import 'dotenv/config';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4010),
  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:4010'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),

  REDIS_URL: optional,
  RUN_WORKERS_IN_API: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  UPLOAD_DIR: z.string().default('uploads'),
  S3_BUCKET: optional,
  S3_REGION: z.string().default('ap-south-1'),
  S3_ENDPOINT: optional,
  AWS_ACCESS_KEY_ID: optional,
  AWS_SECRET_ACCESS_KEY: optional,

  AI_API_KEY: optional,
  AI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_MODEL: z.string().default('gpt-4o-mini'),

  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  EMAIL_FROM: z.string().default('RecruitFlow <no-reply@recruitflow.dev>'),

  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_STARTER: optional,
  STRIPE_PRICE_GROWTH: optional,
  STRIPE_PRICE_BUSINESS: optional,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const features = {
  redis: Boolean(env.REDIS_URL),
  s3: Boolean(env.S3_BUCKET),
  llm: Boolean(env.AI_API_KEY),
  smtp: Boolean(env.SMTP_HOST),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
};
