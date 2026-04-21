# 📘 Documentação Técnica - LNSOTECH Automation CRM v2

Este documento descreve a arquitetura, padrões de software e tecnologias utilizadas no ecossistema LNSOTECH. O sistema foi projetado seguindo as melhores práticas de engenharia de software para garantir escalabilidade, segurança e robustez.

---

## 🏗️ 1. Arquitetura do Sistema

O sistema baseia-se numa arquitetura de **Microserviços Contenerizados** (Docker), dividida em três camadas principais:

### A. Backend (Node.js + Express)
Segue o padrão **MVC (Model-View-Controller)** com uma **Service Layer** adicional:
- **Controllers**: Gerem as requisições HTTP e as respostas (API).
- **Services**: Contêm a lógica de negócio pesada (ex: `BackupService.js`).
- **Repositories**: Encapsulam o acesso direto ao PostgreSQL.
- **Bot Engine**: Motor reativo baseado em eventos para integração com WhatsApp.

### B. Frontend (React + Vite)
Uma **SPA (Single Page Application)** moderna:
- Estrutura baseada em componentes reativos.
- Comunicação via REST API com o backend.
- Gestão de estado através de **React Hooks**.

### C. Infraestrutura (Docker + Nginx)
- **Nginx**: Atua como Reverse Proxy e servidor de arquivos estáticos.
- **PostgreSQL**: Banco de dados relacional para persistência de eventos e logs.

---

## 🛠️ 2. Padrões de Software (Design Patterns)

### 🧩 2.1. Singleton Pattern
- **Conexão BD**: O `Pool` de conexões do PostgreSQL é instanciado uma única vez e partilhado por todos os módulos.
- **Classes de Serviço**: Serviços como `BackupService` são exportados como instâncias únicas para consistência de estado.

### 🔔 2.2. Observer / Event-Driven
- **Baileys Engine**: Todo o motor do WhatsApp funciona através do padrão Observer. O sistema reage a eventos como `connection.update` e `messages.upsert` de forma assíncrona.

### 🛡️ 2.3. Middleware Pattern
- **Cadeia de Responsabilidade**: Endpoints protegidos utilizam o middleware `verificarToken` para validar credenciais JWT antes de permitir o acesso à lógica do controlador.

### 🍱 2.4. Repository Pattern
- As queries SQL são isoladas para facilitar a manutenção e permitir a troca de motor de base de dados no futuro sem afetar a lógica de negócio.

---

## ⚛️ 3. Padrões de Frontend (React Hooks)

A reatividade da interface é gerida através de Hooks oficiais do React:
- **`useState`**: Gestão do estado local (filtros, listas de eventos, modais).
- **`useEffect`**: Gestão de efeitos colaterais (chamadas de API no carregamento e polling de status do servidor).
- **`useRef`**: Interação direta com elementos do DOM (ex: inputs de foto).

---

## 🛡️ 4. Robustez e Estabilização

### 🔄 4.1. Anti-Loop & Anti-Spam
- O motor do bot ignora mensagens de si mesmo (`fromMe`) e valida assinaturas de sistema para evitar ciclos infinitos de respostas automáticas.
- **Rate Limiting**: Intervalo de cache de 10 segundos por conversa para respostas automáticas.

### ⏱️ 4.2. Throttling e Sequential Delivery
- **Sleep Utility**: Implementação de atrasos assíncronos (`sleep`) de 5 segundos entre o envio de lembretes massivos para respeitar as políticas de tráfego do WhatsApp e evitar desconexões.

### 📦 4.3. Data Compatibility
- Implementação de exportação em **Texto Plano (Plain SQL)** e **Binário Customizado** para garantir que backups criados em versões superiores (v17) possam ser migrados e restaurados em versões estáveis de produção (v15).

---

## 🚀 5. Stack Tecnológica
- **Backend**: Node.js v20+, Express, Multer, Baileys (Socket).
- **Frontend**: React 18, Vite, SweetAlert2, Lucide React (Ícones).
- **Database**: PostgreSQL 15-alpine.
- **Server**: Nginx (Alpine-based).

---
*Gerado automaticamente pelo Antigravity AI Coding Assistant em 21/04/2026*
