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

export function TaskSelector({
  contracts,
  contractId,
  activity,
  notes,
  onContractChange,
  onActivityChange,
  onNotesChange,
}: {
  contracts: { id: string; code: string; name: string }[];
  contractId: string;
  activity: string;
  notes: string;
  onContractChange: (v: string) => void;
  onActivityChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}) {
  const notesMissing = notes.trim().length === 0;
  
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

      <div className="space-y-2">
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