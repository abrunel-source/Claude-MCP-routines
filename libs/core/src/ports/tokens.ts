// Nest DI injection tokens for each port. Adapters are bound to these tokens
// in the adapters module, selected (real vs mock) by environment flags.

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
export const ACCOUNTING_PROVIDER = Symbol('ACCOUNTING_PROVIDER');
export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
export const DOCUMENT_SERVICE = Symbol('DOCUMENT_SERVICE');
export const KEY_PROVIDER = Symbol('KEY_PROVIDER');
export const SCHEDULER = Symbol('SCHEDULER');
export const JOB_RUNNER = Symbol('JOB_RUNNER');
