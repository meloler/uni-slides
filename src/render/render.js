// Renderizador: deck.json -> index.html autocontenido (web a pantalla completa + imprimible a PDF).
import { readFile, writeFile, copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export async function listThemes() {
  return (await readdir(path.join(here, 'themes'))).filter((f) => f.endsWith('.css')).map((f) => f.slice(0, -4));
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Mini-markdown: **negrita** -> <strong>
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const pad = (n) => String(n).padStart(2, '0');

const kicker = (s, cls = 'anim') => (s.kicker ? `<div class="kicker ${cls}">${esc(s.kicker)}</div>` : '');
const bullets = (arr, cls = 'anim') =>
  arr?.length ? `<ul class="bullets ${cls}">${arr.map((b) => `<li class="beat">${md(b)}</li>`).join('')}</ul>` : '';
const body = (s, cls = 'anim') => (s.body ? `<p class="body ${cls}">${md(s.body)}</p>` : '');
const callout = (s, cls = 'anim') => (s.callout ? `<div class="callout beat ${cls}">${md(s.callout)}</div>` : '');
const imgDiv = (s, cls) =>
  s.image ? `<div class="img ${cls}" style="background-image:url('${esc(s.image)}')"></div>` : `<div class="ph ${cls}"></div>`;
const bgImage = (s) => `${imgDiv(s, 'bg-full')}<div class="bg-overlay"></div>`;
const mermaid = (code) => `<pre class="mermaid">${esc(code)}</pre>`;

const R = {
  cover: (s, d) => `
    ${bgImage(s)}
    ${kicker(s)}
    <h1 class="anim">${md(s.title)}</h1>
    ${s.subtitle ? `<p class="subtitle anim">${md(s.subtitle)}</p>` : ''}
    ${d.author ? `<div class="meta anim">${esc(d.author)}</div>` : ''}`,

  question: (s) => `
    ${bgImage(s)}
    <div class="qmark grad-text">?</div>
    <div class="kicker anim">${esc(s.kicker || 'La gran pregunta')}</div>
    <h1 class="anim">${md(s.title)}</h1>
    ${s.subtitle ? `<p class="subtitle anim">${md(s.subtitle)}</p>` : ''}`,

  agenda: (s) => `
    ${kicker({ kicker: s.kicker || 'Hoja de ruta' })}
    <h2 class="anim">${md(s.title)}</h2>
    <div class="cards n${Math.min(5, Math.max(2, s.steps.length))}">
      ${s.steps
        .map(
          (st, i) => `<div class="card beat anim a${Math.min(5, i + 2)}">
            <div class="num grad-text">${pad(i + 1)}</div><h3>${md(st.label)}</h3><p>${md(st.text)}</p></div>`
        )
        .join('')}
    </div>`,

  section: (s, d, i, ctx) => `
    <div class="big grad-text anim">${pad(ctx.section)}</div>
    <div class="txt">
      ${kicker({ kicker: s.kicker || `Bloque ${ctx.section}` })}
      <h2 class="anim">${md(s.title)}</h2>
      ${s.subtitle ? `<p class="subtitle anim">${md(s.subtitle)}</p>` : ''}
    </div>
    ${s.image_prompt || s.image ? imgDiv(s, 'side') : ''}`,

  concept: (s) => split(s),
  example: (s) => split({ ...s, kicker: s.kicker || 'Caso real' }),

  'big-number': (s) => `
    ${s.image || s.image_prompt ? bgImage(s) : ''}
    ${kicker({ kicker: s.kicker || 'Dato clave' })}
    <div class="num grad-text anim count-up" data-val="${esc(s.big_number)}">${esc(s.big_number)}</div>
    <div class="label anim">${md(s.big_number_label || s.title)}</div>
    ${s.big_number_label && s.title
      ? `<p class="body anim"><span style="color:var(--fg);font-weight:700">${md(s.title)}.</span> ${md(s.body || '')}</p>`
      : body(s)}`,

  comparison: (s) => `
    ${kicker(s)}
    <h2 class="anim">${md(s.title)}</h2>
    <div class="cols anim">
      ${s.columns
        .slice(0, 2)
        .map((c) => `<div class="card col"><h3>${md(c.heading)}</h3>${bullets(c.bullets, '')}</div>`)
        .join('')}
      <div class="vs">VS</div>
    </div>`,

  process: (s) => `
    ${kicker(s)}
    <h2 class="anim">${md(s.title)}</h2>
    <div class="steps cards n${Math.min(5, Math.max(2, s.steps.length))}" style="margin-top:90px">
      ${s.steps
        .map(
          (st, i) => `<div class="step beat anim a${Math.min(5, i + 2)}">
            <div class="dot">${i + 1}</div><h3>${md(st.label)}</h3><p>${md(st.text)}</p></div>`
        )
        .join('')}
    </div>`,

  diagram: (s) => `
    ${kicker(s)}
    <h2 class="anim">${md(s.title)}</h2>
    <div class="diagram anim">${s.mermaid ? mermaid(s.mermaid) : ''}</div>
    ${body(s)}`,

  quote: (s) => `
    ${s.image || s.image_prompt ? bgImage(s) : ''}
    <div class="mark grad-text anim">“</div>
    <blockquote class="anim">${md(s.quote || s.title)}</blockquote>
    ${s.quote_author ? `<div class="author anim">— ${esc(s.quote_author)}</div>` : ''}`,

  summary: (s) => `
    ${kicker({ kicker: s.kicker || 'La respuesta' })}
    <h2 class="anim">${md(s.title)}</h2>
    ${body(s)}
    <div class="takeaways">
      ${s.bullets
        .map((b, i) => `<div class="card takeaway beat anim a${Math.min(5, i + 2)}"><div class="check">✓</div><p>${md(b)}</p></div>`)
        .join('')}
    </div>`,

  quiz: (s) => `
    ${kicker({ kicker: s.kicker || 'Repaso' })}
    <h2 class="anim">${md(s.title)}</h2>
    <div class="qs">
      ${s.questions
        .map((q, i) => `<div class="card q beat anim a${Math.min(5, i + 2)}"><div class="num grad-text">${i + 1}</div><p>${md(q)}</p></div>`)
        .join('')}
    </div>
    ${callout(s)}`,

  video: (s) => {
    const url = s.video_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(s.video_query || s.title)}`;
    const thumbStyle = s.image ? `style="background-image:url('${esc(s.image)}')"` : '';
    return `
      <div class="txt">
        ${kicker({ kicker: s.kicker || '▶ Vídeo para ver en clase' })}
        <h2 class="anim">${md(s.title)}</h2>
        ${body(s)}
        ${bullets(s.bullets)}
        ${callout(s)}
      </div>
      <a class="yt-card anim a3" href="${esc(url)}" target="_blank" rel="noopener">
        <div class="yt-thumb ${s.image ? '' : 'ph'}" ${thumbStyle}>
          <div class="yt-play">▶</div>
          ${s.video_duration ? `<div class="yt-dur">${esc(s.video_duration)}</div>` : ''}
        </div>
        <div class="yt-meta">
          <div class="yt-badge">YouTube · Clic para reproducir</div>
          <div class="yt-title">${esc(s.video_title || s.video_query || s.title)}</div>
          <div class="yt-sub">
            <span>${esc(s.video_channel || 'YouTube')}</span>
            <span class="yt-url">${esc(url.replace(/^https?:\/\/(www\.)?/, ''))}</span>
          </div>
        </div>
      </a>`;
  },
};

function split(s) {
  const visual = s.mermaid
    ? `<div class="visual diagram-box anim a3">${mermaid(s.mermaid)}</div>`
    : `<div class="visual anim a3">${imgDiv(s, '')}</div>`;
  return `
    <div class="txt">
      ${kicker(s)}
      <h2 class="anim">${md(s.title)}</h2>
      ${body(s)}
      ${bullets(s.bullets)}
      ${callout(s)}
    </div>
    ${visual}`;
}

const LAYOUT_CLASS = { concept: 'l-split', example: 'l-split', video: 'l-split' };
const NO_FOOTER = ['cover', 'question', 'section'];

export function renderHTML(deck, { themeCss, mermaidSrc }) {
  let section = 0;
  const total = deck.slides.length;
  const slides = deck.slides
    .map((s, i) => {
      if (s.layout === 'section') section++;
      const inner = (R[s.layout] || R.concept)(s, deck, i, { section });
      const cls = [`slide`, `l-${s.layout}`, LAYOUT_CLASS[s.layout] || '', s.image_side === 'left' ? 'left' : '']
        .filter(Boolean)
        .join(' ');
      const footer = NO_FOOTER.includes(s.layout)
        ? ''
        : `<div class="footer"><span>${esc(deck.title.replace(/\*\*/g, ''))}</span><span class="foot-pos">${i + 1} / ${total}</span></div>`;
      const plainTitle = (s.title || s.quote || s.big_number_label || '').replace(/\*\*/g, '');
      const beatNotesJson = JSON.stringify(s.beat_notes || []);
      return `<section class="${cls}" data-idx="${i}" data-title="${esc(plainTitle)}" data-kicker="${esc(s.kicker || s.layout)}" data-notes="${esc(s.notes)}" data-beat-notes="${esc(beatNotesJson)}">${inner}${footer}</section>`;
    })
    .join('\n');

  const usesMermaid = deck.slides.some((s) => s.mermaid);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deck.title.replace(/\*\*/g, ''))}</title>
<style>${themeCss}</style>
<style>${BASE_CSS}</style>
</head><body class="beat-mode">
<div class="stage"><div class="deck">
${slides}
</div></div>
<div class="progress"></div>
<div class="hud">
  <span class="hud-pill" id="hud-pos">1 / ${total}</span>
  <span class="hud-pill" id="hud-beats" title="Tecla M: activar/desactivar Modo Beats (paso a paso)">⚡ Beats ON</span>
  <span class="hud-pill hud-pres" id="hud-pres" title="Tecla P: Abrir Ventana de Presentador en tu pantalla (Pantalla 1)">🎙️ Vista Profesor (P)</span>
  <span class="hud-pill hud-keys"><b>Espacio/→</b> avanzar · <b>P</b> presentador · <b>O</b> mosaico · <b>B</b> negro · <b>L</b> láser · <b>F</b> pantalla completa</span>
</div>
<div class="overview" id="overview"></div>
<div class="blackout" id="blackout"><span>Modo Pizarra / Silencio · Pulsa <b>B</b> o haz clic para volver</span></div>
<div class="laser" id="laser"></div>
<div class="notes-panel"></div>

<!-- ===== Consola de Presentador (Pantalla 1: ?presenter=1) ===== -->
<div class="presenter-ui" id="presenter-ui">
  <header class="pr-top">
    <div class="pr-brand">
      <span class="pr-pos-badge" id="pr-pos-badge">1 / ${total}</span>
      <span class="pr-step-badge" id="pr-step-badge">Apertura</span>
    </div>
    <div class="pr-timer-box">
      <span class="pr-clock" id="pr-timer">00:00</span>
      <button class="pr-btn pr-btn-sm" id="pr-timer-toggle" title="Pausar/Reanudar">⏸</button>
      <button class="pr-btn pr-btn-sm" id="pr-timer-reset" title="Reiniciar reloj">↺</button>
    </div>
    <div class="pr-actions">
      <button class="pr-btn" id="pr-prev">← Anterior</button>
      <button class="pr-btn pr-btn-primary" id="pr-next">Siguiente (Espacio) →</button>
      <button class="pr-btn" id="pr-blackout" title="Tecla B: Pantalla en negro">⬛ Negro (B)</button>
    </div>
  </header>

  <main class="pr-main">
    <section class="pr-script-col">
      <div class="pr-now-card">
        <div class="pr-script-header">
          <div>
            <div class="pr-card-label" id="pr-now-label">GUION PARA DECIR AHORA</div>
            <div class="pr-now-title" id="pr-now-title"></div>
          </div>
          <div class="pr-dots" id="pr-dots"></div>
        </div>
        <div class="pr-now-body" id="pr-now-body"></div>
        <div class="pr-next-hint" id="pr-next-body"></div>
      </div>
    </section>

    <aside class="pr-side-col">
      <div class="pr-mini-wrap pr-curr-wrap">
        <div class="pr-mini-head">
          <span class="pr-mini-label">📺 EN PROYECTOR AHORA</span>
          <span class="pr-mini-sub" id="pr-curr-sub"></span>
        </div>
        <div class="pr-mini-stage" id="pr-mini-stage"></div>
      </div>
      <div class="pr-mini-wrap pr-next-wrap">
        <div class="pr-mini-head">
          <span class="pr-mini-label">🔜 SIGUIENTE DIAPOSITIVA</span>
          <span class="pr-mini-sub" id="pr-next-sub"></span>
        </div>
        <div class="pr-mini-stage pr-next-stage" id="pr-next-stage"></div>
      </div>
    </aside>
  </main>
</div>
${usesMermaid ? `<script src="${mermaidSrc}"></script>` : ''}
<script>${RUNTIME}</script>
</body></html>`;
}

let BASE_CSS = '';
const RUNTIME = String.raw`
(async () => {
  const isPresenter = location.search.includes('presenter=1');
  if (isPresenter) document.body.classList.add('is-presenter');

  const slides = [...document.querySelectorAll('.slide')];
  const stage = document.querySelector('.stage');
  const deck = document.querySelector('.deck');
  const prog = document.querySelector('.progress');
  const notes = document.querySelector('.notes-panel');
  const hudPos = document.getElementById('hud-pos');
  const hudBeats = document.getElementById('hud-beats');
  const hudPres = document.getElementById('hud-pres');
  const overview = document.getElementById('overview');
  const laser = document.getElementById('laser');

  // En modo presentador, movemos el escenario en miniatura a la columna derecha
  let nextDeck = null, nextSlides = [];
  if (isPresenter) {
    const mini = document.getElementById('pr-mini-stage');
    if (mini && stage) mini.appendChild(stage);
  }

  let beatMode = !location.search.includes('beats=0');
  let i = 0, b = 0;
  let syncing = false;

  // Canal de sincronización en tiempo real entre Pantalla 1 (Profesor) y Pantalla 2 (Proyector)
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('uni_slides_sync') : null;
  const sendSync = (extra = {}) => {
    if (syncing) return;
    const msg = {
      s: i, b, beatMode,
      blackout: document.body.classList.contains('show-blackout'),
      ...extra, t: Date.now()
    };
    try { chan?.postMessage(msg); } catch {}
    try { localStorage.setItem('uni_slides_state', JSON.stringify(msg)); } catch {}
  };

  const onSyncMsg = (msg) => {
    if (!msg) return;
    syncing = true;
    if (typeof msg.beatMode === 'boolean' && msg.beatMode !== beatMode) {
      beatMode = msg.beatMode;
      document.body.classList.toggle('beat-mode', beatMode);
      hudBeats.textContent = beatMode ? '⚡ Beats ON' : '📄 Slide entera';
    }
    if (typeof msg.blackout === 'boolean') {
      document.body.classList.toggle('show-blackout', msg.blackout);
    }
    if (typeof msg.s === 'number') {
      show(msg.s, msg.b);
    }
    syncing = false;
  };
  if (chan) chan.onmessage = (ev) => onSyncMsg(ev.data);
  addEventListener('storage', (ev) => {
    if (ev.key === 'uni_slides_state' && ev.newValue) {
      try { onSyncMsg(JSON.parse(ev.newValue)); } catch {}
    }
  });

  // Abrir ventana de presentador separada (Tecla P)
  const openPresenterWindow = () => {
    const u = new URL(location.href);
    u.searchParams.set('presenter', '1');
    u.hash = '#' + (i + 1) + '.' + b;
    window.open(u.toString(), 'uni_slides_presenter', 'width=1280,height=820,menubar=no,toolbar=no,location=no,status=no');
  };
  if (hudPres) hudPres.onclick = (e) => { e.stopPropagation(); openPresenterWindow(); };

  // Construir mosaico Overview (Tecla O)
  slides.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'ov-card';
    item.innerHTML = '<div class="ov-num">' + String(idx + 1).padStart(2, '0') + '</div>'
      + '<div class="ov-kicker">' + (s.dataset.kicker || '') + '</div>'
      + '<div class="ov-title">' + (s.dataset.title || '') + '</div>';
    item.onclick = (e) => { e.stopPropagation(); document.body.classList.remove('show-overview'); show(idx, 0); };
    overview.appendChild(item);
  });
  const ovCards = [...overview.querySelectorAll('.ov-card')];

  const getBeats = (idx) => [...slides[idx].querySelectorAll('.beat')];

  // Extrae la nota de orador específica para cada pulso (beat) de la diapositiva
  const getStepInfo = (sIdx, bIdx) => {
    const s = slides[sIdx];
    if (!s) return { badge: '', label: '', title: '', body: '' };
    const beats = getBeats(sIdx);
    const totalB = beats.length;
    let customBeatNotes = [];
    try { customBeatNotes = JSON.parse(s.dataset.beatNotes || '[]'); } catch {}

    const slideTitle = s.dataset.title || '';
    const slideKicker = s.dataset.kicker || '';
    const generalNotes = s.dataset.notes || '';
    const subEl = s.querySelector('.subtitle, .body, blockquote, .label');
    const subText = subEl ? subEl.textContent.trim() : '';

    if (totalB === 0 || bIdx === 0) {
      return {
        badge: totalB > 0 ? ('Apertura · Pulso 0/' + totalB) : 'Diapositiva completa',
        label: '🎙️ GUION DE APERTURA',
        title: slideTitle,
        body: generalNotes || subText || 'Presenta el titular antes de revelar el primer punto.',
      };
    }

    const beatEl = beats[bIdx - 1];
    const customNote = customBeatNotes[bIdx - 1];
    const isCallout = beatEl.classList.contains('callout');
    const strongEl = beatEl.querySelector('strong, h3');
    const rawText = beatEl.textContent.trim();

    let beatTitle = '';
    let beatExplain = rawText;
    if (strongEl) {
      beatTitle = strongEl.textContent.trim().replace(/:$/, '');
      beatExplain = rawText.slice(strongEl.textContent.length).replace(/^[:\s·-]+/, '').trim();
    } else if (isCallout) {
      beatTitle = 'Cierre / Dinámica';
    } else {
      beatTitle = 'Punto ' + bIdx;
    }

    return {
      badge: 'Pulso ' + bIdx + '/' + totalB,
      label: isCallout ? '🎯 CIERRE Y PREGUNTA AL AULA' : ('🎙️ PULSO ' + bIdx + ' DE ' + totalB),
      title: beatTitle,
      body: customNote || ('Amplía este punto con un ejemplo propio más allá de lo que dice la tarjeta: «' + beatExplain + '»'),
    };
  };

  // Actualiza la interfaz de la Consola del Profesor (Pantalla 1) y el panel N
  const updatePresenterUI = () => {
    const cur = getStepInfo(i, b);
    const beats = getBeats(i);
    notes.innerHTML = '<b>[' + cur.badge + '] ' + cur.title + ':</b> ' + cur.body.replace(/\n/g, ' ');

    if (!isPresenter) return;
    document.getElementById('pr-pos-badge').textContent = 'Diapositiva ' + (i + 1) + ' / ' + slides.length;
    document.getElementById('pr-step-badge').textContent = cur.badge;
    document.getElementById('pr-now-label').textContent = cur.label;
    document.getElementById('pr-now-title').textContent = cur.title;
    document.getElementById('pr-now-body').textContent = cur.body;

    // Puntos discretos de pulso (clicables por si quieres saltar a un pulso concreto sin ocupar espacio)
    const dotsEl = document.getElementById('pr-dots');
    if (dotsEl) {
      dotsEl.innerHTML = '';
      const totalSteps = beats.length;
      if (totalSteps > 0) {
        for (let step = 0; step <= totalSteps; step++) {
          const dot = document.createElement('button');
          dot.className = 'pr-dot' + (step === b ? ' active' : (step < b ? ' done' : ''));
          dot.textContent = step === 0 ? 'Intro' : step;
          dot.title = getStepInfo(i, step).title;
          dot.onclick = () => show(i, step);
          dotsEl.appendChild(dot);
        }
      }
    }

    // Qué viene en el siguiente clic (1 sola línea discreta al pie del guion)
    const nextBox = document.getElementById('pr-next-body');
    if (beatMode && b < beats.length) {
      const nxt = getStepInfo(i, b + 1);
      nextBox.innerHTML = '<span>Siguiente clic (Pulso ' + (b + 1) + '/' + beats.length + '):</span> <b>' + nxt.title + '</b>';
    } else if (i < slides.length - 1) {
      const nxtS = slides[i + 1];
      nextBox.innerHTML = '<span>Siguiente clic:</span> <b>Pasa a Diapositiva ' + (i + 2) + ' — ' + (nxtS.dataset.title || '') + '</b>';
    } else {
      nextBox.innerHTML = '<span>🏁 Último pulso de la presentación</span>';
    }

    // Subtítulos y miniatura visual de la siguiente diapositiva
    const currSub = document.getElementById('pr-curr-sub');
    if (currSub) currSub.textContent = (i + 1) + '/' + slides.length + ' · ' + (slides[i].dataset.kicker || '');

    const nextSub = document.getElementById('pr-next-sub');
    const nextStage = document.getElementById('pr-next-stage');
    if (i < slides.length - 1) {
      const ns = slides[i + 1];
      if (nextSub) nextSub.textContent = 'Diapo ' + (i + 2) + ' · ' + (ns.dataset.title || '');
      if (nextStage) nextStage.classList.remove('is-end');
      nextSlides.forEach((el, k) => el.classList.toggle('active', k === i + 1));
    } else {
      if (nextSub) nextSub.textContent = 'Fin de la presentación';
      if (nextStage) nextStage.classList.add('is-end');
      nextSlides.forEach((el) => el.classList.remove('active'));
    }
  };

  // Cronómetro para la clase de 60 min en la Consola del Profesor
  if (isPresenter) {
    let sec = 0, running = true;
    const timerEl = document.getElementById('pr-timer');
    const btnToggle = document.getElementById('pr-timer-toggle');
    const btnReset = document.getElementById('pr-timer-reset');
    setInterval(() => {
      if (!running) return;
      sec++;
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      timerEl.textContent = m + ':' + s;
    }, 1000);
    btnToggle.onclick = () => { running = !running; btnToggle.textContent = running ? '⏸' : '▶'; };
    btnReset.onclick = () => { sec = 0; timerEl.textContent = '00:00'; };
    document.getElementById('pr-prev').onclick = () => prev();
    document.getElementById('pr-next').onclick = () => next();
    document.getElementById('pr-blackout').onclick = () => {
      document.body.classList.toggle('show-blackout');
      sendSync();
    };
  }

  // Animación CountUp para cifras grandes (estilo Beatdeck)
  const animateCount = (el) => {
    const raw = el.dataset.val || el.textContent;
    const m = /^([^0-9]*?)(\d+(?:[.,]\d+)?)([^0-9]*)$/.exec(raw.trim());
    if (!m) return;
    const prefix = m[1], target = parseFloat(m[2].replace(',', '.')), isComma = m[2].includes(','), suffix = m[3];
    const decimals = (m[2].split(/[.,]/)[1] || '').length;
    const dur = 900, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      const val = (target * ease).toFixed(decimals);
      el.textContent = prefix + (isComma ? val.replace('.', ',') : val) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const parseHash = () => {
    const h = location.hash.slice(1);
    if (!h) return { s: 0, b: 0 };
    const [sp, bp] = h.split('.');
    const sIdx = Math.max(0, Math.min(slides.length - 1, (parseInt(sp) || 1) - 1));
    const maxB = getBeats(sIdx).length;
    const bIdx = bp !== undefined ? Math.max(0, Math.min(maxB, parseInt(bp) || 0)) : (beatMode ? 0 : maxB);
    return { s: sIdx, b: bIdx };
  };

  const fit = () => {
    if (isPresenter) {
      const mini = document.getElementById('pr-mini-stage');
      if (mini) {
        const r = mini.getBoundingClientRect();
        const s = Math.min(r.width / 1920, r.height / 1080);
        deck.style.transform = 'scale(' + s + ')';
      }
      const nextStage = document.getElementById('pr-next-stage');
      if (nextStage && nextDeck) {
        const r2 = nextStage.getBoundingClientRect();
        const s2 = Math.min(r2.width / 1920, r2.height / 1080);
        nextDeck.style.transform = 'scale(' + s2 + ')';
      }
      return;
    }
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    deck.style.transform = 'scale(' + s + ')';
  };

  const applyBeats = () => {
    const beats = getBeats(i);
    if (!beatMode || beats.length === 0) {
      beats.forEach((el) => { el.classList.add('vis'); el.classList.remove('current', 'done'); });
      hudPos.textContent = (i + 1) + ' / ' + slides.length;
      return;
    }
    beats.forEach((el, k) => {
      const visible = k < b;
      const isCurrent = k === b - 1;
      el.classList.toggle('vis', visible);
      el.classList.toggle('current', isCurrent);
      el.classList.toggle('done', visible && !isCurrent);
    });
    hudPos.textContent = (i + 1) + ' / ' + slides.length + (beats.length ? ' · paso ' + b + '/' + beats.length : '');
  };

  const show = (n, beat = null) => {
    const prevSlide = i;
    i = Math.max(0, Math.min(slides.length - 1, n));
    const beats = getBeats(i);
    if (beat === null) b = beatMode ? 0 : beats.length;
    else b = Math.max(0, Math.min(beats.length, beat));

    slides.forEach((el, k) => el.classList.toggle('active', k === i));
    ovCards.forEach((el, k) => el.classList.toggle('active', k === i));
    applyBeats();

    if (i !== prevSlide) {
      slides[i].querySelectorAll('.count-up').forEach(animateCount);
    }

    prog.style.width = ((i + 1) / slides.length * 100) + '%';
    updatePresenterUI();
    history.replaceState(null, '', '#' + (i + 1) + (beatMode && beats.length ? '.' + b : ''));
    sendSync();
  };

  const next = () => {
    const beats = getBeats(i);
    if (beatMode && b < beats.length) show(i, b + 1);
    else if (i < slides.length - 1) show(i + 1, 0);
  };

  const prev = () => {
    const beats = getBeats(i);
    if (beatMode && b > 0) show(i, b - 1);
    else if (i > 0) {
      const prevBeats = getBeats(i - 1);
      show(i - 1, beatMode ? prevBeats.length : null);
    }
  };

  const toggleBeatMode = () => {
    beatMode = !beatMode;
    document.body.classList.toggle('beat-mode', beatMode);
    hudBeats.textContent = beatMode ? '⚡ Beats ON' : '📄 Slide entera';
    const beats = getBeats(i);
    if (!beatMode) b = beats.length;
    applyBeats();
    updatePresenterUI();
    sendSync();
  };
  hudBeats.onclick = (e) => { e.stopPropagation(); toggleBeatMode(); };

  addEventListener('resize', fit);
  addEventListener('keydown', (e) => {
    if (document.body.classList.contains('show-blackout') && e.key !== 'b' && e.key !== 'B') {
      document.body.classList.remove('show-blackout');
      sendSync();
      return;
    }
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); show(i + 1, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); show(i - 1, getBeats(Math.max(0, i - 1)).length); }
    else if (e.key === 'Home') show(0, 0);
    else if (e.key === 'End') show(slides.length - 1, getBeats(slides.length - 1).length);
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); openPresenterWindow(); }
    else if (e.key === 'o' || e.key === 'O' || e.key === 'Escape') {
      if (e.key === 'Escape') document.body.classList.remove('show-overview', 'show-blackout');
      else document.body.classList.toggle('show-overview');
      sendSync();
    }
    else if (e.key === 'b' || e.key === 'B' || e.key === '.') {
      document.body.classList.toggle('show-blackout');
      sendSync();
    }
    else if (e.key === 'm' || e.key === 'M') toggleBeatMode();
    else if (e.key === 'l' || e.key === 'L') document.body.classList.toggle('show-laser');
    else if (e.key === 'n' || e.key === 'N') document.body.classList.toggle('show-notes');
    else if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
  });

  addEventListener('mousemove', (e) => {
    if (document.body.classList.contains('show-laser')) {
      laser.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px)';
    }
  });

  addEventListener('click', (e) => {
    if (isPresenter) return;
    if (e.target.closest('.notes-panel, .hud, .overview, .presenter-ui, a')) return;
    if (document.body.classList.contains('show-blackout')) {
      document.body.classList.remove('show-blackout');
      sendSync();
      return;
    }
    if (e.clientX > innerWidth / 4) next(); else prev();
  });

  const init = parseHash();
  fit();
  show(init.s, init.b);
  setTimeout(fit, 100);
  // Para capturas de exportación PDF/PNG (window.__show muestra la diapositiva con todos sus beats revelados)
  window.__show = (idx) => show(idx, getBeats(Math.max(0, Math.min(slides.length - 1, idx))).length);

  if (window.mermaid) {
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose',
      flowchart: { htmlLabels: true, curve: 'basis', padding: 20, wrappingWidth: 210, nodeSpacing: 45, rankSpacing: 60 },
      themeVariables: { fontFamily: v('--font-body'), fontSize: '22px', primaryColor: v('--mermaid-node'),
        primaryTextColor: v('--mermaid-text'), primaryBorderColor: v('--accent'), lineColor: v('--mermaid-line'),
        secondaryColor: v('--bg-2'), tertiaryColor: v('--bg-2'), mainBkg: v('--mermaid-node'), textColor: v('--mermaid-text'),
        nodeBorder: v('--accent'), clusterBkg: v('--card'), edgeLabelBackground: v('--bg') } });
    try { await mermaid.run({ querySelector: '.mermaid' }); } catch (e) { console.error(e); }
  }
  if (isPresenter && deck) {
    const nextStage = document.getElementById('pr-next-stage');
    if (nextStage && !nextDeck) {
      const nextStageInner = document.createElement('div');
      nextStageInner.className = 'stage';
      nextDeck = deck.cloneNode(true);
      nextDeck.querySelectorAll('.beat, .anim').forEach((el) => {
        el.classList.add('vis');
        el.classList.remove('current', 'done');
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      nextStageInner.appendChild(nextDeck);
      nextStage.appendChild(nextStageInner);
      nextSlides = [...nextDeck.querySelectorAll('.slide')];
      fit();
      updatePresenterUI();
    }
  }
  await document.fonts.ready;
  await Promise.all([...document.querySelectorAll('.img')].map((el) => new Promise((ok) => {
    const m = /url\(['"]?(.*?)['"]?\)/.exec(el.style.backgroundImage); if (!m) return ok();
    const im = new Image(); im.onload = im.onerror = ok; im.src = m[1];
  })));
  window.__ready = true;
})();`;

/** Renderiza deck -> outDir/index.html (copia mermaid si hace falta). Devuelve la ruta del HTML. */
export async function renderDeck(deck, outDir) {
  await mkdir(outDir, { recursive: true });
  BASE_CSS = await readFile(path.join(here, 'base.css'), 'utf8');
  const themeFile = path.join(here, 'themes', `${deck.theme}.css`);
  if (!existsSync(themeFile)) throw new Error(`Tema "${deck.theme}" no existe. Disponibles: ${(await listThemes()).join(', ')}`);
  const themeCss = await readFile(themeFile, 'utf8');

  let mermaidSrc = '';
  if (deck.slides.some((s) => s.mermaid)) {
    try {
      await mkdir(path.join(outDir, 'assets'), { recursive: true });
      const src = require.resolve('mermaid/dist/mermaid.min.js');
      await copyFile(src, path.join(outDir, 'assets', 'mermaid.min.js'));
      mermaidSrc = 'assets/mermaid.min.js';
    } catch {
      mermaidSrc = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    }
  }
  const html = renderHTML(deck, { themeCss, mermaidSrc });
  const file = path.join(outDir, 'index.html');
  await writeFile(file, html);
  return file;
}

/**
 * Renderiza un HTML 100% portátil en un único archivo (incrusta las imágenes en base64 y mermaid inline).
 * Funciona con Playwright (si está disponible) o en modo cero-dependencias con Node puro.
 */
export async function renderStandaloneHTML(htmlFile, standaloneFile) {
  const baseDir = path.dirname(htmlFile);
  let html = await readFile(htmlFile, 'utf8');
  const imgFiles = [...new Set([...html.matchAll(/url\(['"]?(images\/[^'")]+)['"]?\)/g)].map((m) => m[1]))];
  const replacements = {};

  let compressedWithPlaywright = false;
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
      const page = await browser.newPage();
      for (const rel of imgFiles) {
        const abs = path.resolve(baseDir, rel);
        if (!existsSync(abs)) continue;
        const buf = await readFile(abs);
        const ext = path.extname(abs).toLowerCase() === '.png' ? 'png' : 'jpeg';
        const rawDataUrl = `data:image/${ext};base64,${buf.toString('base64')}`;
        const jpegDataUrl = await page.evaluate(async (src) => {
          return new Promise((resolve) => {
            const im = new Image();
            im.onload = () => {
              const maxW = 1280;
              const scale = Math.min(1, maxW / (im.naturalWidth || 1024));
              const c = document.createElement('canvas');
              c.width = Math.round((im.naturalWidth || 1024) * scale);
              c.height = Math.round((im.naturalHeight || 1024) * scale);
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#0b0d17';
              ctx.fillRect(0, 0, c.width, c.height);
              ctx.drawImage(im, 0, 0, c.width, c.height);
              resolve(c.toDataURL('image/jpeg', 0.78));
            };
            im.onerror = () => resolve(src);
            im.src = src;
          });
        }, rawDataUrl);
        replacements[rel] = jpegDataUrl;
      }
      compressedWithPlaywright = true;
    } finally {
      await browser.close();
    }
  } catch {
    // Fallback cero-dependencias (sin Playwright): intenta comprimir a JPEG con ffmpeg/python3/convert o incrusta en base64 directo
    const { execFileSync } = await import('node:child_process');
    for (const rel of imgFiles) {
      const abs = path.resolve(baseDir, rel);
      if (!existsSync(abs)) continue;
      let jpegBuf = null;
      try {
        jpegBuf = execFileSync('ffmpeg', ['-v', 'error', '-i', abs, '-vf', "scale='min(1280,iw)':-1", '-q:v', '5', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        try {
          jpegBuf = execFileSync('convert', [abs, '-resize', '1280x1280>', '-quality', '78', 'jpeg:-'], { stdio: ['ignore', 'pipe', 'ignore'] });
        } catch {}
      }
      if (jpegBuf && jpegBuf.length > 100) {
        replacements[rel] = `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
      } else {
        const buf = await readFile(abs);
        const ext = path.extname(abs).toLowerCase() === '.png' ? 'png' : 'jpeg';
        replacements[rel] = `data:image/${ext};base64,${buf.toString('base64')}`;
      }
    }
  }

  for (const [rel, dataUrl] of Object.entries(replacements)) {
    html = html.split(`'${rel}'`).join(`'${dataUrl}'`).split(`"${rel}"`).join(`"${dataUrl}"`);
  }

  // Si usa mermaid externo local, incrustarlo inline también
  if (html.includes('<script src="assets/mermaid.min.js"></script>')) {
    const mPath = path.join(baseDir, 'assets', 'mermaid.min.js');
    if (existsSync(mPath)) {
      const mCode = await readFile(mPath, 'utf8');
      html = html.replace('<script src="assets/mermaid.min.js"></script>', `<script>${mCode}</script>`);
    }
  }

  await writeFile(standaloneFile, html);
  return standaloneFile;
}