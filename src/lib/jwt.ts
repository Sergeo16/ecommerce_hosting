/**
 * JWT uniquement (jose) — compatible Edge / middleware.
 * Aucune dépendance native (argon2, prisma) pour que le middleware puisse l'importer.
 */
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'change-me-in-production');

export type TokenPayload = {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
};

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
