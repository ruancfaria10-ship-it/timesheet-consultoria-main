import { useState, useMemo } from "react";
import type { TimeEntry as BaseTimeEntry } from "@/lib/mock-data";
type TimeEntry = BaseTimeEntry & { os_id?: string, contractName?: string, activity?: string, contractId?: string };
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Clock, Trash2 } from "lucide-react";

export function RetroHistoryList({
  entries, contracts, osList, allocations, panelDate, onEdit, onDelete,
}: {
  entries: TimeEntry[]; contracts: any[]; osList: any[]; allocations: any[]; panelDate: string;
  onEdit: (id: string, start: number, end: number, notes: string, contractId?: string, osId?: string | null, activity?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editNotes, setEditNotes] = useState("");
  
  const [editContractId, setEditContractId] = useState("");
  const [editOsId, setEditOsId] = useState("");
  const [editActivity, setEditActivity] = useState("");

  const formatTimeToHHMM = (timestamp: number): string => {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const getTimestampFromFields = (timeStr: string, dateStr: string, isEndTime: boolean = false, startMs?: number): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d, hours, minutes, 0, 0);
    const ms = date.getTime();
    if (isEndTime && startMs && ms <= startMs) {
       date.setDate(date.getDate() + 1);
       return date.getTime();
    }
    return ms;
  };

  const openEdit = (e: TimeEntry) => {
    setEditing(e);
    setEditContractId(e.contractId || "");
    setEditOsId(e.os_id || "");
    setEditActivity(e.activity || "");
    setEditStart(formatTimeToHHMM(e.start));
    setEditEnd(formatTimeToHHMM(e.end ?? Date.now()));
    setEditNotes(e.notes || "");
  };

  const cObj = contracts.find(c => c.id === editContractId);
  const isComOs = cObj?.tipo === 'continuado_com_os';

  // Helper para identificar o ciclo exato (mês/ano) do apontamento no painel retroativo
  const editCycle = useMemo(() => {
    if (!cObj || !panelDate) return { month: "", year: "" };
    const [y_str, m_str, d_str] = panelDate.split('-');
    const day = parseInt(d_str);
    let m = parseInt(m_str) - 1;
    let y = parseInt(y_str);
    
    if (cObj.ciclo_inicio > cObj.ciclo_fim && day >= cObj.ciclo_inicio) {
      m = m === 11 ? 0 : m + 1;
      if (m === 0) y++;
    }
    return { month: String(m), year: String(y) };
  }, [panelDate, cObj]);

  // Traz apenas as OSs vinculadas ao contrato E com alocação no CICLO ATUAL do painel
  const availableOs = useMemo(() => {
    if (!editContractId || !isComOs) return [];
    
    const alocacoesNoCiclo = allocations.filter(a => 
      a.contract_id === editContractId && 
      a.mes === editCycle.month && 
      a.ano === editCycle.year &&
      (a.horas_disponiveis > 0 || a.atividade === 'Preço Fechado (Medição)')
    );
    
    const osIdsAlocadas = new Set(alocacoesNoCiclo.map(a => a.os_id));
    return osList.filter(o => o.contract_id === editContractId && osIdsAlocadas.has(o.id));
  }, [editContractId, osList, isComOs, allocations, editCycle]);

  // Traz apenas as atividades permitidas no contrato+OS NO CICLO ATUAL do painel
  const availableActivities = useMemo(() => {
    if (!editContractId) return [];
    
    const rawActivities = Array.from(new Set(
      allocations.filter(a => 
        a.contract_id === editContractId && 
        a.mes === editCycle.month && 
        a.ano === editCycle.year &&
        (!isComOs || a.os_id === editOsId)
      ).map(a => a.atividade)
    ));
    
    const cleanedActivities = rawActivities.filter(a => a !== 'Preço Fechado (Medição)');
    return cleanedActivities.length > 0 ? cleanedActivities.sort() : ['Sem atividade específica'];
  }, [allocations, editContractId, editOsId, isComOs, editCycle]);

  // Quando o contrato muda, força a OS e a atividade a resetarem imediatamente
  const handleContractChange = (newContractId: string) => {
    setEditContractId(newContractId);
    const newContractObj = contracts.find(c => c.id === newContractId);
    if (newContractObj?.tipo === 'continuado_com_os') {
      const [y_str, m_str, d_str] = panelDate.split('-');
      const day = parseInt(d_str);
      let m = parseInt(m_str) - 1;
      let y = parseInt(y_str);
      if (newContractObj.ciclo_inicio > newContractObj.ciclo_fim && day >= newContractObj.ciclo_inicio) {
        m = m === 11 ? 0 : m + 1;
        if (m === 0) y++;
      }
      
      const alocacoesDesteContrato = allocations.filter(a => a.contract_id === newContractId && a.mes === String(m) && a.ano === String(y) && (a.horas_disponiveis > 0 || a.atividade === 'Preço Fechado (Medição)'));
      const osIdsAlocadas = new Set(alocacoesDesteContrato.map(a => a.os_id));
      const validOs = osList.filter(o => o.contract_id === newContractId && osIdsAlocadas.has(o.id));
      
      setEditOsId(validOs.length > 0 ? validOs[0].id : "");
    } else {
      setEditOsId("");
    }
    setEditActivity("");
  };

  const renderEntryCard = (e: TimeEntry) => {
    const dur = (e.end ?? Date.now()) - e.start;
    return (
      <div key={e.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors w-full min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><Clock className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex flex-col">
            <span className="font-medium text-sm truncate">{e.contractName}</span>
            {e.os_id && (() => {
               const os = osList.find(o => o.id === e.os_id);
               return os ? <span className="text-[11px] font-bold text-amber-600 dark:text-amber-500 truncate mt-0.5">↳ OS: {os.codigo} {os.descricao ? `- ${os.descricao}` : ''}</span> : null;
            })()}
            <span className="text-xs text-muted-foreground mt-0.5">{e.activity}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">{formatTimeToHHMM(e.start)} — {e.end ? formatTimeToHHMM(e.end) : "agora"}</div>
          {e.notes && <div className="text-[11px] text-muted-foreground mt-1 italic bg-muted/40 p-1.5 rounded border border-muted/50 wrap-break-word whitespace-pre-wrap">“{e.notes}”</div>}
        </div>
        <div className="font-mono text-sm tabular-nums mr-2 shrink-0">{formatDuration(dur)}</div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={() => openEdit(e)} aria-label="Editar" className="h-9 w-9 text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Tem certeza que deseja deletar este apontamento?")) onDelete(e.id); }} aria-label="Deletar" className="h-9 w-9 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-2 w-full min-w-0">
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/20">
            Nenhum registro lançado nesta data.
          </div>
        ) : (
          entries.map(renderEntryCard)
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Apontamento (Retroativo)</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">Contrato / Cliente</Label><Select value={editContractId} onValueChange={handleContractChange}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent className="z-9999">{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent></Select></div>
            {isComOs && (<div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">Ordem de Serviço (OS)</Label><Select value={editOsId} onValueChange={(v) => { setEditOsId(v); setEditActivity(""); }}><SelectTrigger><SelectValue placeholder="Selecione a OS..." /></SelectTrigger><SelectContent className="z-9999">{availableOs.map(o => <SelectItem key={o.id} value={o.id}>{o.codigo} {o.descricao ? `- ${o.descricao}` : ''}</SelectItem>)}</SelectContent></Select></div>)}
            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">Disciplina / Escopo</Label><Select value={editActivity} onValueChange={setEditActivity} disabled={availableActivities.length === 0}><SelectTrigger><SelectValue placeholder={availableActivities.length === 0 ? "Nenhuma disciplina" : "Selecione..."} /></SelectTrigger><SelectContent className="z-9999">{availableActivities.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
            
            <div className="space-y-1.5 pt-2"><Label className="text-xs uppercase tracking-wider text-muted-foreground">Data do Apontamento</Label><Input type="date" value={panelDate} disabled className="bg-muted/50 h-9 mt-1 opacity-80" /></div>
            
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>Início</Label><Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} /></div><div className="space-y-1.5"><Label>Fim</Label><Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Descreva a atividade..." /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => {
                if (!editing) return;

                // 1. BLOQUEIO DE ESTADO FANTASMA (Atividade)
                // Impede salvar se a atividade não pertencer ao contrato selecionado
                if (!editActivity || !availableActivities.includes(editActivity)) {
                   alert("Por favor, selecione uma Disciplina / Escopo válida para este contrato antes de salvar.");
                   return;
                }

                // 2. BLOQUEIO DE OS FANTASMA
                // Impede salvar se for uma OS em que o consultor não tem horas alocadas
                if (isComOs && (!editOsId || !availableOs.some(o => o.id === editOsId))) {
                   alert("Por favor, selecione uma Ordem de Serviço válida para este contrato antes de salvar.");
                   return;
                }

                // Lógica de tempo original (Corujão bloqueado/tratado pela sua função)
                const finalStart = getTimestampFromFields(editStart, panelDate);
                const finalEnd = getTimestampFromFields(editEnd, panelDate, true, finalStart);
                
                onEdit(editing.id, finalStart, finalEnd, editNotes, editContractId, isComOs ? editOsId : null, editActivity);
                setEditing(null);
              }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}