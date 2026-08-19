import { defineConfig } from "astro/config";

const site = process.env.PUBLIC_SITE_URL || "http://localhost:4321";
const configuredBase = process.env.PUBLIC_BASE_PATH || "/";
const base =
  configuredBase === "/" ? "/" : `/${configuredBase.replace(/^\/|\/$/g, "")}`;

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "ignore",
  build: {
    assets: "_assets",
    inlineStylesheets: "always",
  },
  vite: {
    define: {
      __API_BASE_URL__: JSON.stringify(
        process.env.PUBLIC_API_BASE_URL || "http://localhost:8787",
      ),
      __COMMENTS_ENABLED__: JSON.stringify(
        (process.env.PUBLIC_COMMENTS_ENABLED || "true") === "true",
      ),
      __TURNSTILE_SITE_KEY__: JSON.stringify(
        process.env.PUBLIC_TURNSTILE_SITE_KEY || "",
      ),
    },
  },
});
