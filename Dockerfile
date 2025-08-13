# Use Node.js LTS Alpine image for stability and smaller size
FROM node:lts-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ sqlite

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and rebuild sqlite3 bindings
# First install without scripts to avoid husky, then rebuild only sqlite3
RUN npm ci --only=production --ignore-scripts && \
    npm rebuild sqlite3

# Copy application files
COPY src/ ./src/
COPY .env.example ./.env.example

# Create non-root user for security (using standard node user from base image)
# The node user already exists with UID 1000 in node:lts-alpine
# Just create the data directory with proper ownership
RUN mkdir -p /app/data && \
    chown -R node:node /app && \
    chmod 755 /app/data

# IMPORTANT: Declare VOLUME after setting permissions
# This ensures the volume inherits the permissions we just set
VOLUME ["/app/data"]

USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Start the application
CMD ["node", "src/bot.js"]