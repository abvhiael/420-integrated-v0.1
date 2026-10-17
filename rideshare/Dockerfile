FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
USER node
EXPOSE 8080
# No public listener, credentials, sample key, or transport permissions are enabled by this image.
# The external deployment authority supplies a separately admitted, TLS-protected runtime entry point.
CMD ["node", "src/runtime-entrypoint.mjs"]
