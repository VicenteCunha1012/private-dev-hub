FROM node:22-alpine AS build
WORKDIR /build
COPY frontend-lib/ frontend-lib/
COPY ai-session-manager/frontend/package*.json ai-session-manager/frontend/
WORKDIR /build/ai-session-manager/frontend
RUN --mount=type=cache,target=/root/.npm npm ci
COPY ai-session-manager/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/ai-session-manager/frontend/dist /usr/share/nginx/html
COPY ai-session-manager/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
