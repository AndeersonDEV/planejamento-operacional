import React, { useState, useEffect } from "react";
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
  UserCheck
} from "lucide-react";
import { User } from "../types";

interface UserControlPageProps {
  user: User | null;
  theme: "light" | "dark";
  onBack: () => void;
}

interface PendingUser {
  id: number;
  login: number | string;
  name: string;
  email: string;
  status: string;
}

export default function UserControlPage({ user, theme, onBack }: UserControlPageProps) {
  const [registrations, setRegistrations] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Track selected roles for pending accounts: default to "GA" as requested
  const [selectedRoles, setSelectedRoles] = useState<Record<number, "ADM" | "PPCP" | "GA">>({});

  const fetchRegistrations = async () => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await fetch("/api/registro", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: Não foi possível carregar as solicitações de registro.`);
      }

      const data = await response.json();
      console.log("Registros recebidos do backend:", data);
      
      if (Array.isArray(data)) {
        // Show pending users ("exibir os usuarios pendenste")
        const pendingOnly = data.filter((item: any) => String(item.status).toUpperCase() === "PENDENTE");
        setRegistrations(pendingOnly);
        
        // Initialize roles state
        const rolesMap: Record<number, "ADM" | "PPCP" | "GA"> = {};
        pendingOnly.forEach((item: PendingUser) => {
          rolesMap[item.id] = "GA"; // Default selector role
        });
        setSelectedRoles(rolesMap);
      } else {
        setRegistrations([]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar registros:", err);
      setError(err.message || "Não foi possível carregar as solicitações. Verifique se o servidor de registro está ativo e acessível.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchRegistrations();
    }
  }, [user]);

  const handleUpdateStatus = async (id: number, status: "APROVADO" | "RECUSADO") => {
    if (!user?.token) return;
    setActionLoadingId(id);
    setError(null);
    setSuccessMsg(null);

    const role = selectedRoles[id] || "GA";

    try {
      console.log(`Enviando atualização do usuário ${id}:`, { status, role });
      
      const response = await fetch(`/api/registro/${id}`, {
        method: "PUT", // Forward to correct ID path in backend
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({
          status,
          role
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: Falha ao registrar decisão.`);
      }

      setSuccessMsg(`Usuário ${status === "APROVADO" ? "APROVADO" : "RECUSADO"} com o perfil ${role}!`);
      
      // Refresh registrations to remove updated item
      await fetchRegistrations();
    } catch (err: any) {
      console.error("Erro ao atualizar registro:", err);
      setError(err.message || "Ocorreu um erro ao atualizar o registro.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRegistrations = registrations.filter(reg => 
    reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(reg.login).includes(searchTerm) ||
    reg.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-6">
      
      {/* Header and Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${theme === 'dark' ? 'border-white/10 hover:bg-white/5 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900'}`}
            title="Voltar para o Painel"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase tracking-widest">
              <Users className="w-3.5 h-3.5" />
              <span>Painel Administrativo</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight mt-0.5">
              Controle de Usuários
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aprovação e homologação de solicitações pendentes de primeiro acesso.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRegistrations}
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${theme === 'dark' ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Lista</span>
          </button>
        </div>
      </div>

      {/* Grid: Search and list */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Status Alerts */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm backdrop-blur-sm animate-shake">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Atenção:</span> {error}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2.5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm">
            <Check className="w-5 h-5 shrink-0 animate-bounce" />
            <span className="font-bold">{successMsg}</span>
          </div>
        )}

        {/* Filter Bar */}
        {registrations.length > 0 && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 ${theme === 'dark' ? 'bg-[#111827]/60 border-white/10' : 'bg-white border-slate-200/80 shadow-sm'}`}>
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nome, login ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none text-sm focus:outline-none placeholder-slate-400"
            />
          </div>
        )}

        {/* Main List Container */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="absolute -inset-2 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
              <RefreshCw className="w-10 h-10 text-blue-500 animate-spin relative" />
            </div>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">Carregando solicitações de acesso...</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className={`p-12 text-center rounded-3xl border flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-[#111827]/40 border-white/10' : 'bg-white border-slate-200/80 shadow-sm'}`}>
            <div className="p-4 rounded-full bg-slate-500/5 text-slate-400 mb-4 border border-dashed border-slate-500/20">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h3 className="text-base font-extrabold uppercase tracking-wide">Sem solicitações pendentes</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Todos os novos cadastros já foram avaliados e integrados. Novas solicitações de primeiro acesso aparecerão aqui automaticamente.
            </p>
            <button
              onClick={fetchRegistrations}
              className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
            >
              Consultar Novamente
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-2">
              <span>{filteredRegistrations.length} de {registrations.length} solicitações pendentes</span>
              <span>Filtrado por status: PENDENTE</span>
            </div>

            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                Nenhum usuário correspondente ao termo "{searchTerm}" foi encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRegistrations.map((reg) => (
                  <div 
                    key={reg.id}
                    className={`relative p-6 rounded-3xl border transition-all duration-300 hover:shadow-lg flex flex-col justify-between gap-5 overflow-hidden group ${theme === 'dark' ? 'bg-[#111827] border-white/10 hover:border-blue-500/30' : 'bg-white border-slate-200 hover:border-blue-500/30 shadow-sm'}`}
                  >
                    {/* Visual glowing border effect on hover */}
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                    
                    {/* User profile info */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-extrabold text-base tracking-tight">{reg.name}</h3>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {reg.status}
                          </span>
                        </div>
                        
                        <div className={`p-3 rounded-2xl bg-blue-500/5 text-blue-500 border border-blue-500/10`}>
                          <Users className="w-5 h-5" />
                        </div>
                      </div>

                      <hr className="border-slate-200/40 dark:border-slate-800/40" />

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-500">Cadastro (Login):</span>
                          <strong className="text-blue-500 dark:text-blue-400 font-mono text-sm">{reg.login}</strong>
                        </div>

                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-slate-500">E-mail:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 break-all">{reg.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions and role selector */}
                    <div className={`pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'} flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4`}>
                      {/* Permissao Select Dropdown */}
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Permissão de Acesso</label>
                        <select
                          value={selectedRoles[reg.id] || "GA"}
                          onChange={(e) => setSelectedRoles({
                            ...selectedRoles,
                            [reg.id]: e.target.value as "ADM" | "PPCP" | "GA"
                          })}
                          className={`w-full px-3 py-2 text-xs font-bold rounded-xl border focus:ring-4 focus:ring-blue-500/10 cursor-pointer ${theme === 'dark' ? 'bg-slate-800 border-white/10 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'}`}
                        >
                          <option value="ADM">ADM</option>
                          <option value="PPCP">PPCP</option>
                          <option value="GA">GA</option>
                        </select>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 sm:pt-5">
                        {/* Reject */}
                        <button
                          onClick={() => handleUpdateStatus(reg.id, "RECUSADO")}
                          disabled={actionLoadingId !== null}
                          className="flex-1 sm:flex-none px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/15 hover:border-rose-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 text-xs font-bold"
                          title="Recusar usuário"
                        >
                          {actionLoadingId === reg.id ? (
                            <div className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              <span>Recusar</span>
                            </>
                          )}
                        </button>

                        {/* Approve */}
                        <button
                          onClick={() => handleUpdateStatus(reg.id, "APROVADO")}
                          disabled={actionLoadingId !== null}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 text-xs font-black shadow-md shadow-emerald-500/20"
                          title="Aprovar e homologar usuário"
                        >
                          {actionLoadingId === reg.id ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4" />
                              <span>Aprovar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
