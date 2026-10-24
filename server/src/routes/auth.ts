import { Router, Request, Response, NextFunction } from 'express';
import { RegisterInputSchema, LoginInputSchema } from '@celebration-planner/shared';
import { userStore } from '../services/userStore.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  toUserResponse,
} from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { env } from '../config/env.js';
import {
  generateCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
  CSRF_COOKIE_NAME,
} from '../middleware/csrf.js';

const router = Router();

// Apply auth rate limiter to register and login
router.use('/register', authRateLimiter);
router.use('/login', authRateLimiter);

const COOKIE_NAME = 'auth_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  });
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RegisterInputSchema.parse(req.body);
    const existing = await userStore.findByEmail(parsed.email);

    if (existing) {
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(parsed.password);
    const user = await userStore.create({
      name: parsed.name,
      email: parsed.email,
      passwordHash,
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const csrfToken = generateCsrfToken();
    setAuthCookie(res, token);
    setCsrfCookie(res, csrfToken);

    res.status(201).json({
      success: true,
      data: {
        user: toUserResponse(user),
        token,
        csrfToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = LoginInputSchema.parse(req.body);
    const user = await userStore.findByEmail(parsed.email);

    if (!user) {
      // Timing attack mitigation
      await comparePassword(parsed.password, '$2a$10$abcdefghijklmnopqrstuvwxyz12345678901234567890123456');
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
      return;
    }

    const isValid = await comparePassword(parsed.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const csrfToken = generateCsrfToken();
    setAuthCookie(res, token);
    setCsrfCookie(res, csrfToken);

    res.status(200).json({
      success: true,
      data: {
        user: toUserResponse(user),
        token,
        csrfToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/csrf-token ────────────────────────────────────────────────
router.get('/csrf-token', (req: Request, res: Response) => {
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);
  }
  res.status(200).json({
    success: true,
    data: {
      csrfToken,
    },
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userStore.findById(req.user!.id);
    if (!user) {
      clearAuthCookie(res);
      clearCsrfCookie(res);
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found. Please log in again.',
        },
      });
      return;
    }

    let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      setCsrfCookie(res, csrfToken);
    }

    res.status(200).json({
      success: true,
      data: {
        user: toUserResponse(user),
        csrfToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  clearCsrfCookie(res);
  res.status(200).json({
    success: true,
    data: {
      message: 'Logged out successfully.',
    },
  });
});

export default router;
