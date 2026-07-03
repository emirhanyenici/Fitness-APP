/**
 * generate-icons.js — Zenova LifeScore icon pipeline
 *
 * Converts SVG source files in assets/ to PNG at all required sizes.
 *
 * Usage:
 *   npm install --legacy-peer-deps sharp
 *   node scripts/generate-icons.js
 *
 * Output files (written to assets/):
 *   icon.png                      1024×1024  (Expo app icon)
 *   adaptive-icon.png             1024×1024  (Android foreground — transparent bg)
 *   splash.png                    2048×2048  (Expo splash screen)
 *   favicon.png                     48×48   (Web favicon)
 *   android-icon-background.png   1024×1024  (Android background layer)
 *   android-icon-monochrome.png   1024×1024  (Android 13+ themed icon)
 */

const path = require('path');
const fs   = require('fs');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error(
    '\n❌  sharp is not installed.\n' +
    '    Run:  npm install --legacy-peer-deps sharp\n'
  );
  process.exit(1);
}

const ASSETS = path.resolve(__dirname, '..', 'assets');

const jobs = [
  // ── App icon (solid bg baked in) ───────────────────────────────────
  {
    input:  'icon.svg',
    output: 'icon.png',
    width:  1024,
    height: 1024,
  },
  // ── Android adaptive foreground (transparent) ───────────────────────
  {
    input:  'android-icon-foreground.svg',
    output: 'adaptive-icon.png',
    width:  1024,
    height: 1024,
  },
  // ── Android adaptive background ─────────────────────────────────────
  {
    input:  'android-icon-background.svg',
    output: 'android-icon-background.png',
    width:  1024,
    height: 1024,
  },
  // ── Android monochrome (themed icons, Android 13+) ──────────────────
  {
    input:  'android-icon-monochrome.svg',
    output: 'android-icon-monochrome.png',
    width:  1024,
    height: 1024,
  },
  // ── Splash (centred icon on navy, 2048×2048) ─────────────────────────
  {
    input:  'icon.svg',
    output: 'splash.png',
    width:  2048,
    height: 2048,
    // Resize SVG to 768px centred on a 2048×2048 #0D1526 canvas
    compositeOnto: { width: 2048, height: 2048, background: '#0D1526', iconSize: 768 },
  },
  // ── Web favicon ──────────────────────────────────────────────────────
  {
    input:  'icon.svg',
    output: 'favicon.png',
    width:  48,
    height: 48,
  },
];

async function run() {
  let ok = 0;
  let fail = 0;

  for (const job of jobs) {
    const inputPath  = path.join(ASSETS, job.input);
    const outputPath = path.join(ASSETS, job.output);

    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️  Missing source: ${job.input} — skipped`);
      fail++;
      continue;
    }

    try {
      if (job.compositeOnto) {
        const { width, height, background, iconSize } = job.compositeOnto;

        // Render the SVG icon at iconSize×iconSize
        const iconBuffer = await sharp(inputPath)
          .resize(iconSize, iconSize)
          .png()
          .toBuffer();

        // Composite centred on a coloured canvas
        const left = Math.round((width  - iconSize) / 2);
        const top  = Math.round((height - iconSize) / 2);

        await sharp({
          create: { width, height, channels: 4, background },
        })
          .composite([{ input: iconBuffer, left, top }])
          .png()
          .toFile(outputPath);
      } else {
        await sharp(inputPath)
          .resize(job.width, job.height)
          .png()
          .toFile(outputPath);
      }

      console.log(`✅  ${job.output.padEnd(36)} ${job.width}×${job.height ?? job.compositeOnto?.height}`);
      ok++;
    } catch (err) {
      console.error(`❌  ${job.output}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n${ok} generated, ${fail} failed.\n`);
  if (fail > 0) process.exit(1);
}

run();
