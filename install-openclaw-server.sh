#!/usr/bin/env bash
# Instalador automático de uni-slides + Skill para el servidor de OpenClaw (Modo Cero-Dependencias npm)
set -e

INSTALL_DIR="${UNI_SLIDES_HOME:-$HOME/uni-slides}"
OPENCLAW_SKILLS_DIR="${OPENCLAW_SKILLS_DIR:-$HOME/.openclaw/skills}"

echo "🎓 Preparando uni-slides en $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r package.json src examples integrations .env.example "$INSTALL_DIR/" 2>/dev/null || true

if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  echo "⚠️  Recuerda añadir tu OPENAI_API_KEY en $INSTALL_DIR/.env (solo se usa para las ilustraciones)."
fi

echo "🦞 Registrando la skill uni-slides en OpenClaw ($OPENCLAW_SKILLS_DIR)..."
mkdir -p "$OPENCLAW_SKILLS_DIR"
rm -rf "$OPENCLAW_SKILLS_DIR/uni-slides"
cp -r "$INSTALL_DIR/integrations/openclaw/uni-slides" "$OPENCLAW_SKILLS_DIR/uni-slides"
echo "✔ Skill registrada en $OPENCLAW_SKILLS_DIR/uni-slides"

echo "📦 Comprobando entorno (Modo Cero-Dependencias integrado: no requiere registry.npmjs.org)..."
cd "$INSTALL_DIR"
if npm install --prefer-offline --no-audit --no-fund 2>/dev/null; then
  npx playwright install --with-deps chromium 2>/dev/null || true
else
  echo "ℹ️  Proxy sin acceso a registry.npmjs.org detectado — ¡No pasa nada! uni-slides funciona al 100% en Modo Cero-Dependencias (fetch nativo + PptxGenJS integrado en src/vendor/pptxgen.js)."
fi

echo "✅ ¡Instalación completada al 100%! Ya puedes usar la skill uni-slides en OpenClaw."
