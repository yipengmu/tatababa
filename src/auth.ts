import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import type { Request, Response } from "express";

const COOKIE_NAME = "tatababa_admin";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

interface AdminSession {
  sub: string;
  exp: number;
  csrf: string;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function sessionSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  return isProduction() ? null : "tatababa-local-session-secret";
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeSession(session: AdminSession): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

function decodeSession(token: string | undefined): AdminSession | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signPayload(payload, secret), signature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (
      parsed.sub !== adminUsername() ||
      !Number.isInteger(parsed.exp) ||
      parsed.exp <= Math.floor(Date.now() / 1000) ||
      typeof parsed.csrf !== "string" ||
      parsed.csrf.length < 20
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function adminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

function passwordMatchesHash(password: string, encodedHash: string): boolean {
  const [algorithm, salt, expectedHex] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex || !/^[a-f0-9]+$/i.test(expectedHex)) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function isAuthConfigured(): boolean {
  if (!isProduction()) return true;
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD_HASH &&
      process.env.AUTH_SECRET &&
      process.env.AUTH_SECRET.length >= 32
  );
}

export function usesLocalDevelopmentCredentials(): boolean {
  return !isProduction() && !process.env.ADMIN_PASSWORD_HASH;
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  if (!isAuthConfigured() || !safeEqual(username, adminUsername())) return false;
  if (process.env.ADMIN_PASSWORD_HASH) {
    return passwordMatchesHash(password, process.env.ADMIN_PASSWORD_HASH);
  }
  return !isProduction() && safeEqual(password, "tatababa-local");
}

export function setAdminSession(response: Response, request: Request): AdminSession | null {
  const session: AdminSession = {
    sub: adminUsername(),
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    csrf: randomBytes(24).toString("base64url")
  };
  const token = encodeSession(session);
  if (!token) return null;

  const forwardedProtocol = request.header("x-forwarded-proto");
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: request.secure || forwardedProtocol === "https" || isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS * 1000
  });
  return session;
}

export function clearAdminSession(response: Response): void {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/"
  });
}

export function getAdminSession(request: Request): AdminSession | null {
  const token = (request.cookies as Record<string, string | undefined> | undefined)?.[COOKIE_NAME];
  return decodeSession(token);
}

export function hasValidCsrf(request: Request, session: AdminSession): boolean {
  const submitted = request.header("x-csrf-token");
  return Boolean(submitted && safeEqual(submitted, session.csrf));
}
