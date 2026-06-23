import { Global, Module } from '@nestjs/common';
import {
  PAYMENT_PROVIDER,
  ACCOUNTING_PROVIDER,
  NOTIFICATION_SERVICE,
  STORAGE_SERVICE,
  DOCUMENT_SERVICE,
  KEY_PROVIDER,
} from '@cadence/core';
import {
  EnvAesKeyProvider,
  MockPaymentProvider,
  StitchPaymentProvider,
  MockAccountingProvider,
  XeroAccountingProvider,
  MockNotificationService,
  ResendNotificationService,
  S3StorageService,
  InMemoryStorageService,
  PdfmakeDocumentService,
} from '@cadence/adapters';
import { env } from '../config/env';

/**
 * Binds each port to its concrete adapter, selecting real vs mock per provider
 * via environment flags so the system runs end-to-end when a credential is absent.
 */
@Global()
@Module({
  providers: [
    {
      provide: KEY_PROVIDER,
      useFactory: () => new EnvAesKeyProvider(env.encryptionMasterKey()),
    },
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () =>
        env.providers.payment === 'real'
          ? new StitchPaymentProvider({
              graphqlUrl: env.stitch.graphqlUrl,
              tokenUrl: env.stitch.tokenUrl,
            })
          : new MockPaymentProvider(),
    },
    {
      provide: ACCOUNTING_PROVIDER,
      useFactory: () =>
        env.providers.accounting === 'real'
          ? new XeroAccountingProvider({
              clientId: env.xero.clientId,
              clientSecret: env.xero.clientSecret,
              redirectUri: env.xero.redirectUri,
            })
          : new MockAccountingProvider(),
    },
    {
      provide: NOTIFICATION_SERVICE,
      useFactory: () =>
        env.providers.notification === 'real'
          ? new ResendNotificationService(env.resend.apiKey, env.resend.defaultFrom)
          : new MockNotificationService(),
    },
    {
      provide: STORAGE_SERVICE,
      // Use real S3 when an endpoint + credentials are configured; otherwise an
      // in-memory double so signed-PDF flows run end-to-end (see HANDOFF).
      useFactory: () =>
        env.s3.endpoint && env.s3.accessKeyId
          ? new S3StorageService(env.s3)
          : new InMemoryStorageService(),
    },
    {
      provide: DOCUMENT_SERVICE,
      useFactory: () => new PdfmakeDocumentService(),
    },
  ],
  exports: [
    KEY_PROVIDER,
    PAYMENT_PROVIDER,
    ACCOUNTING_PROVIDER,
    NOTIFICATION_SERVICE,
    STORAGE_SERVICE,
    DOCUMENT_SERVICE,
  ],
})
export class AdaptersModule {}
