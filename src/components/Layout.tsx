import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, 
  Lock, 
  LogOut, 
  CheckCircle, 
  WifiOff, 
  BarChart3, 
  CalendarRange, 
  Layers,
  Sun,
  Moon,
  TrendingUp,
  AlertCircle,
  X,
  Activity,
  Users,
  PieChart,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Inbox,
  Send,
  UserCheck
} from "lucide-react";
import DashboardAnalitico from "./Dsh";
import Dashboard2 from "./Dashboard2";
import DashboardOcupacao from "./DashboardOcupacao";

// ============================================================
// TYPES
// ============================================================

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  activeTab: "inbound" | "outbound";
  onTabChange: (tab: "inbound" | "outbound") => void;
  currentPage: string;
  onPageChange: (page: string) => void;
  onLogout: () => void;
  notification: string | null;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  onClearNotification?: () => void;
}

type DashboardComponent = React.ComponentType<{
  theme: "light" | "dark";
  showNotification: (msg: string) => void;
  user?: any;
  onPageChange?: (page: string) => void;
  onThemeToggle?: () => void;
  onLogout?: () => void;
}>;

interface DashboardItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  component: DashboardComponent | null;
  isAvailable: boolean;
}

// ============================================================
// LAYOUT PRINCIPAL: MENU LATERAL EXCLUSIVO (ALTERAÇÃO DE TELAS)
// SUBMENU DOS DASHBOARDS INTEGRADO DIRETAMENTE NA PÁGINA
// DESIGN FIT 100% ZOOM SEM NECESSIDADE DE SCROLL
// ============================================================

export default function Layout({ 
  children, 
  user, 
  activeTab, 
  onTabChange, 
  currentPage, 
  onPageChange, 
  onLogout, 
  notification,
  theme,
  onThemeToggle,
  onClearNotification
}: LayoutProps) {
  
  // Estado do Menu Lateral:
  // "expanded" = expandido (~230px)
  // "collapsed" = compacto apenas com ícones (~68px)
  const [sidebarState, setSidebarState] = useState<"expanded" | "collapsed">(() => {
    const saved = localStorage.getItem("logistics_sidebar_state_v2");
    if (saved === "expanded" || saved === "collapsed") {
      return saved;
    }
    return "expanded";
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("logistics_sidebar_state_v2", sidebarState);
  }, [sidebarState]);

  // Dashboard selecionado na página de analítico (armazenado em localStorage)
  const [expandedDashboardId, setExpandedDashboardId] = useState<string>(() => {
    const saved = localStorage.getItem("logistics_selected_dashboard_id");
    return saved || "ocupacao";
  });

  useEffect(() => {
    if (expandedDashboardId) {
      localStorage.setItem("logistics_selected_dashboard_id", expandedDashboardId);
    }
  }, [expandedDashboardId]);

  // Lista dos dashboards disponíveis
  const dashboards: DashboardItem[] = [
    {
      id: "ocupacao",
      title: "Ocupação & Estoque",
      subtitle: "Capacidade, Ocupação & Projeção",
      description: "Visão executiva de ocupação por categoria, projeção de estoque e agendas.",
      icon: <PieChart className="w-3.5 h-3.5" />,
      badge: "Novo",
      badgeColor: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/30",
      component: DashboardOcupacao,
      isAvailable: true,
    },
    {
      id: "capacidades",
      title: "Capacidades CD",
      subtitle: "PPCP Analítico",
      description: "Análise completa de inbound, outbound, recebimento remunerado e projeções.",
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      badge: "Ativo",
      badgeColor: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/30",
      component: DashboardAnalitico,
      isAvailable: true,
    },
    {
      id: "dashboard2",
      title: "Performance Inbound",
      subtitle: "Capacidade x Recebimento",
      description: "Monitoramento em tempo real do fluxo de inbound, capacidades e desvios.",
      icon: <Activity className="w-3.5 h-3.5" />,
      badge: "Ativo",
      badgeColor: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/30",
      component: Dashboard2,
      isAvailable: true,
    },
  ];

  const handleDashboardSelect = (id: string) => {
    const dashboard = dashboards.find(d => d.id === id);
    if (!dashboard?.isAvailable) {
      if (onClearNotification) onClearNotification();
      return;
    }
    setExpandedDashboardId(id);
    if (currentPage !== "dashboard") {
      onPageChange("dashboard");
    }
  };

  // Itens do Menu Lateral: EXCLUSIVAMENTE para alternância de telas
  const navMenuItems = [
    {
      id: "capacidades",
      label: "Capacidades",
      icon: <BarChart3 className="w-4 h-4" />,
      desc: "Matriz Operacional",
    },
    {
      id: "metas",
      label: "Planejamento",
      icon: <TrendingUp className="w-4 h-4" />,
      desc: "Metas & Planejamento",
    },
    {
      id: "dashboard",
      label: "Analítico",
      icon: <Activity className="w-4 h-4" />,
      desc: "Dashboards & KPIs",
    },
    // {
    //   id: "pfa",
    //   label: "PFA Fim de Ano",
    //   icon: <CalendarRange className="w-4 h-4" />,
    //   desc: "Planejamento Sazonal",
    // },
    ...(user?.role === "admin" ? [
      {
        id: "user-control",
        label: "Usuários",
        icon: <Users className="w-4 h-4" />,
        desc: "Controle de Acessos",
      }
    ] : [])
  ].filter(item => {
    if (item.id === "dashboard" && user?.role === "ga") return false;
    return true;
  });

  const activeDashboard = dashboards.find(d => d.id === expandedDashboardId) || dashboards[0];
  const ActiveComponent = activeDashboard?.isAvailable ? activeDashboard.component : null;

  const accentGradient = activeTab === "inbound" 
    ? "from-emerald-500 via-emerald-600 to-teal-600" 
    : "from-blue-500 via-blue-600 to-indigo-600";

  const shouldShowNotification = (msg: string | null) => {
    if (!msg) return false;
    return msg.includes('❌') || msg.includes('Erro') || msg.includes('erro') || msg.includes('⚠️');
  };

  const cleanMessage = (msg: string) => {
    if (!msg) return '';
    return msg.replace(/[❌⚠️🔍📊📍📅🧹🎯⚡✅]/g, '').trim();
  };

  // Renderizador do Conteúdo da Página de Dashboards com o SUBMENU na página
  const renderDashboardContent = () => {
    if (currentPage === "dashboard") {
      return (
        <div className="w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* SUBMENU DOS DASHBOARDS (NA PRÓPRIA PÁGINA) */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1.5 shrink-0 border-b border-slate-200/70 dark:border-slate-800/70 mb-1.5">
            
            {/* Abas dos Dashboards (Segmented Control) */}
            <div className={`inline-flex items-center gap-1 p-1 ${theme === 'dark' ? 'bg-[#111726] border-slate-800/80' : 'bg-slate-100 border-slate-200'} border rounded-xl shadow-2xs`}>
              {dashboards.map((dash) => {
                const isSelected = expandedDashboardId === dash.id;
                const isDisabled = !dash.isAvailable;

                return (
                  <button
                    key={dash.id}
                    onClick={() => handleDashboardSelect(dash.id)}
                    disabled={isDisabled}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 shrink-0 cursor-pointer ${
                      isSelected
                        ? theme === 'dark'
                          ? "bg-violet-600 text-white shadow-xs"
                          : "bg-white text-slate-900 shadow-xs border border-slate-200"
                        : isDisabled
                          ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-40'
                          : theme === 'dark'
                            ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    <span className={isSelected ? "text-inherit" : "text-slate-400"}>{dash.icon}</span>
                    <span>{dash.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Status Indicador */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>PPCP Analítico</span>
              </span>
            </div>
          </div>

          {/* ÁREA DO DASHBOARD ATIVO (FLEX-1, PREENCHE A TELA SEM SCROLL NO ZOOM 100%) */}
          <div className="flex-1 w-full min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col">
            {ActiveComponent ? (
              <ActiveComponent 
                theme={theme} 
                user={user}
                onPageChange={onPageChange}
                onThemeToggle={onThemeToggle}
                onLogout={onLogout}
                showNotification={(msg) => {
                  console.log("[Dashboard]", msg);
                }} 
              />
            ) : (
              <div className="w-full py-16 px-6 text-center">
                <p className="text-slate-400 dark:text-slate-500 font-mono text-xs">Nenhum painel selecionado</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return children;
  };

  const cleanMsg = notification ? cleanMessage(notification) : '';
  const isError = notification ? (notification.includes('❌') || notification.includes('Erro') || notification.includes('erro') || notification.includes('⚠️')) : false;

  const bgClass = theme === "dark"
    ? "bg-[#090d16] text-slate-100"
    : "bg-slate-100/70 text-slate-800";

  const cardBg = theme === "dark"
    ? "bg-slate-900/90 backdrop-blur-md border-slate-800"
    : "bg-white/95 backdrop-blur-md border-slate-200";

  const sidebarWidth = sidebarState === "expanded" ? "w-56" : "w-[68px]";

  return (
    <div className={`flex h-screen max-h-screen w-screen overflow-hidden ${bgClass} transition-colors duration-300 font-sans antialiased`}>
      
      {/* NOTIFICAÇÃO FLUTUANTE */}
      <AnimatePresence>
        {notification && shouldShowNotification(notification) && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.97 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <div className={`${cardBg} border ${isError ? 'border-rose-200 dark:border-rose-900/30' : 'border-amber-200 dark:border-amber-900/30'} rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-sm`}>
              <div className={`p-1.5 rounded-xl ${isError ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'}`}>
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  {isError ? 'Erro' : 'Alerta'}
                </p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{cleanMsg}</p>
              </div>
              {onClearNotification && (
                <button
                  onClick={onClearNotification}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          MENU LATERAL DESKTOP (EXCLUSIVO PARA TROCA DE TELAS)
          ============================================================ */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-200 ease-in-out border-r relative z-30 h-screen ${sidebarWidth} ${
          theme === 'dark' 
            ? 'bg-[#0d121f] border-slate-800/80 shadow-xs' 
            : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        {/* Cabeçalho do Menu Lateral */}
        <div className="h-12 px-3 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-violet-600 shadow-xs text-white"
            >
              <Layers className="w-3.5 h-3.5" />
            </div>
            
            {sidebarState === "expanded" && (
              <div className="flex flex-col overflow-hidden whitespace-nowrap">
                <span className={`text-xs font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  PPCP <span className="text-violet-500">GPA</span>
                </span>
              </div>
            )}
          </div>

          {/* Botão de Recolher / Expandir Menu Lateral */}
          <button
            onClick={() => setSidebarState(sidebarState === "expanded" ? "collapsed" : "expanded")}
            title={sidebarState === "expanded" ? "Recolher menu" : "Expandir menu"}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            {sidebarState === "expanded" ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* LISTA EXCLUSIVA DE TELAS / NAVEGAÇÃO */}
        <div className="flex-1 px-2 py-2.5 space-y-1 overflow-y-auto no-scrollbar">
          {sidebarState === "expanded" && (
            <div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Navegação
            </div>
          )}

          {navMenuItems.map((item) => {
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                title={sidebarState === "collapsed" ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? theme === 'dark'
                      ? 'bg-violet-600/15 text-violet-400 border border-violet-500/30 font-bold'
                      : 'bg-violet-50 text-violet-700 border border-violet-200 font-bold'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                } ${sidebarState === "collapsed" ? "justify-center px-0 py-2" : ""}`}
              >
                <div className={`shrink-0 ${isActive ? 'text-violet-500' : 'text-slate-400'}`}>
                  {item.icon}
                </div>

                {sidebarState === "expanded" && (
                  <div className="flex-1 text-left flex flex-col min-w-0">
                    <span className="leading-tight truncate">{item.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Rodapé da Sidebar: Perfil, Tema e Logout */}
        <div className="p-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-1.5 shrink-0">
          {/* Perfil do Usuário */}
          <div className={`flex items-center gap-2 p-1.5 rounded-lg border ${theme === 'dark' ? 'bg-[#121829] border-slate-800' : 'bg-slate-50 border-slate-200'} ${sidebarState === 'collapsed' ? 'justify-center p-1' : ''}`}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-violet-600 text-[10px] font-bold text-white shadow-xs">
              {(user?.name || user?.username || "U")[0].toUpperCase()}
            </div>

            {sidebarState === "expanded" && (
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-bold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                  {user?.name || user?.username || "Operador"}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate uppercase font-semibold">
                  {user?.role || "User"}
                </p>
              </div>
            )}
          </div>

          {/* Ações de Tema e Logout */}
          <div className={`flex items-center gap-1 ${sidebarState === 'collapsed' ? 'flex-col' : 'justify-between'}`}>
            <button
              onClick={onThemeToggle}
              title={`Alternar Tema (${theme === 'dark' ? 'Escuro' : 'Claro'})`}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                theme === 'dark' 
                  ? 'text-amber-400 hover:bg-slate-800' 
                  : 'text-slate-600 hover:bg-slate-100'
              } ${sidebarState === 'expanded' ? 'flex-1 justify-center' : 'w-full justify-center'}`}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {sidebarState === "expanded" && <span className="text-[10px]">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
            </button>

            <button
              onClick={onLogout}
              title="Sair do sistema"
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer ${
                sidebarState === 'expanded' ? 'flex-1 justify-center' : 'w-full justify-center'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              {sidebarState === "expanded" && <span className="text-[10px]">Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================
          DRAWER MOBILE MENU
          ============================================================ */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className={`md:hidden fixed left-0 top-0 bottom-0 w-60 z-50 flex flex-col border-r ${
                theme === 'dark' ? 'bg-[#0d121f] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="h-12 px-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-xs">GPA Logistics PPCP</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Links de telas */}
              <div className="flex-1 p-2.5 space-y-1 overflow-y-auto">
                {navMenuItems.map((item) => {
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onPageChange(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                        isActive 
                          ? theme === 'dark' ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Rodapé Mobile */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold">{user?.name || "Operador"}</span>
                <div className="flex items-center gap-1">
                  <button onClick={onThemeToggle} className="p-1.5 rounded-lg text-slate-400">
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={onLogout} className="p-1.5 rounded-lg text-rose-500">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ============================================================
          ÁREA PRINCIPAL DE CONTEÚDO (COMPACTA, 100% ZOOM FIT)
          ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden">
        
        {/* HEADER SUPERIOR COMPACTO */}
        <header className={`h-10 border-b backdrop-blur-md px-3 flex items-center justify-between shrink-0 transition-colors ${
          theme === 'dark'
            ? 'bg-[#0b0f19]/90 border-slate-800/70 shadow-2xs'
            : 'bg-white/90 border-slate-200/80 shadow-2xs'
        }`}>
          {/* Botão Mobile & Título da Tela Atual */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-mono">
                PPCP
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <h1 className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                {currentPage === "dashboard" 
                  ? "Painel Analítico" 
                  : currentPage === "capacidades"
                  ? "Capacidades Logísticas"
                  : currentPage === "metas"
                  ? "Planejamento de Metas"
                  : currentPage === "pfa"
                  ? "PFA Fim de Ano"
                  : currentPage === "user-control"
                  ? "Gestão de Usuários"
                  : currentPage}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              GPA Logistics
            </span>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL (100% DA ALTURA UTILIZÁVEL) */}
        <main className="flex-1 w-full p-2 sm:p-2.5 max-w-[1920px] mx-auto flex flex-col min-h-0 overflow-hidden">
          {renderDashboardContent()}
        </main>
      </div>
    </div>
  );
}
