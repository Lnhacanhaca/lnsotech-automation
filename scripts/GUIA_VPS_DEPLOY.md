# 🚀 Guia de Envio para VPS (Eco-Sistema LNSOTECH)

Este guia cobre o processo de levar as suas alterações locais (Tutorial e Configurações) para o servidor de produção na Contabo.

## 1. Preparação Local
Você já realizou o commit das alterações. O próximo passo é enviar para o GitHub:

```powershell
# Sincronizar com o repositório remoto
git push origin main
```

---

## 2. No Servidor (VPS)
Siga estes passos via SSH para atualizar a produção com segurança:

### Aceder ao Servidor
```bash
ssh root@seu_ip_contabo
cd /opt/apps/bot/lnsotech-automation  # Nova localização confirmada
```

### Sincronização Forçada (Evita erros de divergência)
Se o `git pull` falhar, use estes comandos para forçar a VPS a ficar igual ao GitHub:
```bash
git fetch origin main
git reset --hard origin/main
```

### Reiniciar os Contentores (Docker V2)
Utilize o comando sem hífen (padrão moderno):
```bash
# Reconstrói e reinicia em segundo plano
docker compose up -d --build
```

---

## 3. Verificação de Saúde
Após o deploy, verifique se tudo está operacional:

1.  **Logs do Bot:** Verifique a ligação do WhatsApp.
    `docker compose logs lnsotech-backend --tail 50 -f`
2.  **Interface Web:** Abra o seu domínio, aceda a **Configurações** e teste as sub-abas.
3.  **Tutorial:** Verifique se as novas instruções do tour aparecem.

---

## 🛠️ Resolução de problemas na VPS

| Problema | Solução |
| :--- | :--- |
| **Comando não encontrado** | Use `docker compose` (espaço) em vez de `docker-compose` (hífen). |
| **Mudanças não aparecem** | Limpe a cache do browser (Ctrl+F5) ou use uma janela anónima. |
| **Base de Dados** | Se o banco de dados não iniciar, verifique com `docker ps`. |

---
> [!IMPORTANT]
> **Backup Automático:** Antes de qualquer `docker-compose down`, o sistema está configurado para tentar um dump da base de dados. Verifique a pasta `backups/` se necessário.
