import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Check, 
  XCircle, 
  Users, 
  RefreshCw, 
  AlertCircle, 
  Building2, 
  Mail,
  ShieldAlert,
  ArrowLeft,
  Search,
  UserCheck,
  Shield,
  Clock,
  Sliders,
  UserCog,
  ToggleLeft,
  ToggleRight,
  Download
} from "lucide-react";
import { User } from "../types";

interface UserControlPageProps {
  user: User | null;
  theme: "light" | "dark";
  onBack: () => void;
}

interface RegistrationUser {
  id: number;
  login: number | string;
  name: string;
  email: string;
  password?: string;
  status: string;
  role?: string;
}

export default function UserControlPage({ user, theme, onBack }: UserControlPageProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "users">("pending");
  const [pendingUsers, setPendingUsers] = useState<RegistrationUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<RegistrationUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Track selected roles for users in dropdowns
  const [selectedRoles, setSelectedRoles] = useState<Record<number, "ADM" | "PPCP" | "GA">>({});

  // Fallback Demo Mode state for local preview environments
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem("user_control_demo_mode") === "true";
  });

  const initialMockUsers = useMemo<RegistrationUser[]>(() => [
    { id: 101, login: 43210, name: "Carlos Henrique Silva", email: "carlos.silva@empresa.com.br", status: "PENDENTE", role: "GA" },
    { id: 102, login: 98765, name: "Ana Beatriz Santos", email: "ana.santos@empresa.com.br", status: "PENDENTE", role: "PPCP" },
    { id: 103, login: 11223, name: "Diego Oliveira", email: "diego.oliveira@empresa.com.br", status: "PENDENTE", role: "GA" },
    { id: 201, login: 12345, name: "Administrador Geral", email: "admin@empresa.com.br", status: "APROVADO", role: "ADM" },
    { id: 202, login: 55443, name: "Juliana Ferreira", email: "juliana.ferreira@empresa.com.br", status: "APROVADO", role: "PPCP" },
    { id: 203, login: 66778, name: "Ricardo Souza", email: "ricardo.souza@empresa.com.br", status: "APROVADO", role: "GA" }
  ], []);

  const loadDemoData = useCallback(() => {
    const storedPending = localStorage.getItem("demo_pending_users");
    const storedApproved = localStorage.getItem("demo_approved_users");
    
    let pendingList: RegistrationUser[] = [];
    let approvedList: RegistrationUser[] = [];

    if (storedPending && storedApproved) {
      try {
        pendingList = JSON.parse(storedPending);
        approvedList = JSON.parse(storedApproved);
      } catch (e) {
        pendingList = initialMockUsers.filter(u => u.status === "PENDENTE");
        approvedList = initialMockUsers.filter(u => u.status === "APROVADO");
      }
    } else {
      pendingList = initialMockUsers.filter(u => u.status === "PENDENTE");
      approvedList = initialMockUsers.filter(u => u.status === "APROVADO");
      localStorage.setItem("demo_pending_users", JSON.stringify(pendingList));
      localStorage.setItem("demo_approved_users", JSON.stringify(approvedList));
    }

    setPendingUsers(pendingList);
    setApprovedUsers(approvedList);

    // Initialize roles state
    const rolesMap: Record<number, "ADM" | "PPCP" | "GA"> = {};
    [...pendingList, ...approvedList].forEach((u) => {
      let defaultRole: "ADM" | "PPCP" | "GA" = "GA";
      if (u.role) {
        const r = String(u.role).toUpperCase();
        if (r === "ADM" || r === "ADMIN") defaultRole = "ADM";
        else if (r === "PPCP") defaultRole = "PPCP";
      }
      rolesMap[u.id] = defaultRole;
    });
    setSelectedRoles(prev => ({ ...prev, ...rolesMap }));
  }, [initialMockUsers]);

  // Toggle demo mode manually if desired
  const handleToggleDemoMode = useCallback(() => {
    const nextVal = !isDemoMode;
    setIsDemoMode(nextVal);
    localStorage.setItem("user_control_demo_mode", String(nextVal));
    setSuccessMsg(`Modo ${nextVal ? "Simulado (Offline)" : "Conexão Real (API)"} ativado.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, [isDemoMode]);

  // ============================================
  // FETCH PENDING USERS - GET /registro
  // ============================================
  const fetchPendingUsers = useCallback(async () => {
    if (!user?.token) return;
    
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      await new Promise(resolve => setTimeout(resolve, 300));
      loadDemoData();
      setLoading(false);
      return;
    }
    
    try {
      console.log("📡 Buscando usuários PENDENTES em /registro...");
      const response = await fetch("/registro", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        const pending = data.filter((item: any) => 
          String(item.status).toUpperCase() === "PENDENTE"
        );
        setPendingUsers(pending);
        
        const rolesMap: Record<number, "ADM" | "PPCP" | "GA"> = {};
        pending.forEach((item: RegistrationUser) => {
          rolesMap[item.id] = "GA";
        });
        setSelectedRoles(prev => ({ ...prev, ...rolesMap }));
      }
    } catch (err: any) {
      console.error("❌ Erro ao carregar pendentes:", err);
      // Auto fallback to demo mode
      setIsDemoMode(true);
      localStorage.setItem("user_control_demo_mode", "true");
      loadDemoData();
      setError("⚠️ Modo de Demonstração Simulado ativado.");
    } finally {
      setLoading(false);
    }
  }, [user?.token, isDemoMode, loadDemoData]);

  // ============================================
  // FETCH APPROVED USERS - GET /registro/usuarios
  // ============================================
  const fetchApprovedUsers = useCallback(async () => {
    if (!user?.token) return;
    
    setLoadingUsers(true);
    setError(null);

    if (isDemoMode) {
      await new Promise(resolve => setTimeout(resolve, 300));
      loadDemoData();
      setLoadingUsers(false);
      return;
    }
    
    try {
      console.log("📡 Buscando usuários APROVADOS em /registro/usuarios...");
      const response = await fetch("/registro/usuarios", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setApprovedUsers(data);
        
        const rolesMap: Record<number, "ADM" | "PPCP" | "GA"> = {};
        data.forEach((item: RegistrationUser) => {
          let defaultRole: "ADM" | "PPCP" | "GA" = "GA";
          if (item.role) {
            const r = String(item.role).toUpperCase();
            if (r === "ADM" || r === "ADMIN") defaultRole = "ADM";
            else if (r === "PPCP") defaultRole = "PPCP";
          }
          rolesMap[item.id] = defaultRole;
        });
        setSelectedRoles(prev => ({ ...prev, ...rolesMap }));
      }
    } catch (err: any) {
      console.error("❌ Erro ao carregar aprovados:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [user?.token, isDemoMode, loadDemoData]);

  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchPendingUsers(),
      fetchApprovedUsers()
    ]);
  }, [fetchPendingUsers, fetchApprovedUsers]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchAllData();
    }
  }, [user, isDemoMode, fetchAllData]);

  // ============================================
  // UPDATE USER STATUS/ROLE - PUT /registro/{id}
  // ============================================
  const handleUpdateUser = useCallback(async (id: number, status: "APROVADO" | "RECUSADO" | "PENDENTE", customRole?: "ADM" | "PPCP" | "GA") => {
    if (!user?.token) {
      setError("Usuário não autenticado.");
      return;
    }
    
    setActionLoadingId(id);
    setError(null);
    setSuccessMsg(null);

    const role = customRole || selectedRoles[id] || "GA";

    if (isDemoMode) {
      await new Promise(resolve => setTimeout(resolve, 400));
      
      let pList: RegistrationUser[] = JSON.parse(localStorage.getItem("demo_pending_users") || "[]");
      let aList: RegistrationUser[] = JSON.parse(localStorage.getItem("demo_approved_users") || "[]");
      
      const target = [...pList, ...aList].find(u => u.id === id);
      
      if (target) {
        const updatedUser = { ...target, status, role };
        
        // Remove from both
        pList = pList.filter(u => u.id !== id);
        aList = aList.filter(u => u.id !== id);
        
        if (status === "PENDENTE") {
          pList.push(updatedUser);
        } else if (status === "APROVADO") {
          aList.push(updatedUser);
        }
        
        localStorage.setItem("demo_pending_users", JSON.stringify(pList));
        localStorage.setItem("demo_approved_users", JSON.stringify(aList));
      }

      setPendingUsers(pList);
      setApprovedUsers(aList);
      
      if (status === "APROVADO") {
        setSuccessMsg(`Sucesso: Usuário aprovado como ${role}.`);
      } else if (status === "RECUSADO") {
        setSuccessMsg(`Sucesso: Solicitação de cadastro recusada.`);
      } else {
        setSuccessMsg(`Sucesso: Usuário retornado para análise.`);
      }
      
      setActionLoadingId(null);
      setTimeout(() => setSuccessMsg(null), 3500);
      return;
    }

    try {
      const response = await fetch(`/registro/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({ status, role })
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`);
      }

      if (status === "APROVADO") {
        setSuccessMsg(`Usuário aprovado como ${role}.`);
      } else if (status === "RECUSADO") {
        setSuccessMsg(`Usuário recusado.`);
      } else {
        setSuccessMsg(`Usuário retornado para análise.`);
      }

      await fetchAllData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("❌ Erro ao salvar alterações:", err);
      setError(err.message || "Erro ao salvar alterações do usuário.");
    } finally {
      setActionLoadingId(null);
    }
  }, [user?.token, isDemoMode, selectedRoles, fetchAllData]);

  // ============================================
  // 🔥 [AJUSTE GROSSO - ENTERPRISE] GERAÇÃO DE MANUAL TÉCNICO COMPLETO DO PORTAL LOGÍSTICO GPA
  // ============================================
  // Função ultra performática e sem requisições de rede adicionais que compila
  // toda a documentação das regras de negócios, fórmulas de capacidade e catálogo de APIs
  // diretamente em memória do navegador e gera o download em formato HTML rico e limpo.
  // 🛠️ [Ajuste Fino] Função de download que gera em tempo real a documentação completa
  // 🛠️ de engenharia de software da aplicação front-end, das regras de negócios logísticos e do catálogo de APIs.
  // 🛠️ Este método utiliza a criação de um Blob em memória no navegador (Zero latência - Ultra performático).
  const handleDownloadDocumentation = useCallback(() => {
    const docHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GPA LOGÍSTICA - Manual Técnico & Documentação de Engenharia</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --secondary: #0f172a;
      --text: #334155;
      --light: #f8fafc;
      --border: #e2e8f0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: var(--text);
      line-height: 1.6;
      background-color: var(--light);
      margin: 0;
      padding: 0;
    }
    header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
      border-bottom: 4px solid var(--primary);
    }
    header h1 {
      margin: 0;
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    header p {
      margin: 10px 0 0 0;
      color: #94a3b8;
      font-size: 1.1rem;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
      margin-right: 6px;
    }
    .badge-get { background-color: #e0f2fe; color: #0369a1; }
    .badge-post { background-color: #dcfce7; color: #15803d; }
    .badge-put { background-color: #fef9c3; color: #a16207; }
    .container {
      max-width: 1100px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.02);
    }
    h2 {
      color: var(--secondary);
      font-size: 1.6rem;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h3 {
      color: #1e3a8a;
      font-size: 1.2rem;
      font-weight: 600;
      margin-top: 25px;
      margin-bottom: 12px;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background-color: #0f172a;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 12px;
      text-align: left;
      font-size: 0.9rem;
    }
    th {
      background-color: #f8fafc;
      font-weight: 700;
      color: var(--secondary);
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .footer {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      margin-top: 60px;
    }
  </style>
</head>
<body>

  <header>
    <h1>Manual Técnico e de Arquitetura de Software</h1>
    <p>Portal Corporativo de Logística GPA — Monitoramento de Metas e Capacidades</p>
  </header>

  <div class="container">

    <div class="card">
      <h2>📌 1. Visão Geral do Sistema</h2>
      <p>O <strong>Portal de Logística GPA</strong> é uma plataforma de alta performance desenvolvida para gerenciar as capacidades de processamento logístico (Inbound e Outbound) nos Centros de Distribuição (CDs) do Grupo. O sistema foi desenhado de forma resiliente, permitindo o planejamento de capacidades mensais e a análise em tempo real dos gargalos operacionais gerados pelo excesso de agendamentos frente às capacidades contratadas.</p>
    </div>

    <div class="card">
      <h2>⚙️ 2. Arquitetura do Front-End (React + TypeScript)</h2>
      <p>A aplicação foi construída sobre padrões modernos de desenvolvimento de software de nível corporativo:</p>
      <ul>
        <li><strong>Tecnologia Base:</strong> React 18, TypeScript, Tailwind CSS e Vite.</li>
        <li><strong>Gerenciamento de Sessão Seguro (Anti-Flickering):</strong> No primeiro acesso da sessão, o sistema força a limpeza do cache de credenciais do usuário e redireciona ao login para garantir que as credenciais mais frescas sejam utilizadas. Durante a navegação comum ou recarregamento (F5), o estado é preservado com restauração baseada em <code>localStorage</code> e <code>sessionStorage</code>.</li>
        <li><strong>Filtros e Visualização em Múltiplos Níveis:</strong> Permite filtrar por CD, Categoria do Fluxo, Mês e Semana do Mês de maneira memoizada com <code>useMemo</code>, reduzindo a sobrecarga de re-renderização no DOM virtual.</li>
        <li><strong>Suporte a Gráficos Complexos:</strong> Alimentado por <code>react-chartjs-2</code> e <code>Chart.js 4</code>, configurado com suporte a interações em múltiplos eixos (Click Drilldown), onde um clique em um elemento do gráfico filtra dinamicamente todos os KPIs e tabelas subsequentes da página.</li>
        <li><strong>Sincronização com Padrão SWR (Stale-While-Revalidate):</strong> Os componentes que dependem de dados remotos carregam instantaneamente os dados armazenados em cache global (in-memory) e, de forma não-bloqueante, efetuam chamadas à API em segundo plano para atualização rápida de tela.</li>
      </ul>
    </div>

    <div class="card">
      <h2>📊 3. Regras de Negócio e Fórmulas Logísticas</h2>
      <p>A inteligência analítica do portal fundamenta-se nos seguintes cálculos de produtividade e capacidade logística:</p>
      
      <h3>Cálculo de Desvio e Sobrecarga (Overload Matrix)</h3>
      <p>Determina se o volume de veículos agendados ultrapassa a capacidade física ou contratada do Centro de Distribuição.</p>
      <pre>Desvio = Agendado - Capacidade
Sobrecarga (%) = Se (Capacidade > 0) então: ((Agendado - Capacidade) / Capacidade) * 100, senão 0</pre>
      <p><strong>Ação no Gráfico:</strong> Se o desvio for positivo (<code>Agendado > Capacidade</code>), a linha do agendamento assume a cor vermelha de alerta (<code>#ef4444</code>) e as legendas indicam sobrecarga com a tag <code>🔴 Excesso!</code>.</p>

      <h3>Cálculo de Produtividade Útil (Média e Máximo Recebidos)</h3>
      <p>Para evitar distorções estatísticas decorrentes de feriados ou ausência de expedição aos finais de semana, os cartões de <strong>Média de Recebidos</strong> e <strong>Máximo Recebidos</strong> filtram e desconsideram sistematicamente sábados e domingos:</p>
      <pre>Dia Útil = Se (Dia_da_Semana é Sábado ou Domingo) então FALSO, senão VERDADEIRO
Média Recebido = Somatório(Recebido [em Dias Úteis]) / Quantidade_Dias_Úteis</pre>

      <h3>Índice de Falta (No-Show Logístico)</h3>
      <p>Mede a taxa de absenteísmo dos fornecedores agendados pelo sistema de agendamento integrado.</p>
      <pre>No-Show (%) = (Quantidade_NoShow / Agendas_no_Sistema) * 100</pre>
    </div>

    <div class="card">
      <h2>🔌 4. Catálogo Completo de APIs Integradas</h2>
      <p>O front-end comunica-se com a retaguarda do sistema através de chamadas HTTP padronizadas com envio obrigatório do token JWT no cabeçalho <code>Authorization: Bearer [token]</code>.</p>
      
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Método</th>
            <th>Autenticação</th>
            <th>Descrição / Retorno</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>/login</code></td>
            <td><span class="badge badge-post">POST</span></td>
            <td>Pública</td>
            <td>Efetua a autenticação do usuário. Retorna o perfil (<code>role</code>: ADM, PPCP ou GA), nome de usuário e token JWT para as chamadas subsequentes.</td>
          </tr>
          <tr>
            <td><code>/registro</code></td>
            <td><span class="badge badge-post">POST</span></td>
            <td>Pública</td>
            <td>Solicitação de primeiro acesso. Cria uma conta com status <code>PENDENTE</code> aguardando homologação do ADM.</td>
          </tr>
          <tr>
            <td><code>/registro</code></td>
            <td><span class="badge badge-get">GET</span></td>
            <td>Requerida (ADM)</td>
            <td>Lista todas as solicitações de usuários com status pendente de homologação.</td>
          </tr>
          <tr>
            <td><code>/registro/usuarios</code></td>
            <td><span class="badge badge-get">GET</span></td>
            <td>Requerida (ADM)</td>
            <td>Lista todos os usuários com perfis e privilégios ativos homologados no portal.</td>
          </tr>
          <tr>
            <td><code>/registro/:id</code></td>
            <td><span class="badge badge-put">PUT</span></td>
            <td>Requerida (ADM)</td>
            <td>Atualiza os privilégios do usuário (<code>role</code>) ou altera seu status de acesso (<code>APROVADO</code> ou <code>RECUSADO</code>).</td>
          </tr>
          <tr>
            <td><code>/api/Metas/Inbound</code></td>
            <td><span class="badge badge-get">GET</span></td>
            <td>Requerida</td>
            <td>Retorna as metas de inbound cadastradas agrupadas pelo mês selecionado.</td>
          </tr>
          <tr>
            <td><code>/api/Metas/Inbound</code></td>
            <td><span class="badge badge-post">POST</span></td>
            <td>Requerida (PPCP)</td>
            <td>Atualiza ou insere as metas de inbound da categoria no mês especificado.</td>
          </tr>
          <tr>
            <td><code>/api/Metas/Outbound</code></td>
            <td><span class="badge badge-get">GET</span></td>
            <td>Requerida</td>
            <td>Retorna as metas de outbound cadastradas agrupadas pelo mês selecionado.</td>
          </tr>
          <tr>
            <td><code>/api/Metas/Outbound</code></td>
            <td><span class="badge badge-post">POST</span></td>
            <td>Requerida (PPCP)</td>
            <td>Atualiza ou insere as metas de outbound no mês especificado.</td>
          </tr>
          <tr>
            <td><code>/api/dashboard/inbound</code></td>
            <td><span class="badge badge-get">GET</span></td>
            <td>Requerida</td>
            <td>Retorna os lançamentos agregados diários com volume programado, capacidade estipulada e realizado recebido.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>🛡️ 5. Matriz de Permissões (RBAC)</h2>
      <p>As rotas de front-end e recursos visuais são estritamente delimitados pelas regras de perfilamento abaixo:</p>
      <ul>
        <li><strong>ADM (Administrador):</strong> Acesso irrestrito a todas as páginas do sistema, inclusive à tela de Homologação e Controle de Usuários, com poder de veto e alteração de níveis de privilégio.</li>
        <li><strong>PPCP (Planejamento e Controle de Produção):</strong> Visualiza painéis de performance e possui permissão exclusiva de escrita nas telas de planejamento mensal (Inbound/Outbound Metas).</li>
        <li><strong>GA (Garantia de Abastecimento / Operação):</strong> Perfil estritamente operacional e de recepção. Visualiza apenas o painel de capacidades operacionais diárias. É bloqueado automaticamente de acessar o painel de Dashboards Analíticos de alto nível e Controle de Usuários.</li>
      </ul>
    </div>

    <div class="card">
      <h2>📈 6. Como os Gráficos Foram Desenvolvidos (Dashboard Analítico)</h2>
      <p>Os gráficos do dashboard foram projetados com foco em alta densidade de informação e performance operacional espacial ("Estilo NASA"):</p>
      <ul>
        <li><strong>Biblioteca Principal:</strong> Desenvolvidos utilizando <code>Chart.js 4</code> envelopado pelo wrapper React <code>react-chartjs-2</code> para montagem nativa e ágil no ciclo de vida do componente.</li>
        <li><strong>Filtros Bidirecionais e Drilldown Avançado:</strong> O usuário pode interagir diretamente com o gráfico (clicando em qualquer barra ou linha). O tratador de clique extrai o índice de dados selecionado (via <code>getElementAtEvent</code>) e aplica um filtro global de data. Isso redesenha imediatamente todos os cards de KPIs operacionais e a tabela de auditoria operacional abaixo em tempo real.</li>
        <li><strong>Data Labels e Customização Visual:</strong> Utiliza o plugin oficial <code>chartjs-plugin-datalabels</code> para renderizar as métricas de forma limpa diretamente sobre os elementos do gráfico (evitando poluição visual). Os rótulos de dados se auto-ajustam dinamicamente e aparecem ou ocultam automaticamente baseados no zoom ou drilldown atual.</li>
        <li><strong>Gargalos e Alertas em Tempo Real:</strong> A renderização computa em tempo real desvios e sobrecargas. Dias em situação de sobrecarga de capacidade recebem realces em vermelho de forma nativa e pulsante nos dados e tabelas.</li>
        <li><strong>Motor de Simulação What-If Acoplado:</strong> Integrado ao slider de capacidade de 0% a 100%, todos os conjuntos de dados de capacidade são recomputados em tempo de execução usando <code>useMemo</code> com zero delay, refletindo imediatamente as curvas simuladas no gráfico e alterando o status de desvios operacionais.</li>
      </ul>
      <p><em>Nota: No código fonte do arquivo <code>usuarios.tsx</code>, esta documentação é compilada dinamicamente via <code>Blob</code> em memória para um download instantâneo sem sobrecarregar a banda do servidor.</em></p>
    </div>

  </div>

  <div class="footer">
    <p>Manual Técnico Autogerado pelo Portal de Controle de Logística GPA.</p>
    <p>&copy; 2026 GPA Logística. Todos os direitos reservados.</p>
  </div>

</body>
</html>`;

    const blob = new Blob([docHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "GPA_LOGISTICA_MANUAL_TECNICO_ENGENHARIA.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setSuccessMsg("📘 Documentação Técnica baixada com sucesso! Abra o arquivo .html em seu navegador.");
    setTimeout(() => setSuccessMsg(null), 4000);
  }, []);

  // Filter computation - Memoized for optimal performance
  const currentTabUsers = useMemo(() => {
    return activeTab === "pending" ? pendingUsers : approvedUsers;
  }, [activeTab, pendingUsers, approvedUsers]);

  const isLoading = useMemo(() => {
    return activeTab === "pending" ? loading : loadingUsers;
  }, [activeTab, loading, loadingUsers]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return currentTabUsers;
    return currentTabUsers.filter(reg => 
      reg.name.toLowerCase().includes(term) ||
      String(reg.login).includes(term) ||
      reg.email.toLowerCase().includes(term)
    );
  }, [currentTabUsers, searchTerm]);

  // Unauthorised view
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className={`text-center p-8 rounded-2xl border max-w-md w-full backdrop-blur-sm transition-all ${
          theme === 'dark' ? 'bg-[#0a0f1d] border-red-500/15' : 'bg-white border-red-200'
        }`}>
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Acesso Restrito</h2>
          <p className="text-slate-500 mt-2 text-xs leading-relaxed">
            Área exclusiva de administradores para homologação e segurança de perfis.
          </p>
          <button
            onClick={onBack}
            className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Voltar para o Painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Mini Breadcrumb & Status indicators */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-medium text-slate-400">
        <button 
          onClick={onBack}
          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
            theme === 'dark' ? 'hover:text-white' : 'hover:text-slate-900'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao sistema</span>
        </button>

        <div className="flex items-center gap-4">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="font-mono text-[10px] uppercase">
              {isDemoMode ? "Simulador Offline" : "Conectado à API"}
            </span>
          </div>

          {/* Toggle Button for manual fallback test */}
          <button 
            onClick={handleToggleDemoMode}
            className="flex items-center gap-1 hover:text-blue-500 transition-colors text-[10px] font-semibold uppercase"
            title="Clique para alternar entre o simulador e o servidor real"
          >
            {isDemoMode ? <ToggleRight className="w-4 h-4 text-amber-400" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
            <span>Alternar Modo</span>
          </button>
        </div>
      </div>

      {/* Header and Sync Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Controle de Acessos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Aprovação e gerenciamento de perfis de operadores internos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadDocumentation}
            className={`py-2 px-3.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
              theme === 'dark'
                ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Manual Técnico</span>
          </button>

          <button
            onClick={fetchAllData}
            disabled={loading || loadingUsers}
            className={`py-2 px-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              theme === 'dark' 
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200' 
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || loadingUsers) ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 backdrop-blur-sm ${
          theme === 'dark' ? 'bg-rose-500/5 border-rose-500/10 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Nota de Conectividade:</span> {error}
          </div>
        </div>
      )}

      {successMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
          theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
        }`}>
          <Check className="w-4 h-4 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Segmented Control Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Navigation Tabs (Premium Segmented Control) */}
        <div className={`flex p-0.5 rounded-xl max-w-sm w-full ${
          theme === 'dark' ? 'bg-[#0f1423]' : 'bg-slate-100'
        }`}>
          <button
            onClick={() => {
              setActiveTab("pending");
              setSearchTerm("");
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "pending"
                ? theme === 'dark' 
                  ? "bg-white/10 text-white font-bold"
                  : "bg-white text-slate-900 font-bold shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendentes ({pendingUsers.length})</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab("users");
              setSearchTerm("");
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "users"
                ? theme === 'dark' 
                  ? "bg-white/10 text-white font-bold"
                  : "bg-white text-slate-900 font-bold shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Ativos ({approvedUsers.length})</span>
          </button>
        </div>

        {/* Filter input */}
        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 flex-1 max-w-xs ${
          theme === 'dark' ? 'bg-[#0a0f1d] border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full bg-transparent border-none text-xs focus:outline-none placeholder-slate-400 ${
              theme === 'dark' ? 'text-white' : 'text-slate-800'
            }`}
          />
        </div>
      </div>

      {/* Main List Container */}
      {isLoading ? (
        <div className={`flex flex-col items-center justify-center py-20 gap-3 rounded-2xl border ${
          theme === 'dark' ? 'border-white/5 bg-white/2' : 'border-slate-200 bg-white shadow-sm'
        }`}>
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Sincronizando operadores...
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border flex flex-col items-center justify-center ${
          theme === 'dark' ? 'bg-[#0a0f1d]/40 border-white/5' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`p-3 rounded-full mb-3 ${theme === 'dark' ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
            {activeTab === "pending" ? <Clock className="w-6 h-6" /> : <Users className="w-6 h-6" />}
          </div>
          <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
            {searchTerm ? "Nenhum resultado" : activeTab === "pending" ? "Tudo sob controle" : "Nenhum operador ativo"}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            {searchTerm 
              ? "Experimente mudar o termo de pesquisa ou verificar possíveis erros ortográficos." 
              : activeTab === "pending" 
                ? "Não há nenhuma solicitação de primeiro acesso pendente de validação no momento."
                : "Ainda não existem usuários catalogados com perfil ativo."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* List stats */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
            <span>Visualizando {filteredUsers.length} registros</span>
            <span>status: {activeTab === "pending" ? "Análise pendente" : "Homologados"}</span>
          </div>

          {/* High-density professional responsive corporate table list layout */}
          <div className={`overflow-x-auto rounded-xl border transition-all duration-200 ${
            theme === 'dark' 
              ? 'bg-[#0b0f19]/60 border-slate-800/60 shadow-[0_4px_25px_rgba(0,0,0,0.3)]' 
              : 'bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(148,163,184,0.04)]'
          }`}>
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className={`border-b text-[10px] uppercase tracking-widest font-extrabold text-slate-400 ${
                  theme === 'dark' ? 'border-slate-800/50 bg-[#0e1423]/70' : 'border-slate-100 bg-slate-50/60'
                }`}>
                  <th className="py-3 px-5">Operador / Status</th>
                  <th className="py-3 px-5">Registro ID</th>
                  <th className="py-3 px-5">E-mail</th>
                  <th className="py-3 px-5">Perfil Atual</th>
                  <th className="py-3 px-5">Atribuir Perfil</th>
                  <th className="py-3 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/35">
                {filteredUsers.map((reg) => (
                  <tr 
                    key={reg.id}
                    className={`transition-colors text-xs ${
                      theme === 'dark' 
                        ? 'hover:bg-slate-800/10' 
                        : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Operador / Status */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500'
                        }`}>
                          <UserCog className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`font-bold truncate max-w-[180px] ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                            {reg.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1 h-1 rounded-full ${activeTab === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                            <span className={`text-[9px] font-bold tracking-wider font-mono uppercase ${activeTab === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {reg.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Registro ID */}
                    <td className="py-3.5 px-5 font-mono font-extrabold text-[11px] text-slate-500 dark:text-slate-400">
                      {reg.login}
                    </td>

                    {/* E-mail */}
                    <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400 font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 opacity-50 shrink-0" />
                        <span className="truncate max-w-[200px]" title={reg.email}>{reg.email}</span>
                      </div>
                    </td>

                    {/* Perfil Atual */}
                    <td className="py-3.5 px-5">
                      {activeTab === "users" ? (
                        <span className={`font-mono font-black text-[9px] px-2 py-0.5 rounded uppercase ${
                          reg.role?.toUpperCase() === "ADM" ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" :
                          reg.role?.toUpperCase() === "PPCP" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
                          "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {reg.role || "GA"}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-semibold tracking-wider uppercase font-mono">Pendente</span>
                      )}
                    </td>

                    {/* Atribuir Perfil */}
                    <td className="py-3.5 px-5">
                      <select
                        value={selectedRoles[reg.id] || "GA"}
                        onChange={(e) => setSelectedRoles(prev => ({
                          ...prev,
                          [reg.id]: e.target.value as "ADM" | "PPCP" | "GA"
                        }))}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/15 cursor-pointer transition-all ${
                          theme === 'dark' 
                            ? 'border-slate-800 bg-[#0e1423] text-slate-200 focus:border-blue-500/40' 
                            : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-blue-500/30'
                        }`}
                      >
                        <option value="ADM">👑 ADM</option>
                        <option value="PPCP">📊 PPCP</option>
                        <option value="GA">📦 GA</option>
                      </select>
                    </td>

                    {/* Ações */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {activeTab === "pending" ? (
                          <>
                            <button
                              onClick={() => handleUpdateUser(reg.id, "RECUSADO")}
                              disabled={actionLoadingId !== null}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors ${
                                theme === 'dark'
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100'
                              }`}
                              title="Recusar operador"
                            >
                              {actionLoadingId === reg.id ? (
                                <div className={`w-3 h-3 border-2 rounded-full animate-spin ${
                                  theme === 'dark' ? 'border-rose-400/30 border-t-rose-400' : 'border-rose-600/30 border-t-rose-600'
                                }`} />
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Recusar</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => handleUpdateUser(reg.id, "APROVADO")}
                              disabled={actionLoadingId !== null}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm transition-colors"
                              title="Aprovar operador"
                            >
                              {actionLoadingId === reg.id ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Aprovar</span>
                                </>
                              )}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUpdateUser(reg.id, "PENDENTE")}
                              disabled={actionLoadingId !== null}
                              className={`p-1.5 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors ${
                                theme === 'dark'
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/10'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-100'
                              }`}
                              title="Retornar para pendências"
                            >
                              {actionLoadingId === reg.id ? (
                                <div className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${
                                  theme === 'dark' ? 'border-amber-400/30 border-t-amber-400' : 'border-amber-600/30 border-t-amber-600'
                                }`} />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              onClick={() => handleUpdateUser(reg.id, "APROVADO", selectedRoles[reg.id])}
                              disabled={actionLoadingId !== null}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-sm transition-colors"
                              title="Atualizar privilégios"
                            >
                              {actionLoadingId === reg.id ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Sliders className="w-3.5 h-3.5" />
                                  <span>Atualizar</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Embedded Animations style */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
