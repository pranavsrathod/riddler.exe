import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { minify as minifyJs } from 'terser';
import { minify as minifyCss } from 'csso';

const SRC = 'src';
const DIST = 'dist';

async function build() {
  await mkdir(DIST, { recursive: true });

  const html = await readFile(join(SRC, 'index.html'), 'utf8');
  const css  = await readFile(join(SRC, 'style.css'),  'utf8');
  const js   = await readFile(join(SRC, 'script.js'),  'utf8');

  const minifiedCss = minifyCss(css).css;
  const { code: minifiedJs } = await minifyJs(js, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  });

  let bundled = html.replace(
    /<link[^>]*href=["']style\.css["'][^>]*\/?>/i,
    `<style>${minifiedCss}</style>`
  );
  bundled = bundled.replace(
    /<script[^>]*src=["']script\.js["'][^>]*><\/script>/i,
    `<script>${minifiedJs}</script>`
  );

  if (bundled.includes('style.css'))  throw new Error('CSS inline failed — style.css still referenced');
  if (bundled.includes('script.js')) throw new Error('JS inline failed — script.js still referenced');

  await writeFile(join(DIST, 'index.html'), bundled);

  const entries = await readdir(SRC, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const { name } = entry;
    if (name === 'index.html' || name === 'style.css' || name === 'script.js') continue;
    await copyFile(join(SRC, name), join(DIST, name));
  }

  console.log('✓ Build complete → dist/index.html');
}

build().catch((err) => {
  console.error('✗ Build failed:', err);
  process.exit(1);
});
