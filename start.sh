#!/bin/sh
set -e

echo "[start] ============================================"
echo "[start] iniciando container"
echo "[start] NODE_ENV=${NODE_ENV:-não definido}"
echo "[start] PORT=${PORT:-não definido}"
echo "[start] DB_HOST=${DB_HOST:-não definido}"
echo "[start] DB_PORT=${DB_PORT:-não definido}"
echo "[start] DB_NAME=${DB_NAME:-não definido}"
echo "[start] DB_USER=${DB_USER:-não definido}"
echo "[start] DB_PASSWORD=${DB_PASSWORD:+***definido***}"
echo "[start] WAHA_URL=${WAHA_URL:-não definido}"
echo "[start] WHATSAPP_HOOK_HMAC_KEY=${WHATSAPP_HOOK_HMAC_KEY:+***definido***}"
echo "[start] ============================================"

# Inicia o backend em background
echo "[start] iniciando backend (node)..."
node /app/dist/index.js &
NODE_PID=$!
echo "[start] backend PID=$NODE_PID"

# Aguarda o backend estar pronto antes de iniciar o nginx
echo "[start] aguardando backend na porta 4000..."
READY=0
for i in $(seq 1 30); do
  if wget -qO- http://127.0.0.1:4000/api/health > /dev/null 2>&1; then
    echo "[start] backend pronto (tentativa $i)"
    READY=1
    break
  fi

  # Verifica se o node ainda está vivo
  if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "[start] ERRO: backend morreu antes de ficar pronto (tentativa $i)"
    echo "[start] capturando exit code..."
    wait $NODE_PID || echo "[start] backend saiu com código: $?"
    exit 1
  fi

  echo "[start] tentativa $i/30 falhou, aguardando..."
  sleep 1
done

if [ "$READY" = "0" ]; then
  echo "[start] ERRO: backend não ficou pronto após 30 tentativas"
  echo "[start] verificando se o processo ainda existe..."
  if kill -0 $NODE_PID 2>/dev/null; then
    echo "[start] processo ainda vivo mas não responde no /api/health"
  else
    echo "[start] processo não existe mais"
  fi
  exit 1
fi

# Monitora o node — se morrer, loga e mata o nginx (container reinicia)
(
  wait $NODE_PID
  EXIT_CODE=$?
  echo "[start] ALERTA: backend encerrou com código $EXIT_CODE"
  echo "[start] finalizando container para forçar restart..."
  kill 1
) &

echo "[start] iniciando nginx..."
exec nginx -g "daemon off;"
