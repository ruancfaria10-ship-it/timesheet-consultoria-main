// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Moon, Sun, Timer, LogOut, Check, Calendar, BarChart3, ArrowLeft, Lock, Unlock, MessageSquare, Trash2, Pencil, Briefcase, FolderTree, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";
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
  os_id?: string;
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

const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const getLocalISODate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCycleBoundsForContract = (cInicio: number, cFim: number, monthStr: string, yearStr: string) => {
  const month = parseInt(monthStr);
  const year = parseInt(yearStr);
  let start, end;
  if (cInicio > cFim) {
    const startMonth = month === 0 ? 11 : month - 1;
    const startYear = month === 0 ? year - 1 : year;
    start = new Date(startYear, startMonth, cInicio, 0,0,0).getTime();
    end = new Date(year, month, cFim, 23,59,59,999).getTime();
  } else {
    start = new Date(year, month, cInicio, 0,0,0).getTime();
    end = new Date(year, month, cFim, 23,59,59,999).getTime();
  }
  return { start, end };
};

function TimesheetPage() {
  const { theme, mounted, toggle } = useTheme();
  
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [osList, setOsList] = useState<any[]>([]); 
  
  const [contractId, setContractId] = useState<string>(() => localStorage.getItem("engeprice_contractId") || "");
  const [osId, setOsId] = useState<string>(() => localStorage.getItem("engeprice_osId") || ""); 
  const [activity, setActivity] = useState<string>(() => localStorage.getItem("engeprice_activity") || "");
  const [notes, setNotes] = useState<string>("");
  const [daySelection, setDaySelection] = useState<"hoje" | "ontem">("hoje");

  const [viewMode, setViewMode] = useState<"timesheet" | "painel">("timesheet");
  
  const getTodayStr = () => getLocalISODate(new Date());
  const getYesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return getLocalISODate(d); };
  
  const [panelDate, setPanelDate] = useState<string>(getTodayStr());
  const [authorizedDates, setAuthorizedDates] = useState<string[]>([]);
  const [horasMinimasMes, setHorasMinimasMes] = useState<number>(0);

  const [panelMes, setPanelMes] = useState<string>(() => {
    const now = new Date();
    const refMonth = now.getDate() >= 25 ? (now.getMonth() === 11 ? 0 : now.getMonth() + 1) : now.getMonth();
    return refMonth.toString();
  });
  const [panelAno, setPanelAno] = useState<string>(() => {
    const now = new Date();
    const refYear = now.getDate() >= 25 && now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    return refYear.toString();
  });

  useEffect(() => { localStorage.setItem("engeprice_contractId", contractId); }, [contractId]);
  useEffect(() => { localStorage.setItem("engeprice_osId", osId); }, [osId]);
  useEffect(() => { localStorage.setItem("engeprice_activity", activity); }, [activity]);
  
  const getInitialTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  
  const [startTime, setStartTime] = useState(getInitialTimeStr);
  const [endTime, setEndTime] = useState(getInitialTimeStr);

  const notesValid = notes.trim().length > 0;

  const getTimestampFromTimeFields = (timeStr: string, dateSourceStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const [year, month, day] = dateSourceStr.split("-").map(Number);
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return date.getTime();
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTimesheets(session.user.id);
        fetchAllocations(session.user.id);
        fetchOs(); 
        fetchConsultorMeta(session.user.id);
        fetchAuthorizedDates(session.user.id);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchTimesheets(session.user.id);
        fetchAllocations(session.user.id);
        fetchOs(); 
        fetchConsultorMeta(session.user.id);
        fetchAuthorizedDates(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchConsultorMeta = async (userId: string) => {
    const { data, error } = await supabase.from('consultores').select('horas_minimas_mes').eq('id', userId).single();
    if (!error && data) setHorasMinimasMes(data.horas_minimas_mes || 0);
  };

  const fetchAuthorizedDates = async (userId: string) => {
    const { data, error } = await supabase.from('autorizacoes_edicao').select('data_liberada').eq('user_id', userId);
    if (!error && data) setAuthorizedDates(data.map(d => d.data_liberada));
  };

  const fetchAllocations = async (userId: string) => {
    const { data, error } = await supabase
      .from('alocacoes')
      .select(`id, user_id, contract_id, os_id, atividade, horas_disponiveis, contratos ( codigo, nome, status_ativo, tipo, ciclo_inicio, ciclo_fim )`)
      .eq('user_id', userId);

    if (error) return console.error("Erro ao carregar alocações:", error);
    if (data) {
      const typedData = data as unknown as AllocationRow[];
      setAllocations(typedData);
      const activeAllocations = typedData.filter(a => a.contratos?.status_ativo);
      if (activeAllocations.length > 0) {
        const savedContract = localStorage.getItem("engeprice_contractId");
        const isValidSaved = activeAllocations.some(a => a.contract_id === savedContract);
        if (!isValidSaved) setContractId(activeAllocations[0].contract_id);
      }
    }
  };

  const fetchOs = async () => {
    const { data, error } = await supabase.from('ordens_servico').select('*').eq('status_ativa', true);
    if (!error && data) setOsList(data);
  };

  const fetchTimesheets = async (userId: string) => {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('user_id', userId)
      .order('start_at', { ascending: false });

    if (error) return toast.error("Erro ao puxar dados da nuvem.");
    if (data) {
      const mapped: TimeEntry[] = data.map(row => ({
        id: row.id, contractId: row.contract_id, contractName: row.contract_name,
        activity: row.activity, notes: row.notes || undefined,
        start: new Date(row.start_at).getTime(),
        end: row.end_at ? new Date(row.end_at).getTime() : null,
        edited: row.edited, os_id: row.os_id
      }));
      setEntries(mapped);
    }
  };

  const contractsList = Array.from(new Map(
    allocations.filter(a => a.contratos?.status_ativo).map(a => [
      a.contract_id, 
      { 
        id: a.contract_id, 
        code: a.contratos!.codigo, 
        name: a.contratos!.nome, 
        tipo: a.contratos!.tipo,
        ciclo_inicio: a.contratos!.ciclo_inicio,
        ciclo_fim: a.contratos!.ciclo_fim
      }
    ])
  ).values());

  const currentContractObjFull = allocations.find(a => a.contract_id === contractId)?.contratos;
  const currentContractType = currentContractObjFull?.tipo || 'horas';
  const isComOs = currentContractType === 'continuado_com_os';

  const availableActivities = Array.from(new Set(
    allocations.filter(a => a.contract_id === contractId && (!isComOs || a.os_id === osId)).map(a => a.atividade)
  ));

  useEffect(() => {
    const cObj = contractsList.find((x) => x.id === contractId);
    if (cObj?.tipo === 'continuado_com_os') {
      const osDoContrato = osList.filter(o => o.contract_id === contractId);
      if (osDoContrato.length > 0 && !osDoContrato.find(o => o.id === osId)) {
        setOsId(osDoContrato[0].id);
      } else if (osDoContrato.length === 0) setOsId("");
    } else {
        setOsId(""); 
    }
  }, [contractId, allocations, osList]);

  useEffect(() => {
    if (availableActivities.length > 0 && !availableActivities.includes(activity)) {
      setActivity(availableActivities[0]);
    } else if (availableActivities.length === 0 && activity !== "") {
      setActivity("");
    }
  }, [availableActivities, activity]);

  // 🌟 FUNÇÃO MESTRE: Calcula os limites do ciclo VIGENTE (HOJE) do contrato
  const getContractCycleBounds = (cid: string) => {
    const c = allocations.find(a => a.contract_id === cid)?.contratos;
    const cIni = c?.ciclo_inicio || 25;
    const cF = c?.ciclo_fim || 24;
    
    const now = new Date(); 
    const currentDay = now.getDate(); 
    const currentMonth = now.getMonth(); 
    const currentYear = now.getFullYear();
    let start, end;
    
    if (cIni > cF) {
      if (currentDay >= cIni) { 
        start = new Date(currentYear, currentMonth, cIni, 0,0,0); 
        end = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, cF, 23,59,59,999); 
      } else { 
        start = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, cIni, 0,0,0); 
        end = new Date(currentYear, currentMonth, cF, 23,59,59,999); 
      }
    } else { 
      start = new Date(currentYear, currentMonth, cIni, 0,0,0); 
      end = new Date(currentYear, currentMonth, cF, 23,59,59,999); 
    }
    return { start: start.getTime(), end: end.getTime() };
  };

  // Bounds de quem o usuário quer enxergar (Hoje vs Ontem)
  const daySelectionDate = useMemo(() => {
    if (daySelection === 'ontem') {
      const d = new Date(); d.setDate(d.getDate() - 1); return d;
    }
    return new Date();
  }, [daySelection]);

  const cycleBounds = useMemo(() => {
    const c = allocations.find(a => a.contract_id === contractId)?.contratos;
    const cIni = c?.ciclo_inicio || 25;
    const cF = c?.ciclo_fim || 24;
    const currentDay = daySelectionDate.getDate(); 
    const currentMonth = daySelectionDate.getMonth(); 
    const currentYear = daySelectionDate.getFullYear();
    let start, end;
    if (cIni > cF) {
      if (currentDay >= cIni) { start = new Date(currentYear, currentMonth, cIni, 0,0,0); end = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, cF, 23,59,59,999); } 
      else { start = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, cIni, 0,0,0); end = new Date(currentYear, currentMonth, cF, 23,59,59,999); }
    } else { start = new Date(currentYear, currentMonth, cIni, 0,0,0); end = new Date(currentYear, currentMonth, cF, 23,59,59,999); }
    return { start: start.getTime(), end: end.getTime() };
  }, [contractId, allocations, daySelectionDate]);

  const currentOsObj = osList.find(o => o.id === osId);
  const isIlimitado = ['continuado_sem_os', 'fechado'].includes(currentContractType) || currentOsObj?.codigo === '🛠️ Pequenos Suportes';

  // 🌟 Se o ciclo visualizado na tela já encerrou (ex: olhou pra "ontem" mas o ciclo virou hoje), o orçamento congela e zera saldo
  const isMainCyclePast = cycleBounds.end < Date.now();

  const contractUsedMs = isComOs 
    ? entries.filter(e => e.os_id === osId && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0)
    : entries.filter(e => e.contractId === contractId && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
  
  const activityUsedMs = entries.filter(e => e.contractId === contractId && e.activity === activity && (!isComOs || e.os_id === osId) && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
  const osUsedMs = entries.filter(e => e.os_id === osId).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);

  // Orçamentos Congelados se o Ciclo fechou
  const contractBudgetMs = isMainCyclePast 
    ? contractUsedMs
    : (isComOs 
      ? allocations.filter(a => a.contract_id === contractId && a.os_id === osId).reduce((sum, a) => sum + (a.horas_disponiveis * 3600 * 1000), 0)
      : allocations.filter(a => a.contract_id === contractId).reduce((sum, a) => sum + (a.horas_disponiveis * 3600 * 1000), 0));

  const currentActivityAlloc = allocations.find(a => a.contract_id === contractId && a.atividade === activity && (!isComOs || a.os_id === osId));
  const activityBudgetMs = isMainCyclePast 
    ? activityUsedMs 
    : (currentActivityAlloc ? currentActivityAlloc.horas_disponiveis * 3600 * 1000 : 0);

  const osBudgetMs = isMainCyclePast ? osUsedMs : (currentOsObj ? currentOsObj.horas_previstas * 3600 * 1000 : 0);

  // =====================================
  // MOTOR DO PAINEL DO CONSULTOR
  // =====================================
  const panelCycleBounds = useMemo(() => {
    const month = parseInt(panelMes);
    const year = parseInt(panelAno);
    const startMonth = month === 0 ? 11 : month - 1;
    const startYear = month === 0 ? year - 1 : year;
    const start = new Date(startYear, startMonth, 25, 0, 0, 0).getTime();
    const end = new Date(year, month, 24, 23, 59, 59, 999).getTime();
    return { start, end };
  }, [panelMes, panelAno]);

  const panelCycleEntries = useMemo(() => {
    return entries.filter(e => e.start >= panelCycleBounds.start && e.start <= panelCycleBounds.end);
  }, [entries, panelCycleBounds]);

  const horasTrabalhadasMesAtual = useMemo(() => {
    let sum = 0;
    entries.forEach(e => {
       const cObj = contractsList.find(c => c.id === e.contractId);
       if (cObj) {
           const cb = getCycleBoundsForContract(cObj.ciclo_inicio, cObj.ciclo_fim, panelMes, panelAno);
           if (e.start >= cb.start && e.start <= cb.end) sum += ((e.end ?? Date.now()) - e.start) / 3600000;
       }
    });
    return sum;
  }, [entries, panelMes, panelAno, contractsList]);

  const resumoPorTipo = useMemo(() => {
    let fechado = 0; let horas = 0;
    entries.forEach(e => {
      const cObj = contractsList.find(c => c.id === e.contractId);
      if (cObj) {
        const cb = getCycleBoundsForContract(cObj.ciclo_inicio, cObj.ciclo_fim, panelMes, panelAno);
        if (e.start >= cb.start && e.start <= cb.end) {
          const duration = ((e.end ?? Date.now()) - e.start);
          if (cObj.tipo === 'fechado') fechado += duration;
          else horas += duration;
        }
      }
    });
    return { fechado: fechado / 3600000, horas: horas / 3600000 };
  }, [entries, contractsList, panelMes, panelAno]);

  const totalOrcadoMes = useMemo(() => {
    let totalOrcadoNesteCiclo = 0;
    let hasIlimitado = false;

    allocations.filter(a => a.contratos?.status_ativo).forEach(alloc => {
       const cb = getCycleBoundsForContract(alloc.contratos!.ciclo_inicio, alloc.contratos!.ciclo_fim, panelMes, panelAno);
       const isComOsCheck = alloc.contratos!.tipo === 'continuado_com_os';
       const osObjCheck = isComOsCheck && alloc.os_id ? osList.find(o => o.id === alloc.os_id) : null;
       const isSuportesCheck = osObjCheck?.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'fechado'].includes(alloc.contratos!.tipo);
       
       const nowTime = Date.now();
       const isPast = cb.end < nowTime;
       const isCurrent = nowTime >= cb.start && nowTime <= cb.end;

       let filterEntries = entries.filter(e => e.contractId === alloc.contract_id && e.activity === alloc.atividade && e.start >= cb.start && e.start <= cb.end);
       if (isComOsCheck && alloc.os_id) filterEntries = filterEntries.filter(e => e.os_id === alloc.os_id);
       const gastoCiclo = filterEntries.reduce((sum, e) => sum + (((e.end ?? Date.now()) - e.start)), 0) / 3600000;

       if (isSuportesCheck) {
          hasIlimitado = true;
          totalOrcadoNesteCiclo += gastoCiclo;
       } else {
          if (isPast) totalOrcadoNesteCiclo += gastoCiclo;
          else if (isCurrent) totalOrcadoNesteCiclo += alloc.horas_disponiveis;
          else totalOrcadoNesteCiclo += 0;
       }
    });
    return { total: totalOrcadoNesteCiclo, hasIlimitado };
  }, [allocations, osList, entries, panelMes, panelAno]);

  const saldoHorasMes = Math.max(0, totalOrcadoMes.total - horasTrabalhadasMesAtual);
  const percentualGasto = totalOrcadoMes.total > 0 ? (horasTrabalhadasMesAtual / totalOrcadoMes.total) * 100 : 0;
  const metaDeg = totalOrcadoMes.total > 0 ? (horasMinimasMes / totalOrcadoMes.total) * 360 : 0;

  const pieData = useMemo(() => {
    if (totalOrcadoMes.total === 0) return [{ name: 'Sem Registros', value: 1 }];
    const d = [
      { name: 'Já Entregue', value: Number(horasTrabalhadasMesAtual.toFixed(1)) },
      { name: 'Saldo a Entregar', value: Number(saldoHorasMes.toFixed(1)) }
    ].filter(i => i.value > 0);
    return d.length > 0 ? d : [{ name: 'Sem Registros', value: 1 }];
  }, [horasTrabalhadasMesAtual, saldoHorasMes, totalOrcadoMes]);

  const isPanelDateUnlocked = useMemo(() => authorizedDates.includes(panelDate), [panelDate, authorizedDates]);

  const panelDayEntries = useMemo(() => {
    const [y, m, d] = panelDate.split("-").map(Number);
    const startDay = new Date(y, m - 1, d, 0, 0, 0).getTime();
    const endDay = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    return entries.filter(e => e.start >= startDay && e.start <= endDay);
  }, [entries, panelDate]);

  // 🌟 DETALHAMENTO DE ALOCAÇÕES - Ajustado com a trava imbatível do Date.now()
  const detalhamentoAlocacoes = useMemo(() => {
    const map = new Map<string, any>();
    
    allocations.filter(a => a.contratos?.status_ativo).forEach(alloc => {
      if (!map.has(alloc.contract_id)) {
        map.set(alloc.contract_id, {
          id: alloc.contract_id, codigo: alloc.contratos!.codigo, nome: alloc.contratos!.nome,
          tipo: alloc.contratos!.tipo, inicio: alloc.contratos!.ciclo_inicio, fim: alloc.contratos!.ciclo_fim, osGroups: new Map()
        });
      }
      const cData = map.get(alloc.contract_id);
      const isComOs = cData.tipo === 'continuado_com_os';
      const osKey = isComOs && alloc.os_id ? alloc.os_id : 'sem_os';
      if (!cData.osGroups.has(osKey)) {
        const osObj = osList.find(o => o.id === osKey);
        cData.osGroups.set(osKey, { id: osKey, codigo: osObj?.codigo || '', nome: osObj?.descricao || '', atividades: [] });
      }
      cData.osGroups.get(osKey).atividades.push(alloc);
    });

    return Array.from(map.values()).map(contract => {
      let totalGastoContrato = 0; let totalOrcadoNum = 0; let hasIlimitado = false;
      const cb = getCycleBoundsForContract(contract.inicio, contract.fim, panelMes, panelAno);

      const nowTime = Date.now();
      const isCurrent = nowTime >= cb.start && nowTime <= cb.end;
      const isPast = cb.end < nowTime;

      const osGroupsProcessed = Array.from(contract.osGroups.values()).map((osGroup: any) => {
        const isSuportes = osGroup.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'fechado'].includes(contract.tipo);
        if (isSuportes) hasIlimitado = true;

        const atividadesProcessadas = osGroup.atividades.map((a: any) => {
          let filterCycle = entries.filter(e => e.contractId === contract.id && e.activity === a.atividade && e.start >= cb.start && e.start <= cb.end);
          if (contract.tipo === 'continuado_com_os' && osGroup.id !== 'sem_os') {
             filterCycle = filterCycle.filter(e => e.os_id === osGroup.id);
          }
          
          const gastoCicloH = filterCycle.reduce((sum, e) => sum + (((e.end ?? Date.now()) - e.start)), 0) / 3600000;
          
          let orcadoCicloH = 0;
          if (isSuportes) orcadoCicloH = gastoCicloH;
          else {
            if (isPast) orcadoCicloH = gastoCicloH; // O Segredo Mestre: Passado = Executado
            else if (isCurrent) orcadoCicloH = a.horas_disponiveis;
            else orcadoCicloH = 0;
          }
          const saldoH = isSuportes ? 0 : (orcadoCicloH - gastoCicloH);

          totalGastoContrato += gastoCicloH;
          totalOrcadoNum += orcadoCicloH;

          return { nome: a.atividade, orcado: orcadoCicloH, gasto: gastoCicloH, saldo: saldoH, isSuportes };
        });
        return { ...osGroup, isSuportes, atividades: atividadesProcessadas };
      });

      return {
        ...contract, osGroups: osGroupsProcessed, hasIlimitado, totalOrcado: totalOrcadoNum,
        totalGasto: totalGastoContrato, totalSaldo: hasIlimitado ? 0 : (totalOrcadoNum - totalGastoContrato)
      };
    });
  }, [allocations, entries, panelMes, panelAno, osList]);

  // ==========================================
  // OPERAÇÕES DE LANÇAMENTO E EXCLUSÃO (COM O CÃO DE GUARDA)
  // ==========================================
  const executeLaunch = async (dateStr: string) => {
    if (!contractId || contractId === "" || contractId === "none" || !activity) return toast.error("Selecione contrato e atividade válidos.");
    if (currentContractType === 'continuado_com_os' && !osId) return toast.error("Selecione uma Ordem de Serviço (OS) para este contrato.");
    if (!notesValid) return toast.error("A observação é obrigatória para registrar as horas.");

    const startMs = getTimestampFromTimeFields(startTime, dateStr);
    const endMs = getTimestampFromTimeFields(endTime, dateStr);

    // 🌟 CÃO DE GUARDA: Impede o apontamento se o ciclo correspondente ao contrato já estiver no passado
    const activeCb = getContractCycleBounds(contractId);
    if (startMs < activeCb.start) {
        return toast.error("🚫 Ciclo Fechado! Não é possível registrar horas em um ciclo já encerrado para este contrato.");
    }

    if (endMs <= startMs) return toast.error("A hora de fim deve ser posterior à hora de início.");

    const hasOverlap = entries.some(entry => {
      if (!entry.end) return false;
      return (startMs < entry.end) && (endMs > entry.start);
    });

    if (hasOverlap) return toast.error("Conflito de horário! Você já possui horas nesse período.");

    const durationMs = endMs - startMs;
    if (!isIlimitado) {
      if (activityBudgetMs > 0 && (activityUsedMs + durationMs > activityBudgetMs)) {
        const remaining = Math.max(0, activityBudgetMs - activityUsedMs);
        return toast.error(`⚠️ Saldo insuficiente na disciplina! Restam apenas ${(remaining / 3600000).toFixed(1)}h.`);
      }
      if (contractBudgetMs > 0 && (contractUsedMs + durationMs > contractBudgetMs)) {
        const remaining = Math.max(0, contractBudgetMs - contractUsedMs);
        return toast.error(`⚠️ Saldo global insuficiente no contrato! Restam apenas ${(remaining / 3600000).toFixed(1)}h.`);
      }
    }

    const currentContract = contractsList.find((x) => x.id === contractId);
    if (!currentContract) return toast.error("Contrato inválido ou inativo.");
    
    const label = `${currentContract.code} — ${currentContract.name}`;
    const newEntryId = crypto.randomUUID();

    const newEntry: TimeEntry = {
      id: newEntryId, contractId: contractId, contractName: label, activity: activity,
      notes: notes.trim(), start: startMs, end: endMs, os_id: isComOs ? osId : undefined
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
      if (currentContractType === 'continuado_com_os' && osId) payload.os_id = osId;
      const { error } = await supabase.from('timesheets').insert(payload);
      if (error) toast.error("Erro ao salvar online!");
    }
  };

  const handleAddEntry = () => executeLaunch(daySelection === "hoje" ? getTodayStr() : getYesterdayStr());
  const handleAddPanelEntry = () => executeLaunch(panelDate);

  const handleEditEntry = async (id: string, newStart: number, newEnd: number, newNotes: string) => {
    const entryToEdit = entries.find(e => e.id === id);
    if (entryToEdit) {
       // 🌟 CÃO DE GUARDA (Edição)
       const activeCb = getContractCycleBounds(entryToEdit.contractId);
       if (entryToEdit.start < activeCb.start || newStart < activeCb.start) {
           return toast.error("🚫 Ciclo Fechado! Não é possível alterar apontamentos em um ciclo encerrado.");
       }

       const entryDateStr = new Date(entryToEdit.start).toISOString().split('T')[0];
       if (entryDateStr !== getTodayStr() && entryDateStr !== getYesterdayStr() && !authorizedDates.includes(entryDateStr)) {
          return toast.error("Sem autorização para alterar datas passadas. Fale com seu gestor.");
       }
    }

    if (newEnd <= newStart) return toast.error("A hora de fim deve ser posterior à hora de início.");
    if (newNotes.trim().length === 0) return toast.error("A observação é obrigatória.");

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
    const entryToDel = entries.find(e => e.id === id);
    if (entryToDel) {
       // 🌟 CÃO DE GUARDA (Exclusão)
       const activeCb = getContractCycleBounds(entryToDel.contractId);
       if (entryToDel.start < activeCb.start) {
           return toast.error("🚫 Ciclo Fechado! Não é possível excluir apontamentos de um ciclo já encerrado.");
       }

       const entryDateStr = new Date(entryToDel.start).toISOString().split('T')[0];
       if (entryDateStr !== getTodayStr() && entryDateStr !== getYesterdayStr() && !authorizedDates.includes(entryDateStr)) {
          return toast.error("Sem autorização para excluir lançamentos passados. Fale com seu gestor.");
       }
    }

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
    <div className="flex-1 flex flex-col h-full bg-background text-foreground w-full">
      <Toaster position="top-right" richColors />
      <header className="border-b w-full shrink-0">
        <div className="mx-auto w-full max-w-none px-4 md:px-8 py-3 flex items-center justify-between">
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

      <main className="w-full max-w-none px-4 md:px-8 py-6 overflow-x-hidden">
        {viewMode === "timesheet" ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <section className="space-y-6">
              <div className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
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
                    <p className="text-[10px] text-muted-foreground italic mt-1">Lançamentos de hoje ou ontem são liberados. Para dias anteriores, acesse o painel.</p>
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
              
              <div className="relative">
                <DailyDashboard entries={todayEntries} currentContractId={null} currentContractName={null} />
                <div className="mt-4">
                  <Button onClick={() => setViewMode("painel")} variant="outline" className="w-full h-12 gap-2 border-primary/40 hover:bg-primary/5 text-primary text-sm font-bold shadow-xs">
                    <BarChart3 className="w-4 h-4" /> 📊 Ver Detalhamentos & Painel do Consultor
                  </Button>
                </div>
              </div>
            </section>
            
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Painel de Histórico</h2>
                <span className="text-xs text-muted-foreground">Ciclo Atual</span>
              </div>
              <HistoryList entries={targetHistoryEntries} onEdit={handleEditEntry} onDelete={handleDeleteEntry} />
            </section>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in-50 duration-200 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Painel de Performance e Histórico</h2>
                <p className="text-xs text-muted-foreground">Consulte seu andamento, saldos de contratos e preencha horas autorizadas.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-lg border">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-2">Ciclo:</Label>
                  <Select value={panelMes} onValueChange={setPanelMes}>
                    <SelectTrigger className="w-28 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={panelAno} onValueChange={setPanelAno}>
                    <SelectTrigger className="w-20 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setViewMode("timesheet")} variant="ghost" size="sm" className="gap-1.5 text-xs h-11 border bg-card hover:bg-muted">
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2 shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Resumo do Ciclo Selecionado
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col sm:flex-row items-center gap-8">
                  <div className="w-32 h-32 relative shrink-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} startAngle={90} endAngle={-270} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} stroke="none">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Já Entregue' ? '#3b82f6' : '#e2e8f0'} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                           formatter={(v: number) => [`${v.toFixed(1)}h`, '']} 
                           contentStyle={{ borderRadius: '8px', fontSize: '12px' }} 
                           wrapperStyle={{ zIndex: 100 }} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none z-0">
                       <span className="text-[14px] font-black text-foreground">{percentualGasto.toFixed(0)}%</span>
                    </div>

                    {horasMinimasMes > 0 && totalOrcadoMes.total > 0 && (
                      <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ transform: `rotate(${metaDeg}deg)` }}>
                        <div className="mx-auto w-0.75 h-6 bg-amber-400 mt-1 rounded-full shadow-sm border border-amber-500/50" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 w-full space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-xs font-semibold text-muted-foreground">Total Previsto no Ciclo</span>
                      <span className="font-mono font-bold">
                        {totalOrcadoMes.total.toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-xs font-semibold text-blue-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Já Entregue
                      </span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-blue-600">{horasTrabalhadasMesAtual.toFixed(1)}h</span>
                        {totalOrcadoMes.total > 0 && (
                           <span className="text-[10px] text-blue-600/70 ml-1 font-bold">({percentualGasto.toFixed(1)}%)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span> Saldo a Entregar
                      </span>
                      <span className="font-mono font-bold">
                        {saldoHorasMes.toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="w-1.5 h-3 rounded-sm bg-amber-400"></span> Marco da Meta Assegurada
                      </span>
                      <span className="font-mono font-bold text-amber-600">{horasMinimasMes}h</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm flex flex-col">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Status de Edição</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col justify-center flex-1 text-xs pt-4">
                  <div className="flex items-center gap-3 bg-muted/20 p-4 rounded-xl border">
                    {authorizedDates.length > 0 ? (
                      <>
                        <Unlock className="w-5 h-5 text-green-600 shrink-0" />
                        <div>
                          <p className="font-bold text-green-700 text-sm">Acesso Liberado</p>
                          <p className="text-muted-foreground mt-0.5">Você possui {authorizedDates.length} data(s) abertas para ajuste no histórico.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <p className="font-bold text-amber-700 text-sm">Painel Bloqueado</p>
                          <p className="text-muted-foreground mt-0.5">Sem acessos retroativos no momento. <br/><br/><span className="font-bold">Lançamentos de hoje e ontem devem ser feitos na página principal.</span></p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                <Briefcase className="w-4 h-4" /> Detalhamento de Saldo por Contrato
              </h3>
              
              <Accordion type="multiple" className="w-full space-y-3">
                {detalhamentoAlocacoes.map(contract => (
                  <AccordionItem key={contract.id} value={contract.id} className="border rounded-xl bg-card overflow-hidden shadow-sm">
                    <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 transition-colors data-[state=open]:bg-muted/10 hover:no-underline">
                      <div className="flex flex-col md:flex-row md:items-center justify-between w-full text-left gap-4 pr-4">
                        <div>
                          <p className="text-sm font-bold text-primary">{contract.codigo} - {contract.nome}</p>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">{contract.tipo.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="flex items-center gap-6 text-xs">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Orçado</p>
                            <p className="font-mono font-bold text-foreground">
                              {contract.hasIlimitado && contract.totalOrcado === 0 ? <span className="text-amber-600 flex items-center justify-end"><Wrench className="w-3 h-3"/></span> : `${contract.totalOrcado.toFixed(1)}h`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Consumido</p>
                            <p className="font-mono font-bold text-primary">{contract.totalGasto.toFixed(1)}h</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                            <p className={`font-mono font-bold ${contract.totalSaldo < 0 && !contract.hasIlimitado ? 'text-red-500' : 'text-green-600'}`}>
                              {contract.hasIlimitado && contract.totalSaldo === 0 ? <span className="text-amber-600 flex items-center justify-end"><Wrench className="w-3 h-3"/></span> : `${contract.totalSaldo.toFixed(1)}h`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="p-0 border-t bg-muted/5">
                      {contract.osGroups.map((osGroup: any) => (
                        <div key={osGroup.id} className="border-b last:border-0 border-dashed">
                          {osGroup.id !== 'sem_os' && (
                            <div className="bg-muted/10 px-4 py-2 border-b text-xs font-bold text-foreground/80 flex items-center gap-2">
                              {osGroup.isSuportes ? <Wrench className="w-3.5 h-3.5 text-amber-600"/> : <FolderTree className="w-3.5 h-3.5" />} 
                              <span className={osGroup.isSuportes ? "text-amber-700" : ""}>OS: {osGroup.codigo} {osGroup.nome ? `- ${osGroup.nome}` : ''}</span>
                            </div>
                          )}
                          <div className="px-4 py-2 overflow-x-auto">
                            <table className="w-full text-xs text-left min-w-72">
                              <thead>
                                <tr className="text-muted-foreground/70">
                                  <th className="pb-2 font-medium">Disciplina / Escopo</th>
                                  <th className="pb-2 font-medium text-right w-20">Orçado</th>
                                  <th className="pb-2 font-medium text-right w-20">Consumido</th>
                                  <th className="pb-2 font-medium text-right w-20">Saldo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {osGroup.atividades.map((ativ: any, idx: number) => (
                                  <tr key={idx} className="border-t border-muted/50 hover:bg-muted/20">
                                    <td className="py-2.5 font-medium">{ativ.nome}</td>
                                    <td className="py-2.5 text-right text-muted-foreground font-mono">
                                      {ativ.isSuportes && ativ.orcado === 0 ? <span className="flex items-center justify-end text-amber-600"><Wrench className="w-3 h-3"/></span> : `${ativ.orcado.toFixed(1)}h`}
                                    </td>
                                    <td className="py-2.5 text-right text-primary font-bold font-mono">{ativ.gasto.toFixed(1)}h</td>
                                    <td className={`py-2.5 text-right font-bold font-mono ${ativ.saldo < 0 && !ativ.isSuportes ? 'text-red-500' : 'text-green-600'}`}>
                                      {ativ.isSuportes && ativ.saldo === 0 ? <span className="flex items-center justify-end text-amber-600"><Wrench className="w-3 h-3"/></span> : `${ativ.saldo.toFixed(1)}h`}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <Card className="shadow-sm bg-muted/10 border-dashed">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Horas Entregues no Ciclo</p>
                      <p className="text-sm font-bold text-primary">Contratos por Hora</p>
                    </div>
                    <p className="text-xl font-mono font-black">{resumoPorTipo.horas.toFixed(1)}h</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-muted/10 border-dashed">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Horas Entregues no Ciclo</p>
                      <p className="text-sm font-bold text-primary">Preços Fechados</p>
                    </div>
                    <p className="text-xl font-mono font-black">{resumoPorTipo.fechado.toFixed(1)}h</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] items-start pt-6 border-t">
              <div className="space-y-4">
                <Card className="shadow-sm">
                  <CardHeader className="pb-4 border-b">
                    <div className="flex flex-wrap items-center gap-4 justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Histórico Autorizado</CardTitle>
                        <CardDescription>Escolha o dia no calendário para consultar ou registrar apontamentos.</CardDescription>
                      </div>
                      <div className="w-full max-w-44">
                        <Input type="date" value={panelDate} max={getTodayStr()} onChange={(e) => setPanelDate(e.target.value)} className="font-mono h-9 font-medium" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5">
                    {isPanelDateUnlocked ? (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-700 p-3 rounded-xl text-xs font-semibold">
                          <Unlock className="w-4 h-4" />
                          <span>Esta data está desbloqueada. Você pode consultar, inserir ou excluir horas neste dia.</span>
                        </div>
                        
                        <div className="space-y-6">
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
                          
                          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                            <div className="space-y-1.5">
                              <Label>Horário de Início</Label>
                              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Horário de Fim</Label>
                              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                            </div>
                          </div>

                          <Button onClick={handleAddPanelEntry} disabled={!notesValid || contractId === ""} className="w-full h-12 bg-primary">
                            <Check className="w-4 h-4 mr-2" /> Gravar Registro no Dia {panelDate.split('-').reverse().join('/')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 px-4 border border-dashed rounded-xl text-center bg-red-500/5 border-red-500/10 max-w-xl mx-auto flex flex-col items-center justify-center">
                        <Lock className="w-8 h-8 text-red-500 mb-3" />
                        <h4 className="font-bold text-sm text-foreground">Data Bloqueada para Alterações</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                          Não há autorizações ativas para inserir dados neste dia. Caso precise ajustar, solicite a liberação com o gestor do contrato.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Lançamentos do Dia: {panelDate.split('-').reverse().join('/')}
                  </h3>
                  <Badge variant="secondary" className="font-mono">{panelDayEntries.length} itens</Badge>
                </div>

                {panelDayEntries.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-10 border border-dashed rounded-xl bg-card">
                    Nenhum apontamento efetuado nesta data.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-125 overflow-y-auto pr-1">
                    {panelDayEntries.map((entry) => {
                      const s = new Date(entry.start);
                      const e = entry.end ? new Date(entry.end) : new Date();
                      const hours = ((e.getTime() - s.getTime()) / 3600000).toFixed(1);
                      
                      return (
                        <div key={entry.id} className="p-3.5 bg-card border rounded-xl shadow-xs space-y-2 text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-bold text-foreground leading-tight">{entry.contractName}</p>
                              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{entry.activity}</p>
                            </div>
                            <Badge variant="outline" className="font-mono shrink-0 bg-primary/5 text-primary border-primary/10">{hours}h</Badge>
                          </div>
                          {entry.notes && (
                            <p className="text-[11px] italic text-muted-foreground/90 bg-muted/40 p-2 rounded-md border border-muted/50 leading-relaxed">
                              "{entry.notes}"
                            </p>
                          )}
                          
                          {isPanelDateUnlocked && (
                            <div className="flex justify-end gap-1.5 pt-1 border-t border-dashed mt-2">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-red-500 hover:bg-red-500/10" onClick={() => handleDeleteEntry(entry.id)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Excluir
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}