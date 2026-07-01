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
import { Infinity } from "lucide-react";

export function TaskSelector({
  contracts,
  contractId,
  contractType, // Recebe o tipo (horas ou fechado)
  activity,
  notes,
  contractUsedMs,
  activityUsedMs,
  contractBudgetMs,
  activityBudgetMs,
  availableActivities,
  onContractChange,
  onActivityChange,
  onNotesChange,
}: {
  contracts: { id: string; code: string; name: string }[];
  contractId: string;
  contractType: string;
  activity: string;
  notes: string;
  contractUsedMs: number;
  activityUsedMs: number;
  contractBudgetMs: number;
  activityBudgetMs: number;
  availableActivities: string[];
  onContractChange: (v: string) => void;
  onActivityChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  const notesMissing = notes.trim().length === 0;

  const contractPercent = contractBudgetMs > 0 ? Math.min(100, (contractUsedMs / contractBudgetMs) * 100) : 0;
  const activityPercent = activityBudgetMs > 0 ? Math.min(100, (activityUsedMs / activityBudgetMs) * 100) : 0;

  const formatHoursDisplay = (ms: number) => {
    return (ms / (3600 * 1000)).toFixed(1) + "h";
  };

  const isFechado = contractType === 'fechado';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Contrato
          </Label>
          <Select value={contractId} onValueChange={onContractChange}>
            <SelectTrigger className="h-12">
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
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Disciplina / Escopo
          </Label>
          <Select 
            value={activity} 
            onValueChange={onActivityChange} 
            disabled={availableActivities.length === 0}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder={availableActivities.length === 0 ? "Sem atividades" : "Selecione uma atividade"} />
            </SelectTrigger>
            <SelectContent>
              {availableActivities.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* PAINEL DE SALDO DE HORAS REAL E DINÂMICO */}
      <div className="grid gap-4 md:grid-cols-2 pt-1 pb-2">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Saldo do Contrato</span>
            {isFechado ? (
              <span className="font-semibold text-primary flex items-center gap-1">
                <Infinity className="w-3 h-3" /> Horas Ilimitadas
              </span>
            ) : (
              <span className="font-mono">
                {formatDuration(contractUsedMs)} / {formatHoursDisplay(contractBudgetMs)}
              </span>
            )}
          </div>
          {!isFechado && <Progress value={contractPercent} className="h-1.5" />}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Saldo da Disciplina</span>
            {isFechado ? (
              <span className="font-semibold text-primary flex items-center gap-1">
                <Infinity className="w-3 h-3" /> Horas Ilimitadas
              </span>
            ) : (
              <span className="font-mono">
                {formatDuration(activityUsedMs)} / {formatHoursDisplay(activityBudgetMs)}
              </span>
            )}
          </div>
          {!isFechado && <Progress value={activityPercent} className="h-1.5" />}
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
          placeholder="Descreva a atividade realizada..."
          className={notesMissing ? "border-destructive focus-visible:ring-destructive" : ""}
          rows={2}
        />
      </div>
    </div>
  );
}