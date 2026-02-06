FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for monorepo
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies at root level
RUN npm ci

# Copy source
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build API
RUN npm run --workspace=apps/api build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package*.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main.js"]
