# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app

RUN groupadd --system --gid 1001 phonics \
    && useradd --system --uid 1001 --gid phonics --create-home phonics

COPY --from=builder --chown=phonics:phonics /app/dist/standalone ./
# vinext's beta standalone emitter omits its React peer dependencies.
COPY --from=builder --chown=phonics:phonics /app/node_modules/react ./node_modules/react
COPY --from=builder --chown=phonics:phonics /app/node_modules/react-dom ./node_modules/react-dom
COPY --from=builder --chown=phonics:phonics /app/node_modules/react-server-dom-webpack ./node_modules/react-server-dom-webpack
COPY --from=builder --chown=phonics:phonics /app/node_modules/scheduler ./node_modules/scheduler
COPY --from=builder --chown=phonics:phonics /app/node_modules/acorn-loose ./node_modules/acorn-loose
COPY --from=builder --chown=phonics:phonics /app/node_modules/neo-async ./node_modules/neo-async
COPY --from=builder --chown=phonics:phonics /app/node_modules/webpack-sources ./node_modules/webpack-sources

USER phonics
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
