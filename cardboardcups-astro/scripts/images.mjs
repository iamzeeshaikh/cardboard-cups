/**
 * Generates responsive WebP renditions beside every original upload and writes
 * an intrinsic-size manifest so templates can set width/height and avoid CLS.
 *
 * Original files keep their exact WordPress URL, so no indexed image URL changes.
 */
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const UPLOADS = path.join(ROOT, 'public', 'wp-content', 'uploads');
const MANIFEST = path.join(ROOT, 'src', 'data', 'images.json');
const WIDTHS = [400, 640, 960, 1280];
const RASTER = /\.(jpe?g|png)$/i;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // Skip macOS AppleDouble sidecars and Finder metadata (._*, .DS_Store).
    if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = existsSync(UPLOADS) ? await walk(UPLOADS) : [];
const manifest = {};
let made = 0;

for (const file of files) {
  if (/-\d+w\.webp$/.test(file)) continue; // our own output
  const url = '/' + path.relative(path.join(ROOT, 'public'), file).split(path.sep).join('/');

  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch {
    console.warn('skip (unreadable):', url);
    continue;
  }
  if (!meta.width || !meta.height) continue;

  const record = { width: meta.width, height: meta.height, srcset: [] };

  if (RASTER.test(file)) {
    const base = file.replace(RASTER, '');
    for (const w of WIDTHS) {
      // never upscale — a 600px original must not be stretched to 1280
      if (w > meta.width) continue;
      const out = `${base}-${w}w.webp`;
      if (!existsSync(out)) {
        await sharp(file).resize({ width: w }).webp({ quality: 78 }).toFile(out);
        made++;
      }
      record.srcset.push({
        url: '/' + path.relative(path.join(ROOT, 'public'), out).split(path.sep).join('/'),
        w,
      });
    }
    // originals wider than the largest rendition still deserve a full-size webp
    if (meta.width <= WIDTHS[0]) {
      const out = `${base}-${meta.width}w.webp`;
      if (!existsSync(out)) {
        await sharp(file).webp({ quality: 78 }).toFile(out);
        made++;
      }
      record.srcset = [{
        url: '/' + path.relative(path.join(ROOT, 'public'), out).split(path.sep).join('/'),
        w: meta.width,
      }];
    }
  }
  manifest[url] = record;
}

await mkdir(path.dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1));

const originals = Object.keys(manifest).length;
console.log(`images: ${originals} originals mapped, ${made} webp renditions generated`);
