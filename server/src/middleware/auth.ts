import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../utils/auth.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Check authorization header first, then cookie
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
      },
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session. Please log in again.',
      },
    });
    return;
  }

  req.user = payload;
  next();
}
