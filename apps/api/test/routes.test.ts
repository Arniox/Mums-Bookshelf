import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessToken, hashPassword } from "../src/crypto";
import { app } from "../src/index";
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
    if (this.sql.includes("SELECT id FROM works WHERE id"))
      return { id: "work-1" } as T;
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

  it("orders the full admin collection by publication date", async () => {
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/works",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      env,
    );

    expect(response.status).toBe(200);
    const statement = database.statements.find((item) =>
      item.sql.includes("SELECT * FROM works"),
    );
    expect(statement?.sql).toContain(
      "ORDER BY published_at DESC, updated_at DESC",
    );
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
    expect(
      database.statements.some((statement) =>
        statement.sql.includes("SELECT * FROM works"),
      ),
    ).toBe(true);
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
          primaryExternalUrl: "https://example.com/existing-work",
          socialEmbedEnabled: false,
          genres: [],
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

  it("publishes every draft with one database update", async () => {
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/works/publish-all",
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
      data: { published: 1 },
    });
    const statement = database.statements.find((item) =>
      item.sql.includes("WHERE status = 'draft'"),
    );
    expect(statement).toBeDefined();
    expect(statement?.sql).toContain("published_at = COALESCE");
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

  it("rejects reader comments longer than 250 characters", async () => {
    env.PUBLIC_COMMENTS_ENABLED = "true";
    const response = await app.request(
      "/api/v1/works/work-1/comments",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: "a".repeat(251) }),
      },
      env,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "validation_failed",
        message: "Comments must be 250 characters or fewer.",
      },
    });
    expect(database.statements).toHaveLength(0);
  });

  it("approves a valid reader comment for immediate display", async () => {
    env.PUBLIC_COMMENTS_ENABLED = "true";
    const response = await app.request(
      "/api/v1/works/work-1/comments",
      {
        method: "POST",
        headers: {
          Origin: "https://allowed.example",
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.0.2.1",
        },
        body: JSON.stringify({
          displayName: "A reader",
          body: "This stayed with me long after I finished reading.",
        }),
      },
      env,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { approved: true },
    });
    const statement = database.statements.find((item) =>
      item.sql.includes("INSERT INTO comments"),
    );
    expect(statement?.sql).toContain("'approved'");
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

  it("reports when a requested Pages refresh is ready", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        workflow_runs: [
          {
            id: 456,
            status: "completed",
            conclusion: "success",
            html_url:
              "https://github.com/Arniox/Mums-Bookshelf/actions/runs/456",
            created_at: "2026-08-17T00:00:01Z",
            updated_at: "2026-08-17T00:01:00Z",
          },
        ],
      }),
    );
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/deployments/pages?since=2026-08-17T00:00:00Z",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        state: "ready",
        runId: 456,
      },
    });
  });

  it("reports the active Pages refresh step", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/jobs?"))
        return Response.json({
          jobs: [
            {
              name: "validate",
              status: "in_progress",
              conclusion: null,
              steps: [
                { name: "npm ci", status: "completed", conclusion: "success" },
                {
                  name: "npm run build -w @mums-bookshelf/web",
                  status: "in_progress",
                  conclusion: null,
                },
              ],
            },
          ],
        });
      return Response.json({
        workflow_runs: [
          {
            id: 457,
            status: "in_progress",
            conclusion: null,
            html_url:
              "https://github.com/Arniox/Mums-Bookshelf/actions/runs/457",
            created_at: "2026-08-17T00:00:01Z",
            updated_at: "2026-08-17T00:01:00Z",
          },
        ],
      });
    });
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/deployments/pages?since=2026-08-17T00:00:00Z",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { state: "building", stage: "building-pages" },
    });
  });

  it("keeps final Pages deployment near completion while it waits", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/jobs?"))
        return Response.json({
          jobs: [
            {
              name: "validate",
              status: "completed",
              conclusion: "success",
              steps: [],
            },
            {
              name: "Deploy to GitHub Pages",
              status: "queued",
              conclusion: null,
              steps: [],
            },
          ],
        });
      return Response.json({
        workflow_runs: [
          {
            id: 458,
            status: "in_progress",
            conclusion: null,
            html_url:
              "https://github.com/Arniox/Mums-Bookshelf/actions/runs/458",
            created_at: "2026-08-17T00:00:01Z",
            updated_at: "2026-08-17T00:01:00Z",
          },
        ],
      });
    });
    const accessToken = await activeAccessToken(database, env);
    const response = await app.request(
      "/api/v1/admin/deployments/pages?since=2026-08-17T00:00:00Z",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { state: "building", stage: "deploy-waiting" },
    });
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

  it("returns a safe error when GitHub rejects the Pages deployment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("token details must not reach the browser", { status: 403 }),
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
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(body).toContain("website update could not be started");
    expect(body).not.toContain("token details");
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
