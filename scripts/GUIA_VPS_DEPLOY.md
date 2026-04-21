# 🚀 Guia de Envio para VPS (Eco-Sistema LNSOTECH)

Este guia cobre o processo de levar as suas alterações locais (Tutorial e Configurações) para o servidor de produção na Contabo.

## 1. Preparação Local (O que já fez)

Você já realizou o commit das alterações. O próximo passo é enviar para o repositório central que o seu servidor utiliza.

```powershell
# Sincronizar com o repositório remoto
git push origin main
```

---

## 2. No Servidor (VPS)

Siga estes passos via SSH para atualizar a produção:

### Aceder ao Servidor

```bash
ssh root@seu_ip_contabo
cd /home/lnsotech-automation  # Ou a pasta onde o projeto está instalado
```

### Atualizar o Código

```bash
git pull origin main
```

### Reiniciar os Contentores (Build de Produção)

Para aplicar as mudanças no frontend e backend:

```bash
# Otimizado: reconstrói e reinicia em segundo plano
docker-compose up -d --build
```

---

## 3. Verificação de Saúde

Após o deploy, é vital verificar se o Bot e a Interface estão a funcionar:

1. **Logs do Bot:** Verifique se não há erros na ligação inicial.
   `docker logs lnsotech-backend --tail 50 -f`
2. **Interface Web:** Abra o seu domínio, aceda a **Configurações** e verifique as novas sub-abas.
3. **Tutorial:** O tour deve iniciar automaticamente para novos logins ou ser reiniciado nas configurações.

---

## 🛠️ Resolução de problemas na VPS

| Problema                         | Solução                                                                                                                                   |
|:-------------------------------- |:----------------------------------------------------------------------------------------------------------------------------------------- |
| **Mudanças não aparecem**        | Pode ser cache do Nginx/Browser. Execute `docker-compose down` e `docker-compose up -d --build` para limpar volumes temporários de build. |
| **Erro de Permissão**            | Se o `git pull` falhar, verifique se está como `root` ou use `sudo`.                                                                      |
| **Frontend não liga ao Backend** | Verifique se o seu `.env` na VPS tem o `NODE_ENV=production` correto.                                                                     |

---

> [!IMPORTANT]
> **Backup Automático:** Antes de qualquer `docker-compose down`, o sistema está configurado para tentar um dump da base de dados. Verifique a pasta `backups/` se necessário.
