export interface Bindings {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  AUTH_TOKEN_ISSUER: string;
  AUTH_ACCESS_TOKEN_TTL_SECONDS: string;
  AUTH_REFRESH_TOKEN_TTL_SECONDS: string;
  JWT_SIGNING_SECRET: string;
  PASSWORD_PEPPER: string;
  IP_HASH_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  ENVIRONMENT: string;
  PUBLIC_COMMENTS_ENABLED: string;
}

export interface AuthUser {
  id: string;
  username: string;
  sessionId: string;
}

export interface Variables {
  requestId: string;
  user?: AuthUser;
}

export type AppEnvironment = {
  Bindings: Bindings;
  Variables: Variables;
};
