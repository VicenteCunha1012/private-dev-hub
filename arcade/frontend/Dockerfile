FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY arcade/frontend/package*.json arcade/frontend/
WORKDIR /build/arcade/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY arcade/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/arcade/frontend/dist /usr/share/nginx/html
COPY arcade/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
