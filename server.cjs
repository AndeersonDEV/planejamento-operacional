var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/mockData.ts
var CATEGORIAS_POR_CD = {
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
function generateMockCapacidades() {
  const result = [];
  let currentId = 1;
  const years = [2025, 2026, 2027];
  Object.entries(CATEGORIAS_POR_CD).forEach(([cdStr, categorias]) => {
    const cd = parseInt(cdStr, 10);
    years.forEach((year) => {
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
            let capInbound = Math.round(baseMultiplier * catMultiplier * (0.88 + (day + month) % 7 * 0.04));
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
              recebimentoRemunerado: recRemun
            });
          });
        }
      }
    });
  });
  return result;
}
function generateMockMetas(type, baseCapacidades) {
  const caps = baseCapacidades || generateMockCapacidades();
  const result = [];
  let currentId = 1;
  const grouped = {};
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
        fechTotal: 0
      };
    }
    grouped[key].inboundTotal += item.capacidadeInbound || 0;
    grouped[key].remunTotal += item.recebimentoRemunerado || 0;
    grouped[key].fracTotal += item.capacidadeOutboundFracionado || 0;
    grouped[key].fechTotal += item.capacidadeOutboundFechado || 0;
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
        recebimentoRemunerado: group.remunTotal > 0 ? group.remunTotal : Math.round(group.inboundTotal * 0.15)
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
        capacidadeOutboundFechado: group.fechTotal
      });
    }
  });
  return result;
}
function generateMockPainelEstoque(cd) {
  const cdStr = String(cd);
  const categorias = CATEGORIAS_POR_CD[cdStr] || CATEGORIAS_POR_CD["101"];
  const hoje = /* @__PURE__ */ new Date();
  return categorias.map((subCategoria, catIdx) => {
    const catHash = subCategoria.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const totalPosicoes = 2800 + (cd * 17 + catHash * 19) % 3200;
    const baseOcupacao = 0.62 + cd % 5 * 0.03 + catIdx % 4 * 0.04;
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
        origem: "REAL",
        qtdPosicoes: totalPosicoes,
        qtdOcupada: ocupada,
        percentualOcupacao: Math.round(pct * 1e3) / 1e3
      });
    }
    const projecao = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const trend = i * 7e-3 + Math.cos((i + catIdx) * 0.5) * 0.03;
      const pct = Math.min(0.97, Math.max(0.5, baseOcupacao + 0.01 + trend));
      const ocupada = Math.round(totalPosicoes * pct);
      projecao.push({
        data: dateStr,
        origem: "PROJECTED",
        qtdPosicoes: totalPosicoes,
        qtdOcupada: ocupada,
        percentualOcupacao: Math.round(pct * 1e3) / 1e3
      });
    }
    return {
      cd,
      categoria: subCategoria,
      subCategoria,
      historico,
      projecao
    };
  });
}
function generateMockDashboardInbound(cd = 101, categoria = "Dry Foods") {
  const result = [];
  const hoje = /* @__PURE__ */ new Date();
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
      agendasSistema: Math.round(agendado * 0.15)
    });
  }
  return result;
}
function generateMockPfaData() {
  const semanas = [
    "Week 40",
    "Week 41",
    "Week 42",
    "Week 43",
    "Week 44",
    "Week 45",
    "Week 46",
    "Week 47",
    "Week 48",
    "Week 49",
    "Week 50",
    "Week 51",
    "Week 52"
  ];
  const cds = Object.keys(CATEGORIAS_POR_CD);
  const generateCategoryRecords = (baseMult) => {
    const list = [];
    cds.forEach((cdStr) => {
      const cd = parseInt(cdStr, 10);
      const cats = CATEGORIAS_POR_CD[cdStr] || [];
      cats.forEach((cat) => {
        const catHash = cat.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        semanas.forEach((sem, idx) => {
          const seasonality = 1 + idx * 0.08;
          const baseVolume = (cd % 10 + 5) * 85 + (catHash % 10 + 4) * 65;
          const planejado = Math.round(baseVolume * baseMult * seasonality);
          const realizado = idx < 6 ? Math.round(planejado * (0.94 + (idx + cd) % 5 * 0.025)) : 0;
          list.push({
            cd,
            categoria: cat,
            semana: sem,
            planejado,
            realizado,
            desvio: realizado ? realizado - planejado : 0
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
    transferencia: generateCategoryRecords(0.65)
  };
}
var INITIAL_USERS = [
  {
    id: 1,
    name: "System Administrator",
    login: "admin123",
    email: "admin@mocklogistics.com",
    role: "admin",
    status: "ACTIVE",
    dataSolicitacao: "2025-01-10"
  },
  {
    id: 2,
    name: "Carlos Eduardo - Senior Planner",
    login: "100201",
    email: "carlos.planner@mocklogistics.com",
    role: "planner",
    status: "ACTIVE",
    dataSolicitacao: "2025-02-14"
  },
  {
    id: 3,
    name: "Mariana Silva - Operations Manager",
    login: "200302",
    email: "mariana.manager@mocklogistics.com",
    role: "manager",
    status: "ACTIVE",
    dataSolicitacao: "2025-03-01"
  },
  {
    id: 4,
    name: "Lucas Mendes - Logistics Analyst",
    login: "300403",
    email: "lucas.analyst@mocklogistics.com",
    role: "planner",
    status: "ACTIVE",
    dataSolicitacao: "2025-04-18"
  },
  {
    id: 5,
    name: "Juliana Costa - Regional Planner",
    login: "400504",
    email: "juliana.planner@mocklogistics.com",
    role: "planner",
    status: "PENDING",
    dataSolicitacao: "2026-08-25"
  },
  {
    id: 6,
    name: "Roberto Almeida - Distribution Center Coordinator",
    login: "500605",
    email: "roberto.manager@mocklogistics.com",
    role: "manager",
    status: "PENDING",
    dataSolicitacao: "2026-08-26"
  }
];

// server.ts
var dbCapacidades = generateMockCapacidades();
var dbMetasInbound = generateMockMetas("inbound", dbCapacidades);
var dbMetasOutbound = generateMockMetas("outbound", dbCapacidades);
var dbUsuarios = [...INITIAL_USERS];
var dbPfaData = generateMockPfaData();
function syncMetasFromDaily(ano, mes, cd, categoria, semana) {
  const prefix = `${ano}-${String(mes).padStart(2, "0")}`;
  const days = dbCapacidades.filter((item) => {
    if (!item.dataMovimentacao.startsWith(prefix)) return false;
    if (item.cd !== Number(cd) || item.categoria !== categoria) return false;
    const day = parseInt(item.dataMovimentacao.split("-")[2], 10);
    return Math.ceil(day / 7) === Number(semana);
  });
  const inboundTotal = days.reduce((sum, d) => sum + (d.capacidadeInbound || 0), 0);
  const remunTotal = days.reduce((sum, d) => sum + (d.recebimentoRemunerado || 0), 0);
  const fracTotal = days.reduce((sum, d) => sum + (d.capacidadeOutboundFracionado || 0), 0);
  const fechTotal = days.reduce((sum, d) => sum + (d.capacidadeOutboundFechado || 0), 0);
  const inIdx = dbMetasInbound.findIndex(
    (m) => m.ano === ano && m.mes === mes && m.cd === Number(cd) && m.categoria === categoria && Number(m.semana) === Number(semana)
  );
  if (inIdx !== -1) {
    dbMetasInbound[inIdx].capacidadeInbound = inboundTotal;
    dbMetasInbound[inIdx].recebimentoRemunerado = remunTotal;
  } else {
    dbMetasInbound.push({
      id: dbMetasInbound.length + 1,
      ano,
      mes,
      cd: Number(cd),
      categoria,
      semana: Number(semana),
      capacidadeInbound: inboundTotal,
      recebimentoRemunerado: remunTotal
    });
  }
  const outIdx = dbMetasOutbound.findIndex(
    (m) => m.ano === ano && m.mes === mes && m.cd === Number(cd) && m.categoria === categoria && Number(m.semana) === Number(semana)
  );
  if (outIdx !== -1) {
    dbMetasOutbound[outIdx].capacidadeOutboundFracionado = fracTotal;
    dbMetasOutbound[outIdx].capacidadeOutboundFechado = fechTotal;
  } else {
    dbMetasOutbound.push({
      id: dbMetasOutbound.length + 1,
      ano,
      mes,
      cd: Number(cd),
      categoria,
      semana: Number(semana),
      capacidadeOutboundFracionado: fracTotal,
      capacidadeOutboundFechado: fechTotal
    });
  }
}
function distributeWeeklyToDaily(ano, mes, cd, categoria, semana, updates) {
  const prefix = `${ano}-${String(mes).padStart(2, "0")}`;
  const days = dbCapacidades.filter((item) => {
    if (!item.dataMovimentacao.startsWith(prefix)) return false;
    if (item.cd !== Number(cd) || item.categoria !== categoria) return false;
    const day = parseInt(item.dataMovimentacao.split("-")[2], 10);
    return Math.ceil(day / 7) === Number(semana);
  });
  if (days.length === 0) return;
  const numDays = days.length;
  const weights = days.map((d) => {
    const parts = d.dataMovimentacao.split("-");
    const dayNum = parseInt(parts[2], 10);
    const dayOfWeek = new Date(ano, mes - 1, dayNum).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6 ? 0.35 : 1;
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  days.forEach((item, idx) => {
    const ratio = weights[idx] / totalWeight;
    if (updates.capacidadeInbound !== void 0) {
      const dailyIn = Math.round(updates.capacidadeInbound * ratio);
      item.capacidadeInbound = dailyIn;
      if (updates.capacidadeFracionada === void 0 && updates.capacidadeFechada === void 0) {
        const frac = Math.round(dailyIn * 0.58);
        item.capacidadeOutboundFracionado = frac;
        item.capacidadeOutboundFechado = dailyIn - frac;
      }
    }
    if (updates.recebimentoRemunerado !== void 0) {
      item.recebimentoRemunerado = Math.round(updates.recebimentoRemunerado * ratio);
    }
    if (updates.capacidadeFracionada !== void 0) {
      item.capacidadeOutboundFracionado = Math.round(updates.capacidadeFracionada * ratio);
    }
    if (updates.capacidadeFechada !== void 0) {
      item.capacidadeOutboundFechado = Math.round(updates.capacidadeFechada * ratio);
    }
    if (updates.capacidadeInbound === void 0 && (updates.capacidadeFracionada !== void 0 || updates.capacidadeFechada !== void 0)) {
      item.capacidadeInbound = (item.capacidadeOutboundFracionado || 0) + (item.capacidadeOutboundFechado || 0);
    }
  });
  syncMetasFromDaily(ano, mes, cd, categoria, semana);
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.post("/auth/login", (req, res) => {
    const { login, password } = req.body;
    const loginStr = String(login || "").trim();
    console.log("\u{1F510} [Auth] Login attempt:", { login: loginStr });
    if (!loginStr) {
      return res.status(400).json({ error: "Login is required" });
    }
    const userFound = dbUsuarios.find((u) => u.login === loginStr && u.status === "ACTIVE");
    let role = "planner";
    let name = "Standard User";
    if (userFound) {
      role = userFound.role;
      name = userFound.name;
    } else if (loginStr === "admin123") {
      role = "admin";
      name = "System Administrator";
    } else if (loginStr.startsWith("1")) {
      role = "planner";
      name = `Planner (${loginStr})`;
    } else if (loginStr.startsWith("2")) {
      role = "manager";
      name = `Manager (${loginStr})`;
    } else {
      role = "planner";
      name = `User (${loginStr})`;
    }
    const payload = {
      sub: loginStr,
      name,
      role,
      exp: Math.floor(Date.now() / 1e3) + 86400 * 7
    };
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const dummySignature = "mock_sig_" + Buffer.from(loginStr).toString("hex");
    const token = `${header}.${body}.${dummySignature}`;
    return res.json({
      token,
      user: {
        username: loginStr,
        name,
        role
      }
    });
  });
  app.post("/auth/register-request", (req, res) => {
    const { name, login, email, role } = req.body;
    const loginStr = String(login || "").trim();
    if (!loginStr || !name) {
      return res.status(400).json({ error: "Name and login are required." });
    }
    const existing = dbUsuarios.find((u) => u.login === loginStr);
    if (existing) {
      return res.status(409).json({ error: "This login is already registered." });
    }
    const newRecord = {
      id: dbUsuarios.length + 1,
      name: String(name),
      login: loginStr,
      email: email || `${loginStr}@mocklogistics.com`,
      role: role || "planner",
      status: "PENDING",
      dataSolicitacao: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    dbUsuarios.push(newRecord);
    console.log("\u2705 [Mock Registration] New registration request:", newRecord);
    return res.status(201).json(newRecord);
  });
  app.get("/auth/pending", (req, res) => {
    const pendentes = dbUsuarios.filter((u) => u.status === "PENDING");
    return res.json(pendentes);
  });
  app.get("/auth/users", (req, res) => {
    const aprovados = dbUsuarios.filter((u) => u.status === "ACTIVE");
    return res.json(aprovados);
  });
  const handleUpdateUser = (req, res) => {
    const id = parseInt(req.params.id || req.body.id, 10);
    const { status, role } = req.body;
    const user = dbUsuarios.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (status) user.status = status;
    if (role) user.role = role;
    console.log(`\u2705 [User Update] User ${id} updated: status=${user.status}, role=${user.role}`);
    return res.json(user);
  };
  app.put("/auth/users/:id", handleUpdateUser);
  app.post("/auth/users/:id", handleUpdateUser);
  app.patch("/auth/users/:id", handleUpdateUser);
  app.get("/api/capacity", (req, res) => {
    const { cd, year, month } = req.query;
    let filtered = dbCapacidades;
    if (cd && cd !== "all") {
      filtered = filtered.filter((c) => c.cd === Number(cd));
    }
    if (year && year !== "all") {
      filtered = filtered.filter((c) => c.dataMovimentacao.startsWith(String(year)));
    }
    if (month && month !== "all") {
      const mesStr = String(month).padStart(2, "0");
      filtered = filtered.filter((c) => c.dataMovimentacao.split("-")[1] === mesStr);
    }
    return res.json(filtered);
  });
  app.put("/api/capacity/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const body = req.body;
    const index = dbCapacidades.findIndex((c) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Record not found." });
    }
    dbCapacidades[index] = {
      ...dbCapacidades[index],
      ...body,
      id
    };
    const item = dbCapacidades[index];
    const parts = item.dataMovimentacao.split("-");
    const ano = parseInt(parts[0], 10);
    const mes = parseInt(parts[1], 10);
    const dia = parseInt(parts[2], 10);
    const semana = Math.ceil(dia / 7);
    syncMetasFromDaily(ano, mes, item.cd, item.categoria, semana);
    return res.json(dbCapacidades[index]);
  });
  app.put("/api/capacity/bulk", (req, res) => {
    const body = req.body;
    if (Array.isArray(body)) {
      body.forEach((item) => {
        const idx = dbCapacidades.findIndex((c) => c.id === item.id);
        if (idx !== -1) {
          dbCapacidades[idx] = { ...dbCapacidades[idx], ...item };
          const parts = dbCapacidades[idx].dataMovimentacao.split("-");
          const ano = parseInt(parts[0], 10);
          const mes = parseInt(parts[1], 10);
          const dia = parseInt(parts[2], 10);
          const semana = Math.ceil(dia / 7);
          syncMetasFromDaily(ano, mes, dbCapacidades[idx].cd, dbCapacidades[idx].categoria, semana);
        }
      });
      return res.json({ success: true, count: body.length });
    } else if (body.id) {
      const idx = dbCapacidades.findIndex((c) => c.id === body.id);
      if (idx !== -1) {
        dbCapacidades[idx] = { ...dbCapacidades[idx], ...body };
        const parts = dbCapacidades[idx].dataMovimentacao.split("-");
        const ano = parseInt(parts[0], 10);
        const mes = parseInt(parts[1], 10);
        const dia = parseInt(parts[2], 10);
        const semana = Math.ceil(dia / 7);
        syncMetasFromDaily(ano, mes, dbCapacidades[idx].cd, dbCapacidades[idx].categoria, semana);
        return res.json(dbCapacidades[idx]);
      }
    }
    return res.json({ success: true });
  });
  app.get("/api/metrics/inbound", (req, res) => {
    return res.json(dbMetasInbound);
  });
  app.get("/api/metrics/outbound", (req, res) => {
    return res.json(dbMetasOutbound);
  });
  const handleInboundPost = (req, res) => {
    const body = req.body;
    const { ano, mes, cd, categoria, capacidadeInbound, recebimentoRemunerado, semana } = body;
    const targetSemana = semana !== void 0 ? Number(semana) : 1;
    distributeWeeklyToDaily(Number(ano), Number(mes), Number(cd), String(categoria), targetSemana, {
      capacidadeInbound: Number(capacidadeInbound),
      recebimentoRemunerado: Number(recebimentoRemunerado)
    });
    const record = dbMetasInbound.find(
      (m) => m.ano === Number(ano) && m.mes === Number(mes) && m.cd === Number(cd) && m.categoria === String(categoria) && Number(m.semana) === targetSemana
    );
    return res.status(201).json(record || body);
  };
  const handleOutboundPost = (req, res) => {
    const body = req.body;
    const { ano, mes, cd, categoria, capacidadeFracionada, capacidadeFechada, semana } = body;
    const targetSemana = semana !== void 0 ? Number(semana) : 1;
    distributeWeeklyToDaily(Number(ano), Number(mes), Number(cd), String(categoria), targetSemana, {
      capacidadeFracionada: Number(capacidadeFracionada),
      capacidadeFechada: Number(capacidadeFechada)
    });
    const record = dbMetasOutbound.find(
      (m) => m.ano === Number(ano) && m.mes === Number(mes) && m.cd === Number(cd) && m.categoria === String(categoria) && Number(m.semana) === targetSemana
    );
    return res.status(201).json(record || body);
  };
  app.post("/api/metrics/inbound", handleInboundPost);
  app.post("/api/metrics/outbound", handleOutboundPost);
  app.put("/api/metrics/inbound/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const idx = dbMetasInbound.findIndex((m) => m.id === id);
    if (idx !== -1) {
      const updated = { ...dbMetasInbound[idx], ...req.body, id };
      dbMetasInbound[idx] = updated;
      distributeWeeklyToDaily(updated.ano, updated.mes, updated.cd, updated.categoria, updated.semana || 1, {
        capacidadeInbound: Number(updated.capacidadeInbound),
        recebimentoRemunerado: Number(updated.recebimentoRemunerado)
      });
      return res.json(dbMetasInbound[idx]);
    }
    return res.status(404).json({ error: "Metric not found." });
  });
  app.put("/api/metrics/outbound/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const idx = dbMetasOutbound.findIndex((m) => m.id === id);
    if (idx !== -1) {
      const updated = { ...dbMetasOutbound[idx], ...req.body, id };
      dbMetasOutbound[idx] = updated;
      distributeWeeklyToDaily(updated.ano, updated.mes, updated.cd, updated.categoria, updated.semana || 1, {
        capacidadeFracionada: Number(updated.capacidadeFracionada),
        capacidadeFechada: Number(updated.capacidadeFechada)
      });
      return res.json(dbMetasOutbound[idx]);
    }
    return res.status(404).json({ error: "Metric not found." });
  });
  app.post("/api/metrics/anticipation", (req, res) => {
    const payload = req.body;
    console.log("\u26A1 [Mock Anticipation] Metric anticipation:", payload);
    return res.json({ success: true, message: "Anticipation processed successfully." });
  });
  app.get("/api/dashboard/inbound", (req, res) => {
    const cd = Number(req.query.cd || 101);
    const categoria = String(req.query.categoria || "Dry Foods");
    const data = generateMockDashboardInbound(cd, categoria);
    return res.json(data);
  });
  app.get("/api/dashboard/stock-panel", (req, res) => {
    const cd = Number(req.query.cd || 101);
    const data = generateMockPainelEstoque(cd);
    return res.json(data);
  });
  app.get("/api/dashboard/pfa/receiving", (req, res) => res.json(dbPfaData.recebimento));
  app.get("/api/dashboard/pfa/import", (req, res) => res.json(dbPfaData.importacao));
  app.get("/api/dashboard/pfa/billing", (req, res) => res.json(dbPfaData.faturamento));
  app.get("/api/dashboard/pfa/transfer", (req, res) => res.json(dbPfaData.transferencia));
  app.post("/api/reset", (req, res) => {
    dbCapacidades = generateMockCapacidades();
    dbMetasInbound = generateMockMetas("inbound");
    dbMetasOutbound = generateMockMetas("outbound");
    dbUsuarios = [...INITIAL_USERS];
    dbPfaData = generateMockPfaData();
    console.log("\u{1F504} [Mock Reset] Database reset successfully!");
    return res.json({ message: "Mock database reset successfully!" });
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "Mock Server" });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} Mock Logistics Server running at http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
