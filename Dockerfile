# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package*.json shared/
COPY server/package*.json server/
COPY client/package*.json client/

# Install all dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build --workspace=shared
RUN npm run build --workspace=client
RUN npm run build --workspace=server

# Stage 2: Production
FROM node:24-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/package*.json shared/
COPY server/package*.json server/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=shared --workspace=server 2>/dev/null || npm install --omit=dev --workspace=server

# Copy built artifacts
COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/shared/package.json shared/package.json
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/server/public server/public
COPY --from=builder /app/server/src/db/migrations server/dist/db/migrations

EXPOSE 5000
VOLUME /app/data

ENV NODE_ENV=production
ENV DB_PATH=/app/data/expenses.db
ENV PORT=5000

CMD ["node", "server/dist/index.js"]
