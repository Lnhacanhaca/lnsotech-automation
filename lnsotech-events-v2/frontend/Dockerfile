# Stage 1: Build
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copiar os ficheiros do build para o diretório do Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# A configuração do Nginx será injetada via docker-compose ou imagem customizada
# Aqui usamos a padrão, mas o compose vai sobrepor
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
