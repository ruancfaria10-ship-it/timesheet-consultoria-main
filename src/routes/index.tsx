import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, Timer, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { type TimeEntry } from "@/lib/mock-data";
import { useTheme } from "@/hooks/use-theme";
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
  
  // Novos Estados Simplificados de Data e Hora
  const [daySelection, setDaySelection] = useState<"hoje" | "ontem">("hoje");
  
  const getInitialTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  
  const [startTime, setStartTime] = useState(getInitialTimeStr);
  const [endTime, setEndTime] = useState(getInitialTimeStr);

  const notesValid = notes.trim().length > 0;

  // Helper para converter campos em Timestamp Unix Puro
  const getTimestampFromTimeFields = (timeStr: string, day: "hoje" | "ontem") => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    if (day === "ontem") {
      date.setDate(date.getDate() - 1);
    }
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  };

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
    }
  };

  const handleAddEntry = async () => {
    if (!contractId || contractId === "loading" || !activity) return toast.error("Selecione contrato e atividade");
    if (!notesValid) return toast.error("A observação é obrigatória para registrar as horas.");

    const startMs = getTimestampFromTimeFields(startTime, daySelection);
    const endMs = getTimestampFromTimeFields(endTime, daySelection);

    if (endMs <= startMs) return toast.error("A hora de fim deve ser posterior à hora de início.");

    const hasOverlap = entries.some(entry => {
      if (!entry.end) return false;
      return (startMs < entry.end) && (endMs > entry.start);
    });

    if (hasOverlap) {
      return toast.error("Conflito de horário! Você já registrou horas nesse mesmo período.");
    }

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
    
    setNotes("");
    setStartTime(endTime); // Joga o início do próximo para o fim do atual automaticamente

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
    if (newEnd <= newStart) return toast.error("A hora de fim deve ser posterior à hora de início.");

    const hasOverlap = entries.some(entry => {
      if (entry.id === id) return false;
      if (!entry.end) return false;
      return (newStart < entry.end) && (newEnd > entry.start);
    });

    if (hasOverlap) {
      return toast.error("Conflito! O novo horário invade o período de outro apontamento.");
    }

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

  const handleDeleteEntry = async (id: string) => {
    setEntries((p) => p.filter((e) => e.id !== id));
    toast.success("Apontamento deletado");

    if (user) {
      const { error } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', id);
      
      if (error) {
        toast.error("Erro ao deletar do banco de dados.");
        fetchTimesheets(user.id);
      }
    }
  };

  const contractUsedMs = entries
    .filter(e => e.contractId === contractId)
    .reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);

  const activityUsedMs = entries
    .filter(e => e.contractId === contractId && e.activity === activity)
    .reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);

  // Filtro do Dashboard Geral do dia atual
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23,59,59,999);
  const todayEntries = entries.filter(e => e.start >= todayStart.getTime() && e.start <= todayEnd.getTime());

  // Envia todo o histórico dos dois dias para renderização segmentada no painel lateral
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const targetHistoryEntries = entries.filter(e => e.start >= yesterdayStart.getTime());

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
              contractUsedMs={contractUsedMs}
              activityUsedMs={activityUsedMs}
              onContractChange={setContractId}
              onActivityChange={setActivity}
              onNotesChange={setNotes}
            />
            
            {/* NOVO PAINEL DE DATA SIMPLIFICADO EM FORMATO DE BOLINHAS */}
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quando foi realizado?</Label>
                <RadioGroup
                  value={daySelection}
                  onValueChange={(v) => setDaySelection(v as "hoje" | "ontem")}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2 cursor-pointer">
                    <RadioGroupItem value="hoje" id="day-hoje" />
                    <Label htmlFor="day-hoje" className="cursor-pointer font-medium text-sm">Hoje</Label>
                  </div>
                  <div className="flex items-center space-x-2 cursor-pointer">
                    <RadioGroupItem value="ontem" id="day-ontem" />
                    <Label htmlFor="day-ontem" className="cursor-pointer font-medium text-sm">Ontem</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Horário de Início</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Horário de Fim</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            </div>

            <Button
              onClick={handleAddEntry}
              disabled={!notesValid || contractId === "loading"}
              className="w-full h-14 bg-primary text-primary-foreground text-lg"
            >
              <Check className="h-5 w-5 mr-2" /> Registrar Horas
            </Button>
          </div>
          
          <DailyDashboard
            entries={todayEntries}
            currentContractId={null}
            currentContractName={null}
          />
        </section>
        
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Painel de Histórico</h2>
            <span className="text-xs text-muted-foreground">Ciclo Atual</span>
          </div>
          <HistoryList entries={targetHistoryEntries} onEdit={handleEditEntry} onDelete={handleDeleteEntry} />
        </section>
      </main>
    </div>
  );
}