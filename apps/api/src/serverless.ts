import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.factory';

type ExpressLike = (req: IncomingMessage, res: ServerResponse) => void;

// Vercel serverless entry. The Nest app is created once per warm lambda and the
// underlying Express instance handles each request.
let cached: ExpressLike | null = null;

async function instance(): Promise<ExpressLike> {
  if (!cached) {
    const app = await createApp();
    await app.init();
    cached = app.getHttpAdapter().getInstance() as ExpressLike;
  }
  return cached;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await instance();
  app(req, res);
}
