import React, { useState, useEffect } from "react";
import { 
  Lock, 
  User as UserIcon, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Zap,
  Building2,
  Mail,
  ArrowLeft,
  CheckCircle,
  UserPlus,
  Sun,
  Moon,
  HelpCircle,
  UserX,
  UserCheck,
  ShieldAlert
} from "lucide-react";
import { User, UserRole } from "../types";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
}

export default function LoginScreen({ onLoginSuccess, theme = "dark", onThemeToggle }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"credentials" | "blocked" | "network" | "server" | "user" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // 🔥 CONTAGEM DE TENTATIVAS
  const [attempts, setAttempts] = useState<number>(() => {
    const saved = localStorage.getItem("login_attempts");
    return saved ? parseInt(saved) : 0;
  });
  const [isBlocked, setIsBlocked] = useState<boolean>(() => {
    const blocked = localStorage.getItem("login_blocked");
    if (blocked) {
      const blockTime = parseInt(blocked);
      const now = Date.now();
      if (now - blockTime < 300000) {
        return true;
      } else {
        localStorage.removeItem("login_blocked");
        localStorage.removeItem("login_attempts");
        return false;
      }
    }
    return false;
  });
  const [blockTimer, setBlockTimer] = useState<number>(0);

  // States for Primeiro Acesso
  const [mode, setMode] = useState<"login" | "register" | "success">("login");
  const [regName, setRegName] = useState("");
  const [regLogin, setRegLogin] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // 🔥 Timer para desbloqueio
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBlocked) {
      const blockTime = parseInt(localStorage.getItem("login_blocked") || "0");
      const remaining = Math.max(0, Math.floor((300000 - (Date.now() - blockTime)) / 1000));
      setBlockTimer(remaining);
      
      interval = setInterval(() => {
        setBlockTimer(prev => {
          if (prev <= 1) {
            setIsBlocked(false);
            localStorage.removeItem("login_blocked");
            localStorage.removeItem("login_attempts");
            setAttempts(0);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBlocked]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ============================================
  // 🔥 VALIDAÇÃO DE USUÁRIO
  // ============================================
  const validateUser = (login: string): { valid: boolean; message?: string } => {
    if (!login || login.trim() === "") {
      return { valid: false, message: "Por favor, digite seu usuário." };
    }
    if (login.length < 4) {
      return { valid: false, message: "Usuário deve ter pelo menos 4 caracteres." };
    }
    if (!/^\d+$/.test(login)) {
      return { valid: false, message: "Usuário deve conter apenas números." };
    }
    return { valid: true };
  };

  const validatePassword = (pass: string): { valid: boolean; message?: string } => {
    if (!pass || pass.trim() === "") {
      return { valid: false, message: "Por favor, digite sua senha." };
    }
    if (pass.length < 6) {
      return { valid: false, message: "Senha deve ter pelo menos 6 caracteres." };
    }
    return { valid: true };
  };

  // ============================================
  // 🔥 FUNÇÃO PARA VERIFICAR SE É ERRO DE USUÁRIO NÃO CADASTRADO
  // ============================================
  const isUserNotFoundError = (message: string): boolean => {
    const lowerMsg = message.toLowerCase();
    const patterns = [
      "usuário não encontrado",
      "não encontrado",
      "não cadastrado",
      "not found",
      "inexistente",
      "não existe",
      "user not found",
      "invalid username",
      "usuario nao encontrado",
      "usuario nao cadastrado",
      "cadastro não encontrado",
      "login não encontrado",
      "login inexistente"
    ];
    return patterns.some(pattern => lowerMsg.includes(pattern));
  };

  // ============================================
  // LOGIN
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorType(null);

    // 🔥 VALIDAÇÃO DE USUÁRIO
    const userValidation = validateUser(username);
    if (!userValidation.valid) {
      setError(`❌ ${userValidation.message}`);
      setErrorType("user");
      return;
    }

    // 🔥 VALIDAÇÃO DE SENHA
    const passValidation = validatePassword(password);
    if (!passValidation.valid) {
      setError(`❌ ${passValidation.message}`);
      setErrorType("user");
      return;
    }

    // 🔥 VERIFICA SE ESTÁ BLOQUEADO
    if (isBlocked) {
      setError(`🔒 Conta bloqueada. Aguarde ${blockTimer} segundos para tentar novamente.`);
      setErrorType("blocked");
      return;
    }

    // 🔥 USUÁRIO SIMULADO DE TESTE (INTERCEPTAÇÃO DIRETA CLIENT-SIDE)
    if (username.trim() === "74553125" && password.trim() === "1234567") {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        onLoginSuccess({
          username: "74553125",
          name: "Usuário Teste",
          role: "admin",
          token: "dummyHeader.eyJzdWIiOiI3NDU1MzEyNSIsIm5hbWUiOiJVc3XDoXJpbyBUZXN0ZSIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.dummySignature"
        });
      }, 600);
      return;
    }

    setIsLoading(true);

    try {
      console.log("🔐 Tentando login:", { login: username });

      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          login: username,
          password: password
        })
      });

      console.log("📡 Status:", response.status);

      // 🔥 CASO 404 - USUÁRIO NÃO ENCONTRADO
      if (response.status === 404) {
        setError("❌ Usuário não cadastrado. Verifique seu login ou solicite seu primeiro acesso.");
        setErrorType("user");
        setIsLoading(false);
        return;
      }

      // 🔥 CASO 401 - CREDENCIAIS INVÁLIDAS
      if (response.status === 401) {
        const errorText = await response.text();
        console.log("📡 Resposta 401:", errorText);
        
        let errorMsg = "Senha incorreta.";
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.message || errorJson.error || errorMsg;
        } catch (e) {
          if (errorText) errorMsg = errorText;
        }

        // 🔥 VERIFICA SE É USUÁRIO NÃO CADASTRADO
        if (isUserNotFoundError(errorMsg)) {
          setError("❌ Usuário não cadastrado. Verifique seu login ou solicite seu primeiro acesso.");
          setErrorType("user");
          setIsLoading(false);
          return;
        }

        // 🔥 INCREMENTA TENTATIVAS APENAS PARA SENHA INCORRETA
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        localStorage.setItem("login_attempts", String(newAttempts));

        if (newAttempts >= 3) {
          setIsBlocked(true);
          localStorage.setItem("login_blocked", String(Date.now()));
          setError("🔒 Conta bloqueada por 5 minutos. Muitas tentativas falhas.");
          setErrorType("blocked");
          setAttempts(0);
          localStorage.removeItem("login_attempts");
          setIsLoading(false);
          return;
        }

        setError(`❌ Senha incorreta. Tentativas restantes: ${3 - newAttempts}`);
        setErrorType("credentials");
        setIsLoading(false);
        return;
      }

      // 🔥 CASO 403 - ACESSO NEGADO
      if (response.status === 403) {
        setError("❌ Acesso negado. Você não tem permissão para acessar o sistema.");
        setErrorType("server");
        setIsLoading(false);
        return;
      }

      // 🔥 CASO 500 - ERRO DO SERVIDOR
      if (response.status === 500) {
        setError("❌ Erro interno do servidor. Tente novamente mais tarde.");
        setErrorType("server");
        setIsLoading(false);
        return;
      }

      // 🔥 OUTROS ERROS
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Erro ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.message || errorJson.error || errorMsg;
        } catch (e) {
          errorMsg = errorText || errorMsg;
        }
        
        // 🔥 VERIFICA SE É USUÁRIO NÃO CADASTRADO
        if (isUserNotFoundError(errorMsg)) {
          setError("❌ Usuário não cadastrado. Verifique seu login ou solicite seu primeiro acesso.");
          setErrorType("user");
          setIsLoading(false);
          return;
        }
        
        throw new Error(errorMsg);
      }

      // 🔥 RESETA CONTAGEM EM CASO DE SUCESSO
      setAttempts(0);
      localStorage.removeItem("login_attempts");
      localStorage.removeItem("login_blocked");
      setIsBlocked(false);

      const data = await response.json();
      console.log("✅ Login bem-sucedido:", data);

      const token = data.token || data.accessToken || data.jwt || data.id_token;
      if (!token) {
        setError("❌ Token de autenticação não retornado. Contate o suporte.");
        setErrorType("server");
        setIsLoading(false);
        return;
      }

      const parseJwt = (t: string) => {
        try {
          const base64Url = t.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch (err) {
          return null;
        }
      };

      const claims = parseJwt(token) || {};
      console.log("🔑 JWT decodificado:", claims);

      let role: UserRole = "ppcp";
      const rawRole = data.role || data.user?.role || claims.role || 
                     (Array.isArray(claims.roles) ? claims.roles[0] : null) || 
                     (Array.isArray(claims.authorities) ? claims.authorities[0] : null) || 
                     claims.authority;

      if (rawRole) {
        const rStr = String(rawRole).toLowerCase();
        if (rStr.includes("admin") || rStr.includes("adm")) {
          role = "admin";
        } else if (rStr.includes("ppcp")) {
          role = "ppcp";
        } else if (rStr.includes("ga")) {
          role = "ga";
        }
      } else {
        const uStr = username.toLowerCase();
        if (uStr.includes("admin") || uStr.includes("adm")) {
          role = "admin";
        } else if (uStr.includes("ppcp")) {
          role = "ppcp";
        } else if (uStr.includes("ga")) {
          role = "ga";
        }
      }

      const name = data.name || data.user?.name || claims.name || claims.sub || username;

      console.log("👤 Usuário autenticado:", { username, name, role });

      onLoginSuccess({
        username: username,
        name: name,
        role: role,
        token: token
      });

    } catch (err: any) {
      console.error("❌ Erro na autenticação:", err);
      
      let errorMessage = err.message || "Não foi possível conectar ao servidor.";
      
      // 🔥 VERIFICA SE É USUÁRIO NÃO CADASTRADO
      if (isUserNotFoundError(errorMessage)) {
        setError("❌ Usuário não cadastrado. Verifique seu login ou solicite seu primeiro acesso.");
        setErrorType("user");
      } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        setError("❌ Não foi possível conectar ao servidor. Verifique sua rede/VPN.");
        setErrorType("network");
      } else if (errorMessage.includes("403")) {
        setError("❌ Acesso negado. Verifique suas credenciais.");
        setErrorType("server");
      } else if (errorMessage.includes("404")) {
        setError("❌ Usuário não cadastrado. Verifique seu login ou solicite seu primeiro acesso.");
        setErrorType("user");
      } else if (errorMessage.includes("401")) {
        setError("❌ Senha incorreta. Tente novamente.");
        setErrorType("credentials");
      } else {
        setError(`❌ ${errorMessage}`);
        setErrorType("server");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // REGISTRO
  // ============================================
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);

    try {
      const response = await fetch("/registro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: regName,
          login: Number(regLogin),
          password: regPassword,
          email: regEmail
        })
      });

      if (response.status === 409) {
        setRegError("❌ Este usuário já está cadastrado. Tente fazer login.");
        setRegLoading(false);
        return;
      }

      if (response.status === 400) {
        const errorText = await response.text();
        let errorMsg = "Dados inválidos. Verifique todos os campos.";
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.message || errorJson.error || errorMsg;
        } catch (e) {}
        setRegError(`❌ ${errorMsg}`);
        setRegLoading(false);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Código de status HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Registro realizado:", data);
      
      setMode("success");
    } catch (err: any) {
      console.error("❌ Erro no envio do primeiro acesso:", err);
      setRegError(`❌ ${err.message || "Não foi possível conectar ao servidor."}`);
    } finally {
      setRegLoading(false);
    }
  };

  // ============================================
  // "ESQUECI A SENHA"
  // ============================================
  const handleForgotPassword = () => {
    setError("🔑 Entre em contato com o administrador para redefinir sua senha.");
    setErrorType("server");
    setTimeout(() => {
      setError(null);
      setErrorType(null);
    }, 5000);
  };

  const isDark = theme === "dark";

  // ============================================
  // RENDER - ÍCONE DE ERRO PERSONALIZADO
  // ============================================
  const getErrorIcon = () => {
    switch (errorType) {
      case "user":
        return <UserX className="w-5 h-5" />;
      case "blocked":
        return <Lock className="w-5 h-5" />;
      case "network":
        return <AlertCircle className="w-5 h-5" />;
      case "credentials":
        return <ShieldAlert className="w-5 h-5" />;
      case "server":
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#0a0e1a]' : 'bg-slate-100'
    }`}>
      {/* Botão de Tema - Top Right */}
      <button
        onClick={onThemeToggle}
        className={`absolute top-4 right-4 z-20 p-2.5 rounded-full transition-all duration-300 cursor-pointer ${
          isDark 
            ? 'bg-white/10 hover:bg-white/20 text-yellow-400' 
            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
        }`}
        title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute inset-0 ${
          isDark 
            ? 'bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.08)_0%,_transparent_70%)]' 
            : 'bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.05)_0%,_transparent_70%)]'
        }`} />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 rounded-full animate-float ${
              isDark ? 'bg-blue-400/30' : 'bg-blue-500/20'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDuration: `${3 + Math.random() * 5}s`,
              animationDelay: `${Math.random() * 3}s`,
              width: `${1 + Math.random() * 3}px`,
              height: `${1 + Math.random() * 3}px`,
            }}
          />
        ))}
      </div>

      {/* Mouse follower glow */}
      <div 
        className="absolute pointer-events-none w-[600px] h-[600px] rounded-full bg-gradient-to-r from-blue-500/5 to-indigo-500/5 blur-3xl transition-all duration-500 ease-out"
        style={{
          left: mousePosition.x - 300,
          top: mousePosition.y - 300,
        }}
      />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="relative group">
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000 animate-pulse`} />
          
          <div className={`relative backdrop-blur-2xl border rounded-3xl shadow-2xl p-8 transition-all duration-500 hover:shadow-[0_0_60px_-15px_rgba(79,70,229,0.3)] ${
            isDark 
              ? 'bg-[#111827]/90 border-white/10' 
              : 'bg-white/90 border-slate-200/50'
          }`}>
            
            {mode === "login" && (
              <>
                <div className="text-center mb-8">
                  <div className="relative inline-flex">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur-xl opacity-50 animate-pulse" />
                    <div className={`relative inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30`}>
                      <Building2 className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h1 className={`font-display text-2xl font-bold tracking-tight mt-5 mb-2 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Portal Planejamento
                  </h1>
                  <p className={`text-sm font-medium flex items-center justify-center gap-2 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse`} />
                    Acesse o painel integrado
                  </p>
                </div>

                {/* PAINEL DE CREDENCIAIS DE TESTE SIMULADO */}
                <div className={`p-3.5 mb-4 rounded-2xl border text-xs text-left flex items-center justify-between transition-all duration-300 ${
                  isDark 
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' 
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <div>
                      <p className="font-bold">Usuário de Teste Disponível</p>
                      <p className="text-[10px] opacity-80 mt-0.5">
                        Usuário: <strong className="font-mono">74553125</strong> <br />
                        Senha: <strong className="font-mono">1234567</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername("74553125");
                      setPassword("1234567");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border shrink-0 cursor-pointer ${
                      isDark
                        ? 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/30 text-blue-200'
                        : 'bg-blue-100 border-blue-300 hover:bg-blue-200 text-blue-800'
                    }`}
                  >
                    Preencher
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className={`flex items-start gap-3 p-4 rounded-xl text-sm backdrop-blur-sm animate-shake ${
                      isDark 
                        ? `bg-${errorType === 'blocked' ? 'red' : errorType === 'user' ? 'orange' : 'rose'}-500/10 border border-${errorType === 'blocked' ? 'red' : errorType === 'user' ? 'orange' : 'rose'}-500/20 text-${errorType === 'blocked' ? 'red' : errorType === 'user' ? 'orange' : 'rose'}-400` 
                        : `bg-${errorType === 'blocked' ? 'red' : errorType === 'user' ? 'orange' : 'rose'}-50 border border-${errorType === 'blocked' ? 'red' : errorType === 'user' ? 'orange' : 'rose'}-200 text-${errorType === 'blocked' ? 'red' : errorType === 'user' ? 'orange' : 'rose'}-600`
                    }`}>
                      <div className="mt-0.5 shrink-0">
                        {getErrorIcon()}
                      </div>
                      <span className="font-medium whitespace-pre-wrap">{error}</span>
                    </div>
                  )}

                  {attempts > 0 && !isBlocked && !error && (
                    <div className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium ${
                      isDark 
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}>
                      <AlertCircle className="w-4 h-4" />
                      <span>Tentativas restantes: {3 - attempts}</span>
                    </div>
                  )}

                  {isBlocked && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                      isDark 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <Lock className="w-5 h-5" />
                      <span>🔒 Aguarde {blockTimer} segundos para tentar novamente</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className={`text-xs font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Usuário (Cadastro Numérico)
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute inset-0 rounded-xl blur opacity-0 group-hover/input:opacity-100 transition duration-500 ${
                        isDark ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10'
                      }`} />
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                          isDark ? 'text-slate-500 group-hover/input:text-blue-400' : 'text-slate-400 group-hover/input:text-blue-500'
                        }`}>
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={isBlocked}
                          placeholder="Ex: 12345"
                          className={`w-full pl-12 pr-4 py-3.5 border rounded-xl text-sm focus:outline-none focus:ring-4 transition-all duration-300 ${
                            isDark 
                              ? 'bg-white/5 border-white/10 hover:border-white/20 focus:border-blue-500 text-white placeholder-slate-500 focus:ring-blue-500/10' 
                              : 'bg-white/80 border-slate-200 hover:border-slate-300 focus:border-blue-500 text-slate-800 placeholder-slate-400 focus:ring-blue-500/10'
                          } ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Digite seu número de cadastro (apenas números)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-xs font-bold uppercase tracking-wider block ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className={`text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                          isDark 
                            ? 'text-blue-400 hover:text-blue-300' 
                            : 'text-blue-600 hover:text-blue-500'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Esqueci a senha
                      </button>
                    </div>
                    <div className="relative group/input">
                      <div className={`absolute inset-0 rounded-xl blur opacity-0 group-hover/input:opacity-100 transition duration-500 ${
                        isDark ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10'
                      }`} />
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                          isDark ? 'text-slate-500 group-hover/input:text-blue-400' : 'text-slate-400 group-hover/input:text-blue-500'
                        }`}>
                          <Lock className="w-5 h-5" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isBlocked}
                          placeholder="Digite sua senha"
                          className={`w-full pl-12 pr-12 py-3.5 border rounded-xl text-sm focus:outline-none focus:ring-4 transition-all duration-300 ${
                            isDark 
                              ? 'bg-white/5 border-white/10 hover:border-white/20 focus:border-blue-500 text-white placeholder-slate-500 focus:ring-blue-500/10' 
                              : 'bg-white/80 border-slate-200 hover:border-slate-300 focus:border-blue-500 text-slate-800 placeholder-slate-400 focus:ring-blue-500/10'
                          } ${isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${
                            isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Mínimo 6 caracteres
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || isBlocked}
                    className={`w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer relative overflow-hidden group/btn ${
                      isBlocked ? 'cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 relative z-10 group-hover/btn:scale-110 transition-transform" />
                        <span className="relative z-10">Entrar no Sistema</span>
                      </>
                    )}
                  </button>

                  <div className="relative pt-4">
                    <div className={`absolute inset-x-0 top-4 h-px bg-gradient-to-r from-transparent via-slate-600/30 to-transparent ${
                      isDark ? '' : 'via-slate-300'
                    }`} />
                    <div className="relative pt-6 flex flex-col items-center gap-3">
                      <span className={`text-[10px] font-medium uppercase tracking-widest px-4 ${
                        isDark ? 'text-slate-500 bg-[#111827]' : 'text-slate-400 bg-white'
                      }`}>
                        Novo na plataforma?
                      </span>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setRegError(null);
                          setMode("register");
                        }}
                        className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600/20 to-blue-600/20 hover:from-emerald-600/30 hover:to-blue-600/30 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 p-0.5"
                      >
                        <div className={`relative flex items-center justify-center gap-3 py-3 px-4 rounded-xl backdrop-blur-sm ${
                          isDark ? 'bg-[#111827]/80' : 'bg-white/80'
                        }`}>
                          <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md animate-pulse" />
                            <UserPlus className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform duration-300 relative z-10" />
                          </div>
                          <span className="text-sm font-semibold text-transparent bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text group-hover:from-emerald-300 group-hover:to-blue-300 transition-all duration-300">
                            Solicitar Primeiro Acesso
                          </span>
                          <ArrowLeft className="w-3.5 h-3.5 text-emerald-400/50 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all duration-300 rotate-180" />
                        </div>
                      </button>
                      
                      <p className={`text-[10px] ${
                        isDark ? 'text-slate-500/70' : 'text-slate-400/70'
                      }`}>
                        ⏱️ Aprovação em até 24 horas
                      </p>
                    </div>
                  </div>
                </form>
              </>
            )}

            {mode === "register" && (
              <>
                <div className="text-center mb-6">
                  <div className="relative inline-flex">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur-xl opacity-50 animate-pulse" />
                    <div className="relative inline-flex items-center justify-center p-3.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30">
                      <UserPlus className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h1 className={`font-display text-2xl font-bold tracking-tight mt-4 mb-1 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Primeiro Acesso
                  </h1>
                  <p className={`text-xs font-medium ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Preencha os dados para solicitar seu cadastro
                  </p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-fade-in">
                  {regError && (
                    <div className={`flex items-start gap-3 p-3.5 rounded-xl text-xs backdrop-blur-sm animate-shake ${
                      isDark 
                        ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
                        : 'bg-rose-50 border border-rose-200 text-rose-600'
                    }`}>
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="font-medium">{regError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Nome Completo
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute inset-0 rounded-xl blur opacity-0 group-hover/input:opacity-100 transition duration-500 ${
                        isDark ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10'
                      }`} />
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                          isDark ? 'text-slate-500 group-hover/input:text-blue-400' : 'text-slate-400 group-hover/input:text-blue-500'
                        }`}>
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Digite seu nome completo"
                          className={`w-full pl-11 pr-4 py-3 border rounded-xl text-xs focus:outline-none focus:ring-4 transition-all duration-300 ${
                            isDark 
                              ? 'bg-white/5 border-white/10 hover:border-white/20 focus:border-blue-500 text-white placeholder-slate-500 focus:ring-blue-500/10' 
                              : 'bg-white/80 border-slate-200 hover:border-slate-300 focus:border-blue-500 text-slate-800 placeholder-slate-400 focus:ring-blue-500/10'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Login (Cadastro Numérico)
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute inset-0 rounded-xl blur opacity-0 group-hover/input:opacity-100 transition duration-500 ${
                        isDark ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10'
                      }`} />
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                          isDark ? 'text-slate-500 group-hover/input:text-blue-400' : 'text-slate-400 group-hover/input:text-blue-500'
                        }`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={regLogin}
                          onChange={(e) => setRegLogin(e.target.value)}
                          placeholder="Ex: 12345"
                          className={`w-full pl-11 pr-4 py-3 border rounded-xl text-xs focus:outline-none focus:ring-4 transition-all duration-300 ${
                            isDark 
                              ? 'bg-white/5 border-white/10 hover:border-white/20 focus:border-blue-500 text-white placeholder-slate-500 focus:ring-blue-500/10' 
                              : 'bg-white/80 border-slate-200 hover:border-slate-300 focus:border-blue-500 text-slate-800 placeholder-slate-400 focus:ring-blue-500/10'
                          }`}
                        />
                      </div>
                    </div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Apenas números (ex: 12345)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      E-mail
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute inset-0 rounded-xl blur opacity-0 group-hover/input:opacity-100 transition duration-500 ${
                        isDark ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10'
                      }`} />
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                          isDark ? 'text-slate-500 group-hover/input:text-blue-400' : 'text-slate-400 group-hover/input:text-blue-500'
                        }`}>
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="exemplo@email.com"
                          className={`w-full pl-11 pr-4 py-3 border rounded-xl text-xs focus:outline-none focus:ring-4 transition-all duration-300 ${
                            isDark 
                              ? 'bg-white/5 border-white/10 hover:border-white/20 focus:border-blue-500 text-white placeholder-slate-500 focus:ring-blue-500/10' 
                              : 'bg-white/80 border-slate-200 hover:border-slate-300 focus:border-blue-500 text-slate-800 placeholder-slate-400 focus:ring-blue-500/10'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Senha
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute inset-0 rounded-xl blur opacity-0 group-hover/input:opacity-100 transition duration-500 ${
                        isDark ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20' : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10'
                      }`} />
                      <div className="relative">
                        <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                          isDark ? 'text-slate-500 group-hover/input:text-blue-400' : 'text-slate-400 group-hover/input:text-blue-500'
                        }`}>
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showRegPassword ? "text" : "password"}
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className={`w-full pl-11 pr-11 py-3 border rounded-xl text-xs focus:outline-none focus:ring-4 transition-all duration-300 ${
                            isDark 
                              ? 'bg-white/5 border-white/10 hover:border-white/20 focus:border-blue-500 text-white placeholder-slate-500 focus:ring-blue-500/10' 
                              : 'bg-white/80 border-slate-200 hover:border-slate-300 focus:border-blue-500 text-slate-800 placeholder-slate-400 focus:ring-blue-500/10'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${
                            isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Mínimo 6 caracteres
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className={`flex-1 py-3 px-4 border rounded-xl text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                        isDark 
                          ? 'border-white/10 hover:bg-white/5 text-slate-300' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar
                    </button>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/40 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer relative overflow-hidden group/btn"
                    >
                      {regLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>Solicitar Cadastro</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {mode === "success" && (
              <div className="text-center py-4 animate-fade-in">
                <div className="relative inline-flex mb-6">
                  <div className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-xl opacity-70 animate-pulse" />
                  <div className="relative inline-flex items-center justify-center p-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full shadow-lg shadow-emerald-500/30 text-white">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                </div>

                <h1 className={`font-display text-2xl font-bold tracking-tight mb-3 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  Solicitação Enviada! 🎉
                </h1>
                
                <p className={`text-sm mb-4 leading-relaxed px-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  Olá, <span className="text-emerald-400 font-semibold">{regName}</span>! Sua solicitação de cadastro para o usuário <span className="text-blue-400 font-semibold font-mono">{regLogin}</span> foi enviada para análise.
                </p>

                <div className={`bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6 text-emerald-400 text-xs font-semibold backdrop-blur-sm max-w-sm mx-auto ${
                  isDark ? '' : 'bg-emerald-50'
                }`}>
                  <p className="mb-1">⏰ Tempo para resposta: até 24 horas</p>
                  <p className={`text-[10px] font-normal ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>Seu acesso será liberado após a homologação do administrador.</p>
                </div>

                <p className={`text-xs mb-6 italic ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Agradecemos pela paciência e preferência! 🙏
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setRegName("");
                    setRegLogin("");
                    setRegPassword("");
                    setRegEmail("");
                    setMode("login");
                  }}
                  className={`w-full py-3 px-4 border rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                    isDark 
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o Login
                </button>
              </div>
            )}

          </div>
        </div>

        <div className={`text-center mt-6 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <p className="text-[10px] font-medium uppercase tracking-widest flex items-center justify-center gap-2">
            <span className={`w-1 h-1 rounded-full ${
              isDark ? 'bg-slate-600' : 'bg-slate-300'
            }`} />
            Planejamento PPCP • GPA 2026
            <span className={`w-1 h-1 rounded-full ${
              isDark ? 'bg-slate-600' : 'bg-slate-300'
            }`} />
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float {
          animation: float infinite ease-in-out;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}