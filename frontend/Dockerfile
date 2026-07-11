FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Domyślnie ścieżka WZGLĘDNA '/api' — obsługiwana przez reverse proxy Nginx.
# Obraz nie zna (i nie musi znać) adresu backendu — jest niezależny od środowiska.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine AS production

# Własna konfiguracja: SPA fallback + reverse proxy /api -> backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]