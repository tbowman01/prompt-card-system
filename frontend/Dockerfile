# =============================================================================
# 🚀 OPTIMIZED MULTI-STAGE DOCKER BUILD FOR NEXT.JS FRONTEND
# =============================================================================
# Performance optimizations:
# - Advanced Next.js build caching with standalone output
# - Multi-architecture support with platform-specific optimizations
# - Minimized final image size using alpine base
# - Registry-based caching for faster CI/CD builds
# =============================================================================

# Stage 1: Dependency installation (heavily cached layer)
FROM --platform=$BUILDPLATFORM node:20-alpine AS deps
WORKDIR /app

# Set aggressive caching environment variables
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true \
    CYPRESS_INSTALL_BINARY=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0 \
    DISABLE_OPENCOLLECTIVE=1 \
    ADBLOCK=1

# Copy package files in optimal order for cache efficiency
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.jso[n] ./backend/ 2>/dev/null || true

# Install production dependencies with enhanced caching
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/app/node_modules/.cache,sharing=locked \
    npm ci --omit=dev --ignore-scripts --prefer-offline --no-audit --no-fund \
    && npm cache clean --force

# Stage 2: Build stage (Next.js compilation with standalone output)
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app

# Set build environment variables for optimal performance
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true \
    CYPRESS_INSTALL_BINARY=0 \
    HUSKY=0

# Copy package files for dependency installation
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.jso[n] ./backend/ 2>/dev/null || true

# Install all dependencies with enhanced caching
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/app/node_modules/.cache,sharing=locked \
    npm ci --ignore-scripts --prefer-offline --no-audit --no-fund

# Copy Next.js configuration and source code in optimal order
COPY frontend/next.config.* frontend/tailwind.config.* frontend/postcss.config.* ./frontend/
COPY frontend/public ./frontend/public
COPY frontend/src ./frontend/src
COPY frontend/app ./frontend/app 2>/dev/null || true
COPY frontend/pages ./frontend/pages 2>/dev/null || true
COPY frontend/components ./frontend/components 2>/dev/null || true
COPY frontend/styles ./frontend/styles 2>/dev/null || true

# Set advanced build optimization variables
ENV NODE_OPTIONS="--max-old-space-size=4096" \
    NEXT_TELEMETRY_DISABLED=1 \
    GENERATE_SOURCEMAP=false

# Build Next.js application with standalone output for minimal runtime
RUN cd frontend && \
    echo "🔨 Starting optimized Next.js build with standalone output..." && \
    # Create optimized next.config.js if not exists
    if [ ! -f "next.config.js" ] && [ ! -f "next.config.mjs" ]; then \
        echo "Creating optimized Next.js configuration..." && \
        cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: process.cwd(),
  },
  poweredByHeader: false,
  generateEtags: false,
  compress: true,
  optimizeFonts: true,
  images: {
    unoptimized: false,
    domains: [],
  },
  swcMinify: true,
  productionBrowserSourceMaps: false,
}
module.exports = nextConfig
EOF
    fi && \
    # Build with enhanced error handling
    if npm run build; then \
        echo "✅ Standard build successful"; \
    elif npx next build; then \
        echo "⚠️ Direct Next.js build successful"; \
    else \
        echo "❌ Build failed completely" && exit 1; \
    fi && \
    # Verify standalone output
    if [ ! -f ".next/standalone/server.js" ]; then \
        echo "⚠️ Standalone output not found, ensuring compatibility..." && \
        ls -la .next/; \
    fi && \
    echo "✅ Next.js build completed successfully"

# Stage 3: Production runtime (ultra-minimal Next.js image)
FROM node:20-alpine AS runner

# Install minimal runtime dependencies
RUN apk add --no-cache dumb-init tini curl && \
    # Create optimized non-root user
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs --ingroup nodejs

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=512" \
    HOSTNAME="0.0.0.0" \
    PORT=3000

# Copy standalone application from builder
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./public

# Ensure proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user for security
USER nextjs

# Expose port
EXPOSE 3000

# Advanced health check optimized for Next.js
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health 2>/dev/null || curl -f http://localhost:3000/ || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]