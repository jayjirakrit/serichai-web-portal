# Stage 1: build the SPA
FROM node:24-alpine AS build

WORKDIR /app

# Copy manifest first so `npm ci` is cached unless dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the frontend source and build.
# API_BASE_URL is provided as "" (same-origin) in app.config.ts, which is what
# lets nginx's reverse proxy below serve both the SPA and the backend API
# from one origin.
COPY . .
RUN npm run build

# Stage 2: serve the built assets with nginx
FROM nginx:alpine

COPY --from=build /app/dist/serichai-web-portal/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
