#!/usr/bin/env node
// Uni-Slides Studio: editor visual local tipo Elementor (módulo adicional sin modificar el motor base).
import http from 'node:http';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { normalizeDeck } from '../schema.js';
import { renderHTML, renderDeck, renderStandaloneHTML, listThemes } from '../render/render.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const outRoot = path.join(root, 'out');
const downloadsDir = path.join(os.homedir(), 'Downloads');

function loadEnvironment() {
  const candidates = [
    path.join(root, '.env'),
    path.resolve('.env'),
    path.join(os.homedir(), 'uni-slides', '.env'),
    path.join(os.homedir(), '.env'),
  ];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    try {
      const raw = readFileSync(f, 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const k = trimmed.slice(0, eqIdx).trim();
        let v = trimmed.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
      return f;
    } catch {}
  }
  return null;
}

loadEnvironment();

const slugify = (s) =>
  String(s || 'nueva-presentacion')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'nueva-presentacion';

const safeSlug = (s) => {
  const clean = String(s || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!clean) throw new Error('Nombre de carpeta inválido');
  return clean;
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

function readBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error('Archivo demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function listDecks() {
  await mkdir(outRoot, { recursive: true });
  const entries = await readdir(outRoot, { withFileTypes: true });
  const decks = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const deckFile = path.join(outRoot, e.name, 'deck.json');
    if (!existsSync(deckFile)) continue;
    try {
      const raw = JSON.parse(await readFile(deckFile, 'utf8'));
      decks.push({
        slug: e.name,
        title: (raw.title || e.name).replace(/\*\*/g, ''),
        theme: raw.theme || 'aurora',
        slides: Array.isArray(raw.slides) ? raw.slides.length : 0,
      });
    } catch {}
  }
  return decks.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function renderPreviewHTML(deck, slug, slideIdx = 0) {
  const normalized = normalizeDeck(deck);
  const themeName = normalized.theme || 'aurora';
  const themeFile = path.join(root, 'src', 'render', 'themes', `${themeName}.css`);
  const fallbackTheme = path.join(root, 'src', 'render', 'themes', 'aurora.css');
  const themeCss = await readFile(existsSync(themeFile) ? themeFile : fallbackTheme, 'utf8');
  const baseCss = await readFile(path.join(root, 'src', 'render', 'base.css'), 'utf8');

  // Re-mapear rutas relativas images/... a /out/<slug>/images/... para la vista previa en vivo
  const previewDeck = {
    ...normalized,
    slides: normalized.slides.map((s) => ({
      ...s,
      image: s.image && !s.image.startsWith('http') && !s.image.startsWith('data:') && !s.image.startsWith('/')
        ? `/out/${slug}/${s.image}`
        : s.image,
    })),
  };

  let html = renderHTML(previewDeck, {
    themeCss: `${themeCss}\n${baseCss}`,
    mermaidSrc: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js',
  });

  // Inyectar script de posicionamiento inmediato en la diapositiva seleccionada (sin blur de transición)
  const jumpScript = `
<style>
  .hud, .progress, .notes-panel { display: none !important; }
  .deck .slide { transition: none !important; }
  body.beat-mode .slide .beat { opacity: 1 !important; transform: none !important; filter: none !important; pointer-events: auto !important; }
  .slide .anim { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
</style>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    const check = setInterval(() => {
      if (typeof window.__show === 'function') {
        clearInterval(check);
        window.__show(${Math.max(0, Number(slideIdx) || 0)});
      }
    }, 30);
    window.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === 'jump' && typeof window.__show === 'function') {
        window.__show(ev.data.index || 0);
      }
    });
  });
</script>`;
  html = html.replace('</body>', `${jumpScript}\n</body>`);
  return html;
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = decodeURIComponent(u.pathname);

    // Interfaz principal del Studio
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      const html = await readFile(path.join(here, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }

    // Archivos estáticos de out/ (imágenes, HTML exportado)
    if (req.method === 'GET' && p.startsWith('/out/')) {
      const rel = p.slice(5);
      const abs = path.resolve(outRoot, rel);
      if (!abs.startsWith(outRoot) || !existsSync(abs)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      const buf = await readFile(abs);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
      return;
    }

    // Listar temas disponibles
    if (req.method === 'GET' && p === '/api/themes') {
      return sendJson(res, 200, { themes: await listThemes() });
    }

    // Listar presentaciones existentes
    if (req.method === 'GET' && p === '/api/decks') {
      return sendJson(res, 200, { decks: await listDecks() });
    }

    // Crear nueva presentación vacía
    if (req.method === 'POST' && p === '/api/decks/new') {
      const body = JSON.parse(await readBody(req) || '{}');
      const title = String(body.title || 'Nueva presentación').trim();
      let slug = slugify(title);
      if (existsSync(path.join(outRoot, slug, 'deck.json'))) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
      const outDir = path.join(outRoot, slug);
      await mkdir(outDir, { recursive: true });
      const deck = normalizeDeck({
        title,
        subtitle: body.subtitle || 'Subtítulo de la sesión',
        author: body.author || 'Grado en Comunicación',
        theme: body.theme || 'aurora',
        transition: body.transition || 'cinematic',
        slides: [
          {
            layout: 'cover',
            kicker: 'Sesión de clase',
            title,
            subtitle: body.subtitle || 'Edita este subtítulo en el panel derecho',
            notes: '«¡Hola a todos! Bienvenidos a esta sesión.»',
            beat_notes: [],
          },
          {
            layout: 'concept',
            kicker: 'Bloque 1',
            title: 'Primera idea clave de la presentación',
            bullets: [
              '**Primer punto:** explica aquí el concepto principal.',
              '**Segundo punto:** añade un ejemplo concreto para el aula.',
            ],
            callout: 'Idea resumen para cerrar esta diapositiva.',
            notes: '«Presentamos ahora la primera idea clave del tema.»',
            beat_notes: [
              '«Desarrolla aquí el primer punto con tus propias palabras.»',
              '«Conecta este segundo punto con un caso real.»',
              '«Cierra la diapositiva lanzando una pregunta breve al aula.»',
            ],
          },
        ],
      });
      await writeFile(path.join(outDir, 'deck.json'), JSON.stringify(deck, null, 2), 'utf8');
      return sendJson(res, 200, { slug, deck });
    }

    // Rutas por slug: /api/decks/:slug/...
    const mDeck = /^\/api\/decks\/([^/]+)(?:\/([^/]+))?$/.exec(p);
    if (mDeck) {
      const slug = safeSlug(mDeck[1]);
      const action = mDeck[2] || '';
      const outDir = path.join(outRoot, slug);
      const deckFile = path.join(outDir, 'deck.json');

      // Cargar deck.json
      if (req.method === 'GET' && !action) {
        if (!existsSync(deckFile)) return sendJson(res, 404, { error: 'Presentación no encontrada' });
        const deck = normalizeDeck(JSON.parse(await readFile(deckFile, 'utf8')));
        return sendJson(res, 200, { slug, deck });
      }

      // Guardar deck.json
      if (req.method === 'POST' && action === 'save') {
        const body = JSON.parse(await readBody(req));
        const deck = normalizeDeck(body.deck || body);
        await mkdir(outDir, { recursive: true });
        await writeFile(deckFile, JSON.stringify(deck, null, 2), 'utf8');
        return sendJson(res, 200, { ok: true, slug, slides: deck.slides.length });
      }

      // Vista previa HTML en vivo de una diapositiva
      if (req.method === 'POST' && action === 'preview') {
        const body = JSON.parse(await readBody(req));
        const html = await renderPreviewHTML(body.deck, slug, body.slideIndex || 0);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(html);
        return;
      }

      // Subir imagen propia desde el PC
      if (req.method === 'POST' && action === 'upload-image') {
        const body = JSON.parse(await readBody(req));
        const dataUrl = String(body.dataUrl || '');
        const mImg = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
        if (!mImg) return sendJson(res, 400, { error: 'Formato de imagen no soportado (usa PNG, JPG o WebP)' });
        const ext = mImg[1].toLowerCase() === 'jpeg' ? 'jpg' : mImg[1].toLowerCase();
        const imgDir = path.join(outDir, 'images');
        await mkdir(imgDir, { recursive: true });
        const fileName = `custom-${Date.now()}.${ext}`;
        await writeFile(path.join(imgDir, fileName), Buffer.from(mImg[2], 'base64'));
        return sendJson(res, 200, { ok: true, image: `images/${fileName}` });
      }

      // Generar imagen con IA solo para una diapositiva concreta
      if (req.method === 'POST' && action === 'generate-image') {
        const body = JSON.parse(await readBody(req));
        const slideIndex = Number(body.slideIndex);
        const deck = normalizeDeck(body.deck);
        if (!deck.slides[slideIndex]) return sendJson(res, 400, { error: 'Diapositiva no válida' });
        if (!deck.slides[slideIndex].image_prompt) {
          return sendJson(res, 400, { error: 'Escribe primero una descripción (prompt) de la imagen' });
        }
        await mkdir(outDir, { recursive: true });
        const { generateImages } = await import('../images.js');
        await generateImages(deck, outDir, { only: [slideIndex], force: true, log: () => {} });
        await writeFile(deckFile, JSON.stringify(deck, null, 2), 'utf8');
        return sendJson(res, 200, { ok: true, image: deck.slides[slideIndex].image });
      }

      // Exportar HTML portátil (y opcionalmente PDF) y copiar a Descargas
      if (req.method === 'POST' && action === 'export') {
        const body = JSON.parse(await readBody(req));
        const deck = normalizeDeck(body.deck);
        const withPdf = Boolean(body.pdf);
        await mkdir(outDir, { recursive: true });
        await writeFile(deckFile, JSON.stringify(deck, null, 2), 'utf8');

        const htmlFile = await renderDeck(deck, outDir);
        const fileBase = slugify(deck.title);
        const standaloneFile = path.join(outDir, `${fileBase}-interactivo.html`);
        await renderStandaloneHTML(htmlFile, standaloneFile);

        const cleanTitle = (deck.title || slug).replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim();
        const dlHtml = path.join(downloadsDir, `${cleanTitle}.html`);
        await copyFile(standaloneFile, dlHtml);

        const result = {
          ok: true,
          htmlUrl: `/out/${slug}/${fileBase}-interactivo.html`,
          presenterUrl: `/out/${slug}/${fileBase}-interactivo.html?presenter=1`,
          downloadsHtml: dlHtml,
        };

        if (withPdf) {
          const { exportPDF } = await import('../pdf.js');
          const pdfFile = path.join(outDir, `${fileBase}.pdf`);
          await exportPDF(standaloneFile, pdfFile, { deck, outDir });
          const dlPdf = path.join(downloadsDir, `${cleanTitle}.pdf`);
          await copyFile(pdfFile, dlPdf);
          result.pdfUrl = `/out/${slug}/${fileBase}.pdf`;
          result.downloadsPdf = dlPdf;
        }
        return sendJson(res, 200, result);
      }
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error('[Studio Error]', err);
    sendJson(res, 500, { error: err.message || 'Error interno del servidor' });
  }
});

const PORT = Number(process.env.STUDIO_PORT) || 3456;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✨ Uni-Slides Studio activo en: http://localhost:${PORT}\n`);
});
