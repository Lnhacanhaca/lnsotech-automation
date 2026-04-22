# 🗺️ Roadmap de Evolução: KUMBUKA CRM

Este documento detalha o estado atual do desenvolvimento e as metas futuras para o ecossistema de automação **KUMBUKA**.

---

## ✅ Concluído (Fase 1 & 2)

| Funcionalidade | Descrição | Impacto |
| :--- | :--- | :--- |
| **Migração Docker** | Toda a stack (Frontend, Backend, DB) corre em contentores. | Estabilidade e Portabilidade |
| **Fix 2FA (v13)** | Correção funcional da biblioteca `otplib` para autenticação segura. | Segurança Crítica |
| **Fila de Mensagens (Queue)** | Correção dos tipos de dados Postgres para evitar duplicações. | Confiabilidade do Bot |
| **Branding KUMBUKA** | Implementação de logótipos profissionais e favicons premium. | Identidade Visual |
| **Live Template Editor** | Editor de mensagens com pré-visualização em tempo real (estilo smartphone). | UX de Customização |
| **Smart PWA** | Web App instalável com Service Worker e Sync Offline. | Acessibilidade Mobile |
| **Audit Log System** | Registo imutável de todas as ações feitas pelos utilizadores. | Compliance e Gestão |
| **Multi-Bot WhatsApp** | Suporte para múltiplos dispositivos ligados simultaneamente. | Escalabilidade |

---

## ⏳ Em Desenvolvimento (Fase 3)

- [ ] **Otimização de Cache**: Melhorar a resposta do sistema em grupos de WhatsApp com volume extremo de participantes.
- [ ] **Dashboards Avançados**: Gráficos mais detalhados sobre a performance de cada bot e taxa de leitura.
- [ ] **Sistema de Notificações Internas**: Alertas no dashboard para reconexão de bots ou falhas de sistema.

---

## 📅 Planeado (Fase 4 - Futuro)

1. **Inteligência Artificial (IA)**:
   - Sugestões automáticas de templates baseadas no tipo de evento.
   - Predição de churn de grupos ou tendências de data.
2. **Integrações de Terceiros**:
   - Link direto para Google Calendar e Outlook.
   - Webhooks para integração com CRMs externos.
3. **Multi-Idioma (i18n)**:
   - Tradução completa da interface para Inglês e Espanhol.
4. **Retention Policy**:
   - Configuração automática para limpeza de logs e dados após X meses para manter a performance.

---

> **Última atualização:** 22 de Abril de 2026
> **Estado Geral do Projeto:** 85% Concluído
