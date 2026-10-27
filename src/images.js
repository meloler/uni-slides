// Motor de imágenes: genera una imagen por diapositiva con la API de OpenAI usando fetch nativo (0 dependencias npm).
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const IMAGE_MODEL = () => process.env.SLIDES_IMAGE_MODEL || 'gpt-image-2.5-flare';
const IMAGE_QUALITY = () => process.env.SLIDES_IMAGE_QUALITY || 'medium';

const NO_TEXT = 'Absolutely no text, letters, numbers, watermarks or logos in the image.';

// Layouts que usan imagen a pantalla completa (prefieren composición con espacio negativo para el texto)
const FULL_BLEED = ['cover', 'question', 'quote', 'big-number'];

export function getSlideImageSize(slide) {
  return FULL_BLEED.includes(slide.layout) ? '1536x864' : '1024x1024';
}

export function buildPrompt(deck, slide) {
  const comp = FULL_BLEED.includes(slide.layout)
    ? 'Wide 16:9 cinematic composition with generous empty negative space on the left side for overlaid text.'
    : 'Centered subject with generous margin around the edges so nothing is cropped, clean uncluttered composition.';
  return [slide.image_prompt, deck.image_style, comp, NO_TEXT].filter(Boolean).join(' ');
}

async function pool(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

/**
 * Genera las imágenes que falten usando fetch nativo contra la API de OpenAI (sin requerir npm install).
 * @param {object} deck
 * @param {string} outDir carpeta de la presentación (contendrá images/)
 */
export async function generateImages(deck, outDir, { log = console.log, force = false, only = null } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY para generar imágenes.');
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const imgDir = path.join(outDir, 'images');
  await mkdir(imgDir, { recursive: true });

  const jobs = deck.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.image_prompt && (only === null || only.includes(i)));

  let done = 0;
  await pool(jobs, Number(process.env.SLIDES_IMAGE_CONCURRENCY || 3), async ({ s, i }) => {
    const prompt = buildPrompt(deck, s);
    const size = getSlideImageSize(s);
    const hash = createHash('sha1').update(prompt + IMAGE_MODEL() + size).digest('hex').slice(0, 10);
    const file = `images/s${String(i + 1).padStart(2, '0')}-${hash}.png`;
    const abs = path.join(outDir, file);
    if (!force && existsSync(abs)) {
      s.image = file;
      return;
    }
    try {
      const resp = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: IMAGE_MODEL(),
          prompt,
          size,
          quality: IMAGE_QUALITY(),
          n: 1,
        }),
      });
      if (!resp.ok) {
        const errTxt = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errTxt.slice(0, 200)}`);
      }
      const res = await resp.json();
      const b64 = res.data?.[0]?.b64_json;
      if (b64) await writeFile(abs, Buffer.from(b64, 'base64'));
      else if (res.data?.[0]?.url) {
        const r = await fetch(res.data[0].url);
        await writeFile(abs, Buffer.from(await r.arrayBuffer()));
      }
      s.image = file;
      log(`  🖼  ${++done}/${jobs.length} diapo ${i + 1}`);
    } catch (e) {
      log(`  ✖ imagen diapo ${i + 1}: ${e.message}`);
    }
  });
  return deck;
}
