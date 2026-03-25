# Stage 1 — build Vite
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — nginx serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Template processado com envsubst no startup — substitui ${BACKEND_HOST}
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_HOST=eficienciia
EXPOSE 80
