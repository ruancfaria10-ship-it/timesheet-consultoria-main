// src/components/admin/AdminDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/use-theme'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  PlusCircle, ArrowRight, Trash2, 
  Loader2, Pencil, Check, X, Save, Sun, Moon, User, Layers, 
  CalendarDays, Download, Percent, History, 
  FileUp, FolderTree, Target, AlertTriangle, Building2, UserCog, Receipt, Briefcase, Clock, Unlock, Wrench, Contact2, Users, GripVertical, RefreshCw, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts'
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toast } from "sonner";

type Consultor = { id: string, nome: string, horas_minimas_mes: number, avatar_url?: string, status_ativo?: boolean, is_convidado?: boolean, em_recesso?: boolean }
type Contrato = { id: string, codigo: string, nome: string, status_ativo: boolean, tipo: string, fonte_pagamento: string, teto_global_horas: number, ciclo_inicio: number, ciclo_fim: number, ciclo_fat_inicio: number, ciclo_fat_fim: number, catalogo_atividades?: string[] }
type OrdemServico = { id: string, contract_id: string, codigo: string, descricao: string, status_ativa: boolean, horas_previstas: number }

// --- NOVOS TIPOS (LINHA DE BASE) ---
type LinhaBase = { id: string, contract_id: string, os_id: string | null, versao: number, created_at: string }
type LinhaBaseItem = { id: string, base_id: string, user_id: string, horas_teto: number, atividades: string[], tipo_pagamento: 'horas' | 'fechado' }

type AtividadeAlocada = { id: string, dbId?: string, nome: string, horas: number }
type Alocacao = { consultorId: string, horasTotais: number, geralId?: string, atividades: AtividadeAlocada[], tipo_pagamento?: 'horas' | 'fechado' }
type TimesheetLog = { id: string, user_id: string, contract_id: string, os_id?: string, activity: string, start_at: string, end_at: string | null, notes?: string }
type Medicao = { id?: string, contract_id: string, os_id?: string | null, user_id: string, mes: string, ano: string, percentual: number }

const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CORES_GRAFICO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']

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

export function AdminDashboard() {
  const { theme, toggle } = useTheme()
  const [menuAtivo, setMenuAtivo] = useState('contratos')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [osList, setOsList] = useState<OrdemServico[]>([])
  
  // Estados Contratos
  const [novoCodigo, setNovoCodigo] = useState('')
  const [novoNomeContrato, setNovoNomeContrato] = useState('')
  const [novoTipo, setNovoTipo] = useState('horas')
  const [novaFonte, setNovaFonte] = useState('EC')
  const [novoTetoGlobal, setNovoTetoGlobal] = useState(0)
  const [novoInicio, setNovoInicio] = useState(25)
  const [novoFim, setNovoFim] = useState(24)
  const [novoFatInicio, setNovoFatInicio] = useState(1)
  const [novoFatFim, setNovoFatFim] = useState(31)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [editNome, setEditNome] = useState('')
  const [editStatus, setEditStatus] = useState(true)
  const [editTipo, setEditTipo] = useState('horas')
  const [editFonte, setEditFonte] = useState('EC')
  const [editTetoGlobal, setEditTetoGlobal] = useState(0)
  const [editInicio, setEditInicio] = useState(25)
  const [editFim, setEditFim] = useState(24)
  const [editFatInicio, setEditFatInicio] = useState(1)
  const [editFatFim, setEditFatFim] = useState(31)

  // Estados OS
  const [osContratoId, setOsContratoId] = useState('')
  const [osCodigo, setOsCodigo] = useState('')
  const [osDescricao, setOsDescricao] = useState('')
  const [osHoras, setOsHoras] = useState<number>(0)
  const [osEditandoId, setOsEditandoId] = useState<string | null>(null)
  const [editOsCodigo, setEditOsCodigo] = useState('')
  const [editOsDescricao, setEditOsDescricao] = useState('')
  const [editOsHoras, setEditOsHoras] = useState<number>(0)

  // Função para ler a memória do navegador
  const getSavedMes = () => localStorage.getItem('ep_mes') || new Date().getMonth().toString();
  const getSavedAno = () => localStorage.getItem('ep_ano') || new Date().getFullYear().toString();

  // --- ESTADOS: ALOCAÇÕES & LINHA DE BASE ---
  const [viewAlocacao, setViewAlocacao] = useState<'baseline' | 'mensal'>('mensal')
  const [alocMes, setAlocMes] = useState<string>(getSavedMes)
  const [alocAno, setAlocAno] = useState<string>(getSavedAno)
  const [contratoAtivo, setContratoAtivo] = useState<string>('')
  const [alocacaoOsId, setAlocacaoOsId] = useState<string>('') 
  const [alocacoes, setAlocacoes] = useState<Record<string, Alocacao>>({})
  const [carregandoAlocacoes, setCarregandoAlocacoes] = useState(false)
  const [metasEdit, setMetasEdit] = useState<Record<string, number>>({})
  
  // Memória da Linha de Base
  const [currentBase, setCurrentBase] = useState<LinhaBase | null>(null)
  const [baseVersions, setBaseVersions] = useState<LinhaBase[]>([])
  const [baseItems, setBaseItems] = useState<Record<string, LinhaBaseItem>>({})
  
  const contratoSelecionadoObj = contratos.find(c => c.id === contratoAtivo);
  const isSemOsType = alocacaoOsId ? osList.find(o => o.id === alocacaoOsId)?.codigo === '🛠️ Pequenos Suportes' : false;
  const isOverheadType = contratoSelecionadoObj?.tipo === 'overhead';
  const isComOsType = contratoSelecionadoObj?.tipo === 'continuado_com_os';
  

  // --- ESTADOS DA PALETA FLUTUANTE ---
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [paletteTargetUserId, setPaletteTargetUserId] = useState<string>('none');
  const [palettePos, setPalettePos] = useState({ x: 600, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragRel, setDragRel] = useState({ x: 0, y: 0 });
  const [newActivityName, setNewActivityName] = useState('');
  
  // 🌟 NOVO: Memória temporária para segurar as disciplinas criadas antes de salvar a matriz
  const [atividadesAvulsas, setAtividadesAvulsas] = useState<string[]>([]);
  
  useEffect(() => { setAtividadesAvulsas([]); }, [contratoAtivo, alocacaoOsId]);

  // 🌟 FUNÇÃO PARA SALVAR NO BANCO
  const salvarCatalogoNoBanco = async (idContrato: string, novoCatalogo: string[]) => {
    // 1. Atualiza a tela imediatamente
    setContratos(p => p.map(c => c.id === idContrato ? { ...c, catalogo_atividades: novoCatalogo } : c));
    
    // 2. Tenta salvar no Supabase (usando upsert para garantir a gravação do array)
    const { error } = await supabase
        .from('contratos')
        .update({ catalogo_atividades: novoCatalogo })
        .eq('id', idContrato);
        
    if (error) {
      console.error(error);
      toast.error("Erro de permissão! Verifique as políticas de UPDATE da tabela contratos no Supabase.");
    }
  };
  
  // Limpa a memória temporária se o gestor trocar de contrato
  useEffect(() => { setAtividadesAvulsas([]); }, [contratoAtivo, alocacaoOsId]);

  const handlePaletteMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragRel({ x: e.clientX - palettePos.x, y: e.clientY - palettePos.y });
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPalettePos({ x: e.clientX - dragRel.x, y: e.clientY - dragRel.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, dragRel]);

  const handleInsertFromPalette = (ativName: string) => {
    if (!paletteTargetUserId || paletteTargetUserId === 'none') return;
    setBaseItems(p => {
       const atuais = p[paletteTargetUserId]?.atividades || [];
       if (atuais.includes(ativName)) { toast.info(`"${ativName}" já está alocada para este consultor.`); return p; }
       return { ...p, [paletteTargetUserId]: { ...p[paletteTargetUserId], atividades: [...atuais, ativName] } };
    });
    toast.success(`Disciplina inserida no consultor!`);
  };

  const renameContractActivity = async (oldName: string) => {
     const newName = prompt(`Renomear "${oldName}" para:`, oldName);
     if (!newName || newName.trim() === "" || newName === oldName) return;
     
     // Renomeia na matriz
     setBaseItems(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(uid => {
           if (next[uid].atividades.includes(oldName)) {
              next[uid] = { ...next[uid], atividades: next[uid].atividades.map(a => a === oldName ? newName : a) };
           }
        });
        return next;
     });

     // Renomeia na memória avulsa e no banco
     const cObj = contratos.find(c => c.id === contratoAtivo);
     const currentCat = cObj?.catalogo_atividades || [];
     await salvarCatalogoNoBanco(contratoAtivo, currentCat.map(a => a === oldName ? newName : a));
     
     setAtividadesAvulsas(prev => prev.map(a => a === oldName ? newName : a));
     toast.success("Disciplina renomeada no contrato atual!");
  };

  const removeContractActivity = async (ativNome: string) => {
    if (!window.confirm(`Remover a disciplina "${ativNome}" do catálogo deste contrato e apagá-la das alocações?`)) return;
    
    // 1. Remove da Matriz em tela
    setBaseItems(prev => {
      const updated: Record<string, LinhaBaseItem> = {};
      Object.entries(prev).forEach(([userId, item]) => {
        updated[userId] = { ...item, atividades: item.atividades.filter(a => a !== ativNome) };
      });
      return updated;
    });
    
    // 2. Remove do catálogo do Supabase
    const cObj = contratos.find(c => c.id === contratoAtivo);
    const currentCat = cObj?.catalogo_atividades || [];
    
    // 🌟 CORREÇÃO AQUI: passando 'contratoAtivo' como primeiro parâmetro
    await salvarCatalogoNoBanco(contratoAtivo, currentCat.filter(a => a !== ativNome));
    
    setAtividadesAvulsas(prev => prev.filter(a => a !== ativNome));

    // 3. Deleta fisicamente as alocações antigas do banco
    await supabase.from('alocacoes').delete().eq('contract_id', contratoAtivo).eq('atividade', ativNome);
    
    // Limpa o estado global na hora para sumir da lista
    setAllAlocacoes(prev => prev.filter(a => !(a.contract_id === contratoAtivo && a.atividade === ativNome)));

    toast.success(`Disciplina "${ativNome}" removida do catálogo e das alocações!`);
  };

  const handleAddActivityFromPalette = async () => {
     if (!newActivityName.trim() || !contratoAtivo) return;
     const n = newActivityName.trim();
     
     const cObj = contratos.find(c => c.id === contratoAtivo);
     const currentCat = cObj?.catalogo_atividades || [];
     
     // 🌟 SALVA NO BANCO NA HORA
     if (!currentCat.includes(n)) {
         await salvarCatalogoNoBanco(contratoAtivo, [...currentCat, n]);
     }
     
     // Salva na memória da sessão
     setAtividadesAvulsas(prev => [...prev, n]);

     if (paletteTargetUserId !== 'none') {
         handleInsertFromPalette(n); 
     } else {
         toast.success("Disciplina criada no catálogo do contrato!");
     }
     setNewActivityName('');
  };

  // Estados Medições (Invertido: Por Consultor)
  const [medConsultor, setMedConsultor] = useState<string>('')
  const [medMes, setMedMes] = useState<string>(getSavedMes)
  const [medAno, setMedAno] = useState<string>(getSavedAno)
  const [medicoesInput, setMedicoesInput] = useState<Record<string, number>>({})
  const [medContratosVinculados, setMedContratosVinculados] = useState<any[]>([])
  const [medLoading, setMedLoading] = useState(false)

  // Estados Dashboards (Filtros Globais)
  const [dashVisaoTipos, setDashVisaoTipos] = useState<string[]>(['horas', 'continuado_com_os', 'overhead'])
  const [dashMes, setDashMes] = useState<string>(getSavedMes)
  const [dashAno, setDashAno] = useState<string>(getSavedAno)
  const [dashContratosSelecionados, setDashContratosSelecionados] = useState<string[]>([]) 
  const [dashOs, setDashOs] = useState<string>('todas') 
  const [dashConsultor, setDashConsultor] = useState<string>('todos')
  const [dashFonte, setDashFonte] = useState<string>('todas')
  // 🌟 SPRINT 3 - ITEM 7: Estado para Drill-down nos gráficos (armazena o ID do consultor clicado)
  const [drilldownConsultorId, setDrilldownConsultorId] = useState<string | null>(null);

  // 🌟 SPRINT 3 - ITEM 13: Modo de visualização de datas (por 'ciclo' padrão ou 'intervalo' customizado)
  const [modoDataFiltro, setModoDataFiltro] = useState<'ciclo' | 'intervalo'>('ciclo');
  const [dataInicioCustom, setDataInicioCustom] = useState<string>(getLocalISODate(new Date()));
  const [dataFimCustom, setDataFimCustom] = useState<string>(getLocalISODate(new Date()));
  // Estados Painel do Consultor
  const [resConsId, setResConsId] = useState<string>('')
  const [resConsMes, setResConsMes] = useState<string>(getSavedMes)
  const [resConsAno, setResConsAno] = useState<string>(getSavedAno)

  const [fatVisaoTipos, setFatVisaoTipos] = useState<string[]>(['horas', 'continuado_com_os', 'overhead'])
  const [fatMes, setFatMes] = useState<string>(getSavedMes)
  const [fatAno, setFatAno] = useState<string>(getSavedAno)
  const [fatContratosSelecionados, setFatContratosSelecionados] = useState<string[]>([]) 
  const [fatFonte, setFatFonte] = useState<string>('todas')

  // Salva o mês na memória sempre que ele mudar em qualquer aba
  useEffect(() => { localStorage.setItem('ep_mes', alocMes); }, [alocMes]);
  useEffect(() => { localStorage.setItem('ep_ano', alocAno); }, [alocAno]);
  useEffect(() => { localStorage.setItem('ep_mes', dashMes); }, [dashMes]);
  useEffect(() => { localStorage.setItem('ep_mes', fatMes); }, [fatMes]);
  useEffect(() => { localStorage.setItem('ep_mes', medMes); }, [medMes]);
  useEffect(() => { localStorage.setItem('ep_mes', resConsMes); }, [resConsMes]);

  const [allTimesheets, setAllTimesheets] = useState<TimesheetLog[]>([])
  const [allAlocacoes, setAllAlocacoes] = useState<any[]>([])
  const [allMedicoes, setAllMedicoes] = useState<Medicao[]>([])
  const [loadingDash, setLoadingDash] = useState(false)
  const [allLinhasBase, setAllLinhasBase] = useState<any[]>([])
  const [allLinhaBaseItems, setAllLinhaBaseItems] = useState<any[]>([])

  // Estados Gestão Retroativa
  const [gestaoConsultor, setGestaoConsultor] = useState<string>('')
  const [gestaoContrato, setGestaoContrato] = useState<string>('')
  const [gestaoOs, setGestaoOs] = useState<string>('')
  const [gestaoAtividade, setGestaoAtividade] = useState<string>('')
  const [gestaoData, setGestaoData] = useState<string>(getLocalISODate(new Date()))
  const [gestaoInicio, setGestaoInicio] = useState<string>('08:00')
  const [gestaoFim, setGestaoFim] = useState<string>('12:00')
  const [gestaoNotes, setGestaoNotes] = useState<string>('')
  const [gestaoEditandoId, setGestaoEditandoId] = useState<string | null>(null)

  // Estados Liberação
  const [authList, setAuthList] = useState<any[]>([])
  const [liberarConsultor, setLiberarConsultor] = useState<string>('')
  const [liberarData, setLiberarData] = useState<string>(getLocalISODate(new Date()))
  const [loadingAuth, setLoadingAuth] = useState(false)

  async function carregarDadosDoBanco() {
    try {
      setLoading(true)
      const { data: dbCons } = await supabase.from('consultores').select('id, nome, horas_minimas_mes, avatar_url, status_ativo, is_convidado, em_recesso').order('nome')
      const { data: dbCont } = await supabase.from('contratos').select('*').order('codigo')
      const { data: dbOs } = await supabase.from('ordens_servico').select('*').order('created_at', { ascending: false })
      
      setConsultores(dbCons || [])
      setContratos((dbCont || []).map(c => ({ 
        ...c, status_ativo: c.status_ativo === true, tipo: c.tipo || 'horas', fonte_pagamento: c.fonte_pagamento || 'EC',
        teto_global_horas: c.teto_global_horas || 0,
        ciclo_inicio: c.ciclo_inicio || 25, ciclo_fim: c.ciclo_fim || 24,
        ciclo_fat_inicio: c.ciclo_fat_inicio || 1, ciclo_fat_fim: c.ciclo_fat_fim || 31,
        catalogo_atividades: c.catalogo_atividades || []
      })))
      setOsList(dbOs || [])
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }
  useEffect(() => { carregarDadosDoBanco() }, [])

  // ==========================================
  // FUNÇÕES DE CONTRATO
  // ==========================================
  async function criarNovoContrato() {
    if (!novoCodigo || !novoNomeContrato) return alert("Preencha todos os campos obrigatórios!")
    const { data: newContract, error } = await supabase.from('contratos').insert([{ 
      codigo: novoCodigo.toUpperCase().trim(), nome: novoNomeContrato.trim(), 
      status_ativo: true, tipo: novoTipo, fonte_pagamento: novaFonte, 
      teto_global_horas: novoTipo === 'continuado_com_os' ? novoTetoGlobal : 0,
      ciclo_inicio: novoInicio, ciclo_fim: novoFim, ciclo_fat_inicio: novoFatInicio, ciclo_fat_fim: novoFatFim
    }]).select('*').single()
    if (error || !newContract) return alert("Erro ao criar contrato no banco de dados.");
    if (novoTipo === 'continuado_com_os') {
       await supabase.from('ordens_servico').insert([{ contract_id: newContract.id, codigo: '🛠️ Pequenos Suportes', descricao: 'Serviços pontuais e assessoria (Saldo Dinâmico)', horas_previstas: 0, status_ativa: true }]);
    }
    setNovoCodigo(''); setNovoNomeContrato(''); setNovoTetoGlobal(0); carregarDadosDoBanco();
  }

  function iniciarEdicao(c: Contrato) { 
    setEditandoId(c.id); setEditCodigo(c.codigo); setEditNome(c.nome); setEditStatus(c.status_ativo); 
    setEditTipo(c.tipo); setEditFonte(c.fonte_pagamento); setEditTetoGlobal(c.teto_global_horas);
    setEditInicio(c.ciclo_inicio); setEditFim(c.ciclo_fim); setEditFatInicio(c.ciclo_fat_inicio); setEditFatFim(c.ciclo_fat_fim); 
  }
  
  async function salvarEdicaoContrato(id: string) {
    await supabase.from('contratos').update({ 
      codigo: editCodigo.toUpperCase().trim(), nome: editNome.trim(), status_ativo: editStatus, 
      tipo: editTipo, fonte_pagamento: editFonte, teto_global_horas: editTipo === 'continuado_com_os' ? editTetoGlobal : 0,
      ciclo_inicio: editInicio, ciclo_fim: editFim, ciclo_fat_inicio: editFatInicio, ciclo_fat_fim: editFatFim 
    }).eq('id', id)
    setEditandoId(null); carregarDadosDoBanco();
  }

  async function excluirConsultorSistema(id: string, nome: string) {
    if (!window.confirm(`ATENÇÃO: Você está prestes a excluir definitivamente o consultor(a) "${nome}".\nIsso apagará o perfil dele(a). Você tem certeza?`)) return;
    setLoading(true);
    // Exclui da tabela consultores (isso deve apagar tudo via ON DELETE CASCADE no banco, dependendo da sua arquitetura)
    await supabase.from('consultores').delete().eq('id', id);
    setConsultores(p => p.filter(c => c.id !== id));
    toast.success("Consultor excluído com sucesso.");
    setLoading(false);
  }
  
  async function excluirContrato(id: string, nome: string) {
    const { count: countTimesheets } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('contract_id', id);
    if (countTimesheets && countTimesheets > 0) return alert(`❌ BLOQUEIO:\n\nEste contrato possui ${countTimesheets} apontamentos de horas vinculados. Apenas inative-o.`);
    
    const { count: countAloc } = await supabase.from('alocacoes').select('*', { count: 'exact', head: true }).eq('contract_id', id);
    if (countAloc && countAloc > 0) {
      if (!window.confirm(`⚠️ AVISO:\n\nEste contrato possui ${countAloc} alocações de horas de consultores cadastradas.\nSe você excluir, todas essas alocações serão DELETADAS PARA SEMPRE.\n\nTem certeza absoluta?`)) return;
    } else {
      if (!window.confirm(`Excluir definitivamente o contrato "${nome}"?`)) return;
    }
    await supabase.from('alocacoes').delete().eq('contract_id', id); 
    await supabase.from('medicoes').delete().eq('contract_id', id); 
    await supabase.from('contratos').delete().eq('id', id);
    if (contratoAtivo === id) { setContratoAtivo(''); setAlocacoes({}); }
    carregarDadosDoBanco();
  }

  // ==========================================
  // FUNÇÕES DE ORDEM DE SERVIÇO
  // ==========================================
  async function criarOS() {
    if (!osContratoId || !osCodigo) return alert("Selecione o Contrato e digite o Código da OS.");
    await supabase.from('ordens_servico').insert([{ contract_id: osContratoId, codigo: osCodigo.toUpperCase().trim(), descricao: osDescricao.trim(), horas_previstas: 0, status_ativa: true }]);
    setOsCodigo(''); setOsDescricao(''); carregarDadosDoBanco(); toast.success("OS criada com sucesso!");
  }

  function iniciarEdicaoOS(os: OrdemServico) { setOsEditandoId(os.id); setEditOsCodigo(os.codigo); setEditOsDescricao(os.descricao); }

  async function salvarEdicaoOS(id: string) {
    await supabase.from('ordens_servico').update({ codigo: editOsCodigo.toUpperCase().trim(), descricao: editOsDescricao.trim() }).eq('id', id);
    setOsEditandoId(null); carregarDadosDoBanco();
  }

  async function apagarOS(id: string) {
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('os_id', id);
    if (count && count > 0) return alert(`❌ BLOQUEIO: Esta OS possui ${count} apontamentos vinculados. Exclusão proibida.`);
    if (window.confirm("Apagar esta OS?")) { await supabase.from('ordens_servico').delete().eq('id', id); carregarDadosDoBanco(); }
  }

  // ==========================================
  // UPLOAD E COMPRESSÃO DE AVATAR (STORAGE)
  // ==========================================
  // Função auxiliar que esmaga a imagem no navegador antes de gastar internet
  const compressImage = (file: File, maxSize: number = 300): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Mantém a proporção e reduz para no máximo 300px
          if (width > height && width > maxSize) { 
            height *= maxSize / width; 
            width = maxSize; 
          } else if (height > maxSize) { 
            width *= maxSize / height; 
            height = maxSize; 
          }
          
          canvas.width = width; 
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Converte para WebP com 80% de qualidade (Ultra leve)
          canvas.toBlob((blob) => blob ? resolve(blob) : reject('Erro na compressão'), 'image/webp', 0.8);
        };
      };
    });
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>, consultorId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      toast.info('Otimizando imagem...');
      
      // 1. Comprime a imagem antes de subir
      const compressedBlob = await compressImage(file, 300);
      
      // 2. Gera um nome único forçando a extensão .webp
      const fileName = `${consultorId}-${Math.random().toString(36).substring(2)}.webp`;

      // 3. Faz o upload para o bucket 'avatares'
      const { error: uploadError } = await supabase.storage.from('avatares').upload(fileName, compressedBlob, {
         contentType: 'image/webp'
      });
      if (uploadError) throw uploadError;

      // 4. Pega a URL pública
      const { data: { publicUrl } } = supabase.storage.from('avatares').getPublicUrl(fileName);

      // 5. Atualiza o banco de dados
      const { error: updateError } = await supabase.from('consultores').update({ avatar_url: publicUrl }).eq('id', consultorId);
      if (updateError) throw updateError;

      // 6. Atualiza a tela
      setConsultores(p => p.map(c => c.id === consultorId ? { ...c, avatar_url: publicUrl } : c));
      toast.success('Avatar atualizado e otimizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao enviar foto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // MOTOR DA LINHA DE BASE (MATRIZ) E ALOCAÇÕES
  // ==========================================
  useEffect(() => { 
    if (contratoAtivo && menuAtivo === 'alocacoes') {
      const c = contratos.find(x => x.id === contratoAtivo);
      if (c?.tipo === 'continuado_com_os') {
        const primeiraOs = osList.filter(o => o.contract_id === contratoAtivo)[0];
        setAlocacaoOsId(primeiraOs ? primeiraOs.id : '');
        if(primeiraOs) {
          carregarLinhaBase(contratoAtivo, primeiraOs.id);
          if (viewAlocacao === 'mensal') carregarAlocacoesMensais(contratoAtivo, primeiraOs.id);
        } else {
          setBaseItems({}); setAlocacoes({}); setCurrentBase(null); setBaseVersions([]);
        }
      } else {
        setAlocacaoOsId('');
        carregarLinhaBase(contratoAtivo, null);
        if (viewAlocacao === 'mensal') carregarAlocacoesMensais(contratoAtivo, null);
      }
    }
  }, [contratoAtivo, menuAtivo])

  useEffect(() => {
    if (contratoAtivo && menuAtivo === 'alocacoes') {
      carregarLinhaBase(contratoAtivo, alocacaoOsId || null);
      if (viewAlocacao === 'mensal') carregarAlocacoesMensais(contratoAtivo, alocacaoOsId || null);
    }
  }, [alocacaoOsId, alocMes, alocAno, viewAlocacao])
  
  // 1. Carregar a Linha de Base
  async function carregarLinhaBase(idContrato: string, idOs: string | null) {
    setCarregandoAlocacoes(true);
    let query = supabase.from('linha_base').select('*').eq('contract_id', idContrato).order('versao', { ascending: false });
    if (idOs && idOs !== 'global') query = query.eq('os_id', idOs);
    else query = query.is('os_id', null);

    const { data: bases } = await query;
    if (bases && bases.length > 0) {
      setBaseVersions(bases);
      setCurrentBase(bases[0]); // Pega a mais recente
      
      const { data: items } = await supabase.from('linha_base_items').select('*').eq('base_id', bases[0].id);
      const itemsMap: Record<string, LinhaBaseItem> = {};
      (items || []).forEach(item => { itemsMap[item.user_id] = item; });
      setBaseItems(itemsMap);
    } else {
      setBaseVersions([]); setCurrentBase(null); setBaseItems({});
    }
    setCarregandoAlocacoes(false);
  }

  // 2. Salvar Nova Versão da Linha de Base (Com Auditoria e Caça-Fantasmas)
  async function salvarLinhaBase() {
    setSalvando(true);
    const idOsValido = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);
    const cObj = contratos.find(c => c.id === contratoAtivo);

    // 🌟 1. PROTEÇÃO CONTRA REMOÇÃO DE QUEM TEM HORAS MEDIDAS
    const usuariosNaNovaMatriz = Object.keys(baseItems);

    // Pega todos os timesheets deste contrato/OS no mês selecionado
    const timesheetsDoMes = allTimesheets.filter(t => {
        if (t.contract_id !== contratoAtivo) return false;
        if (idOsValido && t.os_id !== idOsValido) return false;
        return isWithinCycle(t.start_at, alocMes, alocAno, cObj?.ciclo_inicio || 25, cObj?.ciclo_fim || 24);
    });

    // Pega todas as medições de preço fechado deste contrato/OS no mês selecionado
    const medicoesDoMes = allMedicoes.filter(m => {
         if (m.contract_id !== contratoAtivo) return false;
         if (idOsValido && m.os_id !== idOsValido) return false;
         return m.mes === alocMes && m.ano === alocAno;
    });

    const usuariosComHoras = new Set([
        ...timesheetsDoMes.map(t => t.user_id),
        ...medicoesDoMes.map(m => m.user_id)
    ]);

    const usuariosBloqueados: string[] = [];

    usuariosComHoras.forEach(uid => {
        if (!usuariosNaNovaMatriz.includes(uid)) {
           const nome = consultores.find(c => c.id === uid)?.nome || 'Consultor';
           usuariosBloqueados.push(nome);
        }
    });

    // Se a pessoa foi removida da tela, mas tem horas no banco, emite ALERTA e trava a gravação!
    if (usuariosBloqueados.length > 0) {
         alert(`❌ BLOQUEIO DE SEGURANÇA CONTÁBIL:\n\nVocê removeu da Matriz consultores que já possuem HORAS ou MEDIÇÕES no ciclo de ${MESES_NOME[parseInt(alocMes)]}/${alocAno}:\n\n- ${usuariosBloqueados.join('\n- ')}\n\nPara removê-los da matriz, você deve primeiro excluir ou reatribuir os apontamentos de horas que eles já fizeram neste mês.`);
         setSalvando(false);
         carregarLinhaBase(contratoAtivo, idOsValido); // Restaura a tela original
         return;
    }
    // 🌟 FIM DA PROTEÇÃO

    // --- NOVA TRAVA: TETO GLOBAL DA ASSESSORIA ---
    if (cObj?.tipo === 'continuado_com_os' && cObj.teto_global_horas > 0 && idOsValido !== null && !isSemOsType) {
        const tetoDestaOS = Object.values(baseItems).reduce((sum, item) => sum + (item.tipo_pagamento === 'horas' ? Number(item.horas_teto) : 0), 0);
        
        // Busca as últimas bases de todas as OSs deste contrato para ver quanto já "comeram" do Teto Global
        const { data: allBases } = await supabase.from('linha_base').select('id, os_id, versao').eq('contract_id', contratoAtivo);
        
        let tetoOutrasOS = 0;
        if (allBases && allBases.length > 0) {
            const latestBasesMap = new Map();
            allBases.forEach(b => {
               if (b.os_id && b.os_id !== idOsValido) {
                  if (!latestBasesMap.has(b.os_id) || latestBasesMap.get(b.os_id).versao < b.versao) {
                     latestBasesMap.set(b.os_id, b);
                  }
               }
            });
            
            const latestBaseIds = Array.from(latestBasesMap.values()).map(b => b.id);
            if (latestBaseIds.length > 0) {
                const { data: allItems } = await supabase.from('linha_base_items').select('horas_teto').in('base_id', latestBaseIds);
                tetoOutrasOS = (allItems || []).reduce((sum, item) => sum + Number(item.horas_teto), 0);
            }
        }
        
        if (tetoDestaOS + tetoOutrasOS > cObj.teto_global_horas) {
            alert(`❌ TETO GLOBAL DA ASSESSORIA EXCEDIDO!\n\nEste contrato de assessoria tem um Teto Global de ${cObj.teto_global_horas}h.\nOutras Ordens de Serviço (OS) já bloqueiam ${tetoOutrasOS}h da Matriz.\nO máximo que você pode distribuir para a equipe nesta OS é ${(cObj.teto_global_horas - tetoOutrasOS).toFixed(1)}h.\n\nVocê tentou alocar ${tetoDestaOS}h. Reduza o teto dos consultores.`);
            setSalvando(false);
            return;
        }
    }
    const novaVersaoNum = currentBase ? currentBase.versao + 1 : 1;

    // Cria a capa da Baseline
    const { data: novaBase, error: errBase } = await supabase.from('linha_base').insert([{
      contract_id: contratoAtivo,
      os_id: idOsValido,
      versao: novaVersaoNum
    }]).select().single();

    if (errBase || !novaBase) { alert("Erro ao criar versão da linha de base."); setSalvando(false); return; }

    // Cria os Itens (Consultores, Teto e Atividades)
    const itemsToInsert = Object.values(baseItems).map(item => ({
      base_id: novaBase.id,
      user_id: item.user_id,
      horas_teto: item.horas_teto,
      atividades: item.atividades,
      tipo_pagamento: item.tipo_pagamento // <--- NOVA COLUNA AQUI
    }));

    if (itemsToInsert.length > 0) {
      await supabase.from('linha_base_items').insert(itemsToInsert);
    }

    // 🌟 2. INÍCIO DO CAÇA-FANTASMAS (Limpeza de Alocações Futuras)
    try {
      let queryGhost = supabase.from('alocacoes').select('id, user_id, mes, ano').eq('contract_id', contratoAtivo);
      if (idOsValido) queryGhost = queryGhost.eq('os_id', idOsValido);
      else queryGhost = queryGhost.is('os_id', null);

      const { data: todasAlocs } = await queryGhost;
      
      if (todasAlocs && todasAlocs.length > 0) {
        const mAtual = parseInt(alocMes);
        const aAtual = parseInt(alocAno);

        // Acha as alocações de quem saiu da matriz E que são do mês atual ou futuro
        const idsToDelete = todasAlocs.filter(a => {
          if (usuariosNaNovaMatriz.includes(a.user_id)) return false; // Está na matriz, deixa quieto
          
          const mA = parseInt(a.mes);
          const aA = parseInt(a.ano);
          // Só deleta se for do mês/ano atual pra frente (preserva o passado)
          return (aA > aAtual) || (aA === aAtual && mA >= mAtual);
        }).map(a => a.id);

        if (idsToDelete.length > 0) {
          await supabase.from('alocacoes').delete().in('id', idsToDelete);
          console.log(`Limpou ${idsToDelete.length} alocações fantasmas.`);
        }
      }
    } catch (e) {
      console.error("Erro ao limpar fantasmas:", e);
    }
    // 🌟 FIM DO CAÇA-FANTASMAS

    toast.success(`Linha de Base (Versão ${novaVersaoNum}) salva com sucesso!`);
    carregarLinhaBase(contratoAtivo, idOsValido);
    
    // Atualiza a visualização mensal para os fantasmas sumirem da tela na hora
    if (viewAlocacao === 'mensal') carregarAlocacoesMensais(contratoAtivo, idOsValido);

    setSalvando(false);
  }

  // 3. Carregar Alocações do Mês selecionado (Balizado pela Linha de Base mais recente)
  async function carregarAlocacoesMensais(idContrato: string, idOs: string | null) {
    setCarregandoAlocacoes(true);
    
    // Primeiro, recarregamos a matriz mais atual para garantir que os consultores e atividades estão sincronizados
    let queryBase = supabase.from('linha_base').select('*').eq('contract_id', idContrato).order('versao', { ascending: false });
    if (idOs && idOs !== 'global') queryBase = queryBase.eq('os_id', idOs);
    else queryBase = queryBase.is('os_id', null);
    
    const { data: bases } = await queryBase;
    let matrizAtual: Record<string, LinhaBaseItem> = {};
    if (bases && bases.length > 0) {
      const { data: items } = await supabase.from('linha_base_items').select('*').eq('base_id', bases[0].id);
      (items || []).forEach(item => { matrizAtual[item.user_id] = item; });
    }

    // Agora buscamos o que já foi salvo de fato na tabela de alocação mensal
    let query = supabase.from('alocacoes').select('*').eq('contract_id', idContrato).eq('mes', alocMes).eq('ano', alocAno)
    if (idOs && idOs !== 'global') query = query.eq('os_id', idOs);
    else query = query.is('os_id', null);

    const { data: alocsMensais } = await query;
    
    // Mapeamento Inteligente: Mescla a estrutura da Matriz com os valores salvos no Mês
    const alocSalvas: Record<string, Alocacao> = {};
    
    // A. Constrói o esqueleto com base na Matriz (para garantir que novas atividades/consultores apareçam)
    Object.values(matrizAtual).forEach(matrizItem => {
      alocSalvas[matrizItem.user_id] = {
        consultorId: matrizItem.user_id,
        tipo_pagamento: matrizItem.tipo_pagamento, // <--- HERDA AQUI
        horasTotais: 0,
        atividades: matrizItem.atividades.map(nomeAtiv => ({
          id: crypto.randomUUID(),
          nome: nomeAtiv,
          horas: 0 // Inicia zerado, vai ser preenchido se achar no banco
        }))
      };
      
      if (matrizItem.atividades.length === 0 || matrizItem.tipo_pagamento === 'fechado') {
         alocSalvas[matrizItem.user_id].geralId = undefined; 
      }
    });

    // B. Preenche com os dados reais salvos do mês
    (alocsMensais || []).forEach(row => {
      if (!alocSalvas[row.user_id]) return; 

      if (row.atividade === 'Sem atividade específica' || row.atividade === 'Orçamento Geral' || row.atividade === 'Preço Fechado (Medição)') {
        alocSalvas[row.user_id].geralId = row.id;
        alocSalvas[row.user_id].horasTotais = row.horas_disponiveis;
      } else {
        // Acha a atividade no esqueleto da matriz e preenche
        const ativIndex = alocSalvas[row.user_id].atividades.findIndex(a => a.nome === row.atividade);
        if (ativIndex !== -1) {
          alocSalvas[row.user_id].atividades[ativIndex].dbId = row.id;
          alocSalvas[row.user_id].atividades[ativIndex].horas = row.horas_disponiveis;
        }
      }
    });

    // C. Recalcula os totais visuais
    Object.values(alocSalvas).forEach(aloc => {
      if (aloc.atividades.length > 0) aloc.horasTotais = aloc.atividades.reduce((sum, a) => sum + a.horas, 0);
    });

    setAlocacoes(alocSalvas); 
    setCarregandoAlocacoes(false);
  }

  // 4. Salvar Alocações Mensais (Agora com trava cruzando a Base de todas as alocações da vida)
  async function salvarAlocacoesNoBanco() {
    setSalvando(true)
    const cObj = contratos.find(c => c.id === contratoAtivo);
    const isHora = cObj?.tipo === 'horas';
    const isComOs = cObj?.tipo === 'continuado_com_os';
    const targetOsId = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);
    const isSemOs = targetOsId ? osList.find(o => o.id === targetOsId)?.codigo === '🛠️ Pequenos Suportes' : false;
    const isOverheadTypeSave = cObj?.tipo === 'overhead';
    const isDynamic = isSemOs || isOverheadTypeSave;

    // Traz todas as alocações da vida deste contrato para checar o TETO DA MATRIZ
    let queryAll = supabase.from('alocacoes').select('*').eq('contract_id', contratoAtivo);
    if (targetOsId) queryAll = queryAll.eq('os_id', targetOsId);
    else queryAll = queryAll.is('os_id', null);
    const { data: allAllocHistory } = await queryAll;

    const upserts: any[] = []; const inserts: any[] = []; const deletes: string[] = [];
    let bloqueio = false;

    for (const aloc of Object.values(alocacoes)) {
      const nomeCons = consultores.find(c => c.id === aloc.consultorId)?.nome;
      const matrizConsultor = baseItems[aloc.consultorId];

      if (!matrizConsultor && !isDynamic) {
         alert(`❌ ERRO: O consultor ${nomeCons} não está definido na Matriz (Linha de Base). Adicione-o lá primeiro.`);
         bloqueio = true; break;
      }

      const isFechado = matrizConsultor?.tipo_pagamento === 'fechado';

      if (isFechado) {
         const medidoAnteriorPerc = (allMedicoes || [])
           .filter(m => m.user_id === aloc.consultorId && m.contract_id === contratoAtivo && (targetOsId ? m.os_id === targetOsId : true) && !(m.mes === alocMes && m.ano === alocAno))
           .reduce((sum, m) => sum + Number(m.percentual || 0), 0);

         const keyPerc = targetOsId ? `${contratoAtivo}_${targetOsId}` : contratoAtivo;
         const valAtualPerc = Number(medicoesInput[keyPerc] || 0);

         if (medidoAnteriorPerc + valAtualPerc > 100) {
            alert(`❌ LIMITE DE 100% EXCEDIDO!\n\nConsultor: ${nomeCons}\nJá medido em outros meses: ${medidoAnteriorPerc.toFixed(1)}%\nSaldo restante: ${(100 - medidoAnteriorPerc).toFixed(1)}%\n\nVocê tentou medir ${valAtualPerc}% neste mês. Reduza para salvar.`);
            bloqueio = true; break;
         }

         // Salva ou atualiza a medição de % na tabela medicoes do banco de dados
         await supabase.from('medicoes').delete().eq('user_id', aloc.consultorId).eq('contract_id', contratoAtivo).eq('mes', alocMes).eq('ano', alocAno);
         if (valAtualPerc > 0) {
            await supabase.from('medicoes').insert([{
               user_id: aloc.consultorId,
               contract_id: contratoAtivo,
               os_id: targetOsId,
               mes: alocMes,
               ano: alocAno,
               percentual: valAtualPerc
            }]);
         }

         // Salva linha fantasma para controle visual de alocação (0h)
         if (aloc.geralId) upserts.push({ id: aloc.geralId, user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: 0, atividade: 'Preço Fechado (Medição)', mes: alocMes, ano: alocAno });
         else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: 0, atividade: 'Preço Fechado (Medição)', mes: alocMes, ano: alocAno });
         continue;
      }

      // Calcula o quanto já foi alocado em TODOS OS OUTROS MESES para este consultor
      const allocatedOtherMonths = (allAllocHistory || [])
          .filter(a => a.user_id === aloc.consultorId && !(a.mes === alocMes && a.ano === alocAno))
          .reduce((sum, a) => sum + Number(a.horas_disponiveis), 0);
      
      const newMonthlyTotal = isDynamic ? 9999 : aloc.horasTotais;
      
      // TRAVA DA LINHA DE BASE (Teto do Consultor)
      if (!isDynamic && matrizConsultor.horas_teto > 0) {
         if ((allocatedOtherMonths + newMonthlyTotal) > matrizConsultor.horas_teto) {
            const livre = Math.max(0, matrizConsultor.horas_teto - allocatedOtherMonths);
            alert(`❌ TETO DA MATRIZ EXCEDIDO!\n\nConsultor: ${nomeCons}\nTeto na Linha de Base: ${matrizConsultor.horas_teto}h\nJá alocado em outros meses: ${allocatedOtherMonths}h\nSaldo livre para alocar agora: ${livre}h\n\nVocê tentou alocar ${newMonthlyTotal}h neste mês. Reduza para salvar.`);
            bloqueio = true; break;
         }
      }

      if (aloc.atividades.length > 0) {
        aloc.atividades.forEach(ativ => {
          const hAtiv = isDynamic ? 9999 : ativ.horas;
          if (ativ.dbId) upserts.push({ id: ativ.dbId, user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: hAtiv, atividade: ativ.nome.trim(), mes: alocMes, ano: alocAno })
          else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: hAtiv, atividade: ativ.nome.trim(), mes: alocMes, ano: alocAno })
        })
        if (aloc.geralId) deletes.push(aloc.geralId) // Limpa caso existisse um "Geral" antes
      } else {
        if (aloc.geralId) upserts.push({ id: aloc.geralId, user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: newMonthlyTotal, atividade: 'Sem atividade específica', mes: alocMes, ano: alocAno })
        else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: newMonthlyTotal, atividade: 'Sem atividade específica', mes: alocMes, ano: alocAno })
      }
    }

    if (bloqueio) return setSalvando(false);

    try {
      for (const u of upserts) await supabase.from('alocacoes').update({ horas_disponiveis: u.horas_disponiveis, atividade: u.atividade, os_id: u.os_id, mes: u.mes, ano: u.ano }).eq('id', u.id)
      if (inserts.length > 0) await supabase.from('alocacoes').insert(inserts)
      if (deletes.length > 0) await supabase.from('alocacoes').delete().in('id', deletes)
      toast.success("Distribuição mensal salva com sucesso!"); 
      await carregarTudoParaDash();
      carregarAlocacoesMensais(contratoAtivo, alocacaoOsId)
    } catch (e) { alert("Erro ao salvar.") }
    setSalvando(false)
  }

  // --- Funções Auxiliares da View da Linha de Base ---
  const addConsultorBase = (id: string) => { 
    if (!baseItems[id]) setBaseItems(p => ({ ...p, [id]: { id: crypto.randomUUID(), base_id: '', user_id: id, horas_teto: 0, atividades: [], tipo_pagamento: 'horas' } }));
  }
  const removeConsultorBase = (id: string) => { setBaseItems(p => { const n = {...p}; delete n[id]; return n; }); }

  // 🌟 ITEM 2: Catálogo do Contrato (Isolado)
  const catalogoDoContrato = useMemo(() => {
    const setAtiv = new Set<string>();

    // 1. Pega do Supabase (A coluna que criamos!)
    const cObj = contratos.find(c => c.id === contratoAtivo);
    if (cObj && cObj.catalogo_atividades) {
       cObj.catalogo_atividades.forEach(a => setAtiv.add(a));
    }
    
    // 2. Pega do histórico de Alocações
    allAlocacoes.filter(a => a.contract_id === contratoAtivo && (!isComOsType || a.os_id === (alocacaoOsId || null))).forEach(a => {
       if (a.atividade && a.atividade !== 'Sem atividade específica' && a.atividade !== 'Preço Fechado (Medição)') setAtiv.add(a.atividade);
    });
    
    // 3. Pega do histórico de Timesheets
    allTimesheets.filter(t => t.contract_id === contratoAtivo && (!isComOsType || t.os_id === (alocacaoOsId || null))).forEach(t => {
       if (t.activity && t.activity !== 'Sem atividade específica' && t.activity !== 'Preço Fechado (Medição)') setAtiv.add(t.activity);
    });
    
    // 4. Pega as que já estão na Matriz atual
    Object.values(baseItems).forEach(item => {
       item.atividades.forEach(a => setAtiv.add(a));
    });

    // 5. Adiciona as "Avulsas" (criadas agora no pop-up)
    atividadesAvulsas.forEach(a => setAtiv.add(a));

    return Array.from(setAtiv).sort();
  }, [allAlocacoes, allTimesheets, baseItems, contratoAtivo, alocacaoOsId, isComOsType, atividadesAvulsas, contratos]);

  const updateTetoBase = (id: string, h: number) => { setBaseItems(p => ({ ...p, [id]: { ...p[id], horas_teto: h } })); }
  
  const updateTipoPagamentoBase = (id: string, tipo: 'horas' | 'fechado') => { 
    if (tipo === 'fechado') {
      const idOsValido = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);
      const temHoras = allTimesheets.some(t => t.user_id === id && t.contract_id === contratoAtivo && (idOsValido ? t.os_id === idOsValido : true));
      if (temHoras) {
        alert("❌ BLOQUEIO: Este consultor já possui horas registradas neste projeto.\nNão é possível alterar para Preço Fechado para não corromper o histórico.");
        return;
      }

      const temAlocacao = allAlocacoes.some(a => a.user_id === id && a.contract_id === contratoAtivo && (idOsValido ? a.os_id === idOsValido : true) && a.horas_disponiveis > 0 && a.atividade !== 'Preço Fechado (Medição)');
      if (temAlocacao) {
         alert("❌ BLOQUEIO DE SEGURANÇA (DADOS FANTASMAS):\n\nZere as horas dele na aba 'Distribuição Mensal' primeiro.");
         return;
      }
    }
    setBaseItems(p => ({ ...p, [id]: { ...p[id], tipo_pagamento: tipo, atividades: tipo === 'fechado' ? [] : p[id].atividades } })); 
  }

  async function mudarVersaoBase(baseId: string) {
    setCarregandoAlocacoes(true);
    const version = baseVersions.find(b => b.id === baseId);
    if (version) setCurrentBase(version);
    const { data: items } = await supabase.from('linha_base_items').select('*').eq('base_id', baseId);
    const itemsMap: Record<string, LinhaBaseItem> = {};
    (items || []).forEach(item => { itemsMap[item.user_id] = item; });
    setBaseItems(itemsMap);
    setCarregandoAlocacoes(false);
  }

  const removeAtividadeBase = (userId: string, ativName: string) => {
    setBaseItems(p => ({ ...p, [userId]: { ...p[userId], atividades: p[userId].atividades.filter(a => a !== ativName) } }));
  }
  
  const moverAtividadeBase = (userId: string, ativName: string, direction: 'up'|'down') => {
    setBaseItems(p => {
       const arr = [...p[userId].atividades];
       const idx = arr.indexOf(ativName);
       if (direction === 'up' && idx > 0) { [arr[idx], arr[idx-1]] = [arr[idx-1], arr[idx]]; }
       if (direction === 'down' && idx < arr.length - 1) { [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]]; }
       return { ...p, [userId]: { ...p[userId], atividades: arr } };
    });
  }

  // --- Funções Auxiliares da View Mensal ---
  const updateHorasMensal = (id: string, h: number) => setAlocacoes(p => ({ ...p, [id]: { ...p[id], horasTotais: h } }))
  const updateAtivMensal = (cid: string, aid: string, h: number) => setAlocacoes(p => { const newAtivs = p[cid].atividades.map(a => a.id === aid ? { ...a, horas: h } : a); const newTotal = newAtivs.reduce((sum, a) => sum + a.horas, 0); return { ...p, [cid]: { ...p[cid], atividades: newAtivs, horasTotais: newTotal } } })

  // ==========================================
  // AUTORIZAÇÕES RETROATIVAS E CARREGAMENTOS GLOBAIS
  // ==========================================
  useEffect(() => { 
    if (['alocacoes', 'dash-mensal', 'dash-global', 'alertas', 'gestao', 'faturamento-cliente', 'resumo-consultor'].includes(menuAtivo)) {
      carregarTudoParaDash();
      setModoDataFiltro('ciclo'); // 🌟 BLINDAGEM: Sempre volta para o Ciclo Mensal ao trocar de aba!
    }
    if (menuAtivo === 'gestao') carregarAutorizacoes();
  }, [menuAtivo])

  async function carregarTudoParaDash() {
    setLoadingDash(true)
    const { data: times } = await supabase.from('timesheets').select('*').not('end_at', 'is', null)
    const { data: orcs } = await supabase.from('alocacoes').select('*')
    const { data: meds } = await supabase.from('medicoes').select('*')
    // 🌟 NOVO: Carrega as linhas de base para cálculo de Teto Vida Útil
    const { data: lb } = await supabase.from('linha_base').select('*')
    const { data: lbi } = await supabase.from('linha_base_items').select('*')

    setAllTimesheets(times || []); setAllAlocacoes(orcs || []); setAllMedicoes(meds || [])
    setAllLinhasBase(lb || []); setAllLinhaBaseItems(lbi || []);
    setLoadingDash(false)
  }

  // 🌟 MOTOR INTELIGENTE: Calcula o Teto da Linha de Base (última versão) do Contrato ou do Consultor
  const getTetoBaseContrato = (contractId: string, userId?: string) => {
    const basesDoContrato = allLinhasBase.filter(b => b.contract_id === contractId);
    if (basesDoContrato.length === 0) return 0;

    // Mapeia apenas a versão mais recente de cada OS (ou global)
    const latestBasesMap = new Map();
    basesDoContrato.forEach(b => {
      const key = b.os_id || 'global';
      if (!latestBasesMap.has(key) || latestBasesMap.get(key).versao < b.versao) {
        latestBasesMap.set(key, b);
      }
    });

    const latestBaseIds = Array.from(latestBasesMap.values()).map(b => b.id);
    if (latestBaseIds.length === 0) return 0;

    return allLinhaBaseItems
      .filter(item => latestBaseIds.includes(item.base_id) && (userId ? item.user_id === userId : true))
      .reduce((sum, item) => sum + Number(item.horas_teto || 0), 0);
  };
  async function carregarAutorizacoes() {
    setLoadingAuth(true);
    const { data } = await supabase.from('autorizacoes_edicao').select('*').order('created_at', { ascending: false });
    setAuthList(data || []);
    setLoadingAuth(false);
  }

  async function concederAutorizacao() {
    if (!liberarConsultor || !liberarData) return alert("Selecione o consultor e a data.");
    const jaExiste = authList.find(a => a.user_id === liberarConsultor && a.data_liberada === liberarData);
    if (jaExiste) return alert("Esta data já está liberada para este consultor.");

    setSalvando(true);
    const { error } = await supabase.from('autorizacoes_edicao').insert([{ user_id: liberarConsultor, data_liberada: liberarData }]);
    setSalvando(false);

    if (error) return alert("Erro ao liberar data: " + error.message);
    toast.success("Acesso retroativo liberado com sucesso!");
    setLiberarData(getLocalISODate(new Date()));
    carregarAutorizacoes();
  }

  async function revogarAutorizacao(id: string) {
    if (!window.confirm("Deseja revogar este acesso retroativo do consultor?")) return;
    await supabase.from('autorizacoes_edicao').delete().eq('id', id);
    carregarAutorizacoes();
  }

  // ==========================================
  // DASHBOARDS, CÁLCULOS E GESTÃO
  // ==========================================
  const getEffectiveBounds = (cInicio: number, cFim: number, monthStr: string, yearStr: string) => {
    // 1. Se o usuário ativou "Por Intervalo", usa as datas do calendário
    if (modoDataFiltro === 'intervalo') {
      const start = new Date(dataInicioCustom + 'T00:00:00').getTime();
      const end = new Date(dataFimCustom + 'T23:59:59').getTime();
      return { start, end };
    }

    // 2. Se está "Por Ciclo", mantém 100% do seu cálculo original com proteção de meses curtos (getValidDay)
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);
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

  const isWithinCycle = (dateStr: string, monthStr: string, yearStr: string, cInicio: number, cFim: number) => {
    const date = new Date(dateStr).getTime();
    const bounds = getEffectiveBounds(cInicio, cFim, monthStr, yearStr);
    return date >= bounds.start && date <= bounds.end;
  };

  const contratosVisao = contratos.filter(c => c.status_ativo && dashVisaoTipos.includes(c.tipo) && (dashFonte === 'todas' ? true : c.fonte_pagamento === dashFonte))
  
  const consultoresDashDisponiveis = useMemo(() => {
    if (dashContratosSelecionados.length === 0) return consultores;
    const userIds = new Set(allAlocacoes.filter(a => dashContratosSelecionados.includes(a.contract_id)).map(a => a.user_id));
    return consultores.filter(c => userIds.has(c.id));
  }, [dashContratosSelecionados, consultores, allAlocacoes]);

  const osDashDisponiveis = useMemo(() => {
    if (dashContratosSelecionados.length === 0) return osList;
    return osList.filter(o => dashContratosSelecionados.includes(o.contract_id));
  }, [dashContratosSelecionados, osList]);

  const handleImportarTimesheetExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Código de importação igual à versão anterior, mantido para estabilidade.
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      const toInsert: any[] = [];
      let errors = 0;

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const getVal = (colIndex: number) => {
          const cell = row.getCell(colIndex);
          if (!cell.value) return '';
          if (cell.value instanceof Date) return cell.value;
          if (typeof cell.value === 'object' && 'result' in cell.value) return cell.value.result;
          if (typeof cell.value === 'object' && 'text' in cell.value) return cell.value.text;
          return cell.value.toString().trim();
        };

        const consultorNome = String(getVal(1));
        const dataVal = getVal(2);
        const contratoCodigo = String(getVal(3)).toUpperCase();
        const osCodigo = String(getVal(5)).toUpperCase();
        const atividadeStr = String(getVal(6)) || 'Sem atividade específica';
        const inicioVal = getVal(7);
        const fimVal = getVal(8);
        const observacao = String(getVal(9));

        let dataStr = '';
        if (dataVal instanceof Date) dataStr = dataVal.toLocaleDateString('pt-BR');
        else dataStr = String(dataVal);

        const parseTime = (val: any) => {
          if (val instanceof Date) return val.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          if (typeof val === 'number') {
            const totalMs = Math.round(val * 24 * 60 * 60 * 1000);
            const h = Math.floor(totalMs / 3600000);
            const m = Math.floor((totalMs % 3600000) / 60000);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
          return String(val);
        };

        const inicioStr = parseTime(inicioVal);
        const fimStr = parseTime(fimVal);

        const consultor = consultores.find(c => c.nome.toLowerCase() === consultorNome.toLowerCase());
        const contrato = contratos.find(c => c.codigo === contratoCodigo);

        let osId = null;
        if (osCodigo && osCodigo !== '-' && contrato) {
          const os = osList.find(o => o.codigo === osCodigo && o.contract_id === contrato.id);
          if (os) osId = os.id;
        }

        if (!consultor || !contrato || !dataStr || !inicioStr || !fimStr) { errors++; return; }

        try {
          const sep = dataStr.includes('/') ? '/' : '-';
          const [dia, mes, ano] = dataStr.split(sep);
          const anoFinal = ano.length === 2 ? `20${ano}` : ano;
          const [hIni, mIni] = inicioStr.split(':');
          const [hFim, mFim] = fimStr.split(':');

          const startDt = new Date(parseInt(anoFinal), parseInt(mes) - 1, parseInt(dia), parseInt(hIni), parseInt(mIni));
          const endDt = new Date(parseInt(anoFinal), parseInt(mes) - 1, parseInt(dia), parseInt(hFim), parseInt(mFim));
          if (endDt <= startDt) endDt.setDate(endDt.getDate() + 1);

          toInsert.push({
            id: crypto.randomUUID(), user_id: consultor.id, contract_id: contrato.id, os_id: osId,
            contract_name: `${contrato.codigo} — ${contrato.nome}`, activity: atividadeStr,
            notes: observacao, start_at: startDt.toISOString(), end_at: endDt.toISOString(), edited: true
          });
        } catch (err) { errors++; }
      });

      if (toInsert.length > 0) {
        setLoading(true);
        const { error } = await supabase.from('timesheets').insert(toInsert);
        if (error) alert("Erro no banco de dados: " + error.message);
        else { toast.success(`✅ ${toInsert.length} apontamentos importados!\n❌ ${errors} linhas com erro.`); carregarTudoParaDash(); }
        setLoading(false);
      } else alert(`Nenhum apontamento válido encontrado.`);
      event.target.value = ''; 
    };
    reader.readAsArrayBuffer(file);
  };

  const gestaoSaldos = useMemo(() => {
    if (!gestaoConsultor || !gestaoContrato || !gestaoAtividade || !gestaoData) return null;
    const cObj = contratos.find(c => c.id === gestaoContrato);
    if (!cObj) return null;
    
    const [y, mStr, d] = gestaoData.split('-');
    let m = parseInt(mStr) - 1; let yNum = parseInt(y); let day = parseInt(d);
    if (cObj.ciclo_inicio > cObj.ciclo_fim && day >= cObj.ciclo_inicio) {
       m = m === 11 ? 0 : m + 1;
       if (m === 0) yNum++;
    }
    const refMonth = m.toString(); const refYear = yNum.toString();
    const cb = getCycleBoundsForContract(cObj.ciclo_inicio, cObj.ciclo_fim, refMonth, refYear);

    const isComOs = cObj.tipo === 'continuado_com_os';
    const osObj = osList.find(o => o.id === gestaoOs);
    const isSemOs = osObj?.codigo === '🛠️ Pequenos Suportes' || cObj.tipo === 'overhead';

    const alocs = allAlocacoes.filter(a => a.user_id === gestaoConsultor && a.contract_id === gestaoContrato && a.mes === refMonth && a.ano === refYear);
    const alocAtiv = alocs.find(a => a.atividade === gestaoAtividade && (!isComOs || a.os_id === (gestaoOs || null)));

    let orcado = isSemOs ? 9999 : (alocAtiv ? alocAtiv.horas_disponiveis : 0);
    
    let tAtiv = allTimesheets.filter(t => t.user_id === gestaoConsultor && t.contract_id === gestaoContrato && t.activity === gestaoAtividade && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
    if (isComOs && gestaoOs) tAtiv = tAtiv.filter(t => t.os_id === gestaoOs);
    
    let gasto = tAtiv.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;

    if (gestaoEditandoId) {
       const editingEntry = allTimesheets.find(t => t.id === gestaoEditandoId);
       if (editingEntry) {
          gasto -= (new Date(editingEntry.end_at!).getTime() - new Date(editingEntry.start_at).getTime()) / 3600000;
       }
    }

    let orcadoGlobal = 0; let gastoGlobal = 0;
    if (!isSemOs) {
       orcadoGlobal = isComOs ? alocs.filter(a => a.os_id === (gestaoOs || null)).reduce((sum, a) => sum + a.horas_disponiveis, 0) : alocs.reduce((sum, a) => sum + a.horas_disponiveis, 0);
       let tGlob = allTimesheets.filter(t => t.user_id === gestaoConsultor && t.contract_id === gestaoContrato && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
       if (isComOs && gestaoOs) tGlob = tGlob.filter(t => t.os_id === gestaoOs);
       gastoGlobal = tGlob.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
       
       if (gestaoEditandoId) {
          const editingEntry = allTimesheets.find(t => t.id === gestaoEditandoId);
          if (editingEntry) gastoGlobal -= (new Date(editingEntry.end_at!).getTime() - new Date(editingEntry.start_at).getTime()) / 3600000;
       }
    }

    return { orcado, gasto, saldo: orcado - gasto, orcadoGlobal, gastoGlobal, saldoGlobal: orcadoGlobal - gastoGlobal, isSemOs };
  }, [gestaoConsultor, gestaoContrato, gestaoOs, gestaoAtividade, gestaoData, gestaoEditandoId, contratos, osList, allAlocacoes, allTimesheets]);
  
  async function salvarApontamentoAdmin() {
    if(!gestaoConsultor || !gestaoContrato || !gestaoAtividade || !gestaoData || !gestaoInicio || !gestaoFim) return alert("Preencha todos os campos obrigatórios.");
    const startMs = new Date(`${gestaoData}T${gestaoInicio}:00`).getTime();
    let endMs = new Date(`${gestaoData}T${gestaoFim}:00`).getTime();
    
    // Se a hora final for 00:00 ou menor que a inicial, joga pro dia seguinte!
    if(endMs <= startMs) {
      endMs += 24 * 60 * 60 * 1000; // Soma 24 horas em milissegundos
    }

    const contObj = contratos.find(c => c.id === gestaoContrato);
    if (contObj?.tipo === 'continuado_com_os' && !gestaoOs) return alert("Selecione uma Ordem de Serviço (OS) para este contrato.");

    const payload = {
      user_id: gestaoConsultor, contract_id: gestaoContrato, contract_name: `${contObj?.codigo} — ${contObj?.nome}`, 
      activity: gestaoAtividade, notes: gestaoNotes, start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(), edited: true,
      os_id: contObj?.tipo === 'continuado_com_os' ? gestaoOs : null
    };
    setSalvando(true);
    try {
      if(gestaoEditandoId) {
        await supabase.from('timesheets').update(payload).eq('id', gestaoEditandoId);
        toast.success("Atualizado com sucesso!"); setGestaoEditandoId(null);
      } else {
        await supabase.from('timesheets').insert([{ ...payload, id: crypto.randomUUID() }]);
        toast.success("Criado com sucesso!");
      }
      setGestaoInicio('08:00'); setGestaoFim('12:00'); setGestaoNotes(''); setGestaoOs(''); await carregarTudoParaDash();
    } catch (e) { alert("Erro ao processar."); } finally { setSalvando(false); }
  }

  async function excluirApontamentoAdmin(id: string) {
    if(!window.confirm("Atenção: Deseja apagar este apontamento do sistema?")) return;
    await supabase.from('timesheets').delete().eq('id', id); await carregarTudoParaDash();
  }

  function iniciarEdicaoApontamento(t: TimesheetLog) {
    setGestaoEditandoId(t.id); setGestaoConsultor(t.user_id); setGestaoContrato(t.contract_id);
    setGestaoAtividade(t.activity); setGestaoNotes(t.notes || '');
    setGestaoOs(t.os_id || '');
    const startDate = new Date(t.start_at); const endDate = t.end_at ? new Date(t.end_at) : new Date();
    setGestaoData(getLocalISODate(startDate));
    setGestaoInicio(`${String(startDate.getHours()).padStart(2,'0')}:${String(startDate.getMinutes()).padStart(2,'0')}`);
    setGestaoFim(`${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const gestaoLogsFiltrados = useMemo(() => {
    return allTimesheets.filter(t => gestaoConsultor ? t.user_id === gestaoConsultor : true)
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()).slice(0, 50);
  }, [allTimesheets, gestaoConsultor])

  // --- FUNÇÕES E CÁLCULOS RESTAURADOS ---
  async function atualizarMetaConsultor(id: string, valor: number) {
    setConsultores(p => p.map(c => c.id === id ? { ...c, horas_minimas_mes: valor } : c));
    const { data, error } = await supabase.from('consultores').update({ horas_minimas_mes: valor }).eq('id', id).select();
    if (error) toast.error("❌ Erro do banco: " + error.message);
    else if (!data || data.length === 0) toast.error("❌ Falha Silenciosa no Supabase.");
    else toast.success("✅ Meta salva com segurança!");
  }

  // Carrega sempre que mudar de consultor, mês ou ano
  useEffect(() => { if (menuAtivo === 'medicoes' && medConsultor) carregarMedicoes() }, [menuAtivo, medConsultor, medMes, medAno])
  
  async function carregarMedicoes() {
    setMedLoading(true)
    
    // 1. Busca diretamente da Matriz Global quem é Preço Fechado (Garante que aparece em qualquer mês!)
    const { data: matrizFechado } = await supabase.from('linha_base_items').select('contract_id, os_id').eq('user_id', medConsultor).eq('tipo_pagamento', 'fechado');
    
    // 2. Busca as alocações (caso haja algum resquício ou contrato híbrido)
    const { data: alocs } = await supabase.from('alocacoes').select('contract_id, os_id').eq('user_id', medConsultor).eq('mes', medMes).eq('ano', medAno).eq('atividade', 'Preço Fechado (Medição)');
    
    const vinculados: any[] = [];
    
    const addVinculo = (cid: string, osid: string | null) => {
       const c = contratos.find(x => x.id === cid);
       const o = osList.find(x => x.id === osid);
       if (c) {
          const key = osid ? `${c.id}_${osid}` : c.id;
          if (!vinculados.find(v => v.key === key)) vinculados.push({ key, contract_id: c.id, os_id: osid, codigo: c.codigo, nome: c.nome, os_codigo: o?.codigo });
       }
    };

    (matrizFechado || []).forEach(m => addVinculo(m.contract_id, m.os_id));
    (alocs || []).forEach(a => addVinculo(a.contract_id, a.os_id));
    
    setMedContratosVinculados(vinculados);
    
    const { data: meds } = await supabase.from('medicoes').select('*').eq('user_id', medConsultor).eq('mes', medMes).eq('ano', medAno)
    const inputs: Record<string, number> = {}; 
    (meds || []).forEach(m => { 
       const key = m.os_id ? `${m.contract_id}_${m.os_id}` : m.contract_id;
       inputs[key] = m.percentual;
    })
    setMedicoesInput(inputs); 
    setMedLoading(false)
  }
  
  async function salvarMedicoes() {
    setSalvando(true)
    await supabase.from('medicoes').delete().eq('user_id', medConsultor).eq('mes', medMes).eq('ano', medAno)
    
    const inserts = medContratosVinculados.map(v => ({ contract_id: v.contract_id, os_id: v.os_id || null, user_id: medConsultor, mes: medMes, ano: medAno, percentual: medicoesInput[v.key] || 0 })).filter(m => m.percentual > 0)
    
    if (inserts.length > 0) await supabase.from('medicoes').insert(inserts)
    toast.success("Medições do consultor salvas com sucesso!"); await carregarTudoParaDash(); setSalvando(false)
  }

  const gestaoAtividadesDisponiveis = useMemo(() => {
    if (!gestaoContrato) return ['Sem atividade específica'];
    const isComOsType = contratos.find(c => c.id === gestaoContrato)?.tipo === 'continuado_com_os';
    const alocs = allAlocacoes.filter(a => 
      a.contract_id === gestaoContrato && 
      (gestaoConsultor ? a.user_id === gestaoConsultor : true) &&
      (!isComOsType || !gestaoOs || a.os_id === gestaoOs)
    );
    const acts = Array.from(new Set(alocs.map(a => a.atividade)));
    return acts.length > 0 ? acts as string[] : ['Sem atividade específica'];
  }, [gestaoContrato, gestaoConsultor, gestaoOs, allAlocacoes, contratos])

  const dashData = useMemo(() => {
    let fTimes = allTimesheets.filter(t => contratosVisao.some(cv => cv.id === t.contract_id))
    let fAlocs = allAlocacoes.filter(a => a.mes === dashMes && a.ano === dashAno && contratosVisao.some(cv => cv.id === a.contract_id));

    if (dashContratosSelecionados.length > 0) {
      fTimes = fTimes.filter(t => dashContratosSelecionados.includes(t.contract_id)); 
      fAlocs = fAlocs.filter(a => dashContratosSelecionados.includes(a.contract_id)); 
    }
    if (dashOs !== 'todas') { 
      fTimes = fTimes.filter(t => t.os_id === dashOs); 
      fAlocs = fAlocs.filter(a => a.os_id === dashOs); 
    }
    if (dashConsultor !== 'todos') { 
      fTimes = fTimes.filter(t => t.user_id === dashConsultor); 
      fAlocs = fAlocs.filter(a => a.user_id === dashConsultor); 
    }

    const consultoresPagamento: Array<{id: string, nome: string, nomeCurto: string, valorGrafico: number, tooltipExtra: string}> = consultores.map(c => {
      const logs = fTimes.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, dashMes, dashAno, contratos.find(con => con.id === t.contract_id)?.ciclo_inicio || 25, contratos.find(con => con.id === t.contract_id)?.ciclo_fim || 24))
      const valorGrafico = logs.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
      return { id: c.id, nome: c.nome, nomeCurto: c.nome.split(' ')[0], valorGrafico: Number(valorGrafico.toFixed(2)), tooltipExtra: "" }
    }).filter(c => c.valorGrafico > 0).sort((a,b) => b.valorGrafico - a.valorGrafico)

    let orcadoGlobal = 0; let gastoGlobal = 0;

    contratosVisao.forEach(cont => {
      const cycle = getEffectiveBounds(cont.ciclo_inicio, cont.ciclo_fim, dashMes, dashAno);
      const timesContrato = fTimes.filter(t => t.contract_id === cont.id && new Date(t.start_at).getTime() >= cycle.start && new Date(t.start_at).getTime() <= cycle.end);
      const gastoAtual = timesContrato.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
      
      const now = new Date(); const currentDay = now.getDate(); let m = now.getMonth(); let y = now.getFullYear();
      if (cont.ciclo_inicio > cont.ciclo_fim && currentDay >= cont.ciclo_inicio) { m = m === 11 ? 0 : m + 1; if (m === 0) y++; }
      const dM = parseInt(dashMes); const dA = parseInt(dashAno);
      const isPast = (dA < y) || (dA === y && dM < m);

      let orcadoAtual = 0;
      
      if (cont.tipo === 'overhead' || cont.tipo === 'fechado') {
         // Overhead e Preço Fechado não usam horas alocadas no painel de horas. O orçamento dinâmico iguala o gasto para não distorcer.
         orcadoAtual = gastoAtual; 
      } else {
         // Para Contratos Normais: Soma as horas dos Pequenos Suportes ou de Meses já passados direto do timesheet (sem duplicar)
         const tDinamicoPassado = timesContrato.filter(t => {
             const isSup = osList.find(o => o.id === t.os_id)?.codigo === '🛠️ Pequenos Suportes';
             return isSup || isPast;
         });
         const gastoDinamicoPassado = tDinamicoPassado.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
         
         // Soma apenas as horas alocadas explicitamente no mês atual/futuro (Ignorando Suportes e Fechados)
         let alocadoFixo = 0;
         if (!isPast) {
             const alocsFixas = fAlocs.filter(a => a.contract_id === cont.id && a.atividade !== 'Preço Fechado (Medição)' && osList.find(o => o.id === a.os_id)?.codigo !== '🛠️ Pequenos Suportes');
             alocadoFixo = alocsFixas.reduce((sum, a) => sum + Number(a.horas_disponiveis), 0);
         }
         
         orcadoAtual = gastoDinamicoPassado + alocadoFixo;
      }

      orcadoGlobal += orcadoAtual;
      gastoGlobal += gastoAtual;
    });

    const saldoPositivo = orcadoGlobal - gastoGlobal > 0 ? orcadoGlobal - gastoGlobal : 0;
    
    let pieData: Array<{name: string, value: number}> = [ { name: 'Consumido', value: Number(gastoGlobal.toFixed(2)) }, { name: 'Saldo Restante', value: Number(saldoPositivo.toFixed(2)) } ]
    pieData = pieData.filter(p => p.value > 0); 
    if (pieData.length === 0) pieData.push({ name: 'Sem Registros', value: 1 });

    return { 
      consultoresPagamento, maxValor: Math.max(...consultoresPagamento.map(c => c.valorGrafico), 1), 
      orcadoGlobal, gastoGlobal: Number(gastoGlobal.toFixed(2)),
      saldoGlobal: Number((orcadoGlobal - gastoGlobal).toFixed(2)),
      percentualGlobal: orcadoGlobal > 0 ? ((gastoGlobal / orcadoGlobal) * 100).toFixed(1) : '0', pieData
    }
  }, [allTimesheets, allAlocacoes, dashMes, dashAno, dashContratosSelecionados, dashOs, dashConsultor, consultores, dashVisaoTipos, contratosVisao, contratos, osList])

  const exportarPainelConsultor = async (tipo: 'detalhada' | 'consolidada') => {
    const cObj = consultores.find(c => c.id === resConsId);
    if (!cObj) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Relatório ${cObj.nome.split(' ')[0]}`);

    if (tipo === 'detalhada') {
      sheet.columns = [
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
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      
      const alocsMes = allAlocacoes.filter(a => a.user_id === resConsId && a.mes === resConsMes && a.ano === resConsAno && contratos.find(c=>c.id===a.contract_id)?.status_ativo);
      const contratosValidos = Array.from(new Set(alocsMes.map(a => a.contract_id)));
      
      let registros = allTimesheets.filter(t => t.user_id === resConsId && contratosValidos.includes(t.contract_id));
      
      registros.forEach(t => {
        const cont = contratos.find(c => c.id === t.contract_id);
        if (!cont) return;
        if (!isWithinCycle(t.start_at, resConsMes, resConsAno, cont.ciclo_inicio, cont.ciclo_fim)) return;

        const osObj = osList.find(o => o.id === t.os_id);
        const os = osObj ? (osObj.descricao ? `${osObj.codigo} - ${osObj.descricao}` : osObj.codigo) : '-';
        const inicio = new Date(t.start_at); 
        const fim = new Date(t.end_at!);

        sheet.addRow({
          data: inicio.toLocaleDateString('pt-BR'), cod_contrato: cont.codigo, nome_contrato: cont.nome,
          os: os, atividade: t.activity, inicio: inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          fim: fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), obs: t.notes || ''
        });
      });
    } else {
       sheet.columns = [
         { header: 'Cód. Contrato', key: 'cod_contrato', width: 15 },
         { header: 'Nome do Contrato', key: 'nome_contrato', width: 35 },
         { header: 'Orçado', key: 'orcado', width: 15 },
         { header: 'Gasto', key: 'gasto', width: 15 },
         { header: 'Saldo', key: 'saldo', width: 15 },
       ];
       sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
       sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };

       resumoConsultorData?.contratosListados.forEach(ct => {
          sheet.addRow({
             cod_contrato: ct.codigo, nome_contrato: ct.nome,
             orcado: ct.ilimitado ? 'Ilimitado' : `${ct.orcado.toFixed(1)}h`,
             gasto: `${ct.gasto.toFixed(1)}h`,
             saldo: ct.ilimitado ? '-' : `${(ct.orcado - ct.gasto).toFixed(1)}h`
          });
       });
    }
    
    sheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      row.eachCell((cell) => { cell.border = { top: {style:'thin', color: {argb:'FFE2E8F0'}}, left: {style:'thin', color: {argb:'FFE2E8F0'}}, bottom: {style:'thin', color: {argb:'FFE2E8F0'}}, right: {style:'thin', color: {argb:'FFE2E8F0'}} }; });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Relatorio_${tipo}_${cObj.nome.split(' ')[0]}_${MESES_NOME[parseInt(resConsMes)]}_${resConsAno}.xlsx`);
  }
  const resumoConsultorData = useMemo(() => {
     if (!resConsId) return null;
     const consObj = consultores.find(c => c.id === resConsId);
     if (!consObj) return null;

     let orcadoTotal = 0; let gastoTotal = 0;
     const now = new Date(); const currentDay = now.getDate(); let m = now.getMonth(); let y = now.getFullYear();
     const pM = parseInt(resConsMes); const pA = parseInt(resConsAno);

     const contratosListados: Array<{id: string, codigo: string, nome: string, orcado: number, gasto: number, ilimitado: boolean, isFechado?: boolean}> = [];
     const cEnvolvidos = new Set<string>();

     // Puxa do que foi alocado E do que foi apontado (para garantir que meses passados, atuais e futuros apareçam)
     allAlocacoes.filter(a => a.user_id === resConsId && a.mes === resConsMes && a.ano === resConsAno && contratos.find(c=>c.id===a.contract_id)?.status_ativo).forEach(a => cEnvolvidos.add(a.contract_id));
     allTimesheets.filter(t => t.user_id === resConsId).forEach(t => {
        const cObj = contratos.find(c => c.id === t.contract_id);
        if (cObj?.status_ativo) {
           const cb = getEffectiveBounds(cObj.ciclo_inicio, cObj.ciclo_fim, resConsMes, resConsAno);
           if (new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end) cEnvolvidos.add(cObj.id);
        }
     });

     cEnvolvidos.forEach(cid => {
        const cObj = contratos.find(c => c.id === cid);
        if (!cObj) return;
        const cb = getEffectiveBounds(cObj.ciclo_inicio, cObj.ciclo_fim, resConsMes, resConsAno);
        
        let isPast = false; let mm = m; let yy = y;
        if (cObj.ciclo_inicio > cObj.ciclo_fim && currentDay >= cObj.ciclo_inicio) { mm = mm === 11 ? 0 : mm + 1; if (mm === 0) yy++; }
        isPast = (pA < yy) || (pA === yy && pM < mm);

        // Agrupa as OSs envolvidas
        const tContrato = allTimesheets.filter(t => t.user_id === resConsId && t.contract_id === cid && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
        const aContrato = allAlocacoes.filter(a => a.user_id === resConsId && a.contract_id === cid && a.mes === resConsMes && a.ano === resConsAno);
        
        const osEnvolvidas = new Set<string | null>();
        tContrato.forEach(t => osEnvolvidas.add(t.os_id || null));
        aContrato.forEach(a => osEnvolvidas.add(a.os_id || null));

        osEnvolvidas.forEach(osid => {
           let tOs = tContrato; let aOs = aContrato;
           if (cObj.tipo === 'continuado_com_os') {
              tOs = tContrato.filter(t => t.os_id === osid);
              aOs = aContrato.filter(a => a.os_id === osid);
           }
           
           const gastoH = tOs.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
           const osObj = osList.find(o => o.id === osid);
           const isSuportes = osObj?.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'overhead'].includes(cObj.tipo);
           const isFechado = cObj.tipo === 'fechado' || aOs.some(a => a.atividade === 'Preço Fechado (Medição)');
           
           if (isFechado) {
               const pM = parseInt(resConsMes); const pA = parseInt(resConsAno);
               const orcadoPerc = allMedicoes.find(m => m.user_id === resConsId && m.contract_id === cid && (osid ? m.os_id === osid : true) && m.mes === resConsMes && m.ano === resConsAno)?.percentual || 0;
               const gastoPerc = allMedicoes.filter(m => {
                   if (m.user_id !== resConsId || m.contract_id !== cid) return false;
                   if (osid && m.os_id !== osid) return false;
                   const mA = parseInt(m.ano); const mM = parseInt(m.mes);
                   return mA < pA || (mA === pA && mM < pM);
               }).reduce((sum, m) => sum + m.percentual, 0);
               
               const extIdx = contratosListados.findIndex(cl => cl.id === cObj.id);
               if (extIdx === -1) contratosListados.push({ id: cObj.id, codigo: cObj.codigo, nome: cObj.nome, orcado: orcadoPerc, gasto: gastoPerc, ilimitado: false, isFechado: true });
               else {
                  contratosListados[extIdx].orcado += orcadoPerc;
                  contratosListados[extIdx].gasto += gastoPerc;
                  contratosListados[extIdx].isFechado = true;
               }
           } else {
               let orcadoH = 0;
               if (isSuportes) orcadoH = gastoH;
               else {
                  if (isPast) orcadoH = gastoH;
                  else orcadoH = aOs.reduce((sum, a) => sum + Number(a.horas_disponiveis), 0);
               }

               if (orcadoH > 0 || gastoH > 0) {
                  orcadoTotal += orcadoH; gastoTotal += gastoH; // Adiciona apenas HORAS na sumário global
                  const extIdx = contratosListados.findIndex(cl => cl.id === cObj.id);
                  if (extIdx === -1) contratosListados.push({ id: cObj.id, codigo: cObj.codigo, nome: cObj.nome, orcado: orcadoH, gasto: gastoH, ilimitado: isSuportes });
                  else {
                     contratosListados[extIdx].orcado += orcadoH;
                     contratosListados[extIdx].gasto += gastoH;
                     if(isSuportes) contratosListados[extIdx].ilimitado = true;
                  }
               }
           }
        });
     });

     const saldoTotal = orcadoTotal - gastoTotal;
     const percGasto = orcadoTotal > 0 ? (gastoTotal / orcadoTotal) * 100 : 0;
     const pieData: Array<{name: string, value: number}> = [{name: 'Gasto', value: gastoTotal}, {name: 'Saldo', value: Math.max(0, saldoTotal)}].filter(d=>d.value>0);
     if (pieData.length===0) pieData.push({name:'Zerado', value:1});

     return { nome: consObj.nome, iniciais: consObj.nome.substring(0,2).toUpperCase(), meta: consObj.horas_minimas_mes, orcadoTotal, gastoTotal, saldoTotal: Math.max(0, saldoTotal), percGasto, pieData, contratosListados }
  }, [resConsId, resConsMes, resConsAno, allAlocacoes, allTimesheets, contratos, osList, consultores, modoDataFiltro, dataInicioCustom, dataFimCustom]);

  const fatContratosVisao = contratos.filter(c => c.status_ativo && fatVisaoTipos.includes(c.tipo) && (fatFonte === 'todas' ? true : c.fonte_pagamento === fatFonte))
  
  const fatData = useMemo(() => {
    let fTimes = allTimesheets.filter(t => fatContratosVisao.some(cv => cv.id === t.contract_id))
    if (fatContratosSelecionados.length > 0) fTimes = fTimes.filter(t => fatContratosSelecionados.includes(t.contract_id))

    const consultoresPagamento: Array<{id: string, nome: string, nomeCurto: string, valorGrafico: number}> = consultores.map(c => {
      const logs = fTimes.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, fatMes, fatAno, contratos.find(con => con.id === t.contract_id)?.ciclo_fat_inicio || 1, contratos.find(con => con.id === t.contract_id)?.ciclo_fat_fim || 31))
      const valorGrafico = logs.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
      return { id: c.id, nome: c.nome, nomeCurto: c.nome.split(' ')[0], valorGrafico: Number(valorGrafico.toFixed(2)) }
    }).filter(c => c.valorGrafico > 0).sort((a,b) => b.valorGrafico - a.valorGrafico)

    return { consultoresPagamento }
  }, [allTimesheets, fatMes, fatAno, fatContratosSelecionados, consultores, fatVisaoTipos, fatContratosVisao, contratos])

  const radarAlertas = useMemo(() => {
    const ociosos: Array<{id: string, nome: string, trabalhadas: string, meta: number, percentual: string}> = []; 
    const estouradosConsultor: Array<{nome: string, orcado: number, consumido: string, perc: string}> = [];
    const estouradosContrato: Array<{codigo: string, orcado: number, consumido: string, perc: string}> = [];
    const estouradosAssessoria: Array<{codigo: string, orcado: number, consumido: string, perc: string}> = [];
    const estouradosOS: Array<{contrato: string, os: string, orcado: number, consumido: string, perc: string}> = [];
    
    const now = new Date(); const currentDay = now.getDate(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    let startDt, endDt;
    if (25 > 24) { 
      if (currentDay >= 25) { startDt = new Date(currentYear, currentMonth, 25, 0, 0, 0); endDt = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, 24, 23, 59, 59); } 
      else { startDt = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, 25, 0, 0, 0); endDt = new Date(currentYear, currentMonth, 24, 23, 59, 59); }
    } else { startDt = new Date(currentYear, currentMonth, 25, 0, 0, 0); endDt = new Date(currentYear, currentMonth, 24, 23, 59, 59); }

    const meioDoCicloMs = startDt.getTime() + (endDt.getTime() - startDt.getTime()) / 2;
    const jaPassouDaMetade = Date.now() >= meioDoCicloMs;

    const refMonth = currentDay >= 25 ? (currentMonth === 11 ? 0 : currentMonth + 1) : currentMonth;
    const refYear = currentDay >= 25 && currentMonth === 11 ? currentYear + 1 : currentYear;

    // 1. Alertas de Consultores (Ociosidade e Estouro de Saldo Mensal)
    consultores.forEach(c => {
      const tsMes = allTimesheets.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, refMonth.toString(), refYear.toString(), 25, 24));
      const horasTrabalhadas = tsMes.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0);
      
      if (c.horas_minimas_mes > 0) {
        const percentual = (horasTrabalhadas / c.horas_minimas_mes) * 100;
        if (percentual < 30 && jaPassouDaMetade) ociosos.push({ id: c.id, nome: c.nome, trabalhadas: horasTrabalhadas.toFixed(1), meta: c.horas_minimas_mes, percentual: percentual.toFixed(1) })
      }
      
      const alocMesAtual = allAlocacoes.filter(a => a.user_id === c.id && a.mes === refMonth.toString() && a.ano === refYear.toString() && a.atividade !== 'Preço Fechado (Medição)');
      const orcadoMensalTotal = alocMesAtual.reduce((sum, a) => sum + a.horas_disponiveis, 0);
      if (orcadoMensalTotal > 0) {
         const percGasto = (horasTrabalhadas / orcadoMensalTotal) * 100;
         if (percGasto >= 70) estouradosConsultor.push({ nome: c.nome, orcado: orcadoMensalTotal, consumido: horasTrabalhadas.toFixed(1), perc: percGasto.toFixed(1) });
      }
    });

    // 2. Alertas de Contratos (Horas e Assessoria) e OS
    contratos.filter(c => c.status_ativo).forEach(cont => {
      if (cont.tipo === 'fechado' || cont.tipo === 'overhead') return; // Ignora esses dois

      const tsContrato = allTimesheets.filter(t => t.contract_id === cont.id);
      
      if (cont.tipo === 'horas') {
         // Contrato de Horas usa o somatório da Linha de Base como teto
         let tetoContrato = 0;
         const { data: bases } = supabase.from('linha_base').select('id').eq('contract_id', cont.id).order('versao', { ascending: false }).limit(1) as any;
         // Simulando a leitura rápida (na vida real você faz um join, mas podemos inferir das alocações globais se não bater no banco aqui)
         // Para simplificar no Frontend sem await no useMemo, usamos o teto_global_horas se existir, ou ignoramos se for 0.
         // (Seu contrato de horas não tem mais teto global nativo, então ele alerta pelo somatório do mês)
      }

      if (cont.tipo === 'continuado_com_os') {
         const tsAssessoria = tsContrato.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
         if (cont.teto_global_horas > 0) {
            const percAsses = (tsAssessoria / cont.teto_global_horas) * 100;
            if (percAsses >= 70) estouradosAssessoria.push({ codigo: cont.codigo, orcado: cont.teto_global_horas, consumido: tsAssessoria.toFixed(1), perc: percAsses.toFixed(1) });
         }

         // Varre as OSs
         const osDoContrato = osList.filter(o => o.contract_id === cont.id && o.codigo !== '🛠️ Pequenos Suportes');
         osDoContrato.forEach(os => {
            const tsOs = tsContrato.filter(t => t.os_id === os.id).reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
            // Pega o teto da matriz da OS (somando as horas teto das alocacoes da vida toda dessa OS)
            const alocsOS = allAlocacoes.filter(a => a.os_id === os.id && a.atividade !== 'Preço Fechado (Medição)');
            // Usa o max por consultor para achar o teto (aproximação rapida do frontend)
            const mapTeto = new Map();
            alocsOS.forEach(a => { if(!mapTeto.has(a.user_id) || mapTeto.get(a.user_id) < a.horas_disponiveis) mapTeto.set(a.user_id, a.horas_disponiveis) });
            const orcadoOS = Array.from(mapTeto.values()).reduce((sum, v) => sum + v, 0);
            
            if (orcadoOS > 0) {
               const percOs = (tsOs / orcadoOS) * 100;
               if (percOs >= 70) estouradosOS.push({ contrato: cont.codigo, os: os.codigo, orcado: orcadoOS, consumido: tsOs.toFixed(1), perc: percOs.toFixed(1) });
            }
         });
      }
    });
    
    return { ociosos, estouradosConsultor, estouradosAssessoria, estouradosOS, jaPassouDaMetade };
  }, [consultores, contratos, allTimesheets, allAlocacoes, osList]);

  const exportarMatrizConsolidada = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Matriz Consolidada');

    const consultoresAtivos = consultores.filter(c => c.status_ativo !== false);

    // Linha 1: Mês
    sheet.getCell('A1').value = 'Mês:';
    sheet.getCell('A1').font = { bold: true };
    sheet.getCell('B1').value = `${MESES_NOME[parseInt(dashMes)]}/${dashAno}`;
    
    // Linha 2: Cabeçalhos Mestres
    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = 'CONTRATOS';
    sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A2').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

    consultoresAtivos.forEach((c, i) => {
      const cell = sheet.getCell(2, 5 + i);
      cell.value = c.nome;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    });

    // Linha 3: Sub-cabeçalhos
    sheet.getCell('A3').value = 'Nº do Contrato';
    sheet.getCell('B3').value = 'Descrição do Contrato';
    sheet.getCell('C3').value = 'Contratada Pela';
    sheet.getCell('D3').value = 'OS';
    
    consultoresAtivos.forEach((c, i) => {
      sheet.getCell(3, 5 + i).value = 'Entregue / Medido';
    });

    sheet.getRow(3).font = { bold: true };
    sheet.getColumn('A').width = 15;
    sheet.getColumn('B').width = 35;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 20;
    consultoresAtivos.forEach((_, i) => sheet.getColumn(5 + i).width = 15);

    // Preenchimento dos Dados
    contratosVisao.forEach(cont => {
       const osDoContrato = osList.filter(o => o.contract_id === cont.id);
       
       if (osDoContrato.length > 0) {
          osDoContrato.forEach(os => {
             const rowValues = [cont.codigo, cont.nome, cont.fonte_pagamento, os.codigo];
             consultoresAtivos.forEach(cons => {
                const cb = getCycleBoundsForContract(cont.ciclo_inicio, cont.ciclo_fim, dashMes, dashAno);
                const tAtiv = allTimesheets.filter(t => t.user_id === cons.id && t.contract_id === cont.id && t.os_id === os.id && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
                const gasto = tAtiv.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                
                const isFechado = allAlocacoes.some(a => a.user_id === cons.id && a.contract_id === cont.id && a.mes === dashMes && a.ano === dashAno && a.atividade === 'Preço Fechado (Medição)');
                if (isFechado) {
                   const med = allMedicoes.find(m => m.user_id === cons.id && m.contract_id === cont.id && m.mes === dashMes && m.ano === dashAno);
                   rowValues.push((med?.percentual || 0) + '%');
                } else {
                   rowValues.push(gasto > 0 ? gasto.toFixed(1) + 'h' : '-');
                }
             });
             sheet.addRow(rowValues);
          });
       } else {
          const rowValues = [cont.codigo, cont.nome, cont.fonte_pagamento, '-'];
          consultoresAtivos.forEach(cons => {
             const cb = getCycleBoundsForContract(cont.ciclo_inicio, cont.ciclo_fim, dashMes, dashAno);
             const tAtiv = allTimesheets.filter(t => t.user_id === cons.id && t.contract_id === cont.id && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
             const gasto = tAtiv.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
             
             const isFechado = allAlocacoes.some(a => a.user_id === cons.id && a.contract_id === cont.id && a.mes === dashMes && a.ano === dashAno && a.atividade === 'Preço Fechado (Medição)');
             if (isFechado) {
                const med = allMedicoes.find(m => m.user_id === cons.id && m.contract_id === cont.id && m.mes === dashMes && m.ano === dashAno);
                rowValues.push((med?.percentual || 0) + '%');
             } else {
                rowValues.push(gasto > 0 ? gasto.toFixed(1) + 'h' : '-');
             }
          });
          sheet.addRow(rowValues);
       }
    });

    // Centralizar as células de dados
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 3) {
         row.alignment = { vertical: 'middle', horizontal: 'center' };
         row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; // Descrição fica à esquerda
      }
      row.eachCell((cell) => {
         cell.border = { top: {style:'thin', color: {argb:'FFE2E8F0'}}, left: {style:'thin', color: {argb:'FFE2E8F0'}}, bottom: {style:'thin', color: {argb:'FFE2E8F0'}}, right: {style:'thin', color: {argb:'FFE2E8F0'}} };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Matriz_Consolidada_${MESES_NOME[parseInt(dashMes)]}_${dashAno}.xlsx`);
  };

  const exportarMatrizGestao = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Matriz Executiva');

    const consultoresAtivos = consultores.filter(c => c.status_ativo !== false);

    // Linha 1: Mês
    sheet.getCell('A1').value = 'Mês:';
    sheet.getCell('A1').font = { bold: true };
    sheet.getCell('B1').value = `${MESES_NOME[parseInt(dashMes)]}/${dashAno}`;
    
    // Linha 2: Cabeçalhos Mestres (Mesclando 3 colunas por consultor)
    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = 'CONTRATOS';
    sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A2').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };

    consultoresAtivos.forEach((c, i) => {
      const startCol = 5 + (i * 3); // Calcula as colunas dinamicamente (E, H, K...)
      sheet.mergeCells(2, startCol, 2, startCol + 2);
      const cell = sheet.getCell(2, startCol);
      cell.value = c.nome;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    });

    // Linha 3: Sub-cabeçalhos
    sheet.getCell('A3').value = 'Nº do Contrato';
    sheet.getCell('B3').value = 'Descrição do Contrato';
    sheet.getCell('C3').value = 'Contratada Pela';
    sheet.getCell('D3').value = 'OS';
    
    consultoresAtivos.forEach((c, i) => {
      const startCol = 5 + (i * 3);
      sheet.getCell(3, startCol).value = 'Previsto';
      sheet.getCell(3, startCol + 1).value = 'Medido / Entregue';
      sheet.getCell(3, startCol + 2).value = 'Saldo';
    });

    sheet.getRow(3).font = { bold: true };
    sheet.getColumn('A').width = 15;
    sheet.getColumn('B').width = 35;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 20;
    
    consultoresAtivos.forEach((_, i) => {
       const startCol = 5 + (i * 3);
       sheet.getColumn(startCol).width = 12;
       sheet.getColumn(startCol + 1).width = 18;
       sheet.getColumn(startCol + 2).width = 12;
    });

    const processarLinhaConsultores = (cont: Contrato, os: OrdemServico | null, rowValues: any[]) => {
      consultoresAtivos.forEach(cons => {
         const cb = getCycleBoundsForContract(cont.ciclo_inicio, cont.ciclo_fim, dashMes, dashAno);
         const isFechado = allAlocacoes.some(a => a.user_id === cons.id && a.contract_id === cont.id && a.mes === dashMes && a.ano === dashAno && a.atividade === 'Preço Fechado (Medição)') || cont.tipo === 'fechado';
         const isSuportes = os?.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'overhead'].includes(cont.tipo);

         if (isFechado) {
            const pM = parseInt(dashMes); 
            const pA = parseInt(dashAno);
            
            // Previsto: O que está medindo AGORA neste mês
            const previsto = allMedicoes.find(m => m.user_id === cons.id && m.contract_id === cont.id && (os ? m.os_id === os.id : true) && m.mes === dashMes && m.ano === dashAno)?.percentual || 0;
            
            // Medido: O que foi medido no PASSADO
            const medidoHistorico = allMedicoes.filter(m => {
                if (m.user_id !== cons.id || m.contract_id !== cont.id) return false;
                if (os && m.os_id !== os.id) return false;
                const mA = parseInt(m.ano); const mM = parseInt(m.mes);
                return mA < pA || (mA === pA && mM < pM);
            }).reduce((sum, m) => sum + m.percentual, 0);
            
            const saldo = 100 - previsto - medidoHistorico;

            if (previsto > 0 || medidoHistorico > 0) {
               rowValues.push(`${previsto}%`, `${medidoHistorico}%`, `${saldo}%`);
            } else {
               rowValues.push('-', '-', '-');
            }
         } else {
            // Lógica para Contratos em Horas
            const tAtiv = allTimesheets.filter(t => t.user_id === cons.id && t.contract_id === cont.id && (os ? t.os_id === os.id : true) && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
            const gasto = tAtiv.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
            
            const aloc = allAlocacoes.filter(a => a.user_id === cons.id && a.contract_id === cont.id && (os ? a.os_id === os.id : true) && a.mes === dashMes && a.ano === dashAno);
            const previsto = aloc.reduce((sum, a) => sum + Number(a.horas_disponiveis), 0);

            if (isSuportes) {
               if (gasto > 0) rowValues.push(`${gasto.toFixed(1)}h`, `${gasto.toFixed(1)}h`, `0.0h`);
               else rowValues.push('-', '-', '-');
            } else {
               if (previsto > 0 || gasto > 0) {
                 const saldo = previsto - gasto;
                 rowValues.push(
                    previsto > 0 ? `${previsto.toFixed(1)}h` : '-',
                    gasto > 0 ? `${gasto.toFixed(1)}h` : '-',
                    `${saldo.toFixed(1)}h`
                 );
               } else {
                 rowValues.push('-', '-', '-');
               }
            }
         }
      });
    };

    contratosVisao.forEach(cont => {
       const osDoContrato = osList.filter(o => o.contract_id === cont.id);
       if (osDoContrato.length > 0) {
          osDoContrato.forEach(os => {
             const rowValues: any[] = [cont.codigo, cont.nome, cont.fonte_pagamento, os.codigo];
             processarLinhaConsultores(cont, os, rowValues);
             sheet.addRow(rowValues);
          });
       } else {
          const rowValues: any[] = [cont.codigo, cont.nome, cont.fonte_pagamento, '-'];
          processarLinhaConsultores(cont, null, rowValues);
          sheet.addRow(rowValues);
       }
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 3) {
         row.alignment = { vertical: 'middle', horizontal: 'center' };
         row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; 
      }
      row.eachCell((cell) => {
         cell.border = { top: {style:'thin', color: {argb:'FFE2E8F0'}}, left: {style:'thin', color: {argb:'FFE2E8F0'}}, bottom: {style:'thin', color: {argb:'FFE2E8F0'}}, right: {style:'thin', color: {argb:'FFE2E8F0'}} };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Matriz_Executiva_Painel_${MESES_NOME[parseInt(dashMes)]}_${dashAno}.xlsx`);
  };

  const exportarExcel = async (isFaturamento: boolean = false) => {
    let registros = allTimesheets.filter(t => {
      const cont = contratos.find(c => c.id === t.contract_id);
      if (!cont || !(isFaturamento ? fatVisaoTipos : dashVisaoTipos).includes(cont.tipo)) return false;
      if (isFaturamento) return isWithinCycle(t.start_at, fatMes, fatAno, cont.ciclo_fat_inicio, cont.ciclo_fat_fim);
      return isWithinCycle(t.start_at, dashMes, dashAno, cont.ciclo_inicio, cont.ciclo_fim);
    });
    
    if (isFaturamento) {
      if (fatContratosSelecionados.length > 0) registros = registros.filter(t => fatContratosSelecionados.includes(t.contract_id))
    } else {
      if (dashContratosSelecionados.length > 0) registros = registros.filter(t => dashContratosSelecionados.includes(t.contract_id))
      if (dashConsultor !== 'todos') registros = registros.filter(t => t.user_id === dashConsultor)
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(isFaturamento ? 'Faturamento' : 'Pagamento');

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
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isFaturamento ? 'FFD97706' : 'FF3B82F6' } };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    registros.forEach(t => {
      const consultor = consultores.find(c => c.id === t.user_id)?.nome || 'Desconhecido'; 
      const contrato = contratos.find(c => c.id === t.contract_id);
      const osObj = osList.find(o => o.id === t.os_id);
      const os = osObj ? (osObj.descricao ? `${osObj.codigo} - ${osObj.descricao}` : osObj.codigo) : '-';
      const inicio = new Date(t.start_at); 
      const fim = new Date(t.end_at!);

      sheet.addRow({
        consultor: consultor,
        data: inicio.toLocaleDateString('pt-BR'),
        cod_contrato: contrato?.codigo || '-',
        nome_contrato: contrato?.nome || '-',
        os: os,
        atividade: t.activity,
        inicio: inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fim: fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        obs: t.notes || ''
      });
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; }
      row.eachCell((cell) => {
         cell.border = {
            top: {style:'thin', color: {argb:'FFE2E8F0'}}, left: {style:'thin', color: {argb:'FFE2E8F0'}},
            bottom: {style:'thin', color: {argb:'FFE2E8F0'}}, right: {style:'thin', color: {argb:'FFE2E8F0'}}
         };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Engeprice_${isFaturamento ? 'Faturamento' : 'Pagamento'}_${MESES_NOME[parseInt(isFaturamento ? fatMes : dashMes)]}_${isFaturamento ? fatAno : dashAno}.xlsx`);
  };

  const MAPEAMENTO_TIPOS: Record<string, string> = {
    horas: "Escopo Fechado (Horas)", continuado_com_os: "Assessoria / Sob Demanda", overhead: "Overhead"
  };

  const renderFiltroTiposContratoMultiplos = (isFat: boolean = false) => {
    const values = isFat ? fatVisaoTipos : dashVisaoTipos;
    const setter = isFat ? setFatVisaoTipos : setDashVisaoTipos;
    const clearContratos = isFat ? setFatContratosSelecionados : setDashContratosSelecionados;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-64 justify-start font-normal bg-background h-8 text-xs border-primary truncate overflow-hidden">
            {values.length === 0 ? "Nenhum Tipo Selecionado" : `${values.length} Tipo(s) de Contrato`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 bg-card border shadow-md" align="start">
          <div className="space-y-2 max-h-65 overflow-y-auto pr-1">
            {Object.entries(MAPEAMENTO_TIPOS).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2 py-1">
                <Checkbox id={`chk-${isFat?'fat':'dash'}-${key}`} checked={values.includes(key)} onCheckedChange={(checked) => { 
                  if (checked) { setter(prev => [...prev, key]); clearContratos([]); } else { setter(prev => prev.filter(id => id !== key)); clearContratos([]); }
                }} />
                <Label htmlFor={`chk-${isFat?'fat':'dash'}-${key}`} className="cursor-pointer text-sm leading-tight flex-1">{label}</Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const renderFiltroContratosMultiplos = (isFat: boolean = false) => {
    const values = isFat ? fatContratosSelecionados : dashContratosSelecionados;
    const setter = isFat ? setFatContratosSelecionados : setDashContratosSelecionados;
    const visao = isFat ? fatContratosVisao : contratosVisao;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start font-normal bg-background h-9 border-input truncate overflow-hidden text-xs">
            {values.length === 0 ? "Todos os Contratos" : `${values.length} Contrato(s) selecionado(s)`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2 bg-card border shadow-md" align="start">
          <div className="space-y-3 max-h-75 overflow-y-auto pr-1">
            <div className="flex items-center space-x-2 pb-3 border-b"><Checkbox id={`chk-tds-${isFat}`} checked={values.length === 0} onCheckedChange={(c) => { if (c) setter([]) }} /><Label htmlFor={`chk-tds-${isFat}`} className="font-bold cursor-pointer text-sm">Selecionar Todos</Label></div>
            {visao.map(c => (
              <div key={c.id} className="flex items-center space-x-2 py-1">
                <Checkbox id={`chk-c-${isFat}-${c.id}`} checked={values.includes(c.id)} onCheckedChange={(checked) => { if (checked) setter(prev => [...prev, c.id]); else setter(prev => prev.filter(id => id !== c.id)) }} />
                <Label htmlFor={`chk-c-${isFat}-${c.id}`} className="cursor-pointer text-sm leading-tight flex-1"><span className="font-semibold text-primary">{c.codigo}</span> - {c.nome}</Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  // Estado que controla se a barra lateral do Admin está aberta ou fechada
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(true);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="flex h-full w-full overflow-hidden bg-transparent">
      
      {/* 🧭 SIDEBAR LATERAL PROFISSIONAL RETRÁTIL */}
      <aside className={`bg-card border-r flex flex-col shrink-0 h-full transition-all duration-300 ${isAdminSidebarOpen ? 'w-64' : 'w-18'}`}>
        
        {/* CABEÇALHO DO MENU */}
        <div className="p-4 border-b flex items-center justify-between gap-2 bg-primary/5 shrink-0 h-18">
          <div className={`flex items-center gap-3 overflow-hidden ${!isAdminSidebarOpen ? 'hidden' : ''}`}>
             <Building2 className="w-6 h-6 text-primary shrink-0" />
             <div className="min-w-0">
                <h2 className="font-bold text-sm tracking-tight leading-none truncate">Engeprice</h2>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">Management ERP</p>
             </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary mx-auto" onClick={() => setIsAdminSidebarOpen(!isAdminSidebarOpen)}>
             {isAdminSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* ITENS DO MENU */}
        <nav className={`p-4 flex-1 space-y-6 overflow-y-auto min-h-0 overflow-x-hidden scrollbar-none ${!isAdminSidebarOpen ? 'px-2' : ''}`}>
          <div>
            {isAdminSidebarOpen ? <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Engenharia</p> : <div className="h-px bg-border w-full my-2"></div>}
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('contratos')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'contratos' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Contratos de Clientes" : ""}><Briefcase className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Contratos de Clientes</span>}</button>
              <button onClick={() => setMenuAtivo('os')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'os' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Ordens de Serviço (OS)" : ""}><FolderTree className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Ordens de Serviço</span>}</button>
              <button onClick={() => setMenuAtivo('equipe')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'equipe' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Equipe & Acessos" : ""}><Users className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Equipe & Acessos</span>}</button>
            </div>
          </div>
          <div>
            {isAdminSidebarOpen ? <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Lançamentos</p> : <div className="h-px bg-border w-full my-2"></div>}
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('alocacoes')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'alocacoes' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Alocação & Linha Base" : ""}><Clock className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Alocação & Base</span>}</button>
              <button onClick={() => setMenuAtivo('gestao')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'gestao' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Ajustes de Horas (Admin)" : ""}><History className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Ajustes de Horas</span>}</button>
            </div>
          </div>
          <div>
            {isAdminSidebarOpen ? <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Indicadores</p> : <div className="h-px bg-border w-full my-2"></div>}
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('resumo-consultor')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'resumo-consultor' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Painel por Consultor" : ""}><Contact2 className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Painel Consultor</span>}</button>
              <button onClick={() => setMenuAtivo('dash-global')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'dash-global' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Painel dos Contratos" : ""}><Layers className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Painel Contratos</span>}</button>
            </div>
          </div>
          <div>
            {isAdminSidebarOpen ? <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Financeiro</p> : <div className="h-px bg-border w-full my-2"></div>}
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('dash-mensal')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'dash-mensal' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Folha (Mensal)" : ""}><CalendarDays className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Folha (Mensal)</span>}</button>
              <button onClick={() => setMenuAtivo('faturamento-cliente')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'faturamento-cliente' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`} title={!isAdminSidebarOpen ? "Extração p/ Clientes" : ""}><Receipt className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Exportar Clientes</span>}</button>
            </div>
          </div>
          <div>
            {isAdminSidebarOpen ? <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Alertas</p> : <div className="h-px bg-border w-full my-2"></div>}
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('alertas')} className={`w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center transition-colors bg-red-500/5 ${!isAdminSidebarOpen ? 'justify-center' : 'gap-2.5 text-left'} ${menuAtivo === 'alertas' ? 'bg-red-500! text-white' : 'text-red-600 hover:bg-red-500/10'}`} title={!isAdminSidebarOpen ? "Radar de Alertas" : ""}><AlertTriangle className="w-4 h-4 shrink-0"/> {isAdminSidebarOpen && <span className="truncate">Radar de Alertas</span>}</button>
            </div>
          </div>
        </nav>
        
        {/* RODAPÉ DO MENU */}
        <div className={`p-4 border-t flex items-center bg-muted/40 shrink-0 ${!isAdminSidebarOpen ? 'justify-center flex-col gap-3' : 'justify-between'}`}>
          <div className="flex items-center gap-2 bg-primary/10 p-1.5 px-3 rounded-xl border border-primary/20 shrink-0">
            <UserCog className="w-4 h-4 text-primary animate-pulse shrink-0" />
            {isAdminSidebarOpen && <span className="text-[11px] font-black text-primary uppercase tracking-wider">Admin</span>}
          </div>

          <div className={`flex items-center gap-1.5 ${!isAdminSidebarOpen ? 'flex-col' : ''}`}>
            <Button size="icon" variant="outline" onClick={() => { toast.info("Atualizando painel administrativo..."); setTimeout(() => window.location.reload(), 300); }} title="Atualizar Aplicativo (Ctrl + Shift + R)" className="w-8 h-8 rounded-full shadow-sm bg-background hover:bg-primary/10 hover:text-primary shrink-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full w-8 h-8 shrink-0">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* 🌟 BLINDAGEM SPRINT 4: Padding responsivo (p-4 sm:p-6 md:p-8 lg:p-10) para não espremer em telas menores/zoom */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto overflow-x-hidden h-full relative w-full max-w-none">
        
        {/* VIEW: CONTRATOS */}
        {menuAtivo === 'contratos' && (
          <Card className="w-full">
            <CardHeader><CardTitle>Gestão Estratégica de Contratos</CardTitle><CardDescription>Classifique os contratos e configure os ciclos de faturamento do cliente e pagamento do consultor.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end bg-muted/30 p-5 rounded-xl border">
                <div className="space-y-2"><Label>Código</Label><Input placeholder="CT-001" className="uppercase" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Nome do Cliente / Contrato</Label><Input placeholder="Ex: Tractebel - Angra" value={novoNomeContrato} onChange={(e) => setNovoNomeContrato(e.target.value)} /></div>
                <div className="space-y-2"><Label>Tipo Comercial</Label>
                  <Select value={novoTipo} onValueChange={setNovoTipo}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horas">Escopo Fechado (Por Horas)</SelectItem>
                      <SelectItem value="continuado_com_os">Assessoria / Sob Demanda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2"><Label>Fonte de Faturamento</Label>
                  <Select value={novaFonte} onValueChange={setNovaFonte}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="EC">EC (Consulting)</SelectItem><SelectItem value="ET">ET (Treinamentos)</SelectItem></SelectContent>
                  </Select>
                </div>

                {novoTipo === 'continuado_com_os' && (
                  <div className="space-y-2"><Label>Teto Global da Assessoria (h)</Label><Input type="number" placeholder="Ex: 500" value={novoTetoGlobal || ''} onChange={e => setNovoTetoGlobal(Number(e.target.value))} /></div>
                )}

                <div className="space-y-2 col-span-2 md:col-span-1 border p-2.5 rounded-lg bg-background/50">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pagamento (Equipe)</Label>
                  <div className="flex gap-2 mt-1"><div className="relative flex-1"><Input type="number" min={1} max={31} value={novoInicio} onChange={(e) => setNovoInicio(Number(e.target.value))} className="pl-7" /><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">De</span></div><div className="relative flex-1"><Input type="number" min={1} max={31} value={novoFim} onChange={(e) => setNovoFim(Number(e.target.value))} className="pl-7" /><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Até</span></div></div>
                </div>

                <div className="space-y-2 col-span-2 md:col-span-1 border p-2.5 rounded-lg bg-background/50 border-amber-500/30">
                  <Label className="text-[10px] uppercase font-bold text-amber-700">Faturamento (Cliente)</Label>
                  <div className="flex gap-2 mt-1"><div className="relative flex-1"><Input type="number" min={1} max={31} value={novoFatInicio} onChange={(e) => setNovoFatInicio(Number(e.target.value))} className="pl-7 border-amber-500/30" /><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">De</span></div><div className="relative flex-1"><Input type="number" min={1} max={31} value={novoFatFim} onChange={(e) => setNovoFatFim(Number(e.target.value))} className="pl-7 border-amber-500/30" /><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Até</span></div></div>
                </div>

                <div className="md:col-span-4 flex justify-end pt-2">
                  <Button className="gap-2 shadow-md w-full md:w-auto" onClick={criarNovoContrato}><PlusCircle className="w-4 h-4" /> Cadastrar Contrato</Button>
                </div>
              </div>

              <div className="border rounded-xl divide-y max-h-125 overflow-y-auto bg-card shadow-sm w-full">
                {contratos.filter(c => c.tipo !== 'overhead').map(c => (
                  <div key={c.id} className="p-4 flex flex-wrap gap-4 justify-between items-center hover:bg-muted/20">
                    {editandoId === c.id ? (
                      <div className="flex flex-1 flex-wrap gap-3 items-center bg-muted/40 p-3 rounded-lg border w-full">
                        <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-3 mb-2">
                          <Input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} className="uppercase" />
                          <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                          <Select value={editTipo} onValueChange={editTipo => setEditTipo(editTipo)}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="horas">Escopo Fechado (Por Horas)</SelectItem>
                              <SelectItem value="continuado_com_os">Assessoria / Sob Demanda</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={editFonte} onValueChange={editFonte => setEditFonte(editFonte)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EC">EC</SelectItem><SelectItem value="ET">ET</SelectItem></SelectContent></Select>
                        </div>
                        <div className="w-full flex flex-wrap gap-4 items-end justify-between">
                          {editTipo === 'continuado_com_os' ? (
                            <div className="space-y-1"><Label className="text-[10px]">Teto Global (h)</Label><Input type="number" value={editTetoGlobal} onChange={(e) => setEditTetoGlobal(Number(e.target.value))} className="w-20" /></div>
                          ) : <div className="w-20"></div>}
                          <div className="space-y-1"><Label className="text-[10px]">Pgto (Ini/Fim)</Label><div className="flex gap-1"><Input type="number" value={editInicio} onChange={(e) => setEditInicio(Number(e.target.value))} className="w-14" /><Input type="number" value={editFim} onChange={(e) => setEditFim(Number(e.target.value))} className="w-14" /></div></div>
                          <div className="space-y-1"><Label className="text-[10px] text-amber-700">Fat. (Ini/Fim)</Label><div className="flex gap-1"><Input type="number" value={editFatInicio} onChange={(e) => setEditFatInicio(Number(e.target.value))} className="w-14 border-amber-500/30" /><Input type="number" value={editFatFim} onChange={(e) => setEditFatFim(Number(e.target.value))} className="w-14 border-amber-500/30" /></div></div>
                          <div className="flex gap-2 border p-2 rounded-md bg-background h-9 items-center"><Switch id={`st-${c.id}`} checked={editStatus} onCheckedChange={setEditStatus} /><Label htmlFor={`st-${c.id}`}>{editStatus ? 'Ativo' : 'Inativo'}</Label></div>
                          <div className="flex gap-2"><Button size="icon" variant="outline" className="text-green-600 border-green-200" onClick={() => salvarEdicaoContrato(c.id)}><Check className="w-4 h-4" /></Button><Button size="icon" variant="ghost" onClick={() => setEditandoId(null)}><X className="w-4 h-4" /></Button></div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4 flex-1">
                          <Briefcase className="text-primary w-5 h-5 shrink-0" />
                          <div>
                            <p className="font-bold text-foreground text-sm flex items-center gap-2">
                              {c.codigo} - {c.nome}
                              <span className="text-[10px] font-black tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border">{c.fonte_pagamento}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Modalidade: {c.tipo.replace(/_/g, ' ').toUpperCase()}</p>
                            {c.teto_global_horas > 0 && <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 mt-1 border-none font-mono">Teto Vida Útil: {c.teto_global_horas}h</Badge>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-[10px] text-muted-foreground"><span className="font-bold">Pgto:</span> {c.ciclo_inicio} a {c.ciclo_fim} | <span className="font-bold text-amber-700">Fat:</span> {c.ciclo_fat_inicio} a {c.ciclo_fat_fim}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {c.status_ativo ? <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/5">Ativo</Badge> : <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5">Inativo</Badge>}
                            <Button variant="outline" size="sm" onClick={() => { iniciarEdicao(c) }} className="gap-1.5 h-8 ml-2"><Pencil className="w-3.5 h-3.5" /> Editar</Button>
                            <Button variant="ghost" size="icon" onClick={() => excluirContrato(c.id, c.nome)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* VIEW: ORDENS DE SERVIÇO */}
        {menuAtivo === 'os' && (
          <Card className="border-t-4 border-t-amber-500 w-full">
            <CardHeader><CardTitle>Central de Ordens de Serviço (OS)</CardTitle><CardDescription>Distribua os subcontratos e limites de horas dos Contratos Sob Demanda.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4 items-end bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
                <div className="space-y-2 flex-1 min-w-62.5"><Label>Contrato Mestre (Sob Demanda)</Label>
                  <Select value={osContratoId} onValueChange={setOsContratoId}>
                    <SelectTrigger className="bg-background border-amber-500/30"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{contratos.filter(c => c.tipo === 'continuado_com_os' && c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-32"><Label>Código OS</Label><Input placeholder="OS-001" value={osCodigo} onChange={e => setOsCodigo(e.target.value)} className="uppercase" /></div>
                <div className="space-y-2 flex-1"><Label>Escopo / Descrição</Label><Input placeholder="Projeto X..." value={osDescricao} onChange={e => setOsDescricao(e.target.value)} /></div>
                <Button onClick={criarOS} className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"><FolderTree className="w-4 h-4 mr-2"/> Vincular OS</Button>
              </div>

              <div className="border rounded-xl divide-y bg-card shadow-sm w-full">
                {osList.filter(o => o.contract_id === osContratoId).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Selecione um Contrato Mestre acima para visualizar suas Ordens de Serviço ativas.</div>
                ) : osList.filter(o => o.contract_id === osContratoId).map(os => (
                  <div key={os.id} className="p-4 flex flex-wrap justify-between items-center hover:bg-muted/10">
                    {osEditandoId === os.id ? (
                      <div className="flex flex-1 gap-3 items-center w-full">
                        <Input value={editOsCodigo} onChange={e => setEditOsCodigo(e.target.value)} className="w-24 uppercase font-bold" />
                        <Input value={editOsDescricao} onChange={e => setEditOsDescricao(e.target.value)} className="flex-1" />
                        <Button size="icon" variant="ghost" className="text-green-500" onClick={() => salvarEdicaoOS(os.id)}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setOsEditandoId(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <div><p className="font-bold text-amber-600 text-sm">{os.codigo}</p><p className="text-xs text-muted-foreground mt-0.5">{os.descricao || 'Sem descrição cadastrada'}</p></div>
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-none ml-4 text-[10px] uppercase">
                            {os.codigo === '🛠️ Pequenos Suportes' ? 'Ilimitado' : `Controlado pela Matriz`}
                          </Badge>
                        </div>
                        {os.codigo !== '🛠️ Pequenos Suportes' && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => iniciarEdicaoOS(os)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => apagarOS(os.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 🌟 VIEW: ALOCAÇÃO DE CONSULTORES & LINHA DE BASE */}
        {menuAtivo === 'alocacoes' && (
          <div className="flex flex-col h-full w-full gap-6 min-h-0">
            <div className="shrink-0 bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-sm w-full">
              <div>
                <h2 className="text-2xl font-black text-primary tracking-tight flex items-center gap-2">
                  <Clock className="w-6 h-6" /> Gestão de Alocações
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Defina a matriz estrutural do contrato (Linha de Base) e gerencie a distribuição de horas mensais.
                </p>
              </div>
              
              <div className="flex bg-muted/50 p-1 rounded-lg border shadow-inner">
                <Button 
                  variant={viewAlocacao === 'baseline' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setViewAlocacao('baseline')}
                  className="rounded-md font-bold"
                >
                  <FolderTree className="w-4 h-4 mr-1.5" /> Linha de Base (Matriz)
                </Button>
                <Button 
                  variant={viewAlocacao === 'mensal' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setViewAlocacao('mensal')}
                  className="rounded-md font-bold"
                >
                  <CalendarDays className="w-4 h-4 mr-1.5" /> Distribuição Mensal
                </Button>
              </div>
            </div>

            {/* 🌟 LAYOUT DINÂMICO INTELIGENTE - ALOCAÇÕES */}
            <div className={`w-full flex-1 min-h-0 flex gap-6 items-stretch ${viewAlocacao === 'baseline' ? 'flex-col lg:flex-row' : 'flex-col'}`}>
              
              {/* COLUNA ESQUERDA (Ou Topo na Distribuição) */}
              <div className={`${viewAlocacao === 'baseline' ? 'w-full lg:w-[320px] xl:w-90 shrink flex flex-col gap-4 h-full min-h-0' : 'w-full shrink-0'}`}>
                
                {/* 1. SELETOR DE PROJETO */}
                <Card className={`shadow-sm ${viewAlocacao === 'mensal' ? 'border-primary/20 bg-primary/5' : ''}`}>
                  <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4"/> Projeto Mestre</CardTitle></CardHeader>
                  <CardContent className={viewAlocacao === 'mensal' ? 'flex flex-col md:flex-row items-start md:items-center gap-4' : 'flex flex-col'}>
                    <div className="flex-1 w-full min-w-62.5">
                      <Select value={contratoAtivo} onValueChange={(val) => { setContratoAtivo(val); setAlocacoes({}); setBaseItems({}); }}>
                        <SelectTrigger className={`w-full ${viewAlocacao === 'mensal' ? 'h-10 bg-background' : ''}`}><SelectValue placeholder="Escolha o contrato..." /></SelectTrigger>
                        <SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    
                    {contratoSelecionadoObj?.tipo === 'continuado_com_os' && (
                      <div className={`w-full ${viewAlocacao === 'mensal' ? 'flex-1 min-w-62.5' : 'mt-4'}`}>
                        {viewAlocacao === 'baseline' && <Label className="text-xs font-bold text-amber-700 mb-2 block">Ordem de Serviço (Subnível)</Label>}
                        {osList.filter(o => o.contract_id === contratoAtivo).length === 0 ? (
                           <p className="text-[10px] text-amber-800 font-bold bg-amber-500/20 p-2 rounded">Nenhuma OS cadastrada.</p>
                        ) : (
                          <Select value={alocacaoOsId} onValueChange={setAlocacaoOsId}>
                            <SelectTrigger className={`bg-background border-amber-500/30 ${viewAlocacao === 'mensal' ? 'h-10' : 'text-xs'}`}><SelectValue placeholder="Selecione a OS..."/></SelectTrigger>
                            <SelectContent>
                              {osList.filter(o => o.contract_id === contratoAtivo).map(o => (
                                <SelectItem key={o.id} value={o.id}><span className="font-bold">{o.codigo}</span> {o.descricao ? `- ${o.descricao}` : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {(isSemOsType || isOverheadType) && (
                      <div className={`bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 ${viewAlocacao === 'mensal' ? 'flex-1 min-w-75' : 'mt-4'}`}>
                        <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5"/> {isOverheadType ? 'Overhead (Ilimitado)' : 'Suporte Dinâmico'}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* SÓ MOSTRA NO MODO LINHA DE BASE */}
                {viewAlocacao === 'baseline' && (
                  <>
                    <Card className={`shadow-sm flex flex-col flex-1 min-h-0 ${(!contratoAtivo || (isComOsType && !alocacaoOsId)) ? 'opacity-40 pointer-events-none' : ''}`}>
                      <CardHeader className="pb-3 pt-4 shrink-0">
                         <CardTitle className="text-sm text-foreground flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" /> Adicionar à Matriz
                         </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5 flex-1 overflow-y-auto p-3 bg-muted/10 min-h-0">
                        {consultores.map(user => {
                          const jaAlocado = !!baseItems[user.id];
                          return (
                            <div 
                              key={user.id} 
                              onClick={async () => {
                                 if (!jaAlocado) {
                                    const isDynamic = isSemOsType || isOverheadType;
                                    const targetOsId = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);
                                    addConsultorBase(user.id);
                                    if (isDynamic) {
                                      await supabase.from('alocacoes').insert([{ user_id: user.id, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: 9999, atividade: 'Sem atividade específica', mes: alocMes, ano: alocAno }]);
                                      toast.success(`${user.nome} adicionado à Matriz e alocado no mês atual!`);
                                      carregarAlocacoesMensais(contratoAtivo, targetOsId); 
                                    }
                                 }
                              }} 
                              className={`p-2.5 rounded-lg border text-xs flex justify-between items-center transition-colors ${jaAlocado ? 'bg-background opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary hover:bg-primary/5 bg-card shadow-xs'}`}
                            >
                              <span className="font-semibold">{user.nome}</span><ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>

                    
                  </>
                )}
              </div>
              
              {/* COLUNA DIREITA (Ou Conteúdo Inferior na Distribuição) */}
              <div className="flex-1 w-full h-full min-h-0 flex flex-col">
                
                {/* --- MODO LINHA DE BASE --- */}
                {viewAlocacao === 'baseline' && (
                  <Card className="flex flex-col w-full h-full border-primary/20 shadow-md">
                    <CardHeader className="flex flex-row items-start justify-between border-b pb-4 bg-primary/5 shrink-0">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2 text-primary font-bold">
                           <FolderTree className="w-5 h-5" /> Linha de Base (Matriz do Projeto)
                        </CardTitle>
                        {isComOsType && alocacaoOsId && <CardDescription className="text-amber-700 font-bold mt-1.5 uppercase tracking-wider text-[10px] bg-amber-500/10 inline-block px-2 py-0.5 rounded border border-amber-500/20">OS: {osList.find(o => o.id === alocacaoOsId)?.codigo}</CardDescription>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {baseVersions.length > 0 && (
                          <div className="flex items-center gap-2 bg-background p-1 rounded-lg border shadow-xs">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground pl-2">Versão:</span>
                            <Select value={currentBase?.id} onValueChange={mudarVersaoBase}>
                              <SelectTrigger className="h-7 w-28 text-xs font-mono bg-transparent border-none focus:ring-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {baseVersions.map((b, i) => (
                                  <SelectItem key={b.id} value={b.id}>v{b.versao} {i === 0 ? '(Atual)' : ''}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => { setPaletteTargetUserId('none'); setPaletteOpen(true); }} className="gap-2 h-9 border-primary/40 text-primary hover:bg-primary/10">
                            <FolderTree className="w-4 h-4"/> Gerenciar Atividades
                          </Button>
                          {(contratoAtivo && currentBase?.id === baseVersions[0]?.id) && (
                            <Button onClick={salvarLinhaBase} disabled={salvando} className="gap-2 h-9 shadow-sm bg-primary text-white"><Save className="w-4 h-4" /> Salvar Matriz</Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto w-full bg-muted/10 flex-1 min-h-0">
                      <div className="p-6 space-y-5">
                        {carregandoAlocacoes ? (
                          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : Object.values(baseItems).length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 border-2 border-dashed rounded-xl bg-card">
                             <FolderTree className="w-12 h-12 mb-3 text-muted-foreground/30" />
                             <p className="font-semibold text-sm">Matriz Vazia</p>
                             <p className="text-xs mt-1">Adicione consultores no menu lateral para construir a equipe.</p>
                           </div>
                        ) : (
                          Object.values(baseItems).map(item => {
                            const cNome = consultores.find(c => c.id === item.user_id)?.nome;
                            const isFechado = item.tipo_pagamento === 'fechado';
                            const isUltimaVersao = currentBase?.id === baseVersions[0]?.id;
                            
                            const idOsValido = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);
                            const gastoVidaH = allTimesheets.filter(t => t.user_id === item.user_id && t.contract_id === contratoAtivo && (idOsValido ? t.os_id === idOsValido : true)).reduce((sum, t) => sum + (new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                            const saldoH = item.horas_teto - gastoVidaH;
                            
                            return (
                              <div key={item.user_id} className={`border rounded-xl p-5 shadow-sm w-full transition-all ${isUltimaVersao ? 'hover:border-primary/40' : 'opacity-80 pointer-events-none grayscale'} ${isFechado ? 'bg-amber-500/5 border-amber-500/20' : 'bg-card'}`}>
                                <div className={`flex flex-col md:flex-row md:justify-between md:items-center gap-4 ${(!isSemOsType && !isFechado && !isOverheadType) ? 'border-b border-border/60 pb-4 mb-4' : ''}`}>
                                  <div>
                                      <h4 className="font-black text-base text-foreground mb-2">{cNome}</h4>
                                      {(!isSemOsType && !isFechado && !isOverheadType) ? (
                                        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider font-mono bg-muted/40 p-1.5 rounded-lg border w-fit">
                                          <span className="text-primary font-bold px-2">Consumido: {gastoVidaH.toFixed(1)}h</span>
                                          <span className={`${saldoH < 0 ? 'bg-red-500 text-white' : 'bg-green-600 text-white'} px-2 py-0.5 rounded shadow-xs font-bold`}>Saldo Base: {saldoH.toFixed(1)}h</span>
                                        </div>
                                      ) : (
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Definições da Matriz</p>
                                      )}
                                      
                                      <div className="mt-3 flex items-center gap-2">
                                        <Select value={item.tipo_pagamento || 'horas'} onValueChange={(val: 'horas' | 'fechado') => updateTipoPagamentoBase(item.user_id, val)}>
                                          <SelectTrigger className="h-8 w-40 text-xs font-bold shadow-xs bg-background border-primary/20 hover:border-primary/50">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="horas">⏳ Medição em Horas</SelectItem>
                                            <SelectItem value="fechado">🎯 Preço Fechado (%)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    {(!isSemOsType && !isFechado && !isOverheadType) && (
                                      <div className="relative flex items-center">
                                        <Input type="number" value={item.horas_teto || ''} onChange={(e) => updateTetoBase(item.user_id, Number(e.target.value))} className="w-32 h-10 pr-8 font-bold text-lg text-right border-primary/30 focus-visible:ring-primary shadow-xs" placeholder="0" />
                                        <span className="absolute right-3 text-sm text-muted-foreground font-bold">h</span>
                                      </div>
                                    )}
                                    {(isOverheadType && !isFechado) && (
                                      <Badge className="bg-blue-500/10 text-blue-700 border-none font-mono py-1 px-3"><Wrench className="w-3 h-3 mr-1" /> Horas Livres</Badge>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => removeConsultorBase(item.user_id)} className="h-10 w-10 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                </div>
                                
                                {(!isSemOsType && !isFechado) && (
                                  <div className="border-l-4 border-primary/20 pl-4 space-y-3 w-full p-3 rounded-r-xl border-y border-r transition-all bg-background/50">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-muted-foreground uppercase tracking-wider">Disciplinas / Escopo Atribuído</span>
                                        <Button className="h-7 text-[10px] bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 shadow-xs" onClick={() => { setPaletteTargetUserId(item.user_id); setPaletteOpen(true); }} size="sm" variant="outline">
                                          <PlusCircle className="w-3 h-3 mr-1"/> Adicionar Disciplina
                                        </Button>
                                    </div>

                                    {item.atividades.length === 0 ? (
                                        <div className="text-[11px] font-medium text-muted-foreground py-6 text-center border-2 border-dashed rounded-xl bg-background/80">
                                          Nenhuma disciplina atribuída a este consultor.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2 pt-1">
                                          {item.atividades.map((ativNome, idx) => (
                                            <div key={idx} className="group flex items-center justify-between rounded-lg border bg-background px-3 py-2 shadow-xs hover:border-primary/40 hover:bg-primary/5 transition-all">
                                                <div className="flex items-center gap-3">
                                                  <div className="flex flex-col gap-0.5 opacity-20 group-hover:opacity-100 transition-opacity">
                                                     <button type="button" onClick={() => moverAtividadeBase(item.user_id, ativNome, 'up')} disabled={idx === 0} className="hover:text-primary disabled:opacity-30 cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
                                                     <button type="button" onClick={() => moverAtividadeBase(item.user_id, ativNome, 'down')} disabled={idx === item.atividades.length - 1} className="hover:text-primary disabled:opacity-30 cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
                                                  </div>
                                                  <span className="text-sm font-semibold text-foreground/90">{ativNome}</span>
                                                </div>
                                                <button type="button" onClick={() => removeAtividadeBase(item.user_id, ativNome)} className="p-1.5 text-muted-foreground/40 hover:text-red-500 transition-colors cursor-pointer rounded-md hover:bg-red-500/10"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                          ))}
                                        </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* --- MODO DISTRIBUIÇÃO MENSAL --- */}
                {viewAlocacao === 'mensal' && (
                  <Card className="flex flex-col w-full h-full shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-muted/5 shrink-0">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2 font-bold">
                           Distribuição de Horas
                        </CardTitle>
                        <div className="flex items-center gap-3 mt-2">
                           <div className="flex bg-background border p-1 rounded-md shadow-sm">
                             <Select value={alocMes} onValueChange={setAlocMes}>
                               <SelectTrigger className="w-32 h-8 text-xs font-bold border-none bg-transparent focus:ring-0"><SelectValue /></SelectTrigger>
                               <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                             </Select>
                             <div className="w-px bg-border my-1"></div>
                             <Select value={alocAno} onValueChange={setAlocAno}>
                               <SelectTrigger className="w-24 h-8 text-xs font-bold border-none bg-transparent focus:ring-0"><SelectValue /></SelectTrigger>
                               <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                             </Select>
                           </div>
                           {isComOsType && alocacaoOsId && <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 uppercase">OS: {osList.find(o => o.id === alocacaoOsId)?.codigo}</Badge>}
                        </div>
                      </div>
                      {contratoAtivo && <Button onClick={salvarAlocacoesNoBanco} disabled={salvando} className="gap-2 h-10 shadow-sm bg-primary text-white"><Save className="w-4 h-4" /> Gravar Distribuição no Mês</Button>}
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto w-full bg-muted/5 flex-1 min-h-0">
                      <div className="p-6 space-y-5">
                        {carregandoAlocacoes ? (
                          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : Object.values(alocacoes).length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 border-2 border-dashed rounded-xl bg-card">
                             <CalendarDays className="w-12 h-12 mb-3 text-muted-foreground/30" />
                             <p className="font-semibold text-sm">Distribuição Vazia</p>
                             <p className="text-xs mt-1">Volte para a aba <b>Linha de Base</b> e configure a equipe e os tetos primeiro.</p>
                           </div>
                        ) : (
                          Object.values(alocacoes).map(aloc => {
                             const matrizRef = baseItems[aloc.consultorId];
                             const isFechado = aloc.tipo_pagamento === 'fechado';
                             const idOsValido = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);

                             const alocadoOutrosMeses = allAlocacoes.filter(a => a.user_id === aloc.consultorId && a.contract_id === contratoAtivo && (idOsValido ? a.os_id === idOsValido : true) && !(a.mes === alocMes && a.ano === alocAno) && a.atividade !== 'Preço Fechado (Medição)').reduce((sum, a) => sum + Number(a.horas_disponiveis), 0);
                             const alocadoVidaLive = alocadoOutrosMeses + aloc.horasTotais;
                             
                             const medidoVida = allTimesheets.filter(t => t.user_id === aloc.consultorId && t.contract_id === contratoAtivo && (idOsValido ? t.os_id === idOsValido : true)).reduce((sum, t) => sum + (new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                             const saldoAAlocar = matrizRef ? matrizRef.horas_teto - alocadoVidaLive : 0;
                             
                             const cObj = contratos.find(c => c.id === contratoAtivo);
                             const tetoContrato = cObj?.teto_global_horas || 0;
                             const medidoContratoGlobal = allTimesheets.filter(t => t.user_id === aloc.consultorId && t.contract_id === contratoAtivo).reduce((sum, t) => sum + (new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                             
                             return (
                               <div key={aloc.consultorId} className={`border rounded-xl p-5 shadow-sm w-full transition-all hover:border-primary/50 ${isFechado ? 'bg-amber-500/5 border-amber-500/20' : 'bg-card'}`}>
                                 <div className={`flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 ${(!isSemOsType && !isFechado && !isOverheadType && aloc.atividades.length > 0) ? 'border-b border-border/60 pb-4 mb-4' : ''}`}>
                                   <div className="flex-1">
                                      <h4 className="font-black text-base text-foreground flex items-center gap-2 mb-2">
                                         {consultores.find(c => c.id === aloc.consultorId)?.nome}
                                         {isFechado && <Badge className="bg-amber-500/10 text-amber-700 text-[10px] uppercase border-none ml-2 shadow-xs" variant="secondary">Preço Fechado</Badge>}
                                      </h4>
                                      
                                      {!isSemOsType && !isFechado && !isOverheadType && matrizRef && (
                                         <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] uppercase font-mono tracking-wider bg-muted/30 p-1.5 rounded-lg border w-fit">
                                            <span className="text-primary font-bold px-2">Teto Matriz (OS): {matrizRef.horas_teto.toFixed(1)}h</span>
                                            <span className="text-muted-foreground border-l border-dashed pl-2">Global Alocado: {alocadoVidaLive.toFixed(1)}h</span>
                                            <span className="text-muted-foreground border-l border-dashed pl-2">Global Medido: {medidoVida.toFixed(1)}h</span>
                                            <span className={`px-2 py-0.5 rounded shadow-xs font-bold ml-2 ${saldoAAlocar < 0 ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}`}>Saldo Matriz: {saldoAAlocar.toFixed(1)}h</span>
                                         </div>
                                      )}

                                      {isFechado && (() => {
                                         const idOsValido = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);
                                         const medidoOutrosMesesPerc = (allMedicoes || [])
                                           .filter(m => m.user_id === aloc.consultorId && m.contract_id === contratoAtivo && (idOsValido ? m.os_id === idOsValido : true) && !(m.mes === alocMes && m.ano === alocAno))
                                           .reduce((sum, m) => sum + Number(m.percentual || 0), 0);
                                         const saldoPerc = Math.max(0, 100 - medidoOutrosMesesPerc);

                                         return (
                                           <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] uppercase font-mono tracking-wider">
                                              <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded font-bold border border-amber-500/20">
                                                Já Medido: {medidoOutrosMesesPerc.toFixed(1)}%
                                              </span>
                                              <span className={`px-2 py-1 rounded font-bold shadow-sm ${saldoPerc <= 0 ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}`}>
                                                Saldo: {saldoPerc.toFixed(1)}%
                                              </span>
                                           </div>
                                         );
                                      })()}

                                      {(isSemOsType || isOverheadType) && <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-bold">Horas Ilimitadas (Escopo Dinâmico)</p>}
                                   </div>
                                   <div className="flex items-center gap-2">
                                     {isFechado ? (() => {
                                       const idOsValido = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);
                                       const medidoOutrosMesesPerc = (allMedicoes || [])
                                         .filter(m => m.user_id === aloc.consultorId && m.contract_id === contratoAtivo && (idOsValido ? m.os_id === idOsValido : true) && !(m.mes === alocMes && m.ano === alocAno))
                                         .reduce((sum, m) => sum + Number(m.percentual || 0), 0);
                                       const saldoPerc = Math.max(0, 100 - medidoOutrosMesesPerc);
                                       const key = alocacaoOsId ? `${contratoAtivo}_${alocacaoOsId}` : contratoAtivo;

                                       return (
                                         <div className="relative flex items-center">
                                           <Input
                                             type="number"
                                             min={0}
                                             max={saldoPerc}
                                             placeholder="0"
                                             value={medicoesInput[key] || ''}
                                             onChange={(e) => {
                                               let val = Number(e.target.value);
                                               if (medidoOutrosMesesPerc + val > 100) {
                                                 toast.error(`⚠️ Limite excedido! Saldo livre: ${saldoPerc.toFixed(1)}%`);
                                                 val = saldoPerc;
                                               }
                                               setMedicoesInput(p => ({ ...p, [key]: val }));
                                             }}
                                             className="w-28 h-10 pr-7 font-bold text-lg text-right text-amber-600 bg-amber-500/10 border-amber-500/30 focus-visible:ring-amber-500/50 shadow-xs"
                                           />
                                           <span className="absolute right-3 text-sm font-bold text-amber-600">%</span>
                                         </div>
                                       );
                                     })() : (isSemOsType || isOverheadType) ? (
                                       <Badge className="bg-blue-500/10 text-blue-600 border-none font-mono py-1 px-3"><Wrench className="w-3 h-3 mr-1" /> Dinâmico</Badge>
                                     ) : (
                                       <div className="relative flex items-center">
                                         <Input type="number" value={aloc.horasTotais || ''} onChange={(e) => updateHorasMensal(aloc.consultorId, Number(e.target.value))} className="w-28 h-10 pr-7 font-bold text-lg text-right text-primary bg-muted/50 border-primary/20 focus-visible:ring-primary/50 shadow-xs" disabled={aloc.atividades.length > 0} />
                                         <span className="absolute right-3 text-sm font-bold text-muted-foreground">h</span>
                                       </div>
                                     )}
                                   </div>
                                 </div>
                                 
                                 {(!isSemOsType && !isFechado && aloc.atividades.length > 0) && (
                                   <div className="pl-4 border-l-4 border-primary/20 space-y-2 mt-3 w-full bg-background p-3 rounded-r-xl shadow-xs">
                                     <div className="flex justify-between items-center text-xs mb-3">
                                        <span className="font-bold text-muted-foreground uppercase tracking-wider">{isOverheadType ? "Disciplinas do Overhead" : "Horas do Mês por Disciplina"}</span>
                                        <span className="text-[10px] text-muted-foreground/60 italic">(Adicione novas disciplinas via Linha de Base)</span>
                                     </div>
                                     {aloc.atividades.map(a => {
                                          const ativOutrosMeses = allAlocacoes.filter(x => x.user_id === aloc.consultorId && x.contract_id === contratoAtivo && (idOsValido ? x.os_id === idOsValido : true) && x.atividade === a.nome && !(x.mes === alocMes && x.ano === alocAno)).reduce((sum, x) => sum + Number(x.horas_disponiveis), 0);
                                          const ativMedido = allTimesheets.filter(t => t.user_id === aloc.consultorId && t.contract_id === contratoAtivo && (idOsValido ? t.os_id === idOsValido : true) && t.activity === a.nome).reduce((sum, t) => sum + (new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                                          
                                          return (
                                            <div key={a.id} className="flex justify-between items-center bg-muted/10 p-3 rounded-lg w-full border border-dashed border-transparent hover:border-muted-foreground/30 transition-all">
                                              <div className="flex flex-col">
                                                 <span className="font-bold text-sm text-foreground/90">{a.nome}</span>
                                                 {!isOverheadType && <span className="text-[9px] text-muted-foreground font-mono mt-1 uppercase tracking-wider">Histórico: {ativOutrosMeses.toFixed(1)}h Aloc. Anterior | {ativMedido.toFixed(1)}h Medido</span>}
                                              </div>
                                              {isOverheadType ? (
                                                <Badge className="bg-transparent text-blue-600 border-none font-mono"><Wrench className="w-3 h-3 mr-1" /> Livre</Badge>
                                              ) : (
                                                <div className="relative w-28">
                                                   <Input type="number" className="h-9 text-right font-bold text-sm pr-7 border-primary/20 focus-visible:ring-primary/50 bg-background shadow-xs" value={a.horas || ''} onChange={(e) => updateAtivMensal(aloc.consultorId, a.id, Number(e.target.value))} />
                                                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">h</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                     })}
                                   </div>
                                 )}
                               </div>
                             )
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: EQUIPE & ACESSOS (FASE 4) */}
        {menuAtivo === 'equipe' && (
          <Card className="border-t-4 border-t-emerald-500 w-full shadow-sm">
            <CardHeader className="border-b pb-4 bg-muted/5">
              <div>
                <CardTitle className="flex items-center gap-2 text-emerald-700"><Users className="w-5 h-5"/> Gestão de Equipe e Acessos</CardTitle>
                <CardDescription className="mt-1">Gerencie quem tem acesso ao aplicativo (Ativos/Inativos).</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {consultores.map(c => (
                  <div key={c.id} className={`border p-4 rounded-xl flex flex-col gap-4 shadow-sm transition-colors ${!c.status_ativo ? 'bg-muted/40 opacity-75' : c.is_convidado ? 'bg-amber-500/5 border-amber-500/20' : (c.em_recesso ? 'bg-blue-500/5 border-blue-500/20' : 'bg-card')}`}>
                    <div className="flex items-start justify-between">
                       <div className="flex items-center gap-3">
                          {/* 🌟 NOVO SISTEMA DE UPLOAD DE AVATAR OTIMIZADO */}
                          <div className="relative group cursor-pointer">
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                              title="Clique para alterar a foto"
                              onChange={(e) => handleUploadAvatar(e, c.id)}
                            />
                            {c.avatar_url ? (
                              <>
                                <img 
                                  src={c.avatar_url} 
                                  alt="Avatar" 
                                  className="w-10 h-10 rounded-full border border-primary/20 object-cover group-hover:opacity-50 transition-opacity" 
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.nextElementSibling) {
                                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                    }
                                  }}
                                />
                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 hidden items-center justify-center text-emerald-700 font-bold border border-emerald-500/20 group-hover:bg-emerald-500/20">
                                   {c.nome.substring(0,2).toUpperCase()}
                                </div>
                              </>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-700 font-bold border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                                 {c.nome.substring(0,2).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                               <PlusCircle className="w-4 h-4 text-primary bg-background/80 rounded-full" />
                            </div>
                          </div>
                          {/* ------------------------------------ */}
                          
                          <div>
                            <span className="font-bold text-sm block leading-tight">{c.nome}</span>
                            {c.is_convidado ? (
                               <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 text-[9px] mt-1 uppercase border-none">Convidado (Controle Interno)</Badge>
                            ) : c.em_recesso ? (
                               <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 text-[9px] mt-1 uppercase border-none">Em Recesso / Férias</Badge>
                            ) : (
                               <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 text-[9px] mt-1 uppercase border-none">Acesso ao App</Badge>
                            )}
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t pt-3 mt-1">
                      <div className="flex items-center gap-2">
                         <Switch 
                            id={`status-${c.id}`} 
                            checked={c.status_ativo !== false} 
                            onCheckedChange={async (checked) => {
                               setConsultores(p => p.map(user => user.id === c.id ? { ...user, status_ativo: checked } : user));
                               await supabase.from('consultores').update({ status_ativo: checked }).eq('id', c.id);
                            }} 
                         />
                         <Label htmlFor={`status-${c.id}`} className="text-xs cursor-pointer">{c.status_ativo !== false ? 'Ativo' : 'Inativo'}</Label>
                      </div>
                      
                      {/* Botão de Recesso */}
                      <div className="flex items-center gap-2">
                         <Switch 
                            id={`recesso-${c.id}`} 
                            checked={c.em_recesso === true} 
                            disabled={!c.status_ativo}
                            onCheckedChange={async (checked) => {
                               setConsultores(p => p.map(user => user.id === c.id ? { ...user, em_recesso: checked } : user));
                               await supabase.from('consultores').update({ em_recesso: checked }).eq('id', c.id);
                               if (checked) toast.info(`${c.nome} entrou em recesso. Alertas de ociosidade pausados.`);
                               else toast.success(`${c.nome} retornou do recesso.`);
                            }} 
                         />
                         <Label htmlFor={`recesso-${c.id}`} className="text-xs cursor-pointer text-blue-700 font-medium">Recesso</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* VIEW: MEDIÇÕES PREÇOS FECHADOS (%) */}
        {menuAtivo === 'medicoes' && (
          <Card className="border-t-4 border-t-amber-500 w-full shadow-sm">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <CardTitle className="text-xl">Lançamento de Medições (Preço Fechado)</CardTitle>
              <CardDescription>Insira o avanço físico mensal do consultor nos contratos em que ele atua por pacote.</CardDescription>
              <div className="flex flex-wrap gap-3 mt-4 p-3 bg-background border rounded-lg shadow-sm">
                <Select value={medConsultor} onValueChange={setMedConsultor}>
                  <SelectTrigger className="w-80 h-9 border-primary font-semibold"><SelectValue placeholder="Selecione o Consultor..." /></SelectTrigger>
                  <SelectContent>
                    {consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={medMes} onValueChange={setMedMes}><SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger><SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={medAno} onValueChange={setMedAno}><SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {!medConsultor ? (
                <div className="text-center text-muted-foreground py-12 text-sm border border-dashed rounded-xl w-full">
                  Selecione o consultor e o mês acima para carregar os contratos dele.
                </div>
              ) : medLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : medContratosVinculados.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 text-sm border border-dashed rounded-xl">Este consultor não possui projetos alocados como "Preço Fechado" neste mês.</p>
              ) : (
                <div className="w-full space-y-4">
                  {medContratosVinculados.map(v => (
                    <div key={v.key} className="flex items-center justify-between p-4 border rounded-xl bg-muted/10 shadow-sm w-full hover:border-primary/30 transition-colors">
                      <div>
                        <p className="font-bold text-sm text-foreground flex items-center gap-2">
                          {v.codigo}
                          {v.os_codigo && <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-none text-[9px] uppercase">OS: {v.os_codigo}</Badge>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-75">{v.nome}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative w-28">
                          <Input 
                            type="number" 
                            className="pr-8 text-right font-bold text-amber-600 h-9 border-amber-500/30 focus-visible:ring-amber-500/50" 
                            value={medicoesInput[v.key] || ''} 
                            onChange={e => setMedicoesInput(p => ({...p, [v.key]: Number(e.target.value)}))} 
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 flex justify-end">
                    <Button onClick={salvarMedicoes} disabled={salvando} className="bg-amber-500 hover:bg-amber-600 text-white w-48 h-10 shadow-sm">
                      <Save className="w-4 h-4 mr-2" /> Gravar Medições
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* VIEW: GESTÃO DE APONTAMENTOS (ADMIN) */}
        {menuAtivo === 'gestao' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
            <div className="md:col-span-5 space-y-6">
              <Card className="border-t-4 border-t-purple-500 shadow-sm">
                <CardHeader className="border-b pb-4 space-y-4">
                  <div className="flex justify-between items-center w-full">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4"/> Lançamento Direto / Importação</CardTitle>
                    <div className="relative">
                      <input type="file" id="excel-ts-up" className="hidden" accept=".xlsx, .xls" onChange={handleImportarTimesheetExcel} />
                      <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 text-[11px] h-8 gap-1.5" onClick={() => document.getElementById('excel-ts-up')?.click()}>
                        <FileUp className="w-3.5 h-3.5" /> Importar Planilha (.xlsx)
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-[10px] text-purple-800 space-y-1">
                    <p className="font-bold uppercase tracking-wider mb-1">Como importar via Excel:</p>
                    <p>O arquivo (.xlsx) deve conter <strong>exatamente 9 colunas</strong>, na seguinte ordem (com cabeçalho na linha 1):</p>
                    <p className="font-mono font-semibold opacity-90 mt-1">1. Consultor | 2. Data | 3. Cód. Contrato | 4. Nome Contrato | 5. OS | 6. Disciplina/Escopo | 7. Entrada | 8. Saída | 9. Observação</p>
                    <p className="italic opacity-80 mt-1">* Dica: Exporte a planilha na aba "Folha (Mensal)" ou no Painel do Consultor para obter o modelo idêntico.</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-xs">
                  <div className="space-y-1"><Label>Engenheiro</Label><Select value={gestaoConsultor} onValueChange={setGestaoConsultor}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1">
                    <Label>Contrato</Label>
                    <Select value={gestaoContrato} onValueChange={(val) => { setGestaoContrato(val); setGestaoOs(''); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {contratos.find(c => c.id === gestaoContrato)?.tipo === 'continuado_com_os' && (
                    <div className="space-y-1">
                      <Label>Ordem de Serviço (OS)</Label>
                      <Select value={gestaoOs} onValueChange={setGestaoOs}>
                        <SelectTrigger className="h-9 border-amber-500/30"><SelectValue placeholder="Selecione a OS..." /></SelectTrigger>
                        <SelectContent>
                          {osList.filter(o => o.contract_id === gestaoContrato).map(o => (
                            <SelectItem key={o.id} value={o.id}>{o.codigo} - {o.descricao}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1"><Label>Disciplina / Escopo</Label><Select value={gestaoAtividade} onValueChange={setGestaoAtividade} disabled={!gestaoContrato}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{gestaoAtividadesDisponiveis.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Data</Label><Input type="date" value={gestaoData} onChange={e => setGestaoData(e.target.value)} className="h-9" /></div><div className="grid grid-cols-2 gap-1"><div className="space-y-1"><Label>Início</Label><Input type="time" value={gestaoInicio} onChange={e => setGestaoInicio(e.target.value)} className="h-9 px-1" /></div><div className="space-y-1"><Label>Fim</Label><Input type="time" value={gestaoFim} onChange={e => setGestaoFim(e.target.value)} className="h-9 px-1" /></div></div></div>
                  <div className="space-y-1">
                    <Label>Observação Interna</Label>
                    <Input onChange={(e) => setGestaoNotes(e.target.value)} placeholder="Descreva o escopo realizado..." value={gestaoNotes} className="h-9" />
                  </div>

                  {gestaoSaldos && gestaoAtividade !== 'Sem atividade específica' && (
                     <div className="bg-muted/30 border p-3 rounded-lg flex items-center justify-between text-xs my-3 shadow-sm">
                        <div>
                           <p className="font-bold text-foreground">Saldo da Disciplina / Projeto</p>
                           <p className="text-muted-foreground mt-0.5">Orçado: {gestaoSaldos.isSemOs ? '∞' : `${gestaoSaldos.orcado.toFixed(1)}h`} | Consumido: {gestaoSaldos.gasto.toFixed(1)}h</p>
                        </div>
                        <div className="text-right">
                           <Badge className={`font-mono shadow-sm text-white border-none ${gestaoSaldos.isSemOs ? 'bg-amber-500' : (gestaoSaldos.saldo < 0 ? 'bg-red-500' : 'bg-green-600')}`}>
                             {gestaoSaldos.isSemOs && <Wrench className="w-3 h-3 mr-1"/>}
                             {gestaoSaldos.isSemOs ? 'Ilimitado' : `${gestaoSaldos.saldo.toFixed(1)}h livres`}
                           </Badge>
                        </div>
                     </div>
                  )}
                  
                  <div className="flex gap-2 mt-2">
                    
                     <Button onClick={salvarApontamentoAdmin} disabled={salvando} className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-xs">
                        {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} {gestaoEditandoId ? 'Atualizar Histórico' : 'Gravar Horas'}
                     </Button>
                     {gestaoEditandoId && (
                        <Button 
                           variant="outline" 
                           onClick={() => {
                              setGestaoEditandoId(null);
                              setGestaoNotes('');
                           }} 
                           className="h-9 text-xs border-dashed"
                        >
                           Cancelar Edição
                        </Button>
                     )}
                  </div>
                </CardContent>
              </Card>

              {/* 🌟 CARD DE LIBERAÇÃO RETROATIVA */}
              <Card className="border-t-4 border-t-green-500 shadow-sm">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><Unlock className="w-4 h-4"/> Liberação Retroativa (Equipe)</CardTitle>
                  <CardDescription className="text-[10px]">Autorize consultores a editarem dias passados no painel deles.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="space-y-1">
                    <Label>Consultor</Label>
                    <Select value={liberarConsultor} onValueChange={setLiberarConsultor}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o consultor..." /></SelectTrigger>
                      <SelectContent>
                        {consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Data Liberada</Label>
                    <Input type="date" value={liberarData} onChange={e => setLiberarData(e.target.value)} className="h-9" />
                  </div>
                  <Button onClick={concederAutorizacao} disabled={salvando} className="w-full bg-green-600 hover:bg-green-700 h-9 text-xs mt-2"><Unlock className="w-3.5 h-3.5 mr-1" /> Conceder Acesso Temporário</Button>

                  <div className="mt-4 pt-4 border-t space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Acessos Ativos</Label>
                    {loadingAuth ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /> : authList.length === 0 ? <p className="text-[10px] text-center text-muted-foreground py-4 border rounded border-dashed">Nenhuma liberação ativa.</p> : (
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {authList.map(auth => {
                          const nome = consultores.find(c => c.id === auth.user_id)?.nome || 'Desconhecido';
                          return (
                            <div key={auth.id} className="flex justify-between items-center bg-muted/30 p-2 rounded-md border shadow-xs">
                              <div>
                                <p className="font-bold">{nome.split(' ')[0]}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{auth.data_liberada.split('-').reverse().join('/')}</p>
                              </div>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:bg-red-500/10" onClick={() => revogarAutorizacao(auth.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-7 h-full flex flex-col">
              <Card className="flex flex-col shadow-sm w-full h-full min-h-150 xl:min-h-[calc(100vh-180px)]">
                <CardHeader className="border-b py-3 bg-muted/10 shrink-0">
                  <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Últimos Lançamentos Efetuados</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 divide-y text-xs w-full relative">
                  <div className="absolute inset-0 overflow-y-auto">
                    {gestaoLogsFiltrados.map(t => {
                      const s = new Date(t.start_at); const e = t.end_at ? new Date(t.end_at) : new Date();
                      return (
                        <div key={t.id} className="p-4 hover:bg-muted/40 flex justify-between items-center w-full transition-colors">
                          <div>
                            <p className="font-bold text-foreground text-sm">{consultores.find(c => c.id === t.user_id)?.nome}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{contratos.find(c => c.id === t.contract_id)?.codigo}{t.os_id ? ` • ${osList.find(o => o.id === t.os_id)?.codigo}` : ''} • {t.activity} • {s.toLocaleDateString('pt-BR')}</p>
                            {t.notes && <p className="text-[11px] italic text-primary font-medium mt-1.5 truncate max-w-sm">"{t.notes}"</p>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="font-mono bg-primary/10 text-primary border-none h-7 px-2 text-xs">{((e.getTime() - s.getTime()) / 3600000).toFixed(1)}h</Badge>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => iniciarEdicaoApontamento(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10" onClick={() => excluirApontamentoAdmin(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 🌟 NOVO VIEW: PAINEL POR CONSULTOR (Avatar dinâmico) */}
        {menuAtivo === 'resumo-consultor' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
             <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold tracking-tight text-blue-700 flex items-center gap-2"><Contact2 className="w-5 h-5"/> Painel por Consultor</h2>
                <p className="text-xs text-muted-foreground mt-1">Acompanhe a performance orçamentária e a entrega de cada membro da equipe isoladamente.</p>
              </div>
              {resConsId && resumoConsultorData && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="gap-1.5 text-green-700 border-green-500/30 hover:bg-green-500/10 text-xs h-9" onClick={() => exportarPainelConsultor('detalhada')}>
                    <Download className="w-3.5 h-3.5" /> Exportar Detalhada
                  </Button>
                  <Button className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-9 shadow-sm" onClick={() => exportarPainelConsultor('consolidada')}>
                    <Layers className="w-3.5 h-3.5" /> Exportar Consolidada
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-xl border shadow-sm">
                <Select value={resConsId} onValueChange={setResConsId}>
                  <SelectTrigger className="w-64 h-9 bg-background font-bold text-primary"><SelectValue placeholder="Selecione o Consultor" /></SelectTrigger>
                  <SelectContent>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
                <div className="h-6 w-px bg-border mx-1"></div>
                {/* 🌟 ITEM 13: Opção para alternar entre Ciclo Mensal ou Intervalo Personalizado (Consultor) */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
                  <Button
                    size="sm"
                    type="button"
                    variant={modoDataFiltro === 'ciclo' ? 'default' : 'ghost'}
                    onClick={() => setModoDataFiltro('ciclo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Ciclo
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant={modoDataFiltro === 'intervalo' ? 'default' : 'ghost'}
                    onClick={() => setModoDataFiltro('intervalo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Intervalo
                  </Button>
                </div>

                {modoDataFiltro === 'ciclo' ? (
                  <>
                    <Select value={resConsMes} onValueChange={setResConsMes}>
                      <SelectTrigger className="w-32 h-9 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={resConsAno} onValueChange={setResConsAno}>
                      <SelectTrigger className="w-24 h-9 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                    </Select>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in-50">
                    <Input 
                      type="date" 
                      value={dataInicioCustom} 
                      onChange={e => setDataInicioCustom(e.target.value)} 
                      className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                    />
                    <span className="text-xs text-muted-foreground font-medium">até</span>
                    <Input 
                      type="date" 
                      value={dataFimCustom} 
                      onChange={e => setDataFimCustom(e.target.value)} 
                      className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                    />
                  </div>
                )}
              </div>
            </div>

            {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : !resConsId ? (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground">
                <Contact2 className="w-12 h-12 mb-3 text-muted-foreground/50"/>
                <p className="font-medium">Selecione um consultor acima para visualizar seu painel.</p>
              </div>
            ) : !resumoConsultorData ? <div className="text-center py-12">Nenhum dado encontrado para este consultor.</div> : (
              <div className="grid gap-6 md:grid-cols-12">
                 {/* CARTÃO DE PERFIL E RESUMO DE SAÚDE */}
                 <div className="md:col-span-4 space-y-6">
                    <Card className="shadow-sm border-blue-500/20 bg-blue-50/30 overflow-hidden">
                       <div className="h-16 bg-linear-to-r from-blue-600 to-blue-400"></div>
                       <CardContent className="pt-0 relative px-6 pb-6">
                          <div className="flex justify-center -mt-10 mb-4">
                             {/* Nota de Implementação: O avatar_url vem do banco, porém o tipo Consultor precisaria ser atualizado. 
                                 Caso não tenha mapeado avatar_url na query carregarDadosDoBanco, ele usará as iniciais. */}
                             {consultores.find(c => c.id === resConsId)?.avatar_url ? (
                                <img src={consultores.find(c => c.id === resConsId)?.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-background bg-blue-100 object-cover shadow-sm" />
                             ) : (
                                <div className="w-20 h-20 rounded-full border-4 border-background bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-black shadow-sm">
                                   {resumoConsultorData.iniciais}
                                </div>
                             )}
                          </div>
                          <div className="text-center space-y-1">
                             <h3 className="font-bold text-lg text-foreground">{resumoConsultorData.nome}</h3>
                             <Badge variant="outline" className="bg-background">Consultor(a) Técnico</Badge>
                          </div>
                          
                          <div className="mt-8 space-y-4">
                             {/* 🌟 ITEM 4: Meta Contratual removida desta visualização */}
                             <div className="flex justify-between items-center text-sm border-b border-blue-200/50 pb-2">
                                {/* 🌟 ITEM 12: Texto e Número padronizados no tom azul com suporte perfeito ao Modo Escuro */}
                                <span className="text-blue-600/80 dark:text-blue-400/80 font-medium">Budget Alocado</span>
                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{resumoConsultorData.orcadoTotal.toFixed(1)}h</span>
                             </div>
                             <div className="flex justify-between items-center text-sm border-b border-blue-200/50 pb-2">
                                <span className="text-red-600/80 font-medium">Horas Consumidas</span>
                                <span className="font-mono font-bold text-red-600">{resumoConsultorData.gastoTotal.toFixed(1)}h</span>
                             </div>
                             <div className="flex justify-between items-center text-sm bg-blue-600 text-white p-3 rounded-xl shadow-xs mt-2">
                                <span className="font-bold uppercase tracking-wider text-[11px]">Saldo em Conta</span>
                                <span className="font-mono font-black text-lg">{resumoConsultorData.saldoTotal.toFixed(1)}h</span>
                             </div>
                          </div>
                       </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardHeader className="pb-2 border-b"><CardTitle className="text-xs uppercase text-muted-foreground">Consumo do Orçamento</CardTitle></CardHeader>
                      <CardContent className="flex flex-col items-center justify-center pt-6 pb-2 relative h-48">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie data={resumoConsultorData.pieData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                {resumoConsultorData.pieData.map((entry, index) => {
                                  let color = "#e2e8f0"; // Cinza neutro para "Zerado"
                                  if (entry.name === 'Gasto') color = "#ef4444"; // Vermelho
                                  if (entry.name === 'Saldo') color = "#3b82f6"; // Azul
                                  return <Cell key={`cell-${index}`} fill={color} />;
                                })}
                              </Pie>
                               <RechartsTooltip formatter={(v: number) => [`${v.toFixed(1)}h`, '']} contentStyle={{borderRadius: '8px', fontSize: '12px'}} wrapperStyle={{zIndex: 100}}/>
                            </PieChart>
                         </ResponsiveContainer>
                         <div className="absolute flex flex-col items-center justify-center pointer-events-none z-0">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Consumido</span>
                            <span className="text-2xl font-black text-red-500">{resumoConsultorData.percGasto.toFixed(0)}%</span>
                         </div>
                      </CardContent>
                    </Card>
                 </div>

                 {/* TABELA DE CONTRATOS DO CONSULTOR */}
                 <div className="md:col-span-8">
                    <Card className="h-full shadow-sm">
                      <CardHeader className="border-b pb-4 bg-muted/5">
                        <CardTitle className="text-sm font-bold flex items-center gap-2"><Briefcase className="w-4 h-4"/> Alocações do Consultor neste Ciclo</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-y-auto max-h-150">
                        {resumoConsultorData.contratosListados.length === 0 ? (
                           <div className="p-8 text-center text-muted-foreground text-xs">Este consultor não possui horas alocadas ou consumidas neste mês.</div>
                        ) : (
                           <table className="w-full text-sm text-left">
                              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground sticky top-0 z-10 backdrop-blur-md">
                                 <tr>
                                    <th className="px-4 py-3 font-semibold">Projeto / Contrato</th>
                                    <th className="px-4 py-3 font-semibold text-right w-24">Orçado</th>
                                    <th className="px-4 py-3 font-semibold text-right w-24">Gasto</th>
                                    <th className="px-4 py-3 font-semibold text-right w-24">Saldo</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y">
                                 {resumoConsultorData.contratosListados.map(ct => (
                                    <tr key={ct.id} className="hover:bg-muted/10 transition-colors">
                                       <td className="px-4 py-4">
                                          <p className="font-bold text-primary leading-tight">{ct.codigo}</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-50">{ct.nome}</p>
                                       </td>
                                       <td className="px-4 py-4 text-right font-mono text-muted-foreground">
                                          {ct?.isFechado ? `${ct.orcado.toFixed(1)}%` : (ct.ilimitado ? <span className="flex justify-end text-amber-500"><Wrench className="w-3 h-3"/></span> : `${ct.orcado.toFixed(1)}h`)}
                                       </td>
                                       <td className={`px-4 py-4 text-right font-mono font-bold ${ct?.isFechado ? 'text-primary' : 'text-red-500'}`}>
                                          {ct?.isFechado ? `${ct.gasto.toFixed(1)}%` : `${ct.gasto.toFixed(1)}h`}
                                       </td>
                                       <td className={`px-4 py-4 text-right font-mono font-bold ${ct.ilimitado ? 'text-amber-500' : (ct?.isFechado ? (100 - ct.orcado - ct.gasto < 0 ? 'text-red-500' : 'text-blue-600') : (ct.orcado - ct.gasto < 0 ? 'text-red-500' : 'text-blue-600'))}`}>
                                          {ct?.isFechado ? `${(100 - ct.orcado - ct.gasto).toFixed(1)}%` : (ct.ilimitado ? <span className="flex justify-end"><Wrench className="w-3 h-3"/></span> : `${(ct.orcado - ct.gasto).toFixed(1)}h`)}
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        )}
                      </CardContent>
                    </Card>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: DASHBOARD MENSAL (PAGAMENTO CONSULTOR) */}
        {menuAtivo === 'dash-mensal' && (
          <Card className="border-t-4 border-t-blue-500 shadow-sm min-h-125 w-full">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                <div><CardTitle className="text-lg">Folha de Pagamento (Equipe)</CardTitle><CardDescription>Acompanhe o volume a ser repassado, faturado horizontalmente por consultor.</CardDescription></div>
                <div className="flex gap-2">
                  <Button onClick={() => exportarExcel(false)} variant="outline" className="gap-1.5 text-green-700 border-green-500/30 hover:bg-green-500/10 text-xs h-8">
                    <Download className="w-3.5 h-3.5" /> Detalhada
                  </Button>
                  <Button onClick={exportarMatrizConsolidada} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-8 shadow-sm">
                    <Layers className="w-3.5 h-3.5" /> Exportar Matriz Consolidada
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 items-center bg-background p-2.5 rounded-lg border shadow-sm w-full">
                {renderFiltroTiposContratoMultiplos()}
                <Select value={dashFonte} onValueChange={setDashFonte}><SelectTrigger className="w-32 h-8 text-xs bg-muted/40"><SelectValue placeholder="Divisão" /></SelectTrigger><SelectContent><SelectItem value="todas">EC + ET</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent></Select>
                <div className="w-44">{renderFiltroContratosMultiplos()}</div>
                {/* 🌟 ITEM 13: Opção para alternar entre Ciclo Mensal ou Intervalo Personalizado */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
                  <Button
                    size="sm"
                    type="button"
                    variant={modoDataFiltro === 'ciclo' ? 'default' : 'ghost'}
                    onClick={() => setModoDataFiltro('ciclo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Ciclo
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant={modoDataFiltro === 'intervalo' ? 'default' : 'ghost'}
                    onClick={() => setModoDataFiltro('intervalo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Intervalo
                  </Button>
                </div>

                {modoDataFiltro === 'ciclo' ? (
                  <>
                    <Select value={dashMes} onValueChange={setDashMes}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={dashAno} onValueChange={setDashAno}>
                      <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                    </Select>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in-50">
                    <Input 
                      type="date" 
                      value={dataInicioCustom} 
                      onChange={e => setDataInicioCustom(e.target.value)} 
                      className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                    />
                    <span className="text-xs text-muted-foreground font-medium">até</span>
                    <Input 
                      type="date" 
                      value={dataFimCustom} 
                      onChange={e => setDataFimCustom(e.target.value)} 
                      className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {loadingDash ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : dashData.consultoresPagamento.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-12">Nenhum registro encontrado no ciclo para esse filtro.</div>
              ) : (
                <>
                  <div className="w-full h-95">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashData.consultoresPagamento}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onClick={(state) => {
                          const clickedId = state?.activePayload?.[0]?.payload?.id;
                          if (clickedId) {
                            setDrilldownConsultorId(prev => prev === clickedId ? null : clickedId);
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                        <XAxis dataKey="nomeCurto" tickLine={false} axisLine={false} style={{fontSize: '11px'}} />
                        <YAxis tickLine={false} axisLine={false} style={{fontSize: '11px'}} tickFormatter={(v) => `${v}h`} />
                        <RechartsTooltip cursor={{fill: '#88888811'}} contentStyle={{borderRadius: '8px'}} wrapperStyle={{zIndex: 100}} formatter={(v: number) => [`${v} horas`, 'Trabalhado']} />
                        <Bar dataKey="valorGrafico" radius={[4, 4, 0, 0]} maxBarSize={55} cursor="pointer">
                          {dashData.consultoresPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 🌟 DRILL-DOWN CONSOLIDADO POR CONTRATO */}
                  {drilldownConsultorId && (() => {
                    const consNome = consultores.find(c => c.id === drilldownConsultorId)?.nome || 'Consultor';
                    const logsDrilldown = allTimesheets.filter(t => {
                      if (t.user_id !== drilldownConsultorId) return false;
                      const cont = contratos.find(c => c.id === t.contract_id);
                      if (!cont) return false;
                      return isWithinCycle(t.start_at, dashMes, dashAno, cont.ciclo_inicio, cont.ciclo_fim);
                    });

                    // Agrupamento consolidado por Contrato Mestre
                    const contratosMap = new Map<string, { codigo: string; nome: string; totalHoras: number }>();

                    logsDrilldown.forEach(t => {
                      const cont = contratos.find(c => c.id === t.contract_id);
                      if (!cont) return;
                      
                      const duration = (new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000;
                      
                      if (!contratosMap.has(cont.id)) {
                        contratosMap.set(cont.id, {
                          codigo: cont.codigo,
                          nome: cont.nome,
                          totalHoras: 0
                        });
                      }
                      
                      const item = contratosMap.get(cont.id)!;
                      item.totalHoras += duration;
                    });

                    const listaConsolidada = Array.from(contratosMap.values()).sort((a, b) => b.totalHoras - a.totalHoras);

                    return (
                      <div className="mt-6 border-t pt-4 animate-in fade-in-50">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                            <History className="w-4 h-4" /> Consolidado por Contrato: {consNome}
                          </h4>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDrilldownConsultorId(null)}>
                            Fechar Detalhamento ✕
                          </Button>
                        </div>
                        <div className="border rounded-xl overflow-hidden bg-card max-h-60 overflow-y-auto w-full overflow-x-auto">
                          <table className="w-full text-xs text-left min-w-120">
                            <thead className="bg-muted/40 font-semibold text-muted-foreground sticky top-0">
                              <tr>
                                <th className="p-2.5 w-28">Código</th>
                                <th className="p-2.5">Nome do Contrato</th>
                                <th className="p-2.5 text-right w-28">Horas Totais</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {listaConsolidada.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum apontamento consolidado neste ciclo.</td>
                                </tr>
                              ) : listaConsolidada.map((item, idx) => (
                                <tr key={idx} className="hover:bg-muted/20">
                                  <td className="p-2.5 font-bold text-primary font-mono">{item.codigo}</td>
                                  <td className="p-2.5 font-medium text-foreground">{item.nome}</td>
                                  <td className="p-2.5 text-right font-mono font-bold text-primary">{item.totalHoras.toFixed(1)}h</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* VIEW: DASHBOARD GLOBAL (PAINEL DOS CONTRATOS) */}
        {menuAtivo === 'dash-global' && (
          <Card className="border-t-4 border-t-amber-500 shadow-sm min-h-125 w-full">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                <div>
                  <CardTitle className="text-lg">Painel dos Contratos (Saúde Financeira)</CardTitle>
                  <CardDescription>Visão geral de engenharia e custos dos contratos.</CardDescription>
                </div>
                <Button onClick={exportarMatrizGestao} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-8 shadow-sm">
                  <Download className="w-3.5 h-3.5" /> Exportar Visão Executiva (3 Colunas)
                </Button>
              </div>
              <div className="flex flex-col gap-4 mt-6 w-full">
                <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-md border w-fit">
                  <Label className="font-bold uppercase tracking-wider text-xs ml-2">Filtro de Modalidade:</Label>
                  {renderFiltroTiposContratoMultiplos()}
                </div>
                <div className="flex flex-wrap gap-3 p-4 bg-background border rounded-lg shadow-sm w-full">
                  <Select value={dashFonte} onValueChange={setDashFonte}><SelectTrigger className="w-32 h-9 text-xs bg-muted/40"><SelectValue placeholder="Divisão" /></SelectTrigger><SelectContent><SelectItem value="todas">EC + ET</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent></Select>
                  <div className="w-44">{renderFiltroContratosMultiplos()}</div>
                  
                  {dashVisaoTipos.includes('continuado_com_os') && (
                    <Select value={dashOs} onValueChange={setDashOs}>
                      <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Todas as OS" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as OS</SelectItem>
                        {osDashDisponiveis.map(o => <SelectItem key={o.id} value={o.id}>{o.codigo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  
                  <Select value={dashConsultor} onValueChange={setDashConsultor}>
                    <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Equipe..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Toda a Equipe</SelectItem>
                      {consultoresDashDisponiveis.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* 🌟 ITEM 13: Opção para alternar entre Ciclo Mensal ou Intervalo Personalizado (Contratos) */}
                  <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
                    <Button
                      size="sm"
                      type="button"
                      variant={modoDataFiltro === 'ciclo' ? 'default' : 'ghost'}
                      onClick={() => setModoDataFiltro('ciclo')}
                      className="h-7 text-xs px-2.5"
                    >
                      Por Ciclo
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant={modoDataFiltro === 'intervalo' ? 'default' : 'ghost'}
                      onClick={() => setModoDataFiltro('intervalo')}
                      className="h-7 text-xs px-2.5"
                    >
                      Por Intervalo
                    </Button>
                  </div>

                  {modoDataFiltro === 'ciclo' ? (
                    <>
                      <Select value={dashMes} onValueChange={setDashMes}>
                        <SelectTrigger className="w-28 h-9 text-xs border-primary/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={dashAno} onValueChange={setDashAno}>
                        <SelectTrigger className="w-20 h-9 text-xs border-primary/50"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                      </Select>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 animate-in fade-in-50">
                      <Input 
                        type="date" 
                        value={dataInicioCustom} 
                        onChange={e => setDataInicioCustom(e.target.value)} 
                        className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                      />
                      <span className="text-xs text-muted-foreground font-medium">até</span>
                      <Input 
                        type="date" 
                        value={dataFimCustom} 
                        onChange={e => setDataFimCustom(e.target.value)} 
                        className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                      />
                    </div>
                  )}

                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
                <div className="space-y-8">
                  {/* 🌟 ITENS 5 & 6: PAINEL EXECUTIVO CORPORATIVO — VISÃO GLOBAL (VIDA ÚTIL + CICLO) */}
                  {dashContratosSelecionados.length === 1 && (() => {
                    const cObj = contratos.find(c => c.id === dashContratosSelecionados[0]);
                    if (!cObj) return null;
                    
                    const isOverhead = cObj.tipo === 'overhead';

                    // 1. Teto Base do Contrato: usa teto_global_horas SE cadastrado; se <= 0, usa a Linha de Base (Matriz)
                    const tetoLinhaBase = getTetoBaseContrato(cObj.id);
                    const tetoContratoBase = Number(cObj.teto_global_horas > 0 ? cObj.teto_global_horas : tetoLinhaBase);

                    // 2. Total Alocado (Vida Útil) — ignora somatório fantasma se for Overhead
                    const totalAlocadoVida = isOverhead ? 0 : (allAlocacoes || [])
                      .filter(a => a.contract_id === cObj.id && a.atividade !== 'Preço Fechado (Medição)' && osList.find(o => o.id === a.os_id)?.codigo !== '🛠️ Pequenos Suportes')
                      .reduce((sum, a) => sum + Number(a.horas_disponiveis || 0), 0);

                    // 3. Indicadores da VIDA ÚTIL
                    const gastoVidaUtil = allTimesheets
                      .filter(t => t.contract_id === cObj.id)
                      .reduce((sum, t) => sum + ((new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000), 0);
                    
                    const saldoVidaUtil = (isOverhead || tetoContratoBase <= 0) ? 0 : (tetoContratoBase - gastoVidaUtil);
                    const percVidaUtil = isOverhead ? '100' : (tetoContratoBase > 0 ? ((gastoVidaUtil / tetoContratoBase) * 100).toFixed(1) : '0.0');

                    // 4. CÁLCULO DO CICLO (Tratando OS Ilimitada, Suportes e Overhead)
                    const cycleBounds = getEffectiveBounds(cObj.ciclo_inicio, cObj.ciclo_fim, dashMes, dashAno);
                    const fTimesCiclo = allTimesheets.filter(t => t.contract_id === cObj.id && (dashOs !== 'todas' ? t.os_id === dashOs : true) && new Date(t.start_at).getTime() >= cycleBounds.start && new Date(t.start_at).getTime() <= cycleBounds.end);
                    const fAlocsCiclo = allAlocacoes.filter(a => a.contract_id === cObj.id && (dashOs !== 'todas' ? a.os_id === dashOs : true) && a.mes === dashMes && a.ano === dashAno);
                    
                    const gastoCiclo = fTimesCiclo.reduce((sum, t) => sum + ((new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000), 0);
                    
                    const osSelecionadaObj = osList.find(o => o.id === dashOs);
                    const isOsIlimitada = osSelecionadaObj?.codigo === '🛠️ Pequenos Suportes';
                    const isCicloTotalmenteIlimitado = isOverhead || isOsIlimitada;

                    let orcadoCiclo = 0;
                    if (isCicloTotalmenteIlimitado) {
                      orcadoCiclo = gastoCiclo;
                    } else {
                      const alocadoFixoCiclo = fAlocsCiclo
                        .filter(a => a.atividade !== 'Preço Fechado (Medição)' && osList.find(o => o.id === a.os_id)?.codigo !== '🛠️ Pequenos Suportes')
                        .reduce((sum, a) => sum + Number(a.horas_disponiveis || 0), 0);
                      
                      const gastoEmSuportesCiclo = fTimesCiclo
                        .filter(t => osList.find(o => o.id === t.os_id)?.codigo === '🛠️ Pequenos Suportes')
                        .reduce((sum, t) => sum + ((new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000), 0);

                      orcadoCiclo = alocadoFixoCiclo + gastoEmSuportesCiclo;
                    }

                    const saldoCiclo = isCicloTotalmenteIlimitado ? 0 : (orcadoCiclo - gastoCiclo);
                    const percCiclo = orcadoCiclo > 0 ? ((gastoCiclo / orcadoCiclo) * 100).toFixed(1) : '0.0';

                    return (
                      <div className="bg-linear-to-r from-blue-600/15 via-blue-600/5 to-transparent border border-blue-500/30 dark:border-blue-500/20 rounded-2xl p-6 mb-6 shadow-sm animate-in fade-in-50">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-4 mb-5">
                          <div>
                            <Badge className="bg-blue-600 text-white hover:bg-blue-700 font-mono uppercase text-[10px] mb-1.5 shadow-xs border-none">
                              VISÃO GLOBAL
                            </Badge>
                            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                              <span>Contrato: <span className="text-blue-600 dark:text-blue-400 font-mono">{cObj.codigo}</span></span>
                              <span className="text-muted-foreground font-normal text-sm">— {cObj.nome}</span>
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isOverhead
                                ? "Contrato institucional do tipo Overhead (Sem controle de teto ou limite de horas)."
                                : (cObj.teto_global_horas > 0 
                                  ? "Teto Global fixado em cadastro de contrato." 
                                  : "Teto Global balizado pela última versão da Linha de Base (Matriz).")}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 bg-background/60 dark:bg-muted/30 px-4 py-2.5 rounded-xl border border-blue-500/20 shadow-xs">
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Avanço Vida Útil</span>
                              <span className="font-black text-blue-600 dark:text-blue-400 text-xl font-mono">
                                {isOverhead ? '100%' : `${percVidaUtil}%`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* GRID EXECUTIVO DE 8 INDICADORES */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                          {/* BLOCO VIDA ÚTIL */}
                          <div className="bg-background/50 dark:bg-muted/20 p-3 rounded-xl border border-border/40">
                            <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Total Contrato (Base)</span>
                            <span className="font-bold text-foreground text-base font-mono mt-0.5 block">
                              {isOverhead ? (
                                <span className="text-amber-500 flex items-center gap-1 text-sm"><Wrench className="w-3.5 h-3.5"/> Dinâmico</span>
                              ) : (tetoContratoBase > 0 ? `${tetoContratoBase.toFixed(1)}h` : "0.0h")}
                            </span>
                          </div>

                          <div className="bg-background/50 dark:bg-muted/20 p-3 rounded-xl border border-border/40">
                            <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Total Alocado (Vida)</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-base font-mono mt-0.5 block">
                              {isOverhead ? (
                                <span className="text-amber-500 flex items-center gap-1 text-sm"><Wrench className="w-3.5 h-3.5"/> Dinâmico</span>
                              ) : (totalAlocadoVida > 0 ? `${totalAlocadoVida.toFixed(1)}h` : "0.0h")}
                            </span>
                          </div>

                          <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/15">
                            <span className="text-[10px] text-red-600/80 dark:text-red-400 uppercase block font-semibold">Consumido (Vida Útil)</span>
                            <span className="font-bold text-red-600 dark:text-red-400 text-base font-mono mt-0.5 block">
                              {gastoVidaUtil.toFixed(1)}h
                            </span>
                          </div>

                          <div className="bg-green-500/5 p-3 rounded-xl border border-green-500/15">
                            <span className="text-[10px] text-green-700 dark:text-green-400 uppercase block font-semibold">Saldo (Vida Útil)</span>
                            <span className={`font-bold text-base font-mono mt-0.5 block ${isOverhead ? 'text-amber-500' : (saldoVidaUtil < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400')}`}>
                              {isOverhead ? (
                                <span className="flex items-center gap-1 text-sm"><Wrench className="w-3.5 h-3.5"/> Livre</span>
                              ) : `${saldoVidaUtil.toFixed(1)}h`}
                            </span>
                          </div>

                          {/* BLOCO DO CICLO SELECIONADO */}
                          <div className="bg-muted/10 p-3 rounded-xl border border-border/30">
                            <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Orçado no Ciclo</span>
                            <span className="font-bold text-foreground/90 text-base font-mono mt-0.5 flex items-center gap-1">
                              {isCicloTotalmenteIlimitado ? (
                                <span className="text-amber-500 flex items-center gap-1 text-sm"><Wrench className="w-3.5 h-3.5"/> Dinâmico</span>
                              ) : `${orcadoCiclo.toFixed(1)}h`}
                            </span>
                          </div>

                          <div className="bg-muted/10 p-3 rounded-xl border border-border/30">
                            <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Consumido no Ciclo</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-base font-mono mt-0.5 block">
                              {gastoCiclo.toFixed(1)}h
                            </span>
                          </div>

                          <div className="bg-muted/10 p-3 rounded-xl border border-border/30">
                            <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Saldo no Ciclo (Mês)</span>
                            <span className={`font-bold text-base font-mono mt-0.5 block ${isCicloTotalmenteIlimitado ? 'text-amber-500' : (saldoCiclo < 0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400')}`}>
                              {isCicloTotalmenteIlimitado ? (
                                <span className="flex items-center gap-1 text-sm"><Wrench className="w-3.5 h-3.5"/> Livre</span>
                              ) : `${saldoCiclo.toFixed(1)}h`}
                            </span>
                          </div>

                          <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/15">
                            <span className="text-[10px] text-blue-600/80 dark:text-blue-400 uppercase block font-semibold">Avanço no Ciclo (%)</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 text-base font-mono mt-0.5 block">
                              {isCicloTotalmenteIlimitado ? '100%' : `${percCiclo}%`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full">
                    <div className="space-y-4 w-full">
                      <div className="border p-4 rounded-xl bg-muted/10"><p className="text-[10px] font-bold text-muted-foreground uppercase">Budget Total Alocado</p><p className="text-3xl font-bold font-mono mt-0.5">{dashData.orcadoGlobal.toFixed(1)}h</p></div>
                      <div className="border p-4 rounded-xl bg-red-500/5 border-red-500/10"><p className="text-[10px] font-bold text-red-600 uppercase">Horas Consumidas</p><p className="text-3xl font-bold font-mono text-red-600 mt-0.5">{dashData.gastoGlobal.toFixed(1)}h</p></div>
                      <div className={`border p-4 rounded-xl ${dashData.saldoGlobal < 0 ? 'bg-red-500/10 border-red-500/20 text-red-600' : 'bg-green-500/5 border-green-500/10 text-green-600'}`}><p className="text-[10px] font-bold uppercase">Saldo em Conta</p><p className="text-3xl font-bold font-mono mt-0.5">{dashData.saldoGlobal.toFixed(1)}h</p></div>
                    </div>
                    <div className="h-80 w-full flex flex-col items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={dashData.pieData} innerRadius={85} outerRadius={115} paddingAngle={4} dataKey="value" stroke="none">
                            {dashData.pieData.map((entry, index) => {
                              let color = "#e2e8f0"; 
                              if (entry.name === 'Consumido') color = "#ef4444"; 
                              if (entry.name === 'Saldo Restante') color = "#22c55e"; 
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                          </Pie>
                          <RechartsTooltip wrapperStyle={{zIndex: 100}} formatter={(v: number) => [`${v.toFixed(1)}h`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center pointer-events-none z-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Consumo</p>
                        <p className="text-2xl font-black text-primary mt-0.5">{dashData.percentualGlobal}%</p>
                      </div>
                    </div>
                  </div>

                  {/* 🌟 TABELA EXECUTIVA DE SAÚDE POR CONSULTOR (VIDA ÚTIL + CICLO) */}
                  {(dashContratosSelecionados.length === 1 || (dashOs !== 'todas' && dashOs !== '')) && dashConsultor === 'todos' && (
                     <Card className="shadow-sm border-border/80 dark:border-slate-800">
                        <CardHeader className="bg-muted/30 pb-3 border-b border-border/60">
                           <CardTitle className="text-sm flex items-center gap-2 text-foreground font-bold">
                             <Users className="w-4 h-4 text-primary" /> Equipe Alocada no Projeto {contratos.find(c=>c.id === dashContratosSelecionados[0])?.codigo} — Desempenho Completo
                           </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                           <div className="w-full overflow-x-auto">
                             <table className="w-full text-xs text-left min-w-190">
                                <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground font-semibold border-b">
                                   <tr>
                                      <th className="px-4 py-3">Engenheiro(a)</th>
                                      <th className="px-3 py-3 text-right">Teto Base (Vida)</th>
                                      <th className="px-3 py-3 text-right">Consumido (Vida)</th>
                                      <th className="px-3 py-3 text-right">Saldo (Vida)</th>
                                      <th className="px-3 py-3 text-right">% Avanço</th>
                                      <th className="px-3 py-3 text-right bg-muted/30">Orçado (Ciclo)</th>
                                      <th className="px-3 py-3 text-right bg-muted/30">Consumido (Ciclo)</th>
                                      <th className="px-4 py-3 text-right bg-muted/30">Saldo (Ciclo)</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                   {(() => {
                                      const cid = dashContratosSelecionados.length === 1 ? dashContratosSelecionados[0] : osList.find(o => o.id === dashOs)?.contract_id;
                                      if(!cid) return null;
                                      const cObj = contratos.find(c => c.id === cid);
                                      if(!cObj) return null;
                                      const cb = getEffectiveBounds(cObj.ciclo_inicio, cObj.ciclo_fim, dashMes, dashAno);
                                      
                                      const fTimesCiclo = allTimesheets.filter(t => t.contract_id === cid && (dashOs !== 'todas' ? t.os_id === dashOs : true) && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
                                      const fAlocsCiclo = allAlocacoes.filter(a => a.contract_id === cid && (dashOs !== 'todas' ? a.os_id === dashOs : true) && a.mes === dashMes && a.ano === dashAno);
                                      
                                      const now = new Date(); const currentDay = now.getDate(); let m = now.getMonth(); let y = now.getFullYear();
                                      if (cObj.ciclo_inicio > cObj.ciclo_fim && currentDay >= cObj.ciclo_inicio) { m = m === 11 ? 0 : m + 1; if (m === 0) y++; }
                                      const dM = parseInt(dashMes); const dA = parseInt(dashAno);
                                      const isPast = (dA < y) || (dA === y && dM < m);

                                      const rows = consultores.map(c => {
                                        const uTimesCiclo = fTimesCiclo.filter(t => t.user_id === c.id);
                                        const uAlocsCiclo = fAlocsCiclo.filter(a => a.user_id === c.id);
                                        
                                        const isFechado = cObj.tipo === 'fechado' || uAlocsCiclo.some(a => a.atividade === 'Preço Fechado (Medição)');
                                        
                                        // --- 1. INDICADORES DA VIDA ÚTIL DO CONSULTOR ---
                                        const uTetoBase = getTetoBaseContrato(cid, c.id);
                                        const uGastoVida = allTimesheets
                                          .filter(t => t.user_id === c.id && t.contract_id === cid && (dashOs !== 'todas' ? t.os_id === dashOs : true))
                                          .reduce((sum, t) => sum + ((new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000), 0);
                                        const uSaldoVida = uTetoBase > 0 ? (uTetoBase - uGastoVida) : 0;
                                        const uPercVida = uTetoBase > 0 ? ((uGastoVida / uTetoBase) * 100).toFixed(1) : '0.0';

                                        // --- 2. INDICADORES DO CICLO SELECIONADO ---
                                        let uGastoCiclo = 0; let uOrcadoCiclo = 0; let hasIlim = false;

                                        if (isFechado) {
                                            const pM = parseInt(dashMes); const pA = parseInt(dashAno);
                                            uOrcadoCiclo = allMedicoes.find(m => m.user_id === c.id && m.contract_id === cid && (dashOs !== 'todas' ? m.os_id === dashOs : true) && m.mes === dashMes && m.ano === dashAno)?.percentual || 0;
                                            uGastoCiclo = allMedicoes.filter(m => {
                                                if (m.user_id !== c.id || m.contract_id !== cid) return false;
                                                if (dashOs !== 'todas' && m.os_id !== dashOs) return false;
                                                const mA = parseInt(m.ano); const mM = parseInt(m.mes);
                                                return mA < pA || (mA === pA && mM < pM);
                                            }).reduce((sum, m) => sum + m.percentual, 0);
                                        } else {
                                            uGastoCiclo = uTimesCiclo.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                                            uAlocsCiclo.forEach(a => {
                                              const osObj = osList.find(o => o.id === a.os_id);
                                              const isSuportes = osObj?.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'overhead'].includes(cObj.tipo);
                                              if (isSuportes) {
                                                 hasIlim = true;
                                                 const tAtiv = uTimesCiclo.filter(t => t.activity === a.atividade && (a.os_id ? t.os_id === a.os_id : true));
                                                 uOrcadoCiclo += tAtiv.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                                              } else {
                                                 if (isPast) {
                                                   const tAtiv = uTimesCiclo.filter(t => t.activity === a.atividade && (a.os_id ? t.os_id === a.os_id : true));
                                                   uOrcadoCiclo += tAtiv.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                                                 } else {
                                                   uOrcadoCiclo += Number(a.horas_disponiveis);
                                                 }
                                              }
                                            });
                                            if (uAlocsCiclo.length === 0) {
                                               const tSup = uTimesCiclo.filter(t => osList.find(o => o.id === t.os_id)?.codigo === '🛠️ Pequenos Suportes');
                                               if (tSup.length > 0) {
                                                  hasIlim = true;
                                                  uOrcadoCiclo += tSup.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                                               }
                                            }
                                        }
                                        
                                        // Esconde o consultor apenas se não tiver absolutamente nenhum número (nem vida, nem ciclo)
                                        if (uTetoBase === 0 && uGastoVida === 0 && uOrcadoCiclo === 0 && uGastoCiclo === 0) return null;

                                        return (
                                          <tr key={c.id} className="hover:bg-muted/20 transition-colors font-mono">
                                            <td className="px-4 py-3 font-semibold font-sans text-foreground">{c.nome}</td>
                                            
                                            {/* VIDA ÚTIL */}
                                            <td className="px-3 py-3 text-right text-foreground/80">
                                              {cObj.tipo === 'overhead' ? (
                                                <span className="flex justify-end text-amber-500"><Wrench className="w-3.5 h-3.5"/></span>
                                              ) : (uTetoBase > 0 ? `${uTetoBase.toFixed(1)}h` : "-")}
                                            </td>
                                            <td className="px-3 py-3 text-right text-red-600 font-bold">{uGastoVida.toFixed(1)}h</td>
                                            <td className={`px-3 py-3 text-right font-bold ${uSaldoVida < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                              {cObj.tipo === 'overhead' ? (
                                                <span className="flex justify-end text-amber-500"><Wrench className="w-3.5 h-3.5"/></span>
                                              ) : (uTetoBase > 0 ? `${uSaldoVida.toFixed(1)}h` : "-")}
                                            </td>
                                            <td className="px-3 py-3 text-right font-black text-primary">
                                              {cObj.tipo === 'overhead' ? '-' : `${uPercVida}%`}
                                            </td>

                                            {/* CICLO SELECIONADO */}
                                            <td className="px-3 py-3 text-right text-muted-foreground bg-muted/10">{isFechado ? `${uOrcadoCiclo.toFixed(1)}%` : (hasIlim ? <span className="flex justify-end text-amber-500"><Wrench className="w-3 h-3"/></span> : `${uOrcadoCiclo.toFixed(1)}h`)}</td>
                                            <td className={`px-3 py-3 text-right font-bold bg-muted/10 ${isFechado ? 'text-primary' : 'text-red-500'}`}>{isFechado ? `${uGastoCiclo.toFixed(1)}%` : `${uGastoCiclo.toFixed(1)}h`}</td>
                                            <td className={`px-4 py-3 text-right font-bold bg-muted/10 ${hasIlim ? 'text-amber-500' : (isFechado ? (100 - uOrcadoCiclo - uGastoCiclo < 0 ? 'text-red-500' : 'text-blue-600') : (uOrcadoCiclo - uGastoCiclo < 0 ? 'text-red-500' : 'text-blue-600'))}`}>
                                              {isFechado ? `${(100 - uOrcadoCiclo - uGastoCiclo).toFixed(1)}%` : (hasIlim ? <span className="flex justify-end"><Wrench className="w-3 h-3"/></span> : `${(uOrcadoCiclo - uGastoCiclo).toFixed(1)}h`)}
                                            </td>
                                          </tr>
                                        );
                                      });
                                      return rows.every(r=>r===null) ? <tr><td colSpan={8} className="text-center py-6 text-muted-foreground text-xs font-sans">Nenhum consultor alocado na Linha de Base ou com apontamentos neste contrato.</td></tr> : rows;
                                   })()}
                                </tbody>
                             </table>
                           </div>
                        </CardContent>
                     </Card>
                  )}

                  {dashConsultor !== 'todos' && (
                     <Card className="shadow-sm border-blue-500/20">
                        <CardHeader className="bg-blue-500/5 pb-3">
                           <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                             <Briefcase className="w-4 h-4" /> Detalhamento de Atividades - {consultores.find(c=>c.id===dashConsultor)?.nome}
                           </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                           <table className="w-full text-sm text-left">
                              <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
                                 <tr>
                                    <th className="px-4 py-3">Contrato / Escopo de Atuação</th>
                                    <th className="px-4 py-3 text-right">Orçado</th>
                                    <th className="px-4 py-3 text-right">Gasto</th>
                                    <th className="px-4 py-3 text-right">Saldo</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y text-xs">
                                 {(() => {
                                    const uid = dashConsultor;
                                    let fTimes = allTimesheets.filter(t => t.user_id === uid && contratosVisao.some(cv => cv.id === t.contract_id));
                                    let fAlocs = allAlocacoes.filter(a => a.user_id === uid && a.mes === dashMes && a.ano === dashAno && contratosVisao.some(cv => cv.id === a.contract_id));
                                    if (dashContratosSelecionados.length > 0) {
                                      fTimes = fTimes.filter(t => dashContratosSelecionados.includes(t.contract_id));
                                      fAlocs = fAlocs.filter(a => dashContratosSelecionados.includes(a.contract_id));
                                    }
                                    const now = new Date(); const currentDay = now.getDate(); let m = now.getMonth(); let y = now.getFullYear();
                                    const dM = parseInt(dashMes); const dA = parseInt(dashAno);

                                    const rows = fAlocs.map((a, idx) => {
                                      const cObj = contratos.find(c => c.id === a.contract_id);
                                      if (!cObj) return null;
                                      const cb = getCycleBoundsForContract(cObj.ciclo_inicio, cObj.ciclo_fim, dashMes, dashAno);
                                      
                                      let mm = m; let yy = y;
                                      if (cObj.ciclo_inicio > cObj.ciclo_fim && currentDay >= cObj.ciclo_inicio) { mm = mm === 11 ? 0 : mm + 1; if (mm === 0) yy++; }
                                      const cIsPast = (dA < yy) || (dA === yy && dM < mm);

                                      const osObj = osList.find(o => o.id === a.os_id);
                                      const isFechado = a.atividade === 'Preço Fechado (Medição)' || cObj.tipo === 'fechado';
                                      
                                      let orcado = 0; let gasto = 0; let isSuportes = false;

                                      if (isFechado) {
                                          const pM = parseInt(dashMes); const pA = parseInt(dashAno);
                                          orcado = allMedicoes.find(med => med.user_id === uid && med.contract_id === a.contract_id && (a.os_id ? med.os_id === a.os_id : true) && med.mes === dashMes && med.ano === dashAno)?.percentual || 0;
                                          gasto = allMedicoes.filter(med => {
                                              if (med.user_id !== uid || med.contract_id !== a.contract_id) return false;
                                              if (a.os_id && med.os_id !== a.os_id) return false;
                                              const mA = parseInt(med.ano); const mM = parseInt(med.mes);
                                              return mA < pA || (mA === pA && mM < pM);
                                          }).reduce((sum, med) => sum + med.percentual, 0);
                                      } else {
                                          let tAtiv = fTimes.filter(t => t.contract_id === a.contract_id && t.activity === a.atividade && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
                                          if (a.os_id) tAtiv = tAtiv.filter(t => t.os_id === a.os_id);
                                          gasto = tAtiv.reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                                          
                                          isSuportes = osObj?.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'overhead'].includes(cObj.tipo);
                                          if (isSuportes) orcado = gasto;
                                          else {
                                            if (cIsPast) orcado = gasto;
                                            else orcado = Number(a.horas_disponiveis);
                                          }
                                      }

                                      if (orcado === 0 && gasto === 0) return null;

                                      return { contrato: cObj.codigo, nomeContrato: cObj.nome, os: osObj?.codigo || '-', atividade: a.atividade, orcado, gasto, ilimitado: isSuportes, isFechado };
                                    });

                                    const validRows = rows.filter(r => r !== null);
                                    if(validRows.length === 0) return <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Sem atividades neste ciclo.</td></tr>;

                                    const agrupado = validRows.reduce((acc: any, row: any) => {
                                       const key = `${row.contrato}|${row.os}|${row.nomeContrato}`;
                                       if (!acc[key]) acc[key] = { contrato: row.contrato, nomeContrato: row.nomeContrato, os: row.os, itens: [] };
                                       acc[key].itens.push(row);
                                       return acc;
                                    }, {});

                                    return Object.values(agrupado).map((grupo: any, i) => (
                                       <React.Fragment key={i}>
                                          <tr className="bg-muted/30 border-y">
                                             <td colSpan={4} className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                   <FolderTree className="w-4 h-4 text-blue-600" />
                                                   <span className="font-bold text-blue-700">{grupo.contrato}</span>
                                                   {grupo.os !== '-' && <span className="text-[10px] uppercase font-bold bg-blue-500/10 text-blue-700 px-1.5 py-0.5 rounded">OS: {grupo.os}</span>}
                                                   <span className="text-xs text-muted-foreground truncate max-w-44 ml-1">{grupo.nomeContrato}</span>
                                                </div>
                                             </td>
                                          </tr>
                                          {grupo.itens.map((item: any, j: number) => (
                                             <tr key={`${i}-${j}`} className={`hover:bg-muted/10 transition-colors border-l-2 border-l-transparent hover:border-l-blue-500 ${item.isFechado ? 'bg-green-500/5' : ''}`}>
                                                <td className={`px-4 py-2 pl-10 font-medium text-xs ${item.isFechado ? 'text-green-700 flex items-center gap-1.5' : 'text-foreground/80'}`}>
                                                   {item.isFechado && <Check className="w-3.5 h-3.5"/>}
                                                   {item.isFechado ? 'Medição de Avanço (%)' : item.atividade}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                                                   {item.isFechado ? `${item.orcado.toFixed(1)}%` : (item.ilimitado ? <span className="flex justify-end text-amber-500"><Wrench className="w-3 h-3"/></span> : `${item.orcado.toFixed(1)}h`)}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-mono font-bold ${item.isFechado ? 'text-primary' : 'text-red-500'}`}>
                                                   {item.isFechado ? `${item.gasto.toFixed(1)}%` : `${item.gasto.toFixed(1)}h`}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-mono font-bold ${item.ilimitado ? 'text-amber-500' : (item.isFechado ? (100 - item.orcado - item.gasto < 0 ? 'text-red-500' : 'text-blue-600') : (item.orcado - item.gasto < 0 ? 'text-red-500' : 'text-blue-600'))}`}>
                                                   {item.isFechado ? `${(100 - item.orcado - item.gasto).toFixed(1)}%` : (item.ilimitado ? <span className="flex justify-end"><Wrench className="w-3 h-3"/></span> : `${(item.orcado - item.gasto).toFixed(1)}h`)}
                                                </td>
                                             </tr>
                                          ))}
                                       </React.Fragment>
                                    ));
                                 })()}
                              </tbody>
                           </table>
                        </CardContent>
                     </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* VIEW: DASHBOARD DE FATURAMENTO - CLIENTES */}
        {menuAtivo === 'faturamento-cliente' && (
          <Card className="border-t-4 border-t-amber-600 shadow-sm min-h-125 w-full">
            <CardHeader className="bg-amber-600/5 border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                <div><CardTitle className="text-lg text-amber-700 flex items-center gap-2"><Receipt className="w-5 h-5"/> Extração de Horas (Cliente)</CardTitle><CardDescription>Volume comercial consolidado com base no calendário de faturamento acordado.</CardDescription></div>
                <Button onClick={() => exportarExcel(true)} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"><Download className="w-4 h-4" /> Exportar Planilha de Cobrança</Button>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 items-center bg-background p-2.5 rounded-lg border shadow-sm w-full">
                {renderFiltroTiposContratoMultiplos(true)}
                <Select value={fatFonte} onValueChange={setFatFonte}><SelectTrigger className="w-32 h-8 text-xs bg-muted/40"><SelectValue placeholder="Divisão" /></SelectTrigger><SelectContent><SelectItem value="todas">EC + ET</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent></Select>
                <div className="w-44">{renderFiltroContratosMultiplos(true)}</div>
                {/* 🌟 ITEM 13: Opção para alternar entre Ciclo Mensal ou Intervalo Personalizado (Faturamento) */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
                  <Button
                    size="sm"
                    type="button"
                    variant={modoDataFiltro === 'ciclo' ? 'default' : 'ghost'}
                    onClick={() => setModoDataFiltro('ciclo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Ciclo
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant={modoDataFiltro === 'intervalo' ? 'default' : 'ghost'}
                    onClick={() => setModoDataFiltro('intervalo')}
                    className="h-7 text-xs px-2.5"
                  >
                    Por Intervalo
                  </Button>
                </div>

                {modoDataFiltro === 'ciclo' ? (
                  <>
                    <Select value={fatMes} onValueChange={setFatMes}>
                      <SelectTrigger className="w-28 h-8 text-xs border-amber-500/50"><SelectValue /></SelectTrigger>
                      <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={fatAno} onValueChange={setFatAno}>
                      <SelectTrigger className="w-20 h-8 text-xs border-amber-500/50"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                    </Select>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 animate-in fade-in-50">
                    <Input 
                        type="date" 
                        value={dataInicioCustom} 
                        onChange={e => setDataInicioCustom(e.target.value)} 
                        className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                      />
                      <span className="text-xs text-muted-foreground font-medium">até</span>
                      <Input 
                        type="date" 
                        value={dataFimCustom} 
                        onChange={e => setDataFimCustom(e.target.value)} 
                        className="h-9 text-xs w-32 sm:w-40 px-2.5 font-mono bg-background shadow-xs" 
                      />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {loadingDash ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
              ) : fatData.consultoresPagamento.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-12">Nenhum registro faturável neste ciclo.</div>
              ) : (
                <>
                  <div className="w-full h-95">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={fatData.consultoresPagamento}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onClick={(state) => {
                          const clickedId = state?.activePayload?.[0]?.payload?.id;
                          if (clickedId) {
                            setDrilldownConsultorId(prev => prev === clickedId ? null : clickedId);
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                        <XAxis dataKey="nomeCurto" tickLine={false} axisLine={false} style={{fontSize: '11px'}} />
                        <YAxis tickLine={false} axisLine={false} style={{fontSize: '11px'}} tickFormatter={(v) => `${v}h`} />
                        <RechartsTooltip cursor={{fill: '#88888811'}} contentStyle={{borderRadius: '8px'}} wrapperStyle={{zIndex: 100}} formatter={(v: number) => [`${v} horas faturáveis`, 'Para Cliente']} />
                        <Bar dataKey="valorGrafico" radius={[4, 4, 0, 0]} maxBarSize={55} cursor="pointer">
                          {fatData.consultoresPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill="#d97706" />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 🌟 DRILL-DOWN CONSOLIDADO POR CONTRATO (FATURAMENTO CLIENTE) */}
                  {drilldownConsultorId && (() => {
                    const consNome = consultores.find(c => c.id === drilldownConsultorId)?.nome || 'Consultor';
                    const logsDrilldown = allTimesheets.filter(t => {
                      if (t.user_id !== drilldownConsultorId) return false;
                      const cont = contratos.find(c => c.id === t.contract_id);
                      if (!cont) return false;
                      return isWithinCycle(t.start_at, fatMes, fatAno, cont.ciclo_fat_inicio, cont.ciclo_fat_fim);
                    });

                    // Agrupamento consolidado por Contrato Mestre (Faturamento)
                    const contratosMap = new Map<string, { codigo: string; nome: string; totalHoras: number }>();

                    logsDrilldown.forEach(t => {
                      const cont = contratos.find(c => c.id === t.contract_id);
                      if (!cont) return;
                      
                      const duration = (new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000;
                      
                      if (!contratosMap.has(cont.id)) {
                        contratosMap.set(cont.id, {
                          codigo: cont.codigo,
                          nome: cont.nome,
                          totalHoras: 0
                        });
                      }
                      
                      const item = contratosMap.get(cont.id)!;
                      item.totalHoras += duration;
                    });

                    const listaConsolidada = Array.from(contratosMap.values()).sort((a, b) => b.totalHoras - a.totalHoras);

                    return (
                      <div className="mt-6 border-t pt-4 animate-in fade-in-50">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-sm text-amber-700 dark:text-amber-500 flex items-center gap-2">
                            <Receipt className="w-4 h-4" /> Consolidado Comercial (Cliente): {consNome}
                          </h4>
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDrilldownConsultorId(null)}>
                            Fechar Detalhamento ✕
                          </Button>
                        </div>
                        <div className="border rounded-xl overflow-hidden bg-card max-h-60 overflow-y-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted/40 font-semibold text-muted-foreground sticky top-0">
                              <tr>
                                <th className="p-2.5 w-28">Código</th>
                                <th className="p-2.5">Nome do Contrato</th>
                                <th className="p-2.5 text-right w-36">Horas Faturáveis</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {listaConsolidada.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum apontamento comercial consolidado neste ciclo.</td>
                                </tr>
                              ) : listaConsolidada.map((item, idx) => (
                                <tr key={idx} className="hover:bg-muted/20">
                                  <td className="p-2.5 font-bold text-amber-700 dark:text-amber-500 font-mono">{item.codigo}</td>
                                  <td className="p-2.5 font-medium text-foreground">{item.nome}</td>
                                  <td className="p-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{item.totalHoras.toFixed(1)}h</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ========================================================= */}
          {/* 🌟 RADAR DE ALERTAS EXECUTIVOS — GOVERNANÇA (DIEGO & RUAN)  */}
          {/* ========================================================= */}
          {menuAtivo === 'alertas' && (() => {
            const listaAlertasContratos: any[] = [];
            const listaAlertasConsultores: any[] = [];

            // --- 1. ALERTAS DE VIDA ÚTIL DO CONTRATO / OS (50% e 80%) ---
            contratos.filter(c => c.status_ativo && c.tipo !== 'overhead').forEach(c => {
              const tetoBase = Number(c.teto_global_horas > 0 ? c.teto_global_horas : getTetoBaseContrato(c.id));
              const gastoVida = allTimesheets
                .filter(t => t.contract_id === c.id)
                .reduce((sum, t) => sum + ((new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000), 0);

              if (tetoBase > 0) {
                const perc = (gastoVida / tetoBase) * 100;
                if (perc >= 80) {
                  listaAlertasContratos.push({
                    tipo: 'critico',
                    titulo: `Contrato em Risco de Estouro (80%): ${c.codigo}`,
                    desc: `Consumido ${gastoVida.toFixed(1)}h de ${tetoBase.toFixed(1)}h (${perc.toFixed(1)}%). Avaliar fechamento ou aditivo.`,
                    contractId: c.id
                  });
                } else if (perc >= 50) {
                  listaAlertasContratos.push({
                    tipo: 'atencao',
                    titulo: `Checkpoint de Contrato (50%): ${c.codigo}`,
                    desc: `Consumido ${gastoVida.toFixed(1)}h de ${tetoBase.toFixed(1)}h (${perc.toFixed(1)}%). Checar se a entrega está nos trilhos.`,
                    contractId: c.id
                  });
                }
              }

              // Se for Assessoria (continuado_com_os), checa também cada OS individualmente
              if (c.tipo === 'continuado_com_os') {
                osList.filter(o => o.contract_id === c.id && o.status_ativa && o.codigo !== '🛠️ Pequenos Suportes').forEach(os => {
                  const prevOs = Number(os.horas_previstas || 0);
                  const gastoOs = allTimesheets
                    .filter(t => t.os_id === os.id)
                    .reduce((sum, t) => sum + ((new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()) / 3600000), 0);

                  if (prevOs > 0) {
                    const percOs = (gastoOs / prevOs) * 100;
                    if (percOs >= 80) {
                      listaAlertasContratos.push({
                        tipo: 'critico',
                        titulo: `OS em Risco (80%): ${os.codigo} — ${c.codigo}`,
                        desc: `Demanda consumiu ${gastoOs.toFixed(1)}h de ${prevOs.toFixed(1)}h (${percOs.toFixed(1)}%).`,
                        contractId: c.id,
                        osId: os.id
                      });
                    } else if (percOs >= 50) {
                      listaAlertasContratos.push({
                        tipo: 'atencao',
                        titulo: `Checkpoint de OS (50%): ${os.codigo} — ${c.codigo}`,
                        desc: `Demanda consumiu ${gastoOs.toFixed(1)}h de ${prevOs.toFixed(1)}h (${percOs.toFixed(1)}%).`,
                        contractId: c.id,
                        osId: os.id
                      });
                    }
                  }
                });
              }
            });

            // --- 2. ALERTAS DE CONSUMO DA EQUIPE (NO CICLO ATUAL) ---
            const agora = new Date();
            let mesAtualNum = agora.getMonth();
            let anoAtualNum = agora.getFullYear();
            
            // Lógica do Ciclo Engeprice: Passou do dia 25, já estamos no ciclo do mês seguinte
            if (agora.getDate() >= 25) {
              mesAtualNum = mesAtualNum === 11 ? 0 : mesAtualNum + 1;
              if (mesAtualNum === 0) anoAtualNum++;
            }
            const sMes = mesAtualNum.toString();
            const sAno = anoAtualNum.toString();

            // Cálculo do avanço temporal do ciclo (Dia 25 a Dia 24)
            let mesInicio = agora.getMonth();
            let anoInicio = agora.getFullYear();
            if (agora.getDate() < 25) {
                mesInicio = mesInicio === 0 ? 11 : mesInicio - 1;
                if (mesInicio === 11) anoInicio--;
            }
            const dataInicioCiclo = new Date(anoInicio, mesInicio, 25, 0, 0, 0).getTime();
            let mesFim = mesInicio === 11 ? 0 : mesInicio + 1;
            let anoFim = mesInicio === 11 ? anoInicio + 1 : anoInicio;
            const dataFimCiclo = new Date(anoFim, mesFim, 24, 23, 59, 59, 999).getTime();
            
            const tempoTotalCiclo = dataFimCiclo - dataInicioCiclo;
            const tempoDecorrido = agora.getTime() - dataInicioCiclo;
            const avancoCicloPerc = Math.min(100, Math.max(0, (tempoDecorrido / tempoTotalCiclo) * 100));

            consultores.filter(u => u.status_ativo).forEach(u => {
              let orcadoTotal = 0;
              let gastoTotal = 0;

              // Agrupa todos os contratos que o consultor interagiu neste ciclo (via alocação ou apontamento)
              const cEnvolvidos = new Set<string>();
              
              allAlocacoes.filter(a => a.user_id === u.id && a.mes === sMes && a.ano === sAno && contratos.find(c=>c.id===a.contract_id)?.status_ativo).forEach(a => cEnvolvidos.add(a.contract_id));
              
              allTimesheets.filter(t => t.user_id === u.id).forEach(t => {
                 const cObj = contratos.find(c => c.id === t.contract_id);
                 if (cObj?.status_ativo) {
                    const cb = getCycleBoundsForContract(cObj.ciclo_inicio, cObj.ciclo_fim, sMes, sAno);
                    if (new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end) {
                        cEnvolvidos.add(cObj.id);
                    }
                 }
              });

              cEnvolvidos.forEach(cid => {
                 const cObj = contratos.find(c => c.id === cid);
                 if (!cObj || cObj.tipo === 'fechado') return; 
                 
                 const cb = getCycleBoundsForContract(cObj.ciclo_inicio, cObj.ciclo_fim, sMes, sAno);
                 const tContrato = allTimesheets.filter(t => t.user_id === u.id && t.contract_id === cid && new Date(t.start_at).getTime() >= cb.start && new Date(t.start_at).getTime() <= cb.end);
                 const aContrato = allAlocacoes.filter(a => a.user_id === u.id && a.contract_id === cid && a.mes === sMes && a.ano === sAno && a.atividade !== 'Preço Fechado (Medição)');

                 const osEnvolvidas = new Set<string | null>();
                 tContrato.forEach(t => osEnvolvidas.add(t.os_id || null));
                 aContrato.forEach(a => osEnvolvidas.add(a.os_id || null));

                 osEnvolvidas.forEach(osid => {
                    let tOs = tContrato; let aOs = aContrato;
                    if (cObj.tipo === 'continuado_com_os') {
                       tOs = tContrato.filter(t => t.os_id === osid);
                       aOs = aContrato.filter(a => a.os_id === osid);
                    }
                    
                    const gastoH = tOs.reduce((sum, t) => sum + (new Date(t.end_at || Date.now()).getTime() - new Date(t.start_at).getTime()), 0) / 3600000;
                    const osObj = osList.find(o => o.id === osid);
                    const isSuportes = osObj?.codigo === '🛠️ Pequenos Suportes' || ['continuado_sem_os', 'overhead'].includes(cObj.tipo);
                    
                    let orcadoH = 0;
                    if (isSuportes) {
                       orcadoH = gastoH; 
                    } else {
                       orcadoH = aOs.reduce((sum, a) => sum + Number(a.horas_disponiveis), 0);
                       if (orcadoH >= 9000) orcadoH = gastoH; 
                    }

                    if (orcadoH > 0 || gastoH > 0) {
                       orcadoTotal += orcadoH;
                       gastoTotal += gastoH;
                    }
                 });
              });

              if (orcadoTotal > 0) {
                 const percConsultor = (gastoTotal / orcadoTotal) * 100;
                 
                 // Compara o consumo com o tempo decorrido do ciclo (Margem de 5%)
                 const isAcelerado = percConsultor > (avancoCicloPerc + 5);
                 const analiseRitmo = isAcelerado 
                    ? "O consumo de horas está acelerado em relação ao tempo do ciclo." 
                    : "O ritmo de consumo de horas está dentro do esperado.";

                 if (percConsultor >= 80) {
                    listaAlertasConsultores.push({
                       tipo: 'critico',
                       titulo: `Risco de Estouro (Consumo: ${percConsultor.toFixed(0)}% | Tempo do Ciclo: ${avancoCicloPerc.toFixed(0)}%) — ${u.nome}`,
                       desc: `Consumiu ${gastoTotal.toFixed(1)}h de ${orcadoTotal.toFixed(1)}h. ${analiseRitmo}`,
                       userId: u.id
                    });
                 } else if (percConsultor >= 50) {
                    listaAlertasConsultores.push({
                       tipo: 'atencao',
                       titulo: `Checkpoint (Consumo: ${percConsultor.toFixed(0)}% | Tempo do Ciclo: ${avancoCicloPerc.toFixed(0)}%) — ${u.nome}`,
                       desc: `Consumiu ${gastoTotal.toFixed(1)}h de ${orcadoTotal.toFixed(1)}h. ${analiseRitmo}`,
                       userId: u.id
                    });
                 }
              }
            });

            return (
              <div className="space-y-8 animate-in fade-in-50">
                {/* CABEÇALHO DO RADAR */}
                <div className="bg-linear-to-r from-primary/10 via-background to-transparent p-6 rounded-2xl border border-primary/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <Badge className="bg-primary text-white font-mono uppercase text-[10px] mb-1.5">
                      GOVERNANÇA EXECUTIVA
                    </Badge>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">Radar de Alertas (Checkpoints 50% & 80%)</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Monitoramento ativo para gestores: acompanhamento de marcos de saúde de Contratos, OSs e Equipe no ciclo.
                    </p>
                  </div>
                </div>

                {/* --- SEÇÃO 1: ALERTAS DE VIDA ÚTIL (CONTRATOS E OSs) --- */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                    <span>1. Saúde de Contratos e Demandas (Vida Útil)</span>
                    <Badge variant="secondary" className="font-mono">{listaAlertasContratos.length}</Badge>
                  </h3>

                  {listaAlertasContratos.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-2xl bg-card text-muted-foreground text-xs">
                      Nenhum contrato ou OS atingiu os marcos de 50% ou 80% de consumo da vida útil no momento.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {listaAlertasContratos.map((a, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-xs transition-all ${
                          a.tipo === 'critico' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
                        }`}>
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-xs font-bold ${a.tipo === 'critico' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {a.titulo}
                              </span>
                              <Badge className={`text-[10px] font-mono uppercase ${
                                a.tipo === 'critico' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                              }`}>
                                {a.tipo === 'critico' ? 'Risco 80%' : 'Check 50%'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-dashed border-border/60">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs h-8 gap-1.5 border-primary/30 hover:bg-primary/10 text-primary"
                              onClick={() => {
                                setDashContratosSelecionados([a.contractId]);
                                if (a.osId) setDashOs(a.osId);
                                setMenuAtivo('dash-global');
                              }}
                            >
                              <span>Ver Visão Global do Contrato</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* --- SEÇÃO 2: ALERTAS DE CONSUMO MENSAL DO CONSULTOR --- */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-2">
                    <span>2. Consumo de Alocação da Equipe (Tempo do Ciclo: {avancoCicloPerc.toFixed(0)}%)</span>
                    <Badge variant="secondary" className="font-mono">{listaAlertasConsultores.length}</Badge>
                  </h3>

                  {listaAlertasConsultores.length === 0 ? (
                    <div className="p-8 text-center border border-dashed rounded-2xl bg-card text-muted-foreground text-xs">
                      Nenhum consultor atingiu 50% ou 80% da sua alocação no mês selecionado.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {listaAlertasConsultores.map((a, i) => (
                        <div key={i} className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-xs transition-all ${
                          a.tipo === 'critico' ? 'bg-red-500/5 border-red-500/20' : 'bg-blue-500/5 border-blue-500/20'
                        }`}>
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-xs font-bold ${a.tipo === 'critico' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {a.titulo}
                              </span>
                              <Badge className={`text-[10px] font-mono uppercase ${
                                a.tipo === 'critico' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
                              }`}>
                                {a.tipo === 'critico' ? 'Meta 80%' : 'Check 50%'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-dashed border-border/60">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs h-8 gap-1.5 border-primary/30 hover:bg-primary/10 text-primary"
                              onClick={() => {
                                setAlocMes(dashMes);
                                setAlocAno(dashAno);
                                setMenuAtivo('alocacoes');
                              }}
                            >
                              <span>Ajustar Alocação / Matriz</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
              </div>
            );
          })()}

        {/* 🌟 PALETA FLUTUANTE DE DISCIPLINAS */}
        {isPaletteOpen && (
          <div
            style={{ left: palettePos.x, top: palettePos.y }}
            className="fixed z-100 bg-card border shadow-2xl rounded-xl flex flex-col overflow-hidden w-80 max-h-[80vh] resize"
          >
            <div
              onMouseDown={handlePaletteMouseDown}
              className="bg-primary text-primary-foreground border-b p-3 flex justify-between items-center cursor-move"
            >
              <h3 className="font-bold text-sm flex items-center gap-2"><FolderTree className="w-4 h-4"/> Catálogo do Contrato</h3>
              <Button className="w-6 h-6 hover:bg-white/20 text-white" onClick={() => setPaletteOpen(false)} size="icon" variant="ghost">
                <X className="w-4 h-4"/>
              </Button>
            </div>

            <div className="p-3 border-b bg-muted/30">
               <Label className="text-xs font-bold mb-1 block">Atribuir disciplina para:</Label>
               <Select onValueChange={(v) => setPaletteTargetUserId(v)} value={paletteTargetUserId}>
                 <SelectTrigger className="bg-background h-8 text-xs"><SelectValue placeholder="Selecione..."/></SelectTrigger>
                 <SelectContent className="z-9999">
                   <SelectItem value="none">-- Apenas Gerenciar Catálogo --</SelectItem>
                   {Object.values(baseItems).map(item => {
                      const cName = consultores.find(c => c.id === item.user_id)?.nome;
                      return <SelectItem key={item.user_id} value={item.user_id}>{cName}</SelectItem>;
                   })}
                 </SelectContent>
               </Select>
               {paletteTargetUserId !== 'none' && (
                 <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">Clique em uma disciplina abaixo para inseri-la no consultor.</p>
               )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-muted/10">
               {catalogoDoContrato.length === 0 ? (
                 <p className="text-xs text-center text-muted-foreground py-4">Nenhuma disciplina neste contrato.</p>
               ) : (
                 catalogoDoContrato.map(ativ => (
                    <div key={ativ} className="flex items-center justify-between p-2 hover:bg-background border border-transparent hover:border-border rounded-lg group transition-colors mb-1">
                       <span 
                          className={`text-xs font-semibold flex-1 ${paletteTargetUserId !== 'none' ? 'cursor-pointer hover:text-primary' : ''}`} 
                          onClick={() => handleInsertFromPalette(ativ)}
                       >
                          {ativ}
                       </span>
                       <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <Button className="h-6 w-6 text-primary hover:bg-primary/10" onClick={() => renameContractActivity(ativ)} size="icon" variant="ghost"><Pencil className="w-3 h-3"/></Button>
                          <Button className="h-6 w-6 text-red-500 hover:bg-red-500/10" onClick={() => removeContractActivity(ativ)} size="icon" variant="ghost"><Trash2 className="w-3 h-3"/></Button>
                       </div>
                    </div>
                 ))
               )}
            </div>

            <div className="p-3 border-t bg-muted/30 flex gap-2">
               <Input onChange={(e) => setNewActivityName(e.target.value)} value={newActivityName} placeholder="Nova disciplina..." className="text-xs h-8 bg-background"/>
               <Button className="h-8 shadow-sm" onClick={handleAddActivityFromPalette} size="sm"><PlusCircle className="w-3.5 h-3.5 mr-1"/> Criar</Button>
            </div>
          </div>
        )}
          
      </main>
    </div>
  )
}
