import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'your-secret-key-change-in-production';

const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  process.env.JWT_SECRET ||
  ACCESS_SECRET;

const ACCESS_EXPIRES_SECONDS = Math.max(60, Number(process.env.JWT_ACCESS_EXPIRES_SECONDS || 15 * 60));
const REFRESH_EXPIRES_SECONDS = Math.max(
  ACCESS_EXPIRES_SECONDS,
  Number(process.env.JWT_REFRESH_EXPIRES_SECONDS || 30 * 24 * 60 * 60)
);
const LEGACY_EXPIRES_SECONDS = Math.max(ACCESS_EXPIRES_SECONDS, Number(process.env.JWT_LEGACY_EXPIRES_SECONDS || 7 * 24 * 60 * 60));

const ACCESS_COOKIE_NAME = process.env.AUTH_ACCESS_COOKIE || 'umari_access';
const REFRESH_COOKIE_NAME = process.env.AUTH_REFRESH_COOKIE || 'umari_refresh';
const LEGACY_COOKIE_NAME = 'auth_token';

const ACCESS_COOKIE_MAX_AGE = Math.max(60, Number(process.env.AUTH_ACCESS_COOKIE_MAX_AGE || 15 * 60));
const REFRESH_COOKIE_MAX_AGE = Math.max(
  ACCESS_COOKIE_MAX_AGE,
  Number(process.env.AUTH_REFRESH_COOKIE_MAX_AGE || 30 * 24 * 60 * 60)
);
const LEGACY_COOKIE_MAX_AGE = Math.max(ACCESS_COOKIE_MAX_AGE, Number(7 * 24 * 60 * 60));

const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
  subscription_status: 'free' | 'active' | 'expired';
}

type JwtPayload = TokenPayload & {
  token_type?: 'access' | 'refresh';
};

function isTokenPayload(value: unknown): value is TokenPayload {
  const payload = value as TokenPayload | null;
  return Boolean(payload?.id && payload?.email && payload?.role && payload?.subscription_status);
}

function verifyWithSecret(
  token: string,
  secret: string,
  expectedType?: 'access' | 'refresh'
): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (!isTokenPayload(decoded)) return null;
    if (expectedType && decoded.token_type && decoded.token_type !== expectedType) return null;
    if (expectedType === 'refresh' && decoded.token_type !== 'refresh') return null;
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      subscription_status: decoded.subscription_status,
    };
  } catch {
    return null;
  }
}

function setCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, token_type: 'access' }, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_SECONDS,
    algorithm: 'HS256',
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, token_type: 'refresh' }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_SECONDS,
    algorithm: 'HS256',
  });
};

export const generateLegacyToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: LEGACY_EXPIRES_SECONDS,
    algorithm: 'HS256',
  });
};

// Backward-compatible export used by existing routes.
export const generateToken = (payload: TokenPayload): string => generateAccessToken(payload);

export const verifyToken = (token: string): TokenPayload | null => {
  return verifyWithSecret(token, ACCESS_SECRET, 'access') || verifyWithSecret(token, ACCESS_SECRET);
};

export const verifyRefreshToken = (token: string): TokenPayload | null => {
  return verifyWithSecret(token, REFRESH_SECRET, 'refresh');
};

export const setAuthCookies = (response: NextResponse, payload: TokenPayload): NextResponse => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const legacyToken = generateLegacyToken(payload);

  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, setCookieOptions(ACCESS_COOKIE_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, setCookieOptions(REFRESH_COOKIE_MAX_AGE));
  response.cookies.set(LEGACY_COOKIE_NAME, legacyToken, setCookieOptions(LEGACY_COOKIE_MAX_AGE));
  return response;
};

export const clearAuthCookiesOnResponse = (response: NextResponse): NextResponse => {
  const options = {
    ...setCookieOptions(0),
    maxAge: 0,
    expires: new Date(0),
  };
  response.cookies.set(ACCESS_COOKIE_NAME, '', options);
  response.cookies.set(REFRESH_COOKIE_NAME, '', options);
  response.cookies.set(LEGACY_COOKIE_NAME, '', options);
  return response;
};

/**
 * Legacy helper retained for compatibility.
 * New code should use setAuthCookies(response, payload).
 */
export const setAuthCookie = (token: string) => {
  const cookieStore = cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, token, setCookieOptions(ACCESS_COOKIE_MAX_AGE));
  cookieStore.set(LEGACY_COOKIE_NAME, token, setCookieOptions(LEGACY_COOKIE_MAX_AGE));
};

export const getAuthToken = async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE_NAME)?.value || cookieStore.get(LEGACY_COOKIE_NAME)?.value;
};

export const getRefreshToken = async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value;
};

export const getCurrentUser = async (): Promise<TokenPayload | null> => {
  const accessToken = await getAuthToken();
  if (accessToken) {
    const accessPayload = verifyToken(accessToken);
    if (accessPayload) return accessPayload;
  }

  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    return verifyRefreshToken(refreshToken);
  }

  return null;
};

export const clearAuthCookie = () => {
  const cookieStore = cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
};

export const hashPassword = async (password: string): Promise<string> => {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

export const AUTH_COOKIE_NAMES = {
  access: ACCESS_COOKIE_NAME,
  refresh: REFRESH_COOKIE_NAME,
  legacy: LEGACY_COOKIE_NAME,
};
