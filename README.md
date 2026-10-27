# 🎓 uni-slides — Presentaciones Universitarias con IA (Modo Profesor Guiado + Efectos Beatdeck)

Generador de presentaciones universitarias visuales (estilo Gamma + Beatdeck): convierte un **temario en texto** en una presentación de **35 a 42 diapositivas** pensada para clases de 60 minutos, con **tarjetas guiadas**, **efectos paso a paso (*Beats*)**, **Consola de Presentador en Pantalla 1 (`Tecla P`) con guion hablado pulso a pulso**, **vídeos reales de YouTube**, **PDF ligero para el Campus Virtual** y **Google Slides (`.pptx`)**.

Diseñado para ejecutarse en tu servidor con **OpenClaw** (usando el propio modelo de tu agente para ahorrar el 100 % en texto) o desde la terminal.

---

## 🚀 Instalación rápida en tu servidor (OpenClaw)

```bash
git clone https://github.com/meloler/uni-slides.git ~/uni-slides
cd ~/uni-slides
bash install-openclaw-server.sh
```

Después añade tu `OPENAI_API_KEY` (solo se utiliza para generar las ilustraciones con IA):

```bash
nano ~/uni-slides/.env
# OPENAI_API_KEY=sk-...
```

Y dile a tu agente OpenClaw:
> *«Refresca tus skills y hazme las diapositivas de clase con `uni-slides` para este temario: [pega aquí el temario]»*

---

## ✨ Qué genera cada compilación (`cli.js compile`)

1. **`<tema>-interactivo.html` (~2–3 MB, 1 solo archivo portátil):**
   - Lleva todas las imágenes y estilos incrustados dentro del propio `.html`. Puedes descargarlo desde Telegram/WhatsApp en el ordenador del aula y abrirlo sin carpetas ni conexión.
   - **Controles en vivo:**
     - `Espacio` / `→`: Avanza pulso a pulso (*Modo Beats* con foco *Spotlight* en la tarjeta activa).
     - `Tecla P`: Abre la **Consola del Profesor en tu Pantalla 1** (sincronizada en tiempo real con el proyector en la Pantalla 2), donde el **guion hablado cambia en cada pulso** para ampliar la explicación sin leer la diapositiva.
     - `Tecla O`: Mosaico interactivo con todas las diapositivas para saltar a cualquiera.
     - `Tecla B`: Pantalla a negro (Modo Pizarra / Silencio).
     - `Tecla L`: Puntero láser rojo.
     - `Tecla M`: Alternar entre Modo Beats (paso a paso) y Diapositiva entera.
     - `Tecla F`: Pantalla completa en el proyector.
2. **`<tema>.pdf` (~5–7 MB, ultraligero):**
   - Optimizado automáticamente para subirlo sin problemas de límite de tamaño al Campus Virtual / Moodle de los alumnos.
3. **`<tema>.pptx` (100 % editable):**
   - Presentación nativa para Google Slides o PowerPoint.

---

## 🛠️ Uso manual por CLI

```bash
# Validar las reglas pedagógicas de un deck.json
node src/cli.js lint out/mi-clase/deck.json

# Compilar (resuelve vídeos de YouTube + genera imágenes con OpenAI + exporta HTML portátil, PDF y PPTX)
node src/cli.js compile out/mi-clase/deck.json --pdf --pptx

# Re-renderizar sin regenerar imágenes (ej. cambiando al tema neon o paper)
node src/cli.js render out/mi-clase/deck.json --theme neon --pdf --pptx
```
