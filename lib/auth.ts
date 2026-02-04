import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '7d'; // 7 days
const BCRYPT_ROUNDS = 12; // 🔐 Strong password hashing

export interface TokenPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
  subscription_status: 'free' | 'active' | 'expired';
}

/**
 * Generate JWT token
 */
export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Set secure cookie with JWT
 */
export const setAuthCookie = (token: string) => {
  const cookieStore = cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  });
};

/**
 * Get token from cookies
 */
export const getAuthToken = async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value;
};

/**
 * Get current user from cookie
 */
export const getCurrentUser = async (): Promise<TokenPayload | null> => {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    return verifyToken(token);
  } catch (error) {
    return null;
  }
};

/**
 * Clear auth cookie
 */
export const clearAuthCookie = () => {
  const cookieStore = cookies();
  cookieStore.delete('auth_token');
};

/**
 * Hash password with bcrypt (12 rounds - strong security)
 * 🔐 Passwords are ALWAYS hashed, never stored in plaintext
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Compare plaintext password with bcrypt hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  if (!password || !hash) {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};
