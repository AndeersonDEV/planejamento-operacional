import React, { useState, useEffect } from "react";
import { X, Save, Calendar, Building, Layers, Sparkles } from "lucide-react";
import { CATEGORIAS_POR_CD, CDS_LIST } from "../mockData";

interface EditMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    ano: number;
    mes: number;
    cd: number;
    categoria: string;
    capacidadeInbound?: number;
    capacidadeFracionada?: number;
    capacidadeFechada?: number;
  }) => Promise<void> | void;
  editMode: "inbound" | "outbound";
}

const CDS = CDS_LIST.map((c) => c.id);
const MESES = [
  { val: 1, label: "Janeiro" },
  { val: 2, label: "Fevereiro" },
  { val: 3, label: "Março" },
  { val: 4, label: "Abril" },
  { val: 5, label: "Maio" },
  { val: 6, label: "Junho" },
  { val: 7, label: "Julho" },
  { val: 8, label: "Agosto" },
  { val: 9, label: "Setembro" },
  { val: 10, label: "Outubro" },
  { val: 11, label: "Novembro" },
  { val: 12, label: "Dezembro" },
];

export default function EditMonthModal({ isOpen, onClose, onSave, editMode }: EditMonthModalProps) {
  const [ano, setAno] = useState<number>(2026);
  const [mes, setMes] = useState<number>(7);
  const [cd, setCd] = useState<number>(101);
  const [categoria, setCategoria] = useState<string>("Alimentos Secos");
  const [valInbound, setValInbound] = useState<string>("");
  const [valFracionado, setValFracionado] = useState<string>("");
  const [valFechado, setValFechado] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAno(2026);
      setMes(7);
      setCd(101);
      setCategoria(CATEGORIAS_POR_CD["101"] ? CATEGORIAS_POR_CD["101"][0] : "Geral");
      setValInbound("");
      setValFracionado("");
      setValFechado("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: any = {
      ano,
      mes,
      cd,
      categoria,
    };

    if (editMode === "inbound") {
      const val = Number(valInbound);
      payload.capacidadeInbound = isNaN(val) || valInbound.trim() === "" ? 0 : val;
    } else {
      const frac = Number(valFracionado);
      const fech = Number(valFechado);
      payload.capacidadeFracionada = isNaN(frac) || valFracionado.trim() === "" ? 0 : frac;
      payload.capacidadeFechada = isNaN(fech) || valFechado.trim() === "" ? 0 : fech;
    }

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error("Erro ao salvar no EditMonthModal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const accentColor = editMode === "inbound" ? "blue" : "purple";
  const headerAccentClass = editMode === "inbound" 
    ? "bg-blue-50 border border-blue-100 text-blue-600" 
    : "bg-purple-50 border border-purple-100 text-purple-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-150 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${headerAccentClass}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">
                Definir Meta Mensal - {editMode === "inbound" ? "Inbound" : "Outbound"}
              </h3>
              <p className="text-[11px] text-slate-500">
                Planejamento estratégico de metas operacionais consolidado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Ano */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1 font-mono">
                Ano Referência
              </label>
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer shadow-sm focus:border-slate-400 outline-none"
              >
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            {/* Mês */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1 font-mono">
                Mês Referência
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer shadow-sm focus:border-slate-400 outline-none"
              >
                {MESES.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* CD */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1 font-mono">
                <Building className="w-3 h-3 text-slate-400 inline" /> Centro de Distribuição
              </label>
              <select
                value={cd}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCd(val);
                  const allowed = CATEGORIAS_POR_CD[String(val)] || ["Mercearia"];
                  setCategoria(allowed[0]);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer shadow-sm focus:border-slate-400 outline-none"
              >
                {CDS.map((c) => (
                  <option key={c} value={c}>
                    CD {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1 font-mono">
                <Layers className="w-3 h-3 text-slate-400 inline" /> Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer shadow-sm focus:border-slate-400 outline-none"
              >
                {(CATEGORIAS_POR_CD[String(cd)] || ["Mercearia"]).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Valor Inputs */}
          {editMode === "inbound" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Meta Capacidade Inbound (Unidades)
              </label>
              <input
                type="number"
                value={valInbound}
                onChange={(e) => setValInbound(e.target.value)}
                placeholder="Ex: 120000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-mono transition-all"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Meta Fracionada
                </label>
                <input
                  type="number"
                  value={valFracionado}
                  onChange={(e) => setValFracionado(e.target.value)}
                  placeholder="Ex: 155000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/10 text-sm font-mono transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Meta Fechada
                </label>
                <input
                  type="number"
                  value={valFechado}
                  onChange={(e) => setValFechado(e.target.value)}
                  placeholder="Ex: 95000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-purple-500 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/10 text-sm font-mono transition-all"
                />
              </div>
            </div>
          )}

          {/* Informational Hint */}
          <div className="text-[10px] text-slate-500 leading-normal flex gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-150">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
            <span>
              Ao salvar, esta meta mensal servirá como diretriz de capacidade para o CD e Categoria selecionados, refletindo diretamente no painel consolidado e nos relatórios de desempenho.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2.5 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                editMode === "inbound"
                  ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/10"
                  : "bg-purple-600 hover:bg-purple-700 shadow-purple-500/10"
              }`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar Meta
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
