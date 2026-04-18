# 📖 Guia de Commits: Controlo e Segurança Local

Este guia explica como usar o Git para guardar o seu trabalho localmente e ter o controlo total antes de enviar para a VPS.

---

## 1. O Ciclo Local (Trabalho em Progresso)
Pode fazer quantos commits quiser no seu computador. Eles funcionam como "pontos de restauro" (save points). Enquanto não fizer "Push", nada sai do seu PC.

*   **Adicionar alterações:** `git add .`
*   **Guardar no PC:** `git commit -m "Sua mensagem aqui"`

---

## 2. Como "Voltar Atrás" (Rollback Local)
Se cometer um erro e quiser desfazer o último commit antes de o enviar para a nuvem:

### A. Reset Macio (Soft Reset)
Mantém o código que escreveu, mas "desfaz" o commit para que possa corrigir algo.
```powershell
git reset --soft HEAD~1
```

### B. Reset Duro (Hard Reset) - CUIDADO
Apaga totalmente as últimas alterações e volta exatamente ao estado do commit anterior.
```powershell
git reset --hard HEAD~1
```

---

## 3. Diferença Crítica: Commit vs Push

| Ação | Onde grava? | Afeta a VPS? |
| :--- | :--- | :--- |
| **Commit** | Apenas no seu Computador | **NÃO** |
| **Push** | GitHub e VPS Contabo | **SIM** |

---

## 4. O Fluxo Recomendado
1. **Escreva Código.**
2. **Faça Commit Local** (Guarde o progresso).
3. **Valide Localmente** (Use o Passo 2 do Guia de Deploy).
4. **Tudo OK?** Faça `git push origin main`.
5. **Erro detetado?** Faça `git reset` e corrija.

---
**Mensagens de Commit Úteis:**
*   `feat: ...` (Para novas funcionalidades)
*   `fix: ...` (Para correção de erros)
*   `docs: ...` (Para mudanças na documentação)

---
*Gerado para LNSOTECH Automation CRM - 2026*
