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
 * Validates all required environment variables at startup using Zod.
 * The app will crash fast with a clear message if anything is missing
 * rather than failing silently at runtime.
 */
export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  // Required in production, optional in dev/test so the server can start without DB
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
    )
    .refine(
      (val) => process.env.NODE_ENV !== 'production' || val !== undefined,
      { message: 'MONGODB_URI is required in production' }
    ),
  // Required in production, optional in dev so the server boots for health checks
  GEMINI_API_KEY: z
    .string()
    .min(10)
    .optional()
    .refine(
      (val) => process.env.NODE_ENV !== 'production' || val !== undefined,
      { message: 'GEMINI_API_KEY is required in production' }
    ),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters (256-bit entropy)')
    .default('celebration-planner-dev-secret-key-32chars')
    .refine(
      (val) => process.env.NODE_ENV !== 'production' || (val && val !== 'celebration-planner-dev-secret-key-32chars'),
      { message: 'A secure, non-default JWT_SECRET is required in production' }
    ),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(customEnv: Record<string, unknown> = process.env): Env {
  const result = EnvSchema.safeParse(customEnv);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();

