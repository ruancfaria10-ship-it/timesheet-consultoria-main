import { ACTIVITIES } from "@/lib/mock-data";
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

export function TaskSelector({
  contracts,
  contractId,
  activity,
  notes,
  contractUsedMs,
  activityUsedMs,
  onContractChange,
  onActivityChange,
  onNotesChange,
}: {
  contracts: { id: string; code: string; name: string }[];
  contractId: string;
  activity: string;
  notes: string;
  contractUsedMs: number;
  activityUsedMs: number;
  onContractChange: (v: string) => void;
  onActivityChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  const notesMissing = notes.trim().length === 0;
  
  // TETOS FALSOS (MOCKS) - Até criarmos as colunas no Supabase
  const contractBudgetMs = 100 * 3600 * 1000; // 100 horas
  const activityBudgetMs = 20 * 3600 * 1000;  // 20 horas

  const contractPercent = Math.min(100, (contractUsedMs / contractBudgetMs) * 100);
  const activityPercent = Math.min(100, (activityUsedMs / activityBudgetMs) * 100);

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
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{c.code}</span>
                    <span className="text-xs text-muted-foreground">{c.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Atividade
          </Label>
          <Select value={activity} onValueChange={onActivityChange}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Selecione uma atividade" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITIES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* PAINEL DE SALDO DE HORAS */}
      <div className="grid gap-4 md:grid-cols-2 pt-1 pb-2">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Saldo do Contrato</span>
            <span className="font-mono">{formatDuration(contractUsedMs)} / 100h</span>
          </div>
          <Progress value={contractPercent} className="h-1.5" />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Saldo da Atividade</span>
            <span className="font-mono">{formatDuration(activityUsedMs)} / 20h</span>
          </div>
          <Progress value={activityPercent} className="h-1.5" />
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