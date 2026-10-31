import { describe, it, expect } from 'vitest';
import {
  validateEnvDetailed,
  getJwtSecretProblem,
  detectProduction,
  hasBlockingConfigIssues,
  DEV_JWT_SECRET,
  KNOWN_INSECURE_JWT_SECRETS,
} from '../src/config/env.js';

// Random-looking values assembled at runtime; none of these are real credentials.
const STRONG_SECRET = 'Zq8rT2vLx9Kd4NwBm7Hs1Yc6Pf3Ua5Je0GiVoRtEnQwXz';
const VALID_URI = 'mongodb+srv://user:pw@cluster0.example.mongodb.net/app';

const prodEnv = (overrides: Record<string, unknown> = {}) => ({
  NODE_ENV: 'production',
  JWT_SECRET: STRONG_SECRET,
  MONGODB_URI: VALID_URI,
  ...overrides,
});

describe('Production environment validation (security regression)', () => {
  it('accepts a strong secret and MongoDB URI in production', () => {
    const { env, issues, isProduction } = validateEnvDetailed(prodEnv());
    expect(isProduction).toBe(true);
    expect(hasBlockingConfigIssues(issues)).toBe(false);
    expect(env.JWT_SECRET).toBe(STRONG_SECRET);
    expect(env.NODE_ENV).toBe('production');
  });

  it('rejects a missing JWT_SECRET in production and never substitutes the dev default', () => {
    const { env, issues } = validateEnvDetailed(prodEnv({ JWT_SECRET: undefined }));
    expect(hasBlockingConfigIssues(issues)).toBe(true);
    expect(issues.find((i) => i.variable === 'JWT_SECRET')?.blocking).toBe(true);
    expect(env.JWT_SECRET).toBe('');
    expect(env.JWT_SECRET).not.toBe(DEV_JWT_SECRET);
  });

  it.each(KNOWN_INSECURE_JWT_SECRETS.map((s) => [s]))(
    'rejects known development/example secret %#',
    (secret) => {
      const { env, issues } = validateEnvDetailed(prodEnv({ JWT_SECRET: secret }));
      expect(issues.find((i) => i.variable === 'JWT_SECRET')?.blocking).toBe(true);
      expect(env.JWT_SECRET).toBe('');
    }
  );

  it('rejects short, placeholder-like, and low-variety secrets in production', () => {
    for (const bad of ['short', 'a'.repeat(48), 'please-changeme-' + 'x'.repeat(30), 'abababababababababababababababababab']) {
      const { env, issues } = validateEnvDetailed(prodEnv({ JWT_SECRET: bad }));
      expect(hasBlockingConfigIssues(issues)).toBe(true);
      expect(env.JWT_SECRET).toBe('');
    }
  });

  it('never includes secret or connection-string values in issue messages', () => {
    const badSecret = 'changeme-secret-value-that-must-not-leak-1234567890';
    const { issues } = validateEnvDetailed(
      prodEnv({ JWT_SECRET: badSecret, MONGODB_URI: 'mongodb+srv://admin:SuperSecretPw@bad host/x' })
    );
    const text = JSON.stringify(issues);
    expect(text).not.toContain(badSecret);
    expect(text).not.toContain('SuperSecretPw');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('does not reset unrelated settings when a single variable is invalid (per-variable validation)', () => {
    const { env, issues } = validateEnvDetailed(
      prodEnv({ PORT: 'not-a-number', CORS_ORIGIN: 'https://planner.example.com' })
    );
    expect(issues.some((i) => i.variable === 'PORT')).toBe(true);
    expect(env.CORS_ORIGIN).toBe('https://planner.example.com');
    expect(env.JWT_SECRET).toBe(STRONG_SECRET);
    expect(env.MONGODB_URI).toBeTruthy();
  });

  it('requires MONGODB_URI in production unless ephemeral storage is explicitly allowed', () => {
    const missing = validateEnvDetailed(prodEnv({ MONGODB_URI: undefined }));
    expect(missing.issues.find((i) => i.variable === 'MONGODB_URI')?.blocking).toBe(true);

    const allowed = validateEnvDetailed(prodEnv({ MONGODB_URI: undefined, ALLOW_EPHEMERAL_STORAGE: 'true' }));
    expect(hasBlockingConfigIssues(allowed.issues)).toBe(false);
    expect(allowed.issues.some((i) => i.variable === 'ALLOW_EPHEMERAL_STORAGE' && !i.blocking)).toBe(true);
  });

  it('treats a malformed MONGODB_URI as blocking in production (not silently ignored)', () => {
    const { issues } = validateEnvDetailed(prodEnv({ MONGODB_URI: 'http://not-mongo' }));
    expect(issues.find((i) => i.variable === 'MONGODB_URI')?.blocking).toBe(true);
  });

  it('treats blank dashboard variables as unset', () => {
    const { issues } = validateEnvDetailed(prodEnv({ JWT_SECRET: '   ' }));
    expect(issues.find((i) => i.variable === 'JWT_SECRET')?.blocking).toBe(true);
  });

  it('treats Vercel with unset/unrecognised NODE_ENV as production', () => {
    expect(detectProduction({ VERCEL: '1' })).toBe(true);
    expect(detectProduction({ VERCEL: '1', NODE_ENV: 'staging' })).toBe(true);
    expect(detectProduction({ NODE_ENV: 'production' })).toBe(true);
    const { issues } = validateEnvDetailed({ VERCEL: '1', MONGODB_URI: VALID_URI });
    expect(issues.find((i) => i.variable === 'JWT_SECRET')?.blocking).toBe(true);
  });
});

describe('Development and test workflows are preserved', () => {
  it('keeps the dev default secret and optional MongoDB outside production', () => {
    for (const nodeEnv of ['development', 'test']) {
      const { env, issues, isProduction } = validateEnvDetailed({ NODE_ENV: nodeEnv });
      expect(isProduction).toBe(false);
      expect(hasBlockingConfigIssues(issues)).toBe(false);
      expect(env.JWT_SECRET).toBe(DEV_JWT_SECRET);
      expect(env.MONGODB_URI).toBeUndefined();
    }
  });

  it('defaults to development when nothing is set and not on Vercel', () => {
    const { env, isProduction } = validateEnvDetailed({});
    expect(isProduction).toBe(false);
    expect(env.NODE_ENV).toBe('development');
  });
});

describe('getJwtSecretProblem', () => {
  it('returns null for a strong secret and describes problems without echoing the value', () => {
    expect(getJwtSecretProblem(STRONG_SECRET)).toBeNull();
    const problem = getJwtSecretProblem('tiny-secret') as string;
    expect(problem).toContain('too short');
    expect(problem).not.toContain('tiny-secret');
  });
});

