FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm ci --workspace=@recruitflow/shared --workspace=@recruitflow/api
RUN npm run build -w @recruitflow/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/node_modules ./node_modules
WORKDIR /app/apps/api
EXPOSE 4010
CMD ["node", "dist/server.js"]
