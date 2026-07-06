FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY command-vault/frontend/package*.json command-vault/frontend/
WORKDIR /build/command-vault/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY command-vault/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/command-vault/frontend/dist /usr/share/nginx/html
COPY command-vault/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
