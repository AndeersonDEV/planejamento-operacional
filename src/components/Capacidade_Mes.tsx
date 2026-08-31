import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { toBlob, toPng } from "html-to-image";
import {
  Building, Edit2, RefreshCw, X, Info, Package, Sparkles,
  Layers, Tag, CheckCircle, Truck, AlertCircle, Search, MapPin, SlidersHorizontal, Calendar,
  ChevronRight, ChevronDown, Plus, FileSpreadsheet, Presentation, Copy, Check, Download, Mail, Image
} from "lucide-react";
import { User } from "../types";
import { CATEGORIAS_POR_CD, CDS_LIST, generateMockMetas } from "../mockData";

interface CapacidadeMesProps {
  currentUser: User;
  showNotification: (msg: string) => void;
}

const CD_LIST = CDS_LIST.map(c => ({ cd: String(c.id), group: c.name.includes("(") ? c.name.split("(")[1].replace(")", "") : "CD " + c.id }));

// API endpoints - using mock server routes
const API_INBOUND = '/api/metrics/inbound';
const API_OUTBOUND = '/api/metrics/outbound';

const MESES: Record<string, string> = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec" };
const fM = (m: number) => { const n: Record<number, string> = { 1: "JAN", 2: "FEB", 3: "MAR", 4: "APR", 5: "MAY", 6: "JUN", 7: "JUL", 8: "AUG", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DEC" }; return n[m] || `M${m}`; };

const getMonthLabel = (m: number) => {
  const labels: Record<number, string> = {
    1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
    7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
  };
  return labels[m] || `Month ${m}`;
};

const getWeeksInMonth = (year: number, month: number) => {
  const totalDays = new Date(year, month, 0).getDate();
  return Math.ceil(totalDays / 7);
};

export default function Capacidade_Mes({ currentUser, showNotification }: CapacidadeMesProps) {
  const [metas, setMetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState<string | null>(null);
  const [ano, setAno] = useState("Todos");
  const [mes, setMes] = useState("Todos");
  const [cat, setCat] = useState("Todas");
  const [cd, setCd] = useState("Todos");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "frac" | "fech">("all");
  const [edit, setEdit] = useState<any>(null);
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [inboundView, setInboundView] = useState<"mes" | "semana">("mes");
  const [selectedMonthInbound, setSelectedMonthInbound] = useState<number>(7);
  const [expandedMonths, setExpandedMonths] = useState<number[]>([]);
  const [showKpis, setShowKpis] = useState(true);

  // States for bulk launching modals
  const [bulkModal, setBulkModal] = useState<"inbound" | "outbound" | null>(null);
  const [bulkAno, setBulkAno] = useState<number>(2026);
  const [bulkMes, setBulkMes] = useState<number>(7);
  const [bulkCd, setBulkCd] = useState<number>(101);
  const [bulkCategoria, setBulkCategoria] = useState<string>("Dry Foods");
  const [bulkCapInbound, setBulkCapInbound] = useState<string>("");
  const [bulkCapInboundWeeks, setBulkCapInboundWeeks] = useState<Record<number, string>>({});
  const [replicateValue, setReplicateValue] = useState<string>("");
  const [bulkSemanaInbound, setBulkSemanaInbound] = useState<number>(0);
  const [bulkSelectedWeeks, setBulkSelectedWeeks] = useState<number[]>([]);
  const [bulkCapFracionada, setBulkCapFracionada] = useState<string>("");
  const [bulkCapFechada, setBulkCapFechada] = useState<string>("");

  const [expandedOutboundCds, setExpandedOutboundCds] = useState<Record<string, boolean>>({});
  const [expandedInboundCds, setExpandedInboundCds] = useState<Record<string, boolean>>({});
  const [useBulkStartDate, setUseBulkStartDate] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [useEditStartDate, setUseEditStartDate] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState<boolean>(false);
  const [lastSavedInfo, setLastSavedInfo] = useState<string>("");

  // States for Pending Fracionado Modal & Fill
  const [pendingFracModal, setPendingFracModal] = useState<{
    month: number;
    items: { cd: string; group: string; cat: string; currentVal: number; id: number | null }[];
  } | null>(null);

  const [selectedFracItem, setSelectedFracItem] = useState<{
    month: number;
    cd: string;
    cat: string;
    group: string;
    id: number | null;
    currentVal: number;
  } | null>(null);

  const [fracValueInput, setFracValueInput] = useState<string>("");
  const [fracSaving, setFracSaving] = useState<boolean>(false);
  const [fracError, setFracError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // States for Presentation Modal
  const [showPresentationModal, setShowPresentationModal] = useState<boolean>(false);
  const [presentationType, setPresentationType] = useState<"inbound" | "outbound" | "both">("inbound");
  const [presentationMessage, setPresentationMessage] = useState<string>("Good morning, here are the inbound and outbound data:");
  const [copiedPresentation, setCopiedPresentation] = useState<boolean>(false);
  const [copyingImage, setCopyingImage] = useState<boolean>(false);
  const [copiedImageStatus, setCopiedImageStatus] = useState<string | null>(null);
  const presentationRef = useRef<HTMLDivElement>(null);

  // States for Excel Export Modal
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [excelAno, setExcelAno] = useState<string>("Todos");
  const [excelMes, setExcelMes] = useState<string>("Todos");
  const [excelCd, setExcelCd] = useState<string>("Todos");
  const [excelCat, setExcelCat] = useState<string>("Todas");
  const [excelDirection, setExcelDirection] = useState<"inbound" | "outbound" | "both">("both");

  // States for Anticipation Modal
  const [showAntecipacaoModal, setShowAntecipacaoModal] = useState<boolean>(false);
  const [antecipacaoCd, setAntecipacaoCd] = useState<number>(101);
  const [antecipacaoCategoria, setAntecipacaoCategoria] = useState<string>("Dry Foods");
  const [antecipacaoDataInicio, setAntecipacaoDataInicio] = useState<string>("");
  const [antecipacaoDataFim, setAntecipacaoDataFim] = useState<string>("");
  const [antecipacaoQtd, setAntecipacaoQtd] = useState<string>("");
  const [antecipacaoSaving, setAntecipacaoSaving] = useState<boolean>(false);
  const [antecipacaoError, setAntecipacaoError] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = currentUser.role === "admin";

  // ============================================================
  // GET PENDING FRACIONADO FOR MONTH
  // ============================================================
  const getPendingFracionadoForMonth = (m: number, yearNum: number = 2026) => {
    const pending: { cd: string; group: string; cat: string; currentVal: number; id: number | null }[] = [];
    
    CD_LIST.forEach(cdItem => {
      const categories = CATEGORIAS_POR_CD[cdItem.cd] || ["Dry Foods"];
      categories.forEach(categoria => {
        const matchingMeta = metas.find(meta => 
          String(meta.cd) === cdItem.cd &&
          meta.categoria === categoria &&
          Number(meta.mes) === m &&
          Number(meta.ano || 2026) === yearNum
        );

        const val = matchingMeta?.capacidadeFracionada || 0;
        if (!matchingMeta || val === 0) {
          pending.push({
            cd: cdItem.cd,
            group: cdItem.group,
            cat: categoria,
            currentVal: val,
            id: matchingMeta?.id || null
          });
        }
      });
    });

    return pending;
  };

  const saveSingleFracionado = async () => {
    if (!isAdmin) {
      notify("⛔ Only administrators can change capacities!");
      return;
    }
    if (!selectedFracItem) return;

    const numVal = parseInt(fracValueInput.replace(/\D/g, ""), 10);
    if (isNaN(numVal) || numVal < 0) {
      setFracError("Please enter a valid numeric value.");
      return;
    }

    setFracSaving(true);
    setFracError(null);

    try {
      const { month, cd, cat, id } = selectedFracItem;
      const targetAno = ano !== "Todos" ? Number(ano) : 2026;

      const existingRecord = metas.find(m =>
        String(m.cd) === String(cd) &&
        m.categoria === cat &&
        Number(m.mes) === month &&
        Number(m.ano || 2026) === targetAno
      );

      const body: any = {
        ano: targetAno,
        mes: month,
        cd: Number(cd),
        categoria: cat,
        semana: 1,
        capacidadeFracionada: numVal,
        capacidadeFechada: existingRecord?.capacidadeFechada || 0
      };

      const method = id ? "PUT" : "POST";
      const url = id ? `${API_OUTBOUND}/${id}` : API_OUTBOUND;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUser?.token) {
        headers["Authorization"] = `Bearer ${currentUser.token}`;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setFracError(errData.error || `HTTP ${res.status}`);
        setFracSaving(false);
        return;
      }

      notify(`✅ Fracionado saved!`);
      showNotification(`CD ${cd} (${cat}) updated to ${numVal.toLocaleString("pt-BR")} units.`);
      
      await load(true);

      const updatedPending = getPendingFracionadoForMonth(month, targetAno)
        .filter(p => !(p.cd === cd && p.cat === cat));

      setSelectedFracItem(null);
      setFracValueInput("");

      if (updatedPending.length > 0) {
        setPendingFracModal({ month, items: updatedPending });
      } else {
        setPendingFracModal(null);
      }
    } catch (err: any) {
      console.error("Error saving fracionado:", err);
      setFracError("Connection error saving fracionado.");
    } finally {
      setFracSaving(false);
    }
  };

  // ============================================================
  // LOAD DATA - CORRIGIDO PARA POPULAR COM DADOS REAIS
  // ============================================================
  const load = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const endpoint = direction === "outbound" ? API_OUTBOUND : API_INBOUND;
      console.log('🔄 Loading:', endpoint);
      
      const headers: Record<string, string> = {};
      if (currentUser?.token) {
        headers["Authorization"] = `Bearer ${currentUser.token}`;
      }
      
      const r = await fetch(endpoint, { headers });
      
      if (r.ok) {
        const data = await r.json();
        console.log('✅ Data received:', data.length, 'records');
        
        // Se não houver dados, gera dados mock
        let dataToUse = data;
        if (!data || data.length === 0) {
          console.log('⚠️ No data from API, generating mock data');
          dataToUse = generateMockMetas(direction === "outbound" ? "outbound" : "inbound");
        }
        
        const mappedData = dataToUse.map((item: any) => ({
          id: item.id,
          ano: item.ano || 2026,
          mes: item.mes || 7,
          semana: item.semana || 1,
          cd: item.cd,
          categoria: item.categoria,
          capacidadeInbound: item.capacidadeInbound || 0,
          capacidadeFracionada: item.capacidadeFracionada || 0,
          capacidadeFechada: item.capacidadeFechada || 0,
        }));
        
        setMetas(mappedData);
        console.log('📊 Mapped data:', mappedData.length, 'records');
        
        // Atualiza meses disponíveis
        if (mappedData.length > 0) {
          const available = Array.from(new Set(mappedData.map(m => m.mes))).filter(Boolean).map(Number);
          if (available.length > 0 && direction === "inbound") {
            setSelectedMonthInbound(available[0]);
          }
        }
      } else {
        console.warn('⚠️ API returned error, using mock fallback');
        const fallback = generateMockMetas(direction === "outbound" ? "outbound" : "inbound");
        setMetas(fallback);
      }
    } catch (e) {
      console.warn("⚠️ API offline, using mock generator:", e);
      const fallback = generateMockMetas(direction === "outbound" ? "outbound" : "inbound");
      setMetas(fallback);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ✅ Load data on mount and when direction changes
  useEffect(() => {
    load();
  }, [direction]);

  // ✅ Update available months when metas change
  useEffect(() => {
    if (metas.length > 0 && direction === "inbound") {
      const available = Array.from(new Set(metas.map(m => m.mes))).filter(Boolean).map(Number);
      if (available.length > 0 && !available.includes(selectedMonthInbound)) {
        setSelectedMonthInbound(available[0]);
      }
    }
  }, [metas, direction]);

  const notify = (m: string) => { setNotif(m); setTimeout(() => setNotif(null), 2000); };
  const fmt = (v: number) => v.toLocaleString("pt-BR");

  const anosL = useMemo(() => { const s = new Set<string>(); metas.forEach(m => { if (m.ano) s.add(String(m.ano)); }); return ["Todos", ...Array.from(s).sort()]; }, [metas]);
  const mesesL = useMemo(() => { const s = new Set<string>(); metas.forEach(m => { if (m.mes) s.add(String(m.mes).padStart(2, "0")); }); return ["Todos", ...Array.from(s).sort()]; }, [metas]);
  const catsL = useMemo(() => {
    if (cd === "Todos") {
      const s = new Set<string>();
      metas.forEach(m => { if (m.categoria) s.add(m.categoria); });
      return ["Todas", ...Array.from(s).sort()];
    }
    return ["Todas", ...(CATEGORIAS_POR_CD[cd] || [])];
  }, [metas, cd]);

  const dynMonths = useMemo(() => {
    const s = new Set<number>();
    metas.forEach(m => { if (mes !== "Todos") { if (Number(m.mes) === Number(mes)) s.add(Number(m.mes)); } else { if (m.mes) s.add(Number(m.mes)); } });
    return s.size === 0 ? (mes !== "Todos" ? [Number(mes)] : [7, 8, 9]) : Array.from(s).sort((a, b) => a - b);
  }, [metas, mes]);

  const filt = useMemo(() => metas.filter(m => {
    if (ano !== "Todos" && String(m.ano) !== ano) return false;
    if (mes !== "Todos" && String(m.mes).padStart(2, "0") !== mes) return false;
    if (cat !== "Todas" && m.categoria !== cat) return false;
    if (cd !== "Todos" && String(m.cd) !== cd) return false;
    if (q) { const t = q.toLowerCase(); return String(m.cd).includes(t) || (m.categoria || "").toLowerCase().includes(t); }
    return true;
  }), [metas, ano, mes, cat, cd, q]);

  const activeCDList = useMemo(() => {
    const cdsWithData = new Set(filt.map(m => String(m.cd)));
    let list = CD_LIST.filter(item => cdsWithData.has(item.cd));
    if (cd !== "Todos") {
      list = list.filter(item => String(item.cd) === cd);
    }
    return list;
  }, [cd, filt]);

  const activeCategoriesForCD = useMemo(() => {
    const map: Record<string, string[]> = {};
    CD_LIST.forEach(cdItem => {
      if (cat !== "Todas") {
        map[cdItem.cd] = [cat];
      } else {
        const matchingMetas = filt.filter(m => String(m.cd) === cdItem.cd);
        const uniqueCats = Array.from(new Set(matchingMetas.map(m => m.categoria).filter((v): v is string => typeof v === 'string' && !!v))) as string[];
        map[cdItem.cd] = uniqueCats.sort();
      }
    });
    return map;
  }, [filt, cat]);

  const rows = useMemo(() => {
    const result: any[] = [];
    
    activeCDList.forEach(cdItem => {
      const cdCats = activeCategoriesForCD[cdItem.cd] || ["Dry Foods"];
      
      if (cdCats.length <= 1) {
        const category = cdCats[0] || "Dry Foods";
        const cm = filt.filter(m => String(m.cd) === cdItem.cd && m.categoria === category);
        const md: Record<number, { frac: number; fech: number; inbound: number; id: number | null }> = {};
        const wd: Record<string, { inbound: number; id: number | null }> = {};
        
        dynMonths.forEach(m => {
          const mm = cm.filter(x => Number(x.mes) === m);
          md[m] = {
            frac: mm.reduce((s, x) => s + (x.capacidadeFracionada || 0), 0),
            fech: mm.reduce((s, x) => s + (x.capacidadeFechada || 0), 0),
            inbound: mm.reduce((s, x) => s + (x.capacidadeInbound || 0), 0),
            id: mm.length > 0 ? mm[0].id : null
          };
          
          const numWeeks = getWeeksInMonth(2026, m);
          for (let w = 1; w <= numWeeks; w++) {
            const weekItems = mm.filter(x => (x.semana ? Number(x.semana) : 1) === w);
            wd[`${m}-${w}`] = {
              inbound: weekItems.reduce((s, x) => s + (x.capacidadeInbound || 0), 0),
              id: weekItems.length > 0 ? weekItems[0].id : null
            };
          }
        });
        
        result.push({
          id: cdItem.cd,
          cd: cdItem.cd,
          group: cdItem.group,
          cat: category,
          hasMultipleCategories: false,
          isChild: false,
          md,
          wd
        });
      } else {
        const children: any[] = [];
        const parentMd: Record<number, { frac: number; fech: number; inbound: number; id: number | null }> = {};
        const parentWd: Record<string, { inbound: number; id: number | null }> = {};
        
        dynMonths.forEach(m => {
          parentMd[m] = { frac: 0, fech: 0, inbound: 0, id: null };
          const numWeeks = getWeeksInMonth(2026, m);
          for (let w = 1; w <= numWeeks; w++) {
            parentWd[`${m}-${w}`] = { inbound: 0, id: null };
          }
        });
        
        cdCats.forEach(category => {
          const cm = filt.filter(m => String(m.cd) === cdItem.cd && m.categoria === category);
          const md: Record<number, { frac: number; fech: number; inbound: number; id: number | null }> = {};
          const wd: Record<string, { inbound: number; id: number | null }> = {};
          
          dynMonths.forEach(m => {
            const mm = cm.filter(x => Number(x.mes) === m);
            const frac = mm.reduce((s, x) => s + (x.capacidadeFracionada || 0), 0);
            const fech = mm.reduce((s, x) => s + (x.capacidadeFechada || 0), 0);
            const inbound = mm.reduce((s, x) => s + (x.capacidadeInbound || 0), 0);
            
            md[m] = {
              frac,
              fech,
              inbound,
              id: mm.length > 0 ? mm[0].id : null
            };
            
            parentMd[m].frac += frac;
            parentMd[m].fech += fech;
            parentMd[m].inbound += inbound;
            if (mm.length > 0 && !parentMd[m].id) {
              parentMd[m].id = mm[0].id;
            }
            
            const numWeeks = getWeeksInMonth(2026, m);
            for (let w = 1; w <= numWeeks; w++) {
              const weekItems = mm.filter(x => (x.semana ? Number(x.semana) : 1) === w);
              const wInbound = weekItems.reduce((s, x) => s + (x.capacidadeInbound || 0), 0);
              wd[`${m}-${w}`] = {
                inbound: wInbound,
                id: weekItems.length > 0 ? weekItems[0].id : null
              };
              
              parentWd[`${m}-${w}`].inbound += wInbound;
              if (weekItems.length > 0 && !parentWd[`${m}-${w}`].id) {
                parentWd[`${m}-${w}`].id = weekItems[0].id;
              }
            }
          });
          
          children.push({
            id: `${cdItem.cd}-${category}`,
            cd: cdItem.cd,
            group: cdItem.group,
            cat: category,
            isChild: true,
            parentCd: cdItem.cd,
            md,
            wd
          });
        });
        
        result.push({
          id: cdItem.cd,
          cd: cdItem.cd,
          group: cdItem.group,
          cat: "Todas",
          hasMultipleCategories: true,
          isChild: false,
          md: parentMd,
          wd: parentWd,
          children
        });
      }
    });
    
    return result;
  }, [filt, dynMonths, activeCDList, activeCategoriesForCD]);

  const activeWeeks = useMemo(() => {
    const numWeeks = getWeeksInMonth(2026, selectedMonthInbound);
    return Array.from({ length: numWeeks }, (_, i) => i + 1);
  }, [selectedMonthInbound]);

  const weeklyInboundRows = useMemo(() => {
    const result: any[] = [];
    
    activeCDList.forEach(cdItem => {
      const cdCats = activeCategoriesForCD[cdItem.cd] || ["Dry Foods"];
      
      if (cdCats.length <= 1) {
        const category = cdCats[0] || "Dry Foods";
        const cm = filt.filter(m => String(m.cd) === cdItem.cd && m.categoria === category);
        const mm = cm.filter(x => Number(x.mes) === selectedMonthInbound);
        const wd: Record<number, { inbound: number; id: number | null }> = {};
        
        activeWeeks.forEach(w => {
          const weekItems = mm.filter(x => (x.semana ? Number(x.semana) : 1) === w);
          wd[w] = {
            inbound: weekItems.reduce((s, x) => s + (x.capacidadeInbound || 0), 0),
            id: weekItems.length > 0 ? weekItems[0].id : null
          };
        });
        
        result.push({
          id: cdItem.cd,
          cd: cdItem.cd,
          group: cdItem.group,
          cat: category,
          hasMultipleCategories: false,
          isChild: false,
          wd
        });
      } else {
        const children: any[] = [];
        const parentWd: Record<number, { inbound: number; id: number | null }> = {};
        
        activeWeeks.forEach(w => {
          parentWd[w] = { inbound: 0, id: null };
        });
        
        cdCats.forEach(category => {
          const cm = filt.filter(m => String(m.cd) === cdItem.cd && m.categoria === category);
          const mm = cm.filter(x => Number(x.mes) === selectedMonthInbound);
          const wd: Record<number, { inbound: number; id: number | null }> = {};
          
          activeWeeks.forEach(w => {
            const weekItems = mm.filter(x => (x.semana ? Number(x.semana) : 1) === w);
            const wInbound = weekItems.reduce((s, x) => s + (x.capacidadeInbound || 0), 0);
            wd[w] = {
              inbound: wInbound,
              id: weekItems.length > 0 ? weekItems[0].id : null
            };
            
            parentWd[w].inbound += wInbound;
            if (weekItems.length > 0 && !parentWd[w].id) {
              parentWd[w].id = weekItems[0].id;
            }
          });
          
          children.push({
            id: `${cdItem.cd}-${category}`,
            cd: cdItem.cd,
            group: cdItem.group,
            cat: category,
            isChild: true,
            parentCd: cdItem.cd,
            wd
          });
        });
        
        result.push({
          id: cdItem.cd,
          cd: cdItem.cd,
          group: cdItem.group,
          cat: "Todas",
          hasMultipleCategories: true,
          isChild: false,
          wd: parentWd,
          children
        });
      }
    });
    
    return result;
  }, [filt, selectedMonthInbound, activeWeeks, activeCDList, activeCategoriesForCD]);

  const outboundRows = useMemo(() => {
    const result: any[] = [];
    
    activeCDList.forEach(cdItem => {
      const cdCats = activeCategoriesForCD[cdItem.cd] || ["Dry Foods"];
      
      if (cdCats.length <= 1) {
        const category = cdCats[0] || "Dry Foods";
        const cm = filt.filter(m => String(m.cd) === cdItem.cd && m.categoria === category);
        const md: Record<number, { frac: number; fech: number; id: number | null }> = {};
        
        dynMonths.forEach(m => {
          const mm = cm.filter(x => Number(x.mes) === m);
          md[m] = {
            frac: mm.length > 0 ? Math.max(...mm.map(x => x.capacidadeFracionada || 0)) : 0,
            fech: mm.length > 0 ? Math.max(...mm.map(x => x.capacidadeFechada || 0)) : 0,
            id: mm.length > 0 ? mm[0].id : null
          };
        });
        
        result.push({
          id: cdItem.cd,
          cd: cdItem.cd,
          group: cdItem.group,
          cat: category,
          hasMultipleCategories: false,
          isChild: false,
          md
        });
      } else {
        const children: any[] = [];
        const parentMd: Record<number, { frac: number; fech: number; id: number | null }> = {};
        
        dynMonths.forEach(m => {
          parentMd[m] = { frac: 0, fech: 0, id: null };
        });
        
        cdCats.forEach(category => {
          const cm = filt.filter(m => String(m.cd) === cdItem.cd && m.categoria === category);
          const md: Record<number, { frac: number; fech: number; id: number | null }> = {};
          
          dynMonths.forEach(m => {
            const mm = cm.filter(x => Number(x.mes) === m);
            const frac = mm.length > 0 ? Math.max(...mm.map(x => x.capacidadeFracionada || 0)) : 0;
            const fech = mm.length > 0 ? Math.max(...mm.map(x => x.capacidadeFechada || 0)) : 0;
            
            md[m] = {
              frac,
              fech,
              id: mm.length > 0 ? mm[0].id : null
            };
            
            parentMd[m].frac += frac;
            parentMd[m].fech += fech;
            if (mm.length > 0 && !parentMd[m].id) {
              parentMd[m].id = mm[0].id;
            }
          });
          
          children.push({
            id: `${cdItem.cd}-${category}`,
            cd: cdItem.cd,
            group: cdItem.group,
            cat: category,
            isChild: true,
            parentCd: cdItem.cd,
            md
          });
        });
        
        result.push({
          id: cdItem.cd,
          cd: cdItem.cd,
          group: cdItem.group,
          cat: "Todas",
          hasMultipleCategories: true,
          isChild: false,
          md: parentMd,
          children
        });
      }
    });
    
    return result;
  }, [filt, dynMonths, activeCDList, activeCategoriesForCD]);

  const sp = rows.filter(r => r.group === "SP" && !r.isChild), reg = rows.filter(r => r.group === "REG" && !r.isChild);
  const calcT = (rs: any[], f: "frac" | "fech" | "inbound") => { const t: Record<number, number> = {}; dynMonths.forEach(m => { t[m] = rs.reduce((s, r) => s + (r.md[m]?.[f] || 0), 0); }); return t; };
  
  const spF = calcT(sp, "frac"), regF = calcT(reg, "frac"), gtF: Record<number, number> = {}; dynMonths.forEach(m => { gtF[m] = (spF[m] || 0) + (regF[m] || 0); });
  const spE = calcT(sp, "fech"), regE = calcT(reg, "fech"), gtE: Record<number, number> = {}; dynMonths.forEach(m => { gtE[m] = (spE[m] || 0) + (regE[m] || 0); });
  const spI = calcT(sp, "inbound"), regI = calcT(reg, "inbound"), gtI: Record<number, number> = {}; dynMonths.forEach(m => { gtI[m] = (spI[m] || 0) + (regI[m] || 0); });
  
  const tF = dynMonths.reduce((s, m) => s + (gtF[m] || 0), 0), tE = dynMonths.reduce((s, m) => s + (gtE[m] || 0), 0), tI = dynMonths.reduce((s, m) => s + (gtI[m] || 0), 0);

  // Separate Outbound Subtotals
  const spOutbound = useMemo(() => outboundRows.filter(r => r.group === "SP" && !r.isChild), [outboundRows]);
  const regOutbound = useMemo(() => outboundRows.filter(r => r.group === "REG" && !r.isChild), [outboundRows]);

  const calcTOutbound = (rs: any[], f: "frac" | "fech") => {
    const t: Record<number, number> = {};
    dynMonths.forEach(m => {
      t[m] = rs.reduce((s, r) => s + (r.md[m]?.[f] || 0), 0);
    });
    return t;
  };
  
  const spFOutbound = useMemo(() => calcTOutbound(spOutbound, "frac"), [spOutbound, dynMonths]);
  const regFOutbound = useMemo(() => calcTOutbound(regOutbound, "frac"), [regOutbound, dynMonths]);
  const gtFOutbound = useMemo(() => {
    const t: Record<number, number> = {};
    dynMonths.forEach(m => {
      t[m] = (spFOutbound[m] || 0) + (regFOutbound[m] || 0);
    });
    return t;
  }, [spFOutbound, regFOutbound, dynMonths]);

  const spEOutbound = useMemo(() => calcTOutbound(spOutbound, "fech"), [spOutbound, dynMonths]);
  const regEOutbound = useMemo(() => calcTOutbound(regOutbound, "fech"), [regOutbound, dynMonths]);
  const gtEOutbound = useMemo(() => {
    const t: Record<number, number> = {};
    dynMonths.forEach(m => {
      t[m] = (spEOutbound[m] || 0) + (regEOutbound[m] || 0);
    });
    return t;
  }, [spEOutbound, regEOutbound, dynMonths]);

  const tFOutbound = useMemo(() => dynMonths.reduce((s, m) => s + (gtFOutbound[m] || 0), 0), [gtFOutbound, dynMonths]);
  const tEOutbound = useMemo(() => dynMonths.reduce((s, m) => s + (gtEOutbound[m] || 0), 0), [gtEOutbound, dynMonths]);

  const spWeeklySum = useMemo(() => { const t: Record<number, number> = {}; activeWeeks.forEach(w => { t[w] = weeklyInboundRows.filter(r => r.group === "SP" && !r.isChild).reduce((s, r) => s + (r.wd[w]?.inbound || 0), 0); }); return t; }, [weeklyInboundRows, activeWeeks]);
  const regWeeklySum = useMemo(() => { const t: Record<number, number> = {}; activeWeeks.forEach(w => { t[w] = weeklyInboundRows.filter(r => r.group === "REG" && !r.isChild).reduce((s, r) => s + (r.wd[w]?.inbound || 0), 0); }); return t; }, [weeklyInboundRows, activeWeeks]);
  const gtWeeklySum = useMemo(() => { const t: Record<number, number> = {}; activeWeeks.forEach(w => { t[w] = (spWeeklySum[w] || 0) + (regWeeklySum[w] || 0); }); return t; }, [spWeeklySum, regWeeklySum, activeWeeks]);
  const tWeeklyI = useMemo(() => activeWeeks.reduce((s, w) => s + (gtWeeklySum[w] || 0), 0), [gtWeeklySum, activeWeeks]);

  // ============================================================
  // EDIT FUNCTIONS
  // ============================================================
  const startEdit = (rid: string, tp: "frac" | "fech" | "inbound", m: number, v: number, semana?: number) => {
    if (!isAdmin) { 
      notify("⛔ Only administrators can edit!"); 
      return; 
    }
    const tr = direction === "outbound"
      ? (outboundRows.find(r => r.id === rid) || outboundRows.filter(r => r.children).flatMap(r => r.children).find(c => c.id === rid))
      : (rows.find(r => r.id === rid) || rows.filter(r => r.children).flatMap(r => r.children).find(c => c.id === rid) ||
         weeklyInboundRows.find(r => r.id === rid) || weeklyInboundRows.filter(r => r.children).flatMap(r => r.children).find(c => c.id === rid)); 
    if (!tr) return;
    setEdit({ rid, cd: tr.cd, cat: tr.cat, tp, m, v, nv: "", id: tr.md[m]?.id || null, semana });
    setUseEditStartDate(false);
    setEditStartDate("");
  };

  const save = async () => {
    if (!isAdmin) {
      notify("⛔ Only administrators can save!");
      return;
    }
    if (!edit) return;
    const { tp, nv, cd, cat, m, id, semana } = edit;
    const p = nv.trim() === "" ? 0 : parseInt(nv.replace(/\D/g, ""), 10);
    if (isNaN(p) || p < 0) {
      setEditError("Invalid value.");
      return;
    }
    
    // Check for duplicates
    const isEditDuplicate = useMemo(() => {
      if (!edit || edit.id) return false;
      if (direction === "outbound") {
        return metas.some(m => 
          String(m.cd) === String(edit.cd) && 
          Number(m.mes) === Number(edit.m) && 
          Number(m.ano) === (ano !== "Todos" ? Number(ano) : 2026) &&
          m.categoria === edit.cat &&
          Number(m.semana) === 1
        );
      } else {
        const sem = edit.semana !== undefined ? edit.semana : 1;
        return metas.some(m => 
          String(m.cd) === String(edit.cd) && 
          Number(m.mes) === Number(edit.m) && 
          Number(m.ano) === (ano !== "Todos" ? Number(ano) : 2026) &&
          m.categoria === edit.cat &&
          Number(m.semana) === sem
        );
      }
    }, [edit, metas, direction, ano]);

    if (isEditDuplicate) {
      setEditError("Operation Blocked: Metrics already exist for this CD/Category.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = direction === "inbound" ? API_INBOUND : API_OUTBOUND;
      
      const currentRow = direction === "outbound"
        ? (outboundRows.find(r => r.id === edit.rid) || 
           outboundRows.filter(r => r.children).flatMap(r => r.children).find(c => c.id === edit.rid))
        : rows.find(r => r.id === edit.rid);
      const currentValues = currentRow?.md?.[m];
      
      const body: any = { 
        ano: ano !== "Todos" ? Number(ano) : 2026, 
        mes: m, 
        cd: Number(cd), 
        categoria: cat 
      };
      
      if (direction === "inbound") {
        body.semana = semana !== undefined ? semana : 1;
      } else {
        body.semana = 1;
      }
      
      if (tp === "inbound") { 
        body.capacidadeInbound = p; 
      } else if (tp === "frac") { 
        body.capacidadeFracionada = p; 
        body.capacidadeFechada = currentValues?.fech || 0; 
      } else { 
        body.capacidadeFechada = p;
        body.capacidadeFracionada = currentValues?.frac || 0; 
      }

      const isOutboundStartAt = direction === "outbound" && useEditStartDate && editStartDate;
      if (isOutboundStartAt) {
        body.dataInicio = editStartDate;
      }
      
      const method = id ? "PUT" : "POST";
      const url = id ? `${endpoint}/${id}` : endpoint;
      console.log(`📤 ${method} ${url}`, body);
      
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUser?.token) {
        headers["Authorization"] = `Bearer ${currentUser.token}`;
      }

      const r = await fetch(url, { 
        method, 
        headers, 
        body: JSON.stringify(body) 
      });
      
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        const errorText = errData.error || `HTTP ${r.status}`;
        setEditError(errorText);
        setLoading(false);
        return;
      }
      
      notify(`✅ ${id ? "Updated" : "Inserted"}!`);
      showNotification(`CD ${cd} saved successfully.`);
      setEdit(null);
      await load();
    } catch (e) { 
      console.error('❌ Error saving:', e);
      setEditError("Error saving."); 
    } finally { 
      setLoading(false); 
    }
  };

  // ============================================================
  // BULK SAVE FUNCTIONS
  // ============================================================
  const saveBulk = async () => {
    if (!isAdmin) {
      notify("⛔ Only administrators can submit data!");
      return;
    }
    
    const isOutbound = bulkModal === "outbound";
    const endpoint = isOutbound ? API_OUTBOUND : API_INBOUND;
    
    if (isOutbound) {
      const body: any = {
        ano: Number(bulkAno),
        mes: Number(bulkMes),
        cd: Number(bulkCd),
        categoria: bulkCategoria,
        semana: 1
      };

      const frac = bulkCapFracionada.trim() === "" ? 0 : parseInt(bulkCapFracionada.replace(/\D/g, ""), 10);
      const fech = bulkCapFechada.trim() === "" ? 0 : parseInt(bulkCapFechada.replace(/\D/g, ""), 10);
      if (isNaN(frac) || frac < 0 || isNaN(fech) || fech < 0) {
        setBulkError("Invalid fractional and closed capacity values.");
        return;
      }
      body.capacidadeFracionada = frac;
      body.capacidadeFechada = fech;
      
      if (useBulkStartDate && bulkStartDate) {
        body.dataInicio = bulkStartDate;
      }

      // Check for duplicates
      const isBulkDuplicate = useMemo(() => {
        if (!bulkModal) return false;
        const isOutbound = bulkModal === "outbound";
        if (isOutbound) {
          return metas.some(m => 
            String(m.cd) === String(bulkCd) && 
            Number(m.mes) === Number(bulkMes) && 
            Number(m.ano) === Number(bulkAno) &&
            m.categoria === bulkCategoria &&
            Number(m.semana) === 1
          );
        } else {
          const activeWeeks = bulkSelectedWeeks.filter(w => {
            const val = bulkCapInboundWeeks[w];
            return val !== undefined && val.trim() !== "";
          });
          if (activeWeeks.length === 0) return false;
          return metas.some(m => 
            String(m.cd) === String(bulkCd) && 
            Number(m.mes) === Number(bulkMes) && 
            Number(m.ano) === Number(bulkAno) &&
            m.categoria === bulkCategoria &&
            activeWeeks.includes(Number(m.semana || 1))
          );
        }
      }, [bulkModal, bulkCd, bulkMes, bulkAno, bulkCategoria, bulkSelectedWeeks, bulkCapInboundWeeks, metas]);

      if (isBulkDuplicate) {
        setBulkError(`Operation Blocked: Outbound metrics already exist for CD ${bulkCd} (${bulkCategoria}) in ${bulkMes}/${bulkAno}.`);
        return;
      }

      setLoading(true);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (currentUser?.token) {
          headers["Authorization"] = `Bearer ${currentUser.token}`;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errorText = errData.error || `HTTP ${response.status}`;
          console.error('❌ Response error:', errorText);
          setBulkError(errorText);
          setLoading(false);
          return;
        }

        const result = await response.json();
        console.log('✅ Server response:', result);

        notify(`✅ Submission Successful!`);
        const infoStr = `CD ${bulkCd} | ${bulkCategoria} | Month ${bulkMes}/${bulkAno}`;
        showNotification(`Outbound registered successfully. ${infoStr}`);
        
        setLastSavedInfo(`Outbound • ${infoStr}`);
        setBulkCapFracionada("");
        setBulkCapFechada("");
        setUseBulkStartDate(false);
        setBulkStartDate("");
        await load();

        setShowContinuePrompt(true);
      } catch (e) {
        console.error('❌ Error in saveBulk:', e);
        setBulkError(`Error saving metrics: ${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    } else {
      // INBOUND - individual weekly submission
      if (bulkSelectedWeeks.length === 0) {
        setBulkError("Please select at least one week for Inbound submission.");
        return;
      }

      const weeksToSave = bulkSelectedWeeks.filter(w => {
        const val = bulkCapInboundWeeks[w];
        return val !== undefined && val.trim() !== "";
      });

      if (weeksToSave.length === 0) {
        setBulkError("Please enter Inbound capacity for at least one selected week.");
        return;
      }

      // Check for duplicates
      const isBulkDuplicate = useMemo(() => {
        if (!bulkModal) return false;
        const activeWeeks = bulkSelectedWeeks.filter(w => {
          const val = bulkCapInboundWeeks[w];
          return val !== undefined && val.trim() !== "";
        });
        if (activeWeeks.length === 0) return false;
        return metas.some(m => 
          String(m.cd) === String(bulkCd) && 
          Number(m.mes) === Number(bulkMes) && 
          Number(m.ano) === Number(bulkAno) &&
          m.categoria === bulkCategoria &&
          activeWeeks.includes(Number(m.semana || 1))
        );
      }, [bulkModal, bulkCd, bulkMes, bulkAno, bulkCategoria, bulkSelectedWeeks, bulkCapInboundWeeks, metas]);

      if (isBulkDuplicate) {
        setBulkError(`Operation Blocked: Inbound metrics already exist for CD ${bulkCd} (${bulkCategoria}) in the selected weeks of ${bulkMes}/${bulkAno}.`);
        return;
      }

      setLoading(true);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (currentUser?.token) {
          headers["Authorization"] = `Bearer ${currentUser.token}`;
        }

        const savedWeeksSummary: string[] = [];

        for (const w of weeksToSave) {
          const inb = parseInt((bulkCapInboundWeeks[w] || "0").replace(/\D/g, ""), 10);
          const reqBody = {
            ano: Number(bulkAno),
            mes: Number(bulkMes),
            cd: Number(bulkCd),
            categoria: bulkCategoria,
            semana: w,
            capacidadeInbound: inb
          };

          console.log(`📤 POST ${API_INBOUND} (Week ${w})`, reqBody);

          const response = await fetch(API_INBOUND, {
            method: "POST",
            headers,
            body: JSON.stringify(reqBody)
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errorText = errData.error || `HTTP ${response.status} on Week ${w}`;
            setBulkError(errorText);
            setLoading(false);
            return;
          }

          savedWeeksSummary.push(`Week ${w}: ${inb.toLocaleString("pt-BR")} units`);
        }

        notify(`✅ Submission Successful!`);
        const infoStr = `CD ${bulkCd} | ${bulkCategoria} | Month ${bulkMes}/${bulkAno} (${savedWeeksSummary.join(", ")})`;
        showNotification(`Inbound registered successfully. ${infoStr}`);
        setLastSavedInfo(`Inbound • ${infoStr}`);

        setBulkCapInboundWeeks({});
        setReplicateValue("");
        await load();

        setShowContinuePrompt(true);
      } catch (e) {
        console.error('❌ Error in saveBulk:', e);
        setBulkError(`Error saving metrics: ${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================
  const exportToExcelWithFilters = () => {
    try {
      const wb = XLSX.utils.book_new();

      let targetMonths: number[] = [];
      if (excelMes !== "Todos") {
        targetMonths = [Number(excelMes)];
      } else {
        const s = new Set<number>();
        metas.forEach(m => {
          if (excelAno !== "Todos" && String(m.ano) !== excelAno) return;
          if (m.mes) s.add(Number(m.mes));
        });
        targetMonths = s.size === 0 ? [7, 8] : Array.from(s).sort((a, b) => a - b);
      }

      const excelFilt = metas.filter(m => {
        if (excelAno !== "Todos" && String(m.ano) !== excelAno) return false;
        if (excelMes !== "Todos" && String(m.mes).padStart(2, "0") !== excelMes) return false;
        if (excelCat !== "Todas" && m.categoria !== excelCat) return false;
        if (excelCd !== "Todos" && String(m.cd) !== excelCd) return false;
        return true;
      });

      const activeCDs = CD_LIST.filter(item => {
        if (excelCd !== "Todos") return String(item.cd) === excelCd;
        return true;
      });

      // 1. OUTBOUND SHEET
      if (excelDirection === "outbound" || excelDirection === "both") {
        const outboundData: any[] = [];
        outboundData.push(["OUTBOUND CAPACITY"]);
        outboundData.push([`Filters: Year (${excelAno}) | Month (${excelMes}) | CD (${excelCd}) | Category (${excelCat})`]);
        outboundData.push([]);

        const outboundHeaders = ["CD", "Group", "Category"];
        targetMonths.forEach(m => {
          outboundHeaders.push(`${getMonthLabel(m)} - Frac.`);
          outboundHeaders.push(`${getMonthLabel(m)} - Closed`);
          outboundHeaders.push(`${getMonthLabel(m)} - Total`);
        });
        outboundHeaders.push("Total Outbound");
        outboundData.push(outboundHeaders);

        const gtF: Record<number, number> = {};
        const gtE: Record<number, number> = {};
        targetMonths.forEach(m => { gtF[m] = 0; gtE[m] = 0; });

        activeCDs.forEach(cdItem => {
          const cdCats = excelCat !== "Todas" ? [excelCat] : (CATEGORIAS_POR_CD[cdItem.cd] || ["Dry Foods"]);
          cdCats.forEach(catItem => {
            const matching = excelFilt.filter(x => String(x.cd) === cdItem.cd && x.categoria === catItem);
            const row = [cdItem.cd, cdItem.group, catItem];
            let rowTotal = 0;
            targetMonths.forEach(m => {
              const mm = matching.filter(x => Number(x.mes) === m);
              const frac = mm.length > 0 ? Math.max(...mm.map(x => x.capacidadeFracionada || 0)) : 0;
              const fech = mm.length > 0 ? Math.max(...mm.map(x => x.capacidadeFechada || 0)) : 0;
              const totalM = frac + fech;
              row.push(frac, fech, totalM);
              rowTotal += totalM;
              gtF[m] += frac;
              gtE[m] += fech;
            });
            row.push(rowTotal);
            outboundData.push(row);
          });
        });

        const outboundTotalRow: (string | number)[] = ["TOTAL OUTBOUND", "", ""];
        let grandTotalOutbound = 0;
        targetMonths.forEach(m => {
          const tf = gtF[m] || 0;
          const te = gtE[m] || 0;
          const tm = tf + te;
          outboundTotalRow.push(tf, te, tm);
          grandTotalOutbound += tm;
        });
        outboundTotalRow.push(grandTotalOutbound);
        outboundData.push([]);
        outboundData.push(outboundTotalRow);

        const wsOutbound = XLSX.utils.aoa_to_sheet(outboundData);
        XLSX.utils.book_append_sheet(wb, wsOutbound, "Outbound");
      }

      // 2. INBOUND SHEET
      if (excelDirection === "inbound" || excelDirection === "both") {
        const inboundData: any[] = [];
        inboundData.push(["INBOUND CAPACITY"]);
        inboundData.push([`Filters: Year (${excelAno}) | Month (${excelMes}) | CD (${excelCd}) | Category (${excelCat})`]);
        inboundData.push([]);

        const inboundHeaders = ["CD", "Group", "Category"];
        targetMonths.forEach(m => {
          inboundHeaders.push(getMonthLabel(m));
        });
        inboundHeaders.push("Total Inbound");
        inboundData.push(inboundHeaders);

        const gtInbound: Record<number, number> = {};
        targetMonths.forEach(m => { gtInbound[m] = 0; });

        activeCDs.forEach(cdItem => {
          const cdCats = excelCat !== "Todas" ? [excelCat] : (CATEGORIAS_POR_CD[cdItem.cd] || ["Dry Foods"]);
          cdCats.forEach(catItem => {
            const matching = excelFilt.filter(x => String(x.cd) === cdItem.cd && x.categoria === catItem);
            const row = [cdItem.cd, cdItem.group, catItem];
            let rowTotal = 0;
            targetMonths.forEach(m => {
              const mm = matching.filter(x => Number(x.mes) === m);
              const val = mm.reduce((s, x) => s + (x.capacidadeInbound || 0), 0);
              row.push(val);
              rowTotal += val;
              gtInbound[m] += val;
            });
            row.push(rowTotal);
            inboundData.push(row);
          });
        });

        const inboundTotalRow: (string | number)[] = ["TOTAL INBOUND", "", ""];
        let grandTotalInbound = 0;
        targetMonths.forEach(m => {
          const val = gtInbound[m] || 0;
          inboundTotalRow.push(val);
          grandTotalInbound += val;
        });
        inboundTotalRow.push(grandTotalInbound);
        inboundData.push([]);
        inboundData.push(inboundTotalRow);

        const wsInbound = XLSX.utils.aoa_to_sheet(inboundData);
        XLSX.utils.book_append_sheet(wb, wsInbound, "Inbound");
      }

      const cdSuffix = excelCd !== "Todos" ? `_CD${excelCd}` : "";
      const mesSuffix = excelMes !== "Todos" ? `_Month${excelMes}` : "";
      const fileName = `Capacities${cdSuffix}${mesSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      XLSX.writeFile(wb, fileName);
      notify(`✅ Excel downloaded successfully!`);
      showNotification(`Excel report generated: ${fileName}`);
      setShowExcelModal(false);
    } catch (err) {
      console.error("Error generating Excel:", err);
      showNotification("Error exporting to Excel.");
    }
  };

  // ============================================================
  // PRESENTATION FUNCTIONS
  // ============================================================
  const copyPresentationToClipboard = () => {
    const el = presentationRef.current;
    if (!el) return;
    const htmlContent = el.innerHTML;
    const textContent = el.innerText;

    try {
      const blobHtml = new Blob([htmlContent], { type: "text/html" });
      const blobText = new Blob([textContent], { type: "text/plain" });
      const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];

      navigator.clipboard.write(data).then(() => {
        setCopiedPresentation(true);
        showNotification("Presentation copied successfully! Ready to paste in email.");
        setTimeout(() => setCopiedPresentation(false), 2500);
      }).catch((err) => {
        console.error("Error copying HTML:", err);
        navigator.clipboard.writeText(textContent);
        setCopiedPresentation(true);
        showNotification("Presentation text copied to clipboard!");
        setTimeout(() => setCopiedPresentation(false), 2500);
      });
    } catch (e) {
      navigator.clipboard.writeText(textContent);
      setCopiedPresentation(true);
      showNotification("Presentation text copied!");
      setTimeout(() => setCopiedPresentation(false), 2500);
    }
  };

  const copyPresentationAsImage = async () => {
    const el = presentationRef.current;
    if (!el) return;
    setCopyingImage(true);
    setCopiedImageStatus(null);
    try {
      const blob = await toBlob(el, { quality: 0.95, backgroundColor: "#ffffff" });
      if (blob) {
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob })
            ]);
            setCopiedImageStatus("✅ Image Copied!");
            showNotification("Image copied! Ready to paste in email or WhatsApp.");
          } catch (clipErr) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Presentation_Capacities_${new Date().toISOString().slice(0, 10)}.png`;
            a.click();
            URL.revokeObjectURL(url);
            setCopiedImageStatus("✅ Image Downloaded!");
            showNotification("PNG image downloaded successfully!");
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Presentation_Capacities_${new Date().toISOString().slice(0, 10)}.png`;
          a.click();
          URL.revokeObjectURL(url);
          setCopiedImageStatus("✅ Image Downloaded!");
          showNotification("PNG image downloaded successfully!");
        }
      }
    } catch (err) {
      console.error("Error generating image:", err);
      showNotification("Error capturing presentation image.");
    } finally {
      setCopyingImage(false);
      setTimeout(() => setCopiedImageStatus(null), 3000);
    }
  };

  const downloadPresentationAsImage = async () => {
    const el = presentationRef.current;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { quality: 0.95, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Presentation_Capacities_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      showNotification("PNG image generated and downloaded!");
    } catch (err) {
      console.error("Error downloading image:", err);
      showNotification("Error generating image file.");
    }
  };

  // ============================================================
  // ANTICIPATION FUNCTIONS
  // ============================================================
  const saveAntecipacao = async () => {
    setAntecipacaoError(null);
    if (!antecipacaoDataInicio || !antecipacaoDataFim) {
      setAntecipacaoError("Please fill in the start and end dates.");
      return;
    }
    if (!antecipacaoQtd || isNaN(Number(antecipacaoQtd)) || Number(antecipacaoQtd) < 0) {
      setAntecipacaoError("Please enter a valid quantity.");
      return;
    }
    if (new Date(antecipacaoDataInicio) > new Date(antecipacaoDataFim)) {
      setAntecipacaoError("The start date cannot be after the end date.");
      return;
    }

    setAntecipacaoSaving(true);
    try {
      const payload = {
        dataInicio: antecipacaoDataInicio,
        dataFim: antecipacaoDataFim,
        CD: Number(antecipacaoCd),
        categoria: antecipacaoCategoria,
        qtdAntecipacao: Number(antecipacaoQtd)
      };

      const token = localStorage.getItem("auth_token") || currentUser.token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/metrics/anticipation", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error saving anticipation.");
      }

      showNotification("Outbound anticipation registered and capacity updated successfully!");
      setShowAntecipacaoModal(false);
      await load();
    } catch (err: any) {
      setAntecipacaoError(err.message || "Error connecting to server.");
    } finally {
      setAntecipacaoSaving(false);
    }
  };

  // ============================================================
  // CELL COMPONENT
  // ============================================================
  const Cel = ({ rid, tp, m, v, semana, cd, cat, id, disabled }: any) => {
    const isZero = v === 0;
    const isEditingEnabled = isAdmin && !disabled;
    const highlightClass = isEditingEnabled
      ? direction === "inbound"
        ? "hover:bg-violet-50/50 hover:text-violet-700 cursor-pointer"
        : "hover:bg-indigo-50/50 hover:text-indigo-700 cursor-pointer"
      : "";

    return (
      <td 
        onClick={() => {
          if (disabled) return;
          if (isAdmin) {
            if (cd && cat) {
              setEdit({ rid, cd, cat, tp, m, v, nv: "", id, semana });
              setUseEditStartDate(false);
              setEditStartDate("");
            } else {
              startEdit(rid, tp, m, v, semana);
            }
          }
        }} 
        className={`py-2 px-3.5 text-right font-mono text-[11px] tabular-nums transition-all duration-150 relative group ${highlightClass}`}
      >
        <span className={isZero ? "text-slate-300 font-normal" : "text-slate-700 font-normal"}>
          {fmt(v)}
        </span>
        {isEditingEnabled && (
          <Edit2 className="w-2.5 h-2.5 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        )}
      </td>
    );
  };

  // ============================================================
  // TABLE COMPONENTS
  // ============================================================
  const TblInbound = ({ titulo }: { titulo: string }) => {
    const anyMonthExpanded = expandedMonths.length > 0;

    const toggleMonth = (m: number) => {
      setExpandedMonths(prev =>
        prev.includes(m) ? prev.filter(x => x !== m) : [m]
      );
    };

    const toggleAllMonths = () => {
      if (expandedMonths.length === dynMonths.length) {
        setExpandedMonths([]);
      } else {
        setExpandedMonths([...dynMonths]);
      }
    };

    const visibleMonths = useMemo(() => {
      if (expandedMonths.length > 0) {
        return dynMonths.filter(m => expandedMonths.includes(m));
      }
      return dynMonths;
    }, [dynMonths, expandedMonths]);

    const tblCols = useMemo(() => {
      const cols: { key: string; label: string; type: "total" | "week"; month: number; week?: number }[] = [];
      visibleMonths.forEach(m => {
        cols.push({ key: `month-${m}`, label: fM(m), type: "total", month: m });
        if (expandedMonths.includes(m)) {
          const numWeeks = getWeeksInMonth(2026, m);
          for (let w = 1; w <= numWeeks; w++) {
            cols.push({ key: `month-${m}-w${w}`, label: `W${w}`, type: "week", month: m, week: w });
          }
        }
      });
      return cols;
    }, [visibleMonths, expandedMonths]);

    const spInboundCols = useMemo(() => {
      const t: Record<string, number> = {};
      const spRowsLocal = rows.filter(r => r.group === "SP");
      tblCols.forEach(col => {
        if (col.type === "total") {
          t[col.key] = spRowsLocal.reduce((sum, r) => sum + (r.md[col.month]?.inbound || 0), 0);
        } else {
          t[col.key] = spRowsLocal.reduce((sum, r) => sum + (r.wd[`${col.month}-${col.week}`]?.inbound || 0), 0);
        }
      });
      return t;
    }, [rows, tblCols]);

    const regInboundCols = useMemo(() => {
      const t: Record<string, number> = {};
      const regRowsLocal = rows.filter(r => r.group === "REG");
      tblCols.forEach(col => {
        if (col.type === "total") {
          t[col.key] = regRowsLocal.reduce((sum, r) => sum + (r.md[col.month]?.inbound || 0), 0);
        } else {
          t[col.key] = regRowsLocal.reduce((sum, r) => sum + (r.wd[`${col.month}-${col.week}`]?.inbound || 0), 0);
        }
      });
      return t;
    }, [rows, tblCols]);

    const gtInboundCols = useMemo(() => {
      const t: Record<string, number> = {};
      tblCols.forEach(col => {
        t[col.key] = (spInboundCols[col.key] || 0) + (regInboundCols[col.key] || 0);
      });
      return t;
    }, [spInboundCols, regInboundCols, tblCols]);

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/75 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-100 text-violet-600"><Building className="w-3.5 h-3.5" /></span>
            <div>
              <span className="text-xs font-bold text-slate-800 tracking-tight">{titulo}</span>
              <p className="text-[10px] text-slate-400 font-medium">
                {inboundView === "mes" 
                  ? "Receiving view with direct weekly expansion" 
                  : `Weekly view of ${getMonthLabel(selectedMonthInbound)} (${getWeeksInMonth(2026, selectedMonthInbound)} weeks)`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {inboundView === "mes" && (
              <button
                type="button"
                onClick={toggleAllMonths}
                className="px-2.5 py-1 text-[10px] font-bold border border-violet-100 text-violet-700 bg-violet-50/50 hover:bg-violet-100/50 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                {expandedMonths.length === dynMonths.length ? "Collapse All" : "Expand Weeks"}
              </button>
            )}

            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 shadow-inner">
              <button
                onClick={() => setInboundView("mes")}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  inboundView === "mes"
                    ? "bg-white text-violet-700 shadow-sm font-black"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInboundView("semana")}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  inboundView === "semana"
                    ? "bg-white text-violet-700 shadow-sm font-black"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Weekly Focus
              </button>
            </div>
          </div>
        </div>

        {anyMonthExpanded && inboundView === "mes" && (
          <div className="flex items-center justify-between bg-violet-50/30 border-b border-violet-100 px-4 py-2 text-xs text-violet-950 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" />
              <span>
                Focused on <strong>{expandedMonths.map(m => getMonthLabel(m)).join(", ")}</strong> and their weeks.
              </span>
            </div>
            <button
              onClick={() => setExpandedMonths([])}
              className="text-[9px] uppercase font-bold tracking-wider bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-md shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Show All Months
            </button>
          </div>
        )}

        {inboundView === "semana" && (
          <div className="flex items-center gap-1 px-3.5 py-2 bg-slate-50/50 border-b overflow-x-auto scrollbar-none">
            <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0 mr-2 tracking-wide">Focus Month:</span>
            {Array.from(new Set(metas.map(m => Number(m.mes)))).filter(Boolean).sort((a: number, b: number) => a - b).map((m: number) => {
              const isSelected = selectedMonthInbound === m;
              const weekCount = getWeeksInMonth(2026, m);
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMonthInbound(m)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all whitespace-nowrap border flex items-center gap-1 ${
                    isSelected
                      ? "bg-violet-600 text-white border-violet-600 shadow-sm font-extrabold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Calendar className="w-2.5 h-2.5" />
                  {getMonthLabel(m)} ({weekCount} wks)
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-x-auto w-full">
          {inboundView === "mes" ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200/80">
                  <th rowSpan={anyMonthExpanded ? 2 : 1} className="py-3 px-4 font-semibold text-slate-500 text-left">CD</th>
                  <th rowSpan={anyMonthExpanded ? 2 : 1} className="py-3 px-4 text-center font-semibold text-slate-500">Category</th>
                  {visibleMonths.map(m => {
                    const isExpanded = expandedMonths.includes(m);
                    const numWeeks = getWeeksInMonth(2026, m);
                    return (
                      <th
                        key={m}
                        colSpan={isExpanded ? 1 + numWeeks : 1}
                        rowSpan={isExpanded ? 1 : (anyMonthExpanded ? 2 : 1)}
                        className={`py-1.5 px-3 text-center font-semibold transition-all duration-205 ${
                          isExpanded ? "bg-violet-50/40 text-violet-700 font-bold" : "text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[10px] font-extrabold tracking-wider">{getMonthLabel(m)}</span>
                          <button
                            type="button"
                            onClick={() => toggleMonth(m)}
                            className={`p-0.5 rounded transition-all flex items-center justify-center ${
                              isExpanded
                                ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                                : "bg-slate-200/60 text-slate-500 hover:bg-slate-300"
                            }`}
                            title={isExpanded ? "Collapse weeks" : "Expand weeks"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  {!anyMonthExpanded && <th rowSpan={anyMonthExpanded ? 2 : 1} className="py-3 px-4 text-right font-semibold text-slate-500">Total</th>}
                </tr>
                {anyMonthExpanded && (
                  <tr className="bg-slate-50/40 text-[9px] font-bold uppercase text-slate-400 border-b border-slate-150">
                    {tblCols.map(col => {
                      if (!expandedMonths.includes(col.month)) return null;
                      return (
                        <th key={col.key} className="py-1 px-2.5 text-right font-semibold text-slate-400 animate-in fade-in duration-200">
                          {col.type === "total" ? "Total" : `W${col.week}`}
                        </th>
                      );
                    })}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* SÃO PAULO */}
                <tr className="bg-slate-50/40">
                  <td colSpan={anyMonthExpanded ? 2 + tblCols.length : 3 + tblCols.length} className="py-1.5 px-4 border-b border-slate-100/60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-3.5 bg-violet-500 rounded-sm" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">São Paulo (SP)</span>
                    </div>
                  </td>
                </tr>
                {sp.map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-2 px-4 font-bold text-[11px] text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {r.hasMultipleCategories ? (
                            <button 
                              type="button"
                              onClick={() => setExpandedInboundCds(prev => ({ ...prev, [r.cd]: !prev[r.cd] }))}
                              className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-500 shrink-0 cursor-pointer"
                            >
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedInboundCds[r.cd] ? 'rotate-90 text-slate-800' : 'text-slate-400'}`} />
                            </button>
                          ) : (
                            <div className="w-5" />
                          )}
                          CD {r.cd}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium">{r.cat}</td>
                      {tblCols.map(col => {
                        if (col.type === "total") {
                          return <Cel key={col.key} rid={r.id} tp="inbound" m={col.month} v={r.md[col.month]?.inbound || 0} disabled={true} />;
                        } else {
                          const weekData = r.wd[`${col.month}-${col.week}`];
                          return (
                            <Cel 
                              key={col.key} 
                              rid={r.id} 
                              tp="inbound" 
                              m={col.month} 
                              v={weekData?.inbound || 0} 
                              semana={col.week} 
                              cd={r.cd} 
                              cat={r.cat} 
                              id={weekData?.id}
                              disabled={r.hasMultipleCategories}
                            />
                          );
                        }
                      })}
                      {!anyMonthExpanded && <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-700 tabular-nums">{fmt(dynMonths.reduce((s, m) => s + (r.md[m]?.inbound || 0), 0))}</td>}
                    </tr>
                    {r.hasMultipleCategories && expandedInboundCds[r.cd] && r.children?.map((child: any) => (
                      <tr key={child.id} className="bg-slate-50/20 hover:bg-slate-50/40 transition-colors">
                        <td className="py-2 px-4 font-medium text-[11px] text-slate-500 pl-8">
                          <div className="flex items-center gap-1">
                            <span className="text-violet-400 font-bold select-none mr-1">↳</span> CD {child.cd}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium bg-slate-50/5">{child.cat}</td>
                        {tblCols.map(col => {
                          if (col.type === "total") {
                            return <Cel key={col.key} rid={child.id} tp="inbound" m={col.month} v={child.md[col.month]?.inbound || 0} disabled={true} />;
                          } else {
                            const weekData = child.wd[`${col.month}-${col.week}`];
                            return (
                              <Cel 
                                key={col.key} 
                                rid={child.id} 
                                tp="inbound" 
                                m={col.month} 
                                v={weekData?.inbound || 0} 
                                semana={col.week} 
                                cd={child.cd} 
                                cat={child.cat} 
                                id={weekData?.id}
                                disabled={false}
                              />
                            );
                          }
                        })}
                        {!anyMonthExpanded && <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-600 bg-slate-50/30 tabular-nums">{fmt(dynMonths.reduce((s, m) => s + (child.md[m]?.inbound || 0), 0))}</td>}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}

                {/* REGIONAL */}
                <tr className="bg-slate-50/40">
                  <td colSpan={anyMonthExpanded ? 2 + tblCols.length : 3 + tblCols.length} className="py-1.5 px-4 border-b border-slate-100/60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-3.5 bg-violet-400 rounded-sm" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Regional (REG)</span>
                    </div>
                  </td>
                </tr>
                {reg.map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-2 px-4 font-bold text-[11px] text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {r.hasMultipleCategories ? (
                            <button 
                              type="button"
                              onClick={() => setExpandedInboundCds(prev => ({ ...prev, [r.cd]: !prev[r.cd] }))}
                              className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-500 shrink-0 cursor-pointer"
                            >
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedInboundCds[r.cd] ? 'rotate-90 text-slate-800' : 'text-slate-400'}`} />
                            </button>
                          ) : (
                            <div className="w-5" />
                          )}
                          CD {r.cd}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium">{r.cat}</td>
                      {tblCols.map(col => {
                        if (col.type === "total") {
                          return <Cel key={col.key} rid={r.id} tp="inbound" m={col.month} v={r.md[col.month]?.inbound || 0} disabled={true} />;
                        } else {
                          const weekData = r.wd[`${col.month}-${col.week}`];
                          return (
                            <Cel 
                              key={col.key} 
                              rid={r.id} 
                              tp="inbound" 
                              m={col.month} 
                              v={weekData?.inbound || 0} 
                              semana={col.week} 
                              cd={r.cd} 
                              cat={r.cat} 
                              id={weekData?.id}
                              disabled={r.hasMultipleCategories}
                            />
                          );
                        }
                      })}
                      {!anyMonthExpanded && <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-700 tabular-nums">{fmt(dynMonths.reduce((s, m) => s + (r.md[m]?.inbound || 0), 0))}</td>}
                    </tr>
                    {r.hasMultipleCategories && expandedInboundCds[r.cd] && r.children?.map((child: any) => (
                      <tr key={child.id} className="bg-slate-50/20 hover:bg-slate-50/40 transition-colors">
                        <td className="py-2 px-4 font-medium text-[11px] text-slate-500 pl-8">
                          <div className="flex items-center gap-1">
                            <span className="text-violet-400 font-bold select-none mr-1">↳</span> CD {child.cd}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium bg-slate-50/5">{child.cat}</td>
                        {tblCols.map(col => {
                          if (col.type === "total") {
                            return <Cel key={col.key} rid={child.id} tp="inbound" m={col.month} v={child.md[col.month]?.inbound || 0} disabled={true} />;
                          } else {
                            const weekData = child.wd[`${col.month}-${col.week}`];
                            return (
                              <Cel 
                                key={col.key} 
                                rid={child.id} 
                                tp="inbound" 
                                m={col.month} 
                                v={weekData?.inbound || 0} 
                                semana={col.week} 
                                cd={child.cd} 
                                cat={child.cat} 
                                id={weekData?.id}
                                disabled={false}
                              />
                            );
                          }
                        })}
                        {!anyMonthExpanded && <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-600 bg-slate-50/30 tabular-nums">{fmt(dynMonths.reduce((s, m) => s + (child.md[m]?.inbound || 0), 0))}</td>}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}

                {/* TOTAL */}
                <tr className="bg-slate-50 text-slate-800 text-[11px] border-t border-slate-200">
                  <td className="py-3 px-4 uppercase font-semibold tracking-wider text-slate-600">Total</td>
                  <td className="py-3 text-center text-slate-400 font-normal">—</td>
                  {tblCols.map(col => {
                    const val = col.type === "total" ? (gtI[col.month] || 0) : (gtInboundCols[col.key] || 0);
                    return <td key={col.key} className="py-3 px-3.5 text-right font-mono text-slate-700 tabular-nums font-normal">{fmt(val)}</td>;
                  })}
                  {!anyMonthExpanded && <td className="py-3 px-4 text-right font-mono text-slate-700 font-normal tabular-nums">{fmt(tI)}</td>}
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200/80">
                  <th className="py-3 px-4 font-semibold text-slate-500 text-left">CD</th>
                  <th className="py-3 px-4 text-center font-semibold text-slate-500">Category</th>
                  {activeWeeks.map(w => (
                    <th key={w} className="py-3 px-3.5 text-right font-semibold text-slate-500">Week {w}</th>
                  ))}
                  <th className="py-3 px-4 text-right font-semibold text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* SÃO PAULO */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3 + activeWeeks.length} className="py-1.5 px-4 border-b border-slate-100/60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-3.5 bg-violet-500 rounded-sm" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">São Paulo (SP)</span>
                    </div>
                  </td>
                </tr>
                {weeklyInboundRows.filter(r => r.group === "SP" && !r.isChild).map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-2 px-4 font-bold text-[11px] text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {r.hasMultipleCategories ? (
                            <button 
                              type="button"
                              onClick={() => setExpandedInboundCds(prev => ({ ...prev, [r.cd]: !prev[r.cd] }))}
                              className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-500 shrink-0 cursor-pointer"
                            >
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedInboundCds[r.cd] ? 'rotate-90 text-slate-800' : 'text-slate-400'}`} />
                            </button>
                          ) : (
                            <div className="w-5" />
                          )}
                          CD {r.cd}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium">{r.cat}</td>
                      {activeWeeks.map(w => {
                        const weekData = r.wd[w];
                        return (
                          <Cel 
                            key={w} 
                            rid={r.id} 
                            tp="inbound" 
                            m={selectedMonthInbound} 
                            v={weekData?.inbound || 0} 
                            semana={w} 
                            cd={r.cd} 
                            cat={r.cat} 
                            id={weekData?.id}
                            disabled={r.hasMultipleCategories}
                          />
                        );
                      })}
                      <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-700 tabular-nums">
                        {fmt(activeWeeks.reduce((s, w) => s + (r.wd[w]?.inbound || 0), 0))}
                      </td>
                    </tr>
                    {r.hasMultipleCategories && expandedInboundCds[r.cd] && r.children?.map((child: any) => (
                      <tr key={child.id} className="bg-slate-50/20 hover:bg-slate-50/40 transition-colors">
                        <td className="py-2 px-4 font-medium text-[11px] text-slate-500 pl-8">
                          <div className="flex items-center gap-1">
                            <span className="text-violet-400 font-bold select-none mr-1">↳</span> CD {child.cd}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium bg-slate-50/5">{child.cat}</td>
                        {activeWeeks.map(w => {
                          const weekData = child.wd[w];
                          return (
                            <Cel 
                              key={w} 
                              rid={child.id} 
                              tp="inbound" 
                              m={selectedMonthInbound} 
                              v={weekData?.inbound || 0} 
                              semana={w} 
                              cd={child.cd} 
                              cat={child.cat} 
                              id={weekData?.id}
                              disabled={false}
                            />
                          );
                        })}
                        <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-600 bg-slate-50/30 tabular-nums">
                          {fmt(activeWeeks.reduce((s, w) => s + (child.wd[w]?.inbound || 0), 0))}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}

                {/* REGIONAL */}
                <tr className="bg-slate-50/40">
                  <td colSpan={3 + activeWeeks.length} className="py-1.5 px-4 border-b border-slate-100/60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-3.5 bg-violet-400 rounded-sm" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Regional (REG)</span>
                    </div>
                  </td>
                </tr>
                {weeklyInboundRows.filter(r => r.group === "REG" && !r.isChild).map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-2 px-4 font-bold text-[11px] text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {r.hasMultipleCategories ? (
                            <button 
                              type="button"
                              onClick={() => setExpandedInboundCds(prev => ({ ...prev, [r.cd]: !prev[r.cd] }))}
                              className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-500 shrink-0 cursor-pointer"
                            >
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedInboundCds[r.cd] ? 'rotate-90 text-slate-800' : 'text-slate-400'}`} />
                            </button>
                          ) : (
                            <div className="w-5" />
                          )}
                          CD {r.cd}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium">{r.cat}</td>
                      {activeWeeks.map(w => {
                        const weekData = r.wd[w];
                        return (
                          <Cel 
                            key={w} 
                            rid={r.id} 
                            tp="inbound" 
                            m={selectedMonthInbound} 
                            v={weekData?.inbound || 0} 
                            semana={w} 
                            cd={r.cd} 
                            cat={r.cat} 
                            id={weekData?.id}
                            disabled={r.hasMultipleCategories}
                          />
                        );
                      })}
                      <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-700 tabular-nums">
                        {fmt(activeWeeks.reduce((s, w) => s + (r.wd[w]?.inbound || 0), 0))}
                      </td>
                    </tr>
                    {r.hasMultipleCategories && expandedInboundCds[r.cd] && r.children?.map((child: any) => (
                      <tr key={child.id} className="bg-slate-50/20 hover:bg-slate-50/40 transition-colors">
                        <td className="py-2 px-4 font-medium text-[11px] text-slate-500 pl-8">
                          <div className="flex items-center gap-1">
                            <span className="text-violet-400 font-bold select-none mr-1">↳</span> CD {child.cd}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium bg-slate-50/5">{child.cat}</td>
                        {activeWeeks.map(w => {
                          const weekData = child.wd[w];
                          return (
                            <Cel 
                              key={w} 
                              rid={child.id} 
                              tp="inbound" 
                              m={selectedMonthInbound} 
                              v={weekData?.inbound || 0} 
                              semana={w} 
                              cd={child.cd} 
                              cat={child.cat} 
                              id={weekData?.id}
                              disabled={false}
                            />
                          );
                        })}
                        <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-600 bg-slate-50/30 tabular-nums">
                          {fmt(activeWeeks.reduce((s, w) => s + (child.wd[w]?.inbound || 0), 0))}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}

                {/* TOTAL */}
                <tr className="bg-slate-50 text-slate-800 text-[11px] border-t border-slate-200">
                  <td className="py-3 px-4 uppercase font-semibold tracking-wider text-slate-600">Total</td>
                  <td className="py-3 text-center text-slate-400 font-normal">—</td>
                  {activeWeeks.map(w => (
                    <td key={w} className="py-3 px-3.5 text-right font-mono text-slate-700 tabular-nums font-normal">{fmt(gtWeeklySum[w] || 0)}</td>
                  ))}
                  <td className="py-3 px-4 text-right font-mono text-slate-700 font-normal tabular-nums">{fmt(tWeeklyI)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const TblOutbound = ({ titulo }: { titulo: string }) => {
    const showFrac = view === "all" || view === "frac";
    const showFech = view === "all" || view === "fech";

    const subColsCount = (showFrac ? 1 : 0) + (showFech ? 1 : 0);
    const totalColsCount = 1;

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full transition-all duration-300">
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 bg-slate-50/75 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-600"><Truck className="w-3.5 h-3.5" /></span>
            <div>
              <span className="text-xs font-bold text-slate-800 tracking-tight">{titulo}</span>
              <p className="text-[10px] text-slate-450 font-medium">Fractional and Closed channels</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60 tabular-nums">{fmt(tFOutbound + tEOutbound)} total outbound</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200/80">
                <th rowSpan={2} className="py-3 px-4 font-semibold text-slate-500 text-left">CD</th>
                <th rowSpan={2} className="py-3 px-4 text-center font-semibold text-slate-500">Category</th>
                {dynMonths.map(m => (
                  <th
                    key={m}
                    colSpan={subColsCount}
                    className="py-1.5 px-3 text-center font-semibold text-slate-600 bg-slate-50/40 uppercase tracking-wider text-[10px]"
                  >
                    {getMonthLabel(m)}
                  </th>
                ))}
                <th className="py-1.5 px-3 text-center font-semibold text-slate-500 uppercase tracking-wider text-[10px] bg-slate-50/10">Total</th>
              </tr>
              <tr className="bg-slate-50/20 text-[9px] font-bold uppercase text-slate-400 border-b border-slate-150">
                {dynMonths.map(m => {
                  const pendingFrac = getPendingFracionadoForMonth(m, ano !== "Todos" ? Number(ano) : 2026);
                  const hasPending = pendingFrac.length > 0;
                  return (
                    <React.Fragment key={m}>
                      {showFrac && (
                        <th className="py-1.5 px-2.5 text-right font-semibold text-indigo-600/70 bg-slate-50/5">
                          <div className="flex items-center justify-end gap-1">
                            <span>Frac.</span>
                            {hasPending && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingFracModal({ month: m, items: pendingFrac });
                                  setSelectedFracItem(null);
                                }}
                                className="px-1.5 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-2xs hover:shadow-sm border border-amber-400 active:scale-95 group/btn"
                                title={`${pendingFrac.length} CD(s) pending fractional capacity in ${getMonthLabel(m)}. Click to open.`}
                              >
                                <AlertCircle className="w-3 h-3 text-amber-100 group-hover/btn:scale-110 transition-transform" />
                                <span className="text-[9.5px] font-extrabold font-mono leading-none">{pendingFrac.length}</span>
                              </button>
                            )}
                          </div>
                        </th>
                      )}
                      {showFech && <th className="py-1.5 px-2.5 text-right font-semibold text-sky-600/70 bg-slate-50/5">Closed</th>}
                    </React.Fragment>
                  );
                })}
                <th className="py-1.5 px-4 text-right font-semibold text-slate-500 bg-slate-50/10">Total Outbound</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* SÃO PAULO */}
              <tr className="bg-slate-50/40">
                <td colSpan={2 + dynMonths.length * subColsCount + totalColsCount} className="py-1.5 px-4 border-b border-slate-100/60">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-3.5 bg-blue-500 rounded-sm" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">São Paulo (SP)</span>
                  </div>
                </td>
              </tr>
              {spOutbound.map(r => (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-2 px-4 font-bold text-[11px] text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {r.hasMultipleCategories ? (
                          <button 
                            onClick={() => setExpandedOutboundCds(prev => ({ ...prev, [r.cd]: !prev[r.cd] }))}
                            className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-500 shrink-0 cursor-pointer"
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedOutboundCds[r.cd] ? 'rotate-90 text-slate-805' : 'text-slate-400'}`} />
                          </button>
                        ) : (
                          <div className="w-5" />
                        )}
                        CD {r.cd}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium">{r.cat}</td>
                    {dynMonths.map(m => (
                      <React.Fragment key={m}>
                        {showFrac && (
                          <Cel 
                            rid={r.id} 
                            tp="frac" 
                            m={m} 
                            v={r.md[m]?.frac || 0} 
                            cd={r.cd} 
                            cat={r.cat} 
                            id={r.md[m]?.id} 
                            disabled={r.hasMultipleCategories} 
                          />
                        )}
                        {showFech && (
                          <Cel 
                            rid={r.id} 
                            tp="fech" 
                            m={m} 
                            v={r.md[m]?.fech || 0} 
                            cd={r.cd} 
                            cat={r.cat} 
                            id={r.md[m]?.id} 
                            disabled={r.hasMultipleCategories} 
                          />
                        )}
                      </React.Fragment>
                    ))}
                    <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-700 bg-slate-50/40 tabular-nums">
                      {fmt(dynMonths.reduce((s, m) => s + (showFrac ? (r.md[m]?.frac || 0) : 0) + (showFech ? (r.md[m]?.fech || 0) : 0), 0))}
                    </td>
                  </tr>
                  {r.hasMultipleCategories && expandedOutboundCds[r.cd] && r.children?.map((child: any) => (
                    <tr key={child.id} className="bg-slate-50/20 hover:bg-slate-50/40 transition-colors">
                      <td className="py-2 px-4 font-medium text-[11px] text-slate-500 pl-8">
                        <div className="flex items-center gap-1">
                          <span className="text-indigo-400 font-bold select-none mr-1">↳</span> CD {child.cd}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium bg-slate-50/5">{child.cat}</td>
                      {dynMonths.map(m => (
                        <React.Fragment key={m}>
                          {showFrac && (
                            <Cel 
                              rid={child.id} 
                              tp="frac" 
                              m={m} 
                              v={child.md[m]?.frac || 0} 
                              cd={child.cd} 
                              cat={child.cat} 
                              id={child.md[m]?.id} 
                              disabled={false} 
                            />
                          )}
                          {showFech && (
                            <Cel 
                              rid={child.id} 
                              tp="fech" 
                              m={m} 
                              v={child.md[m]?.fech || 0} 
                              cd={child.cd} 
                              cat={child.cat} 
                              id={child.md[m]?.id} 
                              disabled={false} 
                            />
                          )}
                        </React.Fragment>
                      ))}
                      <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-605 bg-slate-50/30 tabular-nums">
                        {fmt(dynMonths.reduce((s, m) => s + (showFrac ? (child.md[m]?.frac || 0) : 0) + (showFech ? (child.md[m]?.fech || 0) : 0), 0))}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {/* REGIONAL */}
              <tr className="bg-slate-50/40">
                <td colSpan={2 + dynMonths.length * subColsCount + totalColsCount} className="py-1.5 px-4 border-b border-slate-100/60">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-3.5 bg-blue-400 rounded-sm" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Regional (REG)</span>
                  </div>
                </td>
              </tr>
              {regOutbound.map(r => (
                <React.Fragment key={r.id}>
                  <tr className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-2 px-4 font-bold text-[11px] text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {r.hasMultipleCategories ? (
                          <button 
                            onClick={() => setExpandedOutboundCds(prev => ({ ...prev, [r.cd]: !prev[r.cd] }))}
                            className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-500 shrink-0 cursor-pointer"
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedOutboundCds[r.cd] ? 'rotate-90 text-slate-805' : 'text-slate-400'}`} />
                          </button>
                        ) : (
                          <div className="w-5" />
                        )}
                        CD {r.cd}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium">{r.cat}</td>
                    {dynMonths.map(m => (
                      <React.Fragment key={m}>
                        {showFrac && (
                          <Cel 
                            rid={r.id} 
                            tp="frac" 
                            m={m} 
                            v={r.md[m]?.frac || 0} 
                            cd={r.cd} 
                            cat={r.cat} 
                            id={r.md[m]?.id} 
                            disabled={r.hasMultipleCategories} 
                          />
                        )}
                        {showFech && (
                          <Cel 
                            rid={r.id} 
                            tp="fech" 
                            m={m} 
                            v={r.md[m]?.fech || 0} 
                            cd={r.cd} 
                            cat={r.cat} 
                            id={r.md[m]?.id} 
                            disabled={r.hasMultipleCategories} 
                          />
                        )}
                      </React.Fragment>
                    ))}
                    <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-700 bg-slate-50/40 tabular-nums">
                      {fmt(dynMonths.reduce((s, m) => s + (showFrac ? (r.md[m]?.frac || 0) : 0) + (showFech ? (r.md[m]?.fech || 0) : 0), 0))}
                    </td>
                  </tr>
                  {r.hasMultipleCategories && expandedOutboundCds[r.cd] && r.children?.map((child: any) => (
                    <tr key={child.id} className="bg-slate-50/20 hover:bg-slate-50/40 transition-colors">
                      <td className="py-2 px-4 font-medium text-[11px] text-slate-500 pl-8">
                        <div className="flex items-center gap-1">
                          <span className="text-indigo-400 font-bold select-none mr-1">↳</span> CD {child.cd}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-center text-[10px] text-slate-400 font-medium bg-slate-50/5">{child.cat}</td>
                      {dynMonths.map(m => (
                        <React.Fragment key={m}>
                          {showFrac && (
                            <Cel 
                              rid={child.id} 
                              tp="frac" 
                              m={m} 
                              v={child.md[m]?.frac || 0} 
                              cd={child.cd} 
                              cat={child.cat} 
                              id={child.md[m]?.id} 
                              disabled={false} 
                            />
                          )}
                          {showFech && (
                            <Cel 
                              rid={child.id} 
                              tp="fech" 
                              m={m} 
                              v={child.md[m]?.fech || 0} 
                              cd={child.cd} 
                              cat={child.cat} 
                              id={child.md[m]?.id} 
                              disabled={false} 
                            />
                          )}
                        </React.Fragment>
                      ))}
                      <td className="py-2 px-4 text-right font-normal font-mono text-[11px] text-slate-605 bg-slate-50/30 tabular-nums">
                        {fmt(dynMonths.reduce((s, m) => s + (showFrac ? (child.md[m]?.frac || 0) : 0) + (showFech ? (child.md[m]?.fech || 0) : 0), 0))}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {/* TOTAL */}
              <tr className="bg-slate-50 text-slate-800 text-[11px] border-t border-slate-200">
                <td className="py-3 px-4 uppercase font-semibold tracking-wider text-slate-600">Total</td>
                <td className="py-3 text-center text-slate-400 font-normal">—</td>
                {dynMonths.map(m => (
                  <React.Fragment key={m}>
                    {showFrac && <td className="py-3 px-3.5 text-right font-mono text-slate-700 tabular-nums font-normal">{fmt(gtFOutbound[m] || 0)}</td>}
                    {showFech && <td className="py-3 px-3.5 text-right font-mono text-slate-700 tabular-nums font-normal">{fmt(gtEOutbound[m] || 0)}</td>}
                  </React.Fragment>
                ))}
                <td className="py-3 px-4 text-right font-mono text-slate-700 font-normal bg-slate-50 tabular-nums">
                  {fmt((showFrac ? tFOutbound : 0) + (showFech ? tEOutbound : 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const kpis = direction === "inbound" ? [
    { icon: Building, wrap: "bg-violet-100 text-violet-600", label: "Total Inbound", val: inboundView === "mes" ? tI : tWeeklyI },
    { icon: Layers, wrap: "bg-emerald-100 text-emerald-600", label: "Active View", val: inboundView === "mes" ? "Monthly" : "Weekly" },
    { icon: MapPin, wrap: "bg-blue-100 text-blue-600", label: "CDs Monitored", val: CD_LIST.length },
    { icon: Tag, wrap: "bg-amber-100 text-amber-600", label: "Active Filters", val: filt.length },
  ] : [
    { icon: Package, wrap: "bg-indigo-100 text-indigo-600", label: "Fractional", val: tFOutbound },
    { icon: Truck, wrap: "bg-sky-100 text-sky-600", label: "Closed", val: tEOutbound },
    { icon: Layers, wrap: "bg-violet-100 text-violet-600", label: "Total Outbound", val: tFOutbound + tEOutbound },
    { icon: Tag, wrap: "bg-amber-100 text-amber-600", label: "Records", val: filt.length },
  ];

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6 overflow-y-auto h-full scrollbar-thin">
      {notif && <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white pl-2.5 pr-3.5 py-2 rounded-lg shadow-lg text-[11px] flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-violet-400" />{notif}</div>}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-violet-50 text-violet-600 border border-violet-100"><Building className="w-5 h-5" /></span>
            <div>
              <span className="text-sm font-black text-slate-850 block leading-tight">Capacity by CD</span>
              <span className="text-[10px] text-slate-400 font-medium">{direction === "outbound" ? "Fractional & Closed" : `Inbound (${inboundView === "mes" ? "Monthly View" : "Weekly View"})`}</span>
            </div>
            <div className="flex bg-slate-100 border border-slate-200/60 rounded-xl p-1 ml-4">
              <button onClick={() => setDirection("inbound")} className={`px-4 py-2 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all duration-250 ${direction === "inbound" ? "bg-blue-600 text-white shadow-md font-bold" : "text-slate-500 hover:text-slate-800"}`}>Inbound</button>
              <button onClick={() => setDirection("outbound")} className={`px-4 py-2 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all duration-250 ${direction === "outbound" ? "bg-blue-600 text-white shadow-md font-bold" : "text-slate-500 hover:text-slate-800"}`}>Outbound</button>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
              <select value={ano} onChange={e => setAno(e.target.value)} className="text-xs bg-transparent border-none py-0.5 px-1 cursor-pointer font-semibold text-slate-600 hover:text-slate-800 focus:outline-none">
                {anosL.map(a => <option key={a} value={a}>{a === "Todos" ? "Year" : a}</option>)}
              </select>
              <span className="text-slate-200">|</span>
              <select value={mes} onChange={e => setMes(e.target.value)} className="text-xs bg-transparent border-none py-0.5 px-1 cursor-pointer font-semibold text-slate-600 hover:text-slate-800 focus:outline-none">
                <option value="Todos">Month</option>
                {mesesL.filter(m => m !== "Todos").map(m => <option key={m} value={m}>{MESES[m] || m}</option>)}
              </select>
              <span className="text-slate-200">|</span>
              <select value={cat} onChange={e => setCat(e.target.value)} className="text-xs bg-transparent border-none py-0.5 px-1 cursor-pointer max-w-[90px] font-semibold text-slate-600 hover:text-slate-800 focus:outline-none">
                <option value="Todas">Cat</option>
                {catsL.filter(c => c !== "Todas").map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-slate-200">|</span>
              <select
                value={cd}
                onChange={e => {
                  const newCd = e.target.value;
                  setCd(newCd);
                  if (newCd !== "Todos" && cat !== "Todas") {
                    const allowed = CATEGORIAS_POR_CD[newCd] || [];
                    if (!allowed.includes(cat)) {
                      setCat("Todas");
                    }
                  }
                }}
                className="text-xs bg-transparent border-none py-0.5 px-1 cursor-pointer font-semibold text-slate-600 hover:text-slate-800 focus:outline-none"
              >
                <option value="Todos">CD</option>
                {CD_LIST.map(c => <option key={c.cd} value={c.cd}>{c.cd}</option>)}
              </select>
            </div>
            <button onClick={() => load()} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95 transition-all" title="Sync">
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => setShowKpis(!showKpis)}
              className={`p-2 bg-white border rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1 text-xs font-bold cursor-pointer ${showKpis ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
              title={showKpis ? "Hide KPIs" : "Show KPIs"}
            >
              {showKpis ? <ChevronDown className="w-4 h-4 rotate-180 transition-transform duration-300" /> : <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">{showKpis ? "Hide Cards" : "Show Cards"}</span>
            </button>
            
            {/* BULK SUBMIT BUTTONS - Admin Only */}
            {isAdmin && direction === "inbound" && (
              <button 
                onClick={() => {
                  setBulkModal("inbound");
                  setBulkMes(mes !== "Todos" ? Number(mes) : 7);
                  setBulkCd(cd !== "Todos" ? Number(cd) : 101);
                  const categorias = CATEGORIAS_POR_CD[String(cd !== "Todos" ? cd : 101)] || ["Dry Foods"];
                  setBulkCategoria(categorias[0]);
                }}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Bulk Inbound Launch"
              >
                <Plus className="w-3.5 h-3.5" />
                Launch Inbound
              </button>
            )}
            
            {isAdmin && direction === "outbound" && (
              <>
                <button 
                  onClick={() => {
                    setBulkModal("outbound");
                    setBulkMes(mes !== "Todos" ? Number(mes) : 7);
                    setBulkCd(cd !== "Todos" ? Number(cd) : 101);
                    const categorias = CATEGORIAS_POR_CD[String(cd !== "Todos" ? cd : 101)] || ["Dry Foods"];
                    setBulkCategoria(categorias[0]);
                  }}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-blue-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Bulk Outbound Launch"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Launch Outbound
                </button>

                <button 
                  onClick={() => {
                    setShowAntecipacaoModal(true);
                    setAntecipacaoCd(cd !== "Todos" ? Number(cd) : 101);
                    const categorias = CATEGORIAS_POR_CD[String(cd !== "Todos" ? cd : 101)] || ["Dry Foods"];
                    setAntecipacaoCategoria(categorias[0]);
                    setAntecipacaoDataInicio("");
                    setAntecipacaoDataFim("");
                    setAntecipacaoQtd("");
                    setAntecipacaoError(null);
                  }}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Launch Outbound Anticipation"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Anticipation
                </button>
              </>
            )}

            {/* EXCEL DOWNLOAD */}
            <button 
              onClick={() => {
                setExcelAno(ano);
                setExcelMes(mes);
                setExcelCd(cd);
                setExcelCat(cat);
                setExcelDirection(direction === "inbound" ? "inbound" : "outbound");
                setShowExcelModal(true);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs hover:border-emerald-300 hover:text-emerald-700"
              title="Download Excel report with filter selection"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline text-[11px]">Excel</span>
            </button>

            {/* PRESENTATION */}
            <button 
              onClick={() => {
                setPresentationType(direction === "inbound" ? "inbound" : "outbound");
                setShowPresentationModal(true);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs hover:border-purple-300 hover:text-purple-700"
              title="Generate formatted table for email presentation"
            >
              <Presentation className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline text-[11px]">Presentation</span>
            </button>
            
            {direction === "outbound" && (
              <div className="flex bg-slate-100 border border-slate-200/60 rounded-xl p-1">
                <button onClick={() => setView("all")} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg ${view === "all" ? "bg-white shadow-sm text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}>All</button>
                <button onClick={() => setView("frac")} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg ${view === "frac" ? "bg-indigo-600 text-white font-extrabold shadow-sm" : "text-slate-500 hover:text-indigo-600"}`}>Frac.</button>
                <button onClick={() => setView("fech")} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg ${view === "fech" ? "bg-sky-600 text-white font-extrabold shadow-sm" : "text-slate-500 hover:text-sky-600"}`}>Closed</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showKpis && (
          <motion.div
            key="kpis-container"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-1">
              {kpis.map((k, i) => (
                <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                  <span className={`p-3.5 rounded-2xl shrink-0 ${k.wrap}`}><k.icon className="w-5 h-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">{k.label}</p>
                    <p className="text-base font-black font-mono text-slate-900 mt-1 leading-none">{typeof k.val === 'number' ? fmt(k.val) : k.val}</p>
                    <span className="text-[9px] text-slate-400 mt-1 block">Planned metrics</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && metas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 justify-center bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-bold">Loading capacity metrics...</span>
        </div>
      ) : filt.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-400 text-center space-y-3">
          <Info className="w-10 h-10 text-slate-350" />
          <p className="text-xs font-bold text-slate-700">No data available for the selected filters.</p>
          <p className="text-[10px] text-slate-450">Click the launch buttons above to create new capacity data.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {direction === "outbound" && (() => {
            const totalPending = dynMonths.reduce((acc, m) => acc + getPendingFracionadoForMonth(m, ano !== "Todos" ? Number(ano) : 2026).length, 0);
            if (totalPending === 0) return null;
            return (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 border border-amber-300/80 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4 text-amber-950 shadow-sm transition-all relative overflow-hidden">
                <div className="absolute -left-1 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-l-2xl" />
                <div className="flex items-center gap-3.5 pl-1">
                  <div className="p-2.5 bg-amber-500/20 text-amber-600 rounded-xl ring-1 ring-amber-400/30 flex items-center justify-center shrink-0 shadow-2xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-950 uppercase tracking-wider">Pending Capacities</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/80 text-amber-800 border border-amber-300/60 shadow-2xs">Action Required</span>
                    </div>
                    <p className="text-[11px] text-amber-900/90 font-medium mt-0.5">
                      <strong className="font-extrabold text-amber-950 bg-amber-200/60 px-1.5 py-0.5 rounded-md border border-amber-300/40">{totalPending} CD(s)</strong> pending fractional capacity.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {dynMonths.map(m => {
                    const pending = getPendingFracionadoForMonth(m, ano !== "Todos" ? Number(ano) : 2026);
                    if (pending.length === 0) return null;
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          setPendingFracModal({ month: m, items: pending });
                          setSelectedFracItem(null);
                        }}
                        className="group px-3 py-1.5 bg-white hover:bg-amber-500 hover:text-white text-amber-900 border border-amber-300/80 hover:border-amber-500 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs hover:shadow-md hover:shadow-amber-500/20"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 group-hover:text-white transition-colors" />
                        <span>{getMonthLabel(m)}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 group-hover:bg-amber-600 text-amber-800 group-hover:text-white text-[10px] font-extrabold transition-colors">
                          {pending.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {direction === "inbound" ? (
            <TblInbound titulo="Inbound Capacity" />
          ) : (
            <TblOutbound titulo="Outbound Capacity" />
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 transform animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${edit.tp === "frac" ? "bg-indigo-50 border-indigo-100 text-indigo-600" : edit.tp === "fech" ? "bg-sky-50 border-sky-100 text-sky-600" : "bg-violet-50 border-violet-100 text-violet-600"}`}>
                  {edit.tp === "frac" ? <Package className="w-4.5 h-4.5" /> : edit.tp === "fech" ? <Truck className="w-4.5 h-4.5" /> : <Building className="w-4.5 h-4.5" />}
                </div>
                <div>
                  <span className="text-sm font-extrabold text-slate-850 block leading-tight">{edit.semana !== undefined ? "Edit Week" : "Edit Month"}</span>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">CD {edit.cd} • {edit.cat}</p>
                </div>
              </div>
              <button onClick={() => setEdit(null)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-4.5 h-4.5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex justify-between"><span className="text-slate-400 font-semibold">Month</span><span className="font-extrabold text-slate-700">{getMonthLabel(edit.m)}</span></div>
                {edit.semana !== undefined && (
                  <div className="flex justify-between"><span className="text-slate-400 font-semibold">Week</span><span className="font-extrabold text-violet-600">Week {edit.semana}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-400 font-semibold">Flow</span><span className="font-extrabold text-slate-700">{edit.tp === "frac" ? "Fractional" : edit.tp === "fech" ? "Closed" : "Inbound"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400 font-semibold">Current Value</span><span className="font-mono font-black text-slate-800">{fmt(edit.v)}</span></div>
              </div>
              {editError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-800 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="text-[11px] leading-relaxed">
                    <p className="font-extrabold">Error saving</p>
                    <p className="text-rose-700 mt-0.5">{editError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">New Value (units)</label>
                <input
                  type="text"
                  autoFocus
                  value={edit.nv}
                  onChange={e => setEdit((p: any) => p ? { ...p, nv: e.target.value.replace(/\D/g, "") } : null)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black font-mono text-center focus:outline-none focus:ring-2 focus:ring-violet-400/60 focus:border-violet-400 focus:bg-white transition-all shadow-sm"
                  placeholder="0"
                />
              </div>

              {direction === "outbound" && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useEditStartDate}
                      onChange={e => {
                        const checked = e.target.checked;
                        setUseEditStartDate(checked);
                        if (checked && !editStartDate) {
                          const formattedMonth = String(edit.m).padStart(2, "0");
                          setEditStartDate(`2026-${formattedMonth}-01`);
                        }
                      }}
                      className="rounded text-violet-600 focus:ring-violet-400 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                      Change from specific day?
                    </span>
                  </label>
                  
                  {useEditStartDate && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5 font-bold">
                        <Calendar className="w-3 h-3 text-slate-400" /> Start Date
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={e => setEditStartDate(e.target.value)}
                        min={`2026-${String(edit.m).padStart(2, "0")}-01`}
                        max={`2026-${String(edit.m).padStart(2, "0")}-${new Date(2026, edit.m, 0).getDate()}`}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 font-mono"
                      />
                      <span className="text-[9.5px] text-amber-600 font-medium block leading-snug">
                        * Change will affect from the selected day onwards.
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2.5 pt-2">
                <button onClick={() => setEdit(null)} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                <button
                  onClick={save}
                  disabled={loading}
                  className={`px-4.5 py-2 text-xs font-black text-white rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 ${
                    edit.semana !== undefined ? "bg-violet-600 hover:bg-violet-700" : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {edit.semana !== undefined ? "Update Week" : "Update Month"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK MODAL */}
      {bulkModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 transform animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${bulkModal === "outbound" ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-violet-50 border-violet-100 text-violet-600"}`}>
                  {bulkModal === "outbound" ? <Truck className="w-4.5 h-4.5" /> : <Building className="w-4.5 h-4.5" />}
                </div>
                <div>
                  <span className="text-sm font-extrabold text-slate-850 block leading-tight">
                    {bulkModal === "outbound" ? "Launch Outbound" : "Launch Inbound"}
                  </span>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">New capacity planning</p>
                </div>
              </div>
              <button onClick={() => setBulkModal(null)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-4.5 h-4.5 text-slate-400" /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
              {showContinuePrompt ? (
                <div className="py-4 px-2 text-center space-y-4 animate-in fade-in duration-200 max-w-md mx-auto">
                  <div className="w-12 h-12 bg-emerald-50 border border-emerald-200/80 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-850">Submission Successful!</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{lastSavedInfo}</p>
                  </div>
                  
                  <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-violet-950">Continue Submitting?</p>
                    <p className="text-[10px] text-violet-600 font-medium">Do you want to make another {bulkModal === "outbound" ? "Outbound" : "Inbound"} submission?</p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowContinuePrompt(false);
                        setBulkModal(null);
                      }}
                      className="px-5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer active:scale-95"
                    >
                      No (Close)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowContinuePrompt(false);
                      }}
                      className="px-5 py-2 text-xs font-black text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Yes (Continue)
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {bulkError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-800 animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <div className="text-[11px] leading-relaxed">
                        <p className="font-extrabold">Operation Error</p>
                        <p className="text-rose-700 mt-0.5">{bulkError}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 block">Year</label>
                      <select 
                        value={bulkAno} 
                        onChange={e => setBulkAno(Number(e.target.value))} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 block">Month</label>
                      <select 
                        value={bulkMes} 
                        onChange={e => setBulkMes(Number(e.target.value))} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{getMonthLabel(m)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 block">Distribution Center (CD)</label>
                      <select 
                        value={bulkCd} 
                        onChange={(e) => {
                          const newCd = Number(e.target.value);
                          setBulkCd(newCd);
                          const categorias = CATEGORIAS_POR_CD[String(newCd)] || ["Dry Foods"];
                          setBulkCategoria(categorias[0]);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        {CD_LIST.map(c => (
                          <option key={c.cd} value={c.cd}>CD {c.cd} ({c.group})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 block">Category</label>
                      <select 
                        value={bulkCategoria} 
                        onChange={e => setBulkCategoria(e.target.value)} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        {(CATEGORIAS_POR_CD[String(bulkCd)] || ["Dry Foods"]).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <p className="text-[8px] text-slate-400 mt-0.5">Categories available for the selected CD</p>
                    </div>
                  </div>

                  {bulkModal === "outbound" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 block">Fractional Capacity (units)</label>
                        <input 
                          type="text" 
                          value={bulkCapFracionada} 
                          onChange={e => setBulkCapFracionada(e.target.value.replace(/\D/g, ""))} 
                          placeholder="0"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 block">Closed Capacity (units)</label>
                        <input 
                          type="text" 
                          value={bulkCapFechada} 
                          onChange={e => setBulkCapFechada(e.target.value.replace(/\D/g, ""))} 
                          placeholder="0"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                    </div>
                  )}

                  {bulkModal === "inbound" && (
                    <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <div>
                          <label className="text-[10px] uppercase font-extrabold tracking-wider text-violet-700 block">
                            Inbound Capacity per Week
                          </label>
                          <p className="text-[10px] text-slate-500 font-medium">Enter Inbound capacity for each desired week</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200/70">
                          {getWeeksInMonth(bulkAno || 2026, bulkMes)} weeks in {getMonthLabel(bulkMes)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 p-2 bg-violet-50/50 rounded-lg border border-violet-100/80">
                        <span className="text-[11px] font-semibold text-violet-900 shrink-0">Apply value to all:</span>
                        <input 
                          type="text"
                          placeholder="Ex: 5000"
                          value={replicateValue}
                          onChange={e => setReplicateValue(e.target.value.replace(/\D/g, ""))}
                          className="w-28 px-2.5 py-1 bg-white border border-violet-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!replicateValue) return;
                            const numWeeks = getWeeksInMonth(bulkAno || 2026, bulkMes);
                            const newWeeksMap: Record<number, string> = {};
                            const selected: number[] = [];
                            for (let w = 1; w <= numWeeks; w++) {
                              newWeeksMap[w] = replicateValue;
                              selected.push(w);
                            }
                            setBulkCapInboundWeeks(newWeeksMap);
                            setBulkSelectedWeeks(selected);
                          }}
                          className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          Apply to All
                        </button>
                      </div>

                      {(() => {
                        const numWeeks = getWeeksInMonth(bulkAno || 2026, bulkMes);
                        const isAllSelected = bulkSelectedWeeks.length === numWeeks;
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between pt-1">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isAllSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBulkSelectedWeeks(Array.from({ length: numWeeks }, (_, i) => i + 1));
                                    } else {
                                      setBulkSelectedWeeks([]);
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-violet-600 rounded border-slate-300/80 focus:ring-1 focus:ring-violet-400 cursor-pointer accent-violet-600 opacity-80 hover:opacity-100 transition-opacity"
                                />
                                <span className="text-xs font-bold text-slate-700">Select All Weeks</span>
                              </label>
                            </div>

                            <div className="space-y-2 pt-1">
                              {Array.from({ length: numWeeks }, (_, i) => i + 1).map(w => {
                                const isChecked = bulkSelectedWeeks.includes(w);
                                const val = bulkCapInboundWeeks[w] || "";
                                return (
                                  <div
                                    key={w}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                      isChecked 
                                        ? "bg-white border-violet-200/90 shadow-2xs" 
                                        : "bg-slate-100/50 border-slate-200/60 opacity-60"
                                    }`}
                                  >
                                    <label className="flex items-center gap-2 cursor-pointer shrink-0 w-28">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setBulkSelectedWeeks(prev => prev.filter(x => x !== w));
                                          } else {
                                            setBulkSelectedWeeks(prev => [...prev, w].sort((a,b) => a - b));
                                          }
                                        }}
                                        className="w-3.5 h-3.5 text-violet-600 rounded border-slate-300/80 focus:ring-1 focus:ring-violet-400 cursor-pointer accent-violet-600 opacity-80 hover:opacity-100 transition-opacity"
                                      />
                                      <span className="text-xs font-bold text-slate-800">Week {w}</span>
                                    </label>

                                    <div className="flex-1 flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={val}
                                        disabled={!isChecked}
                                        onChange={e => {
                                          const cleanVal = e.target.value.replace(/\D/g, "");
                                          setBulkCapInboundWeeks(prev => ({ ...prev, [w]: cleanVal }));
                                          if (!isChecked) {
                                            setBulkSelectedWeeks(prev => [...prev, w].sort((a,b) => a - b));
                                          }
                                        }}
                                        placeholder="0"
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-100 disabled:text-slate-400"
                                      />
                                      <span className="text-[10px] font-bold text-slate-400 shrink-0">units</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <p className="text-[10px] text-slate-500 font-medium pt-1">
                              {bulkSelectedWeeks.length === 0 ? (
                                <span className="text-rose-600 font-bold">⚠️ Select at least one week and enter its value.</span>
                              ) : (
                                `Submission configured for ${bulkSelectedWeeks.length} week(s) of ${getMonthLabel(bulkMes)}.`
                              )}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-4 border-t">
                    <button onClick={() => setBulkModal(null)} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                    <button 
                      onClick={saveBulk} 
                      disabled={loading}
                      className={`px-4.5 py-2 text-xs font-black text-white rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 ${
                        bulkModal === "outbound" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-violet-600 hover:bg-violet-700"
                      }`}
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          {bulkModal === "outbound" ? "Launch Outbound" : "Launch Inbound"}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PENDING FRACIONADO MODAL */}
      {pendingFracModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 transform animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-black text-slate-850 block leading-tight">
                    Pending CDs - Fractional
                  </span>
                  <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                    Month of {getMonthLabel(pendingFracModal.month)} • {pendingFracModal.items.length} pending(s)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPendingFracModal(null);
                  setSelectedFracItem(null);
                }}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
              {!selectedFracItem ? (
                <>
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                    Select one of the pending CDs below to open the exclusive fractional capacity form for {getMonthLabel(pendingFracModal.month)}:
                  </p>

                  <div className="space-y-2.5">
                    {pendingFracModal.items.map((item, idx) => (
                      <div
                        key={`${item.cd}-${item.cat}-${idx}`}
                        onClick={() => {
                          setSelectedFracItem({
                            month: pendingFracModal.month,
                            cd: item.cd,
                            cat: item.cat,
                            group: item.group,
                            id: item.id,
                            currentVal: item.currentVal
                          });
                          setFracValueInput(item.currentVal > 0 ? String(item.currentVal) : "");
                          setFracError(null);
                        }}
                        className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-xl flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-md text-xs font-mono font-bold border border-slate-300/60 shrink-0">
                            CD {item.cd}
                          </span>
                          <div>
                            <span className="text-xs font-extrabold text-slate-800 block">
                              {item.cat}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Group: {item.group} • {item.currentVal > 0 ? `${item.currentVal.toLocaleString('pt-BR')} units` : 'Pending (0 units)'}
                            </span>
                          </div>
                        </div>

                        <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all group-hover:scale-105 cursor-pointer shrink-0">
                          <span>Fill</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <button
                    onClick={() => setSelectedFracItem(null)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer mb-2"
                  >
                    ← Back to pending CDs list
                  </button>

                  <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3.5 text-xs space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-500 font-semibold">CD</span><span className="font-extrabold text-slate-800">CD {selectedFracItem.cd} ({selectedFracItem.group})</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-semibold">Category</span><span className="font-extrabold text-indigo-700">{selectedFracItem.cat}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-semibold">Month</span><span className="font-extrabold text-slate-700">{getMonthLabel(selectedFracItem.month)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 font-semibold">Field</span><span className="font-mono font-extrabold text-indigo-600">Fractional Capacity ONLY</span></div>
                  </div>

                  {fracError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-rose-800 text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{fracError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block">
                      Fractional Capacity (units)
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={fracValueInput}
                      onChange={e => setFracValueInput(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black font-mono text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 shadow-xs"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-slate-400 block text-center">
                      Enter the fractional capacity value for this CD.
                    </span>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => setSelectedFracItem(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={saveSingleFracionado}
                      disabled={fracSaving}
                      className="px-5 py-5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      {fracSaving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Save Fractional
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRESENTATION MODAL */}
      {showPresentationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 border border-purple-100 rounded-xl text-purple-600">
                  <Presentation className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-850">Email Presentation</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Formatted table ready to copy and paste into email</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPresentationModal(false)}
                className="p-1.5 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-3 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">Data Type</label>
                  <div className="flex bg-slate-200/70 p-1 rounded-xl">
                    <button
                      onClick={() => {
                        setPresentationType("inbound");
                        setPresentationMessage("Good morning, here are the inbound data:");
                      }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${presentationType === "inbound" ? "bg-white text-violet-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      Inbound
                    </button>
                    <button
                      onClick={() => {
                        setPresentationType("outbound");
                        setPresentationMessage("Good morning, here are the outbound data:");
                      }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${presentationType === "outbound" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      Outbound
                    </button>
                    <button
                      onClick={() => {
                        setPresentationType("both");
                        setPresentationMessage("Good morning, here are the inbound and outbound data:");
                      }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${presentationType === "both" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      Both
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">Greeting Message</label>
                  <input
                    type="text"
                    value={presentationMessage}
                    onChange={e => setPresentationMessage(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800"
                    placeholder="Ex: Good morning, here are the inbound and outbound data"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto grow space-y-4 bg-slate-100/60 scrollbar-thin">
              <div 
                ref={presentationRef}
                id="presentation-email-content"
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs font-sans text-slate-800 text-xs leading-relaxed"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>
                  {presentationMessage}
                </p>

                {/* INBOUND TABLE */}
                {(presentationType === "inbound" || presentationType === "both") && (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#6d28d9', letterSpacing: '0.5px' }}>
                      Inbound Capacity
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>CD</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>Group</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>Category</th>
                          {dynMonths.map(m => (
                            <th key={m} style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                              {getMonthLabel(m)}
                            </th>
                          ))}
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#e2e8f0' }}>Total Inbound</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.filter(r => !r.isChild).map(r => {
                          let rowSum = 0;
                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', fontWeight: 'bold' }}>{r.cd}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{r.group}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{r.cat}</td>
                              {dynMonths.map(m => {
                                const val = r.md[m]?.inbound || 0;
                                rowSum += val;
                                return (
                                  <td key={m} style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                    {fmt(val)}
                                  </td>
                                );
                              })}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#f8fafc' }}>
                                {fmt(rowSum)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                          <td colSpan={3} style={{ border: '1px solid #cbd5e1', padding: '8px 10px' }}>TOTAL INBOUND</td>
                          {dynMonths.map(m => (
                            <td key={m} style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {fmt(gtI[m] || 0)}
                            </td>
                          ))}
                          <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#6d28d9', backgroundColor: '#ddd6fe' }}>
                            {fmt(dynMonths.reduce((sum, m) => sum + (gtI[m] || 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* OUTBOUND TABLE */}
                {(presentationType === "outbound" || presentationType === "both") && (
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#4338ca', letterSpacing: '0.5px' }}>
                      Outbound Capacity
                    </h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', color: '#1e293b' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>CD</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>Group</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>Category</th>
                          {dynMonths.map(m => (
                            <th key={m} colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>
                              {getMonthLabel(m)}
                            </th>
                          ))}
                          <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#e2e8f0' }}>Total Outbound</th>
                        </tr>
                        <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontSize: '10px' }}>
                          <th colSpan={3} style={{ border: '1px solid #cbd5e1' }}></th>
                          {dynMonths.map(m => (
                            <React.Fragment key={m}>
                              <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right' }}>Frac.</th>
                              <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right' }}>Closed</th>
                            </React.Fragment>
                          ))}
                          <th style={{ border: '1px solid #cbd5e1' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {outboundRows.filter(r => !r.isChild).map(r => {
                          let rowSum = 0;
                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', fontWeight: 'bold' }}>{r.cd}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{r.group}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px' }}>{r.cat}</td>
                              {dynMonths.map(m => {
                                const frac = r.md[m]?.frac || 0;
                                const fech = r.md[m]?.fech || 0;
                                rowSum += frac + fech;
                                return (
                                  <React.Fragment key={m}>
                                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                      {fmt(frac)}
                                    </td>
                                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                      {fmt(fech)}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: '#f8fafc' }}>
                                {fmt(rowSum)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                          <td colSpan={3} style={{ border: '1px solid #cbd5e1', padding: '8px 10px' }}>TOTAL OUTBOUND</td>
                          {dynMonths.map(m => (
                            <React.Fragment key={m}>
                              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {fmt(gtFOutbound[m] || 0)}
                              </td>
                              <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                {fmt(gtEOutbound[m] || 0)}
                              </td>
                            </React.Fragment>
                          ))}
                          <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#4338ca', backgroundColor: '#c7d2fe' }}>
                            {fmt(dynMonths.reduce((sum, m) => sum + (gtFOutbound[m] || 0) + (gtEOutbound[m] || 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 flex-wrap gap-3">
              <span className="text-[11px] text-slate-500 font-medium hidden lg:inline">
                Choose to copy as formatted table for email or as PNG image to paste directly.
              </span>
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <button
                  type="button"
                  onClick={() => setShowPresentationModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={copyPresentationToClipboard}
                  className="px-4 py-2 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  title="Copy formatted table for Outlook or Gmail"
                >
                  {copiedPresentation ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Table (Email)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={copyPresentationAsImage}
                  disabled={copyingImage}
                  className="px-4 py-2 text-xs font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  title="Capture presentation as image and copy to clipboard"
                >
                  {copyingImage ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                  ) : copiedImageStatus ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Image className="w-4 h-4" />
                  )}
                  {copiedImageStatus || "Copy Image (PNG)"}
                </button>

                <button
                  type="button"
                  onClick={downloadPresentationAsImage}
                  className="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                  title="Download presentation as PNG image"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  Download PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL EXPORT MODAL */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-850">Export to Excel (.xlsx)</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Choose filters and flow to customize your report</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExcelModal(false)}
                className="p-1.5 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">Data Flow</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setExcelDirection("inbound")}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${excelDirection === "inbound" ? "bg-white text-blue-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Inbound Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcelDirection("outbound")}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${excelDirection === "outbound" ? "bg-white text-indigo-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Outbound Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcelDirection("both")}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${excelDirection === "both" ? "bg-white text-emerald-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Both
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Month</label>
                  <select
                    value={excelMes}
                    onChange={e => setExcelMes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Todos">All Months</option>
                    {mesesL.filter(m => m !== "Todos").map(m => (
                      <option key={m} value={m}>{MESES[m] || m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Distribution Center</label>
                  <select
                    value={excelCd}
                    onChange={e => {
                      const newCd = e.target.value;
                      setExcelCd(newCd);
                      if (newCd !== "Todos" && excelCat !== "Todas") {
                        const allowed = CATEGORIAS_POR_CD[newCd] || [];
                        if (!allowed.includes(excelCat)) {
                          setExcelCat("Todas");
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Todos">All CDs</option>
                    {CD_LIST.map(c => (
                      <option key={c.cd} value={c.cd}>CD {c.cd} ({c.group})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Year</label>
                  <select
                    value={excelAno}
                    onChange={e => setExcelAno(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Todos">All Years</option>
                    {anosL.filter(a => a !== "Todos").map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Category</label>
                  <select
                    value={excelCat}
                    onChange={e => setExcelCat(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Todas">All Categories</option>
                    {(excelCd !== "Todos" ? (CATEGORIAS_POR_CD[excelCd] || []) : catsL.filter(c => c !== "Todas")).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={exportToExcelWithFilters}
                className="px-5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ANTICIPATION MODAL */}
      {showAntecipacaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/80 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-850">Launch Outbound Anticipation</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Fill in the outbound capacity for the requested period</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAntecipacaoModal(false)}
                className="p-1.5 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {antecipacaoError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{antecipacaoError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                    Distribution Center (CD)
                  </label>
                  <select
                    value={antecipacaoCd}
                    onChange={e => {
                      const selected = Number(e.target.value);
                      setAntecipacaoCd(selected);
                      const catList = CATEGORIAS_POR_CD[String(selected)] || ["Dry Foods"];
                      setAntecipacaoCategoria(catList[0]);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {CD_LIST.map(c => (
                      <option key={c.cd} value={c.cd}>CD {c.cd} ({c.group})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                    Category
                  </label>
                  <select
                    value={antecipacaoCategoria}
                    onChange={e => setAntecipacaoCategoria(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {(CATEGORIAS_POR_CD[String(antecipacaoCd)] || ["Dry Foods"]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={antecipacaoDataInicio}
                    onChange={e => setAntecipacaoDataInicio(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={antecipacaoDataFim}
                    onChange={e => setAntecipacaoDataFim(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Anticipation Quantity
                </label>
                <input
                  type="text"
                  value={antecipacaoQtd}
                  onChange={e => setAntecipacaoQtd(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ex: 1500"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAntecipacaoModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAntecipacao}
                disabled={antecipacaoSaving}
                className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                {antecipacaoSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Save Anticipation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}