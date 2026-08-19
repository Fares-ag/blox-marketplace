# Build from monorepo root (see railway.toml dockerfilePath)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/package.json
RUN npm ci --workspace=@drivemarket/api --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/api ./packages/api
WORKDIR /app/packages/api
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/packages/api
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/api/node_modules ./node_modules
COPY --from=build /app/packages/api/dist ./dist
COPY --from=build /app/packages/api/prisma ./prisma
COPY --from=build /app/packages/api/package.json ./package.json
EXPOSE 3010
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
