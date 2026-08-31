import { Capacidade, PainelEstoqueSubCategoria } from "./types";

// ============================================================================
// 🏢 DISTRIBUTION CENTERS AND CATEGORIES
// ============================================================================
export const CATEGORIAS_POR_CD: Record<string, string[]> = {
  "101": [
    "Dry Foods",
    "Hygiene & Cleaning",
    "Electronics",
    "Beverages",
    "Home & Utilities",
    "Personal Care",
    "Cereals & Breakfast",
    "Snacks & Confectionery",
    "Pet Care"
  ],
  "205": [
    "Refrigerated",
    "Frozen",
    "Fresh Produce",
    "Dairy Products",
    "Premium Meats",
    "Bakery",
    "Cold Cuts",
    "Seafood"
  ],
  "310": [
    "Beverages",
    "Dry Foods",
    "Packaging",
    "Wine & Spirits",
    "Soft Drinks & Juices",
    "Specialty Beers",
    "Water & Isotonic",
    "Disposables"
  ],
  "420": [
    "Fashion & Textiles",
    "Household Goods",
    "Premium Home",
    "Bed & Bath",
    "Footwear & Accessories",
    "Furniture",
    "Decor & Lighting"
  ],
  "550": [
    "Industrial Supplies",
    "Raw Materials",
    "Pharmaceutical",
    "Chemicals",
    "Safety Equipment",
    "Nutrition",
    "Medical Hygiene"
  ],
  "615": [
    "Refrigerated",
    "Fresh Produce",
    "Bakery & Sweets",
    "Dry Foods",
    "Regional Beverages",
    "Hygiene & Cleaning",
    "Dairy Products"
  ],
  "780": [
    "Consumer Electronics",
    "Premium Home",
    "IT Equipment",
    "Mobile Devices",
    "Audio & Video",
    "Small Appliances",
    "Gaming",
    "Climate Control"
  ]
};

export const CD_OPTIONS = [
  { id: 101, code: "101", name: "DC 101 - Logistics Hub Alpha", location: "Sao Paulo - SP" },
  { id: 205, code: "205", name: "DC 205 - Central Hub Delta", location: "Contagem - MG" },
  { id: 310, code: "310", name: "DC 310 - Distribution Omega", location: "Duque de Caxias - RJ" },
  { id: 420, code: "420", name: "DC 420 - Aurora Express", location: "Sao Jose dos Pinhais - PR" },
  { id: 550, code: "550", name: "DC 550 - Titan Supply Hub", location: "Canoas - RS" },
  { id: 615, code: "615", name: "DC 615 - Pegasus Northeast", location: "Cabo de Santo Agostinho - PE" },
  { id: 780, code: "780", name: "DC 780 - Solaris Central", location: "Aparecida de Goiania - GO" },
];

export const CDS_LIST = CD_OPTIONS;

// Colors and gradients for categories
export const SUBCATEGORY_COLORS: Record<string, { color: string; gradient: [string, string] }> = {
  "Dry Foods": { color: "#06b6d4", gradient: ["#06b6d4", "#0284c7"] },
  "Hygiene & Cleaning": { color: "#8b5cf6", gradient: ["#8b5cf6", "#6d28d9"] },
  "Electronics": { color: "#f59e0b", gradient: ["#f59e0b", "#d97706"] },
  "Beverages": { color: "#6366f1", gradient: ["#6366f1", "#4338ca"] },
  "Home & Utilities": { color: "#ec4899", gradient: ["#ec4899", "#be185d"] },
  "Personal Care": { color: "#d946ef", gradient: ["#d946ef", "#a21caf"] },
  "Cereals & Breakfast": { color: "#14b8a6", gradient: ["#14b8a6", "#0f766e"] },
  "Snacks & Confectionery": { color: "#f43f5e", gradient: ["#f43f5e", "#be123c"] },
  "Pet Care": { color: "#10b981", gradient: ["#10b981", "#059669"] },
  "Refrigerated": { color: "#0ea5e9", gradient: ["#0ea5e9", "#0284c7"] },
  "Frozen": { color: "#38bdf8", gradient: ["#38bdf8", "#0369a1"] },
  "Fresh Produce": { color: "#10b981", gradient: ["#10b981", "#047857"] },
  "Dairy Products": { color: "#a855f7", gradient: ["#a855f7", "#7e22ce"] },
  "Premium Meats": { color: "#ef4444", gradient: ["#ef4444", "#b91c1c"] },
  "Bakery": { color: "#fb923c", gradient: ["#fb923c", "#c2410c"] },
  "Cold Cuts": { color: "#e11d48", gradient: ["#e11d48", "#9f1239"] },
  "Seafood": { color: "#06b6d4", gradient: ["#06b6d4", "#0e7490"] },
  "Packaging": { color: "#ec4899", gradient: ["#ec4899", "#be185d"] },
  "Wine & Spirits": { color: "#8b5cf6", gradient: ["#8b5cf6", "#5b21b6"] },
  "Soft Drinks & Juices": { color: "#f97316", gradient: ["#f97316", "#c2410c"] },
  "Specialty Beers": { color: "#eab308", gradient: ["#eab308", "#a16207"] },
  "Water & Isotonic": { color: "#38bdf8", gradient: ["#38bdf8", "#0284c7"] },
  "Disposables": { color: "#64748b", gradient: ["#64748b", "#475569"] },
  "Fashion & Textiles": { color: "#d946ef", gradient: ["#d946ef", "#a21caf"] },
  "Household Goods": { color: "#f97316", gradient: ["#f97316", "#c2410c"] },
  "Premium Home": { color: "#eab308", gradient: ["#eab308", "#ca8a04"] },
  "Bed & Bath": { color: "#ec4899", gradient: ["#ec4899", "#9d174d"] },
  "Footwear & Accessories": { color: "#8b5cf6", gradient: ["#8b5cf6", "#6d28d9"] },
  "Furniture": { color: "#78716c", gradient: ["#78716c", "#44403c"] },
  "Decor & Lighting": { color: "#f59e0b", gradient: ["#f59e0b", "#b45309"] },
  "Industrial Supplies": { color: "#64748b", gradient: ["#64748b", "#475569"] },
  "Raw Materials": { color: "#78716c", gradient: ["#78716c", "#57534e"] },
  "Pharmaceutical": { color: "#14b8a6", gradient: ["#14b8a6", "#0f766e"] },
  "Chemicals": { color: "#6366f1", gradient: ["#6366f1", "#3730a3"] },
  "Safety Equipment": { color: "#f59e0b", gradient: ["#f59e0b", "#d97706"] },
  "Nutrition": { color: "#10b981", gradient: ["#10b981", "#047857"] },
  "Medical Hygiene": { color: "#06b6d4", gradient: ["#06b6d4", "#0e7490"] },
  "Regional Beverages": { color: "#f97316", gradient: ["#f97316", "#ea580c"] },
  "Consumer Electronics": { color: "#3b82f6", gradient: ["#3b82f6", "#1d4ed8"] },
  "IT Equipment": { color: "#8b5cf6", gradient: ["#8b5cf6", "#7c3aed"] },
  "Mobile Devices": { color: "#06b6d4", gradient: ["#06b6d4", "#0284c7"] },
  "Audio & Video": { color: "#ec4899", gradient: ["#ec4899", "#be185d"] },
  "Small Appliances": { color: "#f59e0b", gradient: ["#f59e0b", "#d97706"] },
  "Gaming": { color: "#a855f7", gradient: ["#a855f7", "#6b21a8"] },
  "Climate Control": { color: "#0ea5e9", gradient: ["#0ea5e9", "#0369a1"] },
  "General Supplies": { color: "#a855f7", gradient: ["#a855f7", "#7e22ce"] },
  "Operational Materials": { color: "#059669", gradient: ["#059669", "#047857"] },
  "Industrial Packaging": { color: "#d97706", gradient: ["#d97706", "#92400e"] },
  "Parts & Maintenance": { color: "#475569", gradient: ["#475569", "#1e293b"] },
  "Tools & Hardware": { color: "#ea580c", gradient: ["#ea580c", "#9a3412"] },
  "Handling Equipment": { color: "#2563eb", gradient: ["#2563eb", "#1e40af"] },
};

// ============================================================================
// 📊 DAILY CAPACITY GENERATOR
// ============================================================================
export function generateMockCapacidades(): Capacidade[] {
  const result: Capacidade[] = [];
  let currentId = 1;
  const years = [2025, 2026, 2027];

  Object.entries(CATEGORIAS_POR_CD).forEach(([cdStr, categorias]) => {
    const cd = parseInt(cdStr, 10);

    years.forEach(year => {
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = new Date(year, month, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dateObj = new Date(year, month - 1, day);
          const dayOfWeek = dateObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          categorias.forEach((categoria) => {
            const baseMultiplier = (cd % 10 + 6) * 14;
            const catHash = categoria.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const catMultiplier = (catHash % 7 + 4) * 12;

            let capInbound = Math.round((baseMultiplier * catMultiplier) * (0.88 + ((day + month) % 7) * 0.04));
            
            if (isWeekend) {
              capInbound = Math.round(capInbound * 0.35);
            }

            const capOutFrac = Math.round(capInbound * 0.58);
            const capOutFech = capInbound - capOutFrac;
            const recRemun = !isWeekend && day % 3 === 0 ? Math.round(capInbound * 0.15) : null;

            result.push({
              id: currentId++,
              dataMovimentacao: dateStr,
              cd,
              categoria,
              capacidadeInbound: capInbound,
              capacidadeOutboundFracionado: capOutFrac,
              capacidadeOutboundFechado: capOutFech,
              recebimentoRemunerado: recRemun,
            });
          });
        }
      }
    });
  });

  return result;
}

// ============================================================================
// 🎯 INBOUND AND OUTBOUND METRICS GENERATOR
// ============================================================================
export function generateMockMetas(type: "inbound" | "outbound", baseCapacidades?: Capacidade[]): any[] {
  const caps = baseCapacidades || generateMockCapacidades();
  const result: any[] = [];
  let currentId = 1;

  const grouped: Record<string, {
    cd: number;
    categoria: string;
    ano: number;
    mes: number;
    semana: number;
    inboundTotal: number;
    remunTotal: number;
    fracTotal: number;
    fechTotal: number;
  }> = {};

  caps.forEach((item) => {
    const parts = item.dataMovimentacao.split("-");
    const ano = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10);
    const dia = parseInt(parts[2], 10);
    const semana = Math.ceil(dia / 7);

    const key = `${ano}-${mes}-${item.cd}-${item.categoria}-${semana}`;

    if (!grouped[key]) {
      grouped[key] = {
        cd: item.cd,
        categoria: item.categoria,
        ano,
        mes,
        semana,
        inboundTotal: 0,
        remunTotal: 0,
        fracTotal: 0,
        fechTotal: 0,
      };
    }

    grouped[key].inboundTotal += (item.capacidadeInbound || 0);
    grouped[key].remunTotal += (item.recebimentoRemunerado || 0);
    grouped[key].fracTotal += (item.capacidadeOutboundFracionado || 0);
    grouped[key].fechTotal += (item.capacidadeOutboundFechado || 0);
  });

  Object.values(grouped).forEach((group) => {
    if (type === "inbound") {
      result.push({
        id: currentId++,
        cd: group.cd,
        categoria: group.categoria,
        ano: group.ano,
        mes: group.mes,
        semana: group.semana,
        capacidadeInbound: group.inboundTotal,
        recebimentoRemunerado: group.remunTotal > 0 ? group.remunTotal : Math.round(group.inboundTotal * 0.15),
      });
    } else {
      result.push({
        id: currentId++,
        cd: group.cd,
        categoria: group.categoria,
        ano: group.ano,
        mes: group.mes,
        semana: group.semana,
        capacidadeOutboundFracionado: group.fracTotal,
        capacidadeOutboundFechado: group.fechTotal,
      });
    }
  });

  return result;
}

// ============================================================================
// 📦 STOCK PANEL AND PROJECTION
// ============================================================================
export function generateMockPainelEstoque(cd: number): PainelEstoqueSubCategoria[] {
  const cdStr = String(cd);
  const categorias = CATEGORIAS_POR_CD[cdStr] || CATEGORIAS_POR_CD["101"];
  const hoje = new Date();

  return categorias.map((subCategoria, catIdx) => {
    const catHash = subCategoria.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const totalPosicoes = 2800 + ((cd * 17 + catHash * 19) % 3200);
    const baseOcupacao = 0.62 + ((cd % 5) * 0.03) + ((catIdx % 4) * 0.04);

    const historico = [];
    for (let i = 14; i >= 1; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const variance = Math.sin((i + catIdx) * 0.6) * 0.06;
      const pct = Math.min(0.96, Math.max(0.48, baseOcupacao + variance));
      const ocupada = Math.round(totalPosicoes * pct);

      historico.push({
        data: dateStr,
        origem: "REAL" as const,
        qtdPosicoes: totalPosicoes,
        qtdOcupada: ocupada,
        percentualOcupacao: Math.round(pct * 1000) / 1000,
      });
    }

    const projecao = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const trend = (i * 0.007) + Math.cos((i + catIdx) * 0.5) * 0.03;
      const pct = Math.min(0.97, Math.max(0.50, baseOcupacao + 0.01 + trend));
      const ocupada = Math.round(totalPosicoes * pct);

      projecao.push({
        data: dateStr,
        origem: "PROJECTED" as const,
        qtdPosicoes: totalPosicoes,
        qtdOcupada: ocupada,
        percentualOcupacao: Math.round(pct * 1000) / 1000,
      });
    }

    return {
      cd,
      categoria: subCategoria,
      subCategoria: subCategoria,
      historico,
      projecao,
    };
  });
}

// ============================================================================
// 🚚 INBOUND DASHBOARD PERFORMANCE
// ============================================================================
export function generateMockDashboardInbound(cd: number = 101, categoria: string = "Dry Foods"): any[] {
  const result = [];
  const hoje = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    const capacidade = isWeekend ? 60 : 180;
    const agendado = isWeekend ? Math.round(25 + Math.random() * 30) : Math.round(130 + Math.random() * 60);
    const recebido = Math.min(agendado, Math.round(agendado * (0.88 + Math.random() * 0.12)));
    const noShow = Math.max(0, agendado - recebido);

    result.push({
      data: dateStr,
      cd,
      categoria,
      capacidade,
      agendado,
      recebido,
      noShow,
      agendamentoECapacidade: agendado > capacidade,
      agendasSistema: Math.round(agendado * 0.15),
    });
  }

  return result;
}

export const generateMockInboundRecords = generateMockDashboardInbound;

// ============================================================================
// 🎄 SEASONAL PFA DATA
// ============================================================================
export function generateMockPfaData() {
  const semanas = [
    "Week 40", "Week 41", "Week 42", "Week 43",
    "Week 44", "Week 45", "Week 46", "Week 47",
    "Week 48", "Week 49", "Week 50", "Week 51", "Week 52"
  ];
  const cds = Object.keys(CATEGORIAS_POR_CD);

  const generateCategoryRecords = (baseMult: number) => {
    const list: any[] = [];
    cds.forEach(cdStr => {
      const cd = parseInt(cdStr, 10);
      const cats = CATEGORIAS_POR_CD[cdStr] || [];
      cats.forEach(cat => {
        const catHash = cat.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        semanas.forEach((sem, idx) => {
          const seasonality = 1 + (idx * 0.08);
          const baseVolume = ((cd % 10 + 5) * 85 + (catHash % 10 + 4) * 65);
          const planejado = Math.round(baseVolume * baseMult * seasonality);
          const realizado = idx < 6 ? Math.round(planejado * (0.94 + ((idx + cd) % 5) * 0.025)) : 0;
          list.push({
            cd,
            categoria: cat,
            semana: sem,
            planejado,
            realizado,
            desvio: realizado ? realizado - planejado : 0,
          });
        });
      });
    });
    return list;
  };

  return {
    recebimento: generateCategoryRecords(1.2),
    importacao: generateCategoryRecords(0.45),
    faturamento: generateCategoryRecords(1.2),
    transferencia: generateCategoryRecords(0.65),
  };
}

// ============================================================================
// 👥 USERS
// ============================================================================
export interface MockUserRecord {
  id: number;
  name: string;
  login: string;
  email: string;
  role: "admin" | "planner" | "manager";
  status: "ACTIVE" | "PENDING" | "REJECTED";
  dataSolicitacao: string;
}

export const INITIAL_USERS: MockUserRecord[] = [
  {
    id: 1,
    name: "System Administrator",
    login: "admin123",
    email: "admin@mocklogistics.com",
    role: "admin",
    status: "ACTIVE",
    dataSolicitacao: "2025-01-10",
  },
  {
    id: 2,
    name: "Carlos Eduardo - Senior Planner",
    login: "100201",
    email: "carlos.planner@mocklogistics.com",
    role: "planner",
    status: "ACTIVE",
    dataSolicitacao: "2025-02-14",
  },
  {
    id: 3,
    name: "Mariana Silva - Operations Manager",
    login: "200302",
    email: "mariana.manager@mocklogistics.com",
    role: "manager",
    status: "ACTIVE",
    dataSolicitacao: "2025-03-01",
  },
  {
    id: 4,
    name: "Lucas Mendes - Logistics Analyst",
    login: "300403",
    email: "lucas.analyst@mocklogistics.com",
    role: "planner",
    status: "ACTIVE",
    dataSolicitacao: "2025-04-18",
  },
  {
    id: 5,
    name: "Juliana Costa - Regional Planner",
    login: "400504",
    email: "juliana.planner@mocklogistics.com",
    role: "planner",
    status: "PENDING",
    dataSolicitacao: "2026-08-25",
  },
  {
    id: 6,
    name: "Roberto Almeida - Distribution Center Coordinator",
    login: "500605",
    email: "roberto.manager@mocklogistics.com",
    role: "manager",
    status: "PENDING",
    dataSolicitacao: "2026-08-26",
  },
];