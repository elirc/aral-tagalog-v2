import { createHash, randomBytes } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env";

const secret = new TextEncoder().encode(env.jwtSecret);

export const hashPassword = (password: string) => argon2Hash(password);
export const verifyPassword = (hash: string, password: string) =>
  argon2Verify(hash, password).catch(() => false);

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.accessTokenTtl)
    .sign(secret);
}

export function newRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(48).toString("base64url");
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + env.refreshTokenTtlMs) };
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

/** preHandler: requires a valid Bearer access token, sets request.userId */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return reply.code(401).send({ error: "missing token" });
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub)) {
      throw new Error("invalid subject");
    }
    req.userId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "invalid token" });
  }
}
