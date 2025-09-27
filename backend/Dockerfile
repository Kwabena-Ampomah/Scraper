# Backend API Dockerfile
FROM node:20-bullseye-slim AS base

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Install dependencies first (leverage layer caching)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the rest of the source
COPY . .

# Ensure log directory exists for Winston file transports
RUN mkdir -p logs && chown -R node:node logs

# Drop privileges
USER node

EXPOSE 3000

# Simple healthcheck pinging the health endpoint
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/ping').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]

