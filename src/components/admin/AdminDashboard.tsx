// src/components/admin/AdminDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/use-theme'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  PlusCircle, UserPlus, Briefcase, Clock, ArrowRight, Trash2, 
  Loader2, Pencil, Check, X, Save, BarChart3, Sun, Moon, 
  User, Layers, CalendarDays, Download, Percent, ClipboardCheck,
  History, FileUp
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts'

type Consultor = { id: string, nome: string }
type Contrato = { id: string, codigo: string, nome: string, status_ativo: boolean, tipo: string, ciclo_inicio: number, ciclo_fim: number }
type AtividadeAlocada = { id: string, dbId?: string, nome: string, horas: number }
type Alocacao = { consultorId: string, horasTotais: number, geralId?: string, atividades: AtividadeAlocada[] }
type TimesheetLog = { id: string, user_id: string, contract_id: string, activity: string, start_at: string, end_at: string | null, notes?: string }
type Medicao = { id?: string, contract_id: string, user_id: string, mes: string, ano: string, percentual: number }

const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CORES_GRAFICO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']

export function AdminDashboard() {
  const { theme, toggle } = useTheme()
  const [abaAtiva, setAbaAtiva] = useState('contratos')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  
  const [novoCodigo, setNovoCodigo] = useState('')
  const [novoNomeContrato, setNovoNomeContrato] = useState('')
  const [novoTipo, setNovoTipo] = useState('horas')
  const [novoInicio, setNovoInicio] = useState(25)
  const [novoFim, setNovoFim] = useState(24)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [editNome, setEditNome] = useState('')
  const [editStatus, setEditStatus] = useState(true)
  const [editTipo, setEditTipo] = useState('horas')
  const [editInicio, setEditInicio] = useState(25)
  const [editFim, setEditFim] = useState(24)

  const [contratoAtivo, setContratoAtivo] = useState<string>('')
  const [alocacoes, setAlocacoes] = useState<Record<string, Alocacao>>({})
  const [carregandoAlocacoes, setCarregandoAlocacoes] = useState(false)

  const [medContrato, setMedContrato] = useState<string>('')
  const [medMes, setMedMes] = useState<string>(new Date().getMonth().toString())
  const [medAno, setMedAno] = useState<string>(new Date().getFullYear().toString())
  const [medicoesInput, setMedicoesInput] = useState<Record<string, number>>({})
  const [medConsultores, setMedConsultores] = useState<Consultor[]>([])
  const [medLoading, setMedLoading] = useState(false)

  const [dashVisaoTipo, setDashVisaoTipo] = useState<'horas' | 'fechado'>('horas')
  const [dashMes, setDashMes] = useState<string>(new Date().getMonth().toString())
  const [dashAno, setDashAno] = useState<string>(new Date().getFullYear().toString())
  const [dashContratosSelecionados, setDashContratosSelecionados] = useState<string[]>([]) 
  const [dashConsultor, setDashConsultor] = useState<string>('todos')
  const [dashAtividade, setDashAtividade] = useState<string>('todas')
  
  const [allTimesheets, setAllTimesheets] = useState<TimesheetLog[]>([])
  const [allAlocacoes, setAllAlocacoes] = useState<any[]>([])
  const [allMedicoes, setAllMedicoes] = useState<Medicao[]>([])
  const [loadingDash, setLoadingDash] = useState(false)

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
      const { data: dbCons } = await supabase.from('consultores').select('id, nome').order('nome')
      const { data: dbCont } = await supabase.from('contratos').select('id, codigo, nome, status_ativo, tipo, ciclo_inicio, ciclo_fim').order('codigo')
      setConsultores(dbCons || [])
      setContratos((dbCont || []).map(c => ({ 
        ...c, status_ativo: c.status_ativo === true, tipo: c.tipo || 'horas', ciclo_inicio: c.ciclo_inicio || 25, ciclo_fim: c.ciclo_fim || 24
      })))
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }
  useEffect(() => { carregarDadosDoBanco() }, [])

  // ==========================================
  // FUNÇÕES DE CONTRATO
  // ==========================================
  async function criarNovoContrato() {
    if (!novoCodigo || !novoNomeContrato) return alert("Preencha todos os campos!")
    await supabase.from('contratos').insert([{ codigo: novoCodigo.toUpperCase().trim(), nome: novoNomeContrato.trim(), status_ativo: true, tipo: novoTipo, ciclo_inicio: novoInicio, ciclo_fim: novoFim }])
    setNovoCodigo(''); setNovoNomeContrato(''); carregarDadosDoBanco();
  }

  // Importador de Contratos (CSV)
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

  // NOVO: Importador de Timesheets Históricos (CSV)
  const handleImportarTimesheetCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(1); // Pula o cabeçalho
      const toInsert = [];
      let errors = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        // Padrão esperado: CONSULTOR; MÊS COMP.; CLIENTE; DIA DA SEMANA; DATA; CONTRATO; ATIVIDADE; INICIO; FIM; HORAS
        const parts = line.split(';');
        if (parts.length < 9) continue; // Ignora linhas mal formatadas

        const consultorNome = parts[0]?.trim();
        const dataStr = parts[4]?.trim(); // DD/MM/YYYY
        const contratoCodigo = parts[5]?.trim().toUpperCase();
        const observacao = parts[6]?.trim(); // Planilha chama de Atividade, mas vira Note
        const inicioStr = parts[7]?.trim();
        const fimStr = parts[8]?.trim();

        // Faz o "Match" com o banco
        const consultor = consultores.find(c => c.nome.toLowerCase() === consultorNome?.toLowerCase());
        const contrato = contratos.find(c => c.codigo === contratoCodigo);

        if (!consultor || !contrato || !dataStr || !inicioStr || !fimStr) {
          errors++;
          continue; // Pula se não achar correspondência
        }

        try {
          const sep = dataStr.includes('/') ? '/' : '-';
          const [dia, mes, ano] = dataStr.split(sep);
          const anoFinal = ano.length === 2 ? `20${ano}` : ano; // Resolve anos abreviados (ex: 24 -> 2024)

          const [hIni, mIni] = inicioStr.split(':');
          const [hFim, mFim] = fimStr.split(':');

          const startDt = new Date(parseInt(anoFinal), parseInt(mes) - 1, parseInt(dia), parseInt(hIni), parseInt(mIni));
          const endDt = new Date(parseInt(anoFinal), parseInt(mes) - 1, parseInt(dia), parseInt(hFim), parseInt(mFim));

          // Se a hora de fim for no dia seguinte (ex: varou a noite), adiciona 1 dia
          if (endDt <= startDt) endDt.setDate(endDt.getDate() + 1);

          toInsert.push({
            id: crypto.randomUUID(),
            user_id: consultor.id,
            contract_id: contrato.id,
            contract_name: `${contrato.codigo} — ${contrato.nome}`,
            activity: 'Sem atividade específica', // Alocação Genérica Padrão
            notes: observacao,
            start_at: startDt.toISOString(),
            end_at: endDt.toISOString(),
            edited: true // Como veio do admin, já cai validado
          });
        } catch (err) {
          errors++;
        }
      }

      if (toInsert.length > 0) {
        setLoading(true);
        const { error } = await supabase.from('timesheets').insert(toInsert);
        if (error) {
          alert("Erro no banco de dados: " + error.message);
        } else {
          alert(`✅ ${toInsert.length} apontamentos importados!\n❌ ${errors} linhas ignoradas (Consultor/Contrato não encontrados ou erro de formato).`);
          carregarTudoParaDash();
        }
        setLoading(false);
      } else {
        alert(`Nenhum apontamento válido encontrado. ${errors} linhas não bateram com o banco.`);
      }
      event.target.value = '';
    };
    // Lê como UTF-8
    reader.readAsText(file, 'UTF-8');
  };

  function iniciarEdicao(c: Contrato) { setEditandoId(c.id); setEditCodigo(c.codigo); setEditNome(c.nome); setEditStatus(c.status_ativo); setEditTipo(c.tipo); setEditInicio(c.ciclo_inicio); setEditFim(c.ciclo_fim); }
  
  async function salvarEdicaoContrato(id: string) {
    await supabase.from('contratos').update({ codigo: editCodigo.toUpperCase().trim(), nome: editNome.trim(), status_ativo: editStatus, tipo: editTipo, ciclo_inicio: editInicio, ciclo_fim: editFim }).eq('id', id)
    setEditandoId(null); carregarDadosDoBanco();
  }
  
  // TRAVA DE SEGURANÇA 1: BLOQUEIO DE DELEÇÃO DE CONTRATO COM HISTÓRICO
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
  // FUNÇÕES DE ALOCAÇÃO
  // ==========================================
  useEffect(() => { if (contratoAtivo && abaAtiva === 'alocacoes') carregarAlocacoesDoContrato(contratoAtivo) }, [contratoAtivo, abaAtiva])
  
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

  // TRAVA DE SEGURANÇA 2: NÃO REDUZIR ABAIXO DO CONSUMIDO
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
  
  // TRAVA DE SEGURANÇA 3: NÃO DELETAR ATIVIDADE COM HORAS
  const removeAtiv = async (cid: string, aid: string, dbId?: string) => { 
    const nomeAtiv = alocacoes[cid].atividades.find(a => a.id === aid)?.nome;
    const { count } = await supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('contract_id', contratoAtivo).eq('user_id', cid).eq('activity', nomeAtiv);
    if (count && count > 0) return alert(`❌ TRAVA DE SEGURANÇA:\n\nEste consultor já apontou ${count} vezes na atividade '${nomeAtiv}'. Exclusão bloqueada.`);

    if (dbId && !window.confirm("Apagar do banco?")) return; 
    if (dbId) await supabase.from('alocacoes').delete().eq('id', dbId); 
    setAlocacoes(p => { const newAtivs = p[cid].atividades.filter(a => a.id !== aid); const newTotal = newAtivs.reduce((sum, a) => sum + a.horas, 0); return { ...p, [cid]: { ...p[cid], atividades: newAtivs, horasTotais: newTotal } } }) 
  }
  
  // TRAVA DE SEGURANÇA 4: NÃO DELETAR CONSULTOR COM HORAS DA OBRA
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
  useEffect(() => { if (abaAtiva === 'medicoes' && medContrato) carregarMedicoes() }, [abaAtiva, medContrato, medMes, medAno])
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
  // GESTÃO DE APONTAMENTOS
  // ==========================================
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
  // DASHBOARDS GLOBAIS E CÁLCULOS
  // ==========================================
  useEffect(() => { if (['dash-mensal', 'dash-global', 'gestao'].includes(abaAtiva)) carregarTudoParaDash() }, [abaAtiva])

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
      let prevMonth = month - 1; let startYear = year;
      if (prevMonth < 0) { prevMonth = 11; startYear--; }
      start = new Date(startYear, prevMonth, cInicio, 0, 0, 0).getTime(); end = new Date(year, month, cFim, 23, 59, 59).getTime()
    } else {
      start = new Date(year, month, cInicio, 0, 0, 0).getTime(); end = new Date(year, month, cFim, 23, 59, 59).getTime()
    }
    return date >= start && date <= end
  }

  const contratosVisao = contratos.filter(c => c.status_ativo && c.tipo === dashVisaoTipo)

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
        valorGrafico = fTimes.filter(t => t.user_id === c.id && isWithinCycle(t.start_at, dashMes, dashAno, contratos.find(con => con.id === t.contract_id)?.ciclo_inicio || 25, contratos.find(con => con.id === t.contract_id)?.ciclo_fim || 24)).reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
      }
      return { id: c.id, nome: c.nome, nomeCurto: c.nome.split(' ')[0], valorGrafico: Number(valorGrafico.toFixed(2)), tooltipExtra }
    }).filter(c => c.valorGrafico > 0).sort((a,b) => b.valorGrafico - a.valorGrafico)

    const orcadoGlobal = fAlocs.reduce((acc, curr) => acc + curr.horas_disponiveis, 0)
    const gastoGlobal = fTimes.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
    const medidoGlobal = fMeds.reduce((acc, curr) => acc + curr.percentual, 0)
    
    const saldoPositivo = orcadoGlobal - gastoGlobal > 0 ? orcadoGlobal - gastoGlobal : 0;
    const saldoMedido = 100 - medidoGlobal > 0 ? 100 - medidoGlobal : 0;
    
    const pieData = dashVisaoTipo === 'horas' 
      ? [ { name: 'Consumido', value: Number(gastoGlobal.toFixed(2)) }, { name: 'Saldo Restante', value: Number(saldoPositivo.toFixed(2)) } ]
      : [ { name: '% Entregue (Medida)', value: Number(medidoGlobal.toFixed(1)) }, { name: 'A Entregar', value: Number(saldoMedido.toFixed(1)) } ]

    return { 
      consultoresPagamento, maxValor: Math.max(...consultoresPagamento.map(c => c.valorGrafico), 1), 
      orcadoGlobal, gastoGlobal: Number(gastoGlobal.toFixed(2)), medidoGlobal: Number(medidoGlobal.toFixed(1)),
      saldoGlobal: Number((orcadoGlobal - gastoGlobal).toFixed(2)),
      percentualGlobal: dashVisaoTipo === 'horas' ? (orcadoGlobal > 0 ? ((gastoGlobal / orcadoGlobal) * 100).toFixed(1) : '0') : orcadoGlobal.toString(),
      pieData
    }
  }, [allTimesheets, allAlocacoes, allMedicoes, dashMes, dashAno, dashContratosSelecionados, dashConsultor, dashAtividade, consultores, dashVisaoTipo, contratosVisao, contratos])

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
  const isFechado = contratoSelecionadoObj?.tipo === 'fechado'

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-24">
      <header className="flex flex-wrap gap-4 items-center justify-between pb-6 border-b mb-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Central de Comando</h1><p className="text-muted-foreground text-lg">Gestão integrada de contratos de engenharia.</p></div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full">{theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-700" />}</Button>
          <Avatar className="h-10 w-10 border shadow-sm cursor-pointer hover:opacity-80 transition-opacity"><AvatarFallback className="bg-primary/10 text-primary"><User className="w-5 h-5" /></AvatarFallback></Avatar>
        </div>
      </header>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="flex flex-wrap h-auto w-full mb-6 justify-start">
          <TabsTrigger value="contratos">Gerir Contratos</TabsTrigger>
          <TabsTrigger value="alocacoes">Alocação</TabsTrigger>
          <TabsTrigger value="medicoes" className="bg-amber-500/10 data-[state=active]:bg-amber-500 data-[state=active]:text-white">Medições (%)</TabsTrigger>
          <TabsTrigger value="gestao" className="bg-purple-500/10 data-[state=active]:bg-purple-500 data-[state=active]:text-white gap-2"><History className="w-4 h-4"/> Gestão de Horas</TabsTrigger>
          <TabsTrigger value="dash-mensal" className="gap-2"><CalendarDays className="w-4 h-4" /> Folha (Mensal)</TabsTrigger>
          <TabsTrigger value="dash-global" className="gap-2"><Layers className="w-4 h-4" /> Saúde (Global)</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos">
          <Card>
            <CardHeader><CardTitle>Contratos Cadastrados</CardTitle><CardDescription>Insira novos projetos ou faça o upload de uma planilha CSV com contratos antigos.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 mb-6 items-end bg-muted/20 p-4 rounded-xl border">
                <div className="space-y-2"><Label>Código</Label><Input placeholder="Ex: CT-999" className="w-32 uppercase" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} /></div>
                <div className="space-y-2 flex-1"><Label>Nome descritivo</Label><Input placeholder="Nome da Obra" value={novoNomeContrato} onChange={(e) => setNovoNomeContrato(e.target.value)} /></div>
                <div className="space-y-2"><Label>Tipo</Label>
                  <Select value={novoTipo} onValueChange={setNovoTipo}>
                    <SelectTrigger className="w-36 bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="horas">Por Horas</SelectItem><SelectItem value="fechado">Preço Fechado</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Início (Dia)</Label><Input type="number" min={1} max={31} className="w-20" value={novoInicio} onChange={(e) => setNovoInicio(Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>Fim (Dia)</Label><Input type="number" min={1} max={31} className="w-20" value={novoFim} onChange={(e) => setNovoFim(Number(e.target.value))} /></div>
                <Button className="gap-2" onClick={criarNovoContrato}><PlusCircle className="w-4 h-4" /> Salvar</Button>
                <div className="relative border-l pl-4 ml-2">
                  <input type="file" id="csv-upload" className="hidden" accept=".csv" onChange={handleImportarCSV} />
                  <Button variant="outline" className="gap-2 text-primary" onClick={() => document.getElementById('csv-upload')?.click()}>
                    <FileUp className="w-4 h-4" /> Importar CSV
                  </Button>
                </div>
              </div>
              <div className="border rounded-xl divide-y max-h-[450px] overflow-y-auto bg-card">
                {contratos.map(c => (
                  <div key={c.id} className="p-4 flex flex-wrap gap-4 justify-between items-center hover:bg-muted/30">
                    {editandoId === c.id ? (
                      <div className="flex flex-1 flex-wrap gap-4 items-center">
                        <Input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} className="w-24 uppercase" />
                        <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="flex-1 min-w-[200px]" />
                        <Select value={editTipo} onValueChange={setEditTipo}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="horas">Horas</SelectItem><SelectItem value="fechado">Fechado</SelectItem></SelectContent></Select>
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
                              {c.tipo === 'fechado' ? <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-[10px]">Preço Fechado</Badge> : <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-[10px]">Por Horas</Badge>}
                            </p>
                            <p className="text-sm text-muted-foreground">{c.nome} • Ciclo: Dia {c.ciclo_inicio} ao {c.ciclo_fim}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.status_ativo ? <Badge variant="outline" className="text-green-500 border-green-500/20 mr-2">Ativo</Badge> : <Badge variant="outline" className="text-red-500 border-red-500/20 mr-2">Inativo</Badge>}
                          <Button variant="outline" size="sm" onClick={() => iniciarEdicao(c)} className="gap-2"><Pencil className="w-4 h-4" /> Editar</Button>
                          <Button variant="ghost" size="icon" onClick={() => excluirContrato(c.id, c.nome)} className="text-red-500 hover:bg-red-500/10 ml-2"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alocacoes">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader className="pb-4"><CardTitle className="text-lg">1. Contrato Ativo</CardTitle></CardHeader>
                <CardContent><Select value={contratoAtivo} onValueChange={(val) => { setContratoAtivo(val); setAlocacoes({}); }}><SelectTrigger><SelectValue placeholder="Escolha uma obra..." /></SelectTrigger><SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent></Select></CardContent>
              </Card>
              <Card className={!contratoAtivo ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader className="pb-4"><CardTitle className="text-lg">2. Equipe</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[350px] overflow-y-auto">
                  {consultores.map(user => {
                    const jaAlocado = !!alocacoes[user.id]
                    return (
                      <div key={user.id} onClick={() => addConsultor(user.id)} className={`p-3 rounded-lg border flex justify-between items-center ${jaAlocado ? 'bg-muted opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}>
                        <div className="flex items-center gap-3"><div className="bg-primary/10 p-2 rounded-full"><UserPlus className="w-4 h-4 text-primary" /></div><span className="font-medium text-sm">{user.nome}</span></div>
                        {!jaAlocado && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-8">
              <Card className="h-full min-h-[500px] flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>3. Matriz de Distribuição Global</CardTitle>
                    <CardDescription>{contratoSelecionadoObj ? `${contratoSelecionadoObj.nome} (${isFechado ? 'Porcentagem' : 'Horas'})` : 'Selecione uma obra ativa.'}</CardDescription>
                  </div>
                  {contratoAtivo && <Button onClick={salvarAlocacoesNoBanco} disabled={salvando} className="gap-2 shadow-md">{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Gravar Alocações</Button>}
                </CardHeader>
                <CardContent className="space-y-6 flex-1">
                  {carregandoAlocacoes ? (
                    <div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
                  ) : Object.values(alocacoes).length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground h-64 border-2 border-dashed rounded-lg"><p>Nenhum engenheiro alocado na matriz.</p></div>
                  ) : (
                    Object.values(alocacoes).map(alocacao => (
                      <div key={alocacao.consultorId} className="border bg-card rounded-xl p-5 mb-6">
                        <div className="flex justify-between border-b pb-4 mb-4">
                          <div><h3 className="font-bold text-primary">{consultores.find(c => c.id === alocacao.consultorId)?.nome}</h3><p className="text-xs text-muted-foreground">{isFechado ? 'Alocação Global (%)' : 'Teto Global (Horas)'}</p></div>
                          <div className="flex items-center gap-3">
                            <div className="relative flex items-center">
                              {isFechado ? <Percent className="absolute left-3 w-4 h-4 text-muted-foreground" /> : <Clock className="absolute left-3 w-4 h-4 text-muted-foreground" />}
                              <Input type="number" value={alocacao.horasTotais || ''} onChange={(e) => updateHoras(alocacao.consultorId, Number(e.target.value))} className="w-28 pl-9 pr-8 font-bold text-primary" disabled={alocacao.atividades.length > 0} />
                              <span className="absolute right-3 text-sm text-muted-foreground">{isFechado ? '%' : 'h'}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeConsultor(alocacao.consultorId)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        <div className="pl-4 border-l-2 border-primary/20 space-y-3">
                          <div className="flex justify-between items-center"><span className="text-sm font-medium">Disciplinas Específicas</span><Button variant="outline" size="sm" onClick={() => addAtiv(alocacao.consultorId)}><PlusCircle className="w-3 h-3 mr-1" /> Adicionar</Button></div>
                          {alocacao.atividades.map(atividade => (
                            <div key={atividade.id} className="flex gap-3 items-center bg-muted/30 p-2 rounded-md">
                              <Input disabled value={atividade.nome} className="h-8 flex-1 border-none font-medium" />
                              <div className="relative flex items-center w-32">
                                <Input type="number" className="h-8 pl-4 pr-6" value={atividade.horas || ''} onChange={(e) => updateAtiv(alocacao.consultorId, atividade.id, Number(e.target.value))} />
                                <span className="absolute right-2 text-xs text-muted-foreground">{isFechado ? '%' : 'h'}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => removeAtiv(alocacao.consultorId, atividade.id, atividade.dbId)}><X className="w-4 h-4" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="medicoes">
          <Card className="border-t-4 border-t-amber-500 min-h-[500px]">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <CardTitle className="text-xl">Avanço Físico (Medição Mensal)</CardTitle><CardDescription>Defina qual a % exata faturada/entregue por cada consultor nos contratos fechados.</CardDescription>
              <div className="flex flex-wrap gap-3 mt-4 p-4 bg-background border rounded-lg shadow-sm">
                <div className="flex gap-1">
                  <Select value={medMes} onValueChange={setMedMes}><SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger><SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                  <Select value={medAno} onValueChange={setMedAno}><SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
                </div>
                <Select value={medContrato} onValueChange={setMedContrato}><SelectTrigger className="w-64 h-9 border-primary"><SelectValue placeholder="Selecione Obra Fechada..." /></SelectTrigger><SelectContent>{contratos.filter(c => c.status_ativo && c.tipo === 'fechado').map(c => <SelectItem key={c.id} value={c.id}>{c.codigo}</SelectItem>)}</SelectContent></Select>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              {!medContrato ? <div className="flex flex-col items-center justify-center text-muted-foreground h-48 border-2 border-dashed rounded-lg"><ClipboardCheck className="w-12 h-12 mb-4 opacity-20" /><p>Selecione um contrato acima.</p></div> : medLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : medConsultores.length === 0 ? <p className="text-center text-muted-foreground py-8">Ninguém da equipe está alocado neste contrato.</p> : (
                <div className="max-w-2xl mx-auto space-y-6">
                  {medConsultores.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-4 border rounded-xl bg-muted/20">
                      <span className="font-semibold text-lg">{c.nome}</span>
                      <div className="flex items-center gap-2"><Label>Entregou neste mês:</Label><div className="relative"><Input type="number" className="w-24 pr-8 font-bold text-primary" value={medicoesInput[c.id] || ''} onChange={e => setMedicoesInput(p => ({...p, [c.id]: Number(e.target.value)}))} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span></div></div>
                    </div>
                  ))}
                  <div className="pt-4 flex justify-end"><Button onClick={salvarMedicoes} disabled={salvando} className="bg-amber-500 hover:bg-amber-600 text-white w-48"><Save className="w-4 h-4 mr-2" /> Salvar Medição</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gestao">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-t-4 border-t-purple-500">
                <CardHeader className="bg-muted/10 border-b pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5" /> {gestaoEditandoId ? 'Editar Apontamento' : 'Lançamento Retroativo'}</CardTitle>
                      <CardDescription>Insira horas em nome de qualquer consultor ou importe histórico.</CardDescription>
                    </div>
                    {/* BOTÃO IMPORTAR TIMESHEET CSV */}
                    <div className="relative">
                      <input type="file" id="csv-timesheet-upload" className="hidden" accept=".csv" onChange={handleImportarTimesheetCSV} />
                      <Button variant="outline" className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => document.getElementById('csv-timesheet-upload')?.click()}>
                        <FileUp className="w-4 h-4" /> Importar CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2"><Label>1. Consultor</Label><Select value={gestaoConsultor} onValueChange={setGestaoConsultor}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>2. Contrato</Label><Select value={gestaoContrato} onValueChange={setGestaoContrato}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>3. Atividade / Disciplina</Label><Select value={gestaoAtividade} onValueChange={setGestaoAtividade} disabled={!gestaoContrato}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{gestaoAtividadesDisponiveis.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Data do Serviço</Label><Input type="date" value={gestaoData} onChange={e => setGestaoData(e.target.value)} /></div><div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label>Início</Label><Input type="time" value={gestaoInicio} onChange={e => setGestaoInicio(e.target.value)} /></div><div className="space-y-2"><Label>Fim</Label><Input type="time" value={gestaoFim} onChange={e => setGestaoFim(e.target.value)} /></div></div></div>
                  <div className="space-y-2"><Label>Observação</Label><Input placeholder="Descrição da atividade..." value={gestaoNotes} onChange={e => setGestaoNotes(e.target.value)} /></div>
                  <div className="pt-2 flex gap-2"><Button onClick={salvarApontamentoAdmin} disabled={salvando} className="flex-1 bg-purple-600 hover:bg-purple-700">{salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} {gestaoEditandoId ? 'Atualizar' : 'Salvar'}</Button>{gestaoEditandoId && (<Button variant="outline" onClick={() => { setGestaoEditandoId(null); setGestaoInicio('08:00'); setGestaoFim('12:00'); setGestaoNotes(''); }}>Cancelar</Button>)}</div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-7">
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b"><CardTitle className="text-lg flex justify-between items-center">Últimos Apontamentos<Badge variant="outline" className="font-normal text-xs bg-muted/50">Exibindo os 50 mais recentes</Badge></CardTitle></CardHeader>
                <CardContent className="p-0 overflow-y-auto max-h-[600px]">
                  {loadingDash ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : gestaoLogsFiltrados.length === 0 ? <div className="p-8 text-center text-muted-foreground">Nenhum apontamento encontrado para este consultor.</div> : (
                    <div className="divide-y">
                      {gestaoLogsFiltrados.map(t => {
                        const start = new Date(t.start_at); const end = t.end_at ? new Date(t.end_at) : new Date(); const horas = ((end.getTime() - start.getTime()) / 3600000).toFixed(1)
                        return (
                          <div key={t.id} className={`p-4 hover:bg-muted/30 transition-colors ${gestaoEditandoId === t.id ? 'bg-purple-500/10' : ''}`}>
                            <div className="flex justify-between items-start mb-2"><div><p className="font-bold text-sm">{consultores.find(c => c.id === t.user_id)?.nome || 'Desconhecido'}</p><p className="text-xs text-muted-foreground">{t.contract_id ? contratos.find(c => c.id === t.contract_id)?.codigo : '-'} • {t.activity}</p></div><Badge variant="secondary" className="bg-primary/10 text-primary">{horas}h</Badge></div>
                            <div className="flex justify-between items-center mt-2"><p className="text-xs text-muted-foreground font-mono">{start.toLocaleDateString('pt-BR')} • {String(start.getHours()).padStart(2,'0')}:{String(start.getMinutes()).padStart(2,'0')} às {String(end.getHours()).padStart(2,'0')}:{String(end.getMinutes()).padStart(2,'0')}</p><div className="flex gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => iniciarEdicaoApontamento(t)}><Pencil className="w-3 h-3" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-500/10" onClick={() => excluirApontamentoAdmin(t.id)}><Trash2 className="w-3 h-3" /></Button></div></div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dash-mensal">
          <Card className="border-t-4 border-t-blue-500 min-h-[600px]">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><CardTitle className="text-xl">Folha de Pagamento</CardTitle><CardDescription>Cálculo de horas baseado nos ciclos cadastrados por contrato.</CardDescription></div>
                <Button onClick={exportarExcel} className="gap-2 bg-green-600 hover:bg-green-700 text-white"><Download className="w-4 h-4" /> Exportar Planilha (CSV)</Button>
              </div>
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-md border w-fit">
                  <Label className="font-bold uppercase tracking-wider text-xs ml-2">Visão do Painel:</Label>
                  <Select value={dashVisaoTipo} onValueChange={(v: any) => { setDashVisaoTipo(v); setDashContratosSelecionados([]); }}>
                    <SelectTrigger className="w-48 border-primary bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="horas">Contratos por Horas</SelectItem><SelectItem value="fechado">Preço Fechado (%)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-3 p-4 bg-background border rounded-lg shadow-sm">
                  <div className="flex gap-1">
                    <Select value={dashMes} onValueChange={setDashMes}><SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger><SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent></Select>
                    <Select value={dashAno} onValueChange={setDashAno}><SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
                  </div>
                  <div className="w-64">{renderFiltroContratosMultiplos()}</div>
                  <Select value={dashConsultor} onValueChange={setDashConsultor}><SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Toda a Equipe</SelectItem>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              {loadingDash ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : dashData.consultoresPagamento.length === 0 ? <div className="flex justify-center h-48 items-center border-2 border-dashed rounded-lg"><p className="text-muted-foreground">Sem registros no ciclo.</p></div> : (
                <div className="w-full h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashData.consultoresPagamento} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                      <XAxis dataKey="nomeCurto" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => dashVisaoTipo === 'fechado' ? `${value}%` : `${value}h`} />
                      <RechartsTooltip cursor={{fill: '#88888811'}} contentStyle={{borderRadius: '8px'}} formatter={(value: number, name: string, props: any) => [dashVisaoTipo === 'fechado' ? `${value}% medido na folha\n${props.payload.tooltipExtra || ''}` : `${value} horas`, dashVisaoTipo === 'fechado' ? 'Medição' : 'Trabalhado']} />
                      <Bar dataKey="valorGrafico" radius={[4, 4, 0, 0]} maxBarSize={60}>
                        {dashData.consultoresPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={dashVisaoTipo === 'fechado' ? '#f59e0b' : CORES_GRAFICO[index % CORES_GRAFICO.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dash-global">
          <Card className="border-t-4 border-t-amber-500 min-h-[600px]">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <div><CardTitle className="text-xl">Saúde Financeira Global</CardTitle><CardDescription>Visão geral de {dashVisaoTipo === 'horas' ? 'Horas' : 'Preços Fechados'}.</CardDescription></div>
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-md border w-fit">
                  <Label className="font-bold uppercase tracking-wider text-xs ml-2">Visão do Painel:</Label>
                  <Select value={dashVisaoTipo} onValueChange={(v: any) => { setDashVisaoTipo(v); setDashContratosSelecionados([]); }}>
                    <SelectTrigger className="w-48 border-primary bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="horas">Contratos por Horas</SelectItem><SelectItem value="fechado">Preço Fechado (%)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-3 p-4 bg-background border rounded-lg shadow-sm">
                  <div className="w-64">{renderFiltroContratosMultiplos()}</div>
                  <Select value={dashConsultor} onValueChange={setDashConsultor}><SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Toda a Equipe</SelectItem>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
                  <Select value={dashAtividade} onValueChange={setDashAtividade}><SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Geral (Todas)</SelectItem>{listaAtividadesDash.filter(Boolean).filter(a => a !== 'Sem atividade específica').map((a, i) => <SelectItem key={i} value={a as string}>{a}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 max-w-5xl mx-auto">
              {loadingDash ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                  {dashVisaoTipo === 'horas' ? (
                    <div className="space-y-6">
                      <div className="border p-6 rounded-xl bg-muted/20 shadow-sm"><p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Budget Orçado</p><p className="text-5xl font-bold">{dashData.orcadoGlobal}<span className="text-2xl text-muted-foreground">h</span></p></div>
                      <div className="border p-6 rounded-xl bg-red-500/10 border-red-500/20 shadow-sm"><p className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2">Horas Consumidas</p><p className="text-5xl font-bold text-red-600">{dashData.gastoGlobal}<span className="text-2xl opacity-60">h</span></p></div>
                      <div className={`border p-6 rounded-xl shadow-sm ${dashData.saldoGlobal < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}><p className={`text-sm font-bold uppercase tracking-wider mb-2 ${dashData.saldoGlobal < 0 ? 'text-red-600' : 'text-green-600'}`}>Saldo Restante</p><p className={`text-5xl font-bold ${dashData.saldoGlobal < 0 ? 'text-red-600' : 'text-green-600'}`}>{dashData.saldoGlobal}<span className="text-2xl opacity-60">h</span></p></div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="border p-6 rounded-xl bg-muted/20 shadow-sm"><p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">% Distribuída Global</p><p className="text-5xl font-bold text-primary">{dashData.percentualGlobal}<span className="text-2xl">%</span></p></div>
                      <div className="border p-6 rounded-xl bg-primary/10 border-primary/20 shadow-sm"><p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">% Medida na Obra</p><p className="text-5xl font-bold text-primary">{dashData.medidoGlobal}<span className="text-2xl opacity-60">%</span></p></div>
                    </div>
                  )}
                  <div className="h-[400px] w-full flex flex-col items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dashData.pieData} innerRadius={110} outerRadius={150} paddingAngle={5} dataKey="value" stroke="none">
                          <Cell fill={dashVisaoTipo === 'horas' ? "#ef4444" : "#f59e0b"} /> 
                          <Cell fill="#22c55e" />
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => [dashVisaoTipo === 'fechado' ? `${value}%` : `${value} horas`, '']} contentStyle={{borderRadius: '8px'}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-sm font-bold text-muted-foreground uppercase">{dashVisaoTipo === 'horas' ? 'Consumo' : 'Avanço Físico'}</p>
                      <p className={`text-5xl font-bold ${Number(dashData.percentualGlobal) > 100 && dashVisaoTipo === 'horas' ? 'text-red-500' : 'text-primary'}`}>
                        {dashVisaoTipo === 'horas' ? `${dashData.percentualGlobal}%` : `${dashData.medidoGlobal}%`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}