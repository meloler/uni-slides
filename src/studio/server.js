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
import { resilientFetch } from '../net.js';

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

const DEFAULT_STUDIO_MODEL = process.env.STUDIO_AI_MODEL || 'gpt-6-luna';

async function callOpenAIJson({ system, user, model, reasoningEffort }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY en el archivo .env');
  const chosenModel = model || DEFAULT_STUDIO_MODEL;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const payload = {
    model: chosenModel,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (reasoningEffort && /^gpt-(5|6)/i.test(chosenModel)) {
    payload.reasoning_effort = reasoningEffort;
  }
  const resp = await resilientFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`OpenAI (${chosenModel}) HTTP ${resp.status}: ${errTxt.slice(0, 220)}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('La IA devolvió una respuesta vacía');
  return JSON.parse(content);
}

const LAYOUT_SPECS = `
Formatos disponibles para cada diapositiva (devuelve SIEMPRE JSON válido en español):
- "cover": { layout, kicker, title, subtitle, notes, beat_notes: [] }
- "question": { layout, kicker, title, subtitle, notes, beat_notes: [] }
- "agenda": { layout, kicker, title, steps: [{label, text}], notes, beat_notes: [...] }
- "section": { layout, kicker, title, subtitle, notes, beat_notes: [] }
- "concept" o "example": { layout, kicker, title, body, bullets: ["**Término:** explicación"], callout, notes, beat_notes: [...] } (1 beat_note por cada bullet + 1 por callout)
- "comparison": { layout, kicker, title, columns: [{heading, bullets}, {heading, bullets}], notes, beat_notes: [...] }
- "process": { layout, kicker, title, steps: [{label, text}], notes, beat_notes: [...] }
- "big-number": { layout, kicker, title, big_number, big_number_label, body, notes, beat_notes: [] }
- "diagram": { layout, kicker, title, mermaid: "flowchart LR\\n  A[\\"Inicio\\"] --> B[\\"Fin\\"]", body, notes, beat_notes: [] }
- "quote": { layout, kicker, quote, quote_author, notes, beat_notes: [] }
- "summary": { layout, kicker, title, bullets: [...], notes, beat_notes: [...] }
- "quiz": { layout, kicker, title, questions: [...], callout, notes, beat_notes: [...] }
- "table": { layout, kicker, title, body, table: { headers: ["Col1", "Col2", "Col3"], rows: [["v1", "v2", "v3"]] }, callout, notes, beat_notes: [...] } (máx 4-5 columnas y 4-6 filas; 1 beat_note por fila o [] si se muestra entera)
- "bento": { layout, kicker, title, cards: [{ icon: "🎯", tag: "ETIQUETA", heading: "Título", text: "Resumen breve", span: 1 }], callout, notes, beat_notes: [...] } (3 a 6 tarjetas estilo infografía Bento; puedes poner span: 2 en una tarjeta destacada)
- "mindmap": { layout, kicker, title, center: "Idea Central", branches: [{ label: "Rama 1", items: ["detalle 1", "detalle 2"] }], callout, notes, beat_notes: [...] } (4 ramas ideales: 2 a la izquierda y 2 a la derecha)
- "visual-abstract": { layout, kicker, title, body, cards: [{ icon: "1", tag: "CONTEXTO", heading: "...", text: "..." }], callout, notes, beat_notes: [...] } (3 o 4 bloques conectados con flechas: Problema -> Método -> Hallazgo -> Impacto)
Reglas para notas de orador:
- "notes" (Pulso 0): guion hablado natural dirigido a los alumnos entre comillas «...».
- "beat_notes": guion hablado natural 1 a 1 con cada elemento con pulso (nunca repetir literalmente el texto en pantalla; explica con ejemplos reales).
`;

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

  const totalSlides = normalized.slides.length || 1;
  const idx = Math.max(0, Math.min(totalSlides - 1, Number(slideIdx) || 0));
  const activeSlide = normalized.slides[idx] || normalized.slides[0];
  const mappedSlide = activeSlide ? {
    ...activeSlide,
    image: activeSlide.image && !activeSlide.image.startsWith('http') && !activeSlide.image.startsWith('data:') && !activeSlide.image.startsWith('/')
      ? `/out/${slug}/${activeSlide.image}`
      : activeSlide.image,
  } : null;

  const previewDeck = {
    ...normalized,
    slides: mappedSlide ? [mappedSlide] : [],
  };

  let html = renderHTML(previewDeck, {
    themeCss: `${themeCss}\n${baseCss}`,
    mermaidSrc: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js',
  });

  // Mostrar el número real de diapositiva en el pie de página y ocultar HUD/transiciones
  html = html.replace('<span class="foot-pos">1 / 1</span>', `<span class="foot-pos">${idx + 1} / ${totalSlides}</span>`);
  const previewStyle = `
<style>
  .hud, .progress, .notes-panel { display: none !important; }
  .deck .slide { transition: none !important; opacity: 1 !important; visibility: visible !important; transform: none !important; filter: none !important; }
  body.beat-mode .slide .beat { opacity: 1 !important; transform: none !important; filter: none !important; pointer-events: auto !important; }
  .slide .anim { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
</style>`;
  html = html.replace('</body>', `${previewStyle}\n</body>`);
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

    // IA: Transformar una diapositiva existente a otro bloque visual (estilo Gamma)
    if (req.method === 'POST' && p === '/api/ai/transform-slide') {
      const body = JSON.parse(await readBody(req));
      const { slide, targetLayout, deckTitle, model } = body;
      if (!slide || !targetLayout) return sendJson(res, 400, { error: 'Falta slide o targetLayout' });
      const system = `Eres un diseñador instruccional y editor visual experto (estilo Gamma.app) para clases universitarias en español.
Convierte el contenido de la diapositiva proporcionada al formato exacto "${targetLayout}" sin perder rigor ni inventar datos falsos.
${LAYOUT_SPECS}
Devuelve ÚNICAMENTE un objeto JSON con la diapositiva transformada (propiedad "layout": "${targetLayout}").`;
      const user = `Presentación: "${deckTitle || ''}"
Formato destino deseado: "${targetLayout}"
Diapositiva actual (JSON):
${JSON.stringify(slide, null, 2)}`;
      const transformed = await callOpenAIJson({ system, user, model, reasoningEffort: 'low' });
      transformed.layout = targetLayout;
      const norm = normalizeDeck({ slides: [transformed] }).slides[0];
      // Conservar imagen si el layout destino la soporta y el original tenía una
      if (slide.image && !norm.image && ['cover', 'question', 'section', 'concept', 'example', 'big-number', 'quote'].includes(targetLayout)) {
        norm.image = slide.image;
      }
      return sendJson(res, 200, { ok: true, slide: norm, model: model || DEFAULT_STUDIO_MODEL });
    }

    // IA: Generar una presentación completa estilo Gamma a partir de un temario en Markdown/texto
    if (req.method === 'POST' && p === '/api/ai/generate-deck') {
      const body = JSON.parse(await readBody(req));
      const markdown = String(body.markdown || '').trim();
      if (markdown.length < 30) return sendJson(res, 400, { error: 'Pega o sube un temario más completo (mínimo 30 caracteres)' });
      const theme = body.theme || 'aurora';
      const author = body.author || 'Grado en Comunicación';
      const model = body.model || DEFAULT_STUDIO_MODEL;

      const system = `Eres un diseñador pedagógico experto que crea presentaciones universitarias visuales estilo Gamma.app en español.
A partir del temario en Markdown o texto del usuario, diseña una presentación rica, variada y fiel al temario (el número de diapositivas debe ser el natural para cubrir TODO el contenido sin omitir conceptos ni meter relleno).
OBLIGATORIO: Varía muchísimo los bloques visuales para que NO todas las diapositivas sean bullets: alterna "bento" (infografía de tarjetas), "table" (tablas comparativas), "mindmap" (mapas conceptuales), "visual-abstract" (esquemas de 4 bloques conectados), "comparison" (VS), "process" (pasos), "diagram" (Mermaid), "big-number", "example" y "concept".
${LAYOUT_SPECS}
Devuelve ÚNICAMENTE un JSON con esta forma:
{
  "title": "Título de la presentación",
  "subtitle": "Subtítulo breve",
  "hook": "Gran pregunta de la sesión",
  "slides": [ ... ]
}`;
      const user = `Temario a convertir en presentación visual estilo Gamma:\n\n${markdown.slice(0, 28000)}`;
      const generated = await callOpenAIJson({ system, user, model });
      const title = String(body.title || generated.title || 'Presentación IA').trim();
      let slug = slugify(title);
      if (existsSync(path.join(outRoot, slug, 'deck.json'))) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
      const deck = normalizeDeck({
        ...generated,
        title,
        author,
        theme,
        transition: body.transition || 'cinematic',
      });
      const outDir = path.join(outRoot, slug);
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, 'deck.json'), JSON.stringify(deck, null, 2), 'utf8');
      return sendJson(res, 200, { ok: true, slug, deck, model });
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
