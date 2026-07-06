// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Moon, Sun, Timer, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { type TimeEntry as BaseTimeEntry } from "@/lib/mock-data";
type TimeEntry = BaseTimeEntry & { os_id?: string };
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

interface AllocationRow {
  id: string;
  user_id: string;
  contract_id: string;
  atividade: string;
  horas_disponiveis: number;
  contratos: {
    codigo: string;
    nome: string;
    status_ativo: boolean;
    tipo: string;
    ciclo_inicio: number;
    ciclo_fim: number;
  } | null;
}

function TimesheetPage() {
  const { theme, mounted, toggle } = useTheme();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [osList, setOsList] = useState<any[]>([]); // Estado para lista de OS
  
  const [contractId, setContractId] = useState<string>("");
  const [osId, setOsId] = useState<string>(""); // Estado para OS selecionada
  const [activity, setActivity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  
  const [daySelection, setDaySelection] = useState<"hoje" | "ontem">("hoje");
  
  const getInitialTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  
  const [startTime, setStartTime] = useState(getInitialTimeStr);
  const [endTime, setEndTime] = useState(getInitialTimeStr);

  const notesValid = notes.trim().length > 0;

  const getTimestampFromTimeFields = (timeStr: string, day: "hoje" | "ontem") => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    if (day === "ontem") date.setDate(date.getDate() - 1);
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTimesheets(session.user.id);
        fetchAllocations(session.user.id);
        fetchOs(); // Busca as OS ao iniciar
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTimesheets(session.user.id);
        fetchAllocations(session.user.id);
        fetchOs(); // Busca as OS ao mudar de usuário
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAllocations = async (userId: string) => {
    const { data, error } = await supabase
      .from('alocacoes')
      .select(`
        id, user_id, contract_id, atividade, horas_disponiveis,
        contratos ( codigo, nome, status_ativo, tipo, ciclo_inicio, ciclo_fim )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error("Erro ao carregar alocações:", error);
      return;
    }

    if (data) {
      const typedData = data as unknown as AllocationRow[];
      setAllocations(typedData);
      
      const activeAllocations = typedData.filter(a => a.contratos?.status_ativo);
      if (activeAllocations.length > 0) {
        setContractId(activeAllocations[0].contract_id);
        setActivity(activeAllocations[0].atividade);
      }
    }
  };

  // Função para buscar as Ordens de Serviço
  const fetchOs = async () => {
    const { data, error } = await supabase.from('ordens_servico').select('*').eq('status_ativa', true);
    if (!error && data) {
      setOsList(data);
    }
  };

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
        edited: row.edited,
        os_id: row.os_id // <-- ESTA É A LINHA QUE PUXA A OS DO BANCO!
      }));
      setEntries(mapped);
    }
  };

  const contractsList = Array.from(
    new Map(
      allocations
        .filter(a => a.contratos?.status_ativo)
        .map(a => [
          a.contract_id, 
          { id: a.contract_id, code: a.contratos!.codigo, name: a.contratos!.nome, tipo: a.contratos!.tipo }
        ])
    ).values()
  );

  const availableActivities = allocations
    .filter(a => a.contract_id === contractId)
    .map(a => a.atividade);

  useEffect(() => {
    if (availableActivities.length > 0 && !availableActivities.includes(activity)) {
      setActivity(availableActivities[0]);
    }

    // Auto-selecionar a primeira OS caso o contrato mude e seja do Tipo 4 (continuado_com_os)
    const cObj = contractsList.find((x) => x.id === contractId);
    if (cObj?.tipo === 'continuado_com_os') {
      const osDoContrato = osList.filter(o => o.contract_id === contractId);
      if (osDoContrato.length > 0 && !osDoContrato.find(o => o.id === osId)) {
        setOsId(osDoContrato[0].id);
      } else if (osDoContrato.length === 0) {
          setOsId("");
      }
    } else {
        setOsId(""); // Limpa OS se mudar para um contrato que não precisa
    }
  }, [contractId, allocations, osList]);

  // =====================================
  // CALCULADORA DO MOTOR DE CICLOS/HORAS
  // =====================================
  const currentContractObjFull = allocations.find(a => a.contract_id === contractId)?.contratos;
  const currentContractType = currentContractObjFull?.tipo || 'horas';
  const cInicio = currentContractObjFull?.ciclo_inicio || 25;
  const cFim = currentContractObjFull?.ciclo_fim || 24;

  const currentActivityAlloc = allocations.find(a => a.contract_id === contractId && a.atividade === activity);
  const activityBudgetMs = currentActivityAlloc ? currentActivityAlloc.horas_disponiveis * 3600 * 1000 : 0;
  const contractBudgetMs = allocations.filter(a => a.contract_id === contractId).reduce((sum, a) => sum + (a.horas_disponiveis * 3600 * 1000), 0);
  const currentOsObj = osList.find(o => o.id === osId);
  const osBudgetMs = currentOsObj ? currentOsObj.horas_previstas * 3600 * 1000 : 0;

  // Calcula o início e fim do ciclo atual do contrato selecionado
  const cycleBounds = useMemo(() => {
    const now = new Date(); 
    const currentDay = now.getDate(); 
    const currentMonth = now.getMonth(); 
    const currentYear = now.getFullYear();
    let start, end;

    if (cInicio > cFim) {
      if (currentDay >= cInicio) { 
        start = new Date(currentYear, currentMonth, cInicio, 0,0,0); 
        end = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, cFim, 23,59,59); 
      } else { 
        start = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, cInicio, 0,0,0); 
        end = new Date(currentYear, currentMonth, cFim, 23,59,59); 
      }
    } else {
      start = new Date(currentYear, currentMonth, cInicio, 0,0,0); 
      end = new Date(currentYear, currentMonth, cFim, 23,59,59);
    }
    return { start: start.getTime(), end: end.getTime() };
  }, [cInicio, cFim, daySelection, startTime]);

  // Filtra as horas usadas dependendo se a regra é global ou mensal
  const isMensal = ['overhead', 'continuado_limite_mensal'].includes(currentContractType);
  const isIlimitado = ['continuado_sem_os', 'fechado'].includes(currentContractType);

  let contractUsedMs = 0;
  let activityUsedMs = 0;

  if (isMensal) {
    // Busca só as horas gastas DENTRO deste ciclo (Zera todo mês)
    contractUsedMs = entries.filter(e => e.contractId === contractId && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
    activityUsedMs = entries.filter(e => e.contractId === contractId && e.activity === activity && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
  } else {
    // Global Histórico
    contractUsedMs = entries.filter(e => e.contractId === contractId).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
    activityUsedMs = entries.filter(e => e.contractId === contractId && e.activity === activity).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
  }
  const osUsedMs = entries.filter(e => e.os_id === osId).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);

  // ==========================================
  // LÓGICA DE REGISTRO DE HORAS (COM TRAVA)
  // ==========================================
  const handleAddEntry = async () => {
    if (!contractId || contractId === "" || contractId === "none" || !activity) {
      return toast.error("Selecione contrato e atividade válidos.");
    }
    // Trava para exigir OS se o contrato for do tipo continuado_com_os
    if (currentContractType === 'continuado_com_os' && !osId) {
      return toast.error("Selecione uma Ordem de Serviço (OS) para este contrato.");
    }
    if (!notesValid) return toast.error("A observação é obrigatória para registrar as horas.");

    const startMs = getTimestampFromTimeFields(startTime, daySelection);
    const endMs = getTimestampFromTimeFields(endTime, daySelection);

    if (endMs <= startMs) return toast.error("A hora de fim deve ser posterior à hora de início.");

    const hasOverlap = entries.some(entry => {
      if (!entry.end) return false;
      return (startMs < entry.end) && (endMs > entry.start);
    });

    if (hasOverlap) return toast.error("Conflito de horário! Você já registrou horas nesse mesmo período.");

    // --- MÓDULO DA TRAVA DE SALDO (Adaptado para Mensal vs Global e Horas Ilimitadas) ---
    const durationMs = endMs - startMs;
    if (!isIlimitado) {
      // Bloqueio por Atividade
      if (activityBudgetMs > 0 && (activityUsedMs + durationMs > activityBudgetMs)) {
        const remaining = Math.max(0, activityBudgetMs - activityUsedMs);
        return toast.error(`⚠️ Saldo insuficiente na disciplina! Restam apenas ${(remaining / 3600000).toFixed(1)}h${isMensal ? ' neste mês' : ''}.`);
      }
      // Bloqueio Global do Contrato
      if (contractBudgetMs > 0 && (contractUsedMs + durationMs > contractBudgetMs)) {
        const remaining = Math.max(0, contractBudgetMs - contractUsedMs);
        return toast.error(`⚠️ Saldo global insuficiente no contrato! Restam apenas ${(remaining / 3600000).toFixed(1)}h${isMensal ? ' neste mês' : ''}.`);
      }
      // --- Trava de Horas da Ordem de Serviço (OS) ---
      if (currentContractType === 'continuado_com_os' && osId) {
        const selectedOs = osList.find(o => o.id === osId);
        if (selectedOs && selectedOs.horas_previstas > 0) {
          const osUsedMs = entries.filter(e => e.os_id === osId).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
          if (osUsedMs + durationMs > selectedOs.horas_previstas * 3600 * 1000) {
            const rem = Math.max(0, (selectedOs.horas_previstas * 3600 * 1000) - osUsedMs);
            return toast.error(`⚠️ Saldo estourado na OS ${selectedOs.codigo}! Restam apenas ${(rem / 3600000).toFixed(1)}h.`);
          }
        }
      }
    }

    const currentContract = contractsList.find((x) => x.id === contractId);
    if (!currentContract) return toast.error("Contrato inválido ou inativo.");
    
    const label = `${currentContract.code} — ${currentContract.name}`;
    const newEntryId = crypto.randomUUID();

    const newEntry: TimeEntry = {
      id: newEntryId, contractId: contractId, contractName: label, activity: activity,
      notes: notes.trim(), start: startMs, end: endMs,
    };
    
    setEntries((p) => [newEntry, ...p]);
    toast.success("Apontamento lançado com sucesso!");
    
    setNotes("");
    setStartTime(endTime);

    if (user) {
      const payload: any = {
        id: newEntryId, user_id: user.id, contract_id: contractId, contract_name: label,
        activity: activity, notes: notes.trim(),
        start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(),
      };
      
      // Anexa a OS se o contrato for do tipo adequado e uma OS estiver selecionada
      if (currentContractType === 'continuado_com_os' && osId) {
          payload.os_id = osId;
      }

      const { error } = await supabase.from('timesheets').insert(payload);
      if (error) toast.error("Erro ao salvar online!");
    }
  };

  // ==========================================
  // LÓGICA DE EDIÇÃO (COM TRAVA DE AUMENTO)
  // ==========================================
  const handleEditEntry = async (id: string, newStart: number, newEnd: number, newNotes: string) => {
    if (newEnd <= newStart) return toast.error("A hora de fim deve ser posterior à hora de início.");
    const hasOverlap = entries.some(entry => {
      if (entry.id === id) return false;
      if (!entry.end) return false;
      return (newStart < entry.end) && (newEnd > entry.start);
    });
    if (hasOverlap) return toast.error("Conflito! O novo horário invade o período de outro apontamento.");
    if (newNotes.trim().length === 0) return toast.error("A observação é obrigatória.");

    // --- MÓDULO DA TRAVA DE SALDO (NA EDIÇÃO) ---
    const entryToEdit = entries.find(e => e.id === id);
    if (entryToEdit) {
      const oldDurationMs = (entryToEdit.end ?? Date.now()) - entryToEdit.start;
      const newDurationMs = newEnd - newStart;
      const diffMs = newDurationMs - oldDurationMs; // Se aumentou o tempo, precisamos verificar o saldo
      
      const entryContractObj = contractsList.find(x => x.id === entryToEdit.contractId);
      const isEntryIlimitado = ['continuado_sem_os', 'fechado'].includes(entryContractObj?.tipo || '');
      const isEntryMensal = ['overhead', 'continuado_limite_mensal'].includes(entryContractObj?.tipo || '');

      if (!isEntryIlimitado && diffMs > 0) {
        const aAlloc = allocations.find(a => a.contract_id === entryToEdit.contractId && a.atividade === entryToEdit.activity);
        const aBudget = aAlloc ? aAlloc.horas_disponiveis * 3600 * 1000 : 0;
        const cBudget = allocations.filter(a => a.contract_id === entryToEdit.contractId).reduce((s, a) => s + (a.horas_disponiveis * 3600 * 1000), 0);

        let aUsed = 0;
        let cUsed = 0;

        if (isEntryMensal) {
             // Busca horas apenas no ciclo do apontamento
             const entryDate = new Date(entryToEdit.start);
             const cIni = entryContractObj?.tipo ? allocations.find(a => a.contract_id === entryToEdit.contractId)?.contratos?.ciclo_inicio || 25 : 25;
             const cF = entryContractObj?.tipo ? allocations.find(a => a.contract_id === entryToEdit.contractId)?.contratos?.ciclo_fim || 24 : 24;
             
             const eMonth = entryDate.getMonth(); const eYear = entryDate.getFullYear(); const eDay = entryDate.getDate();
             let bStart, bEnd;
             if (cIni > cF) {
                if (eDay >= cIni) { bStart = new Date(eYear, eMonth, cIni, 0,0,0); bEnd = new Date(eMonth === 11 ? eYear + 1 : eYear, eMonth === 11 ? 0 : eMonth + 1, cF, 23,59,59); } 
                else { bStart = new Date(eMonth === 0 ? eYear - 1 : eYear, eMonth === 0 ? 11 : eMonth - 1, cIni, 0,0,0); bEnd = new Date(eYear, eMonth, cF, 23,59,59); }
             } else {
                bStart = new Date(eYear, eMonth, cIni, 0,0,0); bEnd = new Date(eYear, eMonth, cF, 23,59,59);
             }
             cUsed = entries.filter(e => e.contractId === entryToEdit.contractId && e.start >= bStart.getTime() && e.start <= bEnd.getTime()).reduce((s, e) => s + ((e.end ?? Date.now()) - e.start), 0);
             aUsed = entries.filter(e => e.contractId === entryToEdit.contractId && e.activity === entryToEdit.activity && e.start >= bStart.getTime() && e.start <= bEnd.getTime()).reduce((s, e) => s + ((e.end ?? Date.now()) - e.start), 0);
        } else {
             aUsed = entries.filter(e => e.contractId === entryToEdit.contractId && e.activity === entryToEdit.activity).reduce((s, e) => s + ((e.end ?? Date.now()) - e.start), 0);
             cUsed = entries.filter(e => e.contractId === entryToEdit.contractId).reduce((s, e) => s + ((e.end ?? Date.now()) - e.start), 0);
        }

        if (aBudget > 0 && (aUsed + diffMs > aBudget)) {
          const remaining = Math.max(0, aBudget - aUsed);
          return toast.error(`⚠️ Saldo insuficiente na disciplina para este aumento! Restam ${(remaining / 3600000).toFixed(1)}h${isEntryMensal ? ' neste mês' : ''}.`);
        }
        if (cBudget > 0 && (cUsed + diffMs > cBudget)) {
          const remaining = Math.max(0, cBudget - cUsed);
          return toast.error(`⚠️ Saldo global insuficiente no contrato para este aumento! Restam ${(remaining / 3600000).toFixed(1)}h${isEntryMensal ? ' neste mês' : ''}.`);
        }
      }
    }

    setEntries((p) => p.map((e) => (e.id === id ? { ...e, start: newStart, end: newEnd, notes: newNotes.trim(), edited: true } : e)));
    toast.success("Apontamento atualizado");

    if (user) {
      await supabase.from('timesheets').update({
        start_at: new Date(newStart).toISOString(), end_at: new Date(newEnd).toISOString(),
        notes: newNotes.trim(), edited: true
      }).eq('id', id);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    setEntries((p) => p.filter((e) => e.id !== id));
    toast.success("Apontamento deletado");
    if (user) await supabase.from('timesheets').delete().eq('id', id);
  };

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23,59,59,999);
  const todayEntries = entries.filter(e => e.start >= todayStart.getTime() && e.start <= todayEnd.getTime());

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
              {mounted ? (theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4" />}
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
              contractType={currentContractType}
              osList={osList}
              osId={osId}
              activity={activity}
              notes={notes}
              contractUsedMs={contractUsedMs}
              activityUsedMs={activityUsedMs}
              contractBudgetMs={contractBudgetMs}
              activityBudgetMs={activityBudgetMs}
              availableActivities={availableActivities}
              onContractChange={setContractId}
              onOsChange={setOsId}
              onActivityChange={setActivity}
              onNotesChange={setNotes}
              osUsedMs={osUsedMs}
              osBudgetMs={osBudgetMs}
            />
            
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quando foi realizado?</Label>
                <RadioGroup value={daySelection} onValueChange={(v) => setDaySelection(v as "hoje" | "ontem")} className="flex gap-6">
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

            <Button onClick={handleAddEntry} disabled={!notesValid || contractId === "" || contractsList.length === 0} className="w-full h-14 bg-primary text-primary-foreground text-lg">
              <Check className="h-5 w-5 mr-2" /> Registrar Horas
            </Button>
          </div>
          
          <DailyDashboard entries={todayEntries} currentContractId={null} currentContractName={null} />
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