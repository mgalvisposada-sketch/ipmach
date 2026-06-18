/**
 * Build script to compile the Playwright worker thread
 * This ensures the worker is available as JavaScript before Next.js build
 */

const { build } = require('esbuild');
const path = require('path');
const fs = require('fs');

const workerSource = path.join(__dirname, '../src/lib/workers/playwright-worker.ts');
const workerOutput = path.join(__dirname, '../lib/workers/playwright-worker.js');
const outputDir = path.dirname(workerOutput);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Building Playwright worker thread...');
console.log(`  Source: ${workerSource}`);
console.log(`  Output: ${workerOutput}`);

build({
  entryPoints: [workerSource],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: workerOutput,
  external: ['playwright', 'playwright-core', 'worker_threads'],
  sourcemap: false, // Disable sourcemap to avoid issues
  banner: {
    js: '// This file is auto-generated. Do not edit directly.\n',
  },
}).then(() => {
  console.log('✅ Worker thread compiled successfully');
  console.log(`   Output: ${workerOutput}`);
}).catch((error) => {
  console.error('❌ Failed to compile worker thread:', error);
  process.exit(1);
});

