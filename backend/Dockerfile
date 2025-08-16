# Multi-stage build for Node.js backend
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p logs temp uploads && \
    chown -R nodejs:nodejs logs temp uploads

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "app.js"]

# Development stage
FROM node:18-alpine AS development

WORKDIR /app

# Install all dependencies including dev dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port and debugger port
EXPOSE 3001 9229

# Start with nodemon for development
CMD ["npm", "run", "dev"]
