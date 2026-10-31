# Rally web: build with Node, serve static files with nginx.
# The container proxies /api and /health to $BACKEND_URL at runtime.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_URL=http://localhost:8000
EXPOSE 80
