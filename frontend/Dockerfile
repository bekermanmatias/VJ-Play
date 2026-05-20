# syntax=docker/dockerfile:1
ARG PUBLIC_REPLAY_API_BASE=http://localhost:4000

FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG PUBLIC_REPLAY_API_BASE
ENV PUBLIC_REPLAY_API_BASE=${PUBLIC_REPLAY_API_BASE}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "./dist/server/entry.mjs"]
