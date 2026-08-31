import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Doughnut, Bar, Line, Chart } from "react-chartjs-2";
import {
  Package,
  Layers,
  TrendingUp,
  Building,
  RefreshCw,
  Search,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  Maximize2,
  Minimize2,
  X
} from "lucide-react";
import { User, PainelEstoqueSubCategoria } from "../types";
import { CDS_LIST, SUBCATEGORY_COLORS, generateMockPainelEstoque } from "../mockData";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  ChartTitle,
  ChartTooltip,
  ChartLegend,
  Filler,
  ChartDataLabels
);

interface DashboardOcupacaoProps {
  theme: "light" | "dark";
  showNotification: (msg: string) => void;
  user?: User | null;
  onPageChange?: (page: string) => void;
  onThemeToggle?: () => void;
  onLogout?: () => void;
}

// Model for category data
interface CategoryStat {
  id: string;
  name: string;
  pallets: number;
  capacidade: number;
  ocupacaoPct: number;
  color: string;
  gradient: [string, string];
  variacao: number;
  giro: "Alto" | "Médio" | "Estável";
}

// Model for item/PLU data
interface PluItem {
  plu: string;
  descricao: string;
  categoria: string;
  cd: number;
  pallets: number;
  capacidadeMax: number;
}

// Default Fallback Subcategories dataset from simulated mock generator
const DEFAULT_PAINEL_ESTOQUE: PainelEstoqueSubCategoria[] = generateMockPainelEstoque(101);

// Helper to calculate consecutive date strings (YYYY-MM-DD)
function getNextDateStr(dateStr: string, daysToAdd: number = 1): string {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(Date.UTC(year, month, day + daysToAdd));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  } catch (e) {
    console.error("Erro ao calcular próxima data:", e);
  }
  return dateStr;
}

/**
 * Converte com máxima precisão qualquer formato de percentual da API:
 * - "1.00814922129663" ou " 1.00814922129663" -> 100.8%
 * - "0.952667364016736" -> 95.3%
 * - 1.00814922129663 -> 100.8%
 * - 0.952667364016736 -> 95.3%
 * - 0.646 -> 64.6%
 * - 64.6 -> 64.6%
 * - Fallback se nulo: (qtdOcupada / qtdPosicoes) * 100
 */
export function parseOccupancyPct(
  rawVal: any,
  qtdOcupada?: number,
  qtdPosicoes?: number
): number {
  if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
    const cleanStr = String(rawVal).trim().replace(/['"%\s]/g, "").replace(",", ".");
    const num = parseFloat(cleanStr);
    if (!isNaN(num)) {
      // Se num estiver em formato decimal unitário (0.0 até ~3.0, onde 1.0 = 100%, 0.9526... = 95.3%, 1.008149... = 100.8%)
      // Ratios até 3.0 (até 300% de capacidade) são convertidos multiplicando por 100.
      // Se for maior que 3.0 (ex: 75.5, 95.3, 100.8), já está na escala 0-100.
      const pct = num <= 3.0 ? num * 100 : num;
      return Math.round(pct * 10) / 10;
    }
  }
  if (qtdPosicoes && qtdPosicoes > 0 && qtdOcupada !== undefined && qtdOcupada !== null) {
    return Math.round(((qtdOcupada / qtdPosicoes) * 100) * 10) / 10;
  }
  return 0;
}

// Global memory cache to persist painel estoque data across tab switches (Stale-While-Revalidate pattern)
let cachedPainelEstoqueDatasets: Record<number, PainelEstoqueSubCategoria[]> | null = null;
let hasLoadedOcupacaoOncePerLogin: boolean = false;

export function resetDashboardOcupacaoCache() {
  cachedPainelEstoqueDatasets = null;
  hasLoadedOcupacaoOncePerLogin = false;
  try {
    sessionStorage.removeItem("logistics_ocupacao_loaded_session");
  } catch {}
}

export default function DashboardOcupacao({
  theme,
  showNotification,
  user,
  onPageChange,
  onThemeToggle,
  onLogout
}: DashboardOcupacaoProps) {
  const isDark = theme === "dark";

  // State
  const [selectedCd, setSelectedCd] = useState<number>(101);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [projectionMode, setProjectionMode] = useState<"real" | "projecao">("projecao");
  const [daysRange, setDaysRange] = useState<7 | 14>(14);
  const [categoryChartMode, setCategoryChartMode] = useState<"volume" | "percent">("volume");
  const [isChartMaximized, setIsChartMaximized] = useState<boolean>(false);
  const [searchPlu, setSearchPlu] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Loading state: active only once per login session if cache is not ready
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const sessionLoaded = sessionStorage.getItem("logistics_ocupacao_loaded_session");
      if (sessionLoaded === "true" || hasLoadedOcupacaoOncePerLogin) {
        return false;
      }
      return !cachedPainelEstoqueDatasets;
    } catch {
      return !cachedPainelEstoqueDatasets && !hasLoadedOcupacaoOncePerLogin;
    }
  });

  const [painelData, setPainelData] = useState<PainelEstoqueSubCategoria[]>(() => {
    if (cachedPainelEstoqueDatasets && cachedPainelEstoqueDatasets[101]) {
      return cachedPainelEstoqueDatasets[101];
    }
    return DEFAULT_PAINEL_ESTOQUE;
  });
  const [latestDateStr, setLatestDateStr] = useState<string>("2026-08-24");

  // Fetch from API: /api/painel-estoque?cd=${selectedCd} with fast caching (Stale-While-Revalidate)
  const fetchPainelEstoque = async (cd: number, silent = false) => {
    const hasData = cachedPainelEstoqueDatasets && cachedPainelEstoqueDatasets[cd];

    if (!silent && !hasData && !hasLoadedOcupacaoOncePerLogin) {
      setIsLoading(true);
    }

    if (hasData) {
      setPainelData(cachedPainelEstoqueDatasets![cd]);
      let maxDate = "2026-08-24";
      cachedPainelEstoqueDatasets![cd].forEach((item: PainelEstoqueSubCategoria) => {
        if (item.historico && item.historico.length > 0) {
          const lastH = item.historico[item.historico.length - 1].data;
          if (lastH > maxDate) maxDate = lastH;
        }
      });
      setLatestDateStr(maxDate);
    }

    try {
      const res = await fetch(`/api/painel-estoque?cd=${cd}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (!cachedPainelEstoqueDatasets) {
            cachedPainelEstoqueDatasets = {};
          }
          cachedPainelEstoqueDatasets[cd] = data;
          setPainelData(data);
          let maxDate = "2026-08-24";
          data.forEach((item: PainelEstoqueSubCategoria) => {
            if (item.historico && item.historico.length > 0) {
              const lastH = item.historico[item.historico.length - 1].data;
              if (lastH > maxDate) maxDate = lastH;
            }
          });
          setLatestDateStr(maxDate);
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar dados do painel de estoque, utilizando cache local:", e);
    } finally {
      hasLoadedOcupacaoOncePerLogin = true;
      try {
        sessionStorage.setItem("logistics_ocupacao_loaded_session", "true");
      } catch {}
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const silentFetch = !!(cachedPainelEstoqueDatasets && cachedPainelEstoqueDatasets[selectedCd]) || hasLoadedOcupacaoOncePerLogin;
    fetchPainelEstoque(selectedCd, silentFetch);
  }, [selectedCd]);

  // Extract all unique dates from historico
  const allHistoricalDates = useMemo(() => {
    const datesSet = new Set<string>();
    painelData.forEach(sub => {
      sub.historico?.forEach(h => {
        if (h.data) datesSet.add(h.data);
      });
    });
    return Array.from(datesSet).sort();
  }, [painelData]);

  // Gerar os 14 dias reais retroativos a partir da data mais recente
  const realDates = useMemo(() => {
    if (allHistoricalDates && allHistoricalDates.length >= 14) {
      return allHistoricalDates.slice(-14);
    }
    if (allHistoricalDates && allHistoricalDates.length > 0) {
      return allHistoricalDates;
    }
    if (!latestDateStr) return ["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24"];
    
    const dates = [];
    const parts = latestDateStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    // Criar 14 dias consecutivos para trás
    for (let i = 13; i >= 0; i--) {
      const date = new Date(Date.UTC(year, month, day - i));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    
    return dates;
  }, [allHistoricalDates, latestDateStr]);

  // Extract all unique projection dates
  const allProjectedDates = useMemo(() => {
    const datesSet = new Set<string>();
    painelData.forEach(sub => {
      sub.projecao?.forEach(p => {
        if (p.data) datesSet.add(p.data);
      });
    });
    return Array.from(datesSet).sort();
  }, [painelData]);

  // Always guarantees exactly 14 projection days
  const projDates = useMemo(() => {
    const dates = [...allProjectedDates];
    const baseDate = latestDateStr || "2026-08-24";

    if (dates.length === 0) {
      let cur = baseDate;
      for (let i = 1; i <= 14; i++) {
        cur = getNextDateStr(cur, 1);
        dates.push(cur);
      }
    } else {
      while (dates.length < 14) {
        const lastDate = dates[dates.length - 1];
        dates.push(getNextDateStr(lastDate, 1));
      }
    }
    return dates.slice(0, 14);
  }, [allProjectedDates, latestDateStr]);

  // Categories computed for the MOST CURRENT DAY
  const categories: CategoryStat[] = useMemo(() => {
    return painelData.map((sub, idx) => {
      const histItem = sub.historico?.find(h => h.data === latestDateStr) || 
                       sub.historico?.[sub.historico.length - 1] || {
                         data: latestDateStr,
                         origem: "REAL",
                         qtdPosicoes: 1000,
                         qtdOcupada: 500,
                         percentualOcupacao: 0.5
                       };

      const pal = histItem.qtdOcupada;
      const cap = histItem.qtdPosicoes;
      
      // Obter percentual diretamente da API (ex: 0.575 -> 57.5% ou 57.5)
      const pct = histItem.percentualOcupacao !== undefined && histItem.percentualOcupacao !== null
        ? (histItem.percentualOcupacao <= 1
            ? Math.round(histItem.percentualOcupacao * 1000) / 10
            : Math.round(histItem.percentualOcupacao * 10) / 10)
        : (cap > 0 ? Math.round((pal / cap) * 1000) / 10 : 0);
      
      const themeColors = SUBCATEGORY_COLORS[sub.subCategoria] || {
        color: ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#3b82f6"][idx % 6],
        gradient: [["#8b5cf6", "#6d28d9"], ["#06b6d4", "#0284c7"], ["#10b981", "#059669"]][idx % 3] as [string, string]
      };

      return {
        id: sub.subCategoria.toLowerCase().replace(/\s+/g, "_"),
        name: sub.subCategoria,
        pallets: pal,
        capacidade: cap,
        ocupacaoPct: pct,
        color: themeColors.color,
        gradient: themeColors.gradient,
        variacao: (histItem.percentualOcupacao || (cap > 0 ? pal / cap : 0)) > 0.7 ? 4.2 : -1.8,
        giro: (histItem.percentualOcupacao || (cap > 0 ? pal / cap : 0)) > 0.75 ? "Alto" : (histItem.percentualOcupacao || (cap > 0 ? pal / cap : 0)) > 0.4 ? "Médio" : "Estável"
      };
    });
  }, [painelData, latestDateStr]);

  // Realistic Product SKU Database per Category for the PLU table
  const SUBCATEGORY_PRODUCTS_MAP: Record<string, string[]> = {
    "Alimentos Secos": [
      "Arroz Agulhinha Tipo 1 5kg",
      "Feijão Carioca Extra 1kg",
      "Óleo de Soja Refinado 900ml cx c/20",
      "Açúcar Cristal Especial 1kg fardo c/10",
      "Macarrão Espaguete Grano Duro 500g",
      "Farinha de Trigo Premium 1kg"
    ],
    "Higiene & Limpeza": [
      "Detergente Líquido Neutro 500ml cx c/24",
      "Sabão em Pó Concentrado 1.6kg cx c/10",
      "Amaciante Toque de Frescor 2L cx c/6",
      "Desinfetante Floral Lavanda 2L",
      "Papel Higiênico Folha Dupla 30m c/12",
      "Água Sanitária Concentrada 2L"
    ],
    "Eletro": [
      "Smart TV 50 Pol 4K UHD HDR",
      "Geladeira Frost Free 410L Inox",
      "Fritadeira Elétrica Sem Óleo Air Fryer 4L",
      "Micro-ondas 32L Espelhado Inox",
      "Lavadora de Roupas 12kg Automática"
    ],
    "Bebidas": [
      "Refrigerante Cola 2L Pet fardo c/6",
      "Cerveja Puro Malte Lata 350ml c/12",
      "Água Mineral Sem Gás 500ml fardo c/12",
      "Suco de Uva Integral 1.5L Vidro c/6",
      "Energético Tropical 473ml cx c/12"
    ],
    "Bazar & Utilidades": [
      "Conjunto de Panelas Antiaderente 5 Pçs",
      "Mop Giratório Limpeza Prática c/ Balde",
      "Kit Potes Herméticos Vidro 4 Unidades",
      "Varal de Chão Dobrável Alumínio"
    ],
    "Perfumaria & Cosméticos": [
      "Shampoo & Condicionador Nutritivo 400ml",
      "Desodorante Antitranspirante Roll-On 50ml",
      "Creme Hidratante Corporal 400ml",
      "Sabonete em Barra Cremoso 90g c/8"
    ],
    "Matinais & Cereais": [
      "Café Torrado e Moído Tradicional 500g",
      "Achocolatado em Pó 400g lata",
      "Cereal Matinal de Milho Crocante 300g",
      "Aveia em Flocos Finos 250g"
    ],
    "Snacks & Confeitaria": [
      "Biscoito Recheado Chocolate 130g cx c/30",
      "Batata Palha Tradicional 120g",
      "Chocolate ao Leite Barra 90g cx c/24",
      "Castanha de Caju Torrada e Salgada 150g"
    ],
    "Pet Care": [
      "Ração Seca Cães Adultos Carne 15kg",
      "Ração Úmida Sachê Gatos Salmão 85g c/12",
      "Areia Sanitária Gatos Grânulos 4kg",
      "Petisco Bifinho Cães Carne 500g"
    ],
    "Refrigerados": [
      "Leite UHT Integral 1L cx c/12",
      "Iogurte Grego Tradicional 400g c/6",
      "Manteiga de Primeira Qualidade c/ Sal 200g",
      "Queijo Mussarela Fatiado Interfolhado 500g",
      "Requeijão Cremoso Tradicional 200g"
    ],
    "Congelados": [
      "Hambúrguer Bovino Tradicional 672g",
      "Batata Pré-Frita Congelada 2kg",
      "Pizza Congelada Calabresa 460g",
      "Filé de Peito de Frango Congelado IQF 1kg",
      "Lasanha Congelada à Bolonhesa 600g"
    ],
    "Hortifrúti Fresco": [
      "Tomate Longa Vida Selecionado cx 20kg",
      "Cebola Nacional Granel sc 20kg",
      "Batata Inglesa Especial sc 25kg",
      "Banana Prata Climatizada cx 18kg",
      "Maçã Fuji Nacional Cat-1 cx 18kg"
    ],
    "Laticínios & Derivados": [
      "Queijo Prato Lanche Fatiado 500g",
      "Leite Fermentado Frasco 80g c/6",
      "Creme de Leite Leve TP 200g cx c/27",
      "Leite Condensado Semidesnatado TP 395g"
    ],
    "Aves & Carnes Nobres": [
      "Picanha Bovina Resfriada Vácuo kg",
      "Costela Bovina Premium kg",
      "Filé de Frango Sassami Congelado 1kg",
      "Linguiça Toscana Especial Churrasco kg"
    ],
    "Padaria & Confeitaria": [
      "Pão de Forma Tradicional 500g",
      "Pão Francês Congelado cx 10kg",
      "Bolo Confeitado Chocolate 400g",
      "Torrada Tradicional Crocante 140g"
    ],
    "Padaria & Doces": [
      "Pão de Queijo Mineiro Congelado 1kg",
      "Doce de Leite Pastoso Pote 400g",
      "Goiabada Cascão Tradicional 300g",
      "Panetone Tradicional Frutas 400g"
    ],
    "Embutidos & Fatiados": [
      "Presunto Cozido sem Capa Fatiado 500g",
      "Salame Tipo Italiano Fatiado 100g",
      "Peito de Peru Defumado Fatiado 200g",
      "Mortadela Defumada Especial kg"
    ],
    "Frutos do Mar": [
      "Camarão Cinza Limpo Congelado 400g",
      "Filé de Salmão Chileno Porcionado 500g",
      "Filé de Tilápia Congelado IQF 800g",
      "Posta de Cação Congelada 1kg"
    ],
    "Adega & Destilados": [
      "Vinho Tinto Fino Cabernet Sauvignon 750ml",
      "Whisky Escocês 12 Anos 750ml",
      "Gin London Dry Premium 750ml",
      "Espumante Brut Tradicional 750ml"
    ],
    "Eletroeletrônicos": [
      "Smartphone 5G 128GB Tela 6.5 Pol",
      "Notebook 15.6 Pol Core i5 8GB 256GB SSD",
      "Tablet 10.1 Pol Octa-Core 64GB Wi-Fi",
      "Monitor Gamer 24 Pol Full HD 144Hz"
    ],
    "Informática": [
      "Teclado Mecânico RGB Sem Fio",
      "Mouse Gamer Óptico 7200 DPI",
      "Headset Gamer Som Surround 7.1",
      "Roteador Wi-Fi 6 Gigabit Dual Band"
    ],
    "Suprimentos Gerais": [
      "Filme Stretch Manual 500mm x 0,025mm",
      "Pallet de Madeira PBR 1000x1200mm",
      "Fita Adesiva Transparente 48mm x 100m",
      "Etiquetas Térmicas Adesivas 100x150mm"
    ]
  };

  // Dynamic PLU List constructed from real subcategories with rich SKU distribution
  const pluList: PluItem[] = useMemo(() => {
    const list: PluItem[] = [];
    categories.forEach((cat, catIdx) => {
      const products = SUBCATEGORY_PRODUCTS_MAP[cat.name] || [
        `${cat.name} Item Standard A`,
        `${cat.name} Item Standard B`,
        `${cat.name} Item Especial C`,
        `${cat.name} Item Volume D`
      ];

      const numProducts = products.length;
      const basePalletsPerItem = Math.floor(cat.pallets / numProducts);
      const baseCapPerItem = Math.floor(cat.capacidade / numProducts);

      products.forEach((prodName, pIdx) => {
        // Unique PLU code calculation
        const codeNum = 18000 + (catIdx * 120) + (pIdx * 17) + (selectedCd * 3);
        const weightFactor = 0.8 + ((pIdx * 11) % 5) * 0.1;
        const itemPallets = Math.round(basePalletsPerItem * weightFactor);
        const itemCap = Math.round(baseCapPerItem * weightFactor);

        list.push({
          plu: `PLU-${codeNum}`,
          descricao: prodName,
          categoria: cat.name,
          cd: selectedCd,
          pallets: itemPallets,
          capacidadeMax: itemCap
        });
      });
    });
    return list;
  }, [categories, selectedCd]);

  // Filtered PLUs based on Selected Category & Search Query
  const filteredPlus = useMemo(() => {
    return pluList.filter(item => {
      if (selectedCategory !== "all" && item.categoria.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (searchPlu.trim()) {
        const query = searchPlu.toLowerCase();
        return item.plu.toLowerCase().includes(query) || item.descricao.toLowerCase().includes(query) || item.categoria.toLowerCase().includes(query);
      }
      return true;
    });
  }, [pluList, selectedCategory, searchPlu]);

  // Aggregated Stats for Cards on the Most Current Day
  const currentStats = useMemo(() => {
    let totalCap = 0;
    let totalOcup = 0;
    let explicitPct: number | null = null;

    if (selectedCategory === "all") {
      categories.forEach(c => {
        totalCap += c.capacidade;
        totalOcup += c.pallets;
      });
    } else {
      const cat = categories.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase());
      if (cat) {
        totalCap = cat.capacidade;
        totalOcup = cat.pallets;
        explicitPct = cat.ocupacaoPct;
      }
    }

    const totalLivre = Math.max(0, totalCap - totalOcup);
    const taxaOcupacao = explicitPct !== null 
      ? explicitPct 
      : (totalCap > 0 ? Math.round((totalOcup / totalCap) * 1000) / 10 : 0);
    const taxaLivre = Math.max(0, Math.round((100 - taxaOcupacao) * 10) / 10);

    return {
      totalCapacidade: totalCap,
      totalOcupado: totalOcup,
      totalLivre,
      taxaOcupacao,
      taxaLivre
    };
  }, [categories, selectedCategory]);

  // Previous day (Yesterday) date from allHistoricalDates
  const yesterdayDateStr = useMemo(() => {
    if (realDates.length >= 2) {
      return realDates[realDates.length - 2];
    }
    if (allHistoricalDates.length >= 2) {
      return allHistoricalDates[allHistoricalDates.length - 2];
    }
    return null;
  }, [realDates, allHistoricalDates]);

  // Aggregated Stats for Yesterday to calculate Day-over-Day variance
  const yesterdayStats = useMemo(() => {
    let yesterdayCap = 0;
    let yesterdayOcup = 0;
    let yesterdayPct: number | null = null;

    const activeSub = selectedCategory === "all"
      ? painelData
      : painelData.filter(s => s.subCategoria.toLowerCase() === selectedCategory.toLowerCase());

    activeSub.forEach(sub => {
      const histItem = yesterdayDateStr 
        ? sub.historico?.find(h => h.data === yesterdayDateStr) 
        : (sub.historico && sub.historico.length >= 2 ? sub.historico[sub.historico.length - 2] : null);
      
      if (histItem) {
        yesterdayCap += histItem.qtdPosicoes;
        yesterdayOcup += histItem.qtdOcupada;
        if (selectedCategory !== "all" && histItem.percentualOcupacao !== undefined && histItem.percentualOcupacao !== null) {
          yesterdayPct = histItem.percentualOcupacao <= 1 
            ? Math.round(histItem.percentualOcupacao * 1000) / 10 
            : Math.round(histItem.percentualOcupacao * 10) / 10;
        }
      }
    });

    const yesterdayLivre = Math.max(0, yesterdayCap - yesterdayOcup);
    const taxaOcupacao = yesterdayPct !== null 
      ? yesterdayPct 
      : (yesterdayCap > 0 ? Math.round((yesterdayOcup / yesterdayCap) * 1000) / 10 : 0);
    const taxaLivre = Math.max(0, Math.round((100 - taxaOcupacao) * 10) / 10);

    return {
      yesterdayCap,
      yesterdayOcup,
      yesterdayLivre,
      taxaOcupacao,
      taxaLivre
    };
  }, [painelData, selectedCategory, yesterdayDateStr]);

  // Differences vs Yesterday for all KPI cards
  const diffMetrics = useMemo(() => {
    const yCap = yesterdayStats.yesterdayCap || currentStats.totalCapacidade;
    const yOcup = yesterdayStats.yesterdayOcup || currentStats.totalOcupado;
    const yLivre = yesterdayStats.yesterdayLivre || currentStats.totalLivre;

    const capDiff = currentStats.totalCapacidade - yCap;
    const capDiffPct = yCap > 0 ? ((currentStats.totalCapacidade - yCap) / yCap) * 100 : 0;

    const ocupDiff = currentStats.totalOcupado - yOcup;
    const ocupDiffPct = yOcup > 0 ? ((currentStats.totalOcupado - yOcup) / yOcup) * 100 : 0;

    const livreDiff = currentStats.totalLivre - yLivre;
    const livreDiffPct = yLivre > 0 ? ((currentStats.totalLivre - yLivre) / yLivre) * 100 : 0;

    return {
      capDiff,
      capDiffPct: Math.round(capDiffPct * 10) / 10,
      ocupDiff,
      ocupDiffPct: Math.round(ocupDiffPct * 10) / 10,
      livreDiff,
      livreDiffPct: Math.round(livreDiffPct * 10) / 10,
      yesterdayDateStr
    };
  }, [currentStats, yesterdayStats, yesterdayDateStr]);

  // Real Historical Day-by-Day Series for the 7 Retroactive Days
  const realHistoryMetrics = useMemo(() => {
    const activeSub = selectedCategory === "all"
      ? painelData
      : painelData.filter(s => s.subCategoria.toLowerCase() === selectedCategory.toLowerCase());

    const capPoints: number[] = [];
    const ocupPoints: number[] = [];
    const livrePoints: number[] = [];

    realDates.forEach(date => {
      let capSum = 0;
      let ocupSum = 0;
      activeSub.forEach(s => {
        const found = s.historico?.find(h => h.data === date);
        if (found) {
          capSum += found.qtdPosicoes;
          ocupSum += found.qtdOcupada;
        } else {
          // Caso não haja registro no dia específico, usar o registro histórico mais recente até a data
          const previous = s.historico?.filter(h => h.data <= date);
          if (previous && previous.length > 0) {
            const lastPrev = previous[previous.length - 1];
            capSum += lastPrev.qtdPosicoes;
            ocupSum += lastPrev.qtdOcupada;
          } else if (s.historico && s.historico.length > 0) {
            capSum += s.historico[0].qtdPosicoes;
            ocupSum += s.historico[0].qtdOcupada;
          }
        }
      });
      capPoints.push(capSum);
      ocupPoints.push(ocupSum);
      livrePoints.push(Math.max(0, capSum - ocupSum));
    });

    // Assegurar que o último ponto coincida exatamente com o dia atual do card
    if (capPoints.length > 0 && currentStats.totalCapacidade > 0) {
      capPoints[capPoints.length - 1] = currentStats.totalCapacidade;
      ocupPoints[ocupPoints.length - 1] = currentStats.totalOcupado;
      livrePoints[livrePoints.length - 1] = currentStats.totalLivre;
    }

    return {
      capPoints: capPoints.length > 0 ? capPoints : [currentStats.totalCapacidade],
      ocupPoints: ocupPoints.length > 0 ? ocupPoints : [currentStats.totalOcupado],
      livrePoints: livrePoints.length > 0 ? livrePoints : [currentStats.totalLivre]
    };
  }, [painelData, selectedCategory, realDates, currentStats]);

  // Toggle or select category
  const handleCategoryClick = (catName: string) => {
    if (selectedCategory.toLowerCase() === catName.toLowerCase()) {
      setSelectedCategory("all");
      showNotification(`🔄 Filtro removido. Exibindo todas as categorias.`);
    } else {
      setSelectedCategory(catName);
      showNotification(`🎯 Painel filtrado por categoria: ${catName}`);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPainelEstoque(selectedCd);
    setTimeout(() => {
      setIsRefreshing(false);
      showNotification("⚡ Painel de Ocupação sincronizado em tempo real!");
    }, 300);
  };

  // Sparkline Chart Data Generator with real historical data points & real curvature
  const createSparklineData = (points: number[], color: string, gradientStart: string) => ({
    labels: points.map((_, i) => `D${i + 1}`),
    datasets: [
      {
        data: points,
        borderColor: color,
        borderWidth: 2,
        pointRadius: (ctx: any) => {
          return ctx.dataIndex === points.length - 1 ? 3 : 0;
        },
        pointBackgroundColor: color,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointHoverRadius: 4,
        tension: 0.45,
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart?.ctx;
          if (!ctx) return gradientStart;
          const gradient = ctx.createLinearGradient(0, 0, 0, 36);
          gradient.addColorStop(0, gradientStart);
          gradient.addColorStop(1, "transparent");
          return gradient;
        }
      }
    ]
  });

  const getSparklineOptions = (points: number[]) => {
    const validPts = points && points.length > 0 ? points : [0];
    const minVal = Math.min(...validPts);
    const maxVal = Math.max(...validPts);
    const range = maxVal - minVal;
    // Enhanced visual scale padding to give dynamic emphasis to the real curve
    const padding = range === 0 ? Math.max(1, maxVal * 0.05) : range * 0.25;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: { top: 3, bottom: 3, left: 1, right: 2 }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false }
      },
      scales: {
        x: { display: false },
        y: {
          display: false,
          min: Math.max(0, minVal - padding),
          max: maxVal + padding
        }
      }
    };
  };

  const sparklineCapacidade = useMemo(() => {
    return createSparklineData(
      realHistoryMetrics.capPoints,
      "#f97316",
      isDark ? "rgba(249, 115, 22, 0.25)" : "rgba(249, 115, 22, 0.15)"
    );
  }, [realHistoryMetrics.capPoints, isDark]);

  const sparklineOcupado = useMemo(() => {
    return createSparklineData(
      realHistoryMetrics.ocupPoints,
      "#8b5cf6",
      isDark ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.15)"
    );
  }, [realHistoryMetrics.ocupPoints, isDark]);

  const sparklineLivre = useMemo(() => {
    return createSparklineData(
      realHistoryMetrics.livrePoints,
      "#06b6d4",
      isDark ? "rgba(6, 182, 212, 0.3)" : "rgba(6, 182, 212, 0.15)"
    );
  }, [realHistoryMetrics.livrePoints, isDark]);

  const sparklineCapOptions = useMemo(() => getSparklineOptions(realHistoryMetrics.capPoints), [realHistoryMetrics.capPoints]);
  const sparklineOcupOptions = useMemo(() => getSparklineOptions(realHistoryMetrics.ocupPoints), [realHistoryMetrics.ocupPoints]);
  const sparklineLivreOptions = useMemo(() => getSparklineOptions(realHistoryMetrics.livrePoints), [realHistoryMetrics.livrePoints]);

  // =========================================================================
  // 📈 PROJECTION CHART: REAL (7 DIAS) OU PROJETADO (14 DIAS)
  // Capacidade Total em Barra + Ocupação em Linha + Alerta Crítico
  // =========================================================================
  const projectionChartData = useMemo(() => {
    const activeSubcategories = selectedCategory === "all"
      ? painelData
      : painelData.filter(s => s.subCategoria.toLowerCase() === selectedCategory.toLowerCase());

    const isReal = projectionMode === "real";
    const targetDates = isReal ? realDates : projDates;

    // Calculate occupied values for the selected days
    const occupiedValues = targetDates.map(d => {
      let sum = 0;
      activeSubcategories.forEach(sub => {
        if (isReal) {
          const foundH = sub.historico?.find(h => h.data === d);
          if (foundH) {
            sum += foundH.qtdOcupada;
          } else {
            const lastH = sub.historico?.[sub.historico.length - 1];
            if (lastH) sum += lastH.qtdOcupada;
          }
        } else {
          const foundP = sub.projecao?.find(p => p.data === d);
          if (foundP) {
            sum += foundP.qtdOcupada;
          } else {
            const lastP = sub.projecao?.[sub.projecao.length - 1];
            const lastH = sub.historico?.[sub.historico.length - 1];
            if (lastP) {
              sum += lastP.qtdOcupada;
            } else if (lastH) {
              sum += lastH.qtdOcupada;
            }
          }
        }
      });
      return sum;
    });

    // Calculate total capacity reference values across the selected days
    const capacityValues = targetDates.map(d => {
      let capSum = 0;
      activeSubcategories.forEach(sub => {
        if (isReal) {
          const foundH = sub.historico?.find(h => h.data === d);
          capSum += foundH ? foundH.qtdPosicoes : (sub.historico?.[sub.historico.length - 1]?.qtdPosicoes || 0);
        } else {
          const foundP = sub.projecao?.find(p => p.data === d);
          if (foundP) {
            capSum += foundP.qtdPosicoes;
          } else {
            const lastP = sub.projecao?.[sub.projecao.length - 1];
            const lastH = sub.historico?.[sub.historico.length - 1];
            capSum += lastP ? lastP.qtdPosicoes : (lastH ? lastH.qtdPosicoes : 0);
          }
        }
      });
      return capSum;
    });

    // Directly capture percentualOcupacao from API data for each day with maximum precision
    const percentageValues = targetDates.map(d => {
      if (activeSubcategories.length === 1) {
        const sub = activeSubcategories[0];
        const item = isReal
          ? sub.historico?.find(h => h.data === d) || sub.historico?.[sub.historico.length - 1]
          : sub.projecao?.find(p => p.data === d) || sub.projecao?.[sub.projecao.length - 1];
        if (item && item.percentualOcupacao !== undefined && item.percentualOcupacao !== null) {
          const rawPct = typeof item.percentualOcupacao === "string" ? parseFloat(item.percentualOcupacao) : item.percentualOcupacao;
          const pct = rawPct <= 1 ? rawPct * 100 : rawPct;
          return Math.round(pct * 10) / 10;
        } else if (item && item.qtdPosicoes > 0) {
          return Math.round(((item.qtdOcupada / item.qtdPosicoes) * 100) * 10) / 10;
        }
      }

      let totalOccup = 0;
      let totalCap = 0;
      activeSubcategories.forEach(sub => {
        const item = isReal
          ? sub.historico?.find(h => h.data === d) || sub.historico?.[sub.historico.length - 1]
          : sub.projecao?.find(p => p.data === d) || sub.projecao?.[sub.projecao.length - 1];
        if (item) {
          totalOccup += item.qtdOcupada;
          totalCap += item.qtdPosicoes;
        }
      });

      return totalCap > 0 ? Math.round(((totalOccup / totalCap) * 100) * 10) / 10 : 0;
    });

    const alertValues = capacityValues.map(c => Math.round(c * 0.85));

    // Timeline labels (DD/MM)
    const labels = targetDates.map(d => {
      const parts = d.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
    });

    return {
      labels,
      percentages: percentageValues,
      datasets: [
        {
          type: "line" as const,
          label: isReal ? "Ocupação Real (Pallets)" : "Ocupação Projetada (Pallets)",
          data: occupiedValues,
          percentages: percentageValues,
          borderColor: isReal ? "#8b5cf6" : "#06b6d4",
          backgroundColor: (context: any) => {
            const ctx = context.chart?.ctx;
            if (!ctx) return isReal ? "rgba(139, 92, 246, 0.2)" : "rgba(6, 182, 212, 0.2)";
            const gradient = ctx.createLinearGradient(0, 0, 0, 200);
            if (isReal) {
              gradient.addColorStop(0, isDark ? "rgba(139, 92, 246, 0.35)" : "rgba(139, 92, 246, 0.2)");
            } else {
              gradient.addColorStop(0, isDark ? "rgba(6, 182, 212, 0.35)" : "rgba(6, 182, 212, 0.2)");
            }
            gradient.addColorStop(1, "transparent");
            return gradient;
          },
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: isReal ? "#8b5cf6" : "#06b6d4",
          order: 1
        },
        {
          type: "bar" as const,
          label: "Capacidade Total (Pallets)",
          data: capacityValues,
          backgroundColor: isDark ? "rgba(71, 85, 105, 0.25)" : "rgba(203, 213, 225, 0.55)",
          borderColor: isDark ? "rgba(100, 116, 139, 0.4)" : "rgba(148, 163, 184, 0.6)",
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.45,
          categoryPercentage: 0.7,
          order: 2
        },
        {
          type: "line" as const,
          label: "Alerta Crítico (85%)",
          data: alertValues,
          borderColor: isDark ? "rgba(245, 158, 11, 0.65)" : "rgba(245, 158, 11, 0.8)",
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
          order: 0
        }
      ]
    };
  }, [painelData, selectedCategory, projectionMode, realDates, projDates, isDark]);

  // Detailed Day-by-Day breakdown for the active mode (Used in Maximized modal)
  const activeTimelineDetails = useMemo(() => {
    const isReal = projectionMode === "real";
    const targetDates = isReal ? realDates : projDates;

    const rows = targetDates.map((dateStr) => {
      let ocupadaSum = 0;
      let capSum = 0;
      let directPct: number | null = null;
      const activeSubs = selectedCategory === "all"
        ? painelData
        : painelData.filter(s => s.subCategoria.toLowerCase() === selectedCategory.toLowerCase());

      activeSubs.forEach(sub => {
        if (isReal) {
          const item = sub.historico?.find(h => h.data === dateStr);
          if (item) {
            ocupadaSum += item.qtdOcupada;
            capSum += item.qtdPosicoes;
            if (activeSubs.length === 1 && item.percentualOcupacao !== undefined && item.percentualOcupacao !== null) {
              const rawPct = typeof item.percentualOcupacao === "string" ? parseFloat(item.percentualOcupacao) : item.percentualOcupacao;
              const calc = rawPct <= 1 ? rawPct * 100 : rawPct;
              directPct = Math.round(calc * 10) / 10;
            }
          } else {
            const lastH = sub.historico?.[sub.historico.length - 1];
            if (lastH) {
              ocupadaSum += lastH.qtdOcupada;
              capSum += lastH.qtdPosicoes;
              if (activeSubs.length === 1 && lastH.percentualOcupacao !== undefined && lastH.percentualOcupacao !== null) {
                const rawPct = typeof lastH.percentualOcupacao === "string" ? parseFloat(lastH.percentualOcupacao) : lastH.percentualOcupacao;
                const calc = rawPct <= 1 ? rawPct * 100 : rawPct;
                directPct = Math.round(calc * 10) / 10;
              }
            }
          }
        } else {
          const item = sub.projecao?.find(p => p.data === dateStr);
          if (item) {
            ocupadaSum += item.qtdOcupada;
            capSum += item.qtdPosicoes;
            if (activeSubs.length === 1 && item.percentualOcupacao !== undefined && item.percentualOcupacao !== null) {
              const rawPct = typeof item.percentualOcupacao === "string" ? parseFloat(item.percentualOcupacao) : item.percentualOcupacao;
              const calc = rawPct <= 1 ? rawPct * 100 : rawPct;
              directPct = Math.round(calc * 10) / 10;
            }
          } else {
            const lastP = sub.projecao?.[sub.projecao.length - 1];
            const lastH = sub.historico?.[sub.historico.length - 1];
            if (lastP) {
              ocupadaSum += lastP.qtdOcupada;
              capSum += lastP.qtdPosicoes;
              if (activeSubs.length === 1 && lastP.percentualOcupacao !== undefined && lastP.percentualOcupacao !== null) {
                const rawPct = typeof lastP.percentualOcupacao === "string" ? parseFloat(lastP.percentualOcupacao) : lastP.percentualOcupacao;
                const calc = rawPct <= 1 ? rawPct * 100 : rawPct;
                directPct = Math.round(calc * 10) / 10;
              }
            } else if (lastH) {
              ocupadaSum += lastH.qtdOcupada;
              capSum += lastH.qtdPosicoes;
            }
          }
        }
      });

      if (capSum === 0) {
        activeSubs.forEach(sub => {
          capSum += sub.historico?.[sub.historico.length - 1]?.qtdPosicoes || 0;
        });
      }

      const pct = directPct !== null
        ? directPct
        : (capSum > 0 ? Math.round(((ocupadaSum / capSum) * 100) * 10) / 10 : 0);
      const livre = Math.max(0, capSum - ocupadaSum);

      const dParts = dateStr.split("-");
      const dObj = new Date(Number(dParts[0]), Number(dParts[1]) - 1, Number(dParts[2]));
      const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dObj.getDay()] || "";

      return {
        date: dateStr,
        displayDate: `${dParts[2]}/${dParts[1]}`,
        weekday,
        ocupada: ocupadaSum,
        capacidade: capSum,
        livre,
        pct,
        status: pct >= 85 ? "Crítico" : pct >= 75 ? "Atenção" : "Normal"
      };
    });

    const totalOcup = rows.reduce((acc, r) => acc + r.ocupada, 0);
    const totalCap = rows.reduce((acc, r) => acc + r.capacidade, 0);
    const avgOcup = rows.length > 0 ? Math.round(totalOcup / rows.length) : 0;
    const avgCap = rows.length > 0 ? Math.round(totalCap / rows.length) : 0;
    const avgPct = avgCap > 0 ? Math.round((avgOcup / avgCap) * 1000) / 10 : 0;
    const maxOcup = rows.reduce((m, r) => Math.max(m, r.ocupada), 0);
    const minOcup = rows.reduce((m, r) => Math.min(m, r.ocupada || m), rows[0]?.ocupada || 0);

    return {
      rows,
      avgOcup,
      avgCap,
      avgPct,
      maxOcup,
      minOcup
    };
  }, [painelData, selectedCategory, projectionMode, realDates, projDates]);

  const projectionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 20,
        bottom: 5,
        left: 5,
        right: 15
      }
    },
    interaction: {
      mode: "index" as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: "top" as const,
        align: "end" as const,
        labels: {
          color: isDark ? "#94a3b8" : "#64748b",
          font: { size: 9, family: "monospace", weight: "bold" },
          boxWidth: 10,
          usePointStyle: false
        }
      },
      tooltip: {
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "#f8fafc" : "#0f172a",
        bodyColor: isDark ? "#cbd5e1" : "#334155",
        borderColor: isDark ? "#334155" : "#e2e8f0",
        borderWidth: 1,
        padding: 8,
        titleFont: { size: 10, weight: "bold" },
        bodyFont: { size: 10 },
        callbacks: {
          label: (item: any) => {
            if (item.raw === null || item.raw === undefined) return "";
            if (item.datasetIndex === 0) {
              const pcts = (item.dataset as any).percentages;
              let pctStr = "";
              if (pcts && pcts[item.dataIndex] !== undefined) {
                const p = pcts[item.dataIndex];
                pctStr = Number.isInteger(p) ? `${p}%` : `${p.toFixed(1)}%`;
              } else {
                const cap = item.chart.data.datasets[1]?.data[item.dataIndex] || 1;
                pctStr = cap > 0 ? `${((item.raw / cap) * 100).toFixed(1)}%` : "0%";
              }
              return ` ${item.dataset.label}: ${item.raw.toLocaleString("pt-BR")} plts (${pctStr})`;
            }
            return ` ${item.dataset.label}: ${item.raw.toLocaleString("pt-BR")} plts`;
          }
        }
      },
      datalabels: {
        display: (context: any) => {
          // Display ONLY on the line dataset (datasetIndex === 0)
          return context.datasetIndex === 0;
        },
        align: "top" as const,
        anchor: "end" as const,
        offset: 4,
        color: isDark ? "#ffffff" : "#0f172a",
        font: {
          size: 10,
          weight: "bold" as const,
          family: "monospace"
        },
        formatter: (_value: any, context: any) => {
          const dataIndex = context.dataIndex;
          const pcts = (context.dataset as any).percentages;
          if (pcts && pcts[dataIndex] !== undefined) {
            const p = pcts[dataIndex];
            return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
          }
          const occ = context.dataset.data[dataIndex];
          const cap = context.chart.data.datasets[1]?.data[dataIndex] || 1;
          if (cap > 0 && typeof occ === "number") {
            const pct = (occ / cap) * 100;
            return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
          }
          return "";
        },
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.95)",
        borderRadius: 4,
        padding: {
          top: 1.5,
          bottom: 1.5,
          left: 4,
          right: 4
        },
        borderWidth: 1,
        borderColor: isDark ? "rgba(139, 92, 246, 0.5)" : "rgba(139, 92, 246, 0.35)"
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.25)" : "rgba(226, 232, 240, 0.6)" },
        ticks: { color: isDark ? "#94a3b8" : "#64748b", font: { size: 9, family: "monospace" } }
      },
      y: {
        grace: "12%",
        grid: { color: isDark ? "rgba(51, 65, 85, 0.25)" : "rgba(226, 232, 240, 0.6)" },
        ticks: {
          color: isDark ? "#94a3b8" : "#64748b",
          font: { size: 9, family: "monospace" },
          callback: (val: any) => `${(val / 1000).toFixed(0)}k`
        }
      }
    }
  };

  // Donut Chart Data (Apenas Ocupado x Livre por CD ou Categoria selecionada)
  const donutChartData = useMemo(() => {
    const activeColor = selectedCategory !== "all"
      ? (SUBCATEGORY_COLORS[selectedCategory]?.color || "#8b5cf6")
      : (currentStats.taxaOcupacao >= 85 ? "#f43f5e" : currentStats.taxaOcupacao >= 75 ? "#f59e0b" : "#8b5cf6");

    const trackColor = isDark ? "rgba(30, 41, 59, 0.75)" : "rgba(226, 232, 240, 0.85)";
    const hoverColor = selectedCategory !== "all"
      ? (SUBCATEGORY_COLORS[selectedCategory]?.color || "#7c3aed")
      : (currentStats.taxaOcupacao >= 85 ? "#e11d48" : currentStats.taxaOcupacao >= 75 ? "#d97706" : "#7c3aed");

    return {
      labels: ["Ocupado", "Livre"],
      datasets: [
        {
          data: [currentStats.totalOcupado, currentStats.totalLivre],
          backgroundColor: [
            activeColor,
            trackColor
          ],
          hoverBackgroundColor: [
            hoverColor,
            isDark ? "rgba(51, 65, 85, 0.9)" : "rgba(203, 213, 225, 1)"
          ],
          borderWidth: 0,
          cutout: "75%",
          borderRadius: 4,
          spacing: 2
        }
      ]
    };
  }, [currentStats, selectedCategory, isDark]);

  const donutChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "#f8fafc" : "#0f172a",
        bodyColor: isDark ? "#cbd5e1" : "#334155",
        borderColor: isDark ? "#334155" : "#e2e8f0",
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (item: any) => {
            const isOcupado = item.dataIndex === 0;
            const pct = isOcupado ? currentStats.taxaOcupacao : currentStats.taxaLivre;
            return ` ${item.label}: ${item.raw.toLocaleString("pt-BR")} plts (${pct}%)`;
          }
        }
      },
      datalabels: { display: false }
    }
  }), [isDark, currentStats]);

  // Agendas da Semana Bar Chart Data
  const agendasChartData = useMemo(() => {
    const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const baseMult = selectedCd === 101 ? 1.0 : selectedCd === 205 ? 0.85 : selectedCd === 310 ? 0.7 : 0.9;
    const baseValues = [1420, 1980, 2450, 2100, 1850, 950, 420];
    const data = baseValues.map(v => Math.round(v * baseMult * (selectedCategory !== "all" ? 0.35 : 1)));

    return {
      labels: days,
      datasets: [
        {
          label: "Agendas (Pallets)",
          data,
          backgroundColor: (context: any) => {
            const ctx = context.chart?.ctx;
            if (!ctx) return "#8b5cf6";
            const gradient = ctx.createLinearGradient(0, 0, 0, 120);
            gradient.addColorStop(0, "#8b5cf6");
            gradient.addColorStop(1, "#6366f1");
            return gradient;
          },
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    };
  }, [selectedCd, selectedCategory]);

  const agendasChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
        titleColor: isDark ? "#f8fafc" : "#0f172a",
        bodyColor: isDark ? "#cbd5e1" : "#334155",
        borderColor: isDark ? "#334155" : "#e2e8f0",
        borderWidth: 1,
        padding: 8,
        callbacks: {
          label: (item: any) => ` ${item.raw.toLocaleString("pt-BR")} pallets agendados`
        }
      },
      datalabels: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? "#94a3b8" : "#64748b", font: { size: 9, family: "monospace" } }
      },
      y: {
        grid: { color: isDark ? "rgba(51, 65, 85, 0.2)" : "rgba(226, 232, 240, 0.6)" },
        ticks: {
          color: isDark ? "#94a3b8" : "#64748b",
          font: { size: 9, family: "monospace" },
          callback: (val: any) => `${(val / 1000).toFixed(0)}k`
        }
      }
    }
  };

  // 📊 Gráfico Ocupação por Categoria (Data & Options)
  const categoryChartData = useMemo(() => {
    const labels = categories.map(c => c.name);

    if (categoryChartMode === "percent") {
      const pcts = categories.map(c => c.ocupacaoPct);
      const bgColors = categories.map(c => {
        const isDimmed = selectedCategory !== "all" && c.name.toLowerCase() !== selectedCategory.toLowerCase();
        if (isDimmed) return isDark ? "rgba(100, 116, 139, 0.2)" : "rgba(203, 213, 225, 0.35)";
        if (c.ocupacaoPct >= 85) return "rgba(244, 63, 94, 0.85)";
        if (c.ocupacaoPct >= 75) return "rgba(245, 158, 11, 0.85)";
        return "rgba(16, 185, 129, 0.85)";
      });

      return {
        labels,
        datasets: [
          {
            type: "bar" as const,
            label: "Taxa de Ocupação (%)",
            data: pcts,
            backgroundColor: bgColors,
            borderRadius: 6,
            barPercentage: 0.65,
            categoryPercentage: 0.85
          }
        ]
      };
    }

    // Default: Volume (Pallets vs Capacidade)
    const ocupData = categories.map(c => c.pallets);
    const capData = categories.map(c => c.capacidade);

    const ocupColors = categories.map(c => {
      const isDimmed = selectedCategory !== "all" && c.name.toLowerCase() !== selectedCategory.toLowerCase();
      if (isDimmed) return isDark ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.25)";
      return c.color || "#8b5cf6";
    });

    const capColors = categories.map(() => {
      return isDark ? "rgba(51, 65, 85, 0.35)" : "rgba(226, 232, 240, 0.75)";
    });

    return {
      labels,
      datasets: [
        {
          type: "bar" as const,
          label: "Paletes Ocupados",
          data: ocupData,
          backgroundColor: ocupColors,
          borderRadius: 6,
          barPercentage: 0.75,
          categoryPercentage: 0.8,
          order: 1
        },
        {
          type: "bar" as const,
          label: "Capacidade Total",
          data: capData,
          backgroundColor: capColors,
          borderColor: isDark ? "rgba(100, 116, 139, 0.4)" : "rgba(148, 163, 184, 0.6)",
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.75,
          categoryPercentage: 0.8,
          order: 2
        }
      ]
    };
  }, [categories, categoryChartMode, selectedCategory, isDark]);

  const categoryChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_: any, elements: any[]) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const cat = categories[index];
          if (cat) {
            handleCategoryClick(cat.name);
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          align: "end" as const,
          labels: {
            color: isDark ? "#94a3b8" : "#64748b",
            font: { size: 10, family: "monospace", weight: "bold" as const },
            boxWidth: 10,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
          titleColor: isDark ? "#f8fafc" : "#0f172a",
          bodyColor: isDark ? "#cbd5e1" : "#334155",
          borderColor: isDark ? "#334155" : "#e2e8f0",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: (item: any) => {
              if (categoryChartMode === "percent") {
                return ` Taxa: ${item.raw}%`;
              }
              return ` ${item.dataset.label}: ${item.raw.toLocaleString("pt-BR")} plts`;
            },
            afterBody: (tooltipItems: any[]) => {
              if (!tooltipItems.length) return "";
              const idx = tooltipItems[0].dataIndex;
              const cat = categories[idx];
              if (!cat) return "";
              const free = Math.max(0, cat.capacidade - cat.pallets);
              return `\nTaxa de Ocupação: ${cat.ocupacaoPct}%\nPosições Livres: ${free.toLocaleString("pt-BR")} plts\n(Clique na barra para filtrar)`;
            }
          }
        },
        datalabels: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: isDark ? "#94a3b8" : "#64748b",
            font: { size: 9, family: "monospace", weight: "bold" as const },
            maxRotation: 45,
            minRotation: 20
          }
        },
        y: {
          grid: { color: isDark ? "rgba(51, 65, 85, 0.2)" : "rgba(226, 232, 240, 0.6)" },
          ticks: {
            color: isDark ? "#94a3b8" : "#64748b",
            font: { size: 9, family: "monospace" },
            callback: (val: any) => categoryChartMode === "percent" ? `${val}%` : `${(val / 1000).toFixed(0)}k`
          }
        }
      }
    };
  }, [categories, categoryChartMode, isDark, handleCategoryClick]);

  return (
    <div className={`flex flex-col w-full h-full flex-1 min-h-0 font-sans ${isDark ? "text-slate-100" : "text-slate-800"}`}>
      
      {/* 🚀 CONTEÚDO PRINCIPAL (FULL WIDTH - COMPACTADO PARA ZOOM 100% SEM SCROLL) */}
      <div className="flex-1 flex flex-col min-w-0 w-full h-full min-h-0 overflow-y-auto lg:overflow-hidden p-1 sm:p-2">
        
        {/* BARRA SUPERIOR DE FILTROS: CD SELECTOR + REFRESH + STATUS */}
        <div className="flex items-center justify-between gap-2 pb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            {/* CD Selector */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shadow-2xs ${
              isDark ? "bg-[#0f1422] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"
            }`}>
              <Building className="w-3.5 h-3.5 text-violet-500 shrink-0" />
              <select
                value={selectedCd}
                onChange={(e) => setSelectedCd(Number(e.target.value))}
                className="bg-transparent font-bold text-xs outline-hidden cursor-pointer"
              >
                {CDS_LIST.map((cd) => (
                  <option 
                    key={cd.id} 
                    value={cd.id} 
                    className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}
                  >
                    {cd.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria Ativa Badge se filtrada */}
            {selectedCategory !== "all" && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-500 text-xs font-bold">
                <span>Filtro: {selectedCategory}</span>
                <button
                  onClick={() => handleCategoryClick("all")}
                  className="p-0.5 hover:bg-violet-500/20 rounded cursor-pointer"
                  title="Remover filtro"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              Atualizado às {new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Atualizar dados"
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isDark 
                  ? "bg-[#0f1422] border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60" 
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-violet-500" : ""}`} />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 🌟 MACRO LAYOUT: BLOCO PRINCIPAL (ESQUERDA) + BARRA LATERAL (DIREITA) */}
        {/* ============================================================ */}
        {isLoading ? (
          <div className="w-full flex-1 min-h-[350px] flex flex-col items-center justify-center p-8 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/20 my-auto">
            <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mb-3" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
              Sincronizando com a API...
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch flex-1 min-h-0">
          
          {/* ============================================================ */}
          {/* ⬅️ BLOCO PRINCIPAL ESQUERDO (8 COLUNAS)                      */}
          {/* ============================================================ */}
          <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-2.5 min-h-0">
            
            {/* 🔝 3 KPI CARDS NO TOPO DO BLOCO ESQUERDO (SLIM / FINOS) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
              
              {/* CARD 1: CAPACIDADE TOTAL */}
              <div className={`p-2.5 rounded-xl border relative overflow-hidden flex flex-col justify-between shadow-xs ${
                isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
              }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                    Capacidade Total
                  </span>
                  {/* <span className="text-[9px] font-mono font-bold text-orange-500">
                    {selectedCategory === "all" ? "CD Completo" : selectedCategory}
                  </span> */}
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg sm:text-xl font-black tracking-tight">
                    {currentStats.totalCapacidade.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">pallets</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex-1 h-7 sm:h-8 min-w-0">
                    <Line data={sparklineCapacidade} options={sparklineCapOptions as any} />
                  </div>
                  <div className={`shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                    diffMetrics.capDiffPct > 0
                      ? "bg-rose-500/15 text-rose-500 dark:text-rose-400"
                      : diffMetrics.capDiffPct < 0
                      ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                      : "bg-slate-500/15 text-slate-400"
                  }`}>
                    {diffMetrics.capDiffPct > 0 ? `▲ +${diffMetrics.capDiffPct}%` : diffMetrics.capDiffPct < 0 ? `▼ ${diffMetrics.capDiffPct}%` : "0.0%"}
                    <span className="text-[8px] opacity-75 font-normal ml-0.5">vs ontem</span>
                  </div>
                </div>
              </div>

              {/* CARD 2: OCUPAÇÃO ATUAL */}
              <div className={`p-2.5 rounded-xl border relative overflow-hidden flex flex-col justify-between shadow-xs ${
                isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
              }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                    Ocupação Atual
                  </span>
                  {/* <span className={`text-[9px] font-mono font-bold ${
                    currentStats.taxaOcupacao >= 85 ? "text-rose-500" : currentStats.taxaOcupacao >= 75 ? "text-amber-500" : "text-violet-500"
                  }`}>
                    {currentStats.taxaOcupacao}%
                  </span> */}
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg sm:text-xl font-black tracking-tight">
                    {currentStats.totalOcupado.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">pallets</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex-1 h-7 sm:h-8 min-w-0">
                    <Line data={sparklineOcupado} options={sparklineOcupOptions as any} />
                  </div>
                  <div className={`shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                    diffMetrics.ocupDiffPct > 0
                      ? "bg-rose-500/15 text-rose-500 dark:text-rose-400"
                      : diffMetrics.ocupDiffPct < 0
                      ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                      : "bg-slate-500/15 text-slate-400"
                  }`}>
                    {diffMetrics.ocupDiffPct > 0 ? `▲ +${diffMetrics.ocupDiffPct}%` : diffMetrics.ocupDiffPct < 0 ? `▼ ${diffMetrics.ocupDiffPct}%` : "0.0%"}
                    <span className="text-[8px] opacity-75 font-normal ml-0.5">vs ontem</span>
                  </div>
                </div>
              </div>

              {/* CARD 3: POSIÇÕES LIVRES */}
              <div className={`p-2.5 rounded-xl border relative overflow-hidden flex flex-col justify-between shadow-xs ${
                isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
              }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                    Posições Livres
                  </span>
                  {/* <span className="text-[9px] font-mono font-bold text-cyan-500">
                    {currentStats.taxaLivre}%
                  </span> */}
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg sm:text-xl font-black tracking-tight">
                    {currentStats.totalLivre.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">pallets</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <div className="flex-1 h-7 sm:h-8 min-w-0">
                    <Line data={sparklineLivre} options={sparklineLivreOptions as any} />
                  </div>
                  <div className={`shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                    diffMetrics.livreDiffPct > 0
                      ? "bg-rose-500/15 text-rose-500 dark:text-rose-400"
                      : diffMetrics.livreDiffPct < 0
                      ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                      : "bg-slate-500/15 text-slate-400"
                  }`}>
                    {diffMetrics.livreDiffPct > 0 ? `▲ +${diffMetrics.livreDiffPct}%` : diffMetrics.livreDiffPct < 0 ? `▼ ${diffMetrics.livreDiffPct}%` : "0.0%"}
                    <span className="text-[8px] opacity-75 font-normal ml-0.5">vs ontem</span>
                  </div>
                </div>
              </div>

            </div>

            {/* 📦 LINHA INFERIOR DO BLOCO ESQUERDO: CATEGORIAS (ESTREITA) + PROJEÇÃO & AGENDAS */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-stretch flex-1 min-h-0">
              
              {/* 📋 COLUNA INTERNA 1: OCUPAÇÃO POR CATEGORIA (ESTREITA / SLIM) */}
              <div className={`md:col-span-5 p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between shadow-xs min-h-0 ${
                isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
              }`}>
                <div className="flex flex-col min-h-0 flex-1">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <h3 className={`text-xs font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                        Ocupação por Categoria
                      </h3>
                    </div>

                    {selectedCategory !== "all" && (
                      <button
                        onClick={() => handleCategoryClick("all")}
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 border border-violet-500/30 transition-all cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  <p className="text-[9px] text-slate-400 font-medium mt-0.5 shrink-0">
                    {categories.length} subcategorias no CD {selectedCd} • Clique para filtrar
                  </p>

                  <div className="w-full h-px bg-slate-200 dark:bg-slate-800/80 my-1.5 shrink-0" />

                  {/* Lista Vertical de Categorias com Barra de Progresso Trilha Escura */}
                  <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1 max-h-[290px] sm:max-h-[310px] 2xl:max-h-[380px]">
                    {categories.map((cat) => {
                      const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                      const pctFormatted = Number.isInteger(cat.ocupacaoPct) ? `${cat.ocupacaoPct}%` : `${cat.ocupacaoPct.toFixed(1)}%`;
                      
                      return (
                        <div
                          key={cat.id}
                          onClick={() => handleCategoryClick(cat.name)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer select-none ${
                            isSelected
                              ? "bg-violet-500/10 border-violet-500 ring-2 ring-violet-500/30 shadow-xs"
                              : isDark
                              ? "bg-[#141a2e] border-[#1e2740] hover:border-slate-600 hover:bg-[#18213a]"
                              : "bg-slate-50 border-slate-200/90 hover:border-slate-300 hover:bg-slate-100/70"
                          }`}
                        >
                          {/* Linha superior: Dot + Nome | Paletes + Taxa */}
                          <div className="flex items-center justify-between mb-1 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className={`font-bold text-[10px] truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                                {cat.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 font-mono shrink-0 text-[10px]">
                              <span className="text-slate-400 font-semibold">
                                {cat.pallets.toLocaleString("pt-BR")}
                              </span>
                              <span
                                className={`font-bold ${
                                  cat.ocupacaoPct >= 85
                                    ? "text-rose-500 dark:text-rose-400"
                                    : cat.ocupacaoPct >= 75
                                    ? "text-amber-500 dark:text-amber-400"
                                    : "text-emerald-500 dark:text-emerald-400"
                                }`}
                              >
                                {pctFormatted}
                              </span>
                            </div>
                          </div>

                          {/* Linha inferior: Barra de Progresso com Trilha Escura */}
                          <div className="w-full h-1 rounded-full bg-black dark:bg-[#070a12] overflow-hidden border border-slate-800/40">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.max(1, cat.ocupacaoPct))}%`,
                                backgroundColor: cat.color
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-800 text-[9px] text-slate-400 font-mono flex items-center justify-between shrink-0">
                  <span>Total: {categories.length} subcats</span>
                  <span className="font-bold text-violet-400">CD {selectedCd}</span>
                </div>
              </div>

              {/* 📈 COLUNA INTERNA 2: PROJEÇÃO DE ESTOQUE + AGENDAS DA SEMANA */}
              <div className="md:col-span-7 flex flex-col gap-2.5 min-h-0">
                
                {/* 📊 PROJEÇÃO / HISTÓRICO DE ESTOQUE (14 DIAS) */}
                <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between shadow-xs ${
                  isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
                }`}>
                  {/* Header with Mode Toggle & Maximize Button */}
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h3 className={`text-xs font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                        {projectionMode === "real" ? "Histórico Real de Estoque (14 Dias)" : "Projeção Futura de Estoque (14 Dias)"}
                      </h3>
                      <span className="text-[9px] text-slate-400 block font-medium">
                        {projectionMode === "real"
                          ? `14D Real (${realDates[0]?.split("-").reverse().slice(0, 2).join("/")} a ${realDates[realDates.length - 1]?.split("-").reverse().slice(0, 2).join("/")})`
                          : `14D Proj (${projDates[0]?.split("-").reverse().slice(0, 2).join("/")} a ${projDates[projDates.length - 1]?.split("-").reverse().slice(0, 2).join("/")})`
                        }
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Mode Toggle (Real vs Projetado) */}
                      <div className={`inline-flex items-center p-0.5 rounded-lg border ${
                        isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
                      }`}>
                        <button
                          onClick={() => {
                            setProjectionMode("real");
                            showNotification("📊 Visualizando Histórico Real de 14 Dias");
                          }}
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                            projectionMode === "real"
                              ? "bg-violet-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Real (14D)
                        </button>
                        <button
                          onClick={() => {
                            setProjectionMode("projecao");
                            showNotification("📈 Visualizando Projeção Futura de 14 Dias");
                          }}
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                            projectionMode === "projecao"
                              ? "bg-cyan-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Projetado (14D)
                        </button>
                      </div>

                      {/* Maximize Button */}
                      <button
                        onClick={() => setIsChartMaximized(true)}
                        title="Maximizar Gráfico"
                        className={`p-1 rounded-lg border transition-all cursor-pointer ${
                          isDark 
                            ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700" 
                            : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Chart Canvas */}
                  <div className="h-44 sm:h-48 relative w-full mt-0.5">
                    <Chart type="bar" data={projectionChartData as any} options={projectionChartOptions as any} />
                  </div>
                </div>

                {/* 📊 AGENDAS DA SEMANA */}
                <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between shadow-xs ${
                  isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h3 className={`text-xs font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                        Agendas da Semana
                      </h3>
                      <span className="text-[9px] text-slate-400 font-medium">
                        Previsão de Recebimento de Carga (Pallets por Dia)
                      </span>
                    </div>
                  </div>

                  <div className="h-24 sm:h-28 relative w-full">
                    <Bar data={agendasChartData} options={agendasChartOptions as any} />
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* ============================================================ */}
          {/* ➡️ BARRA LATERAL DIREITA (4 COLUNAS - DONUT + TABELA ITENS)  */}
          {/* ============================================================ */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-2.5 min-h-0">
            
            {/* 🍩 DONUT: OCUPAÇÃO VS LIVRE (POR CD) */}
            <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between shadow-xs shrink-0 ${
              isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h3 className={`text-xs font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    Ocupado x Livre
                  </h3>
                  <span className="text-[9px] text-slate-400 block font-medium">
                    CD {selectedCd} • Visão Consolidada
                  </span>
                </div>
                {/* <span className="text-[10px] font-mono font-bold text-violet-500">
                  {currentStats.taxaOcupacao}% Ocupado
                </span> */}
              </div>

              <div className="h-32 sm:h-36 relative flex items-center justify-center my-0.5">
                <Doughnut data={donutChartData} options={donutChartOptions as any} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] text-slate-400 font-mono">Taxa</span>
                  <span className="text-lg sm:text-xl font-black">{currentStats.taxaOcupacao}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] font-mono">
                <div>
                  <span className="text-slate-400 block flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" /> Ocupado
                  </span>
                  <span className="font-bold text-violet-400">{currentStats.totalOcupado.toLocaleString("pt-BR")} plts</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block flex items-center justify-end gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${isDark ? "bg-slate-700" : "bg-slate-300"}`} /> Livre
                  </span>
                  <span className="font-bold text-cyan-400">{currentStats.totalLivre.toLocaleString("pt-BR")} plts</span>
                </div>
              </div>
            </div>

            {/* 📋 TABELA ITENS (PLU / PALLET - ESTREITA E COMPACTA) */}
            <div className={`p-2.5 sm:p-3 rounded-xl border flex-1 flex flex-col justify-between shadow-xs min-h-0 ${
              isDark ? "bg-[#0f1422] border-[#1e2538]" : "bg-white border-slate-200"
            }`}>
              <div className="flex flex-col min-h-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
                  <div>
                    <h3 className={`text-xs font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                      Itens
                    </h3>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {filteredPlus.length} itens no CD {selectedCd}
                    </span>
                  </div>

                  {/* Input de busca rápida com borda arredondada */}
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchPlu}
                      onChange={(e) => setSearchPlu(e.target.value)}
                      placeholder="Buscar..."
                      className={`pl-6 pr-2 py-0.5 rounded-lg border text-[11px] transition-all w-24 sm:w-28 ${
                        isDark ? "bg-slate-900 border-slate-800 text-white placeholder-slate-500" : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                  </div>
                </div>

                {/* Tabela com Header Escuro Estilizado e 2 Colunas: PLU e PALLET */}
                <div className="overflow-x-auto overflow-y-auto border border-slate-800/80 rounded-lg bg-slate-950/20 flex-1 max-h-[220px] sm:max-h-[260px] 2xl:max-h-[320px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#182032] text-slate-200 uppercase text-[9px] font-mono font-bold sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-1.5 px-2.5">PLU</th>
                        <th className="py-1.5 px-2.5 text-right">PALLET</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      {filteredPlus.map((item) => {
                        const isSelected = selectedCategory.toLowerCase() === item.categoria.toLowerCase();
                        const itemColor = SUBCATEGORY_COLORS[item.categoria]?.color || "#8b5cf6";
                        return (
                          <tr
                            key={item.plu}
                            onClick={() => handleCategoryClick(item.categoria)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-violet-500/15 dark:bg-violet-500/20"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                            }`}
                          >
                            <td className="py-1.5 px-2.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: itemColor }}
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 block font-mono text-[11px] truncate">
                                    {item.plu}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block truncate max-w-[100px]">
                                    {item.categoria}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-1.5 px-2.5 text-right">
                              <span className="font-bold text-violet-600 dark:text-violet-400 block font-mono text-[11px]">
                                {item.pallets.toLocaleString("pt-BR")} plts
                              </span>
                              <span className="text-[8px] text-slate-400 block font-mono">
                                {currentStats.totalCapacidade > 0 ? ((item.pallets / currentStats.totalCapacidade) * 100).toFixed(1) : "0"}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-1.5 mt-1 border-t border-slate-200 dark:border-slate-800 text-[9px] text-slate-400 font-mono flex items-center justify-between shrink-0">
                <span>{filteredPlus.length} itens</span>
                {selectedCategory !== "all" ? (
                  <button
                    onClick={() => handleCategoryClick("all")}
                    className="text-violet-500 font-bold hover:underline cursor-pointer"
                  >
                    Limpar
                  </button>
                ) : (
                  <span>Clique p/ filtrar</span>
                )}
              </div>
            </div>

          </div>

        </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* 🔍 MAXIMIZED PROJECTION / REAL CHART MODAL VIEW               */}
      {/* ============================================================ */}
      <AnimatePresence>
        {isChartMaximized && (
          <motion.div
            key="maximized-chart-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsChartMaximized(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              className={`w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border p-5 sm:p-6 shadow-2xl flex flex-col gap-4 ${
                isDark ? "bg-[#0f1422] border-[#1e2538] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-violet-500" />
                    <h2 className="text-base sm:text-lg font-black tracking-tight">
                      {projectionMode === "real" ? "Histórico Real de Ocupação (14 Dias)" : "Projeção Futura de Estoque (14 Dias)"}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    CD {selectedCd} • {selectedCategory === "all" ? "Todas as Categorias" : `Categoria: ${selectedCategory}`} • Janela de {activeTimelineDetails.rows[0]?.displayDate} a {activeTimelineDetails.rows[activeTimelineDetails.rows.length - 1]?.displayDate}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle Real vs Projetado in Maximized mode */}
                  <div className={`inline-flex items-center p-0.5 rounded-xl border ${
                    isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
                  }`}>
                    <button
                      onClick={() => setProjectionMode("real")}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        projectionMode === "real"
                          ? "bg-violet-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Real (14 Dias)
                    </button>
                    <button
                      onClick={() => setProjectionMode("projecao")}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        projectionMode === "projecao"
                          ? "bg-cyan-600 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Projetado (14 Dias)
                    </button>
                  </div>

                  {/* Minimize / Close Button */}
                  <button
                    onClick={() => setIsChartMaximized(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
                    title="Minimizar Gráfico"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Minimizar</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Metric Cards (Clean without clutter tags) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Média no Período</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black">{activeTimelineDetails.avgOcup.toLocaleString("pt-BR")}</span>
                    <span className="text-[10px] text-slate-400 font-mono">plts</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Capacidade Média</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black">{activeTimelineDetails.avgCap.toLocaleString("pt-BR")}</span>
                    <span className="text-[10px] text-slate-400 font-mono">plts</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Taxa Média</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className={`text-lg font-black ${
                      activeTimelineDetails.avgPct >= 85 ? "text-rose-500" : activeTimelineDetails.avgPct >= 75 ? "text-amber-500" : "text-emerald-500"
                    }`}>{activeTimelineDetails.avgPct}%</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                  <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block">Pico Máximo</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black text-violet-400">{activeTimelineDetails.maxOcup.toLocaleString("pt-BR")}</span>
                    <span className="text-[10px] text-slate-400 font-mono">plts</span>
                  </div>
                </div>
              </div>

              {/* High Resolution Maximized Mixed Chart */}
              <div className={`p-4 rounded-2xl border ${isDark ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200"}`}>
                <div className="w-full h-72 sm:h-80 relative">
                  <Chart type="bar" data={projectionChartData as any} options={projectionChartOptions as any} />
                </div>
              </div>

              {/* Detailed Day-by-Day Table */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Detalhamento Diário ({projectionMode === "real" ? `${realDates.length} Dias Retroativos` : "14 Dias de Projeção"})
                </h4>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 uppercase text-[9px] font-mono font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Dia</th>
                        <th className="py-2.5 px-3 text-right">Capacidade Total</th>
                        <th className="py-2.5 px-3 text-right">Capacidade Ocupado</th>
                        <th className="py-2.5 px-3 text-right">Capacidade Livre</th>
                        <th className="py-2.5 px-3 text-center">Ocupação (%)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-mono">
                      {activeTimelineDetails.rows.map((row) => (
                        <tr key={row.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-violet-500 dark:text-violet-400">
                            {row.displayDate}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                            {row.weekday}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 font-semibold">
                            {row.capacidade.toLocaleString("pt-BR")} plts
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-violet-600 dark:text-violet-400">
                            {row.ocupada.toLocaleString("pt-BR")} plts
                          </td>
                          <td className="py-2.5 px-3 text-right text-cyan-600 dark:text-cyan-400 font-medium">
                            {row.livre.toLocaleString("pt-BR")} plts
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`font-black ${
                                row.pct >= 85 ? "text-rose-500" : row.pct >= 75 ? "text-amber-500" : "text-emerald-500"
                              }`}>
                                {row.pct}%
                              </span>
                              <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    row.pct >= 85 ? "bg-rose-500" : row.pct >= 75 ? "bg-amber-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(100, row.pct)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                              row.status === "Crítico"
                                ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                                : row.status === "Atenção"
                                ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
