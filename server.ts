import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  CATEGORIAS_POR_CD,
  generateMockCapacidades,
  generateMockMetas,
  generateMockPainelEstoque,
  generateMockDashboardInbound,
  generateMockPfaData,
  INITIAL_USERS,
  MockUserRecord
} from "./src/mockData";

// ==========================================================
// 🗄️ IN-MEMORY MOCK DATABASE
// ==========================================================
let dbCapacidades = generateMockCapacidades();
let dbMetasInbound = generateMockMetas("inbound", dbCapacidades);
let dbMetasOutbound = generateMockMetas("outbound", dbCapacidades);
let dbUsuarios: MockUserRecord[] = [...INITIAL_USERS];
let dbPfaData = generateMockPfaData();

// Synchronizes weekly metrics from daily data
function syncMetasFromDaily(ano: number, mes: number, cd: number, categoria: string, semana: number) {
  const prefix = `${ano}-${String(mes).padStart(2, "0")}`;
  const days = dbCapacidades.filter(item => {
    if (!item.dataMovimentacao.startsWith(prefix)) return false;
    if (item.cd !== Number(cd) || item.categoria !== categoria) return false;
    const day = parseInt(item.dataMovimentacao.split("-")[2], 10);
    return Math.ceil(day / 7) === Number(semana);
  });

  const inboundTotal = days.reduce((sum, d) => sum + (d.capacidadeInbound || 0), 0);
  const remunTotal = days.reduce((sum, d) => sum + (d.recebimentoRemunerado || 0), 0);
  const fracTotal = days.reduce((sum, d) => sum + (d.capacidadeOutboundFracionado || 0), 0);
  const fechTotal = days.reduce((sum, d) => sum + (d.capacidadeOutboundFechado || 0), 0);

  // Update or create Inbound Metric
  const inIdx = dbMetasInbound.findIndex(m =>
    m.ano === ano && m.mes === mes && m.cd === Number(cd) && m.categoria === categoria && Number(m.semana) === Number(semana)
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
      recebimentoRemunerado: remunTotal,
    });
  }

  // Update or create Outbound Metric
  const outIdx = dbMetasOutbound.findIndex(m =>
    m.ano === ano && m.mes === mes && m.cd === Number(cd) && m.categoria === categoria && Number(m.semana) === Number(semana)
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
      capacidadeOutboundFechado: fechTotal,
    });
  }
}

// Distributes weekly/monthly metrics to corresponding daily records
function distributeWeeklyToDaily(
  ano: number,
  mes: number,
  cd: number,
  categoria: string,
  semana: number,
  updates: {
    capacidadeInbound?: number;
    recebimentoRemunerado?: number;
    capacidadeFracionada?: number;
    capacidadeFechada?: number;
  }
) {
  const prefix = `${ano}-${String(mes).padStart(2, "0")}`;
  const days = dbCapacidades.filter(item => {
    if (!item.dataMovimentacao.startsWith(prefix)) return false;
    if (item.cd !== Number(cd) || item.categoria !== categoria) return false;
    const day = parseInt(item.dataMovimentacao.split("-")[2], 10);
    return Math.ceil(day / 7) === Number(semana);
  });

  if (days.length === 0) return;

  const numDays = days.length;
  // Weighted distribution based on weekdays vs weekends
  const weights = days.map(d => {
    const parts = d.dataMovimentacao.split("-");
    const dayNum = parseInt(parts[2], 10);
    const dayOfWeek = new Date(ano, mes - 1, dayNum).getDay();
    return (dayOfWeek === 0 || dayOfWeek === 6) ? 0.35 : 1.0;
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  days.forEach((item, idx) => {
    const ratio = weights[idx] / totalWeight;

    if (updates.capacidadeInbound !== undefined) {
      const dailyIn = Math.round(updates.capacidadeInbound * ratio);
      item.capacidadeInbound = dailyIn;
      
      if (updates.capacidadeFracionada === undefined && updates.capacidadeFechada === undefined) {
        const frac = Math.round(dailyIn * 0.58);
        item.capacidadeOutboundFracionado = frac;
        item.capacidadeOutboundFechado = dailyIn - frac;
      }
    }

    if (updates.recebimentoRemunerado !== undefined) {
      item.recebimentoRemunerado = Math.round(updates.recebimentoRemunerado * ratio);
    }

    if (updates.capacidadeFracionada !== undefined) {
      item.capacidadeOutboundFracionado = Math.round(updates.capacidadeFracionada * ratio);
    }

    if (updates.capacidadeFechada !== undefined) {
      item.capacidadeOutboundFechado = Math.round(updates.capacidadeFechada * ratio);
    }

    if (updates.capacidadeInbound === undefined && (updates.capacidadeFracionada !== undefined || updates.capacidadeFechada !== undefined)) {
      item.capacidadeInbound = (item.capacidadeOutboundFracionado || 0) + (item.capacidadeOutboundFechado || 0);
    }
  });

  syncMetasFromDaily(ano, mes, cd, categoria, semana);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS configuration for development
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // ==========================================================
  // 🔐 AUTHENTICATION ENDPOINTS
  // ==========================================================
  app.post("/auth/login", (req, res) => {
    const { login, password } = req.body;
    const loginStr = String(login || "").trim();

    console.log("🔐 [Auth] Login attempt:", { login: loginStr });

    if (!loginStr) {
      return res.status(400).json({ error: "Login is required" });
    }

    // Find user in mock database
    const userFound = dbUsuarios.find(u => u.login === loginStr && u.status === "ACTIVE");

    let role: "admin" | "planner" | "manager" = "planner";
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

    // Simulated JWT token
    const payload = {
      sub: loginStr,
      name,
      role,
      exp: Math.floor(Date.now() / 1000) + 86400 * 7,
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
        role,
      }
    });
  });

  // ==========================================================
  // 👥 USER REGISTRATION AND ACCESS CONTROL
  // ==========================================================
  app.post("/auth/register-request", (req, res) => {
    const { name, login, email, role } = req.body;
    const loginStr = String(login || "").trim();

    if (!loginStr || !name) {
      return res.status(400).json({ error: "Name and login are required." });
    }

    const existing = dbUsuarios.find(u => u.login === loginStr);
    if (existing) {
      return res.status(409).json({ error: "This login is already registered." });
    }

    const newRecord: MockUserRecord = {
      id: dbUsuarios.length + 1,
      name: String(name),
      login: loginStr,
      email: email || `${loginStr}@mocklogistics.com`,
      role: role || "planner",
      status: "PENDING",
      dataSolicitacao: new Date().toISOString().split("T")[0],
    };

    dbUsuarios.push(newRecord);
    console.log("✅ [Mock Registration] New registration request:", newRecord);

    return res.status(201).json(newRecord);
  });

  // Get pending registrations
  app.get("/auth/pending", (req, res) => {
    const pendentes = dbUsuarios.filter(u => u.status === "PENDING");
    return res.json(pendentes);
  });

  // Get active users
  app.get("/auth/users", (req, res) => {
    const aprovados = dbUsuarios.filter(u => u.status === "ACTIVE");
    return res.json(aprovados);
  });

  // Update user status or role
  const handleUpdateUser = (req: any, res: any) => {
    const id = parseInt(req.params.id || req.body.id, 10);
    const { status, role } = req.body;

    const user = dbUsuarios.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (status) user.status = status;
    if (role) user.role = role;

    console.log(`✅ [User Update] User ${id} updated: status=${user.status}, role=${user.role}`);
    return res.json(user);
  };

  app.put("/auth/users/:id", handleUpdateUser);
  app.post("/auth/users/:id", handleUpdateUser);
  app.patch("/auth/users/:id", handleUpdateUser);

  // ==========================================================
  // 📊 DAILY CAPACITY ENDPOINTS
  // ==========================================================
  app.get("/api/capacity", (req, res) => {
    const { cd, year, month } = req.query;
    let filtered = dbCapacidades;

    if (cd && cd !== "all") {
      filtered = filtered.filter(c => c.cd === Number(cd));
    }
    if (year && year !== "all") {
      filtered = filtered.filter(c => c.dataMovimentacao.startsWith(String(year)));
    }
    if (month && month !== "all") {
      const mesStr = String(month).padStart(2, "0");
      filtered = filtered.filter(c => c.dataMovimentacao.split("-")[1] === mesStr);
    }

    return res.json(filtered);
  });

  // Update daily capacity
  app.put("/api/capacity/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const body = req.body;

    const index = dbCapacidades.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Record not found." });
    }

    dbCapacidades[index] = {
      ...dbCapacidades[index],
      ...body,
      id,
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

  // Bulk update
  app.put("/api/capacity/bulk", (req, res) => {
    const body = req.body;
    if (Array.isArray(body)) {
      body.forEach(item => {
        const idx = dbCapacidades.findIndex(c => c.id === item.id);
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
      const idx = dbCapacidades.findIndex(c => c.id === body.id);
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

  // ==========================================================
  // 🎯 INBOUND & OUTBOUND METRICS
  // ==========================================================
  app.get("/api/metrics/inbound", (req, res) => {
    return res.json(dbMetasInbound);
  });

  app.get("/api/metrics/outbound", (req, res) => {
    return res.json(dbMetasOutbound);
  });

  const handleInboundPost = (req: any, res: any) => {
    const body = req.body;
    const { ano, mes, cd, categoria, capacidadeInbound, recebimentoRemunerado, semana } = body;
    const targetSemana = semana !== undefined ? Number(semana) : 1;

    distributeWeeklyToDaily(Number(ano), Number(mes), Number(cd), String(categoria), targetSemana, {
      capacidadeInbound: Number(capacidadeInbound),
      recebimentoRemunerado: Number(recebimentoRemunerado),
    });

    const record = dbMetasInbound.find(m =>
      m.ano === Number(ano) && m.mes === Number(mes) && m.cd === Number(cd) && m.categoria === String(categoria) && Number(m.semana) === targetSemana
    );

    return res.status(201).json(record || body);
  };

  const handleOutboundPost = (req: any, res: any) => {
    const body = req.body;
    const { ano, mes, cd, categoria, capacidadeFracionada, capacidadeFechada, semana } = body;
    const targetSemana = semana !== undefined ? Number(semana) : 1;

    distributeWeeklyToDaily(Number(ano), Number(mes), Number(cd), String(categoria), targetSemana, {
      capacidadeFracionada: Number(capacidadeFracionada),
      capacidadeFechada: Number(capacidadeFechada),
    });

    const record = dbMetasOutbound.find(m =>
      m.ano === Number(ano) && m.mes === Number(mes) && m.cd === Number(cd) && m.categoria === String(categoria) && Number(m.semana) === targetSemana
    );

    return res.status(201).json(record || body);
  };

  app.post("/api/metrics/inbound", handleInboundPost);
  app.post("/api/metrics/outbound", handleOutboundPost);

  app.put("/api/metrics/inbound/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const idx = dbMetasInbound.findIndex(m => m.id === id);
    if (idx !== -1) {
      const updated = { ...dbMetasInbound[idx], ...req.body, id };
      dbMetasInbound[idx] = updated;

      distributeWeeklyToDaily(updated.ano, updated.mes, updated.cd, updated.categoria, updated.semana || 1, {
        capacidadeInbound: Number(updated.capacidadeInbound),
        recebimentoRemunerado: Number(updated.recebimentoRemunerado),
      });

      return res.json(dbMetasInbound[idx]);
    }
    return res.status(404).json({ error: "Metric not found." });
  });

  app.put("/api/metrics/outbound/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const idx = dbMetasOutbound.findIndex(m => m.id === id);
    if (idx !== -1) {
      const updated = { ...dbMetasOutbound[idx], ...req.body, id };
      dbMetasOutbound[idx] = updated;

      distributeWeeklyToDaily(updated.ano, updated.mes, updated.cd, updated.categoria, updated.semana || 1, {
        capacidadeFracionada: Number(updated.capacidadeFracionada),
        capacidadeFechada: Number(updated.capacidadeFechada),
      });

      return res.json(dbMetasOutbound[idx]);
    }
    return res.status(404).json({ error: "Metric not found." });
  });

  // Anticipation metrics
  app.post("/api/metrics/anticipation", (req, res) => {
    const payload = req.body;
    console.log("⚡ [Mock Anticipation] Metric anticipation:", payload);
    return res.json({ success: true, message: "Anticipation processed successfully." });
  });

  // ==========================================================
  // 📈 DASHBOARDS AND ANALYTICS
  // ==========================================================
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

  // Seasonal PFA endpoints
  app.get("/api/dashboard/pfa/receiving", (req, res) => res.json(dbPfaData.recebimento));
  app.get("/api/dashboard/pfa/import", (req, res) => res.json(dbPfaData.importacao));
  app.get("/api/dashboard/pfa/billing", (req, res) => res.json(dbPfaData.faturamento));
  app.get("/api/dashboard/pfa/transfer", (req, res) => res.json(dbPfaData.transferencia));

  // Reset database
  app.post("/api/reset", (req, res) => {
    dbCapacidades = generateMockCapacidades();
    dbMetasInbound = generateMockMetas("inbound");
    dbMetasOutbound = generateMockMetas("outbound");
    dbUsuarios = [...INITIAL_USERS];
    dbPfaData = generateMockPfaData();
    console.log("🔄 [Mock Reset] Database reset successfully!");
    return res.json({ message: "Mock database reset successfully!" });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "Mock Server" });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Mock Logistics Server running at http://localhost:${PORT}`);
  });
}

startServer();