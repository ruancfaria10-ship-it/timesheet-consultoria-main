import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TimerDisplay({
  startedAt,
  baseMs,
  running,
}: {
  startedAt: number | null;
  baseMs: number;
  running: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const elapsed = baseMs + (running && startedAt ? now - startedAt : 0);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {running ? "Em andamento" : "Parado"}
      </span>
      <div
        className={cn(
          "rounded-2xl px-8 py-6 bg-card border transition-all",
          running && "running-pulse border-primary/40",
        )}
      >
        <span className="font-mono text-6xl md:text-7xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatDuration(elapsed)}
        </span>
      </div>
    </div>
  );
}
