# Public app (Expo web) plus the owner desk. The API is a separate service.
FROM node:22-alpine AS desk
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

FROM node:22-alpine AS app
WORKDIR /app

COPY mobile/package.json mobile/package-lock.json ./
RUN npm install -g npm@11.6.2 && npm ci

COPY mobile/ ./
ENV CI=1
ENV EXPO_NO_TELEMETRY=1
# The hosted site calls /api on its own address. Do not bake a LAN URL.
ENV EXPO_PUBLIC_API_URL=
ENV EXPO_PUBLIC_ADMIN_URL=
RUN npx expo export --platform web

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=app /app/dist /srv/app
COPY --from=desk /app/dist /srv/desk
