import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { User, UserResponse } from '@celebration-planner/shared';

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
}

const BCRYPT_SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  if (!env.JWT_SECRET) {
    // Production misconfiguration: refuse to sign rather than use an insecure secret.
    throw new Error('JWT signing is unavailable: JWT_SECRET is not securely configured.');
  }
  return jwt.sign({ ...payload }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload | null {
  if (!env.JWT_SECRET) return null;
  try {
    // Explicitly pin algorithm to HS256 to prevent algorithm-confusion or "none" attacks
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as TokenPayload;
    if (!decoded || !decoded.id || !decoded.email) {
      return null;
    }
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

export function toUserResponse(user: User | { id: string; name: string; email: string; createdAt: string; updatedAt: string }): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
