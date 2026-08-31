import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
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
  BarChart3,
  RefreshCw,
  Filter,
  FilterX,
  Calendar,
  Layers,
  Activity,
  PieChart as PieChartIcon,
  TrendingUp,
  X,
  Building,
  Package,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Info,
  Coins,
  CheckCircle,
  TrendingDown,
  Sparkles,
  Truck,
  Zap,
  ArrowUpRight,
  BarChart2
} from "lucide-react";
import { Capacidade, User } from "../types";
import { generateMockCapacidades, generateMockMetas } from "../mockData";

// Register ChartJS plugins and controllers
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

// Custom inline plugin to draw numbers/datalabels above each column (for Bar charts)
const customDatalabels = {
  id: "customDatalabels",
  afterDraw(chart: any) {
    if (chart.config.type === "doughnut" || chart.config.type === "pie") {
      return;
    }

    const { ctx } = chart;
    ctx.save();

    const isDarkMode = document.documentElement.classList.contains("dark");
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    // Setup colors for maximum legibility (high contrast outline)
    const fillColor = isDarkMode ? "#f8fafc" : "#00122e";
    const strokeColor = isDarkMode ? "#00122e" : "#ffffff";

    const datasets = chart.data.datasets;
    if (!datasets || datasets.length === 0) {
      ctx.restore();
      return;
    }

    const labelsCount = chart.data.labels ? chart.data.labels.length : 0;
    if (!labelsCount) {
      ctx.restore();
      return;
    }
    
    // Check if the scale or options are configured as stacked
    const isStacked = 
      chart.scales.y?.options?.stacked === true ||
      chart.options?.scales?.y?.stacked === true ||
      chart.options?.scales?.x?.stacked === true;

    if (isStacked) {
      for (let index = 0; index < labelsCount; index++) {
        let total = 0;
        let topY = Infinity;
        let hasVisible = false;
        let barX = 0;

        datasets.forEach((dataset: any, dsIndex: number) => {
          const meta = chart.getDatasetMeta(dsIndex);
          if (meta && meta.data && meta.data[index]) {
            const bar = meta.data[index];
            if (!bar.hidden && chart.isDatasetVisible(dsIndex)) {
              hasVisible = true;
              total += dataset.data[index] || 0;
              barX = bar.x;
              if (bar.y < topY) {
                topY = bar.y;
              }
            }
          }
        });

        if (hasVisible && total > 0 && topY !== Infinity) {
          const text = Math.round(total).toLocaleString("pt-BR");
          const x = barX;
          const y = topY - 4;

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(text, x, y);

          ctx.fillStyle = fillColor;
          ctx.fillText(text, x, y);
        }
      }
    } else {
      datasets.forEach((dataset: any, dsIndex: number) => {
        const meta = chart.getDatasetMeta(dsIndex);
        if (meta && meta.data && chart.isDatasetVisible(dsIndex)) {
          meta.data.forEach((bar: any, index: number) => {
            const val = dataset.data[index];
            if (val > 0) {
              const text = Math.round(val).toLocaleString("pt-BR");
              const x = bar.x;
              const y = bar.y - 4;

              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 3;
              ctx.lineJoin = "round";
              ctx.strokeText(text, x, y);

              ctx.fillStyle = fillColor;
              ctx.fillText(text, x, y);
            }
          });
        }
      });
    }
    ctx.restore();
  }
};

const MONTH_NAMES: Record<string, string> = {
  "01": "Janeiro",
  "02": "Fevereiro",
  "03": "Março",
  "04": "Abril",
  "05": "Maio",
  "06": "Junho",
  "07": "Julho",
  "08": "Agosto",
  "09": "Setembro",
  "10": "Outubro",
  "11": "Novembro",
  "12": "Dezembro"
};

// Helper to get week of month (1 to 5)
function getWeekOfMonth(day: number): number {
  return Math.ceil(day / 7);
}

interface MetaInbound {
  id: number;
  ano: number;
  mes: number;
  semana?: number;
  cd: number;
  categoria: string;
  capacidadeInbound: number;
  capacidadeRemunerada?: number;
}

interface MetaOutbound {
  id: number;
  ano: number;
  mes: number;
  semana?: number;
  cd: number;
  categoria: string;
  capacidadeFracionada: number;
  capacidadeFechada: number;
}

interface DashboardAnaliticoProps {
  theme: "light" | "dark";
  showNotification: (msg: string) => void;
  user?: User;
}

// Global memory cache
let cachedCapacidades: Capacidade[] | null = null;
let cachedMetasInbound: MetaInbound[] | null = null;
let cachedMetasOutbound: MetaOutbound[] | null = null;

export default function DashboardAnalitico({ theme, showNotification, user }: DashboardAnaliticoProps) {
  const [capacidades, setCapacidades] = useState<Capacidade[]>(() => cachedCapacidades || []);
  const [visibleCharts, setVisibleCharts] = useState<"both" | "inbound" | "outbound">("both");
  const [metasInbound, setMetasInbound] = useState<MetaInbound[]>(() => cachedMetasInbound || []);
  const [metasOutbound, setMetasOutbound] = useState<MetaOutbound[]>(() => cachedMetasOutbound || []);
  
  const [isLoading, setIsLoading] = useState(!cachedCapacidades);
  const [error, setError] = useState<string | null>(null);

  // Dropdown filter states
  const [selectedCd, setSelectedCd] = useState<string>("all");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // PowerBI-style cross-filtering states
  const [filterMonth, setFilterMonth] = useState<string | null>(null);
  const [filterWeek, setFilterWeek] = useState<number | null>(null);
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [selectedCdCategory, setSelectedCdCategory] = useState<{ cd: string; category: string } | null>(null);

  // View mode for X-Axis aggregation level
  const [viewMode, setViewMode] = useState<"mensal" | "semanal" | "diario">("mensal");

  // Local filters for the Category Chart
  const [catChartCd, setCatChartCd] = useState<string>("all");
  const [catChartFlow, setCatChartFlow] = useState<"both" | "inbound" | "outbound">("both");

  // Fetch all endpoints in parallel
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (user?.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }

      const [resCap, resIn, resOut] = await Promise.all([
        fetch("/api/capacidades", { headers }),
        fetch("/api/metas/inbound", { headers }),
        fetch("/api/metas/outbound", { headers })
      ]);

      if (!resCap.ok || !resIn.ok || !resOut.ok) {
        throw new Error("Falha ao carregar dados das APIs");
      }

      const [capData, inData, outData] = await Promise.all([
        resCap.json(),
        resIn.json(),
        resOut.json()
      ]);

      const validCaps = (Array.isArray(capData) && capData.length > 0) ? capData : generateMockCapacidades();
      const validIn = (Array.isArray(inData) && inData.length > 0) ? inData : generateMockMetas("inbound", validCaps);
      const validOut = (Array.isArray(outData) && outData.length > 0) ? outData : generateMockMetas("outbound", validCaps);

      cachedCapacidades = validCaps;
      cachedMetasInbound = validIn;
      cachedMetasOutbound = validOut;

      setCapacidades(validCaps);
      setMetasInbound(validIn);
      setMetasOutbound(validOut);
      setError(null);
      if (!silent) {
        showNotification("📊 Painel Analítico sincronizado com sucesso!");
      }
    } catch (err: any) {
      console.warn("⚠️ Utilizando dados mock simulados para o Painel Analítico:", err);
      const mockCaps = generateMockCapacidades();
      const mockIn = generateMockMetas("inbound", mockCaps);
      const mockOut = generateMockMetas("outbound", mockCaps);
      cachedCapacidades = mockCaps;
      cachedMetasInbound = mockIn;
      cachedMetasOutbound = mockOut;
      setCapacidades(mockCaps);
      setMetasInbound(mockIn);
      setMetasOutbound(mockOut);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [showNotification, user]);

  useEffect(() => {
    const silentFetch = !!cachedCapacidades;
    fetchData(silentFetch);
  }, [fetchData]);

  // Unique lists for Dropdowns
  const cdsList = useMemo(() => {
    const list = new Set<string>();
    capacidades.forEach(c => { if (c.cd) list.add(String(c.cd)); });
    metasInbound.forEach(m => { if (m.cd) list.add(String(m.cd)); });
    metasOutbound.forEach(m => { if (m.cd) list.add(String(m.cd)); });
    return Array.from(list).sort((a,b) => Number(a) - Number(b));
  }, [capacidades, metasInbound, metasOutbound]);

  const categoriesList = useMemo(() => {
    const list = new Set<string>();
    capacidades.forEach(c => { if (c.categoria) list.add(c.categoria); });
    metasInbound.forEach(m => { if (m.categoria) list.add(m.categoria); });
    metasOutbound.forEach(m => { if (m.categoria) list.add(m.categoria); });
    return Array.from(list).sort();
  }, [capacidades, metasInbound, metasOutbound]);

  const monthsList = useMemo(() => {
    const list = new Set<string>();
    capacidades.forEach(c => {
      const parts = c.dataMovimentacao.split("-");
      if (parts[1]) list.add(parts[1]);
    });
    metasInbound.forEach(m => {
      const str = String(m.mes).padStart(2, "0");
      list.add(str);
    });
    metasOutbound.forEach(m => {
      const str = String(m.mes).padStart(2, "0");
      list.add(str);
    });
    return Array.from(list).sort();
  }, [capacidades, metasInbound, metasOutbound]);

  // Handle clearing all interactive and dropdown filters
  const handleClearFilters = () => {
    setSelectedCd("all");
    setSelectedCat("all");
    setSelectedMonth("all");
    setFilterMonth(null);
    setFilterWeek(null);
    setFilterDay(null);
    setSelectedCdCategory(null);
    setCatChartCd("all");
    setViewMode("mensal");
    showNotification("🧹 Todos os filtros foram limpos!");
  };

  const isInteractiveFiltered = useMemo(() => {
    return filterMonth !== null || filterWeek !== null || filterDay !== null || selectedCdCategory !== null;
  }, [filterMonth, filterWeek, filterDay, selectedCdCategory]);

  const handleDrillUp = () => {
    if (viewMode === "diario") {
      setFilterDay(null);
      setViewMode("semanal");
      showNotification("🔍 Subindo para visualização Semanal");
    } else if (viewMode === "semanal") {
      setFilterWeek(null);
      setViewMode("mensal");
      showNotification("🔍 Subindo para visualização Mensal");
    }
  };

  const handleSelectPeriod = (item: any) => {
    if (!item) return;

    if (viewMode === "mensal") {
      setFilterMonth(item.monthKey);
      setViewMode("semanal");
      showNotification(`📅 Detalhando mês: ${item.name}`);
    } else if (viewMode === "semanal") {
      setFilterWeek(item.weekNum);
      setViewMode("diario");
      showNotification(`📅 Detalhando Semana ${item.weekNum}`);
    } else if (viewMode === "diario") {
      if (filterDay === item.dateStr) {
        setFilterDay(null);
        showNotification("📍 Seleção de dia desfeita");
      } else {
        setFilterDay(item.dateStr);
        showNotification(`📍 Filtrado por dia específico: ${item.name}`);
      }
    }
  };

  // Filter helper for Capacidades
  const filteredCapacidades = useMemo(() => {
    return capacidades.filter(item => {
      if (selectedCd !== "all" && String(item.cd) !== selectedCd) return false;
      if (selectedCat !== "all" && item.categoria !== selectedCat) return false;
      
      const parts = item.dataMovimentacao.split("-");
      const itemMonth = parts[1];
      const dayNum = parseInt(parts[2], 10);
      const itemWeek = getWeekOfMonth(dayNum);

      if (selectedMonth !== "all" && itemMonth !== selectedMonth) return false;

      if (selectedCdCategory) {
        if (String(item.cd) !== selectedCdCategory.cd || item.categoria !== selectedCdCategory.category) {
          return false;
        }
      }

      if (filterMonth && itemMonth !== filterMonth) return false;
      if (filterWeek && itemWeek !== filterWeek) return false;
      if (filterDay && item.dataMovimentacao !== filterDay) return false;

      return true;
    });
  }, [capacidades, selectedCd, selectedCat, selectedMonth, selectedCdCategory, filterMonth, filterWeek, filterDay]);

  // Filter helper for Metas Inbound
  const filteredMetasInbound = useMemo(() => {
    return metasInbound.filter(item => {
      if (selectedCd !== "all" && String(item.cd) !== selectedCd) return false;
      if (selectedCat !== "all" && item.categoria !== selectedCat) return false;
      
      const itemMonthStr = String(item.mes).padStart(2, "0");
      if (selectedMonth !== "all" && itemMonthStr !== selectedMonth) return false;

      if (selectedCdCategory) {
        if (String(item.cd) !== selectedCdCategory.cd || item.categoria !== selectedCdCategory.category) {
          return false;
        }
      }

      if (filterMonth && itemMonthStr !== filterMonth) return false;

      return true;
    });
  }, [metasInbound, selectedCd, selectedCat, selectedMonth, selectedCdCategory, filterMonth]);

  // Filter helper for Metas Outbound
  const filteredMetasOutbound = useMemo(() => {
    return metasOutbound.filter(item => {
      if (selectedCd !== "all" && String(item.cd) !== selectedCd) return false;
      if (selectedCat !== "all" && item.categoria !== selectedCat) return false;
      
      const itemMonthStr = String(item.mes).padStart(2, "0");
      if (selectedMonth !== "all" && itemMonthStr !== selectedMonth) return false;

      if (selectedCdCategory) {
        if (String(item.cd) !== selectedCdCategory.cd || item.categoria !== selectedCdCategory.category) {
          return false;
        }
      }

      if (filterMonth && itemMonthStr !== filterMonth) return false;

      return true;
    });
  }, [metasOutbound, selectedCd, selectedCat, selectedMonth, selectedCdCategory, filterMonth]);

  // Aggregate Data for Period Charts (Months / Weeks / Days)
  const aggregatedPeriodData = useMemo(() => {
    const map: Record<string, {
      key: string;
      name: string;
      monthKey: string;
      weekNum?: number;
      dateStr?: string;
      inbound: number;
      remunerado: number;
      fracionado: number;
      fechado: number;
      outboundTotal: number;
      inboundMeta: number;
      remuneradoMeta: number;
      outboundFracionadoMeta: number;
      outboundFechadoMeta: number;
      outboundTotalMeta: number;
      cdBreakdown: Record<string, {
        inbound: number;
        remunerado: number;
        fracionado: number;
        fechado: number;
        outboundTotal: number;
      }>;
    }> = {};

    filteredCapacidades.forEach(item => {
      const parts = item.dataMovimentacao.split("-");
      const year = parts[0];
      const month = parts[1];
      const day = parseInt(parts[2], 10);
      const week = getWeekOfMonth(day);

      let key = "";
      let name = "";

      if (viewMode === "mensal") {
        key = `${year}-${month}`;
        name = `${MONTH_NAMES[month] || month}/${year}`;
      } else if (viewMode === "semanal") {
        key = `${year}-${month}-W${week}`;
        name = `${MONTH_NAMES[month] || month} - Sem ${week}`;
      } else {
        key = item.dataMovimentacao;
        name = `${day}/${month}`;
      }

      if (!map[key]) {
        map[key] = {
          key,
          name,
          monthKey: month,
          weekNum: week,
          dateStr: item.dataMovimentacao,
          inbound: 0,
          remunerado: 0,
          fracionado: 0,
          fechado: 0,
          outboundTotal: 0,
          inboundMeta: 0,
          remuneradoMeta: 0,
          outboundFracionadoMeta: 0,
          outboundFechadoMeta: 0,
          outboundTotalMeta: 0,
          cdBreakdown: {}
        };
      }

      map[key].inbound += item.capacidadeInbound || 0;
      map[key].remunerado += item.recebimentoRemunerado || item.capacidadeRemunerada || 0;
      map[key].fracionado += item.capacidadeOutboundFracionado || 0;
      map[key].fechado += item.capacidadeOutboundFechado || 0;
      map[key].outboundTotal += (item.capacidadeOutboundFracionado || 0) + (item.capacidadeOutboundFechado || 0);

      const cdStr = String(item.cd);
      if (!map[key].cdBreakdown[cdStr]) {
        map[key].cdBreakdown[cdStr] = {
          inbound: 0,
          remunerado: 0,
          fracionado: 0,
          fechado: 0,
          outboundTotal: 0
        };
      }
      map[key].cdBreakdown[cdStr].inbound += item.capacidadeInbound || 0;
      map[key].cdBreakdown[cdStr].remunerado += item.recebimentoRemunerado || item.capacidadeRemunerada || 0;
      map[key].cdBreakdown[cdStr].fracionado += item.capacidadeOutboundFracionado || 0;
      map[key].cdBreakdown[cdStr].fechado += item.capacidadeOutboundFechado || 0;
      map[key].cdBreakdown[cdStr].outboundTotal += (item.capacidadeOutboundFracionado || 0) + (item.capacidadeOutboundFechado || 0);
    });

    Object.keys(map).forEach(key => {
      const entry = map[key];
      const yearNum = parseInt(key.split("-")[0], 10) || 2026;
      const monthNum = parseInt(entry.monthKey, 10);
      const weekNum = entry.weekNum;

      const monthlyInboundMetas = filteredMetasInbound.filter(m => m.ano === yearNum && m.mes === monthNum);
      let sumInbound = 0;
      let sumRemunerado = 0;

      if (viewMode === "mensal") {
        sumInbound = monthlyInboundMetas.reduce((sum, m) => sum + (m.capacidadeInbound || 0), 0);
        sumRemunerado = monthlyInboundMetas.reduce((sum, m) => sum + (m.capacidadeRemunerada || 0), 0);
      } else if (viewMode === "semanal" && weekNum !== undefined) {
        const weekly = monthlyInboundMetas.filter(m => m.semana === weekNum);
        if (weekly.length > 0) {
          sumInbound = weekly.reduce((sum, m) => sum + (m.capacidadeInbound || 0), 0);
          sumRemunerado = weekly.reduce((sum, m) => sum + (m.capacidadeRemunerada || 0), 0);
        } else {
          sumInbound = monthlyInboundMetas.reduce((sum, m) => sum + (m.capacidadeInbound || 0), 0) / 4;
          sumRemunerado = monthlyInboundMetas.reduce((sum, m) => sum + (m.capacidadeRemunerada || 0), 0) / 4;
        }
      } else {
        sumInbound = monthlyInboundMetas.reduce((sum, m) => sum + (m.capacidadeInbound || 0), 0) / 30;
        sumRemunerado = monthlyInboundMetas.reduce((sum, m) => sum + (m.capacidadeRemunerada || 0), 0) / 30;
      }
      entry.inboundMeta = sumInbound;
      entry.remuneradoMeta = sumRemunerado;

      const monthlyOutboundMetas = filteredMetasOutbound.filter(m => m.ano === yearNum && m.mes === monthNum);
      let sumFrac = 0;
      let sumFech = 0;

      if (viewMode === "mensal") {
        sumFrac = monthlyOutboundMetas.reduce((sum, m) => sum + (m.capacidadeFracionada || 0), 0);
        sumFech = monthlyOutboundMetas.reduce((sum, m) => sum + (m.capacidadeFechada || 0), 0);
      } else if (viewMode === "semanal" && weekNum !== undefined) {
        const weekly = monthlyOutboundMetas.filter(m => m.semana === weekNum);
        if (weekly.length > 0) {
          sumFrac = weekly.reduce((sum, m) => sum + (m.capacidadeFracionada || 0), 0);
          sumFech = weekly.reduce((sum, m) => sum + (m.capacidadeFechada || 0), 0);
        } else {
          const totalFrac = monthlyOutboundMetas.reduce((sum, m) => sum + (m.capacidadeFracionada || 0), 0);
          const totalFech = monthlyOutboundMetas.reduce((sum, m) => sum + (m.capacidadeFechada || 0), 0);
          sumFrac = totalFrac / 4;
          sumFech = totalFech / 4;
        }
      } else {
        const totalFrac = monthlyOutboundMetas.reduce((sum, m) => sum + (m.capacidadeFracionada || 0), 0);
        const totalFech = monthlyOutboundMetas.reduce((sum, m) => sum + (m.capacidadeFechada || 0), 0);
        sumFrac = totalFrac / 30;
        sumFech = totalFech / 30;
      }

      entry.outboundFracionadoMeta = sumFrac;
      entry.outboundFechadoMeta = sumFech;
      entry.outboundTotalMeta = sumFrac + sumFech;
    });

    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredCapacidades, filteredMetasInbound, filteredMetasOutbound, viewMode]);

  // Group Capacidades by CD for comparison
  const cdAggregateData = useMemo(() => {
    const map: Record<string, {
      cd: string;
      inbound: number;
      remunerado: number;
      outboundFracionado: number;
      outboundFechado: number;
      outboundTotal: number;
      totalGlobal: number;
    }> = {};

    filteredCapacidades.forEach(item => {
      const cdStr = String(item.cd);
      if (!map[cdStr]) {
        map[cdStr] = {
          cd: cdStr,
          inbound: 0,
          remunerado: 0,
          outboundFracionado: 0,
          outboundFechado: 0,
          outboundTotal: 0,
          totalGlobal: 0,
        };
      }
      const inStd = item.capacidadeInbound || 0;
      const inRem = item.recebimentoRemunerado || item.capacidadeRemunerada || 0;
      const outFrac = item.capacidadeOutboundFracionado || 0;
      const outFech = item.capacidadeOutboundFechado || 0;

      map[cdStr].inbound += inStd;
      map[cdStr].remunerado += inRem;
      map[cdStr].outboundFracionado += outFrac;
      map[cdStr].outboundFechado += outFech;
      map[cdStr].outboundTotal += (outFrac + outFech);
      map[cdStr].totalGlobal += (inStd + inRem + outFrac + outFech);
    });

    return Object.values(map).sort((a, b) => b.totalGlobal - a.totalGlobal);
  }, [filteredCapacidades]);

  // Donut Chart Data: Category Distribution Share
  const categoryDonutData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCapacidades.forEach(item => {
      const cat = item.categoria || "Outros";
      const total = (item.capacidadeInbound || 0) +
                    (item.recebimentoRemunerado || item.capacidadeRemunerada || 0) +
                    (item.capacidadeOutboundFracionado || 0) +
                    (item.capacidadeOutboundFechado || 0);
      map[cat] = (map[cat] || 0) + total;
    });

    const sortedCats = Object.keys(map).sort((a, b) => map[b] - map[a]);
    const colorPalette = [
      { bg: "rgba(16, 185, 129, 0.85)", border: "#10b981", text: "text-emerald-500" },
      { bg: "rgba(99, 102, 241, 0.85)", border: "#6366f1", text: "text-indigo-500" },
      { bg: "rgba(56, 189, 248, 0.85)", border: "#38bdf8", text: "text-sky-500" },
      { bg: "rgba(245, 158, 11, 0.85)", border: "#f59e0b", text: "text-amber-500" },
      { bg: "rgba(244, 63, 94, 0.85)",  border: "#f43f5e", text: "text-rose-500" },
      { bg: "rgba(168, 85, 247, 0.85)", border: "#a855f7", text: "text-purple-500" },
      { bg: "rgba(20, 184, 166, 0.85)", border: "#14b8a6", text: "text-teal-500" },
    ];

    const grandTotal = Object.values(map).reduce((a, b) => a + b, 0);

    return {
      labels: sortedCats,
      values: sortedCats.map(c => map[c]),
      percentages: sortedCats.map(c => grandTotal > 0 ? ((map[c] / grandTotal) * 100).toFixed(1) : "0"),
      colors: sortedCats.map((_, i) => colorPalette[i % colorPalette.length]),
      grandTotal,
    };
  }, [filteredCapacidades]);

  // KPI calculations
  const kpis = useMemo(() => {
    let totalInboundActual = 0;
    let totalRemuneradoActual = 0;
    let totalFracionadoActual = 0;
    let totalFechadoActual = 0;

    filteredCapacidades.forEach(item => {
      totalInboundActual += item.capacidadeInbound || 0;
      totalRemuneradoActual += item.recebimentoRemunerado || item.capacidadeRemunerada || 0;
      totalFracionadoActual += item.capacidadeOutboundFracionado || 0;
      totalFechadoActual += item.capacidadeOutboundFechado || 0;
    });

    let totalInboundMeta = 0;
    let totalRemuneradoMeta = 0;
    filteredMetasInbound.forEach(m => {
      totalInboundMeta += m.capacidadeInbound || 0;
      totalRemuneradoMeta += m.capacidadeRemunerada || 0;
    });

    let totalFracionadoMeta = 0;
    let totalFechadoMeta = 0;
    filteredMetasOutbound.forEach(m => {
      totalFracionadoMeta += m.capacidadeFracionada || 0;
      totalFechadoMeta += m.capacidadeFechada || 0;
    });

    const totalInboundCombined = totalInboundActual + totalRemuneradoActual;
    const totalOutboundCombined = totalFracionadoActual + totalFechadoActual;
    const grandTotal = totalInboundCombined + totalOutboundCombined;
    const extraRatio = totalInboundCombined > 0 ? (totalRemuneradoActual / totalInboundCombined) * 100 : 0;

    return {
      inboundActual: totalInboundActual,
      inboundMeta: totalInboundMeta,
      remuneradoActual: totalRemuneradoActual,
      remuneradoMeta: totalRemuneradoMeta,
      fracionadoActual: totalFracionadoActual,
      fracionadoMeta: totalFracionadoMeta,
      fechadoActual: totalFechadoActual,
      fechadoMeta: totalFechadoMeta,
      outboundActual: totalOutboundCombined,
      outboundMeta: totalFracionadoMeta + totalFechadoMeta,
      grandTotal,
      extraRatio
    };
  }, [filteredCapacidades, filteredMetasInbound, filteredMetasOutbound]);

  const fmt = (num: number) => {
    return Math.round(num).toLocaleString("pt-BR");
  };

  const isDark = theme === "dark";

  // ChartJS Base Options Configuration
  const chartOptionsBase = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(10, 15, 30, 0.95)" : "rgba(255, 255, 255, 0.98)",
          titleColor: isDark ? "#f8fafc" : "#00122e",
          bodyColor: isDark ? "#cbd5e1" : "#00122e",
          borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(148, 163, 184, 0.2)",
          borderWidth: 1.5,
          cornerRadius: 16,
          padding: 14,
          titleFont: {
            family: "Inter, sans-serif",
            size: 12,
            weight: "bold" as const,
          },
          bodyFont: {
            family: "JetBrains Mono, monospace",
            size: 11,
            weight: "bold" as const,
          },
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: isDark ? "#cbd5e1" : "#00122e",
            font: { family: "Inter, sans-serif", size: 10, weight: "bold" as const }
          }
        },
        y: {
          grace: "10%",
          grid: {
            color: isDark ? "rgba(51, 65, 85, 0.15)" : "rgba(226, 232, 240, 0.5)",
            drawTicks: false,
          },
          border: { display: false },
          ticks: {
            color: isDark ? "#cbd5e1" : "#00122e",
            font: { family: "Inter, sans-serif", size: 10, weight: "bold" as const },
            callback: function (value: any) {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${value / 1000}k`;
              return value;
            }
          }
        }
      }
    };
  }, [isDark]);

  // Chart 1: Inbound & Remunerado Combined Flow (STACKED BAR)
  const inboundChartData = useMemo(() => {
    return {
      labels: aggregatedPeriodData.map(d => d.name),
      datasets: [
        {
          label: "Inbound Padrão",
          data: aggregatedPeriodData.map(d => d.inbound),
          backgroundColor: aggregatedPeriodData.map(entry => {
            const isHighlighted = 
              (!filterMonth && !filterWeek && !filterDay) || 
              (filterMonth && entry.monthKey === filterMonth && viewMode === "mensal") ||
              (filterWeek && entry.weekNum === filterWeek && viewMode === "semanal") ||
              (filterDay && entry.dateStr === filterDay && viewMode === "diario");
            return isHighlighted ? "rgba(16, 185, 129, 0.85)" : "rgba(16, 185, 129, 0.2)";
          }),
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1.5,
          borderRadius: 0,
        },
        {
          label: "Inserções Remuneradas",
          data: aggregatedPeriodData.map(d => d.remunerado),
          backgroundColor: aggregatedPeriodData.map(entry => {
            const isHighlighted = 
              (!filterMonth && !filterWeek && !filterDay) || 
              (filterMonth && entry.monthKey === filterMonth && viewMode === "mensal") ||
              (filterWeek && entry.weekNum === filterWeek && viewMode === "semanal") ||
              (filterDay && entry.dateStr === filterDay && viewMode === "diario");
            const activeColor = isDark ? "rgba(56, 189, 248, 0.85)" : "rgba(0, 18, 46, 0.85)";
            const dimColor = isDark ? "rgba(56, 189, 248, 0.2)" : "rgba(0, 18, 46, 0.2)";
            return isHighlighted ? activeColor : dimColor;
          }),
          borderColor: isDark ? "rgba(56, 189, 248, 1)" : "rgba(0, 18, 46, 1)",
          borderWidth: 1.5,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
        }
      ]
    };
  }, [aggregatedPeriodData, filterMonth, filterWeek, filterDay, viewMode, isDark]);

  const getCdBreakdownLines = useCallback((periodItem: any, field: "inbound" | "remunerado" | "fracionado" | "fechado" | "outboundTotal", labelSuffix: string) => {
    if (!periodItem || !periodItem.cdBreakdown) return [];
    const cds = Object.keys(periodItem.cdBreakdown);
    const lines: string[] = [];
    cds.forEach(cd => {
      const val = periodItem.cdBreakdown[cd][field];
      if (val > 0) {
        lines.push(`CD ${cd} (${labelSuffix}): ${Math.round(val).toLocaleString("pt-BR")} caixas`);
      }
    });
    return lines;
  }, []);

  const inboundChartOptions = useMemo(() => {
    return {
      ...chartOptionsBase,
      plugins: {
        ...chartOptionsBase.plugins,
        tooltip: {
          ...chartOptionsBase.plugins?.tooltip,
          mode: "index" as const,
          intersect: false,
          callbacks: {
            label: function (context: any) {
              const index = context.dataIndex;
              const periodItem = aggregatedPeriodData[index];
              const labelName = context.dataset.label;
              const isRem = labelName === "Inserções Remuneradas";
              
              if (periodItem) {
                const totalVal = isRem ? periodItem.remunerado : periodItem.inbound;
                const prefix = isRem ? "Inserções Remuneradas" : "Inbound Padrão";
                const firstLine = `■ ${prefix} (Total: ${Math.round(totalVal).toLocaleString("pt-BR")} cx)`;
                const breakdowns = getCdBreakdownLines(periodItem, isRem ? "remunerado" : "inbound", isRem ? "Remuneradas" : "Inbound Padrão");
                return [firstLine, ...breakdowns.map(line => "  " + line)];
              }
              return "";
            }
          }
        }
      },
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const clickedItem = aggregatedPeriodData[index];
          handleSelectPeriod(clickedItem);
        }
      },
      scales: {
        ...chartOptionsBase.scales,
        x: { ...chartOptionsBase.scales.x, stacked: true },
        y: { ...chartOptionsBase.scales.y, stacked: true }
      }
    };
  }, [chartOptionsBase, aggregatedPeriodData, getCdBreakdownLines]);

  // Chart 2: Outbound Flow (Fracionado vs Fechado)
  const outboundChartData = useMemo(() => {
    return {
      labels: aggregatedPeriodData.map(d => d.name),
      datasets: [
        {
          label: "Fracionado",
          data: aggregatedPeriodData.map(d => d.fracionado),
          backgroundColor: aggregatedPeriodData.map(entry => {
            const isHighlighted = 
              (!filterMonth && !filterWeek && !filterDay) || 
              (filterMonth && entry.monthKey === filterMonth && viewMode === "mensal") ||
              (filterWeek && entry.weekNum === filterWeek && viewMode === "semanal") ||
              (filterDay && entry.dateStr === filterDay && viewMode === "diario");
            return isHighlighted ? "rgba(99, 102, 241, 0.85)" : "rgba(99, 102, 241, 0.25)";
          }),
          borderColor: "rgba(99, 102, 241, 1)",
          borderWidth: 1.5,
          borderRadius: 0,
        },
        {
          label: "Fechado",
          data: aggregatedPeriodData.map(d => d.fechado),
          backgroundColor: aggregatedPeriodData.map(entry => {
            const isHighlighted = 
              (!filterMonth && !filterWeek && !filterDay) || 
              (filterMonth && entry.monthKey === filterMonth && viewMode === "mensal") ||
              (filterWeek && entry.weekNum === filterWeek && viewMode === "semanal") ||
              (filterDay && entry.dateStr === filterDay && viewMode === "diario");
            return isHighlighted ? "rgba(56, 189, 248, 0.85)" : "rgba(56, 189, 248, 0.25)";
          }),
          borderColor: "rgba(56, 189, 248, 1)",
          borderWidth: 1.5,
          borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
        }
      ]
    };
  }, [aggregatedPeriodData, filterMonth, filterWeek, filterDay, viewMode]);

  const outboundChartOptions = useMemo(() => {
    return {
      ...chartOptionsBase,
      plugins: {
        ...chartOptionsBase.plugins,
        tooltip: {
          ...chartOptionsBase.plugins?.tooltip,
          callbacks: {
            label: function (context: any) {
              const index = context.dataIndex;
              const periodItem = aggregatedPeriodData[index];
              const labelName = context.dataset.label;
              const isFrac = labelName === "Fracionado";
              
              if (periodItem) {
                return getCdBreakdownLines(periodItem, isFrac ? "fracionado" : "fechado", isFrac ? "Fracionado" : "Fechado");
              }
              return "";
            }
          }
        }
      },
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const clickedItem = aggregatedPeriodData[index];
          handleSelectPeriod(clickedItem);
        }
      },
      scales: {
        ...chartOptionsBase.scales,
        x: { ...chartOptionsBase.scales.x, stacked: true },
        y: { ...chartOptionsBase.scales.y, stacked: true }
      }
    };
  }, [chartOptionsBase, aggregatedPeriodData, getCdBreakdownLines]);

  // Chart 3: CD Comparison (Inbound vs Outbound per CD)
  const cdChartDataConfig = useMemo(() => {
    return {
      labels: cdAggregateData.map(d => `CD ${d.cd}`),
      datasets: [
        {
          label: "Inbound Total",
          data: cdAggregateData.map(d => d.inbound + d.remunerado),
          backgroundColor: cdAggregateData.map(d => {
            const isSel = selectedCd === "all" || selectedCd === d.cd;
            return isSel ? "rgba(16, 185, 129, 0.85)" : "rgba(16, 185, 129, 0.25)";
          }),
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: "Outbound Total",
          data: cdAggregateData.map(d => d.outboundTotal),
          backgroundColor: cdAggregateData.map(d => {
            const isSel = selectedCd === "all" || selectedCd === d.cd;
            return isSel ? "rgba(99, 102, 241, 0.85)" : "rgba(99, 102, 241, 0.25)";
          }),
          borderColor: "rgba(99, 102, 241, 1)",
          borderWidth: 1.5,
          borderRadius: 6,
        }
      ]
    };
  }, [cdAggregateData, selectedCd]);

  const cdChartOptionsConfig = useMemo(() => {
    return {
      ...chartOptionsBase,
      plugins: {
        ...chartOptionsBase.plugins,
        tooltip: {
          ...chartOptionsBase.plugins?.tooltip,
          callbacks: {
            label: function (context: any) {
              const val = context.raw || 0;
              return `  ${context.dataset.label}: ${Math.round(val).toLocaleString("pt-BR")} caixas`;
            }
          }
        }
      },
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const clickedCd = cdAggregateData[index].cd;
          if (selectedCd === clickedCd) {
            setSelectedCd("all");
            showNotification("Filtro de CD desfeito");
          } else {
            setSelectedCd(clickedCd);
            showNotification(`📍 Filtrado por CD ${clickedCd}`);
          }
        }
      }
    };
  }, [chartOptionsBase, cdAggregateData, selectedCd, showNotification]);

  // Chart 4: Doughnut Chart config (Category Share)
  const donutChartConfig = useMemo(() => {
    return {
      labels: categoryDonutData.labels,
      datasets: [
        {
          data: categoryDonutData.values,
          backgroundColor: categoryDonutData.colors.map(c => c.bg),
          borderColor: categoryDonutData.colors.map(c => c.border),
          borderWidth: 2,
          hoverOffset: 8,
        }
      ]
    };
  }, [categoryDonutData]);

  const donutChartOptionsConfig = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "rgba(10, 15, 30, 0.95)" : "rgba(255, 255, 255, 0.98)",
          titleColor: isDark ? "#f8fafc" : "#00122e",
          bodyColor: isDark ? "#cbd5e1" : "#00122e",
          borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(148, 163, 184, 0.2)",
          borderWidth: 1.5,
          cornerRadius: 14,
          padding: 12,
          callbacks: {
            label: function (context: any) {
              const val = context.raw || 0;
              const grand = categoryDonutData.grandTotal || 1;
              const pct = ((val / grand) * 100).toFixed(1);
              return `  ${context.label}: ${Math.round(val).toLocaleString("pt-BR")} cx (${pct}%)`;
            }
          }
        }
      },
      onClick: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const clickedCat = categoryDonutData.labels[index];
          if (selectedCat === clickedCat) {
            setSelectedCat("all");
            showNotification("Filtro de categoria desfeito");
          } else {
            setSelectedCat(clickedCat);
            showNotification(`📍 Filtrado por categoria: ${clickedCat}`);
          }
        }
      }
    };
  }, [isDark, categoryDonutData, selectedCat, showNotification]);

  // Chart 5: Trend Line Chart
  const trendChartData = useMemo(() => {
    return {
      labels: aggregatedPeriodData.map(d => d.name),
      datasets: [
        {
          label: "Inbound Consolidado",
          data: aggregatedPeriodData.map(d => d.inbound + d.remunerado),
          borderColor: "rgba(16, 185, 129, 1)",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "rgba(16, 185, 129, 1)",
          fill: true,
        },
        {
          label: "Outbound Consolidado",
          data: aggregatedPeriodData.map(d => d.outboundTotal),
          borderColor: "rgba(99, 102, 241, 1)",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "rgba(99, 102, 241, 1)",
          fill: true,
        }
      ]
    };
  }, [aggregatedPeriodData]);

  const cardColors = {
    light: {
      title: "text-[#00122e]",
      subtitle: "text-slate-500",
      value: "text-[#00122e]",
      border: "border-slate-200/80",
      background: "bg-white",
      cardBg: "bg-white",
      buttonBg: "bg-slate-50 hover:bg-slate-100",
      selectBg: "bg-slate-50",
      tableBg: "bg-white",
    },
    dark: {
      title: "text-[#f8fafc]",
      subtitle: "text-slate-400",
      value: "text-[#f1f5f9]",
      border: "border-slate-800/80",
      background: "bg-slate-900/80 backdrop-blur-md",
      cardBg: "bg-slate-900/80 backdrop-blur-md",
      buttonBg: "bg-slate-800/90 hover:bg-slate-700/90",
      selectBg: "bg-slate-800/90",
      tableBg: "bg-slate-900/80",
    }
  };

  const colors = isDark ? cardColors.dark : cardColors.light;
  const hasActiveFilters = selectedCd !== "all" || selectedMonth !== "all" || selectedCat !== "all" || isInteractiveFiltered;

  return (
    <div className={`p-2 sm:p-4 space-y-4 ${isDark ? 'text-[#e2e8f0]' : 'text-[#00122e]'} font-sans w-full h-full flex-1 min-h-0 overflow-y-auto transition-colors duration-300`}>
      
      {/* HEADER & FILTERS BAR */}
      <div className={`${colors.background} p-4 sm:p-5 rounded-3xl border ${colors.border} shadow-xs transition-all duration-300`}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-2xl text-white shadow-md border border-indigo-500/20 shrink-0">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-lg sm:text-xl font-black tracking-tight ${colors.title}`}>
                  Painel Analítico de Capacidade
                </h2>
                <span className="text-[9px] font-extrabold tracking-widest px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20 font-mono">
                  EXECUTIVE LIVE
                </span>
              </div>
              <p className={`text-xs ${colors.subtitle} mt-0.5`}>
                Visão consolidada de Inbound, Outbound e Inserções Remuneradas
              </p>
            </div>
          </div>

          {/* FILTERS CONTROL TOOLBAR - MINIMALIST & ORGANIZED */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Filter Dropdowns Segmented Box */}
            <div className={`flex flex-wrap items-center gap-1.5 p-1 rounded-2xl ${isDark ? 'bg-slate-950/60' : 'bg-slate-100/80'} border ${colors.border}`}>
              
              {/* CD Filter */}
              <div className={`flex items-center gap-1.5 ${isDark ? 'bg-slate-900 hover:bg-slate-800/90' : 'bg-white hover:bg-slate-50'} border ${colors.border} px-2.5 py-1.5 rounded-xl transition-all shadow-xs`}>
                <Building className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <div className="flex flex-col">
                  <span className={`text-[8px] ${colors.subtitle} font-extrabold uppercase tracking-wider leading-none mb-0.5`}>Depósito</span>
                  <select
                    value={selectedCd}
                    onChange={(e) => {
                      setSelectedCd(e.target.value);
                      setSelectedCdCategory(null);
                    }}
                    className={`bg-transparent border-none text-xs font-bold ${colors.value} focus:outline-none cursor-pointer pr-1 py-0`}
                  >
                    <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Todos CDs</option>
                    {cdsList.map(cd => (
                      <option key={cd} value={cd} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">CD {cd}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Month Filter */}
              <div className={`flex items-center gap-1.5 ${isDark ? 'bg-slate-900 hover:bg-slate-800/90' : 'bg-white hover:bg-slate-50'} border ${colors.border} px-2.5 py-1.5 rounded-xl transition-all shadow-xs`}>
                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <div className="flex flex-col">
                  <span className={`text-[8px] ${colors.subtitle} font-extrabold uppercase tracking-wider leading-none mb-0.5`}>Mês</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      setFilterMonth(null);
                      setFilterWeek(null);
                      setFilterDay(null);
                    }}
                    className={`bg-transparent border-none text-xs font-bold ${colors.value} focus:outline-none cursor-pointer pr-1 py-0`}
                  >
                    <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Todos Meses</option>
                    {monthsList.map(m => (
                      <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">{MONTH_NAMES[m] || m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category Filter */}
              <div className={`flex items-center gap-1.5 ${isDark ? 'bg-slate-900 hover:bg-slate-800/90' : 'bg-white hover:bg-slate-50'} border ${colors.border} px-2.5 py-1.5 rounded-xl transition-all shadow-xs`}>
                <Package className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div className="flex flex-col">
                  <span className={`text-[8px] ${colors.subtitle} font-extrabold uppercase tracking-wider leading-none mb-0.5`}>Categoria</span>
                  <select
                    value={selectedCat}
                    onChange={(e) => {
                      setSelectedCat(e.target.value);
                      setSelectedCdCategory(null);
                    }}
                    className={`bg-transparent border-none text-xs font-bold ${colors.value} focus:outline-none cursor-pointer pr-1 py-0 max-w-[130px] truncate`}
                  >
                    <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">Todas Categorias</option>
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            {/* View Scope Segmented Toggle */}
            <div className={`flex items-center gap-0.5 ${isDark ? 'bg-slate-950/60' : 'bg-slate-100/80'} p-1 rounded-2xl border ${colors.border}`}>
              <button
                onClick={() => setVisibleCharts("both")}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                  visibleCharts === "both"
                    ? isDark 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "bg-slate-900 text-white shadow-sm"
                    : `${colors.subtitle} hover:text-slate-900 dark:hover:text-white`
                }`}
              >
                Geral
              </button>
              <button
                onClick={() => setVisibleCharts("inbound")}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                  visibleCharts === "inbound"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : `${colors.subtitle} hover:text-emerald-600`
                }`}
              >
                Inbound
              </button>
              <button
                onClick={() => setVisibleCharts("outbound")}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                  visibleCharts === "outbound"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : `${colors.subtitle} hover:text-indigo-600`
                }`}
              >
                Outbound
              </button>
            </div>

            {/* Clear Filters Quick Button (when active) */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-500/20 transition-all cursor-pointer shrink-0"
                title="Limpar todos os filtros"
              >
                <FilterX className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}

            {/* Sync Button */}
            <button
              onClick={() => fetchData(false)}
              className={`p-2.5 ${isDark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-slate-100'} border ${colors.border} rounded-2xl transition-all active:scale-95 cursor-pointer shadow-xs group`}
              title="Sincronizar Dados"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:rotate-180 transition-transform duration-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* CROSS-FILTERING ACTIVE BANNER */}
      <AnimatePresence>
        {isInteractiveFiltered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-mono">Filtros Cruzados Interativos</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {selectedCdCategory && (
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200/50">
                      CD {selectedCdCategory.cd} • {selectedCdCategory.category}
                    </span>
                  )}
                  {filterMonth && (
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200/50">
                      Mês: {MONTH_NAMES[filterMonth] || filterMonth}
                    </span>
                  )}
                  {filterWeek && (
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-full border border-sky-200/50">
                      Semana: {filterWeek}
                    </span>
                  )}
                  {filterDay && (
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 rounded-full border border-violet-200/50">
                      Dia: {filterDay.split("-").reverse().join("/")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-slate-800 active:scale-95 cursor-pointer transition-all shrink-0"
            >
              <FilterX className="w-3.5 h-3.5 text-emerald-400" />
              <span>Limpar Filtros</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* METRIC CARDS (KPIs) - 5 CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Inbound Padrão */}
        <motion.div
          whileHover={{ y: -3 }}
          className={`${colors.cardBg} p-5 rounded-3xl border ${colors.border} relative overflow-hidden transition-all duration-300 shadow-xs`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black ${colors.subtitle} uppercase tracking-wider font-mono`}>
              Inbound Padrão
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black ${colors.value} font-mono tracking-tight`}>
              {fmt(kpis.inboundActual)}
            </h3>
            <div className={`flex items-center justify-between mt-2 pt-2 border-t ${colors.border} text-[10px] ${colors.subtitle} font-mono`}>
              <span>Capacidade Meta:</span>
              <span className="font-bold">{fmt(kpis.inboundMeta)}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full" 
                style={{ width: `${Math.min(kpis.inboundMeta > 0 ? (kpis.inboundActual / kpis.inboundMeta) * 100 : 0, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* KPI 2: Recebimento Remunerado */}
        <motion.div
          whileHover={{ y: -3 }}
          className={`${colors.cardBg} p-5 rounded-3xl border border-sky-500/30 dark:border-sky-500/40 relative overflow-hidden transition-all duration-300 shadow-xs`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider font-mono`}>
                Extra Remunerada
              </span>
              <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-sky-500/20 text-sky-600 dark:text-sky-300 rounded-md">
                YIELD
              </span>
            </div>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200/50 dark:border-sky-800/40">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono tracking-tight">
              {fmt(kpis.remuneradoActual)}
            </h3>
            <div className={`flex items-center justify-between mt-2 pt-2 border-t ${colors.border} text-[10px] ${colors.subtitle} font-mono`}>
              <span>% do Inbound:</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">{kpis.extraRatio.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-sky-500 h-1.5 rounded-full" 
                style={{ width: `${Math.min(kpis.extraRatio, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* KPI 3: Outbound Fracionado */}
        <motion.div
          whileHover={{ y: -3 }}
          className={`${colors.cardBg} p-5 rounded-3xl border ${colors.border} relative overflow-hidden transition-all duration-300 shadow-xs`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black ${colors.subtitle} uppercase tracking-wider font-mono`}>
              Outbound Fracionado
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black ${colors.value} font-mono tracking-tight`}>
              {fmt(kpis.fracionadoActual)}
            </h3>
            <div className={`flex items-center justify-between mt-2 pt-2 border-t ${colors.border} text-[10px] ${colors.subtitle} font-mono`}>
              <span>Capacidade Meta:</span>
              <span className="font-bold">{fmt(kpis.fracionadoMeta)}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-indigo-500 h-1.5 rounded-full" 
                style={{ width: `${Math.min(kpis.fracionadoMeta > 0 ? (kpis.fracionadoActual / kpis.fracionadoMeta) * 100 : 0, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* KPI 4: Outbound Fechado */}
        <motion.div
          whileHover={{ y: -3 }}
          className={`${colors.cardBg} p-5 rounded-3xl border ${colors.border} relative overflow-hidden transition-all duration-300 shadow-xs`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black ${colors.subtitle} uppercase tracking-wider font-mono`}>
              Outbound Fechado
            </span>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 rounded-xl border border-sky-200/50 dark:border-sky-800/40">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black ${colors.value} font-mono tracking-tight`}>
              {fmt(kpis.fechadoActual)}
            </h3>
            <div className={`flex items-center justify-between mt-2 pt-2 border-t ${colors.border} text-[10px] ${colors.subtitle} font-mono`}>
              <span>Capacidade Meta:</span>
              <span className="font-bold">{fmt(kpis.fechadoMeta)}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-sky-400 h-1.5 rounded-full" 
                style={{ width: `${Math.min(kpis.fechadoMeta > 0 ? (kpis.fechadoActual / kpis.fechadoMeta) * 100 : 0, 100)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* KPI 5: Capacidade Consolidada Global */}
        <motion.div
          whileHover={{ y: -3 }}
          className={`${colors.cardBg} p-5 rounded-3xl border border-emerald-500/30 dark:border-emerald-500/40 relative overflow-hidden transition-all duration-300 shadow-xs`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono`}>
              Capacidade Consolidada
            </span>
            <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black ${colors.value} font-mono tracking-tight`}>
              {fmt(kpis.grandTotal)}
            </h3>
            <div className={`flex items-center justify-between mt-2 pt-2 border-t ${colors.border} text-[10px] ${colors.subtitle} font-mono`}>
              <span>Inbound + Outbound</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">Total</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-1.5 rounded-full w-full" />
            </div>
          </div>
        </motion.div>

      </div>

      {/* CORE CHARTS SECTION */}
      <div className={`grid gap-6 ${visibleCharts === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        
        {/* CHARTS 1 & 2: INBOUND & OUTBOUND */}
        {(visibleCharts === "both" || visibleCharts === "inbound") && (
          <div className={`${colors.cardBg} p-6 rounded-3xl border ${colors.border} flex flex-col min-h-[420px] transition-all duration-300 shadow-xs`}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-widest">
                  Fluxo de Entrada
                </span>
                <h3 className={`text-base font-black ${colors.value} flex items-center gap-2 mt-0.5`}>
                  <span>Inbound Padrão + Remunerado</span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {isInteractiveFiltered && (
                  <button
                    onClick={handleDrillUp}
                   className={`flex items-center gap-1 px-3 py-1 bg-slate-200 dark:bg-slate-800${colors.value} text-[10px] font-bold uppercase rounded-xl transition-all border ${colors.border}`}

                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Subir Nível</span>
                  </button>
                )}

                <div className={`flex items-center ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'} p-0.5 rounded-xl border ${colors.border}`}>
                  <button
                    onClick={() => { setViewMode("mensal"); setFilterMonth(null); setFilterWeek(null); setFilterDay(null); }}
                    className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${
                      viewMode === "mensal" 
                        ? isDark 
                          ? 'bg-white text-slate-900 shadow-xs' 
                          : 'bg-slate-900 text-white shadow-xs'
                        : colors.subtitle
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => { setViewMode("semanal"); setFilterDay(null); }}
                    className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${
                      viewMode === "semanal" 
                        ? isDark 
                          ? 'bg-white text-slate-900 shadow-xs' 
                          : 'bg-slate-900 text-white shadow-xs'
                        : colors.subtitle
                    }`}
                  >
                    Sem
                  </button>
                  <button
                    onClick={() => setViewMode("diario")}
                    className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${
                      viewMode === "diario" 
                        ? isDark 
                          ? 'bg-white text-slate-900 shadow-xs' 
                          : 'bg-slate-900 text-white shadow-xs'
                        : colors.subtitle
                    }`}
                  >
                    Dia
                  </button>
                </div>
              </div>
            </div>

            <div className={`text-[10px] ${colors.subtitle} font-mono font-bold mb-3 flex items-center gap-3`}>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" />
                Inbound Padrão
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-sky-500 rounded-full inline-block" />
                Remuneradas
              </span>
            </div>

            <div className="flex-1 w-full min-h-[280px]">
              {aggregatedPeriodData.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center ${colors.subtitle} font-mono text-xs`}>
                  Nenhum registro de Inbound encontrado para os filtros.
                </div>
              ) : (
                <Bar data={inboundChartData} options={inboundChartOptions} plugins={[customDatalabels]} />
              )}
            </div>
          </div>
        )}

        {(visibleCharts === "both" || visibleCharts === "outbound") && (
          <div className={`${colors.cardBg} p-6 rounded-3xl border ${colors.border} flex flex-col min-h-[420px] transition-all duration-300 shadow-xs`}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 font-mono uppercase tracking-widest">
                  Fluxo de Saída
                </span>
                <h3 className={`text-base font-black ${colors.value} flex items-center gap-2 mt-0.5`}>
                  <span>Outbound: Fracionado vs Fechado</span>
                </h3>
              </div>

              <div className="text-[10px] px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold uppercase tracking-wider font-mono">
                {viewMode}
              </div>
            </div>

            <div className={`text-[10px] ${colors.subtitle} font-mono font-bold mb-3 flex items-center gap-3`}>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full inline-block" />
                Fracionado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-sky-400 rounded-full inline-block" />
                Fechado
              </span>
            </div>

            <div className="flex-1 w-full min-h-[280px]">
              {aggregatedPeriodData.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center ${colors.subtitle} font-mono text-xs`}>
                  Nenhum registro de Outbound encontrado para os filtros.
                </div>
              ) : (
                <Bar data={outboundChartData} options={outboundChartOptions} plugins={[customDatalabels]} />
              )}
            </div>
          </div>
        )}

      </div>

      {/* NEW CHARTS ROW: CD COMPARISON & CATEGORY DONUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART 3: COMPARATIVO POR DEPÓSITO (CD) - 2 COLS */}
        <div className={`lg:col-span-2 ${colors.cardBg} p-6 rounded-3xl border ${colors.border} flex flex-col min-h-[380px] shadow-xs`}>
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 font-mono uppercase tracking-widest">
                Comparativo Operacional
              </span>
              <h3 className={`text-base font-black ${colors.value} mt-0.5`}>
                Capacidade por Depósito (Inbound vs Outbound)
              </h3>
            </div>

            {selectedCd !== "all" && (
              <button
                onClick={() => setSelectedCd("all")}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 text-[10px] font-bold rounded-xl border border-blue-200/50 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Ver Todos os CDs</span>
              </button>
            )}
          </div>

          <p className={`text-xs ${colors.subtitle} mb-4`}>
            Clique em qualquer barra para filtrar o dashboard pelo CD correspondente.
          </p>

          <div className="flex-1 w-full min-h-[260px]">
            {cdAggregateData.length === 0 ? (
              <div className={`h-full flex flex-col items-center justify-center ${colors.subtitle} font-mono text-xs`}>
                Nenhum dado por CD disponível para os filtros atuais.
              </div>
            ) : (
              <Bar data={cdChartDataConfig} options={cdChartOptionsConfig} plugins={[customDatalabels]} />
            )}
          </div>
        </div>

        {/* CHART 4: PARTICIPAÇÃO POR CATEGORIA (DONUT CHART) - 1 COL */}
        <div className={`${colors.cardBg} p-6 rounded-3xl border ${colors.border} flex flex-col min-h-[380px] shadow-xs`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-widest">
                Share de Categoria
              </span>
              <h3 className={`text-base font-black ${colors.value} mt-0.5`}>
                Distribuição %
              </h3>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
              <PieChartIcon className="w-4 h-4" />
            </div>
          </div>

          {/* DONUT CONTAINER WITH CENTER METRIC */}
          <div className="relative flex-1 w-full min-h-[200px] flex items-center justify-center my-2">
            <Doughnut data={donutChartConfig} options={donutChartOptionsConfig} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={`text-[9px] font-bold uppercase tracking-wider ${colors.subtitle}`}>Total Vol.</span>
              <span className={`text-base font-black font-mono ${colors.value}`}>
                {fmt(categoryDonutData.grandTotal)}
              </span>
            </div>
          </div>

          {/* CATEGORY LEGEND BADGES */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {categoryDonutData.labels.map((cat, idx) => (
              <button
                key={cat}
                onClick={() => {
                  if (selectedCat === cat) {
                    setSelectedCat("all");
                    showNotification("Filtro de categoria desfeito");
                  } else {
                    setSelectedCat(cat);
                    showNotification(`📍 Filtrado por ${cat}`);
                  }
                }}
                className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  selectedCat === cat
                    ? isDark
                      ? "bg-white text-slate-900 border-transparent shadow-xs"
                      : "bg-slate-900 text-white border-transparent shadow-xs"
                    : `${isDark ? 'bg-slate-800/60' : 'bg-slate-50'} ${colors.border} ${colors.subtitle} hover:border-slate-400`
                }`}
              >
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: categoryDonutData.colors[idx].border }} 
                />
                <span>{cat}</span>
                <span className="font-mono text-[9px] opacity-75">({categoryDonutData.percentages[idx]}%)</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* CHART 5: EVOLUÇÃO TEMPORAL (TREND LINE CHART) */}
      <div className={`${colors.cardBg} p-6 rounded-3xl border ${colors.border} transition-all duration-300 shadow-xs`}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 font-mono uppercase tracking-widest">
              Trajetória Logística
            </span>
            <h3 className={`text-base font-black ${colors.value} mt-0.5`}>
              Evolução Temporal: Inbound vs Outbound
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono font-bold">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              Inbound Consolidado
            </span>
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
              <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
              Outbound Consolidado
            </span>
          </div>
        </div>

        <div className="w-full min-h-[260px] h-[300px]">
          {aggregatedPeriodData.length === 0 ? (
            <div className={`h-full flex flex-col items-center justify-center ${colors.subtitle} font-mono text-xs`}>
              Sem dados temporais disponíveis.
            </div>
          ) : (
            <Line data={trendChartData} options={chartOptionsBase} />
          )}
        </div>
      </div>

      {/* OPERATIONAL SUMMARY DATA GRID */}
      <div className={`${colors.cardBg} p-6 rounded-3xl border ${colors.border} shadow-xs`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h3 className={`text-base font-black ${colors.value}`}>
              Resumo Operacional ({filteredCapacidades.length} registros)
            </h3>
            <p className={`text-xs ${colors.subtitle} mt-0.5`}>
              Tabela analítica detalhada com amarrações de capacidade
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800">
                <th className={`py-3 px-4 text-[10px] font-black ${colors.value} uppercase tracking-wider font-mono`}>Data Movimentação</th>
                <th className={`py-3 px-4 text-[10px] font-black ${colors.value} uppercase tracking-wider font-mono text-center`}>Depósito</th>
                <th className={`py-3 px-4 text-[10px] font-black ${colors.value} uppercase tracking-wider font-mono`}>Categoria</th>
                <th className={`py-3 px-4 text-[10px] font-black ${colors.value} uppercase tracking-wider font-mono text-right`}>Inbound Padrão</th>
                <th className={`py-3 px-4 text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider font-mono text-right`}>Remunerado</th>
                <th className={`py-3 px-4 text-[10px] font-black ${colors.value} uppercase tracking-wider font-mono text-right`}>Outbound Fracionado</th>
                <th className={`py-3 px-4 text-[10px] font-black ${colors.value} uppercase tracking-wider font-mono text-right`}>Outbound Fechado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCapacidades.slice(0, 15).map((row) => {
                const remVal = row.recebimentoRemunerado || row.capacidadeRemunerada;
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-xs"
                  >
                    <td className={`py-3 px-4 font-mono font-bold ${colors.value}`}>
                      {row.dataMovimentacao.split("-").reverse().join("/")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-10 dark:bg-slate-0 rounded-md border border-slate-200 dark:border-slate-700">
                        CD {row.cd}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-semibold ${colors.subtitle}`}>
                      {row.categoria}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {row.capacidadeInbound ? fmt(row.capacidadeInbound) : "--"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sky-600 dark:text-sky-400 font-bold bg-sky-500/5">
                      {remVal ? fmt(remVal) : "--"}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${colors.value} font-bold`}>
                      {row.capacidadeOutboundFracionado ? fmt(row.capacidadeOutboundFracionado) : "--"}
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${colors.value} font-bold`}>
                      {row.capacidadeOutboundFechado ? fmt(row.capacidadeOutboundFechado) : "--"}
                    </td>
                  </tr>
                );
              })}
              {filteredCapacidades.length > 15 && (
                <tr>
                  <td colSpan={7} className={`py-3 px-4 text-center ${colors.subtitle} text-[11px] font-mono italic`}>
                    Exibindo as primeiras 15 linhas de um total de {filteredCapacidades.length} registros.
                  </td>
                </tr>
              )}
              {filteredCapacidades.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-8 px-4 text-center ${colors.subtitle} text-xs font-mono`}>
                    Nenhum registro operacional encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}