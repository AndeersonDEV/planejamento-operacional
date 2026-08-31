# Manual de Integração e Guia de Desenvolvimento do Backend

Este documento serve como guia completo para o desenvolvimento do backend de suporte ao **Portal de Planejamento de Capacidades Logísticas**. Contém todos os detalhes de rotas, payloads, regras de negócio e estrutura do banco de dados para que outro desenvolvedor ou agente de Inteligência Artificial possa construir as conexões e edições sem qualquer ambiguidade.

---

## 1. Visão Geral da Arquitetura

O frontend é uma Single Page Application (SPA) construída em **React 18** + **Vite** + **Tailwind CSS**. Atualmente, ele gerencia as seguintes funcionalidades críticas:
*   **Controle de Acesso Simulador**: Cadastro e login de usuários salvos no `localStorage` por motivos de prototipagem, distinguindo perfis de **Administrador (admin)** e **Operador Padrão (user)**.
*   **Controle de Capacidades Logísticas**: Exibição hierárquica temporal de dados divididos por Centro de Distribuição (CD), Categoria de Mercadoria, Mês, Semana e Dia.
*   **Edição Inbound (Diária)**: Edição pontual e diária de capacidades para administradores.
*   **Edição Outbound (Mensal/Cascata)**: Atualização em massa para o mês inteiro (com propagação em cascata para todos os dias do respectivo mês).

Para tornar a aplicação 100% de produção, o backend deve substituir as persistências locais (`localStorage`) e expor endpoints REST consistentes.

---

## 2. Banco de Dados Sugerido (PostgreSQL / MySQL)

### Tabela 1: `usuarios` (Users)
Armazena as credenciais e níveis de privilégio.

```sql
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin' ou 'user'
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela 2: `capacidades` (Capacities)
Registros de movimentação e metas diárias de volumes por Centro de Distribuição e Categoria.

```sql
CREATE TABLE capacidades (
    id SERIAL PRIMARY KEY,
    cd VARCHAR(50) NOT NULL,                    -- Ex: '1965'
    categoria VARCHAR(100) NOT NULL,           -- Ex: 'ELETRO', 'MOVEIS', 'MODA'
    data_movimentacao DATE NOT NULL,           -- Campo crítico (ex: '2026-07-01')
    capacidade_inbound INT NOT NULL DEFAULT 0, -- Volume limite Inbound
    capacidade_outbound_fracionado INT NOT NULL DEFAULT 0,
    capacidade_outbound_fechado INT NOT NULL DEFAULT 0,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 3. Endpoints da API REST

Abaixo estão descritos todos os contratos de API que o frontend espera consumir.

### 3.1. Autenticação e Registro

#### A. Login de Usuário
*   **Rota**: `POST /api/auth/login`
*   **Acesso**: Público
*   **Payload de Envio (JSON)**:
    ```json
    {
      "username": "anderson",
      "password": "123"
    }
    ```
*   **Resposta de Sucesso (200 OK)**:
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": 1,
        "name": "Anderson Silva",
        "username": "anderson",
        "email": "anderson@empresa.com",
        "role": "admin"
      }
    }
    ```

#### B. Registro de Novo Usuário (Nome, Email, Senha, Role)
*   **Rota**: `POST /api/auth/register`
*   **Acesso**: Público / Restrito (A critério de TI, no frontend qualquer usuário pode simular o registro)
*   **Payload de Envio (JSON)**:
    ```json
    {
      "name": "Leonardo Marques",
      "email": "leonardo@empresa.com",
      "username": "leonardo.marques",
      "password": "suasenhaforte",
      "role": "user" -- Ou "admin"
    }
    ```
*   **Resposta de Sucesso (201 Created)**:
    ```json
    {
      "success": true,
      "message": "Usuário cadastrado com sucesso!",
      "user": {
        "id": 12,
        "name": "Leonardo Marques",
        "email": "leonardo@empresa.com",
        "username": "leonardo.marques",
        "role": "user"
      }
    }
    ```

---

### 3.2. Gestão de Capacidades Logísticas

O frontend mapeia dinamicamente a hierarquia a partir de uma lista plana de dados diários.

#### A. Listagem Geral de Capacidades
*   **Rota**: `GET /api/capacidades`
*   **Acesso**: Autenticado (Bearer Token)
*   **Parâmetros de Filtro opcionais**: `?cd=all&mes=all&categoria=all`
*   **Resposta de Sucesso (200 OK)**:
    ```json
    [
      {
        "id": "1",
        "cd": "1965",
        "categoria": "ELETRO",
        "dataMovimentacao": "2026-07-01",
        "capacidadeInbound": 120000,
        "capacidadeOutboundFracionado": 155000,
        "capacidadeOutboundFechado": 95000
      },
      {
        "id": "2",
        "cd": "1965",
        "categoria": "ELETRO",
        "dataMovimentacao": "2026-07-02",
        "capacidadeInbound": 120000,
        "capacidadeOutboundFracionado": 155000,
        "capacidadeOutboundFechado": 95000
      }
    ]
    ```

#### B. Atualização de Capacidade por ID (Edição Diária - Inbound)
*   **Rota**: `PUT /api/capacidades/:id`
*   **Acesso**: Restrito a perfil `admin`
*   **Payload de Envio (JSON)**:
    ```json
    {
      "capacidadeInbound": 135000
    }
    ```
*   **Resposta de Sucesso (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Capacidade atualizada com sucesso!",
      "data": {
        "id": "1",
        "capacidadeInbound": 135000
      }
    }
    ```

#### C. Atualização Mensal em Cascata (Edição Outbound)
Quando alterado o volume mensal no frontend, o backend deve atualizar **todos os dias correspondentes àquele mês** para aquele CD/Categoria.
*   **Rota**: `PUT /api/capacidades/cascade-monthly`
*   **Acesso**: Restrito a perfil `admin`
*   **Payload de Envio (JSON)**:
    ```json
    {
      "month": "2026-07", -- Mês referência no formato YYYY-MM
      "cd": "1965",
      "categoria": "ELETRO",
      "capacidadeOutboundFracionado": 160000,
      "capacidadeOutboundFechado": 105000
    }
    ```
*   **Lógica do Backend**:
    ```sql
    UPDATE capacidades 
    SET capacidade_outbound_fracionado = 160000, 
        capacidade_outbound_fechado = 105000 
    WHERE cd = '1965' 
      AND categoria = 'ELETRO' 
      AND TO_CHAR(data_movimentacao, 'YYYY-MM') = '2026-07';
    ```
*   **Resposta de Sucesso (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Capacidades do mês 2026-07 atualizadas em cascata com sucesso!",
      "recordsUpdated": 31
    }
    ```

---

## 4. Como o Frontend está Estruturado para Integração

No arquivo `/src/App.tsx`, as seguintes funções estão prontas para serem conectadas aos seus endpoints reais:

1.  **`fetchCapacidades()`**: Atualmente faz um fetch simulado que monta a hierarquia temporal (Mês -> Semana -> Dia) dinamicamente. Para conectar com a API real, basta substituir o mock pelo seu endpoint `GET /api/capacidades`.
2.  **`handleSaveCapacity(id, value)`**: Chamada ao clicar em salvar no modal. Substituir pelo seu `PUT /api/capacidades/:id` para persistência real.
3.  **`handleResetData()`**: Usado para fins de teste no frontend. Pode ser removido ou transformado em um reset do seed do banco de dados.

## 5. Próximos Passos recomendados para Conexão
1.  **CORS**: Certifique-se de habilitar o CORS no seu backend Node/Express ou Java Spring Boot para aceitar conexões provenientes da URL de desenvolvimento do frontend.
2.  **Segurança**: Implemente autenticação baseada em tokens JWT nas rotas `/api/capacidades` e verifique se o usuário possui a propriedade `role === "admin"` para as rotas com método `PUT`.
