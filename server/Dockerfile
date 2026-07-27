# PrayNow API — production image
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY data ./data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000
ENV PGSCHEMA=praynow

EXPOSE 5000

# Migrate schema on boot, then serve
CMD ["npm", "run", "start:prod"]
