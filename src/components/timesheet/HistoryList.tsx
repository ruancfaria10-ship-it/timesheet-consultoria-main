import { useState } from "react";
import type { TimeEntry } from "@/lib/mock-data";
import { formatDuration, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pencil, Clock, Trash2 } from "lucide-react";

export function HistoryList({
  entries,
  onEdit,
  onDelete,
}: {
  entries: TimeEntry[];
  onEdit: (id: string, start: number, end: number) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [editDay, setEditDay] = useState<"hoje" | "ontem">("hoje");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Funções Auxiliares de Conversão Matemática de Tempo
  const determineDayOption = (timestamp: number): "hoje" | "ontem" => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return timestamp >= todayStart.getTime() ? "hoje" : "ontem";
  };

  const formatTimeToHHMM = (timestamp: number): string => {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const getTimestampFromFields = (timeStr: string, day: "hoje" | "ontem"): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    if (day === "ontem") {
      date.setDate(date.getDate() - 1);
    }
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  };

  const openEdit = (e: TimeEntry) => {
    setEditing(e);
    setEditDay(determineDayOption(e.start));
    setEditStart(formatTimeToHHMM(e.start));
    setEditEnd(formatTimeToHHMM(e.end ?? Date.now()));
  };

  // Separação dos apontamentos por Grupos de Dias
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const todayEntries = entries.filter(e => e.start >= todayStart.getTime() && e.start <= todayEnd.getTime());
  const yesterdayEntries = entries.filter(e => e.start >= yesterdayStart.getTime() && e.start < todayStart.getTime());

  const renderEntryCard = (e: TimeEntry) => {
    const dur = (e.end ?? Date.now()) - e.start;
    return (
      <div
        key={e.id}
        className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{e.contractName}</span>
            <span className="text-xs text-muted-foreground">· {e.activity}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatTime(e.start)} — {e.end ? formatTime(e.end) : "agora"}
          </div>
          {e.notes && (
            <div className="text-xs text-muted-foreground mt-1 italic truncate">
              “{e.notes}”
            </div>
          )}
        </div>
        <div className="font-mono text-sm tabular-nums mr-2">{formatDuration(dur)}</div>
        
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => openEdit(e)}
            aria-label="Editar"
            className="h-9 w-9"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (confirm("Tem certeza que deseja deletar este apontamento?")) {
                onDelete(e.id);
              }
            }}
            aria-label="Deletar"
            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* SEÇÃO: HOJE */}
        <div className="space-y-2">
          <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground px-1">
            Hoje
          </div>
          {todayEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/20">
              Nenhum registro lançado hoje.
            </div>
          ) : (
            todayEntries.map(renderEntryCard)
          )}
        </div>

        {/* SEÇÃO: ONTEM */}
        <div className="space-y-2 pt-2 border-t border-dashed">
          <div className="text-xs uppercase font-semibold tracking-wider text-muted-foreground px-1">
            Ontem
          </div>
          {yesterdayEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/20">
              Nenhum registro lançado para o dia anterior.
            </div>
          ) : (
            yesterdayEntries.map(renderEntryCard)
          )}
        </div>
      </div>

      {/* DIALOG DE EDIÇÃO SIMPLIFICADO */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar apontamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dia do Apontamento</Label>
              <RadioGroup
                value={editDay}
                onValueChange={(v) => setEditDay(v as "hoje" | "ontem")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 cursor-pointer">
                  <RadioGroupItem value="hoje" id="edit-hoje" />
                  <Label htmlFor="edit-hoje" className="cursor-pointer font-medium text-sm">Hoje</Label>
                </div>
                <div className="flex items-center space-x-2 cursor-pointer">
                  <RadioGroupItem value="ontem" id="edit-ontem" />
                  <Label htmlFor="edit-ontem" className="cursor-pointer font-medium text-sm">Ontem</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editing) return;
                const finalStart = getTimestampFromFields(editStart, editDay);
                const finalEnd = getTimestampFromFields(editEnd, editDay);
                onEdit(editing.id, finalStart, finalEnd);
                setEditing(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}