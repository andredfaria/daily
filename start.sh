#!/bin/sh
set -e

# Inicia o backend em background
node /app/dist/index.js &
NODE_PID=$!

# Aguarda o backend estar pronto antes de iniciar o nginx
echo "[start] aguardando backend na porta 4000..."
for i in $(seq 1 20); do
  if wget -qO- http://localhost:4000/api/health > /dev/null 2>&1; then
    echo "[start] backend pronto"
    break
  fi
  sleep 1
done

# Monitora o node — se morrer, mata o nginx (e o container reinicia)
(
  wait $NODE_PID
  echo "[start] backend encerrou, finalizando container..."
  kill 1
) &

exec nginx -g "daemon off;"
