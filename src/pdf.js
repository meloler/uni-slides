// Exporta la presentación a PDF (1920x1080 / 16:9).
// 1) Usa Playwright o playwright-core (incluyendo la instalación global de OpenClaw en /root/.openclaw/workspace/node_modules/playwright-core) + Google Chrome / Chromium.
//    Captura cada diapositiva a 1920x1080 real (bloqueando peticiones externas para que el proxy no bloquee ni cuelgue Chrome, y sin usar page.pdf() para evitar cierres por memoria /dev/shm en contenedores) y ensambla un PDF 16:9 idéntico píxel a píxel al HTML Aurora/Neón/Paper.
// 2) Si no hay navegador en el sistema, usa el motor PDF nativo en Node puro (0 dependencias, respetando proporción de imágenes).
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import zlib from 'node:zlib';

async function findPlaywrightModule() {
  const candidates = [
    'playwright',
    'playwright-core',
    '/root/.openclaw/workspace/node_modules/playwright-core/index.mjs',
    '/root/.openclaw/workspace/node_modules/playwright-core/index.js',
    '/root/.openclaw/node_modules/playwright-core/index.js',
    path.join(os.homedir(), '.openclaw', 'workspace', 'node_modules', 'playwright-core', 'index.js'),
  ];
  for (const modPath of candidates) {
    try {
      const m = await import(modPath.startsWith('/') || modPath.includes(':\\') ? pathToFileURL(modPath).href : modPath);
      if (m?.chromium) return m.chromium;
      if (m?.default?.chromium) return m.default.chromium;
    } catch {}
  }
  return null;
}

async function findBrowserExecutable() {
  const roots = [
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    '/root/.cache/ms-playwright',
    '/ms-playwright',
    '/home/node/.cache/ms-playwright',
  ];
  for (const r of roots) {
    if (!existsSync(r)) continue;
    try {
      const dirs = await readdir(r);
      for (const d of dirs.sort().reverse()) {
        if (!d.startsWith('chromium')) continue;
        const candidates = [
          path.join(r, d, 'chrome-linux', 'chrome'),
          path.join(r, d, 'chrome-linux', 'headless_shell'),
          path.join(r, d, 'chromium-linux', 'chrome'),
        ];
        for (const c of candidates) {
          if (existsSync(c)) return c;
        }
      }
    } catch {}
  }
  const sysBins = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const b of sysBins) {
    if (existsSync(b)) return b;
  }
  return null;
}

/**
 * Empaqueta un array de capturas JPEG (1920x1080) en un documento PDF 1.4 panorámico (16:9)
 * sin recodificar los flujos JPEG (/DCTDecode directo).
 */
export async function buildJpegSlidesPDF(jpegBuffers, pdfFile) {
  const W = 1440;
  const H = 810;
  const objects = [];
  const addObj = (header, streamBuf = null) => {
    const id = objects.length + 1;
    objects.push({ id, header, streamBuf });
    return id;
  };

  const pageIds = [];
  for (let i = 0; i < jpegBuffers.length; i++) {
    const buf = jpegBuffers[i];
    const dims = parseJpegDimensions(buf) || { w: 1920, h: 1080 };
    const imgId = addObj(
      `<< /Type /XObject /Subtype /Image /Width ${dims.w} /Height ${dims.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${buf.length} >>`,
      buf
    );
    const ops = `q\n${W} 0 0 ${H} 0 0 cm\n/Im${imgId} Do\nQ\n`;
    const streamBuf = Buffer.from(ops, 'latin1');
    const contentId = addObj(`<< /Length ${streamBuf.length} >>`, streamBuf);
    const pageId = addObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${imgId} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  const pagesId = addObj(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  for (const pid of pageIds) {
    objects[pid - 1].header = objects[pid - 1].header.replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  }
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  let offset = chunks[0].length;

  for (const obj of objects) {
    offsets.push(offset);
    const headBuf = Buffer.from(`${obj.id} 0 obj\n${obj.header}\n`, 'latin1');
    chunks.push(headBuf);
    offset += headBuf.length;
    if (obj.streamBuf) {
      const sStart = Buffer.from('stream\n', 'latin1');
      const sEnd = Buffer.from('\nendstream\n', 'latin1');
      chunks.push(sStart, obj.streamBuf, sEnd);
      offset += sStart.length + obj.streamBuf.length + sEnd.length;
    }
    const endObj = Buffer.from('endobj\n', 'latin1');
    chunks.push(endObj);
    offset += endObj.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));

  await writeFile(pdfFile, Buffer.concat(chunks));
  return pdfFile;
}

export async function exportPDF(htmlFile, pdfFile, { screenshotsDir = null, deck = null, outDir = null } = {}) {
  // 1. Intentar con Playwright / playwright-core + Chrome local (captura fiel 1920x1080 por diapositiva)
  try {
    const chromium = await findPlaywrightModule();
    if (!chromium) throw new Error('Playwright no encontrado');
    const executablePath = await findBrowserExecutable();
    const launchOpts = {
      headless: true,
      args: [
        '--allow-file-access-from-files',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    };
    if (executablePath) launchOpts.executablePath = executablePath;

    let browser;
    try {
      browser = await chromium.launch(launchOpts);
    } catch {
      delete launchOpts.executablePath;
      browser = await chromium.launch(launchOpts);
    }

    try {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      // Bloquear llamadas de red externas (fuentes/iframes) para que un proxy con 403 nunca congele la carga
      await page.route(/^https?:\/\//, (route) => route.abort());
      await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 }).catch(() => {});

      await page.evaluate(() => {
        document.body.classList.remove('beat-mode');
        document.body.setAttribute('data-transition', 'none');
        const h = document.querySelector('.hud');
        if (h) h.style.display = 'none';
        const p = document.querySelector('.progress');
        if (p) p.style.display = 'none';
        document.querySelectorAll('.beat').forEach((el) => {
          el.classList.add('shown', 'current');
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.style.filter = 'none';
        });
      });

      const n = await page.locator('.slide').count();
      if (n > 0) {
        const jpegBuffers = [];
        for (let k = 1; k <= n; k++) {
          await page.evaluate((idx) => {
            window.__show(idx);
            document.body.classList.remove('beat-mode');
            document.querySelectorAll('.slide.active .beat').forEach((el) => {
              el.classList.add('shown');
              el.style.opacity = '1';
              el.style.transform = 'none';
              el.style.filter = 'none';
            });
          }, k - 1);
          await page.waitForTimeout(1600);
          if (screenshotsDir) {
            await page.screenshot({ path: `${screenshotsDir}/slide-${String(k).padStart(2, '0')}.png` });
          }
          const jpg = await page.screenshot({ type: 'jpeg', quality: 90 });
          jpegBuffers.push(jpg);
        }
        await buildJpegSlidesPDF(jpegBuffers, pdfFile);
        return pdfFile;
      }
    } finally {
      await browser.close();
    }
  } catch {}

  // 2. Fallback universal cero-dependencias: generador PDF nativo en Node puro (sin navegador externo)
  const baseDir = outDir || path.dirname(htmlFile);
  let deckObj = deck;
  if (!deckObj) {
    const deckPath = path.join(baseDir, 'deck.json');
    if (existsSync(deckPath)) {
      deckObj = JSON.parse(await readFile(deckPath, 'utf8'));
    }
  }
  if (deckObj) {
    return await exportPureNodePDF(deckObj, baseDir, pdfFile);
  }
  throw new Error('No se encontró navegador ni deck.json para exportar a PDF.');
}

// ============================================================================
// Motor PDF 1.4 nativo en Node puro (0 dependencias npm, soporta PNG y JPEG)
// ============================================================================

const PDF_THEMES = {
  aurora: {
    bg: [0.039, 0.051, 0.11],
    bg2: [0.082, 0.102, 0.212],
    card: [0.09, 0.11, 0.227],
    border: [0.173, 0.2, 0.4],
    fg: [0.96, 0.965, 1.0],
    soft: [0.875, 0.89, 0.984],
    muted: [0.604, 0.639, 0.8],
    accent: [1.0, 0.478, 0.42],
    accent2: [0.545, 0.42, 1.0],
  },
  neon: {
    bg: [0.016, 0.027, 0.043],
    bg2: [0.043, 0.082, 0.125],
    card: [0.043, 0.102, 0.141],
    border: [0.071, 0.306, 0.271],
    fg: [0.918, 1.0, 0.969],
    soft: [0.812, 0.933, 0.894],
    muted: [0.498, 0.651, 0.608],
    accent: [0.0, 0.898, 0.659],
    accent2: [0.0, 0.639, 1.0],
  },
  paper: {
    bg: [0.965, 0.945, 0.914],
    bg2: [0.922, 0.89, 0.835],
    card: [1.0, 0.992, 0.976],
    border: [0.875, 0.839, 0.78],
    fg: [0.11, 0.102, 0.09],
    soft: [0.184, 0.169, 0.149],
    muted: [0.431, 0.4, 0.357],
    accent: [0.851, 0.282, 0.059],
    accent2: [0.094, 0.392, 0.671],
  },
};

function toWinAnsiBytes(str) {
  const clean = String(str ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/…/g, '...')
    .replace(/✓/g, '+')
    .replace(/▶/g, '>')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else out += ch;
  }
  return out;
}

function wrapLines(text, maxChars) {
  const words = String(text ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function parseJpegDimensions(buf) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      return { w, h };
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

function decodePngToRgbFlate(buf) {
  if (buf.length < 32 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let pos = 8;
  let w = 0,
    h = 0,
    bitDepth = 0,
    colorType = 0;
  const idats = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const dataStart = pos + 8;
    if (type === 'IHDR') {
      w = buf.readUInt32BE(dataStart);
      h = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
    } else if (type === 'IDAT') {
      idats.push(buf.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (!w || !h || bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return null;
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = w * bpp;
  const step = w > 720 ? 2 : 1;
  const outW = Math.floor(w / step);
  const outH = Math.floor(h / step);
  const rgb = Buffer.alloc(outW * outH * 3);
  const prevRow = Buffer.alloc(stride);
  const curRow = Buffer.alloc(stride);

  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  };

  let inOff = 0;
  let outOff = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[inOff++];
    for (let x = 0; x < stride; x++) {
      const v = raw[inOff++];
      const a = x >= bpp ? curRow[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;
      let recon = v;
      if (filter === 1) recon = (v + a) & 0xff;
      else if (filter === 2) recon = (v + b) & 0xff;
      else if (filter === 3) recon = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) recon = (v + paeth(a, b, c)) & 0xff;
      curRow[x] = recon;
    }
    if (y % step === 0 && y / step < outH) {
      for (let px = 0; px < outW; px++) {
        const srcPx = px * step * bpp;
        rgb[outOff++] = curRow[srcPx];
        rgb[outOff++] = curRow[srcPx + 1];
        rgb[outOff++] = curRow[srcPx + 2];
      }
    }
    curRow.copy(prevRow);
  }
  return { w: outW, h: outH, flate: zlib.deflateSync(rgb) };
}

function loadPdfImage(baseDir, relPath) {
  if (!relPath || relPath.startsWith('http') || relPath.startsWith('data:')) return null;
  const abs = path.resolve(baseDir, relPath);
  if (!existsSync(abs)) return null;
  try {
    const buf = readFileSync(abs);
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      const dims = parseJpegDimensions(buf);
      if (!dims) return null;
      return { filter: '/DCTDecode', w: dims.w, h: dims.h, data: buf };
    }
    const png = decodePngToRgbFlate(buf);
    if (png) {
      return { filter: '/FlateDecode', w: png.w, h: png.h, data: png.flate };
    }
  } catch {}
  return null;
}

export async function exportPureNodePDF(deck, baseDir, pdfFile) {
  const W = 1440;
  const H = 810;
  const t = PDF_THEMES[deck.theme] || PDF_THEMES.aurora;
  const rgbFill = (c) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)} rg`;
  const rgbStroke = (c) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)} RG`;

  const objects = [];
  const addObj = (header, streamBuf = null) => {
    const id = objects.length + 1;
    objects.push({ id, header, streamBuf });
    return id;
  };

  const fontRegId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const imageCache = new Map();
  const getImageObj = (relPath) => {
    if (!relPath) return null;
    if (imageCache.has(relPath)) return imageCache.get(relPath);
    const im = loadPdfImage(baseDir, relPath);
    if (!im) {
      imageCache.set(relPath, null);
      return null;
    }
    const objId = addObj(
      `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${im.filter} /Length ${im.data.length} >>`,
      im.data
    );
    const meta = { objId, name: `/Im${objId}`, w: im.w, h: im.h };
    imageCache.set(relPath, meta);
    return meta;
  };

  const pageIds = [];
  const slides = deck.slides || [];
  let sectionNum = 0;

  slides.forEach((s, i) => {
    if (s.layout === 'section') sectionNum++;
    const ops = [];
    const pageImages = new Set();

    // Fondo
    ops.push(rgbFill(t.bg), `0 0 ${W} ${H} re f`);
    // Barra superior de acento
    ops.push(rgbFill(t.accent), `0 ${H - 6} ${W} 6 re f`);

    const drawText = (str, x, yTop, size, color = t.fg, bold = false) => {
      const y = H - yTop - size;
      ops.push('BT', `${bold ? '/F2' : '/F1'} ${size} Tf`, rgbFill(color), `${x.toFixed(1)} ${y.toFixed(1)} Td`, `(${toWinAnsiBytes(str)}) Tj`, 'ET');
    };

    const drawWrapped = (str, x, yTop, size, maxChars, color = t.soft, bold = false, lineHeight = 1.32, maxLines = 8) => {
      const lines = wrapLines(str, maxChars).slice(0, maxLines);
      lines.forEach((ln, idx) => {
        drawText(ln, x, yTop + idx * size * lineHeight, size, color, bold);
      });
      return yTop + lines.length * size * lineHeight;
    };

    const drawBox = (x, yTop, w, h, fillCol = t.card, strokeCol = t.border, accentLeft = false) => {
      const y = H - yTop - h;
      ops.push(rgbFill(fillCol), rgbStroke(strokeCol), '1 w', `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re B`);
      if (accentLeft) {
        ops.push(rgbFill(t.accent), `${x.toFixed(1)} ${y.toFixed(1)} 5 ${h.toFixed(1)} re f`);
      }
    };

    const imMeta = getImageObj(s.image);
    const hasSideImg = imMeta && ['concept', 'example', 'video', 'section', 'cover', 'question'].includes(s.layout);
    if (hasSideImg) {
      pageImages.add(imMeta);
      const boxX = 890,
        boxYTop = 105,
        boxW = 460,
        boxH = 560;
      const scale = Math.min(boxW / (imMeta.w || 1024), boxH / (imMeta.h || 1024));
      const drawW = (imMeta.w || 1024) * scale;
      const drawH = (imMeta.h || 1024) * scale;
      const ix = boxX + (boxW - drawW) / 2;
      const iyTop = boxYTop + (boxH - drawH) / 2;
      const iy = H - iyTop - drawH;
      ops.push('q', `${drawW.toFixed(1)} 0 0 ${drawH.toFixed(1)} ${ix.toFixed(1)} ${iy.toFixed(1)} cm`, `${imMeta.name} Do`, 'Q');
    }

    const contentMaxChars = hasSideImg ? 54 : 88;
    const titleMaxChars = hasSideImg ? 32 : 52;

    // Kicker
    const kickerText = s.kicker || (s.layout === 'section' ? `Bloque ${sectionNum}` : '');
    if (kickerText) {
      drawText(String(kickerText).toUpperCase(), 90, 72, 14, t.accent, true);
    }

    // Título
    let curY = drawWrapped(s.title || s.quote || '', 90, 104, s.layout === 'cover' || s.layout === 'question' ? 44 : 32, titleMaxChars, t.fg, true, 1.22, 3);
    curY += 16;

    if (s.subtitle) {
      curY = drawWrapped(s.subtitle, 90, curY, 20, contentMaxChars, t.muted, false, 1.3, 3) + 16;
    }
    if (s.body) {
      curY = drawWrapped(s.body, 90, curY, 18, contentMaxChars, t.soft, false, 1.32, 4) + 16;
    }

    if (s.layout === 'big-number' && s.big_number) {
      drawText(String(s.big_number), 90, curY + 10, 110, t.accent, true);
      curY += 140;
      if (s.big_number_label) {
        curY = drawWrapped(s.big_number_label, 90, curY, 26, contentMaxChars, t.fg, true, 1.25, 2) + 14;
      }
    }

    if (s.layout === 'comparison' && s.columns?.length === 2) {
      s.columns.slice(0, 2).forEach((col, cIdx) => {
        const cx = cIdx === 0 ? 90 : 735;
        const cw = 595;
        drawBox(cx, 220, cw, 460, t.card, t.border, true);
        drawText(col.heading || '', cx + 24, 244, 22, cIdx === 0 ? t.accent2 : t.accent, true);
        let by = 288;
        (col.bullets || []).forEach((b) => {
          by = drawWrapped('• ' + b, cx + 24, by, 16, 52, t.soft, false, 1.32, 5) + 14;
        });
      });
    } else if (['process', 'agenda'].includes(s.layout) && s.steps?.length) {
      const n = s.steps.length;
      const gap = 18;
      const totW = W - 180;
      const cw = (totW - gap * (n - 1)) / n;
      s.steps.forEach((st, idx) => {
        const cx = 90 + idx * (cw + gap);
        drawBox(cx, 240, cw, 410, t.card, t.border, true);
        drawText(`0${idx + 1}`, cx + 20, 264, 28, t.accent, true);
        let sy = drawWrapped(st.label || '', cx + 20, 308, 19, Math.floor(cw / 10.5), t.fg, true, 1.25, 3) + 12;
        drawWrapped(st.text || '', cx + 20, sy, 15, Math.floor(cw / 8.5), t.muted, false, 1.32, 8);
      });
    } else if (s.bullets?.length) {
      const boxW = hasSideImg ? 770 : 1260;
      s.bullets.forEach((b) => {
        const lines = wrapLines(b, hasSideImg ? 64 : 105).slice(0, 4);
        const bh = lines.length * 22 + 24;
        drawBox(90, curY, boxW, bh, t.card, t.border, true);
        drawWrapped(b, 112, curY + 12, 16, hasSideImg ? 64 : 105, t.soft, false, 1.32, 4);
        curY += bh + 12;
      });
    } else if (s.questions?.length) {
      s.questions.forEach((q, qIdx) => {
        const lines = wrapLines(q, 98).slice(0, 3);
        const bh = lines.length * 24 + 26;
        drawBox(90, curY, 1260, bh, t.card, t.border, true);
        drawWrapped(`${qIdx + 1}. ${q}`, 114, curY + 13, 18, 98, t.fg, false, 1.3, 3);
        curY += bh + 14;
      });
    }

    if (s.callout && ['concept', 'example', 'quiz'].includes(s.layout)) {
      const boxW = hasSideImg ? 770 : 1260;
      const lines = wrapLines(s.callout, hasSideImg ? 64 : 105).slice(0, 3);
      const bh = lines.length * 21 + 22;
      if (curY + bh < H - 55) {
        drawBox(90, curY + 4, boxW, bh, t.bg2, t.accent, true);
        drawWrapped(s.callout, 112, curY + 15, 15, hasSideImg ? 64 : 105, t.fg, true, 1.3, 3);
      }
    }

    // Pie de página
    drawText(deck.title || '', 90, H - 38, 11, t.muted, false);
    drawText(`${i + 1} / ${slides.length}`, W - 140, H - 38, 11, t.muted, true);

    const streamBuf = Buffer.from(ops.join('\n'), 'latin1');
    const contentId = addObj(`<< /Length ${streamBuf.length} >>`, streamBuf);
    const xObjDict = pageImages.size
      ? `/XObject << ${[...pageImages].map((m) => `${m.name} ${m.objId} 0 R`).join(' ')} >>`
      : '';
    const pageId = addObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontRegId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjDict} >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  const pagesId = addObj(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  for (const pid of pageIds) {
    objects[pid - 1].header = objects[pid - 1].header.replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`);
  }
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  let offset = chunks[0].length;

  for (const obj of objects) {
    offsets.push(offset);
    const headBuf = Buffer.from(`${obj.id} 0 obj\n${obj.header}\n`, 'latin1');
    chunks.push(headBuf);
    offset += headBuf.length;
    if (obj.streamBuf) {
      const sStart = Buffer.from('stream\n', 'latin1');
      const sEnd = Buffer.from('\nendstream\n', 'latin1');
      chunks.push(sStart, obj.streamBuf, sEnd);
      offset += sStart.length + obj.streamBuf.length + sEnd.length;
    }
    const endObj = Buffer.from('endobj\n', 'latin1');
    chunks.push(endObj);
    offset += endObj.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, 'latin1'));

  await writeFile(pdfFile, Buffer.concat(chunks));
  return pdfFile;
}
