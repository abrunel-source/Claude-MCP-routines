import { createHash, randomBytes } from 'node:crypto';

/** Generate a high-entropy opaque token (for links/refresh tokens). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Hash a token for at-rest storage (never store raw link/refresh tokens). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
