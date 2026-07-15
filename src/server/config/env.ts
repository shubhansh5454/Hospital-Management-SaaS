import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Apply defaults only in non-production to keep development running out of the box
if (process.env.NODE_ENV !== 'production') {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'super-secret-hospital-jwt-key';
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    process.env.JWT_REFRESH_SECRET = 'super-secret-hospital-refresh-jwt-key';
  }
}

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SQL_HOST: z.string().min(1, 'SQL_HOST is required'),
  SQL_USER: z.string().min(1, 'SQL_USER is required'),
  SQL_PASSWORD: z.string().min(1, 'SQL_PASSWORD is required'),
  SQL_DB_NAME: z.string().min(1, 'SQL_DB_NAME is required'),
  SQL_ADMIN_USER: z.string().min(1, 'SQL_ADMIN_USER is required'),
  SQL_ADMIN_PASSWORD: z.string().min(1, 'SQL_ADMIN_PASSWORD is required'),
  APP_URL: z.string().optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
}).refine((data) => {
  if (data.NODE_ENV === 'production') {
    // Prevent usage of unsafe default JWT secrets in production
    const isUnsafeSecret = data.JWT_SECRET === 'super-secret-hospital-jwt-key';
    const isUnsafeRefreshSecret = data.JWT_REFRESH_SECRET === 'super-secret-hospital-refresh-jwt-key';
    return !isUnsafeSecret && !isUnsafeRefreshSecret;
  }
  return true;
}, {
  message: 'Insecure default JWT keys are strictly prohibited in production mode. Please provide custom, strong JWT secrets in environment variables.',
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Environment configuration validation failed:');
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1);
}

export const env = parseResult.data;
