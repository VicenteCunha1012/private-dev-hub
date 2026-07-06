FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY mock-data-generator/frontend/package*.json mock-data-generator/frontend/
WORKDIR /build/mock-data-generator/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY mock-data-generator/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/mock-data-generator/frontend/dist /usr/share/nginx/html
COPY mock-data-generator/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
