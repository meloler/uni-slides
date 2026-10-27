// Exporta index.html a PDF ligero (~3-6 MB).
// Soporta Playwright (si está instalado) o cualquier Chromium/Chrome del sistema (modo cero-dependencias npm).
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export async function exportPDF(htmlFile, pdfFile, { screenshotsDir = null } = {}) {
  // 1. Intentar con Playwright si está disponible
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

      if (screenshotsDir) {
        await page.evaluate(() => {
          document.body.classList.remove('beat-mode');
          const h = document.querySelector('.hud');
          if (h) h.style.display = 'none';
        });
        const n = await page.locator('.slide').count();
        for (let k = 1; k <= n; k++) {
          await page.evaluate((k) => window.__show(k - 1), k);
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${screenshotsDir}/slide-${String(k).padStart(2, '0')}.png` });
        }
      }

      const baseDir = path.dirname(htmlFile);
      const relUrls = await page.evaluate(() => {
        return [...document.querySelectorAll('.img, .yt-thumb')].map((el) => {
          const m = /url\(['"]?(.*?)['"]?\)/.exec(el.style.backgroundImage);
          return m ? m[1] : null;
        });
      });

      const dataMap = {};
      for (const u of new Set(relUrls.filter(Boolean))) {
        if (u.startsWith('data:') || u.startsWith('http')) continue;
        const abs = path.resolve(baseDir, decodeURIComponent(u));
        if (existsSync(abs)) {
          const buf = await readFile(abs);
          const ext = path.extname(abs).toLowerCase() === '.png' ? 'png' : 'jpeg';
          dataMap[u] = `data:image/${ext};base64,${buf.toString('base64')}`;
        }
      }

      await page.evaluate(async (map) => {
        const els = [...document.querySelectorAll('.img, .yt-thumb')];
        for (const el of els) {
          const m = /url\(['"]?(.*?)['"]?\)/.exec(el.style.backgroundImage);
          if (!m || !map[m[1]]) continue;
          const src = map[m[1]];
          await new Promise((resolve) => {
            const im = new Image();
            im.onload = () => {
              try {
                const isFull = el.classList.contains('bg-full');
                const maxW = isFull ? 1152 : 720;
                const scale = Math.min(1, maxW / (im.naturalWidth || 1024));
                const c = document.createElement('canvas');
                c.width = Math.round((im.naturalWidth || 1024) * scale);
                c.height = Math.round((im.naturalHeight || 1024) * scale);
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#0b0d17';
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(im, 0, 0, c.width, c.height);
                const jpegUrl = c.toDataURL('image/jpeg', 0.72);
                el.style.backgroundImage = `url("${jpegUrl}")`;
              } catch {}
              resolve();
            };
            im.onerror = resolve;
            im.src = src;
          });
        }
      }, dataMap);

      await page.addStyleTag({
        content: `@media print { .card, ul.bullets li, .callout { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } }`,
      });

      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: pdfFile, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
      return pdfFile;
    } finally {
      await browser.close();
    }
  } catch {
    // 2. Fallback sin npm install: usar Chromium / Google Chrome del sistema operativo si existe
    const candidates = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', '/usr/bin/chromium', '/usr/bin/google-chrome'];
    for (const bin of candidates) {
      try {
        execFileSync(
          bin,
          [
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--allow-file-access-from-files',
            '--print-to-pdf-no-header',
            `--print-to-pdf=${pdfFile}`,
            pathToFileURL(htmlFile).href,
          ],
          { stdio: 'ignore', timeout: 60000 }
        );
        if (existsSync(pdfFile)) return pdfFile;
      } catch {}
    }
    throw new Error('No se encontró Playwright ni Chromium en el servidor para exportar a PDF directo.');
  }
}
