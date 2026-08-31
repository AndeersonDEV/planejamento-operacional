import React, { useState, useMemo } from "react";
import { 
  FileText, Download, TrendingUp, AlertTriangle, 
  CheckCircle, PieChart, BarChart, Calendar, Shield, MapPin, 
  ArrowUpRight, Sparkles, Filter, Info, Package, Truck
} from "lucide-react";

import { CATEGORIAS_POR_CD, CDS_LIST } from "../mockData";

interface RelatoriosProps {
  user: any;
  showNotification: (msg: string) => void;
}

export default function Relatorios({ user, showNotification }: RelatoriosProps) {
  const [selectedCD, setSelectedCD] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-07");

  // Simulated reports metrics from simulated CDs
  const cdsData = [
    { cd: "101", inbound: 1250000, outbound: 1540000, utilization: 84 },
    { cd: "205", inbound: 980000, outbound: 1100000, utilization: 72 },
    { cd: "310", inbound: 1450000, outbound: 1390000, utilization: 91 },
    { cd: "415", inbound: 850000, outbound: 950000, utilization: 65 },
    { cd: "520", inbound: 1120000, outbound: 1200000, utilization: 78 }
  ];

  const categoryShare = [
    { name: "Alimentos Secos", value: 38, color: "bg-blue-500", text: "text-blue-500" },
    { name: "Higiene & Limpeza", value: 22, color: "bg-emerald-500", text: "text-emerald-500" },
    { name: "Refrigerados", value: 18, color: "bg-indigo-500", text: "text-indigo-500" },
    { name: "Congelados", value: 14, color: "bg-amber-500", text: "text-amber-500" },
    { name: "Eletro", value: 8, color: "bg-rose-500", text: "text-rose-500" }
  ];

  const filteredCds = useMemo(() => {
    if (selectedCD === "all") return cdsData;
    return cdsData.filter(c => c.cd === selectedCD);
  }, [selectedCD]);

  const handleExport = (format: "PDF" | "XLSX") => {
    showNotification(`⏳ Gerando relatório consolidado em ${format}...`);
    setTimeout(() => {
      showNotification(`✅ Relatório exportado com sucesso no formato ${format}!`);
    }, 1500);
  };

  const getUtilColor = (val: number) => {
    if (val >= 90) return "text-rose-600 bg-rose-50 border-rose-100";
    if (val >= 80) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-emerald-600 bg-emerald-50 border-emerald-100";
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 w-full animate-fade-in">
      
      {/* Title & Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-md shadow-blue-500/10">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-tight">Painel de Relatórios Analíticos</h2>
            <p className="text-[10px] text-slate-500 font-medium">Relatórios operacionais agregados por CD e categorias</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedCD} 
              onChange={e => setSelectedCD(e.target.value)}
              className="text-xs bg-transparent border-none py-0.5 px-1 cursor-pointer font-semibold text-slate-600 focus:outline-none"
            >
              <option value="all">Todos os CDs</option>
              {cdsData.map(c => <option key={c.cd} value={c.cd}>CD {c.cd}</option>)}
            </select>
            <span className="text-slate-200">|</span>
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-xs bg-transparent border-none py-0.5 px-1 cursor-pointer font-semibold text-slate-600 focus:outline-none"
            >
              <option value="2026-07">Julho 2026</option>
              <option value="2026-06">Junho 2026</option>
            </select>
          </div>

          <button 
            onClick={() => handleExport("PDF")}
            disabled={user?.role !== "admin"}
            className={`flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-200/50 ${user?.role !== "admin" ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button 
            onClick={() => handleExport("XLSX")}
            disabled={user?.role !== "admin"}
            className={`flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-500/10 ${user?.role !== "admin" ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Download className="w-3.5 h-3.5" /> Planilha XLSX
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100"><TrendingUp className="w-5 h-5" /></span>
            <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-600 font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
              +12.4% <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Inbound Total Acumulado</p>
            <h3 className="text-xl font-black font-mono text-slate-900 mt-1">5.690.000</h3>
            <span className="text-[9px] text-slate-400 mt-1 block">Unidades recebidas no mês</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="p-2.5 rounded-xl bg-violet-50 text-violet-600 border border-violet-100"><Truck className="w-5 h-5" /></span>
            <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-600 font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
              +8.3% <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Outbound Total Expedido</p>
            <h3 className="text-xl font-black font-mono text-slate-900 mt-1">6.180.000</h3>
            <span className="text-[9px] text-slate-400 mt-1 block">Fracionado + Fechado entregues</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100"><AlertTriangle className="w-5 h-5" /></span>
            <span className="text-[10px] bg-amber-100 border border-amber-200 text-amber-700 font-extrabold px-2 py-0.5 rounded-full">
              Crítico SP
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Ocupação Média Operacional</p>
            <h3 className="text-xl font-black font-mono text-slate-900 mt-1">78.0%</h3>
            <span className="text-[9px] text-slate-400 mt-1 block">CD 310 opera com 91%</span>
          </div>
        </div>

      </div>

      {/* Main Content Sections: CD Performance & Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CD Capacidades Bars */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><BarChart className="w-4 h-4" /></span>
              <span className="text-xs font-black text-slate-800">Ocupação e Desempenho por CD</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono font-medium">Capacidades Planejadas vs Realizadas</span>
          </div>

          <div className="space-y-4 pt-2">
            {filteredCds.map(c => (
              <div key={c.cd} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5 font-bold"><MapPin className="w-3.5 h-3.5 text-slate-400" /> CD {c.cd}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[11px]">Inbound: <strong className="text-slate-600">{(c.inbound/1000).toFixed(0)}k</strong></span>
                    <span className="text-slate-400 text-[11px]">Outbound: <strong className="text-slate-600">{(c.outbound/1000).toFixed(0)}k</strong></span>
                    <span className={`text-[10px] font-mono font-bold border px-1.5 py-0.5 rounded-md ${getUtilColor(c.utilization)}`}>{c.utilization}%</span>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div style={{ width: `${c.utilization}%` }} className="bg-gradient-to-r from-blue-500 to-sky-500 rounded-full h-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed pt-2 flex items-center gap-2 border-t border-slate-100">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span><strong>Dica Operacional:</strong> CDs com utilização acima de 90% (ex: CD 310) estão propensos a gargalos no inbound. Priorizar remanejamento de cargas secas.</span>
          </div>
        </div>

        {/* Category Share Distribution */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><PieChart className="w-4 h-4" /></span>
            <span className="text-xs font-black text-slate-800">Participação por Categoria</span>
          </div>

          <div className="space-y-3 pt-2">
            {categoryShare.map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-bold">{cat.name}</span>
                  <span className={`font-mono font-bold ${cat.text}`}>{cat.value}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div style={{ width: `${cat.value}%` }} className={`${cat.color} h-full rounded-full`} />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-[9px] font-black border border-violet-100 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Liderança: Mercearia
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
