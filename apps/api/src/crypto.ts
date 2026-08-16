import { SignJWT, jwtVerify } from "jose";
import type { Bindings } from "./types";

const encoder = new TextEncoder();
// workerd caps PBKDF2 at 100,000 iterations to protect Workers from CPU abuse.
// Passwords are additionally protected by a server-side pepper and login rate limiting.
const iterations = 100_000;

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export async function hashPassword(
  password: string,
  pepper: string,
  salt?: Uint8Array,
): Promise<string> {
  const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${password}\u0000${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array([...actualSalt]),
      iterations,
    },
    material,
    256,
  );
  return `pbkdf2-sha256$${iterations}$${bytesToBase64(actualSalt)}$${bytesToBase64(new Uint8Array(derived))}`;
}

export async function verifyPassword(
  password: string,
  pepper: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, storedIterations, salt, expected] = stored.split("$");
  if (
    algorithm !== "pbkdf2-sha256" ||
    Number(storedIterations) !== iterations ||
    !salt ||
    !expected
  ) {
    return false;
  }
  const actual = await hashPassword(password, pepper, base64ToBytes(salt));
  return constantTimeEqual(actual, stored);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function jwtKey(secret: string): Uint8Array {
  return encoder.encode(secret);
}

export async function createAccessToken(
  bindings: Bindings,
  user: { id: string; username: string },
  sessionId: string,
): Promise<string> {
  const ttl = Number(bindings.AUTH_ACCESS_TOKEN_TTL_SECONDS);
  return new SignJWT({ username: user.username, sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(bindings.AUTH_TOKEN_ISSUER)
    .setAudience("author-library-admin")
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(jwtKey(bindings.JWT_SIGNING_SECRET));
}

export async function verifyAccessToken(bindings: Bindings, token: string) {
  return jwtVerify(token, jwtKey(bindings.JWT_SIGNING_SECRET), {
    issuer: bindings.AUTH_TOKEN_ISSUER,
    audience: "author-library-admin",
    algorithms: ["HS256"],
  });
}

export function randomToken(bytes = 32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
