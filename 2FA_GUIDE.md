# 🔐 Guia Técnico: Autenticação de Dois Fatores (2FA)

Este documento explica o funcionamento da segurança 2FA implementada no sistema **LNSOTECH Automation**, utilizando o padrão **TOTP** (Time-based One-Time Password).

---

## 📖 O que é 2FA?

A Autenticação de Dois Fatores (2FA) é um método de segurança que exige que o utilizador forneça duas formas diferentes de identificação antes de aceder à conta:
1.  **Algo que você sabe:** A sua palavra-passe.
2.  **Algo que você tem:** Um código gerado dinamicamente no seu telemóvel.

---

## 🛠️ Funcionamento Técnico (Algoritmo TOTP)

O sistema utiliza o padrão **RFC 6238**, conhecido como TOTP. O segredo da sua segurança baseia-se na sincronização entre o servidor e o seu dispositivo móvel.

### 1. Fase de Configuração (Setup)
Quando ativa o 2FA:
*   **Geração do Secret:** O servidor gera uma chave alfanumérica única (ex: `K5XW 6Y3B MNSX...`).
*   **QR Code:** Esta chave é codificada num QR Code. Ao lê-lo com um app (Google Authenticator), o telemóvel armazena o segredo localmente.
*   **Base de Dados:** O servidor guarda o segredo cifrado no perfil do utilizador.

### 2. Geração do Código
A cada 30 segundos, tanto o seu telemóvel quanto o servidor calculam um novo código de 6 dígitos usando:
*   🔑 **O Segredo Guardado**
*   🕒 **A Hora Atual** (dividida em blocos de 30 segundos)

Como ambos têm a mesma "fórmula" e a mesma "chave", o número gerado será idêntico.

---

## 🚀 Fluxo de Login

1.  **Credenciais:** O utilizador insere o email e a senha.
2.  **Desafio 2FA:** Se o 2FA estiver ativo, o servidor solicita o código de 6 dígitos.
3.  **Validação:**
    *   O utilizador abre o app e digita o código (ex: `123456`).
    *   O servidor recebe o código e executa uma verificação síncrona (`verifySync`).
4.  **Acesso:** Se o código bater, um Token JWT de acesso total é emitido.

---

## 🛡️ Benefícios de Segurança

*   **Proteção contra Phishing:** Mesmo que a senha seja roubada, o atacante precisaria de posse física do seu telemóvel para entrar.
*   **Segurança Offline:** O código é gerado pelo telemóvel sem necessidade de internet, evitando interceções de rede.
*   **Anti-Brute Force:** Como o código muda a cada 30 segundos, é matematicamente impossível adivinhar o código a tempo.

---

## 💻 Implementação no Projeto

A lógica principal encontra-se nos seguintes ficheiros:
- `backend/src/services/TwoFactorService.js`: Gerador de segredos e validador de tokens.
- `backend/src/controllers/AuthController.js`: Gere as rotas de ativação e verificação.

> [!TIP]
> **Dica de Segurança:** Nunca partilhe o seu segredo 2FA com ninguém. Em caso de perda do telemóvel, o acesso só poderá ser recuperado por um administrador do sistema.
