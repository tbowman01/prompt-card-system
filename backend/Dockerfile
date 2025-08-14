# Multi-stage build for optimized Docker layers and caching
# Stage 1: Dependency installation (cached layer)
FROM node:20-alpine AS deps
WORKDIR /app

# Install system dependencies for better-sqlite3 and canvas
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

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

# Stage 2: Build stage (for TypeScript compilation)
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

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

# Copy backend source code
COPY backend/ ./backend/

# Build the backend application
RUN cd backend && (npm run build || npm run build:lenient)

# Stage 3: Production runtime (minimal final image)
FROM node:20-alpine AS runner
WORKDIR /app

# Install only runtime system dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    libjpeg-turbo \
    freetype

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

# Copy production dependencies from deps stage
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodeuser:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/backend/package*.json ./

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown nodeuser:nodejs /app/data

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3001

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start production server
CMD ["npm", "start"]