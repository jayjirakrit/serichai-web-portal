# Stage 1: build the SPA
FROM node:20-alpine AS build

WORKDIR /app

# Copy manifest first so `npm ci` is cached unless dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the frontend source and build.
# VITE_API_BASE_URL is intentionally left unset here: apiConfig.ts falls back
# to "" (relative/same-origin API calls), which is what lets nginx's
# reverse proxy below serve both the SPA and the backend API from one origin.
COPY . .
RUN npm run build

# Stage 2: serve the built assets with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
