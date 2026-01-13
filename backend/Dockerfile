FROM node:20-slim

# Instalar dependências do sistema para Playwright
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libwayland-client0 libxcomposite1 \
    libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    xdg-utils libu2f-udev libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Instalar Playwright Chromium
RUN npx playwright install chromium

# Copiar código
COPY . .

# Criar diretórios
RUN mkdir -p /app/bots/screenshots /app/logs

EXPOSE 5000

CMD ["node", "src/server.js"]
