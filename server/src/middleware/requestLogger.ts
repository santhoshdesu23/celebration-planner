import morgan from 'morgan';
import { env } from '../config/env.js';

/**
 * HTTP request logger.
 * Uses 'dev' format in development (colourised, concise) and
 * 'combined' (Apache format) in production for log aggregators.
 */
export const requestLogger = morgan(
  env.NODE_ENV === 'production' ? 'combined' : 'dev'
);
