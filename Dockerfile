# Build on the runner's native platform; the output (static files + pure-JS deps) is arch-independent.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=5200 BASE_PATH=
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 5200
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:5200/ >/dev/null || exit 1
CMD ["node", "server/index.js"]
