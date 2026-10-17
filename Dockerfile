# Web app + owner desk. The API is a separate service (server/Dockerfile).
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# node:22-alpine ships npm 10, which rejects this npm 11 lockfile.
RUN npm install -g npm@11.6.2 && npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY portal ./portal
COPY src ./src

ARG VITE_API_URL=
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
