import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPassword } from "../src/crypto";

const username = process.argv[2];
if (!username || !/^[a-zA-Z0-9._-]{3,100}$/.test(username)) {
  console.error("Usage: npm run admin:create -- author");
  process.exit(1);
}

const pepper = process.env.PASSWORD_PEPPER;
if (!pepper || pepper.length < 32) {
  console.error(
    "Set PASSWORD_PEPPER to the same strong secret configured for the Worker.",
  );
  process.exit(1);
}

const reader = createInterface({ input: stdin, output: stdout });
const password = await reader.question("Password (input may be visible): ");
const confirmation = await reader.question("Confirm password: ");
reader.close();

if (password !== confirmation || password.length < 8) {
  console.error("Passwords must match and contain at least 8 characters.");
  process.exit(1);
}

const id = crypto.randomUUID();
const hash = await hashPassword(password, pepper);
const now = new Date().toISOString();
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
console.log("\nRun this command from the repository root:\n");
console.log(
  `npx wrangler d1 execute author-library --remote --config apps/api/wrangler.jsonc --command "INSERT INTO admin_users (id, username, password_hash, enabled, created_at, updated_at) VALUES (${quote(id)}, ${quote(username)}, ${quote(hash)}, 1, ${quote(now)}, ${quote(now)});"`,
);
