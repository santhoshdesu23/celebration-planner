import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Sanitizes MongoDB URIs by masking credentials.
 */
export function sanitizeMongoUri(uri?: string): string {
  if (!uri) return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^\s/?#]+)([/\\?#\s]|$)/gi, (_match, proto, authHost, rest) => {
    const lastAt = authHost.lastIndexOf('@');
    if (lastAt === -1) return `${proto}${authHost}${rest}`;
    const auth = authHost.substring(0, lastAt);
    const host = authHost.substring(lastAt + 1);
    const maskedAuth = auth.includes(':') ? '***:***@' : '***@';
    return `${proto}${maskedAuth}${host}${rest}`;
  });
}

/**
 * Sanitizes arbitrary error messages or strings to remove credentials, API keys, tokens, and secrets.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return '';
  return message
    // Mask Database URIs (mongodb, postgres, mysql, redis)
    .replace(/((?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/)([^\s/?#]+)([/\\?#\s]|$)/gi, (_match, proto, authHost, rest) => {
      const lastAt = authHost.lastIndexOf('@');
      if (lastAt === -1) return `${proto}${authHost}${rest}`;
      const auth = authHost.substring(0, lastAt);
      const host = authHost.substring(lastAt + 1);
      const maskedAuth = auth.includes(':') ? '***:***@' : '***@';
      return `${proto}${maskedAuth}${host}${rest}`;
    })
    // Mask Google / Gemini API keys
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, 'AIza***REDACTED***')
    .replace(/([?&]key=)[^&\s]+/gi, '$1***')
    // Mask Bearer tokens & authorization headers
    .replace(/Bearer\s+[a-zA-Z0-9.\-_~/+=]+/gi, 'Bearer ***')
    .replace(/(["']?(?:authorization|auth)["']?\s*[:=]\s*)(["']?)(?:Bearer\s+)?[^"',\r\n]+\2/gi, '$1$2***$2')
    // Mask JWT tokens (header.payload.signature)
    .replace(/eyJ[a-zA-Z0-9_\-]{8,}\.eyJ[a-zA-Z0-9_\-]{8,}\.[a-zA-Z0-9_\-]+/gi, 'eyJ***.eyJ***.***')
    // Mask cookies
    .replace(/(["']?(?:auth_token|csrf_token|connect\.sid)["']?\s*=\s*)(["']?)[^;"'\s]+\2/gi, '$1$2***$2')
    // Mask Quoted Passwords & Secrets (handles JSON {"password": "..."} and secret values with spaces)
    .replace(/(["']?(?:password|passwd|pwd|passphrase|secret(?:[_-]?key)?|client[_-]?secret|api[_-]?key|gemini[_-]?key)["']?\s*[:=]\s*)(["'])(?:\\.|(?!\2).)*\2/gi, '$1$2***$2')
    // Mask Unquoted Passwords & Secrets (in URLs, form bodies, key=value, or YAML-style)
    .replace(/(["']?(?:password|passwd|pwd|passphrase|secret(?:[_-]?key)?|client[_-]?secret|api[_-]?key|gemini[_-]?key)["']?\s*[:=]\s*)(?!["'])([^"'\\,;&\s\r\n]+)/gi, '$1***');
}

/**
 * Extracts a safe, credential-sanitized string representation of an error.
 * Strips raw provider objects, request configs, and stacks to prevent leaking credentials.
 */
export function formatSafeError(err: unknown): string {
  if (!err) return 'Unknown error';
  let message: string;
  if (err instanceof Error) {
    message = `${err.name}: ${err.message}`;
  } else if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const extracted = obj.message || obj.error || obj.code || 'Error';
    message = String(extracted);
  } else {
    message = String(err);
  }
  return sanitizeErrorMessage(message).slice(0, 1000);
}

/**
 * Normalizes MongoDB connection strings by ensuring special characters
 * in credentials (such as unescaped '@' in passwords) are percent-encoded
 * according to RFC 3986 / MongoDB specifications.
 */
export function normalizeMongoUri(uri: string): string {
  const trimmed = uri.trim().replace(/^["']|["']$/g, '');
  const match = trimmed.match(/^(mongodb(?:\+srv)?:\/\/)([^/]+)(.*)$/i);
  if (!match) return trimmed;

  const [, protocol, userHost, rest] = match;
  const lastAt = userHost.lastIndexOf('@');
  if (lastAt === -1) return trimmed; // No credentials in URI

  const userPass = userHost.substring(0, lastAt);
  const host = userHost.substring(lastAt + 1);
  const colonIdx = userPass.indexOf(':');

  if (colonIdx === -1) {
    const decodedUser = decodeURIComponent(userPass);
    return `${protocol}${encodeURIComponent(decodedUser)}@${host}${rest}`;
  }

  const user = userPass.substring(0, colonIdx);
  const pass = userPass.substring(colonIdx + 1);

  // Safely percent-encode username and password (idempotent if already encoded)
  try {
    const decodedUser = decodeURIComponent(user);
    const decodedPass = decodeURIComponent(pass);
    return `${protocol}${encodeURIComponent(decodedUser)}:${encodeURIComponent(decodedPass)}@${host}${rest}`;
  } catch {
    return trimmed;
  }
}

/**
 * Locates and loads .env files from candidate paths (process.cwd(), parent dirs, workspace root).
 * Preserves existing process.env variables (does not overwrite system/CI environment).
 */
export function loadEnvironment(): { loaded: boolean; paths: string[] } {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    process.env.DOTENV_CONFIG_PATH,
    process.env.ENV_FILE,
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(currentDir, '../../.env'),
    path.resolve(currentDir, '../../../.env'),
  ].filter((p): p is string => Boolean(p));

  const loadedPaths: string[] = [];
  const checked = new Set<string>();

  for (const envPath of candidatePaths) {
    const resolved = path.normalize(envPath);
    if (!checked.has(resolved) && fs.existsSync(resolved)) {
      checked.add(resolved);
      dotenv.config({ path: resolved, override: false });
      loadedPaths.push(resolved);
    }
  }

  return {
    loaded: loadedPaths.length > 0,
    paths: loadedPaths,
  };
}

// Automatically load environment before schema validation
loadEnvironment();

/**
 * Development-only JWT secret. It is public (it ships in the repository and `.env.example`),
 * so it is accepted ONLY outside production and is never used to sign production tokens.
 */
export const DEV_JWT_SECRET = 'celebration-planner-dev-secret-key-32chars';

/** Secrets that appear in the repository, docs, or tests and must never be used in production. */
export const KNOWN_INSECURE_JWT_SECRETS: readonly string[] = [
  DEV_JWT_SECRET,
  'your-secure-random-jwt-secret-key-32chars',
  'ci_test_secret_32_chars_minimum_value!',
];

const INSECURE_JWT_FRAGMENTS = [
  'dev-secret',
  'your-secure',
  'your_secure',
  'your_jwt',
  'changeme',
  'change-me',
  'replace-me',
  'placeholder',
  'example',
  'insecure',
];

const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

/**
 * Returns a human-readable problem with a production JWT secret, or null when acceptable.
 * Never includes the secret value in the message.
 */
export function getJwtSecretProblem(secret: string | undefined): string | null {
  if (!secret) {
    return 'is missing. Set a unique random value of at least 32 characters.';
  }
  if (secret.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
    return `is too short (${secret.length} characters). Production requires at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH}.`;
  }
  const lowered = secret.toLowerCase();
  if (
    KNOWN_INSECURE_JWT_SECRETS.some((known) => known.toLowerCase() === lowered) ||
    INSECURE_JWT_FRAGMENTS.some((fragment) => lowered.includes(fragment))
  ) {
    return 'matches a known development/example value. Generate a unique random secret.';
  }
  if (new Set(secret).size < 10) {
    return 'has too little character variety to be a secure random secret.';
  }
  return null;
}

/**
 * Environment variable schema. Each field is validated INDIVIDUALLY by `validateEnvDetailed`,
 * so one bad variable never causes unrelated (or security-critical) settings to be reset.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  // Optional outside production: development/test fall back to the in-memory store.
  MONGODB_URI: z
    .string()
    .min(1)
    .optional()
    .transform((val) => (val ? normalizeMongoUri(val) : val))
    .refine(
      (val) => {
        if (!val) return true;
        try {
          new URL(val);
          return val.startsWith('mongodb://') || val.startsWith('mongodb+srv://');
        } catch {
          return false;
        }
      },
      { message: 'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection string' }
    ),
  // Optional: falls back to the deterministic domain generator if not configured
  GEMINI_API_KEY: z.string().min(10).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // The development default is only honoured outside production (see validateEnvDetailed).
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    .default(DEV_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Explicit opt-in to run production without MongoDB (data is lost on every cold start).
  ALLOW_EPHEMERAL_STORAGE: z.enum(['true', 'false']).default('false'),
});

export type Env = z.infer<typeof EnvSchema>;

export interface ConfigIssue {
  variable: string;
  /** Safe, actionable text. Never contains a secret value. */
  message: string;
  /** Blocking issues make the API fail closed (503) in production. */
  blocking: boolean;
}

export interface EnvValidationResult {
  env: Env;
  issues: ConfigIssue[];
  isProduction: boolean;
}

/**
 * Production when NODE_ENV=production, or on Vercel when NODE_ENV is unset/unrecognised.
 * An unrecognised NODE_ENV on Vercel must never silently downgrade to development.
 */
export function detectProduction(raw: Record<string, unknown>): boolean {
  const nodeEnv = typeof raw.NODE_ENV === 'string' ? raw.NODE_ENV.trim() : undefined;
  if (nodeEnv === 'production') return true;
  if (nodeEnv === 'development' || nodeEnv === 'test') return false;
  return Boolean(raw.VERCEL);
}

/** Treats blank values (common for empty hosting-dashboard variables) as unset. */
function readRaw(raw: Record<string, unknown>, key: string): unknown {
  const value = raw[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return value;
}

/**
 * Validates each environment variable independently and reports safe, actionable issues.
 * - Production: JWT_SECRET must be strong and non-default; MONGODB_URI is required unless
 *   ALLOW_EPHEMERAL_STORAGE=true. Failures are recorded as blocking issues - NO development
 *   defaults are substituted for security-critical settings.
 * - Development/test: safe local defaults are preserved.
 */
export function validateEnvDetailed(
  customEnv: Record<string, unknown> = process.env
): EnvValidationResult {
  const isProduction = detectProduction(customEnv);
  const issues: ConfigIssue[] = [];
  const resolved: Record<string, unknown> = {};

  for (const key of Object.keys(EnvSchema.shape) as Array<keyof Env>) {
    const fieldSchema = EnvSchema.shape[key] as z.ZodTypeAny;
    const result = fieldSchema.safeParse(readRaw(customEnv, key));
    if (result.success) {
      resolved[key] = result.data;
      continue;
    }

    // Invalid value: report variable name + rule only (never the value).
    const rule = result.error.issues[0]?.message ?? 'is invalid';
    const securityCritical = key === 'JWT_SECRET' || key === 'MONGODB_URI' || key === 'NODE_ENV';
    issues.push({
      variable: key,
      message: `${key}: ${rule}`,
      blocking: isProduction && securityCritical,
    });
    const fallback = fieldSchema.safeParse(undefined);
    resolved[key] = fallback.success ? fallback.data : undefined;
  }

  const parsed = resolved as Env;
  parsed.NODE_ENV = isProduction ? 'production' : parsed.NODE_ENV === 'test' ? 'test' : 'development';

  if (isProduction) {
    // JWT_SECRET: never accept a missing, short, or publicly known secret.
    const problem = getJwtSecretProblem(readRaw(customEnv, 'JWT_SECRET') as string | undefined);
    if (problem) {
      if (!issues.some((i) => i.variable === 'JWT_SECRET')) {
        issues.push({ variable: 'JWT_SECRET', message: `JWT_SECRET ${problem}`, blocking: true });
      }
      parsed.JWT_SECRET = ''; // unusable on purpose: signing/verification refuse to run
    }

    const hasMongo = Boolean(parsed.MONGODB_URI);
    const ephemeralAllowed = parsed.ALLOW_EPHEMERAL_STORAGE === 'true';
    if (!hasMongo && !issues.some((i) => i.variable === 'MONGODB_URI')) {
      if (!ephemeralAllowed) {
        issues.push({
          variable: 'MONGODB_URI',
          message:
            'MONGODB_URI is required in production. Set it, or set ALLOW_EPHEMERAL_STORAGE=true to accept non-durable in-memory data.',
          blocking: true,
        });
      }
    }
    if (ephemeralAllowed) {
      issues.push({
        variable: 'ALLOW_EPHEMERAL_STORAGE',
        message: 'ALLOW_EPHEMERAL_STORAGE=true: production data is NOT durable and resets on every cold start.',
        blocking: false,
      });
    }
  } else if (!readRaw(customEnv, 'JWT_SECRET') && customEnv.NODE_ENV !== 'test') {
    issues.push({
      variable: 'JWT_SECRET',
      message: 'JWT_SECRET not set: using the public development secret (development only).',
      blocking: false,
    });
  }

  return { env: parsed, issues, isProduction };
}

/** Backwards-compatible helper returning only the validated environment. */
export function validateEnv(customEnv: Record<string, unknown> = process.env): Env {
  return validateEnvDetailed(customEnv).env;
}

const validation = validateEnvDetailed();

export const env = validation.env;
export const isProduction = validation.isProduction;
export const configIssues: readonly ConfigIssue[] = validation.issues;

/** True when the server must fail closed because production configuration is unsafe. */
export function hasBlockingConfigIssues(issues: readonly ConfigIssue[] = configIssues): boolean {
  return issues.some((i) => i.blocking);
}

/**
 * True when writes must never land in ephemeral memory: production with durable storage expected.
 * Evaluated against the real environment; middleware accepts an override so it is testable.
 */
export function requiresDurableStorage(): boolean {
  return isProduction && env.ALLOW_EPHEMERAL_STORAGE !== 'true';
}

// Log configuration problems by variable name only (visible in Vercel function logs).
if (process.env.NODE_ENV !== 'test') {
  for (const issue of configIssues) {
    const log = issue.blocking ? console.error : console.warn;
    log(`[config] ${issue.blocking ? 'BLOCKING' : 'warning'} - ${issue.message}`);
  }
}
