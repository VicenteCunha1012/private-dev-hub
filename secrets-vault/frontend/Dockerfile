FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY secrets-vault/frontend/package*.json secrets-vault/frontend/
WORKDIR /build/secrets-vault/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY secrets-vault/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/secrets-vault/frontend/dist /usr/share/nginx/html
COPY secrets-vault/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
