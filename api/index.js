// Vercel serverless function handling every /api/* request. It re-exports the
// pre-built Nest bundle (produced by the vercel-build step). Plain JS so Vercel
// does not transpile workspace path aliases — those are resolved in the bundle.
const handler = require('../dist/apps/api/serverless.js').default;

module.exports = (req, res) => handler(req, res);
