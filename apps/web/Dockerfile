FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Build frontend
WORKDIR /app/apps/web
RUN npm run build

# Production - just serve static files via nginx
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html