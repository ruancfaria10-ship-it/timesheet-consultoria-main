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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  PlusCircle, UserPlus, Briefcase, Clock, ArrowRight, Trash2, 
  Loader2, Pencil, Check, X, Save, Sun, Moon, User, Layers, 
  CalendarDays, Download, Percent, ClipboardCheck, History, 
  FileUp, FolderTree, Target, AlertTriangle, Building2
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts'

type Consultor = { id: string, nome: string, horas_minimas_mes: number }
type Contrato = { id: string, codigo: string, nome: string, status_ativo: boolean, tipo: string, fonte_pagamento: string, ciclo_inicio: number, ciclo_fim: number }
type OrdemServico = { id: string, contract_id: string, codigo: string, descricao: string, status_ativa: boolean, horas_previstas: number }
type AtividadeAlocada = { id: string, dbId?: string, nome: string, horas: number }
type Alocacao = { consultorId: string, horasTotais: number, geralId?: string, atividades: AtividadeAlocada[] }
type TimesheetLog = { id: string, user_id: string, contract_id: string, activity: string, start_at: string, end_at: string | null, notes?: string }
type Medicao = { id?: string, contract_id: string, user_id: string, mes: string, ano: string, percentual: number }

const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CORES_GRAFICO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']

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
  const [novoInicio, setNovoInicio] = useState(25)
  const [novoFim, setNovoFim] = useState(24)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [editNome, setEditNome] = useState('')
  const [editStatus, setEditStatus] = useState(true)
  const [editTipo, setEditTipo] = useState('horas')
  const [editFonte, setEditFonte] = useState('EC')
  const [editInicio, setEditInicio] = useState(25)
  const [editFim, setEditFim] = useState(24)

  // Estados OS
  const [osContratoId, setOsContratoId] = useState('')
  const [osCodigo, setOsCodigo] = useState('')
  const [osDescricao, setOsDescricao] = useState('')
  const [osHoras, setOsHoras] = useState<number>(0)
  
  const [osEditandoId, setOsEditandoId] = useState<string | null>(null)
  const [editOsCodigo, setEditOsCodigo] = useState('')
  const [editOsDescricao, setEditOsDescricao] = useState('')
  const [editOsHoras, setEditOsHoras] = useState<number>(0)

  // Estados Alocações
  const [contratoAtivo, setContratoAtivo] = useState<string>('')
  const [alocacoes, setAlocacoes] = useState<Record<string, Alocacao>>({})
  const [carregandoAlocacoes, setCarregandoAlocacoes] = useState(false)

  // Estados Equipe e Metas
  const [metasEdit, setMetasEdit] = useState<Record<string, number>>({})

  // Estados Medições
  const [medContrato, setMedContrato] = useState<string>('')
  const [medMes, setMedMes] = useState<string>(new Date().getMonth().toString())
  const [medAno, setMedAno] = useState<string>(new Date().getFullYear().toString())
  const [medFonte, setMedFonte] = useState<string>('todas') // NOVO FILTRO EC/ET NAS MEDIÇÕES
  const [medicoesInput, setMedicoesInput] = useState<Record<string, number>>({})
  const [medConsultores, setMedConsultores] = useState<Consultor[]>([])
  const [medLoading, setMedLoading] = useState(false)

  // Estados Gestão e Dashboards
  const [dashVisaoTipo, setDashVisaoTipo] = useState<'horas' | 'fechado' | 'continuado_sem_os' | 'continuado_com_os' | 'continuado_limite_mensal' | 'overhead'>('horas')
  const [dashMes, setDashMes] = useState<string>(new Date().getMonth().toString())
  const [dashAno, setDashAno] = useState<string>(new Date().getFullYear().toString())
  const [dashContratosSelecionados, setDashContratosSelecionados] = useState<string[]>([]) 
  const [dashConsultor, setDashConsultor] = useState<string>('todos')
  const [dashAtividade, setDashAtividade] = useState<string>('todas')
  const [dashFonte, setDashFonte] = useState<string>('todas')

  const [allTimesheets, setAllTimesheets] = useState<TimesheetLog[]>([])
  const [allAlocacoes, setAllAlocacoes] = useState<any[]>([])
  const [allMedicoes, setAllMedicoes] = useState<Medicao[]>([])
  const [loadingDash, setLoadingDash] = useState(false)

  // Estados Gestão Retroativa
  const [gestaoConsultor, setGestaoConsultor] = useState<string>('')
  const [gestaoContrato, setGestaoContrato] = useState<string>('')
  const [gestaoAtividade, setGestaoAtividade] = useState<string>('')
  const [gestaoData, setGestaoData] = useState<string>(new Date().toISOString().split('T')[0])
  const [gestaoInicio, setGestaoInicio] = useState<string>('08:00')
  const [gestaoFim, setGestaoFim] = useState<string>('12:00')
  const [gestaoNotes, setGestaoNotes] = useState<string>('')
  const [gestaoEditandoId, setGestaoEditandoId] = useState<string | null>(null)

  async function carregarDadosDoBanco() {
    try {
      setLoading(true)
      const { data: dbCons } = await supabase.from('consultores').select('id, nome, horas_minimas_mes').order('nome')
      const { data: dbCont } = await supabase.from('contratos').select('*').order('codigo')
      const { data: dbOs } = await supabase.from('ordens_servico').select('*').order('created_at', { ascending: false })
      
      setConsultores(dbCons || [])
      setContratos((dbCont || []).map(c => ({ 
        ...c, status_ativo: c.status_ativo === true, tipo: c.tipo || 'horas', fonte_pagamento: c.fonte_pagamento || 'EC',
        ciclo_inicio: c.ciclo_inicio || 25, ciclo_fim: c.ciclo_fim || 24
      })))
      setOsList(dbOs || [])
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }
  useEffect(() => { carregarDadosDoBanco() }, [])

  // ==========================================
  // FUNÇÕES DE CONTRATO
  // ==========================================
  async function criarNovoContrato() {
    if (!novoCodigo || !novoNomeContrato) return alert("Preencha todos os campos!")
    await supabase.from('contratos').insert([{ 
      codigo: novoCodigo.toUpperCase().trim(), nome: novoNomeContrato.trim(), 
      status_ativo: true, tipo: novoTipo, fonte_pagamento: novaFonte, ciclo_inicio: novoInicio, ciclo_fim: novoFim 
    }])
    setNovoCodigo(''); setNovoNomeContrato(''); carregarDadosDoBanco();
  }

  const handleImportarCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(1);
      const toInsert = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const [codigo, nome, tipo, inicio, fim] = line.split(';');
        if (codigo && nome) {
          toInsert.push({
            codigo: codigo.toUpperCase().trim(), nome: nome.trim(),
            tipo: tipo?.toLowerCase().includes('fechado') ? 'fechado' : 'horas',
            fonte_pagamento: 'EC',
            ciclo_inicio: parseInt(inicio) || 25, ciclo_fim: parseInt(fim) || 24, status_ativo: true
          });
        }
      }
      if (toInsert.length > 0) {
        setLoading(true); await supabase.from('contratos').insert(toInsert);
        alert(`✅ ${toInsert.length} contratos importados com sucesso!`); carregarDadosDoBanco();
      } else { alert("Nenhum contrato válido encontrado no arquivo."); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  function iniciarEdicao(c: Contrato) { setEditandoId(c.id); setEditCodigo(c.codigo); setEditNome(c.nome); setEditStatus(c.status_ativo); setEditTipo(c.tipo); setEditFonte(c.fonte_pagamento); setEditInicio(c.ciclo_inicio); setEditFim(c.ciclo_fim); }
  
  async function salvarEdicaoContrato(id: string) {
    await supabase.from('contratos').update({ codigo: editCodigo.toUpperCase().trim(), nome: editNome.trim(), status_ativo: editStatus, tipo: editTipo, fonte_pagamento: editFonte, ciclo_inicio: editInicio, ciclo_fim: editFim }).eq('id', id)
    setEditandoId(null); carregarDadosDoBanco();
  }
  
  async function excluirContrato(id: string, nome: string) {
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('contract_id', id);
    if (count && count > 0) {
      return alert(`❌ TRAVA DE SEGURANÇA:\n\nEste contrato possui ${count} apontamentos de horas vinculados.\nVocê não pode excluí-lo para não quebrar os dashboards. Se não quiser mais usá-lo, apenas EDITE e marque como INATIVO.`);
    }

    if (!window.confirm(`Excluir definitivamente "${nome}" e suas alocações vazias?`)) return;
    await supabase.from('alocacoes').delete().eq('contract_id', id); 
    await supabase.from('medicoes').delete().eq('contract_id', id); 
    await supabase.from('contratos').delete().eq('id', id);
    if (contratoAtivo === id) { setContratoAtivo(''); setAlocacoes({}); }
    carregarDadosDoBanco();
  }

  // ==========================================
  // FUNÇÕES DE ORDEM DE SERVIÇO (COM HORAS)
  // ==========================================
  async function criarOS() {
    if (!osContratoId || !osCodigo) return alert("Selecione a Obra e digite o Código da OS.");
    await supabase.from('ordens_servico').insert([{
      contract_id: osContratoId, codigo: osCodigo.toUpperCase().trim(), descricao: osDescricao.trim(), horas_previstas: osHoras, status_ativa: true
    }]);
    setOsCodigo(''); setOsDescricao(''); setOsHoras(0); carregarDadosDoBanco(); alert("OS criada com sucesso!");
  }

  function iniciarEdicaoOS(os: OrdemServico) {
    setOsEditandoId(os.id); setEditOsCodigo(os.codigo); setEditOsDescricao(os.descricao); setEditOsHoras(os.horas_previstas);
  }

  async function salvarEdicaoOS(id: string) {
    await supabase.from('ordens_servico').update({
      codigo: editOsCodigo.toUpperCase().trim(), descricao: editOsDescricao.trim(), horas_previstas: editOsHoras
    }).eq('id', id);
    setOsEditandoId(null); carregarDadosDoBanco();
  }

  async function apagarOS(id: string) {
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('os_id', id);
    if (count && count > 0) return alert(`❌ BLOQUEIO: Esta OS possui ${count} apontamentos vinculados. Exclusão proibida.`);
    if (window.confirm("Apagar esta OS?")) {
      await supabase.from('ordens_servico').delete().eq('id', id);
      carregarDadosDoBanco();
    }
  }

  // ==========================================
  // FUNÇÕES DE EQUIPE & METAS (CORRIGIDO)
  // ==========================================
  async function atualizarMetaConsultor(id: string, valor: number) {
    // Atualiza a tela imediatamente para não travar o usuário
    setConsultores(p => p.map(c => c.id === id ? { ...c, horas_minimas_mes: valor } : c));
    
    // Tenta atualizar no banco e pede para o banco DEVOLVER a linha alterada (.select)
    const { data, error } = await supabase.from('consultores').update({ horas_minimas_mes: valor }).eq('id', id).select();
    
    if (error) {
      alert("❌ Erro do banco: " + error.message);
    } else if (!data || data.length === 0) {
      alert("❌ Falha Silenciosa: O Supabase bloqueou o salvamento. Verifique se rodou o script SQL de permissão!");
    } else {
      alert("✅ Meta salva com segurança na nuvem!");
    }
  }

  // ==========================================
  // FUNÇÕES DE ALOCAÇÃO
  // ==========================================
  useEffect(() => { if (contratoAtivo && menuAtivo === 'alocacoes') carregarAlocacoesDoContrato(contratoAtivo) }, [contratoAtivo, menuAtivo])
  
  async function carregarAlocacoesDoContrato(idContrato: string) {
    setCarregandoAlocacoes(true)
    const { data } = await supabase.from('alocacoes').select('*').eq('contract_id', idContrato)
    const alocSalvas: Record<string, Alocacao> = {}
    ;(data || []).forEach(row => {
      if (!alocSalvas[row.user_id]) alocSalvas[row.user_id] = { consultorId: row.user_id, horasTotais: 0, atividades: [] }
      if (row.atividade === 'Sem atividade específica' || row.atividade === 'Orçamento Geral') {
        alocSalvas[row.user_id].geralId = row.id
      } else {
        alocSalvas[row.user_id].atividades.push({ id: row.id.toString(), dbId: row.id, nome: row.atividade, horas: row.horas_disponiveis })
      }
    })

    Object.values(alocSalvas).forEach(aloc => {
      if (aloc.atividades.length > 0) {
        aloc.horasTotais = aloc.atividades.reduce((sum, a) => sum + a.horas, 0);
      } else {
        const rowGeral = data?.find(r => r.id === aloc.geralId);
        aloc.horasTotais = rowGeral ? rowGeral.horas_disponiveis : 0;
      }
    })
    setAlocacoes(alocSalvas); setCarregandoAlocacoes(false)
  }

  async function salvarAlocacoesNoBanco() {
    setSalvando(true)
    const { data: currentTimesheets } = await supabase.from('timesheets').select('*').eq('contract_id', contratoAtivo);
    const cObj = contratos.find(c => c.id === contratoAtivo);
    const isHora = cObj?.tipo === 'horas';

    const upserts: any[] = []; const inserts: any[] = []; const deletes: string[] = [];
    let bloqueio = false;

    Object.values(alocacoes).forEach(aloc => {
      const nomeCons = consultores.find(c => c.id === aloc.consultorId)?.nome;
      if (aloc.atividades.length > 0) {
        aloc.atividades.forEach(ativ => {
          if (isHora && currentTimesheets) {
            const consumed = currentTimesheets.filter(t => t.user_id === aloc.consultorId && t.activity === ativ.nome).reduce((acc, t) => acc + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
            if (ativ.horas < consumed) {
              alert(`❌ TRAVA DE SEGURANÇA:\n\n${nomeCons} já gastou ${consumed.toFixed(1)}h na disciplina '${ativ.nome}'.\nVocê não pode reduzir o teto para ${ativ.horas}h.`);
              bloqueio = true;
            }
          }
          if (ativ.dbId) upserts.push({ id: ativ.dbId, user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: ativ.horas, atividade: ativ.nome.trim() })
          else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: ativ.horas, atividade: ativ.nome.trim() })
        })
        if (aloc.geralId) deletes.push(aloc.geralId)
      } else {
        if (isHora && currentTimesheets) {
          const consumed = currentTimesheets.filter(t => t.user_id === aloc.consultorId).reduce((acc, t) => acc + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
          if (aloc.horasTotais < consumed) {
            alert(`❌ TRAVA DE SEGURANÇA:\n\n${nomeCons} já gastou ${consumed.toFixed(1)}h no contrato.\nVocê não pode reduzir o teto para ${aloc.horasTotais}h.`);
            bloqueio = true;
          }
        }
        if (aloc.geralId) upserts.push({ id: aloc.geralId, user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: aloc.horasTotais, atividade: 'Sem atividade específica' })
        else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: aloc.horasTotais, atividade: 'Sem atividade específica' })
      }
    })

    if (bloqueio) return setSalvando(false);

    try {
      for (const u of upserts) await supabase.from('alocacoes').update({ horas_disponiveis: u.horas_disponiveis, atividade: u.atividade }).eq('id', u.id)
      if (inserts.length > 0) await supabase.from('alocacoes').insert(inserts)
      if (deletes.length > 0) await supabase.from('alocacoes').delete().in('id', deletes)
      alert("Alocações salvas com sucesso!"); carregarAlocacoesDoContrato(contratoAtivo)
    } catch (e) { alert("Erro ao salvar.") }
    setSalvando(false)
  }

  const addConsultor = (id: string) => { if (!alocacoes[id]) setAlocacoes(p => ({ ...p, [id]: { consultorId: id, horasTotais: 0, atividades: [] } })) }
  const updateHoras = (id: string, h: number) => setAlocacoes(p => ({ ...p, [id]: { ...p[id], horasTotais: h } }))
  const addAtiv = (id: string) => { const n = prompt("Nome da Atividade:"); if (n) setAlocacoes(p => { const newAtivs = [...p[id].atividades, { id: Date.now().toString(), nome: n, horas: 0 }]; const newTotal = newAtivs.reduce((sum, a) => sum + a.horas, 0); return { ...p, [id]: { ...p[id], atividades: newAtivs, horasTotais: newTotal } } }) }
  const updateAtiv = (cid: string, aid: string, h: number) => setAlocacoes(p => { const newAtivs = p[cid].atividades.map(a => a.id === aid ? { ...a, horas: h } : a); const newTotal = newAtivs.reduce((sum, a) => sum + a.horas, 0); return { ...p, [cid]: { ...p[cid], atividades: newAtivs, horasTotais: newTotal } } })
  const removeAtiv = async (cid: string, aid: string, dbId?: string) => { 
    const nomeAtiv = alocacoes[cid].atividades.find(a => a.id === aid)?.nome;
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('contract_id', contratoAtivo).eq('user_id', cid).eq('activity', nomeAtiv);
    if (count && count > 0) return alert(`❌ TRAVA DE SEGURANÇA:\n\nEste consultor já apontou ${count} vezes na atividade '${nomeAtiv}'. Exclusão bloqueada.`);

    if (dbId && !window.confirm("Apagar do banco?")) return; 
    if (dbId) await supabase.from('alocacoes').delete().eq('id', dbId); 
    setAlocacoes(p => { const newAtivs = p[cid].atividades.filter(a => a.id !== aid); const newTotal = newAtivs.reduce((sum, a) => sum + a.horas, 0); return { ...p, [cid]: { ...p[cid], atividades: newAtivs, horasTotais: newTotal } } }) 
  }
  
  const removeConsultor = async (cid: string) => { 
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('contract_id', contratoAtivo).eq('user_id', cid);
    if (count && count > 0) return alert(`❌ TRAVA DE SEGURANÇA:\n\nEste consultor possui ${count} apontamentos nesta obra. Você não pode removê-lo da alocação para não quebrar a folha de pagamento.`);

    const dbIds = [...alocacoes[cid].atividades.map(a => a.dbId).filter(Boolean), alocacoes[cid].geralId].filter(Boolean); 
    if (dbIds.length > 0 && !window.confirm("Excluir histórico deste consultor nesta obra?")) return; 
    if (dbIds.length > 0) await supabase.from('alocacoes').delete().in('id', dbIds as string[]); 
    setAlocacoes(p => { const n = { ...p }; delete n[cid]; return n }) 
  }

  // ==========================================
  // MEDIÇÕES MENSAIS
  // ==========================================
  useEffect(() => { if (menuAtivo === 'medicoes' && medContrato) carregarMedicoes() }, [menuAtivo, medContrato, medMes, medAno])
  async function carregarMedicoes() {
    setMedLoading(true)
    const { data: alocs } = await supabase.from('alocacoes').select('user_id').eq('contract_id', medContrato)
    const idsNaObra = Array.from(new Set((alocs || []).map(a => a.user_id)))
    setMedConsultores(consultores.filter(c => idsNaObra.includes(c.id)))
    const { data: meds } = await supabase.from('medicoes').select('*').eq('contract_id', medContrato).eq('mes', medMes).eq('ano', medAno)
    const inputs: Record<string, number> = {}; (meds || []).forEach(m => { inputs[m.user_id] = m.percentual })
    setMedicoesInput(inputs); setMedLoading(false)
  }
  async function salvarMedicoes() {
    setSalvando(true)
    await supabase.from('medicoes').delete().eq('contract_id', medContrato).eq('mes', medMes).eq('ano', medAno)
    const inserts = medConsultores.map(c => ({ contract_id: medContrato, user_id: c.id, mes: medMes, ano: medAno, percentual: medicoesInput[c.id] || 0 })).filter(m => m.percentual > 0)
    if (inserts.length > 0) await supabase.from('medicoes').insert(inserts)
    alert("Medição do mês salva com sucesso!"); await carregarTudoParaDash(); setSalvando(false)
  }

  // ==========================================
  // GESTÃO DE APONTAMENTOS E IMPORTADOR DE TIMESHEET
  // ==========================================
  const handleImportarTimesheetCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(1);
      const toInsert = [];
      let errors = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(';');
        if (parts.length < 9) continue; 

        const consultorNome = parts[0]?.trim();
        const dataStr = parts[4]?.trim(); 
        const contratoCodigo = parts[5]?.trim().toUpperCase();
        const observacao = parts[6]?.trim(); 
        const inicioStr = parts[7]?.trim();
        const fimStr = parts[8]?.trim();

        const consultor = consultores.find(c => c.nome.toLowerCase() === consultorNome?.toLowerCase());
        const contrato = contratos.find(c => c.codigo === contratoCodigo);

        if (!consultor || !contrato || !dataStr || !inicioStr || !fimStr) { errors++; continue; }

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
            id: crypto.randomUUID(),
            user_id: consultor.id,
            contract_id: contrato.id,
            contract_name: `${contrato.codigo} — ${contrato.nome}`,
            activity: 'Sem atividade específica', 
            notes: observacao,
            start_at: startDt.toISOString(),
            end_at: endDt.toISOString(),
            edited: true 
          });
        } catch (err) { errors++; }
      }

      if (toInsert.length > 0) {
        setLoading(true);
        const { error } = await supabase.from('timesheets').insert(toInsert);
        if (error) { alert("Erro no banco de dados: " + error.message); } 
        else { alert(`✅ ${toInsert.length} apontamentos importados!\n❌ ${errors} linhas ignoradas.`); carregarTudoParaDash(); }
        setLoading(false);
      } else { alert(`Nenhum apontamento válido encontrado. ${errors} erros.`); }
      event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const gestaoAtividadesDisponiveis = useMemo(() => {
    if (!gestaoContrato) return ['Sem atividade específica'];
    const alocs = allAlocacoes.filter(a => a.contract_id === gestaoContrato && (gestaoConsultor ? a.user_id === gestaoConsultor : true));
    const acts = Array.from(new Set(alocs.map(a => a.atividade)));
    return acts.length > 0 ? acts : ['Sem atividade específica'];
  }, [gestaoContrato, gestaoConsultor, allAlocacoes])

  useEffect(() => {
    if (gestaoAtividadesDisponiveis.length > 0 && !gestaoAtividadesDisponiveis.includes(gestaoAtividade)) setGestaoAtividade(gestaoAtividadesDisponiveis[0]);
  }, [gestaoAtividadesDisponiveis, gestaoAtividade])

  async function salvarApontamentoAdmin() {
    if(!gestaoConsultor || !gestaoContrato || !gestaoAtividade || !gestaoData || !gestaoInicio || !gestaoFim) return alert("Preencha todos os campos obrigatórios.");
    const startMs = new Date(`${gestaoData}T${gestaoInicio}:00`).getTime();
    const endMs = new Date(`${gestaoData}T${gestaoFim}:00`).getTime();
    if(endMs <= startMs) return alert("A hora de fim deve ser posterior à hora de início.");

    const contObj = contratos.find(c => c.id === gestaoContrato);
    const payload = {
      user_id: gestaoConsultor, contract_id: gestaoContrato, contract_name: `${contObj?.codigo} — ${contObj?.nome}`, 
      activity: gestaoAtividade, notes: gestaoNotes, start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(), edited: true
    };
    setSalvando(true);
    try {
      if(gestaoEditandoId) {
        await supabase.from('timesheets').update(payload).eq('id', gestaoEditandoId);
        alert("Atualizado com sucesso!"); setGestaoEditandoId(null);
      } else {
        await supabase.from('timesheets').insert([{ ...payload, id: crypto.randomUUID() }]);
        alert("Criado com sucesso!");
      }
      setGestaoInicio('08:00'); setGestaoFim('12:00'); setGestaoNotes(''); await carregarTudoParaDash();
    } catch (e) { alert("Erro ao processar."); } finally { setSalvando(false); }
  }

  async function excluirApontamentoAdmin(id: string) {
    if(!window.confirm("Atenção: Deseja apagar este apontamento do sistema?")) return;
    await supabase.from('timesheets').delete().eq('id', id); await carregarTudoParaDash();
  }

  function iniciarEdicaoApontamento(t: TimesheetLog) {
    setGestaoEditandoId(t.id); setGestaoConsultor(t.user_id); setGestaoContrato(t.contract_id);
    setGestaoAtividade(t.activity); setGestaoNotes(t.notes || '');
    const startDate = new Date(t.start_at); const endDate = t.end_at ? new Date(t.end_at) : new Date();
    setGestaoData(startDate.toISOString().split('T')[0]);
    setGestaoInicio(`${String(startDate.getHours()).padStart(2,'0')}:${String(startDate.getMinutes()).padStart(2,'0')}`);
    setGestaoFim(`${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const gestaoLogsFiltrados = useMemo(() => {
    return allTimesheets.filter(t => gestaoConsultor ? t.user_id === gestaoConsultor : true)
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()).slice(0, 50);
  }, [allTimesheets, gestaoConsultor])

  // ==========================================
  // DASHBOARDS, CALCULADORA E ALERTAS (RADAR)
  // ==========================================
  useEffect(() => { if (['dash-mensal', 'dash-global', 'alertas', 'gestao'].includes(menuAtivo)) carregarTudoParaDash() }, [menuAtivo])

  async function carregarTudoParaDash() {
    setLoadingDash(true)
    const { data: times } = await supabase.from('timesheets').select('*').not('end_at', 'is', null)
    const { data: orcs } = await supabase.from('alocacoes').select('*')
    const { data: meds } = await supabase.from('medicoes').select('*')
    setAllTimesheets(times || []); setAllAlocacoes(orcs || []); setAllMedicoes(meds || [])
    setLoadingDash(false)
  }

  const isWithinCycle = (dateStr: string, monthStr: string, yearStr: string, cInicio: number, cFim: number) => {
    const date = new Date(dateStr).getTime()
    const month = parseInt(monthStr); const year = parseInt(yearStr)
    let start, end
    if (cInicio > cFim) {
      if (new Date().getDate() >= cInicio) { start = new Date(year, month, cInicio, 0,0,0).getTime(); end = new Date(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, cFim, 23,59,59).getTime(); } 
      else { start = new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, cInicio, 0,0,0).getTime(); end = new Date(year, month, cFim, 23,59,59).getTime(); }
    } else { start = new Date(year, month, cInicio, 0,0,0).getTime(); end = new Date(year, month, cFim, 23,59,59).getTime() }
    return date >= start && date <= end
  }

  const contratosVisao = contratos.filter(c => 
    c.status_ativo && 
    c.tipo === dashVisaoTipo && 
    (dashFonte === 'todas' ? true : c.fonte_pagamento === dashFonte)
  )

  const dashData = useMemo(() => {
    let fTimes = allTimesheets.filter(t => contratosVisao.some(cv => cv.id === t.contract_id))
    let fAlocs = allAlocacoes.filter(a => {
      if (a.atividade === 'Sem atividade específica' || a.atividade === 'Orçamento Geral') {
        const hasSpecific = allAlocacoes.some(o => o.user_id === a.user_id && o.contract_id === a.contract_id && o.id !== a.id && o.atividade !== 'Sem atividade específica' && o.atividade !== 'Orçamento Geral');
        if (hasSpecific) return false;
      }
      return contratosVisao.some(cv => cv.id === a.contract_id);
    });
    let fMeds = allMedicoes.filter(m => contratosVisao.some(cv => cv.id === m.contract_id))

    if (dashContratosSelecionados.length > 0) {
      fTimes = fTimes.filter(t => dashContratosSelecionados.includes(t.contract_id))
      fAlocs = fAlocs.filter(a => dashContratosSelecionados.includes(a.contract_id))
      fMeds = fMeds.filter(m => dashContratosSelecionados.includes(m.contract_id))
    }
    if (dashConsultor !== 'todos') {
      fTimes = fTimes.filter(t => t.user_id === dashConsultor); fAlocs = fAlocs.filter(a => a.user_id === dashConsultor); fMeds = fMeds.filter(m => m.user_id === dashConsultor)
    }
    if (dashAtividade !== 'todas') {
      fTimes = fTimes.filter(t => t.activity === dashAtividade); fAlocs = fAlocs.filter(a => a.atividade === dashAtividade || a.atividade === 'Sem atividade específica')
    }

    const consultoresPagamento = consultores.map(c => {
      let valorGrafico = 0; let tooltipExtra = ""
      if (dashVisaoTipo === 'fechado') {
        valorGrafico = fMeds.filter(m => m.user_id === c.id && m.mes === dashMes && m.ano === dashAno).reduce((acc, m) => acc + m.percentual, 0)
        const horasInfinitas = fTimes.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, dashMes, dashAno, contratos.find(con => con.id === t.contract_id)?.ciclo_inicio || 25, contratos.find(con => con.id === t.contract_id)?.ciclo_fim || 24)).reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
        tooltipExtra = horasInfinitas > 0 ? `(Tempo investido: ${horasInfinitas.toFixed(1)}h)` : ""
      } else {
        const logs = fTimes.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, dashMes, dashAno, contratos.find(con => con.id === t.contract_id)?.ciclo_inicio || 25, contratos.find(con => con.id === t.contract_id)?.ciclo_fim || 24))
        valorGrafico = logs.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
      }
      return { id: c.id, nome: c.nome, nomeCurto: c.nome.split(' ')[0], valorGrafico: Number(valorGrafico.toFixed(2)), tooltipExtra }
    }).filter(c => c.valorGrafico > 0).sort((a,b) => b.valorGrafico - a.valorGrafico)

    const orcadoGlobal = fAlocs.reduce((acc, curr) => acc + curr.horas_disponiveis, 0)
    const gastoGlobal = fTimes.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
    const medidoGlobal = fMeds.reduce((acc, curr) => acc + curr.percentual, 0)
    
    const saldoPositivo = orcadoGlobal - gastoGlobal > 0 ? orcadoGlobal - gastoGlobal : 0;
    const saldoMedido = 100 - medidoGlobal > 0 ? 100 - medidoGlobal : 0;
    
    let pieData = dashVisaoTipo === 'fechado' 
      ? [ { name: '% Entregue (Medida)', value: Number(medidoGlobal.toFixed(1)) }, { name: 'A Entregar', value: Number(saldoMedido.toFixed(1)) } ]
      : [ { name: 'Consumido', value: Number(gastoGlobal.toFixed(2)) }, { name: 'Saldo Restante', value: Number(saldoPositivo.toFixed(2)) } ]
    
    // Trava para a Pizza não desaparecer se estiver tudo 0
    pieData = pieData.filter(p => p.value > 0);
    if (pieData.length === 0) pieData.push({ name: 'Sem Registros', value: 1 });

    return { 
      consultoresPagamento, maxValor: Math.max(...consultoresPagamento.map(c => c.valorGrafico), 1), 
      orcadoGlobal, gastoGlobal: Number(gastoGlobal.toFixed(2)), medidoGlobal: Number(medidoGlobal.toFixed(1)),
      saldoGlobal: Number((orcadoGlobal - gastoGlobal).toFixed(2)),
      percentualGlobal: dashVisaoTipo === 'horas' ? (orcadoGlobal > 0 ? ((gastoGlobal / orcadoGlobal) * 100).toFixed(1) : '0') : orcadoGlobal.toString(),
      pieData
    }
  }, [allTimesheets, allAlocacoes, allMedicoes, dashMes, dashAno, dashContratosSelecionados, dashConsultor, dashAtividade, consultores, dashVisaoTipo, contratosVisao, contratos])

// LÓGICA DO RADAR DE ALERTAS REPROGRAMADA
  const radarAlertas = useMemo(() => {
    const ociosos: any[] = [];
    const estourados: any[] = [];

    // Cálculo dinâmico da metade do ciclo padrão vigente (25 a 24)
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let startDt, endDt;
    if (25 > 24) { // Ciclo padrão Engeprice
      if (currentDay >= 25) {
        startDt = new Date(currentYear, currentMonth, 25, 0, 0, 0);
        endDt = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, 24, 23, 59, 59);
      } else {
        startDt = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, 25, 0, 0, 0);
        endDt = new Date(currentYear, currentMonth, 24, 23, 59, 59);
      }
    } else {
      startDt = new Date(currentYear, currentMonth, 25, 0, 0, 0);
      endDt = new Date(currentYear, currentMonth, 24, 23, 59, 59);
    }

    const meioDoCicloMs = startDt.getTime() + (endDt.getTime() - startDt.getTime()) / 2;
    const jaPassouDaMetade = Date.now() >= meioDoCicloMs;

    // Alerta de Ociosidade (< 30% da Meta Mensal - Apenas se passou da metade do ciclo)
    consultores.forEach(c => {
      if (c.horas_minimas_mes > 0) {
        const horasTrabalhadas = allTimesheets.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, dashMes, dashAno, 25, 24)).reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0);
        const percentual = (horasTrabalhadas / c.horas_minimas_mes) * 100;
        
        if (percentual < 30 && jaPassouDaMetade) {
          ociosos.push({ id: c.id, nome: c.nome, trabalhadas: horasTrabalhadas.toFixed(1), meta: c.horas_minimas_mes, percentual: percentual.toFixed(1) })
        }
      }
    });

    // Alerta de Estouro (> 70% do Contrato/Alocação)
    contratos.filter(c => c.status_ativo && ['horas', 'continuado_limite_mensal', 'continuado_com_os'].includes(c.tipo)).forEach(cont => {
      const orcado = allAlocacoes.filter(a => a.contract_id === cont.id).reduce((sum, a) => sum + a.horas_disponiveis, 0);
      const consumido = allTimesheets.filter(t => t.contract_id === cont.id && (cont.tipo === 'continuado_limite_mensal' ? isWithinCycle(t.start_at, dashMes, dashAno, cont.ciclo_inicio, cont.ciclo_fim) : true)).reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
      
      if (orcado > 0) {
        const perc = (consumido / orcado) * 100;
        if (perc >= 70) estourados.push({ contrato: cont.nome, consumido: consumido.toFixed(1), orcado, perc: perc.toFixed(1), tipo: cont.tipo })
      }
    });

    return { ociosos, estourados };
  }, [consultores, contratos, allTimesheets, allAlocacoes, dashMes, dashAno]);

  const exportarExcel = () => {
    let registros = allTimesheets.filter(t => {
      const cont = contratos.find(c => c.id === t.contract_id); if (cont?.tipo !== dashVisaoTipo) return false;
      return isWithinCycle(t.start_at, dashMes, dashAno, cont?.ciclo_inicio || 25, cont?.ciclo_fim || 24)
    })
    if (dashContratosSelecionados.length > 0) registros = registros.filter(t => dashContratosSelecionados.includes(t.contract_id))
    if (dashConsultor !== 'todos') registros = registros.filter(t => t.user_id === dashConsultor)
    if (dashAtividade !== 'todas') registros = registros.filter(t => t.activity === dashAtividade)

    const csvRows = ["Consultor;Obra;Atividade;Tipo;Data;Entrada;Saida;Horas Totais;Observacao"]
    registros.forEach(t => {
      const consultor = consultores.find(c => c.id === t.user_id)?.nome || 'Desconhecido'; const contrato = contratos.find(c => c.id === t.contract_id)
      const inicio = new Date(t.start_at); const fim = new Date(t.end_at!)
      const dataStr = inicio.toLocaleDateString('pt-BR'); const horaIn = inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
      const horaOut = fim.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
      const horas = ((fim.getTime() - inicio.getTime()) / 3600000).toFixed(2).replace('.', ',')
      const obsSafe = t.notes ? `"${t.notes.replace(/"/g, '""')}"` : ""
      csvRows.push(`${consultor};${contrato?.codigo || '-'};${t.activity};${contrato?.tipo.toUpperCase()};${dataStr};${horaIn};${horaOut};${horas};${obsSafe}`)
    })
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); 
    link.download = `Apontamentos_Engeprice_${dashVisaoTipo}_${MESES_NOME[parseInt(dashMes)]}_${dashAno}.csv`; link.click()
  }

  const renderFiltroContratosMultiplos = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal bg-background h-9 border-input truncate overflow-hidden">
          {dashContratosSelecionados.length === 0 ? "Todos os Contratos" : `${dashContratosSelecionados.length} Contrato(s) selecionado(s)`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 bg-card border shadow-md" align="start">
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          <div className="flex items-center space-x-2 pb-3 border-b"><Checkbox id="chk-todos" checked={dashContratosSelecionados.length === 0} onCheckedChange={(c) => { if (c) setDashContratosSelecionados([]) }} /><Label htmlFor="chk-todos" className="font-bold cursor-pointer text-sm">Selecionar Todos</Label></div>
          {contratosVisao.map(c => (
            <div key={c.id} className="flex items-center space-x-2 py-1">
              <Checkbox id={`chk-${c.id}`} checked={dashContratosSelecionados.includes(c.id)} onCheckedChange={(checked) => { if (checked) setDashContratosSelecionados(prev => [...prev, c.id]); else setDashContratosSelecionados(prev => prev.filter(id => id !== c.id)) }} />
              <Label htmlFor={`chk-${c.id}`} className="cursor-pointer text-sm leading-tight flex-1"><span className="font-semibold text-primary">{c.codigo}</span> - {c.nome}</Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )

  const listaAtividadesDash = Array.from(new Set([...allTimesheets.map(t => t.activity), ...allAlocacoes.map(a => a.atividade)]))
  const contratoSelecionadoObj = contratos.find(c => c.id === contratoAtivo)

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>

if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="flex h-full w-full overflow-hidden bg-transparent">
      
      {/* 🧭 SIDEBAR LATERAL PROFISSIONAL */}
      <aside className="w-64 bg-card border-r flex flex-col shrink-0 h-full">
        {/* CABEÇALHO FIXO */}
        <div className="p-6 border-b flex items-center gap-3 bg-primary/5 shrink-0">
          <Building2 className="w-6 h-6 text-primary" />
          <div><h2 className="font-bold text-sm tracking-tight leading-none">Engeprice</h2><p className="text-[10px] text-muted-foreground mt-1">Management ERP</p></div>
        </div>
        
        {/* MENU DE NAVEGAÇÃO ROLÁVEL (O 'min-h-0' é a trava que salva o rodapé) */}
        <nav className="p-4 flex-1 space-y-6 overflow-y-auto min-h-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Engenharia & Cadastros</p>
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('contratos')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'contratos' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Briefcase className="w-4 h-4"/> Contratos e Clientes</button>
              <button onClick={() => setMenuAtivo('os')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'os' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><FolderTree className="w-4 h-4"/> Ordens de Serviço (OS)</button>
              <button onClick={() => setMenuAtivo('equipe')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'equipe' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Target className="w-4 h-4"/> Equipe & Metas</button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Operação & Lançamentos</p>
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('alocacoes')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'alocacoes' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Clock className="w-4 h-4"/> Matriz de Alocação</button>
              <button onClick={() => setMenuAtivo('medicoes')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'medicoes' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Percent className="w-4 h-4"/> Medições Mensais (%)</button>
              <button onClick={() => setMenuAtivo('gestao')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'gestao' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><History className="w-4 h-4"/> Ajustes de Horas (Admin)</button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">BI & Indicadores</p>
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('alertas')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors bg-red-500/5 ${menuAtivo === 'alertas' ? 'bg-red-500! text-white' : 'text-red-600 hover:bg-red-500/10'}`}><AlertTriangle className="w-4 h-4"/> Radar de Alertas</button>
              <button onClick={() => setMenuAtivo('dash-mensal')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'dash-mensal' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><CalendarDays className="w-4 h-4"/> Folha (Mensal)</button>
              <button onClick={() => setMenuAtivo('dash-global')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'dash-global' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Layers className="w-4 h-4"/> Saúde (Global)</button>
            </div>
          </div>
        </nav>
        
        {/* RODAPÉ FIXO NA BASE */}
        <div className="p-4 border-t flex items-center justify-between bg-muted/40 shrink-0">
          <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full">{theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4" />}</Button>
          <Avatar className="h-8 w-8 border shadow-sm"><AvatarFallback className="text-xs bg-primary/10 text-primary">ADM</AvatarFallback></Avatar>
        </div>
      </aside>

      {/* 📄 ÁREA DE CONTEÚDO DINÂMICO */}
      <main className="flex-1 p-8 lg:p-10 overflow-y-auto h-full relative">
        
        {/* VIEW: CONTRATOS */}
        {menuAtivo === 'contratos' && (
          <Card>
            <CardHeader><CardTitle>Gestão Estratégica de Contratos</CardTitle><CardDescription>Classifique os contratos cadastrados e gerencie as fontes de faturamento corporativo.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 mb-6 items-end bg-muted/30 p-4 rounded-xl border">
                <div className="space-y-2 w-32"><Label>Código</Label><Input placeholder="CT-001" className="uppercase" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} /></div>
                <div className="space-y-2 flex-1 min-w-[200px]"><Label>Nome do Cliente / Obra</Label><Input placeholder="Nome da Obra" value={novoNomeContrato} onChange={(e) => setNovoNomeContrato(e.target.value)} /></div>
                <div className="space-y-2 w-48"><Label>Tipo Comercial</Label>
                  <Select value={novoTipo} onValueChange={setNovoTipo}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horas">Escopo Fechado (Por Horas)</SelectItem>
                      <SelectItem value="fechado">Preço Fechado (%)</SelectItem>
                      <SelectItem value="continuado_com_os">Sob Demanda (Com OS)</SelectItem>
                      <SelectItem value="continuado_sem_os">Assessoria (Horas Livres)</SelectItem>
                      <SelectItem value="continuado_limite_mensal">Assessoria (Teto Mensal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-32"><Label>Fonte de Faturamento</Label>
                  <Select value={novaFonte} onValueChange={setNovaFonte}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="EC">EC (Consulting)</SelectItem><SelectItem value="ET">ET (Treinamentos)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-20"><Label>Ini. Ciclo</Label><Input type="number" min={1} max={31} value={novoInicio} onChange={(e) => setNovoInicio(Number(e.target.value))} /></div>
                <div className="space-y-2 w-20"><Label>Fim Ciclo</Label><Input type="number" min={1} max={31} value={novoFim} onChange={(e) => setNovoFim(Number(e.target.value))} /></div>
                <Button className="gap-2 shrink-0 shadow-md" onClick={criarNovoContrato}><PlusCircle className="w-4 h-4" /> Cadastrar</Button>
                <div className="relative border-l pl-4 shrink-0">
                  <input type="file" id="csv-upload" className="hidden" accept=".csv" onChange={handleImportarCSV} />
                  <Button variant="outline" className="gap-2 text-primary border-primary/30" onClick={() => document.getElementById('csv-upload')?.click()}><FileUp className="w-4 h-4" /> Importar CSV</Button>
                </div>
              </div>

              <div className="border rounded-xl divide-y max-h-[500px] overflow-y-auto bg-card shadow-sm">
                {contratos.filter(c => c.tipo !== 'overhead').map(c => (
                  <div key={c.id} className="p-4 flex flex-wrap gap-4 justify-between items-center hover:bg-muted/20">
                    {editandoId === c.id ? (
                      <div className="flex flex-1 flex-wrap gap-3 items-center">
                        <Input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} className="w-24 uppercase" />
                        <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="flex-1 min-w-[200px]" />
                        <Select value={editTipo} onValueChange={editTipo => setEditTipo(editTipo)}>
                          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="horas">Escopo Fechado (Por Horas)</SelectItem>
                                <SelectItem value="fechado">Preço Fechado (%)</SelectItem>
                                <SelectItem value="continuado_com_os">Sob Demanda (Com OS)</SelectItem>
                                <SelectItem value="continuado_sem_os">Assessoria (Horas Livres)</SelectItem>
                                <SelectItem value="continuado_limite_mensal">Assessoria (Teto Mensal)</SelectItem>
                              </SelectContent>
                        </Select>
                        <Select value={editFonte} onValueChange={editFonte => setEditFonte(editFonte)}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EC">EC</SelectItem><SelectItem value="ET">ET</SelectItem></SelectContent></Select>
                        <Input type="number" value={editInicio} onChange={(e) => setEditInicio(Number(e.target.value))} className="w-16" />
                        <Input type="number" value={editFim} onChange={(e) => setEditFim(Number(e.target.value))} className="w-16" />
                        <div className="flex gap-2 border p-2 rounded-md"><Switch id={`st-${c.id}`} checked={editStatus} onCheckedChange={setEditStatus} /><Label htmlFor={`st-${c.id}`}>{editStatus ? 'Ativo' : 'Inativo'}</Label></div>
                        <Button size="icon" variant="ghost" className="text-green-500" onClick={() => salvarEdicaoContrato(c.id)}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditandoId(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4 flex-1">
                          <Briefcase className="text-primary w-5 h-5 shrink-0" />
                          <div>
                            <p className="font-bold flex items-center gap-2">
                              {c.codigo} 
                              <Badge variant="secondary" className={c.fonte_pagamento === 'EC' ? 'bg-blue-500/10 text-blue-600 border-none' : 'bg-purple-500/10 text-purple-600 border-none'}>{c.fonte_pagamento}</Badge>
                            </p>
                            <p className="text-sm text-muted-foreground">{c.nome} • Modalidade: {c.tipo.replace(/_/g, ' ').toUpperCase()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.status_ativo ? <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/5">Ativo</Badge> : <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5">Inativo</Badge>}
                          <Button variant="outline" size="sm" onClick={() => { iniciarEdicao(c) }} className="gap-1.5 h-8"><Pencil className="w-3.5 h-3.5" /> Editar</Button>
                          <Button variant="ghost" size="icon" onClick={() => excluirContrato(c.id, c.nome)} className="text-red-500 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
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
          <Card className="border-t-4 border-t-amber-500">
            <CardHeader><CardTitle>Central de Ordens de Serviço (OS)</CardTitle><CardDescription>Distribua os subcontratos e limites de horas das obras Sob Demanda.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-4 items-end bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
                <div className="space-y-2 flex-1 min-w-[250px]"><Label>Contrato Mestre (Sob Demanda)</Label>
                  <Select value={osContratoId} onValueChange={setOsContratoId}>
                    <SelectTrigger className="bg-background border-amber-500/30"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{contratos.filter(c => c.tipo === 'continuado_com_os' && c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-32"><Label>Código OS</Label><Input placeholder="OS-001" value={osCodigo} onChange={e => setOsCodigo(e.target.value)} className="uppercase" /></div>
                <div className="space-y-2 flex-1"><Label>Escopo / Descrição</Label><Input placeholder="Projeto X..." value={osDescricao} onChange={e => setOsDescricao(e.target.value)} /></div>
                <div className="space-y-2 w-32"><Label>Limite (Horas)</Label><Input type="number" placeholder="50" value={osHoras || ''} onChange={e => setOsHoras(Number(e.target.value))} /></div>
                <Button onClick={criarOS} className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm"><FolderTree className="w-4 h-4 mr-2"/> Vincular OS</Button>
              </div>

              <div className="border rounded-xl divide-y bg-card shadow-sm">
                {osList.filter(o => o.contract_id === osContratoId).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Selecione uma obra mestre acima para visualizar suas Ordens de Serviço ativas.</div>
                ) : osList.filter(o => o.contract_id === osContratoId).map(os => (
                  <div key={os.id} className="p-4 flex flex-wrap justify-between items-center hover:bg-muted/10">
                    {osEditandoId === os.id ? (
                      <div className="flex flex-1 gap-3 items-center">
                        <Input value={editOsCodigo} onChange={e => setEditOsCodigo(e.target.value)} className="w-24 uppercase font-bold" />
                        <Input value={editOsDescricao} onChange={e => setEditOsDescricao(e.target.value)} className="flex-1" />
                        <div className="relative w-32"><Input type="number" value={editOsHoras} onChange={e => setEditOsHoras(Number(e.target.value))} className="pr-8" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">h</span></div>
                        <Button size="icon" variant="ghost" className="text-green-500" onClick={() => salvarEdicaoOS(os.id)}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setOsEditandoId(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <div><p className="font-bold text-amber-600 text-sm">{os.codigo}</p><p className="text-xs text-muted-foreground mt-0.5">{os.descricao || 'Sem descrição cadastrada'}</p></div>
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-none ml-4 font-mono">{os.horas_previstas}h orçadas</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => iniciarEdicaoOS(os)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => apagarOS(os.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* VIEW: EQUIPE & METAS */}
        {menuAtivo === 'equipe' && (
          <Card className="border-t-4 border-t-emerald-500">
            <CardHeader><CardTitle>Horas Contratuais Mínimas</CardTitle><CardDescription>Defina a meta de horas mínimas que a Engeprice assegura faturar para cada consultor por mês.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {consultores.map(c => (
                  <div key={c.id} className="border p-4 rounded-xl flex flex-col gap-3 bg-muted/10 shadow-sm">
                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-emerald-600"/><span className="font-bold text-sm">{c.nome}</span></div>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <Input 
                          type="number" 
                          value={metasEdit[c.id] !== undefined ? metasEdit[c.id] : c.horas_minimas_mes} 
                          onChange={(e) => setMetasEdit(prev => ({...prev, [c.id]: Number(e.target.value)}))}
                          className="pl-8 font-bold" 
                        />
                        <Target className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">horas/mês</span>
                      <Button size="icon" onClick={() => atualizarMetaConsultor(c.id, metasEdit[c.id] !== undefined ? metasEdit[c.id] : c.horas_minimas_mes)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"><Save className="w-4 h-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* VIEW: RADAR DE ALERTAS */}
        {menuAtivo === 'alertas' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-red-500 bg-red-500/5">
                <CardHeader><CardTitle className="text-red-600 flex items-center gap-2 text-base"><AlertTriangle className="w-5 h-5"/> Ociosidade Crítica (&lt; 30% da Carga Mínima)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {radarAlertas.ociosos.length === 0 ? <p className="text-muted-foreground text-xs p-2">Toda a equipe está engajada no ciclo atual!</p> : radarAlertas.ociosos.map((o, i) => (
                    <div key={i} className="bg-background p-4 rounded-xl border border-red-200 flex justify-between items-center shadow-sm">
                      <div><p className="font-bold text-sm">{o.nome}</p><p className="text-xs text-muted-foreground mt-0.5">Mínimo: {o.meta}h | Apontou: {o.trabalhadas}h</p></div>
                      <Badge variant="destructive" className="font-mono text-sm">{o.percentual}%</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-amber-500 bg-amber-500/5">
                <CardHeader><CardTitle className="text-amber-600 flex items-center gap-2 text-base"><AlertTriangle className="w-5 h-5"/> Atenção para Aditivos (&gt; 70% Consumido)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {radarAlertas.estourados.length === 0 ? <p className="text-muted-foreground text-xs p-2">Nenhum contrato atingiu o limite crítico.</p> : radarAlertas.estourados.map((e, i) => (
                    <div key={i} className="bg-background p-4 rounded-xl border border-amber-200 flex justify-between items-center shadow-sm">
                      <div className="max-w-[70%]"><p className="font-bold text-sm truncate">{e.contrato}</p><p className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded w-fit mt-1">{e.tipo.replace(/_/g, ' ').toUpperCase()}</p></div>
                      <Badge className="bg-amber-500 text-white font-mono text-sm">{e.perc}%</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* VIEW: ALOCAÇÃO DE HORAS */}
        {menuAtivo === 'alocacoes' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">1. Projeto Mestre</CardTitle></CardHeader>
                <CardContent>
                  <Select value={contratoAtivo} onValueChange={(val) => { setContratoAtivo(val); setAlocacoes({}); }}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Escolha a obra..." /></SelectTrigger>
                    <SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className={!contratoAtivo ? 'opacity-40 pointer-events-none' : ''}>
                <CardHeader className="pb-3"><CardTitle className="text-sm">2. Selecionar Engenheiro</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 max-h-[350px] overflow-y-auto p-3">
                  {consultores.map(user => {
                    const jaAlocado = !!alocacoes[user.id]
                    return (
                      <div key={user.id} onClick={() => addConsultor(user.id)} className={`p-2.5 rounded-lg border text-xs flex justify-between items-center transition-colors ${jaAlocado ? 'bg-muted opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary hover:bg-primary/5'}`}>
                        <span className="font-medium">{user.nome}</span><ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-8">
              <Card className="h-full min-h-[450px] flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                  <div><CardTitle className="text-base">3. Distribuição de Metas de Custo</CardTitle></div>
                  {contratoAtivo && <Button onClick={salvarAlocacoesNoBanco} disabled={salvando} className="gap-2 h-9 shadow-sm"><Save className="w-4 h-4" /> Gravar Matriz</Button>}
                </CardHeader>
                <CardContent className="p-4 space-y-4 overflow-y-auto max-h-[500px]">
                  {carregandoAlocacoes ? (
                    <div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
                  ) : Object.values(alocacoes).length === 0 ? <div className="text-center text-muted-foreground text-xs py-12">Selecione uma obra e adicione consultores.</div> : 
                    Object.values(alocacoes).map(aloc => (
                      <div key={aloc.consultorId} className="border rounded-xl p-4 bg-card shadow-sm">
                        <div className="flex justify-between items-center border-b pb-3 mb-3">
                          <div><h4 className="font-bold text-sm text-primary">{consultores.find(c => c.id === aloc.consultorId)?.nome}</h4><p className="text-[10px] text-muted-foreground mt-0.5">{contratoSelecionadoObj?.tipo === 'continuado_limite_mensal' ? 'Teto Mensal (Horas)' : 'Teto Global (Horas)'}</p></div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex items-center">
                              <Input type="number" value={aloc.horasTotais || ''} onChange={(e) => updateHoras(aloc.consultorId, Number(e.target.value))} className="w-24 h-8 pr-6 font-bold text-right text-primary bg-muted/50" disabled={aloc.atividades.length > 0} />
                              <span className="absolute right-2 text-xs text-muted-foreground">h</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeConsultor(aloc.consultorId)} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        <div className="pl-3 border-l-2 border-primary/20 space-y-2">
                          <div className="flex justify-between items-center text-xs"><span className="font-medium text-muted-foreground">Disciplinas / Escopos</span><Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => addAtiv(aloc.consultorId)}><PlusCircle className="w-3 h-3 mr-1" /> Adicionar</Button></div>
                          {aloc.atividades.map(a => (
                            <div key={a.id} className="flex gap-2 items-center bg-muted/30 p-2 rounded-lg text-xs">
                              <span className="flex-1 font-medium">{a.nome}</span>
                              <div className="relative w-24"><Input type="number" className="h-7 text-right font-bold pr-5" value={a.horas || ''} onChange={(e) => updateAtiv(aloc.consultorId, a.id, Number(e.target.value))} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">h</span></div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => removeAtiv(aloc.consultorId, a.id, a.dbId)}><X className="w-3.5 h-3.5" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* VIEW: MEDIÇÕES MENSAIS (%) */}
        {menuAtivo === 'medicoes' && (
          <Card className="border-t-4 border-t-amber-500">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <CardTitle className="text-xl">Lançamento de Medições</CardTitle>
              <CardDescription>Insira o avanço físico mensal dos consultores em contratos fechados.</CardDescription>
              <div className="flex flex-wrap gap-3 mt-4 p-3 bg-background border rounded-lg shadow-sm">
                <Select value={medMes} onValueChange={setMedMes}>
                  <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={medAno} onValueChange={setMedAno}>
                  <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                </Select>
                {/* 🌟 NOVO FILTRO DE FONTE (EC/ET) NAS MEDIÇÕES */}
                <Select value={medFonte} onValueChange={setMedFonte}>
                  <SelectTrigger className="w-36 h-9 border-primary/50"><SelectValue placeholder="Divisão" /></SelectTrigger>
                  <SelectContent><SelectItem value="todas">Todas (EC + ET)</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent>
                </Select>
                <Select value={medContrato} onValueChange={setMedContrato}>
                  <SelectTrigger className="w-60 h-9 border-primary"><SelectValue placeholder="Selecione a Obra..." /></SelectTrigger>
                  <SelectContent>
                    {contratos.filter(c => c.status_ativo && c.tipo === 'fechado' && (medFonte === 'todas' ? true : c.fonte_pagamento === medFonte)).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {!medContrato ? <div className="text-center text-muted-foreground py-12 text-sm border border-dashed rounded-xl">Selecione os filtros e a obra acima para carregar a equipe.</div> : medLoading ? <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" /></div> : medConsultores.length === 0 ? <p className="text-center text-muted-foreground py-6 text-xs">Nenhum engenheiro alocado nesta matriz.</p> : (
                <div className="max-w-4xl mx-auto space-y-4">
                  {medConsultores.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/10 shadow-sm">
                      <span className="font-semibold text-sm">{c.nome}</span>
                      <div className="flex items-center gap-2"><div className="relative w-28"><Input type="number" className="pr-8 text-right font-bold text-primary h-9" value={medicoesInput[c.id] || ''} onChange={e => setMedicoesInput(p => ({...p, [c.id]: Number(e.target.value)}))} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">%</span></div></div>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-end"><Button onClick={salvarMedicoes} disabled={salvando} className="bg-amber-500 hover:bg-amber-600 text-white w-40 h-9"><Save className="w-4 h-4 mr-1.5" /> Gravar Medição</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* VIEW: GESTÃO DE APONTAMENTOS (ADMIN) */}
        {menuAtivo === 'gestao' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5">
              <Card className="border-t-4 border-t-purple-500 shadow-sm">
                <CardHeader className="border-b pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4"/> Lançamento Direto</CardTitle>
                    <input type="file" id="csv-ts-up" className="hidden" accept=".csv" onChange={handleImportarTimesheetCSV} />
                    <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 text-[11px] h-8" onClick={() => document.getElementById('csv-ts-up')?.click()}><FileUp className="w-3.5 h-3.5 mr-1" /> Planilha Antiga</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-xs">
                  <div className="space-y-1"><Label>Engenheiro</Label><Select value={gestaoConsultor} onValueChange={setGestaoConsultor}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Contrato</Label><Select value={gestaoContrato} onValueChange={setGestaoContrato}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Disciplina / Escopo</Label><Select value={gestaoAtividade} onValueChange={setGestaoAtividade} disabled={!gestaoContrato}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{gestaoAtividadesDisponiveis.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Data</Label><Input type="date" value={gestaoData} onChange={e => setGestaoData(e.target.value)} className="h-9" /></div>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="space-y-1"><Label>Início</Label><Input type="time" value={gestaoInicio} onChange={e => setGestaoInicio(e.target.value)} className="h-9 px-1" /></div>
                      <div className="space-y-1"><Label>Fim</Label><Input type="time" value={gestaoFim} onChange={e => setGestaoFim(e.target.value)} className="h-9 px-1" /></div>
                    </div>
                  </div>
                  <div className="space-y-1"><Label>Observação Interna</Label><Input placeholder="Descreva o escopo realizado..." value={gestaoNotes} onChange={e => setGestaoNotes(e.target.value)} className="h-9" /></div>
                  <Button onClick={salvarApontamentoAdmin} disabled={salvando} className="w-full h-9 bg-purple-600 hover:bg-purple-700 mt-2 text-xs">{salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} {gestaoEditandoId ? 'Atualizar Histórico' : 'Gravar Horas'}</Button>
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-7">
              <Card className="h-full max-h-[500px] flex flex-col shadow-sm">
                <CardHeader className="border-b py-3"><CardTitle className="text-xs font-bold text-muted-foreground">Últimos Lançamentos Efetuados</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 divide-y text-xs">
                  {gestaoLogsFiltrados.map(t => {
                    const s = new Date(t.start_at); const e = t.end_at ? new Date(t.end_at) : new Date();
                    return (
                      <div key={t.id} className="p-3 hover:bg-muted/40 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-foreground text-xs">{consultores.find(c => c.id === t.user_id)?.nome}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{contratos.find(c => c.id === t.contract_id)?.codigo} • {t.activity} • {s.toLocaleDateString('pt-BR')}</p>
                          {t.notes && <p className="text-[10px] italic text-primary font-medium mt-1 truncate max-w-[280px]">"{t.notes}"</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="font-mono bg-primary/10 text-primary border-none h-6 px-1.5">{((e.getTime() - s.getTime()) / 3600000).toFixed(1)}h</Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => iniciarEdicaoApontamento(t)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => excluirApontamentoAdmin(t.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* VIEW: DASHBOARD MENSAL (FOLHA) */}
        {menuAtivo === 'dash-mensal' && (
          <Card className="border-t-4 border-t-blue-500 shadow-sm min-h-[500px]">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div><CardTitle className="text-lg">Folha de Medição Mensal</CardTitle><CardDescription>Acompanhe o volume faturado filtrando por modelo de contrato.</CardDescription></div>
                <Button onClick={exportarExcel} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-8"><Download className="w-4 h-4" /> Exportar CSV</Button>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 items-center bg-background p-2.5 rounded-lg border shadow-sm">
                <Select value={dashVisaoTipo} onValueChange={(v: any) => { setDashVisaoTipo(v); setDashContratosSelecionados([]); }}>
                  <SelectTrigger className="w-56 h-8 text-xs border-primary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="horas">Escopo Fechado (Por Horas)</SelectItem>
                        <SelectItem value="fechado">Preço Fechado (%)</SelectItem>
                        <SelectItem value="continuado_com_os">Sob Demanda (Com OS)</SelectItem>
                        <SelectItem value="continuado_sem_os">Assessoria (Horas Livres)</SelectItem>
                        <SelectItem value="continuado_limite_mensal">Assessoria (Teto Mensal)</SelectItem>
                        <SelectItem value="overhead">Overhead (Custos/Apoio)</SelectItem>
                      </SelectContent>
                </Select>
                {/* 🌟 FILTRO EC/ET INTEGRADO NO DASHBOARD MENSAL */}
                <Select value={dashFonte} onValueChange={setDashFonte}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-muted/40"><SelectValue placeholder="Divisão" /></SelectTrigger>
                  <SelectContent><SelectItem value="todas">EC + ET</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent>
                </Select>
                <div className="w-44">{renderFiltroContratosMultiplos()}</div>
                <Select value={dashMes} onValueChange={setDashMes}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={dashAno} onValueChange={setDashAno}><SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : dashData.consultoresPagamento.length === 0 ? <div className="text-center text-muted-foreground text-xs py-12">Nenhum registro encontrado no ciclo para esse filtro.</div> : (
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashData.consultoresPagamento} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                      <XAxis dataKey="nomeCurto" tickLine={false} axisLine={false} style={{fontSize: '11px'}} />
                      <YAxis tickLine={false} axisLine={false} style={{fontSize: '11px'}} tickFormatter={(v) => dashVisaoTipo === 'fechado' ? `${v}%` : `${v}h`} />
                      <RechartsTooltip cursor={{fill: '#88888811'}} contentStyle={{borderRadius: '8px'}} formatter={(v: number, name: string, props: any) => [dashVisaoTipo === 'fechado' ? `${v}%` : `${v} horas`, dashVisaoTipo === 'fechado' ? 'Medição' : 'Trabalhado']} />
                      <Bar dataKey="valorGrafico" radius={[4, 4, 0, 0]} maxBarSize={45}>
                        {dashData.consultoresPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={dashVisaoTipo === 'fechado' ? '#f59e0b' : CORES_GRAFICO[index % CORES_GRAFICO.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* VIEW: DASHBOARD GLOBAL (SAÚDE FINANCEIRA) */}
        {menuAtivo === 'dash-global' && (
          <Card className="border-t-4 border-t-amber-500 shadow-sm min-h-[500px]">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <div><CardTitle className="text-lg">Saúde Financeira Consolidade</CardTitle><CardDescription>Monitore a queima do saldo global ou o avanço das entregas por divisão comercial.</CardDescription></div>
              <div className="flex flex-wrap gap-3 mt-4 items-center bg-background p-2.5 rounded-lg border shadow-sm">
                <Select value={dashVisaoTipo} onValueChange={(v: any) => { setDashVisaoTipo(v); setDashContratosSelecionados([]); }}>
                  <SelectTrigger className="w-56 h-8 text-xs border-primary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="horas">Escopo Fechado (Por Horas)</SelectItem>
                        <SelectItem value="fechado">Preço Fechado (%)</SelectItem>
                        <SelectItem value="continuado_com_os">Sob Demanda (Com OS)</SelectItem>
                        <SelectItem value="continuado_sem_os">Assessoria (Horas Livres)</SelectItem>
                        <SelectItem value="continuado_limite_mensal">Assessoria (Teto Mensal)</SelectItem>
                        <SelectItem value="overhead">Overhead (Custos/Apoio)</SelectItem>
                      </SelectContent>
                </Select>
                {/* 🌟 FILTRO EC/ET INTEGRADO NO DASHBOARD FINANCEIRO */}
                <Select value={dashFonte} onValueChange={setDashFonte}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-muted/40"><SelectValue placeholder="Divisão" /></SelectTrigger>
                  <SelectContent><SelectItem value="todas">EC + ET</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent>
                </Select>
                <div className="w-44">{renderFiltroContratosMultiplos()}</div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-4">
                    {['horas', 'continuado_com_os', 'continuado_limite_mensal', 'overhead'].includes(dashVisaoTipo) ? (
                      <>
                        <div className="border p-4 rounded-xl bg-muted/10"><p className="text-[10px] font-bold text-muted-foreground uppercase">Budget Total Alocado</p><p className="text-3xl font-bold font-mono mt-0.5">{dashData.orcadoGlobal}h</p></div>
                        <div className="border p-4 rounded-xl bg-red-500/5 border-red-500/10"><p className="text-[10px] font-bold text-red-600 uppercase">Horas Consumidas</p><p className="text-3xl font-bold font-mono text-red-600 mt-0.5">{dashData.gastoGlobal.toFixed(1)}h</p></div>
                        <div className={`border p-4 rounded-xl ${dashData.saldoGlobal < 0 ? 'bg-red-500/10 border-red-500/20 text-red-600' : 'bg-green-500/5 border-green-500/10 text-green-600'}`}><p className="text-[10px] font-bold uppercase">Saldo em Conta</p><p className="text-3xl font-bold font-mono mt-0.5">{dashData.saldoGlobal.toFixed(1)}h</p></div>
                      </>
                    ) : (
                      <>
                        <div className="border p-4 rounded-xl bg-muted/10"><p className="text-[10px] font-bold text-muted-foreground uppercase">Rateio Distribuído Equipe</p><p className="text-3xl font-bold text-primary mt-0.5">{dashVisaoTipo === 'fechado' ? `${dashData.percentualGlobal}%` : '---'}</p></div>
                        <div className="border p-4 rounded-xl bg-primary/5 border-primary/10"><p className="text-[10px] font-bold text-primary uppercase">{dashVisaoTipo === 'fechado' ? 'Avanço Físico Medido' : 'Tempo de Apoio Investido'}</p><p className="text-3xl font-bold text-primary mt-0.5">{dashVisaoTipo === 'fechado' ? `${dashData.medidoGlobal}%` : `${dashData.gastoGlobal.toFixed(1)}h`}</p></div>
                      </>
                    )}
                  </div>
                  {/* 🍕 GRÁFICO DE PIZZA IMORTAL (CORRIGIDO) */}
                  <div className="h-[280px] w-full flex flex-col items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dashData.pieData.length > 0 ? dashData.pieData : [{name: 'Sem registros', value: 1}]} innerRadius={75} outerRadius={105} paddingAngle={4} dataKey="value" stroke="none">
                          <Cell fill={dashVisaoTipo === 'fechado' ? "#f59e0b" : "#ef4444"} /> 
                          <Cell fill={dashData.pieData.length > 1 ? "#22c55e" : "#88888822"} />
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => [dashVisaoTipo === 'fechado' ? `${v}%` : `${v.toFixed(1)}h`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center pointer-events-none">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{dashVisaoTipo === 'fechado' ? 'Avanço Físico' : 'Consumo'}</p>
                      <p className="text-2xl font-black text-primary mt-0.5">{dashVisaoTipo === 'fechado' ? `${dashData.medidoGlobal}%` : dashVisaoTipo === 'continuado_sem_os' ? '---' : `${dashData.percentualGlobal}%`}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  )
}