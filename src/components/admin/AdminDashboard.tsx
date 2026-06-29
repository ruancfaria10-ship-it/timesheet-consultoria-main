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
import { PlusCircle, UserPlus, Briefcase, Clock, ArrowRight, Trash2, Loader2, Pencil, Check, X, Save, BarChart3, Sun, Moon, User, Layers, CalendarDays } from 'lucide-react'

// --- Tipagens ---
type Consultor = { id: string, nome: string }
type Contrato = { id: string, codigo: string, nome: string, status_ativo: boolean }
type AtividadeAlocada = { id: string, dbId?: string, nome: string, horas: number }
type Alocacao = { consultorId: string, horasTotais: number, geralId?: string, atividades: AtividadeAlocada[] }
type TimesheetLog = { id: string, user_id: string, contract_id: string, activity: string, start_at: string, end_at: string | null }

const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function AdminDashboard() {
  const { theme, toggle } = useTheme()
  const [abaAtiva, setAbaAtiva] = useState('contratos')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [consultores, setConsultores] = useState<Consultor[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  
  const [novoCodigo, setNovoCodigo] = useState('')
  const [novoNomeContrato, setNovoNomeContrato] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editCodigo, setEditCodigo] = useState('')
  const [editNome, setEditNome] = useState('')
  const [editStatus, setEditStatus] = useState(true)
  const [contratoAtivo, setContratoAtivo] = useState<string>('')
  const [alocacoes, setAlocacoes] = useState<Record<string, Alocacao>>({})
  const [carregandoAlocacoes, setCarregandoAlocacoes] = useState(false)

  // Filtros Globais dos Dashboards
  const [dashMes, setDashMes] = useState<string>(new Date().getMonth().toString())
  const [dashAno, setDashAno] = useState<string>(new Date().getFullYear().toString())
  const [dashContratosSelecionados, setDashContratosSelecionados] = useState<string[]>([]) 
  const [dashConsultor, setDashConsultor] = useState<string>('todos')
  const [dashAtividade, setDashAtividade] = useState<string>('todas')
  
  const [allTimesheets, setAllTimesheets] = useState<TimesheetLog[]>([])
  const [allAlocacoes, setAllAlocacoes] = useState<any[]>([])
  const [loadingDash, setLoadingDash] = useState(false)

  // CARREGAR ESTRUTURA INICIAL
  async function carregarDadosDoBanco() {
    try {
      setLoading(true)
      const { data: dbCons } = await supabase.from('consultores').select('id, nome').order('nome')
      const { data: dbCont } = await supabase.from('contratos').select('id, codigo, nome, status_ativo').order('codigo')

      setConsultores(dbCons || [])
      setContratos((dbCont || []).map(c => ({ ...c, status_ativo: c.status_ativo === true })))
    } catch (error) { console.error("Erro geral:", error) } finally { setLoading(false) }
  }
  useEffect(() => { carregarDadosDoBanco() }, [])

  // FUNÇÕES DE CONTRATO
  async function criarNovoContrato() {
    if (!novoCodigo || !novoNomeContrato) return alert("Preencha todos os campos!")
    try {
      await supabase.from('contratos').insert([{ codigo: novoCodigo.toUpperCase().trim(), nome: novoNomeContrato.trim(), status_ativo: true }])
      setNovoCodigo(''); setNovoNomeContrato(''); carregarDadosDoBanco();
    } catch (error) { alert("Erro ao criar contrato.") }
  }
  function iniciarEdicao(c: Contrato) { setEditandoId(c.id); setEditCodigo(c.codigo); setEditNome(c.nome); setEditStatus(c.status_ativo); }
  async function salvarEdicaoContrato(id: string) {
    try {
      await supabase.from('contratos').update({ codigo: editCodigo.toUpperCase().trim(), nome: editNome.trim(), status_ativo: editStatus }).eq('id', id)
      setEditandoId(null); carregarDadosDoBanco();
    } catch (error) { alert("Erro ao atualizar.") }
  }
  async function excluirContrato(id: string, nome: string) {
    if (!window.confirm(`Excluir definitivamente "${nome}" e suas alocações?`)) return;
    try {
      await supabase.from('alocacoes').delete().eq('contract_id', id);
      await supabase.from('contratos').delete().eq('id', id);
      if (contratoAtivo === id) { setContratoAtivo(''); setAlocacoes({}); }
      carregarDadosDoBanco();
    } catch (error) { alert("Falha ao excluir.") }
  }

  // FUNÇÕES DE ALOCAÇÃO
  useEffect(() => { if (contratoAtivo && abaAtiva === 'alocacoes') carregarAlocacoesDoContrato(contratoAtivo) }, [contratoAtivo, abaAtiva])
  async function carregarAlocacoesDoContrato(idContrato: string) {
    setCarregandoAlocacoes(true)
    const { data } = await supabase.from('alocacoes').select('*').eq('contract_id', idContrato)
    const alocSalvas: Record<string, Alocacao> = {}
    ;(data || []).forEach(row => {
      if (!alocSalvas[row.user_id]) alocSalvas[row.user_id] = { consultorId: row.user_id, horasTotais: 0, atividades: [] }
      if (row.atividade === 'Orçamento Geral') {
        alocSalvas[row.user_id].horasTotais = row.horas_disponiveis; alocSalvas[row.user_id].geralId = row.id
      } else {
        alocSalvas[row.user_id].atividades.push({ id: row.id.toString(), dbId: row.id, nome: row.atividade, horas: row.horas_disponiveis })
        alocSalvas[row.user_id].horasTotais += row.horas_disponiveis
      }
    })
    setAlocacoes(alocSalvas); setCarregandoAlocacoes(false)
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
      alert("Alocações salvas!"); carregarAlocacoesDoContrato(contratoAtivo)
    } catch (e) { alert("Erro ao salvar.") }
    setSalvando(false)
  }
  const adicionarConsultorAoContrato = (id: string) => { if (!alocacoes[id]) setAlocacoes(p => ({ ...p, [id]: { consultorId: id, horasTotais: 0, atividades: [] } })) }
  const atualizarHorasTotais = (id: string, h: number) => setAlocacoes(p => ({ ...p, [id]: { ...p[id], horasTotais: h } }))
  const adicionarAtividade = (id: string) => {
    const nome = prompt("Nome da Atividade:"); if (!nome) return;
    setAlocacoes(p => ({ ...p, [id]: { ...p[id], atividades: [...p[id].atividades, { id: Date.now().toString(), nome, horas: 0 }] } }))
  }
  const atualizarHorasAtividade = (cid: string, aid: string, h: number) => setAlocacoes(p => ({ ...p, [cid]: { ...p[cid], atividades: p[cid].atividades.map(a => a.id === aid ? { ...a, horas: h } : a) } }))
  const removerAtividade = async (cid: string, aid: string, dbId?: string) => {
    if (dbId && !window.confirm("Apagar do banco?")) return;
    if (dbId) await supabase.from('alocacoes').delete().eq('id', dbId)
    setAlocacoes(p => ({ ...p, [cid]: { ...p[cid], atividades: p[cid].atividades.filter(a => a.id !== aid) } }))
  }
  const removerConsultor = async (cid: string) => {
    const aloc = alocacoes[cid]; const dbIds = [...aloc.atividades.map(a => a.dbId).filter(Boolean), aloc.geralId].filter(Boolean)
    if (dbIds.length > 0 && !window.confirm("Excluir histórico deste consultor?")) return;
    if (dbIds.length > 0) await supabase.from('alocacoes').delete().in('id', dbIds as string[])
    setAlocacoes(p => { const n = { ...p }; delete n[cid]; return n })
  }

  // BUSCA DE DADOS PARA OS DASHBOARDS
  useEffect(() => {
    if ((abaAtiva === 'dash-mensal' || abaAtiva === 'dash-global') && allTimesheets.length === 0) {
      carregarTudoParaDash()
    }
  }, [abaAtiva])

  async function carregarTudoParaDash() {
    setLoadingDash(true)
    try {
      const { data: times } = await supabase.from('timesheets').select('*').not('end_at', 'is', null)
      const { data: orcs } = await supabase.from('alocacoes').select('*')
      setAllTimesheets(times || [])
      setAllAlocacoes(orcs || [])
    } catch (error) { console.error("Erro dash:", error) } finally { setLoadingDash(false) }
  }

  // CÁLCULOS DO DASHBOARD (Otimizados com filtros múltiplos)
  const dashData = useMemo(() => {
    let filteredTimesheets = allTimesheets
    let filteredAlocacoes = allAlocacoes

    if (dashContratosSelecionados.length > 0) {
      filteredTimesheets = filteredTimesheets.filter(t => dashContratosSelecionados.includes(t.contract_id))
      filteredAlocacoes = filteredAlocacoes.filter(a => dashContratosSelecionados.includes(a.contract_id))
    }
    
    if (dashConsultor !== 'todos') {
      filteredTimesheets = filteredTimesheets.filter(t => t.user_id === dashConsultor)
      filteredAlocacoes = filteredAlocacoes.filter(a => a.user_id === dashConsultor)
    }
    if (dashAtividade !== 'todas') {
      filteredTimesheets = filteredTimesheets.filter(t => t.activity === dashAtividade)
      filteredAlocacoes = filteredAlocacoes.filter(a => a.atividade === dashAtividade || a.atividade === 'Orçamento Geral')
    }

    // 1. FOLHA DE PAGAMENTO (Filtra por Data Mês Engeprice)
    let prevMonth = parseInt(dashMes) - 1
    let startYear = parseInt(dashAno)
    if (prevMonth < 0) { prevMonth = 11; startYear -= 1; }
    const dataInicio = new Date(startYear, prevMonth, 25, 0, 0, 0).getTime()
    const dataFim = new Date(parseInt(dashAno), parseInt(dashMes), 24, 23, 59, 59).getTime()

    const consultoresPagamento = consultores.map(c => {
      const logsDoConsultor = filteredTimesheets.filter(t => t.user_id === c.id)
      const logsDoMes = logsDoConsultor.filter(t => {
        const d = new Date(t.start_at).getTime()
        return d >= dataInicio && d <= dataFim
      })
      const horas = logsDoMes.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
      return { ...c, horas: Number(horas.toFixed(2)) }
    }).filter(c => c.horas > 0).sort((a,b) => b.horas - a.horas)

    const maxHorasMes = Math.max(...consultoresPagamento.map(c => c.horas), 1)

    // 2. SAÚDE GLOBAL (Sem filtro de data)
    const orcadoGlobal = filteredAlocacoes.reduce((acc, curr) => acc + curr.horas_disponiveis, 0)
    const gastoGlobal = filteredTimesheets.reduce((acc, curr) => acc + (new Date(curr.end_at!).getTime() - new Date(curr.start_at).getTime()) / 3600000, 0)
    
    const saldoGlobal = Number((orcadoGlobal - gastoGlobal).toFixed(2))
    const percentualGlobal = orcadoGlobal > 0 ? ((gastoGlobal / orcadoGlobal) * 100).toFixed(1) : '0'

    return { 
      consultoresPagamento, maxHorasMes, 
      orcadoGlobal, gastoGlobal: Number(gastoGlobal.toFixed(2)), saldoGlobal, percentualGlobal 
    }
  }, [allTimesheets, allAlocacoes, dashMes, dashAno, dashContratosSelecionados, dashConsultor, dashAtividade, consultores])

  // A VARIÁVEL QUE RESOLVE O BUG DO MENU FECHANDO:
  // Como ela está declarada diretamente como JSX em vez de um componente isolado, o React não destrói ela ao clicar.
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

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
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

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[800px] mb-6">
          <TabsTrigger value="contratos">Gerir Contratos</TabsTrigger>
          <TabsTrigger value="alocacoes">Alocação</TabsTrigger>
          <TabsTrigger value="dash-mensal" className="gap-2"><CalendarDays className="w-4 h-4" /> Folha (Mensal)</TabsTrigger>
          <TabsTrigger value="dash-global" className="gap-2"><Layers className="w-4 h-4" /> Saúde (Global)</TabsTrigger>
        </TabsList>

        {/* ABA 1: CONTRATOS */}
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
                  <Input placeholder="Ex: CT-999" className="w-48 uppercase" value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Nome descritivo do contrato</Label>
                  <Input placeholder="Nome descritivo do contrato" value={novoNomeContrato} onChange={(e) => setNovoNomeContrato(e.target.value)} />
                </div>
                <Button className="gap-2" onClick={criarNovoContrato}><PlusCircle className="w-4 h-4" /> Cadastrar Projeto</Button>
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
                          <Button size="icon" variant="ghost" className="text-green-500 hover:text-green-600 hover:bg-green-500/10" onClick={() => salvarEdicaoContrato(c.id)}><Check className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => setEditandoId(null)}><X className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <Briefcase className="text-primary w-5 h-5 shrink-0" />
                          <div><p className="font-bold tracking-wide">{c.codigo}</p><p className="text-sm text-muted-foreground">{c.nome}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.status_ativo ? <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 mr-2">Ativo</Badge> : <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 mr-2">Inativo</Badge>}
                          <Button variant="outline" size="sm" onClick={() => iniciarEdicao(c)} className="gap-2"><Pencil className="w-4 h-4" /> Editar</Button>
                          <Button variant="ghost" size="icon" onClick={() => excluirContrato(c.id, c.nome)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 ml-2"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: ALOCAÇÕES */}
        <TabsContent value="alocacoes">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader className="pb-4"><CardTitle className="text-lg">1. Contrato Ativo</CardTitle></CardHeader>
                <CardContent>
                  <Select value={contratoAtivo} onValueChange={(val) => { setContratoAtivo(val); setAlocacoes({}); }}>
                    <SelectTrigger><SelectValue placeholder="Escolha uma obra..." /></SelectTrigger>
                    <SelectContent>{contratos.filter(c => c.status_ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card className={!contratoAtivo ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader className="pb-4"><CardTitle className="text-lg">2. Equipe</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-[350px] overflow-y-auto">
                  {consultores.map(user => {
                    const jaAlocado = !!alocacoes[user.id]
                    return (
                      <div key={user.id} onClick={() => adicionarConsultorAoContrato(user.id)} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${jaAlocado ? 'bg-muted opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}>
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
                  {contratoAtivo && <Button onClick={salvarAlocacoesNoBanco} disabled={salvando} className="gap-2 shadow-md">{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Gravar Alocações</Button>}
                </CardHeader>
                <CardContent className="space-y-6 flex-1">
                  {carregandoAlocacoes ? (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mb-4" /><p>Lendo matriz do banco...</p></div>
                  ) : Object.values(alocacoes).length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg"><p>Nenhum engenheiro alocado na matriz.</p></div>
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
                              <Input type="number" value={alocacao.horasTotais || ''} onChange={(e) => atualizarHorasTotais(alocacao.consultorId, Number(e.target.value))} className="w-28 pl-9 pr-8 font-medium" />
                              <span className="absolute right-3 text-sm text-muted-foreground pointer-events-none">h</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removerConsultor(alocacao.consultorId)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        <div className="pl-4 border-l-2 border-primary/20 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-muted-foreground">Disciplinas Específicas</span>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => adicionarAtividade(alocacao.consultorId)}><PlusCircle className="w-3 h-3" /> Adicionar</Button>
                          </div>
                          {alocacao.atividades.map(atividade => (
                            <div key={atividade.id} className="flex gap-3 items-center bg-muted/30 p-2 rounded-md">
                              <Input disabled value={atividade.nome} className="h-8 flex-1 bg-transparent border-none font-medium" />
                              <div className="relative flex items-center w-32">
                                <Clock className="absolute left-2.5 w-3 h-3 text-muted-foreground pointer-events-none" />
                                <Input type="number" className="h-8 pl-8 pr-6" value={atividade.horas || ''} onChange={(e) => atualizarHorasAtividade(alocacao.consultorId, atividade.id, Number(e.target.value))} />
                                <span className="absolute right-2 text-xs text-muted-foreground pointer-events-none">h</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => removerAtividade(alocacao.consultorId, atividade.id, atividade.dbId)}><X className="w-4 h-4" /></Button>
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
        {/* ABA 3: FOLHA DE PAGAMENTO (DASHBOARD MENSAL COM DATA) */}
        {/* ============================================================================== */}
        <TabsContent value="dash-mensal">
          <Card className="border-t-4 border-t-blue-500 min-h-[600px]">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Folha de Pagamento (Ciclo Mensal)</CardTitle>
                  <CardDescription>Horas extraídas de 25 do mês ant. a 24 do mês atual.</CardDescription>
                </div>
                
                <div className="flex flex-wrap gap-3 p-4 bg-background border rounded-lg shadow-sm">
                  <div className="space-y-1">
                    <Label className="text-xs">Mês Ref.</Label>
                    <div className="flex gap-1">
                      <Select value={dashMes} onValueChange={setDashMes}>
                        <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{MESES_NOME.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={dashAno} onValueChange={setDashAno}>
                        <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1 w-64">
                    <Label className="text-xs">Filtros de Contrato</Label>
                    {renderFiltroContratosMultiplos}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Consultor</Label>
                    <Select value={dashConsultor} onValueChange={setDashConsultor}>
                      <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos da Obra</SelectItem>
                        {consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                <div className="space-y-6 max-w-4xl mx-auto">
                  {dashData.consultoresPagamento.map(c => (
                    <div key={c.id} className="space-y-2 group">
                      <div className="flex items-center justify-between text-sm px-1">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{c.nome.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-base">{c.nome}</span>
                        </div>
                        <span className="font-bold text-lg text-primary bg-primary/10 px-3 py-1 rounded-md">{c.horas}h trabalhadas</span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner relative">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 group-hover:bg-blue-400" 
                             style={{ width: `${(c.horas / dashData.maxHorasMes) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================================== */}
        {/* ABA 4: SAÚDE GLOBAL (SEM FILTRO DE DATA MENSAL) */}
        {/* ============================================================================== */}
        <TabsContent value="dash-global">
          <Card className="border-t-4 border-t-amber-500 min-h-[600px]">
            <CardHeader className="bg-muted/10 border-b pb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Saúde Financeira e Orçamento (Global)</CardTitle>
                  <CardDescription>Histórico integral: Horas orçadas vs Consumidas de todo o período.</CardDescription>
                </div>
                
                <div className="flex flex-wrap gap-3 p-4 bg-background border rounded-lg shadow-sm">
                  <div className="space-y-1 w-64">
                    <Label className="text-xs">Filtros de Contrato</Label>
                    {renderFiltroContratosMultiplos}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Consultor</Label>
                    <Select value={dashConsultor} onValueChange={setDashConsultor}>
                      <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Toda a Equipe</SelectItem>
                        {consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Disciplina / Escopo</Label>
                    <Select value={dashAtividade} onValueChange={setDashAtividade}>
                      <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Geral (Todas)</SelectItem>
                        {listaAtividadesDash.filter(Boolean).filter(a => a !== 'Orçamento Geral').map((a, i) => <SelectItem key={i} value={a as string}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-8 max-w-5xl mx-auto">
              {loadingDash ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border rounded-xl p-6 bg-muted/20 text-center shadow-sm">
                      <p className="text-sm text-muted-foreground uppercase font-bold mb-2 tracking-wider">Budget Orçado</p>
                      <p className="text-5xl font-bold">{dashData.orcadoGlobal}<span className="text-2xl text-muted-foreground">h</span></p>
                    </div>
                    
                    <div className="border rounded-xl p-6 bg-primary/5 text-center shadow-sm border-primary/20">
                      <p className="text-sm text-primary uppercase font-bold mb-2 tracking-wider">Horas Consumidas</p>
                      <p className="text-5xl font-bold text-primary">{dashData.gastoGlobal}<span className="text-2xl opacity-60">h</span></p>
                    </div>

                    <div className={`border rounded-xl p-6 text-center shadow-sm ${dashData.saldoGlobal < 0 ? 'bg-red-500/10 border-red-500/30' : dashData.saldoGlobal > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-muted'}`}>
                      <p className={`text-sm uppercase font-bold mb-2 tracking-wider ${dashData.saldoGlobal < 0 ? 'text-red-600' : dashData.saldoGlobal > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        Saldo Restante
                      </p>
                      <p className={`text-5xl font-bold tracking-tight ${dashData.saldoGlobal < 0 ? 'text-red-600' : dashData.saldoGlobal > 0 ? 'text-green-600' : 'text-foreground'}`}>
                        {dashData.saldoGlobal}<span className="text-2xl opacity-60">h</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 p-6 border rounded-xl bg-card shadow-sm">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-lg font-semibold text-muted-foreground">Progresso Global do Budget</span>
                      <span className={`text-3xl font-bold ${Number(dashData.percentualGlobal) > 100 ? 'text-red-500' : 'text-primary'}`}>
                        {dashData.percentualGlobal}%
                      </span>
                    </div>
                    
                    {/* BARRA DE PROGRESSO GLOBAL FLUIDA E ANIMADA */}
                    <div className="w-full h-8 bg-muted rounded-full overflow-hidden shadow-inner relative">
                      <div 
                        className={`h-full transition-all duration-1000 ${Number(dashData.percentualGlobal) > 100 ? 'bg-red-500' : 'bg-primary'}`} 
                        style={{ width: `${Math.min(Number(dashData.percentualGlobal), 100)}%` }}
                      />
                    </div>
                    {dashData.saldoGlobal < 0 && <p className="text-sm text-red-600 mt-2 font-bold text-center">⚠️ Atenção: Os contratos selecionados ultrapassaram o teto orçamentário!</p>}
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