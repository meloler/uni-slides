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
6. **Guion de profesor OBLIGATORIO por cada pulso (`notes` + `beat_notes`) para la Consola en Pantalla 1 (`Tecla P`):**
   - El profesor usa una ventana de presentador en su Pantalla 1 mientras proyecta en el aula (`Tecla P`).
   - Durante la clase **no tiene tiempo de descifrar notas teóricas complejas ni instrucciones sobre lo que "va a hacer"**. Necesita un **guion hablado directo y sencillo («...»)** que pueda leer o parafrasear al instante:
     - `notes`: Guion hablado de **Apertura (Pulso 0)** para presentar el tema o soltar una pregunta/anécdota antes de pulsar Espacio.
     - `beat_notes`: Array de strings con el **guion hablado exacto para cada pulso que aparece al pulsar Espacio** (tantos elementos como bullets, pasos o columnas tenga la diapositiva + 1 al final si hay `callout`).
   - *(Consulta la Sección 2 para ver ejemplos exactos de cómo escribir este guion).*

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

---

## 4. Estructura de la sesión paso a paso

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

## 5. Reglas validadas por `lint`

- **Titulares (`title`):** Afirmación completa con verbo y conclusión, entre **4 y 15 palabras**.
- **Bullets:** Máximo **3 bullets** por diapositiva (4 en `summary`), de **12 a 26 palabras** cada uno, empezando por `**Concepto en negrita**: explicación...`.
- **Palabras por diapositiva:** Máximo **95 palabras** entre `body`, `bullets` y `callout`.
- **Variedad visual:** No repitas el mismo `layout` más de **2 veces seguidas**.
- **Imágenes:** Toda diapositiva `concept`, `example` y `question` lleva `image_prompt` en inglés (sin texto en la imagen) o `mermaid`.
- **Notas de orador (`notes`):** Obligatorias en todas las diapositivas. Guion hablado directo para el profesor («...»), sin meta-lenguaje tipo "Voy a provocar una respuesta...".
- **Pulsos (`beat_notes`):** Obligatorio si la diapositiva tiene varios puntos. Array de strings con el guion hablado para cada pulso al pulsar la barra espaciadora.

---

## 6. Flujo paso a paso

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
