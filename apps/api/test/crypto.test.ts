import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/crypto";
import { allowedOrigins } from "../src/http";

describe("API security helpers", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("a long test password", "a".repeat(32));
    expect(hash).not.toContain("a long test password");
    await expect(
      verifyPassword("a long test password", "a".repeat(32), hash),
    ).resolves.toBe(true);
    await expect(
      verifyPassword("wrong password", "a".repeat(32), hash),
    ).resolves.toBe(false);
  });

  it("rejects unsupported iteration counts without invoking PBKDF2", async () => {
    const hash = await hashPassword("a long test password", "a".repeat(32));
    const unsupportedHash = hash.replace("$100000$", "$210000$");

    await expect(
      verifyPassword("a long test password", "a".repeat(32), unsupportedHash),
    ).resolves.toBe(false);
  });

  it("parses a strict CORS allow-list", () => {
    expect(allowedOrigins("https://one.example, https://two.example")).toEqual(
      new Set(["https://one.example", "https://two.example"]),
    );
    expect(
      allowedOrigins("https://allowed.example").has("https://evil.example"),
    ).toBe(false);
  });
});
