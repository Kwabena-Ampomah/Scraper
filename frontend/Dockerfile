# Frontend (Next.js) Dockerfile

# 1) Install deps
FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force

# 2) Build
FROM deps AS builder
WORKDIR /app

# Pass public env at build time for Next.js
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY . .
RUN npm run build

# 3) Run
FROM node:20-bullseye-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy runtime files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]

