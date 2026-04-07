FROM node:20-slim

# Instalar dependências necessárias para o Chromium rodar no Linux (VPS)
RUN apt-get update && apt-get install -y \
    chromium \
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

WORKDIR /app

# Copiar apenas os ficheiros de dependências primeiro (otimiza o build)
COPY package*.json ./
RUN npm install --production

# Copiar o resto do código do bot para dentro do container
COPY . .

# Comando para iniciar o bot
CMD ["node", "index.js"]
