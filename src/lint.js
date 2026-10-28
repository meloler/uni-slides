// Revisor de "buenas presentaciones" (Modo Profesor Guiado):
// Permite bullets con "Concepto + mini-explicación" para que la diapositiva guíe al profesor sin depender de las notas.

const words = (t) => (t || '').replace(/\*\*/g, '').trim().split(/\s+/).filter(Boolean).length;

const VISUAL_REQUIRED = ['concept', 'example', 'question'];
const ASSERTION_TITLES = ['concept', 'example', 'diagram', 'big-number', 'comparison', 'process', 'video'];

export function lintDeck(deck) {
  const issues = [];
  const add = (i, level, msg) => issues.push({ slide: i + 1, level, msg });
  const slides = deck.slides || [];

  if (slides.length < 10) add(-1, 'error', `Solo hay ${slides.length} diapositivas; mínimo 10.`);
  if (slides[0]?.layout !== 'cover') add(0, 'warn', 'La primera diapositiva debería ser "cover".');
  if (!slides.slice(0, 3).some((s) => s.layout === 'question'))
    add(1, 'error', 'Falta la GRAN PREGUNTA ("question") al principio.');
  if (!slides.some((s) => s.layout === 'agenda')) add(2, 'warn', 'Falta la diapositiva "agenda" (mapa de subpreguntas).');
  if (!slides.slice(-4).some((s) => s.layout === 'summary'))
    add(slides.length - 1, 'error', 'Falta "summary" al final que responda la gran pregunta.');

  if (slides.length >= 25) {
    const videos = slides.filter((s) => s.layout === 'video').length;
    const examples = slides.filter((s) => s.layout === 'example').length;
    if (videos < 2) add(-1, 'warn', `Solo hay ${videos} vídeos de YouTube; incluye al menos 2-3 para dinamizar los 60 min.`);
    if (examples < 3) add(-1, 'warn', `Solo hay ${examples} casos reales ("example"); incluye al menos 4.`);
  }

  let streak = 1;
  slides.forEach((s, i) => {
    const nb = s.bullets?.length || 0;
    const tw = words(s.title);

    if (tw > 15) add(i, 'error', `Título demasiado largo (${tw} palabras, máx. 15).`);
    if (ASSERTION_TITLES.includes(s.layout) && tw < 4)
      add(i, 'warn', `El título "${s.title}" es una etiqueta; debe ser una afirmación completa (≥4 palabras).`);

    if (s.layout === 'summary') {
      if (nb > 4) add(i, 'error', `Summary con ${nb} takeaways (máx. 4).`);
    } else if (nb > 4) add(i, 'error', `${nb} bullets (máx. 4). Divide en dos diapositivas.`);

    s.bullets?.forEach((b, j) => {
      if (words(b) > 28) add(i, 'warn', `Bullet ${j + 1} muy largo (${words(b)} palabras, máx. 28).`);
    });

    const bodyWords = words(s.body) + (s.bullets || []).reduce((a, b) => a + words(b), 0) + words(s.callout);
    if (bodyWords > 95) add(i, 'error', `Demasiado texto en pantalla (${bodyWords} palabras, máx. 95). Divide en 2 diapositivas.`);

    if (VISUAL_REQUIRED.includes(s.layout) && !s.image_prompt && !s.image && !s.mermaid)
      add(i, 'error', `"${s.layout}" necesita un visual (image_prompt o mermaid).`);
    if (s.layout === 'video' && !s.video_query && !s.video_url)
      add(i, 'error', 'Layout "video" necesita "video_query" (búsqueda de YouTube).');
    if (s.layout === 'diagram' && !s.mermaid) add(i, 'error', 'Layout "diagram" sin código mermaid.');
    if (s.layout === 'comparison' && s.columns?.length !== 2) add(i, 'error', 'Comparison necesita exactamente 2 columnas.');
    if (['process', 'agenda'].includes(s.layout) && (s.steps?.length < 3 || s.steps?.length > 5))
      add(i, 'error', `${s.layout} necesita entre 3 y 5 steps.`);
    if (s.layout === 'big-number' && !s.big_number) add(i, 'error', 'big-number sin cifra.');
    if (s.layout === 'quiz' && !(s.questions?.length >= 2)) add(i, 'error', 'Quiz necesita ≥2 preguntas.');

    // Validación de notas de orador (guion hablado para el profesor)
    if (!s.notes || !s.notes.trim()) {
      add(i, 'error', 'Falta la nota de orador ("notes"). Debe incluir el guion hablado para el profesor.');
    } else {
      const metaMatch = s.notes.match(/^(voy a|quiero que|reservar[eé]|no aceptar[eé]|yo organizar[ií]a|vamos a ver c[oó]mo|comenzar[eé]|empezar[eé]|pretendo|proceder[eé])/i);
      if (metaMatch) {
        add(i, 'warn', `La nota de orador parece una instrucción para ti ("${metaMatch[0]}..."). Escribe directamente el guion hablado que dirás a los alumnos en clase («...»).`);
      }
    }

    // Comprobación de beats y beat_notes
    let expectedBeats = 0;
    if (s.bullets?.length) expectedBeats += s.bullets.length;
    if (s.steps?.length) expectedBeats += s.steps.length;
    if (s.columns?.length) expectedBeats += s.columns.length;
    if (s.questions?.length) expectedBeats += s.questions.length;
    if (s.callout) expectedBeats += 1;
    if (s.layout === 'video') expectedBeats += 1;

    if (expectedBeats >= 2 && (!s.beat_notes || s.beat_notes.length === 0)) {
      add(i, 'warn', `Esta diapositiva tiene ${expectedBeats} pulsos pero "beat_notes" está vacío. Añade un array de strings con el guion hablado para cada pulso al pulsar Espacio.`);
    }

    if (i > 0 && s.layout === slides[i - 1].layout && s.layout !== 'section') {
      streak++;
      if (streak > 2) add(i, 'warn', `Layout "${s.layout}" repetido ${streak} veces seguidas; varía el ritmo visual.`);
    } else streak = 1;
  });

  return issues;
}

export function formatIssues(issues) {
  if (!issues.length) return '✔ Sin problemas.';
  return issues
    .map((x) => `${x.level === 'error' ? '✖' : '⚠'} [${x.slide > 0 ? 'diapo ' + x.slide : 'deck'}] ${x.msg}`)
    .join('\n');
}
