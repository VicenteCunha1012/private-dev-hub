FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY hub/frontend/package*.json hub/frontend/
WORKDIR /build/hub/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY hub/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/hub/frontend/dist /usr/share/nginx/html
COPY hub/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
