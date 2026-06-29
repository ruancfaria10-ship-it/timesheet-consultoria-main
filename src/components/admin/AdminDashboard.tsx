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
  User, Layers, CalendarDays, Download 
} from 'lucide-react'

// ==========================================
// IMPORTAÇÃO DOS GRÁFICOS (RECHARTS)
// ==========================================
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts'

// --- Tipagens ---
type Consultor = { id: string, nome: string }
type Contrato = { id: string, codigo: string, nome: string, status_ativo: boolean }
type AtividadeAlocada = { id: string, dbId?: string, nome: string, horas: number }
type Alocacao = { consultorId: string, horasTotais: number, geralId?: string, atividades: AtividadeAlocada[] }
type TimesheetLog = { id: string, user_id: string, contract_id: string, activity: string, start_at: string, end_at: string | null }

const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CORES_GRAFICO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']

export function AdminDashboard() {
  const { theme, toggle } = useTheme()
  const [abaAtiva, setAbaAtiva] = useState('contratos')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // Dados Globais
  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  
  // Abas 1 e 2: Contratos e Alocações
  const [novoCodigo, setNovoCodigo] = useState('')
  const [novoNomeContrato, setNovoNomeContrato] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [editNome, setEditNome] = useState('')
  const [editStatus, setEditStatus] = useState(true)
  const [contratoAtivo, setContratoAtivo] = useState<string>('')
  const [alocacoes, setAlocacoes] = useState<Record<string, Alocacao>>({})
  const [carregandoAlocacoes, setCarregandoAlocacoes] = useState(false)

  // Aba Dashboards
  const [dashMes, setDashMes] = useState<string>(new Date().getMonth().toString())
  const [dashAno, setDashAno] = useState<string>(new Date().getFullYear().toString())
  const [dashContratosSelecionados, setDashContratosSelecionados] = useState<string[]>([]) 
  const [dashConsultor, setDashConsultor] = useState<string>('todos')
  const [dashAtividade, setDashAtividade] = useState<string>('todas')
  const [allTimesheets, setAllTimesheets] = useState<TimesheetLog[]>([])
  const [allAlocacoes, setAllAlocacoes] = useState<any[]>([])
  const [loadingDash, setLoadingDash] = useState(false)

  // 1. CARREGAR ESTRUTURA INICIAL
  async function carregarDadosDoBanco() {
    try {
      setLoading(true)
      const { data: dbCons } = await supabase.from('consultores').select('id, nome').order('nome')
      const { data: dbCont } = await supabase.from('contratos').select('id, codigo, nome, status_ativo').order('codigo')
      setConsultores(dbCons || [])
      setContratos((dbCont || []).map(c => ({ ...c, status_ativo: c.status_ativo === true })))
    } catch (error) {
      console.error("Erro geral:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarDadosDoBanco() }, [])

  // ==========================================
  // FUNÇÕES DE CONTRATO
  // ==========================================
  async function criarNovoContrato() {
    if (!novoCodigo || !novoNomeContrato) return alert("Preencha todos os campos!")
    await supabase.from('contratos').insert([{ codigo: novoCodigo.toUpperCase().trim(), nome: novoNomeContrato.trim(), status_ativo: true }])
    setNovoCodigo(''); setNovoNomeContrato(''); carregarDadosDoBanco();
  }

  function iniciarEdicao(c: Contrato) {
    setEditandoId(c.id); setEditCodigo(c.codigo); setEditNome(c.nome); setEditStatus(c.status_ativo);
  }

  async function salvarEdicaoContrato(id: string) {
    await supabase.from('contratos').update({ codigo: editCodigo.toUpperCase().trim(), nome: editNome.trim(), status_ativo: editStatus }).eq('id', id)
    setEditandoId(null); carregarDadosDoBanco();
  }

  async function excluirContrato(id: string, nome: string) {
    if (!window.confirm(`Excluir definitivamente "${nome}" e suas alocações?`)) return;
    await supabase.from('alocacoes').delete().eq('contract_id', id); 
    await supabase.from('contratos').delete().eq('id', id);
    if (contratoAtivo === id) { setContratoAtivo(''); setAlocacoes({}); }
    carregarDadosDoBanco();
  }

  // ==========================================
  // FUNÇÕES DE ALOCAÇÃO
  // ==========================================
  useEffect(() => { 
    if (contratoAtivo && abaAtiva === 'alocacoes') carregarAlocacoesDoContrato(contratoAtivo) 
  }, [contratoAtivo, abaAtiva])

  async function carregarAlocacoesDoContrato(idContrato: string) {
    setCarregandoAlocacoes(true)
    const { data } = await supabase.from('alocacoes').select('*').eq('contract_id', idContrato)
    const alocSalvas: Record<string, Alocacao> = {}
    
    ;(data || []).forEach(row => {
      if (!alocSalvas[row.user_id]) {
        alocSalvas[row.user_id] = { consultorId: row.user_id, horasTotais: 0, atividades: [] }
      }
      if (row.atividade === 'Orçamento Geral') {
        alocSalvas[row.user_id].horasTotais = row.horas_disponiveis
        alocSalvas[row.user_id].geralId = row.id
      } else {
        alocSalvas[row.user_id].atividades.push({ 
          id: row.id.toString(), dbId: row.id, nome: row.atividade, horas: row.horas_disponiveis 
        })
        alocSalvas[row.user_id].horasTotais += row.horas_disponiveis
      }
    })
    setAlocacoes(alocSalvas)
    setCarregandoAlocacoes(false)
  }

  async function salvarAlocacoesNoBanco() {
    setSalvando(true)
    const upserts: any[] = []; const inserts: any[] = []
    
    Object.values(alocacoes).forEach(aloc => {
      if (aloc.atividades.length > 0) {
        aloc.atividades.forEach(ativ => {
          if (ativ.dbId) upserts.push({ id: ativ.dbId, user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: ativ.horas, atividade: ativ.nome.trim() })
          else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: ativ.horas, atividade: ativ.nome.trim() })
        })
      } else {
        if (aloc.geralId) upserts.push({ id: aloc.geralId, user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: aloc.horasTotais, atividade: 'Orçamento Geral' })
        else inserts.push({ user_id: aloc.consultorId, contract_id: contratoAtivo, horas_disponiveis: aloc.horasTotais, atividade: 'Orçamento Geral' })
      }
    })
    
    try {
      for (const u of upserts) await supabase.from('alocacoes').update({ horas_disponiveis: u.horas_disponiveis, atividade: u.atividade }).eq('id', u.id)
      if (inserts.length > 0) await supabase.from('alocacoes').insert(inserts)
      alert("Alocações salvas!")
      carregarAlocacoesDoContrato(contratoAtivo)
    } catch (e) { alert("Erro ao salvar.") }
    setSalvando(false)
  }

  const adicionarConsultorAoContrato = (id: string) => { 
    if (!alocacoes[id]) setAlocacoes(p => ({ ...p, [id]: { consultorId: id, horasTotais: 0, atividades: [] } })) 
  }
  
  const atualizarHorasTotais = (id: string, h: number) => {
    setAlocacoes(p => ({ ...p, [id]: { ...p[id], horasTotais: h } }))
  }
  
  const adicionarAtividade = (id: string) => { 
    const n = prompt("Nome da Atividade:"); 
    if (n) setAlocacoes(p => ({ ...p, [id]: { ...p[id], atividades: [...p[id].atividades, { id: Date.now().toString(), nome: n, horas: 0 }] } })) 
  }
  
  const atualizarHorasAtividade = (cid: string, aid: string, h: number) => {
    setAlocacoes(p => ({ ...p, [cid]: { ...p[cid], atividades: p[cid].atividades.map(a => a.id === aid ? { ...a, horas: h } : a) } }))
  }
  
  const removerAtividade = async (cid: string, aid: string, dbId?: string) => { 
    if (dbId && !window.confirm("Apagar definitivamente do banco?")) return; 
    if (dbId) await supabase.from('alocacoes').delete().eq('id', dbId); 
    setAlocacoes(p => ({ ...p, [cid]: { ...p[cid], atividades: p[cid].atividades.filter(a => a.id !== aid) } })) 
  }
  
  const removerConsultor = async (cid: string) => { 
    const dbIds = [...alocacoes[cid].atividades.map(a => a.dbId).filter(Boolean), alocacoes[cid].geralId].filter(Boolean); 
    if (dbIds.length > 0 && !window.confirm("Excluir todo o histórico deste consultor nesta obra?")) return; 
    if (dbIds.length > 0) await supabase.from('alocacoes').delete().in('id', dbIds as string[]); 
    setAlocacoes(p => { const n = { ...p }; delete n[cid]; return n }) 
  }

  // ==========================================
  // DASHBOARDS E EXPORTAÇÃO PARA EXCEL
  // ==========================================
  useEffect(() => {
    if ((abaAtiva === 'dash-mensal' || abaAtiva === 'dash-global') && allTimesheets.length === 0) {
      carregarTudoParaDash()
    }
  }, [abaAtiva])

  async function carregarTudoParaDash() {
    setLoadingDash(true)
    const { data: times } = await supabase.from('timesheets').select('*').not('end_at', 'is', null)
    const { data: orcs } = await supabase.from('alocacoes').select('*')
    setAllTimesheets(times || [])
    setAllAlocacoes(orcs || [])
    setLoadingDash(false)
  }

  const dashData = useMemo(() => {
    let fTimes = allTimesheets
    let fAlocs = allAlocacoes
    
    if (dashContratosSelecionados.length > 0) {
      fTimes = fTimes.filter(t => dashContratosSelecionados.includes(t.contract_id))
      fAlocs = fAlocs.filter(a => dashContratosSelecionados.includes(a.contract_id))
    }
    if (dashConsultor !== 'todos') {
      fTimes = fTimes.filter(t => t.user_id === dashConsultor)
      fAlocs = fAlocs.filter(a => a.user_id === dashConsultor)
    }
    if (dashAtividade !== 'todas') {
      fTimes = fTimes.filter(t => t.activity === dashAtividade)
      fAlocs = fAlocs.filter(a => a.atividade === dashAtividade || a.atividade === 'Orçamento Geral')
    }

    // 1. FOLHA MENSAL (Ciclo Dia 25 ao Dia 24)
    let prevMonth = parseInt(dashMes) - 1
    let startYear = parseInt(dashAno)
    if (prevMonth < 0) { prevMonth = 11; startYear -= 1; }
    
    const dataInicio = new Date(startYear, prevMonth, 25, 0, 0, 0).getTime()
    const dataFim = new Date(parseInt(dashAno), parseInt(dashMes), 24, 23, 59, 59).getTime()

    const consultoresPagamento = consultores.map(c => {
      const logs = fTimes.filter(t => 
        t.user_id === c.id && 
        new Date(t.start_at).getTime() >= dataInicio && 
        new Date(t.start_at).getTime() <= dataFim
      )
      const horas = logs.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
      return { 
        id: c.id, 
        nome: c.nome, 
        nomeCurto: c.nome.split(' ')[0], 
        horas: Number(horas.toFixed(2)) 
      }
    }).filter(c => c.horas > 0).sort((a,b) => b.horas - a.horas)

    // 2. SAÚDE GLOBAL (Sem filtro de data)
    const orcadoGlobal = fAlocs.reduce((acc, curr) => acc + curr.horas_disponiveis, 0)
    const gastoGlobal = fTimes.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
    
    const saldoPositivo = orcadoGlobal - gastoGlobal > 0 ? orcadoGlobal - gastoGlobal : 0;
    
    // Dados para o Gráfico de Rosca (Doughnut)
    const pieData = [
      { name: 'Consumido', value: Number(gastoGlobal.toFixed(2)) },
      { name: 'Saldo Restante', value: Number(saldoPositivo.toFixed(2)) }
    ]

    return { 
      consultoresPagamento, 
      orcadoGlobal, 
      gastoGlobal: Number(gastoGlobal.toFixed(2)), 
      saldoGlobal: Number((orcadoGlobal - gastoGlobal).toFixed(2)),
      percentualGlobal: orcadoGlobal > 0 ? ((gastoGlobal / orcadoGlobal) * 100).toFixed(1) : '0',
      pieData
    }
  }, [allTimesheets, allAlocacoes, dashMes, dashAno, dashContratosSelecionados, dashConsultor, dashAtividade, consultores])

  // ==========================================
  // FUNÇÃO DE EXPORTAÇÃO PARA EXCEL (CSV UTF-8)
  // ==========================================
  const exportarExcel = () => {
    let prevMonth = parseInt(dashMes) - 1
    let startYear = parseInt(dashAno)
    if (prevMonth < 0) { prevMonth = 11; startYear -= 1; }
    const dataInicio = new Date(startYear, prevMonth, 25, 0, 0, 0).getTime()
    const dataFim = new Date(parseInt(dashAno), parseInt(dashMes), 24, 23, 59, 59).getTime()

    let registros = allTimesheets.filter(t => new Date(t.start_at).getTime() >= dataInicio && new Date(t.start_at).getTime() <= dataFim)
    if (dashContratosSelecionados.length > 0) registros = registros.filter(t => dashContratosSelecionados.includes(t.contract_id))
    if (dashConsultor !== 'todos') registros = registros.filter(t => t.user_id === dashConsultor)
    if (dashAtividade !== 'todas') registros = registros.filter(t => t.activity === dashAtividade)

    const csvRows = ["Consultor;Obra;Atividade;Data;Entrada;Saida;Horas Totais"]
    
    registros.forEach(t => {
      const consultor = consultores.find(c => c.id === t.user_id)?.nome || 'Desconhecido'
      const contrato = contratos.find(c => c.id === t.contract_id)?.codigo || 'Desconhecido'
      const inicio = new Date(t.start_at)
      const fim = new Date(t.end_at!)
      const dataStr = inicio.toLocaleDateString('pt-BR')
      const horaIn = inicio.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
      const horaOut = fim.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
      const horas = ((fim.getTime() - inicio.getTime()) / 3600000).toFixed(2).replace('.', ',')

      csvRows.push(`${consultor};${contrato};${t.activity};${dataStr};${horaIn};${horaOut};${horas}`)
    })

    const csvContent = "\uFEFF" + csvRows.join("\n") // UTF-8 para manter os acentos
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Folha_Engeprice_${MESES_NOME[parseInt(dashMes)]}_${dashAno}.csv`
    link.click()
  }

  // ==========================================
  // COMPONENTE: Filtro Multi-Seleção de Contratos
  // ==========================================
  const renderFiltroContratosMultiplos = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal bg-background h-9 border-input truncate overflow-hidden">
          {dashContratosSelecionados.length === 0 
            ? "Todos os Contratos" 
            : `${dashContratosSelecionados.length} Contrato(s) selecionado(s)`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 bg-card border shadow-md" align="start">
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          <div className="flex items-center space-x-2 pb-3 border-b">
            <Checkbox 
              id="chk-todos"
              checked={dashContratosSelecionados.length === 0} 
              onCheckedChange={(c) => { if (c) setDashContratosSelecionados([]) }} 
            />
            <Label htmlFor="chk-todos" className="font-bold cursor-pointer text-sm">Selecionar Todos</Label>
          </div>
          {contratos.filter(c => c.status_ativo).map(c => (
            <div key={c.id} className="flex items-center space-x-2 py-1">
              <Checkbox 
                id={`chk-${c.id}`}
                checked={dashContratosSelecionados.includes(c.id)}
                onCheckedChange={(checked) => {
                  if (checked) setDashContratosSelecionados(prev => [...prev, c.id])
                  else setDashContratosSelecionados(prev => prev.filter(id => id !== c.id))
                }}
              />
              <Label htmlFor={`chk-${c.id}`} className="cursor-pointer text-sm leading-tight flex-1">
                <span className="font-semibold text-primary">{c.codigo}</span> - {c.nome}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )

  const listaAtividadesDash = Array.from(new Set([...allTimesheets.map(t => t.activity), ...allAlocacoes.map(a => a.atividade)]))

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-24">
      
      {/* HEADER PRINCIPAL */}
      <header className="flex flex-wrap gap-4 items-center justify-between pb-6 border-b mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Comando</h1>
          <p className="text-muted-foreground text-lg">Gestão integrada de contratos de engenharia.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggle} className="rounded-full">
            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </Button>
          <Avatar className="h-10 w-10 border shadow-sm cursor-pointer hover:opacity-80 transition-opacity">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* CONTROLE DE ABAS */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[800px] mb-6">
          <TabsTrigger value="contratos">Gerir Contratos</TabsTrigger>
          <TabsTrigger value="alocacoes">Alocação</TabsTrigger>
          <TabsTrigger value="dash-mensal" className="gap-2"><CalendarDays className="w-4 h-4" /> Folha (Mensal)</TabsTrigger>
          <TabsTrigger value="dash-global" className="gap-2"><Layers className="w-4 h-4" /> Saúde (Global)</TabsTrigger>
        </TabsList>

        {/* ============================================================================== */}
        {/* ABA 1: CONTRATOS */}
        {/* ============================================================================== */}
        <TabsContent value="contratos">
          <Card>
            <CardHeader>
              <CardTitle>Contratos Cadastrados</CardTitle>
              <CardDescription>Insira novos projetos ou modifique registros existentes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 mb-6 items-end">
                <div className="space-y-2">
                  <Label>Código do Contrato</Label>
                  <Input 
                    placeholder="Ex: CT-999" 
                    className="w-48 uppercase" 
                    value={novoCodigo} 
                    onChange={(e) => setNovoCodigo(e.target.value)} 
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Nome descritivo do contrato</Label>
                  <Input 
                    placeholder="Nome descritivo do contrato" 
                    value={novoNomeContrato} 
                    onChange={(e) => setNovoNomeContrato(e.target.value)} 
                  />
                </div>
                <Button className="gap-2" onClick={criarNovoContrato}>
                  <PlusCircle className="w-4 h-4" /> Cadastrar Projeto
                </Button>
              </div>
              
              <div className="border rounded-xl divide-y max-h-[450px] overflow-y-auto bg-card">
                {contratos.map(c => (
                  <div key={c.id} className="p-4 flex flex-wrap gap-4 justify-between items-center hover:bg-muted/30 transition-colors">
                    {editandoId === c.id ? (
                      <div className="flex flex-1 flex-wrap gap-4 items-center">
                        <Input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} className="w-32 font-mono uppercase" />
                        <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="flex-1" />
                        <div className="flex items-center gap-2 border p-2 rounded-md bg-background">
                          <Switch id={`edit-status-${c.id}`} checked={editStatus} onCheckedChange={setEditStatus} />
                          <Label htmlFor={`edit-status-${c.id}`} className="text-xs cursor-pointer">{editStatus ? 'Ativo' : 'Inativo'}</Label>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="text-green-500 hover:text-green-600 hover:bg-green-500/10" onClick={() => salvarEdicaoContrato(c.id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => setEditandoId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <Briefcase className="text-primary w-5 h-5 shrink-0" />
                          <div>
                            <p className="font-bold tracking-wide">{c.codigo}</p>
                            <p className="text-sm text-muted-foreground">{c.nome}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.status_ativo ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 mr-2">Ativo</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 mr-2">Inativo</Badge>
                          )}
                          <Button variant="outline" size="sm" onClick={() => iniciarEdicao(c)} className="gap-2">
                            <Pencil className="w-4 h-4" /> Editar
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => excluirContrato(c.id, c.nome)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 ml-2">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================================== */}
        {/* ABA 2: ALOCAÇÕES */}
        {/* ============================================================================== */}
        <TabsContent value="alocacoes">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader className="pb-4"><CardTitle className="text-lg">1. Contrato Ativo</CardTitle></CardHeader>
                <CardContent>
                  <Select value={contratoAtivo} onValueChange={(val) => { setContratoAtivo(val); setAlocacoes({}); }}>
                    <SelectTrigger><SelectValue placeholder="Escolha uma obra..." /></SelectTrigger>
                    <SelectContent>
                      {contratos.filter(c => c.status_ativo).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className={!contratoAtivo ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader className="pb-4"><CardTitle className="text-lg">2. Equipe</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[350px] overflow-y-auto">
                  {consultores.map(user => {
                    const jaAlocado = !!alocacoes[user.id]
                    return (
                      <div 
                        key={user.id} 
                        onClick={() => adicionarConsultorAoContrato(user.id)} 
                        className={`p-3 rounded-lg border flex justify-between items-center transition-all ${jaAlocado ? 'bg-muted opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 p-2 rounded-full"><UserPlus className="w-4 h-4 text-primary" /></div>
                          <span className="font-medium text-sm">{user.nome}</span>
                        </div>
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
                    <CardTitle>3. Matriz de Budget e Horas</CardTitle>
                    <CardDescription>{contratoAtivo ? contratos.find(c => c.id === contratoAtivo)?.nome : 'Selecione uma obra ativa.'}</CardDescription>
                  </div>
                  {contratoAtivo && (
                    <Button onClick={salvarAlocacoesNoBanco} disabled={salvando} className="gap-2 shadow-md">
                      {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Gravar Alocações
                    </Button>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-6 flex-1">
                  {carregandoAlocacoes ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
                  ) : Object.values(alocacoes).length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground h-64 border-2 border-dashed rounded-lg">
                      <p>Nenhum engenheiro alocado na matriz.</p>
                    </div>
                  ) : (
                    Object.values(alocacoes).map(alocacao => (
                      <div key={alocacao.consultorId} className="border bg-card rounded-xl p-5 shadow-sm mb-6">
                        <div className="flex flex-wrap items-end justify-between border-b pb-4 mb-4">
                          <div>
                            <h3 className="font-bold text-lg text-primary">{consultores.find(c => c.id === alocacao.consultorId)?.nome}</h3>
                            <p className="text-xs text-muted-foreground">Teto global de horas</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="relative flex items-center">
                              <Clock className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input 
                                type="number" 
                                value={alocacao.horasTotais || ''} 
                                onChange={(e) => atualizarHorasTotais(alocacao.consultorId, Number(e.target.value))} 
                                className="w-28 pl-9 pr-8 font-medium" 
                              />
                              <span className="absolute right-3 text-sm text-muted-foreground pointer-events-none">h</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removerConsultor(alocacao.consultorId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="pl-4 border-l-2 border-primary/20 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-muted-foreground">Disciplinas Específicas</span>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => adicionarAtividade(alocacao.consultorId)}>
                              <PlusCircle className="w-3 h-3" /> Adicionar
                            </Button>
                          </div>
                          {alocacao.atividades.map(atividade => (
                            <div key={atividade.id} className="flex gap-3 items-center bg-muted/30 p-2 rounded-md">
                              <Input disabled value={atividade.nome} className="h-8 flex-1 bg-transparent border-none font-medium" />
                              <div className="relative flex items-center w-32">
                                <Clock className="absolute left-2.5 w-3 h-3 text-muted-foreground pointer-events-none" />
                                <Input 
                                  type="number" 
                                  className="h-8 pl-8 pr-6" 
                                  value={atividade.horas || ''} 
                                  onChange={(e) => atualizarHorasAtividade(alocacao.consultorId, atividade.id, Number(e.target.value))} 
                                />
                                <span className="absolute right-2 text-xs text-muted-foreground pointer-events-none">h</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => removerAtividade(alocacao.consultorId, atividade.id, atividade.dbId)}>
                                <X className="w-4 h-4" />
                              </Button>
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

        {/* ============================================================================== */}
        {/* ABA 3: FOLHA DE PAGAMENTO (COM GRÁFICO RECHARTS E EXCEL) */}
        {/* ============================================================================== */}
        <TabsContent value="dash-mensal">
          <Card className="border-t-4 border-t-blue-500 min-h-[600px]">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Folha de Pagamento</CardTitle>
                  <CardDescription>Ciclo: 25 mês ant. a 24 mês atual.</CardDescription>
                </div>
                
                {/* BOTÃO EXPORTAR EXCEL */}
                <Button onClick={exportarExcel} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Download className="w-4 h-4" /> Exportar Planilha (CSV)
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-3 mt-4 p-4 bg-background border rounded-lg shadow-sm">
                <div className="flex gap-1">
                  <Select value={dashMes} onValueChange={setDashMes}>
                    <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={dashAno} onValueChange={setDashAno}>
                    <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-64">{renderFiltroContratosMultiplos}</div>
                <Select value={dashConsultor} onValueChange={setDashConsultor}>
                  <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Toda a Equipe</SelectItem>
                    {consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="pt-8">
              {loadingDash ? (
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : dashData.consultoresPagamento.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground h-48 border-2 border-dashed rounded-lg">
                  <p>Nenhum registro de horas encontrado para estes filtros neste ciclo.</p>
                </div>
              ) : (
                <div className="w-full h-[400px]">
                  {/* GRÁFICO DE BARRAS NATIVO - RECHARTS */}
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashData.consultoresPagamento} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                      <XAxis dataKey="nomeCurto" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} />
                      <RechartsTooltip 
                        cursor={{fill: '#88888811'}} 
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                        formatter={(value: number) => [`${value} horas`, 'Total']} 
                      />
                      <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={60}>
                        {dashData.consultoresPagamento.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================================== */}
        {/* ABA 4: SAÚDE GLOBAL (COM GRÁFICO DE ROSCA RECHARTS) */}
        {/* ============================================================================== */}
        <TabsContent value="dash-global">
          <Card className="border-t-4 border-t-amber-500 min-h-[600px]">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <div>
                <CardTitle className="text-xl">Saúde Financeira Global</CardTitle>
                <CardDescription>Horas orçadas vs Consumidas de todo o período histórico.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 p-4 bg-background border rounded-lg shadow-sm">
                <div className="w-64">{renderFiltroContratosMultiplos}</div>
                <Select value={dashConsultor} onValueChange={setDashConsultor}>
                  <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Toda a Equipe</SelectItem>
                    {consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={dashAtividade} onValueChange={setDashAtividade}>
                  <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Geral (Todas)</SelectItem>
                    {listaAtividadesDash.filter(Boolean).filter(a => a !== 'Orçamento Geral').map((a, i) => (
                      <SelectItem key={i} value={a as string}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="pt-8">
              {loadingDash ? (
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
                  
                  {/* DADOS À ESQUERDA */}
                  <div className="space-y-6">
                    <div className="border p-6 rounded-xl bg-muted/20 shadow-sm">
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Budget Orçado</p>
                      <p className="text-5xl font-bold">{dashData.orcadoGlobal}<span className="text-2xl text-muted-foreground">h</span></p>
                    </div>
                    <div className="border p-6 rounded-xl bg-red-500/10 border-red-500/20 shadow-sm">
                      <p className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2">Horas Consumidas</p>
                      <p className="text-5xl font-bold text-red-600">{dashData.gastoGlobal}<span className="text-2xl opacity-60">h</span></p>
                    </div>
                    <div className={`border p-6 rounded-xl shadow-sm ${dashData.saldoGlobal < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                      <p className={`text-sm font-bold uppercase tracking-wider mb-2 ${dashData.saldoGlobal < 0 ? 'text-red-600' : 'text-green-600'}`}>Saldo Restante</p>
                      <p className={`text-5xl font-bold ${dashData.saldoGlobal < 0 ? 'text-red-600' : 'text-green-600'}`}>{dashData.saldoGlobal}<span className="text-2xl opacity-60">h</span></p>
                    </div>
                  </div>

                  {/* GRÁFICO DE ROSCA À DIREITA - RECHARTS */}
                  <div className="h-[400px] w-full flex flex-col items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={dashData.pieData} 
                          innerRadius={110} 
                          outerRadius={150} 
                          paddingAngle={5} 
                          dataKey="value" 
                          stroke="none"
                        >
                          <Cell fill="#ef4444" /> {/* Vermelho = Consumido */}
                          <Cell fill="#22c55e" /> {/* Verde = Saldo */}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number) => [`${value} horas`, '']} 
                          contentStyle={{borderRadius: '8px', border: 'none'}} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Texto no centro da Rosca */}
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-sm font-bold text-muted-foreground uppercase">Consumo</p>
                      <p className={`text-5xl font-bold ${Number(dashData.percentualGlobal) > 100 ? 'text-red-500' : 'text-primary'}`}>
                        {dashData.percentualGlobal}%
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