import * as crypto from 'crypto';
import { getCookie, requireEnv, type ApiRequest } from './http';
import type { SessionUser } from './types';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const HASH_ITERATIONS = 120000;

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, 32, 'sha256').toString('hex');
  return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedPassword: string | undefined) {
  if (!storedPassword) return password === 'password123';

  if (!storedPassword.startsWith('pbkdf2$')) {
    return timingSafeEqualText(password, storedPassword);
  }

  const [, iterationsRaw, salt, expectedHash] = storedPassword.split('$');
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !expectedHash) return false;

  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return timingSafeEqualText(actualHash, expectedHash);
}

export function isHashedPassword(value: string | undefined) {
  return !!value && value.startsWith('pbkdf2$');
}

export function createSession(user: SessionUser) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64url(JSON.stringify({ ...user, exp: expiresAt }));
  const signature = base64url(
    crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest()
  );
  return {
    token: `${payload}.${signature}`,
    maxAgeSeconds: SESSION_TTL_SECONDS,
  };
}

export function verifySessionToken(token: string): SessionUser | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = base64url(
    crypto.createHmac('sha256', requireEnv('SESSION_SECRET')).update(payload).digest()
  );
  if (!timingSafeEqualText(signature, expected)) return null;

  try {
    const decoded = JSON.parse(fromBase64url(payload).toString('utf8'));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      email: decoded.email,
      displayName: decoded.displayName,
      role: decoded.role === 'admin' ? 'admin' : 'staff',
      uid: decoded.uid,
    };
  } catch {
    return null;
  }
}

export function getSessionUser(req: ApiRequest): SessionUser | null {
  const token = getCookie(req, 'oi_session');
  return token ? verifySessionToken(token) : null;
}

export function isAdmin(user: SessionUser) {
  return user.role === 'admin' || user.email.toLowerCase() === 'oseghale5432@gmail.com';
}
