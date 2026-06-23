import { ValidationPipe, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * Builds and configures the Nest application without starting a listener.
 * Shared by the long-running server (main.ts) and the Vercel serverless
 * handler (serverless.ts) so both behave identically.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('Cadence API')
    .setDescription('Multi-tenant SA professional-services billing platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  return app;
}
