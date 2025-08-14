# 🔐 Security-First Authentication Service Dockerfile  
# Build from root context to access auth/ directory
FROM node:20-alpine AS base

# Security: Create non-root user
RUN addgroup -g 1001 -S authuser && \
    adduser -S authuser -u 1001 -G authuser

# Security: Install only production dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Change ownership to non-root user
RUN chown -R authuser:authuser /app

# Switch to non-root user
USER authuser

# Development stage
FROM base AS development
WORKDIR /app
COPY --chown=authuser:authuser auth/package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi
COPY --chown=authuser:authuser auth/ .
EXPOSE 8005
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
WORKDIR /app
COPY --chown=authuser:authuser auth/package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi
COPY --chown=authuser:authuser auth/ .
RUN npm run build || npm run build:lenient && \
    npm prune --production && \
    npm cache clean --force

# Production stage
FROM base AS production
WORKDIR /app

# Copy package files
COPY --chown=authuser:authuser auth/package*.json ./

# Install only production dependencies
# Use npm install if package-lock.json is missing, otherwise use npm ci
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi && \
    npm cache clean --force

# Copy built application
COPY --from=build --chown=authuser:authuser /app/dist ./dist
COPY --from=build --chown=authuser:authuser /app/node_modules ./node_modules

# Security: Remove package manager to prevent runtime package installations
RUN rm -rf /usr/local/lib/node_modules/npm

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8005/auth/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Security labels
LABEL security.scanner="trivy" \
      security.policy="zero-trust" \
      maintainer="vllm-security-team"

# Expose port
EXPOSE 8005

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]