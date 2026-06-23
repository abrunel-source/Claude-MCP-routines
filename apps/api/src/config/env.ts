// Typed environment access. All configuration via env vars (portability rule 1).

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? parseInt(v, 10) : fallback;
}

export type AdapterMode = 'real' | 'mock';

function mode(name: string): AdapterMode {
  return (process.env[name] === 'real' ? 'real' : 'mock');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Passwordless demo session (skips password verification). Enabled by default;
  // set DEMO_LOGIN=false to require real credentials in production.
  demoLogin: process.env.DEMO_LOGIN !== 'false',
  apiPort: int('API_PORT', 3000),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  appRootDomain: process.env.APP_ROOT_DOMAIN ?? 'cadence.co.za',
  platformHosts: (
    process.env.PLATFORM_HOSTS ??
    // Default to localhost plus the Vercel production/deployment domains so the
    // platform surface (and platform-admin login) resolves without extra config.
    ['localhost', process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
      .filter(Boolean)
      .join(',')
  )
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),

  databaseUrl: () => req('DATABASE_URL'),

  jwt: {
    accessSecret: () => req('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-please-32x'),
    refreshSecret: () => req('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-please-32'),
    accessTtl: int('JWT_ACCESS_TTL', 900),
    refreshTtl: int('JWT_REFRESH_TTL', 2592000),
  },

  argon2: {
    memoryCost: int('ARGON2_MEMORY_KIB', 19456),
    timeCost: int('ARGON2_TIME_COST', 2),
    parallelism: int('ARGON2_PARALLELISM', 1),
  },

  encryptionMasterKey: () =>
    req('ENCRYPTION_MASTER_KEY', Buffer.alloc(32, 'dev-master-key').toString('base64')),

  providers: {
    payment: mode('PAYMENT_PROVIDER'),
    accounting: mode('ACCOUNTING_PROVIDER'),
    notification: mode('NOTIFICATION_PROVIDER'),
  },

  stitch: {
    graphqlUrl: process.env.STITCH_GRAPHQL_URL ?? 'https://api.stitch.money/graphql',
    tokenUrl: process.env.STITCH_TOKEN_URL ?? 'https://secure.stitch.money/connect/token',
    webhookSecret: process.env.STITCH_WEBHOOK_SECRET ?? 'mock',
  },

  xero: {
    clientId: process.env.XERO_CLIENT_ID ?? '',
    clientSecret: process.env.XERO_CLIENT_SECRET ?? '',
    redirectUri: process.env.XERO_REDIRECT_URI ?? '',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    defaultFrom: process.env.RESEND_DEFAULT_FROM ?? 'Cadence <no-reply@cadence.co.za>',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'auto',
    bucket: process.env.S3_BUCKET ?? 'cadence',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  },

  cronSecret: process.env.CRON_SECRET ?? 'change-me-cron-secret',

  defaults: {
    currency: process.env.DEFAULT_CURRENCY ?? 'ZAR',
    vatRate: int('DEFAULT_VAT_RATE', 15),
    trialDays: int('TRIAL_DAYS', 14),
  },
};
