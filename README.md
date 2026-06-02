# SGFS - Sistema de Gestão de Folhas Salariais (Curso Nocturno)

O **SGFS** é um sistema web moderno e responsivo desenvolvido para o **Instituto Superior Politécnico de Tete (ISPT)**, Moçambique. Ele simplifica e centraliza a gestão, lançamento, auditoria e emissão de folhas de pagamento mensais para docentes do curso nocturno (pós-laboral).

---

## 🛠️ Tecnologias Utilizadas

O sistema foi desenhado com foco em desempenho, segurança e experiência do utilizador:

### Frontend
- **React (Vite)**: Renderização rápida de componentes.
- **Tailwind CSS v4**: Design moderno, adaptável e com suporte a variáveis CSS e temas nativos.
- **Lucide React**: Biblioteca de ícones moderna.
- **Recharts**: Visualização gráfica de indicadores e custos salariais.
- **TanStack React Query**: Gerenciamento de estado de dados e chamadas à API com cache inteligente.

### Backend
- **Node.js (Express)**: API REST robusta e veloz.
- **Knex.js**: Query Builder utilizado para migrações e sementes (seeds) de dados.
- **SQLite3**: Banco de dados para o ambiente de desenvolvimento local.
- **PostgreSQL**: Banco de dados robusto de nível de produção na VPS.

### Infraestrutura & Deploy
- **Docker & Docker Compose**: Empacotamento de containers para ambiente local e produção.
- **Nginx Proxy Manager**: Proxy reverso de entrada e gerenciamento de certificados SSL/HTTPS na VPS.
- **Bash Scripting**: Scripts automatizados de implantação local para a VPS.

---

## 👥 Perfis de Acesso (Funções)

O sistema possui controle de acesso rigoroso baseado em papéis (RBAC):

1. **Administrador Geral (ADMIN)**:
   - Visão consolidada (Geral) de todas as folhas salariais.
   - Gerenciamento completo de utilizadores (Diretores de Curso).
   - Cadastro, edição e importação (via CSV) de Docentes e suas respectivas categorias e cargas de Aulas Programadas (AP).
   - Definição de **Exceções de Prazo** para permitir que diretores específicos editem horas após o período regulamentar.
   - Publicação de avisos críticos no mural do painel.
   - Visualização de logs de auditoria e segurança.
   - Criação de Cópias de Segurança (Backup) e Restauro completo do sistema em formato JSON.

2. **Director de Curso (DIRETOR_CURSO)**:
   - Acesso exclusivo aos docentes associados ao seu curso ou grupo de cursos (ex: *Almeida* para CA/CAP, *Lucas/Leandro* para Minas/Processamento).
   - Lançamento manual semanal de Aulas Dadas (AD) e Vigias Dadas (VD - Modo Exame).
   - Emissão e impressão de relatórios de folha salarial e notas de justificação individual.
   - Edição de perfil próprio (Username e Senha).

---

## ✨ Principais Funcionalidades

- **100% Responsivo**: Layout desenhado com técnica mobile-first, garantindo compatibilidade total com tablets e celulares sem quebra de tabelas.
- **Modo Escuro Global**: Tema escuro premium controlado por um botão alternador (Sol/Lua) no topo superior direito, disponível para todos os utilizadores.
- **Sincronização Automática de AP**: Alterações na carga horária semanal (AP) feitas no cadastro de docentes propagam-se instantaneamente para todas as tabelas de lançamento e relatórios.
- **Quadro de Avisos**: Canal direto de comunicação da Direção com os Diretores.
- **Alertas de Feriados Nacionais**: Exibição dinâmica de alertas de feriados no mês de referência para guiar o desconto de horas acadêmicas.
- **Análise Anual de Custos**: Gráficos financeiros detalhados mostrando evolução de gastos por curso e o rácio entre aulas programadas vs dadas.
- **Justificação de Atrasos**: Modal que gera documentos automatizados em conformidade com as exigências da administração pública moçambicana.

---

## 🚀 Como Rodar o Projeto Localmente

### Pré-requisitos
- [Docker](https://www.docker.com/) instalado em sua máquina.
- [Node.js](https://nodejs.org/) (opcional, apenas para desenvolvimento nativo).

### Execução via Docker Compose (Recomendado)

1. Certifique-se de que a rede compartilhada existe:
   ```bash
   docker network create lnso_network
   ```

2. Inicialize os containers locais:
   ```bash
   docker compose up -d --build
   ```

3. Acesse no navegador:
   - **Frontend (SPA)**: `http://localhost:5173`
   - **Backend API**: `http://localhost:3001`
   - **Nginx Proxy Manager**: `http://localhost:81`

### Utilizadores Padrão (Ambiente de Testes)
- **Administrador**: `admin` / senha: `admin123`
- **Director Almeida**: `almeida` / senha: `password`
- **Director Lucas**: `lucas` / senha: `password`

---

## 🌐 Deploy na VPS (Produção)

O projeto está configurado para deploy automatizado via script SSH.

### Configuração do Script
O script `deploy_local.sh` compacta as pastas de código, transfere para a VPS usando SSH, reconstrói os containers do Docker Compose produtivo e roda as migrações mais recentes no banco de dados Postgres:

```bash
# Executar deploy
./deploy_local.sh
```

### Configurações de Payload (Envio de Backups Grandes)
Para evitar o erro **HTTP 413 (Payload Too Large)** ao restaurar backups grandes via JSON, as seguintes definições estão configuradas:
1. **Express Backend**: Configurado no `index.js` para aceitar payloads de até **50MB** (`express.json({ limit: '50mb' })`).
2. **Nginx Proxy Manager (VPS)**: Caso envie arquivos maiores que 1MB em produção, vá nas configurações do host no painel do Nginx Proxy Manager, aceda à aba **Advanced** e insira:
   ```nginx
   client_max_body_size 50m;
   ```

---

## 📄 Licença

Este projeto é desenvolvido para uso interno exclusivo do **Instituto Superior Politécnico de Tete (ISPT)**. Todos os direitos reservados.
