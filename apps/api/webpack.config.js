const path = require('path');

// Extend the default Nest webpack build: bundle the workspace libs (via aliases)
// into a single dist/apps/api/main.js (Cloud Run / Vercel artifact). Every bare
// dependency (node_modules) stays external and is resolved at runtime — this is
// correct for a Node server bundle and keeps native modules (argon2, prisma)
// loading normally under pnpm's nested store.
module.exports = (options) => ({
  ...options,
  output: {
    ...options.output,
    path: path.resolve(__dirname, '../../dist/apps/api'),
    filename: 'main.js',
  },
  externals: [
    ({ request }, cb) => {
      if (!request || request.startsWith('.') || request.startsWith('/')) {
        return cb();
      }
      if (request.startsWith('@cadence/')) {
        return cb(); // bundle the workspace libs from source
      }
      return cb(null, 'commonjs ' + request); // external: resolved at runtime
    },
  ],
  resolve: {
    ...options.resolve,
    alias: {
      ...(options.resolve && options.resolve.alias),
      '@cadence/shared-types': path.resolve(__dirname, '../../libs/shared-types/src/index.ts'),
      '@cadence/core': path.resolve(__dirname, '../../libs/core/src/index.ts'),
      '@cadence/adapters': path.resolve(__dirname, '../../libs/adapters/src/index.ts'),
    },
  },
});
