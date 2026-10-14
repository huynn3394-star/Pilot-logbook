FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY public ./public
COPY lib ./lib
COPY server.js ./server.js
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server.js"]
