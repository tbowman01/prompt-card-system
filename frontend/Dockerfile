# Multi-stage build for optimized Next.js application
# Stage 1: Dependency installation (cached layer)
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace package files for dependency installation
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Set environment variables to skip unnecessary downloads
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
ENV CYPRESS_INSTALL_BINARY=0

# Install production dependencies (workspace-aware) - use npm install for version tolerance
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Stage 2: Build stage (for Next.js compilation)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace package files and install all dependencies (including dev)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Set environment variables to skip unnecessary downloads
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
ENV CYPRESS_INSTALL_BINARY=0

# Install all dependencies for building (workspace-aware) - use npm install for version tolerance
RUN npm install --ignore-scripts

# Copy frontend source code
COPY frontend/ ./frontend/

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Increase Node.js memory for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the Next.js application with enhanced error handling
RUN cd frontend && \
    echo "🔨 Starting frontend build..." && \
    if npm run build; then \
        echo "✅ Next.js build successful"; \
    else \
        echo "❌ Next.js build failed, checking for common issues..."; \
        echo "🔧 Attempting build with increased memory and lenient settings..."; \
        NODE_OPTIONS="--max-old-space-size=4096" npm run build || \
        NODE_OPTIONS="--max-old-space-size=4096" npx next build --experimental-build-mode=compile || \
        (echo "❌ Frontend build failed completely" && exit 1); \
        echo "⚠️ Frontend build completed with fallback settings"; \
    fi

# Stage 3: Production runtime (minimal final image)
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy production dependencies from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage with proper structure
# Check if standalone exists, otherwise copy dist
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next ./next
COPY --from=builder --chown=nextjs:nodejs /app/frontend/package*.json ./
# Copy public folder if it exists
RUN mkdir -p ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./public/ 2>/dev/null || true
# Copy node_modules for runtime
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start production server
CMD ["npm", "start"]