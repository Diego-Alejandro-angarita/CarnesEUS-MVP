FROM node:22-alpine

WORKDIR /app

# Igual que en el backend: dependencias primero para aprovechar la cache.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4200

# --poll: en Docker sobre Windows/macOS los eventos del sistema de archivos no
# atraviesan el volumen, asi que sin esto no hay recarga en caliente.
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]
