# Secret Vault

Sistema web para armazenamento seguro de segredos (senhas, API Keys, tokens, certificados e credenciais) com foco em criptografia, versionamento, auditoria e ciclo de vida dos segredos.

---

# Objetivo

O objetivo deste projeto é demonstrar conhecimentos em:

* Criptografia aplicada
* Arquitetura backend
* Segurança de aplicações
* Modelagem de banco de dados
* Gestão de segredos
* Auditoria e rastreabilidade
* PostgreSQL
* Desenvolvimento web com Go

O objetivo **não é demonstrar autenticação**.

A autenticação existirá apenas para permitir o uso da aplicação.

---

# Fora do Escopo

Os seguintes tópicos não fazem parte dos objetivos principais:

* OAuth
* OpenID Connect
* MFA
* Social Login
* JWT complexo
* Refresh Tokens
* SSO
* Gestão avançada de usuários
* Controle granular de permissões

Esses temas já são abordados pelo projeto Secure Auth Platform.

---

# Escopo do Produto

O sistema deve permitir:

* Criar segredos
* Armazenar segredos criptografados
* Consultar segredos
* Atualizar segredos
* Versionar segredos
* Expirar segredos
* Revogar segredos
* Auditar acessos e alterações

---

# Stack Tecnológica

## Frontend

* React (Vite)
* React Router
* TypeScript
* Tailwind CSS

## Backend

* Go
* Chi Router
* PostgreSQL

## Infraestrutura

* Docker
* Docker Compose

---

# Arquitetura

```text
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   API Go    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │
└─────────────┘
```

---

# Fase 1 - Estrutura Inicial

## Objetivo

Preparar a base do projeto.

## Entregas

* Docker Compose
* API Go
* Frontend React (Vite)
* PostgreSQL
* Sistema de migrações

## Critério de Conclusão

Aplicação executando localmente via Docker.

---

# Fase 2 - Autenticação Mínima

## Objetivo

Permitir acesso à aplicação sem desviar o foco do projeto.

## Implementação

Credenciais definidas via variáveis de ambiente:

```env
ADMIN_USER=admin
ADMIN_PASSWORD=senha_forte
```

## Fluxo

```text
Login
  ↓
Cookie de Sessão
  ↓
Acesso ao Vault
```

## Observação

A autenticação deve permanecer simples durante todo o projeto.

Qualquer melhoria futura relacionada a autenticação deve ser implementada no Secure Auth Platform, não neste projeto.

---

# Fase 3 - Criptografia dos Segredos

## Objetivo

Garantir que nenhum segredo seja armazenado em texto puro.

## Implementação

Utilizar:

```text
AES-256-GCM
```

## Fluxo

```text
Segredo
   ↓
Criptografar
   ↓
Salvar no Banco
```

Ao consultar:

```text
Banco
   ↓
Descriptografar
   ↓
Exibir ao Usuário
```

## Requisitos

Nunca armazenar:

```text
senha123
```

Armazenar apenas:

```text
ciphertext
nonce
```

---

# Fase 4 - Gestão de Segredos

## Objetivo

Criar o núcleo funcional do sistema.

## Campos

```text
Nome
Descrição
Categoria
Status
Data de Expiração
Data de Criação
Data de Atualização
```

## Exemplos

```text
DATABASE_PASSWORD

JWT_SECRET

SMTP_PASSWORD

STRIPE_API_KEY

AWS_ACCESS_KEY
```

## Funcionalidades

* Criar segredo
* Listar segredos
* Consultar segredo
* Atualizar segredo
* Revogar segredo

---

# Fase 5 - Versionamento

## Objetivo

Permitir histórico completo das alterações.

## Exemplo

```text
DATABASE_PASSWORD

v1
v2
v3
v4
```

## Funcionalidades

* Histórico de versões
* Consulta de versões
* Restauração de versão anterior

## Regra

O valor do segredo não deve ser exibido no histórico.

---

# Fase 6 - Auditoria

## Objetivo

Registrar todos os eventos relevantes.

## Eventos

```text
CREATE_SECRET
READ_SECRET
UPDATE_SECRET
REVOKE_SECRET
RESTORE_VERSION
```

## Exemplo

```text
2026-07-15 10:31

READ_SECRET

DATABASE_PASSWORD
```

## Regras

Registrar:

* Evento
* Data/Hora
* Segredo afetado

Nunca registrar:

* Conteúdo do segredo

---

# Fase 7 - Expiração

## Objetivo

Gerenciar validade dos segredos.

## Campos

```text
expires_at
```

## Funcionalidades

* Definir expiração
* Identificar expirados
* Identificar próximos do vencimento

## Dashboard

```text
Expirados: 3

Expiram em 7 dias: 5

Expiram em 30 dias: 12
```

---

# Fase 8 - Revogação

## Objetivo

Desativar segredos sem perder histórico.

## Estados

```text
ATIVO

REVOGADO

EXPIRADO
```

## Benefícios

* Preservação de auditoria
* Recuperação de contexto histórico
* Maior rastreabilidade

---

# Fase 9 - Dashboard

## Objetivo

Fornecer visão geral do Vault.

## Indicadores

* Total de segredos
* Segredos ativos
* Segredos revogados
* Segredos expirados
* Últimos acessos
* Últimas alterações

---

# Modelagem de Banco

## Tabela secrets

```sql
id UUID
name VARCHAR
description TEXT
status VARCHAR
expires_at TIMESTAMP
current_version_id UUID
created_at TIMESTAMP
updated_at TIMESTAMP
```

Representa a entidade principal.

---

## Tabela secret_versions

```sql
id UUID
secret_id UUID
version INTEGER
encrypted_value TEXT
nonce TEXT
created_at TIMESTAMP
```

Armazena todas as versões criptografadas.

---

## Tabela audit_logs

```sql
id UUID
event_type VARCHAR
secret_id UUID
created_at TIMESTAMP
metadata JSONB
```

Armazena eventos de auditoria.

---

---

# Cobertura de Testes Frontend

Para garantir o correto funcionamento e a integridade da interface, o frontend conterá testes de componente/integração usando Vitest.

## Escopo dos Testes (Vitest)
* **Fluxo de Autenticação**: Renderização de login, erro ao digitar dados inválidos e chamada à API.
* **Ciclo de Vida do Segredo**: Criação de segredo por meio do formulário do modal.
* **Dashboard**: Validação das métricas e contadores exibidos de acordo com as propriedades fornecidas.


