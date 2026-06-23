// Vercel serverless function handling every /api/* request. It re-exports the
// pre-built Nest bundle (produced by the vercel-build step). Kept as plain JS so
// Vercel does not attempt to transpile workspace path aliases — those are
// already resolved inside the bundle.
const mod = require('../dist/apps/api/serverless.js');
const handler = mod.default || mod;

module.exports = (req, res) => handler(req, res);
