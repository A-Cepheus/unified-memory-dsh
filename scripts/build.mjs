import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'lib');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/**
 * Exact 11 PLATFORM_MODULES supplied by `@deepseek-ai/dsh-web-frontend` to
 * `window.__ModuleLoader__`. Any other dependency in `src/client/**` is bundled
 * inline so `lib/client.js` has zero unresolved runtime requires.
 */
const CLIENT_PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
];

const CLIENT_ALLOWED_EXTERNALS = new Set([
  ...CLIENT_PLATFORM_MODULES,
  ...(Array.isArray(pkg.dsh?.client?.external) ? pkg.dsh.client.external : []),
]);

/**
 * Host peer packages resolved directly from the DSH Host runtime so Cordis
 * Services, Symbols, and Schemastery `.volatile()` metadata share one instance.
 */
const HOST_EXTERNALS = [
  '@deepseek-ai/*',
  'react',
  'react-dom',
];

async function buildHost() {
  const entry = path.join(ROOT, 'src', 'host', 'index.ts');
  if (!fs.existsSync(entry)) {
    throw new Error(`Host entry not found: ${entry}`);
  }
  fs.mkdirSync(LIB_DIR, { recursive: true });
  const outfile = path.join(LIB_DIR, 'index.js');

  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    sourcemap: false,
    external: HOST_EXTERNALS,
    logLevel: 'info',
  });
  fs.rmSync(`${outfile}.map`, { force: true });

  const sizeKb = (fs.statSync(outfile).size / 1024).toFixed(1);
  console.log(`[build:host] wrote lib/index.js (${sizeKb} KB)`);
}

function assertAllowedClientRequires(code) {
  const re = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
  const disallowed = new Set();
  let match;
  while ((match = re.exec(code)) !== null) {
    const spec = match[1];
    if (!CLIENT_ALLOWED_EXTERNALS.has(spec)) {
      disallowed.add(spec);
    }
  }
  if (disallowed.size > 0) {
    throw new Error(
      `[build:client] Unresolved non-platform require(s) in lib/client.js: ${Array.from(disallowed).join(', ')}`,
    );
  }
}

async function buildClient() {
  const entry = path.join(ROOT, 'src', 'client', 'index.ts');
  if (!fs.existsSync(entry)) {
    throw new Error(`Client entry not found: ${entry}`);
  }
  fs.mkdirSync(LIB_DIR, { recursive: true });
  const outfile = path.join(LIB_DIR, 'client.js');

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'browser',
    target: 'es2022',
    format: 'cjs',
    jsx: 'automatic',
    minify: false,
    external: Array.from(CLIENT_ALLOWED_EXTERNALS),
    logLevel: 'info',
  });

  const jsFile = result.outputFiles.find((f) => f.path.endsWith('.js')) ?? result.outputFiles[0];
  if (!jsFile) {
    throw new Error('[build:client] esbuild produced no output file');
  }

  const innerCode = jsFile.text;
  assertAllowedClientRequires(innerCode);

  const wrapped =
    `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{\n` +
    `var module={exports:{}};\n` +
    `var exports=module.exports;\n` +
    `Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"});\n` +
    `${innerCode}\n` +
    `if(module.exports&&typeof module.exports==="object"&&!(Symbol.toStringTag in module.exports)){\n` +
    `Object.defineProperty(module.exports,Symbol.toStringTag,{value:"Module"});\n` +
    `}\n` +
    `return module.exports;\n` +
    `}});\n`;

  fs.writeFileSync(outfile, wrapped, 'utf8');
  const sizeKb = (fs.statSync(outfile).size / 1024).toFixed(1);
  console.log(`[build:client] wrote lib/client.js (${sizeKb} KB, Lazy-CJS for ${pkg.name})`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const hostOnly = args.has('--host-only');
  const clientOnly = args.has('--client-only');

  if (hostOnly && clientOnly) {
    throw new Error('Cannot pass both --host-only and --client-only');
  }

  if (!clientOnly) {
    await buildHost();
  }
  if (!hostOnly) {
    await buildClient();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
