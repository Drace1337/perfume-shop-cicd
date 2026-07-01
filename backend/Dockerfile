# ETAP 1: Budowanie (Kompilacja TypeScript i Prismy)
FROM node:22-alpine AS builder

WORKDIR /app

# Kopiujemy pliki konfiguracyjne
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

# Instalujemy wszystkie zależności (w tym devDependencies do kompilacji)
RUN npm ci

# Kopiujemy resztę kodu
COPY . .

# Generujemy klienta Prismy dla środowiska wewnątrz kontenera
RUN npx prisma generate

# Kompilujemy TypeScripta
RUN npm run build


# ETAP 2: Środowisko produkcyjne (Lekki obraz)
FROM node:22-alpine

WORKDIR /app

# Kopiujemy tylko to, co niezbędne
COPY package*.json ./
COPY prisma ./prisma/

# Instalujemy TYLKO zależności produkcyjne (bez ciężkich narzędzi deweloperskich)
RUN npm ci --omit=dev

# Generujemy klienta Prismy raz jeszcze dla czystych zależności produkcyjnych
RUN npx prisma generate

# Kopiujemy skompilowany kod z pierwszego etapu
COPY --from=builder /app/dist ./dist

# Uruchamiamy aplikację
CMD ["node", "dist/server.js"]