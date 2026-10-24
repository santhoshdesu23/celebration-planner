import mongoose from 'mongoose';
import { env, sanitizeErrorMessage, normalizeMongoUri } from '../config/env.js';

let isConnected = false;
let isUsingMemoryStore = false;
let connectionError: string | null = null;
let listenersAttached = false;

function setupConnectionListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    isConnected = true;
    isUsingMemoryStore = false;
    connectionError = null;
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    isUsingMemoryStore = true;
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    isUsingMemoryStore = false;
    connectionError = null;
  });

  mongoose.connection.on('error', (err) => {
    const raw = err instanceof Error ? err.message : String(err);
    connectionError = sanitizeErrorMessage(raw);
  });
}

export async function connectDatabase(customUri?: string): Promise<boolean> {
  setupConnectionListeners();

  const targetUri = customUri ?? env.MONGODB_URI;

  if (!targetUri) {
    console.info(
      'ℹ️ MONGODB_URI not provided. Operating in EPHEMERAL IN-MEMORY mode. (Notice: Non-durable; data resets on restart).'
    );
    isConnected = false;
    isUsingMemoryStore = true;
    connectionError = null;
    return false;
  }

  // If already connected, return true immediately
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    isUsingMemoryStore = false;
    connectionError = null;
    return true;
  }

  const normalizedUri = normalizeMongoUri(targetUri);

  try {
    console.info('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(normalizedUri, {
      serverSelectionTimeoutMS: 3000,
    });

    isConnected = true;
    isUsingMemoryStore = false;
    connectionError = null;

    const clusterHost = mongoose.connection.host || 'MongoDB Atlas';
    const dbName = mongoose.connection.name;
    console.info(
      `✅ Connected to MongoDB Atlas successfully (${clusterHost}${dbName ? ` / ${dbName}` : ''}).`
    );
    return true;
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);
    const sanitizedError = sanitizeErrorMessage(rawError);

    connectionError = sanitizedError;
    isConnected = false;
    isUsingMemoryStore = true;

    console.warn(
      `⚠️ Could not connect to MongoDB Atlas. Operating in EPHEMERAL IN-MEMORY fallback mode. (Notice: Data is non-durable). Reason: ${sanitizedError}`
    );
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export function isUsingMemory(): boolean {
  return !isDbConnected();
}

export function getDbConnectionError(): string | null {
  return connectionError;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  isConnected = false;
  isUsingMemoryStore = true;
}

/**
 * Resets internal connection state for test isolation.
 */
export function _resetConnectionStateForTest(): void {
  isConnected = false;
  isUsingMemoryStore = false;
  connectionError = null;
}

