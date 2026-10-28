// Esquema de deck.json: el formato intermedio entre el agente/IA y el renderizador.
// Incluye el modo "Profesor Guiado": puntos con Concepto + Mini-explicación, callout inferior y vídeos de YouTube.

export const LAYOUTS = {
  cover: 'Portada: título del tema, subtítulo y (opcional) imagen de fondo.',
  question: 'La GRAN PREGUNTA (gancho). Pantalla completa con imagen.',
  agenda: 'Mapa: 3-5 subpreguntas (en "steps") que, juntas, responden la gran pregunta.',
  section: 'Separador de bloque: kicker "Bloque N" + título = la subpregunta del bloque.',
  concept: 'Un concepto guiado. Título = afirmación completa. 2-3 bullets con formato "**Concepto**: mini-explicación completa" + callout con ejemplo.',
  'big-number': 'Un dato/cifra/símbolo impactante: big_number + big_number_label + body explicativo.',
  comparison: 'Comparación de 2 columnas (columns[2]): A vs B, mito/realidad, antes/después.',
  process: 'Proceso, tabla comparativa o checklist en 3-5 pasos (steps con label + text explicativo).',
  diagram: 'Diagrama Mermaid (flowchart) para estructuras, flujos o arquitecturas.',
  quote: 'Cita o pregunta clave destacada (quote + quote_author).',
  example: 'Caso real de empresa/institución: título = la lección, body + bullets explicativos + imagen.',
  video: 'Vídeo de YouTube para dinamizar la clase: video_query (búsqueda) + bullets de qué observar/comentar.',
  summary: 'Síntesis: vuelve a la gran pregunta y la responde. Takeaways en bullets (3-4).',
  quiz: 'Debate / Repaso: 3-4 preguntas en "questions" (seguido siempre de una diapositiva con las respuestas).',
};

export const LAYOUT_NAMES = Object.keys(LAYOUTS);

const str = { type: 'string' };
const nstr = { type: ['string', 'null'] };
const strArr = { type: 'array', items: str };

// JSON Schema estricto (Structured Outputs de OpenAI: todo required, nullables explícitos)
export const SLIDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    layout: { type: 'string', enum: LAYOUT_NAMES },
    kicker: nstr,
    title: str,
    subtitle: nstr,
    bullets: strArr,
    body: nstr,
    callout: nstr,
    big_number: nstr,
    big_number_label: nstr,
    columns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { heading: str, bullets: strArr },
        required: ['heading', 'bullets'],
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { label: str, text: str },
        required: ['label', 'text'],
      },
    },
    quote: nstr,
    quote_author: nstr,
    mermaid: nstr,
    questions: strArr,
    video_query: nstr,
    image_prompt: nstr,
    image_side: { type: ['string', 'null'], enum: ['left', 'right', null] },
    notes: str,
    beat_notes: strArr,
  },
  required: [
    'layout', 'kicker', 'title', 'subtitle', 'bullets', 'body', 'callout', 'big_number', 'big_number_label',
    'columns', 'steps', 'quote', 'quote_author', 'mermaid', 'questions', 'video_query', 'image_prompt', 'image_side', 'notes', 'beat_notes',
  ],
};

export const DECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: str,
    subtitle: nstr,
    hook: str,
    image_style: str,
    slides: { type: 'array', items: SLIDE_SCHEMA },
  },
  required: ['title', 'subtitle', 'hook', 'image_style', 'slides'],
};

/** Rellena valores por defecto para que el renderizador nunca reciba undefined. */
export function normalizeDeck(deck) {
  const d = {
    title: deck.title || 'Presentación',
    subtitle: deck.subtitle ?? null,
    author: deck.author ?? null,
    hook: deck.hook || '',
    theme: deck.theme || 'aurora',
    image_style: deck.image_style || '',
    slides: [],
  };
  let side = 'right';
  for (const s of deck.slides || []) {
    const slide = {
      layout: LAYOUT_NAMES.includes(s.layout) ? s.layout : 'concept',
      kicker: s.kicker ?? null,
      title: s.title || '',
      subtitle: s.subtitle ?? null,
      bullets: s.bullets || [],
      body: s.body ?? null,
      callout: s.callout ?? null,
      big_number: s.big_number ?? null,
      big_number_label: s.big_number_label ?? null,
      columns: s.columns || [],
      steps: s.steps || [],
      quote: s.quote ?? null,
      quote_author: s.quote_author ?? null,
      mermaid: s.mermaid ?? null,
      questions: s.questions || [],
      video_query: s.video_query ?? null,
      video_url: s.video_url ?? null,
      video_title: s.video_title ?? null,
      video_channel: s.video_channel ?? null,
      video_duration: s.video_duration ?? null,
      image_prompt: s.image_prompt ?? null,
      image_side: s.image_side ?? null,
      image: s.image ?? null,
      notes: s.notes || '',
      beat_notes: Array.isArray(s.beat_notes) ? s.beat_notes : [],
    };
    if (['concept', 'example'].includes(slide.layout) && !slide.image_side) {
      slide.image_side = side;
      side = side === 'right' ? 'left' : 'right';
    }
    d.slides.push(slide);
  }
  return d;
}
