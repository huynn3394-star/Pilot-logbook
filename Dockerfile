# Rebuild the Firebase browser bundle: its transport includes the workspace schema.
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts && npm cache clean --force
COPY public ./public
COPY scripts/build-atpl-account.mjs scripts/stamp-bundle.mjs ./scripts/
RUN npm run build:atpl-account && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY lib ./lib
COPY data ./data
COPY server.js ./server.js
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server.js"]
