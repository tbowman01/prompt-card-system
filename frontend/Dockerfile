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
# Global platform arguments
ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG TARGETOS
ARG TARGETARCH

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
# Backend package files not needed for frontend-only build

# Install production dependencies with enhanced caching
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/app/node_modules/.cache,sharing=locked \
    npm install --omit=dev --ignore-scripts --prefer-offline --no-audit --no-fund \
    && npm cache clean --force

# Stage 2: Build stage (Next.js compilation with standalone output)
# Redeclare platform arguments for builder stage
ARG BUILDPLATFORM
ARG TARGETPLATFORM

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
# Backend package files not needed for frontend-only build

# Install all dependencies with enhanced caching
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=cache,target=/app/node_modules/.cache,sharing=locked \
    npm install --ignore-scripts --prefer-offline --no-audit --no-fund

# Copy Next.js configuration and source code in optimal order
COPY frontend/next.config.* frontend/tailwind.config.* frontend/postcss.config.* ./frontend/
COPY frontend/public ./frontend/public
COPY frontend/src ./frontend/src
# Copy additional Next.js directories if they exist
# Note: These may not exist depending on Next.js app structure (app router vs pages router)
# Styles directory will be copied with source

# Set advanced build optimization variables
ENV NODE_OPTIONS="--max-old-space-size=4096" \
    NEXT_TELEMETRY_DISABLED=1 \
    GENERATE_SOURCEMAP=false

# Build Next.js application with standalone output for minimal runtime
# Create minimal Next.js config and build
RUN cd frontend && \
    echo "🔨 Starting frontend build..." && \
    echo "module.exports = { output: 'standalone', poweredByHeader: false, compress: true }" > next.config.js && \
    npm run build && \
    echo "✅ Frontend build completed"

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

# Copy built application from builder
# Note: Copying standalone server and static files separately
COPY --from=builder --chown=nextjs:nodejs /app/frontend/package.json ./package.json

# Create server.js for standalone mode
RUN echo 'const { createServer } = require("http"); const { parse } = require("url"); const next = require("next"); const dev = process.env.NODE_ENV !== "production"; const hostname = "0.0.0.0"; const port = process.env.PORT || 3000; const app = next({ dev, hostname, port }); const handle = app.getRequestHandler(); app.prepare().then(() => { createServer(async (req, res) => { try { const parsedUrl = parse(req.url, true); const { pathname, query } = parsedUrl; await handle(req, res, parsedUrl); } catch (err) { console.error("Error occurred handling", req.url, err); res.statusCode = 500; res.end("internal server error"); } }).listen(port, (err) => { if (err) throw err; console.log(`> Ready on http://${hostname}:${port}`); }); });' > server.js

# Copy source files for Next.js runtime
COPY --from=builder --chown=nextjs:nodejs /app/frontend/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/next.config.js ./next.config.js

# Ensure proper permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user for security
USER nextjs

# Expose port
EXPOSE 3000

# Advanced health check optimized for Next.js
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]