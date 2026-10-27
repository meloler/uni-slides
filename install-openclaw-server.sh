#!/usr/bin/env bash
# Instalador automático de uni-slides + Skill para el servidor de OpenClaw
set -e

INSTALL_DIR="${UNI_SLIDES_HOME:-$HOME/uni-slides}"
OPENCLAW_SKILLS_DIR="${OPENCLAW_SKILLS_DIR:-$HOME/.openclaw/skills}"

echo "🎓 Instalando uni-slides en $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r package.json src examples integrations .env.example "$INSTALL_DIR/" 2>/dev/null || true

cd "$INSTALL_DIR"
npm install
npx playwright install --with-deps chromium

if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  echo "⚠️  Recuerda añadir tu OPENAI_API_KEY en $INSTALL_DIR/.env (solo se usa para las ilustraciones)."
fi

echo "🦞 Registrando la skill uni-slides en OpenClaw ($OPENCLAW_SKILLS_DIR)..."
mkdir -p "$OPENCLAW_SKILLS_DIR"
rm -rf "$OPENCLAW_SKILLS_DIR/uni-slides"
cp -r "$INSTALL_DIR/integrations/openclaw/uni-slides" "$OPENCLAW_SKILLS_DIR/uni-slides"

echo "✅ ¡Listo! Ya puedes enviar cualquier temario a tu agente OpenClaw y pedirle:"
echo "   «Hazme las diapositivas de clase con uni-slides de este temario»"
