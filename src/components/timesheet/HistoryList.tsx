import { useState } from "react";
import type { TimeEntry } from "@/lib/mock-data";
import { formatDuration, formatTime, toLocalInputValue, fromLocalInputValue } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Clock } from "lucide-react";

export function HistoryList({
  entries,
  onEdit,
}: {
  entries: TimeEntry[];
  onEdit: (id: string, start: number, end: number) => void;
}) {
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [startVal, setStartVal] = useState("");
  const [endVal, setEndVal] = useState("");

  const openEdit = (e: TimeEntry) => {
    setEditing(e);
    setStartVal(toLocalInputValue(e.start));
    setEndVal(toLocalInputValue(e.end ?? Date.now()));
  };

  return (
    <>
      <div className="space-y-2">
        {entries.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum apontamento hoje. Selecione um contrato e pressione Play.
          </div>
        )}
        {entries.map((e) => {
          const dur = (e.end ?? Date.now()) - e.start;
          const live = e.end === null;
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
                  {e.edited && (
                    <Badge variant="secondary" className="text-[10px]">
                      Editado manualmente
                    </Badge>
                  )}
                  {live && (
                    <Badge className="text-[10px] bg-success text-success-foreground">
                      Em andamento
                    </Badge>
                  )}
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
              <div className="font-mono text-sm tabular-nums">{formatDuration(dur)}</div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openEdit(e)}
                disabled={live}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar apontamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="datetime-local" value={endVal} onChange={(e) => setEndVal(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              O registro será marcado como "Editado manualmente" para transparência.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editing) return;
                onEdit(editing.id, fromLocalInputValue(startVal), fromLocalInputValue(endVal));
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
