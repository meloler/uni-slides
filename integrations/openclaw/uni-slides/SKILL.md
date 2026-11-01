---
name: uni-slides
description: "Diseña y genera presentaciones de clase visuales (estilo Gamma) en Web, PDF y Google Slides (.pptx) en Modo Profesor Guiado (con el número de diapositivas que el tema requiera sin pasar de ~40, tarjetas Concepto + Mini-explicación y notas de orador 100% alineadas pulso a pulso con lo que se ve en pantalla). El propio agente escribe deck.json y usa la CLI para validar y compilar."
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

1. **Número natural de diapositivas según el temario (normalmente 20–34, máximo ~40):**
   - **No rellenes por rellenar ni fuerces 42 diapositivas si el tema no lo pide.** Crea las diapositivas que el temario requiera de forma natural (suele estar entre 20 y 34 diapositivas, sin pasarte de 40).
   - Si el temario trae una tabla importante (p. ej. 4 situaciones, 5 licencias Creative Commons o varios formatos), dale espacio para que se lea con claridad, pero **mantente 100% fiel al temario** sin inventar tareas ni bloques artificiales.
2. **Tarjetas `Concepto + Mini-explicación` en pantalla:**
   - Nunca pongas bullets crípticos de 3 palabras (`"Portal ≠ recurso"`).
   - Cada bullet debe tener entre **12 y 24 palabras** con la estructura:
     `**Concepto o idea clave**: explicación completa y natural conectada con el temario.`
3. **Banda inferior `callout` (solo en `concept`, `example` y `quiz`):**
   - Rellena el campo `callout` en diapositivas `concept`, `example` o `quiz` con la idea clave o conclusión conectada al temario.
   - ⚠️ **No pongas `callout` en `comparison`, `process`, `agenda` ni `summary`** (esos layouts no muestran `callout` en pantalla).
4. **Vídeos de YouTube (`layout: "video"`): reproducción directa al pulsar Espacio, SIN bullets previos ni tareas inventadas:**
   - Incluye **1 o 2 diapositivas `video`** cuando aporten valor real al tema.
   - Pon en `video_query` términos de búsqueda claros en español y en `body` una sola frase breve de contexto.
   - ⚠️ **PROHIBIDO poner `bullets` en diapositivas `video` y PROHIBIDO inventar tareas que no estén en el temario** (nada de *"Mientras miramos: identifica..."* ni *"Después del vídeo: anota..."*). Deja siempre `"bullets": []` en las diapositivas `video` para que al pulsar Espacio se reproduzca directamente el vídeo en pantalla, y al volver a pulsar Espacio regrese a la diapositiva.
5. **Toda pregunta o debate del temario (`quiz`) lleva su respuesta en la diapositiva siguiente:**
   - Cuando el temario incluya preguntas de reflexión o ejercicios, añade justo después una diapositiva con **las respuestas razonadas según el propio temario**, para que el profesor nunca se quede en blanco.
6. **Alineación ESTRICTA 1 a 1 entre la tarjeta en pantalla y el guion del profesor (`notes` + `beat_notes`):**
   - En la Consola del Profesor (`Tecla P`), cada vez que el profesor pulsa Espacio se ilumina un elemento en el proyector (un bullet, un paso o una tarjeta de columna) y a la izquierda aparece su nota `beat_notes[k]`.
   - **REGLA CRÍTICA:** La nota `beat_notes[k]` **DEBE hablar exactamente del mismo concepto que el alumno está viendo iluminado en ese pulso**, explicándolo con otras palabras más sencillas y cercanas, pero sin saltar a otro punto ni contar algo desconectado.
   - **Conteo exacto de `beat_notes` por layout (validado por `lint`):**
     - `concept` y `example`: `bullets.length + (callout ? 1 : 0)` notas.
     - `comparison`: **suma de todos los bullets de la Columna 1 + todos los bullets de la Columna 2** (p. ej. si la Columna 1 tiene 2 bullets y la Columna 2 tiene 2 bullets, `beat_notes` DEBE tener **4 strings** en ese mismo orden: primero los 2 de la izquierda y luego los 2 de la derecha).
     - `process` y `agenda`: `steps.length` notas.
     - `summary`: `bullets.length` notas.
     - `quiz`: `questions.length + (callout ? 1 : 0)` notas.
     - `video`: `0` notas (o `1` si lleva `callout`).

---

## 2. Cómo redactar las Notas de Orador (`notes` y `beat_notes`): ¡Sencillas, Habladas y Sin Confusión!

El mayor fallo al generar notas es redactar resúmenes teóricos o planes docentes en lugar de lo que el profesor tiene que decir.

### 🚫 Anti-patrones que DEBES EVITAR:
1. **❌ Prohibido el meta-lenguaje docente:**
   - ❌ *"Voy a provocar una respuesta rápida...", "Quiero que distingan...", "Reservaré los últimos minutos para...", "Voy a mantenerlo sin matemáticas..."*
   - 👉 ¿Por qué está mal? Porque cuando el profesor lee eso en clase, tiene que hacer un doble esfuerzo mental para pensar cómo decirlo.
2. **❌ Prohibida la jerga académica o jurídica enrevesada:**
   - ❌ *"Es una figura normativa vinculada a las externalidades de la reutilización...", "La inferencia del grupo pequeño impide la agregación efectiva..."*
   - 👉 ¿Por qué está mal? Porque suena frío, aburrido y los alumnos desconectan.
3. **❌ Prohibido dejar `beat_notes: []` vacío:**
   - Si una diapositiva tiene 3 bullets, debe tener 3 o 4 notas en `beat_notes`. Al dar al espacio, el profesor necesita ver qué decir sobre esa tarjeta concreta.

### ✅ Reglas de oro para un guion perfecto:
1. **✔️ Escribe DIRECTAMENTE en primera persona lo que el profesor dice a los alumnos («...»):**
   - Habla a los estudiantes de tú o vosotros, con energía y cercanía.
2. **✔️ Explícalo como a un estudiante inteligente de 20 años en una cafetería:**
   - Frases cortas.
   - Metáforas cotidianas inmediatas (el menú del bar, el aparcamiento lleno, la lista de Spotify, la secretaría de la facultad, una simple resta).
3. **✔️ Estructura de beats sincronizada:**
   - Si la diapositiva tiene 3 bullets y 1 callout, `beat_notes` tendrá **4 frases** en ese orden exacto.

#### 🌟 Ejemplo comparativo real:

| Concepto | ❌ Redacción confusa / académica | ✔️ Guion hablado claro y pedagógico |
| :--- | :--- | :--- |
| **Datasets de alto valor** | *"Alto valor no significa caro. Es una figura normativa del Reglamento UE 2023/138 con seis categorías que optimizan la reutilización socioeconómica."* | **notes**: *«Cuando escucháis "datos de alto valor", ¿qué pensáis? ¿Secretos de Estado? ¿Datos que valen un millón de euros? Para nada.»*<br>**beat_notes**: [ *«Son datos clave que la ley europea obliga a dar gratis y por API porque mueven la economía: mapas, satélites y el tiempo.»*, *«Si queréis montar una app de reparto o de senderismo, necesitáis el callejero oficial de la ciudad y el radar de lluvias de la AEMET al segundo.»*, *«También incluye registros de empresas y tráfico: saber quién es el dueño de una sociedad o dónde está el autobús evita fraudes y agiliza la ciudad.»*, *«💡 Consejo: Si un dato está en esta lista de la UE, ningún ayuntamiento puede cobraros ni un céntimo por descargarlo.»* ] |
| **Seudonimizar vs Anonimizar** | *"La seudonimización preserva el vínculo mediante una llave disociada, mientras que la anonimización exige una valoración razonable de no reidentificación."* | **notes**: *«Mucho ojo con esto, que es la típica trampa en entrevistas de trabajo y en exámenes: pensar que poner un código a un nombre ya es anonimizar.»*<br>**beat_notes**: [ *«Seudonimizar es solo poner un apodo. Si en una lista cambio "Carlos Pérez" por "Alumno-14", pero en un Excel guardo que Alumno-14 es Carlos, eso NO es anónimo. Sigue siendo dato personal protegido.»*, *«Anonimizar de verdad es romper la llave y tirar las cenizas. Significa que ni vosotros, ni el ayuntamiento ni ningún hacker puede volver a saber razonablemente de quién era ese dato.»* ] |
| **Riesgo por deducción (resta)** | *"La agregación de grupos reducidos presenta riesgos de inferencia residual si se conocen los marginales del sumatorio."* | **notes**: *«Mirad cómo se puede desenmascarar a un vecino con una simple resta de primaria, sin ser ningún hacker ruso.»*<br>**beat_notes**: [ *«Imaginad que el ayuntamiento publica: "Taller de adicciones: 10 inscritos en total. Barrio A: 6. Barrio B: 3. Barrio C: [Dato oculto por privacidad]".»*, *«Haced la cuenta: 10 menos 6 menos 3 = 1. Ya sabemos que en el Barrio C solo fue 1 persona. Y si en el pueblo sabemos quién del barrio va a esa hora... su privacidad queda destruida.»* ] |

---

## 3. Estilo Visual e Imágenes (Aurora, Neón, Paper)

### 🎨 Elección de Tema Visual y Estilo de Imágenes (¡Pregunta al usuario o ajústalo a la asignatura!)
`deck.json` tiene dos campos clave en la raíz:
- **`"theme"`**: define la paleta, fondo y tipografía de la presentación.
  - `"aurora"` (por defecto): **Modo oscuro premium** (fondo azul/negro noche `#0a0d1c`, degradados violeta/coral y tipografía moderna `Space Grotesk`). Es el estilo visual más impactante y cinematográfico.
  - `"neon"`: **Modo oscuro ciber/tech** (fondo negro profundo `#04070b`, cian y verde eléctrico con tipografía `Sora`). Ideal para tecnología, código, IA o ciberseguridad.
  - `"paper"`: **Modo claro editorial** (fondo crema `#f6f1e9`, acento terracota/azul marino y serifa elegante `Fraunces`).
  *(Si el usuario pide un color o tema concreto, puedes usar uno de estos o cambiar `--theme` al compilar).*

- **`"image_style"`**: directriz de estilo que se suma a todos los prompts de imagen para que la IA genere imágenes con alta dirección de arte en vez de fotos genéricas:
  - Para estilo artístico/vectorial metafórico (como el que más le gusta al usuario):
    `"image_style": "minimalist abstract 3D editorial illustration, clean vector curves, vibrant warm and violet palette, artistic metaphor, studio lighting, high resolution"`
  - Para estilo fotográfico cinematográfico:
    `"image_style": "cinematic 35mm photography, subtle film grain, dramatic documentary lighting, natural candid composition, highly detailed"`
  - Para infografía / diseño tecnológico:
    `"image_style": "isometric 3D tech visualization, sleek glassmorphism elements, neon accents, dark sleek background"`

### 📸 Calidad y prompts de imágenes (`image_prompt`):
- Los `image_prompt` se escriben siempre en **inglés**.
- **No describas clips de oficina ni iconos genéricos con candados o checkmarks aburridos.** Describe conceptos artísticos, metáforas visuales, personas en acción realista o composiciones editoriales:
  - ❌ Cutre / genérico: *"A cartoon folder with a green tick icon and a lock"*
  - ✔️ Editorial / impactante: *"Abstract layered human profile made of evolving organic ribbons and geometric shapes representing personal growth and digital identity, warm sunset colors on dark background"*
- Si no hay `OPENAI_API_KEY` en el entorno o la API falla, el sistema usará placeholders. Asegúrate de que OpenClaw tenga configurada la clave en `.env`.

### 🤖 Generación de imágenes con la herramienta nativa de OpenClaw (¡Recomendado si el proxy bloquea OpenAI!):
Si el entorno de OpenClaw tiene un proxy de red que bloquea la conexión externa hacia `api.openai.com` (error HTTP 403 en `cli.js check`), **tú mismo (OpenClaw) puedes generar las imágenes directamente con tu herramienta nativa de generación de imágenes / OAuth de Codex**:
1. Escribe `deck.json` con los `image_prompt` en inglés para cada diapositiva visual.
2. Genera cada imagen usando tu propia herramienta nativa de imágenes (vía tu suscripción/OAuth).
3. Guarda los archivos generados en `$UNI_SLIDES_HOME/out/<slug>/images/s01.png`, `s02.png`, etc.
4. Asigna la ruta correspondiente en el campo `"image"` de cada diapositiva en `deck.json` (ej. `"image": "images/s01.png"`).
5. Compila usando el flag `--no-images`:
   ```bash
   node $UNI_SLIDES_HOME/src/cli.js compile $UNI_SLIDES_HOME/out/<slug>/deck.json --no-images --pdf --pptx
   ```
   El compilador tomará tus imágenes generadas, las incrustará automáticamente en base64 dentro del archivo `.html` autocontenido final y exportará el PDF y PPTX sin intentar llamar a la API externa bloqueada.

---

## 4. Estructura de la sesión paso a paso

1. **`cover`** — Portada atractiva.
2. **`question`** — **LA GRAN PREGUNTA** de la sesión (≤14 palabras).
3. **`example`** — El caso/encargo inicial que motiva la sesión (ej. «Lunes por la mañana en la agencia…»).
4. **`agenda`** — Mapa de la sesión con 4 o 5 bloques (`steps`).
5. **Para cada bloque:**
   - `section` — Separador del bloque (`kicker`: `"Bloque N"`, `title`: la subpregunta).
   - Desarrollo desglosado paso a paso combinando `concept`, `comparison`, `process`, `diagram`, `big-number`, `example` y `video`.
   - `quiz` ("Para pensar en clase") + diapositiva siguiente con la **solución explicada para el profesor**.
6. **`summary`** — Respuesta final a la gran pregunta + 4 conclusiones clave.
7. **`process` o `concept` final** — Guía paso a paso de la tarea práctica/ejercicio de los alumnos (si el temario incluye una tarea).

---

## 5. Reglas validadas por `lint`

- **Titulares (`title`):** Afirmación completa con verbo y conclusión, entre **4 y 15 palabras**.
- **Bullets:** Máximo **3 bullets** por diapositiva (4 en `summary`), de **12 a 26 palabras** cada uno, empezando por `**Concepto en negrita**: explicación...`.
- **Palabras por diapositiva:** Máximo **95 palabras** entre `body`, `bullets` y `callout`.
- **Variedad visual:** No repitas el mismo `layout` más de **2 veces seguidas**.
- **Imágenes:** Toda diapositiva `concept`, `example` y `question` lleva `image_prompt` en inglés (sin texto en la imagen) o `mermaid`.
- **Notas de orador (`notes`):** Obligatorias en todas las diapositivas. Guion hablado directo para el profesor («...»), sin meta-lenguaje tipo "Voy a provocar una respuesta...".
- **Pulsos (`beat_notes`):** Obligatorio si la diapositiva tiene pulsos. Debe coincidir 1 a 1 con el número exacto de elementos con pulso en pantalla.

---

## 6. Flujo paso a paso

0. **Comprueba el entorno y la API de OpenAI (solo la primera vez o si dudas):**
   ```bash
   node $UNI_SLIDES_HOME/src/cli.js check
   ```
   Verifica que detecte el archivo `.env` y que la generación de imágenes con OpenAI esté al 100% (o usa tu herramienta nativa de imágenes + `--no-images` si el proxy bloquea `api.openai.com`).
   *(⚠️ **PROHIBIDO** generar gráficos caseros con SVG, Python o FFmpeg con textos superpuestos).*

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
   *(Usa `--no-images` si ya generaste las imágenes tú mismo o si el usuario pide un borrador rápido).*
4. **Envía al usuario los 3 archivos resultantes:**
   - **`standalone` (`<slug>-interactivo.html`, ~2-3 MB):** Un **único archivo `.html` 100% autocontenido** (con todas las imágenes ya incrustadas en base64, efectos de pulsos *Beats*, mosaico `O`, láser `L` y Consola del Profesor en Pantalla 1 con `Tecla P`).
   - **`pdf` (`<slug>.pdf`, ~5-7 MB):** PDF ligero optimizado para subir directamente al Campus Virtual / Moodle de los alumnos.
   - **`pptx` (`<slug>.pptx`):** Presentación editable para Google Slides / PowerPoint.
