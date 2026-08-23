# Build from monorepo root (see railway.toml dockerfilePath)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=@drivemarket/api --workspace=@drivemarket/shared --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
WORKDIR /app/packages/shared
RUN npm run build:pricing
WORKDIR /app/packages/api
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/prisma ./packages/api/prisma
COPY --from=build /app/packages/api/scripts/chery-elite-motors-import.json ./packages/api/scripts/chery-elite-motors-import.json
COPY --from=build /app/packages/api/scripts/run-qauto-seed.mjs ./packages/api/scripts/run-qauto-seed.mjs
COPY --from=build /app/packages/api/assets/qauto-catalog ./packages/api/assets/qauto-catalog
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/api/node_modules ./packages/api/node_modules
WORKDIR /app/packages/api
EXPOSE 3010
CMD ["node", "dist/api/src/main.js"]
