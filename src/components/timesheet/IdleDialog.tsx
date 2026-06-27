import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDuration } from "@/lib/format";

export function IdleDialog({
  open,
  contractName,
  idleMs,
  onResume,
  onDiscard,
}: {
  open: boolean;
  contractName: string;
  idleMs: number;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Você ainda está trabalhando?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            Detectamos <span className="font-mono font-semibold">{formatDuration(idleMs)}</span> de inatividade
            enquanto o cronômetro estava ativo no contrato:
          </p>
          <p className="font-medium text-foreground">{contractName}</p>
          <p className="text-muted-foreground">
            O tempo foi pausado automaticamente. Deseja descontar este intervalo e retomar?
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onDiscard}>Manter pausado</Button>
          <Button onClick={onResume}>Descontar e retomar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
