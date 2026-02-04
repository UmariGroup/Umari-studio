/**
 * 🔐 Password Security Utilities
 */

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 128;

/**
 * Validate password strength
 * Requirements:
 * - Minimum 6 characters
 * - Maximum 128 characters
 * - No validation of complexity (user choice)
 */
export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
    };
  }

  return { valid: true };
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  if (email.length > 255) {
    return { valid: false, error: 'Email is too long' };
  }

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
};

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .trim()
    .substring(0, 255)
    .replace(/[<>]/g, ''); // Remove potential HTML tags
};

/**
 * Generate password reset token (6 digit code)
 */
export const generateResetToken = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Check if password reset token is expired
 */
export const isResetTokenExpired = (createdAt: Date, expiryMinutes: number = 30): boolean => {
  const now = new Date();
  const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
  return diffMinutes > expiryMinutes;
};
