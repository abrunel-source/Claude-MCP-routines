// Generates a Vercel Build Output API v3 directory (.vercel/output) so the
// deployment is fully self-described and Vercel's framework/Nx auto-detection
// (which keeps overriding the Output Directory) is bypassed entirely.
//
//   .vercel/output/
//     config.json                         routing (static + SPA fallback + API)
//     static/                             the Angular SPA (served at /)
//     functions/api/[[...path]].func/     the NestJS serverless function (/api/*)
//
// The function's runtime dependencies (Prisma engine, argon2 native binary, Nest,
// etc.) are traced with @vercel/nft and copied in, exactly like Vercel's
// zero-config Node builder does.
import { nodeFileTrace } from '@vercel/nft';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '.vercel', 'output');
const staticDir = path.join(out, 'static');
const funcDir = path.join(out, 'functions', 'api', '[[...path]].func');
const serverlessEntry = 'dist/apps/api/serverless.js';

async function main() {
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(staticDir, { recursive: true });
  await fs.mkdir(funcDir, { recursive: true });

  // 1. Static SPA -> .vercel/output/static
  await fs.cp(path.join(root, 'dist/apps/web'), staticDir, { recursive: true });

  // 2. Trace the serverless bundle's runtime files and copy them into the func.
  const { fileList } = await nodeFileTrace([serverlessEntry], { base: root });
  const files = new Set(fileList);
  // Safety net: make sure the generated Prisma client + query engine are included
  // even if nft misses the dynamically-loaded engine binary.
  await collectPrismaFiles(files);

  for (const rel of files) {
    const src = path.join(root, rel);
    const dst = path.join(funcDir, rel);
    const stat = await fs.lstat(src).catch(() => null);
    if (!stat || stat.isDirectory()) continue;
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }

  // 3. Launcher: Vercel's Node runtime invokes the default export as (req, res).
  await fs.writeFile(
    path.join(funcDir, 'index.js'),
    "module.exports = require('./dist/apps/api/serverless.js').default;\n",
  );

  // 4. Function config.
  await fs.writeFile(
    path.join(funcDir, '.vc-config.json'),
    JSON.stringify(
      {
        runtime: 'nodejs20.x',
        handler: 'index.js',
        launcherType: 'Nodejs',
        shouldAddHelpers: true,
        maxDuration: 30,
      },
      null,
      2,
    ),
  );

  // 5. Top-level build output config: static files first, API via the function,
  //    everything else falls back to the SPA shell.
  await fs.writeFile(
    path.join(out, 'config.json'),
    JSON.stringify(
      {
        version: 3,
        routes: [
          { handle: 'filesystem' },
          { src: '/((?!api/).*)', dest: '/index.html' },
        ],
      },
      null,
      2,
    ),
  );

  console.log('Generated .vercel/output (static + api function).');
}

async function collectPrismaFiles(files) {
  const candidates = [
    'node_modules/.prisma/client',
    'node_modules/@prisma/client',
  ];
  for (const dir of candidates) {
    const abs = path.join(root, dir);
    const entries = await fs.readdir(abs).catch(() => null);
    if (!entries) continue;
    for (const name of entries) {
      // engine binaries + the generated client query files
      if (/query_engine|libquery|\.so\.node$|\.node$|schema\.prisma$/.test(name)) {
        files.add(path.join(dir, name));
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
