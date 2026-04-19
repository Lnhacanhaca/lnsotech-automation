# LNSOTECH Automation - Arquitetura e Padrões de Software

Este documento serve como guia técnico para a arquitetura do sistema LNSOTECH Automation CRM V2.

## 1. Backend (Node.js / Express)

O backend segue uma arquitetura de camadas para isolar responsabilidades:

### Padrão MVC + Repository + Service
- **Routes**: Definem os endpoints e aplicam middlewares (ex: `auth.js`).
- **Controllers**: Recebem a requisição, validam parâmetros básicos e chamam os serviços. Não executam queries SQL diretamente.
- **Services**: Contêm a lógica de negócio (ex: cálculos de datas, geração de ficheiros, regras de validação complexas).
- **Repositories**: Única camada com acesso ao Singleton da base de dados. Contém as queries SQL brutas.

### Singletons Críticos
- **Database**: Pool de conexões PostgreSQL partilhado.
- **Bot Engine**: Instância única do socket Baileys (WhatsApp) acessível globalmente.

## 2. Frontend (React / Vite)

O frontend foi refactorizado para utilizar **Custom Hooks**, reduzindo a complexidade dos componentes visuais.

### Hooks de Aplicação
- `useAuth`: Centraliza a validação de token e permissões (Admin/Editor).
- `useEventos`: Abstrai a busca de dados, estatísticas e filtros.
- `useBotStatus`: Gere o ciclo de vida da conexão WhatsApp e polling de QR code.
- `useOfflineSync`: Implementa a lógica de persistência para funcionamento offline (PWA).
- `useTheme`: Gere o estado visual (Dark/Light Mode).

## 3. DevOps e Infraestrutura
- **Docker Multi-stage**: Imagens otimizadas para produção.
- **Volumes**: Persistência de logs, backups e sessões de bot.
- **Nginx**: Proxy reverso com suporte a WebSockets para o bot.

---
*Gerado automaticamente pelo Antigravity AI em 2026-04-19*
