FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY todo/frontend/package*.json todo/frontend/
WORKDIR /build/todo/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY todo/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/todo/frontend/dist /usr/share/nginx/html
COPY todo/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
