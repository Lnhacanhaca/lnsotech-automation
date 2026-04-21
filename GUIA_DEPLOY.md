# 🚀 Guia de Deploy DEFINITIVO (3 Passos)

Este guião define o fluxo de trabalho profissional para o ecossistema LNSOTECH. O objetivo é que o **GitHub Actions** seja apenas o "gatilho" final depois de você ter a certeza absoluta de que tudo funciona no seu PC.

---

## Passo 1: Desenvolvimento (Modo Rápido)

Este é o modo onde a criação acontece.

* **Comando:** `docker-compose up --build`
* **O que acontece:**
  * **Hot-Reload:** Cada mudança no código é refletida no browser instantaneamente.
  * **Ferramentas de Debug:** O painel **pgAdmin** está disponível em `http://localhost:5050`.

---

## Passo 2: Validação (O "OK" Final)

Este é o passo mais importante. Aqui você simula a VPS dentro do seu próprio PC.

* **Comando:** `docker-compose -f docker-compose.yml up --build`
* **O que acontece:**
  * **Simulação Real:** O Docker constrói o sistema exatamente como ele será na nuvem (sem pgAdmin, com Nginx de produção).
  * **Segurança:** Se o site abrir bem aqui, é **garantido** que funcionará na Contabo.

---

## Passo 3: Lançamento (Automático)

Uma vez validado no Passo 2, é hora de "lançar ao mundo".

* **Comando:**
  
  ```bash
  git push origin main
  ```

* **O que acontece:**
  
  * O **GitHub Actions** liga-se à Contabo.
  * Faz o `git pull` e reconstrói os contentores na VPS.
  * Realiza um **Backup** da base de dados por segurança.

---

## 🏁 Monitorização Pós-Lançamento

1. **Check:** Aceda ao seu domínio e veja as mudanças ao vivo.
2. **Logs:** Para ver o bot a ligar na nuvem:
   `docker logs lnsotech-backend --tail 30`

---

> [!IMPORTANT]
> **Aviso Contabo:** Se a sua VPS tiver um Nginx nativo, deve pará-lo com `systemctl stop nginx` para que o Docker possa usar o Porto 80.

---

*Gerado para LNSOTECH Automation CRM - 2026*
