// Cliente HTTP robusto con soporte nativo de proxy mediante fallback automático a curl.
// En entornos corporativos o contenedores (como OpenClaw) donde Node fetch no respeta
// HTTP_PROXY/HTTPS_PROXY, resilientFetch recurre a curl sin requerir paquetes npm externos.

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export async function resilientFetch(url, options = {}) {
  // 1. Intentar primero con fetch nativo de Node.js
  try {
    return await fetch(url, options);
  } catch (nativeErr) {
    // 2. Si falla (por ejemplo por proxy HTTP_PROXY/HTTPS_PROXY no interceptado por Node),
    // intentamos con curl del sistema, que sí respeta proxies del entorno automáticamente.
    try {
      const args = ['-sS', '-i', '-X', options.method || 'GET'];
      if (options.headers) {
        for (const [k, v] of Object.entries(options.headers)) {
          args.push('-H', `${k}: ${v}`);
        }
      }
      let tmpFile = null;
      if (options.body) {
        tmpFile = path.join(os.tmpdir(), `req-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
        writeFileSync(tmpFile, options.body);
        args.push('--data-binary', `@${tmpFile}`);
      }
      args.push(url);

      let rawOutput;
      try {
        rawOutput = execFileSync('curl', args, { encoding: 'latin1', timeout: 90000, maxBuffer: 100 * 1024 * 1024 });
      } finally {
        if (tmpFile) {
          try { unlinkSync(tmpFile); } catch {}
        }
      }

      // Separar cabeceras del cuerpo de respuesta (manejando posibles 100 Continue o 200 Connection Established)
      const parts = rawOutput.split(/\r?\n\r?\n/);
      let headerBlockIdx = -1;
      for (let i = 0; i < parts.length - 1; i++) {
        if (parts[i].trim().startsWith('HTTP/')) headerBlockIdx = i;
      }
      if (headerBlockIdx === -1) throw new Error('Respuesta HTTP no válida recibida desde curl.');

      const statusLine = parts[headerBlockIdx].split(/\r?\n/)[0];
      const statusCode = parseInt(statusLine.split(' ')[1], 10);
      const responseBodyLatin = parts.slice(headerBlockIdx + 1).join('\n\n');
      const responseBuf = Buffer.from(responseBodyLatin, 'latin1');

      return {
        ok: statusCode >= 200 && statusCode < 300,
        status: statusCode,
        statusText: statusLine,
        text: async () => responseBuf.toString('utf8'),
        json: async () => JSON.parse(responseBuf.toString('utf8')),
        arrayBuffer: async () => responseBuf.buffer.slice(responseBuf.byteOffset, responseBuf.byteOffset + responseBuf.byteLength),
        fromCurl: true,
      };
    } catch (curlErr) {
      const err = new Error(`Fallo de conexión (fetch: ${nativeErr.message}; curl: ${curlErr.message})`);
      err.nativeError = nativeErr;
      err.cause = nativeErr.cause || nativeErr;
      err.curlError = curlErr;
      throw err;
    }
  }
}
