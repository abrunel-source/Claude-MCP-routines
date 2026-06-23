// Concrete vendor adapters implementing the libs/core ports. Bound to DI tokens
// in apps/api. Each port ships a real adapter and a working mock double; an
// environment flag selects which is active so the system runs end-to-end even
// when a real credential is absent.

export * from './key/env-aes-key.provider';
export * from './payment/mock-payment.provider';
export * from './payment/stitch-payment.provider';
export * from './accounting/mock-accounting.provider';
export * from './accounting/xero-accounting.provider';
export * from './notification/mock-notification.service';
export * from './notification/resend-notification.service';
export * from './storage/s3-storage.service';
export * from './document/pdfmake-document.service';
