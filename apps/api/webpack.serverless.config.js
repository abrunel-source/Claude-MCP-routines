const path = require('path');

// Bundles the API into a single CommonJS handler module
// (dist/apps/api/serverless.js) with the workspace libs compiled in and every
// third-party dependency left external. Vercel's file tracing then includes the
// external node_modules (Prisma engine, argon2 native binary, etc.) for the
// serverless function that re-exports this bundle.
module.exports = {
  mode: 'production',
  target: 'node',
  entry: path.resolve(__dirname, 'src/serverless.ts'),
  output: {
    path: path.resolve(__dirname, '../../dist/apps/api'),
    filename: 'serverless.js',
    libraryTarget: 'commonjs2',
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
    extensions: ['.ts', '.js'],
    alias: {
      '@cadence/shared-types': path.resolve(__dirname, '../../libs/shared-types/src/index.ts'),
      '@cadence/core': path.resolve(__dirname, '../../libs/core/src/index.ts'),
      '@cadence/adapters': path.resolve(__dirname, '../../libs/adapters/src/index.ts'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          configFile: path.resolve(__dirname, 'tsconfig.build.json'),
        },
      },
    ],
  },
  // Nest optionally requires packages that may be absent; ignore those warnings.
  ignoreWarnings: [/critical dependency/i],
};
