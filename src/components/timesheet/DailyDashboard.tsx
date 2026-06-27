import { formatDuration } from "@/lib/format";
import type { TimeEntry } from "@/lib/mock-data";

function statFromEntries(entries: TimeEntry[], filter?: (e: TimeEntry) => boolean) {
  const now = Date.now();
  return entries
    .filter((e) => (filter ? filter(e) : true))
    .reduce((sum, e) => sum + ((e.end ?? now) - e.start), 0);
}

export function DailyDashboard({
  entries,
  currentContractId,
  currentContractName,
}: {
  entries: TimeEntry[];
  currentContractId: string | null;
  currentContractName: string | null;
}) {
  const total = statFromEntries(entries);
  const currentTotal = currentContractId
    ? statFromEntries(entries, (e) => e.contractId === currentContractId)
    : 0;
  const distinctContracts = new Set(entries.map((e) => e.contractId)).size;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Stat label="Total do dia" value={formatDuration(total)} />
      <Stat
        label={currentContractName ? "Contrato atual" : "Contratos distintos"}
        value={currentContractName ? formatDuration(currentTotal) : String(distinctContracts)}
        hint={currentContractName ?? undefined}
      />
      <Stat label="Apontamentos" value={String(entries.length)} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}
