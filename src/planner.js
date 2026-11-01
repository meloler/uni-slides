// Planificador pedagógico: convierte el temario (texto) en deck.json con OpenAI (Structured Outputs) usando fetch nativo (0 dependencias npm).
import { DECK_SCHEMA, LAYOUTS, SLIDE_SCHEMA, normalizeDeck } from './schema.js';
import { lintDeck, formatIssues } from './lint.js';
import { resilientFetch } from './net.js';

const TEXT_MODEL = () => process.env.SLIDES_TEXT_MODEL || 'gpt-5';

const layoutDocs = Object.entries(LAYOUTS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n');

export const SYSTEM_PROMPT = `Eres un diseñador instruccional experto y profesor universitario de marketing y tecnología.
Conviertes un temario en una presentación de clase memorable, visual y bien estructurada.

## Estructura obligatoria (de lo general a lo específico — principio de la pirámide)
1. cover — título atractivo del tema.
2. question — LA GRAN PREGUNTA: una pregunta provocadora, concreta y relevante para los alumnos que todo el tema responde.
   (Ej.: "¿Por qué compras cosas que no necesitas?" en vez de "Introducción al comportamiento del consumidor").
3. agenda — 3-4 subpreguntas (steps: label = subpregunta corta, text = qué descubriremos) que juntas responden la gran pregunta.
4. Para cada subpregunta: section (título = la subpregunta, kicker = "Bloque N") seguido de 2-5 diapositivas de contenido
   que bajan de concepto general → concepto específico → ejemplo/caso real.
5. summary — vuelve a la gran pregunta (title = la respuesta en una frase), bullets = 3-4 takeaways.
6. quiz — 3-5 preguntas de repaso o debate (opcional pero recomendado).

## Reglas de buenas presentaciones (MODO PROFESOR GUIADO — OBLIGATORIAS)
- Ajusta el número de diapositivas a lo que el temario requiera de forma natural (normalmente entre 20 y 34 diapositivas, sin pasar de 40) y mantente 100% fiel al contenido del temario sin inventar tareas que no estén en él.
- Títulos de contenido = AFIRMACIÓN completa con la conclusión (estilo aserción-evidencia), máx. 14 palabras.
- Tarjetas Concepto + Mini-explicación:
  cada bullet (máx. 3 por diapositiva) debe tener entre 12 y 24 palabras con el formato "**Concepto clave**: explicación completa y clara en una frase".
- Rellena "callout" solo en diapositivas "concept", "example" o "quiz" (no pongas callout en "comparison", "process", "agenda" ni "summary").
- En diapositivas con layout "video", pon "bullets": [] (vacío) sin explicaciones previas ni tareas inventadas, para que al pulsar Espacio se reproduzca directamente el vídeo.
- Incluye casos reales conectados al temario y cada vez que pongas un "quiz" añade justo después una diapositiva con las respuestas explicadas.
- Varía los layouts: no repitas el mismo más de 2 veces seguidas.

## Reglas OBLIGATORIAS para las notas de orador (ALINEACIÓN 1 A 1 CON LA PANTALLA)
El profesor proyecta las diapositivas en la pantalla del aula mientras lee la Consola del Profesor en su portátil (Tecla P).
1. **ALINEACIÓN ESTRICTA CON LO QUE VEN LOS ALUMNOS:**
   - Cada pulso en \`beat_notes\` DEBE hablar exactamente del punto en \`**negrita**\` que los alumnos están viendo iluminado en pantalla en ese instante, ampliándolo con otras palabras más sencillas para que se entienda mejor.
   - En \`comparison\`, pon 1 nota por cada bullet de la columna 1 seguida de 1 nota por cada bullet de la columna 2 (ej. 2 + 2 = 4 notas en \`beat_notes\`).
2. **PROHIBIDO EL META-LENGUAJE PEDAGÓGICO:**
   - ❌ NUNCA escribas: "Voy a provocar una respuesta rápida...", "Quiero que piensen...", "Reservaré los últimos minutos...".
   - ✔️ Escribe DIRECTAMENTE las palabras habladas que el profesor dice a los alumnos («...»).
3. **LENGUAJE SENCILLO Y FIEL AL TEMARIO:**
   - Usa palabras claras y ejemplos fieles al temario, sin inventar tareas ni historias desconectadas de la diapositiva.

## Layouts disponibles
${layoutDocs}

## Campos
- Rellena solo los campos que use el layout; el resto a null o [] (vacío).
- image_prompt: en INGLÉS, describe una escena visual concreta y metafórica del concepto. Sin texto, letras ni logos en la imagen.
  No repitas el estilo en cada prompt (se añade automáticamente con image_style).
- image_style (nivel deck): un estilo visual coherente para TODAS las imágenes, en inglés
  (ej. "editorial 3D illustration, soft studio lighting, clean background, muted indigo and coral palette").
- mermaid: código Mermaid válido y simple (flowchart LR/TD o mindmap), etiquetas cortas entre comillas, máx. 8 nodos.
- kicker: etiqueta corta sobre el título (ej. "Bloque 2", "Caso real", "Dato clave"), o null.`;

async function callJSON(messages, schema, name) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY (ponla en .env o en el entorno).');
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const resp = await resilientFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL(),
      messages,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    }),
  });
  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`OpenAI HTTP ${resp.status}: ${errTxt.slice(0, 300)}`);
  }
  const res = await resp.json();
  const msg = res.choices[0].message;
  if (msg.refusal) throw new Error('El modelo rechazó la petición: ' + msg.refusal);
  return JSON.parse(msg.content);
}

/**
 * Genera un deck completo a partir del temario.
 * @param {string} syllabus texto del temario
 * @param {{minutes?:number, audience?:string, theme?:string, extra?:string, maxFixes?:number, log?:Function}} opts
 */
export async function planDeck(syllabus, opts = {}) {
  const log = opts.log || console.log;
  const minutes = opts.minutes || 60;
  const target = Math.max(24, Math.min(44, Math.round(minutes * 0.62)));
  const user = `Duración de la clase: ${minutes} minutos (≈${target} diapositivas).
Público: ${opts.audience || 'alumnos universitarios de grado'}.
${opts.extra ? 'Indicaciones del profesor: ' + opts.extra + '\n' : ''}
TEMARIO:
"""
${syllabus}
"""`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];

  log(`→ Planificando con ${TEXT_MODEL()} (~${target} diapositivas)...`);
  let raw = await callJSON(messages, DECK_SCHEMA, 'deck');
  let deck = normalizeDeck({ ...raw, theme: opts.theme });

  // Bucle de autocorrección con el revisor de reglas
  for (let pass = 1; pass <= (opts.maxFixes ?? 2); pass++) {
    const errors = lintDeck(deck).filter((x) => x.level === 'error');
    if (!errors.length) break;
    log(`→ Corrigiendo ${errors.length} problemas (pasada ${pass})...\n${formatIssues(errors)}`);
    messages.push({ role: 'assistant', content: JSON.stringify(raw) });
    messages.push({
      role: 'user',
      content: `El revisor ha encontrado estos problemas. Devuelve el deck COMPLETO corregido, sin cambiar lo que ya está bien:\n${formatIssues(errors)}`,
    });
    raw = await callJSON(messages, DECK_SCHEMA, 'deck');
    deck = normalizeDeck({ ...raw, theme: opts.theme });
  }
  return deck;
}

/** Reescribe una sola diapositiva según una instrucción ("hazla más visual", "añade un caso real"...). */
export async function regenSlide(deck, index, instruction) {
  const ctx = deck.slides.map((s, i) => `${i + 1}. [${s.layout}] ${s.title}`).join('\n');
  const raw = await callJSON(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Presentación "${deck.title}". Gran pregunta: "${deck.hook}".
Índice:\n${ctx}\n
Diapositiva ${index + 1} actual:\n${JSON.stringify(deck.slides[index], null, 2)}\n
Reescríbela siguiendo esta instrucción: "${instruction}". Devuelve solo la diapositiva.`,
      },
    ],
    SLIDE_SCHEMA,
    'slide'
  );
  const next = normalizeDeck({ ...deck, slides: [raw] }).slides[0];
  if (next.image_prompt === deck.slides[index].image_prompt) next.image = deck.slides[index].image;
  return next;
}
