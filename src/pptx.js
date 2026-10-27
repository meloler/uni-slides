// Exportador a PPTX editable (compatible 100% con Google Slides y PowerPoint).
// Mantiene los 3 temas (aurora, neon, paper), los 13 layouts, imágenes y notas del profesor.
import PptxGenJS from 'pptxgenjs';
import { existsSync } from 'node:fs';
import path from 'node:path';

const THEMES = {
  aurora: {
    bg: '0A0D1C',
    bg2: '151A36',
    card: '171C3A',
    border: '2C3366',
    fg: 'F5F6FF',
    soft: 'DFE3FB',
    muted: '9AA3CC',
    accent: 'FF7A6B',
    accent2: '8B6BFF',
    fontHead: 'Space Grotesk',
    fontBody: 'Inter',
  },
  neon: {
    bg: '04070B',
    bg2: '0B1520',
    card: '0B1A24',
    border: '124E45',
    fg: 'EAFFF7',
    soft: 'CFEEE4',
    muted: '7FA69B',
    accent: '00E5A8',
    accent2: '00A3FF',
    fontHead: 'Sora',
    fontBody: 'Inter',
  },
  paper: {
    bg: 'F6F1E9',
    bg2: 'EBE3D5',
    card: 'FFFDF9',
    border: 'DFD6C7',
    fg: '1C1A17',
    soft: '2F2B26',
    muted: '6E665B',
    accent: 'D9480F',
    accent2: '1864AB',
    fontHead: 'Georgia',
    fontBody: 'Inter',
  },
};

const stripMd = (s) => String(s ?? '').replace(/\*\*(.+?)\*\*/g, '$1');

/** Convierte texto con **negrita** en runs de PptxGenJS con color de acento. */
function richRuns(text, t, baseOpts = {}) {
  const parts = String(text ?? '').split(/(\*\*.*?\*\*)/g).filter(Boolean);
  if (!parts.length) return [{ text: '', options: baseOpts }];
  return parts.map((p) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return { text: p.slice(2, -2), options: { ...baseOpts, bold: true, color: t.accent } };
    }
    return { text: p, options: baseOpts };
  });
}

function addKicker(slide, text, t, x = 0.9, y = 0.85) {
  if (!text) return;
  slide.addShape('rect', { x, y: y + 0.11, w: 0.35, h: 0.04, fill: { color: t.accent }, line: { color: t.accent, width: 0 } });
  slide.addText(String(text).toUpperCase(), {
    x: x + 0.45,
    y,
    w: 8,
    h: 0.3,
    fontFace: t.fontBody,
    fontSize: 11,
    bold: true,
    charSpacing: 3,
    color: t.accent,
    margin: 0,
  });
}

function addFooter(slide, deckTitle, idx, total, t) {
  slide.addText(String(deckTitle || '').replace(/\*\*/g, ''), {
    x: 0.9,
    y: 7.0,
    w: 8,
    h: 0.3,
    fontFace: t.fontBody,
    fontSize: 10,
    color: t.muted,
    margin: 0,
  });
  slide.addText(`${idx} / ${total}`, {
    x: 10.4,
    y: 7.0,
    w: 2.0,
    h: 0.3,
    fontFace: t.fontBody,
    fontSize: 10,
    color: t.muted,
    align: 'right',
    margin: 0,
  });
}

function addCard(slide, t, { x, y, w, h }) {
  slide.addShape('roundRect', {
    x,
    y,
    w,
    h,
    rectRadius: 0.15,
    fill: { color: t.card },
    line: { color: t.border, width: 1 },
  });
}

function resolveImg(outDir, rel) {
  if (!rel) return null;
  const p = path.resolve(outDir, rel);
  return existsSync(p) ? p : null;
}

export async function exportPPTX(deck, outDir, pptxFile) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 pulgadas (16:9)
  pptx.title = deck.title;
  if (deck.author) pptx.author = deck.author;

  const t = THEMES[deck.theme] || THEMES.aurora;
  let sectionNum = 0;
  const total = deck.slides.length;

  deck.slides.forEach((s, i) => {
    if (s.layout === 'section') sectionNum++;
    const slide = pptx.addSlide();
    slide.background = { color: t.bg };
    if (s.notes) slide.addNotes(s.notes);

    const imgPath = resolveImg(outDir, s.image);

    switch (s.layout) {
      case 'cover': {
        if (imgPath) {
          slide.addImage({ path: imgPath, x: 0, y: 0, w: 13.333, h: 7.5 });
          slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: t.bg, transparency: 25 } });
        }
        addKicker(slide, s.kicker || 'Presentación', t, 0.9, 1.5);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 52, bold: true, color: t.fg }), {
          x: 0.9,
          y: 2.0,
          w: 10.5,
          h: 2.4,
          valign: 'top',
          margin: 0,
        });
        if (s.subtitle) {
          slide.addText(stripMd(s.subtitle), {
            x: 0.9,
            y: 4.5,
            w: 9.5,
            h: 0.9,
            fontFace: t.fontBody,
            fontSize: 20,
            color: t.muted,
            margin: 0,
          });
        }
        if (deck.author) {
          slide.addText(deck.author.toUpperCase(), {
            x: 0.9,
            y: 6.2,
            w: 8,
            h: 0.4,
            fontFace: t.fontBody,
            fontSize: 12,
            charSpacing: 2,
            color: t.muted,
            margin: 0,
          });
        }
        break;
      }

      case 'question': {
        if (imgPath) {
          slide.addImage({ path: imgPath, x: 0, y: 0, w: 13.333, h: 7.5 });
          slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: t.bg, transparency: 22 } });
        }
        slide.addText('?', {
          x: 9.5,
          y: 1.0,
          w: 3.5,
          h: 6.0,
          fontFace: t.fontHead,
          fontSize: 240,
          bold: true,
          color: t.accent2,
          transparency: 82,
          align: 'right',
        });
        addKicker(slide, s.kicker || 'La gran pregunta', t, 0.9, 1.6);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 46, bold: true, color: t.fg }), {
          x: 0.9,
          y: 2.2,
          w: 10.5,
          h: 3.5,
          valign: 'top',
          margin: 0,
        });
        break;
      }

      case 'agenda':
      case 'process': {
        addKicker(slide, s.kicker || (s.layout === 'agenda' ? 'Hoja de ruta' : 'Proceso'), t);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 34, bold: true, color: t.fg }), {
          x: 0.9,
          y: 1.25,
          w: 11.5,
          h: 1.1,
          margin: 0,
        });
        const steps = s.steps || [];
        const n = Math.max(1, Math.min(5, steps.length));
        const gap = 0.25;
        const totalW = 11.533;
        const cardW = (totalW - gap * (n - 1)) / n;
        steps.slice(0, 5).forEach((st, idx) => {
          const x = 0.9 + idx * (cardW + gap);
          const y = 2.8;
          addCard(slide, t, { x, y, w: cardW, h: 3.6 });
          slide.addText(String(idx + 1).padStart(2, '0'), {
            x: x + 0.25,
            y: y + 0.25,
            w: cardW - 0.5,
            h: 0.65,
            fontFace: t.fontHead,
            fontSize: 28,
            bold: true,
            color: t.accent,
            margin: 0,
          });
          slide.addText(stripMd(st.label), {
            x: x + 0.25,
            y: y + 1.05,
            w: cardW - 0.5,
            h: 0.85,
            fontFace: t.fontHead,
            fontSize: 18,
            bold: true,
            color: t.fg,
            valign: 'top',
            margin: 0,
          });
          slide.addText(stripMd(st.text), {
            x: x + 0.25,
            y: y + 1.95,
            w: cardW - 0.5,
            h: 1.4,
            fontFace: t.fontBody,
            fontSize: 13,
            color: t.muted,
            valign: 'top',
            margin: 0,
          });
        });
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }

      case 'section': {
        const num = String(sectionNum).padStart(2, '0');
        slide.addText(num, {
          x: 0.8,
          y: 1.6,
          w: 3.4,
          h: 3.8,
          fontFace: t.fontHead,
          fontSize: 140,
          bold: true,
          color: t.accent2,
          margin: 0,
        });
        addKicker(slide, s.kicker || `Bloque ${sectionNum}`, t, 4.3, 2.1);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 42, bold: true, color: t.fg }), {
          x: 4.3,
          y: 2.6,
          w: imgPath ? 4.8 : 8.1,
          h: 2.2,
          valign: 'top',
          margin: 0,
        });
        if (s.subtitle) {
          slide.addText(stripMd(s.subtitle), {
            x: 4.3,
            y: 4.8,
            w: imgPath ? 4.8 : 8.1,
            h: 1.0,
            fontFace: t.fontBody,
            fontSize: 18,
            color: t.muted,
            margin: 0,
          });
        }
        if (imgPath) slide.addImage({ path: imgPath, x: 9.4, y: 0, w: 3.933, h: 7.5 });
        break;
      }

      case 'big-number': {
        addKicker(slide, s.kicker || 'Dato clave', t, 0.9, 1.1);
        slide.addText(String(s.big_number || ''), {
          x: 0.9,
          y: 1.5,
          w: 11.5,
          h: 2.4,
          fontFace: t.fontHead,
          fontSize: 120,
          bold: true,
          color: t.accent2,
          margin: 0,
        });
        slide.addText(stripMd(s.big_number_label || s.title), {
          x: 0.9,
          y: 4.0,
          w: 10.5,
          h: 1.2,
          fontFace: t.fontHead,
          fontSize: 26,
          bold: true,
          color: t.fg,
          margin: 0,
        });
        const extra = s.big_number_label && s.title ? `${stripMd(s.title)}. ${stripMd(s.body || '')}` : stripMd(s.body || '');
        if (extra.trim()) {
          slide.addText(extra, {
            x: 0.9,
            y: 5.3,
            w: 10.0,
            h: 1.1,
            fontFace: t.fontBody,
            fontSize: 16,
            color: t.muted,
            margin: 0,
          });
        }
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }

      case 'comparison': {
        addKicker(slide, s.kicker, t);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 34, bold: true, color: t.fg }), {
          x: 0.9,
          y: 1.25,
          w: 11.5,
          h: 1.1,
          margin: 0,
        });
        (s.columns || []).slice(0, 2).forEach((col, idx) => {
          const x = idx === 0 ? 0.9 : 6.85;
          addCard(slide, t, { x, y: 2.6, w: 5.58, h: 4.0 });
          slide.addText(stripMd(col.heading), {
            x: x + 0.4,
            y: 2.9,
            w: 4.8,
            h: 0.6,
            fontFace: t.fontHead,
            fontSize: 22,
            bold: true,
            color: idx === 0 ? t.accent2 : t.accent,
            margin: 0,
          });
          const bulletRuns = (col.bullets || []).map((b) => ({
            text: stripMd(b),
            options: { bullet: true, fontFace: t.fontBody, fontSize: 16, color: t.soft, paraSpaceAfter: 10 },
          }));
          if (bulletRuns.length) {
            slide.addText(bulletRuns, { x: x + 0.4, y: 3.65, w: 4.8, h: 2.7, valign: 'top', margin: 0 });
          }
        });
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }

      case 'quote': {
        slide.addText('“', {
          x: 0.8,
          y: 1.0,
          w: 2,
          h: 2,
          fontFace: 'Georgia',
          fontSize: 120,
          bold: true,
          color: t.accent,
          margin: 0,
        });
        slide.addText(richRuns(s.quote || s.title, t, { fontFace: t.fontHead, fontSize: 34, bold: true, color: t.fg }), {
          x: 0.9,
          y: 2.4,
          w: 11.2,
          h: 2.6,
          valign: 'top',
          margin: 0,
        });
        if (s.quote_author) {
          slide.addText(`— ${s.quote_author.toUpperCase()}`, {
            x: 0.9,
            y: 5.3,
            w: 10,
            h: 0.5,
            fontFace: t.fontBody,
            fontSize: 14,
            charSpacing: 2,
            color: t.muted,
            margin: 0,
          });
        }
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }

      case 'summary': {
        addKicker(slide, s.kicker || 'La respuesta', t);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 34, bold: true, color: t.fg }), {
          x: 0.9,
          y: 1.25,
          w: 11.5,
          h: 1.2,
          margin: 0,
        });
        (s.bullets || []).slice(0, 4).forEach((b, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = 0.9 + col * 5.9;
          const y = 2.75 + row * 1.9;
          addCard(slide, t, { x, y, w: 5.65, h: 1.65 });
          slide.addText('✓', {
            x: x + 0.25,
            y: y + 0.3,
            w: 0.5,
            h: 0.5,
            fontFace: t.fontHead,
            fontSize: 20,
            bold: true,
            color: t.accent,
            align: 'center',
          });
          slide.addText(richRuns(b, t, { fontFace: t.fontBody, fontSize: 16, color: t.soft }), {
            x: x + 0.9,
            y: y + 0.3,
            w: 4.5,
            h: 1.1,
            valign: 'middle',
            margin: 0,
          });
        });
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }

      case 'quiz': {
        addKicker(slide, s.kicker || 'Repaso', t);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 34, bold: true, color: t.fg }), {
          x: 0.9,
          y: 1.25,
          w: 11.5,
          h: 1.0,
          margin: 0,
        });
        (s.questions || []).slice(0, 4).forEach((q, idx) => {
          const y = 2.45 + idx * 1.08;
          addCard(slide, t, { x: 0.9, y, w: 11.5, h: 0.92 });
          slide.addText(String(idx + 1), {
            x: 1.15,
            y: y + 0.15,
            w: 0.6,
            h: 0.6,
            fontFace: t.fontHead,
            fontSize: 22,
            bold: true,
            color: t.accent,
          });
          slide.addText(stripMd(q), {
            x: 1.85,
            y: y + 0.15,
            w: 10.3,
            h: 0.6,
            fontFace: t.fontBody,
            fontSize: 16,
            color: t.soft,
            valign: 'middle',
          });
        });
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }

      case 'diagram': {
        addKicker(slide, s.kicker || 'Esquema', t);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 34, bold: true, color: t.fg }), {
          x: 0.9,
          y: 1.25,
          w: 11.5,
          h: 1.1,
          margin: 0,
        });
        // Extrae las cajas del flowchart Mermaid para dibujarlas como tarjetas editables en Google Slides
        const nodes = [...(s.mermaid || '').matchAll(/\["?([^"\]]+)"?\]/g)].map((m) => m[1].replace(/<br\s*\/?>/gi, '\n'));
        if (nodes.length >= 2) {
          const n = Math.min(5, nodes.length);
          const gap = 0.25;
          const cardW = (11.533 - gap * (n - 1)) / n;
          nodes.slice(0, 5).forEach((txt, idx) => {
            const x = 0.9 + idx * (cardW + gap);
            addCard(slide, t, { x, y: 2.8, w: cardW, h: 2.4 });
            slide.addText(txt, {
              x: x + 0.2,
              y: 3.0,
              w: cardW - 0.4,
              h: 2.0,
              fontFace: t.fontBody,
              fontSize: 15,
              color: t.fg,
              align: 'center',
              valign: 'middle',
            });
          });
        }
        if (s.body) {
          slide.addText(richRuns(s.body, t, { fontFace: t.fontBody, fontSize: 16, color: t.muted }), {
            x: 0.9,
            y: 5.6,
            w: 11.5,
            h: 0.9,
            margin: 0,
          });
        }
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }

      case 'video':
      case 'concept':
      case 'example':
      default: {
        const leftImg = s.image_side === 'left' && s.layout !== 'video';
        const txtX = leftImg ? 6.2 : 0.9;
        const imgX = leftImg ? 0.9 : 7.6;
        const defaultKicker = s.layout === 'video' ? '▶ Vídeo para ver en clase' : s.layout === 'example' ? 'Caso real' : null;
        addKicker(slide, s.kicker || defaultKicker, t, txtX, 0.85);
        slide.addText(richRuns(s.title, t, { fontFace: t.fontHead, fontSize: 30, bold: true, color: t.fg }), {
          x: txtX,
          y: 1.25,
          w: 6.2,
          h: 1.35,
          valign: 'top',
          margin: 0,
        });
        let nextY = 2.7;
        if (s.body) {
          slide.addText(richRuns(s.body, t, { fontFace: t.fontBody, fontSize: 15, color: t.soft }), {
            x: txtX,
            y: nextY,
            w: 6.2,
            h: 0.9,
            valign: 'top',
            margin: 0,
          });
          nextY += 0.95;
        }
        if (s.bullets?.length) {
          s.bullets.slice(0, 3).forEach((b, idx) => {
            const by = nextY + idx * 0.98;
            addCard(slide, t, { x: txtX, y: by, w: 6.2, h: 0.88 });
            slide.addText(richRuns(b, t, { fontFace: t.fontBody, fontSize: 13.5, color: t.soft }), {
              x: txtX + 0.22,
              y: by + 0.1,
              w: 5.76,
              h: 0.68,
              valign: 'middle',
              margin: 0,
            });
          });
          nextY += s.bullets.slice(0, 3).length * 0.98 + 0.08;
        }
        if (s.callout && nextY <= 6.0) {
          addCard(slide, t, { x: txtX, y: nextY, w: 6.2, h: 0.78 });
          slide.addShape('rect', { x: txtX, y: nextY, w: 0.08, h: 0.78, fill: { color: t.accent }, line: { color: t.accent, width: 0 } });
          slide.addText(richRuns(s.callout, t, { fontFace: t.fontBody, fontSize: 13, color: t.fg }), {
            x: txtX + 0.22,
            y: nextY + 0.08,
            w: 5.8,
            h: 0.62,
            valign: 'middle',
            margin: 0,
          });
        }
        if (s.layout === 'video') {
          const url = s.video_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(s.video_query || s.title)}`;
          addCard(slide, t, { x: imgX, y: 0.9, w: 4.8, h: 5.7 });
          if (imgPath) {
            slide.addImage({ path: imgPath, x: imgX + 0.15, y: 1.05, w: 4.5, h: 3.1, hyperlink: { url } });
          }
          slide.addText('YOUTUBE · CLIC PARA REPRODUCIR', {
            x: imgX + 0.25,
            y: 4.35,
            w: 4.3,
            h: 0.3,
            fontFace: t.fontBody,
            fontSize: 10,
            bold: true,
            color: t.accent,
            margin: 0,
          });
          slide.addText(s.video_title || s.video_query || s.title, {
            x: imgX + 0.25,
            y: 4.68,
            w: 4.3,
            h: 1.1,
            fontFace: t.fontHead,
            fontSize: 16,
            bold: true,
            color: t.fg,
            valign: 'top',
            hyperlink: { url },
            margin: 0,
          });
          slide.addText(`${s.video_channel || 'YouTube'} · ${s.video_duration || ''} · ${url}`, {
            x: imgX + 0.25,
            y: 5.85,
            w: 4.3,
            h: 0.55,
            fontFace: t.fontBody,
            fontSize: 10.5,
            color: t.muted,
            hyperlink: { url },
            margin: 0,
          });
        } else if (imgPath) {
          slide.addImage({ path: imgPath, x: imgX, y: 0.9, w: 4.8, h: 5.6, rounding: true });
        } else {
          addCard(slide, t, { x: imgX, y: 0.9, w: 4.8, h: 5.6 });
        }
        addFooter(slide, deck.title, i + 1, total, t);
        break;
      }
    }
  });

  await pptx.writeFile({ fileName: pptxFile });
  return pptxFile;
}
