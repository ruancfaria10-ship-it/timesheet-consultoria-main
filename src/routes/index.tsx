import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, Timer, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { type TimeEntry } from "@/lib/mock-data";
import { useTheme } from "@/hooks/use-theme";
import { toLocalInputValue, fromLocalInputValue } from "@/lib/format";
import { TaskSelector } from "@/components/timesheet/TaskSelector";
import { HistoryList } from "@/components/timesheet/HistoryList";
import { DailyDashboard } from "@/components/timesheet/DailyDashboard";
import { supabase } from "@/lib/supabase";
import { Login } from "@/components/Login";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Timesheet — Engenharia de Custos" },
      { name: "description", content: "Apontamento de horas por contrato e atividade para consultores." },
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
  
  // Novos campos de Início e Fim (Lançamento Manual)
  const [startVal, setStartVal] = useState(() => toLocalInputValue(Date.now()));
  const [endVal, setEndVal] = useState(() => toLocalInputValue(Date.now()));

  const notesValid = notes.trim().length > 0;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTimesheets(session.user.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTimesheets(session.user.id);
    });

    fetch('/contratos.json')
      .then(res => res.json())
      .then(data => {
        if(data && data.length > 0) {
          setContractsList(data);
          setContractId(data[0].id);
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
      // Filtro para mostrar apenas os de hoje (opcional, mas ajuda na visualização limpa do dia)
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
      const mapped: TimeEntry[] = data.map(row => ({
        id: row.id,
        contractId: row.contract_id,
        contractName: row.contract_name,
        activity: row.activity,
        notes: row.notes || undefined,
        start: new Date(row.start_at).getTime(),
        end: row.end_at ? new Date(row.end_at).getTime() : null,
        edited: row.edited
      })).filter(e => e.start >= todayStart.getTime()); // Mostra apenas o histórico do dia atual na lista principal
      
      setEntries(mapped);
    }
  };

  const handleAddEntry = async () => {
    if (!contractId || contractId === "loading" || !activity) return toast.error("Selecione contrato e atividade");
    if (!notesValid) return toast.error("A observação é obrigatória para registar as horas.");

    const startMs = fromLocalInputValue(startVal);
    const endMs = fromLocalInputValue(endVal);

    if (endMs <= startMs) return toast.error("A hora de fim deve ser posterior à hora de início.");

    const c = contractsList.find((x) => x.id === contractId) || contractsList[0];
    const label = `${c.code} — ${c.name.split(" — ")[0]}`;
    const newEntryId = crypto.randomUUID();

    const newEntry: TimeEntry = {
      id: newEntryId,
      contractId: contractId,
      contractName: label,
      activity: activity,
      notes: notes.trim(),
      start: startMs,
      end: endMs,
    };
    
    setEntries((p) => [newEntry, ...p]);
    toast.success("Apontamento lançado com sucesso!");
    
    // Limpa a observação e adianta o relógio para evitar repetição automática de notas
    setNotes("");
    setStartVal(endVal);

    if (user) {
      const { error } = await supabase.from('timesheets').insert({
        id: newEntryId,
        user_id: user.id,
        contract_id: contractId,
        contract_name: label,
        activity: activity,
        notes: notes.trim(),
        start_at: new Date(startMs).toISOString(),
        end_at: new Date(endMs).toISOString(),
      });
      if (error) toast.error("Erro ao salvar online!");
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
              onContractChange={setContractId}
              onActivityChange={setActivity}
              onNotesChange={setNotes}
            />
            
            <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="datetime-local" value={endVal} onChange={(e) => setEndVal(e.target.value)} />
              </div>
            </div>

            <Button
              onClick={handleAddEntry}
              disabled={!notesValid || contractId === "loading"}
              className="w-full h-14 bg-primary text-primary-foreground text-lg"
            >
              <Check className="h-5 w-5 mr-2" /> Registar Horas
            </Button>
          </div>
          
          <DailyDashboard
            entries={entries}
            currentContractId={null}
            currentContractName={null}
          />
        </section>
        
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Histórico de Hoje</h2>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
          </div>
          <HistoryList entries={entries} onEdit={handleEditEntry} />
        </section>
      </main>
    </div>
  );
}