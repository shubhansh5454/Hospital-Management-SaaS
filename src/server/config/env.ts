import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

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
  JWT_SECRET: z.string().default('super-secret-hospital-jwt-key'),
  JWT_REFRESH_SECRET: z.string().default('super-secret-hospital-refresh-jwt-key'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Environment configuration validation failed:');
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1);
}

export const env = parseResult.data;
