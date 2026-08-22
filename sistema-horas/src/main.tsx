import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3, CheckCircle2, Clock3, Filter, History, LayoutDashboard,
  Plus, Search, Trash2, Users, X, Clipboard, CalendarDays, LogOut,
  UserPlus, ShieldCheck, Building2, Menu, LockKeyhole, Mail, Eye, EyeOff,
  AlertCircle, RefreshCw
} from 'lucide-react';

type Role = 'ADMIN' | 'INTERNO' | 'CLIENTE';
type Status = 'Aguardando análise' | 'Em análise' | 'Aguardando aprovação' | 'Em desenvolvimento' | 'Em homologação' | 'Concluída' | 'Reprovada';
type Priority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

type AuthUser = { id:number; name:string; email:string; role:Role; clientId:number|null };
type Client = { id:number; name:string; email?:string; active?:number|boolean };
type DashboardSummary = {
  totalDemands:number; totalHours:number; analysisHours:number; requiredHours:number;
  approvedDemands:number; rejectedDemands:number; pendingApproval:number;
  byStatus:Record<string,number>;
  byClient:Array<{
    clientId:number; clientName:string; totalDemands:number; analysisHours:number;
    requiredHours:number; totalHours:number; approvedDemands:number; rejectedDemands:number; pendingApproval:number;
  }>;
};
type User = { id:number; name:string; email:string; role:Role; clientId:number|null; clientName?:string|null; active:number|boolean };

type HistoryItem = { id:string; date:string; user:string; field:string; oldValue:string; newValue:string };
type Demand = {
  id:string; numero:number; problema:string; tratamento:string; horasAnalise:number; horasNecessarias:number;
  prioridade:Priority; status:Status; aprovacao:'Pendente'|'Aprovada'|'Reprovada'; aprovadoPor:string;
  aprovadoEm:string; pago:boolean; responsavel:string; criadoEm:string; history:HistoryItem[];
};

const API = 'http://localhost:3001/api';
const statuses:Status[] = ['Aguardando análise','Em análise','Aguardando aprovação','Em desenvolvimento','Em homologação','Concluída','Reprovada'];
const priorities:Priority[] = ['Baixa','Média','Alta','Urgente'];
const uid = () => crypto.randomUUID();

const initialDemands:Demand[] = [
  {id:'1',numero:1,problema:'Erro no cadastro de usuário',tratamento:'Corrigir validação da API',horasAnalise:2,horasNecessarias:8,prioridade:'Alta',status:'Em desenvolvimento',aprovacao:'Aprovada',aprovadoPor:'Victória',aprovadoEm:'20/08/2026 10:30',pago:true,responsavel:'Gabriel',criadoEm:'2026-08-18',history:[]},
  {id:'2',numero:2,problema:'Filtro de documentos não funciona',tratamento:'Ajustar filtros do backoffice',horasAnalise:1,horasNecessarias:4,prioridade:'Média',status:'Em homologação',aprovacao:'Aprovada',aprovadoPor:'Victória',aprovadoEm:'20/08/2026 11:10',pago:false,responsavel:'Lucas',criadoEm:'2026-08-19',history:[]},
  {id:'3',numero:3,problema:'Relatório não apresenta documentos vencidos',tratamento:'Adicionar status ao relatório',horasAnalise:3,horasNecessarias:6,prioridade:'Alta',status:'Aguardando aprovação',aprovacao:'Pendente',aprovadoPor:'',aprovadoEm:'',pago:false,responsavel:'Amanda',criadoEm:'2026-08-20',history:[]}
];

function normalizeDemand(raw:any):Demand {
  return {
    id:String(raw.id), numero:Number(raw.number ?? raw.numero ?? 0), problema:raw.problem ?? raw.problema ?? '',
    tratamento:raw.treatment ?? raw.tratamento ?? '', horasAnalise:Number(raw.analysisHours ?? raw.analysis_hours ?? raw.horasAnalise ?? 0),
    horasNecessarias:Number(raw.requiredHours ?? raw.required_hours ?? raw.horasNecessarias ?? 0), prioridade:raw.priority ?? raw.prioridade ?? 'Média',
    status:raw.status ?? 'Pendente', aprovacao:raw.approval ?? raw.aprovacao ?? 'Pendente', aprovadoPor:raw.approvedBy ?? raw.approved_by ?? '',
    aprovadoEm:raw.approvedAt ?? raw.approved_at ?? '', pago:Boolean(raw.paid ?? raw.paid), responsavel:raw.responsible ?? raw.responsavel ?? '',
    criadoEm:(raw.createdAt ?? raw.created_at ?? new Date().toISOString()).slice(0,10), history:raw.history ?? []
  };
}

function App(){
  const [token,setToken]=useState<string|null>(()=>localStorage.getItem('horaflow-token'));
  const [user,setUser]=useState<AuthUser|null>(()=>{try{return JSON.parse(localStorage.getItem('horaflow-user')||'null')}catch{return null}});
  const [loginEmail,setLoginEmail]=useState('');
  const [loginPassword,setLoginPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [loginLoading,setLoginLoading]=useState(false);
  const [loginError,setLoginError]=useState('');

  const [tab,setTab]=useState<'dashboard'|'demandas'|'usuarios'|'clientes'>('dashboard');
  const [demands,setDemands]=useState<Demand[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [clients,setClients]=useState<Client[]>([]);
  const [dashboard,setDashboard]=useState<DashboardSummary>({
    totalDemands:0,totalHours:0,analysisHours:0,requiredHours:0,
    approvedDemands:0,rejectedDemands:0,pendingApproval:0,byStatus:{},byClient:[]
  });
  const [dashboardLoading,setDashboardLoading]=useState(false);
  const [clientFilter,setClientFilter]=useState('Todos');
  const [loading,setLoading]=useState(false);
  const [apiError,setApiError]=useState('');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('Todos');
  const [priorityFilter,setPriorityFilter]=useState('Todas');
  const [period,setPeriod]=useState('Todos');
  const [historyDemand,setHistoryDemand]=useState<Demand|null>(null);
  const [copied,setCopied]=useState(false);
  const [mobileMenu,setMobileMenu]=useState(false);

  const [userModal,setUserModal]=useState(false);
  const [userSaving,setUserSaving]=useState(false);
  const [userError,setUserError]=useState('');
  const [newUser,setNewUser]=useState({name:'',email:'',password:'',role:'INTERNO' as Role,clientId:''});

  const [clientModal,setClientModal]=useState(false);
  const [clientSaving,setClientSaving]=useState(false);
  const [clientError,setClientError]=useState('');
  const [editingClient,setEditingClient]=useState<Client|null>(null);
  const [clientForm,setClientForm]=useState({name:'',email:''});

  const [demandModal,setDemandModal]=useState(false);
  const [demandSaving,setDemandSaving]=useState(false);
  const [demandError,setDemandError]=useState('');
  const [editingDemand,setEditingDemand]=useState<Demand|null>(null);
  const [demandForm,setDemandForm]=useState<any>({
    problema:'',tratamento:'',horasAnalise:0,horasNecessarias:0,prioridade:'Média',
    status:'Aguardando análise',clientId:'',responsavel:''
  });

  const isAdmin=user?.role==='ADMIN';
  const isInternal=user?.role==='INTERNO'||isAdmin;
  const isClient=user?.role==='CLIENTE';

  const request=async(path:string,options:RequestInit={})=>{
    const headers=new Headers(options.headers||{});
    headers.set('Content-Type','application/json');
    if(token)headers.set('Authorization',`Bearer ${token}`);
    const response=await fetch(`${API}${path}`,{...options,headers});
    const data=await response.json().catch(()=>({success:false,message:'Resposta inválida do servidor.'}));
    if(!response.ok||data.success===false)throw new Error(data.message||'Erro na API.');
    return data;
  };

  const login=async(e?:React.FormEvent)=>{
    e?.preventDefault();setLoginError('');setLoginLoading(true);
    try{
      const response=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:loginEmail.trim(),password:loginPassword})});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'E-mail ou senha inválidos.');
      localStorage.setItem('horaflow-token',data.data.token);
      localStorage.setItem('horaflow-user',JSON.stringify(data.data.user));
      setToken(data.data.token);setUser(data.data.user);setLoginPassword('');
    }catch(error:any){setLoginError(error.message||'Não foi possível entrar.')}
    finally{setLoginLoading(false)}
  };

  const logout=()=>{localStorage.removeItem('horaflow-token');localStorage.removeItem('horaflow-user');setToken(null);setUser(null);setTab('dashboard')};

  const loadDemands=async()=>{
    try{setLoading(true);setApiError('');const data=await request('/demands');setDemands((data.data||[]).map((d:any)=>({...normalizeDemand(d),clientId:d.clientId??d.client_id??null,clientName:d.clientName??d.client_name??''})));}
    catch(error:any){setApiError(error.message)}
    finally{setLoading(false)}
  };

  const loadDashboard=async(clientIdOverride?:string)=>{
    try{
      setDashboardLoading(true);
      const selected = isAdmin
        ? (clientIdOverride ?? clientFilter)
        : '';
      const query = isAdmin && selected && selected!=='Todos'
        ? `?clientId=${encodeURIComponent(selected)}`
        : '';
      const data=await request(`/dashboard${query}`);
      const d=data.data||{};
      setDashboard({
        totalDemands:Number(d.totalDemands||0),
        totalHours:Number(d.totalHours||0),
        analysisHours:Number(d.analysisHours||0),
        requiredHours:Number(d.requiredHours||0),
        approvedDemands:Number(d.approvedDemands||0),
        rejectedDemands:Number(d.rejectedDemands||0),
        pendingApproval:Number(d.pendingApproval||0),
        byStatus:d.byStatus||{},
        byClient:d.byClient||[]
      });
    }catch(error:any){
      setApiError(error.message||'Não foi possível carregar o dashboard.');
    }finally{setDashboardLoading(false)}
  };

  const loadUsers=async()=>{
    if(!isAdmin)return;
    try{const data=await request('/users');setUsers(data.data||[])}
    catch(error:any){setUserError(error.message)}
  };

  const loadClients=async()=>{
    try{const data=await request('/clients');setClients(data.data||[])}
    catch(error:any){setClients([]);setApiError(error.message||'Não foi possível carregar os clientes.')}
  };

  useEffect(()=>{
    if(token){
      loadDemands();
      loadDashboard();
      if(isAdmin)loadClients();
    }
  },[token,isAdmin]);

  useEffect(()=>{
    if(token&&tab==='dashboard')loadDashboard(clientFilter);
  },[clientFilter]);
  useEffect(()=>{if(token&&tab==='usuarios'&&isAdmin)loadUsers()},[tab,token,isAdmin]);

  const updateLocal=(id:string,field:keyof Demand,value:unknown)=>{
    setDemands(current=>current.map(d=>{
      if(d.id!==id)return d;
      const oldValue=String(d[field]??'');const newValue=String(value??'');
      if(oldValue===newValue)return d;
      return {...d,[field]:value,history:[{id:uid(),date:new Date().toLocaleString('pt-BR'),user:user?.name||'Usuário atual',field:String(field),oldValue,newValue},...(d.history||[])]};
    }))
  };

  const saveDemandField=async(id:string,field:keyof Demand,value:unknown)=>{
    if(isClient && field!=='prioridade')return;
    updateLocal(id,field,value);
    try{
      await request(`/demands/${id}`,{method:'PUT',body:JSON.stringify({
        [field==='problema'?'problem':field==='tratamento'?'treatment':field==='horasAnalise'?'analysisHours':field==='horasNecessarias'?'requiredHours':field==='prioridade'?'priority':field==='status'?'status':field==='responsavel'?'responsible':field]:value
      })});
    }catch(error:any){setApiError(error.message);loadDemands()}
  };

  const emptyDemand=()=>({
    problema:'',tratamento:'',horasAnalise:0,horasNecessarias:0,prioridade:'Média',
    status:'Aguardando análise',clientId:isClient?String(user?.clientId||''):'',responsavel:''
  });

  const openNewDemand=()=>{
    if(!isInternal)return;
    setDemandError('');setEditingDemand(null);setDemandForm(emptyDemand());setDemandModal(true);
  };

  const openEditDemand=(d:Demand)=>{
    if(!isInternal)return;
    setDemandError('');setEditingDemand(d);
    setDemandForm({
      problema:d.problema,tratamento:d.tratamento,horasAnalise:d.horasAnalise,
      horasNecessarias:d.horasNecessarias,prioridade:d.prioridade,status:d.status,
      clientId:String((d as any).clientId||''),responsavel:d.responsavel
    });
    setDemandModal(true);
  };

  const saveDemand=async(e:React.FormEvent)=>{
    e.preventDefault();setDemandError('');
    if(!demandForm.problema.trim()||!demandForm.tratamento.trim()){setDemandError('Informe o problema e o tratamento.');return}
    if(isInternal&&!demandForm.clientId){setDemandError('Selecione o cliente vinculado.');return}
    try{
      setDemandSaving(true);
      const payload={
        problem:demandForm.problema.trim(),treatment:demandForm.tratamento.trim(),
        analysisHours:Number(demandForm.horasAnalise)||0,requiredHours:Number(demandForm.horasNecessarias)||0,
        priority:demandForm.prioridade,status:demandForm.status,
        clientId:Number(demandForm.clientId),responsible:demandForm.responsavel||''
      };
      if(editingDemand)await request(`/demands/${editingDemand.id}`,{method:'PUT',body:JSON.stringify(payload)});
      else await request('/demands',{method:'POST',body:JSON.stringify(payload)});
      setDemandModal(false);setDemandForm(emptyDemand());await loadDemands();
    }catch(error:any){setDemandError(error.message||'Não foi possível salvar a demanda.')}
    finally{setDemandSaving(false)}
  };

  const removeDemand=async(id:string)=>{
    if(!isInternal)return;
    if(!confirm('Excluir esta demanda?'))return;
    try{await request(`/demands/${id}`,{method:'DELETE'});await loadDemands()}
    catch(error:any){setApiError(error.message)}
  };

  const approve=async(d:Demand,approved=true)=>{
    if(!isAdmin&&!isClient)return;
    try{
      await request(`/demands/${d.id}/approval`,{method:'PUT',body:JSON.stringify({approval:approved?'Aprovada':'Reprovada'})});
      await loadDemands();
    }catch(error:any){
      // fallback para APIs que atualizam a própria demanda
      try{await request(`/demands/${d.id}`,{method:'PUT',body:JSON.stringify({approval:approved?'Aprovada':'Reprovada'})});await loadDemands()}
      catch(e:any){setApiError(e.message||error.message)}
    }
  };

  const filtered=useMemo(()=>demands.filter(d=>{
    const text=`${d.numero} ${d.problema} ${d.tratamento} ${d.responsavel}`.toLowerCase();
    const matchesClient = clientFilter==='Todos' || String((d as any).clientId||'')===String(clientFilter);
    return text.includes(search.toLowerCase())&&matchesClient&&(statusFilter==='Todos'||d.status===statusFilter)&&(priorityFilter==='Todas'||d.prioridade===priorityFilter)&&(period==='Todos'||d.criadoEm.startsWith(period));
  }),[demands,search,statusFilter,priorityFilter,period]);

  const totalAnalysis=filtered.reduce((s,d)=>s+d.horasAnalise,0);
  const totalNeeded=filtered.reduce((s,d)=>s+d.horasNecessarias,0);
  const totalHours=totalAnalysis+totalNeeded;
  const paidCount=filtered.filter(d=>d.pago).length;
  const approvedCount=filtered.filter(d=>d.aprovacao==='Aprovada').length;
  const countStatus=(s:Status)=>filtered.filter(d=>d.status===s).length;

  const emptyUser=()=>({name:'',email:'',password:'',role:'INTERNO' as Role,clientId:''});
  const openUserModal=()=>{setUserError('');setNewUser(emptyUser());setUserModal(true)};
  const closeUserModal=()=>{setUserError('');setNewUser(emptyUser());setUserModal(false)};

  const saveUser=async(e:React.FormEvent)=>{
    e.preventDefault();setUserError('');
    if(!newUser.name.trim()||!newUser.email.trim()||!newUser.password){setUserError('Preencha nome, e-mail e senha.');return}
    if(newUser.role==='CLIENTE'&&!newUser.clientId){setUserError('Selecione o cliente vinculado.');return}
    try{
      setUserSaving(true);
      await request('/users',{method:'POST',body:JSON.stringify({
        name:newUser.name.trim(),email:newUser.email.trim(),password:newUser.password,
        role:newUser.role,clientId:newUser.role==='CLIENTE'?Number(newUser.clientId):null
      })});
      closeUserModal();await loadUsers();
    }catch(error:any){setUserError(error.message||'Não foi possível cadastrar o usuário.')}
    finally{setUserSaving(false)}
  };

  const openClientModal=(client?:Client)=>{
    setClientError('');setEditingClient(client||null);
    setClientForm({name:client?.name||'',email:client?.email||''});setClientModal(true);
  };

  const saveClient=async(e:React.FormEvent)=>{
    e.preventDefault();setClientError('');
    if(!clientForm.name.trim()){setClientError('Informe o nome da empresa/cliente.');return}
    try{
      setClientSaving(true);
      if(editingClient)await request(`/clients/${editingClient.id}`,{method:'PUT',body:JSON.stringify(clientForm)});
      else await request('/clients',{method:'POST',body:JSON.stringify(clientForm)});
      setClientModal(false);setEditingClient(null);setClientForm({name:'',email:''});await loadClients();
    }catch(error:any){setClientError(error.message||'Não foi possível salvar o cliente.')}
    finally{setClientSaving(false)}
  };

  const copyTable=async()=>{
    const header=['Nº','Cliente','Problema','Tratamento','Análise','Horas necessárias','Prioridade','Status','Aprovação','Aprovado por','Responsável','Pago'];
    const rows=filtered.map(d=>[d.numero,(d as any).clientName||'',d.problema,d.tratamento,d.horasAnalise,d.horasNecessarias,d.prioridade,d.status,d.aprovacao,d.aprovadoPor,d.responsavel,d.pago?'Sim':'Não']);
    await navigator.clipboard.writeText([header,...rows].map(r=>r.join('\t')).join('\n'));setCopied(true);setTimeout(()=>setCopied(false),1600);
  };

  if(!token||!user)return <LoginScreen email={loginEmail} password={loginPassword} setEmail={setLoginEmail} setPassword={setLoginPassword} showPassword={showPassword} setShowPassword={setShowPassword} loading={loginLoading} error={loginError} onSubmit={login}/>;

  return <div className="hf-app">
    <style>{styles}</style>
    {mobileMenu&&<div className="hf-overlay" onClick={()=>setMobileMenu(false)}/>}
    <aside className={`hf-sidebar ${mobileMenu?'open':''}`}>
      <div className="hf-brand"><div className="hf-logo">H</div><div><strong>HoraFlow</strong><span>Gestão de demandas</span></div></div>
      <nav>
        <Nav active={tab==='dashboard'} icon={<LayoutDashboard size={18}/>} text="Dashboard" onClick={()=>{setTab('dashboard');setMobileMenu(false)}}/>
        <Nav active={tab==='demandas'} icon={<BarChart3 size={18}/>} text="Demandas" onClick={()=>{setTab('demandas');setMobileMenu(false)}}/>
        {(isAdmin||isInternal)&&<Nav active={tab==='clientes'} icon={<Building2 size={18}/>} text="Clientes" onClick={()=>{setTab('clientes');setMobileMenu(false)}}/>}
        <Nav active={tab==='usuarios'} icon={<Users size={18}/>} text="Usuários" onClick={()=>{if(isAdmin){setTab('usuarios');setMobileMenu(false)}}} disabled={!isAdmin}/>
      </nav>
      <div className="hf-sidebar-bottom"><div className="hf-user-mini"><div className="hf-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{roleLabel(user.role)}</span></div></div><button className="hf-logout" onClick={logout}><LogOut size={17}/> Sair</button></div>
    </aside>

    <main className="hf-main">
      <header className="hf-topbar">
        <button className="hf-menu" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button>
        <div><div className="hf-eyebrow">HoraFlow • Gestão</div><h1>{tab==='dashboard'?'Visão geral':tab==='demandas'?'Demandas':tab==='clientes'?'Clientes':'Usuários'}</h1><p>{tab==='usuarios'?'Cadastre usuários e controle o acesso ao sistema.':tab==='clientes'?'Gerencie empresas e vincule suas demandas.':'Acompanhe demandas, aprovações e horas desempenhadas.'}</p></div>
        <div className="hf-top-actions">{(tab==='demandas'||tab==='dashboard')&&isInternal&&<button className="hf-primary" onClick={openNewDemand}><Plus size={17}/> Nova demanda</button>}{tab==='clientes'&&isAdmin&&<button className="hf-primary" onClick={()=>openClientModal()}><Plus size={17}/> Novo cliente</button>}<div className="hf-top-avatar">{user.name.slice(0,1).toUpperCase()}</div></div>
      </header>

      {apiError&&<div className="hf-alert"><AlertCircle size={18}/><span>{apiError}</span><button onClick={()=>{setApiError('');loadDemands();loadClients()}}><RefreshCw size={16}/></button></div>}

      {tab==='usuarios'&&<UsersPage users={users} clients={clients} loading={loading} onNew={openUserModal} onRefresh={loadUsers} isAdmin={isAdmin}/>}
      {tab==='clientes'&&<ClientsPage clients={clients} demands={demands} isAdmin={isAdmin} onNew={()=>openClientModal()} onEdit={openClientModal} onDemand={openEditDemand}/>}
      {(tab==='dashboard'||tab==='demandas')&&<>
        <section className="hf-filters"><div className="hf-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nº, problema, tratamento ou responsável..."/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>Todos</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}><option>Todas</option>{priorities.map(p=><option key={p}>{p}</option>)}</select>{isAdmin&&<select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option value="Todos">Todos os clientes</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="Todos">Todos os períodos</option><option value="2026-08">Agosto/2026</option><option value="2026-07">Julho/2026</option></select><span className="hf-filter-count"><Filter size={15}/> {filtered.length} resultados</span></section>

        {tab==='dashboard'?<>
          <section className="hf-cards">
            <Card title="Demandas" value={dashboardLoading?'…':dashboard.totalDemands} icon={<BarChart3/>}/>
            <Card title="Horas de análise" value={dashboardLoading?'…':`${dashboard.analysisHours}h`} icon={<Clock3/>}/>
            <Card title="Horas necessárias" value={dashboardLoading?'…':`${dashboard.requiredHours}h`} icon={<Clock3/>}/>
            <Card title="Horas totais" value={dashboardLoading?'…':`${dashboard.totalHours}h`} icon={<CheckCircle2/>}/>
          </section>
          <section className="hf-cards small">
            <Card title="Aprovadas" value={dashboardLoading?'…':dashboard.approvedDemands} icon={<CheckCircle2/>}/>
            <Card title="Reprovadas" value={dashboardLoading?'…':dashboard.rejectedDemands} icon={<X/>}/>
            <Card title="Aguardando aprovação" value={dashboardLoading?'…':dashboard.pendingApproval} icon={<Clock3/>}/>
            <Card title="Em desenvolvimento" value={dashboardLoading?'…':(dashboard.byStatus['Em desenvolvimento']||0)} icon={<BarChart3/>}/>
          </section>
          <section className="hf-grid2">
            <div className="hf-panel">
              <PanelTitle title="Demandas por status"/>
              <div className="hf-status-list">
                {statuses.map((s) => {
                  const count = dashboard.byStatus[s] || 0;
                  const total = dashboard.totalDemands || 0;
                  const percentage = total ? (count / total) * 100 : 0;
                  return (
                    <div className="hf-status-row" key={s}>
                      <span className={"hf-status-dot dot-" + slug(s)} />
                      <span>{s}</span>
                      <strong>{count}</strong>
                      <div className="hf-bar">
                        <i style={{ width: String(percentage) + "%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="hf-panel">
              <PanelTitle title="Resumo da empresa" icon={<CalendarDays size={18}/>}/>
              <div className="hf-big-number">{dashboard.totalHours}h</div>
              <p className="hf-muted">Horas totais da empresa selecionada</p>
              <div className="hf-mini-stats">
                <div><span>Análise</span><b>{dashboard.analysisHours}h</b></div>
                <div><span>Necessárias</span><b>{dashboard.requiredHours}h</b></div>
                <div><span>Aprovadas</span><b>{dashboard.approvedDemands}</b></div>
              </div>
            </div>
          </section>
          <section className="hf-panel"><div className="hf-panel-title"><div><h2>Últimas demandas</h2><p className="hf-muted">Acompanhe as demandas mais recentes</p></div><button className="hf-link" onClick={()=>setTab('demandas')}>Ver todas</button></div><DemandTable demands={filtered.slice(0,5)} update={saveDemandField} remove={removeDemand} approve={approve} history={setHistoryDemand} canEdit={isInternal} canApprove={isAdmin||isClient} onEdit={openEditDemand}/></section>
        </>:<section className="hf-panel"><div className="hf-panel-title"><div><h2>Planilha de demandas</h2><p className="hf-muted">{filtered.length} demandas • {totalHours}h totais</p></div><div className="hf-actions"><button className="hf-secondary" onClick={copyTable}><Clipboard size={15}/>{copied?'Copiado!':'Copiar tabela'}</button>{isInternal&&<button className="hf-primary compact" onClick={openNewDemand}><Plus size={16}/> Nova</button>}</div></div><DemandTable demands={filtered} update={saveDemandField} remove={removeDemand} approve={approve} history={setHistoryDemand} canEdit={isInternal} canApprove={isAdmin||isClient} onEdit={openEditDemand}/><div className="hf-totals"><strong>Totais</strong><span>{filtered.length} demandas</span><span>Análise: <b>{totalAnalysis}h</b></span><span>Necessárias: <b>{totalNeeded}h</b></span><span>Total: <b>{totalHours}h</b></span></div></section>}
      </>}
    </main>

    {historyDemand&&<HistoryModal demand={historyDemand} close={()=>setHistoryDemand(null)}/>}
    {userModal&&<UserModal value={newUser} setValue={setNewUser} clients={clients} error={userError} saving={userSaving} close={closeUserModal} save={saveUser}/>}
    {clientModal&&<ClientModal value={clientForm} setValue={setClientForm} editing={editingClient} error={clientError} saving={clientSaving} close={()=>setClientModal(false)} save={saveClient}/>}
    {demandModal&&<DemandModal value={demandForm} setValue={setDemandForm} clients={clients} editing={editingDemand} isClient={isClient} error={demandError} saving={demandSaving} close={()=>setDemandModal(false)} save={saveDemand}/>}
  </div>;
}

function LoginScreen({email,password,setEmail,setPassword,showPassword,setShowPassword,loading,error,onSubmit}:{email:string;password:string;setEmail:(v:string)=>void;setPassword:(v:string)=>void;showPassword:boolean;setShowPassword:(v:boolean)=>void;loading:boolean;error:string;onSubmit:(e:React.FormEvent)=>void}){
  return <div className="hf-login"><style>{styles}</style><div className="hf-login-decoration one"/><div className="hf-login-decoration two"/><div className="hf-login-card"><div className="hf-login-brand"><div className="hf-logo large">H</div><div><strong>HoraFlow</strong><span>Gestão de demandas e horas</span></div></div><div className="hf-login-copy"><h1>Bem-vinda de volta</h1><p>Entre para acompanhar suas demandas, horas e aprovações.</p></div><form onSubmit={onSubmit}><label>E-mail<div className="hf-input"><Mail size={18}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="username" required/></div></label><label>Senha<div className="hf-input"><LockKeyhole size={18}/><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" autoComplete="current-password" required/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{error&&<div className="hf-login-error"><AlertCircle size={16}/>{error}</div>}<button className="hf-login-button" disabled={loading}>{loading?'Entrando...':'Entrar'}<span>→</span></button></form><div className="hf-login-footer">Acesso seguro • HoraFlow</div></div></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
function UsersPage({users,clients,loading,onNew,onRefresh,isAdmin}:{users:User[];clients:Client[];loading:boolean;onNew:()=>void;onRefresh:()=>void;isAdmin:boolean}){
  if(!isAdmin)return <div className="hf-panel hf-empty-page"><ShieldCheck size={40}/><h2>Acesso restrito</h2><p>Apenas administradores podem gerenciar usuários.</p></div>;
  return <section className="hf-panel"><div className="hf-panel-title"><div><h2>Usuários</h2><p className="hf-muted">Cadastre pessoas e defina o nível de acesso.</p></div><div className="hf-actions"><button className="hf-secondary" onClick={onRefresh}><RefreshCw size={15}/> Atualizar</button><button className="hf-primary" onClick={onNew}><UserPlus size={17}/> Novo usuário</button></div></div>{loading?<div className="hf-loading">Carregando usuários...</div>:users.length===0?<div className="hf-empty-page"><Users size={38}/><h3>Nenhum usuário encontrado</h3><p>Comece cadastrando o primeiro usuário.</p><button className="hf-primary" onClick={onNew}><UserPlus size={16}/> Cadastrar usuário</button></div>:<div className="hf-user-grid">{users.map(u=><div className="hf-user-card" key={u.id}><div className="hf-user-card-top"><div className="hf-avatar big">{u.name.slice(0,1).toUpperCase()}</div><span className={`hf-role role-${u.role.toLowerCase()}`}>{roleLabel(u.role)}</span></div><h3>{u.name}</h3><p>{u.email}</p>{u.role==='CLIENTE'&&<div className="hf-client-tag"><Building2 size={14}/>{u.clientName||`Cliente #${u.clientId}`}</div>}<div className="hf-user-status"><span className={Boolean(u.active)?'active':''}/>{Boolean(u.active)?'Ativo':'Inativo'}</div></div>)}</div>}</section>;
}

function UserModal({value,setValue,clients,error,saving,close,save}:{value:any;setValue:(v:any)=>void;clients:Client[];error:string;saving:boolean;close:()=>void;save:(e:React.FormEvent)=>void}){
  const [showPassword,setShowPassword]=useState(false);

  useEffect(()=>{setShowPassword(false)},[value.name,value.email]);

  return <div className="hf-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <div className="hf-modal user-modal">
      <div className="hf-modal-head">
        <div><span className="hf-eyebrow">Controle de acesso</span><h2>Novo usuário</h2><p>Cadastre o acesso e defina o perfil da pessoa.</p></div>
        <button type="button" onClick={close}><X size={20}/></button>
      </div>
      <form onSubmit={save} className="hf-form">
        <label>Nome
          <input value={value.name} onChange={e=>setValue({...value,name:e.target.value})} placeholder="Nome completo" autoComplete="off"/>
        </label>
        <label>E-mail
          <input type="email" value={value.email} onChange={e=>setValue({...value,email:e.target.value})} placeholder="email@empresa.com" autoComplete="off"/>
        </label>
        <label>Senha
          <div className="hf-password-field">
            <input type={showPassword?'text':'password'} value={value.password} onChange={e=>setValue({...value,password:e.target.value})} placeholder="Senha de acesso" autoComplete="new-password"/>
            <button type="button" className="hf-password-toggle" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Ocultar senha':'Visualizar senha'}>
              {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
            </button>
          </div>
        </label>
        <label>Perfil
          <select value={value.role} onChange={e=>setValue({...value,role:e.target.value,clientId:e.target.value==='CLIENTE'?value.clientId:''})}>
            <option value="INTERNO">Interno</option>
            <option value="CLIENTE">Cliente</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        {value.role==='CLIENTE'&&<label>Cliente vinculado
          <select value={value.clientId} onChange={e=>setValue({...value,clientId:e.target.value})}>
            <option value="">Selecione o cliente</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>}
        {error&&<div className="hf-login-error"><AlertCircle size={16}/>{error}</div>}
        <div className="hf-form-actions">
          <button type="button" className="hf-secondary" onClick={close}>Cancelar</button>
          <button className="hf-primary" disabled={saving}>{saving?'Salvando...':'Cadastrar usuário'}</button>
        </div>
      </form>
    </div>
  </div>
}

function Nav({active,icon,text,onClick,disabled}:{active:boolean;icon:React.ReactNode;text:string;onClick:()=>void;disabled?:boolean}){return <button disabled={disabled} className={`hf-nav ${active?'active':''} ${disabled?'disabled':''}`} onClick={onClick}>{icon}<span>{text}</span></button>}
function PanelTitle({title,icon}:{title:string;icon?:React.ReactNode}){return <div className="hf-panel-title"><h2>{title}</h2>{icon}</div>}
function Card({title,value,icon}:{title:string;value:string|number;icon:React.ReactNode}){return <div className="hf-card"><div className="hf-card-icon">{icon}</div><span>{title}</span><strong>{value}</strong></div>}
function slug(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll(' ','-')}
function roleLabel(r:Role){return r==='ADMIN'?'Administrador':r==='INTERNO'?'Interno':'Cliente'}

function DemandTable({demands,update,remove,approve,history,canEdit,canApprove,onEdit}:{demands:Demand[];update:(id:string,f:keyof Demand,v:unknown)=>void;remove:(id:string)=>void;approve:(d:Demand,approved?:boolean)=>void;history:(d:Demand)=>void;canEdit:boolean;canApprove:boolean;onEdit:(d:Demand)=>void}){
  return <div className="hf-table-wrap"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Problema</th><th>Tratamento</th><th>Análise</th><th>Horas necessárias</th><th>Prioridade</th><th>Status</th><th>Aprovação</th><th>Responsável</th><th>Pago</th><th>Histórico</th><th></th></tr></thead><tbody>{demands.map(d=><tr key={d.id}>
    <td className="number">#{String(d.numero).padStart(3,'0')}</td>
    <td><span className="hf-client-cell">{(d as any).clientName||'—'}</span></td>
    <td>{canEdit?<input value={d.problema} onChange={e=>update(d.id,'problema',e.target.value)} placeholder="Problema"/>:<span>{d.problema}</span>}</td>
    <td>{canEdit?<input value={d.tratamento} onChange={e=>update(d.id,'tratamento',e.target.value)} placeholder="Tratamento"/>:<span>{d.tratamento}</span>}</td>
    <td>{canEdit?<input className="hours" type="number" min="0" step="0.5" value={d.horasAnalise} onChange={e=>update(d.id,'horasAnalise',Number(e.target.value))}/>:d.horasAnalise}</td>
    <td>{canEdit?<input className="hours" type="number" min="0" step="0.5" value={d.horasNecessarias} onChange={e=>update(d.id,'horasNecessarias',Number(e.target.value))}/>:d.horasNecessarias}</td>
    <td>{canEdit||canApprove?<select className={`hf-select-${slug(d.prioridade)}`} value={d.prioridade} onChange={e=>update(d.id,'prioridade',e.target.value)}>{priorities.map(p=><option key={p}>{p}</option>)}</select>:d.prioridade}</td>
    <td>{canEdit?<select value={d.status} onChange={e=>update(d.id,'status',e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select>:d.status}</td>
    <td>{d.aprovacao==='Aprovada'?<span className="hf-pill approved">Aprovada</span>:d.aprovacao==='Reprovada'?<span className="hf-pill rejected">Reprovada</span>:canApprove?<div className="hf-approval-actions"><button className="hf-approve" onClick={()=>approve(d,true)}>Aprovar</button><button className="hf-reject" onClick={()=>approve(d,false)}>Reprovar</button></div>:<span className="hf-muted">Pendente</span>}</td>
    <td>{canEdit?<input value={d.responsavel} onChange={e=>update(d.id,'responsavel',e.target.value)} placeholder="Responsável"/>:(d.responsavel||'—')}</td>
    <td>{canEdit?<button className={`hf-toggle ${d.pago?'on':''}`} onClick={()=>update(d.id,'pago',!d.pago)}>{d.pago?'Sim':'Não'}</button>:(d.pago?'Sim':'Não')}</td>
    <td><button className="hf-icon-btn" onClick={()=>history(d)}><History size={16}/></button></td>
    <td>{canEdit&&<><button className="hf-icon-btn" onClick={()=>onEdit(d)} title="Editar"><Clipboard size={15}/></button><button className="hf-icon-btn danger" onClick={()=>remove(d.id)} title="Excluir"><Trash2 size={16}/></button></>}</td>
  </tr>)}</tbody></table>{!demands.length&&<div className="hf-empty"><Search size={28}/><strong>Nenhuma demanda encontrada</strong><span>Ajuste os filtros ou crie uma nova demanda.</span></div>}</div>
}

function ClientsPage({clients,demands,isAdmin,onNew,onEdit,onDemand}:{clients:Client[];demands:Demand[];isAdmin:boolean;onNew:()=>void;onEdit:(c:Client)=>void;onDemand:(d:Demand)=>void}){
  return <section className="hf-panel"><div className="hf-panel-title"><div><h2>Clientes / Empresas</h2><p className="hf-muted">Empresas cadastradas no HoraFlow e suas demandas vinculadas.</p></div>{isAdmin&&<button className="hf-primary" onClick={onNew}><Plus size={17}/> Novo cliente</button>}</div>
    {!clients.length?<div className="hf-empty-page"><Building2 size={40}/><h3>Nenhuma empresa cadastrada</h3><p>Cadastre a primeira empresa para poder vincular usuários e demandas.</p>{isAdmin&&<button className="hf-primary" onClick={onNew}><Plus size={16}/> Cadastrar empresa</button>}</div>:
    <div className="hf-client-grid">{clients.map(c=>{const cd=demands.filter(d=>String((d as any).clientId||'')===String(c.id));return <div className="hf-client-card" key={c.id}>
      <div className="hf-client-card-head"><div className="hf-client-icon"><Building2 size={20}/></div><div><h3>{c.name}</h3><p>{c.email||'Sem e-mail cadastrado'}</p></div>{isAdmin&&<button className="hf-icon-btn" onClick={()=>onEdit(c)} title="Editar cliente"><Clipboard size={15}/></button>}</div>
      <div className="hf-client-metrics"><div><b>{cd.length}</b><span>Demandas</span></div><div><b>{cd.filter(d=>d.aprovacao==='Aprovada').length}</b><span>Aprovadas</span></div></div>
      <div className="hf-client-demand-list">{cd.slice(0,3).map(d=><button key={d.id} onClick={()=>onDemand(d)}><span>#{String(d.numero).padStart(3,'0')}</span><strong>{d.problema||'Sem descrição'}</strong><small>{d.prioridade}</small></button>)}{!cd.length&&<span className="hf-muted">Nenhuma demanda vinculada.</span>}</div>
    </div>})}</div>}
  </section>
}

function ClientModal({value,setValue,editing,error,saving,close,save}:{value:{name:string;email:string};setValue:(v:any)=>void;editing:Client|null;error:string;saving:boolean;close:()=>void;save:(e:React.FormEvent)=>void}){
  return <div className="hf-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="hf-modal user-modal">
    <div className="hf-modal-head"><div><span className="hf-eyebrow">Cadastro de empresa</span><h2>{editing?'Editar cliente':'Novo cliente'}</h2><p>Cadastre a empresa que poderá receber usuários e demandas.</p></div><button onClick={close}><X size={20}/></button></div>
    <form onSubmit={save} className="hf-form"><label>Nome da empresa<input value={value.name} onChange={e=>setValue({...value,name:e.target.value})} placeholder="Ex.: ABHO" autoComplete="off"/></label><label>E-mail<input type="email" value={value.email} onChange={e=>setValue({...value,email:e.target.value})} placeholder="contato@empresa.com.br" autoComplete="off"/></label>
    {error&&<div className="hf-login-error"><AlertCircle size={16}/>{error}</div>}<div className="hf-form-actions"><button type="button" className="hf-secondary" onClick={close}>Cancelar</button><button className="hf-primary" disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Cadastrar empresa'}</button></div></form>
  </div></div>
}

function DemandModal({value,setValue,clients,editing,isClient,error,saving,close,save}:{value:any;setValue:(v:any)=>void;clients:Client[];editing:Demand|null;isClient:boolean;error:string;saving:boolean;close:()=>void;save:(e:React.FormEvent)=>void}){
  return <div className="hf-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="hf-modal">
    <div className="hf-modal-head"><div><span className="hf-eyebrow">Demanda</span><h2>{editing?'Editar demanda':'Nova demanda'}</h2><p>{isClient?'Atualize os dados permitidos da sua demanda.':'Vincule a demanda a uma empresa para organizar o atendimento.'}</p></div><button onClick={close}><X size={20}/></button></div>
    <form onSubmit={save} className="hf-form">
      <label>Cliente
        <select value={value.clientId} onChange={e=>setValue({...value,clientId:e.target.value})} disabled={isClient||Boolean(editing&&isClient)}>
          <option value="">Selecione o cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Problema<input value={value.problema} onChange={e=>setValue({...value,problema:e.target.value})} placeholder="Descreva a demanda"/></label>
      <label>Tratamento<input value={value.tratamento} onChange={e=>setValue({...value,tratamento:e.target.value})} placeholder="Como a demanda será tratada"/></label>
      <div className="hf-form-grid"><label>Horas de análise<input type="number" min="0" step="0.5" value={value.horasAnalise} onChange={e=>setValue({...value,horasAnalise:e.target.value})}/></label><label>Horas necessárias<input type="number" min="0" step="0.5" value={value.horasNecessarias} onChange={e=>setValue({...value,horasNecessarias:e.target.value})}/></label></div>
      <div className="hf-form-grid"><label>Prioridade<select value={value.prioridade} onChange={e=>setValue({...value,prioridade:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select></label><label>Status<select value={value.status} onChange={e=>setValue({...value,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label></div>
      <label>Responsável<input value={value.responsavel} onChange={e=>setValue({...value,responsavel:e.target.value})} placeholder="Responsável interno"/></label>
      {error&&<div className="hf-login-error"><AlertCircle size={16}/>{error}</div>}
      <div className="hf-form-actions"><button type="button" className="hf-secondary" onClick={close}>Cancelar</button><button className="hf-primary" disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Criar demanda'}</button></div>
    </form>
  </div></div>
}

function HistoryModal({demand,close}:{demand:Demand;close:()=>void}){return <div className="hf-modal-backdrop"><div className="hf-modal"><div className="hf-modal-head"><div><span className="hf-eyebrow">Demanda #{String(demand.numero).padStart(3,'0')}</span><h2>Histórico de alterações</h2></div><button onClick={close}><X size={20}/></button></div><div className="hf-history">{!demand.history.length?<div className="hf-empty">Nenhuma alteração registrada.</div>:demand.history.map(h=><div className="hf-history-row" key={h.id}><div className="hf-history-line"/><div><strong>{h.field}</strong><p>{h.oldValue||'—'} → <b>{h.newValue||'—'}</b></p><span>{h.user} • {h.date}</span></div></div>)}</div></div></div>}

const styles = `
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7fb;color:#172033}button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.55}
.hf-login{min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#081426 0%,#102442 55%,#eaf0f8 55%,#f4f7fb 100%);position:relative;overflow:hidden;padding:24px}.hf-login-decoration{position:absolute;border-radius:50%;filter:blur(2px)}.hf-login-decoration.one{width:420px;height:420px;background:#2e6bff22;top:-180px;right:-100px}.hf-login-decoration.two{width:300px;height:300px;background:#ffffff10;bottom:-150px;left:-80px}.hf-login-card{width:min(440px,100%);background:#fff;border:1px solid #e5eaf2;border-radius:24px;padding:36px;box-shadow:0 28px 70px #06132733;position:relative;z-index:2}.hf-login-brand,.hf-brand{display:flex;align-items:center;gap:12px}.hf-logo{width:40px;height:40px;border-radius:12px;background:#14233c;color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px}.hf-logo.large{width:52px;height:52px;border-radius:16px;font-size:24px}.hf-login-brand strong{display:block;font-size:22px}.hf-login-brand span,.hf-brand span{display:block;color:#8390a6;font-size:12px;margin-top:2px}.hf-login-copy{margin:34px 0 24px}.hf-login-copy h1{font-size:29px;margin:0 0 8px;letter-spacing:-.7px}.hf-login-copy p{margin:0;color:#7b879b;line-height:1.5}.hf-login-card form label,.hf-form label{display:block;font-size:13px;font-weight:700;color:#38445a;margin-bottom:16px}.hf-input{height:48px;margin-top:7px;border:1px solid #d9e0ea;border-radius:12px;display:flex;align-items:center;gap:10px;padding:0 13px;color:#8b96a8;background:#fbfcfe}.hf-input:focus-within{border-color:#315efb;box-shadow:0 0 0 4px #315efb14}.hf-input input{border:0;outline:0;background:transparent;width:100%;color:#172033}.hf-input button{border:0;background:transparent;color:#7d899b;display:grid;place-items:center}.hf-login-button{height:50px;width:100%;border:0;border-radius:12px;background:#14233c;color:#fff;font-weight:750;display:flex;align-items:center;justify-content:space-between;padding:0 17px;margin-top:6px;box-shadow:0 10px 22px #14233c22}.hf-login-button span{font-size:20px}.hf-login-error,.hf-alert{display:flex;align-items:center;gap:8px;background:#fff0f0;color:#c73a3a;border:1px solid #ffd2d2;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:14px}.hf-login-footer{text-align:center;color:#9aa5b6;font-size:11px;margin-top:24px}
.hf-app{min-height:100vh;display:flex}.hf-sidebar{width:240px;background:#0d1a2d;color:#cbd4e3;display:flex;flex-direction:column;padding:22px 14px;position:fixed;inset:0 auto 0 0;z-index:20}.hf-brand{padding:4px 10px 28px}.hf-brand strong{display:block;color:#fff;font-size:18px}.hf-sidebar nav{display:grid;gap:6px}.hf-nav{border:0;background:transparent;color:#aeb9ca;display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;text-align:left}.hf-nav:hover,.hf-nav.active{background:#ffffff0e;color:#fff}.hf-nav.active{box-shadow:inset 3px 0 #4d79ff}.hf-nav.disabled{color:#56647a}.hf-sidebar-bottom{margin-top:auto;border-top:1px solid #ffffff10;padding-top:16px}.hf-user-mini{display:flex;gap:10px;align-items:center;margin:0 6px 12px}.hf-avatar{width:34px;height:34px;border-radius:50%;background:#315efb;color:#fff;display:grid;place-items:center;font-weight:800}.hf-avatar.big{width:48px;height:48px}.hf-user-mini strong{display:block;color:#fff;font-size:13px;max-width:135px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hf-user-mini span{font-size:11px;color:#7f8da4}.hf-logout{width:100%;border:0;background:transparent;color:#9aa7bb;padding:10px;border-radius:9px;text-align:left;display:flex;gap:9px;align-items:center}.hf-logout:hover{background:#ffffff09;color:#fff}.hf-main{margin-left:240px;width:calc(100% - 240px);padding:30px 34px 50px}.hf-topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:25px}.hf-topbar h1{margin:3px 0 2px;font-size:27px;letter-spacing:-.5px}.hf-topbar p{margin:0;color:#8591a5;font-size:13px}.hf-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6681c8}.hf-top-actions,.hf-actions{display:flex;align-items:center;gap:10px}.hf-top-avatar{width:38px;height:38px;border-radius:50%;background:#14233c;color:#fff;display:grid;place-items:center;font-weight:800}.hf-menu{display:none}.hf-primary,.hf-secondary{border:0;border-radius:10px;height:40px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:700}.hf-primary{background:#315efb;color:#fff;box-shadow:0 7px 16px #315efb22}.hf-primary.compact{height:36px}.hf-secondary{background:#fff;color:#344158;border:1px solid #dfe5ee}.hf-alert{justify-content:flex-start}.hf-alert button{margin-left:auto;border:0;background:transparent;color:inherit}.hf-filters{background:#fff;border:1px solid #e3e8f0;border-radius:14px;padding:11px;display:flex;gap:9px;align-items:center;margin-bottom:18px}.hf-search{height:38px;display:flex;align-items:center;gap:8px;border:1px solid #e0e6ef;border-radius:9px;padding:0 10px;flex:1;color:#8793a5}.hf-search input{border:0;outline:0;width:100%;color:#172033}.hf-filters select{height:38px;border:1px solid #e0e6ef;border-radius:9px;background:#fff;padding:0 10px;color:#566176}.hf-filter-count{color:#8793a5;font-size:12px;white-space:nowrap;display:flex;gap:6px;align-items:center}.hf-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}.hf-card{background:#fff;border:1px solid #e4e9f0;border-radius:15px;padding:18px;position:relative;min-height:118px}.hf-card-icon{width:34px;height:34px;border-radius:10px;background:#eef3ff;color:#315efb;display:grid;place-items:center;margin-bottom:12px}.hf-card span{display:block;color:#7d899b;font-size:12px}.hf-card strong{display:block;font-size:25px;margin-top:4px}.hf-cards.small .hf-card{min-height:96px}.hf-cards.small .hf-card-icon{display:none}.hf-grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;margin-bottom:14px}.hf-panel{background:#fff;border:1px solid #e3e8f0;border-radius:15px;padding:19px;margin-bottom:14px}.hf-panel-title{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:17px}.hf-panel-title h2{font-size:16px;margin:0}.hf-muted{color:#8793a5;font-size:12px;margin:4px 0 0}.hf-link{border:0;background:transparent;color:#315efb;font-weight:700}.hf-status-list{display:grid;gap:14px}.hf-status-row{display:grid;grid-template-columns:10px 1fr 28px 1.2fr;gap:9px;align-items:center;font-size:12px}.hf-status-row strong{text-align:right}.hf-status-dot{width:8px;height:8px;border-radius:50%;background:#94a3b8}.dot-em-desenvolvimento{background:#315efb}.dot-em-homologacao{background:#7c4dff}.dot-concluida{background:#22a06b}.dot-reprovada{background:#e44b4b}.dot-aguardando-aprovacao{background:#f1a52b}.hf-bar{height:6px;background:#edf0f5;border-radius:9px;overflow:hidden}.hf-bar i{display:block;height:100%;background:#315efb;border-radius:9px}.hf-big-number{font-size:42px;font-weight:800;letter-spacing:-1px}.hf-mini-stats{display:grid;grid-template-columns:repeat(3,1fr);margin-top:25px;border-top:1px solid #edf0f4;padding-top:17px}.hf-mini-stats span{display:block;color:#8a95a6;font-size:11px}.hf-mini-stats b{font-size:17px}.hf-table-wrap{overflow:auto}.hf-table-wrap table{width:100%;border-collapse:collapse;min-width:1120px}.hf-table-wrap th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8b96a8;text-align:left;padding:10px 8px;border-bottom:1px solid #e8ecf2;white-space:nowrap}.hf-table-wrap td{padding:8px;border-bottom:1px solid #eef1f5;font-size:12px}.hf-table-wrap input,.hf-table-wrap select{border:1px solid #e3e7ee;border-radius:7px;height:34px;padding:0 8px;min-width:130px;background:#fff}.hf-table-wrap input.hours{width:72px;min-width:72px}.hf-table-wrap .number{font-weight:800;color:#315efb}.hf-pill{padding:5px 8px;border-radius:20px;font-size:11px;font-weight:700}.hf-pill.approved{background:#eaf8f1;color:#21865a}.hf-approve{border:0;background:#eef3ff;color:#315efb;border-radius:7px;padding:7px 9px;font-size:11px;font-weight:700}.hf-toggle{border:1px solid #e0e5ed;background:#fff;border-radius:20px;padding:6px 10px;font-size:11px;color:#7d899b}.hf-toggle.on{background:#eaf8f1;border-color:#cceedd;color:#21865a}.hf-icon-btn{width:30px;height:30px;border:0;background:#f2f5f9;color:#657188;border-radius:8px;display:grid;place-items:center}.hf-icon-btn.danger:hover{background:#fff0f0;color:#d13d3d}.hf-empty{padding:40px;display:flex;flex-direction:column;align-items:center;gap:7px;color:#8994a5}.hf-totals{display:flex;gap:20px;justify-content:flex-end;padding-top:15px;color:#788497;font-size:12px}.hf-totals strong{color:#27344b}.hf-user-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.hf-user-card{border:1px solid #e4e9f0;border-radius:14px;padding:17px}.hf-user-card-top{display:flex;justify-content:space-between;align-items:center}.hf-user-card h3{margin:15px 0 4px;font-size:15px}.hf-user-card p{margin:0;color:#8490a2;font-size:12px}.hf-role{font-size:10px;font-weight:800;border-radius:20px;padding:5px 8px}.role-admin{background:#eeeaff;color:#6744cc}.role-interno{background:#eef3ff;color:#315efb}.role-cliente{background:#fff5df;color:#a56b00}.hf-client-tag{display:flex;gap:5px;align-items:center;color:#69758a;font-size:11px;background:#f6f8fb;padding:8px;border-radius:8px;margin-top:12px}.hf-user-status{display:flex;gap:7px;align-items:center;color:#7c8799;font-size:11px;margin-top:15px}.hf-user-status span{width:7px;height:7px;border-radius:50%;background:#d2d8e1}.hf-user-status span.active{background:#27a56c}.hf-loading{text-align:center;padding:45px;color:#8793a5}.hf-empty-page{text-align:center;padding:60px;color:#8490a2}.hf-empty-page h2,.hf-empty-page h3{color:#28364c;margin:12px 0 5px}.hf-empty-page p{margin:0 0 20px}.hf-modal-backdrop{position:fixed;inset:0;background:#07101d99;display:grid;place-items:center;padding:20px;z-index:100;backdrop-filter:blur(3px)}.hf-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 25px 70px #07101d44}.hf-modal.user-modal{width:min(500px,100%)}.hf-modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.hf-modal-head h2{margin:4px 0;font-size:21px}.hf-modal-head p{margin:0;color:#8793a5;font-size:12px}.hf-modal-head>button{border:0;background:#f2f5f8;width:34px;height:34px;border-radius:9px;color:#647188;display:grid;place-items:center}.hf-form{display:grid;gap:3px}.hf-form input,.hf-form select{height:44px;margin-top:7px;border:1px solid #dce2eb;border-radius:10px;padding:0 12px;outline:0;background:#fff}.hf-form input:focus,.hf-form select:focus{border-color:#315efb;box-shadow:0 0 0 4px #315efb12}.hf-password-field{position:relative;margin-top:7px}.hf-password-field input{width:100%;margin-top:0;padding-right:45px}.hf-password-toggle{position:absolute;right:5px;top:5px;width:34px;height:34px;border:0;background:transparent;color:#7d899b;border-radius:8px;display:grid;place-items:center}.hf-password-toggle:hover{background:#f2f5f9;color:#315efb}.hf-form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:10px}.hf-history{display:grid;gap:17px}.hf-history-row{display:flex;gap:12px;position:relative}.hf-history-line{width:8px;height:8px;border-radius:50%;background:#315efb;margin-top:5px;flex:none}.hf-history-row strong{font-size:12px}.hf-history-row p{font-size:12px;color:#677388;margin:5px 0}.hf-history-row span{font-size:10px;color:#9aa4b3}.hf-overlay{display:none}

.hf-client-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.hf-client-card{border:1px solid #e4e9f0;border-radius:15px;padding:17px;background:#fff}
.hf-client-card-head{display:flex;gap:11px;align-items:center}
.hf-client-card-head>div:nth-child(2){flex:1;min-width:0}
.hf-client-card-head h3{margin:0 0 4px;font-size:15px}
.hf-client-card-head p{margin:0;color:#8793a5;font-size:11px;overflow:hidden;text-overflow:ellipsis}
.hf-client-icon{width:42px;height:42px;border-radius:12px;background:#eef3ff;color:#315efb;display:grid;place-items:center;flex:none}
.hf-client-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:15px 0}
.hf-client-metrics div{background:#f7f9fc;border-radius:9px;padding:10px}
.hf-client-metrics b,.hf-client-metrics span{display:block}.hf-client-metrics b{font-size:18px}.hf-client-metrics span{font-size:10px;color:#8793a5;margin-top:2px}
.hf-client-demand-list{display:grid;gap:6px}.hf-client-demand-list button{border:1px solid #e8ecf2;background:#fff;border-radius:8px;padding:8px;text-align:left;display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center}
.hf-client-demand-list button span{font-size:10px;color:#315efb;font-weight:800}.hf-client-demand-list strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hf-client-demand-list small{font-size:9px;color:#8793a5}
.hf-client-cell{font-size:11px;font-weight:700;color:#556177;white-space:nowrap}
.hf-approval-actions{display:flex;gap:5px}.hf-reject{border:0;background:#fff0f0;color:#c73a3a;border-radius:7px;padding:7px 8px;font-size:11px;font-weight:700}
.hf-pill.rejected{background:#fff0f0;color:#c73a3a}.hf-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

@media(max-width:1000px){.hf-sidebar{transform:translateX(-100%);transition:.2s}.hf-sidebar.open{transform:translateX(0)}.hf-overlay{display:block;position:fixed;inset:0;background:#07101d66;z-index:15}.hf-main{margin-left:0;width:100%;padding:22px}.hf-menu{display:grid;border:1px solid #e1e6ee;background:#fff;width:38px;height:38px;border-radius:10px;place-items:center;color:#344158}.hf-topbar{align-items:flex-start}.hf-topbar>div:nth-child(2){flex:1}.hf-cards{grid-template-columns:repeat(2,1fr)}.hf-grid2{grid-template-columns:1fr}.hf-user-grid{grid-template-columns:repeat(2,1fr)}.hf-client-grid{grid-template-columns:repeat(2,1fr)}.hf-filters{flex-wrap:wrap}.hf-search{min-width:100%}}
@media(max-width:600px){.hf-login{background:#f4f7fb;padding:14px}.hf-login-card{padding:25px 20px;border-radius:18px}.hf-topbar h1{font-size:23px}.hf-top-actions .hf-primary{display:none}.hf-cards{grid-template-columns:1fr}.hf-cards.small{grid-template-columns:1fr 1fr}.hf-user-grid{grid-template-columns:1fr}.hf-client-grid{grid-template-columns:1fr}.hf-form-grid{grid-template-columns:1fr}.hf-filters select{flex:1}.hf-filter-count{width:100%}.hf-totals{flex-wrap:wrap;justify-content:flex-start}.hf-main{padding:16px}.hf-panel{padding:14px}}
`;

export default App;