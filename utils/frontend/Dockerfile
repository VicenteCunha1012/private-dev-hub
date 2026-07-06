FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY utils/frontend/package*.json utils/frontend/
WORKDIR /build/utils/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY utils/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/utils/frontend/dist /usr/share/nginx/html
COPY utils/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
