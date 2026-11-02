# Multi-stage Dockerfile for Browser IDE Static Web Application
FROM node:22-alpine AS build

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy root configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all packages and apps
COPY packages ./packages
COPY pocs ./pocs
COPY apps ./apps
COPY tests ./tests

# Install dependencies and build static distributable
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Production static serving container via Nginx
FROM nginx:alpine AS runtime

COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Custom nginx configuration for SPA routing & WASM compression
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript application/wasm; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
