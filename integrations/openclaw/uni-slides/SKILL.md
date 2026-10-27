---
name: uni-slides
description: "Diseña y genera presentaciones de clase visuales (estilo Gamma) en Web, PDF y Google Slides (.pptx) en Modo Profesor Guiado (35–42 diapositivas para 60 min, tarjetas Concepto + Mini-explicación para no depender de las notas de orador, casos reales, vídeos de YouTube verificados y preguntas con su diapositiva de respuesta). El propio agente escribe deck.json y usa la CLI para validar y compilar."
metadata:
  openclaw:
    emoji: "🎓"
    requires:
      bins: ["node"]
---

# uni-slides — Skill de diseño de presentaciones (Modo Profesor Guiado)

> **IMPORTANTE (Ahorro de API):** **TÚ (el agente de OpenClaw) eres el cerebro pedagógico.**
> **NUNCA** uses `cli.js build` ni `cli.js plan` (llaman a un LLM externo de pago).
> Tú mismo debes analizar el temario, escribir `deck.json`, validarlo con `cli.js lint` y compilarlo con `cli.js compile`.

La herramienta está instalada en `$UNI_SLIDES_HOME` (por defecto `~/uni-slides`).

---

## 1. Filosofía del «Modo Profesor Guiado» (¡Fundamental!)

El profesor a veces imparte temas que no domina al 100%, no siempre puede ver las notas de orador en el proyector del aula y suele avanzar rápido (~1 min por diapositiva). Por tanto:

1. **Volumen para 60 minutos: entre 34 y 42 diapositivas.**
   - **No comprimas el temario.** Si el temario trae una tabla con 4 situaciones, 4 comprobaciones, 5 licencias Creative Commons o 6 formatos de archivo, **no los metas apretados en una sola diapositiva**: dedica una diapositiva de introducción y luego **una diapositiva detallada por cada elemento o pareja de elementos** con su caso real.
2. **Tarjetas `Concepto + Mini-explicación` en pantalla (para no necesitar notas de orador):**
   - Nunca pongas bullets crípticos de 3 palabras (`"Portal ≠ recurso"`).
   - Cada bullet debe tener entre **12 y 24 palabras** con la estructura:
     `**Concepto o idea clave**: explicación completa y natural que el profesor puede leer o parafrasear directamente en clase.`
   - Así el alumno escanea rápidamente lo que va en `**negrita**` (en color de acento) y el profesor tiene toda la explicación delante sin mirar notas.
3. **Banda inferior `callout` en las diapositivas:**
   - Rellena el campo `callout` con la analogía, el matiz clave o la pregunta para lanzar al aula (ej. `"💡 Analogía: Ver la carta de un restaurante en Instagram no te da permiso para editar sus precios y usarla en tu web."`).
4. **Vídeos de YouTube (`layout: "video"`) para dinamizar y dar aire a la clase:**
   - Incluye **entre 2 y 3 diapositivas `video`** repartidas en la presentación (una por bloque principal).
   - Pon en `video_query` términos de búsqueda claros en español (ej. `"que es open data datos abiertos explicacion español"` o `"licencias creative commons explicadas en español"`). El compilador buscará automáticamente un vídeo real en YouTube, descargará su miniatura y pondrá el enlace clicable.
   - En los 3 `bullets` de la diapositiva `video`, explica **qué deben fijarse los alumnos durante el vídeo y qué conclusión comentar al terminar**.
5. **Toda pregunta o debate (`quiz`) lleva su respuesta en la diapositiva siguiente:**
   - Cuando incluyas una diapositiva `quiz` con las preguntas de *"Para pensar"*, añade justo después una diapositiva (`concept` o `comparison`) con **las respuestas razonadas**, para que el profesor nunca se quede en blanco tras escuchar a los alumnos.
6. **Guion de profesor por cada pulso (`notes` + `beat_notes`) para la Consola en Pantalla 1 (`Tecla P`):**
   - El profesor usa una ventana de presentador separada en su Pantalla 1 (`Tecla P`) mientras proyecta en la Pantalla 2.
   - **Prohibido repetir lo que ya pone en la diapositiva.** Las notas de orador deben **ampliar la clase** con un guion hablado natural en primera persona (`«...»`), anécdotas, contexto detrás de las cámaras, matices de examen o preguntas para enganchar a los alumnos:
     - `notes`: Guion de apertura (Pulso 0) para introducir el titular antes de revelar las tarjetas.
     - `beat_notes`: Array de strings con **un guion hablado por cada pulso (*beat*) de la diapositiva** (en el mismo orden en que aparecen: primero los `bullets` / `steps` / `questions` / `columns`, y por último el `callout` si existe).

---

## 2. Estructura de la presentación (34 a 42 diapositivas)

1. **`cover`** — Portada atractiva.
2. **`question`** — **LA GRAN PREGUNTA** de la sesión (≤14 palabras).
3. **`example`** — El caso/encargo inicial que motiva la sesión (ej. «Lunes por la mañana en la agencia…»).
4. **`agenda`** — Mapa de la sesión con 4 o 5 bloques (`steps`).
5. **Para cada bloque (4–5 bloques de 6–8 diapositivas cada uno):**
   - `section` — Separador del bloque (`kicker`: `"Bloque N"`, `title`: la subpregunta).
   - Desarrollo desglosado paso a paso combinando `concept`, `comparison`, `process`, `diagram`, `big-number`, `example` (casos reales de España/empresas conocidas) y `video` (vídeo de YouTube).
   - `quiz` ("Para pensar en clase") + diapositiva siguiente con la **solución explicada para el profesor**.
6. **`summary`** — Respuesta final a la gran pregunta + 4 conclusiones clave.
7. **`process` o `concept` final** — Guía paso a paso de la tarea práctica/ejercicio de los alumnos (si el temario incluye una tarea como TFS1).

---

## 3. Reglas validadas por `lint`

- **Titulares (`title`):** Afirmación completa con verbo y conclusión, entre **4 y 15 palabras**.
- **Bullets:** Máximo **3 bullets** por diapositiva (4 en `summary`), de **12 a 26 palabras** cada uno, empezando por `**Concepto en negrita**: explicación...`.
- **Palabras por diapositiva:** Máximo **95 palabras** entre `body`, `bullets` y `callout`.
- **Variedad visual:** No repitas el mismo `layout` más de **2 veces seguidas**.
- **Imágenes:** Toda diapositiva `concept`, `example` y `question` lleva `image_prompt` en inglés (sin texto en la imagen) o `mermaid`.

---

## 4. Flujo paso a paso

1. **Escribe `$UNI_SLIDES_HOME/out/<slug>/deck.json`** directamente con tu propio razonamiento.
2. **Valida con `lint` (gratis, instantáneo):**
   ```bash
   node $UNI_SLIDES_HOME/src/cli.js lint $UNI_SLIDES_HOME/out/<slug>/deck.json
   ```
   Si hay errores (`✖`), corrige tú mismo `deck.json` y repite hasta que quede limpio.
3. **Compila (resuelve vídeos de YouTube + genera imágenes + exporta HTML interactivo portátil de 1 archivo, PDF ligero y Google Slides `.pptx`):**
   ```bash
   node $UNI_SLIDES_HOME/src/cli.js compile $UNI_SLIDES_HOME/out/<slug>/deck.json --pdf --pptx --json
   ```
   *(Usa `--no-images` si el usuario pide un borrador rápido sin coste de imágenes).*
4. **Envía al usuario los 3 archivos resultantes:**
   - **`standalone` (`<slug>-interactivo.html`, ~2-3 MB):** Un **único archivo `.html` 100% autocontenido** (con todas las imágenes ya incrustadas en base64, efectos de pulsos *Beats*, mosaico `O`, láser `L` y Consola del Profesor en Pantalla 1 con `Tecla P`). El profesor puede descargarlo desde Telegram/WhatsApp en el ordenador del aula y abrirlo con doble clic sin necesitar carpetas ni conexión.
   - **`pdf` (`<slug>.pdf`, ~5-7 MB):** PDF ligero optimizado para subir directamente al Campus Virtual / Moodle de los alumnos.
   - **`pptx` (`<slug>.pptx`):** Presentación editable para Google Slides / PowerPoint.
