# Base super leve com Node.js 20 (Alpine) - O Chromium já NÃO é necessário graças ao Baileys!
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# O Baileys não precisa de instalar o Chromium! Isto poupa ~500MB+ de RAM e Armazenamento!
# Copiar apenas os ficheiros de dependências primeiro (para otimizar cache do Docker)
COPY package*.json ./
RUN npm install --production

# Copiar o resto do código da v2
COPY . .

# Expor porta (quando criarmos a API do Painel Administrativo Front-end)
EXPOSE 3000

# Comando para iniciar o servidor web (que também arranca o bot)
CMD ["node", "src/server.js"]
