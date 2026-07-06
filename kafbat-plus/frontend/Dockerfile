FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY kafbat-plus/frontend/package*.json kafbat-plus/frontend/
WORKDIR /build/kafbat-plus/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY kafbat-plus/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/kafbat-plus/frontend/dist /usr/share/nginx/html
COPY kafbat-plus/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
