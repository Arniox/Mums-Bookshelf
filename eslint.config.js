import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/.astro/**",
      "**/.wrangler/**",
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,astro}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.worker,
        __API_BASE_URL__: "readonly",
        __COMMENTS_ENABLED__: "readonly",
        __TURNSTILE_SITE_KEY__: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["apps/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@mums-bookshelf/shared",
              message:
                "Use a runtime-safe shared subpath such as /schemas or /content in the Worker.",
            },
          ],
        },
      ],
    },
  },
];
