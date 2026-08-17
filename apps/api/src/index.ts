import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { loginSchema } from "@mums-bookshelf/shared/schemas";
import { login, logout, refresh, requireAuth } from "./auth";
import {
  createComment,
  deleteComment,
  listAdminComments,
  listPublicComments,
  moderateComment,
} from "./comments";
import { exportData } from "./export";
import {
  getPagesDeploymentStatus,
  triggerPagesDeployment,
} from "./deployments";
import {
  ApiError,
  corsMiddleware,
  parseJsonBody,
  requireAllowedMutationOrigin,
  success,
} from "./http";
import { getPublicSettings, updateSettings } from "./settings";
import type { AppEnvironment } from "./types";
import {
  archiveWork,
  createWork,
  getAdminWork,
  getPublicWork,
  listAdminWorks,
  listPublicWorks,
  patchWork,
  publishAllDrafts,
  replaceWork,
} from "./works";

const app = new Hono<AppEnvironment>();

app.use("*", async (context, next) => {
  context.set("requestId", crypto.randomUUID());
  context.header("X-Request-Id", context.get("requestId"));
  await next();
});
app.use("*", secureHeaders());
app.use("/api/*", corsMiddleware);
app.use("/api/v1/auth/*", async (context, next) => {
  context.header("Cache-Control", "no-store, private");
  if (context.req.method === "POST")
    return requireAllowedMutationOrigin(context, next);
  return next();
});
app.use("/api/v1/admin/*", requireAuth);
app.use("/api/v1/admin/*", async (context, next) => {
  if (context.req.method !== "GET")
    return requireAllowedMutationOrigin(context, next);
  return next();
});

app.get("/", (context) =>
  success(context, { service: "author-library-api", version: "v1" }),
);
app.get("/api/v1/works", listPublicWorks);
app.get("/api/v1/works/:slug", getPublicWork);
app.get("/api/v1/settings/public", getPublicSettings);
app.get("/api/v1/works/:id/comments", listPublicComments);
app.post(
  "/api/v1/works/:id/comments",
  requireAllowedMutationOrigin,
  createComment,
);

app.post("/api/v1/auth/login", async (context) => {
  const parsed = loginSchema.safeParse(await parseJsonBody(context, 10_000));
  if (!parsed.success)
    throw new ApiError(
      422,
      "validation_failed",
      "Username and password are required.",
    );
  return success(
    context,
    await login(context, parsed.data.username, parsed.data.password),
  );
});
app.post("/api/v1/auth/refresh", async (context) =>
  success(context, await refresh(context)),
);
app.post("/api/v1/auth/logout", async (context) => {
  await logout(context);
  return success(context, { loggedOut: true });
});
app.get("/api/v1/auth/session", requireAuth, (context) =>
  success(context, { user: context.get("user") }),
);

app.get("/api/v1/admin/works", listAdminWorks);
app.get("/api/v1/admin/works/:id", getAdminWork);
app.post("/api/v1/admin/works", createWork);
app.post("/api/v1/admin/works/publish-all", publishAllDrafts);
app.put("/api/v1/admin/works/:id", replaceWork);
app.patch("/api/v1/admin/works/:id", patchWork);
app.delete("/api/v1/admin/works/:id", archiveWork);
app.get("/api/v1/admin/settings", getPublicSettings);
app.put("/api/v1/admin/settings", updateSettings);
app.get("/api/v1/admin/comments", listAdminComments);
app.patch("/api/v1/admin/comments/:id", moderateComment);
app.delete("/api/v1/admin/comments/:id", deleteComment);
app.get("/api/v1/admin/export", exportData);
app.get("/api/v1/admin/deployments/pages", getPagesDeploymentStatus);
app.post("/api/v1/admin/deployments/pages", triggerPagesDeployment);

app.notFound((context) =>
  context.json(
    {
      error: {
        code: "not_found",
        message: "The requested resource was not found.",
      },
      requestId: context.get("requestId"),
    },
    404,
  ),
);

app.onError((error, context) => {
  const requestId = context.get("requestId");
  if (error instanceof ApiError) {
    return context.json(
      { error: { code: error.code, message: error.message }, requestId },
      error.status,
    );
  }
  if (error instanceof ZodError) {
    return context.json(
      {
        error: {
          code: "validation_failed",
          message: error.issues[0]?.message || "Validation failed.",
        },
        requestId,
      },
      422,
    );
  }
  console.error(
    JSON.stringify({
      event: "unhandled_error",
      requestId,
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage:
        error instanceof Error ? error.message : "Unknown thrown value",
    }),
  );
  return context.json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred.",
      },
      requestId,
    },
    500,
  );
});

export { app };
export default app;
