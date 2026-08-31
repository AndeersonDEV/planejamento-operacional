import React, { useState, useEffect } from "react";
import { X, Save, ShieldAlert, Calendar, AlertCircle } from "lucide-react";
import { Capacidade } from "../types";

interface EditCapacityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: number;
    monthKey?: string;
    capacidadeInbound?: number | null;
    capacidadeOutboundFracionado?: number | null;
    capacidadeOutboundFechado?: number | null;
    recebimentoRemunerado?: number | null;
    cd?: number;
    categoria?: string;
  }) => void;
  editMode: "inbound" | "outbound";
  targetDay?: { 
    id: number; 
    dateStr: string; 
    capacidadeInbound: number | null; 
    recebimentoRemunerado?: number | null;
  };
  targetMonth?: { monthKey: string; monthName: string; capacidadeOutboundFracionado: number; capacidadeOutboundFechado: number; cd: number; categoria: string };
}

export default function EditCapacityModal({
  isOpen,
  onClose,
  onSave,
  editMode,
  targetDay,
  targetMonth,
}: EditCapacityModalProps) {
  const [valInbound, setValInbound] = useState<string>("");
  const [valFracionado, setValFracionado] = useState<string>("");
  const [valFechado, setValFechado] = useState<string>("");
  const [hasRemunerada, setHasRemunerada] = useState<boolean>(false);
  const [valRemunerada, setValRemunerada] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editMode === "inbound" && targetDay) {
      setValInbound(targetDay.capacidadeInbound !== null ? String(targetDay.capacidadeInbound) : "");
      const rem = targetDay.recebimentoRemunerado;
      if (rem !== undefined && rem !== null && rem > 0) {
        setHasRemunerada(true);
        setValRemunerada(String(rem));
      } else {
        setHasRemunerada(false);
        setValRemunerada("");
      }
    } else if (editMode === "outbound" && targetMonth) {
      setValFracionado(targetMonth.capacidadeOutboundFracionado !== null ? String(targetMonth.capacidadeOutboundFracionado) : "");
      setValFechado(targetMonth.capacidadeOutboundFechado !== null ? String(targetMonth.capacidadeOutboundFechado) : "");
    }
  }, [editMode, targetDay, targetMonth, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      if (editMode === "inbound" && targetDay) {
        onSave({
          id: targetDay.id,
          capacidadeInbound: valInbound === "" ? null : Number(valInbound),
          recebimentoRemunerado: hasRemunerada && valRemunerada !== "" ? Number(valRemunerada) : null,
        });
      } else if (editMode === "outbound" && targetMonth) {
        onSave({
          monthKey: targetMonth.monthKey,
          capacidadeOutboundFracionado: valFracionado === "" ? null : Number(valFracionado),
          capacidadeOutboundFechado: valFechado === "" ? null : Number(valFechado),
          cd: targetMonth.cd,
          categoria: targetMonth.categoria,
        });
      }
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${editMode === "inbound" ? "bg-blue-50 border border-blue-100 text-blue-600" : "bg-indigo-50 border border-indigo-100 text-indigo-600"}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 leading-tight">
                Editar Capacidade
              </h3>
              <p className="text-[11px] text-slate-500">
                Ação restrita de nível administrador (anderson)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {editMode === "inbound" && targetDay && (
            <div className="bg-blue-50/60 border border-blue-100 p-3.5 rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <div className="text-xs">
                <p className="text-slate-500">Tipo de Fluxo: <strong className="text-blue-600">Inbound (Edição Diária)</strong></p>
                <p className="text-slate-700 mt-0.5">Dia selecionado: <strong>{targetDay.dateStr}</strong></p>
              </div>
            </div>
          )}

          {editMode === "outbound" && targetMonth && (
            <div className="bg-indigo-50/60 border border-indigo-100 p-3.5 rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <div className="text-xs">
                <p className="text-slate-500">Tipo de Fluxo: <strong className="text-indigo-600">Outbound (Edição Mensal)</strong></p>
                <p className="text-slate-700 mt-0.5">Mês selecionado: <strong>{targetMonth.monthName}</strong></p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          {editMode === "inbound" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Capacidade Inbound (Unidades)
                </label>
                <input
                  type="number"
                  value={valInbound}
                  onChange={(e) => setValInbound(e.target.value)}
                  placeholder="Ex: 120000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm font-mono transition-all"
                />
              </div>

              {/* Opção de Inserir remuneradas */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3.5 shadow-inner">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasRemunerada}
                    onChange={(e) => {
                      setHasRemunerada(e.target.checked);
                      if (!e.target.checked) setValRemunerada("");
                    }}
                    className="mt-0.5 w-3.5 h-3.5 text-emerald-600 border-slate-300/80 rounded focus:ring-1 focus:ring-emerald-400 cursor-pointer accent-emerald-600 opacity-80 hover:opacity-100 transition-opacity"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Inserir remuneradas</span>
                    <span className="text-[10px] text-slate-500 block leading-relaxed font-medium">Habilitar acionamento de capacidade extra remunerada para este dia de recebimento.</span>
                  </div>
                </label>

                {hasRemunerada && (
                  <div className="space-y-2 pt-2.5 border-t border-slate-200/60 transition-all duration-300 animate-in fade-in slide-in-from-top-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Valor da Capacidade Remunerada (Unidades)
                    </label>
                    <input
                      type="number"
                      value={valRemunerada}
                      onChange={(e) => setValRemunerada(e.target.value)}
                      placeholder="Ex: 15000"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 rounded-xl text-slate-800 focus:outline-none text-xs font-mono transition-all"
                      required={hasRemunerada}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Capacidade Outbound Fracionado
                </label>
                <input
                  type="number"
                  value={valFracionado}
                  onChange={(e) => setValFracionado(e.target.value)}
                  placeholder="Ex: 155000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-mono transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Capacidade Outbound Fechado
                </label>
                <input
                  type="number"
                  value={valFechado}
                  onChange={(e) => setValFechado(e.target.value)}
                  placeholder="Ex: 95000"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-mono transition-all"
                />
              </div>
              <div className="text-[10px] text-slate-500 leading-normal flex gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                <span>Alterar este valor mensal atualizará em cascata todos os dias cadastrados para este mês.</span>
              </div>
            </div>
          )}

          {/* Buttons */}
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
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10"
              }`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
