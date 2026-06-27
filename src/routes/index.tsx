import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw, Moon, Sun, Settings2, Timer, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ACTIVITY_REQUIRING_NOTES, type TimeEntry } from "@/lib/mock-data";
import { useTheme } from "@/hooks/use-theme";
import { useIdle } from "@/hooks/use-idle";
import { TimerDisplay } from "@/components/timesheet/TimerDisplay";
import { TaskSelector } from "@/components/timesheet/TaskSelector";
import { HistoryList } from "@/components/timesheet/HistoryList";
import { DailyDashboard } from "@/components/timesheet/DailyDashboard";
import { IdleDialog } from "@/components/timesheet/IdleDialog";
import { supabase } from "@/lib/supabase";
import { Login } from "@/components/Login";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Timesheet — Engenharia de Custos" },
      { name: "description", content: "Apontamento de horas por contrato e atividade para consultores de engenharia de custos." },
    ],
  }),
  component: TimesheetPage,
});

function TimesheetPage() {
  const { theme, mounted, toggle } = useTheme();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Estados da Aplicação
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [contractsList, setContractsList] = useState<{id: string, code: string, name: string}[]>([{ id: "loading", code: "Aguarde", name: "Carregando contratos..." }]);
  
  const [contractId, setContractId] = useState<string>("loading");
  const [activity, setActivity] = useState<string>("Orçamento");
  const [notes, setNotes] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  
  const [idleOpen, setIdleOpen] = useState(false);
  const [idleStartedAt, setIdleStartedAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState(5);

  const contract = contractsList.find((c) => c.id === contractId) || contractsList[0];
  const contractLabel = contract.code !== "Aguarde" ? `${contract.code} — ${contract.name.split(" — ")[0]}` : "";
  const notesRequired = activity === ACTIVITY_REQUIRING_NOTES;
  const notesValid = !notesRequired || notes.trim().length > 0;
  const openEntry = entries.find((e) => e.end === null) ?? null;

  useEffect(() => {
    // 1. Verifica autenticação
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTimesheets(session.user.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTimesheets(session.user.id);
    });

    // 2. Busca contratos do arquivo local (simulando a nuvem)
    fetch('/contratos.json')
      .then(res => res.json())
      .then(data => {
        if(data && data.length > 0) {
          setContractsList(data);
          setContractId(data[0].id); // Seleciona o primeiro contrato automaticamente
        }
      })
      .catch(err => console.error("Erro ao ler contratos", err));

    return () => subscription.unsubscribe();
  }, []);

  const fetchTimesheets = async (userId: string) => {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('user_id', userId)
      .order('start_at', { ascending: false });

    if (error) {
      toast.error("Erro ao puxar dados da nuvem.");
      return;
    }

    if (data) {
      const mapped: TimeEntry[] = data.map(row => ({
        id: row.id,
        contractId: row.contract_id,
        contractName: row.contract_name,
        activity: row.activity,
        notes: row.notes || undefined,
        start: new Date(row.start_at).getTime(),
        end: row.end_at ? new Date(row.end_at).getTime() : null,
        edited: row.edited
      }));
      setEntries(mapped);

      const runningEntry = mapped.find(e => e.end === null);
      if (runningEntry) {
        setContractId(runningEntry.contractId);
        setActivity(runningEntry.activity);
        setNotes(runningEntry.notes || "");
        setStartedAt(runningEntry.start);
        setRunning(true);
      }
    }
  };

  const openNewEntry = async (cId: string, act: string, nts: string) => {
    const c = contractsList.find((x) => x.id === cId) || contractsList[0];
    const label = `${c.code} — ${c.name.split(" — ")[0]}`;
    const now = Date.now();
    const newEntryId = crypto.randomUUID();

    const newEntry: TimeEntry = {
      id: newEntryId,
      contractId: cId,
      contractName: label,
      activity: act,
      notes: nts.trim() || undefined,
      start: now,
      end: null,
    };
    
    setEntries((p) => [newEntry, ...p]);
    setStartedAt(now);
    setRunning(true);

    if (user) {
      const { error } = await supabase.from('timesheets').insert({
        id: newEntryId,
        user_id: user.id,
        contract_id: cId,
        contract_name: label,
        activity: act,
        notes: nts.trim() || null,
        start_at: new Date(now).toISOString(),
      });
      if (error) toast.error("Erro ao salvar online!");
    }
  };

  const start = () => {
    if (!contractId || contractId === "loading" || !activity) return toast.error("Selecione contrato e atividade");
    if (!notesValid) return toast.error('Observações são obrigatórias para a atividade "Outros"');
    openNewEntry(contractId, activity, notes);
    toast.success("Cronômetro iniciado");
  };

  const pause = async () => {
    if (!running) return;
    const now = Date.now();
    const activeEntry = entries.find((e) => e.end === null);
    
    setEntries((p) => p.map((e) => (e.end === null ? { ...e, end: now } : e)));
    setRunning(false);
    setStartedAt(null);
    toast("Cronômetro pausado");

    if (activeEntry && user) {
      const { error } = await supabase.from('timesheets').update({
        end_at: new Date(now).toISOString()
      }).eq('id', activeEntry.id);
      if (error) toast.error("Erro ao pausar online!");
    }
  };

  const resume = () => start();

  const handleContractChange = (v: string) => {
    if (v === contractId) return;
    if (running) {
      if (!notesValid) return toast.error('Preencha as observações antes de alterar');
      pause().then(() => {
        setContractId(v);
        openNewEntry(v, activity, notes);
        toast.success("Contrato alterado");
      });
    } else {
      setContractId(v);
    }
  };

  const handleActivityChange = (v: string) => {
    if (v === activity) return;
    if (running) {
      if (v === ACTIVITY_REQUIRING_NOTES && notes.trim().length === 0) {
        setActivity(v);
        toast.error('Preencha as observações para iniciar a atividade "Outros"');
        pause();
        return;
      }
      if (activity === ACTIVITY_REQUIRING_NOTES && !notesValid) {
        return toast.error("Preencha as observações antes de alterar");
      }
      pause().then(() => {
        setActivity(v);
        openNewEntry(contractId, v, notes);
        toast.success("Atividade alterada");
      });
    } else {
      setActivity(v);
    }
  };

  const handleEditEntry = async (id: string, newStart: number, newEnd: number) => {
    setEntries((p) =>
      p.map((e) => (e.id === id ? { ...e, start: newStart, end: newEnd, edited: true } : e)),
    );
    toast.success("Apontamento atualizado");

    if (user) {
      await supabase.from('timesheets').update({
        start_at: new Date(newStart).toISOString(),
        end_at: new Date(newEnd).toISOString(),
        edited: true
      }).eq('id', id);
    }
  };

  useIdle(
    idleMinutes * 60 * 1000,
    () => {
      if (running) {
        setIdleStartedAt(Date.now());
        pause();
        setIdleOpen(true);
      }
    },
    running,
  );

  const handleResumeFromIdle = () => {
    setIdleOpen(false);
    setIdleStartedAt(null);
    resume();
  };

  const handleDiscardIdle = () => {
    setIdleOpen(false);
    setIdleStartedAt(null);
  };

  const baseMs = useMemo(() => {
    if (!openEntry || !running) return 0;
    return 0;
  }, [openEntry, running]);

  useEffect(() => {
    if (!running || !startedAt) {
      document.title = "Timesheet — Engenharia de Custos";
      return;
    }
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      const h = String(Math.floor(sec / 3600)).padStart(2, "0");
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
      document.title = ` ▶  ${h}:${m}  —  ${contract.code}`;
    }, 1000);
    return () => clearInterval(id);
  }, [running, startedAt, contract.code]);

  const playDisabled = !notesValid || contractId === "loading";

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando sistema...</div>;

  if (!user) return <Login onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Timesheet</h1>
              <p className="text-xs text-muted-foreground leading-tight">Engenharia de Custos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Olá, <span className="font-medium text-foreground">{user.email?.split('@')[0]}</span>
            </span>
            <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} aria-label="Configurações">
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={toggle} aria-label="Alternar tema">
              {mounted ? (
                theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => supabase.auth.signOut()} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 space-y-6">
            <TaskSelector
              contracts={contractsList}
              contractId={contractId}
              activity={activity}
              notes={notes}
              notesRequired={notesRequired}
              onContractChange={handleContractChange}
              onActivityChange={handleActivityChange}
              onNotesChange={setNotes}
            />
            <div className="flex flex-col items-center gap-6 py-4">
              <TimerDisplay startedAt={startedAt} baseMs={baseMs} running={running} />
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {!running ? (
                  <Button
                    onClick={start}
                    disabled={playDisabled}
                    className="h-14 bg-success text-success-foreground hover:bg-success/90"
                  >
                    <Play className="h-4 w-4 mr-2" /> Play
                  </Button>
                ) : (
                  <Button onClick={pause} className="h-14 bg-warning text-warning-foreground hover:bg-warning/90">
                    <Pause className="h-4 w-4 mr-2" /> Pause
                  </Button>
                )}
                <Button
                  onClick={resume}
                  variant="outline"
                  className="h-14"
                  disabled={running || entries.length === 0 || playDisabled}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Retomar
                </Button>
              </div>
              {notesRequired && !notesValid && (
                <p className="text-xs text-destructive">
                  Preencha as observações para iniciar/alterar com a atividade "Outros".
                </p>
              )}
            </div>
          </div>
          <DailyDashboard
            entries={entries}
            currentContractId={running ? contractId : null}
            currentContractName={running ? contractLabel : null}
          />
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Histórico do dia</h2>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
          </div>
          <HistoryList entries={entries} onEdit={handleEditEntry} />
        </section>
      </main>
      <IdleDialog
        open={idleOpen}
        contractName={contractLabel}
        idleMs={idleStartedAt ? Date.now() - idleStartedAt : idleMinutes * 60 * 1000}
        onResume={handleResumeFromIdle}
        onDiscard={handleDiscardIdle}
      />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tempo de inatividade (minutos)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={idleMinutes}
              onChange={(e) => setIdleMinutes(Math.max(1, Number(e.target.value) || 5))}
            />
            <p className="text-xs text-muted-foreground">
              Após esse período sem mouse ou teclado, o cronômetro pausa automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}