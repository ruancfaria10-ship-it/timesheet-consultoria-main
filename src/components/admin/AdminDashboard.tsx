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
  CalendarDays, Download, Percent, History, 
  FileUp, FolderTree, Target, AlertTriangle, Building2, UserCog, Receipt
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts'

type Consultor = { id: string, nome: string, horas_minimas_mes: number }
type Contrato = { id: string, codigo: string, nome: string, status_ativo: boolean, tipo: string, fonte_pagamento: string, teto_global_horas: number, ciclo_inicio: number, ciclo_fim: number, ciclo_fat_inicio: number, ciclo_fat_fim: number }
type OrdemServico = { id: string, contract_id: string, codigo: string, descricao: string, status_ativa: boolean, horas_previstas: number }
type AtividadeAlocada = { id: string, dbId?: string, nome: string, horas: number }
type Alocacao = { consultorId: string, horasTotais: number, geralId?: string, atividades: AtividadeAlocada[] }
type TimesheetLog = { id: string, user_id: string, contract_id: string, os_id?: string, activity: string, start_at: string, end_at: string | null, notes?: string }
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
  const [editOsStatus, setEditOsStatus] = useState<boolean>(true) // 🌟 NOVO: ESTADO STATUS DA OS NA EDIÇÃO

  // Estados Alocações
  const [contratoAtivo, setContratoAtivo] = useState<string>('')
  const [alocacaoOsId, setAlocacaoOsId] = useState<string>('') 
  const [alocacoes, setAlocacoes] = useState<Record<string, Alocacao>>({})
  const [carregandoAlocacoes, setCarregandoAlocacoes] = useState(false)

  // Estados Equipe e Metas
  const [metasEdit, setMetasEdit] = useState<Record<string, number>>({})

  // Estados Medições
  const [medContrato, setMedContrato] = useState<string>('')
  const [medMes, setMedMes] = useState<string>(new Date().getMonth().toString())
  const [medAno, setMedAno] = useState<string>(new Date().getFullYear().toString())
  const [medFonte, setMedFonte] = useState<string>('todas')
  const [medicoesInput, setMedicoesInput] = useState<Record<string, number>>({})
  const [medConsultores, setMedConsultores] = useState<Consultor[]>([])
  const [medLoading, setMedLoading] = useState(false)

  // Estados Dashboards (Folha e Global)
  const [dashVisaoTipos, setDashVisaoTipos] = useState<string[]>(['horas', 'continuado_com_os', 'continuado_limite_mensal', 'overhead'])
  const [dashMes, setDashMes] = useState<string>(new Date().getMonth().toString())
  const [dashAno, setDashAno] = useState<string>(new Date().getFullYear().toString())
  const [dashContratosSelecionados, setDashContratosSelecionados] = useState<string[]>([]) 
  const [dashOs, setDashOs] = useState<string>('todas') 
  const [dashConsultor, setDashConsultor] = useState<string>('todos')
  const [dashAtividade, setDashAtividade] = useState<string>('todas')
  const [dashFonte, setDashFonte] = useState<string>('todas')

  // Estados Dashboard (Faturamento Cliente)
  const [fatVisaoTipos, setFatVisaoTipos] = useState<string[]>(['horas', 'continuado_com_os', 'continuado_limite_mensal', 'overhead'])
  const [fatMes, setFatMes] = useState<string>(new Date().getMonth().toString())
  const [fatAno, setFatAno] = useState<string>(new Date().getFullYear().toString())
  const [fatContratosSelecionados, setFatContratosSelecionados] = useState<string[]>([]) 
  const [fatOs, setFatOs] = useState<string>('todas') // 🌟 NOVO: ESTADO OS NO FATURAMENTO
  const [fatFonte, setFatFonte] = useState<string>('todas')

  const [allTimesheets, setAllTimesheets] = useState<TimesheetLog[]>([])
  const [allAlocacoes, setAllAlocacoes] = useState<any[]>([])
  const [allMedicoes, setAllMedicoes] = useState<Medicao[]>([])
  const [loadingDash, setLoadingDash] = useState(false)

  // Estados Gestão Retroativa
  const [gestaoConsultor, setGestaoConsultor] = useState<string>('')
  const [gestaoContrato, setGestaoContrato] = useState<string>('')
  const [gestaoOs, setGestaoOs] = useState<string>('')
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
        teto_global_horas: c.teto_global_horas || 0,
        ciclo_inicio: c.ciclo_inicio || 25, ciclo_fim: c.ciclo_fim || 24,
        ciclo_fat_inicio: c.ciclo_fat_inicio || 1, ciclo_fat_fim: c.ciclo_fat_fim || 31
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
    await supabase.from('contratos').insert([{ 
      codigo: novoCodigo.toUpperCase().trim(), nome: novoNomeContrato.trim(), 
      status_ativo: true, tipo: novoTipo, fonte_pagamento: novaFonte, 
      teto_global_horas: novoTipo === 'continuado_com_os' ? novoTetoGlobal : 0,
      ciclo_inicio: novoInicio, ciclo_fim: novoFim, ciclo_fat_inicio: novoFatInicio, ciclo_fat_fim: novoFatFim
    }])
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
  
  async function excluirContrato(id: string, nome: string) {
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('contract_id', id);
    if (count && count > 0) return alert(`❌ BLOQUEIO:\n\nEste contrato possui ${count} apontamentos vinculados. Apenas inative-o.`);
    if (!window.confirm(`Excluir definitivamente "${nome}" e suas alocações vazias?`)) return;
    await supabase.from('alocacoes').delete().eq('contract_id', id); 
    await supabase.from('medicoes').delete().eq('contract_id', id); 
    await supabase.from('contratos').delete().eq('id', id);
    if (contratoAtivo === id) { setContratoAtivo(''); setAlocacoes({}); }
    carregarDadosDoBanco();
  }

  // ==========================================
  // FUNÇÕES DE ORDEM DE SERVIÇO (COM TETO GLOBAL E STATUS)
  // ==========================================
  async function criarOS() {
    if (!osContratoId || !osCodigo) return alert("Selecione o Contrato e digite o Código da OS.");
    
    const contMestre = contratos.find(c => c.id === osContratoId);
    if (contMestre && contMestre.teto_global_horas > 0) {
      const horasAtuais = osList.filter(o => o.contract_id === osContratoId).reduce((sum, o) => sum + o.horas_previstas, 0);
      if (horasAtuais + osHoras > contMestre.teto_global_horas) {
        return alert(`❌ Teto Excedido!\nO contrato mestre possui um limite global de ${contMestre.teto_global_horas}h.\nAs OS atuais já somam ${horasAtuais}h. Você não pode adicionar mais ${osHoras}h.`);
      }
    }

    await supabase.from('ordens_servico').insert([{
      contract_id: osContratoId, codigo: osCodigo.toUpperCase().trim(), descricao: osDescricao.trim(), horas_previstas: osHoras, status_ativa: true // 🌟 NOVO: STATUS ATIVA
    }]);
    setOsCodigo(''); setOsDescricao(''); setOsHoras(0); carregarDadosDoBanco(); alert("OS criada com sucesso!");
  }

  function iniciarEdicaoOS(os: OrdemServico) {
    setOsEditandoId(os.id); setEditOsCodigo(os.codigo); setEditOsDescricao(os.descricao); setEditOsHoras(os.horas_previstas);
    setEditOsStatus(os.status_ativa !== false); // 🌟 NOVO: PEGA O STATUS ATUAL (Cuidado com null)
  }

  async function salvarEdicaoOS(id: string) {
    await supabase.from('ordens_servico').update({
      codigo: editOsCodigo.toUpperCase().trim(), descricao: editOsDescricao.trim(), horas_previstas: editOsHoras,
      status_ativa: editOsStatus // 🌟 NOVO: GRAVA O STATUS NA EDIÇÃO
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
  // FUNÇÕES DE EQUIPE & METAS
  // ==========================================
  async function atualizarMetaConsultor(id: string, valor: number) {
    setConsultores(p => p.map(c => c.id === id ? { ...c, horas_minimas_mes: valor } : c));
    const { data, error } = await supabase.from('consultores').update({ horas_minimas_mes: valor }).eq('id', id).select();
    if (error) alert("❌ Erro do banco: " + error.message);
    else if (!data || data.length === 0) alert("❌ Falha Silenciosa no Supabase.");
    else alert("✅ Meta salva com segurança!");
  }

  // ==========================================
  // FUNÇÕES DE ALOCAÇÃO
  // ==========================================
  useEffect(() => { 
    if (contratoAtivo && menuAtivo === 'alocacoes') {
      const c = contratos.find(x => x.id === contratoAtivo);
      if (c?.tipo === 'continuado_com_os') {
        const primeiraOs = osList.filter(o => o.contract_id === contratoAtivo && o.status_ativa)[0]; // 🌟 NOVO: SÓ PEGA OS ATIVA PARA ALOCAR
        setAlocacaoOsId(primeiraOs ? primeiraOs.id : '');
        if(primeiraOs) carregarAlocacoesDoContrato(contratoAtivo, primeiraOs.id);
        else setAlocacoes({});
      } else {
        setAlocacaoOsId('');
        carregarAlocacoesDoContrato(contratoAtivo, '');
      }
    }
  }, [contratoAtivo, menuAtivo])

  useEffect(() => {
    if (contratoAtivo && alocacaoOsId && menuAtivo === 'alocacoes') carregarAlocacoesDoContrato(contratoAtivo, alocacaoOsId);
  }, [alocacaoOsId])
  
  async function carregarAlocacoesDoContrato(idContrato: string, idOs: string) {
    setCarregandoAlocacoes(true)
    let query = supabase.from('alocacoes').select('*').eq('contract_id', idContrato)
    if (idOs && idOs !== 'global') query = query.eq('os_id', idOs);
    else query = query.is('os_id', null);

    const { data } = await query;
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
      if (aloc.atividades.length > 0) aloc.horasTotais = aloc.atividades.reduce((sum, a) => sum + a.horas, 0);
      else { const rowGeral = data?.find(r => r.id === aloc.geralId); aloc.horasTotais = rowGeral ? rowGeral.horas_disponiveis : 0; }
    })
    setAlocacoes(alocSalvas); setCarregandoAlocacoes(false)
  }

  async function salvarAlocacoesNoBanco() {
    setSalvando(true)
    const { data: currentTimesheets } = await supabase.from('timesheets').select('*').eq('contract_id', contratoAtivo);
    const cObj = contratos.find(c => c.id === contratoAtivo);
    const isHora = cObj?.tipo === 'horas';
    const isSemOs = cObj?.tipo === 'continuado_sem_os';
    const isComOs = cObj?.tipo === 'continuado_com_os';
    const targetOsId = alocacaoOsId === 'global' ? null : (alocacaoOsId || null);

    // 🌟 NOVA TRAVA: Verifica se a soma da equipe não fura o teto da OS
    if (isComOs && targetOsId) {
      const currentOs = osList.find(o => o.id === targetOsId);
      if (currentOs && currentOs.horas_previstas > 0) {
        let totalAlocadoOS = 0;
        Object.values(alocacoes).forEach(aloc => {
          if (aloc.atividades.length > 0) {
            totalAlocadoOS += aloc.atividades.reduce((sum, a) => sum + (Number(a.horas) || 0), 0);
          } else {
            totalAlocadoOS += Number(aloc.horasTotais) || 0;
          }
        });
        
        if (totalAlocadoOS > currentOs.horas_previstas) {
          alert(`❌ LIMITE DA OS EXCEDIDO!\n\nA OS '${currentOs.codigo}' possui um limite global de ${currentOs.horas_previstas}h.\nA soma do que você distribuiu para a equipe dá ${totalAlocadoOS}h.\nReduza as horas antes de salvar.`);
          setSalvando(false);
          return;
        }
      }
    }

    const upserts: any[] = []; const inserts: any[] = []; const deletes: string[] = [];
    let bloqueio = false;

    Object.values(alocacoes).forEach(aloc => {
      const nomeCons = consultores.find(c => c.id === aloc.consultorId)?.nome;
      const hTotais = isSemOs ? 9999 : aloc.horasTotais;

      if (aloc.atividades.length > 0) {
        aloc.atividades.forEach(ativ => {
          const hAtiv = isSemOs ? 9999 : ativ.horas;
          if (isHora && currentTimesheets) {
            const consumed = currentTimesheets.filter(t => t.user_id === aloc.consultorId && t.activity === ativ.nome).reduce((acc, t) => acc + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
            if (hAtiv < consumed) { alert(`❌ TRAVA:\n${nomeCons} já gastou ${consumed.toFixed(1)}h na disciplina '${ativ.nome}'. Não pode reduzir para ${hAtiv}h.`); bloqueio = true; }
          }
          if (ativ.dbId) upserts.push({ id: ativ.dbId, user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: hAtiv, atividade: ativ.nome.trim() })
          else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: hAtiv, atividade: ativ.nome.trim() })
        })
        if (aloc.geralId) deletes.push(aloc.geralId)
      } else {
        if (isHora && currentTimesheets) {
          const consumed = currentTimesheets.filter(t => t.user_id === aloc.consultorId).reduce((acc, t) => acc + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
          if (hTotais < consumed) { alert(`❌ TRAVA:\n${nomeCons} já gastou ${consumed.toFixed(1)}h. Não pode reduzir para ${hTotais}h.`); bloqueio = true; }
        }
        if (aloc.geralId) upserts.push({ id: aloc.geralId, user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: hTotais, atividade: 'Sem atividade específica' })
        else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, os_id: targetOsId, horas_disponiveis: hTotais, atividade: 'Sem atividade específica' })
      }
    })

    if (bloqueio) return setSalvando(false);

    try {
      for (const u of upserts) await supabase.from('alocacoes').update({ horas_disponiveis: u.horas_disponiveis, atividade: u.atividade, os_id: u.os_id }).eq('id', u.id)
      if (inserts.length > 0) await supabase.from('alocacoes').insert(inserts)
      if (deletes.length > 0) await supabase.from('alocacoes').delete().in('id', deletes)
      alert("Alocações salvas com sucesso!"); carregarAlocacoesDoContrato(contratoAtivo, alocacaoOsId)
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
    if (count && count > 0) return alert(`❌ BLOQUEIO: Este consultor já apontou ${count} vezes na atividade '${nomeAtiv}'.`);
    if (dbId && !window.confirm("Apagar do banco?")) return; 
    if (dbId) await supabase.from('alocacoes').delete().eq('id', dbId); 
    setAlocacoes(p => { const newAtivs = p[cid].atividades.filter(a => a.id !== aid); const newTotal = newAtivs.reduce((sum, a) => sum + a.horas, 0); return { ...p, [cid]: { ...p[cid], atividades: newAtivs, horasTotais: newTotal } } }) 
  }
  const removeConsultor = async (cid: string) => { 
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('contract_id', contratoAtivo).eq('user_id', cid);
    if (count && count > 0) return alert(`❌ BLOQUEIO: Este consultor possui ${count} apontamentos neste contrato.`);
    const dbIds = [...alocacoes[cid].atividades.map(a => a.dbId).filter(Boolean), alocacoes[cid].geralId].filter(Boolean); 
    if (dbIds.length > 0 && !window.confirm("Excluir histórico deste consultor neste contrato?")) return; 
    if (dbIds.length > 0) await supabase.from('alocacoes').delete().in('id', dbIds as string[]); 
    setAlocacoes(p => { const n = { ...p }; delete n[cid]; return n }) 
  }

  const contratoSelecionadoObj = contratos.find(c => c.id === contratoAtivo)
  const isSemOsType = contratoSelecionadoObj?.tipo === 'continuado_sem_os';
  const isComOsType = contratoSelecionadoObj?.tipo === 'continuado_com_os';
  const isGlobalType4 = false;

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
  // DASHBOARDS, CÁLCULOS E CICLOS
  // ==========================================
  useEffect(() => { if (['dash-mensal', 'dash-global', 'alertas', 'gestao', 'faturamento-cliente'].includes(menuAtivo)) carregarTudoParaDash() }, [menuAtivo])

  async function carregarTudoParaDash() {
    setLoadingDash(true)
    const { data: times } = await supabase.from('timesheets').select('*').not('end_at', 'is', null)
    const { data: orcs } = await supabase.from('alocacoes').select('*')
    const { data: meds } = await supabase.from('medicoes').select('*')
    setAllTimesheets(times || []); setAllAlocacoes(orcs || []); setAllMedicoes(meds || [])
    setLoadingDash(false)
  }

  // Lógica Base para Dashboards e CICLO COM PROTEÇÃO DO FEVEREIRO
  const isWithinCycle = (dateStr: string, monthStr: string, yearStr: string, cInicio: number, cFim: number) => {
    const date = new Date(dateStr).getTime(); 
    const month = parseInt(monthStr); 
    const year = parseInt(yearStr);
    
    // Helper para impedir que dia 31 "vaze" para o mês seguinte em fevereiro, abril, etc.
    const getValidDay = (y: number, m: number, d: number) => Math.min(d, new Date(y, m + 1, 0).getDate());

    let start, end;
    if (cInicio > cFim) {
      const startMonth = month === 0 ? 11 : month - 1;
      const startYear = month === 0 ? year - 1 : year;
      start = new Date(startYear, startMonth, getValidDay(startYear, startMonth, cInicio), 0, 0, 0).getTime();
      end = new Date(year, month, getValidDay(year, month, cFim), 23, 59, 59).getTime();
    } else {
      start = new Date(year, month, getValidDay(year, month, cInicio), 0, 0, 0).getTime();
      end = new Date(year, month, getValidDay(year, month, cFim), 23, 59, 59).getTime();
    }
    return date >= start && date <= end;
  }

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

  const atividadesDashDisponiveis = useMemo(() => {
    let alocs = allAlocacoes;
    if (dashContratosSelecionados.length > 0) alocs = alocs.filter(a => dashContratosSelecionados.includes(a.contract_id));
    if (dashOs !== 'todas') alocs = alocs.filter(a => a.os_id === dashOs);
    const acts = new Set(alocs.map(a => a.atividade || a.activity));
    return Array.from(acts).filter(Boolean).filter(a => a !== 'Sem atividade específica');
  }, [dashContratosSelecionados, dashOs, allAlocacoes]);

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
      fTimes = fTimes.filter(t => dashContratosSelecionados.includes(t.contract_id)); fAlocs = fAlocs.filter(a => dashContratosSelecionados.includes(a.contract_id)); fMeds = fMeds.filter(m => dashContratosSelecionados.includes(m.contract_id))
    }
    if (dashOs !== 'todas') { fTimes = fTimes.filter(t => t.os_id === dashOs); fAlocs = fAlocs.filter(a => a.os_id === dashOs); }
    if (dashConsultor !== 'todos') { fTimes = fTimes.filter(t => t.user_id === dashConsultor); fAlocs = fAlocs.filter(a => a.user_id === dashConsultor); fMeds = fMeds.filter(m => m.user_id === dashConsultor) }
    if (dashAtividade !== 'todas') { fTimes = fTimes.filter(t => t.activity === dashAtividade); fAlocs = fAlocs.filter(a => a.atividade === dashAtividade || a.atividade === 'Sem atividade específica') }

    const isFechadoMode = dashVisaoTipos.includes('fechado') && dashVisaoTipos.length === 1;

    const consultoresPagamento = consultores.map(c => {
      let valorGrafico = 0; let tooltipExtra = ""
      if (isFechadoMode) {
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
    
    let pieData = isFechadoMode ? [ { name: '% Entregue', value: Number(medidoGlobal.toFixed(1)) }, { name: 'A Entregar', value: Number(saldoMedido.toFixed(1)) } ] : [ { name: 'Consumido', value: Number(gastoGlobal.toFixed(2)) }, { name: 'Saldo Restante', value: Number(saldoPositivo.toFixed(2)) } ]
    pieData = pieData.filter(p => p.value > 0); if (pieData.length === 0) pieData.push({ name: 'Sem Registros', value: 1 });

    return { 
      consultoresPagamento, maxValor: Math.max(...consultoresPagamento.map(c => c.valorGrafico), 1), 
      orcadoGlobal, gastoGlobal: Number(gastoGlobal.toFixed(2)), medidoGlobal: Number(medidoGlobal.toFixed(1)),
      saldoGlobal: Number((orcadoGlobal - gastoGlobal).toFixed(2)),
      percentualGlobal: orcadoGlobal > 0 ? ((gastoGlobal / orcadoGlobal) * 100).toFixed(1) : '0', pieData, isFechadoMode
    }
  }, [allTimesheets, allAlocacoes, allMedicoes, dashMes, dashAno, dashContratosSelecionados, dashOs, dashConsultor, dashAtividade, consultores, dashVisaoTipos, contratosVisao, contratos])

  // Lógica Base para Dashboard FATURAMENTO (Cliente)
  const fatContratosVisao = contratos.filter(c => c.status_ativo && fatVisaoTipos.includes(c.tipo) && (fatFonte === 'todas' ? true : c.fonte_pagamento === fatFonte))
  const fatData = useMemo(() => {
    let fTimes = allTimesheets.filter(t => fatContratosVisao.some(cv => cv.id === t.contract_id))
    if (fatContratosSelecionados.length > 0) fTimes = fTimes.filter(t => fatContratosSelecionados.includes(t.contract_id))
    if (fatOs !== 'todas') fTimes = fTimes.filter(t => t.os_id === fatOs) // 🌟 NOVO: APLICA FILTRO DE OS NO FATURAMENTO
    
    const isFechadoMode = fatVisaoTipos.includes('fechado') && fatVisaoTipos.length === 1;

    const consultoresPagamento = consultores.map(c => {
      let valorGrafico = 0;
      if (!isFechadoMode) {
        const logs = fTimes.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, fatMes, fatAno, contratos.find(con => con.id === t.contract_id)?.ciclo_fat_inicio || 1, contratos.find(con => con.id === t.contract_id)?.ciclo_fat_fim || 31))
        valorGrafico = logs.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
      }
      return { id: c.id, nome: c.nome, nomeCurto: c.nome.split(' ')[0], valorGrafico: Number(valorGrafico.toFixed(2)) }
    }).filter(c => c.valorGrafico > 0).sort((a,b) => b.valorGrafico - a.valorGrafico)

    return { consultoresPagamento, isFechadoMode }
  }, [allTimesheets, fatMes, fatAno, fatContratosSelecionados, fatOs, consultores, fatVisaoTipos, fatContratosVisao, contratos])

  const radarAlertas = useMemo(() => {
    const ociosos: any[] = []; const estourados: any[] = [];
    const now = new Date(); const currentDay = now.getDate(); const currentMonth = now.getMonth(); const currentYear = now.getFullYear();
    let startDt, endDt;
    
    const getValidDay = (y: number, m: number, d: number) => Math.min(d, new Date(y, m + 1, 0).getDate());

    if (25 > 24) { 
      if (currentDay >= 25) { startDt = new Date(currentYear, currentMonth, 25, 0, 0, 0); endDt = new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, 24, 23, 59, 59); } 
      else { startDt = new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, 25, 0, 0, 0); endDt = new Date(currentYear, currentMonth, 24, 23, 59, 59); }
    } else { startDt = new Date(currentYear, currentMonth, 25, 0, 0, 0); endDt = new Date(currentYear, currentMonth, 24, 23, 59, 59); }

    const meioDoCicloMs = startDt.getTime() + (endDt.getTime() - startDt.getTime()) / 2;
    const jaPassouDaMetade = Date.now() >= meioDoCicloMs;

    // Determinar o mês/ano de referência dinâmico e cravado
    const refMonth = currentDay >= 25 ? (currentMonth === 11 ? 0 : currentMonth + 1) : currentMonth;
    const refYear = currentDay >= 25 && currentMonth === 11 ? currentYear + 1 : currentYear;

    consultores.forEach(c => {
      if (c.horas_minimas_mes > 0) {
        const horasTrabalhadas = allTimesheets.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, refMonth.toString(), refYear.toString(), 25, 24)).reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0);
        const percentual = (horasTrabalhadas / c.horas_minimas_mes) * 100;
        if (percentual < 30 && jaPassouDaMetade) ociosos.push({ id: c.id, nome: c.nome, trabalhadas: horasTrabalhadas.toFixed(1), meta: c.horas_minimas_mes, percentual: percentual.toFixed(1) })
      }
    });

    contratos.filter(c => c.status_ativo && ['horas', 'continuado_limite_mensal', 'continuado_com_os', 'overhead'].includes(c.tipo)).forEach(cont => {
      const orcado = allAlocacoes.filter(a => a.contract_id === cont.id).reduce((sum, a) => sum + a.horas_disponiveis, 0);
      let consumido = 0;
      if (cont.tipo === 'continuado_limite_mensal' || cont.tipo === 'overhead') {
        consumido = allTimesheets.filter(t => t.contract_id === cont.id && isWithinCycle(t.start_at, refMonth.toString(), refYear.toString(), cont.ciclo_inicio, cont.ciclo_fim)).reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
      } else {
        consumido = allTimesheets.filter(t => t.contract_id === cont.id).reduce((sum, t) => sum + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()) / 3600000, 0);
      }
      if (orcado > 0) {
        const perc = (consumido / orcado) * 100;
        if (perc >= 70) estourados.push({ contrato: cont.nome, consumido: consumido.toFixed(1), orcado, perc: perc.toFixed(1), tipo: cont.tipo })
      }
    });
    
    // Passando o status "jaPassouDaMetade" para o visual da tela
    return { ociosos, estourados, jaPassouDaMetade };
  }, [consultores, contratos, allTimesheets, allAlocacoes]); // Independente do filtro dropdown da interface!

  // Função para Gestão de Apontamentos 
  const gestaoAtividadesDisponiveis = useMemo(() => {
    if (!gestaoContrato) return ['Sem atividade específica'];
    const isComOsType = contratos.find(c => c.id === gestaoContrato)?.tipo === 'continuado_com_os';
    const alocs = allAlocacoes.filter(a => 
      a.contract_id === gestaoContrato && 
      (gestaoConsultor ? a.user_id === gestaoConsultor : true) &&
      (!isComOsType || !gestaoOs || a.os_id === gestaoOs) // 🌟 NOVO: FILTRA DISCIPLINAS DA OS SELECIONADA
    );
    const acts = Array.from(new Set(alocs.map(a => a.atividade)));
    return acts.length > 0 ? acts as string[] : ['Sem atividade específica'];
  }, [gestaoContrato, gestaoConsultor, gestaoOs, allAlocacoes, contratos])

  useEffect(() => {
    if (gestaoAtividadesDisponiveis.length > 0 && !gestaoAtividadesDisponiveis.includes(gestaoAtividade)) setGestaoAtividade(gestaoAtividadesDisponiveis[0]);
  }, [gestaoAtividadesDisponiveis, gestaoAtividade])

  // NOVO MOTOR DE IMPORTAÇÃO (TIMESHEET) DE 8 COLUNAS
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
        if (parts.length < 8) { errors++; continue; } 

        const consultorNome = parts[0]?.trim();
        const dataStr = parts[1]?.trim(); 
        const contratoCodigo = parts[2]?.trim().toUpperCase();
        const osCodigo = parts[3]?.trim().toUpperCase();
        const atividadeStr = parts[4]?.trim() || 'Sem atividade específica';
        const observacao = parts[5]?.trim(); 
        const inicioStr = parts[6]?.trim();
        const fimStr = parts[7]?.trim();

        const consultor = consultores.find(c => c.nome.toLowerCase() === consultorNome?.toLowerCase());
        const contrato = contratos.find(c => c.codigo === contratoCodigo);
        
        let osId = null;
        if (osCodigo && osCodigo !== '-' && contrato) {
           const os = osList.find(o => o.codigo === osCodigo && o.contract_id === contrato.id);
           if (os) osId = os.id;
        }

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
            os_id: osId,
            contract_name: `${contrato.codigo} — ${contrato.nome}`,
            activity: atividadeStr, 
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
        else { alert(`✅ ${toInsert.length} apontamentos importados!\n❌ ${errors} linhas ignoradas com erro.`); carregarTudoParaDash(); }
        setLoading(false);
      } else { alert(`Nenhum apontamento válido encontrado. Verifique o padrão das colunas do seu Excel.`); }
      event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  async function salvarApontamentoAdmin() {
    if(!gestaoConsultor || !gestaoContrato || !gestaoAtividade || !gestaoData || !gestaoInicio || !gestaoFim) return alert("Preencha todos os campos obrigatórios.");
    const startMs = new Date(`${gestaoData}T${gestaoInicio}:00`).getTime();
    const endMs = new Date(`${gestaoData}T${gestaoFim}:00`).getTime();
    if(endMs <= startMs) return alert("A hora de fim deve ser posterior à hora de início.");

    const contObj = contratos.find(c => c.id === gestaoContrato);
    
    // 🌟 NOVA TRAVA: EXIGE OS EM CONTRATOS TIPO 4
    if (contObj?.tipo === 'continuado_com_os' && !gestaoOs) {
      return alert("Selecione uma Ordem de Serviço (OS) para este contrato.");
    }
    
    // 🌟 NOVA TRAVA: VALIDA LIMITES NO AJUSTE RETROATIVO (Igual ao App do Consultor)
    const durationMs = endMs - startMs;
    const isMensal = ['overhead', 'continuado_limite_mensal'].includes(contObj?.tipo || '');
    const isIlimitado = ['continuado_sem_os', 'fechado'].includes(contObj?.tipo || '');
    const isComOs = contObj?.tipo === 'continuado_com_os';
    
    // Puxa as horas já consumidas
    let cUsed = 0; let aUsed = 0; let oUsed = 0;
    if (isMensal) {
      // Como é apenas uma verificação rasa no admin, somamos tudo do mês corrente para o bloqueio de segurança
      const refMonth = new Date(startMs).getMonth();
      cUsed = allTimesheets.filter(t => t.contract_id === gestaoContrato && t.user_id === gestaoConsultor && new Date(t.start_at).getMonth() === refMonth).reduce((s, t) => s + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0);
      aUsed = allTimesheets.filter(t => t.contract_id === gestaoContrato && t.user_id === gestaoConsultor && t.activity === gestaoAtividade && new Date(t.start_at).getMonth() === refMonth).reduce((s, t) => s + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0);
    } else {
      cUsed = allTimesheets.filter(t => t.contract_id === gestaoContrato && t.user_id === gestaoConsultor).reduce((s, t) => s + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0);
      aUsed = allTimesheets.filter(t => t.contract_id === gestaoContrato && t.user_id === gestaoConsultor && t.activity === gestaoAtividade && (!isComOs || t.os_id === gestaoOs)).reduce((s, t) => s + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0);
    }
    if (isComOs && gestaoOs) {
      oUsed = allTimesheets.filter(t => t.os_id === gestaoOs).reduce((s, t) => s + (new Date(t.end_at!).getTime() - new Date(t.start_at).getTime()), 0);
    }
    
    // Subtrai o tempo antigo se estiver editando
    if (gestaoEditandoId) {
      const oldEntry = allTimesheets.find(t => t.id === gestaoEditandoId);
      if (oldEntry) {
        const oldDur = new Date(oldEntry.end_at!).getTime() - new Date(oldEntry.start_at).getTime();
        cUsed -= oldDur; aUsed -= oldDur; oUsed -= oldDur;
      }
    }

    if (!isIlimitado) {
      // Puxa as metas alocadas
      const aAlloc = allAlocacoes.find(a => a.contract_id === gestaoContrato && a.user_id === gestaoConsultor && a.atividade === gestaoAtividade && (!isComOs || a.os_id === gestaoOs));
      const aBudget = aAlloc ? aAlloc.horas_disponiveis * 3600 * 1000 : 0;
      const cBudget = isComOs 
        ? allAlocacoes.filter(a => a.contract_id === gestaoContrato && a.user_id === gestaoConsultor && a.os_id === gestaoOs).reduce((s, a) => s + (a.horas_disponiveis * 3600 * 1000), 0)
        : allAlocacoes.filter(a => a.contract_id === gestaoContrato && a.user_id === gestaoConsultor).reduce((s, a) => s + (a.horas_disponiveis * 3600 * 1000), 0);

      if (aBudget > 0 && (aUsed + durationMs > aBudget)) {
        const remaining = Math.max(0, aBudget - aUsed);
        return alert(`⚠️ BLOQUEIO:\nSaldo insuficiente na disciplina! Restam apenas ${(remaining / 3600000).toFixed(1)}h.`);
      }
      if (cBudget > 0 && (cUsed + durationMs > cBudget)) {
        const remaining = Math.max(0, cBudget - cUsed);
        return alert(`⚠️ BLOQUEIO:\nSaldo global insuficiente! Restam apenas ${(remaining / 3600000).toFixed(1)}h.`);
      }
      if (isComOs && gestaoOs) {
        const currentOsObj = osList.find(o => o.id === gestaoOs);
        if (currentOsObj && currentOsObj.horas_previstas > 0 && (oUsed + durationMs > currentOsObj.horas_previstas * 3600 * 1000)) {
          const rem = Math.max(0, (currentOsObj.horas_previstas * 3600 * 1000) - oUsed);
          return alert(`⚠️ BLOQUEIO:\nO limite macro da OS estourou! Restam apenas ${(rem / 3600000).toFixed(1)}h para esta OS.`);
        }
      }
    }

    const payload = {
      user_id: gestaoConsultor, contract_id: gestaoContrato, contract_name: `${contObj?.codigo} — ${contObj?.nome}`, 
      activity: gestaoAtividade, notes: gestaoNotes, start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(), edited: true,
      os_id: contObj?.tipo === 'continuado_com_os' ? gestaoOs : null // 🌟 ANEXA A OS NO BANCO
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
    setGestaoOs(t.os_id || ''); // 🌟 RECUPERA A OS CADASTRADA AO EDITAR
    const startDate = new Date(t.start_at); const endDate = t.end_at ? new Date(t.end_at) : new Date();
    setGestaoData(startDate.toISOString().split('T')[0]);
    setGestaoInicio(`${String(startDate.getHours()).padStart(2,'0')}:${String(startDate.getMinutes()).padStart(2,'0')}`);
    setGestaoFim(`${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 🌟 NOVO: CANCELAR A EDIÇÃO DO HISTÓRICO MANUALMENTE
  function cancelarEdicaoApontamento() {
    setGestaoEditandoId(null); setGestaoConsultor(''); setGestaoContrato(''); setGestaoOs(''); setGestaoAtividade(''); setGestaoNotes('');
    setGestaoInicio('08:00'); setGestaoFim('12:00');
  }

  const gestaoLogsFiltrados = useMemo(() => {
    return allTimesheets.filter(t => gestaoConsultor ? t.user_id === gestaoConsultor : true)
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()).slice(0, 50);
  }, [allTimesheets, gestaoConsultor])

  const exportarExcel = (isFaturamento: boolean = false) => {
    let registros = allTimesheets.filter(t => {
      const cont = contratos.find(c => c.id === t.contract_id); 
      if (!cont || !(isFaturamento ? fatVisaoTipos : dashVisaoTipos).includes(cont.tipo)) return false;
      if (isFaturamento) return isWithinCycle(t.start_at, fatMes, fatAno, cont.ciclo_fat_inicio, cont.ciclo_fat_fim);
      return isWithinCycle(t.start_at, dashMes, dashAno, cont.ciclo_inicio, cont.ciclo_fim);
    })
    
    if (isFaturamento) {
      if (fatContratosSelecionados.length > 0) registros = registros.filter(t => fatContratosSelecionados.includes(t.contract_id))
      if (fatOs !== 'todas') registros = registros.filter(t => t.os_id === fatOs) // 🌟 NOVO: APLICA FILTRO NO CSV DE FATURAMENTO
    } else {
      if (dashContratosSelecionados.length > 0) registros = registros.filter(t => dashContratosSelecionados.includes(t.contract_id))
      if (dashOs !== 'todas') registros = registros.filter(t => t.os_id === dashOs) // 🌟 NOVO: APLICA FILTRO DE OS NO CSV
      if (dashConsultor !== 'todos') registros = registros.filter(t => t.user_id === dashConsultor)
      if (dashAtividade !== 'todas') registros = registros.filter(t => t.activity === dashAtividade)
    }

    const csvRows = ["Consultor;Contrato;OS;Atividade;Tipo;Data;Entrada;Saida;Horas Totais;Observacao"]
    registros.forEach(t => {
      const consultor = consultores.find(c => c.id === t.user_id)?.nome || 'Desconhecido'; const contrato = contratos.find(c => c.id === t.contract_id)
      const os = osList.find(o => o.id === t.os_id)?.codigo || '-'
      const inicio = new Date(t.start_at); const fim = new Date(t.end_at!)
      const dataStr = inicio.toLocaleDateString('pt-BR'); const horaIn = inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
      const horaOut = fim.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
      const horas = ((fim.getTime() - inicio.getTime()) / 3600000).toFixed(2).replace('.', ',')
      const obsSafe = t.notes ? `"${t.notes.replace(/"/g, '""')}"` : ""
      csvRows.push(`${consultor};${contrato?.codigo || '-'};${os};${t.activity};${contrato?.tipo.toUpperCase()};${dataStr};${horaIn};${horaOut};${horas};${obsSafe}`)
    })
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); 
    link.download = `Engeprice_${isFaturamento ? 'Faturamento' : 'Pagamento'}_${MESES_NOME[parseInt(isFaturamento ? fatMes : dashMes)]}_${isFaturamento ? fatAno : dashAno}.csv`; link.click()
  }

  const MAPEAMENTO_TIPOS: Record<string, string> = {
    horas: "Escopo Fechado (Horas)", fechado: "Preço Fechado (%)", continuado_com_os: "Sob Demanda (Com OS)",
    continuado_sem_os: "Assessoria (Ilimitada)", continuado_limite_mensal: "Assessoria (Teto Mensal)", overhead: "Overhead (Custos/Apoio)"
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
        
        {/* MENU DE NAVEGAÇÃO ROLÁVEL */}
        <nav className="p-4 flex-1 space-y-6 overflow-y-auto min-h-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Engenharia & Cadastros</p>
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('contratos')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'contratos' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Briefcase className="w-4 h-4"/> Contratos de Clientes</button>
              <button onClick={() => setMenuAtivo('os')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'os' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><FolderTree className="w-4 h-4"/> Ordens de Serviço (OS)</button>
              <button onClick={() => setMenuAtivo('equipe')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'equipe' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Target className="w-4 h-4"/> Equipe & Metas</button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Operação & Lançamentos</p>
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('alocacoes')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'alocacoes' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Clock className="w-4 h-4"/> Alocação de Consultores</button>
              <button onClick={() => setMenuAtivo('medicoes')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'medicoes' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Percent className="w-4 h-4"/> Medições Preços Fechados (%)</button>
              <button onClick={() => setMenuAtivo('gestao')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'gestao' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><History className="w-4 h-4"/> Ajustes de Horas (Admin)</button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">BI & Indicadores</p>
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('dash-mensal')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'dash-mensal' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><CalendarDays className="w-4 h-4"/> Folha (Mensal)</button>
              <button onClick={() => setMenuAtivo('dash-global')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'dash-global' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}><Layers className="w-4 h-4"/> Saúde (Global)</button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Faturamento & Alertas</p>
            <div className="space-y-1">
              <button onClick={() => setMenuAtivo('faturamento-cliente')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors ${menuAtivo === 'faturamento-cliente' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-600/10'}`}><Receipt className="w-4 h-4"/> Extração p/ Clientes</button>
              <button onClick={() => setMenuAtivo('alertas')} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors bg-red-500/5 ${menuAtivo === 'alertas' ? 'bg-red-500! text-white' : 'text-red-600 hover:bg-red-500/10'}`}><AlertTriangle className="w-4 h-4"/> Radar de Alertas</button>
            </div>
          </div>
        </nav>
        
        {/* RODAPÉ FIXO NA BASE COM ICONE DO ENGEPRICINHO ADM */}
        <div className="p-4 border-t flex items-center justify-between bg-muted/40 shrink-0">
          <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full">{theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4" />}</Button>
          <div className="flex items-center gap-2 bg-primary/10 p-1.5 px-3 rounded-xl border border-primary/20">
            <UserCog className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-[11px] font-black text-primary uppercase tracking-wider">Admin</span>
          </div>
        </div>
      </aside>

      {/* 📄 ÁREA DE CONTEÚDO DINÂMICO COMPLETAMENTE EXPANDIDA (FULL WIDTH) */}
      <main className="flex-1 p-8 lg:p-10 overflow-y-auto overflow-x-hidden h-full relative w-full max-w-none">
        
        {/* VIEW: CONTRATOS */}
        {menuAtivo === 'contratos' && (
          <Card className="w-full">
            <CardHeader><CardTitle>Gestão Estratégica de Contratos</CardTitle><CardDescription>Classifique os contratos e configure os ciclos de faturamento do cliente e pagamento do consultor.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end bg-muted/30 p-5 rounded-xl border">
                <div className="space-y-2"><Label>Código</Label><Input placeholder="CT-001" className="uppercase" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Nome do Cliente / Contrato</Label><Input placeholder="Ex: Hospital Mater Dei" value={novoNomeContrato} onChange={(e) => setNovoNomeContrato(e.target.value)} /></div>
                <div className="space-y-2"><Label>Tipo Comercial</Label>
                  <Select value={novoTipo} onValueChange={setNovoTipo}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horas">Escopo Fechado (Por Horas)</SelectItem>
                      <SelectItem value="fechado">Preço Fechado (%)</SelectItem>
                      <SelectItem value="continuado_com_os">Sob Demanda (Com OS)</SelectItem>
                      <SelectItem value="continuado_sem_os">Assessoria (Ilimitada)</SelectItem>
                      <SelectItem value="continuado_limite_mensal">Assessoria (Teto Mensal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {novoTipo === 'continuado_com_os' && (
                  <div className="space-y-2"><Label className="text-amber-600">Teto Global (Horas)</Label><Input type="number" placeholder="Ex: 500" value={novoTetoGlobal || ''} onChange={e => setNovoTetoGlobal(Number(e.target.value))} /></div>
                )}
                
                <div className="space-y-2"><Label>Fonte de Faturamento</Label>
                  <Select value={novaFonte} onValueChange={setNovaFonte}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="EC">EC (Consulting)</SelectItem><SelectItem value="ET">ET (Treinamentos)</SelectItem></SelectContent>
                  </Select>
                </div>

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
                              <SelectItem value="fechado">Preço Fechado (%)</SelectItem>
                              <SelectItem value="continuado_com_os">Sob Demanda (Com OS)</SelectItem>
                              <SelectItem value="continuado_sem_os">Assessoria (Ilimitada)</SelectItem>
                              <SelectItem value="continuado_limite_mensal">Assessoria (Teto Mensal)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={editFonte} onValueChange={editFonte => setEditFonte(editFonte)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EC">EC</SelectItem><SelectItem value="ET">ET</SelectItem></SelectContent></Select>
                        </div>
                        <div className="w-full flex flex-wrap gap-4 items-end justify-between">
                          {editTipo === 'continuado_com_os' && <div className="space-y-1"><Label className="text-[10px] text-amber-600">Teto Global (h)</Label><Input type="number" value={editTetoGlobal} onChange={e => setEditTetoGlobal(Number(e.target.value))} className="w-24" /></div>}
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
                            <p className="font-bold flex items-center gap-2">
                              {c.codigo} 
                              <Badge variant="secondary" className={c.fonte_pagamento === 'EC' ? 'bg-blue-500/10 text-blue-600 border-none' : 'bg-purple-500/10 text-purple-600 border-none'}>{c.fonte_pagamento}</Badge>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{c.nome} • Modalidade: {c.tipo.replace(/_/g, ' ').toUpperCase()}</p>
                            {c.tipo === 'continuado_com_os' && <p className="text-[10px] font-bold text-amber-600 mt-1">TETO GLOBAL: {c.teto_global_horas}h</p>}
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
            <CardHeader><CardTitle>Central de Ordens de Serviço (OS)</CardTitle><CardDescription>Distribua os subcontratos e limites de horas das obras Sob Demanda.</CardDescription></CardHeader>
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
                <div className="space-y-2 w-32"><Label>Limite (Horas)</Label><Input type="number" placeholder="50" value={osHoras || ''} onChange={e => setOsHoras(Number(e.target.value))} /></div>
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
                        <div className="relative w-32"><Input type="number" value={editOsHoras} onChange={e => setEditOsHoras(Number(e.target.value))} className="pr-8" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">h</span></div>
                        <div className="flex gap-2 border p-2 rounded-md bg-background h-9 items-center"><Switch id={`stos-${os.id}`} checked={editOsStatus} onCheckedChange={setEditOsStatus} /><Label htmlFor={`stos-${os.id}`}>{editOsStatus ? 'Ativa' : 'Inativa'}</Label></div>
                        <Button size="icon" variant="ghost" className="text-green-500" onClick={() => salvarEdicaoOS(os.id)}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setOsEditandoId(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <div><p className="font-bold text-amber-600 text-sm">{os.codigo}</p><p className="text-xs text-muted-foreground mt-0.5">{os.descricao || 'Sem descrição cadastrada'}</p></div>
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-none ml-4 font-mono">{os.horas_previstas}h orçadas</Badge>
                          {!os.status_ativa && <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 ml-2">Inativa</Badge>}
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
          <Card className="border-t-4 border-t-emerald-500 w-full">
            <CardHeader><CardTitle>Horas Contratuais Mínimas</CardTitle><CardDescription>Defina a meta de horas mínimas que a Engeprice assegura faturar para cada consultor por mês.</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
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

        {/* VIEW: ALOCAÇÃO DE CONSULTORES */}
        {menuAtivo === 'alocacoes' && (
          <div className="space-y-6 w-full">
            {/* CABEÇALHO EXPANDIDO */}
            <div className="bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-sm w-full">
              <div>
                <h2 className="text-2xl font-black text-primary tracking-tight flex items-center gap-2">
                  <Clock className="w-6 h-6" /> Alocação de Consultores
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Defina o limite global de horas de cada engenheiro por contrato e, caso necessário, fragmente esse saldo em disciplinas específicas.
                </p>
              </div>
              {contratoAtivo && (
                <div className="bg-background/80 backdrop-blur-sm border rounded-xl p-3 px-5 text-right shrink-0 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contrato Selecionado</p>
                  <p className="font-bold text-sm text-foreground mt-0.5">{contratos.find(c => c.id === contratoAtivo)?.codigo || "Nenhum"}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
              <div className="md:col-span-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">1. Projeto Mestre</CardTitle></CardHeader>
                  <CardContent>
                    <Select value={contratoAtivo} onValueChange={(val) => { setContratoAtivo(val); setAlocacaoOsId(''); setAlocacoes({}); }}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Escolha o contrato..." /></SelectTrigger>
                      <SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    
                    {contratoSelecionadoObj?.tipo === 'continuado_com_os' && (
                      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <Label className="text-xs font-bold text-amber-700 mb-2 block">Ordem de Serviço (Subnível)</Label>
                        {osList.filter(o => o.contract_id === contratoAtivo && o.status_ativa).length === 0 ? (
                           <p className="text-[10px] text-amber-800 font-bold bg-amber-500/20 p-2 rounded">Nenhuma OS cadastrada. Vá na aba de OS e crie uma antes de alocar a equipe.</p>
                        ) : (
                          <Select value={alocacaoOsId} onValueChange={setAlocacaoOsId}>
                            <SelectTrigger className="bg-background border-amber-500/30 text-xs"><SelectValue placeholder="Selecione a OS..."/></SelectTrigger>
                            <SelectContent>
                              {osList.filter(o => o.contract_id === contratoAtivo && o.status_ativa).map(o => (
                                <SelectItem key={o.id} value={o.id}>{o.codigo} - {o.descricao}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {isSemOsType && (
                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-xs font-bold text-blue-700">Contrato de Acesso Ilimitado</p>
                        <p className="text-[10px] text-blue-700/70 mt-1 leading-tight">Não há limite de horas. Adicione o consultor ao lado para liberar o acesso.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card className={(!contratoAtivo || (isComOsType && !alocacaoOsId)) ? 'opacity-40 pointer-events-none' : ''}>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">2. Selecionar Engenheiro</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5 max-h-87.5 overflow-y-auto p-3">
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
              
              <div className="md:col-span-8 w-full">
                <Card className="h-full min-h-112.5 flex flex-col w-full">
                  <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                    <div>
                      <CardTitle className="text-base">3. Distribuição de Metas de Custo</CardTitle>
                      {isComOsType && alocacaoOsId && <CardDescription className="text-amber-600 font-bold mt-1">Alocando para a OS: {osList.find(o => o.id === alocacaoOsId)?.codigo}</CardDescription>}
                    </div>
                    {contratoAtivo && <Button onClick={salvarAlocacoesNoBanco} disabled={salvando} className="gap-2 h-9 shadow-sm"><Save className="w-4 h-4" /> Gravar Matriz</Button>}
                  </CardHeader>
                  <CardContent className="p-4 space-y-4 overflow-y-auto max-h-125 w-full">
                    {carregandoAlocacoes ? (
                      <div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
                    ) : Object.values(alocacoes).length === 0 ? <div className="text-center text-muted-foreground text-xs py-12">Selecione o contrato e adicione consultores.</div> : 
                      Object.values(alocacoes).map(aloc => (
                        <div key={aloc.consultorId} className="border rounded-xl p-4 bg-card shadow-sm w-full">
                          <div className={`flex justify-between items-center ${!isSemOsType ? 'border-b pb-3 mb-3' : ''}`}>
                            <div><h4 className="font-bold text-sm text-primary">{consultores.find(c => c.id === aloc.consultorId)?.nome}</h4><p className="text-[10px] text-muted-foreground mt-0.5">{contratoSelecionadoObj?.tipo === 'continuado_limite_mensal' || contratoSelecionadoObj?.tipo === 'overhead' ? 'Teto Mensal (Horas)' : 'Teto Total (Horas)'}</p></div>
                            <div className="flex items-center gap-2">
                              {isSemOsType ? (
                                <Badge className="bg-blue-500 mr-2">Ilimitado</Badge>
                              ) : (
                                <div className="relative flex items-center">
                                  <Input type="number" value={aloc.horasTotais || ''} onChange={(e) => updateHoras(aloc.consultorId, Number(e.target.value))} className="w-24 h-8 pr-6 font-bold text-right text-primary bg-muted/50" disabled={aloc.atividades.length > 0} />
                                  <span className="absolute right-2 text-xs text-muted-foreground">h</span>
                                </div>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => removeConsultor(aloc.consultorId)} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </div>
                          
                          {!isSemOsType && (
                            <div className="pl-3 border-l-2 border-primary/20 space-y-2 mt-3 w-full">
                              <div className="flex justify-between items-center text-xs"><span className="font-medium text-muted-foreground">Disciplinas / Escopos Específicos</span><Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => addAtiv(aloc.consultorId)}><PlusCircle className="w-3 h-3 mr-1" /> Adicionar</Button></div>
                              {aloc.atividades.map(a => (
                                <div key={a.id} className="flex gap-2 items-center bg-muted/30 p-2 rounded-lg text-xs w-full">
                                  <span className="flex-1 font-medium">{a.nome}</span>
                                  <div className="relative w-24"><Input type="number" className="h-7 text-right font-bold pr-5" value={a.horas || ''} onChange={(e) => updateAtiv(aloc.consultorId, a.id, Number(e.target.value))} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">h</span></div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => removeAtiv(aloc.consultorId, a.id, a.dbId)}><X className="w-3.5 h-3.5" /></Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: MEDIÇÕES PREÇOS FECHADOS (%) */}
        {menuAtivo === 'medicoes' && (
          <Card className="border-t-4 border-t-amber-500 w-full">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <CardTitle className="text-xl">Lançamento de Medições</CardTitle>
              <CardDescription>Insira o avanço físico mensal dos consultores em contratos fechados.</CardDescription>
              <div className="flex flex-wrap gap-3 mt-4 p-3 bg-background border rounded-lg shadow-sm">
                <Select value={medMes} onValueChange={setMedMes}><SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger><SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={medAno} onValueChange={setMedAno}><SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
                <Select value={medFonte} onValueChange={setMedFonte}><SelectTrigger className="w-36 h-9 border-primary/50"><SelectValue placeholder="Divisão" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas (EC + ET)</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent></Select>
                <Select value={medContrato} onValueChange={setMedContrato}><SelectTrigger className="w-80 h-9 border-primary"><SelectValue placeholder="Selecione o Contrato..." /></SelectTrigger><SelectContent>{contratos.filter(c => c.status_ativo && c.tipo === 'fechado' && (medFonte === 'todas' ? true : c.fonte_pagamento === medFonte)).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent></Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {!medContrato ? <div className="text-center text-muted-foreground py-12 text-sm border border-dashed rounded-xl w-full">Selecione os filtros e o contrato acima para carregar a equipe.</div> : medLoading ? <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" /></div> : medConsultores.length === 0 ? <p className="text-center text-muted-foreground py-6 text-xs">Nenhum engenheiro alocado nesta matriz.</p> : (
                <div className="w-full space-y-4">
                  {medConsultores.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/10 shadow-sm w-full">
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
            <div className="md:col-span-5">
              <Card className="border-t-4 border-t-purple-500 shadow-sm">
                <CardHeader className="border-b pb-4">
                  <div className="flex justify-between items-center w-full">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4"/> Lançamento Direto</CardTitle>
                    <div className="relative">
                      <input type="file" id="csv-ts-up" className="hidden" accept=".csv" onChange={handleImportarTimesheetCSV} />
                      <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 text-[11px] h-8 gap-1.5" onClick={() => document.getElementById('csv-ts-up')?.click()}><FileUp className="w-3.5 h-3.5" /> Importar CSV (8 Colunas)</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-xs">
                  <div className="space-y-1"><Label>Engenheiro</Label><Select value={gestaoConsultor} onValueChange={setGestaoConsultor} disabled={!!gestaoEditandoId}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1">
                    <Label>Contrato</Label>
                    <Select value={gestaoContrato} onValueChange={(val) => { setGestaoContrato(val); setGestaoOs(''); }} disabled={!!gestaoEditandoId}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {/* 🌟 CAMPOS DE ORDENS DE SERVIÇO VINCULADAS */}
                  {contratos.find(c => c.id === gestaoContrato)?.tipo === 'continuado_com_os' && (
                    <div className="space-y-1">
                      <Label>Ordem de Serviço (OS)</Label>
                      <Select value={gestaoOs} onValueChange={setGestaoOs} disabled={!!gestaoEditandoId}>
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
                  <div className="space-y-1"><Label>Observação Interna</Label><Input placeholder="Descreva o escopo realizado..." value={gestaoNotes} onChange={e => setGestaoNotes(e.target.value)} className="h-9" /></div>
                  <div className="flex gap-2 pt-2">
                    {gestaoEditandoId && <Button variant="outline" onClick={cancelarEdicaoApontamento} className="h-9 text-xs">Cancelar Edição</Button>}
                    <Button onClick={salvarApontamentoAdmin} disabled={salvando} className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-xs">{salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} {gestaoEditandoId ? 'Atualizar Histórico' : 'Gravar Horas'}</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-7">
              <Card className="h-full max-h-125 flex flex-col shadow-sm w-full">
                <CardHeader className="border-b py-3"><CardTitle className="text-xs font-bold text-muted-foreground">Últimos Lançamentos Efetuados</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 divide-y text-xs w-full">
                  {gestaoLogsFiltrados.map(t => {
                    const s = new Date(t.start_at); const e = t.end_at ? new Date(t.end_at) : new Date();
                    return (
                      <div key={t.id} className="p-3 hover:bg-muted/40 flex justify-between items-center w-full">
                        <div>
                          <p className="font-bold text-foreground text-xs">{consultores.find(c => c.id === t.user_id)?.nome}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{contratos.find(c => c.id === t.contract_id)?.codigo}{t.os_id ? ` • ${osList.find(o => o.id === t.os_id)?.codigo}` : ''} • {t.activity} • {s.toLocaleDateString('pt-BR')}</p>
                          {t.notes && <p className="text-[10px] italic text-primary font-medium mt-1 truncate max-w-70">"{t.notes}"</p>}
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

        {/* VIEW: DASHBOARD MENSAL (PAGAMENTO CONSULTOR) */}
        {menuAtivo === 'dash-mensal' && (
          <Card className="border-t-4 border-t-blue-500 shadow-sm min-h-125 w-full">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                <div><CardTitle className="text-lg">Folha de Pagamento (Equipe)</CardTitle><CardDescription>Acompanhe o volume a ser repassado, faturado horizontalmente por monitor.</CardDescription></div>
                <Button onClick={() => exportarExcel(false)} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-8"><Download className="w-4 h-4" /> Exportar CSV</Button>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 items-center bg-background p-2.5 rounded-lg border shadow-sm w-full">
                {renderFiltroTiposContratoMultiplos()}
                <Select value={dashFonte} onValueChange={setDashFonte}><SelectTrigger className="w-32 h-8 text-xs bg-muted/40"><SelectValue placeholder="Divisão" /></SelectTrigger><SelectContent><SelectItem value="todas">EC + ET</SelectItem><SelectItem value="EC">Apenas EC</SelectItem><SelectItem value="ET">Apenas ET</SelectItem></SelectContent></Select>
                <div className="w-44">{renderFiltroContratosMultiplos()}</div>
                
                {/* 🌟 FILTRO OS NO DASH MENSAL */}
                {dashVisaoTipos.includes('continuado_com_os') && (
                  <Select value={dashOs} onValueChange={setDashOs}>
                    <SelectTrigger className="w-48 h-8 text-xs border-amber-500/50"><SelectValue placeholder="Todas as OS" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as OS</SelectItem>
                      {osDashDisponiveis.map(o => <SelectItem key={o.id} value={o.id}>{o.codigo} - {o.descricao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                <Select value={dashMes} onValueChange={setDashMes}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={dashAno} onValueChange={setDashAno}><SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : dashData.consultoresPagamento.length === 0 ? <div className="text-center text-muted-foreground text-xs py-12">Nenhum registro encontrado no ciclo para esse filtro.</div> : (
                <div className="w-full h-95">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashData.consultoresPagamento} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                      <XAxis dataKey="nomeCurto" tickLine={false} axisLine={false} style={{fontSize: '11px'}} />
                      <YAxis tickLine={false} axisLine={false} style={{fontSize: '11px'}} tickFormatter={(v) => dashData.isFechadoMode ? `${v}%` : `${v}h`} />
                      <RechartsTooltip cursor={{fill: '#88888811'}} contentStyle={{borderRadius: '8px'}} formatter={(v: number) => [dashData.isFechadoMode ? `${v}%` : `${v} horas`, dashData.isFechadoMode ? 'Medição' : 'Trabalhado']} />
                      <Bar dataKey="valorGrafico" radius={[4, 4, 0, 0]} maxBarSize={55}>
                        {dashData.consultoresPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={dashData.isFechadoMode ? '#f59e0b' : CORES_GRAFICO[index % CORES_GRAFICO.length]} />)}
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
          <Card className="border-t-4 border-t-amber-500 shadow-sm min-h-125 w-full">
            <CardHeader className="bg-muted/10 border-b pb-4">
              <div><CardTitle className="text-lg">Saúde Financeira Consolidada</CardTitle><CardDescription>Visão geral de engenharia e lucratividade de custos.</CardDescription></div>
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
                      <SelectTrigger className="w-48 h-9 border-amber-500/50"><SelectValue placeholder="Todas as OS" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as OS</SelectItem>
                        {osDashDisponiveis.map(o => <SelectItem key={o.id} value={o.id}>{o.codigo} - {o.descricao}</SelectItem>)}
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
                  <Select value={dashAtividade} onValueChange={setDashAtividade}>
                    <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Atividades..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Geral (Todas)</SelectItem>
                      {atividadesDashDisponiveis.map((a, i) => <SelectItem key={i} value={a as string}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full">
                  <div className="space-y-4 w-full">
                    {!dashData.isFechadoMode ? (
                      <>
                        <div className="border p-4 rounded-xl bg-muted/10"><p className="text-[10px] font-bold text-muted-foreground uppercase">Budget Total Alocado</p><p className="text-3xl font-bold font-mono mt-0.5">{dashData.orcadoGlobal}h</p></div>
                        <div className="border p-4 rounded-xl bg-red-500/5 border-red-500/10"><p className="text-[10px] font-bold text-red-600 uppercase">Horas Consumidas</p><p className="text-3xl font-bold font-mono text-red-600 mt-0.5">{dashData.gastoGlobal.toFixed(1)}h</p></div>
                        <div className={`border p-4 rounded-xl ${dashData.saldoGlobal < 0 ? 'bg-red-500/10 border-red-500/20 text-red-600' : 'bg-green-500/5 border-green-500/10 text-green-600'}`}><p className="text-[10px] font-bold uppercase">Saldo em Conta</p><p className="text-3xl font-bold font-mono mt-0.5">{dashData.saldoGlobal.toFixed(1)}h</p></div>
                      </>
                    ) : (
                      <>
                        <div className="border p-4 rounded-xl bg-muted/10"><p className="text-[10px] font-bold text-muted-foreground uppercase">Rateio Distribuído Equipe</p><p className="text-3xl font-bold text-primary mt-0.5">{dashData.percentualGlobal}%</p></div>
                        <div className="border p-4 rounded-xl bg-primary/5 border-primary/10"><p className="text-[10px] font-bold text-primary uppercase">Avanço Físico Medido</p><p className="text-3xl font-bold text-primary mt-0.5">{dashData.medidoGlobal}%</p></div>
                      </>
                    )}
                  </div>
                  <div className="h-80 w-full flex flex-col items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dashData.pieData} innerRadius={85} outerRadius={115} paddingAngle={4} dataKey="value" stroke="none">
                          <Cell fill={dashData.isFechadoMode ? "#f59e0b" : "#ef4444"} /> 
                          <Cell fill={dashData.pieData.length > 1 ? "#22c55e" : "#88888822"} />
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => [dashData.isFechadoMode ? `${v}%` : `${v.toFixed(1)}h`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center pointer-events-none">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">{dashData.isFechadoMode ? 'Avanço Físico' : 'Consumo'}</p>
                      <p className="text-2xl font-black text-primary mt-0.5">
                        {dashData.isFechadoMode 
                          ? `${dashData.medidoGlobal}%` 
                          : (dashVisaoTipos.includes('continuado_sem_os') && !dashVisaoTipos.includes('horas') && !dashVisaoTipos.includes('continuado_limite_mensal') && !dashVisaoTipos.includes('overhead')) 
                            ? '---' 
                            : `${dashData.percentualGlobal}%`}
                      </p>
                    </div>
                  </div>
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
                
                {/* 🌟 FILTRO OS NO FATURAMENTO */}
                {fatVisaoTipos.includes('continuado_com_os') && (
                  <Select value={fatOs} onValueChange={setFatOs}>
                    <SelectTrigger className="w-48 h-8 text-xs border-amber-500/50"><SelectValue placeholder="Todas as OS" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as OS</SelectItem>
                      {osDashDisponiveis.map(o => <SelectItem key={o.id} value={o.id}>{o.codigo} - {o.descricao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                <Select value={fatMes} onValueChange={setFatMes}><SelectTrigger className="w-28 h-8 text-xs border-amber-500/50"><SelectValue /></SelectTrigger><SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={fatAno} onValueChange={setFatAno}><SelectTrigger className="w-20 h-8 text-xs border-amber-500/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6 w-full">
              {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div> : fatData.consultoresPagamento.length === 0 ? <div className="text-center text-muted-foreground text-xs py-12">Nenhum registro faturável neste ciclo.</div> : (
                <div className="w-full h-95">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fatData.consultoresPagamento} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888822" />
                      <XAxis dataKey="nomeCurto" tickLine={false} axisLine={false} style={{fontSize: '11px'}} />
                      <YAxis tickLine={false} axisLine={false} style={{fontSize: '11px'}} tickFormatter={(v) => fatData.isFechadoMode ? `${v}%` : `${v}h`} />
                      <RechartsTooltip cursor={{fill: '#88888811'}} contentStyle={{borderRadius: '8px'}} formatter={(v: number) => [fatData.isFechadoMode ? `${v}%` : `${v} horas faturáveis`, fatData.isFechadoMode ? 'Físico Medido' : 'Para Cliente']} />
                      <Bar dataKey="valorGrafico" radius={[4, 4, 0, 0]} maxBarSize={55}>
                        {fatData.consultoresPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={fatData.isFechadoMode ? '#f59e0b' : '#d97706'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  )
}