// Exportador a PPTX editable (compatible 100% con Google Slides y PowerPoint).
// Mantiene los 3 temas (aurora, neon, paper), los 13 layouts, imágenes y notas del profesor.
// Incluye motor OpenXML (.pptx) nativo en Node puro (0 dependencias) si pptxgenjs no está instalado.
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

async function loadPptxGen() {
  try {
    const mod = await import('./vendor/pptxgen.js');
    return mod.default || mod;
  } catch {
    try {
      const mod = await import('pptxgenjs');
      return mod.default || mod;
    } catch {
      return null;
    }
  }
}

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

function formatSpeakerNotes(s) {
  const parts = [];
  if (s.notes && String(s.notes).trim()) {
    parts.push(String(s.notes).trim());
  }
  if (Array.isArray(s.beat_notes) && s.beat_notes.length > 0) {
    s.beat_notes.forEach((bn, idx) => {
      if (bn && String(bn).trim()) {
        parts.push(`[Pulso ${idx + 1}] ${String(bn).trim()}`);
      }
    });
  }
  return parts.join('\n\n');
}

function getImgDimensions(buf) {
  if (!buf || buf.length < 24) return { w: 1024, h: 1024 };
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16) || 1024, h: buf.readUInt32BE(20) || 1024 };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { h: buf.readUInt16BE(i + 5) || 1024, w: buf.readUInt16BE(i + 7) || 1024 };
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return { w: 1024, h: 1024 };
}

export async function exportPPTX(deck, outDir, pptxFile) {
  const PptxGenJS = await loadPptxGen();
  if (!PptxGenJS) {
    return await exportPureNodePPTX(deck, outDir, pptxFile);
  }
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
    const fullNotes = formatSpeakerNotes(s);
    if (fullNotes) slide.addNotes(fullNotes);

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

// ============================================================================
// Motor OpenXML (.pptx) en Node puro (0 dependencias npm)
// ============================================================================

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), 'utf8');
    const crc = crc32(raw);
    const comp = zlib.deflateRawSync(raw);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, comp);
    centralParts.push(central);
    offset += local.length + comp.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

const xmlEsc = (s) =>
  String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

const inch = (v) => Math.round(v * 914400);

function pptxShapeText({ id, name, x, y, w, h, text, fontSize = 18, bold = false, color = 'F5F6FF', fill = null, border = null }) {
  const fillXml = fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>';
  const lnXml = border ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${border}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
  const paras = String(text ?? '')
    .split('\n')
    .map(
      (line) => `<a:p><a:r><a:rPr lang="es-ES" sz="${Math.round(fontSize * 100)}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${xmlEsc(line)}</a:t></a:r></a:p>`
    )
    .join('');
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="${xmlEsc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${inch(x)}" y="${inch(y)}"/><a:ext cx="${inch(w)}" cy="${inch(h)}"/></a:xfrm>
      <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 4000"/></a:avLst></a:prstGeom>
      ${fillXml}${lnXml}
    </p:spPr>
    <p:txBody><a:bodyPr wrap="square" lIns="140000" tIns="100000" rIns="140000" bIns="100000"/><a:lstStyle/>${paras}</p:txBody>
  </p:sp>`;
}

function pptxPic({ id, rId, x, y, w, h }) {
  return `<p:pic>
    <p:nvPicPr><p:cNvPr id="${id}" name="Image ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
    <p:spPr><a:xfrm><a:off x="${inch(x)}" y="${inch(y)}"/><a:ext cx="${inch(w)}" cy="${inch(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
  </p:pic>`;
}

export async function exportPureNodePPTX(deck, outDir, pptxFile) {
  const t = THEMES[deck.theme] || THEMES.aurora;
  const entries = [];
  const slides = deck.slides || [];
  let sectionNum = 0;

  entries.push({
    name: '[Content_Types].xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n  ')}
  ${slides.map((_, i) => `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join('\n  ')}
</Types>`,
  });

  entries.push({
    name: '_rels/.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  });

  entries.push({
    name: 'ppt/presentation.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>
  <p:notesMasterIdLst><p:notesMasterId r:id="rIdNotesMaster"/></p:notesMasterIdLst>
  <p:sldIdLst>
    ${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdSlide${i + 1}"/>`).join('\n    ')}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`,
  });

  entries.push({
    name: 'ppt/_rels/presentation.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rIdNotesMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/>
  <Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  ${slides.map((_, i) => `<Relationship Id="rIdSlide${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('\n  ')}
</Relationships>`,
  });

  entries.push({
    name: 'ppt/notesMasters/notesMaster1.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:notesMaster>`,
  });

  entries.push({
    name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  });

  entries.push({
    name: 'ppt/slideMasters/slideMaster1.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`,
  });

  entries.push({
    name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  });

  entries.push({
    name: 'ppt/slideLayouts/slideLayout1.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`,
  });

  entries.push({
    name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  });

  entries.push({
    name: 'ppt/theme/theme1.xml',
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="UniSlides">
  <a:themeElements>
    <a:clrScheme name="UniSlides">
      <a:dk1><a:srgbClr val="0A0D1C"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="151A36"/></a:dk2><a:lt2><a:srgbClr val="DFE3FB"/></a:lt2>
      <a:accent1><a:srgbClr val="${t.accent}"/></a:accent1><a:accent2><a:srgbClr val="${t.accent2}"/></a:accent2>
      <a:accent3><a:srgbClr val="${t.accent}"/></a:accent3><a:accent4><a:srgbClr val="${t.accent2}"/></a:accent4>
      <a:accent5><a:srgbClr val="${t.accent}"/></a:accent5><a:accent6><a:srgbClr val="${t.accent2}"/></a:accent6>
      <a:hlink><a:srgbClr val="${t.accent}"/></a:hlink><a:folHlink><a:srgbClr val="${t.accent2}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="UniSlides">
      <a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="UniSlides"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`,
  });

  slides.forEach((s, i) => {
    if (s.layout === 'section') sectionNum++;
    const shapes = [];
    const rels = [
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
    ];
    let nextId = 2;

    const imgAbs = resolveImg(outDir, s.image);
    let hasSideImg = false;
    if (imgAbs) {
      try {
        const ext = path.extname(imgAbs).toLowerCase() === '.png' ? 'png' : 'jpg';
        const mediaName = `image${i + 1}.${ext}`;
        const imgBuf = readFileSync(imgAbs);
        const dims = getImgDimensions(imgBuf);
        entries.push({ name: `ppt/media/${mediaName}`, data: imgBuf });
        rels.push(
          `<Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`
        );
        const boxX = 7.85,
          boxY = 0.95,
          boxW = 4.65,
          boxH = 5.4;
        const scale = Math.min(boxW / dims.w, boxH / dims.h);
        const drawW = dims.w * scale;
        const drawH = dims.h * scale;
        const ix = boxX + (boxW - drawW) / 2;
        const iy = boxY + (boxH - drawH) / 2;
        shapes.push(pptxPic({ id: nextId++, rId: 'rIdImg', x: ix, y: iy, w: drawW, h: drawH }));
        hasSideImg = true;
      } catch {}
    }

    const txtW = hasSideImg ? 6.6 : 11.5;
    const kicker = s.kicker || (s.layout === 'section' ? `Bloque ${sectionNum}` : '');
    if (kicker) {
      shapes.push(
        pptxShapeText({ id: nextId++, name: 'Kicker', x: 0.9, y: 0.65, w: txtW, h: 0.4, text: kicker.toUpperCase(), fontSize: 12, bold: true, color: t.accent })
      );
    }

    shapes.push(
      pptxShapeText({
        id: nextId++,
        name: 'Title',
        x: 0.9,
        y: 1.1,
        w: txtW,
        h: 1.3,
        text: s.title || s.quote || '',
        fontSize: s.layout === 'cover' || s.layout === 'question' ? 38 : 28,
        bold: true,
        color: t.fg,
      })
    );

    let curY = 2.55;
    if (s.subtitle || s.body) {
      shapes.push(
        pptxShapeText({
          id: nextId++,
          name: 'Body',
          x: 0.9,
          y: curY,
          w: txtW,
          h: 0.9,
          text: [s.subtitle, s.body].filter(Boolean).join('\n'),
          fontSize: 15,
          color: t.soft,
        })
      );
      curY += 1.0;
    }

    if (s.layout === 'comparison' && s.columns?.length === 2) {
      s.columns.slice(0, 2).forEach((col, cIdx) => {
        const cx = cIdx === 0 ? 0.9 : 6.8;
        const txt = `${col.heading}\n\n` + (col.bullets || []).map((b) => `• ${b}`).join('\n');
        shapes.push(
          pptxShapeText({ id: nextId++, name: `Col${cIdx}`, x: cx, y: 2.6, w: 5.6, h: 3.9, text: txt, fontSize: 14, color: t.soft, fill: t.card, border: t.border })
        );
      });
    } else if (['process', 'agenda'].includes(s.layout) && s.steps?.length) {
      const n = s.steps.length;
      const cw = (11.5 - 0.25 * (n - 1)) / n;
      s.steps.forEach((st, idx) => {
        const cx = 0.9 + idx * (cw + 0.25);
        shapes.push(
          pptxShapeText({
            id: nextId++,
            name: `Step${idx}`,
            x: cx,
            y: 2.7,
            w: cw,
            h: 3.7,
            text: `0${idx + 1}. ${st.label}\n\n${st.text}`,
            fontSize: 14,
            color: t.soft,
            fill: t.card,
            border: t.border,
          })
        );
      });
    } else if (s.bullets?.length) {
      s.bullets.slice(0, 4).forEach((b, bIdx) => {
        shapes.push(
          pptxShapeText({
            id: nextId++,
            name: `Bullet${bIdx}`,
            x: 0.9,
            y: curY,
            w: txtW,
            h: 0.85,
            text: b,
            fontSize: 13.5,
            color: t.soft,
            fill: t.card,
            border: t.border,
          })
        );
        curY += 0.95;
      });
    } else if (s.questions?.length) {
      s.questions.slice(0, 4).forEach((q, qIdx) => {
        shapes.push(
          pptxShapeText({
            id: nextId++,
            name: `Q${qIdx}`,
            x: 0.9,
            y: curY,
            w: txtW,
            h: 0.85,
            text: `${qIdx + 1}. ${q}`,
            fontSize: 14,
            color: t.fg,
            fill: t.card,
            border: t.border,
          })
        );
        curY += 0.95;
      });
    }

    if (s.callout && ['concept', 'example', 'quiz'].includes(s.layout) && curY <= 6.1) {
      shapes.push(
        pptxShapeText({
          id: nextId++,
          name: 'Callout',
          x: 0.9,
          y: curY,
          w: txtW,
          h: 0.72,
          text: s.callout,
          fontSize: 13,
          bold: true,
          color: t.fg,
          fill: t.bg2,
          border: t.accent,
        })
      );
    }

    shapes.push(
      pptxShapeText({
        id: nextId++,
        name: 'Footer',
        x: 0.9,
        y: 6.9,
        w: 11.5,
        h: 0.35,
        text: `${deck.title || ''}   ·   ${i + 1} / ${slides.length}`,
        fontSize: 10,
        color: t.muted,
      })
    );

    rels.push(
      `<Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${i + 1}.xml"/>`
    );

    entries.push({
      name: `ppt/slides/slide${i + 1}.xml`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${t.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      ${shapes.join('\n      ')}
    </p:spTree>
  </p:cSld>
</p:sld>`,
    });

    entries.push({
      name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join('\n  ')}
</Relationships>`,
    });

    const fullNotes = formatSpeakerNotes(s);
    const notesParas = (fullNotes || '')
      .split('\n')
      .map(
        (line) => `<a:p><a:r><a:rPr lang="es-ES" sz="1200" dirty="0"/><a:t>${xmlEsc(line)}</a:t></a:r></a:p>`
      )
      .join('');

    entries.push({
      name: `ppt/notesSlides/notesSlide${i + 1}.xml`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/>${notesParas}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`,
    });

    entries.push({
      name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${i + 1}.xml"/>
</Relationships>`,
    });
  });

  await writeFile(pptxFile, buildZip(entries));
  return pptxFile;
}
