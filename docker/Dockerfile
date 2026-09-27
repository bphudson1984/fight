# MATHS FIST app image. The game is a static Vite build (no backend; all
# progress lives in the browser), so: build with Node, serve with nginx.

# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /src
# The npm package only; the agent image and CI install browsers separately.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html ./
COPY src/ ./src/
RUN npm run build

# ---- runtime --------------------------------------------------------------
# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
