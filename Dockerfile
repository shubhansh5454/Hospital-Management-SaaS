# ==============================================================================
# STAGE 1: Build Environment
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies for compiling)
RUN npm ci

# Copy the entire source tree
COPY . .

# Generate Prisma client first (if database client requires binaries)
RUN npx prisma generate --schema=./prisma/schema.prisma || echo "No prisma schema or client generation needed"

# Compile frontend and backend (bundled to dist/server.cjs via vite + esbuild)
RUN npm run build

# ==============================================================================
# STAGE 2: Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /usr/src/app

# Copy dependency manifests to run production-only installs
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the compiled distribution code and generated assets from the builder
COPY --from=builder /usr/src/app/dist ./dist
# Copy prisma configurations if needed for database operations
COPY --from=builder /usr/src/app/prisma ./prisma

# Ensure backups directory has proper permissions
RUN mkdir -p src/server/data/backups && chown -R node:node /usr/src/app

# Switch to a safe, unprivileged non-root user for execution
USER node

# Expose the standard container ingress port
EXPOSE 3000

# Health check probe to ensure container reliability inside clusters
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(res => res.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the optimized full-stack Express + Vite server bundle
CMD ["node", "dist/server.cjs"]
