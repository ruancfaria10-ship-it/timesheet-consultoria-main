// src/components/timesheet/TaskSelector.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Briefcase, ChevronRight, CheckCircle2, Clock, Check, ChevronsUpDown, Infinity, Wrench } from "lucide-react";

export function TaskSelector({
  contracts,
  contractId,
  contractType,
  osList,
  osId,
  activity,
  notes,
  contractUsedMs,
  activityUsedMs,
  contractBudgetMs,
  activityBudgetMs,
  osUsedMs,
  osBudgetMs,
  availableActivities,
  onContractChange,
  onOsChange,
  onActivityChange,
  onNotesChange,
}: {
  contracts: { id: string; code: string; name: string; tipo: string }[];
  contractId: string;
  contractType: string;
  osList: { id: string; codigo: string; descricao: string; contract_id: string }[];
  osId: string;
  activity: string;
  notes: string;
  contractUsedMs: number;
  activityUsedMs: number;
  contractBudgetMs: number;
  activityBudgetMs: number;
  osUsedMs?: number;
  osBudgetMs?: number;
  availableActivities: string[];
  onContractChange: (v: string) => void;
  onOsChange: (v: string) => void;
  onActivityChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  const notesMissing = notes.trim().length === 0;

  // Identificação das modalidades de contrato
  const currentOs = osList?.find(o => o.id === osId);
  const isIlimitado = ['continuado_sem_os', 'fechado', 'overhead'].includes(contractType) || currentOs?.codigo === '🛠️ Pequenos Suportes';
  const isMensal = ['overhead', 'continuado_limite_mensal'].includes(contractType);
  const isComOS = contractType === 'continuado_com_os';
  
  // 🌟 DEFINIÇÃO DO SALDO SUPERIOR:
  // Se for contrato com OS, exibe o saldo do consultor naquela Demanda (OS).
  // Se for contrato comum por horas, exibe o Saldo Global acumulado de todas as disciplinas.
  const topLabel = isComOS ? "Saldo da Demanda (OS)" : (isMensal ? "Saldo Mensal" : "Saldo Global");
  const topUsedMs = contractUsedMs;
  const topBudgetMs = contractBudgetMs;
  const topPercent = topBudgetMs > 0 ? Math.min(100, (topUsedMs / topBudgetMs) * 100) : 0;
  
  // 🌟 DEFINIÇÃO DO SALDO INFERIOR:
  // Exibe o saldo individual alocado especificamente para a disciplina/escopo selecionado.
  const subLabel = "Saldo da Disciplina";
  const displayUsedMs = activityUsedMs;
  const displayBudgetMs = activityBudgetMs;
  const subPercent = displayBudgetMs > 0 ? Math.min(100, (displayUsedMs / displayBudgetMs) * 100) : 0;

  const formatHoursDisplay = (ms: number) => {
    return (ms / (3600 * 1000)).toFixed(1) + "h";
  };

  const availableOs = osList ? osList.filter(os => os.contract_id === contractId) : [];

  return (
    <div className="space-y-5">
      {/* 🌟 SPRINT 4: Quebra suave para 1 coluna em telas estreitas, 2 colunas em telas amplas */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Contrato / Cliente</Label>
          <Select value={contractId} onValueChange={onContractChange}>
            <SelectTrigger className="h-12 border-primary/50">
              <SelectValue placeholder="Selecione um contrato" />
            </SelectTrigger>
            <SelectContent>
              {contracts.length === 0 ? (
                <SelectItem value="none" disabled>Nenhum contrato alocado</SelectItem>
              ) : (
                contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{c.code}</span>
                      <span className="text-xs text-muted-foreground">{c.name}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* CAMPO DE OS SÓ APARECE SE O CONTRATO FOR SOB DEMANDA (TIPO 4) */}
        {isComOS ? (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ordem de Serviço (OS)</Label>
            <Select value={osId} onValueChange={onOsChange} disabled={availableOs.length === 0}>
              <SelectTrigger className="h-12 border-amber-500/50">
                <SelectValue placeholder={availableOs.length === 0 ? "Nenhuma OS cadastrada" : "Selecione a OS"} />
              </SelectTrigger>
              <SelectContent>
                {availableOs.map((os) => (
                  <SelectItem key={os.id} value={os.id}>
                    <span className="font-bold">{os.codigo}</span> {os.descricao ? `- ${os.descricao}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Disciplina / Escopo</Label>
            <Select value={activity} onValueChange={onActivityChange} disabled={availableActivities.length === 0}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder={availableActivities.length === 0 ? "Sem atividades" : "Selecione uma atividade"} />
              </SelectTrigger>
              <SelectContent>
                {availableActivities.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* SE FOR COM OS, A DISCIPLINA ADQUIRE SEU PRÓPRIO CAMPO LOGO ABAIXO */}
      {isComOS && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Disciplina / Escopo</Label>
          <Select value={activity} onValueChange={onActivityChange} disabled={availableActivities.length === 0}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder={availableActivities.length === 0 ? "Sem atividades" : "Selecione uma atividade"} />
            </SelectTrigger>
            <SelectContent>
              {availableActivities.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 🌟 SPRINT 4: Painel de saldos responsivo com quebra limpa */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 pt-1 pb-2">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>{topLabel}</span>
            {isIlimitado ? (
              <span className="font-semibold text-primary flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Horas Indefinidas
              </span>
            ) : (
              <span className="font-mono">
                {formatDuration(topUsedMs)} / {formatHoursDisplay(topBudgetMs)}
              </span>
            )}
          </div>
          {!isIlimitado && <Progress value={topPercent} className="h-1.5" />}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>{subLabel}</span>
            {isIlimitado ? (
              <span className="font-semibold text-primary flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Horas Indefinidas
              </span>
            ) : (
              <span className="font-mono">
                {formatDuration(displayUsedMs)} / {formatHoursDisplay(displayBudgetMs)}
              </span>
            )}
          </div>
          {!isIlimitado && <Progress value={subPercent} className="h-1.5" />}
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          Observações
          <span className="text-[10px] normal-case tracking-normal text-destructive">
            *obrigatório
          </span>
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Descreva a atividade realizada detalhadamente..."
          className={notesMissing ? "border-destructive focus-visible:ring-destructive" : ""}
          rows={2}
        />
      </div>
    </div>
  );
}