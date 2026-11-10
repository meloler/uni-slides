---
name: uni-slides
description: "Diseña y genera presentaciones de clase visuales (estilo Gamma) en Web, PDF y Google Slides (.pptx) en Modo Profesor Guiado (con el número de diapositivas 100% libre y natural según lo que pida el temario —sean 10, 18, 25, 29, 34 o 40—, tarjetas Concepto + Mini-explicación y notas de orador habladas 100% alineadas pulso a pulso con lo que se ve en pantalla). El propio agente escribe deck.json y usa la CLI para validar y compilar."
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

## 0. Fase 0: Briefing interactivo previo (¡OBLIGATORIO antes de generar!)

Cuando el usuario te pida crear una presentación (p. ej. *"hazme una presentación de este PDF"* o *"prepara la clase de..."*) y **no te haya especificado aún los detalles de diseño**, **NO empieces a generar el `deck.json` a ciegas**.

Primero analiza muy brevemente de qué trata el documento/tema (1 línea) y hazle **en un único mensaje claro y directo** este cuestionario de 6 puntos con opciones rápidas (para que pueda responder en segundos tipo *"1B, 2A, 3A, 4A, 5A, 6A"* o *"todo por defecto salvo..."*):

> 📋 **Plantilla de preguntas que debes hacer al usuario antes de empezar:**
>
> Antes de diseñar y compilar la presentación sobre **[Título/Tema detectado]**, dime cómo prefieres configurarla (puedes responder con las letras, ej. `1B, 2A...`, o decirme *"por defecto"*):
>
> 1. **📏 Extensión de la presentación (sin número obligado, 100% según el temario):**
>    - **A)** Píldora / Corta (~10–18 diapositivas, solo ideas maestras).
>    - **B) ⭐ Estándar de clase (~20–30 diapositivas, ritmo cómodo de 50-60 min).**
>    - **C)** Extensa / Detallada (~32–42 diapositivas, desglosando cada tabla y caso al máximo).
>    - **D)** Las que tú veas convenientes según el temario (sin forzar ninguna cifra prefijada).
>
> 2. **🎓 Nivel de profundidad y tono en las tarjetas:**
>    - **A) ⭐ Universitario divulgativo (riguroso pero muy claro, con metáforas cotidianas y casos reales cercanos).**
>    - **B)** Introductorio / Sencillo (lenguaje llano, cero tecnicismos complejos, ideal para primer contacto).
>    - **C)** Técnico / Avanzado (precisión normativa/técnica alta, definiciones más densas).
>
> 3. **🎙️ Estilo y longitud de las Notas de Orador (`notes` y `beat_notes`):**
>    - **A) ⭐ Guion conversacional desarrollado (2–3 frases naturales por pulso, con ejemplos hablados «...» listos para decir en clase y explicar lo que ven en pantalla con otras palabras).**
>    - **B)** Guion corto / Telegráfico (1 frase directa por pulso, solo la idea clave y el gancho para no leer tanto).
>    - **C)** Guion magistral amplio (explicación profunda en cada pulso + preguntas retóricas para lanzar a los alumnos).
>
> 4. **🎨 Tema visual y efecto de transición:**
>    - **A) ⭐ `aurora` (Oscuro premium azul noche, violeta y coral) + transición `cinematic`.**
>    - **B)** `neon` (Oscuro ciber/tech negro, verde eléctrico y cian) + transición `cube` (3D) o `glide`.
>    - **C)** `paper` (Editorial claro crema, terracota y azul marino, ideal para proyectores con mucha luz) + transición `glide`.
>
> 5. **🖼️ Estilo de las imágenes y recursos visuales:**
>    - **A) ⭐ Ilustración 3D editorial metafórica (estilo abstracto limpio, sin iconos literales ni texto) + esquemas Mermaid.**
>    - **B)** Fotografía cinematográfica 35mm (realista, luz dramática documental).
>    - **C)** Infografía isométrica 3D / Tech (paneles de cristal, diagramas técnicos 3D).
>    - **D)** Ligero / Rápido (solo 4–6 imágenes en diapositivas clave + láminas vectoriales 3D instantáneas en el resto).
>
> 6. **🎬 Vídeos y dinámicas:**
>    - **A) ⭐ Incluir 1–2 vídeos de YouTube reales de contexto (reproducción directa sin tareas inventadas) + pausas de reflexión del temario con su solución en la diapo siguiente.**
>    - **B)** Sin vídeos de YouTube (100 % diapositivas y esquemas).

*(Nota: Si el usuario ya indicó todas sus preferencias en el primer mensaje o dice "hazlo directamente con lo habitual", aplica las opciones marcadas con ⭐ y pasa directamente al diseño).*

---

## 1. Filosofía del «Modo Profesor Guiado» (¡Fundamental!)

El profesor a veces imparte temas que no domina al 100%, no siempre puede ver las notas de orador en el proyector del aula y suele avanzar rápido (~1 min por diapositiva). Por tanto:

1. **CERO OBLIGACIÓN DE 40 DIAPOSITIVAS — Número 100% natural según el temario:**
   - **PROHIBIDO forzar o inflar diapositivas para alcanzar una cifra prefijada.** Una clase excelente puede tener 10, 14, 22, 29, 34 o 40 diapositivas.
   - Si el temario se cubre con rigor, solidez y buen ritmo en 18 o 29 diapositivas, **ese es el número perfecto**. Rellenar con diapositivas vacías solo para "llegar a 40" arruina la clase y aburre a los alumnos.
   - Configura en la raíz de `deck.json`: `"preferences": { "min_slides": 5, "max_slides": 50 }` (o la cifra que requiera el tema).
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

## 2. La Fórmula Maestra de las Notas de Orador (`notes` y `beat_notes`): El Estándar Antigravity

El mayor fallo al generar notas es redactar resúmenes teóricos, texto telegráfico o planes docentes en lugar de lo que el profesor tiene que **decir en voz alta en clase**.
Aquí tienes la arquitectura exacta que hace que la clase suene vibrante, natural y profesional:

### 🎙️ La arquitectura en dos niveles:

1. **`notes` — El gancho oral de entrada (antes del primer clic):**
   - Es lo primero que dice el profesor nada más pasar a la diapositiva, antes de pulsar la barra espaciadora.
   - **Objetivo:** Conectar con lo anterior, hacer una pregunta retórica o avisar de la importancia del punto.
   - **Fórmula:** Siempre entre comillas latinas `«...»`. 1 a 2 frases enérgicas.
   - *Ejemplo:* `«Fijaos bien en esta pantalla, porque aquí es donde caen el 90 % de los profesionales cuando empiezan en una agencia...»` o `«¿Por qué casi todo el mundo confunde estos dos términos? Vamos a verlo con un caso real.»`

2. **`beat_notes` — El guion hablado sincronizado paso a paso (con la barra espaciadora):**
   - Un array de strings donde cada elemento `[0, 1, 2...]` se corresponde exactamente 1 a 1 con la tarjeta/bullet que se ilumina en pantalla.
   - **PROHIBIDO LEER LA PANTALLA:** Los alumnos ya saben leer el texto breve en el proyector. La nota oral debe **expandir, explicar y traducir**.
   - **La fórmula de 3 partes para cada pulso:**
     1. **Llamada de atención:** `«Mirad el primer punto...»`, `«¿Qué significa esto en la práctica?»` o `«Ojo a la diferencia...»`.
     2. **Traducción coloquial con metáfora cotidiana:** Explica la norma o la técnica con algo que un alumno de 20 años viva todos los días (el menú del bar, el grupo de WhatsApp, el caso de Ibai Llanos, Duolingo, pedir un café, el algoritmo de TikTok, una simple resta).
     3. **Consejo profesional o advertencia de examen:** `«Esto os lo van a preguntar en la entrevista»`, `«Si un cliente os pide esto, respondedle inmediatamente que no...»`.
   - **Estilo lingüístico:**
     - Siempre en primera persona y dirigiéndose al aula: *«fijaos»*, *«imaginad»*, *«mucho cuidado con esto»*, *«¿veis lo que pasa?»*.
     - Frases con cadencia oral natural, pausas e ironía pedagógica.
     - **CERO metalenguaje:** PROHIBIDO escribir *"En esta diapositiva el profesor explicará...", "Quiero que los alumnos entiendan...", "Con este punto busco..."*. Escribe directamente las palabras exactas que van a salir de la boca del profesor.

### 📋 Guía rápida de redacción por tipo de layout:

- **`concept` / `example` (2-3 bullets + callout):**
  - `notes`: El dilema o caso que abre el debate.
  - `beat_notes[0..N-1]`: La explicación hablada de cada tarjeta con ejemplos del mundo real.
  - `beat_notes[último]` (si hay callout): La moraleja de oro o la regla definitiva para llevarse a casa.
- **`comparison` (Columna A vs Columna B):**
  - Orden estricto: primero los bullets de la columna izquierda (el mito, el error o la opción A) y luego los de la columna derecha (la realidad, la solución o la opción B).
  - En la voz: contrastar con fuerza: `«Esto es lo que cree todo el mundo... pero mirad ahora la realidad en la columna derecha...»`.
- **`process` / `agenda` (Pasos secuenciales):**
  - Cada pulso es un hito: `«Paso uno: lo primero que hacéis al llegar al despacho no es abrir Excel...»`.
- **`quiz` (Pregunta en clase):**
  - La nota del profesor debe darle pautas para provocar el debate: `«A ver, lanzaos a la piscina: ¿quién cree que la opción A es legal? Levantad la mano... Bien, ahora mirad por qué no.»`.

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

### 📊 Esquemas, Infografías y Diagramas Visuales
Para conceptos técnicos, flujos de procesos o relaciones entre datos, puedes utilizar **dos formatos visuales según convenga**:

1. **Infografías o esquemas 3D generados como Imagen (`layout: "concept"` o `"example"` con `image`):**
   - Es la opción visualmente más espectacular y con acabado de revista de diseño / editorial.
   - Pides a tu generador de imágenes una infografía conceptual o diagrama 3D en isométrico o vista cenital/frontal.
   - Ejemplos de prompts infográficos:
     - `"isometric 3D infographic diagram showing data flow from government database through privacy filters to public citizen apps, sleek glassmorphism panels, soft neon accents"`
     - `"abstract conceptual diagram of data hierarchy, tiered floating glass pedestals, minimal futuristic visualization, warm sunset studio lighting"`
   - Se guarda como imagen en `images/sXX.png` y se asigna al campo `"image"`.

2. **Diagramas interactivos de código nativo (`layout: "diagram"` con `mermaid`):**
   - El sistema tiene soporte nativo para **Mermaid** (diagramas vectoriales interactivos).
   - Ideal para flujos de decisión, mapas conceptuales o árboles lógicos donde los nodos y flechas deban verse en texto nítido y adaptarse al tema (`flowchart LR`, `flowchart TD`, `mindmap`).
   - Ejemplo:
     ```json
     {
       "layout": "diagram",
       "kicker": "Flujo de decisión",
       "title": "Protocolo para evaluar la apertura de un conjunto de datos",
       "mermaid": "graph LR\n  A[\"¿Tiene datos personales?\"] -->|Sí| B[\"Aplicar anonimización\"]\n  A -->|No| C[\"Revisar licencias\"]\n  B --> D[\"¿Riesgo residual?\"]\n  D -->|Alto| E[\"Acceso restringido\"]\n  D -->|Bajo| F[\"Publicar en Open Data\"]",
       "notes": "...",
       "beat_notes": []
     }
     ```
El agente debe **combinar ambos recursos**: usar imágenes/infografías generadas para metáforas visuales potentes y esquemas Mermaid para flujos analíticos o árboles de decisión.

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
- **Imágenes y esquemas (`image_prompt` / `mermaid`) — Criterio de valor:**
  - **No poner por poner, pero nunca dejar a cero:** Selecciona intencionalmente entre **5 y 8 diapositivas clave** donde una ilustración realmente sume valor pedagógico (portada `cover`, la gran pregunta `question`, metáforas centrales y casos reales de empresas o situaciones concretas).
  - Cada `image_prompt` debe ser conceptual, elegante y libre de texto (`no text, clean composition`).
  - En las diapositivas puramente lógicas o de flujo, usa un diagrama `mermaid` o la lámina infográfica editorial.
  - Al compilar, **siempre compila con las imágenes activadas** (`compile ... --pdf --pptx` sin `--no-images`) para que el resultado final entregado al profesor siempre cuente con ese apoyo visual de impacto.
- **Notas de orador (`notes`):** Obligatorias en todas las diapositivas. Guion hablado directo para el profesor («...»), sin meta-lenguaje tipo "Voy a provocar una respuesta...".
- **Pulsos (`beat_notes`):** Obligatorio si la diapositiva tiene varios puntos. Array de strings con el guion hablado para cada pulso al pulsar la barra espaciadora (debe coincidir exactamente 1 a 1 con el número de elementos `.beat` de la diapositiva).

---

## 6. Flujo paso a paso OBLIGATORIO para el agente

Cuando el usuario te pida *"hazme una presentación de esto"*, ejecuta este flujo:

0. **Haz el Briefing Interactivo (Fase 0)**:
   - Si el usuario no ha indicado extensión, nivel, longitud de notas de orador, tema visual e imágenes, **hazle primero las 6 preguntas de la Fase 0** y espera su respuesta antes de escribir `deck.json`.

1. **Diseña pedagógicamente y escribe `$UNI_SLIDES_HOME/out/<slug>/deck.json`**:
   - Ajusta el número de diapositivas, el tono, la longitud de `notes` / `beat_notes`, el `"theme"`, `"transition"` y `"image_style"` exactamente a lo que haya elegido el usuario (guardando también `"preferences": { "min_slides": ..., "max_slides": ... }` en la raíz de `deck.json`).
   - Redacta las notas de orador (`notes` y `beat_notes`) 100% alineadas 1 a 1 con la pantalla.

2. **Valida la estructura con `lint` (rápido y gratuito)**:
   ```bash
   node $UNI_SLIDES_HOME/src/cli.js lint $UNI_SLIDES_HOME/out/<slug>/deck.json
   ```
   Si hay avisos o errores, corrígelos en `deck.json`.

3. **Compila la presentación y genera las ilustraciones con OpenAI automáticamente**:
   - Ejecuta directamente `compile` **SIN `--no-images`** para que el propio motor de `uni-slides` llame a la API de OpenAI (`OPENAI_API_KEY` configurada en `~/uni-slides/.env`), genere todas las ilustraciones de los `image_prompt` en paralelo y exporte el HTML interactivo, el PDF píxel-perfecto (con `playwright-core` + Chrome) y el PPTX con todas las notas de orador:
   ```bash
   node $UNI_SLIDES_HOME/src/cli.js compile $UNI_SLIDES_HOME/out/<slug>/deck.json --pdf --pptx
   ```
   - *(Plan B solo si el proxy sigue bloqueando `api.openai.com` con HTTP 403)*: Si ves que las llamadas a la API dan error de proxy, genera entre 4 y 8 imágenes individuales limpias (sin texto ni mosaicos 2×2) con tu herramienta nativa `image_generate`, guárdalas en `out/<slug>/images/sXX.png` y vuelve a ejecutar con `--no-images`.

5. **Entrega al usuario los archivos resultantes**:
   - El archivo interactivo standalone (`.html`).
   - El PDF para imprimir o subir a Moodle (`.pdf`).
   - El archivo PowerPoint/Google Slides (`.pptx`).
