// Domain + application core. Depends only on ports (interfaces), never on
// concrete vendor SDKs. Adapters in libs/adapters implement these ports.

export * from './ports';
export * from './tenancy';
export * from './money';
