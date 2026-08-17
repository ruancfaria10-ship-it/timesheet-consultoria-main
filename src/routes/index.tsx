// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Moon, Sun, Timer, LogOut, Check, Calendar, BarChart3, ArrowLeft, Lock, Unlock, MessageSquare, Trash2, Pencil, Briefcase, FolderTree, Wrench, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { usePerfil } from "@/hooks/use-perfil";
import { UpdatePassword } from "@/components/UpdatePassword";

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
  mes: string; 
  ano: string; 
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

const getCycleMonthYear = (date: Date, cInicio: number, cFim: number) => {
  const d = date.getDate();
  let m = date.getMonth();
  let y = date.getFullYear();
  if (cInicio > cFim && d >= cInicio) { 
    m = m === 11 ? 0 : m + 1;
    if (m === 0) y++;
  }
  return { month: String(m), year: String(y) };
}

let urlOriginal = typeof window !== 'undefined' ? window.location.href : '';

function TimesheetPage() {
  const { theme, mounted, toggle } = useTheme();
  const { isAdmin } = usePerfil();
  
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{nome: string, avatar_url: string | null} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [showUpdatePassword, setShowUpdatePassword] = useState(false);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase.from('consultores').select('nome, avatar_url').eq('id', userId).single();
    if (!error && data) setUserProfile(data);
  };
  
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
  const [medicoesPainel, setMedicoesPainel] = useState<any[]>([]);
  const [ordemMatriz, setOrdemMatriz] = useState<Record<string, string[]>>({});

  // Estado para controlar a edição retroativa
  const [editingRetroId, setEditingRetroId] = useState<string | null>(null);

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

  // 🌟 ETAPA 4: Modo de visualização no Painel do Consultor ('ciclo' ou 'intervalo')
  const [panelModoData, setPanelModoData] = useState<'ciclo' | 'intervalo'>('ciclo');
  const [panelDataInicio, setPanelDataInicio] = useState<string>(getTodayStr());
  const [panelDataFim, setPanelDataFim] = useState<string>(getTodayStr());

  // 🌟 BLINDAGEM: Reseta para 'ciclo' sempre que o consultor fechar/voltar do painel
  useEffect(() => {
    if (viewMode === 'timesheet') {
      setPanelModoData('ciclo');
    }
  }, [viewMode]);


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
    const checkHashAndTokens = () => {
      if ((urlOriginal.includes('type=invite') || urlOriginal.includes('type=recovery')) && !sessionStorage.getItem('senha_redefinida')) {
        setShowUpdatePassword(true);
        sessionStorage.setItem('senha_redefinida', 'true');
        urlOriginal = ''; 
      }
    };

    checkHashAndTokens();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchTimesheets(session.user.id);
        fetchAllocations(session.user.id);
        fetchOs(); 
        fetchConsultorMeta(session.user.id);
        fetchAuthorizedDates(session.user.id);
        fetchOrdemMatriz(session.user.id); // <--- ADICIONE ESTA LINHA NAS DUAS VEZES QUE APARECE
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'PASSWORD_RECOVERY' && !sessionStorage.getItem('senha_redefinida')) {
        setShowUpdatePassword(true);
        sessionStorage.setItem('senha_redefinida', 'true');
      }
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
        fetchTimesheets(session.user.id);
        fetchAllocations(session.user.id);
        fetchOs(); 
        fetchConsultorMeta(session.user.id);
        fetchAuthorizedDates(session.user.id);
        fetchOrdemMatriz(session.user.id);
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

  const fetchMedicoesPainel = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.from('medicoes').select('*').eq('user_id', user.id);
    if (!error && data) setMedicoesPainel(data);
  };

  const fetchOrdemMatriz = async (userId: string) => {
    const { data: bases } = await supabase.from('linha_base').select('id, contract_id, os_id');
    const { data: items } = await supabase.from('linha_base_items').select('base_id, atividades').eq('user_id', userId);
    if (bases && items) {
       const map: Record<string, string[]> = {};
       items.forEach(item => {
           const base = bases.find(b => b.id === item.base_id);
           if (base) {
               const key = `${base.contract_id}_${base.os_id || 'sem_os'}`;
               map[key] = item.atividades || [];
           }
       });
       setOrdemMatriz(map);
    }
  };

  useEffect(() => {
    if (user?.id) fetchMedicoesPainel();
  }, [user?.id]);

  const fetchAllocations = async (userId: string) => {
    const { data, error } = await supabase
      .from('alocacoes')
      .select(`id, user_id, contract_id, os_id, atividade, horas_disponiveis, mes, ano, contratos ( codigo, nome, status_ativo, tipo, ciclo_inicio, ciclo_fim )`)
      .eq('user_id', userId);

    if (error) return console.error("Erro ao carregar alocações:", error);
    if (data) {
      const rawData = data as unknown as AllocationRow[];
      
      // --- NOVA TRAVA: FILTRA ALOCAÇÕES ZERADAS ---
      // Como Overhead e Pequenos Suportes salvam 9999 no banco, eles passam automaticamente no > 0.
      const validAllocations = rawData.filter(a => a.horas_disponiveis > 0 || a.atividade === 'Preço Fechado (Medição)');

      setAllocations(validAllocations);
      
      const activeAllocations = validAllocations.filter(a => a.contratos?.status_ativo);
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
    allocations
      .filter(a => a.contratos?.status_ativo && a.atividade !== 'Preço Fechado (Medição)')
      .map(a => [
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

  const currentContractObjFull = contractsList.find((x) => x.id === contractId);
  const currentContractType = currentContractObjFull?.tipo || 'horas';
  const isComOs = currentContractType === 'continuado_com_os';

  const daySelectionDate = useMemo(() => {
    if (daySelection === 'ontem') {
      const d = new Date(); d.setDate(d.getDate() - 1); return d;
    }
    return new Date();
  }, [daySelection]);

  const activeCycleForInput = useMemo(() => {
    const cIni = currentContractObjFull?.ciclo_inicio || 25;
    const cFim = currentContractObjFull?.ciclo_fim || 24;
    return getCycleMonthYear(daySelectionDate, cIni, cFim);
  }, [currentContractObjFull, daySelectionDate]);

  const filteredOsList = useMemo(() => {
      return osList.filter(os => {
        // Oculta a OS se o consultor estiver nela como Preço Fechado no mês atual
        const isFechado = allocations.some(a => a.os_id === os.id && a.atividade === 'Preço Fechado (Medição)' && a.mes === activeCycleForInput.month && a.ano === activeCycleForInput.year);
        return !isFechado;
      });
    }, [osList, allocations, activeCycleForInput]);

  const availableActivities = useMemo(() => {
    const rawActivities = Array.from(new Set(
      allocations.filter(a => 
        a.contract_id === contractId && 
        (!isComOs || a.os_id === osId) && 
        a.mes === activeCycleForInput.month && 
        a.ano === activeCycleForInput.year
      ).map(a => a.atividade)
    ));

    const key = `${contractId}_${isComOs ? (osId || 'sem_os') : 'sem_os'}`;
    const ordemOficial = ordemMatriz[key] || [];
    
    return rawActivities.sort((a, b) => {
      const indexA = ordemOficial.indexOf(a);
      const indexB = ordemOficial.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [allocations, contractId, osId, activeCycleForInput, isComOs, ordemMatriz]);

  useEffect(() => {
    const cObj = contractsList.find((x) => x.id === contractId);
    if (cObj?.tipo === 'continuado_com_os') {
      const osDoContrato = filteredOsList.filter(o => o.contract_id === contractId);
      const savedOs = localStorage.getItem("engeprice_osId");
      const savedOsValida = osDoContrato.some(o => o.id === savedOs);

      if (savedOsValida && savedOs) {
        setOsId(savedOs);
      } else if (osDoContrato.length > 0 && !osDoContrato.find(o => o.id === osId)) {
        setOsId(osDoContrato[0].id);
      } else if (osDoContrato.length === 0) {
        setOsId("");
      }
    } else {
      setOsId(""); 
    }
  }, [contractId, allocations, osList]);

  useEffect(() => {
    const savedActivity = localStorage.getItem("engeprice_activity");
    const isSavedValid = availableActivities.includes(savedActivity || "");

    if (isSavedValid && savedActivity) {
      if (activity !== savedActivity) setActivity(savedActivity);
    } else if (availableActivities.length > 0 && !availableActivities.includes(activity)) {
      setActivity(availableActivities[0]);
    } else if (availableActivities.length === 0 && activity !== "") {
      setActivity("");
    }
  }, [availableActivities]);

  const getContractCycleBounds = (cid: string) => {
    const c = contractsList.find(x => x.id === cid);
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

  const cycleBounds = useMemo(() => {
    const cIni = currentContractObjFull?.ciclo_inicio || 25;
    const cFim = currentContractObjFull?.ciclo_fim || 24;
    const currentDay = daySelectionDate.getDate(); 
    const currentMonth = daySelectionDate.getMonth(); 
    const currentYear = daySelectionDate.getFullYear();
    let start, end;
    if (cIni > cFim) {
      if (currentDay >= cIni) { start = new Date(currentYear, currentMonth, cIni, 0,0,0); end = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, cFim, 23,59,59,999); } 
      else { start = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, cIni, 0,0,0); end = new Date(currentYear, currentMonth, cFim, 23,59,59,999); }
    } else { start = new Date(currentYear, currentMonth, cIni, 0,0,0); end = new Date(currentYear, currentMonth, cFim, 23,59,59,999); }
    return { start: start.getTime(), end: end.getTime() };
  }, [currentContractObjFull, daySelectionDate]);

  const currentOsObj = osList.find(o => o.id === osId);
  const isIlimitado = ['continuado_sem_os', 'fechado', 'overhead'].includes(currentContractType) || currentOsObj?.codigo === '🛠️ Pequenos Suportes';

  const currentActivityAlloc = allocations.find(a => a.contract_id === contractId && a.atividade === activity && (!isComOs || a.os_id === osId) && a.mes === activeCycleForInput.month && a.ano === activeCycleForInput.year);
  const activityBudgetMs = currentActivityAlloc ? currentActivityAlloc.horas_disponiveis * 3600 * 1000 : 0;
  
  const contractBudgetMs = isComOs 
    ? allocations.filter(a => a.contract_id === contractId && a.os_id === osId && a.mes === activeCycleForInput.month && a.ano === activeCycleForInput.year).reduce((sum, a) => sum + (a.horas_disponiveis * 3600 * 1000), 0)
    : allocations.filter(a => a.contract_id === contractId && a.mes === activeCycleForInput.month && a.ano === activeCycleForInput.year).reduce((sum, a) => sum + (a.horas_disponiveis * 3600 * 1000), 0);

  const osBudgetMs = currentOsObj ? currentOsObj.horas_previstas * 3600 * 1000 : 0;
  const osUsedMs = entries.filter(e => e.os_id === osId && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);

  const contractUsedMs = isComOs 
    ? entries.filter(e => e.os_id === osId && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0)
    : entries.filter(e => e.contractId === contractId && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);
  
  const activityUsedMs = entries.filter(e => e.contractId === contractId && e.activity === activity && (!isComOs || e.os_id === osId) && e.start >= cycleBounds.start && e.start <= cycleBounds.end).reduce((sum, e) => sum + ((e.end ?? Date.now()) - e.start), 0);

  // 🌟 MOTOR INTELIGENTE: Retorna a janela do Ciclo OU o Intervalo Personalizado (De/Até)
  const getEffectivePanelBounds = (cInicio: number, cFim: number) => {
    if (panelModoData === 'intervalo') {
      const start = new Date(panelDataInicio + 'T00:00:00').getTime();
      const end = new Date(panelDataFim + 'T23:59:59').getTime();
      return { start, end };
    }
    const month = parseInt(panelMes);
    const year = parseInt(panelAno);
    const getValidDay = (y: number, m: number, d: number) => Math.min(d, new Date(y, m + 1, 0).getDate());
    let start, end;
    if (cInicio > cFim) {
      const startMonth = month === 0 ? 11 : month - 1;
      const startYear = month === 0 ? year - 1 : year;
      start = new Date(startYear, startMonth, getValidDay(startYear, startMonth, cInicio), 0, 0, 0).getTime();
      end = new Date(year, month, getValidDay(year, month, cFim), 23, 59, 59, 999).getTime();
    } else {
      start = new Date(year, month, getValidDay(year, month, cInicio), 0, 0, 0).getTime();
      end = new Date(year, month, getValidDay(year, month, cFim), 23, 59, 59, 999).getTime();
    }
    return { start, end };
  };


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
           const cb = getEffectivePanelBounds(cObj.ciclo_inicio, cObj.ciclo_fim);
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
        const cb = getEffectivePanelBounds(cObj.ciclo_inicio, cObj.ciclo_fim);
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

    const alocsDoMes = allocations.filter(a => a.contratos?.status_ativo && a.mes === panelMes && a.ano === panelAno && a.atividade !== 'Preço Fechado (Medição)');

    alocsDoMes.forEach(alloc => {
       const cb = getEffectivePanelBounds(alloc.contratos!.ciclo_inicio, alloc.contratos!.ciclo_fim);
       const isComOsCheck = alloc.contratos!.tipo === 'continuado_com_os';
       const osObjCheck = isComOsCheck && alloc.os_id ? osList.find(o => o.id === alloc.os_id) : null;
       const isSuportesCheck = osObjCheck?.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'fechado', 'overhead'].includes(alloc.contratos!.tipo);
       
       if (isSuportesCheck) {
          hasIlimitado = true;
          let filterEntries = entries.filter(e => e.contractId === alloc.contract_id && e.activity === alloc.atividade && e.start >= cb.start && e.start <= cb.end);
          if (isComOsCheck && alloc.os_id) filterEntries = filterEntries.filter(e => e.os_id === alloc.os_id);
          const gastoCiclo = filterEntries.reduce((sum, e) => sum + (((e.end ?? Date.now()) - e.start)), 0) / 3600000;
          totalOrcadoNesteCiclo += gastoCiclo;
       } else {
          totalOrcadoNesteCiclo += alloc.horas_disponiveis;
       }
    });
    return { total: totalOrcadoNesteCiclo, hasIlimitado };
  }, [allocations, osList, entries, panelMes, panelAno]);

  const saldoHorasMes = Math.max(0, totalOrcadoMes.total - horasTrabalhadasMesAtual);
  const percentualGasto = totalOrcadoMes.total > 0 ? (horasTrabalhadasMesAtual / totalOrcadoMes.total) * 100 : 0;
  
  const metaDeg = useMemo(() => {
    if (totalOrcadoMes.total === 0) return 0;
    const percentualMaximo = Math.min(horasMinimasMes / totalOrcadoMes.total, 1);
    return percentualMaximo * 360;
  }, [horasMinimasMes, totalOrcadoMes.total]);

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

  const detalhamentoAlocacoes = useMemo(() => {
    const map = new Map<string, any>();
    
    const alocsDoMes = allocations.filter(a => a.contratos?.status_ativo && a.mes === panelMes && a.ano === panelAno);

    alocsDoMes.forEach(alloc => {
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
      let totalGastoContrato = 0; let totalOrcadoNum = 0; let hasIlimitado = false; let hasFechado = false;
      // 🌟 USA O MOTOR INTELIGENTE: Responde instantaneamente às datas do calendário de intervalo!
      const cb = getEffectivePanelBounds(contract.inicio, contract.fim);

      const osGroupsProcessed = Array.from(contract.osGroups.values()).map((osGroup: any) => {
        const isSuportes = osGroup.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'overhead'].includes(contract.tipo);
        if (isSuportes) hasIlimitado = true;

        const atividadesProcessadas = osGroup.atividades.map((a: any) => {
          const isFechadoAtiv = a.atividade === 'Preço Fechado (Medição)' || contract.tipo === 'fechado';
          
          if (isFechadoAtiv) {
             hasFechado = true;
             const pM = parseInt(panelMes); const pA = parseInt(panelAno);
             const medidoMes = medicoesPainel.find(m => m.contract_id === contract.id && (osGroup.id !== 'sem_os' ? m.os_id === osGroup.id : true) && m.mes === panelMes && m.ano === panelAno)?.percentual || 0;
             const medidoPassado = medicoesPainel.filter(m => {
                 if (m.contract_id !== contract.id) return false;
                 if (osGroup.id !== 'sem_os' && m.os_id !== osGroup.id) return false;
                 const mA = parseInt(m.ano); const mM = parseInt(m.mes);
                 return mA < pA || (mA === pA && mM < pM);
             }).reduce((sum, m) => sum + m.percentual, 0);
             
             totalOrcadoNum += medidoMes;
             totalGastoContrato += medidoPassado;
             
             return { nome: a.atividade, orcado: medidoMes, gasto: medidoPassado, saldo: 100 - (medidoMes + medidoPassado), isSuportes: false, isFechado: true };
          }

          let filterCycle = entries.filter(e => e.contractId === contract.id && e.activity === a.atividade && e.start >= cb.start && e.start <= cb.end);
          if (contract.tipo === 'continuado_com_os' && osGroup.id !== 'sem_os') {
             filterCycle = filterCycle.filter(e => e.os_id === osGroup.id);
          }
          
          const gastoCicloH = filterCycle.reduce((sum, e) => sum + (((e.end ?? Date.now()) - e.start)), 0) / 3600000;
          const orcadoCicloH = isSuportes ? gastoCicloH : a.horas_disponiveis;
          const saldoH = isSuportes ? 0 : (orcadoCicloH - gastoCicloH);

          totalGastoContrato += gastoCicloH;
          totalOrcadoNum += orcadoCicloH;

          return { nome: a.atividade, orcado: orcadoCicloH, gasto: gastoCicloH, saldo: saldoH, isSuportes, isFechado: false };
        });
        return { ...osGroup, isSuportes, atividades: atividadesProcessadas };
      });

      return {
        ...contract, osGroups: osGroupsProcessed, hasIlimitado, totalOrcado: totalOrcadoNum,
        totalGasto: totalGastoContrato, 
        totalSaldo: hasFechado ? (100 - (totalOrcadoNum + totalGastoContrato)) : (hasIlimitado ? 0 : (totalOrcadoNum - totalGastoContrato)),
        hasFechado
      };
    });
    // 🌟 BLINDAGEM DO USEMEMO: Adicionadas as 3 variáveis do intervalo no array de dependências!
  }, [allocations, entries, panelMes, panelAno, osList, medicoesPainel, panelModoData, panelDataInicio, panelDataFim]);

  const handleExportarExcelConsultor = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Meu Apontamento');

      sheet.columns = [
        { header: 'Consultor', key: 'consultor', width: 25 },
        { header: 'Data', key: 'data', width: 15 },
        { header: 'Cód. Contrato', key: 'cod_contrato', width: 15 },
        { header: 'Nome do Contrato', key: 'nome_contrato', width: 35 },
        { header: 'OS', key: 'os', width: 15 },
        { header: 'Disciplina / Escopo', key: 'atividade', width: 35 },
        { header: 'Entrada', key: 'inicio', width: 12 },
        { header: 'Saída', key: 'fim', width: 12 },
        { header: 'Memorial Descritivo', key: 'obs', width: 50 },
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      let hasData = false;
      entries.forEach(t => {
        const cObj = contractsList.find(c => c.id === t.contractId);
        if (cObj) {
           const cb = getEffectivePanelBounds(cObj.ciclo_inicio, cObj.ciclo_fim);
           if (t.start >= cb.start && t.start <= cb.end) {
              hasData = true;
              const s = new Date(t.start);
              const e = t.end ? new Date(t.end) : new Date();
              const osObj = osList.find(o => o.id === t.os_id);
              const osFormatada = osObj ? (osObj.descricao ? `${osObj.codigo} - ${osObj.descricao}` : osObj.codigo) : '-';
              sheet.addRow({
                 consultor: userProfile?.nome || user?.email?.split('@')[0] || 'Consultor',
                 data: s.toLocaleDateString('pt-BR'),
                 cod_contrato: cObj.code,
                 nome_contrato: cObj.name,
                 os: osFormatada, // <-- Aqui está a melhoria
                 atividade: t.activity,
                 inicio: s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                 fim: e.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                 obs: t.notes || ''
              });
           }
        }
      });

      if (!hasData) return toast.error("Não há apontamentos no mês selecionado para exportar.");

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
           row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
        row.eachCell((cell) => {
           cell.border = {
              top: {style:'thin', color: {argb:'FFE2E8F0'}}, left: {style:'thin', color: {argb:'FFE2E8F0'}},
              bottom: {style:'thin', color: {argb:'FFE2E8F0'}}, right: {style:'thin', color: {argb:'FFE2E8F0'}}
           };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Timesheet_Consultor_${MESES_NOME[parseInt(panelMes)]}_${panelAno}.xlsx`);
      toast.success("Relatório Excel gerado com sucesso!");

    } catch (e) {
      toast.error("Erro ao gerar arquivo Excel.");
    }
  };

  const handleEditEntry = async (id: string, newStart: number, newEnd: number, newNotes: string) => {
    const entryToEdit = entries.find(e => e.id === id);
    if (entryToEdit) {
       const activeCb = getContractCycleBounds(entryToEdit.contractId);
       const pastCycleStart = new Date(activeCb.start);
       const m = pastCycleStart.getMonth();
       pastCycleStart.setMonth(m === 0 ? 11 : m - 1);
       if (m === 0) pastCycleStart.setFullYear(pastCycleStart.getFullYear() - 1);

       const now = new Date();
       const isDia25 = now.getDate() === 25;

       if (entryToEdit.start < activeCb.start || newStart < activeCb.start) {
           if (!(isDia25 && entryToEdit.start >= pastCycleStart.getTime() && newStart >= pastCycleStart.getTime())) {
               return toast.error("🚫 Régua Passada! Edição bloqueada pois o ciclo passado já foi liquidado.");
           }
       }

       const entryDateStr = getLocalISODate(new Date(entryToEdit.start));
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

  const executeLaunch = async (dateStr: string) => {
    if (!contractId || contractId === "" || contractId === "none" || !activity) return toast.error("Selecione contrato e atividade válidos.");
    if (currentContractType === 'continuado_com_os' && !osId) return toast.error("Selecione uma Ordem de Serviço (OS) para este contrato.");
    if (!notesValid) return toast.error("A observação é obrigatória para registrar as horas.");

    const startMs = getTimestampFromTimeFields(startTime, dateStr);
    const endMs = getTimestampFromTimeFields(endTime, dateStr);

    const activeCb = getContractCycleBounds(contractId);
    const pastCycleStart = new Date(activeCb.start);
    const m = pastCycleStart.getMonth();
    pastCycleStart.setMonth(m === 0 ? 11 : m - 1);
    if (m === 0) pastCycleStart.setFullYear(pastCycleStart.getFullYear() - 1);

    const now = new Date();
    const isDia25 = now.getDate() === 25;

    if (startMs < activeCb.start) {
        if (!(isDia25 && startMs >= pastCycleStart.getTime())) {
            return toast.error("🚫 Régua Passada! O dia 26 chegou e este ciclo foi liquidado e travado para pagamentos.");
        }
    }

    if (endMs <= startMs) return toast.error("A hora de fim deve ser posterior à hora de início.");

    const hasOverlap = entries.some(entry => {
      // Ignora o próprio card sendo editado no painel retroativo
      if (editingRetroId && entry.id === editingRetroId) return false;
      if (!entry.end) return false;
      return (startMs < entry.end) && (endMs > entry.start);
    });

    if (hasOverlap) return toast.error("Conflito de horário! Você já possui horas nesse período.");

    const durationMs = endMs - startMs;
    
    // Se estivermos editando, subtraímos a duração antiga do consumo antes de testar os limites
    const oldEntry = editingRetroId ? entries.find(e => e.id === editingRetroId) : null;
    const oldDurationMs = oldEntry ? ((oldEntry.end ?? Date.now()) - oldEntry.start) : 0;
    
    if (!isIlimitado) {
      // 🌟 ITEM 10: Trava de saldo removida da Disciplina/Atividade.
      // O bloqueio agora ocorre APENAS quando o somatório estourar o orçamento global do Contrato ou da OS (Demanda).
      if (contractBudgetMs > 0 && ((contractUsedMs - oldDurationMs) + durationMs > contractBudgetMs)) {
        const remaining = Math.max(0, contractBudgetMs - (contractUsedMs - oldDurationMs));
        const rotuloTrava = isComOs ? "na Demanda (OS)" : "no contrato";
        return toast.error(`⚠️ Saldo insuficiente ${rotuloTrava}! Restam apenas ${(remaining / 3600000).toFixed(1)}h livres.`);
      }
    }

    const currentContract = contractsList.find((x) => x.id === contractId);
    if (!currentContract) return toast.error("Contrato inválido ou inativo.");
    
    const label = `${currentContract.code} — ${currentContract.name}`;

    if (editingRetroId) {
      await handleEditEntry(editingRetroId, startMs, endMs, notes);
      setEditingRetroId(null);
      setNotes("");
      setStartTime(endTime);
      return;
    }

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

  const handleEditRetro = (entry: TimeEntry) => {
    setContractId(entry.contractId);
    if (entry.os_id) setOsId(entry.os_id);
    setActivity(entry.activity);
    setNotes(entry.notes || "");
    const s = new Date(entry.start);
    const e = entry.end ? new Date(entry.end) : new Date();
    setStartTime(`${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`);
    setEndTime(`${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`);
    setEditingRetroId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEntry = async (id: string) => {
    const entryToDel = entries.find(e => e.id === id);
    if (entryToDel) {
       const activeCb = getContractCycleBounds(entryToDel.contractId);
       const pastCycleStart = new Date(activeCb.start);
       const m = pastCycleStart.getMonth();
       pastCycleStart.setMonth(m === 0 ? 11 : m - 1);
       if (m === 0) pastCycleStart.setFullYear(pastCycleStart.getFullYear() - 1);

       const now = new Date();
       const isDia25 = now.getDate() === 25;

       if (entryToDel.start < activeCb.start) {
           if (!(isDia25 && entryToDel.start >= pastCycleStart.getTime())) {
               return toast.error("🚫 Régua Passada! Exclusão bloqueada pois o ciclo passado já foi liquidado.");
           }
       }

       const entryDateStr = getLocalISODate(new Date(entryToDel.start));
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

  // 🌟 LOADING LIMPO (FASE 1)
  if (authLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground animate-in fade-in duration-500">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg mb-6 animate-pulse">
         <img src="/favicon.ico" alt="Logo Engeprice" className="w-12 h-12 object-contain dark:bg-white dark:p-1.5 dark:rounded-xl" />
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2 text-primary">Engeprice Timesheet</h2>
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Autenticando e carregando dados...
      </p>
    </div>
  );

  if (!user) return <Login onLoginSuccess={() => {}} />;

  return (
    <div className="flex-1 flex flex-col h-full bg-background text-foreground w-full relative">
      
      {showUpdatePassword && (
        <UpdatePassword 
          onUpdateSuccess={() => {
            setShowUpdatePassword(false);
            window.location.href = window.location.pathname; 
          }} 
        />
      )}

      <Toaster position="top-right" richColors />
      <header className="border-b w-full shrink-0 bg-card/30 relative overflow-hidden">
        <div className="mx-auto w-full max-w-none px-4 md:px-8 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-4 z-10 relative">
            {userProfile?.avatar_url ? (
              <>
                <img 
                  src={userProfile.avatar_url} 
                  alt="Avatar" 
                  className="w-12 h-12 rounded-full border-2 border-primary/20 shadow-md object-cover" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-full border-2 border-primary/20 shadow-md bg-primary/10 hidden items-center justify-center text-primary font-bold text-sm">
                   {userProfile?.nome ? userProfile.nome.substring(0,2).toUpperCase() : user?.email?.substring(0,2).toUpperCase()}
                </div>
              </>
            ) : (
              <div className="w-12 h-12 rounded-full border-2 border-primary/20 shadow-md bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                 {userProfile?.nome ? userProfile.nome.substring(0,2).toUpperCase() : user?.email?.substring(0,2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground leading-tight">
                Olá, <span className="font-bold text-foreground text-base">{userProfile?.nome?.split(' ')[0] || user?.email?.split('@')[0]}</span>
              </span>
            </div>
          </div>
          
          {!isAdmin && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 z-0 pointer-events-none">
              <img 
                src="/favicon.ico" 
                alt="Logo Engeprice" 
                className="w-7 h-7 object-contain transition-colors dark:bg-white dark:p-1 dark:rounded-md shadow-sm" 
              />
              <span className="font-black text-xl tracking-tight text-primary">
                Engeprice
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 z-10 relative">
            {/* --- NOVO: BOTÃO ATUALIZAR APP (CACHE BUSTER) --- */}
            <Button 
              size="icon" 
              variant="outline" 
              onClick={() => {
                toast.info("Buscando última versão do aplicativo...");
                setTimeout(() => window.location.reload(), 300);
              }} 
              title="Atualizar Aplicativo (Ctrl + Shift + R)"
              className="w-10 h-10 rounded-full shadow-sm bg-background hover:bg-primary/10 hover:text-primary"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button size="icon" variant="outline" onClick={toggle} aria-label="Alternar tema" className="w-10 h-10 rounded-full shadow-sm bg-background">
              {mounted ? (theme === "dark" ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />) : <Moon className="h-5 w-5" />}
            </Button>
            
            <div className="w-px h-8 bg-border mx-2"></div>
            
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-10 rounded-xl font-medium" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>

        </div>
      </header>

      {/* 🌟 SPRINT 4: max-w-7xl mx-auto centraliza e harmoniza em telas ultrawide */}
      {/* 1. O MAIN se estica na tela inteira para jogar o scroll no canto direito */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden">
        
        {/* 2. A DIV INTERNA mantém todo o nosso trabalho da SPRINT 4 intacto! */}
        <div className="w-full max-w-400 mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          
          {viewMode === "timesheet" ? (
            /* 3. Nosso grid anti-achatamento (1 coluna em notebooks, 2 em ultrawide) continua aqui dentro */
            <div className="grid gap-8 grid-cols-1 xl:grid-cols-[1.3fr_1fr] items-start w-full">
            <section className="space-y-6 min-w-0 w-full">
              <div className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
                <TaskSelector
                  contracts={contractsList}
                  contractId={contractId}
                  contractType={currentContractType}
                  osList={filteredOsList}
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
            
            <section className="space-y-3 min-w-0 w-full">
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
              <div className="flex flex-wrap items-center gap-2">
                {/* Botões de alternância: Por Ciclo | Por Intervalo */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
                  <Button
                    size="sm"
                    type="button"
                    variant={panelModoData === 'ciclo' ? 'default' : 'ghost'}
                    onClick={() => setPanelModoData('ciclo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Ciclo
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant={panelModoData === 'intervalo' ? 'default' : 'ghost'}
                    onClick={() => setPanelModoData('intervalo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Intervalo
                  </Button>
                </div>

                {panelModoData === 'ciclo' ? (
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
                ) : (
                  <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-lg border animate-in fade-in-50">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-1">Período:</Label>
                    <Input
                      type="date"
                      value={panelDataInicio}
                      onChange={e => setPanelDataInicio(e.target.value)}
                      className="h-8 text-xs w-32 px-2 font-mono bg-background shadow-xs"
                    />
                    <span className="text-xs text-muted-foreground font-medium">até</span>
                    <Input
                      type="date"
                      value={panelDataFim}
                      onChange={e => setPanelDataFim(e.target.value)}
                      className="h-8 text-xs w-32 px-2 font-mono bg-background shadow-xs"
                    />
                  </div>
                )}

                <Button onClick={() => setViewMode("timesheet")} variant="ghost" size="sm" className="gap-1.5 text-xs h-10 border bg-card hover:bg-muted ml-1">
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </Button>
              </div>
            </div>
          

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2 shadow-sm">
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Resumo do Ciclo Selecionado
                  </CardTitle>
                  <Button onClick={handleExportarExcelConsultor} variant="outline" size="sm" className="h-7 text-[10px] bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20">
                    <Download className="w-3 h-3 mr-1" /> EXPORTAR EXCEL
                  </Button>
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
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">
                            {contract.hasFechado ? 'PREÇO FECHADO' : contract.tipo.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-6 text-xs">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">
                              Orçado no {panelModoData === 'intervalo' ? 'Período' : 'Ciclo'}
                            </p>
                            <p className="font-mono font-bold text-foreground">
                              {contract.hasIlimitado && contract.totalOrcado === 0 ? <span className="text-amber-600 flex items-center justify-end"><Wrench className="w-3 h-3"/></span> : `${contract.totalOrcado.toFixed(1)}${contract.hasFechado ? '%' : 'h'}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Consumido</p>
                            <p className="font-mono font-bold text-primary">{contract.totalGasto.toFixed(1)}{contract.hasFechado ? '%' : 'h'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                            <p className={`font-mono font-bold ${contract.totalSaldo < 0 && !contract.hasIlimitado ? 'text-red-500' : 'text-green-600'}`}>
                              {contract.hasIlimitado && contract.totalSaldo === 0 ? <span className="text-amber-600 flex items-center justify-end"><Wrench className="w-3 h-3"/></span> : `${contract.totalSaldo.toFixed(1)}${contract.hasFechado ? '%' : 'h'}`}
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
                          <div className="px-4 py-2 w-full overflow-x-auto">
                            <table className="w-full text-xs text-left min-w-150">
                              <thead>
                                <tr className="text-muted-foreground/70">
                                  <th className="pb-2 font-medium">Disciplina / Escopo</th>
                                  <th className="pb-2 font-medium text-right w-20">Orçado</th>
                                  <th className="pb-2 font-medium text-right w-20">Consumido</th>
                                  <th className="pb-2 font-medium text-right w-20">Saldo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {osGroup.atividades.map((ativ: any, idx: number) => {
                                  const isFechado = ativ.nome === 'Preço Fechado (Medição)';
                                  
                                  if (ativ.isFechado) {
                                     return (
                                        <tr key={idx} className="border-t border-green-500/20 bg-green-500/5 hover:bg-green-500/10">
                                          <td className="py-2.5 font-medium text-green-700 flex items-center gap-1.5 pl-2"><Check className="w-3.5 h-3.5"/> Medição de Avanço (%)</td>
                                          <td className="py-2.5 text-right font-mono text-green-700">{ativ.orcado}%</td>
                                          <td className="py-2.5 text-right text-primary font-bold font-mono">{ativ.gasto}%</td>
                                          <td className="py-2.5 text-right font-bold font-mono text-green-700">{ativ.saldo}%</td>
                                        </tr>
                                     );
                                  }

                                  return (
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
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="w-full pt-2">
                <Card className="shadow-sm bg-muted/10 border-dashed">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Horas Entregues no Ciclo</p>
                      <p className="text-sm font-bold text-primary">Contratos por Hora e Dinâmicos</p>
                    </div>
                    <p className="text-2xl font-mono font-black text-primary">{resumoPorTipo.horas.toFixed(1)}h</p>
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
                            osList={filteredOsList}
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
                            {editingRetroId ? (
                              <><Check className="w-4 h-4 mr-2" /> Atualizar Registro</>
                            ) : (
                              <><Check className="w-4 h-4 mr-2" /> Gravar Registro no Dia {panelDate.split('-').reverse().join('/')}</>
                            )}
                          </Button>

                          {editingRetroId && (
                            <Button onClick={() => {
                               setEditingRetroId(null);
                               setNotes("");
                            }} variant="outline" className="w-full h-10 mt-2 border-dashed hover:bg-muted/50">
                              Cancelar Edição
                            </Button>
                          )}
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
                      const isBeingEdited = editingRetroId === entry.id;
                      
                      return (
                        <div key={entry.id} className={`p-3.5 bg-card border rounded-xl shadow-xs space-y-2 text-xs transition-colors ${isBeingEdited ? 'border-primary bg-primary/5' : ''}`}>
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
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-primary hover:bg-primary/10" onClick={() => handleEditRetro(entry)}>
                                <Pencil className="w-3 h-3 mr-1" /> Editar
                              </Button>
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
        </div>
      </main>
    </div>
  );
}