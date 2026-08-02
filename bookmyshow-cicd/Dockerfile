# --- Stage 1: install deps & run in a clean, reproducible environment ---
FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Only copy manifest files first so the dependency layer is cached
# between builds unless package.json actually changes.
COPY app/package*.json ./
RUN npm install --omit=dev

# Copy the rest of the build artifact (already tested by Jenkins at this point)
COPY app/ ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
