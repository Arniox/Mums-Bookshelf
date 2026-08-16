import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index";
import { createAccessToken, hashPassword } from "../src/crypto";
import type { Bindings } from "../src/types";

class FakeStatement {
  values: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly database: FakeDatabase,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async run() {
    if (this.sql.includes("INSERT INTO works") && this.database.slugConflict) {
      throw new Error("UNIQUE constraint failed: works.slug");
    }
    return { success: true, meta: { changes: 1 } };
  }

  async first<T>() {
    if (this.sql.includes("SELECT count FROM rate_limits"))
      return { count: this.database.rateCount } as T;
    if (this.sql.includes("FROM admin_users WHERE username"))
      return this.database.loginUser as T;
    if (this.sql.includes("FROM sessions s JOIN admin_users")) {
      return this.database.session as T;
    }
    return null;
  }

  async all() {
    return { success: true, results: [], meta: {} };
  }
}

class FakeDatabase {
  statements: FakeStatement[] = [];
  loginUser: Record<string, unknown> | null = null;
  session: Record<string, unknown> | null = null;
  rateCount = 1;
  slugConflict = false;

  prepare(sql: string) {
    const statement = new FakeStatement(sql, this);
    this.statements.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  }
}

function bindings(database: FakeDatabase): Bindings {
  return {
    DB: database as unknown as D1Database,
    ALLOWED_ORIGINS: "https://allowed.example",
    AUTH_TOKEN_ISSUER: "author-library-api",
    AUTH_ACCESS_TOKEN_TTL_SECONDS: "900",
    AUTH_REFRESH_TOKEN_TTL_SECONDS: "2592000",
    JWT_SIGNING_SECRET: "jwt-secret-that-is-long-enough-for-tests",
    PASSWORD_PEPPER: "password-pepper-that-is-long-enough",
    IP_HASH_SECRET: "ip-hash-secret-that-is-long-enough",
    GITHUB_PAGES_DEPLOY_TOKEN: "github-token-for-tests",
    GITHUB_REPOSITORY: "Arniox/Mums-Bookshelf",
    GITHUB_PAGES_WORKFLOW: "deploy-pages.yml",
    GITHUB_DEFAULT_BRANCH: "main",
    ENVIRONMENT: "test",
    PUBLIC_COMMENTS_ENABLED: "false",
  };
}

describe("API routes", () => {
  let database: FakeDatabase;
  let env: Bindings;

  beforeEach(() => {
    vi.restoreAllMocks();
    database = new FakeDatabase();
    env = bindings(database);
  });

  it("returns a generic failed-login response", async () => {
    const response = await app.request(
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.0.2.1",
        },
        body: JSON.stringify({
          username: "author",
          password: "incorrect-password",
        }),
      },
      env,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: {
        code: "invalid_credentials",
        message: "Username or password is incorrect.",
      },
    });
  });

  it("creates a server-backed session after a successful login", async () => {
    database.loginUser = {
      id: "user-1",
      username: "author",
      enabled: 1,
      password_hash: await hashPassword(
        "correct-password",
        env.PASSWORD_PEPPER,
      ),
    };
    const response = await app.request(
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "author",
          password: "correct-password",
        }),
      },
      env,
    );
    const payload = (await response.json()) as {
      data: { accessToken: string };
    };
    expect(response.status).toBe(200);
    expect(payload.data.accessToken.split(".")).toHaveLength(3);
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-author_refresh=",
    );
  });

  it("rate limits repeated login attempts", async () => {
    database.rateCount = 8;
    const response = await app.request(
      "/api/v1/auth/login",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "author",
          password: "incorrect-password",
        }),
      },
      env,
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { code: "rate_limited" },
    });
  });

  it("rejects unauthorized admin mutations before touching D1", async () => {
    const response = await app.request(
      "/api/v1/admin/works",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      },
      env,
    );
    expect(response.status).toBe(401);
    expect(database.statements).toHaveLength(0);
  });

  it("rejects an access token whose server session is expired", async () => {
    const accessToken = await createAccessToken(
      env,
      { id: "user-1", username: "author" },
      "session-1",
    );
    database.session = {
      revoked_at: null,
      expires_at: "2000-01-01T00:00:00Z",
      enabled: 1,
    };
    const response = await app.request(
      "/api/v1/admin/works",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      env,
    );
    expect(response.status).toBe(401);
  });

  it("rejects CORS preflight from an unlisted origin", async () => {
    const response = await app.request(
      "/api/v1/works",
      { method: "OPTIONS", headers: { Origin: "https://evil.example" } },
      env,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("filters public work queries to published status", async () => {
    const response = await app.request("/api/v1/works", {}, env);
    expect(response.status).toBe(200);
    expect(
      database.statements.some((statement) =>
        statement.sql.includes("status = 'published'"),
      ),
    ).toBe(true);
    expect(
      database.statements.some((statement) =>
        statement.sql.includes("status = 'archived'"),
      ),
    ).toBe(false);
  });

  it("returns validation errors for invalid work payloads", async () => {
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/works",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "" }),
      },
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "validation_failed" },
    });
  });

  it("returns a conflict when a work slug is already in use", async () => {
    database.slugConflict = true;
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/works",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: "existing-work",
          title: "Existing Work",
          status: "draft",
          publicationType: "short-story",
          blurb: "A valid blurb.",
          contentVisibility: "external-only",
          socialEmbedEnabled: false,
          genres: [],
          tags: [],
          featured: false,
        }),
      },
      env,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "slug_conflict" },
    });
  });

  it("allows authenticated comment moderation", async () => {
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/comments/comment-1",
      {
        method: "PATCH",
        headers: {
          Origin: "https://allowed.example",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ moderationStatus: "approved" }),
      },
      env,
    );
    expect(response.status).toBe(200);
    expect(
      database.statements.some((statement) =>
        statement.sql.includes("UPDATE comments SET moderation_status"),
      ),
    ).toBe(true);
  });

  it("dispatches the Pages workflow for an authenticated administrator", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        workflow_run_id: 123,
        html_url: "https://github.com/Arniox/Mums-Bookshelf/actions/runs/123",
      }),
    );
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/deployments/pages",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          Authorization: `Bearer ${accessToken}`,
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        queued: true,
        runId: 123,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/Arniox/Mums-Bookshelf/actions/workflows/deploy-pages.yml/dispatches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ref: "main" }),
      }),
    );
  });

  it("reports when automatic Pages deployment is not configured", async () => {
    delete env.GITHUB_PAGES_DEPLOY_TOKEN;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/deployments/pages",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          Authorization: `Bearer ${accessToken}`,
        },
      },
      env,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "deployment_not_configured" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

async function activeAccessToken(database: FakeDatabase, env: Bindings) {
  database.session = {
    revoked_at: null,
    expires_at: "2999-01-01T00:00:00Z",
    enabled: 1,
  };
  return createAccessToken(
    env,
    { id: "user-1", username: "author" },
    "session-1",
  );
}
