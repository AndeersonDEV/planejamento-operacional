import React, { useMemo, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Chart, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from "chart.js";
import {
  CalendarRange,
  Calendar,
  CalendarOff,
  Building2,
  Package,
  Filter,
  RotateCcw,
  TrendingUp,
  BarChart3,
  Truck,
  ArrowUpRight,
  Zap,
  RefreshCw,
  Layers,
  Activity,
  CheckCircle2,
  SlidersHorizontal,
  Info,
  Award,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
);

// ============================================================
// 🔥 PLUGIN: LINHAS DE REFERÊNCIA
// ============================================================
const referenceLinesPlugin = {
  id: "referenceLinesPlugin",
  afterDraw(chart: any) {
    const { ctx, chartArea, scales } = chart;
    const refLines = chart.options.plugins?.referenceLines?.lines;
    if (!refLines || !refLines.length || !scales.y || !chartArea) return;

    ctx.save();
    refLines.forEach((line: { y: number; color: string; label: string }) => {
      if (line.y === undefined || line.y === null || isNaN(line.y)) return;
      const yPixel = scales.y.getPixelForValue(line.y);
      if (yPixel < chartArea.top || yPixel > chartArea.bottom) return;

      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(chartArea.left, yPixel);
      ctx.lineTo(chartArea.right, yPixel);
      ctx.stroke();

      ctx.fillStyle = line.color;
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(line.label, chartArea.right - 6, yPixel - 4);
    });
    ctx.restore();
  },
};

// ============================================================
// 🔥 PLUGIN: DATALABELS (MÉTRICAS SOBRE AS BARRAS)
// ============================================================
const datalabelsPlugin = {
  id: "customDatalabels",
  afterDraw(chart: any) {
    const { ctx } = chart;
    const isDark = chart.options.plugins?.themeIsDark ?? true;
    ctx.save();
    ctx.font = "bold 9px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const isStacked = chart.options?.scales?.x?.stacked || chart.options?.scales?.y?.stacked;

    if (!isStacked) {
      chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden || dataset.type === "line") return;

        meta.data.forEach((element: any, index: number) => {
          const val = dataset.data[index];
          if (val === undefined || val === null || val === 0) return;
          
          let formatted = typeof val === "number" ? val.toLocaleString("pt-BR") : val;
          if (typeof val === "number" && val >= 1000000) {
            formatted = (val / 1000000).toFixed(1) + "M";
          } else if (typeof val === "number" && val >= 10000) {
            formatted = Math.round(val / 1000) + "k";
          }
          
          ctx.fillStyle = isDark ? "#cbd5e1" : "#334155";
          ctx.fillText(formatted, element.x, element.y - 2);
        });
      });
    }
    ctx.restore();
  },
};

// ============================================================
// 🔥 CONFIGURAÇÃO DA API - USANDO PROXY
// ============================================================
const USE_MOCK_DATA = false;
const API_BASE = "/api/dashboard/pfa"; // 🔥 URL RELATIVA (VIA PROXY)
const ENDPOINTS = {
  recebimento: "/recebimento",
  importacao: "/importacao",
  faturamento: "/faturamento",
  transferencia: "/transferencia",
};

// ============================================================
// 🔥 FUNÇÃO DE FETCH COM TOKEN
// ============================================================
async function fetchFromApi(path: string, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { headers });
  
  if (!res.ok) {
    throw new Error(`Erro ao buscar ${path}: ${res.status} - ${res.statusText}`);
  }
  
  return res.json();
}

import { CATEGORIAS_POR_CD, CDS_LIST } from "../mockData";

// ============================================================
// 🔥 CONSTANTES
// ============================================================
const ANO = 2026;
const CDS = CDS_LIST.map((c) => c.id);
const CD_LABEL: Record<number | string, string> = Object.fromEntries(
  CDS_LIST.map((c) => [c.id, `${c.name} · ${(CATEGORIAS_POR_CD[String(c.id)] || []).join(" / ")}`])
);

const CD_CATEGORIAS_MAP: Record<string, string[]> = Object.fromEntries(
  Object.entries(CATEGORIAS_POR_CD).map(([cd, cats]) => [
    cd,
    [...cats, ...cats.map((c) => c.toUpperCase())]
  ])
);

const CATEGORIAS = Array.from(new Set(Object.values(CATEGORIAS_POR_CD).flat()));
const MESES = [
  { n: 9, nome: "Setembro" },
  { n: 10, nome: "Outubro" },
  { n: 11, nome: "Novembro" },
  { n: 12, nome: "Dezembro" },
];
const DIAS_SEMANA = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// ============================================================
// 🔥 HELPERS
// ============================================================
function getWeekOfMonth(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const cleanDate = dateStr.split("T")[0].split(" ")[0];
  const parts = cleanDate.includes("-") ? cleanDate.split("-") : cleanDate.split("/");
  if (parts.length !== 3) return null;
  let year = Number(parts[0]);
  let month = Number(parts[1]) - 1;
  let day = Number(parts[2]);
  if (parts[2].length === 4) {
    year = Number(parts[2]);
    month = Number(parts[1]) - 1;
    day = Number(parts[0]);
  }
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  return Math.ceil(day / 7);
}
function diaLabel(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const [, m, d] = parts;
  return `${d}/${m}`;
}

function quartil(valores: number[], q: number) {
  if (!valores || !valores.length) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + resto * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

// ============================================================
// 🔥 MOCK DATA (FALLBACK)
// ============================================================
function buildMockData() {
  const recebimento: any[] = [];
  const importacao: any[] = [];
  const faturamento: any[] = [];
  const transferencia: any[] = [];
  let id = 1;
  let idI = 1;
  let idF = 1;
  let idT = 1;
  const tiposDemanda = ["SEPARAÇÃO PICKING", "SEPARAÇÃO PLT FECHADO"];

  function seeded(seedStr: string) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    return () => {
      h = (h * 1664525 + 1013904223) >>> 0;
      return h / 4294967296;
    };
  }

  function diasOperacionaisDoMes(mes: number, ano = ANO) {
    const totalDias = new Date(ano, mes, 0).getDate();
    const dias = [];
    for (let d = 1; d <= totalDias; d++) {
      const dateObj = new Date(ano, mes - 1, d);
      const dow = dateObj.getDay();
      if (dow === 0) continue;
      dias.push({
        dateStr: `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        diaDoMes: d,
        mes,
        nomeDia: DIAS_SEMANA[dow - 1],
      });
    }
    return dias;
  }

  CDS.forEach((cd) => {
    CATEGORIAS.forEach((categoria) => {
      MESES.forEach(({ n: mes }) => {
        diasOperacionaisDoMes(mes).forEach(({ dateStr, nomeDia }) => {
          const rnd = seeded(`${cd}-${categoria}-${dateStr}`);

          const capacidade = Math.round(4 + rnd() * 10);
          const agendados = Math.round(capacidade * (0.6 + rnd() * 0.4));
          const recebidos = Math.round(agendados * (0.75 + rnd() * 0.3));
          const proposto = Math.round(capacidade * (0.9 + rnd() * 0.25));
          recebimento.push({
            id: id++,
            dataRecebimento: dateStr,
            categoria,
            cd,
            mes,
            nomeDia,
            capacidade,
            agendados,
            recebidos: Math.min(recebidos, capacidade + 3),
            proposto,
          });

          const qtdImportacao = Math.round(rnd() * 2);
          importacao.push({
            id: idI++,
            dataImportacao: dateStr,
            categoria,
            cd,
            mes,
            nomeDia,
            qtdImportacao,
            proposto: Math.round(qtdImportacao * (0.8 + rnd() * 0.5)),
          });

          tiposDemanda.forEach((tipoDemanda) => {
            const rnd2 = seeded(`${cd}-${categoria}-${dateStr}-${tipoDemanda}`);
            const fat = Math.round(2000 + rnd2() * 9000);
            faturamento.push({
              id: idF++,
              dataFaturamento: dateStr,
              categoria,
              cd,
              mes,
              nomeDia,
              faturamento: fat,
              tipoDemanda,
              proposto: Math.round(fat * (0.9 + rnd2() * 0.3)),
              capacidade: Math.round(fat * (1.1 + rnd2() * 0.2)),
            });
          });
        });
      });
    });

    CDS.filter((d) => d !== cd).forEach((destino) => {
      MESES.forEach(({ n: mes }) => {
        diasOperacionaisDoMes(mes).forEach(({ dateStr, nomeDia }) => {
          const rnd = seeded(`${cd}-${destino}-${dateStr}`);
          if (rnd() > 0.55) return;
          transferencia.push({
            id: idT++,
            dataTransferencia: dateStr,
            nomeDia,
            cd,
            destino,
            mes,
            rota: Math.round(1000000 + rnd() * 200000),
            proposto: Math.round(1 + rnd() * 3),
          });
        });
      });
    });
  });
  return { recebimento, importacao, faturamento, transferencia };
}

// ============================================================
// 🔥 HOOK: useDashboardData (CORRIGIDO)
// ============================================================
function useDashboardData(token?: string) {
  const [data, setData] = useState<any>(() => (USE_MOCK_DATA ? buildMockData() : null));
  const [loading, setLoading] = useState(!USE_MOCK_DATA);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = useCallback(async () => {
    if (USE_MOCK_DATA || hasLoaded) return;
    setLoading(true);
    setError(null);
    try {
      console.log("🔍 Carregando dados PFA da API...");
      console.log("🔑 Token presente?", !!token);
      
      const [recebimento, importacao, faturamento, transferencia] = await Promise.all([
        fetchFromApi(ENDPOINTS.recebimento, token),
        fetchFromApi(ENDPOINTS.importacao, token),
        fetchFromApi(ENDPOINTS.faturamento, token),
        fetchFromApi(ENDPOINTS.transferencia, token),
      ]);
      
      console.log("✅ Dados carregados com sucesso!");
      console.log("📊 Recebimento:", recebimento?.length || 0, "registros");
      console.log("📊 Importação:", importacao?.length || 0, "registros");
      console.log("📊 Faturamento:", faturamento?.length || 0, "registros");
      console.log("📊 Transferência:", transferencia?.length || 0, "registros");
      
      setData({ recebimento, importacao, faturamento, transferencia });
      setHasLoaded(true);
    } catch (e: any) {
      console.warn("⚠️ API offline ou erro, carregando dados simulados:", e.message);
      console.log("📦 Usando dados MOCK como fallback");
      setData(buildMockData());
      setError(e.message || "Falha ao carregar dados da API. Usando dados locais.");
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [token, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) {
      load();
    }
  }, [load, hasLoaded]);

  return { data, loading, error, reload: load };
}

// ============================================================
// 🔥 UI COMPONENTS
// ============================================================
const MES_NOMES: Record<number, string> = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril", 5: "Maio", 6: "Junho",
  7: "Julho", 8: "Agosto", 9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

interface MetricCardProps {
  label1: string;
  value1: string | number;
  label2?: string;
  value2?: string | number;
  icon?: React.ReactNode;
  badge?: string;
  accentColor?: "emerald" | "blue" | "amber" | "violet" | "teal";
  theme?: "light" | "dark";
}

function MetricCard({ label1, value1, label2, value2, icon, badge, accentColor = "blue", theme = "dark" }: MetricCardProps) {
  const isDark = theme === "dark";

  const colorGradients = {
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-indigo-600",
    amber: "from-amber-500 to-orange-600",
    violet: "from-violet-500 to-purple-600",
    teal: "from-teal-400 to-cyan-600",
  };

  const bgBorder = isDark
    ? "bg-slate-900/80 border-slate-800/80 shadow-2xl shadow-slate-950/40"
    : "bg-white/80 border-slate-200/80 shadow-xl shadow-slate-200/40";

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className={`relative overflow-hidden rounded-2xl p-5 border backdrop-blur-xl transition-all duration-300 flex flex-col justify-between ${bgBorder}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorGradients[accentColor]}`} />

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {label1}
          </span>
          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-gradient-to-r ${colorGradients[accentColor]} text-white shadow-sm`}>
              {badge}
            </span>
          )}
          {icon && <div className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>{icon}</div>}
        </div>

        <div className={`text-2xl font-black tracking-tight font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
          {value1}
        </div>
      </div>

      {label2 && (
        <div className="mt-4 pt-3 border-t border-slate-700/30 dark:border-slate-800/50 flex items-center justify-between">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            {label2}
          </span>
          <span className={`text-sm font-bold font-mono ${isDark ? "text-slate-200" : "text-slate-700"}`}>
            {value2}
          </span>
        </div>
      )}
    </motion.div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
  theme?: "light" | "dark";
}

function Select({ label, value, onChange, options, icon, theme = "dark" }: SelectProps) {
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col gap-1.5 min-w-[170px] flex-1 sm:flex-initial">
      <label className={`text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        {icon}
        <span>{label}</span>
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full py-2.5 px-3.5 pr-8 rounded-xl text-xs font-semibold font-mono appearance-none outline-none transition-all duration-200 border cursor-pointer ${
            isDark
              ? "bg-slate-950/80 border-slate-800 text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              : "bg-slate-100/80 border-slate-200 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          }`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className={isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 🔥 COMPONENTE: DETALHAMENTO DE CATEGORIAS POR CD
// ============================================================
interface CategoryCdBreakdownProps {
  title?: string;
  subtitle?: string;
  dataRows: any[];
  valField: string;
  valLabel: string;
  selectedCd: string;
  selectedCat: string;
  onSelectCd: (cd: string) => void;
  onSelectCat: (cat: string) => void;
  theme?: "light" | "dark";
}

function CategoryCdBreakdown({
  title = "Distribuição de Categorias por Centro de Distribuição",
  subtitle = "Comparativo das categorias em cada unidade operacional. Clique nas barras para filtrar.",
  dataRows,
  valField,
  valLabel,
  selectedCd,
  selectedCat,
  onSelectCd,
  onSelectCat,
  theme = "dark",
}: CategoryCdBreakdownProps) {
  const isDark = theme === "dark";

  const { mapByCd, cdsList, categoriesList, colorMap } = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const catSet = new Set<string>();

    (dataRows || []).forEach((r: any) => {
      const cdStr = String(r.cd);
      const catStr = r.categoria || "Geral";
      catSet.add(catStr);

      if (!map[cdStr]) map[cdStr] = {};
      const val = Number(r[valField]) || 0;
      map[cdStr][catStr] = (map[cdStr][catStr] || 0) + val;
    });

    const cds = Array.from(new Set([...CDS.map(String), ...Object.keys(map)])).sort((a, b) => Number(a) - Number(b));
    const cats = Array.from(catSet).sort();

    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1", "#f43f5e"];
    const cMap: Record<string, string> = {};
    cats.forEach((c, idx) => {
      cMap[c] = colors[idx % colors.length];
    });

    return { mapByCd: map, cdsList: cds, categoriesList: cats, colorMap: cMap };
  }, [dataRows, valField]);

  const chartData = useMemo(() => {
    const labels = cdsList.map((c) => CD_LABEL[c] || `CD ${c}`);
    const datasets = categoriesList.map((cat) => ({
      label: cat,
      data: cdsList.map((cdStr) => mapByCd[cdStr]?.[cat] || 0),
      backgroundColor: colorMap[cat] || "#3b82f6",
      borderRadius: 4,
    }));
    return { labels, datasets };
  }, [cdsList, categoriesList, mapByCd, colorMap]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            color: isDark ? "#cbd5e1" : "#334155",
            font: { family: "Inter, sans-serif", size: 11, weight: "bold" as const },
            usePointStyle: true,
            boxWidth: 8,
          },
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#f8fafc" : "#0f172a",
          bodyColor: isDark ? "#cbd5e1" : "#334155",
          borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label: (context: any) => {
              const cat = context.dataset.label;
              const val = context.raw || 0;
              return ` ${cat}: ${val.toLocaleString("pt-BR")} ${valLabel}`;
            },
          },
        },
        themeIsDark: isDark,
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: isDark ? "#94a3b8" : "#475569", font: { family: "Inter, sans-serif", size: 11, weight: "bold" as const } },
        },
        y: {
          grid: { color: isDark ? "rgba(51, 65, 85, 0.2)" : "rgba(226, 232, 240, 0.7)" },
          ticks: {
            color: isDark ? "#64748b" : "#94a3b8",
            font: { family: "IBM Plex Mono, monospace", size: 10 },
            callback: (v: any) => Number(v).toLocaleString("pt-BR"),
          },
        },
      },
      onClick: (event: any, elements: any[]) => {
        if (!elements || !elements.length) return;
        const first = elements[0];
        const cdStr = cdsList[first.index];
        const catStr = categoriesList[first.datasetIndex];
        if (cdStr) onSelectCd(cdStr);
        if (catStr) onSelectCat(catStr);
      },
    }),
    [isDark, cdsList, categoriesList, valLabel, onSelectCd, onSelectCat]
  );

  return (
    <div className={`p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
      isDark ? "bg-slate-900/80 border-slate-800/80 shadow-2xl shadow-slate-950/40" : "bg-white/80 border-slate-200/80 shadow-xl shadow-slate-200/50"
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/20">
              Análise por CD & Categoria
            </span>
            <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
              💡 Clique nas barras ou categorias para aplicar filtros
            </span>
          </div>
          <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            {title}
          </h3>
          <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {subtitle}
          </p>
        </div>
      </div>

      <div className="h-[300px] w-full mb-8">
        <Bar data={chartData} options={chartOptions} plugins={[datalabelsPlugin]} />
      </div>

      {/* Cards por CD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-700/30 dark:border-slate-800/50">
        {cdsList.map((cdStr) => {
          const cdName = CD_LABEL[cdStr] || `CD ${cdStr}`;
          const catMap = mapByCd[cdStr] || {};
          const totalCd = (Object.values(catMap) as number[]).reduce((s: number, v: number) => s + Number(v || 0), 0);
          const isCdActive = selectedCd === cdStr;

          return (
            <div
              key={cdStr}
              onClick={() => onSelectCd(selectedCd === cdStr ? "all" : cdStr)}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isCdActive
                  ? "bg-blue-500/10 border-blue-500/60 shadow-lg shadow-blue-500/10"
                  : isDark
                    ? "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 ${isCdActive ? "text-blue-400" : "text-slate-400"}`} />
                  <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {cdName}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {Number(totalCd).toLocaleString("pt-BR")}
                </span>
              </div>

              <div className="space-y-2">
                {Object.entries(catMap)
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .map(([cat, val]) => {
                    const numVal = Number(val);
                    const pct = totalCd > 0 ? Math.round((numVal / totalCd) * 100) : 0;
                    const isCatActive = selectedCat === cat;
                    const catColor = colorMap[cat] || "#3b82f6";

                    return (
                      <div
                        key={cat}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCd(cdStr);
                          onSelectCat(selectedCat === cat ? "all" : cat);
                        }}
                        className={`group p-1.5 rounded-lg transition-all flex flex-col gap-1 cursor-pointer ${
                          isCatActive ? "bg-purple-500/20 ring-1 ring-purple-500/40" : "hover:bg-slate-800/30"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                            {cat}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            {numVal.toLocaleString("pt-BR")} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800/50 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: catColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(catMap).length === 0 && (
                  <p className="text-[10px] text-slate-500 italic">Sem registros para os filtros atuais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 🔥 COMPONENTE PRINCIPAL
// ============================================================
interface PfaProps {
  theme?: "light" | "dark";
  showNotification?: (msg: string) => void;
  user?: any;
}

export default function Pfa({ theme = "dark", showNotification, user }: PfaProps) {
  const isDark = theme === "dark";
  const token = user?.token;
  const { data, loading, error, reload } = useDashboardData(token);
  const [tab, setTab] = useState("recebimento");
  const [cd, setCd] = useState("all");
  const [categoria, setCategoria] = useState("all");
  const [mes, setMes] = useState("all");
  const [semana, setSemana] = useState("all");
  const [tipoDemanda, setTipoDemanda] = useState("all");
  const [diaFiltro, setDiaFiltro] = useState<string | null>(null);
  const [showCategorias, setShowCategorias] = useState(false);
  const [ocultarFimDeSemana, setOcultarFimDeSemana] = useState(false);

  // 🔥 NOTIFICAÇÃO DE ERRO
  useEffect(() => {
    if (error && showNotification) {
      showNotification(`⚠️ ${error}`);
    }
  }, [error, showNotification]);

  // ============================================================
  // 🔥 HELPER FIM DE SEMANA
  // ============================================================
  function isFimDeSemanaRow(r: any, dateField: string): boolean {
    if (r?.nomeDia) {
      const n = String(r.nomeDia).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (n.includes("sab") || n.includes("dom")) return true;
    }
    const dateStr = r?.[dateField];
    if (dateStr && typeof dateStr === "string") {
      const cleanDate = dateStr.split("T")[0].split(" ")[0];
      const parts = cleanDate.includes("-") ? cleanDate.split("-") : cleanDate.split("/");
      if (parts.length === 3) {
        let year = Number(parts[0]);
        let month = Number(parts[1]) - 1;
        let day = Number(parts[2]);
        if (parts[2].length === 4) {
          year = Number(parts[2]);
          month = Number(parts[1]) - 1;
          day = Number(parts[0]);
        }
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const d = new Date(year, month, day);
          const dow = d.getDay();
          if (dow === 0 || dow === 6) return true;
        }
      }
    }
    return false;
  }

  // ============================================================
  // 🔥 FILTROS E AGREGAÇÕES
  // ============================================================
  const todasLinhas = useMemo(
    () => [
      ...(data?.recebimento || []),
      ...(data?.importacao || []),
      ...(data?.faturamento || []),
      ...(data?.transferencia || []),
    ],
    [data]
  );

  const cdOptions = useMemo(() => {
    const unicos = Array.from(new Set(todasLinhas.map((r) => r.cd))).filter((v) => v !== undefined && v !== null);
    const base = unicos.length ? unicos : CDS;
    return [
      { value: "all", label: "Todos os CDs" },
      ...base.sort((a: any, b: any) => a - b).map((c: any) => ({ value: String(c), label: CD_LABEL[c] || `CD ${c}` })),
    ];
  }, [todasLinhas]);

  const categoriaOptions = useMemo(() => {
    const linhasComCategoria = [
      ...(data?.recebimento || []),
      ...(data?.importacao || []),
      ...(data?.faturamento || []),
    ];
    let unicas = Array.from(new Set(linhasComCategoria.map((r) => r.categoria))).filter(Boolean);

    if (cd !== "all") {
      const allowed = CD_CATEGORIAS_MAP[cd];
      if (allowed && allowed.length > 0) {
        const allowedNorm = allowed.map((a) => a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const filtered = unicas.filter((cat) => {
          const norm = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return allowedNorm.some((a) => norm.includes(a) || a.includes(norm));
        });
        unicas = filtered.length > 0 ? filtered : allowed;
      }
    }

    const base = unicas.length ? unicas : CATEGORIAS;
    return [{ value: "all", label: "Todas as categorias" }, ...base.sort().map((c) => ({ value: c, label: c }))];
  }, [data, cd]);

  // Reset de Categoria caso não pertença ao CD selecionado
  useEffect(() => {
    if (cd !== "all" && categoria !== "all") {
      const allowed = CD_CATEGORIAS_MAP[cd];
      if (allowed && allowed.length > 0) {
        const allowedNorm = allowed.map((a) => a.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        const catNorm = categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isValid = allowedNorm.some((a) => catNorm.includes(a) || a.includes(catNorm));
        if (!isValid) {
          setCategoria("all");
        }
      }
    }
  }, [cd, categoria]);

  const tipoDemandaOptions = useMemo(() => {
    const unicos = Array.from(new Set((data?.faturamento || []).map((r: any) => r.tipoDemanda))).filter(Boolean);
    return [{ value: "all", label: "Todos os tipos" }, ...unicos.sort().map((t: any) => ({ value: t, label: t }))];
  }, [data]);

  const mesOptions = useMemo(() => {
    const unicos = Array.from(new Set(todasLinhas.map((r) => r.mes))).filter((v) => v !== undefined && v !== null);
    const base = unicos.length ? unicos : MESES.map((m) => m.n);
    return [
      { value: "all", label: "Todos os meses" },
      ...base.sort((a: any, b: any) => a - b).map((m: any) => ({ value: String(m), label: MES_NOMES[m] || `Mês ${m}` })),
    ];
  }, [todasLinhas]);

  const semanaOptions = useMemo(() => {
    const semanasSet = new Set<number>();
    todasLinhas.forEach((r) => {
      if (mes !== "all") {
        const rowMes = r.mes ?? Number((r.dataRecebimento || r.dataImportacao || r.dataFaturamento || r.dataTransferencia || "").split("-")[1]);
        if (String(rowMes) !== mes) return;
      }
      const dateStr = r.dataRecebimento || r.dataImportacao || r.dataFaturamento || r.dataTransferencia;
      if (dateStr) {
        const wk = getWeekOfMonth(dateStr);
        if (wk) semanasSet.add(wk);
      }
    });
    const sorted = Array.from(semanasSet).sort((a, b) => a - b);
    return [
      { value: "all", label: "Todas as semanas" },
      ...sorted.map((w) => ({ value: String(w), label: `Semana ${w}` })),
    ];
  }, [todasLinhas, mes]);

  // Reset de Semana se não existir no mês selecionado
  useEffect(() => {
    if (semana !== "all") {
      const exists = semanaOptions.some((opt) => opt.value === semana);
      if (!exists) {
        setSemana("all");
      }
    }
  }, [semanaOptions, semana]);

  const applyFilters = useCallback(
    (rows: any[], { hasCategoria = true, hasTipoDemanda = false, dateField, cdField = "cd" }: any) => {
      if (!rows) return [];
      return rows.filter((r) => {
        if (cd !== "all" && String(r[cdField]) !== cd) return false;
        if (hasCategoria && categoria !== "all" && r.categoria !== categoria) return false;
        if (hasTipoDemanda && tipoDemanda !== "all" && r.tipoDemanda !== tipoDemanda) return false;
        if (mes !== "all") {
          const rowMes = r.mes ?? Number((r[dateField] || "").split("-")[1]);
          if (String(rowMes) !== mes) return false;
        }
        if (semana !== "all" && dateField) {
          const wk = getWeekOfMonth(r[dateField]);
          if (wk !== null && String(wk) !== semana) return false;
        }
        if (diaFiltro && dateField) {
          const formattedDia = diaLabel(r[dateField]);
          if (formattedDia !== diaFiltro && r[dateField] !== diaFiltro) return false;
        }
        if (ocultarFimDeSemana && dateField && isFimDeSemanaRow(r, dateField)) {
          return false;
        }
        return true;
      });
    },
    [cd, categoria, mes, semana, tipoDemanda, diaFiltro, ocultarFimDeSemana]
  );

  const recebimentoData = useMemo(() => applyFilters(data?.recebimento, { dateField: "dataRecebimento" }), [data, applyFilters]);
  const importacaoData = useMemo(() => applyFilters(data?.importacao, { dateField: "dataImportacao" }), [data, applyFilters]);
  const faturamentoData = useMemo(
    () => applyFilters(data?.faturamento, { dateField: "dataFaturamento", hasTipoDemanda: true }),
    [data, applyFilters]
  );
  const transferenciaData = useMemo(
    () => applyFilters(data?.transferencia, { hasCategoria: false, dateField: "dataTransferencia" }),
    [data, applyFilters]
  );

  function agregarPorDia(rows: any[], dateField: string, seed: any, acumular: (acc: any, r: any) => void) {
    const map: Record<string, any> = {};
    rows.forEach((r) => {
      const key = r[dateField];
      if (!map[key]) map[key] = { dia: diaLabel(key), _sort: key, ...seed };
      acumular(map[key], r);
    });
    return Object.values(map).sort((a, b) => a._sort.localeCompare(b._sort));
  }

  const recebimentoPorDia = useMemo(
    () =>
      agregarPorDia(
        recebimentoData,
        "dataRecebimento",
        { Capacidade: 0, Agendados: 0, Recebidos: 0, Proposto: 0 },
        (acc, r) => {
          acc.Capacidade += r.capacidade || 0;
          acc.Agendados += r.agendados || 0;
          acc.Recebidos += r.recebidos || 0;
          acc.Proposto += r.proposto || 0;
        }
      ),
    [recebimentoData]
  );

  const importacaoPorDia = useMemo(
    () =>
      agregarPorDia(
        importacaoData,
        "dataImportacao",
        { Importado: 0, Proposto: 0 },
        (acc, r) => {
          acc.Importado += r.qtdImportacao || 0;
          acc.Proposto += r.proposto || 0;
        }
      ),
    [importacaoData]
  );

  const faturamentoPorDia = useMemo(
    () =>
      agregarPorDia(
        faturamentoData,
        "dataFaturamento",
        { Faturado: 0, Proposto: 0, Capacidade: 0 },
        (acc, r) => {
          acc.Faturado += r.faturamento || 0;
          acc.Capacidade += r.capacidade || 0;
          acc.Proposto += r.proposto || 0;
        }
      ),
    [faturamentoData]
  );

  const destinoOptions = useMemo(() => {
    const unicos = Array.from(new Set((data?.transferencia || []).map((r: any) => r.destino))).filter((v) => v != null);
    return unicos.sort((a: any, b: any) => a - b);
  }, [data]);

  const [destinoEncaixe, setDestinoEncaixe] = useState<any>(null);
  useEffect(() => {
    if ((destinoEncaixe === null || !destinoOptions.includes(destinoEncaixe)) && destinoOptions.length) {
      setDestinoEncaixe(destinoOptions[0]);
    }
  }, [destinoOptions, destinoEncaixe]);

  const encaixeData = useMemo(() => {
    if (destinoEncaixe == null) return { rows: [], q3Max: 0, q3Media: 0, origens: [] };
    const rows = transferenciaData.filter((r: any) => r.destino === destinoEncaixe);
    const origens = Array.from(new Set(rows.map((r: any) => r.cd))).sort((a: any, b: any) => a - b);

    const porOrigemDia: Record<string, Record<string, Record<string, number>>> = {};
    rows.forEach((r: any) => {
      porOrigemDia[r.cd] = porOrigemDia[r.cd] || {};
      porOrigemDia[r.cd][r.nomeDia] = porOrigemDia[r.cd][r.nomeDia] || {};
      porOrigemDia[r.cd][r.nomeDia][r.dataTransferencia] = (porOrigemDia[r.cd][r.nomeDia][r.dataTransferencia] || 0) + 1;
    });

    const diasParaExibir = ocultarFimDeSemana
      ? DIAS_SEMANA.filter((d) => !d.toLowerCase().includes("sábado") && !d.toLowerCase().includes("sabado") && !d.toLowerCase().includes("domingo"))
      : DIAS_SEMANA;

    const rowsPorTipo: { Max: Record<string, number>; Media: Record<string, number> } = { Max: {}, Media: {} };
    const chartRows: any[] = [];
    diasParaExibir.forEach((dia) => {
      const maxRow: any = { grupo: `${dia}__Max`, dia, tipo: "Max" };
      const mediaRow: any = { grupo: `${dia}__Media`, dia, tipo: "Media" };
      let totalMax = 0;
      let totalMedia = 0;
      origens.forEach((origem: any) => {
        const porData = (porOrigemDia[origem] || {})[dia] || {};
        const valores = Object.values(porData);
        const max = valores.length ? Math.max(...valores) : 0;
        const media = valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
        const mediaArred = Math.round(media * 10) / 10;
        maxRow[String(origem)] = max;
        mediaRow[String(origem)] = mediaArred;
        totalMax += max;
        totalMedia += mediaArred;
      });
      rowsPorTipo.Max[dia] = totalMax;
      rowsPorTipo.Media[dia] = totalMedia;
      chartRows.push(maxRow, mediaRow);
    });

    const q3Max = quartil(Object.values(rowsPorTipo.Max), 0.75);
    const q3Media = quartil(Object.values(rowsPorTipo.Media), 0.75);

    return { rows: chartRows, q3Max, q3Media, origens };
  }, [transferenciaData, destinoEncaixe, ocultarFimDeSemana]);

  // ============================================================
  // 🔥 KPIs (MÉDIAS DESCONSIDERANDO SÁBADOS E DOMINGOS)
  // ============================================================
  const kpisRecebimento = useMemo(() => {
    const capacidade = recebimentoData.reduce((s: number, r: any) => s + (r.capacidade || 0), 0);
    const agendados = recebimentoData.reduce((s: number, r: any) => s + (r.agendados || 0), 0);
    const recebidos = recebimentoData.reduce((s: number, r: any) => s + (r.recebidos || 0), 0);
    const proposto = recebimentoData.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const semFds = recebimentoData.filter((r: any) => !isFimDeSemanaRow(r, "dataRecebimento"));
    const diasUteisAtivos = new Set(
      semFds
        .filter((r: any) => (r.capacidade || 0) > 0 || (r.recebidos || 0) > 0 || (r.agendados || 0) > 0 || (r.proposto || 0) > 0)
        .map((r: any) => r.dataRecebimento)
    );
    const divisor = diasUteisAtivos.size || new Set(semFds.map((r: any) => r.dataRecebimento)).size || 1;

    const capSemFds = semFds.reduce((s: number, r: any) => s + (r.capacidade || 0), 0);
    const agendSemFds = semFds.reduce((s: number, r: any) => s + (r.agendados || 0), 0);
    const recSemFds = semFds.reduce((s: number, r: any) => s + (r.recebidos || 0), 0);
    const propSemFds = semFds.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const mediaCapacidade = Math.round(capSemFds / divisor);
    const mediaAgendados = Math.round(agendSemFds / divisor);
    const mediaRecebidos = Math.round(recSemFds / divisor);
    const mediaProposto = Math.round(propSemFds / divisor);

    return { capacidade, recebidos, proposto, agendados, mediaCapacidade, mediaAgendados, mediaRecebidos, mediaProposto };
  }, [recebimentoData]);

  const kpisImportacao = useMemo(() => {
    const total = importacaoData.reduce((s: number, r: any) => s + (r.qtdImportacao || 0), 0);
    const proposto = importacaoData.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const semFds = importacaoData.filter((r: any) => !isFimDeSemanaRow(r, "dataImportacao"));
    const diasUteisAtivos = new Set(
      semFds
        .filter((r: any) => (r.qtdImportacao || 0) > 0 || (r.proposto || 0) > 0)
        .map((r: any) => r.dataImportacao)
    );
    const divisor = diasUteisAtivos.size || new Set(semFds.map((r: any) => r.dataImportacao)).size || 1;

    const totalSemFds = semFds.reduce((s: number, r: any) => s + (r.qtdImportacao || 0), 0);
    const propSemFds = semFds.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const mediaImportacao = Math.round(totalSemFds / divisor);
    const mediaProposto = Math.round(propSemFds / divisor);

    return { total, proposto, registros: importacaoData.length, mediaImportacao, mediaProposto };
  }, [importacaoData]);

  const kpisFaturamento = useMemo(() => {
    const total = faturamentoData.reduce((s: number, r: any) => s + (r.faturamento || 0), 0);
    const capacidade = faturamentoData.reduce((s: number, r: any) => s + (r.capacidade || 0), 0);
    const proposto = faturamentoData.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const semFds = faturamentoData.filter((r: any) => !isFimDeSemanaRow(r, "dataFaturamento"));
    const diasUteisAtivos = new Set(
      semFds
        .filter((r: any) => (r.faturamento || 0) > 0 || (r.capacidade || 0) > 0 || (r.proposto || 0) > 0)
        .map((r: any) => r.dataFaturamento)
    );
    const divisor = diasUteisAtivos.size || new Set(semFds.map((r: any) => r.dataFaturamento)).size || 1;

    const totalSemFds = semFds.reduce((s: number, r: any) => s + (r.faturamento || 0), 0);
    const capSemFds = semFds.reduce((s: number, r: any) => s + (r.capacidade || 0), 0);
    const propSemFds = semFds.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const mediaFaturado = Math.round(totalSemFds / divisor);
    const mediaCapacidade = Math.round(capSemFds / divisor);
    const mediaProposto = Math.round(propSemFds / divisor);

    return { total, proposto, mediaFaturado, mediaProposto, capacidade, mediaCapacidade };
  }, [faturamentoData]);

  const kpisTransferencia = useMemo(() => {
    const rotas = transferenciaData.length;
    const destinos = new Set(transferenciaData.map((r: any) => r.destino)).size;
    const origens = new Set(transferenciaData.map((r: any) => r.cd)).size;
    const proposto = transferenciaData.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const semFds = transferenciaData.filter((r: any) => !isFimDeSemanaRow(r, "dataTransferencia"));
    const diasUteisAtivos = new Set(
      semFds
        .filter((r: any) => (r.proposto || 0) > 0 || (r.cd || 0) > 0)
        .map((r: any) => r.dataTransferencia)
    );
    const divisor = diasUteisAtivos.size || new Set(semFds.map((r: any) => r.dataTransferencia)).size || 1;

    const rotasSemFds = semFds.length;
    const propSemFds = semFds.reduce((s: number, r: any) => s + (r.proposto || 0), 0);

    const mediaTransferencia = Math.round(rotasSemFds / divisor);
    const mediaProposto = Math.round(propSemFds / divisor);

    return { rotas, destinos, origens, proposto, mediaTransferencia, mediaProposto };
  }, [transferenciaData]);

  const fmt = (n: number) => (n || 0).toLocaleString("pt-BR");

  // ============================================================
  // 🔥 CHART OPTIONS & INTERATIVIDADE
  // ============================================================
  const createInteractiveOptions = useCallback(
    (onBarClick?: (day: string) => void) => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        legend: {
          position: "bottom" as const,
          align: "center" as const,
          labels: {
            color: isDark ? "#cbd5e1" : "#475569",
            font: { family: "Inter, sans-serif", size: 11, weight: "bold" as const },
            usePointStyle: true,
            boxWidth: 10,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#f8fafc" : "#0f172a",
          bodyColor: isDark ? "#cbd5e1" : "#334155",
          borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          bodyFont: { family: "IBM Plex Mono, monospace", size: 12 },
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || "";
              const val = context.raw;
              const formatted = typeof val === "number" ? val.toLocaleString("pt-BR") : val;
              return ` ${label}: ${formatted}`;
            },
          },
        },
        themeIsDark: isDark,
      },
      scales: {
        x: {
          grid: { color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(226, 232, 240, 0.5)" },
          ticks: {
            color: isDark ? "#94a3b8" : "#475569",
            font: { family: "IBM Plex Mono, monospace", size: 10, weight: "bold" as const },
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          grid: {
            color: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(226, 232, 240, 0.7)",
          },
          ticks: {
            color: isDark ? "#94a3b8" : "#475569",
            font: { family: "IBM Plex Mono, monospace", size: 10 },
            callback: (val: any) => Number(val).toLocaleString("pt-BR"),
          },
        },
      },
      onClick: (event: any, elements: any[], chart: any) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const label = chart.data.labels[idx];
        if (onBarClick && label) {
          onBarClick(String(label));
        }
      },
    }),
    [isDark]
  );

  const commonChartOptions = useMemo(() => createInteractiveOptions(), [createInteractiveOptions]);

  const handleDailyChartClick = useCallback((diaClicked: string) => {
    setDiaFiltro((prev) => (prev === diaClicked ? null : diaClicked));
  }, []);

  const stackedChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            color: isDark ? "#94a3b8" : "#475569",
            font: { family: "Inter, sans-serif", size: 11, weight: "bold" as const },
            usePointStyle: true,
            boxWidth: 8,
            generateLabels: (chart: any) => {
              const original = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              return original.map((l: any) => {
                const labelText = l.text;
                l.text = CD_LABEL[labelText] || `CD ${labelText}`;
                return l;
              });
            },
          },
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#f8fafc" : "#0f172a",
          bodyColor: isDark ? "#cbd5e1" : "#334155",
          borderColor: isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.8)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            title: (items: any) => {
              if (!items.length) return "";
              const label = items[0].label || "";
              const parts = label.split("__");
              if (parts.length === 2) {
                const diaCap = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                const tipo = parts[1] === "Max" ? "Pico Máximo" : "Média Diária";
                return `${diaCap} — ${tipo}`;
              }
              return label;
            },
            label: (context: any) => {
              const datasetLabel = context.dataset.label;
              const cdName = CD_LABEL[datasetLabel] || `CD ${datasetLabel}`;
              const val = context.raw;
              return ` ${cdName}: ${val}`;
            },
          },
        },
        referenceLines: {
          lines: [
            { y: encaixeData.q3Max, color: "#ef4444", label: `${encaixeData.q3Max.toFixed(0)} (3ºQ Máx.)` },
            { y: encaixeData.q3Media, color: "#8b5cf6", label: `${encaixeData.q3Media.toFixed(0)} (3ºQ Méd.)` },
          ],
        },
        themeIsDark: isDark,
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: isDark ? "#64748b" : "#94a3b8",
            font: { family: "IBM Plex Mono, monospace", size: 10 },
            callback: function (this: any, val: any) {
              const raw = this.getLabelForValue(val);
              if (!raw) return "";
              const parts = String(raw).split("__");
              if (parts.length === 2) {
                const diaNome = parts[0].charAt(0).toUpperCase() + parts[0].slice(1, 3);
                return parts[1] === "Max" ? `${diaNome} (Máx)` : `${diaNome} (Méd)`;
              }
              return raw;
            },
          },
        },
        y: {
          stacked: true,
          grid: {
            color: isDark ? "rgba(51, 65, 85, 0.2)" : "rgba(226, 232, 240, 0.7)",
          },
          ticks: {
            color: isDark ? "#64748b" : "#94a3b8",
            font: { family: "IBM Plex Mono, monospace", size: 10 },
          },
        },
      },
      onClick: (event: any, elements: any[]) => {
        if (!elements || !elements.length) return;
        const first = elements[0];
        const row = encaixeData.rows[first.index];
        if (row && row.dia) {
          setDiaFiltro((prev) => (prev === row.dia ? null : row.dia));
        }
      },
    };
  }, [isDark, encaixeData]);

  const ORIGEM_COLORS_TW = ["#3b82f6", "#64748b", "#f59e0b", "#14b8a6", "#8b5cf6", "#10b981"];

  // ============================================================
  // 🔥 RENDER: LOADING
  // ============================================================
  if (loading) {
    return (
      <div className={`w-full min-h-[500px] flex items-center justify-center rounded-3xl p-12 ${isDark ? "bg-slate-900/60" : "bg-white/60"}`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm font-medium font-mono text-slate-400 animate-pulse">
            Carregando planejamento de final de ano...
          </p>
          <p className="text-xs text-slate-500 font-mono">Buscando dados da API</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // 🔥 RENDER: ERROR
  // ============================================================
  if (error && !data) {
    return (
      <div className={`w-full rounded-3xl p-8 border ${isDark ? "bg-slate-900/80 border-red-500/30" : "bg-white border-red-200"}`}>
        <div className="flex items-center gap-3 text-red-500 mb-4">
          <Info className="w-6 h-6" />
          <h3 className="font-bold text-lg">Erro no Carregamento do PFA</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6">{error}</p>
        <button
          onClick={reload}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs flex items-center gap-2 hover:bg-blue-500 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  // ============================================================
  // 🔥 TABS CONFIG
  // ============================================================
  const tabsConfig = [
    { id: "recebimento", num: "01", label: "Recebimento", icon: <Package className="w-4 h-4" /> },
    { id: "importacao", num: "02", label: "Importação", icon: <Truck className="w-4 h-4" /> },
    { id: "faturamento", num: "03", label: "Expedição", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "transferencia", num: "04", label: "Transferência", icon: <Activity className="w-4 h-4" /> },
  ];

  // ============================================================
  // 🔥 RENDER PRINCIPAL
  // ============================================================
  return (
    <div className="w-full flex flex-col gap-6">
      {/* HEADER */}
      <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 border backdrop-blur-2xl transition-all duration-300 ${
        isDark 
          ? "bg-slate-900/80 border-slate-800/80 shadow-2xl shadow-slate-950/40" 
          : "bg-white/80 border-slate-200/80 shadow-xl shadow-slate-200/50"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Operacional GPA
                </span>
                <span className={`text-xs font-mono font-medium ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  SET — DEZ 2026
                </span>
                {data && (
                  <span className={`text-xs font-mono font-medium ${isDark ? "text-emerald-500" : "text-emerald-600"}`}>
                    ● Dados da API
                  </span>
                )}
              </div>
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                PLANEJAMENTO DE FINAL DE ANO <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">(PFA)</span>
              </h1>
            </div>
          </div>

          <button
            onClick={reload}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all duration-200 self-start md:self-auto ${
              isDark
                ? "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Dados</span>
          </button>
        </div>

        {/* TABS */}
        <div className="mt-8 flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-slate-700/30 dark:border-slate-800/50 pt-4">
          {tabsConfig.map((t) => {
            const isActive = tab === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => setTab(t.id)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className={`relative px-5 py-3 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center gap-2.5 shrink-0 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                    : isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-800/40"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                }`}
              >
                <span className={`text-[10px] font-mono ${isActive ? "text-blue-200" : "text-slate-500"}`}>
                  {t.num}
                </span>
                <span>{t.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="pfaActiveTabIndicator"
                    className="absolute -bottom-1 left-4 right-4 h-0.5 bg-white rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* FILTROS */}
      <div className={`p-5 rounded-2xl border backdrop-blur-xl flex flex-col gap-4 transition-all duration-300 ${
        isDark
          ? "bg-slate-900/60 border-slate-800/80 shadow-xl"
          : "bg-white/60 border-slate-200/80 shadow-md"
      }`}>
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Centro de Distribuição"
            value={cd}
            onChange={setCd}
            options={cdOptions}
            icon={<Building2 className="w-3.5 h-3.5" />}
            theme={theme}
          />

          {tab !== "transferencia" && (
            <Select
              label="Categoria"
              value={categoria}
              onChange={setCategoria}
              options={categoriaOptions}
              icon={<Package className="w-3.5 h-3.5" />}
              theme={theme}
            />
          )}

          {tab === "faturamento" && (
            <Select
              label="Tipo de Demanda"
              value={tipoDemanda}
              onChange={setTipoDemanda}
              options={tipoDemandaOptions}
              icon={<Filter className="w-3.5 h-3.5" />}
              theme={theme}
            />
          )}

          <Select
            label="Mês de Análise"
            value={mes}
            onChange={setMes}
            options={mesOptions}
            icon={<Calendar className="w-3.5 h-3.5" />}
            theme={theme}
          />

          <Select
            label="Semana do Ano"
            value={semana}
            onChange={setSemana}
            options={semanaOptions}
            icon={<CalendarRange className="w-3.5 h-3.5" />}
            theme={theme}
          />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setOcultarFimDeSemana((prev) => !prev)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all duration-200 ${
              ocultarFimDeSemana
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10"
                : isDark
                  ? "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
            title="Retirar ou exibir dados de Sábado e Domingo dos gráficos"
          >
            <CalendarOff className="w-3.5 h-3.5 text-amber-400" />
            <span>{ocultarFimDeSemana ? "Sem Sáb / Dom" : "Exibir Sáb / Dom"}</span>
          </motion.button>

          {tab !== "transferencia" && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCategorias((prev) => !prev)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all duration-200 ${
                showCategorias
                  ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20"
                  : isDark
                    ? "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800"
                    : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {showCategorias ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showCategorias ? "Ocultar Categorias" : "Exibir Categorias"}</span>
            </motion.button>
          )}

          {(cd !== "all" || categoria !== "all" || mes !== "all" || semana !== "all" || tipoDemanda !== "all" || diaFiltro || ocultarFimDeSemana) && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCd("all");
                setCategoria("all");
                setMes("all");
                setSemana("all");
                setTipoDemanda("all");
                setDiaFiltro(null);
                setOcultarFimDeSemana(false);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all duration-200 ${
                isDark
                  ? "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </motion.button>
          )}
        </div>

        {/* ACTIVE FILTER BADGES & CLICK HINT */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-400" /> Filtros Ativos:
            </span>
            {cd !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                CD: {CD_LABEL[cd] || `CD ${cd}`}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setCd("all")} />
              </span>
            )}
            {categoria !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                Cat: {categoria}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setCategoria("all")} />
              </span>
            )}
            {mes !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Mês: {MES_NOMES[mes] || mes}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setMes("all")} />
              </span>
            )}
            {semana !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                Semana {semana}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSemana("all")} />
              </span>
            )}
            {tipoDemanda !== "all" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Tipo: {tipoDemanda}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setTipoDemanda("all")} />
              </span>
            )}
            {diaFiltro && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/30">
                Dia: {diaFiltro}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setDiaFiltro(null)} />
              </span>
            )}
            {ocultarFimDeSemana && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Sem Sáb/Dom
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setOcultarFimDeSemana(false)} />
              </span>
            )}
            {cd === "all" && categoria === "all" && mes === "all" && tipoDemanda === "all" && !diaFiltro && !ocultarFimDeSemana && (
              <span className="text-xs text-slate-500 italic">Exibindo visão global consolidada</span>
            )}
          </div>
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 bg-slate-800/30 px-3 py-1 rounded-lg border border-slate-700/40">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Dica: Clique em qualquer barra dos gráficos para filtrar por CD, Categoria ou Dia</span>
          </div>
        </div>
      </div>

      {/* ============================================================
          CONTENT BY TAB
          ============================================================ */}
      <AnimatePresence mode="wait">
        {/* RECEBIMENTO */}
        {tab === "recebimento" && (
          <motion.div
            key="tab-recebimento"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label1="Capacidade Média"
                value1={fmt(kpisRecebimento.mediaCapacidade)}
                label2="Capacidade Total"
                value2={fmt(kpisRecebimento.capacidade)}
                icon={<BarChart3 className="w-4 h-4 text-amber-500" />}
                accentColor="amber"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Agendamento Médio"
                value1={fmt(kpisRecebimento.mediaAgendados)}
                label2="Total Agendado"
                value2={fmt(kpisRecebimento.agendados)}
                icon={<Calendar className="w-4 h-4 text-blue-500" />}
                accentColor="blue"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Recebimento Médio"
                value1={fmt(kpisRecebimento.mediaRecebidos)}
                label2="Total Recebido"
                value2={fmt(kpisRecebimento.recebidos)}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                accentColor="emerald"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Proposto Médio"
                value1={fmt(kpisRecebimento.mediaProposto)}
                label2="Total Planejado"
                value2={fmt(kpisRecebimento.proposto)}
                icon={<TrendingUp className="w-4 h-4 text-teal-500" />}
                accentColor="teal"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
            </div>

            {/* CHART POR DIA */}
            <div className={`p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
              isDark
                ? "bg-slate-900/80 border-slate-800/80 shadow-2xl shadow-slate-950/40"
                : "bg-white/80 border-slate-200/80 shadow-xl shadow-slate-200/50"
            }`}>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className={`text-sm sm:text-base font-extrabold uppercase tracking-wider font-mono ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                    CAPACIDADE VS. AGENDADO VS. RECEBIDO, POR DIA
                  </h3>
                  <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Acompanhamento diário das métricas operacionais de recebimento. Clique em uma barra para isolar o dia.
                  </p>
                </div>
              </div>

              <div className="h-[360px] w-full">
                <Chart
                  type="bar"
                  data={{
                    labels: recebimentoPorDia.map((d) => d.dia),
                    datasets: [
                      {
                        type: "bar" as const,
                        label: "Agendados",
                        data: recebimentoPorDia.map((d) => d.Agendados),
                        backgroundColor: isDark ? "rgba(203, 213, 225, 0.85)" : "rgba(148, 163, 184, 0.85)",
                        borderRadius: 3,
                      },
                      {
                        type: "line" as const,
                        label: "Capacidade",
                        data: recebimentoPorDia.map((d) => d.Capacidade),
                        borderColor: "#f97316",
                        backgroundColor: "rgba(249, 115, 22, 0.15)",
                        borderWidth: 2.5,
                        pointRadius: 2.5,
                        tension: 0.3,
                      },
                      {
                        type: "line" as const,
                        label: "Proposto",
                        data: recebimentoPorDia.map((d) => d.Proposto),
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59, 130, 246, 0.15)",
                        borderWidth: 2,
                        pointRadius: 2.5,
                        tension: 0.3,
                      },
                      {
                        type: "bar" as const,
                        label: "Recebidos",
                        data: recebimentoPorDia.map((d) => d.Recebidos),
                        backgroundColor: isDark ? "rgba(56, 163, 165, 0.85)" : "rgba(13, 148, 136, 0.85)",
                        borderRadius: 3,
                      },
                    ],
                  }}
                  options={createInteractiveOptions(handleDailyChartClick)}
                  plugins={[datalabelsPlugin]}
                />
              </div>
            </div>

            {/* CATEGORIAS POR CD (OPCIONAL) */}
            {showCategorias ? (
              <CategoryCdBreakdown
                title="Recebimento: Categorias por Centro de Distribuição"
                subtitle="Volume total recebido por categoria em cada CD (clique nas barras para filtrar)"
                dataRows={recebimentoData}
                valField="recebidos"
                valLabel="itens recebidos"
                selectedCd={cd}
                selectedCat={categoria}
                onSelectCd={setCd}
                onSelectCat={setCategoria}
                theme={theme}
              />
            ) : (
              <button
                onClick={() => setShowCategorias(true)}
                className={`w-full py-3.5 px-4 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 ${
                  isDark
                    ? "border-slate-800 text-slate-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/10"
                    : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-purple-500/50 hover:bg-purple-50"
                }`}
              >
                <Eye className="w-4 h-4 text-purple-400" />
                <span>Exibir Detalhamento por Categoria & CD</span>
              </button>
            )}
          </motion.div>
        )}

        {/* IMPORTAÇÃO */}
        {tab === "importacao" && (
          <motion.div
            key="tab-importacao"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label1="Importação Média"
                value1={fmt(kpisImportacao.mediaImportacao)}
                label2="Total Importado"
                value2={fmt(kpisImportacao.total)}
                icon={<Truck className="w-4 h-4 text-teal-500" />}
                accentColor="teal"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Proposto Médio"
                value1={fmt(kpisImportacao.mediaProposto)}
                label2="Total Proposto"
                value2={fmt(kpisImportacao.proposto)}
                icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
                accentColor="blue"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Registros Analisados"
                value1={fmt(kpisImportacao.registros)}
                icon={<Layers className="w-4 h-4 text-violet-500" />}
                accentColor="violet"
                theme={theme}
              />
              <MetricCard
                label1="Atingimento Proposto"
                value1={kpisImportacao.proposto ? `${Math.round((kpisImportacao.total / kpisImportacao.proposto) * 100)}%` : "100%"}
                icon={<Award className="w-4 h-4 text-emerald-500" />}
                accentColor="emerald"
                theme={theme}
              />
            </div>

            <div className={`p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
              isDark
                ? "bg-slate-900/80 border-slate-800/80 shadow-2xl shadow-slate-950/40"
                : "bg-white/80 border-slate-200/80 shadow-xl shadow-slate-200/50"
            }`}>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Quantidade Importada vs. Proposto (por dia)
                  </h3>
                  <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Comparativo da carga importada real em relação ao planejado no PFA. Clique em uma barra para filtrar o dia.
                  </p>
                </div>
              </div>

              <div className="h-[360px] w-full">
                <Chart
                  type="bar"
                  data={{
                    labels: importacaoPorDia.map((d) => d.dia),
                    datasets: [
                      {
                        type: "bar" as const,
                        label: "Importado",
                        data: importacaoPorDia.map((d) => d.Importado),
                        backgroundColor: "rgba(20, 184, 166, 0.85)",
                        borderRadius: 6,
                      },
                      {
                        type: "line" as const,
                        label: "Proposto",
                        data: importacaoPorDia.map((d) => d.Proposto),
                        borderColor: "#8b5cf6",
                        backgroundColor: "rgba(139, 92, 246, 0.2)",
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={createInteractiveOptions(handleDailyChartClick)}
                  plugins={[datalabelsPlugin]}
                />
              </div>
            </div>

            {/* CATEGORIAS POR CD (OPCIONAL) */}
            {showCategorias ? (
              <CategoryCdBreakdown
                title="Importação: Categorias por Centro de Distribuição"
                subtitle="Quantidade importada por categoria em cada CD (clique nas barras para filtrar)"
                dataRows={importacaoData}
                valField="qtdImportacao"
                valLabel="qtd importada"
                selectedCd={cd}
                selectedCat={categoria}
                onSelectCd={setCd}
                onSelectCat={setCategoria}
                theme={theme}
              />
            ) : (
              <button
                onClick={() => setShowCategorias(true)}
                className={`w-full py-3.5 px-4 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 ${
                  isDark
                    ? "border-slate-800 text-slate-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/10"
                    : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-purple-500/50 hover:bg-purple-50"
                }`}
              >
                <Eye className="w-4 h-4 text-purple-400" />
                <span>Exibir Detalhamento por Categoria & CD</span>
              </button>
            )}
          </motion.div>
        )}

        {/* EXPEDIÇÃO / FATURAMENTO */}
        {tab === "faturamento" && (
          <motion.div
            key="tab-faturamento"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                label1="Capacidade Média"
                value1={fmt(kpisFaturamento.mediaCapacidade)}
                label2="Capacidade Total"
                value2={fmt(kpisFaturamento.capacidade)}
                icon={<BarChart3 className="w-4 h-4 text-amber-500" />}
                accentColor="amber"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Faturamento Médio"
                value1={fmt(kpisFaturamento.mediaFaturado)}
                label2="Faturamento Total"
                value2={fmt(kpisFaturamento.total)}
                icon={<Zap className="w-4 h-4 text-teal-500" />}
                accentColor="teal"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Proposto Médio"
                value1={fmt(kpisFaturamento.mediaProposto)}
                label2="Proposto Total"
                value2={fmt(kpisFaturamento.proposto)}
                icon={<TrendingUp className="w-4 h-4 text-blue-500" />}
                accentColor="blue"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
            </div>

            <div className={`p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
              isDark
                ? "bg-slate-900/80 border-slate-800/80 shadow-2xl shadow-slate-950/40"
                : "bg-white/80 border-slate-200/80 shadow-xl shadow-slate-200/50"
            }`}>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Faturamento vs. Proposto vs. Capacidade (por dia)
                  </h3>
                  <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Visão quantitativa de expedição diária. Clique em uma barra para filtrar o dia.
                  </p>
                </div>
              </div>

              <div className="h-[360px] w-full">
                <Chart
                  type="bar"
                  data={{
                    labels: faturamentoPorDia.map((d) => d.dia),
                    datasets: [
                      {
                        type: "bar" as const,
                        label: "Faturado",
                        data: faturamentoPorDia.map((d) => d.Faturado),
                        backgroundColor: "rgba(59, 130, 246, 0.85)",
                        borderRadius: 6,
                      },
                      {
                        type: "line" as const,
                        label: "Proposto",
                        data: faturamentoPorDia.map((d) => d.Proposto),
                        borderColor: "#8b5cf6",
                        backgroundColor: "rgba(139, 92, 246, 0.2)",
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.3,
                      },
                      {
                        type: "line" as const,
                        label: "Capacidade",
                        data: faturamentoPorDia.map((d) => d.Capacidade),
                        borderColor: "#f59e0b",
                        backgroundColor: "rgba(245, 158, 11, 0.2)",
                        borderWidth: 2,
                        pointRadius: 2,
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={createInteractiveOptions(handleDailyChartClick)}
                  plugins={[datalabelsPlugin]}
                />
              </div>
            </div>

            {/* CATEGORIAS POR CD (OPCIONAL) */}
            {showCategorias ? (
              <CategoryCdBreakdown
                title="Faturamento: Categorias por Centro de Distribuição"
                subtitle="Volume faturado por categoria em cada CD (clique nas barras para filtrar)"
                dataRows={faturamentoData}
                valField="faturamento"
                valLabel="faturados"
                selectedCd={cd}
                selectedCat={categoria}
                onSelectCd={setCd}
                onSelectCat={setCategoria}
                theme={theme}
              />
            ) : (
              <button
                onClick={() => setShowCategorias(true)}
                className={`w-full py-3.5 px-4 rounded-2xl border border-dashed flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 ${
                  isDark
                    ? "border-slate-800 text-slate-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/10"
                    : "border-slate-200 text-slate-500 hover:text-slate-900 hover:border-purple-500/50 hover:bg-purple-50"
                }`}
              >
                <Eye className="w-4 h-4 text-purple-400" />
                <span>Exibir Detalhamento por Categoria & CD</span>
              </button>
            )}
          </motion.div>
        )}

        {/* TRANSFERÊNCIA */}
        {tab === "transferencia" && (
          <motion.div
            key="tab-transferencia"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label1="Média Transferência"
                value1={fmt(kpisTransferencia.mediaTransferencia)}
                label2="Total Transferido"
                value2={fmt(kpisTransferencia.rotas)}
                icon={<Truck className="w-4 h-4 text-teal-500" />}
                accentColor="teal"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="Proposto Médio"
                value1={fmt(kpisTransferencia.mediaProposto)}
                label2="Total Proposto"
                value2={fmt(kpisTransferencia.proposto)}
                icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
                accentColor="amber"
                badge="Média (exc. Sáb/Dom)"
                theme={theme}
              />
              <MetricCard
                label1="CDs de Origem"
                value1={kpisTransferencia.origens}
                icon={<Building2 className="w-4 h-4 text-blue-500" />}
                accentColor="blue"
                theme={theme}
              />
              <MetricCard
                label1="CDs de Destino"
                value1={kpisTransferencia.destinos}
                icon={<ArrowUpRight className="w-4 h-4 text-violet-500" />}
                accentColor="violet"
                theme={theme}
              />
            </div>

            <div className={`p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
              isDark
                ? "bg-slate-900/80 border-slate-800/80 shadow-2xl shadow-slate-950/40"
                : "bg-white/80 border-slate-200/80 shadow-xl shadow-slate-200/50"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Encaixe entre CDs — Destino {destinoEncaixe != null ? (CD_LABEL[destinoEncaixe] || `CD ${destinoEncaixe}`) : ""}
                  </h3>
                  <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Análise dos picos máximos e médios por dia da semana empilhados por origem com linhas de 3º Quartil
                  </p>
                </div>

                {destinoOptions.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      CD Destino:
                    </span>
                    <select
                      value={destinoEncaixe ?? ""}
                      onChange={(e) => setDestinoEncaixe(Number(e.target.value))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border outline-none ${
                        isDark
                          ? "bg-slate-950 border-slate-800 text-white"
                          : "bg-slate-100 border-slate-200 text-slate-900"
                      }`}
                    >
                      {destinoOptions.map((d: any) => (
                        <option key={d} value={d}>
                          {CD_LABEL[d] || `CD ${d}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="h-[400px] w-full">
                <Bar
                  data={{
                    labels: encaixeData.rows.map((r: any) => r.grupo),
                    datasets: encaixeData.origens.map((origem: any, index: number) => ({
                      label: String(origem),
                      data: encaixeData.rows.map((r: any) => r[String(origem)] || 0),
                      backgroundColor: ORIGEM_COLORS_TW[index % ORIGEM_COLORS_TW.length],
                      borderRadius: 4,
                    })),
                  }}
                  options={stackedChartOptions}
                  plugins={[referenceLinesPlugin]}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}