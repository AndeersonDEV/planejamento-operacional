import { useState } from "react";
import { X, Copy, Check, FileCode, Server, Database, Sparkles } from "lucide-react";
import { Capacidade } from "../types";

interface ExportPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: Capacidade[];
}

export default function ExportPromptModal({ isOpen, onClose, currentData }: ExportPromptModalProps) {
  const [activeTab, setActiveTab] = useState<"ai-prompt" | "db-schema" | "api-routes" | "json-payload">("ai-prompt");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // 1. Generate full AI Prompt
  const fullAiPrompt = `Instruções para Criação do Backend de Capacidades Logísticas

Preciso criar um backend robusto em ambiente de produção para suportar uma aplicação de monitoramento de capacidades logísticas (Inbound e Outbound). Seguem as especificações detalhadas do banco de dados, rotas de API, regras de negócio e a massa de dados atualizada.

---

### 1. MODELAGEM DO BANCO DE DADOS (PostgreSQL ou equivalente Relacional)
Crie uma tabela chamada \`capacidades\` com as seguintes colunas e tipos:

\`\`\`sql
CREATE TABLE capacidades (
    id SERIAL PRIMARY KEY,
    data_movimentacao DATE NOT NULL,
    cd INTEGER NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    capacidade_inbound INTEGER NULL,
    capacidade_outbound_fracionado INTEGER NULL,
    capacidade_outbound_fechado INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices recomendados para otimização de filtros frequentes:
CREATE INDEX idx_capacidades_cd_data ON capacidades(cd, data_movimentacao);
CREATE INDEX idx_capacidades_categoria ON capacidades(categoria);
\`\`\`

---

### 2. ENDPOINTS DA API REST
A API deve escutar no endereço \`http://localhost:8080\` ou variável de ambiente correspondente e conter as seguintes rotas protegidas ou públicas:

#### A. GET /api/capacidades
- **Objetivo**: Retornar todas as capacidades filtradas opcionalmente por \`cd\` (Centro de Distribuição), \`categoria\` ou \`mes\` (YYYY-MM).
- **Formato do Retorno (JSON)**:
\`\`\`json
[
  {
    "id": 1,
    "dataMovimentacao": "2026-07-01",
    "cd": 101,
    "categoria": "Alimentos Secos",
    "capacidadeInbound": 120000,
    "capacidadeOutboundFracionado": 150000,
    "capacidadeOutboundFechado": 85000
  }
]
\`\`\`

#### B. PUT /api/capacidades/:id
- **Objetivo**: Atualizar as capacidades de um registro específico (Inbound por dia ou Outbound por mês).
- **Corpo da Requisição (JSON)**:
\`\`\`json
{
  "capacidadeInbound": 130000,
  "capacidadeOutboundFracionado": 160000,
  "capacidadeOutboundFechado": 90000
}
\`\`\`
- **Retorno (JSON)**: Confirmação de atualização e o objeto modificado.

---

### 3. EXTRAS DE DESENVOLVIMENTO
- **CORS**: Habilitar CORS para permitir requisições vindas do endereço do frontend.
- **Tratamento de Nulos**: Se as capacidades forem alteradas ou vierem nulas do ERP, garantir que o JSON retorne \`null\` ou zero de forma amigável ao frontend.

---

### 4. CARGA INICIAL DE DADOS (Payload JSON Atualizado do Sistema)
Aqui está o JSON atualizado que você deve carregar como semente ou banco de dados inicial (seed):

\`\`\`json
${JSON.stringify(currentData, null, 2)}
\`\`\`

---

Por favor, gere o código completo do backend utilizando a stack de sua escolha (Node.js/Express, Python/FastAPI ou Java/Spring Boot), incluindo a conexão com o banco de dados PostgreSQL e os endpoints configurados conforme acima.`;

  // 2. Generate database schemas documentation
  const dbSchemaCode = `--- SQL SCHEMA ---
CREATE TABLE capacidades (
    id SERIAL PRIMARY KEY,
    data_movimentacao DATE NOT NULL,
    cd INTEGER NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    capacidade_inbound INTEGER DEFAULT NULL,
    capacidade_outbound_fracionado INTEGER DEFAULT NULL,
    capacidade_outbound_fechado INTEGER DEFAULT NULL
);

-- Carga inicial de dados de exemplo
INSERT INTO capacidades (data_movimentacao, cd, categoria, capacidade_inbound, capacidade_outbound_fracionado, capacidade_outbound_fechado) VALUES
('2026-07-01', 101, 'Alimentos Secos', 120000, 150000, 85000),
('2026-06-01', 101, 'Alimentos Secos', 110000, 155000, 80000),
('2026-06-02', 101, 'Alimentos Secos', 115000, 155000, 82000);`;

  // 3. API endpoints overview
  const apiRoutesCode = `--- ROTAS EXPOSTAS (Node.js/Express exemplo) ---

// GET: Retorna lista de capacidades
app.get('/api/capacidades', async (req, res) => {
    try {
        const result = await db.query('SELECT id, data_movimentacao as "dataMovimentacao", cd, categoria, capacidade_inbound as "capacidadeInbound", capacidade_outbound_fracionado as "capacidadeOutboundFracionado", capacidade_outbound_fechado as "capacidadeOutboundFechado" FROM capacidades ORDER BY data_movimentacao ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar dados" });
    }
});

// PUT: Atualiza um registro por ID
app.put('/api/capacidades/:id', async (req, res) => {
    const { id } = req.params;
    const { capacidadeInbound, capacidadeOutboundFracionado, capacidadeOutboundFechado } = req.body;
    try {
        await db.query(
            'UPDATE capacidades SET capacidade_inbound = $1, capacidade_outbound_fracionado = $2, capacidade_outbound_fechado = $3 WHERE id = $4',
            [capacidadeInbound, capacidadeOutboundFracionado, capacidadeOutboundFechado, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao atualizar registro" });
    }
});`;

  const getCopyContent = () => {
    switch (activeTab) {
      case "ai-prompt":
        return fullAiPrompt;
      case "db-schema":
        return dbSchemaCode;
      case "api-routes":
        return apiRoutesCode;
      case "json-payload":
        return JSON.stringify(currentData, null, 2);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCopyContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white leading-tight">
                Exportar Dados & Guia de Integração
              </h2>
              <p className="text-xs text-slate-400">
                Gere prompts e estruturas completas para alimentar outras IAs no desenvolvimento do seu backend
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 bg-slate-950/40 border-b border-slate-800/80 flex gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab("ai-prompt")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeTab === "ai-prompt"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Prompt IAs Auxiliares (Completo)
          </button>
          <button
            onClick={() => setActiveTab("db-schema")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "db-schema"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Estrutura do Banco SQL
          </button>
          <button
            onClick={() => setActiveTab("api-routes")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "api-routes"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Rotas API
          </button>
          <button
            onClick={() => setActiveTab("json-payload")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "json-payload"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            JSON de Dados Atual
          </button>
        </div>

        {/* Modal Code/Prompt View */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 font-mono text-sm leading-relaxed text-slate-300">
          {activeTab === "ai-prompt" && (
            <div className="whitespace-pre-wrap select-text selection:bg-blue-500/30">
              <div className="bg-blue-950/20 border border-blue-900/30 text-blue-400 p-4 rounded-xl mb-4 leading-normal font-sans text-xs">
                💡 <strong>Dica do Engenheiro:</strong> Este prompt foi gerado dinamicamente incluindo todas as alterações feitas na tabela durante sua sessão. Copie e envie para o ChatGPT, Claude ou outra IA para gerar o servidor de produção correspondente em segundos!
              </div>
              {fullAiPrompt}
            </div>
          )}

          {activeTab === "db-schema" && (
            <pre className="whitespace-pre-wrap select-text text-indigo-300">
              {dbSchemaCode}
            </pre>
          )}

          {activeTab === "api-routes" && (
            <pre className="whitespace-pre-wrap select-text text-sky-300">
              {apiRoutesCode}
            </pre>
          )}

          {activeTab === "json-payload" && (
            <pre className="whitespace-pre-wrap select-text text-emerald-300 text-xs">
              {JSON.stringify(currentData, null, 2)}
            </pre>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-sans">
            Massa de dados atualizada com <strong>{currentData.length} registros</strong>.
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all"
            >
              Fechar
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-500/15 flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Conteúdo
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
