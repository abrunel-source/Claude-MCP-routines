import 'reflect-metadata';
import { createApp } from './app.factory';
import { env } from './config/env';

// Long-running server entry (local dev + Docker / Cloud Run).
async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(env.apiPort);
  // eslint-disable-next-line no-console
  console.log(`Cadence API listening on :${env.apiPort} (docs at /api/docs)`);
}

bootstrap();
