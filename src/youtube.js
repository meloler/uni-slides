// Buscador y verificador de vídeos reales de YouTube (sin necesidad de API key).
// Convierte video_query en un vídeo real existente de YouTube y descarga su miniatura para PDF/PPTX.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function searchYouTube(query) {
  const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    },
  });
  const html = await res.text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
  if (!m) return null;
  const data = JSON.parse(m[1]);
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  for (const sec of sections) {
    const items = sec?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const v = item.videoRenderer;
      if (v?.videoId && v?.title?.runs?.[0]?.text) {
        return {
          id: v.videoId,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          title: v.title.runs[0].text,
          duration: v.lengthText?.simpleText || 'Vídeo',
          channel: v.ownerText?.runs?.[0]?.text || 'YouTube',
          thumb: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        };
      }
    }
  }
  return null;
}

export function extractYouTubeId(url) {
  const m = String(url || '').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Resuelve todos los slides con layout === 'video' en el deck y descarga sus miniaturas. */
export async function resolveVideos(deck, outDir, { log = console.log } = {}) {
  const imgDir = path.join(outDir, 'images');
  await mkdir(imgDir, { recursive: true });

  for (let i = 0; i < deck.slides.length; i++) {
    const s = deck.slides[i];
    if (s.layout !== 'video') continue;
    try {
      const q = s.video_query || s.title;
      let info = null;
      const existingId = extractYouTubeId(s.video_url);
      if (existingId) {
        let title = s.video_title;
        let channel = s.video_channel;
        if (!title) {
          try {
            const oe = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${existingId}&format=json`);
            if (oe.ok) {
              const j = await oe.json();
              title = j.title;
              channel = j.author_name;
            }
          } catch {}
        }
        info = {
          id: existingId,
          url: `https://www.youtube.com/watch?v=${existingId}`,
          title: title || q,
          duration: s.video_duration || 'Vídeo',
          channel: channel || 'YouTube',
          thumb: `https://i.ytimg.com/vi/${existingId}/hqdefault.jpg`,
        };
      } else {
        info = await searchYouTube(q);
      }
      if (!info) continue;
      s.video_url = info.url;
      s.video_title = info.title;
      s.video_channel = info.channel;
      s.video_duration = info.duration;

      const relThumb = `images/yt-${info.id}.jpg`;
      const absThumb = path.join(outDir, relThumb);
      if (!existsSync(absThumb)) {
        const r = await fetch(info.thumb);
        if (r.ok) await writeFile(absThumb, Buffer.from(await r.arrayBuffer()));
      }
      if (existsSync(absThumb)) s.image = relThumb;
      log(`  ▶  Vídeo diapo ${i + 1}: "${info.title}" (${info.duration}) — ${info.url}`);
    } catch (e) {
      log(`  ⚠ No se pudo resolver vídeo en diapo ${i + 1}: ${e.message}`);
    }
  }
  return deck;
}
