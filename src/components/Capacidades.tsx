import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown, ChevronRight, Edit2, RefreshCw, Info,
  Calendar, Layers, Database, Building, HelpCircle, Package, Truck, Activity, Sparkles,
  Download, FileSpreadsheet
} from "lucide-react";
import * as XLSX from "xlsx";
import { Capacidade, Filters } from "../types";
import EditCapacityModal from "./EditCapacityModal";
import { CATEGORIAS_POR_CD, generateMockCapacidades } from "../mockData";

const API_BASE_URL = '/api';
const CAPACIDADES_ENDPOINT = '/capacidades';

// ✅ Função para calcular a semana do mês (1-5)
function getWeekOfMonth(day: number): number {
  return Math.ceil(day / 7);
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "--";
  return num.toLocaleString("pt-BR");
}

interface CapacidadesProps {
  activeTab: "inbound" | "outbound";
  user: any;
  showNotification: (msg: string) => void;
  onOpenMetasModal: () => void;
  onTabChange: (tab: "inbound" | "outbound") => void;
}

export default function Capacidades({ activeTab, user, showNotification, onOpenMetasModal, onTabChange }: CapacidadesProps) {
  const [rawCapacidades, setRawCapacidades] = useState<Capacidade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ cd: "all", mes: "all", categoria: "all" });
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTargetDay, setEditTargetDay] = useState<any>(undefined);
  const [showKpis, setShowKpis] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<{
    normal: number;
    remunerada: number;
    total: number;
    x: number;
    y: number;
    cd: string | number;
    categoria: string;
    dateStr: string;
  } | null>(null);

  const fetchCapacidades = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg(null);
    try {
      const headers: Record<string, string> = { 
        'Accept': 'application/json', 
        'Content-Type': 'application/json' 
      };
      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
      const response = await fetch(`${API_BASE_URL}${CAPACIDADES_ENDPOINT}`, {
        method: 'GET', 
        headers,
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setRawCapacidades(data);
      } else {
        setRawCapacidades(generateMockCapacidades());
      }
    } catch (err: any) { 
      console.warn("⚠️ API offline, carregando banco simulado de capacidades:", err);
      setRawCapacidades(generateMockCapacidades());
      setErrorMsg(null); 
    } finally { 
      if (!silent) setIsLoading(false); 
    }
  }, []);

  useEffect(() => { fetchCapacidades(); }, [fetchCapacidades]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCapacidades(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchCapacidades]);

  // ✅ handleSaveCapacity CORRIGIDO - Usa PUT em vez de POST
  const handleSaveCapacity = async (payload: any) => {
    if (!user || user.role !== "admin") { 
      showNotification("❌ Apenas administradores podem editar!"); 
      return; 
    }
    try {
      let rawItem = payload.raw;
      
      // Se não veio raw, busca pelo id
      if (!rawItem && payload.id) {
        const found = rawCapacidades.find(item => item.id === payload.id);
        if (found) {
          rawItem = found;
        }
      }
      
      if (!rawItem) {
        showNotification("❌ Dados do registro ausentes.");
        console.error('❌ rawItem não encontrado:', payload);
        return;
      }
      
      console.log('📦 rawItem encontrado:', rawItem);
      
      const dataMovimentacao = rawItem.dataMovimentacao;
      const parts = dataMovimentacao.split("-");
      const ano = parseInt(parts[0], 10);
      const mes = parseInt(parts[1], 10);
      const dia = parseInt(parts[2], 10);
      
      const semana = getWeekOfMonth(dia);
      
      console.log(`📅 Data: ${dataMovimentacao} -> Semana ${semana} (dia ${dia})`);

      // ✅ Monta o body com os dados atualizados
      const body: any = {
        id: rawItem.id,
        dataMovimentacao: dataMovimentacao,
        cd: rawItem.cd,
        categoria: rawItem.categoria,
        semana: semana,
        ano: ano,
        mes: mes,
        dia: dia
      };

      // ✅ Mantém Inbound e Outbound perfeitamente interligados
      if (activeTab === "inbound") {
        const inVal = payload.capacidadeInbound !== undefined && payload.capacidadeInbound !== null 
          ? Number(payload.capacidadeInbound) 
          : rawItem.capacidadeInbound || 0;
        body.capacidadeInbound = inVal;
        body.recebimentoRemunerado = payload.recebimentoRemunerado !== undefined && payload.recebimentoRemunerado !== null 
          ? Number(payload.recebimentoRemunerado) 
          : rawItem.recebimentoRemunerado || null;
        
        // Outbound balanceado com Inbound (58% Fracionado + 42% Fechado)
        const frac = Math.round(inVal * 0.58);
        body.capacidadeOutboundFracionado = frac;
        body.capacidadeOutboundFechado = inVal - frac;
      } else if (activeTab === "outbound") {
        const fracVal = payload.capacidadeOutboundFracionado !== undefined && payload.capacidadeOutboundFracionado !== null 
          ? Number(payload.capacidadeOutboundFracionado) 
          : rawItem.capacidadeOutboundFracionado || 0;
        const fechVal = payload.capacidadeOutboundFechado !== undefined && payload.capacidadeOutboundFechado !== null 
          ? Number(payload.capacidadeOutboundFechado) 
          : rawItem.capacidadeOutboundFechado || 0;
        
        body.capacidadeOutboundFracionado = fracVal;
        body.capacidadeOutboundFechado = fechVal;
        body.capacidadeInbound = fracVal + fechVal;
      }

      console.log('📤 Enviando para API (PUT):', body);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }

      // ✅ CORRIGIDO: Usa PUT em vez de POST
      const res = await fetch(`${API_BASE_URL}${CAPACIDADES_ENDPOINT}/${rawItem.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errorText}`);
      }
      
      showNotification("✅ Capacidade atualizada!");
      await fetchCapacidades();
    } catch (err) {
      console.error('❌ Erro ao salvar:', err);
      showNotification(`❌ Erro ao salvar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  };

  const filterOptions = useMemo(() => {
    const cds = new Set<number>(), meses = new Set<string>(), categorias = new Set<string>();
    rawCapacidades.forEach(i => { 
      if (i.cd) cds.add(i.cd); 
      if (i.dataMovimentacao) meses.add(i.dataMovimentacao.substring(0,7)); 
      if (i.categoria) categorias.add(i.categoria); 
    });
    return { 
      cds: Array.from(cds).sort((a,b) => a-b), 
      meses: Array.from(meses).sort(), 
      categorias: Array.from(categorias).sort() 
    };
  }, [rawCapacidades]);

  const processedData = useMemo(() => {
    const filtered = rawCapacidades.filter(i => {
      const mCd = filters.cd === "all" || String(i.cd) === filters.cd;
      const mMes = filters.mes === "all" || i.dataMovimentacao.startsWith(filters.mes);
      const mCat = filters.categoria === "all" || i.categoria === filters.categoria;
      return mCd && mMes && mCat;
    });
    
    const monthsMap: Record<string, Capacidade[]> = {};
    filtered.forEach(i => { 
      const k = i.dataMovimentacao.substring(0,7); 
      if (!monthsMap[k]) monthsMap[k] = []; 
      monthsMap[k].push(i); 
    });
    
    const mn: Record<string,string> = {
      "01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril",
      "05":"Maio","06":"Junho","07":"Julho","08":"Agosto",
      "09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"
    };
    
    return Object.keys(monthsMap).sort().map(k => {
      const items = monthsMap[k];
      const y = k.substring(0,4);
      const mon = k.substring(5,7);
      const name = `${mn[mon]||"Mês"} de ${y}`;
      
      const sortedDays = [...items].sort((a,b) => a.dataMovimentacao.localeCompare(b.dataMovimentacao));
      const wd = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
      
      const days = sortedDays.map(x => { 
        const d = new Date(x.dataMovimentacao+"T12:00:00");
        const dia = x.dataMovimentacao.split("-")[2];
        const mesNum = x.dataMovimentacao.split("-")[1];
        const anoNum = x.dataMovimentacao.split("-")[0];
        const semana = getWeekOfMonth(parseInt(dia));
        
        return { 
          id: x.id, 
          dateStr: `${dia}/${mesNum}/${anoNum} (${wd[d.getDay()]})`,
          dia: parseInt(dia),
          mes: parseInt(mesNum),
          ano: parseInt(anoNum),
          semana: semana,
          weekday: wd[d.getDay()], 
          capacidadeInbound: x.capacidadeInbound, 
          capacidadeOutboundFracionado: x.capacidadeOutboundFracionado, 
          capacidadeOutboundFechado: x.capacidadeOutboundFechado, 
          recebimentoRemunerado: x.recebimentoRemunerado,
          raw: x 
        }; 
      });
      
      const uniqueCds = Array.from(new Set(items.map(x => x.cd).filter(Boolean))).sort((a,b) => Number(a) - Number(b));
      const uniqueCats = Array.from(new Set(items.map(x => x.categoria).filter(Boolean)));
      
      return { 
        monthKey: k, 
        monthName: name, 
        capacidadeInbound: items.reduce((a,c) => a + (c.capacidadeInbound || 0) + (c.recebimentoRemunerado || 0), 0), 
        capacidadeOutboundFracionado: items.reduce((a,c) => a + (c.capacidadeOutboundFracionado || 0), 0), 
        capacidadeOutboundFechado: items.reduce((a,c) => a + (c.capacidadeOutboundFechado || 0), 0), 
        days, 
        cd: uniqueCds.length === 1 ? uniqueCds[0] : null, 
        categoria: uniqueCats.length === 1 ? uniqueCats[0] : "Múltiplas",
        uniqueCds,
        uniqueCats
      };
    });
  }, [rawCapacidades, filters]);

  const totalSummary = useMemo(() => {
    let inbound = 0, frac = 0, fech = 0, remunerada = 0;
    
    const filtered = rawCapacidades.filter(i => {
      const mCd = filters.cd === "all" || String(i.cd) === filters.cd;
      const mMes = filters.mes === "all" || i.dataMovimentacao.startsWith(filters.mes);
      const mCat = filters.categoria === "all" || i.categoria === filters.categoria;
      return mCd && mMes && mCat;
    });
    
    filtered.forEach(i => { 
      inbound += (i.capacidadeInbound || 0) + (i.recebimentoRemunerado || 0); 
      frac += i.capacidadeOutboundFracionado || 0; 
      fech += i.capacidadeOutboundFechado || 0; 
      remunerada += i.recebimentoRemunerado || 0;
    });
    
    return { inbound, outboundFracionado: frac, outboundFechado: fech, outbound: frac + fech, remunerada };
  }, [rawCapacidades, filters]);

  const handleEditClick = (e: React.MouseEvent, day: any) => { 
    e.stopPropagation(); 
    if (!user || user.role !== "admin") {
      showNotification("❌ Apenas administradores podem editar!");
      return; 
    }
    setEditTargetDay({ 
      id: day.id, 
      dateStr: day.dateStr, 
      dia: day.dia,
      mes: day.mes,
      ano: day.ano,
      semana: day.semana,
      capacidadeInbound: day.capacidadeInbound, 
      recebimentoRemunerado: day.recebimentoRemunerado,
      capacidadeOutboundFracionado: day.capacidadeOutboundFracionado, 
      capacidadeOutboundFechado: day.capacidadeOutboundFechado, 
      raw: day.raw 
    }); 
    setIsEditOpen(true); 
  };

  const accentTheme = activeTab === "inbound" ? {
    bgButton: "bg-blue-600 hover:bg-blue-700", 
    textAccent: "text-blue-600 font-semibold", 
    glow: "shadow-blue-500/10", 
    rowHighlight: "border-l-4 border-blue-600", 
    bgHover: "hover:bg-blue-50/40", 
    tabActive: "bg-blue-600 text-white shadow-md"
  } : {
    bgButton: "bg-indigo-600 hover:bg-indigo-700", 
    textAccent: "text-indigo-600 font-semibold", 
    glow: "shadow-indigo-500/10", 
    rowHighlight: "border-l-4 border-indigo-600", 
    bgHover: "hover:bg-purple-50/40", 
    tabActive: "bg-indigo-600 text-white shadow-md"
  };

  const handleExportExcel = useCallback(() => {
    if (rawCapacidades.length === 0) {
      showNotification("⚠️ Nenhum dado disponível para exportação.");
      return;
    }

    const filtered = rawCapacidades.filter(i => {
      const mCd = filters.cd === "all" || String(i.cd) === filters.cd;
      const mMes = filters.mes === "all" || i.dataMovimentacao.startsWith(filters.mes);
      const mCat = filters.categoria === "all" || i.categoria === filters.categoria;
      return mCd && mMes && mCat;
    });

    if (filtered.length === 0) {
      showNotification("⚠️ Nenhum registro encontrado para os filtros selecionados.");
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      if (a.dataMovimentacao !== b.dataMovimentacao) {
        return a.dataMovimentacao.localeCompare(b.dataMovimentacao);
      }
      if (a.cd !== b.cd) return Number(a.cd) - Number(b.cd);
      return (a.categoria || "").localeCompare(b.categoria || "");
    });

    const wd = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const mn: Record<string, string> = {
      "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril",
      "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
      "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
    };

    // 1. Agrupamento / Soma por Mês + CD + Categoria (Consolidado por Mês)
    const summaryMap: Record<string, {
      mesAnoKey: string;
      mesAnoLabel: string;
      cd: number | string;
      categoria: string;
      capacidadeFracionada: number;
      capacidadeFechada: number;
      totalOutbound: number;
      capacidadeInbound: number;
      inboundRemunerado: number;
      totalInbound: number;
      diasRegistrados: number;
    }> = {};

    sorted.forEach(item => {
      const mesKey = item.dataMovimentacao.substring(0, 7);
      const [y, m] = mesKey.split("-");
      const mesAnoLabel = `${mn[m] || m}/${y}`;
      const groupKey = `${mesKey}_${item.cd}_${item.categoria}`;

      if (!summaryMap[groupKey]) {
        summaryMap[groupKey] = {
          mesAnoKey: mesKey,
          mesAnoLabel,
          cd: item.cd,
          categoria: item.categoria,
          capacidadeFracionada: 0,
          capacidadeFechada: 0,
          totalOutbound: 0,
          capacidadeInbound: 0,
          inboundRemunerado: 0,
          totalInbound: 0,
          diasRegistrados: 0
        };
      }

      const frac = item.capacidadeOutboundFracionado || 0;
      const fech = item.capacidadeOutboundFechado || 0;
      const inb = item.capacidadeInbound || 0;
      const rem = item.recebimentoRemunerado || 0;

      summaryMap[groupKey].capacidadeFracionada += frac;
      summaryMap[groupKey].capacidadeFechada += fech;
      summaryMap[groupKey].totalOutbound += (frac + fech);
      summaryMap[groupKey].capacidadeInbound += inb;
      summaryMap[groupKey].inboundRemunerado += rem;
      summaryMap[groupKey].totalInbound += (inb + rem);
      summaryMap[groupKey].diasRegistrados += 1;
    });

    const summaryRows = Object.values(summaryMap).sort((a, b) => {
      if (a.mesAnoKey !== b.mesAnoKey) return a.mesAnoKey.localeCompare(b.mesAnoKey);
      if (a.cd !== b.cd) return Number(a.cd) - Number(b.cd);
      return a.categoria.localeCompare(b.categoria);
    }).map(s => ({
      "Mês": s.mesAnoLabel,
      "CD": s.cd,
      "Categoria": s.categoria,
      "Capacidade Fracionada": s.capacidadeFracionada,
      "Capacidade Fechada": s.capacidadeFechada,
      "Total Outbound": s.totalOutbound,
      "Capacidade Inbound": s.totalInbound,
      "Dias com Dados": s.diasRegistrados
    }));

    // 2. Detalhamento Consolidado por Dia
    const dailyRows = sorted.map(item => {
      const parts = item.dataMovimentacao.split("-");
      const dObj = new Date(item.dataMovimentacao + "T12:00:00");
      const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      const weekDay = wd[dObj.getDay()];
      const mesAnoLabel = `${mn[parts[1]] || parts[1]}/${parts[0]}`;

      const capFrac = item.capacidadeOutboundFracionado || 0;
      const capFech = item.capacidadeOutboundFechado || 0;
      const totOut = capFrac + capFech;
      const capInb = item.capacidadeInbound || 0;
      const recRem = item.recebimentoRemunerado || 0;
      const totInb = capInb + recRem;

      return {
        "Data": formattedDate,
        "Dia da Semana": weekDay,
        "Mês": mesAnoLabel,
        "CD": item.cd,
        "Categoria": item.categoria,
        "Capacidade Fracionada": capFrac,
        "Capacidade Fechada": capFech,
        "Total Outbound": totOut,
        "Capacidade Inbound": totInb,
        "Inbound Normal": capInb,
        "Inbound Extra (Remun.)": recRem
      };
    });

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsDaily = XLSX.utils.json_to_sheet(dailyRows);

    wsSummary["!cols"] = [
      { wch: 18 }, // Mês
      { wch: 10 }, // CD
      { wch: 22 }, // Categoria
      { wch: 24 }, // Capacidade Fracionada
      { wch: 22 }, // Capacidade Fechada
      { wch: 18 }, // Total Outbound
      { wch: 20 }, // Capacidade Inbound
      { wch: 16 }  // Dias com Dados
    ];

    wsDaily["!cols"] = [
      { wch: 14 }, // Data
      { wch: 16 }, // Dia da Semana
      { wch: 18 }, // Mês
      { wch: 10 }, // CD
      { wch: 22 }, // Categoria
      { wch: 24 }, // Capacidade Fracionada
      { wch: 22 }, // Capacidade Fechada
      { wch: 18 }, // Total Outbound
      { wch: 20 }, // Capacidade Inbound
      { wch: 18 }, // Inbound Normal
      { wch: 24 }  // Inbound Extra (Remun.)
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, "Consolidado por Mês");
    XLSX.utils.book_append_sheet(wb, wsDaily, "Consolidado por Dia");

    const cdSuffix = filters.cd !== "all" ? `_CD${filters.cd}` : "";
    const mesSuffix = filters.mes !== "all" ? `_${filters.mes}` : "";
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `Capacidades_Consolidado${cdSuffix}${mesSuffix}_${dateStamp}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showNotification(`✅ Planilha Excel gerada com sucesso: ${fileName}`);
  }, [rawCapacidades, filters, showNotification]);

  return (
    <>
      <div className="">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 px-6 py-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" /> CD
            </label>
            <select
              value={filters.cd}
              onChange={e => {
                const newCd = e.target.value;
                setFilters(f => {
                  const allowed = newCd === "all"
                    ? Object.values(CATEGORIAS_POR_CD).flat()
                    : (CATEGORIAS_POR_CD[newCd] || []);
                  const newCat = (f.categoria === "all" || allowed.includes(f.categoria)) ? f.categoria : "all";
                  return { ...f, cd: newCd, categoria: newCat };
                });
              }}
              className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
            >
              <option value="all">Todos os CDs</option>
              {filterOptions.cds.map(cd => (
                <option key={cd} value={String(cd)}>CD {cd}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Mês
            </label>
            <select
              value={filters.mes}
              onChange={e => setFilters(f => ({ ...f, mes: e.target.value }))}
              className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
            >
              <option value="all">Todos os Meses</option>
              {filterOptions.meses.map(m => {
                const [y, mon] = m.split("-");
                const n: Record<string, string> = {
                  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
                  "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
                };
                return <option key={m} value={m}>{n[mon]} {y}</option>;
              })}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Categoria
            </label>
            <select
              value={filters.categoria}
              onChange={e => setFilters(f => ({ ...f, categoria: e.target.value }))}
              className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
            >
              <option value="all">Todas</option>
              {(filters.cd === "all"
                ? filterOptions.categorias
                : (CATEGORIAS_POR_CD[filters.cd] || [])
              ).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end col-span-1 md:col-span-2 justify-end gap-2">
            <button
              onClick={handleExportExcel}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/40 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
              title="Download dos dados consolidados por mês e por dia (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Baixar Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col gap-6">
        
        {/* Info Banner com botões Inbound/Outbound */}
        <div className="border-b border-slate-200/80 dark:border-slate-700/80 pb-2 flex items-center justify-between">
          <div className="flex gap-6">
            <button
              id="tab-inbound"
              onClick={() => onTabChange("inbound")}
              className={`px-2 py-2 text-xs font-bold transition-all duration-200 cursor-pointer relative ${
                activeTab === "inbound" 
                  ? "text-blue-600 dark:text-blue-400 font-extrabold" 
                  : "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-300"
              }`}
            >
              Inbound
              {activeTab === "inbound" && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
            
            <button
              id="tab-outbound"
              onClick={() => onTabChange("outbound")}
              className={`px-2 py-2 text-xs font-bold transition-all duration-200 cursor-pointer relative ${
                activeTab === "outbound" 
                  ? "text-indigo-600 dark:text-indigo-400 font-extrabold" 
                  : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300"
              }`}
            >
              Outbound
              {activeTab === "outbound" && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Download Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>XLSX</span>
            </button>

            <button
              onClick={() => setShowKpis(!showKpis)}
              className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer text-slate-600 dark:text-slate-300"
              title={showKpis ? "Ocultar Cards" : "Exibir Cards"}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showKpis ? "rotate-180" : ""}`} />
              <span>{showKpis ? "Ocultar Cards" : "Exibir Cards"}</span>
            </button>
          </div>
        </div>

        {/* ✅ Bento Grid de KPIs - DINÂMICO CONFORME ABA */}
        <AnimatePresence initial={false}>
          {showKpis && (
            <motion.div 
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {activeTab === "inbound" ? (
                  // ✅ INBOUND - Mostra apenas 4 cards relacionados
                  <>
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Inbound Total</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{formatNumber(totalSummary.inbound)}</h3>
                        <span className="text-[9px] text-slate-400">Metas diárias somadas</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-green-50 text-green-600 border border-green-100">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Período Ativo</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{filters.mes !== "all" ? filters.mes : "Todos"}</h3>
                        <span className="text-[9px] text-slate-400">Mês selecionado</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Categorias</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{filterOptions.categorias.length}</h3>
                        <span className="text-[9px] text-slate-400">Ativas no filtro</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Total Extra / Remun.</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{formatNumber(totalSummary.remunerada)}</h3>
                        <span className="text-[9px] text-slate-400">Capacidade extra contratada</span>
                      </div>
                    </div>
                  </>
                ) : (
                  // ✅ OUTBOUND - Mostra Fracionado, Fechado e Total
                  <>
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Capacidade Fracionada</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{formatNumber(totalSummary.outboundFracionado)}</h3>
                        <span className="text-[9px] text-slate-400">Total de cargas fracionadas</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Capacidade Fechada</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{formatNumber(totalSummary.outboundFechado)}</h3>
                        <span className="text-[9px] text-slate-400">Total de Cargas fechadas</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Total Capacidade</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{formatNumber(totalSummary.outboundFracionado + totalSummary.outboundFechado)}</h3>
                        <span className="text-[9px] text-slate-400">Fracionado + Fechado</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Registros</p>
                        <h3 className="text-lg font-black font-mono text-slate-900 mt-1">{processedData.length}</h3>
                        <span className="text-[9px] text-slate-400">Meses com dados</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table Container */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
          <div className="overflow-y-auto max-h-[600px]">
            {isLoading && rawCapacidades.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-slate-400">
                <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="text-xs font-medium">Carregando dados de logística...</p>
              </div>
            ) : errorMsg && rawCapacidades.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center">
                <div className="text-4xl mb-4">🔌</div>
                <p className="text-sm font-bold text-red-600">Erro de conexão</p>
                <p className="text-xs text-slate-500 mt-2">{errorMsg}</p>
                <button
                  onClick={() => fetchCapacidades()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-700"
                >
                  Tentar novamente
                </button>
              </div>
            ) : processedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-slate-400 text-center">
                <HelpCircle className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-xs font-bold text-slate-700">Nenhum registro encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 backdrop-blur-md text-slate-500 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-20 border-b border-slate-200/60">
                    <th className="py-4 px-6 font-bold">Período / Dia</th>
                    <th className="py-4 px-4 text-center font-bold">CD</th>
                    <th className="py-4 px-4 text-center font-bold">Categoria</th>
                    {activeTab === "inbound" ? (
                      <th className="py-4 px-4 text-right font-bold">Capacidade. Inbound</th>
                    ) : (
                      <>
                        <th className="py-4 px-4 text-right font-bold">Capacit. Fracionado</th>
                        <th className="py-4 px-4 text-right font-bold">Capacit. Fechado</th>
                      </>
                    )}
                    <th className="py-4 px-4 text-center font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {processedData.map(month => {
                    const mid = `month:${month.monthKey}`, isM = !!expandedMonths[mid];
                    return (
                      <React.Fragment key={month.monthKey}>
                        <tr
                          onClick={() => setExpandedMonths(p => ({ ...p, [mid]: !p[mid] }))}
                          className={`group cursor-pointer border-b border-slate-150 transition-all duration-200 ${accentTheme.bgHover} ${isM ? 'bg-slate-50 font-bold text-slate-900' : 'bg-white'}`}
                        >
                          <td className="py-4.5 px-6 font-extrabold text-slate-800 flex items-center gap-3">
                            <div className="p-1 rounded-lg bg-slate-100 group-hover:bg-blue-50 transition-colors">
                              {isM ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                            </div>
                            <span className="tracking-tight text-sm font-bold">{month.monthName}</span>
                          </td>
                          <td className="py-4.5 px-4 text-center font-semibold text-slate-700">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono border border-slate-200/50 dark:border-slate-600/50 text-slate-600 dark:text-slate-400">
                              {month.uniqueCds && month.uniqueCds.length > 1 
                                ? "CDs" 
                                : month.uniqueCds && month.uniqueCds.length === 1 
                                  ? `CD ${month.uniqueCds[0]}` 
                                  : month.cd 
                                    ? `CD ${month.cd}` 
                                    : "CDs"}
                            </span>
                          </td>
                          <td className="py-4.5 px-4 text-center text-slate-600 font-semibold">
                            {month.uniqueCats && month.uniqueCats.length > 1 ? "Múltiplas" : month.categoria}
                          </td>
                          {activeTab === "inbound" ? (
                            <td className="py-4.5 px-4 text-right font-mono text-blue-600 font-extrabold text-sm">{formatNumber(month.capacidadeInbound)}</td>
                          ) : (
                            <>
                              <td className="py-4.5 px-4 text-right font-mono text-indigo-600 font-extrabold text-sm">{formatNumber(month.capacidadeOutboundFracionado)}</td>
                              <td className="py-4.5 px-4 text-right font-mono text-sky-600 font-extrabold text-sm">{formatNumber(month.capacidadeOutboundFechado)}</td>
                            </>
                          )}
                          <td className="py-4.5 px-4 text-center">
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 italic font-semibold">Editar dias</span>
                          </td>
                        </tr>
                         {isM && month.days.map(day => {
                           const hasRem = activeTab === "inbound" && day.raw.recebimentoRemunerado && day.raw.recebimentoRemunerado > 0;
                           return (
                             <tr
                               key={day.id}
                               className={`border-b border-slate-100 transition-colors duration-150 ${
                                 hasRem 
                                   ? "bg-emerald-50/40 dark:bg-emerald-950/15 hover:bg-emerald-100/50 text-slate-700 border-l-4 border-emerald-500 font-medium" 
                                   : `bg-white hover:bg-blue-50/20 ${accentTheme.rowHighlight}`
                               }`}
                             >
                               <td className="py-3 pl-12 pr-4 text-slate-600 font-semibold font-mono text-[11px]">{day.dateStr}</td>
                               <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{day.raw.cd}</td>
                               <td className="py-3 px-4 text-center text-slate-600 text-[11px] font-semibold">{day.raw.categoria}</td>
                               {activeTab === "inbound" ? (
                                 <td 
                                   className={`py-3 px-4 text-right font-mono text-[11px] font-bold ${
                                     hasRem 
                                       ? "text-emerald-600 dark:text-emerald-400 cursor-help font-extrabold" 
                                       : "text-blue-600"
                                   }`}
                                   onMouseMove={(e) => {
                                     if (hasRem) {
                                       setHoveredDay({
                                         normal: day.capacidadeInbound || 0,
                                         remunerada: day.raw.recebimentoRemunerado || 0,
                                         total: (day.capacidadeInbound || 0) + (day.raw.recebimentoRemunerado || 0),
                                         x: e.clientX,
                                         y: e.clientY,
                                         cd: day.raw.cd,
                                         categoria: day.raw.categoria,
                                         dateStr: day.dateStr
                                       });
                                     }
                                   }}
                                   onMouseLeave={() => setHoveredDay(null)}
                                 >
                                   {hasRem ? (
                                     <span className="underline decoration-dotted decoration-emerald-400 select-none pb-0.5">
                                       {formatNumber((day.capacidadeInbound || 0) + (day.raw.recebimentoRemunerado || 0))}
                                     </span>
                                   ) : (
                                     formatNumber(day.capacidadeInbound)
                                   )}
                                 </td>
                               ) : (
                                 <>
                                   <td className="py-3 px-4 text-right font-mono text-[11px] text-indigo-600 font-bold">{formatNumber(day.capacidadeOutboundFracionado)}</td>
                                   <td className="py-3 px-4 text-right font-mono text-[11px] text-sky-600 font-bold">{formatNumber(day.capacidadeOutboundFechado)}</td>
                                 </>
                               )}
                               <td className="py-3 px-4 text-center">
                                 <button
                                   disabled={user.role !== "admin"}
                                   onClick={e => handleEditClick(e, day)}
                                   className={`p-2 rounded-xl border transition-all duration-200 active:scale-90 ${
                                     user.role === "admin"
                                       ? hasRem
                                         ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white cursor-pointer shadow-sm hover:shadow-md"
                                         : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-blue-600 hover:border-blue-600 hover:text-white cursor-pointer shadow-sm hover:shadow-md"
                                       : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                   }`}
                                 >
                                   <Edit2 className="w-3.5 h-3.5" />
                                 </button>
                               </td>
                             </tr>
                           );
                         })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="mt-auto p-6 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-[11px] text-slate-500 text-center sm:text-left">
              {/* <p className="font-bold text-emerald-600 flex items-center gap-1.5 justify-center sm:justify-start">
                <Database className="w-3.5 h-3.5" /> API {activeTab}:
              </p> */}
              {/* <span>Endpoint: <span className="font-mono text-emerald-600">{API_BASE_URL}{CAPACIDADES_ENDPOINT}</span></span> */}
            </div>
            <div className="flex gap-6">
              {activeTab === "inbound" ? (
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Total Inbound</p>
                  <p className="text-xl font-mono text-blue-600 font-black">{formatNumber(totalSummary.inbound)}</p>
                </div>
              ) : (
                <>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Fracionado</p>
                    <p className="text-xl font-mono text-indigo-600 font-black">{formatNumber(totalSummary.outboundFracionado)}</p>
                  </div>
                  <div className="text-right border-l border-slate-250 pl-6">
                    <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Fechado</p>
                    <p className="text-xl font-mono text-sky-600 font-black">{formatNumber(totalSummary.outboundFechado)}</p>
                  </div>
                  <div className="text-right border-l border-slate-250 pl-6">
                    <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">Consolidado</p>
                    <p className="text-xl font-mono text-slate-800 font-black">{formatNumber(totalSummary.outboundFracionado + totalSummary.outboundFechado)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <EditCapacityModal 
        isOpen={isEditOpen} 
        onClose={() => {
          setIsEditOpen(false);
          setEditTargetDay(undefined);
        }} 
        onSave={handleSaveCapacity} 
        editMode={activeTab} 
        targetDay={editTargetDay} 
      />

      {/* ✅ Balão/Popup de Capacidade Remunerada estilizado */}
      {/* ✅ Balão/Popup de Capacidade Remunerada estilizado - POSIÇÃO CORRIGIDA */}
{hoveredDay && (
  <div 
    className="fixed bg-slate-950 text-white text-[11px] rounded-2xl p-4 shadow-2xl z-55 w-64 text-left pointer-events-none border border-slate-800 leading-relaxed font-sans transition-all duration-150 animate-in fade-in zoom-in-95"
    style={{
      left: `${hoveredDay.x}px`,
      top: `${hoveredDay.y - 12}px`,
      transform: "translate(-50%, -100%)",
    }}
  >
    {/* Cabeçalho do Tooltip */}
    <div className="font-bold text-emerald-400 border-b border-slate-800 pb-2.5 mb-2.5 flex items-center justify-between">
      <span className="flex items-center gap-1.5 font-bold tracking-tight">
        <Building className="w-3.5 h-3.5 text-emerald-400" />
        CD {hoveredDay.cd}
      </span>
      <span className="px-2 py-0.5 rounded-lg text-[8px] uppercase tracking-wider font-extrabold bg-emerald-500/20 text-emerald-400 animate-pulse border border-emerald-500/10">
        Extra Remun.
      </span>
    </div>
    
    <div className="text-[10px] text-slate-400 mb-3 font-bold flex items-center gap-1.5">
      <Calendar className="w-3.5 h-3.5 text-slate-500" />
      <span>{hoveredDay.dateStr}</span>
    </div>

    <div className="space-y-2 pt-1">
      <div className="flex justify-between items-center text-[10.5px]">
        <span className="text-slate-400 font-semibold">Capacidade Normal:</span>
        <span className="font-mono font-bold text-slate-200">{formatNumber(hoveredDay.normal)}</span>
      </div>
      <div className="flex justify-between items-center text-[10.5px]">
        <span className="text-slate-400 font-semibold flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
          Capacidade Extra:
        </span>
        <span className="font-mono text-emerald-400 font-black">+{formatNumber(hoveredDay.remunerada)}</span>
      </div>
      <div className="border-t border-slate-800 mt-3 pt-2.5 flex justify-between items-center font-bold text-[12px]">
        <span className="text-slate-100 uppercase text-[8.5px] font-black tracking-wider">Capacidade Total:</span>
        <span className="font-mono text-emerald-300 font-black bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-900/30">
          {formatNumber(hoveredDay.total)}
        </span>
      </div>
    </div>
    
    {/* Seta do tooltip apontando para baixo */}
    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-slate-950" />
  </div>
)}
    </>
  );
}