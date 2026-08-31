import React, { useState, useEffect, useCallback, useMemo } from "react";
import { User } from "./types";
import LoginScreen from "./components/LoginScreen";
import Layout from "./components/Layout";
import Capacidades from "./components/Capacidades";
import Capacidade_Mes from "./components/Capacidade_Mes";
import EditMonthModal from "./components/EditMonthModal";
import DashboardAnalitico from "./components/Dsh";
import UserControlPage from "./components/usuarios";
import Pfa from "./components/Pfa";
import { resetDashboardOcupacaoCache } from "./components/DashboardOcupacao";

// ============================================
// 🔥 CONSTANTES DE CONFIGURAÇÃO
// ============================================
const STORAGE_KEYS = {
  USER: "logistics_user",
  THEME: "logistics_theme",
  ACTIVE_TAB: "logistics_active_tab",
  CURRENT_PAGE: "logistics_current_page",
  SESSION_LOADED: "app_session_loaded",
} as const;

const DEFAULT_PAGE = "capacidades";
const DEFAULT_TAB = "outbound";
const DEFAULT_THEME = "dark";
const NOTIFICATION_DURATION = 4000;

// ============================================
// 🔥 HELPER: Gerenciamento de Sessão
// ============================================
const sessionManager = {
  isFirstLoad: (): boolean => {
    return !sessionStorage.getItem(STORAGE_KEYS.SESSION_LOADED);
  },
  markAsLoaded: (): void => {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_LOADED, "true");
  },
  clear: (): void => {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_LOADED);
    resetDashboardOcupacaoCache();
  },
};

const storageManager = {
  getUser: (): User | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return parsed.token ? parsed : null;
    } catch {
      return null;
    }
  },
  saveUser: (user: User): void => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  removeUser: (): void => {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
  getTheme: (): "light" | "dark" => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return (saved === "light" || saved === "dark") ? saved : DEFAULT_THEME;
  },
  getActiveTab: (): "inbound" | "outbound" => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    return (saved === "inbound" || saved === "outbound") ? saved : DEFAULT_TAB;
  },
  getCurrentPage: (): string => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_PAGE) || DEFAULT_PAGE;
  },
};

export default function App() {
  // ============================================
  // 🔥 ESTADOS PRINCIPAIS
  // ============================================
  const [user, setUser] = useState<User | null>(() => {
    // 🔥 SÓ RESTAURA SE NÃO FOR PRIMEIRA CARGA
    if (!sessionManager.isFirstLoad()) {
      return storageManager.getUser();
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<"light" | "dark">(storageManager.getTheme);
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound">(storageManager.getActiveTab);
  const [currentPage, setCurrentPage] = useState<string>(storageManager.getCurrentPage);
  
  // ============================================
  // 🔥 UI STATES
  // ============================================
  const [isMonthModalOpen, setIsMonthModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [notificationTimer, setNotificationTimer] = useState<NodeJS.Timeout | null>(null);

  // ============================================
  // 🔥 INICIALIZAÇÃO DA SESSÃO
  // ============================================
  useEffect(() => {
    const initSession = () => {
      if (sessionManager.isFirstLoad()) {
        console.log("🔐 Primeira carga - Redirecionando para login");
        storageManager.removeUser();
        setUser(null);
        sessionManager.markAsLoaded();
      } else {
        const savedUser = storageManager.getUser();
        if (savedUser) {
          console.log("🔄 Recarregando - Restaurando sessão:", savedUser.username);
          setUser(savedUser);
        }
      }
      setIsLoading(false);
    };

    initSession();
  }, []);

  // ============================================
  // 🔥 PERSISTÊNCIA DE ESTADOS
  // ============================================
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_PAGE, currentPage);
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  // ============================================
  // 🔥 CONTROLE DE ACESSO (GA e Admin)
  // ============================================
  useEffect(() => {
    if (!user) return;

    // 🔥 GA não pode acessar Dashboard
    if (user.role === "ga" && currentPage === "dashboard") {
      setCurrentPage(DEFAULT_PAGE);
      return;
    }

    // 🔥 Não-admin não pode acessar Controle de Usuários
    if (user.role !== "admin" && currentPage === "user-control") {
      setCurrentPage(DEFAULT_PAGE);
      return;
    }
  }, [user, currentPage]);

  // ============================================
  // 🔥 NOTIFICATIONS (com cleanup)
  // ============================================
  const showNotification = useCallback((msg: string) => {
    // Limpa timer anterior
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      setNotificationTimer(null);
    }

    setNotification(msg);

    const timer = setTimeout(() => {
      setNotification(null);
      setNotificationTimer(null);
    }, NOTIFICATION_DURATION);

    setNotificationTimer(timer);
  }, [notificationTimer]);

  // Cleanup notification timer
  useEffect(() => {
    return () => {
      if (notificationTimer) {
        clearTimeout(notificationTimer);
      }
    };
  }, [notificationTimer]);

  // ============================================
  // 🔥 HANDLERS
  // ============================================
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  }, []);

  const handleLogout = useCallback(() => {
    storageManager.removeUser();
    sessionManager.clear();
    setUser(null);
    setCurrentPage(DEFAULT_PAGE);
    setActiveTab(DEFAULT_TAB);
    console.log("🚪 Usuário deslogado");
  }, []);

  const handleLoginSuccess = useCallback((userData: User) => {
    storageManager.saveUser(userData);
    sessionManager.markAsLoaded();
    setUser(userData);
    setCurrentPage(DEFAULT_PAGE);
    setActiveTab(DEFAULT_TAB);
    console.log("✅ Login bem-sucedido:", userData.username);
  }, []);

  // ============================================
  // 🔥 SAVE MONTH CAPACITY
  // ============================================
  const handleSaveMonthCapacity = useCallback(async (payload: any) => {
    const endpoint = activeTab === 'inbound' 
      ? '/api/Metas/Inbound' 
      : '/api/Metas/Outbound';
    
    try {
      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      
      if (user?.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error || `HTTP ${response.status}`;
        showNotification(`❌ ${msg}`);
        throw new Error(msg);
      }

      showNotification(`✅ Meta ${activeTab === 'inbound' ? 'Inbound' : 'Outbound'} salva com sucesso!`);
    } catch (err: any) {
      if (!err.message || (!err.message.includes("Operação Bloqueada") && !err.message.includes("Já existem"))) {
        showNotification("❌ Erro ao salvar meta.");
      }
      throw err;
    }
  }, [activeTab, user?.token, showNotification]);

  // ============================================
  // 🔥 LOADING SCREEN
  // ============================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin relative" />
          </div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">
            Carregando sistema...
          </p>
          <div className="flex gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <span className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // 🔥 RENDER: LOGIN
  // ============================================
  if (!user) {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
    );
  }

  // ============================================
  // 🔥 RENDER: APP LOGADO
  // ============================================
  return (
    <div className={theme === "dark" 
      ? "dark bg-[#0a0e1a] min-h-screen text-slate-100 transition-colors duration-300" 
      : "light bg-slate-50 min-h-screen text-slate-800 transition-colors duration-300"
    }>
      <Layout
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
        notification={notification}
        theme={theme}
        onThemeToggle={toggleTheme}
      >
        {currentPage === "capacidades" && (
          <Capacidades 
            activeTab={activeTab} 
            user={user} 
            showNotification={showNotification} 
            onOpenMetasModal={() => setIsMonthModalOpen(true)}
            onTabChange={setActiveTab}
          />
        )}
        
        {currentPage === "metas" && (
          <Capacidade_Mes 
            currentUser={user} 
            showNotification={showNotification} 
          />
        )}
        
        {currentPage === "dashboard" && (
          <DashboardAnalitico 
            theme={theme} 
            showNotification={showNotification} 
            user={user} 
          />
        )}

        {currentPage === "pfa" && (
          <Pfa 
            theme={theme} 
            showNotification={showNotification} 
            user={user} 
          />
        )}

        {currentPage === "user-control" && user?.role === "admin" && (
          <UserControlPage 
            user={user} 
            theme={theme} 
            onBack={() => setCurrentPage(DEFAULT_PAGE)} 
          />
        )}

        <EditMonthModal
          isOpen={isMonthModalOpen}
          onClose={() => setIsMonthModalOpen(false)}
          onSave={handleSaveMonthCapacity}
          editMode={activeTab}
        />
      </Layout>
    </div>
  );
}