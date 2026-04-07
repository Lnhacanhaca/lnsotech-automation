# Base leve com Node.js 20
FROM node:20-slim

# Instalar dependências necessárias para Chromium rodar em ambiente headless
RUN apt-get update && apt-get install -y \
    chromium-browser \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar apenas os ficheiros de dependências primeiro (para otimizar cache)
COPY package*.json ./
RUN npm install --production

# Copiar o resto do código do bot
COPY . .

# Definir variável de ambiente para Puppeteer usar o Chromium instalado
ENV CHROME_PATH=/usr/bin/chromium-browser

# Expor porta (caso uses Express para página web)
EXPOSE 3000

# Comando para iniciar o bot
CMD ["node", "index.js"]
