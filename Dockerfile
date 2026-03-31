# ─────────────────────────────────────────
# Stage 1 — Build frontend (React + Vite)
# ─────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.ts ./
COPY src ./src
RUN npm run build

# ─────────────────────────────────────────
# Stage 2 — Build backend (Node + TypeScript)
# ─────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ─────────────────────────────────────────
# Stage 3 — Imagem final
# ─────────────────────────────────────────
FROM nginx:alpine
RUN apk add --no-cache nodejs

# Frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Backend
WORKDIR /app
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY backend/package*.json ./

# Config
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
