#!/usr/bin/env node
// CLI `slides`: la interfaz común para ti, para OpenClaw y para cualquier otro agente.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { normalizeDeck } from './schema.js';
import { lintDeck, formatIssues } from './lint.js';
import { renderDeck, renderStandaloneHTML, listThemes } from './render/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carga robusta de .env compatible con cualquier versión de Node.js (≥18) y múltiples ubicaciones
function loadEnvironment() {
  const candidates = [
    path.join(root, '.env'),
    path.resolve('.env'),
    path.join(os.homedir(), 'uni-slides', '.env'),
    path.join(os.homedir(), '.env'),
    path.join(os.homedir(), '.openclaw', '.env'),
  ];
  for (const f of candidates) {
    if (existsSync(f)) {
      try {
        if (typeof process.loadEnvFile === 'function') {
          process.loadEnvFile(f);
          return f;
        }
      } catch {}
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
  }
  return null;
}

const loadedEnvFile = loadEnvironment();

const HELP = `
slides — generador de presentaciones de clase con IA

USO
  slides compile <deck.json> [--pdf] [--pptx] [--png] [--no-images]
      Toma un deck.json creado por el agente (OpenClaw), genera las imágenes y exporta HTML/PDF/PPTX.
  slides check                                 Verifica que el archivo .env y la API de OpenAI funcionan
  slides lint    <deck.json>                   Revisa las reglas de buenas presentaciones
  slides render  <deck.json> [--pdf] [--pptx] [--png] [--theme T]   Renderiza sin regenerar imágenes
  slides images  <deck.json> [--force] [--slide N]   Genera/regenera imágenes
  slides themes                                Lista los temas visuales
  slides build   <temario.md|-> [opciones]     Modo autónomo (usa LLM por API si no hay agente)

OPCIONES
  --theme <aurora|paper|neon>   Tema visual (por defecto: aurora)
  --minutes <n>                 Duración de la clase (por defecto: 50)
  --audience "<texto>"          Público (por defecto: alumnos universitarios de grado)
  --extra "<texto>"             Indicaciones extra (enfoque, ejemplos que quieres, etc.)
  --author "<texto>"            Nombre del profesor / asignatura para la portada
  --out <dir>                   Carpeta de salida (por defecto: ./out/<titulo>)
  --no-images                   No generar imágenes (usa fondos abstractos)
  --pdf / --pptx / --png        Exportar PDF / PPTX (editable en Google Slides) / capturas PNG
  --json                        Salida final en JSON (para agentes)
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[k + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else (args[key] = next), k++;
    } else args._.push(a);
  }
  return args;
}

function slug(s) {
  return String(s || 'presentacion')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function readInput(file) {
  if (!file || file === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return readFile(file, 'utf8');
}

async function loadDeck(file) {
  const raw = JSON.parse(await readInput(file));
  return normalizeDeck(raw);
}

async function saveDeck(deck, outDir) {
  await mkdir(outDir, { recursive: true });
  const f = path.join(outDir, 'deck.json');
  await writeFile(f, JSON.stringify(deck, null, 2));
  return f;
}

async function finish(deck, outDir, args, log) {
  if (deck.slides.some((s) => s.layout === 'video')) {
    const { resolveVideos } = await import('./youtube.js');
    await resolveVideos(deck, outDir, { log });
    await saveDeck(deck, outDir);
  }
  const html = await renderDeck(deck, outDir);
  log(`✔ HTML: ${html}`);
  const standalone = path.join(outDir, `${slug(deck.title)}-interactivo.html`);
  await renderStandaloneHTML(html, standalone);
  log(`✔ HTML Portátil (1 solo archivo con imágenes incrustadas): ${standalone}`);
  const result = { outDir, deck: path.join(outDir, 'deck.json'), html, standalone, slides: deck.slides.length };
  if (args.pdf || args.png) {
    try {
      const { exportPDF } = await import('./pdf.js');
      let shots = null;
      if (args.png) await mkdir((shots = path.join(outDir, 'png')), { recursive: true });
      const pdf = path.join(outDir, `${slug(deck.title)}.pdf`);
      await exportPDF(standalone, pdf, { screenshotsDir: shots });
      log(`✔ PDF: ${pdf}`);
      result.pdf = pdf;
      if (shots) result.png = shots;
    } catch (e) {
      log(`⚠ PDF directo no disponible en este contenedor (${e.message}). Puedes abrir ${path.basename(standalone)} en el navegador y pulsar Ctrl+P -> Guardar como PDF.`);
    }
  }
  if (args.pptx) {
    try {
      const { exportPPTX } = await import('./pptx.js');
      const pptx = path.join(outDir, `${slug(deck.title)}.pptx`);
      await exportPPTX(deck, outDir, pptx);
      log(`✔ PPTX (Google Slides): ${pptx}`);
      result.pptx = pptx;
    } catch (e) {
      log(`⚠ PPTX no disponible en modo cero-dependencias (${e.message}). El HTML interactivo está completo.`);
    }
  }
  const issues = lintDeck(deck);
  if (issues.length) log(`\nRevisión:\n${formatIssues(issues)}`);
  result.issues = issues;
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, input] = args._;
  const log = args.json ? (...m) => console.error(...m) : console.log;

  switch (cmd) {
    case 'build':
    case 'plan': {
      const { planDeck } = await import('./planner.js');
      const text = await readInput(input);
      if (!text.trim()) throw new Error('El temario está vacío.');
      const deck = await planDeck(text, {
        minutes: Number(args.minutes) || 50,
        audience: args.audience,
        theme: args.theme || 'aurora',
        extra: args.extra,
        log,
      });
      if (args.author) deck.author = args.author;
      const outDir = path.resolve(args.out || path.join(root, 'out', slug(deck.title)));
      await saveDeck(deck, outDir);
      log(`✔ deck.json (${deck.slides.length} diapositivas): ${outDir}`);
      if (cmd === 'plan') return out({ outDir, deck: path.join(outDir, 'deck.json') }, args);
      if (!args['no-images']) {
        const { generateImages } = await import('./images.js');
        log('→ Generando imágenes...');
        await generateImages(deck, outDir, { log });
        await saveDeck(deck, outDir);
      }
      return out(await finish(deck, outDir, args, log), args);
    }
    case 'compile': {
      const deck = await loadDeck(input);
      if (args.theme) deck.theme = args.theme;
      if (args.author) deck.author = args.author;
      const outDir = path.resolve(args.out || path.dirname(path.resolve(input)));
      if (!args['no-images']) {
        const { generateImages } = await import('./images.js');
        log('→ Generando imágenes...');
        await generateImages(deck, outDir, { log, force: !!args.force });
      }
      await saveDeck(deck, outDir);
      return out(await finish(deck, outDir, args, log), args);
    }
    case 'images': {
      const deck = await loadDeck(input);
      const outDir = path.dirname(path.resolve(input));
      const { generateImages } = await import('./images.js');
      const only = args.slide ? String(args.slide).split(',').map((n) => Number(n) - 1) : null;
      await generateImages(deck, outDir, { log, force: !!args.force, only });
      await saveDeck(deck, outDir);
      return out(await finish(deck, outDir, args, log), args);
    }
    case 'render': {
      const deck = await loadDeck(input);
      if (args.theme) deck.theme = args.theme;
      if (args.author) deck.author = args.author;
      const outDir = path.resolve(args.out || path.dirname(path.resolve(input)));
      if (args.theme || args.author || args.out) await saveDeck(deck, outDir);
      return out(await finish(deck, outDir, args, log), args);
    }
    case 'regen': {
      if (!args.slide || !args.do) throw new Error('Uso: slides regen <deck.json> --slide N --do "instrucción"');
      const { regenSlide } = await import('./planner.js');
      const deck = await loadDeck(input);
      const outDir = path.dirname(path.resolve(input));
      const idx = Number(args.slide) - 1;
      deck.slides[idx] = await regenSlide(deck, idx, args.do);
      if (!deck.slides[idx].image && deck.slides[idx].image_prompt && !args['no-images']) {
        const { generateImages } = await import('./images.js');
        await generateImages(deck, outDir, { log, only: [idx] });
      }
      await saveDeck(deck, outDir);
      log(`✔ Diapositiva ${idx + 1} reescrita: ${deck.slides[idx].title}`);
      return out(await finish(deck, outDir, args, log), args);
    }
    case 'lint': {
      const issues = lintDeck(await loadDeck(input));
      if (args.json) return out({ issues }, args);
      console.log(formatIssues(issues));
      process.exitCode = issues.some((x) => x.level === 'error') ? 1 : 0;
      return;
    }
    case 'check':
    case 'doctor': {
      console.log('🔍 Diagnóstico del entorno uni-slides:\n');
      console.log(`  • Versión de Node.js: ${process.version}`);
      console.log(`  • Carpeta raíz: ${root}`);
      console.log(`  • Archivo .env cargado: ${loadedEnvFile ? `✔ ${loadedEnvFile}` : '✖ No se encontró archivo .env'}`);

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.log('  • OPENAI_API_KEY: ✖ NO DETECTADA');
        console.log('\n👉 CÓMO SOLUCIONARLO EN TU SERVIDOR:');
        console.log('   1. Asegúrate de tener tu archivo .env en: ' + path.join(root, '.env'));
        console.log('   2. Contenido requerido:');
        console.log('      OPENAI_API_KEY=sk-proj-tu-clave-aqui');
        console.log('      SLIDES_IMAGE_MODEL=gpt-image-2.5-flare');
        console.log('   3. Vuelve a ejecutar: node src/cli.js check');
        process.exit(1);
      }

      const masked = apiKey.slice(0, 7) + '...' + apiKey.slice(-4);
      console.log(`  • OPENAI_API_KEY: ✔ Detectada (${masked}, ${apiKey.length} caracteres)`);

      const imgModel = process.env.SLIDES_IMAGE_MODEL || 'gpt-image-2.5-flare';
      console.log(`  • Modelo de imagen configurado: ${imgModel}`);

      console.log('\n→ Comprobando conexión con OpenAI API...');
      try {
        const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
        const resp = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!resp.ok) {
          const errTxt = await resp.text();
          console.log(`  ✖ Error de autenticación OpenAI (HTTP ${resp.status}): ${errTxt.slice(0, 200)}`);
          process.exit(1);
        }
        console.log('  ✔ Autenticación con OpenAI: Correcta (HTTP 200)');

        console.log('→ Generando 1 imagen de prueba con OpenAI...');
        const imgResp = await fetch(`${baseUrl}/images/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: imgModel,
            prompt: 'Abstract minimal 3D glass sphere glowing with subtle warm amber light, dark elegant background',
            size: '1024x1024',
            quality: 'medium',
            n: 1,
          }),
        });
        if (!imgResp.ok) {
          const imgErr = await imgResp.text();
          console.log(`  ✖ Fallo al generar imagen (HTTP ${imgResp.status}): ${imgErr.slice(0, 200)}`);
          console.log(`  💡 Si el modelo ${imgModel} no está disponible en tu cuenta, prueba con dall-e-3.`);
          process.exit(1);
        }
        console.log('  ✔ Generación de imagen con OpenAI: FUNCIONANDO AL 100% 🎉');
        console.log('\n✅ Todo está correctamente configurado para generar ilustraciones de alta calidad con OpenAI.');
      } catch (err) {
        console.log(`  ✖ Error de red al conectar con OpenAI: ${err.message}`);
        process.exit(1);
      }
      return;
    }
    case 'themes':
      return console.log((await listThemes()).join('\n'));
    default:
      console.log(HELP);
  }
}

function out(result, args) {
  if (args.json) console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error('✖ ' + e.message);
  process.exit(1);
});
