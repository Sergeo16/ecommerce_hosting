/**
 * Auth : Argon2id + JWT + refresh tokens (usage serveur uniquement — API routes).
 * Le middleware utilise @/lib/jwt pour éviter d'importer argon2 en Edge.
 */
import * as argon2 from 'argon2';
import * as jose from 'jose';
import { prisma } from './db';
import type { Role } from '@prisma/client';
import { verifyAccessToken as verifyJwt, type TokenPayload } from './jwt';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'change-me-in-production');
const REFRESH_SECRET = new TextEncoder().encode(process.env.REFRESH_SECRET ?? 'refresh-change-me');
/** Durée de vie de l’access token (alignée sur la session : déconnexion uniquement au clic sur « Déconnexion »). */
const ACCESS_TTL = '7d';
const REFRESH_TTL = '7d';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export type { TokenPayload } from './jwt';

export async function signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(JWT_SECRET);
}

export async function signRefreshToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  const token = await new jose.SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setExpirationTime(REFRESH_TTL)
    .sign(REFRESH_SECRET);
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

export const verifyAccessToken = verifyJwt;

export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, REFRESH_SECRET);
    const t = await prisma.refreshToken.findUnique({ where: { token } });
    if (!t || t.expiresAt < new Date()) return null;
    return { userId: payload.sub as string };
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

/** Vérifie si l'utilisateur a le rôle (ou un rôle supérieur) */
export function hasRole(userRole: Role, required: Role): boolean {
  const hierarchy: Role[] = ['SUPER_ADMIN', 'SUPPLIER', 'AFFILIATE', 'COURIER', 'CLIENT'];
  return hierarchy.indexOf(userRole) <= hierarchy.indexOf(required);
}

export function isSuperAdmin(role: Role): boolean {
  return role === 'SUPER_ADMIN';
}
