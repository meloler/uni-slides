// Planificador pedagógico: convierte el temario (texto) en deck.json con OpenAI (Structured Outputs) usando fetch nativo (0 dependencias npm).
import { DECK_SCHEMA, LAYOUTS, SLIDE_SCHEMA, normalizeDeck } from './schema.js';
import { lintDeck, formatIssues } from './lint.js';

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
- Para una clase de 60 minutos genera entre 34 y 42 diapositivas (no comprimas tablas ni listas: dedica varias diapositivas a desglosar casos, licencias y formatos).
- Títulos de contenido = AFIRMACIÓN completa con la conclusión (estilo aserción-evidencia), máx. 14 palabras.
- Tarjetas Concepto + Mini-explicación (para que el profesor se guíe leyendo la propia diapositiva sin depender de notas de orador):
  cada bullet (máx. 3 por diapositiva) debe tener entre 12 y 24 palabras con el formato "**Concepto clave**: explicación completa y clara en una frase".
- Rellena "callout" en las diapositivas de contenido con una analogía, matiz práctico o pregunta al aula (ej. "💡 Analogía: ...").
- Incluye 2 o 3 diapositivas con layout "video" (pon en video_query la búsqueda en YouTube en español y en bullets qué observar y comentar tras el vídeo).
- Incluye al menos 4 diapositivas "example" con casos reales y cada vez que pongas un "quiz" añade justo después una diapositiva con las respuestas explicadas.
- Varía los layouts: no repitas el mismo más de 2 veces seguidas.

## Reglas OBLIGATORIAS para las notas de orador (GUION HABLADO PARA EL PROFESOR)
El profesor proyecta las diapositivas en la pantalla del aula mientras lee la Consola del Profesor en su portátil (Tecla P).
Durante la clase NO tiene tiempo de traducir textos complejos ni de leer instrucciones pedagógicas sobre lo que "va a hacer".

1. **PROHIBIDO EL META-LENGUAJE PEDAGÓGICO:**
   - ❌ NUNCA escribas: "Voy a provocar una respuesta rápida...", "Quiero que piensen...", "Reservaré los últimos minutos...", "Comenzaré explicando...".
   - ✔️ Escribe DIRECTAMENTE las palabras habladas que el profesor dice a los alumnos:
     «Chicos, mirad estos dos barrios: Barrio A tiene 20 actividades y Barrio B tiene 10. A primera vista parece que B está abandonado. Pero alto: ¿y si Barrio B tiene solo 500 habitantes? El dato en bruto sin contexto engaña.»

2. **LENGUAJE SENCILLO, NATURAL Y COLOQUIAL (Como a un amigo inteligente de 20 años):**
   - Evita jerga administrativa o legal farragosa ("figura normativa", "inferencia de grupo pequeño", "autorización general").
   - Usa metáforas cotidianas (el menú del bar, el aparcamiento lleno, la lista de Spotify, el Excel con contraseñas, el carné de la biblioteca).
   - Frases cortas y directas. Si hay un concepto técnico (como Seudonimización vs Anonimización, o Hash), explícalo con una analogía visual inmediata.

3. **CAMPOS OBLIGATORIOS POR DIAPOSITIVA:**
   - notes: Guion hablado de APERTURA (Pulso 0). Es lo que dice el profesor nada más pasar a la diapositiva, antes de pulsar Espacio para revelar los puntos. Plantea la pregunta, la anécdota o el titular.
   - beat_notes: Array de strings con el guion hablado EXACTO para cada pulso que aparece al pulsar Espacio:
     - 1 string por cada bullet / columna / paso.
     - 1 string adicional al final para el callout (analogía o pregunta al aula).
     Cada frase debe ser lo que el profesor dice en voz alta para explicar ese punto concreto sin repetir literalmente el texto de la pantalla.

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
  const resp = await fetch(`${baseUrl}/chat/completions`, {
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
    if (!errors.length) {
      log(`✔ Validación limpia (intento ${pass}).`);
      break;
    }
    log(`⚠ ${errors.length} errores detectados; corrigiendo (pase ${pass})...`);
    const fixPrompt = `El revisor detectó estos errores en el JSON anterior:\n${formatIssues(errors)}\nCorrige el deck devolviendo el JSON completo válido.`;
    raw = await callJSON(
      [...messages, { role: 'assistant', content: JSON.stringify(deck) }, { role: 'user', content: fixPrompt }],
      DECK_SCHEMA,
      'deck_fixed'
    );
    deck = normalizeDeck({ ...raw, theme: opts.theme });
  }

  return deck;
}
