import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart3, CheckCircle2, Clock3, Filter, History, LayoutDashboard,
  Plus, Search, Trash2, Users, X, Clipboard, CalendarDays, LogOut,
  UserPlus, ShieldCheck, Building2, Menu, LockKeyhole, Mail, Eye, EyeOff,
  AlertCircle, RefreshCw, Bell
} from 'lucide-react';

type Role = 'ADMIN' | 'INTERNO' | 'CLIENTE';
type Status = 'Aguardando análise' | 'Em análise' | 'Analisada' | 'Aguardando aprovação' | 'Em desenvolvimento' | 'Em homologação' | 'Concluída' | 'Reprovada';
type Priority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

type AuthUser = { id:number; name:string; email:string; role:Role; clientId:number|null };
type Client = { id:number; name:string; email?:string; active?:number|boolean };
type DashboardSummary = {
  totalDemands:number; totalHours:number; analysisHours:number; requiredHours:number;
  approvedDemands:number; analyzedHours:number; rejectedDemands:number; pendingApprovalDemands:number; pendingApprovalHoursTotal:number; finishedHours:number; finishedDemands:number;
  byStatus:Record<string,number>;
  byClient:Array<{
    clientId:number; clientName:string; totalDemands:number; analysisHours:number;
    requiredHours:number; totalHours:number; approvedDemands:number; analyzedHours:number; rejectedDemands:number; pendingApprovalDemands:number; pendingApprovalHoursTotal:number;
  }>;
};
type User = { id:number; name:string; email:string; role:Role; clientId:number|null; clientName?:string|null; active:number|boolean };

type HistoryItem = { id:string; date:string; user:string; field:string; oldValue:string; newValue:string };
type Demand = {
  id:string; numero:number; problema:string; tratamento:string; horasAnalise:number; horasNecessarias:number;
  prioridade:Priority; status:Status; aprovacao:'Pendente'|'Aprovada'|'Reprovada'; aprovadoPor:string;
  aprovadoEm:string; analysisMonth?:string; requestDate?:string; deliveryDate?:string; rejectionReason?:string; pago:boolean; responsavel:string; criadoEm:string; history:HistoryItem[];
};

const API = 'https://horas-flow.onrender.com/api';

const statuses:Status[] = ['Aguardando análise','Em análise','Analisada','Em desenvolvimento','Em homologação','Concluída'];
const priorities:Priority[] = ['Baixa','Média','Alta','Urgente'];
const uid = () => crypto.randomUUID();

const initialDemands:Demand[] = [
  {id:'1',numero:1,problema:'Erro no cadastro de usuário',tratamento:'Corrigir validação da API',horasAnalise:2,horasNecessarias:8,prioridade:'Alta',status:'Em desenvolvimento',aprovacao:'Aprovada',aprovadoPor:'Victória',aprovadoEm:'20/08/2026 10:30',pago:true,responsavel:'Gabriel',criadoEm:'2026-08-18',history:[]},
  {id:'2',numero:2,problema:'Filtro de documentos não funciona',tratamento:'Ajustar filtros do backoffice',horasAnalise:1,horasNecessarias:4,prioridade:'Média',status:'Em homologação',aprovacao:'Aprovada',aprovadoPor:'Victória',aprovadoEm:'20/08/2026 11:10',pago:false,responsavel:'Lucas',criadoEm:'2026-08-19',history:[]},
  {id:'3',numero:3,problema:'Relatório não apresenta documentos vencidos',tratamento:'Adicionar status ao relatório',horasAnalise:3,horasNecessarias:6,prioridade:'Alta',status:'Aguardando aprovação',aprovacao:'Pendente',aprovadoPor:'',aprovadoEm:'',pago:false,responsavel:'Amanda',criadoEm:'2026-08-20',history:[]}
];

function normalizePriority(value:any):Priority {
  const v=String(value ?? '').trim().toLowerCase();
  if(v==='baixa'||v==='low')return 'Baixa';
  if(v==='alta'||v==='high')return 'Alta';
  if(v==='urgente'||v==='urgent'||v==='critical'||v==='critica')return 'Urgente';
  return 'Média';
}

function normalizeStatus(value:any){
  const raw=String(value??'').trim();
  const key=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const map:Record<string,string>={
    'aguardando analise':'Aguardando análise',
    'em analise':'Em análise',
    'analisada':'Analisada',
    'aguardando aprovacao':'Aguardando aprovação',
    'em desenvolvimento':'Em desenvolvimento',
    'em homologacao':'Em homologação',
    'concluida':'Concluída',
    'pendente':'Pendente'
  };
  return map[key]||raw;
}

function normalizeApproval(value:any):'Pendente'|'Aprovada'|'Reprovada' {
  const v=String(value ?? '').trim().toLowerCase();
  if(v==='aprovada'||v==='approved')return 'Aprovada';
  if(v==='reprovada'||v==='rejected')return 'Reprovada';
  return 'Pendente';
}

function normalizeDemand(raw:any):Demand {
  const analysisMonth = raw.analysisMonth ?? raw.analysis_month ?? '';
  const requestDate = raw.requestDate ?? raw.request_date ?? '';
  const deliveryDate = raw.deliveryDate ?? raw.delivery_date ?? '';
  const created = raw.createdAt ?? raw.created_at ?? new Date().toISOString();
  return {
    id:String(raw.id), numero:Number(raw.number ?? raw.numero ?? 0), problema:raw.problem ?? raw.problema ?? '',
    tratamento:raw.treatment ?? raw.tratamento ?? '', horasAnalise:Number(raw.analysisHours ?? raw.analysis_hours ?? raw.horasAnalise ?? 0),
    horasNecessarias:Number(raw.requiredHours ?? raw.required_hours ?? raw.horasNecessarias ?? 0), prioridade:normalizePriority(raw.priority ?? raw.prioridade),
    status:raw.status ?? 'Pendente', aprovacao:normalizeApproval(raw.approval ?? raw.aprovacao), aprovadoPor:raw.approvedBy ?? raw.approved_by ?? '',
    aprovadoEm:raw.approvedAt ?? raw.approved_at ?? '', analysisMonth, requestDate, deliveryDate,
    rejectionReason:raw.rejectionReason ?? raw.rejection_reason ?? raw.rejection ?? '',
    pago:Boolean(raw.paid ?? raw.pago), responsavel:raw.responsible ?? raw.responsavel ?? '',
    criadoEm:String(created).slice(0,10), history:raw.history ?? []
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

  const [tab,setTab]=useState<'meu-dia'|'dashboard'|'demandas'|'usuarios'|'clientes'>('meu-dia');
  const [demands,setDemands]=useState<Demand[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [clients,setClients]=useState<Client[]>([]);
  const [dashboard,setDashboard]=useState<DashboardSummary>({
    totalDemands:0,totalHours:0,analysisHours:0,requiredHours:0,
    approvedDemands:0,analyzedHours:0,rejectedDemands:0,pendingApprovalDemands:0,pendingApprovalHoursTotal:0,finishedHours:0,finishedDemands:0,byStatus:{},byClient:[]
  });
  const [dashboardLoading,setDashboardLoading]=useState(false);
  const [dashboardClientFilter,setDashboardClientFilter]=useState('Todos');
  const [dashboardPeriod,setDashboardPeriod]=useState('Todos');

const availablePeriods = useMemo(() => {
  const periods = new Set<string>();

  demands.forEach(d => {
    const month = getDeliveryMonthKey(
      d.deliveryDate || (d as any).delivery_date
    );

    if(month){
      periods.add(month);
    }
  });

  return Array.from(periods).sort().reverse();
}, [demands]);
const formatPeriod = (period:string) => {
  if (!period || period === 'Todos') return 'Todos os períodos';

  const [year, month] = period.split('-');

  const date = new Date(Number(year), Number(month)-1, 1);

  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).replace(/^./, c => c.toUpperCase());
};
  const [loading,setLoading]=useState(false);
  const [apiError,setApiError]=useState('');
  const [demandSearch,setDemandSearch]=useState('');
  const [demandFiltersOpen,setDemandFiltersOpen]=useState(false);
  const [demandStatusFilter,setDemandStatusFilter]=useState('Todos');
  const [demandApprovalFilter,setDemandApprovalFilter]=useState('Todas');
  const [demandPriorityFilter,setDemandPriorityFilter]=useState('Todas');
  const [demandClientFilter,setDemandClientFilter]=useState('Todos');
  const [demandPeriod,setDemandPeriod]=useState('Todos');
  const [demandPage,setDemandPage]=useState(1);
  const [demandView,setDemandView]=useState<'table'|'cards'|'kanban'>('table');
  const demandPageSize=10;
  const [historyDemand,setHistoryDemand]=useState<Demand|null>(null);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [copied,setCopied]=useState(false);
  const [mobileMenu,setMobileMenu]=useState(false);
  const [commandCenterOpen,setCommandCenterOpen]=useState(false);
const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [saphireIaOpen,setSaphireIaOpen]=useState(false);
  const [commandSearch,setCommandSearch]=useState('');
  useEffect(()=>{
    const handleCommandShortcut=(e:KeyboardEvent)=>{
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='k'){
        e.preventDefault();
        setCommandCenterOpen(true);
        setCommandSearch('');
      }

      if(e.key==='Escape'){
        setCommandCenterOpen(false);
        setCommandSearch('');
      }
    };

    window.addEventListener('keydown',handleCommandShortcut);

    return()=>{
      window.removeEventListener('keydown',handleCommandShortcut);
    };
  },[]);

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
  const [approvalDemand,setApprovalDemand]=useState<Demand|null>(null);
  const [approvalMonth,setApprovalMonth]=useState('');
  const [approvalReason,setApprovalReason]=useState('');
  const [approvalSaving,setApprovalSaving]=useState(false);
  const [approvalType,setApprovalType]=useState<'approve'|'reject'>('approve');
  const [demandSaving,setDemandSaving]=useState(false);
  const [demandSuccess,setDemandSuccess]=useState('');
  const [demandError,setDemandError]=useState('');
  const [editingDemand,setEditingDemand]=useState<Demand|null>(null);
  const [demandForm,setDemandForm]=useState<any>({
    problema:'',tratamento:'',horasAnalise:0,horasNecessarias:0,prioridade:'Média',
    status:'Aguardando análise',clientId:'',responsavel:'',analysisMonth:'',requestDate:'',deliveryDate:''
  });

  const isAdmin=user?.role==='ADMIN';
  const isInternal=user?.role==='INTERNO'||isAdmin;
  const isClient=user?.role==='CLIENTE';
const notificationProfile =
  isAdmin
    ? 'admin'
    : isClient
      ? 'client'
      : 'internal';

const notificationUserIdentity =
  String((user as any)?.id ?? 'usuario');

const notificationUserKey =
  `${notificationProfile}-${notificationUserIdentity}`;

const notificationStorageKey =
  `sapphire-notifications-${notificationUserKey}`;

const [notificationReadIds,setNotificationReadIds] =
  useState<string[]>(() => {

    try{

      const saved =
        localStorage.getItem(notificationStorageKey);

      return saved
        ? JSON.parse(saved)
        : [];

    }catch{
      return [];
    }

  });

const [notificationClearedIds,setNotificationClearedIds] =
  useState<string[]>(() => {

    try{

      const saved =
        localStorage.getItem(
          `${notificationStorageKey}-cleared`
        );

      return saved
        ? JSON.parse(saved)
        : [];

    }catch{
      return [];
    }

  });
const [notificationInitialized,setNotificationInitialized] =
  useState(() => {

    try{
      return localStorage.getItem(
        `${notificationStorageKey}-initialized`
      ) === 'true';
    }catch{
      return false;
    }

  });

useEffect(() => {

  setNotificationReadIds([]);
  setNotificationClearedIds([]);
  setNotificationInitialized(false);

  try{

    const savedRead =
      localStorage.getItem(notificationStorageKey);

    const savedCleared =
      localStorage.getItem(
        `${notificationStorageKey}-cleared`
      );

    const savedInitialized =
      localStorage.getItem(
        `${notificationStorageKey}-initialized`
      ) === 'true';

    setNotificationReadIds(
      savedRead
        ? JSON.parse(savedRead)
        : []
    );

    setNotificationClearedIds(
      savedCleared
        ? JSON.parse(savedCleared)
        : []
    );

    setNotificationInitialized(
      savedInitialized
    );

  }catch{

    setNotificationReadIds([]);
    setNotificationClearedIds([]);
    setNotificationInitialized(false);

  }

},[notificationStorageKey])
const notifications = useMemo(() => {

  const result: Array<{
    id:string;
    type:'approval'|'assigned'|'deadline'|'info';
    title:string;
    description:string;
    demand:Demand;
  }> = [];

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  demands.forEach(d => {

    const demandClientId =
      (d as any).clientId ??
      (d as any).client_id ??
      '';

    const userClientId =
      (user as any)?.clientId ??
      (user as any)?.client_id ??
      '';

        /*
     * CLIENTE
     * Notificações exclusivas das demandas do próprio cliente.
     */
    if(
      isClient &&
      String(demandClientId) === String(userClientId)
    ){

      /*
       * DEMANDA AGUARDANDO APROVAÇÃO
       */
      if(normalizeApproval(d.aprovacao) === 'Pendente'){

        result.push({
          id:`approval-${d.id}`,
          type:'approval',
          title:
            `Demanda #${String(d.numero).padStart(3,'0')} aguarda aprovação`,
          description:
            'Essa demanda precisa da sua aprovação.',
          demand:d
        });

      }

      /*
       * DEMANDA CONCLUÍDA
       */
      if(d.status === 'Concluída'){

        result.push({
          id:`completed-${d.id}`,
          type:'info',
          title:
            `Demanda #${String(d.numero).padStart(3,'0')} concluída`,
          description:
            'A demanda foi concluída.',
          demand:d
        });

      }

    }
/*
     * USUÁRIO INTERNO / RESPONSÁVEL
     */
    if(isInternal){

      const responsavel =
        String(d.responsavel || '').trim().toLowerCase();

      const nomeUsuario =
        String(user?.name || '').trim().toLowerCase();

      if(
        responsavel &&
        responsavel === nomeUsuario &&
        d.status !== 'Concluída'
      ){

        /*
         * DEMANDA ATRIBUÍDA
         */
        result.push({
          id:`assigned-${d.id}`,
          type:'assigned',
          title:`Demanda #${String(d.numero).padStart(3,'0')} atribuída a você`,
          description:
            `Mês de análise: ${
              d.analysisMonth || 'Não definido'
            } • Entrega: ${
              d.deliveryDate
                ? formatDate(d.deliveryDate)
                : 'Não definida'
            }`,
          demand:d
        });

        /*
         * PRAZO DE ENTREGA
         */
        if(d.deliveryDate){

          const entrega =
            new Date(`${d.deliveryDate}T00:00:00`);

          const diff = Math.ceil(
            (entrega.getTime()-hoje.getTime()) /
            (1000*60*60*24)
          );

          if(diff < 0){

            result.push({
              id:`overdue-${d.id}`,
              type:'deadline',
              title:`Demanda #${String(d.numero).padStart(3,'0')} está atrasada`,
              description:
                `A data de entrega era ${formatDate(d.deliveryDate)}.`,
              demand:d
            });

          }
          else if(diff <= 3){

            result.push({
              id:`deadline-${d.id}`,
              type:'deadline',
              title:
                `Entrega próxima — demanda #${String(d.numero).padStart(3,'0')}`,
              description:
                diff === 0
                  ? 'A entrega é hoje.'
                  : `Faltam ${diff} dia${diff===1?'':'s'} para a entrega.`,
              demand:d
            });

          }

        }

      }

    }

    /*
     * ADMIN
     */
    if(isAdmin){

      if(d.status === 'Aguardando análise'){

        result.push({
          id:`analysis-${d.id}`,
          type:'info',
          title:
            `Demanda #${String(d.numero).padStart(3,'0')} aguardando análise`,
          description:
            'Existe uma demanda aguardando análise.',
          demand:d
        });

      }

      if(d.aprovacao === 'Aprovada'){

        result.push({
          id:`approved-${d.id}`,
          type:'info',
          title:
            `Demanda #${String(d.numero).padStart(3,'0')} aprovada`,
          description:
            'A demanda foi aprovada.',
          demand:d
        });

      }

    }

  });

  return result;

},[demands,user,isClient,isInternal,isAdmin]);

useEffect(() => {

  if(notificationInitialized) return;

  if(!notifications.length){

    localStorage.setItem(
      `${notificationStorageKey}-initialized`,
      'true'
    );

    setNotificationInitialized(true);

    return;
  }

  /*
   * Na primeira inicialização, todas as notificações
   * existentes são consideradas já conhecidas.
   */
  const existingIds =
    notifications.map(n=>n.id);

  localStorage.setItem(
    notificationStorageKey,
    JSON.stringify(existingIds)
  );

  localStorage.setItem(
    `${notificationStorageKey}-initialized`,
    'true'
  );

  setNotificationReadIds(existingIds);
  setNotificationInitialized(true);

},[
  notifications,
  notificationInitialized,
  notificationStorageKey
]);

const unreadNotifications =
  notificationInitialized
    ? notifications.filter(
        n =>
          !notificationReadIds.includes(n.id) &&
          !notificationClearedIds.includes(n.id)
      )
    : [];

const markNotificationAsRead = (id:string) => {

  setNotificationReadIds(previous => {

    const updated = previous.includes(id)
      ? previous
      : [...previous,id];

    localStorage.setItem(
      notificationStorageKey,
      JSON.stringify(updated)
    );

    return updated;
  });

};



  const exportStatusReport = () => {
    const doc = new jsPDF();

    const formatReportPeriod = (period: string) => {
      if (period === 'Todos') return 'Todos os períodos';

      const [year, month] = period.split('-');

      const months = [
        'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
      ];

      return months[Number(month) - 1]
        ? `${months[Number(month) - 1]}/${year}`
        : period;
    };

    const periodLabel =
      formatReportPeriod(dashboardPeriod);

    const selectedClient =
      dashboardClientFilter !== 'Todos'
        ? clients.find(
            c => String(c.id) === String(dashboardClientFilter)
          )
        : null;

    const clientName =
      selectedClient?.name ||
      (isClient ? user?.name : 'Todos os clientes');

    const clientMatches = (d: Demand) => {
      if (dashboardClientFilter === 'Todos') return true;

      const demandClientId =
        (d as any).clientId ??
        (d as any).client_id ??
        '';

      return String(demandClientId) ===
        String(dashboardClientFilter);
    };

    const periodMatches = (
      value: string | undefined
    ) => {
      if (dashboardPeriod === 'Todos') return true;

      return String(value || '').slice(0, 7) ===
        dashboardPeriod;
    };

    // =================================================
    // DEMANDAS ANALISADAS
    // =================================================

    const analyzedDemands = demands.filter(d => {
      if (!clientMatches(d)) return false;

      if (normalizeStatus(d.status) !== 'Analisada') {
        return false;
      }

      return periodMatches(d.analysisMonth);
    });

    // =================================================
    // DEMANDAS CONCLUÍDAS
    // =================================================

    const completedDemands = demands.filter(d => {
      if (!clientMatches(d)) return false;

      if (normalizeStatus(d.status) !== 'Concluída') {
        return false;
      }

      return periodMatches(d.deliveryDate || (d as any).delivery_date);
    });

    const analysisHours =
      analyzedDemands.reduce(
        (sum, d) =>
          sum + Number(d.horasAnalise || 0),
        0
      );

    const finishedHours =
      completedDemands.reduce(
        (sum, d) =>
          sum +
          Number(d.horasAnalise || 0) +
          Number(d.horasNecessarias || 0),
        0
      );

    const totalMonthHours =
      analysisHours + finishedHours;

    // =================================================
    // INDICADORES GERAIS
    // =================================================

    const generalDemands =
      demands.filter(d => clientMatches(d));

    const totalDemands =
      generalDemands.length;

    const approvedDemands =
      generalDemands.filter(
        d =>
          normalizeApproval(d.aprovacao) ===
          'Aprovada'
      ).length;

    const rejectedDemands =
      generalDemands.filter(
        d =>
          normalizeApproval(d.aprovacao) ===
          'Reprovada'
      ).length;

    const pendingApprovalHours =
      generalDemands
        .filter(
          d =>
            normalizeApproval(d.aprovacao) ===
            'Pendente'
        )
        .reduce(
          (sum, d) =>
            sum + Number(d.horasNecessarias || 0),
          0
        );

    const today = new Date();

    const generatedAt =
      today.toLocaleDateString('pt-BR') +
      ' às ' +
      today.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });

    // =================================================
    // CABEÇALHO EXECUTIVO
    // =================================================

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(
      'SAPHIRE SHEET',
      14,
      13
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      'STATUS REPORT EXECUTIVO',
      14,
      20
    );

    doc.setFontSize(7.5);
    doc.text(
      `${periodLabel}  •  ${clientName}`,
      14,
      26
    );

    doc.setTextColor(22, 35, 59);

    // =================================================
    // CONTEXTO
    // =================================================

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);

    doc.text(
      'VISÃO EXECUTIVA',
      14,
      41
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    doc.text(
      `Período: ${periodLabel}`,
      14,
      48
    );

    doc.text(
      `Cliente: ${clientName}`,
      14,
      54
    );

    doc.text(
      `Gerado em: ${generatedAt}`,
      14,
      60
    );

    // =================================================
    // FUNÇÃO DE CARD
    // =================================================

    const drawMetric = (
      x: number,
      y: number,
      width: number,
      title: string,
      value: string
    ) => {
      doc.setDrawColor(225, 231, 239);
      doc.setFillColor(248, 250, 252);

      doc.roundedRect(
        x,
        y,
        width,
        24,
        3,
        3,
        'FD'
      );

      doc.setTextColor(108, 122, 142);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      doc.text(
        title,
        x + 5,
        y + 8
      );

      doc.setTextColor(22, 35, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);

      doc.text(
        value,
        x + 5,
        y + 18
      );
    };

    // =================================================
    // HORAS DO PERÍODO
    // =================================================

    drawMetric(
      14,
      68,
      57,
      'HORAS ANALISADAS',
      `${analysisHours}h`
    );

    drawMetric(
      76,
      68,
      57,
      'HORAS CONCLUÍDAS',
      `${finishedHours}h`
    );

    drawMetric(
      138,
      68,
      58,
      'TOTAL DO MÊS',
      `${totalMonthHours}h`
    );

    // =================================================
    // INDICADORES GERAIS
    // =================================================

    doc.setTextColor(22, 35, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    doc.text(
      'INDICADORES GERAIS',
      14,
      106
    );

    drawMetric(
      14,
      112,
      44,
      'DEMANDAS',
      String(totalDemands)
    );

    drawMetric(
      62,
      112,
      44,
      'APROVADAS',
      String(approvedDemands)
    );

    drawMetric(
      110,
      112,
      44,
      'REPROVADAS',
      String(rejectedDemands)
    );


    // =================================================
    // DEMANDAS ANALISADAS
    // =================================================

    let analyzedStartY = 149;

    doc.setTextColor(22, 35, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);

    doc.text(
      `DEMANDAS ANALISADAS NO PERÍODO  •  ${analyzedDemands.length}`,
      14,
      analyzedStartY
    );

    const analyzedTable =
      analyzedDemands.map(d => [
        String(d.numero).padStart(3, '0'),
        d.problema || '-',
        `${Number(d.horasAnalise || 0)}h`,
        d.responsavel || '-'
      ]);

    autoTable(doc, {
      startY: analyzedStartY + 6,

      head: [[
        'Nº',
        'Demanda',
        'Horas',
        'Responsável'
      ]],

      body:
        analyzedTable.length
          ? analyzedTable
          : [[
              '-',
              'Nenhuma demanda analisada no período.',
              '-',
              '-'
            ]],

      theme: 'grid',

      styles: {
        font: 'helvetica',
        fontSize: 7.2,
        cellPadding: 3,
        overflow: 'linebreak',
        textColor: [45, 55, 72],
        lineColor: [226, 232, 240],
        lineWidth: 0.25
      },

      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },

      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 105 },
        2: { cellWidth: 22 },
        3: { cellWidth: 41 }
      },

      margin: {
        left: 14,
        right: 14
      }
    });

    // =================================================
    // DEMANDAS CONCLUÍDAS
    // =================================================

    let completedStartY =
      ((doc as any).lastAutoTable?.finalY || 155) + 14;

    if (completedStartY > 250) {
      doc.addPage();
      completedStartY = 22;
    }

    doc.setTextColor(22, 35, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);

    doc.text(
      `DEMANDAS CONCLUÍDAS NO PERÍODO  •  ${completedDemands.length}`,
      14,
      completedStartY
    );

    const completedTable =
      completedDemands.map(d => [
        String(d.numero).padStart(3, '0'),
        d.problema || '-',
        `${(
          Number(d.horasAnalise || 0) +
          Number(d.horasNecessarias || 0)
        )}h`,
        d.responsavel || '-'
      ]);

    autoTable(doc, {
      startY: completedStartY + 6,

      head: [[
        'Nº',
        'Demanda',
        'Horas',
        'Responsável'
      ]],

      body:
        completedTable.length
          ? completedTable
          : [[
              '-',
              'Nenhuma demanda concluída no período.',
              '-',
              '-'
            ]],

      theme: 'grid',

      styles: {
        font: 'helvetica',
        fontSize: 7.2,
        cellPadding: 3,
        overflow: 'linebreak',
        textColor: [45, 55, 72],
        lineColor: [226, 232, 240],
        lineWidth: 0.25
      },

      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },

      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 105 },
        2: { cellWidth: 22 },
        3: { cellWidth: 41 }
      },

      margin: {
        left: 14,
        right: 14
      }
    });

    // =================================================
    // RODAPÉ
    // =================================================

    const pageCount =
      (doc as any).internal.getNumberOfPages();

    for (
      let page = 1;
      page <= pageCount;
      page++
    ) {
      doc.setPage(page);

      const pageHeight =
        doc.internal.pageSize.getHeight();

      doc.setDrawColor(226, 232, 240);

      doc.line(
        14,
        pageHeight - 17,
        196,
        pageHeight - 17
      );

      doc.setTextColor(120, 132, 148);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      doc.text(
        'Saphire Sheet • Status Report Executivo',
        14,
        pageHeight - 10
      );

      doc.text(
        `Página ${page} de ${pageCount}`,
        196,
        pageHeight - 10,
        { align: 'right' }
      );
    }

    const filePeriod =
      dashboardPeriod === 'Todos'
        ? 'todos-periodos'
        : dashboardPeriod;

    const safeClient =
      clientName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    doc.save(
      `status-report-${filePeriod}-${safeClient || 'todos-clientes'}.pdf`
    );
  };
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

  // Após login ou restauração da sessão, iniciar sempre no Meu Dia.
  useEffect(()=>{
    if(token && user){
      setTab('meu-dia');
    }
  },[token,user]);

  const loadDemands=async()=>{
    try{setLoading(true);setApiError('');const data=await request('/demands');setDemands((data.data||[]).map((d:any)=>({...normalizeDemand(d),clientId:d.clientId??d.client_id??null,clientName:d.clientName??d.client_name??''})));}
    catch(error:any){setApiError(error.message)}
    finally{setLoading(false)}
  };

  const loadDashboard=async(clientIdOverride?:string)=>{
    try{
      setDashboardLoading(true);
      const selected = isAdmin
        ? (clientIdOverride ?? dashboardClientFilter)
        : '';
      const params = new URLSearchParams();
      if(isAdmin && selected && selected!=='Todos') params.set('clientId', String(selected));
      if(dashboardPeriod && dashboardPeriod!=='Todos') params.set('period', dashboardPeriod);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data=await request(`/dashboard${query}`);
      const d=data.data||{};
      setDashboard({
        totalDemands:Number(d.totalDemands||0),
        totalHours:Number(d.totalHours||0),
        analysisHours:Number(d.analysisHours||0),
        requiredHours:Number(d.requiredHours||0),
        analyzedHours:Number(d.analyzedHours ?? 0),
        approvedDemands:Number(d.approvedDemands||0),
        rejectedDemands:Number(d.rejectedDemands||0),
        pendingApprovalDemands:Number(d.pendingApprovalDemands ?? 0),
        pendingApprovalHoursTotal:Number(d.pendingApprovalHoursTotal ?? 0),
        finishedHours:Number((demands||[]).filter((x:any)=>normalizeStatus(x.status)==='Concluída' && (dashboardPeriod==='Todos' || getDeliveryMonthKey(x.deliveryDate || (x as any).delivery_date)===dashboardPeriod)).reduce((sum:number,x:any)=>sum+Number(x.horasAnalise||0)+Number(x.horasNecessarias||0),0)),
        finishedDemands:Number(d.finishedDemands ?? d.finalizedDemands ?? 0),
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
    if(token&&tab==='dashboard')loadDashboard(dashboardClientFilter);
  },[dashboardClientFilter,dashboardPeriod]);
  useEffect(()=>{if(token&&isAdmin)loadUsers()},[token,isAdmin]);

  const updateLocal=(id:string,field:keyof Demand,value:unknown)=>{
    setDemands(current=>current.map(d=>{
      if(d.id!==id)return d;
      const oldValue=String(d[field]??'');const newValue=String(value??'');
      if(oldValue===newValue)return d;
      return {...d,[field]:value,history:[{id:uid(),date:new Date().toLocaleString('pt-BR'),user:user?.name||'Usuário atual',field:String(field),oldValue,newValue},...(d.history||[])]};
    }))
  };

  const openHistory=async(d:Demand)=>{
    try{
      setHistoryLoading(true);
      const data=await request(`/demands/${d.id}/history`);
      const history=(data.data||[]).map((h:any)=>({
        id:String(h.id),
        date:h.createdAt||h.created_at||h.date||'',
        user:h.userName||h.user_name||h.user||'Usuário',
        field:h.field||'',
        oldValue:String(h.oldValue??h.old_value??''),
        newValue:String(h.newValue??h.new_value??'')
      }));
      setHistoryDemand({...d,history});
    }catch(error:any){
      setApiError(error.message||'Não foi possível carregar o histórico.');
    }finally{setHistoryLoading(false);}
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
    status:'Aguardando análise',clientId:isClient?String(user?.clientId||''):'',responsavel:'',
    analysisMonth:'',requestDate:'',deliveryDate:''
  });
  const openNewDemand=()=>{
    if(!isInternal)return;
    setDemandError('');setEditingDemand(null);setDemandForm(emptyDemand());setDemandModal(true);
  };

  const openEditDemand=(d:Demand)=>{
    if(!isInternal&&!isClient)return;
    setDemandError('');setEditingDemand(d);
    setDemandForm({
      problema:d.problema,tratamento:d.tratamento,horasAnalise:d.horasAnalise,
      horasNecessarias:d.horasNecessarias,prioridade:d.prioridade,status:d.status,
      clientId:String((d as any).clientId||''),responsavel:d.responsavel,analysisMonth:String((d as any).analysisMonth||'').slice(0,7),requestDate:String((d as any).requestDate||'').slice(0,10),deliveryDate:String((d as any).deliveryDate||'').slice(0,10)
    });
    setDemandModal(true);
  };

  const saveDemand=async(e:React.FormEvent)=>{
    e.preventDefault();setDemandError('');

    // CLIENTE só pode alterar a prioridade da própria demanda.
    if(isClient){
      if(!editingDemand){setDemandError('Cliente não pode criar demandas.');return}
      try{
        setDemandSaving(true);
        await request(`/demands/${editingDemand.id}/priority`,{
          method:'PATCH',
          body:JSON.stringify({priority:demandForm.prioridade})
        });
        setDemandModal(false);
        setDemandForm(emptyDemand());
        await loadDemands();
      }catch(error:any){
        setDemandError(error.message||'Não foi possível alterar a prioridade.');
      }finally{setDemandSaving(false)}
      return;
    }

    if(!demandForm.problema.trim()||!demandForm.tratamento.trim()){setDemandError('Informe o problema e o tratamento.');return}
    if(!demandForm.clientId){setDemandError('Selecione o cliente vinculado.');return}

    if(normalizeStatus(demandForm.status)==='Analisada' && Number(demandForm.horasAnalise)<=0){
      setDemandError('Informe as horas de análise para marcar a demanda como Analisada.');
      return;
    }

    try{
      setDemandSaving(true);
      const payload={
        problem:demandForm.problema.trim(),treatment:demandForm.tratamento.trim(),
        analysisHours:Number(demandForm.horasAnalise)||0,requiredHours:Number(demandForm.horasNecessarias)||0,
        priority:demandForm.prioridade,status:demandForm.status,
        analysisMonth:demandForm.analysisMonth||null,requestDate:demandForm.requestDate||null,deliveryDate:demandForm.deliveryDate||null,
        clientId:Number(demandForm.clientId),responsible:demandForm.responsavel||''
      };
      const creatingDemand = !editingDemand;

      if(editingDemand){

        await request(
          `/demands/${editingDemand.id}`,
          {
            method:'PUT',
            body:JSON.stringify(payload)
          }
        );

      }else{

        await request(
          '/demands',
          {
            method:'POST',
            body:JSON.stringify(payload)
          }
        );

      }

      setDemandSuccess(
        creatingDemand
          ? 'Demanda criada com sucesso!'
          : 'Demanda atualizada com sucesso!'
      );

      await loadDemands();

      setTimeout(()=>{

        setDemandModal(false);
        setDemandForm(emptyDemand());
        setDemandSuccess('');

      },1100);
    }catch(error:any){setDemandError(error.message||'Não foi possível salvar a demanda.')}
    finally{setDemandSaving(false)}
  };

  const removeDemand=async(id:string)=>{
    if(!isInternal)return;
    if(!confirm('Excluir esta demanda?'))return;
    try{await request(`/demands/${id}`,{method:'DELETE'});await loadDemands()}
    catch(error:any){setApiError(error.message)}
  };

  const openApproval=async(d:Demand,approved=true)=>{
    if(!isAdmin&&!isClient)return;
    setApprovalDemand(d);
    setApprovalReason('');
    setApprovalMonth('');
    setApprovalType(approved ? 'approve' : 'reject');
  };

  const closeApproval=()=>{
    setApprovalDemand(null);
    setApprovalMonth('');
    setApprovalReason('');
    setApprovalSaving(false);
  };

  const confirmApproval=async()=>{
    if(!approvalDemand)return;
    const type=approvalType;

    if(type==='reject' && !approvalReason.trim()){setApiError('Informe o motivo da reprovação.');return;}
    try{
      setApprovalSaving(true);
      if(type==='approve'){await request(`/demands/${approvalDemand.id}/approve`,{method:'POST',body:JSON.stringify({})});}
      else{await request(`/demands/${approvalDemand.id}/reject`,{method:'POST',body:JSON.stringify({reason:approvalReason.trim()})});}
      closeApproval();
      await loadDemands();
      await loadDashboard(dashboardClientFilter);
    }catch(error:any){setApiError(error.message||'Não foi possível registrar a decisão.');}
    finally{setApprovalSaving(false);}
  };

  const approve=async(d:Demand,approved=true)=>openApproval(d,approved);

  useEffect(()=>{setDemandPage(1)},[demandSearch,demandStatusFilter,demandApprovalFilter,demandPriorityFilter,demandClientFilter,demandPeriod]);

  const filtered=useMemo(()=>{
    const result=demands.filter(d=>{
      const text=`${d.numero} ${d.problema} ${d.tratamento} ${d.responsavel}`.toLowerCase();
      const demandClientId = (d as any).clientId ?? (d as any).client_id ?? ''; const matchesClient = demandClientFilter==='Todos' || String(demandClientId)===String(demandClientFilter);
      return text.includes(demandSearch.toLowerCase()) &&
        matchesClient &&
        (demandStatusFilter==='Todos'||normalizeStatus(d.status)===demandStatusFilter) &&
        (demandApprovalFilter==='Todas'||normalizeApproval(d.aprovacao)===demandApprovalFilter) &&
        (demandPriorityFilter==='Todas'||String(d.prioridade).trim().toLowerCase()===String(demandPriorityFilter).trim().toLowerCase()) &&
        (demandPeriod==='Todos'||getDeliveryMonthKey(d.deliveryDate || (d as any).delivery_date)===demandPeriod)
    });

    // Mais recente primeiro: número maior = demanda mais nova.
    return result.sort((a,b)=>Number(b.numero||0)-Number(a.numero||0));
  },[demands,demandSearch,demandStatusFilter,demandApprovalFilter,demandPriorityFilter,demandClientFilter,demandPeriod]);

  const demandPageCount=Math.max(1,Math.ceil(filtered.length/demandPageSize));
  const paginatedDemands=useMemo(()=>{
    const safePage=Math.min(demandPage,demandPageCount);
    const start=(safePage-1)*demandPageSize;
    return filtered.slice(start,start+demandPageSize);
  },[filtered,demandPage,demandPageCount]);

  useEffect(()=>{if(demandPage>demandPageCount)setDemandPage(demandPageCount)},[demandPage,demandPageCount]);

  const dashboardFilteredDemands=useMemo(()=>{
    return demands.filter(d=>{
      const demandClientId=(d as any).clientId ?? (d as any).client_id ?? '';
      const matchesClient=dashboardClientFilter==='Todos' ||
        String(demandClientId)===String(dashboardClientFilter);

      const matchesPeriod=dashboardPeriod==='Todos' ||
        getDeliveryMonthKey(
          d.deliveryDate || (d as any).delivery_date
        )===dashboardPeriod;

      return matchesClient && matchesPeriod;
    });
  },[demands,dashboardClientFilter,dashboardPeriod]);

  const dashboardLocalStats=useMemo(()=>{
    const list=dashboardFilteredDemands;

    const byStatus:Record<string,number>={};

    const statusPeriodMatches=(d:Demand)=>{
      if(dashboardPeriod==='Todos') return true;

      const status=normalizeStatus(d.status);

      if(status==='Analisada'){
        return String(d.analysisMonth || '').slice(0,7)===dashboardPeriod;
      }

      if(status==='Concluída'){
        return getDeliveryMonthKey(
          d.deliveryDate || (d as any).delivery_date
        )===dashboardPeriod;
      }

      return String(d.requestDate || '').slice(0,7)===dashboardPeriod;
    };

    statuses.forEach(status=>{
      byStatus[status]=demands.filter(d=>{
        const demandClientId=(d as any).clientId ?? (d as any).client_id ?? '';

        const matchesClient=dashboardClientFilter==='Todos' ||
          String(demandClientId)===String(dashboardClientFilter);

        return matchesClient &&
          normalizeStatus(d.status)===status &&
          statusPeriodMatches(d);
      }).length;
    });

    const approvedDemands=list.filter(
      d=>normalizeApproval(d.aprovacao)==='Aprovada'
    ).length;

    const rejectedDemands=list.filter(
      d=>normalizeApproval(d.aprovacao)==='Reprovada'
    ).length;

    const pendingApprovalDemands=list.filter(
      d=>normalizeApproval(d.aprovacao)==='Pendente'
    ).length;

    const analysisHours=demands
      .filter(d=>{
        const demandClientId=(d as any).clientId ?? (d as any).client_id ?? '';

        const matchesClient=dashboardClientFilter==='Todos' ||
          String(demandClientId)===String(dashboardClientFilter);

        const matchesAnalysisPeriod=dashboardPeriod==='Todos' ||
          String(d.analysisMonth || '').slice(0,7)===dashboardPeriod;

        return matchesClient &&
          normalizeStatus(d.status)==='Analisada' &&
          matchesAnalysisPeriod;
      })
      .reduce(
        (sum,d)=>sum+Number(d.horasAnalise||0),
        0
      );

    const requiredHours=list.reduce(
      (sum,d)=>sum+Number(d.horasNecessarias||0),0
    );

    const finishedDemands=list.filter(
      d=>normalizeStatus(d.status)==='Concluída'
    ).length;

    const finishedHours=list
      .filter(d=>normalizeStatus(d.status)==='Concluída')
      .reduce(
        (sum,d)=>sum+
          Number(d.horasAnalise||0)+
          Number(d.horasNecessarias||0),
        0
      );

    return {
      totalDemands:list.length,
      totalHours:analysisHours+requiredHours,
      analysisHours,
      requiredHours,
      approvedDemands,
      rejectedDemands,
      pendingApprovalDemands,
      pendingApprovalHoursTotal:list
        .filter(d=>normalizeApproval(d.aprovacao)==='Pendente')
        .reduce(
          (sum,d)=>sum+
            Number(d.horasAnalise||0)+
            Number(d.horasNecessarias||0),
          0
        ),
      finishedDemands,
      finishedHours,
      byStatus
    };
  },[dashboardFilteredDemands]);
const dashboardDemands=useMemo(()=>{
    return demands.filter(d=>{
      const demandClientId=(d as any).clientId ?? (d as any).client_id ?? '';
      const matchesClient=dashboardClientFilter==='Todos' ||
        String(demandClientId)===String(dashboardClientFilter);
      const matchesPeriod=dashboardPeriod==='Todos' ||
        getDeliveryMonthKey(d.deliveryDate || (d as any).delivery_date)===dashboardPeriod;
      return matchesClient && matchesPeriod;
    }).slice(0,5);
  },[demands,dashboardClientFilter,dashboardPeriod]);



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
    const header=['Nº','Cliente','Problema','Tratamento','Análise','Horas necessárias','Prioridade','Status','Aprovação','Aprovado em','Data de entrega','Aprovado por','Responsável','Pago'];
    const rows=filtered.map(d=>[d.numero,(d as any).clientName||'',d.problema,d.tratamento,d.horasAnalise,d.horasNecessarias,d.prioridade,d.status,d.aprovacao,d.aprovadoEm?new Date(d.aprovadoEm).toLocaleString('pt-BR'):'',formatDate(d.deliveryDate || (d as any).delivery_date),d.aprovadoPor,d.responsavel,d.pago?'Sim':'Não']);
    await navigator.clipboard.writeText([header,...rows].map(r=>r.join('\t')).join('\n'));setCopied(true);setTimeout(()=>setCopied(false),1600);
  };

  if(!token||!user)return <LoginScreen email={loginEmail} password={loginPassword} setEmail={setLoginEmail} setPassword={setLoginPassword} showPassword={showPassword} setShowPassword={setShowPassword} loading={loginLoading} error={loginError} onSubmit={login}/>;

  return <div className="hf-app">
    <style>{styles}</style>    
    {/* COMMAND CENTER MODAL */}
    {commandCenterOpen && (
      <div
        className="hf-command-backdrop"
        onMouseDown={(e)=>{
          if(e.target===e.currentTarget){
            setCommandCenterOpen(false);
            setCommandSearch('');
          }
        }}
      >
        <div className="hf-command-modal">
          <div className="hf-command-content">

            <div className="hf-command-section-title">
              Ações rápidas
            </div>

            <button
              type="button"
              className="hf-command-item"
              onClick={()=>{
                setCommandCenterOpen(false);
                setCommandSearch('');
                setTab('meu-dia');
              }}
            >
              <CalendarDays size={18}/>
              <div>
                <strong>Meu Dia</strong>
                <span>Ver sua central de trabalho</span>
              </div>
            </button>

            <button
              type="button"
              className="hf-command-item"
              onClick={()=>{
                setCommandCenterOpen(false);
                setCommandSearch('');
                setTab('demandas');
              }}
            >
              <BarChart3 size={18}/>
              <div>
                <strong>Demandas</strong>
                <span>Consultar e filtrar demandas</span>
              </div>
            </button>

            <button
              type="button"
              className="hf-command-item"
              onClick={()=>{
                setCommandCenterOpen(false);
                setCommandSearch('');
                setTab('dashboard');
              }}
            >
              <LayoutDashboard size={18}/>
              <div>
                <strong>Dashboard</strong>
                <span>Ver indicadores e resultados</span>
              </div>
            </button>

            {isInternal && (
              <button
                type="button"
                className="hf-command-item"
                onClick={()=>{
                  setCommandCenterOpen(false);
                  setCommandSearch('');
                  openNewDemand();
                }}
              >
                <Plus size={18}/>
                <div>
                  <strong>Nova demanda</strong>
                  <span>Criar uma nova demanda</span>
                </div>
              </button>
            )}

          </div>

          <div className="hf-command-footer">
            <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
            <span><kbd>Enter</kbd> selecionar</span>
            <span><kbd>Esc</kbd> fechar</span>
          </div>

        </div>
      </div>
    )}

    {/* FIM COMMAND CENTER MODAL */}
    {mobileMenu&&<div className="hf-overlay" onClick={()=>setMobileMenu(false)}/>}
    <aside className={`hf-sidebar ${mobileMenu?'open':''}`}>
      <div className="hf-brand-logo"><strong>Saphire</strong><span>Sheet</span></div>
      <nav>
        <Nav active={tab==='meu-dia'} icon={<CalendarDays size={18}/>} text="Meu Dia" onClick={()=>{setTab('meu-dia');setMobileMenu(false)}}/>
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
        <div><div className="hf-eyebrow">Saphire Sheet • Gestão</div><h1>
  {tab==='meu-dia'
    ? 'Meu Dia'
    : tab==='dashboard'
      ? 'Visão geral'
      : tab==='demandas'
        ? 'Demandas'
        : tab==='clientes'
          ? 'Clientes'
          : 'Usuários'}
</h1><p>
  {tab==='meu-dia'
    ? 'Organize seu trabalho e veja o que precisa da sua atenção.'
    : tab==='usuarios'
      ? 'Cadastre usuários e controle o acesso ao sistema.'
      : tab==='clientes'
        ? 'Gerencie empresas e vincule suas demandas.'
        : 'Acompanhe demandas, aprovações e horas desempenhadas.'}
</p></div>
        <div className="hf-top-actions">{(tab==='demandas'||tab==='dashboard')&&isInternal&&<button className="hf-primary" onClick={openNewDemand}><Plus size={17}/> Nova demanda</button>}{tab==='clientes'&&isAdmin&&<button className="hf-primary" onClick={()=>openClientModal()}><Plus size={17}/> Novo cliente</button>}<button
  type="button"
  className="hf-command-trigger"
  onClick={()=>{
    setCommandCenterOpen(true);
    setCommandSearch('');
  }}
>
  <Search size={16}/>
  <span>Busca rápida</span>
  <kbd>Ctrl K</kbd>
</button><button
  type="button"
  className="hf-saphire-ia-trigger" style={{position:"fixed",left:24,bottom:105,width:62,height:62,minWidth:62,maxWidth:62,padding:4,borderRadius:"50%",display:"grid",placeItems:"center",overflow:"visible",color:"transparent",fontSize:0}}
  onClick={()=>setSaphireIaOpen(true)}
  title="Saphire IA"
  aria-label="Abrir Saphire IA"
>
  <span className="hf-saphire-ia-trigger-gem">
    <SaphireGem size={21}/>
  </span>
  
</button><button
  type="button"
  className="hf-notification-trigger"
  onClick={()=>setNotificationsOpen(true)}
  title="Notificações"
  aria-label="Notificações"
>
  <Bell size={19}/>
  {unreadNotifications.length > 0 && (
    <span className="hf-notification-badge">
      {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
    </span>
  )}
</button>
<div className="hf-top-avatar">{user.name.slice(0,1).toUpperCase()}</div></div>
      </header>

      {apiError&&<div className="hf-alert"><AlertCircle size={18}/><span>{apiError}</span><button onClick={()=>{setApiError('');loadDemands();loadClients()}}><RefreshCw size={16}/></button></div>}

      {tab==='usuarios'&&<UsersPage users={users} clients={clients} loading={loading} onNew={openUserModal} onRefresh={loadUsers} isAdmin={isAdmin}/>}
      {tab==='clientes'&&<ClientsPage clients={clients} demands={demands} isAdmin={isAdmin} onNew={()=>openClientModal()} onEdit={openClientModal} onDemand={openEditDemand}/>}
      {tab==='meu-dia'?<>
          {(() => {
            const hoje = new Date();
            const hojeKey = hoje.toISOString().slice(0,10);

            // Base geral das demandas que o usuário pode visualizar
            const minhasDemandas = demands.filter(d => {
              if (isAdmin) {
                return true;
              }

              if (isClient) {
                const demandClientId =
                  (d as any).clientId ??
                  (d as any).client_id ??
                  '';

                const userClientId =
                  (user as any)?.clientId ??
                  (user as any)?.client_id ??
                  '';

                return String(demandClientId) === String(userClientId);
              }

              if (isInternal) {
                const responsavel =
                  String(d.responsavel || '').trim().toLowerCase();

                const nomeUsuario =
                  String(user?.name || '').trim().toLowerCase();

                return responsavel === nomeUsuario;
              }

              return false;
            });

            const aguardandoAnalise = minhasDemandas.filter(
              d => normalizeStatus(d.status) === 'Aguardando análise'
            ).length;

            const emAnalise = minhasDemandas.filter(
              d => normalizeStatus(d.status) === 'Em análise'
            ).length;

            const analisadas = minhasDemandas.filter(
              d => normalizeStatus(d.status) === 'Analisada'
            ).length;

            const emDesenvolvimento = minhasDemandas.filter(
              d => normalizeStatus(d.status) === 'Em desenvolvimento'
            ).length;

            const emHomologacao = minhasDemandas.filter(
              d => normalizeStatus(d.status) === 'Em homologação'
            ).length;

            const concluidas = minhasDemandas.filter(
              d => normalizeStatus(d.status) === 'Concluída'
            ).length;

            const pendentesAprovacao = minhasDemandas.filter(
              d => normalizeApproval(d.aprovacao) === 'Pendente'
            ).length;

            const entregasHoje = minhasDemandas.filter(d => {
              const entrega = String(
                d.deliveryDate || (d as any).delivery_date || ''
              ).slice(0,10);

              return entrega === hojeKey;
            }).length;

            const atrasadas = minhasDemandas.filter(d => {
              const entrega = String(
                d.deliveryDate || (d as any).delivery_date || ''
              ).slice(0,10);

              return entrega &&
                entrega < hojeKey &&
                !['Concluída','Reprovada'].includes(normalizeStatus(d.status));
            });

            const hojeDemandas = minhasDemandas.filter(d => {
              const entrega = String(
                d.deliveryDate || (d as any).delivery_date || ''
              ).slice(0,10);

              return entrega === hojeKey;
            });

            const emAndamento = minhasDemandas.filter(d =>
              ['Em análise','Em desenvolvimento','Em homologação'].includes(
                normalizeStatus(d.status)
              )
            );

            const aguardandoAcao = minhasDemandas.filter(d =>
              ['Aguardando aprovação','Aguardando análise'].includes(
                normalizeStatus(d.status)
              )
            );

            const filtrarDemandasPorStatus = (status:string) => {
  setDemandStatusFilter(normalizeStatus(status));
  setDemandSearch('');
  setDemandApprovalFilter('Todas');
  setDemandPriorityFilter('Todas');
  setDemandClientFilter('Todos');
  setDemandPeriod('Todos');
  setDemandPage(1);
  setDemandFiltersOpen(false);
  setTab('demandas');
};
const proximas = minhasDemandas
              .filter(d => {
                const entrega = String(
                  d.deliveryDate || (d as any).delivery_date || ''
                ).slice(0,10);

                return entrega >= hojeKey &&
                  !['Concluída','Reprovada'].includes(normalizeStatus(d.status));
              })
              .sort((a,b) => {
                const da = String(a.deliveryDate || (a as any).delivery_date || '');
                const db = String(b.deliveryDate || (b as any).delivery_date || '');
                return da.localeCompare(db);
              })
              .slice(0,5);

            const horasAnalisadas = minhasDemandas
              .filter(d => normalizeStatus(d.status) === 'Analisada')
              .reduce((sum,d) => sum + Number(d.horasAnalise || 0), 0);

            const horasNecessarias = minhasDemandas
              .reduce((sum,d) => sum + Number(d.horasNecessarias || 0), 0);

            return (
              <>
                <section className="hf-dashboard-header">
                  <div>
                    <div className="hf-eyebrow">Saphire Sheet • Central de trabalho</div>
                    <h1>Meu Dia</h1>
                    <p>
                      Olá, {user?.name?.split(' ')[0] || 'usuário'} 👋
                      Aqui está o que precisa da sua atenção.
                    </p>
                  </div>

                  <div className="hf-dashboard-actions">
                    {isInternal && (
                      <button className="hf-primary" onClick={openNewDemand}>
                        <Plus size={17}/>
                        Nova demanda
                      </button>
                    )}
                  </div>
                </section>

                <section
                  className="hf-dashboard-kpis"
                  style={{
                    display:"grid",
                    gridTemplateColumns:"repeat(4,minmax(0,1fr))",
                    gap:"16px",
                    width:"100%",
                    marginTop:"12px"
                  }}
                >
                  <Card
                    title="Aguardando análise"
                    value={aguardandoAnalise}
                    icon={<Clock3
                    onClick={()=>filtrarDemandasPorStatus("Aguardando análise")}/>}
                  />

                  <Card
                    title="Em análise"
                    value={emAnalise}
                    icon={<Search
                    onClick={()=>filtrarDemandasPorStatus("Em análise")}/>}
                  />

                  <Card
                    title="Analisadas"
                    value={analisadas}
                    icon={<CheckCircle2
                    onClick={()=>filtrarDemandasPorStatus("Analisada")}/>}
                  />

                  <Card
                    title="Em desenvolvimento"
                    value={emDesenvolvimento}
                    icon={<BarChart3
                    onClick={()=>filtrarDemandasPorStatus("Em desenvolvimento")}/>}
                  />

                  <Card
                    title="Em homologação"
                    value={emHomologacao}
                    icon={<Clipboard
                    onClick={()=>filtrarDemandasPorStatus("Em homologação")}/>}
                  />

                  <Card
                    title="Concluídas"
                    value={concluidas}
                    icon={<CheckCircle2
                    onClick={()=>filtrarDemandasPorStatus("Concluída")}/>}
                  />

                  <Card
                    title="Pendentes de aprovação"
                    value={pendentesAprovacao}
                    icon={<AlertCircle/>}
                  />

                  <Card
                    title="Entregas hoje"
                    value={entregasHoje}
                    icon={<CalendarDays/>}
                  />
                </section>

                <section
                  style={{
                    display:"grid",
                    gridTemplateColumns:"minmax(0,1.5fr) minmax(300px,.8fr)",
                    gap:"20px",
                    marginTop:"20px"
                  }}
                >
                  <div className="hf-panel">
                    <div className="hf-panel-title">
                      <div>
                        <h2>🎯 Precisa da sua atenção</h2>
                        <p>O que merece sua atenção primeiro.</p>
                      </div>

                      {atrasadas.length + hojeDemandas.length + aguardandoAcao.length > 0 && (
                        <span className="hf-filter-count">
                          {atrasadas.length + hojeDemandas.length + aguardandoAcao.length} pendências
                        </span>
                      )}
                    </div>

                    <div style={{
                      display:"flex",
                      flexDirection:"column",
                      gap:"10px"
                    }}>

                      {[...atrasadas,...hojeDemandas,...aguardandoAcao]
                        .filter((d,i,arr) =>
                          arr.findIndex(x => x.id === d.id) === i
                        )
                        .slice(0,6)
                        .map(d => {

                          const entrega = String(
                            d.deliveryDate ||
                            (d as any).delivery_date ||
                            ''
                          ).slice(0,10);

                          const status = normalizeStatus(d.status);

                          const isAtrasada =
                            atrasadas.some(x => x.id === d.id);

                          const isHoje =
                            hojeDemandas.some(x => x.id === d.id);

                          const isAguardando =
                            aguardandoAcao.some(x => x.id === d.id);

                          const label = isAtrasada
                            ? 'ATRASADA'
                            : isHoje
                              ? 'ENTREGA HOJE'
                              : isAguardando
                                ? 'AGUARDANDO AÇÃO'
                                : status;

                          return (
                            <div
                              key={d.id}
                              style={{
                                display:"flex",
                                alignItems:"center",
                                justifyContent:"space-between",
                                gap:"16px",
                                padding:"15px 16px",
                                border:"1px solid #e5eaf2",
                                borderRadius:"12px",
                                background:"#fff"
                              }}
                            >

                              <div style={{
                                minWidth:0,
                                flex:1
                              }}>

                                <div style={{
                                  display:"flex",
                                  alignItems:"center",
                                  gap:"8px",
                                  flexWrap:"wrap",
                                  marginBottom:"6px"
                                }}>

                                  <span style={{
                                    fontSize:"12px",
                                    fontWeight:700,
                                    color:"#64748b"
                                  }}>
                                    #{d.numero}
                                  </span>

                                  <span style={{
                                    fontSize:"12px",
                                    color:"#8b97a8"
                                  }}>
                                    {(d as any).clientName || 'Cliente'}
                                  </span>

                                  <span style={{
                                    fontSize:"10px",
                                    fontWeight:800,
                                    letterSpacing:".4px",
                                    padding:"4px 8px",
                                    borderRadius:"999px",
                                    background:
                                      isAtrasada
                                        ? "#fef2f2"
                                        : isHoje
                                          ? "#fff7ed"
                                          : "#fffbeb",
                                    color:
                                      isAtrasada
                                        ? "#dc2626"
                                        : isHoje
                                          ? "#ea580c"
                                          : "#b45309"
                                  }}>
                                    {label}
                                  </span>

                                </div>

                                <strong style={{
                                  display:"block",
                                  color:"#18243b",
                                  marginBottom:"7px",
                                  fontSize:"14px"
                                }}>
                                  {d.problema}
                                </strong>

                                <div style={{
                                  display:"flex",
                                  gap:"8px",
                                  flexWrap:"wrap",
                                  alignItems:"center",
                                  fontSize:"12px",
                                  color:"#8b97a8"
                                }}>
                                  <span>{status}</span>

                                  <span>•</span>

                                  <span>{d.prioridade}</span>

                                  {entrega && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        Entrega: {formatDate(entrega)}
                                      </span>
                                    </>
                                  )}
                                </div>

                              </div>

                              <button
                                className="hf-secondary"
                                onClick={() => {
                                  setTab('demandas');
                                  setDemandSearch(String(d.numero));
                                }}
                              >
                                Abrir
                              </button>

                            </div>
                          );
                        })}

                      {!atrasadas.length &&
                       !hojeDemandas.length &&
                       !aguardandoAcao.length && (
                        <div className="hf-empty">
                          <CheckCircle2 size={28}/>
                          <strong>Tudo em dia 🎉</strong>
                          <span>
                            Não há demandas exigindo sua atenção agora.
                          </span>
                        </div>
                      )}

                    </div>
                  </div>
                  <div className="hf-panel">
                    <div className="hf-panel-title">
                      <div>
                        <h2>📊 Meu resumo</h2>
                        <p>Seus principais números.</p>
                      </div>
                    </div>

                    <div style={{
                      display:"flex",
                      flexDirection:"column",
                      gap:"14px"
                    }}>
                      <div>
                        <span className="hf-dashboard-mini-label">
                          Minhas demandas
                        </span>
                        <strong style={{
                          display:"block",
                          fontSize:"28px",
                          color:"#18243b"
                        }}>
                          {minhasDemandas.length}
                        </strong>
                      </div>

                      <div>
                        <span className="hf-dashboard-mini-label">
                          Horas analisadas
                        </span>
                        <strong style={{
                          display:"block",
                          fontSize:"28px",
                          color:"#18243b"
                        }}>
                          {horasAnalisadas}h
                        </strong>
                      </div>

                      <div>
                        <span className="hf-dashboard-mini-label">
                          Horas necessárias
                        </span>
                        <strong style={{
                          display:"block",
                          fontSize:"28px",
                          color:"#18243b"
                        }}>
                          {horasNecessarias}h
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="hf-panel" style={{marginTop:"20px"}}>
                  <div className="hf-panel-title">
                    <div>
                      <h2>📅 Próximas entregas</h2>
                      <p>O que vem pela frente.</p>
                    </div>
                  </div>

                  <div style={{
                    display:"flex",
                    flexDirection:"column",
                    gap:"8px"
                  }}>
                    {proximas.map(d => (
                      <div
                        key={d.id}
                        style={{
                          display:"grid",
                          gridTemplateColumns:"110px 1fr auto",
                          gap:"16px",
                          alignItems:"center",
                          padding:"12px 0",
                          borderBottom:"1px solid #eef1f5"
                        }}
                      >
                        <strong>
                          {formatDate(d.deliveryDate)}
                        </strong>

                        <div>
                          <strong>{d.problema}</strong>
                          <div style={{
                            fontSize:"12px",
                            color:"#8b97a8",
                            marginTop:"3px"
                          }}>
                            #{d.numero} • {d.status}
                          </div>
                        </div>

                        <span>{d.prioridade}</span>
                      </div>
                    ))}

                    {!proximas.length && (
                      <div className="hf-empty">
                        Nenhuma próxima entrega encontrada.
                      </div>
                    )}
                  </div>
                </section>
              </>
            );
          })()}
        </> : null}
        {(tab==='dashboard'||tab==='demandas')&&<>
        {tab==='dashboard' ? (
          <section className="hf-filters hf-filters-clean">
            {isAdmin&&<select value={dashboardClientFilter} onChange={e=>setDashboardClientFilter(e.target.value)}><option value="Todos">Todos os clientes</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
            <select
  value={dashboardPeriod}
  onChange={e=>setDashboardPeriod(e.target.value)}
>
  <option value="Todos">Todos os períodos</option>

  {availablePeriods.map(period => (
    <option key={period} value={period}>
      {formatPeriod(period)}
    </option>
  ))}
</select>
            <span className="hf-filter-count">{dashboardLocalStats.totalDemands} demandas</span>
          </section>
        ) : (
          <section className="hf-filters hf-filters-clean">
            <div className="hf-search">
  <Search size={17}/>
  <input
    value={demandSearch}
    onChange={e=>setDemandSearch(e.target.value)}
    placeholder="Buscar..."
  />
</div>

<button
  type="button"
  className="hf-filter-trigger"
  onClick={()=>setDemandFiltersOpen(true)}
>
  <Filter size={16}/>
  Filtros
</button>
          </section>

          
        )}

        {demandFiltersOpen && (
          <div
            className="hf-filter-modal-backdrop"
            onMouseDown={e=>{
              if(e.target===e.currentTarget)setDemandFiltersOpen(false)
            }}
          >
            <div
              className="hf-filter-modal"
              onMouseDown={e=>e.stopPropagation()}
            >

              <div className="hf-filter-modal-header">
                <div>
                  <h3>Filtros</h3>
                  <p>Refine a listagem de demandas</p>
                </div>

                <button
                  type="button"
                  className="hf-filter-modal-close"
                  onClick={()=>setDemandFiltersOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="hf-filter-modal-body">

                <label>
                  <span>Status</span>
                  <select
                    value={demandStatusFilter}
                    onChange={e=>setDemandStatusFilter(e.target.value)}
                  >
                    <option value="Todos">Status</option>
                    {statuses.map(s=>
                      <option key={s} value={s}>{s}</option>
                    )}
                    {demands.some(d=>normalizeStatus(d.status)==='Pendente') &&
                      <option value="Pendente">Pendente</option>
                    }
                  </select>
                </label>

                <label>
                  <span>Aprovações</span>
                  <select
                    value={demandApprovalFilter}
                    onChange={e=>setDemandApprovalFilter(e.target.value)}
                  >
                    <option value="Todas">Aprovações</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Aprovada">Aprovada</option>
                    <option value="Reprovada">Reprovada</option>
                  </select>
                </label>

                <label>
                  <span>Prioridade</span>
                  <select
                    value={demandPriorityFilter}
                    onChange={e=>setDemandPriorityFilter(e.target.value)}
                  >
                    <option value="Todas">Prioridade</option>
                    {priorities.map(p=>
                      <option key={p}>{p}</option>
                    )}
                  </select>
                </label>

                <label>
                  <span>Cliente</span>
                    <select
                      value={demandClientFilter}
                      onChange={e=>setDemandClientFilter(e.target.value)}
                    >
                      <option value="Todos">Clientes</option>
                      {clients.map(c=>
                        <option key={c.id} value={c.id}>{c.name}</option>
                      )}
                    </select>
                  </label>

                <label>
                  <span>Períodos</span>
                  <select
                    value={demandPeriod}
                    onChange={e=>setDemandPeriod(e.target.value)}
                  >
                    <option value="Todos">Períodos</option>
                    {availablePeriods.map(period => (
      <option key={period} value={period}>
        {formatPeriod(period)}
      </option>
    ))}
                    
                  </select>
                </label>

              </div>

              <div className="hf-filter-modal-footer">

                <button
                  type="button"
                  className="hf-filter-clear"
                  onClick={()=>{
                    setDemandStatusFilter('Todos');
                    setDemandApprovalFilter('Todas');
                    setDemandPriorityFilter('Todas');
                    setDemandClientFilter('Todos');
                    setDemandPeriod('Todos');
                  }}
                >
                  Limpar filtros
                </button>

                <button
                  type="button"
                  className="hf-filter-apply"
                  onClick={()=>setDemandFiltersOpen(false)}
                >
                  Aplicar filtros
                </button>

              </div>

            </div>
          </div>
        )}
        {tab==='dashboard'?<>
          <section className="hf-dashboard-header">
            <div>
              
              <h1>Dashboard</h1>
              <p>Acompanhe demandas, horas e andamento das atividades.</p>
            </div>

            <div className="hf-dashboard-actions">
              <button className="hf-secondary" onClick={exportStatusReport}>
                <Clipboard size={15}/>
                Exportar Status Report
              </button>
            </div>
          </section>

                    
          <section
            className="hf-dashboard-kpis"
            style={{
              display:"grid",
              gridTemplateColumns:"repeat(3,minmax(0,1fr))",
              gap:"16px",
              width:"100%",
              marginTop:"12px"
            }}
          >
            <Card
              title="Horas analisadas"
              value={dashboardLoading?'…':`${dashboardLocalStats.analysisHours}h`}
              icon={<CheckCircle2/>}
            />

            <Card
              title="Horas concluídas"
              value={dashboardLoading?'…':`${dashboardLocalStats.finishedHours}h`}
              icon={<CheckCircle2/>}
            />

            <Card
  title="Total do mês"
  value={dashboardLoading
    ? '…'
    : `${(
        Number(dashboardLocalStats.analysisHours || 0) +
        Number(dashboardLocalStats.finishedHours || 0)
      ).toFixed(1)}h`}
  icon={<Clock3/>}
/>
          </section>

          <section
            className="hf-dashboard-secondary"
            style={{
              display:"grid",
              gridTemplateColumns:"repeat(4,minmax(0,1fr))",
              gap:"16px",
              width:"100%",
              marginTop:"12px",
              marginBottom:"20px"
            }}
          >
            <div
              style={{
                background:"#fff",
                border:"1px solid #e5eaf2",
                borderRadius:"14px",
                padding:"18px 20px",
                minHeight:"82px",
                display:"flex",
                flexDirection:"column",
                justifyContent:"center",
                boxSizing:"border-box",
                boxShadow:"0 3px 12px rgba(15,23,42,.035)"
              }}
            >
              <span className="hf-dashboard-mini-label">
                Total de demandas
              </span>
              <strong
                style={{
                  display:"block",
                  fontSize:"24px",
                  lineHeight:"1.1",
                  color:"#16233b",
                  fontWeight:700
                }}
              >
                {dashboardLoading?'…':dashboardLocalStats.totalDemands}
              </strong>
            </div>

            <div
              style={{
                background:"#fff",
                border:"1px solid #e5eaf2",
                borderRadius:"14px",
                padding:"18px 20px",
                minHeight:"82px",
                display:"flex",
                flexDirection:"column",
                justifyContent:"center",
                boxSizing:"border-box",
                boxShadow:"0 3px 12px rgba(15,23,42,.035)"
              }}
            >
              <span className="hf-dashboard-mini-label">
                Aprovadas
              </span>
              <strong
                style={{
                  display:"block",
                  fontSize:"24px",
                  lineHeight:"1.1",
                  color:"#16233b",
                  fontWeight:700
                }}
              >
                {dashboardLoading?'…':dashboardLocalStats.approvedDemands}
              </strong>
            </div>

            <div
              style={{
                background:"#fff",
                border:"1px solid #e5eaf2",
                borderRadius:"14px",
                padding:"18px 20px",
                minHeight:"82px",
                display:"flex",
                flexDirection:"column",
                justifyContent:"center",
                boxSizing:"border-box",
                boxShadow:"0 3px 12px rgba(15,23,42,.035)"
              }}
            >
              <span className="hf-dashboard-mini-label">
                Reprovadas
              </span>
              <strong
                style={{
                  display:"block",
                  fontSize:"24px",
                  lineHeight:"1.1",
                  color:"#16233b",
                  fontWeight:700
                }}
              >
                {dashboardLoading?'…':dashboardLocalStats.rejectedDemands}
              </strong>
            </div>

            <div
              style={{
                background:"#fff",
                border:"1px solid #e5eaf2",
                borderRadius:"14px",
                padding:"18px 20px",
                minHeight:"82px",
                display:"flex",
                flexDirection:"column",
                justifyContent:"center",
                boxSizing:"border-box",
                boxShadow:"0 3px 12px rgba(15,23,42,.035)"
              }}
            >
              <span className="hf-dashboard-mini-label">
                Pendentes de aprovação
              </span>
              <strong
                style={{
                  display:"block",
                  fontSize:"24px",
                  lineHeight:"1.1",
                  color:"#16233b",
                  fontWeight:700
                }}
              >
                {dashboardLoading
                  ? '…'
                  : `${dashboardLocalStats.pendingApprovalHoursTotal}h`}
              </strong>
            </div>
          </section>

          <section className="hf-grid2 hf-dashboard-main-grid">

            <div className="hf-panel hf-chart-panel">
              <PanelTitle title="Demandas por status"/>

              <div className="hf-status-chart" style={{
  display:"grid",
  gridTemplateColumns:"220px minmax(0,1fr)",
  alignItems:"center",
  gap:"30px",
  width:"100%",
  minHeight:"240px"
}}>

  <div style={{
    width:"210px",
    height:"210px",
    minWidth:"210px",
    minHeight:"210px",
    position:"relative",
    margin:"0 auto"
  }}>

    <div
      style={{
        position:"absolute",
        inset:"0",
        borderRadius:"50%",
        background:(() => {
          const total = dashboardLocalStats.totalDemands || 0;

          if (!total) return "#edf1f7";

          const colors:Record<string,string> = {
            "Aguardando análise":"#94a3b8",
            "Em análise":"#3b82f6",
            "Analisada":"#8b5cf6",
            "Em desenvolvimento":"#06b6d4",
            "Em homologação":"#f59e0b",
            "Concluída":"#22c55e"
          };

          let current = 0;

          const pieces = statuses
            .map((s) => {
              const count = dashboardLocalStats.byStatus[s] || 0;
              const percent = (count / total) * 100;
              const startPercent = current;
              const endPercent = current + percent;

              current = endPercent;

              return `${colors[s] || "#64748b"} ${startPercent}% ${endPercent}%`;
            })
            .filter(Boolean);

          return `conic-gradient(${pieces.join(",")})`;
        })()
      }}
    />

    <div style={{
      position:"absolute",
      top:"50%",
      left:"50%",
      transform:"translate(-50%,-50%)",
      width:"118px",
      height:"118px",
      borderRadius:"50%",
      background:"#fff",
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      justifyContent:"center",
      boxShadow:"0 2px 8px rgba(15,23,42,.06)"
    }}>
      <strong style={{
        fontSize:"32px",
        fontWeight:800,
        lineHeight:1,
        color:"#18243b"
      }}>
        {dashboardLocalStats.totalDemands}
      </strong>

      <span style={{
        marginTop:"6px",
        fontSize:"12px",
        color:"#8b97a8"
      }}>
        demandas
      </span>
    </div>

  </div>

  <div style={{
    display:"flex",
    flexDirection:"column",
    width:"100%",
    minWidth:"0"
  }}>

    {statuses.map((s) => {
      const count = dashboardLocalStats.byStatus[s] || 0;
      const total = dashboardLocalStats.totalDemands || 0;
      const percentage = total ? (count / total) * 100 : 0;

      const colors:Record<string,string> = {
        "Aguardando análise":"#94a3b8",
        "Em análise":"#3b82f6",
        "Analisada":"#8b5cf6",
        "Em desenvolvimento":"#06b6d4",
        "Em homologação":"#f59e0b",
        "Concluída":"#22c55e"
      };

      return (
          <div
            title={`${s}: ${count} demandas — ${percentage.toFixed(0)}%`}
          key={s}
          style={{
            display:"grid",
            gridTemplateColumns:"minmax(0,1fr) 45px 45px",
            alignItems:"center",
            minHeight:"42px",
            padding:"6px 8px",
            boxSizing:"border-box",
            borderBottom:"1px solid #edf0f5",
            borderRadius:"7px"
          }}
        >

          <div style={{
            display:"flex",
            alignItems:"center",
            gap:"10px",
            fontSize:"14px",
            color:"#334155"
          }}>
            <span style={{
              width:"10px",
              height:"10px",
              minWidth:"10px",
              borderRadius:"50%",
              background:colors[s] || "#64748b"
            }} />

            <span>{s}</span>
          </div>

          <strong style={{
            textAlign:"right",
            fontSize:"14px",
            fontWeight:700,
            color:"#18243b"
          }}>
            {count}
          </strong>

          <small style={{
            textAlign:"right",
            fontSize:"12px",
            color:"#8b97a8"
          }}>
            {percentage.toFixed(0)}%
          </small>

        </div>
      );
    })}

  </div>

</div>
            </div></section>

          <section className="hf-panel hf-dashboard-demand-panel hf-ultimas-demandas">
            <div className="hf-panel-title">
              <div>
                
                <h2>Últimas demandas</h2>
                <p className="hf-muted">
                  Acompanhe as demandas mais recentes.
                </p>
              </div>

              <button
                className="hf-link"
                onClick={()=>setTab('demandas')}
              >
                Ver todas →
              </button>
            </div>

            <DemandTable
              demands={dashboardDemands}
              remove={removeDemand}
              approve={approve}
              history={openHistory}
              canEdit={isInternal}
              canApprove={isAdmin||isClient}
              onEdit={openEditDemand}
              isClient={isClient}
              clients={clients}
            />
          </section>

        </>:<section className="hf-panel"><div className="hf-panel-title"><div><h2>Planilha de demandas</h2>
<div className="hf-view-switcher">
  <button type="button" className={demandView==='table'?'active':''} onClick={()=>setDemandView('table')}>
    <span>☷</span> Tabela
  </button>
  <button type="button" className={demandView==='cards'?'active':''} onClick={()=>setDemandView('cards')}>
    <span>▦</span> Cards
  </button>
  <button type="button" className={demandView==='kanban'?'active':''} onClick={()=>setDemandView('kanban')}>
    <span>▤</span> Kanban
  </button>
</div><p className="hf-muted">{filtered.length} demandas • {totalHours}h totais</p></div><div className="hf-actions"><button className="hf-secondary" onClick={copyTable}><Clipboard size={15}/>{copied?'Copiado!':'Copiar tabela'}</button>{isInternal&&<button className="hf-primary compact" onClick={openNewDemand}><Plus size={16}/> Nova</button>}</div></div>{demandView==="cards"
  ? <DemandCardsView demands={paginatedDemands} clients={clients} onOpen={openEditDemand}/>
  : demandView==="kanban"
    ? <DemandKanbanView demands={filtered} clients={clients} onOpen={openEditDemand}/>
    : <DemandTable
        demands={paginatedDemands}
        remove={removeDemand}
        approve={approve}
        history={openHistory}
        canEdit={isInternal}
        canApprove={isAdmin||isClient}
        onEdit={openEditDemand}
        isClient={isClient}
        clients={clients}
      />}<div className="hf-pagination"><span>Mostrando {filtered.length ? ((demandPage-1)*demandPageSize)+1 : 0}-{Math.min(demandPage*demandPageSize,filtered.length)} de {filtered.length}</span><div><button className="hf-page-btn" disabled={demandPage<=1} onClick={()=>setDemandPage(p=>Math.max(1,p-1))}>Anterior</button>{Array.from({length:demandPageCount},(_,i)=>i+1).slice(Math.max(0,demandPage-3),Math.min(demandPageCount,demandPage+2)).map(page=><button key={page} className={`hf-page-btn ${page===demandPage?'active':''}`} onClick={()=>setDemandPage(page)}>{page}</button>)}<button className="hf-page-btn" disabled={demandPage>=demandPageCount} onClick={()=>setDemandPage(p=>Math.min(demandPageCount,p+1))}>Próxima</button></div></div><div className="hf-totals"><strong>Totais</strong><span>{filtered.length} demandas</span><span>Análise: <b>{totalAnalysis}h</b></span><span>Necessárias: <b>{totalNeeded}h</b></span><span>Total: <b>{totalHours}h</b></span></div></section>}
      </>}
    </main>

    {approvalDemand&&<ApprovalModal demand={approvalDemand} month={approvalMonth} setMonth={setApprovalMonth} reason={approvalReason} setReason={setApprovalReason} saving={approvalSaving} close={closeApproval} confirm={confirmApproval} type={approvalType}/>}
    {historyDemand&&<HistoryModal demand={historyDemand} loading={historyLoading} close={()=>setHistoryDemand(null)}/>}
    {userModal&&<UserModal value={newUser} setValue={setNewUser} clients={clients} error={userError} saving={userSaving} close={closeUserModal} save={saveUser}/>}
    {clientModal&&<ClientModal value={clientForm} setValue={setClientForm} editing={editingClient} error={clientError} saving={clientSaving} close={()=>setClientModal(false)} save={saveClient}/>}
    {saphireIaOpen&&<SaphireIAModal
      user={user}
      close={()=>setSaphireIaOpen(false)}
      clientId={dashboardClientFilter}
      period={dashboardPeriod}
    />}    {notificationsOpen&&<NotificationsModal
      notifications={notifications}
      close={()=>setNotificationsOpen(false)}
      openDemand={openEditDemand}
      markAsRead={markNotificationAsRead}
      readIds={notificationReadIds}
      setReadIds={setNotificationReadIds}
      clearedIds={notificationClearedIds}
      setClearedIds={setNotificationClearedIds}
      notificationStorageKey={notificationStorageKey}
    />}
    {demandModal&&<DemandModal value={demandForm} setValue={setDemandForm} clients={clients} users={users} editing={editingDemand} isClient={isClient} error={demandError} saving={demandSaving} success={demandSuccess} close={()=>setDemandModal(false)} save={saveDemand} approve={approve}/>}
  </div>;
}

function LoginScreen({email,password,setEmail,setPassword,showPassword,setShowPassword,loading,error,onSubmit}:{email:string;password:string;setEmail:(v:string)=>void;setPassword:(v:string)=>void;showPassword:boolean;setShowPassword:(v:boolean)=>void;loading:boolean;error:string;onSubmit:(e:React.FormEvent)=>void}){
  return <div className="hf-login"><style>{styles}</style><div className="hf-login-decoration one"/><div className="hf-login-decoration two"/><div className="hf-login-card"><div className="hf-login-brand"><strong>Saphire</strong><span>Sheet</span></div><div className="hf-login-copy"><h1>Bem-vinda de volta</h1><p>Entre para acompanhar suas demandas, horas e aprovações.</p></div><form onSubmit={onSubmit}><label>E-mail<div className="hf-input"><Mail size={18}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="username" required/></div></label><label>Senha<div className="hf-input"><LockKeyhole size={18}/><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" autoComplete="current-password" required/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{error&&<div className="hf-login-error"><AlertCircle size={16}/>{error}</div>}<button className="hf-login-button" disabled={loading}>{loading?'Entrando...':'Entrar'}<span>→</span></button></form><div className="hf-login-footer">Acesso seguro • Saphire Sheet</div></div></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
function UsersPage({users,clients,loading,onNew,onRefresh,isAdmin}:{users:User[];clients:Client[];loading:boolean;onNew:()=>void;onRefresh:()=>void;isAdmin:boolean}){
  if(!isAdmin)return <div className="hf-panel hf-empty-page"><ShieldCheck size={40}/><h2>Acesso restrito</h2><p>Apenas administradores podem gerenciar usuários.</p></div>;
  return <section className="hf-panel"><div className="hf-panel-title"><div><h2>Usuários</h2><p className="hf-muted">Cadastre pessoas e defina o nível de acesso.</p></div><div className="hf-actions"><button className="hf-secondary" onClick={onRefresh}><RefreshCw size={15}/> Atualizar</button><button className="hf-primary" onClick={onNew}><UserPlus size={17}/> Novo usuário</button></div></div>{loading?<div className="hf-loading">Carregando usuários...</div>:users.length===0?<div className="hf-empty-page"><Users size={38}/><h3>Nenhum usuário encontrado</h3><p>Comece cadastrando o primeiro usuário.</p><button className="hf-primary" onClick={onNew}><UserPlus size={16}/> Cadastrar usuário</button></div>:<div className="hf-user-grid">{users.map(u=><div className="hf-user-card" key={u.id}><div className="hf-user-card-top"><div className="hf-avatar big">{u.name.slice(0,1).toUpperCase()}</div><span className={`hf-role role-${u.role.toLowerCase()}`}>{roleLabel(u.role)}</span></div><h3>{u.name}</h3><p>{u.email}</p>{u.role==='CLIENTE'&&<div className="hf-client-tag"><Building2 size={14}/>{u.clientName||`Cliente #${u.clientId}`}</div>}<div className="hf-user-status"><span className={Boolean(u.active)?'active':''}/>{Boolean(u.active)?'Ativo':'Inativo'}</div></div>)}</div>}</section>;
}

function UserModal({value,setValue,clients,error,saving,close,save}:{value:any;setValue:(v:any)=>void;clients:Client[];error:string;saving:boolean;close:()=>void;save:(e:React.FormEvent)=>void}){
  const [showPassword,setShowPassword]=useState(false);

  useEffect(()=>{setShowPassword(false)},[value.name,value.email]);

  return <div className="hf-modal-backdrop">
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
function Card({title,value,icon,onClick}:{title:string;value:string|number;icon:React.ReactNode;onClick?:()=>void}){return <div className="hf-card" onClick={onClick} role={onClick?"button":undefined} tabIndex={onClick?0:undefined} onKeyDown={e=>{if(onClick&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onClick()}}} style={onClick?{cursor:"pointer"}:undefined}><div className="hf-card-icon">{icon}</div><span>{title}</span><strong>{value}</strong></div>}
function slug(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll(' ','-')}
function formatApprovalDate(value:any){if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString('pt-BR')}
function formatDate(value:any){
  if(!value)return '—';
  const raw=String(value);
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(match)return `${match[3]}/${match[2]}/${match[1]}`;
  const br=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(br)return raw;
  return raw;
}
function getDeliveryMonthKey(value:any){
  if(!value)return '';
  const raw=String(value);
  const match=raw.match(/^(\d{4})-(\d{2})/);
  if(match)return `${match[1]}-${match[2]}`;
  const br=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(br)return `${br[3]}-${br[2]}`;
  return '';
}

function roleLabel(r:Role){return r==='ADMIN'?'Administrador':r==='INTERNO'?'Interno':'Cliente'}

function DemandKanbanView({demands,clients,onOpen}:{demands:Demand[];clients:Client[];onOpen:(d:Demand)=>void}){
  const columns=[
    'Aguardando análise',
    'Em análise',
    'Analisada',
    'Em desenvolvimento',
    'Em homologação',
    'Concluída'
  ];

  return <div className="hf-kanban">
    {columns.map(column=>{
      const items=demands.filter(d=>
        normalizeStatus(d.status)===normalizeStatus(column)
      );

      return <section
        className="hf-kanban-column"
        key={column}
      >
        <div className="hf-kanban-column-head">
          <div>
            <strong>{column}</strong>
            <span>{items.length}</span>
          </div>
        </div>

        <div className="hf-kanban-list">
          {items.length===0 ? (
            <div className="hf-kanban-empty">
              Nenhuma demanda
            </div>
          ) : (
            items.map(d=>
              <button
                type="button"
                className="hf-kanban-card"
                key={d.id}
                onClick={()=>onOpen(d)}
              >
                <div className="hf-kanban-card-top">
                  <span>
                    #{String(d.numero).padStart(3,'0')}
                  </span>

                  <b>
                    {d.prioridade||'—'}
                  </b>
                </div>

                <strong>
                  {d.problema||'Sem descrição da demanda'}
                </strong>

                <p>
                  {(() => {
                    const clientId = (d as any).clientId ?? (d as any).client_id;
                    const client = clients.find(
                      (c:any) => String(c.id) === String(clientId)
                    );
                    return client?.name || (d as any).clientName || (d as any).client_name || 'Cliente não informado';
                  })()}
                </p>

                <div className="hf-kanban-card-footer">
                  <span>
                    {d.horasNecessarias||0}h
                  </span>

                  <span>
                    {d.responsavel||'Sem responsável'}
                  </span>
                </div>
              </button>
            )
          )}
        </div>
      </section>
    })}
  </div>
}
function DemandTable({demands,remove,approve,history,canEdit,canApprove,onEdit,isClient,clients}:{demands:Demand[];remove:(id:string)=>void;approve:(d:Demand,approved?:boolean)=>void;history:(d:Demand)=>void;canEdit:boolean;canApprove:boolean;onEdit:(d:Demand)=>void;isClient:boolean;clients:any[]}){
  return <div className="hf-table-wrap"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Problema</th><th>Tratamento</th><th>Horas</th><th>Prioridade</th><th>Status</th><th>Aprovação</th><th>Motivo</th><th>Data de entrega</th><th>Responsável</th><th>Pago</th><th className="actions-head">Ações</th></tr></thead><tbody>{demands.map(d=><tr key={d.id}>
    <td className="number"><span className="hf-number-badge">#{String(d.numero).padStart(3,'0')}</span></td>
    <td>
  {(() => {
    const clientId = (d as any).clientId ?? (d as any).client_id;
    const client = clients.find(
      (c:any) => String(c.id) === String(clientId)
    );

    const clientName =
      (d as any).clientName ||
      (d as any).client_name ||
      client?.name ||
      'Cliente não informado';

    return (
      <span
        className="hf-client-cell"
        title={String(clientName).trim()}
      >
        {clientName === 'Cliente não informado'
          ? '—'
          : clientName}
      </span>
    );
  })()}
</td>
    <td><div className="hf-demand-text" title={d.problema}>{d.problema||'—'}</div></td>
    <td><div className="hf-demand-text" title={d.tratamento}>{d.tratamento||'—'}</div></td>
    <td>
  <div className="hf-hours-tooltip">
    <div className="hf-hours-cell">
      <b>{d.horasAnalise + d.horasNecessarias}h</b>
    </div>

    <div className="hf-hours-tooltip-content">
      <div className="hf-hours-tooltip-title">Horas</div>

      <div className="hf-hours-tooltip-row">
        <span>Análise</span>
        <b>{d.horasAnalise}h</b>
      </div>

      <div className="hf-hours-tooltip-row">
        <span>Necessárias</span>
        <b>{d.horasNecessarias}h</b>
      </div>

      <div className="hf-hours-tooltip-total">
        <span>Total</span>
        <b>{d.horasAnalise + d.horasNecessarias}h</b>
      </div>
    </div>
  </div>
</td>
    <td><span className={`hf-priority-pill priority-${slug(d.prioridade)}`}>{d.prioridade}</span></td>
    <td><span className={`hf-status-pill status-${slug(normalizeStatus(d.status))}`}>{normalizeStatus(d.status)}</span></td>
    <td>{d.aprovacao==='Aprovada'?<span className="hf-pill approved">Aprovada</span>:d.aprovacao==='Reprovada'?<span className="hf-pill rejected">Reprovada</span>:canApprove?<div className="hf-approval-actions"><button className="hf-approve" onClick={()=>approve(d,true)}>Aprovar</button><button className="hf-reject" onClick={()=>approve(d,false)}>Reprovar</button></div>:<span className="hf-pill pending">Pendente</span>}</td>
    <td>{d.aprovacao==='Reprovada'?<span className="hf-rejection-reason" title={d.rejectionReason||'Sem motivo informado'}>{d.rejectionReason||'Sem motivo informado'}</span>:<span className="hf-muted">—</span>}</td>
    <td><span className={d.deliveryDate?'hf-execution':'hf-muted'}>{formatDate(d.deliveryDate || (d as any).delivery_date)}</span></td>
    <td>{d.responsavel||'—'}</td>
    <td><span className={`hf-paid-dot ${d.pago?'on':''}`}><i/>{d.pago?'Sim':'Não'}</span></td>
    <td><div className="hf-row-actions">
      <button className="hf-action-btn" onClick={()=>history(d)} title="Ver histórico"><History size={15}/><span>Histórico</span></button>
      {isClient&&<button className="hf-action-btn primary" onClick={()=>onEdit(d)} title="Visualizar demanda"><Eye size={15}/><span>Visualizar</span></button>}
      {canEdit&&<button className="hf-action-btn primary" onClick={()=>onEdit(d)} title="Editar demanda"><Clipboard size={15}/><span>Editar</span></button>}
      {canEdit&&<button className="hf-action-btn danger" onClick={()=>remove(d.id)} title="Excluir demanda"><Trash2 size={15}/><span>Excluir</span></button>}
    </div></td>
  </tr>)}</tbody></table>{!demands.length&&<div className="hf-empty"><Search size={28}/><strong>Nenhuma demanda encontrada</strong><span>Ajuste os filtros ou crie uma nova demanda.</span></div>}</div>
}

function DemandCardsView({demands,clients,onOpen}:{demands:Demand[];clients:Client[];onOpen:(d:Demand)=>void}){
  if(!demands.length)return <div className="hf-empty-page"><h3>Nenhuma demanda encontrada</h3><p>Ajuste os filtros para visualizar outras demandas.</p></div>;

  return <div className="hf-demand-cards">
    {demands.map(d=>{
      const statusClass=String(d.status||'').toLowerCase().replace(/\s+/g,'-').replace(/[áã]/g,'a').replace(/ç/g,'c');

      return <button
        type="button"
        className="hf-demand-card"
        key={d.id}
        onClick={()=>onOpen(d)}
      >
        <div className="hf-demand-card-top">
          <span className="hf-demand-number">#{String(d.numero).padStart(3,'0')}</span>
          <span className={"hf-demand-status "+statusClass}>{d.status}</span>
        </div>

        <div className="hf-demand-card-client">
          {(() => {
            const clientId = (d as any).clientId ?? (d as any).client_id;
            const client = clients.find(
              (c:any) => String(c.id) === String(clientId)
            );
            return client?.name || (d as any).clientName || (d as any).client_name || 'Cliente não informado';
          })()}
        </div>

        <h3>{d.problema||'Sem descrição da demanda'}</h3>

        <p>{d.tratamento||'Sem tratamento informado.'}</p>

        <div className="hf-demand-card-footer">
          <span>
            <small>Horas</small>
            <strong>{d.horasNecessarias||0}h</strong>
          </span>

          <span>
            <small>Prioridade</small>
            <strong>{d.prioridade||'—'}</strong>
          </span>

          <span>
            <small>Responsável</small>
            <strong>{d.responsavel||'—'}</strong>
          </span>
        </div>
      </button>
    })}
  </div>
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
  return <div className="hf-modal-backdrop"><div className="hf-modal user-modal">
    <div className="hf-modal-head"><div><span className="hf-eyebrow">Cadastro de empresa</span><h2>{editing?'Editar cliente':'Novo cliente'}</h2><p>Cadastre a empresa que poderá receber usuários e demandas.</p></div><button onClick={close}><X size={20}/></button></div>
    <form onSubmit={save} className="hf-form"><label>Nome da empresa<input value={value.name} onChange={e=>setValue({...value,name:e.target.value})} placeholder="Ex.: ABHO" autoComplete="off"/></label><label>E-mail<input type="email" value={value.email} onChange={e=>setValue({...value,email:e.target.value})} placeholder="contato@empresa.com.br" autoComplete="off"/></label>
    {error&&<div className="hf-login-error"><AlertCircle size={16}/>{error}</div>}<div className="hf-form-actions"><button type="button" className="hf-secondary" onClick={close}>Cancelar</button><button className="hf-primary" disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Cadastrar empresa'}</button></div></form>
  </div></div>
}


function NotificationsModal({
  notifications,
  close,
  openDemand,
  markAsRead,
  readIds,
  setReadIds,
  clearedIds,
  setClearedIds,
  notificationStorageKey
}:{
  notifications:any[];
  close:()=>void;
  openDemand:(d:Demand)=>void;
  markAsRead:(id:string)=>void;
  readIds:string[];
  setReadIds:(ids:string[])=>void;
  clearedIds:string[];
  setClearedIds:(ids:string[])=>void;
  notificationStorageKey:string;
}){

  const [filter,setFilter] =
    useState<'todas'|'nao-lidas'|'lidas'>('todas');

  const activeNotifications =
    notifications.filter(
      (notification:any)=>
        !clearedIds.includes(notification.id)
    );

  const filteredNotifications =
    activeNotifications.filter((notification:any)=>{

      const isRead =
        readIds.includes(notification.id);

      if(filter==='nao-lidas'){
        return !isRead;
      }

      if(filter==='lidas'){
        return isRead;
      }

      return true;

    });

  const unreadCount =
    activeNotifications.filter(
      (notification:any)=>
        !readIds.includes(notification.id)
    ).length;

  const clearNotifications = ()=>{

    if(!window.confirm(
      'Deseja limpar todas as notificações?'
    )){
      return;
    }

    const allIds =
      notifications.map(
        (notification:any)=>notification.id
      );

    const updatedCleared =
      Array.from(
        new Set([
          ...clearedIds,
          ...allIds
        ])
      );

    localStorage.setItem(
      `${notificationStorageKey}-cleared`,
      JSON.stringify(updatedCleared)
    );

    setClearedIds(updatedCleared);

  };

  return <div className="hf-modal-backdrop">

    <div className="hf-notifications-modal">

      <div className="hf-notifications-head">

        <div>

          <div className="hf-notifications-title">
            <Bell size={19}/>
            <strong>Notificações</strong>
          </div>

          <span>
            {unreadCount === 0
              ? 'Tudo em dia'
              : `${unreadCount} não lida${unreadCount===1?'':'s'}`
            }
          </span>

        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Fechar notificações"
        >
          <X size={19}/>
        </button>

      </div>

      <div className="hf-notifications-toolbar">

        <div className="hf-notification-tabs">

          <button
            type="button"
            className={filter==='todas'?'active':''}
            onClick={()=>setFilter('todas')}
          >
            Todas
          </button>

          <button
            type="button"
            className={filter==='nao-lidas'?'active':''}
            onClick={()=>setFilter('nao-lidas')}
          >
            Não lidas
            {unreadCount > 0 &&
              <span>{unreadCount}</span>
            }
          </button>

          <button
            type="button"
            className={filter==='lidas'?'active':''}
            onClick={()=>setFilter('lidas')}
          >
            Lidas
          </button>

        </div>

        {notifications.length > 0 && (

          <button
            type="button"
            className="hf-notifications-clear"
            onClick={clearNotifications}
          >
            Limpar notificações
          </button>

        )}

      </div>

      <div className="hf-notifications-list">

        {filteredNotifications.length === 0 ? (

          <div className="hf-notifications-empty">

            <Bell size={28}/>

            <strong>
              {filter==='nao-lidas'
                ? 'Nenhuma notificação não lida'
                : filter==='lidas'
                  ? 'Nenhuma notificação lida'
                  : 'Nenhuma notificação'
              }
            </strong>

            <span>
              {filter==='nao-lidas'
                ? 'Você está em dia.'
                : 'Não há notificações para exibir.'
              }
            </span>

          </div>

        ) : (

          filteredNotifications.map(
            (notification:any)=>{

              const isRead =
                readIds.includes(notification.id);

              return (

                <button
                  type="button"
                  className={`hf-notification-item ${notification.type} ${isRead?'read':'unread'}`}
                  key={notification.id}
                  onClick={()=>{

                    markAsRead(notification.id);

                    close();

                    openDemand(notification.demand);

                  }}
                >

                  <div className="hf-notification-item-icon">

                    {notification.type==='approval' &&
                      <AlertCircle size={18}/>
                    }

                    {notification.type==='assigned' &&
                      <Users size={18}/>
                    }

                    {notification.type==='deadline' &&
                      <CalendarDays size={18}/>
                    }

                    {notification.type==='info' &&
                      <Bell size={18}/>
                    }

                  </div>

                  <div className="hf-notification-item-content">

                    <strong>
                      {notification.title}
                    </strong>

                    <span>
                      {notification.description}
                    </span>

                  </div>

                  {!isRead &&
                    <span className="hf-notification-unread-dot"/>
                  }

                  <span className="hf-notification-arrow">
                    →
                  </span>

                </button>

              );

            }
          )

        )}

      </div>

    </div>

  </div>;
}

function DemandModal({value,setValue,clients,users,editing,isClient,error,saving,success,close,save,approve}:{value:any;setValue:(v:any)=>void;clients:Client[];users:User[];editing:Demand|null;isClient:boolean;error:string;saving:boolean;success:string;close:()=>void;save:(e:React.FormEvent)=>void;approve:(d:Demand,approved?:boolean)=>void}){
  const readonly=isClient;
  const demandForApproval=editing;

  return <div className="hf-modal-backdrop">
    <div className="hf-modal hf-demand-modal">

      {success && (
        <div className="hf-action-success">

          <div className="hf-action-success-icon">
            <CheckCircle2 size={30}/>
          </div>

          <strong>{success}</strong>

          <span>
            A operação foi registrada com sucesso.
          </span>

        </div>
      )}

      <div className="hf-modal-head">
        <div>
          <span className="hf-eyebrow">{isClient?'Visualização da demanda':editing?'Edição de demanda':'Nova demanda'}</span>
          <h2>{isClient?'Detalhes da demanda':editing?'Editar demanda':'Criar nova demanda'}</h2>
          <p>{isClient?'Consulte os detalhes e altere somente a prioridade.':'Preencha as informações para registrar ou editar a demanda.'}</p>
        </div>
        <button type="button" onClick={close}><X size={20}/></button>
      </div>

      <form onSubmit={save} className="hf-form hf-demand-form">
        <div className="hf-form-section">
          <div className="hf-section-title"><span>01</span><div><strong>Identificação</strong><small>{readonly?'Informações da demanda':'Vincule a demanda e descreva o problema.'}</small></div></div>
          <label><span>Cliente</span>
            <select value={value.clientId} onChange={e=>setValue({...value,clientId:e.target.value})} disabled={readonly||Boolean(editing)}>
              <option value="">Selecione o cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label><span>Problema</span>
            <textarea value={value.problema} onChange={e=>setValue({...value,problema:e.target.value})} placeholder="Descreva de forma clara o problema ou necessidade..." rows={3} readOnly={readonly}/>
          </label>
          <label><span>Tratamento</span>
            <textarea value={value.tratamento} onChange={e=>setValue({...value,tratamento:e.target.value})} placeholder="Descreva como a demanda será tratada..." rows={3} readOnly={readonly}/>
          </label>
        </div>

        <div className="hf-form-section">
          <div className="hf-section-title"><span>02</span><div><strong>Estimativa e classificação</strong><small>{readonly?'Consulte as estimativas e ajuste somente a prioridade.':'Defina horas, prioridade e status.'}</small></div></div>          <div className="hf-form-grid">

            <label>
              <span>Horas de análise</span>
              <div className="hf-input-suffix">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={value.horasAnalise}
                  readOnly={readonly}
                  onChange={e=>setValue({...value,horasAnalise:e.target.value})}
                  placeholder="0"
                />
                <small>horas</small>
              </div>
            </label>

            <label>
              <span>Mês de análise</span>
              <input
                type="month"
                value={value.analysisMonth||''}
                readOnly={readonly}
                onChange={e=>setValue({...value,analysisMonth:e.target.value})}
              />
            </label>

          </div>

          <div className="hf-form-grid">

            <label>
              <span>Horas necessárias</span>
              <div className="hf-input-suffix">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={value.horasNecessarias}
                  readOnly={readonly}
                  onChange={e=>setValue({...value,horasNecessarias:e.target.value})}
                  placeholder="0"
                />
                <small>horas</small>
              </div>
            </label>

            <label>
              <span>Data de entrega</span>
              <input
                type="date"
                value={value.deliveryDate||''}
                readOnly={readonly}
                onChange={e=>setValue({...value,deliveryDate:e.target.value})}
              />
            </label>

          </div>

          <div className="hf-form-grid">

            <label>
              <span>Prioridade {readonly&&<small className="hf-muted"> · editável</small>}</span><select value={value.prioridade} onChange={e=>setValue({...value,prioridade:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select></label>
            <label><span>Status</span><select value={value.status} onChange={e=>setValue({...value,status:e.target.value})} disabled={readonly}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
          </div>
          <label>
  <span>Responsável</span>
  <select
    value={value.responsavel}
    onChange={e=>setValue({...value,responsavel:e.target.value})}
    disabled={readonly}
  >
    <option value="">Selecione o responsável</option>
    {users
      .filter((u:any)=>Boolean(u.active))
      .map((u:any)=>(
        <option key={u.id} value={u.name}>
          {u.name}
        </option>
      ))}
  </select>
</label>
        </div>

        {editing&&<div className="hf-form-section">
          <div className="hf-section-title"><span>03</span><div><strong>Resultado da aprovação</strong><small>Informações atuais da análise da demanda.</small></div></div>
          <div className="hf-form-grid">
            <label><span>Aprovação</span><input value={editing.aprovacao||'Pendente'} readOnly/></label>
            <label><span>Data de entrega</span><input value={formatDate(editing.deliveryDate||'')} readOnly/></label>
          </div>
          <label><span>Motivo da reprovação</span><textarea value={editing.rejectionReason||'—'} readOnly rows={2}/></label>
        </div>}

        {error&&<div className="hf-form-error"><AlertCircle size={17}/><span>{error}</span></div>}

        <div className="hf-form-actions">
          <button type="button" className="hf-secondary" onClick={close}>Fechar</button>
          {isClient&&editing&&<>
            {editing.aprovacao==='Pendente'&&<button type="button" className="hf-primary" onClick={()=>approve(editing,true)}><CheckCircle2 size={16}/> Aprovar demanda</button>}
            <button className="hf-primary" disabled={saving}>{saving?'Salvando...':'Salvar prioridade'}</button>
          </>}
          {!isClient&&<button className="hf-primary" disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Criar demanda'}</button>}
        </div>
      </form>
    </div>
  </div>
}

function ApprovalModal({demand,month,setMonth,reason,setReason,saving,close,confirm,type}:{demand:Demand;month:string;setMonth:(v:string)=>void;reason:string;setReason:(v:string)=>void;saving:boolean;close:()=>void;confirm:()=>void;type:'approve'|'reject'}){
  const approving=type==='approve';
  return <div className="hf-modal-backdrop">
    <div className="hf-modal hf-decision-modal">
      <div className="hf-modal-head">
        <div><span className="hf-eyebrow">{approving?'Aprovação':'Reprovação'}</span><h2>{approving?'Aprovar demanda':'Reprovar demanda'}</h2><p>Demanda #{String(demand.numero).padStart(3,'0')}</p></div>
        <button type="button" onClick={close}><X size={20}/></button>
      </div>
      <div className="hf-decision-demand"><span>Demanda selecionada</span><strong>{demand.problema}</strong><div><span>{demand.horasAnalise+demand.horasNecessarias}h estimadas</span><span>{demand.prioridade}</span><span>{demand.status}</span></div></div>
      <div className="hf-form">
        {approving?<div className="hf-decision-content">
          <div className="hf-decision-icon approved"><CheckCircle2 size={24}/></div>          <div>
            <h3>Confirmar aprovação</h3>
            <p>A demanda será aprovada e seguirá conforme a data de entrega cadastrada.</p>
          </div>
        </div>:<div className="hf-decision-content">
          <div className="hf-decision-icon rejected"><X size={24}/></div>
          <div><h3>Por que esta demanda foi reprovada?</h3><p>Informe o motivo para que a equipe tenha clareza sobre o que precisa ser ajustado.</p></div>
          <label><span>Motivo da reprovação</span><textarea className="hf-rejection-textarea" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: Escopo precisa ser ajustado, informações insuficientes..." rows={6} autoFocus/></label>
        </div>}
        <div className="hf-form-actions"><button type="button" className="hf-secondary" onClick={close}>Cancelar</button><button type="button" className={approving?'hf-primary':'hf-reject hf-reject-confirm'} disabled={saving} onClick={confirm}>{saving?'Salvando...':approving?'Confirmar aprovação':'Confirmar reprovação'}</button></div>
      </div>
    </div>
  </div>
}

function HistoryModal({demand,close,loading}:{demand:Demand;close:()=>void;loading:boolean}){
  return <div className="hf-modal-backdrop"><div className="hf-modal hf-history-modal">
    <div className="hf-modal-head"><div><span className="hf-eyebrow">Demanda #{String(demand.numero).padStart(3,'0')}</span><h2>Histórico de alterações</h2><p>Registro de todas as modificações realizadas nesta demanda.</p></div><button onClick={close} aria-label="Fechar"><X size={20}/></button></div>
    {loading?<div className="hf-history-loading"><RefreshCw size={22}/><span>Carregando histórico...</span></div>:!demand.history.length?<div className="hf-history-empty"><History size={30}/><strong>Nenhuma alteração registrada</strong><span>As próximas edições aparecerão aqui.</span></div>:<div className="hf-history">{demand.history.map(h=><div className="hf-history-row" key={h.id}><div className="hf-history-line"/><div className="hf-history-content"><div className="hf-history-top"><strong>{h.field}</strong><span>{h.user}</span></div><p><span>{h.oldValue||'—'}</span><b>→</b><strong>{h.newValue||'—'}</strong></p><small>{formatApprovalDate(h.date)}</small></div></div>)}</div>}
  </div></div>
}

function SaphireGem({size=52}:{size?:number}){
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="saphireGemMain" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8FB4FF"/>
          <stop offset=".38" stopColor="#315EFB"/>
          <stop offset="1" stopColor="#102F91"/>
        </linearGradient>
        <linearGradient id="saphireGemLight" x1="17" y1="11" x2="37" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DDE9FF"/>
          <stop offset="1" stopColor="#6F98FF"/>
        </linearGradient>
      </defs>

      <path
        d="M16 9h32l11 14-27 33L5 23 16 9Z"
        fill="url(#saphireGemMain)"
      />

      <path
        d="M16 9 5 23h16l6-14H16Z"
        fill="url(#saphireGemLight)"
        opacity=".9"
      />

      <path
        d="m27 9-6 14h20L37 9H27Z"
        fill="#4F7CFF"
        opacity=".72"
      />

      <path
        d="M16 9 5 23l16 0M48 9l11 14-16 0M27 9l-6 14h20L37 9"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="1"
      />

      <path
        d="M21 23 32 56 43 23H21Z"
        fill="#173C9E"
        opacity=".32"
      />

      <path
        d="M5 23h54L32 56 5 23Z"
        stroke="rgba(255,255,255,.35)"
        strokeWidth="1"
      />
    </svg>
  );
}

function renderSaphireText(text:string){
  const lines=text.split(/\r?\n/);

  return lines.map((line,index)=>{
    const trimmed=line.trim();

    if(!trimmed){
      return <div key={index} style={{height:8}} />;
    }

    const renderInline=(value:string)=>{
      const parts=value.split(/(\*\*[^*]+\*\*)/g);

      return parts.map((part,partIndex)=>{
        if(part.startsWith('**') && part.endsWith('**')){
          return (
            <strong key={partIndex}>
              {part.slice(2,-2)}
            </strong>
          );
        }

        return <span key={partIndex}>{part}</span>;
      });
    };

    if(trimmed.startsWith('## ')){
      return (
        <div
          key={index}
          style={{
            fontWeight:700,
            fontSize:14,
            marginTop:index===0 ? 0 : 10,
            marginBottom:5
          }}
        >
          {renderInline(trimmed.slice(3))}
        </div>
      );
    }

    if(trimmed.startsWith('- ')){
      return (
        <div
          key={index}
          style={{
            display:'flex',
            gap:7,
            marginBottom:4
          }}
        >
          <span>•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
    }

    return (
      <div key={index} style={{marginBottom:4}}>
        {renderInline(line)}
      </div>
    );
  });
}
function SaphireIAModal({
  user,
  close,
  clientId,
  period
}:{
  user:any;
  close:()=>void;
  clientId:string;
  period:string;
}){
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const [messages,setMessages]=useState<Array<{role:'assistant'|'user';text:string}>>([]);

  const firstName=String(user?.name||'usuário').split(' ')[0];

  const suggestions=[
    'O que está atrasado?',
    'O que vence essa semana?',
    'O que precisa da minha atenção?',
    'Como está a operação?'
  ];

  const sendMessage=async(text?:string)=>{
    const value=(text ?? message).trim();

    if(!value || loading) return;

    setMessage('');
    setMessages(prev=>[
      ...prev,
      {role:'user',text:value}
    ]);

    setLoading(true);

    try{
      const token=localStorage.getItem('horaflow-token');

      if(!token){
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }

      const response=await fetch(`${API}/ai/chat`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${token}`
        },
        body:JSON.stringify({
          message:value,
          clientId:clientId !== 'Todos' ? clientId : null,
          period:period !== 'Todos' ? period : null
        })
      });

      const data=await response.json().catch(()=>({
        isSuccess:false,
        message:'Resposta inválida do servidor.'
      }));

      if(!response.ok || data.isSuccess===false){
        throw new Error(data.message || 'Não foi possível obter uma resposta da Saphire IA.');
      }

      setMessages(prev=>[
        ...prev,
        {
          role:'assistant',
          text:data.message || 'Não consegui gerar uma resposta no momento.'
        }
      ]);
    }catch(error:any){
      setMessages(prev=>[
        ...prev,
        {
          role:'assistant',
          text:error?.message || 'Não foi possível conectar à Saphire IA. Tente novamente.'
        }
      ]);
    }finally{
      setLoading(false);
    }
  };

  return (
    <div className="hf-saphire-ia-overlay" onMouseDown={e=>{
      if(e.target===e.currentTarget) close();
    }}>
      <aside className="hf-saphire-ia-panel">
        <div className="hf-saphire-ia-head">
          <div className="hf-saphire-ia-brand">
            <div className="hf-saphire-ia-gem">
              <SaphireGem size={34}/>
            </div>

            <div>
              <strong>Saphire IA</strong>
              <span>Seu assistente de gestão</span>
            </div>
          </div>

          <button
            type="button"
            className="hf-saphire-ia-close"
            onClick={close}
            aria-label="Fechar Saphire IA"
          >
            <X size={18}/>
          </button>
        </div>

        <div className="hf-saphire-ia-body">
          {messages.length===0 ? (
            <>
              <div className="hf-saphire-ia-welcome">
                <div className="hf-saphire-ia-welcome-gem">
                  <SaphireGem size={58}/>
                </div>

                <h2>Olá, {firstName}! 👋</h2>

                <p>
                  Eu sou a Saphire IA. Posso ajudar você a
                  entender a operação e decidir o próximo passo.
                </p>
              </div>

              <div className="hf-saphire-ia-question">
                <span>O que você precisa resolver?</span>
              </div>

              <div className="hf-saphire-ia-suggestions">
                {suggestions.map(item=>(
                  <button
                    key={item}
                    type="button"
                    onClick={()=>sendMessage(item)}
                  >
                    {item}
                    <span>→</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="hf-saphire-ia-messages">
              <div className="hf-saphire-ia-welcome-mini">
                <SaphireGem size={30}/>
                <span>Saphire IA</span>
              </div>

              {messages.map((item,index)=>(
                <div
                  key={index}
                  className={`hf-saphire-ia-message ${item.role}`}
                >
                  {renderSaphireText(item.text)}
                </div>
              ))}

              {loading && (
                <div className="hf-saphire-ia-message assistant loading">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hf-saphire-ia-footer">
          <div className="hf-saphire-ia-input">
            <input
              value={message}
              onChange={e=>setMessage(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter') sendMessage();
              }}
              placeholder="Digite uma pergunta..."
              aria-label="Pergunte à Saphire IA"
            />

            <button
              type="button"
              onClick={()=>sendMessage()}
              disabled={!message.trim() || loading}
              aria-label="Enviar pergunta"
            >
              →
            </button>
          </div>

          <small>
            Saphire IA • assistente inteligente
          </small>
        </div>
      </aside>
    </div>
  );
}
const styles = `
/* =====================================================
   SAPHIRE IA — ASSISTENTE
   ===================================================== */

.hf-saphire-ia-overlay{
  position:fixed;
  inset:0;
  background:rgba(7,16,29,.28);
  z-index:300;
  animation:hfSaphireOverlayIn .18s ease;
}

.hf-saphire-ia-panel{
  position:absolute;
  top:0;
  right:0;
  width:min(440px,100vw);
  height:100%;
  background:#fff;
  display:flex;
  flex-direction:column;
  box-shadow:-18px 0 55px rgba(7,16,29,.16);
  animation:hfSaphirePanelIn .24s cubic-bezier(.22,.8,.28,1);
}

.hf-saphire-ia-head{
  min-height:76px;
  padding:0 20px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  border-bottom:1px solid #edf0f5;
  background:linear-gradient(180deg,#fff 0%,#fbfcff 100%);
}

.hf-saphire-ia-brand{
  display:flex;
  align-items:center;
  gap:11px;
}

.hf-saphire-ia-gem{
  width:42px;
  height:42px;
  border-radius:13px;
  display:grid;
  place-items:center;
  background:#eef3ff;
  box-shadow:inset 0 0 0 1px #dfe7ff;
}

.hf-saphire-ia-brand strong{
  display:block;
  color:#172033;
  font-size:15px;
  font-weight:800;
  letter-spacing:-.2px;
}

.hf-saphire-ia-brand span{
  display:block;
  margin-top:3px;
  color:#8994a7;
  font-size:10px;
}

.hf-saphire-ia-close{
  width:34px;
  height:34px;
  border:0;
  border-radius:9px;
  background:#f3f5f8;
  color:#68758a;
  display:grid;
  place-items:center;
  transition:.18s ease;
}

.hf-saphire-ia-close:hover{
  background:#edf2ff;
  color:#315efb;
  transform:rotate(3deg);
}

.hf-saphire-ia-body{
  flex:1;
  min-height:0;
  overflow:auto;
  padding:28px 22px;
}

.hf-saphire-ia-welcome{
  text-align:center;
  padding:12px 20px 28px;
}

.hf-saphire-ia-welcome-gem{
  width:86px;
  height:86px;
  margin:0 auto 17px;
  border-radius:25px;
  display:grid;
  place-items:center;
  background:radial-gradient(circle at 35% 25%,#fff 0%,#edf3ff 35%,#dce7ff 100%);
  box-shadow:
    0 12px 30px rgba(49,94,251,.12),
    inset 0 0 0 1px #e0e8ff;
  animation:hfSaphireGemPulse 3.2s ease-in-out infinite;
}

.hf-saphire-ia-welcome h2{
  margin:0 0 8px;
  color:#1c2940;
  font-size:20px;
  letter-spacing:-.35px;
}

.hf-saphire-ia-welcome p{
  max-width:330px;
  margin:0 auto;
  color:#7d899b;
  font-size:12px;
  line-height:1.65;
}

.hf-saphire-ia-question{
  margin-bottom:10px;
  color:#566176;
  font-size:11px;
  font-weight:800;
}

.hf-saphire-ia-suggestions{
  display:grid;
  gap:8px;
}

.hf-saphire-ia-suggestions button{
  width:100%;
  min-height:48px;
  padding:0 13px;
  border:1px solid #e2e7ef;
  border-radius:11px;
  background:#fff;
  color:#344158;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  text-align:left;
  font-size:11px;
  font-weight:700;
  transition:.18s ease;
}

.hf-saphire-ia-suggestions button span{
  color:#9aa5b6;
  font-size:16px;
  transition:.18s ease;
}

.hf-saphire-ia-suggestions button:hover{
  border-color:#cbd8ff;
  background:#f8faff;
  color:#315efb;
  transform:translateX(-2px);
  box-shadow:0 5px 16px rgba(49,94,251,.07);
}

.hf-saphire-ia-suggestions button:hover span{
  color:#315efb;
  transform:translateX(3px);
}

.hf-saphire-ia-footer{
  padding:14px 18px 17px;
  border-top:1px solid #edf0f5;
  background:#fff;
}

.hf-saphire-ia-input{
  min-height:46px;
  display:flex;
  align-items:center;
  gap:8px;
  padding:4px 5px 4px 13px;
  border:1px solid #dfe5ee;
  border-radius:13px;
  background:#fbfcfe;
  transition:.18s ease;
}

.hf-saphire-ia-input:focus-within{
  border-color:#9eb4ff;
  background:#fff;
  box-shadow:0 0 0 4px rgba(49,94,251,.08);
}

.hf-saphire-ia-input input{
  flex:1;
  min-width:0;
  height:36px;
  border:0;
  outline:0;
  background:transparent;
  color:#172033;
  font-size:12px;
}

.hf-saphire-ia-input input::placeholder{
  color:#a0a9b7;
}

.hf-saphire-ia-input button{
  width:36px;
  height:36px;
  flex:none;
  border:0;
  border-radius:10px;
  background:#315efb;
  color:#fff;
  font-size:18px;
  display:grid;
  place-items:center;
  transition:.18s ease;
}

.hf-saphire-ia-input button:hover:not(:disabled){
  background:#244bd7;
  transform:translateY(-1px);
}

.hf-saphire-ia-input button:disabled{
  background:#dfe5ee;
  color:#9aa5b6;
}

.hf-saphire-ia-footer small{
  display:block;
  margin-top:8px;
  color:#a0a9b7;
  font-size:9px;
  text-align:center;
}

.hf-saphire-ia-messages{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.hf-saphire-ia-welcome-mini{
  display:flex;
  align-items:center;
  gap:8px;
  color:#536077;
  font-size:11px;
  font-weight:800;
  margin-bottom:8px;
}

.hf-saphire-ia-message{
  max-width:88%;
  padding:11px 13px;
  border-radius:13px;
  font-size:11px;
  line-height:1.55;
}

.hf-saphire-ia-message.user{
  align-self:flex-end;
  background:#315efb;
  color:#fff;
  border-bottom-right-radius:4px;
}

.hf-saphire-ia-message.assistant{
  align-self:flex-start;
  background:#f3f6fa;
  color:#46536a;
  border-bottom-left-radius:4px;
}

.hf-saphire-ia-message.loading{
  display:flex;
  gap:4px;
  align-items:center;
  min-width:46px;
}

.hf-saphire-ia-message.loading span{
  width:5px;
  height:5px;
  border-radius:50%;
  background:#7f91b5;
  animation:hfSaphireTyping 1s infinite ease-in-out;
}

.hf-saphire-ia-message.loading span:nth-child(2){
  animation-delay:.15s;
}

.hf-saphire-ia-message.loading span:nth-child(3){
  animation-delay:.3s;
}

@keyframes hfSaphireOverlayIn{
  from{opacity:0}
  to{opacity:1}
}

@keyframes hfSaphirePanelIn{
  from{
    transform:translateX(100%);
  }
  to{
    transform:translateX(0);
  }
}

@keyframes hfSaphireGemPulse{
  0%,100%{
    transform:translateY(0);
    box-shadow:0 12px 30px rgba(49,94,251,.12),inset 0 0 0 1px #e0e8ff;
  }
  50%{
    transform:translateY(-3px);
    box-shadow:0 17px 34px rgba(49,94,251,.18),inset 0 0 0 1px #d2deff;
  }
}

@keyframes hfSaphireTyping{
  0%,60%,100%{transform:translateY(0);opacity:.45}
  30%{transform:translateY(-3px);opacity:1}
}

@media(max-width:600px){
  .hf-saphire-ia-panel{
    width:100vw;
  }

  .hf-saphire-ia-body{
    padding:24px 18px;
  }

  .hf-saphire-ia-welcome{
    padding-left:10px;
    padding-right:10px;
  }
  /* SAPHIRE IA - JOIA MOBILE */
  .hf-saphire-ia-trigger{
    left:18px !important;
    bottom:24px !important;
    width:60px !important;
    min-width:60px !important;
    max-width:60px !important;
    height:60px !important;
    padding:4px !important;
    display:grid !important;
    place-items:center !important;
    gap:0 !important;
    border-radius:50% !important;
    background:radial-gradient(circle at 35% 25%,#fff 0%,#edf4ff 35%,#d8e6ff 70%,#c2d5ff 100%) !important;
    color:transparent !important;
    font-size:0 !important;
    line-height:0 !important;
  }

  .hf-saphire-ia-trigger::before{
    inset:-13px !important;
    border-radius:50% !important;
  }

  .hf-saphire-ia-trigger::after{
    top:1px !important;
    left:auto !important;
    right:0 !important;
    width:10px !important;
    height:10px !important;
    border-radius:50% !important;
  }

  .hf-saphire-ia-trigger-gem{
    width:48px !important;
    height:48px !important;
    border-radius:50% !important;
  }

  .hf-saphire-ia-label{
    display:none !important;
  }}

/* SAPHIRE VIEW SWITCHER MODERN */
.hf-view-switcher{display:inline-flex!important;align-items:center!important;gap:3px!important;padding:4px!important;margin:0!important;background:#f5f7fb!important;border:1px solid #e4e9f1!important;border-radius:12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 2px 8px rgba(15,23,42,.04)!important}.hf-view-switcher button{appearance:none!important;-webkit-appearance:none!important;height:34px!important;min-width:82px!important;padding:0 12px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#7b8799!important;font-family:inherit!important;font-size:11px!important;font-weight:700!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;cursor:pointer!important;outline:none!important;box-shadow:none!important;transition:background-color .18s ease,color .18s ease,box-shadow .18s ease,transform .15s ease!important}.hf-view-switcher button span{font-size:13px!important;line-height:1!important;opacity:.85!important}.hf-view-switcher button:hover{background:#edf2ff!important;color:#315efb!important;transform:translateY(-1px)!important}.hf-view-switcher button.active{background:#fff!important;color:#315efb!important;box-shadow:0 2px 7px rgba(15,23,42,.10),0 1px 2px rgba(15,23,42,.04)!important}.hf-view-switcher button.active span{opacity:1!important}.hf-view-switcher button:active{transform:scale(.97)!important}.hf-view-switcher button:focus-visible{box-shadow:0 0 0 3px rgba(49,94,251,.14)!important}@media(max-width:650px){.hf-view-switcher{width:100%!important}.hf-view-switcher button{flex:1!important;min-width:0!important}}

.hf-demand-cards{display:grid;grid-template-columns:repeat(3,minmax(240px,1fr));gap:14px;margin-top:16px}.hf-demand-card{appearance:none;width:100%;box-sizing:border-box;border:1px solid #e4e9f0;background:#fff;border-radius:16px;padding:16px;text-align:left;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.04);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}.hf-demand-card:hover{transform:translateY(-3px);border-color:#cfd9ee;box-shadow:0 12px 28px rgba(15,23,42,.08)}.hf-demand-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.hf-demand-number{font-size:11px;font-weight:800;color:#315efb}.hf-demand-status{padding:5px 9px;border-radius:999px;background:#f1f4f8;color:#687489;font-size:10px;font-weight:700}.hf-demand-card-client{margin-top:14px;color:#7d899b;font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hf-demand-card h3{margin:7px 0 5px;color:#202b3f;font-size:14px;line-height:1.45}.hf-demand-card>p{margin:0;color:#8994a7;font-size:11px;line-height:1.5;min-height:34px}.hf-demand-card-footer{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #edf0f5}.hf-demand-card-footer span{min-width:0}.hf-demand-card-footer small{display:block;color:#9aa4b3;font-size:9px;margin-bottom:3px}.hf-demand-card-footer strong{display:block;color:#465268;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:1050px){.hf-demand-cards{grid-template-columns:repeat(2,minmax(240px,1fr))}}@media(max-width:650px){.hf-demand-cards{grid-template-columns:1fr}}
.hf-kanban{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:14px;margin-top:14px;overflow-x:auto;padding-bottom:4px}.hf-kanban-column{min-width:220px;background:#f7f9fc;border:1px solid #e5eaf1;border-radius:15px;padding:12px}.hf-kanban-column-head{padding:4px 4px 12px}.hf-kanban-column-head>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.hf-kanban-column-head strong{color:#344158;font-size:12px}.hf-kanban-column-head span{min-width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:#eaf0ff;color:#315efb;font-size:10px;font-weight:800}.hf-kanban-list{display:grid;gap:9px}.hf-kanban-empty{min-height:100px;display:grid;place-items:center;text-align:center;color:#a0a9b7;font-size:10px;border:1px dashed #dce2eb;border-radius:11px;background:#fff}.hf-kanban-card{width:100%;border:1px solid #e4e9f0;border-radius:12px;background:#fff;padding:12px;text-align:left;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.hf-kanban-card:hover{transform:translateY(-2px);border-color:#d3dcf0;box-shadow:0 8px 20px rgba(15,23,42,.07)}.hf-kanban-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:9px}.hf-kanban-card-top span{color:#315efb;font-size:10px;font-weight:800}.hf-kanban-card-top b{color:#7b8799;font-size:9px;background:#f3f5f8;border-radius:999px;padding:4px 7px}.hf-kanban-card>strong{display:block;color:#27344b;font-size:11px;line-height:1.45}.hf-kanban-card>p{margin:6px 0 0;color:#8a95a6;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hf-kanban-card-footer{display:flex;justify-content:space-between;gap:8px;margin-top:11px;padding-top:9px;border-top:1px solid #eef1f5}.hf-kanban-card-footer span{color:#68758a;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:1100px){.hf-kanban{grid-template-columns:repeat(2,minmax(240px,1fr))}}@media(max-width:650px){.hf-kanban{grid-template-columns:1fr}}/* =====================================================
   SAPHIRE UI MOTION 2.0
   Microinterações e refinamento visual
   ===================================================== */

.hf-main {
  animation: sapphirePageIn .28s ease-out;
}

@keyframes sapphirePageIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Cards */
.hf-card,
.hf-user-card,
.hf-client-card {
  transition:
    transform .2s ease,
    box-shadow .2s ease,
    border-color .2s ease;
}

.hf-card:hover,
.hf-user-card:hover,
.hf-client-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15,23,42,.07);
}

/* Botões */
.hf-primary,
.hf-secondary,
.hf-command-trigger,
.hf-icon-btn {
  transition:
    transform .16s ease,
    box-shadow .16s ease,
    background-color .16s ease,
    border-color .16s ease;
}

.hf-primary:hover,
.hf-secondary:hover,
.hf-command-trigger:hover {
  transform: translateY(-1px);
}

.hf-primary:active,
.hf-secondary:active,
.hf-command-trigger:active,
.hf-icon-btn:active {
  transform: scale(.97);
}

/* Sidebar */
.hf-sidebar nav button {
  transition:
    background-color .18s ease,
    color .18s ease,
    transform .18s ease;
}

.hf-sidebar nav button:hover {
  transform: translateX(2px);
}

/* Avatar */
.hf-top-avatar {
  transition:
    transform .2s ease,
    box-shadow .2s ease;
}

.hf-top-avatar:hover {
  transform: scale(1.05);
  box-shadow: 0 5px 14px rgba(15,23,42,.15);
}

/* Modais */
.hf-modal-backdrop,
.hf-command-backdrop {
  animation: sapphireBackdropIn .2s ease-out;
}

@keyframes sapphireBackdropIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.hf-modal,
.hf-command-modal {
  animation: sapphireModalIn .24s cubic-bezier(.22,1,.36,1);
}

@keyframes sapphireModalIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Command Center */
.hf-command-item {
  transition:
    background-color .16s ease,
    transform .16s ease;
}

.hf-command-item:hover {
  transform: translateX(2px);
}

/* Inputs */
.hf-form input,
.hf-form select,
.hf-form textarea,
.hf-search input {
  transition:
    border-color .18s ease,
    box-shadow .18s ease,
    background-color .18s ease;
}

/* Barras */
.hf-bar i {
  animation: sapphireProgressIn .7s ease-out;
}

@keyframes sapphireProgressIn {
  from {
    width: 0;
  }
}

/* Acessibilidade */
@media (prefers-reduced-motion: reduce) {
  .hf-main,
  .hf-modal,
  .hf-command-modal,
  .hf-modal-backdrop,
  .hf-command-backdrop,
  .hf-bar i {
    animation: none !important;
    transition: none !important;
  }
}

.hf-hours-tooltip{
  position:relative;
  display:inline-flex;
  align-items:center;
}

.hf-hours-cell{
  display:inline-flex;
  align-items:center;
  justify-content:center;
}

.hf-hours-tooltip-content{
  position:absolute;
  z-index:99999;
  left:50%;
  top:calc(100% + 8px);
  bottom:auto;
  transform:translateX(-50%) translateY(-3px);
  width:150px;
  padding:9px 11px;
  border-radius:7px;
  background:#1f2937;
  color:#fff;
  box-shadow:0 6px 18px rgba(0,0,0,.18);
  opacity:0;
  visibility:hidden;
  pointer-events:none;
  transition:opacity .15s ease,transform .15s ease;
}

.hf-hours-tooltip-content::before{
  content:"";
  position:absolute;
  left:50%;
  bottom:100%;
  transform:translateX(-50%);
  border:5px solid transparent;
  border-bottom-color:#1f2937;
}

.hf-hours-tooltip:hover .hf-hours-tooltip-content{
  opacity:1;
  visibility:visible;
  transform:translateX(-50%) translateY(0);
}

.hf-hours-tooltip-title{
  font-size:11px;
  font-weight:700;
  margin-bottom:5px;
}

.hf-hours-tooltip-row,
.hf-hours-tooltip-total{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  font-size:11px;
  line-height:1.6;
}

.hf-hours-tooltip-row span{
  opacity:.75;
}

.hf-hours-tooltip-total{
  margin-top:4px;
  padding-top:4px;
  border-top:1px solid rgba(255,255,255,.15);
  font-weight:700;
}
.hf-hours-tooltip-row span{
  opacity:.75;
}

.hf-hours-tooltip-total{
  margin-top:4px;
  padding-top:4px;
  border-top:1px solid rgba(255,255,255,.15);
  font-weight:700;
}
.hf-hours-tooltip-row span{
  opacity:.75;
}

.hf-hours-tooltip-total{
  margin-top:6px;
  padding-top:6px;
  border-top:1px solid rgba(255,255,255,.15);
  font-weight:700;
}

*{box-sizing:border-box}body{margin:0;font-family:Poppins,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7fb;color:#172033}button,input,select,textarea{font-family:Poppins,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.55}
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap");
.hf-brand-logo{padding:8px 10px 28px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-height:88px;line-height:.92}.hf-brand-logo strong{color:#fff;font-size:24px;font-weight:800;letter-spacing:-.8px}.hf-brand-logo span{color:#5f82ff;font-size:21px;font-weight:500;letter-spacing:1.2px;margin-left:2px}.hf-execution{font-weight:700;color:#315efb}.hf-number-badge{display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:28px;padding:0 8px;border-radius:9px;background:#f1f5ff;color:#315efb;font-weight:800;font-size:11px}.hf-demand-text{max-width:220px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#344158}.hf-hours-cell{display:grid;grid-template-columns:auto 8px auto;align-items:center;gap:3px;white-space:nowrap}.hf-hours-cell b{font-size:12px}.hf-hours-cell span{color:#a2acbb}.hf-hours-cell small{grid-column:1/-1;color:#9aa4b3;font-size:9px}.hf-priority-pill,.hf-status-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap}.hf-priority-pill:before,.hf-status-pill:before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}.priority-baixa{background:#eef8f2;color:#258153}.priority-media{background:#f3f5f8;color:#667286}.priority-alta{background:#fff5e7;color:#b66a00}.priority-urgente{background:#fff0f1;color:#c83d4b}.status-aguardando-analise,.status-pendente{background:#fff8e9;color:#a56b00}.status-em-analise{background:#eef4ff;color:#315efb}.status-aguardando-aprovacao{background:#f4efff;color:#7b55c7}.status-em-desenvolvimento{background:#edf8f8;color:#15818a}.status-em-homologacao{background:#f1efff;color:#6b59c9}.status-concluida{background:#edf8f2;color:#258153}.status-reprovada{background:#fff0f1;color:#c83d4b}.hf-paid-dot{display:inline-flex;align-items:center;gap:6px;color:#7d899b;font-size:11px}.hf-paid-dot i{width:7px;height:7px;border-radius:50%;background:#c7ced8}.hf-paid-dot.on{color:#258153;font-weight:700}.hf-paid-dot.on i{background:#2fa66e}.hf-row-actions{display:flex;align-items:center;gap:5px;min-width:220px}.hf-action-btn{height:32px;border:1px solid #e0e6ef;background:#fff;color:#68758a;border-radius:8px;padding:0 9px;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:600;transition:.18s}.hf-action-btn:hover{border-color:#c9d3e2;background:#f8fafc;transform:translateY(-1px)}.hf-action-btn.primary{color:#315efb;border-color:#d8e1ff;background:#f5f7ff}.hf-action-btn.primary:hover{background:#edf2ff}.hf-action-btn.danger{color:#c83d4b;border-color:#f0d5d9;background:#fff8f8}.hf-action-btn.danger:hover{background:#fff0f1}.actions-head{min-width:220px}.hf-pill.pending{background:#f3f5f8;color:#68758a}.hf-history-modal{width:min(720px,100%)}.hf-history-loading,.hf-history-empty{min-height:220px;display:grid;place-items:center;align-content:center;gap:10px;color:#8793a5;text-align:center}.hf-history-loading svg{animation:spin 1s linear infinite;color:#315efb}.hf-history-empty svg{color:#b7c0ce}.hf-history-empty strong{color:#354259}.hf-history-empty span{font-size:12px}@keyframes spin{to{transform:rotate(360deg)}}.hf-history-content{flex:1;background:#f8fafc;border:1px solid #e7ebf1;border-radius:12px;padding:12px 14px}.hf-history-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.hf-history-top span{font-size:10px;color:#8a95a6;background:#fff;border:1px solid #e4e9f0;border-radius:999px;padding:4px 7px}.hf-history-content p{display:flex;gap:8px;align-items:center;margin:9px 0 5px;font-size:12px;flex-wrap:wrap}.hf-history-content p span{color:#7d899b}.hf-history-content p b{color:#b0b8c5}.hf-history-content p strong{color:#315efb}.hf-history-content small{color:#9aa4b3;font-size:10px}.hf-history-row{align-items:flex-start}.hf-history-line{margin-top:18px;box-shadow:0 0 0 4px #315efb12}.hf-table-wrap table tbody tr:hover{background:#fbfcfe}.hf-table-wrap table td{vertical-align:middle}/* =========================================================
   SAPPHIRE — MODAL DE DEMANDA MODERNO
   ========================================================= */

.hf-demand-modal{
  width:min(820px,calc(100vw - 32px));
  max-height:calc(100vh - 32px);
  overflow-y:auto;
  padding:0;
  border-radius:22px;
  background:#fff;
  box-shadow:0 28px 90px rgba(7,16,29,.22);
}

.hf-demand-modal .hf-modal-head{
  padding:24px 26px 20px;
  margin:0;
  border-bottom:1px solid #edf0f5;
  background:linear-gradient(180deg,#fff 0%,#fbfcfe 100%);
}

.hf-demand-modal .hf-modal-head h2{
  margin:4px 0 5px;
  font-size:22px;
  font-weight:800;
  letter-spacing:-.4px;
  color:#172033;
}

.hf-demand-modal .hf-modal-head p{
  font-size:12px;
  color:#8793a5;
}

.hf-demand-form{
  padding:0 26px 26px;
  gap:0;
}

.hf-form-section{
  padding:24px 0;
  border-bottom:1px solid #edf0f5;
}

.hf-form-section:first-child{
  padding-top:22px;
}

.hf-form-section:last-of-type{
  border-bottom:0;
}

.hf-section-title{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:18px;
}

.hf-section-title>span{
  width:34px;
  height:34px;
  border-radius:10px;
  display:grid;
  place-items:center;
  background:#eef3ff;
  color:#315efb;
  font-size:11px;
  font-weight:800;
  box-shadow:inset 0 0 0 1px #dfe7ff;
}

.hf-section-title strong{
  font-size:14px;
  font-weight:800;
  color:#202b3f;
}

.hf-section-title small{
  color:#8994a7;
  font-size:11px;
}

.hf-demand-form .hf-form-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

.hf-demand-form label{
  display:flex;
  flex-direction:column;
  gap:7px;
  margin-bottom:15px;
}

.hf-demand-form label>span{
  font-size:11px;
  font-weight:800;
  color:#566176;
}

.hf-demand-form input,
.hf-demand-form select,
.hf-demand-form textarea{
  width:100%;
  box-sizing:border-box;
  border:1px solid #dfe5ee;
  background:#fbfcfe;
  border-radius:12px;
  padding:11px 13px;
  color:#172033;
  font-size:13px;
  outline:none;
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;
}

.hf-demand-form input,
.hf-demand-form select{
  height:46px;
}

.hf-demand-form textarea{
  min-height:92px;
  line-height:1.5;
  resize:vertical;
}

.hf-demand-form input:hover,
.hf-demand-form select:hover,
.hf-demand-form textarea:hover{
  border-color:#cbd5e4;
  background:#fff;
}

.hf-demand-form input:focus,
.hf-demand-form select:focus,
.hf-demand-form textarea:focus{
  border-color:#315efb;
  background:#fff;
  box-shadow:0 0 0 4px rgba(49,94,251,.09);
}

.hf-demand-form .hf-input-suffix{
  position:relative;
  display:flex;
  align-items:center;
}

.hf-demand-form .hf-input-suffix input{
  padding-right:58px;
}

.hf-demand-form .hf-input-suffix small{
  position:absolute;
  right:13px;
  color:#8a95a6;
  font-size:11px;
  font-weight:700;
  pointer-events:none;
}

.hf-form-actions{
  padding-top:22px;
  margin-top:0;
  border-top:1px solid #edf0f5;
}

.hf-form-actions .hf-secondary,
.hf-form-actions .hf-primary{
  height:42px;
  padding:0 17px;
  border-radius:11px;
}

.hf-form-actions .hf-primary{
  box-shadow:0 7px 18px rgba(49,94,251,.20);
}

@media(max-width:650px){
  .hf-demand-modal{
    width:calc(100vw - 20px);
    max-height:calc(100vh - 20px);
    border-radius:18px;
  }

  .hf-demand-modal .hf-modal-head{
    padding:20px;
  }

  .hf-demand-form{
    padding:0 20px 20px;
  }

  .hf-demand-form .hf-form-grid{
    grid-template-columns:1fr;
    gap:0;
  }

  .hf-form-section{
    padding:20px 0;
  }
}
.hf-demand-modal{width:min(700px,100%)}
.hf-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 2px 2px;color:#7d899b;font-size:12px}.hf-pagination>div{display:flex;gap:5px;align-items:center}.hf-page-btn{border:1px solid #dfe5ee;background:#fff;color:#566176;border-radius:8px;min-width:34px;height:34px;padding:0 10px}.hf-page-btn:hover:not(:disabled),.hf-page-btn.active{background:#315efb;border-color:#315efb;color:#fff}.hf-page-btn:disabled{opacity:.45}.hf-login-brand{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:.92;margin-bottom:6px}.hf-login-brand strong{display:block;color:#14233c;font-size:40px;font-weight:800;letter-spacing:-1.5px}.hf-login-brand span{display:block;color:#315efb;font-size:28px;font-weight:500;letter-spacing:2px;margin-top:3px}.hf-login{min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#081426 0%,#102442 55%,#eaf0f8 55%,#f4f7fb 100%);position:relative;overflow:hidden;padding:24px}.hf-login-decoration{position:absolute;border-radius:50%;filter:blur(2px)}.hf-login-decoration.one{width:420px;height:420px;background:#2e6bff22;top:-180px;right:-100px}.hf-login-decoration.two{width:300px;height:300px;background:#ffffff10;bottom:-150px;left:-80px}.hf-login-card{width:min(440px,100%);background:#fff;border:1px solid #e5eaf2;border-radius:24px;padding:36px;box-shadow:0 28px 70px #06132733;position:relative;z-index:2}.hf-login-brand,.hf-brand{display:flex;align-items:center;gap:12px}.hf-logo{width:40px;height:40px;border-radius:12px;background:#14233c;color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px}.hf-logo.large{width:52px;height:52px;border-radius:16px;font-size:24px}.hf-brand strong{display:block;font-size:22px}.hf-brand span{display:block;color:#8390a6;font-size:12px;margin-top:2px}.hf-login-copy{margin:34px 0 24px}.hf-login-copy h1{font-size:29px;margin:0 0 8px;letter-spacing:-.7px}.hf-login-copy p{margin:0;color:#7b879b;line-height:1.5}.hf-login-card form label,.hf-form label{display:block;font-size:13px;font-weight:700;color:#38445a;margin-bottom:16px}.hf-input{height:48px;margin-top:7px;border:1px solid #d9e0ea;border-radius:12px;display:flex;align-items:center;gap:10px;padding:0 13px;color:#8b96a8;background:#fbfcfe}.hf-input:focus-within{border-color:#315efb;box-shadow:0 0 0 4px #315efb14}.hf-input input{border:0;outline:0;background:transparent;width:100%;color:#172033}.hf-input button{border:0;background:transparent;color:#7d899b;display:grid;place-items:center}.hf-login-button{height:50px;width:100%;border:0;border-radius:12px;background:#14233c;color:#fff;font-weight:750;display:flex;align-items:center;justify-content:space-between;padding:0 17px;margin-top:6px;box-shadow:0 10px 22px #14233c22}.hf-login-button span{font-size:20px}.hf-login-error,.hf-alert{display:flex;align-items:center;gap:8px;background:#fff0f0;color:#c73a3a;border:1px solid #ffd2d2;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:14px}.hf-login-footer{text-align:center;color:#9aa5b6;font-size:11px;margin-top:24px}
.hf-app{min-height:100vh;display:flex}.hf-sidebar{width:240px;background:#0d1a2d;color:#cbd4e3;display:flex;flex-direction:column;padding:22px 14px;position:fixed;inset:0 auto 0 0;z-index:20}.hf-brand{padding:4px 10px 28px}.hf-brand strong{display:block;color:#fff;font-size:18px}.hf-sidebar nav{display:grid;gap:6px}.hf-nav{border:0;background:transparent;color:#aeb9ca;display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;text-align:left}.hf-nav:hover,.hf-nav.active{background:#ffffff0e;color:#fff}.hf-nav.active{box-shadow:inset 3px 0 #4d79ff}.hf-nav.disabled{color:#56647a}.hf-sidebar-bottom{margin-top:auto;border-top:1px solid #ffffff10;padding-top:16px}.hf-user-mini{display:flex;gap:10px;align-items:center;margin:0 6px 12px}.hf-avatar{width:34px;height:34px;border-radius:50%;background:#315efb;color:#fff;display:grid;place-items:center;font-weight:800}.hf-avatar.big{width:48px;height:48px}.hf-user-mini strong{display:block;color:#fff;font-size:13px;max-width:135px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hf-user-mini span{font-size:11px;color:#7f8da4}.hf-logout{width:100%;border:0;background:transparent;color:#9aa7bb;padding:10px;border-radius:9px;text-align:left;display:flex;gap:9px;align-items:center}.hf-logout:hover{background:#ffffff09;color:#fff}.hf-main{margin-left:240px;width:calc(100% - 240px);padding:30px 34px 50px}.hf-topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:25px}.hf-topbar h1{margin:3px 0 2px;font-size:27px;letter-spacing:-.5px}.hf-topbar p{margin:0;color:#8591a5;font-size:13px}.hf-eyebrow{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#6681c8}.hf-top-actions,.hf-actions{display:flex;align-items:center;gap:10px}.hf-top-avatar{width:38px;height:38px;border-radius:50%;background:#14233c;color:#fff;display:grid;place-items:center;font-weight:800}.hf-menu{display:none}.hf-primary,.hf-secondary{border:0;border-radius:10px;height:40px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:700}.hf-primary{background:#315efb;color:#fff;box-shadow:0 7px 16px #315efb22}.hf-primary.compact{height:36px}.hf-secondary{background:#fff;color:#344158;border:1px solid #dfe5ee}.hf-alert{justify-content:flex-start}.hf-alert button{margin-left:auto;border:0;background:transparent;color:inherit}.hf-filters{background:#fff;border:1px solid #e3e8f0;border-radius:14px;padding:11px;display:flex;gap:9px;align-items:center;margin-bottom:18px}.hf-search{height:38px;display:flex;align-items:center;gap:8px;border:1px solid #e0e6ef;border-radius:9px;padding:0 10px;flex:1;color:#8793a5}.hf-search input{border:0;outline:0;width:100%;color:#172033}.hf-filters select{height:38px;border:1px solid #e0e6ef;border-radius:9px;background:#fff;padding:0 10px;color:#566176}.hf-filter-count{color:#8793a5;font-size:12px;white-space:nowrap;display:flex;gap:6px;align-items:center}.hf-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}.hf-card{background:#fff;border:1px solid #e4e9f0;border-radius:15px;padding:18px;position:relative;min-height:118px}.hf-card-icon{width:34px;height:34px;border-radius:10px;background:#eef3ff;color:#315efb;display:grid;place-items:center;margin-bottom:12px}.hf-card span{display:block;color:#7d899b;font-size:12px}.hf-card strong{display:block;font-size:25px;margin-top:4px}.hf-cards.small .hf-card{min-height:96px}.hf-cards.small .hf-card-icon{display:none}.hf-grid2{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;margin-bottom:14px}.hf-panel{background:#fff;border:1px solid #e3e8f0;border-radius:15px;padding:19px;margin-bottom:14px}.hf-panel-title{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:17px}.hf-panel-title h2{font-size:16px;margin:0}.hf-muted{color:#8793a5;font-size:12px;margin:4px 0 0}.hf-link{border:0;background:transparent;color:#315efb;font-weight:700}.hf-status-list{display:grid;gap:14px}.hf-status-row{display:grid;grid-template-columns:10px 1fr 28px 1.2fr;gap:9px;align-items:center;font-size:12px}.hf-status-row strong{text-align:right}.hf-status-dot{width:8px;height:8px;border-radius:50%;background:#94a3b8}.dot-em-desenvolvimento{background:#315efb}.dot-em-homologacao{background:#7c4dff}.dot-concluida{background:#22a06b}.dot-reprovada{background:#e44b4b}.dot-aguardando-aprovacao{background:#f1a52b}.hf-bar{height:6px;background:#edf0f5;border-radius:9px;overflow:hidden}.hf-bar i{display:block;height:100%;background:#315efb;border-radius:9px}.hf-big-number{font-size:42px;font-weight:800;letter-spacing:-1px}.hf-mini-stats{display:grid;grid-template-columns:repeat(3,1fr);margin-top:25px;border-top:1px solid #edf0f4;padding-top:17px}.hf-mini-stats span{display:block;color:#8a95a6;font-size:11px}.hf-mini-stats b{font-size:17px}.hf-table-wrap{overflow:auto}.hf-table-wrap table{width:100%;border-collapse:collapse;min-width:1120px}.hf-table-wrap th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8b96a8;text-align:left;padding:10px 8px;border-bottom:1px solid #e8ecf2;white-space:nowrap}.hf-table-wrap td{padding:8px;border-bottom:1px solid #eef1f5;font-size:12px}.hf-table-wrap input,.hf-table-wrap select{border:1px solid #e3e7ee;border-radius:7px;height:34px;padding:0 8px;min-width:130px;background:#fff}.hf-table-wrap input.hours{width:72px;min-width:72px}.hf-table-wrap .number{font-weight:800;color:#315efb}.hf-pill{padding:5px 8px;border-radius:20px;font-size:11px;font-weight:700}.hf-pill.approved{background:#eaf8f1;color:#21865a}.hf-approve{border:0;background:#eef3ff;color:#315efb;border-radius:7px;padding:7px 9px;font-size:11px;font-weight:700}.hf-toggle{border:1px solid #e0e5ed;background:#fff;border-radius:20px;padding:6px 10px;font-size:11px;color:#7d899b}.hf-toggle.on{background:#eaf8f1;border-color:#cceedd;color:#21865a}.hf-icon-btn{width:30px;height:30px;border:0;background:#f2f5f9;color:#657188;border-radius:8px;display:grid;place-items:center}.hf-icon-btn.danger:hover{background:#fff0f0;color:#d13d3d}.hf-empty{padding:40px;display:flex;flex-direction:column;align-items:center;gap:7px;color:#8994a5}.hf-totals{display:flex;gap:20px;justify-content:flex-end;padding-top:15px;color:#788497;font-size:12px}.hf-totals strong{color:#27344b}.hf-user-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.hf-user-card{border:1px solid #e4e9f0;border-radius:14px;padding:17px}.hf-user-card-top{display:flex;justify-content:space-between;align-items:center}.hf-user-card h3{margin:15px 0 4px;font-size:15px}.hf-user-card p{margin:0;color:#8490a2;font-size:12px}.hf-role{font-size:10px;font-weight:800;border-radius:20px;padding:5px 8px}.role-admin{background:#eeeaff;color:#6744cc}.role-interno{background:#eef3ff;color:#315efb}.role-cliente{background:#fff5df;color:#a56b00}.hf-client-tag{display:flex;gap:5px;align-items:center;color:#69758a;font-size:11px;background:#f6f8fb;padding:8px;border-radius:8px;margin-top:12px}.hf-user-status{display:flex;gap:7px;align-items:center;color:#7c8799;font-size:11px;margin-top:15px}.hf-user-status span{width:7px;height:7px;border-radius:50%;background:#d2d8e1}.hf-user-status span.active{background:#27a56c}.hf-loading{text-align:center;padding:45px;color:#8793a5}.hf-empty-page{text-align:center;padding:60px;color:#8490a2}.hf-empty-page h2,.hf-empty-page h3{color:#28364c;margin:12px 0 5px}.hf-empty-page p{margin:0 0 20px}.hf-modal-backdrop{position:fixed;inset:0;background:#07101d99;display:grid;place-items:center;padding:20px;z-index:100;backdrop-filter:blur(3px)}.hf-modal{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 25px 70px #07101d44}.hf-modal.user-modal{width:min(500px,100%)}.hf-modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.hf-modal-head h2{margin:4px 0;font-size:21px}.hf-modal-head p{margin:0;color:#8793a5;font-size:12px}.hf-modal-head>button{border:0;background:#f2f5f8;width:34px;height:34px;border-radius:9px;color:#647188;display:grid;place-items:center}.hf-form{display:grid;gap:3px}.hf-form input,.hf-form select{height:44px;margin-top:7px;border:1px solid #dce2eb;border-radius:10px;padding:0 12px;outline:0;background:#fff}.hf-form input:focus,.hf-form select:focus{border-color:#315efb;box-shadow:0 0 0 4px #315efb12}.hf-password-field{position:relative;margin-top:7px}.hf-password-field input{width:100%;margin-top:0;padding-right:45px}.hf-password-toggle{position:absolute;right:5px;top:5px;width:34px;height:34px;border:0;background:transparent;color:#7d899b;border-radius:8px;display:grid;place-items:center}.hf-password-toggle:hover{background:#f2f5f9;color:#315efb}.hf-form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:10px}.hf-history{display:grid;gap:17px}.hf-history-row{display:flex;gap:12px;position:relative}.hf-history-line{width:8px;height:8px;border-radius:50%;background:#315efb;margin-top:5px;flex:none}.hf-history-row strong{font-size:12px}.hf-history-row p{font-size:12px;color:#677388;margin:5px 0}.hf-history-row span{font-size:10px;color:#9aa4b3}.hf-overlay{display:none}
/* =====================================================
   COMMAND CENTER - BOTÃO DE BUSCA RÁPIDA
   ===================================================== */

.hf-saphire-ia-trigger{
  position:fixed;
  left:24px;
  bottom:26px;
  width:auto;
  min-width:154px;
  height:58px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding:5px 15px 5px 7px;
  border:1px solid rgba(151,184,255,.55);
  border-radius:999px;
  background:
    linear-gradient(135deg,rgba(255,255,255,.98),rgba(241,246,255,.96));
  color:#17356f;
  font-family:Poppins,sans-serif;
  font-size:12px;
  font-weight:800;
  letter-spacing:-.15px;
  cursor:pointer;
  z-index:260;
  overflow:visible;
  box-shadow:
    0 12px 30px rgba(20,65,160,.20),
    0 3px 10px rgba(49,94,251,.12),
    inset 0 1px 0 rgba(255,255,255,1),
    inset 0 -1px 0 rgba(116,151,225,.12);
  transition:
    transform .25s cubic-bezier(.2,.8,.2,1),
    box-shadow .25s ease,
    border-color .25s ease;
  animation:hfSaphireFloat 4s ease-in-out infinite;
}

.hf-saphire-ia-trigger::before{
  content:"";
  position:absolute;
  inset:-7px;
  border-radius:999px;
  background:
    radial-gradient(
      circle,
      rgba(72,132,255,.24) 0%,
      rgba(72,132,255,.10) 38%,
      rgba(72,132,255,0) 72%
    );
  filter:blur(5px);
  z-index:-1;
  opacity:.85;
  animation:hfSaphireAura 3s ease-in-out infinite;
}

.hf-saphire-ia-trigger::after{
  content:"";
  position:absolute;
  top:5px;
  left:48px;
  width:8px;
  height:8px;
  border-radius:50%;
  background:#22c55e;
  border:2px solid #fff;
  box-shadow:
    0 0 0 2px rgba(34,197,94,.16),
    0 0 12px rgba(34,197,94,.65);
  z-index:4;
}

.hf-saphire-ia-trigger-gem{
  position:relative;
  width:48px;
  height:48px;
  flex:none;
  display:grid;
  place-items:center;
  border-radius:50%;
  background:
    radial-gradient(
      circle at 35% 25%,
      rgba(255,255,255,.98) 0%,
      rgba(224,237,255,.94) 22%,
      rgba(184,207,255,.92) 48%,
      rgba(108,149,255,.78) 72%,
      rgba(62,101,211,.72) 100%
    );
  box-shadow:
    inset 0 2px 4px rgba(255,255,255,.95),
    inset 0 -5px 10px rgba(39,75,170,.20),
    0 4px 14px rgba(42,88,210,.25),
    0 0 24px rgba(83,137,255,.28);
  transition:
    transform .3s cubic-bezier(.2,.8,.2,1),
    box-shadow .3s ease;
  overflow:visible;
}

.hf-saphire-ia-trigger-gem::before{
  content:"";
  position:absolute;
  width:12px;
  height:6px;
  top:8px;
  left:11px;
  border-radius:50%;
  background:rgba(255,255,255,.82);
  filter:blur(2px);
  transform:rotate(-28deg);
  pointer-events:none;
}

.hf-saphire-ia-trigger-gem::after{
  content:"✦";
  position:absolute;
  right:-8px;
  top:-8px;
  color:#fff;
  font-size:13px;
  text-shadow:
    0 0 8px rgba(255,255,255,.95),
    0 0 14px rgba(72,132,255,.85);
  animation:hfSaphireSparkle 2.4s ease-in-out infinite;
  pointer-events:none;
}

.hf-saphire-ia-trigger:hover{
  transform:translateY(-4px) scale(1.025);
  border-color:rgba(86,130,236,.72);
  box-shadow:
    0 18px 38px rgba(20,65,160,.25),
    0 5px 18px rgba(49,94,251,.18),
    0 0 28px rgba(73,126,255,.16),
    inset 0 1px 0 rgba(255,255,255,1);
  animation-play-state:paused;
}

.hf-saphire-ia-trigger:hover::before{
  opacity:1;
}

.hf-saphire-ia-trigger:hover .hf-saphire-ia-trigger-gem{
  transform:translateY(-2px) rotate(-3deg) scale(1.05);
  box-shadow:
    inset 0 2px 5px rgba(255,255,255,.98),
    inset 0 -6px 12px rgba(39,75,170,.18),
    0 7px 20px rgba(42,88,210,.30),
    0 0 34px rgba(83,137,255,.42);
}

.hf-saphire-ia-trigger:active{
  transform:translateY(-1px) scale(.97);
}

.hf-saphire-ia-trigger:focus-visible{
  outline:none;
  box-shadow:
    0 0 0 4px rgba(49,94,251,.18),
    0 12px 30px rgba(20,65,160,.20);
}

.hf-saphire-ia-label{
  white-space:nowrap;
  line-height:1;
}

@keyframes hfSaphireFloat{
  0%,100%{
    transform:translateY(0);
  }
  50%{
    transform:translateY(-5px);
  }
}

@keyframes hfSaphireAura{
  0%,100%{
    transform:scale(.92);
    opacity:.62;
  }
  50%{
    transform:scale(1.08);
    opacity:1;
  }
}

@keyframes hfSaphireSparkle{
  0%,100%{
    opacity:.25;
    transform:scale(.75) rotate(0deg);
  }
  45%{
    opacity:1;
    transform:scale(1.15) rotate(18deg);
  }
  70%{
    opacity:.5;
    transform:scale(.9) rotate(30deg);
  }
}

@media(max-width:600px){
  .hf-saphire-ia-trigger{
    left:18px;
    bottom:18px;
    width:58px;
    min-width:58px;
    height:58px;
    padding:5px;
    border-radius:50%;
  }

  .hf-saphire-ia-trigger-gem{
    width:48px;
    height:48px;
  }

  .hf-saphire-ia-label{
    display:none;
  }
}
.hf-command-trigger{
  height:40px;
  display:inline-flex;
  align-items:center;
  gap:9px;
  padding:0 10px 0 12px;
  border:1px solid #dfe5ef;
  border-radius:11px;
  background:#fff;
  color:#344158;
  font-family:Poppins,sans-serif;
  font-size:12px;
  font-weight:600;
  cursor:pointer;
  box-shadow:0 2px 6px rgba(15,23,42,.04);
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease,transform .18s ease;
}

.hf-command-trigger svg{
  width:16px;
  height:16px;
  color:#64748b;
  flex:none;
}

.hf-command-trigger span{
  white-space:nowrap;
}

.hf-command-trigger kbd{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:45px;
  height:24px;
  padding:0 7px;
  border:1px solid #e1e6ee;
  border-radius:6px;
  background:#f6f8fb;
  color:#69758a;
  font-family:inherit;
  font-size:10px;
  font-weight:700;
  line-height:1;
}

.hf-command-trigger:hover{
  background:#f8faff;
  border-color:#b9c8ed;
  box-shadow:0 4px 12px rgba(49,94,251,.10);
  transform:translateY(-1px);
}

.hf-command-trigger:hover svg{
  color:#315efb;
}

.hf-command-trigger:focus-visible{
  outline:none;
  border-color:#315efb;
  box-shadow:0 0 0 3px rgba(49,94,251,.12);
}

@media(max-width:600px){
  .hf-saphire-ia-trigger{
  position:fixed;
  left:24px;
  bottom:26px;
  width:auto;
  min-width:154px;
  height:58px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding:5px 15px 5px 7px;
  border:1px solid rgba(151,184,255,.55);
  border-radius:999px;
  background:
    linear-gradient(135deg,rgba(255,255,255,.98),rgba(241,246,255,.96));
  color:#17356f;
  font-family:Poppins,sans-serif;
  font-size:12px;
  font-weight:800;
  letter-spacing:-.15px;
  cursor:pointer;
  z-index:260;
  overflow:visible;
  box-shadow:
    0 12px 30px rgba(20,65,160,.20),
    0 3px 10px rgba(49,94,251,.12),
    inset 0 1px 0 rgba(255,255,255,1),
    inset 0 -1px 0 rgba(116,151,225,.12);
  transition:
    transform .25s cubic-bezier(.2,.8,.2,1),
    box-shadow .25s ease,
    border-color .25s ease;
  animation:hfSaphireFloat 4s ease-in-out infinite;
}

.hf-saphire-ia-trigger::before{
  content:"";
  position:absolute;
  inset:-7px;
  border-radius:999px;
  background:
    radial-gradient(
      circle,
      rgba(72,132,255,.24) 0%,
      rgba(72,132,255,.10) 38%,
      rgba(72,132,255,0) 72%
    );
  filter:blur(5px);
  z-index:-1;
  opacity:.85;
  animation:hfSaphireAura 3s ease-in-out infinite;
}

.hf-saphire-ia-trigger::after{
  content:"";
  position:absolute;
  top:5px;
  left:48px;
  width:8px;
  height:8px;
  border-radius:50%;
  background:#22c55e;
  border:2px solid #fff;
  box-shadow:
    0 0 0 2px rgba(34,197,94,.16),
    0 0 12px rgba(34,197,94,.65);
  z-index:4;
}

.hf-saphire-ia-trigger-gem{
  position:relative;
  width:48px;
  height:48px;
  flex:none;
  display:grid;
  place-items:center;
  border-radius:50%;
  background:
    radial-gradient(
      circle at 35% 25%,
      rgba(255,255,255,.98) 0%,
      rgba(224,237,255,.94) 22%,
      rgba(184,207,255,.92) 48%,
      rgba(108,149,255,.78) 72%,
      rgba(62,101,211,.72) 100%
    );
  box-shadow:
    inset 0 2px 4px rgba(255,255,255,.95),
    inset 0 -5px 10px rgba(39,75,170,.20),
    0 4px 14px rgba(42,88,210,.25),
    0 0 24px rgba(83,137,255,.28);
  transition:
    transform .3s cubic-bezier(.2,.8,.2,1),
    box-shadow .3s ease;
  overflow:visible;
}

.hf-saphire-ia-trigger-gem::before{
  content:"";
  position:absolute;
  width:12px;
  height:6px;
  top:8px;
  left:11px;
  border-radius:50%;
  background:rgba(255,255,255,.82);
  filter:blur(2px);
  transform:rotate(-28deg);
  pointer-events:none;
}

.hf-saphire-ia-trigger-gem::after{
  content:"✦";
  position:absolute;
  right:-8px;
  top:-8px;
  color:#fff;
  font-size:13px;
  text-shadow:
    0 0 8px rgba(255,255,255,.95),
    0 0 14px rgba(72,132,255,.85);
  animation:hfSaphireSparkle 2.4s ease-in-out infinite;
  pointer-events:none;
}

.hf-saphire-ia-trigger:hover{
  transform:translateY(-4px) scale(1.025);
  border-color:rgba(86,130,236,.72);
  box-shadow:
    0 18px 38px rgba(20,65,160,.25),
    0 5px 18px rgba(49,94,251,.18),
    0 0 28px rgba(73,126,255,.16),
    inset 0 1px 0 rgba(255,255,255,1);
  animation-play-state:paused;
}

.hf-saphire-ia-trigger:hover::before{
  opacity:1;
}

.hf-saphire-ia-trigger:hover .hf-saphire-ia-trigger-gem{
  transform:translateY(-2px) rotate(-3deg) scale(1.05);
  box-shadow:
    inset 0 2px 5px rgba(255,255,255,.98),
    inset 0 -6px 12px rgba(39,75,170,.18),
    0 7px 20px rgba(42,88,210,.30),
    0 0 34px rgba(83,137,255,.42);
}

.hf-saphire-ia-trigger:active{
  transform:translateY(-1px) scale(.97);
}

.hf-saphire-ia-trigger:focus-visible{
  outline:none;
  box-shadow:
    0 0 0 4px rgba(49,94,251,.18),
    0 12px 30px rgba(20,65,160,.20);
}

.hf-saphire-ia-label{
  white-space:nowrap;
  line-height:1;
}

@keyframes hfSaphireFloat{
  0%,100%{
    transform:translateY(0);
  }
  50%{
    transform:translateY(-5px);
  }
}

@keyframes hfSaphireAura{
  0%,100%{
    transform:scale(.92);
    opacity:.62;
  }
  50%{
    transform:scale(1.08);
    opacity:1;
  }
}


/* =====================================================
   SAPHIRE IA — BOTÃO JOIA FINAL
   ===================================================== */

.hf-saphire-ia-trigger{
  position:fixed !important;
  left:24px !important;
  bottom:105px !important;
  width:62px !important;
  min-width:62px !important;
  max-width:62px !important;
  height:62px !important;
  padding:4px !important;
  margin:0 !important;
  display:grid !important;
  place-items:center !important;
  gap:0 !important;
  border:1px solid rgba(157,190,255,.72) !important;
  border-radius:50% !important;
  background:radial-gradient(circle at 35% 25%,#fff 0%,#edf4ff 35%,#d8e6ff 70%,#c2d5ff 100%) !important;
  color:transparent !important;
  font-size:0 !important;
  line-height:0 !important;
  cursor:pointer !important;
  z-index:260 !important;
  overflow:visible !important;
  box-shadow:
    0 12px 28px rgba(24,67,155,.24),
    0 0 20px rgba(74,128,255,.28),
    inset 0 2px 5px rgba(255,255,255,1),
    inset 0 -4px 8px rgba(62,101,190,.14) !important;
  animation:hfSaphireGemFloat 4s ease-in-out infinite !important;
}

.hf-saphire-ia-trigger::before{
  content:"" !important;
  position:absolute !important;
  inset:-14px !important;
  border-radius:50% !important;
  background:radial-gradient(
    circle,
    rgba(67,126,255,.30) 0%,
    rgba(67,126,255,.13) 42%,
    rgba(67,126,255,0) 72%
  ) !important;
  filter:blur(7px) !important;
  z-index:-1 !important;
}

.hf-saphire-ia-trigger::after{
  content:"" !important;
  position:absolute !important;
  top:1px !important;
  right:0 !important;
  left:auto !important;
  width:11px !important;
  height:11px !important;
  border-radius:50% !important;
  background:#22c55e !important;
  border:2px solid #fff !important;
  box-shadow:
    0 0 0 2px rgba(34,197,94,.14),
    0 0 12px rgba(34,197,94,.70) !important;
  z-index:5 !important;
}

.hf-saphire-ia-trigger-gem{
  position:relative !important;
  width:50px !important;
  height:50px !important;
  min-width:50px !important;
  border-radius:50% !important;
  display:grid !important;
  place-items:center !important;
  flex:none !important;
  background:radial-gradient(
    circle at 34% 22%,
    #fff 0%,
    #e2efff 23%,
    #b8d3ff 48%,
    #6897ff 73%,
    #2d53be 100%
  ) !important;
  box-shadow:
    inset 0 2px 5px rgba(255,255,255,1),
    inset 0 -7px 12px rgba(37,73,168,.18),
    0 5px 16px rgba(42,88,210,.30),
    0 0 28px rgba(83,137,255,.38) !important;
}

.hf-saphire-ia-trigger-gem::before{
  content:"" !important;
  position:absolute !important;
  width:15px !important;
  height:7px !important;
  top:7px !important;
  left:10px !important;
  border-radius:50% !important;
  background:rgba(255,255,255,.95) !important;
  filter:blur(2px) !important;
  transform:rotate(-28deg) !important;
}

.hf-saphire-ia-trigger-gem::after{
  content:"✦" !important;
  position:absolute !important;
  right:-7px !important;
  top:-10px !important;
  color:#fff !important;
  font-size:14px !important;
  line-height:1 !important;
  text-shadow:0 0 7px #fff,0 0 16px rgba(72,132,255,.95) !important;
}

.hf-saphire-ia-label{
  display:none !important;
  width:0 !important;
  height:0 !important;
  overflow:hidden !important;
}

.hf-saphire-ia-trigger:hover{
  transform:translateY(-5px) scale(1.07) !important;
}

@keyframes hfSaphireGemFloat{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-5px)}
}

@media(max-width:600px){
  .hf-saphire-ia-trigger{
    left:18px !important;
    bottom:24px !important;
    width:60px !important;
    min-width:60px !important;
    max-width:60px !important;
    height:60px !important;
  }

  .hf-saphire-ia-trigger-gem{
    width:48px !important;
    min-width:48px !important;
    height:48px !important;
  }
}
@keyframes hfSaphireSparkle{
  0%,100%{
    opacity:.25;
    transform:scale(.75) rotate(0deg);
  }
  45%{
    opacity:1;
    transform:scale(1.15) rotate(18deg);
  }
  70%{
    opacity:.5;
    transform:scale(.9) rotate(30deg);
  }
}

@media(max-width:600px){
  .hf-saphire-ia-trigger{
    left:18px;
    bottom:18px;
    width:58px;
    min-width:58px;
    height:58px;
    padding:5px;
    border-radius:50%;
  }

  .hf-saphire-ia-trigger-gem{
    width:48px;
    height:48px;
  }

  .hf-saphire-ia-label{
    display:none;
  }
}
.hf-command-trigger{
    width:40px;
    padding:0;
    justify-content:center;
  }

  .hf-command-trigger span,
  .hf-command-trigger kbd{
    display:none;
  }
}

/* =====================================================
   COMMAND CENTER
   ===================================================== */

.hf-command-backdrop{
  position:fixed;
  inset:0;
  z-index:200;
  background:rgba(7,16,29,.58);
  backdrop-filter:blur(5px);
  display:flex;
  justify-content:center;
  align-items:flex-start;
  padding-top:12vh;
}

.hf-command-modal{
  width:min(680px,calc(100vw - 32px));
  background:#fff;
  border:1px solid #e1e7f0;
  border-radius:16px;
  overflow:hidden;
  box-shadow:0 25px 80px rgba(7,16,29,.28);
}

/* Command Center — campo sem ícone */
.hf-command-search::before,
.hf-command-search::after{
  display:none !important;
  content:none !important;
}

.hf-command-search input{
  background-image:none !important;
  padding-left:0 !important;
}

/* Command Center — remover ícone nativo do input de busca */
.hf-command-search input[type="search"]{
  -webkit-appearance:none !important;
  appearance:none !important;
  background-image:none !important;
}

.hf-command-search input[type="search"]::-webkit-search-decoration,
.hf-command-search input[type="search"]::-webkit-search-cancel-button,
.hf-command-search input[type="search"]::-webkit-search-results-button,
.hf-command-search input[type="search"]::-webkit-search-results-decoration{
  display:none !important;
}

/* Command Center — remover qualquer ícone visual do campo */
.hf-command-search{
  background-image:none !important;
}

.hf-command-search::before,
.hf-command-search::after{
  content:"" !important;
  display:none !important;
  background:none !important;
}

.hf-command-search input{
  background:none !important;
  background-image:none !important;
  -webkit-appearance:none !important;
  appearance:none !important;
  padding-left:0 !important;
}

.hf-command-search input::-webkit-search-decoration,
.hf-command-search input::-webkit-search-cancel-button,
.hf-command-search input::-webkit-search-results-button,
.hf-command-search input::-webkit-search-results-decoration{
  display:none !important;
  -webkit-appearance:none !important;
}
.hf-command-search{position:relative;
  height:68px;
  display:flex;
  align-items:center;
  gap:12px;
  padding:0 18px;
  border-bottom:1px solid #edf0f5;
  color:#315efb;
}

.hf-command-search input{
  flex:1;
  min-width:0;
  border:0;
  outline:0;
  font-family:Poppins,sans-serif;
  font-size:16px;
  color:#172033;
  background:transparent;
}

.hf-command-search input::placeholder{
  color:#98a2b3;
}

.hf-command-search kbd{
  font-size:10px;
  font-weight:700;
  color:#8793a5;
  background:#f3f5f8;
  border:1px solid #e1e6ed;
  border-radius:6px;
  padding:5px 7px;
}

.hf-command-content{
  padding:12px;
  max-height:430px;
  overflow:auto;
}

.hf-command-section-title{
  padding:8px 10px;
  color:#8994a7;
  font-size:10px;
  font-weight:800;
  text-transform:uppercase;
  letter-spacing:.08em;
}

.hf-command-item{
  width:100%;
  border:0;
  background:#fff;
  border-radius:10px;
  padding:11px 12px;
  display:flex;
  align-items:center;
  gap:12px;
  text-align:left;
  cursor:pointer;
  color:#315efb;
}

.hf-command-item:hover{
  background:#f4f7ff;
}

.hf-command-item>div{
  display:flex;
  flex-direction:column;
  gap:2px;
}

.hf-command-item strong{
  color:#202b3f;
  font-size:13px;
}

.hf-command-item span{
  color:#8994a7;
  font-size:11px;
}

.hf-command-footer{
  display:flex;
  gap:18px;
  padding:11px 16px;
  border-top:1px solid #edf0f5;
  color:#8994a7;
  font-size:10px;
}

.hf-command-footer kbd{
  margin-right:4px;
  padding:3px 5px;
  border:1px solid #dfe5ed;
  border-radius:5px;
  background:#f7f9fb;
  color:#69758a;
  font-size:9px;
}

@media(max-width:600px){
  .hf-command-backdrop{
    padding:20px 10px;
  }

  .hf-command-modal{
    width:100%;
  }

  .hf-command-footer{
    flex-wrap:wrap;
    gap:8px;
  }
}


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
.hf-client-cell{display:block;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700;color:#556177;cursor:help}
.hf-approval-actions{display:flex;gap:5px}.hf-reject{border:0;background:#fff0f0;color:#c73a3a;border-radius:7px;padding:7px 8px;font-size:11px;font-weight:700}
.hf-pill.rejected{background:#fff0f0;color:#c73a3a}.hf-rejection-reason{display:inline-block;max-width:220px;color:#a33a3a;background:#fff5f5;border:1px solid #ffd7d7;border-radius:8px;padding:6px 8px;line-height:1.35;font-size:11px;white-space:normal}.hf-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}


/* =========================================================
   SAPPHIRE — CENTRAL DE NOTIFICAÇÕES
   ========================================================= */

.hf-notification-trigger{
  position:relative !important;
  width:40px !important;
  height:40px !important;
  flex:none !important;

  display:grid !important;
  place-items:center !important;

  border:1px solid #e2e7ef !important;
  border-radius:11px !important;

  background:#fff !important;
  color:#657188 !important;

  cursor:pointer !important;
  transition:
    background .18s ease,
    border-color .18s ease,
    color .18s ease,
    transform .18s ease,
    box-shadow .18s ease !important;
}

.hf-notification-trigger:hover{
  background:#f7f9fc !important;
  border-color:#d5dce7 !important;
  color:#315efb !important;
  transform:translateY(-1px) !important;
  box-shadow:0 5px 14px rgba(31,45,67,.08) !important;
}

.hf-notification-trigger:active{
  transform:scale(.96) !important;
}

.hf-notification-trigger:focus-visible{
  outline:3px solid rgba(49,94,251,.15) !important;
  outline-offset:2px !important;
}

.hf-notification-badge{
  position:absolute !important;
  top:-5px !important;
  right:-5px !important;

  min-width:18px !important;
  height:18px !important;

  padding:0 4px !important;

  display:flex !important;
  align-items:center !important;
  justify-content:center !important;

  border:2px solid #fff !important;
  border-radius:20px !important;

  background:#e5484d !important;
  color:#fff !important;

  font-size:9px !important;
  line-height:1 !important;
  font-weight:800 !important;

  box-shadow:0 2px 6px rgba(229,72,77,.25) !important;
}

@media(max-width:600px){
  .hf-notification-trigger{
    width:38px !important;
    height:38px !important;
  }
}

@media(max-width:1000px){.hf-sidebar{transform:translateX(-100%);transition:.2s}.hf-sidebar.open{transform:translateX(0)}.hf-overlay{display:block;position:fixed;inset:0;background:#07101d66;z-index:15}.hf-main{margin-left:0;width:100%;padding:22px}.hf-menu{display:grid;border:1px solid #e1e6ee;background:#fff;width:38px;height:38px;border-radius:10px;place-items:center;color:#344158}.hf-topbar{align-items:flex-start}.hf-topbar>div:nth-child(2){flex:1}.hf-cards{grid-template-columns:repeat(2,1fr)}.hf-grid2{grid-template-columns:1fr}.hf-user-grid{grid-template-columns:repeat(2,1fr)}.hf-client-grid{grid-template-columns:repeat(2,1fr)}.hf-filters{flex-wrap:wrap}.hf-search{min-width:100%}}
@media(max-width:600px){.hf-login{background:#f4f7fb;padding:14px}.hf-login-card{padding:25px 20px;border-radius:18px}.hf-topbar h1{font-size:23px}.hf-top-actions .hf-primary{display:none}.hf-cards{grid-template-columns:1fr}.hf-cards.small{grid-template-columns:1fr 1fr}.hf-user-grid{grid-template-columns:1fr}.hf-client-grid{grid-template-columns:1fr}.hf-form-grid{grid-template-columns:1fr}.hf-filters select{flex:1}.hf-filter-count{width:100%}.hf-totals{flex-wrap:wrap;justify-content:flex-start}.hf-main{padding:16px}.hf-panel{padding:14px}}

/* =====================================================
   MODAIS - NOVA DEMANDA / APROVAÇÃO / REPROVAÇÃO
   ===================================================== */
/* =========================================================
   SAPPHIRE — MODAL DE DEMANDA MODERNO
   ========================================================= */

.hf-demand-modal{
  width:min(820px,calc(100vw - 32px));
  max-height:calc(100vh - 32px);
  overflow-y:auto;
  padding:0;
  border-radius:22px;
  background:#fff;
  box-shadow:0 28px 90px rgba(7,16,29,.22);
}

.hf-demand-modal .hf-modal-head{
  padding:24px 26px 20px;
  margin:0;
  border-bottom:1px solid #edf0f5;
  background:linear-gradient(180deg,#fff 0%,#fbfcfe 100%);
}

.hf-demand-modal .hf-modal-head h2{
  margin:4px 0 5px;
  font-size:22px;
  font-weight:800;
  letter-spacing:-.4px;
  color:#172033;
}

.hf-demand-modal .hf-modal-head p{
  font-size:12px;
  color:#8793a5;
}

.hf-demand-form{
  padding:0 26px 26px;
  gap:0;
}

.hf-form-section{
  padding:24px 0;
  border-bottom:1px solid #edf0f5;
}

.hf-form-section:first-child{
  padding-top:22px;
}

.hf-form-section:last-of-type{
  border-bottom:0;
}

.hf-section-title{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:18px;
}

.hf-section-title>span{
  width:34px;
  height:34px;
  border-radius:10px;
  display:grid;
  place-items:center;
  background:#eef3ff;
  color:#315efb;
  font-size:11px;
  font-weight:800;
  box-shadow:inset 0 0 0 1px #dfe7ff;
}

.hf-section-title strong{
  font-size:14px;
  font-weight:800;
  color:#202b3f;
}

.hf-section-title small{
  color:#8994a7;
  font-size:11px;
}

.hf-demand-form .hf-form-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

.hf-demand-form label{
  display:flex;
  flex-direction:column;
  gap:7px;
  margin-bottom:15px;
}

.hf-demand-form label>span{
  font-size:11px;
  font-weight:800;
  color:#566176;
}

.hf-demand-form input,
.hf-demand-form select,
.hf-demand-form textarea{
  width:100%;
  box-sizing:border-box;
  border:1px solid #dfe5ee;
  background:#fbfcfe;
  border-radius:12px;
  padding:11px 13px;
  color:#172033;
  font-size:13px;
  outline:none;
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;
}

.hf-demand-form input,
.hf-demand-form select{
  height:46px;
}

.hf-demand-form textarea{
  min-height:92px;
  line-height:1.5;
  resize:vertical;
}

.hf-demand-form input:hover,
.hf-demand-form select:hover,
.hf-demand-form textarea:hover{
  border-color:#cbd5e4;
  background:#fff;
}

.hf-demand-form input:focus,
.hf-demand-form select:focus,
.hf-demand-form textarea:focus{
  border-color:#315efb;
  background:#fff;
  box-shadow:0 0 0 4px rgba(49,94,251,.09);
}

.hf-demand-form .hf-input-suffix{
  position:relative;
  display:flex;
  align-items:center;
}

.hf-demand-form .hf-input-suffix input{
  padding-right:58px;
}

.hf-demand-form .hf-input-suffix small{
  position:absolute;
  right:13px;
  color:#8a95a6;
  font-size:11px;
  font-weight:700;
  pointer-events:none;
}

.hf-form-actions{
  padding-top:22px;
  margin-top:0;
  border-top:1px solid #edf0f5;
}

.hf-form-actions .hf-secondary,
.hf-form-actions .hf-primary{
  height:42px;
  padding:0 17px;
  border-radius:11px;
}

.hf-form-actions .hf-primary{
  box-shadow:0 7px 18px rgba(49,94,251,.20);
}

@media(max-width:650px){
  .hf-demand-modal{
    width:calc(100vw - 20px);
    max-height:calc(100vh - 20px);
    border-radius:18px;
  }

  .hf-demand-modal .hf-modal-head{
    padding:20px;
  }

  .hf-demand-form{
    padding:0 20px 20px;
  }

  .hf-demand-form .hf-form-grid{
    grid-template-columns:1fr;
    gap:0;
  }

  .hf-form-section{
    padding:20px 0;
  }
}
.hf-demand-modal{width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow-y:auto}
.hf-demand-form{gap:0}
.hf-form-section{padding:20px 0;border-bottom:1px solid #edf0f5}
.hf-form-section:first-child{padding-top:4px}
.hf-form-section:last-of-type{border-bottom:0}
.hf-section-title{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.hf-section-title>span{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#eef3ff;color:#315efb;font-size:11px;font-weight:800}
.hf-section-title div{display:flex;flex-direction:column;gap:2px}
.hf-section-title strong{font-size:13px;color:#202b3f}
.hf-section-title small{color:#8994a7;font-size:11px}
.hf-demand-form label{display:flex;flex-direction:column;gap:7px;margin-bottom:15px}
.hf-demand-form label>span{font-size:12px;font-weight:700;color:#465268}
.hf-demand-form input,.hf-demand-form select,.hf-demand-form textarea{width:100%;border:1px solid #dfe5ee;background:#fbfcfe;border-radius:10px;padding:11px 13px;color:#172033;font-size:13px;outline:none;transition:.18s}
.hf-demand-form input,.hf-demand-form select{height:44px;padding-top:0;padding-bottom:0}
.hf-demand-form textarea{resize:vertical;min-height:78px;line-height:1.5}
.hf-demand-form input:focus,.hf-demand-form select:focus,.hf-demand-form textarea:focus{border-color:#6d8dfb;background:#fff;box-shadow:0 0 0 3px #315efb12}
.hf-input-suffix{position:relative}
.hf-input-suffix input{padding-right:58px}
.hf-input-suffix small{position:absolute;right:13px;top:50%;transform:translateY(-50%);color:#8b95a7;font-size:11px;pointer-events:none}
.hf-form-error{display:flex;align-items:center;gap:9px;padding:11px 13px;border-radius:10px;background:#fff1f1;border:1px solid #ffd5d5;color:#c53c3c;font-size:12px;margin-top:4px}
.hf-decision-modal{width:min(590px,calc(100vw - 32px))}
.hf-decision-demand{margin:0 24px 4px;padding:15px 16px;border:1px solid #e7ebf2;background:#f8faff;border-radius:12px}
.hf-decision-demand>span{display:block;color:#8a94a6;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px}
.hf-decision-demand>strong{display:block;color:#202b3f;font-size:14px;line-height:1.4}
.hf-decision-demand>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
.hf-decision-demand>div span{padding:5px 9px;border-radius:7px;background:#fff;border:1px solid #e4e8ef;color:#687489;font-size:10px;font-weight:600}
.hf-decision-content{padding-top:8px}
.hf-decision-icon{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;margin-bottom:13px}
.hf-decision-icon.approved{background:#e9f8ef;color:#199653}
.hf-decision-icon.rejected{background:#fff0f0;color:#d74747}
.hf-decision-content h3{margin:0 0 5px;font-size:14px;color:#202b3f}
.hf-decision-content p{margin:0 0 18px;color:#8994a7;font-size:12px;line-height:1.5}
.hf-decision-content label{display:flex;flex-direction:column;gap:7px}
.hf-decision-content label>span{font-size:12px;font-weight:700;color:#465268}
.hf-filter-month{display:flex;align-items:center;gap:7px;height:38px;padding:0 10px;border:1px solid #dfe5ee;border-radius:10px;background:#fff;color:#5d687a;font-size:12px;white-space:nowrap}
.hf-filter-month input{border:0;background:transparent;color:#172033;font-size:12px;outline:none;min-width:120px;padding:0}
.hf-filter-month button{border:0;background:transparent;color:#8a94a6;font-size:18px;line-height:1;padding:0 2px}
.hf-filter-month button:hover{color:#172033}
@media(max-width:900px){.hf-filter-month{width:100%}.hf-filter-month input{flex:1}}
.hf-month-input{width:100%;height:48px;border:1px solid #dfe5ee;border-radius:10px;padding:0 13px;background:#fbfcfe;color:#172033;font-family:Poppins,sans-serif;font-size:14px;outline:none}
.hf-month-input:focus{border-color:#315efb;box-shadow:0 0 0 3px #315efb12}
.hf-rejection-textarea{width:100%;resize:vertical;border:1px solid #e0e5ed;border-radius:10px;padding:13px;font-family:Poppins,sans-serif;font-size:13px;line-height:1.55;color:#172033;background:#fbfcfe;outline:none}
.hf-rejection-textarea:focus{border-color:#df5555;box-shadow:0 0 0 3px #df555512;background:#fff}
.hf-reject-confirm{background:#d94c4c!important;border-color:#d94c4c!important;color:#fff!important}
.hf-reject-confirm:hover{background:#c93f3f!important;border-color:#c93f3f!important}
@media(max-width:650px){.hf-form-grid{grid-template-columns:1fr}.hf-demand-modal,.hf-decision-modal{width:calc(100vw - 20px)}.hf-modal-head{padding:18px}.hf-demand-form,.hf-decision-modal .hf-form{padding:0 18px 18px}.hf-decision-demand{margin-left:18px;margin-right:18px}}



/* =========================================================
   SAPPHIRE — MODAL DE DEMANDA MODERNO
   ========================================================= */

.hf-demand-modal{
  width:min(760px,calc(100vw - 32px)) !important;
  max-height:calc(100vh - 32px) !important;
  padding:0 !important;
  border-radius:22px !important;
  overflow-y:auto !important;
  background:#fff !important;
  box-shadow:0 28px 80px rgba(15,23,42,.22) !important;
}

.hf-demand-modal .hf-modal-head{
  padding:24px 28px 20px !important;
  background:#fff !important;
  border-bottom:1px solid #edf0f5 !important;
}

.hf-demand-modal .hf-modal-head h2{
  margin:0 !important;
  font-size:23px !important;
  font-weight:800 !important;
  letter-spacing:-.5px !important;
  color:#172033 !important;
}

.hf-demand-modal .hf-modal-head p{
  margin-top:5px !important;
  color:#8995a8 !important;
  font-size:12px !important;
}

.hf-demand-form{
  padding:0 28px 24px !important;
}

.hf-demand-form .hf-form-section{
  padding:24px 0 !important;
  border-bottom:1px solid #edf0f5 !important;
}

.hf-demand-form .hf-section-title{
  display:flex !important;
  align-items:center !important;
  gap:12px !important;
  margin-bottom:18px !important;
}

.hf-demand-form .hf-section-title>span{
  width:34px !important;
  height:34px !important;
  min-width:34px !important;
  display:grid !important;
  place-items:center !important;
  border-radius:10px !important;
  background:#eef3ff !important;
  color:#315efb !important;
  font-size:11px !important;
  font-weight:800 !important;
}

.hf-demand-form .hf-section-title strong{
  display:block !important;
  font-size:14px !important;
  font-weight:800 !important;
  color:#202b3f !important;
}

.hf-demand-form .hf-section-title small{
  display:block !important;
  margin-top:3px !important;
  font-size:11px !important;
  color:#8994a7 !important;
}

.hf-demand-form .hf-form-grid{
  display:grid !important;
  grid-template-columns:1fr 1fr !important;
  gap:14px !important;
}

.hf-demand-form label{
  display:flex !important;
  flex-direction:column !important;
  gap:7px !important;
  margin-bottom:15px !important;
}

.hf-demand-form label>span{
  font-size:11px !important;
  font-weight:800 !important;
  color:#465268 !important;
}

.hf-demand-form input,
.hf-demand-form select,
.hf-demand-form textarea{
  width:100% !important;
  box-sizing:border-box !important;
  border:1px solid #dce3ec !important;
  border-radius:11px !important;
  background:#fbfcfe !important;
  color:#172033 !important;
  font-size:13px !important;
  outline:none !important;
}

.hf-demand-form input,
.hf-demand-form select{
  height:46px !important;
  padding:0 13px !important;
}

.hf-demand-form textarea{
  min-height:88px !important;
  padding:12px 13px !important;
  resize:vertical !important;
  line-height:1.5 !important;
}

.hf-demand-form input:hover,
.hf-demand-form select:hover,
.hf-demand-form textarea:hover{
  background:#fff !important;
  border-color:#c8d2e0 !important;
}

.hf-demand-form input:focus,
.hf-demand-form select:focus,
.hf-demand-form textarea:focus{
  background:#fff !important;
  border-color:#315efb !important;
  box-shadow:0 0 0 4px rgba(49,94,251,.09) !important;
}

.hf-demand-form .hf-input-suffix{
  position:relative !important;
}

.hf-demand-form .hf-input-suffix input{
  padding-right:62px !important;
}

.hf-demand-form .hf-input-suffix small{
  right:13px !important;
  color:#8793a5 !important;
  font-size:10px !important;
  font-weight:700 !important;
}

/* bloco de estimativas */
.hf-demand-form .hf-form-section:nth-child(2) .hf-form-grid{
  margin-bottom:14px !important;
}

/* responsável */
.hf-demand-form .hf-form-section:nth-child(2)>label:last-child{
  margin-top:2px !important;
}

.hf-demand-modal .hf-form-actions{
  display:flex !important;
  justify-content:flex-end !important;
  align-items:center !important;
  gap:9px !important;
  padding-top:20px !important;
  border-top:1px solid #edf0f5 !important;
}

.hf-demand-modal .hf-form-actions button{
  height:43px !important;
  padding:0 18px !important;
  border-radius:11px !important;
  font-weight:750 !important;
}

.hf-demand-modal .hf-form-actions .hf-primary{
  box-shadow:0 8px 20px rgba(49,94,251,.20) !important;
}

.hf-demand-modal .hf-form-actions .hf-primary:hover{
  transform:translateY(-1px) !important;
  box-shadow:0 11px 25px rgba(49,94,251,.25) !important;
}

@media(max-width:650px){
  .hf-demand-modal{
    width:calc(100vw - 20px) !important;
    max-height:calc(100vh - 20px) !important;
    border-radius:18px !important;
  }

  .hf-demand-modal .hf-modal-head{
    padding:20px !important;
  }

  .hf-demand-form{
    padding:0 20px 20px !important;
  }

  .hf-demand-form .hf-form-grid{
    grid-template-columns:1fr !important;
  }
}

/* =========================================================
   SAPPHIRE — FILTROS CLEAN
   ========================================================= */


/* =========================================================
   SAPPHIRE — MODAL DE NOTIFICAÇÕES
   ========================================================= */

.hf-notifications-modal{
  width:min(560px,calc(100vw - 32px)) !important;
  max-height:min(680px,calc(100vh - 48px)) !important;

  display:flex !important;
  flex-direction:column !important;

  background:#fff !important;
  border:1px solid #e5e9f0 !important;
  border-radius:18px !important;

  overflow:hidden !important;

  box-shadow:
    0 24px 70px rgba(20,31,52,.20),
    0 6px 22px rgba(20,31,52,.08) !important;
}

.hf-notifications-head{
  display:flex !important;
  align-items:center !important;
  justify-content:space-between !important;

  padding:20px 22px !important;

  border-bottom:1px solid #edf0f5 !important;
  background:#fff !important;
}

.hf-notifications-head>div:first-child{
  display:flex !important;
  flex-direction:column !important;
  gap:4px !important;
}

.hf-notifications-title{
  display:flex !important;
  align-items:center !important;
  gap:9px !important;

  color:#172033 !important;
}

.hf-notifications-title svg{
  color:#315efb !important;
}

.hf-notifications-title strong{
  font-size:16px !important;
  font-weight:800 !important;
}

.hf-notifications-head>div:first-child>span{
  color:#8a94a6 !important;
  font-size:11px !important;
}

.hf-notifications-head>button{
  width:36px !important;
  height:36px !important;

  display:grid !important;
  place-items:center !important;

  border:0 !important;
  border-radius:10px !important;

  background:#f5f7fa !important;
  color:#657188 !important;

  cursor:pointer !important;

  transition:.18s ease !important;
}

.hf-notifications-head>button:hover{
  background:#edf1f6 !important;
  color:#172033 !important;
}

.hf-notifications-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 14px;
  border-bottom:1px solid #edf0f4;
  background:#fff;
}

.hf-notification-tabs{
  display:flex;
  align-items:center;
  gap:4px;
}

.hf-notification-tabs button{
  border:0;
  background:transparent;
  color:#8994a7;
  padding:7px 10px;
  border-radius:8px;
  font-size:11px;
  font-weight:700;
  cursor:pointer;
}

.hf-notification-tabs button:hover{
  background:#f5f7fb;
  color:#465268;
}

.hf-notification-tabs button.active{
  background:#eef3ff;
  color:#315efb;
}

.hf-notification-tabs button span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:17px;
  height:17px;
  margin-left:5px;
  padding:0 4px;
  border-radius:9px;
  background:#315efb;
  color:#fff;
  font-size:9px;
}

.hf-notifications-clear{
  border:0;
  background:transparent;
  color:#a04b4b;
  font-size:10px;
  font-weight:700;
  cursor:pointer;
  white-space:nowrap;
}

.hf-notifications-clear:hover{
  color:#d74747;
  text-decoration:underline;
}

.hf-notification-item.read{
  opacity:.72;
}

.hf-notification-item.unread{
  background:#fbfcff !important;
}

.hf-notification-unread-dot{
  width:7px;
  height:7px;
  min-width:7px;
  border-radius:50%;
  background:#315efb;
}

@media(max-width:600px){

  .hf-notifications-toolbar{
    align-items:flex-start;
    flex-direction:column;
  }

  .hf-notification-tabs{
    width:100%;
  }

  .hf-notification-tabs button{
    flex:1;
  }

  .hf-notifications-clear{
    align-self:flex-end;
  }

}
.hf-notifications-list{
  flex:1 !important;
  overflow-y:auto !important;

  padding:8px !important;

  background:#fbfcfe !important;
}

.hf-notification-item{
  width:100% !important;

  display:flex !important;
  align-items:center !important;
  gap:12px !important;

  padding:14px !important;
  margin:0 !important;

  border:0 !important;
  border-bottom:1px solid #edf0f4 !important;

  background:#fff !important;

  text-align:left !important;
  cursor:pointer !important;

  transition:.16s ease !important;
}

.hf-notification-item:first-child{
  border-radius:12px 12px 0 0 !important;
}

.hf-notification-item:last-child{
  border-bottom:0 !important;
  border-radius:0 0 12px 12px !important;
}

.hf-notification-item:hover{
  background:#f7f9fc !important;
}

.hf-notification-item-icon{
  width:38px !important;
  height:38px !important;
  min-width:38px !important;

  display:grid !important;
  place-items:center !important;

  border-radius:11px !important;

  background:#eef3ff !important;
  color:#315efb !important;
}

.hf-notification-item.approval .hf-notification-item-icon{
  background:#fff6df !important;
  color:#c58a00 !important;
}

.hf-notification-item.assigned .hf-notification-item-icon{
  background:#eef3ff !important;
  color:#315efb !important;
}

.hf-notification-item.deadline .hf-notification-item-icon{
  background:#fff0f0 !important;
  color:#d74747 !important;
}

.hf-notification-item.info .hf-notification-item-icon{
  background:#edf8f2 !important;
  color:#199653 !important;
}

.hf-notification-item-content{
  min-width:0 !important;
  flex:1 !important;

  display:flex !important;
  flex-direction:column !important;
  gap:4px !important;
}

.hf-notification-item-content strong{
  color:#202b3f !important;
  font-size:12px !important;
  font-weight:750 !important;
  line-height:1.35 !important;
}

.hf-notification-item-content span{
  color:#8994a7 !important;
  font-size:11px !important;
  line-height:1.4 !important;
}

.hf-notification-arrow{
  flex:none !important;

  color:#a1aabb !important;
  font-size:17px !important;

  transition:.16s ease !important;
}

.hf-notification-item:hover .hf-notification-arrow{
  color:#315efb !important;
  transform:translateX(2px) !important;
}

.hf-notifications-empty{
  min-height:260px !important;

  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;

  gap:8px !important;

  color:#8994a7 !important;
}

.hf-notifications-empty svg{
  color:#b1bac8 !important;
  margin-bottom:4px !important;
}

.hf-notifications-empty strong{
  color:#465268 !important;
  font-size:13px !important;
}

.hf-notifications-empty span{
  font-size:11px !important;
}

@media(max-width:600px){

  .hf-notifications-modal{
    width:calc(100vw - 20px) !important;
    max-height:calc(100vh - 20px) !important;
    border-radius:16px !important;
  }

  .hf-notifications-head{
    padding:17px !important;
  }

  .hf-notifications-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 14px;
  border-bottom:1px solid #edf0f4;
  background:#fff;
}

.hf-notification-tabs{
  display:flex;
  align-items:center;
  gap:4px;
}

.hf-notification-tabs button{
  border:0;
  background:transparent;
  color:#8994a7;
  padding:7px 10px;
  border-radius:8px;
  font-size:11px;
  font-weight:700;
  cursor:pointer;
}

.hf-notification-tabs button:hover{
  background:#f5f7fb;
  color:#465268;
}

.hf-notification-tabs button.active{
  background:#eef3ff;
  color:#315efb;
}

.hf-notification-tabs button span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:17px;
  height:17px;
  margin-left:5px;
  padding:0 4px;
  border-radius:9px;
  background:#315efb;
  color:#fff;
  font-size:9px;
}

.hf-notifications-clear{
  border:0;
  background:transparent;
  color:#a04b4b;
  font-size:10px;
  font-weight:700;
  cursor:pointer;
  white-space:nowrap;
}

.hf-notifications-clear:hover{
  color:#d74747;
  text-decoration:underline;
}

.hf-notification-item.read{
  opacity:.72;
}

.hf-notification-item.unread{
  background:#fbfcff !important;
}

.hf-notification-unread-dot{
  width:7px;
  height:7px;
  min-width:7px;
  border-radius:50%;
  background:#315efb;
}

@media(max-width:600px){

  .hf-notifications-toolbar{
    align-items:flex-start;
    flex-direction:column;
  }

  .hf-notification-tabs{
    width:100%;
  }

  .hf-notification-tabs button{
    flex:1;
  }

  .hf-notifications-clear{
    align-self:flex-end;
  }

}
.hf-notifications-list{
    padding:6px !important;
  }

  .hf-notification-item{
    padding:12px !important;
  }

}

.hf-action-success{
  position:absolute !important;
  z-index:20 !important;

  top:50% !important;
  left:50% !important;

  transform:translate(-50%,-50%) !important;

  width:320px !important;
  min-height:210px !important;

  box-sizing:border-box !important;

  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;

  gap:9px !important;

  padding:28px !important;

  background:#ffffff !important;

  border:1px solid #e7ebf1 !important;

  border-radius:18px !important;

  box-shadow:0 18px 50px rgba(30,45,70,.16) !important;

  animation:hfSuccessIn .22s ease-out !important;
}

.hf-action-success-icon{
  width:58px !important;
  height:58px !important;

  display:grid !important;
  place-items:center !important;

  border-radius:50% !important;

  background:#eaf8ef !important;
  color:#199653 !important;

  animation:hfSuccessIcon .35s ease-out !important;
}

.hf-action-success strong{
  color:#202b3f !important;
  font-size:16px !important;
  font-weight:750 !important;
  text-align:center !important;
}

.hf-action-success span{
  color:#8994a7 !important;
  font-size:12px !important;
  line-height:1.5 !important;
  text-align:center !important;
}
@keyframes hfSuccessIn{
  from{
    opacity:0;
  }

  to{
    opacity:1;
  }
}

@keyframes hfSuccessIcon{
  from{
    transform:scale(.65);
    opacity:0;
  }

  to{
    transform:scale(1);
    opacity:1;
  }
}

.hf-filters-clean {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px !important;

  background: #ffffff !important;
  border: 1px solid #e4eaf3 !important;
  border-radius: 16px !important;

  box-shadow: 0 2px 8px rgba(16,24,40,.03) !important;
}

.hf-filters-clean .hf-search {
  flex: 1 !important;
  min-width: 0 !important;

  height: 42px !important;

  display: flex !important;
  align-items: center !important;
  gap: 9px !important;

  padding: 0 13px !important;

  background: #fff !important;
  border: 1px solid #dfe6f1 !important;
  border-radius: 10px !important;

  color: #8794a7 !important;

  transition: .18s ease !important;
}

.hf-filters-clean .hf-search:focus-within {
  border-color: #2f5bea !important;
  box-shadow: 0 0 0 3px rgba(47,91,234,.08) !important;
}

.hf-filters-clean .hf-search svg {
  width: 18px !important;
  height: 18px !important;
  color: #8996a9 !important;
}

.hf-filters-clean .hf-search input {
  flex: 1 !important;
  min-width: 0 !important;

  border: 0 !important;
  outline: 0 !important;

  background: transparent !important;

  color: #344054 !important;
  font-size: 14px !important;
}

.hf-filters-clean .hf-search input::placeholder {
  color: #98a2b3 !important;
}


/* =========================================================
   BOTÃO FILTROS
   ========================================================= */

.hf-filter-trigger {
  height: 42px !important;

  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 7px !important;

  padding: 0 15px !important;

  border: 1px solid #dce4ef !important;
  border-radius: 10px !important;

  background: #ffffff !important;
  color: #475467 !important;

  font-family: inherit !important;
  font-size: 14px !important;
  font-weight: 600 !important;

  cursor: pointer !important;

  transition: all .18s ease !important;
}

.hf-filter-trigger svg {
  width: 16px !important;
  height: 16px !important;

  color: #667085 !important;

  stroke-width: 2 !important;
}

.hf-filter-trigger:hover {
  background: #f6f8ff !important;
  border-color: #c5d2f3 !important;
  color: #2f5bea !important;
}

.hf-filter-trigger:hover svg {
  color: #2f5bea !important;
}


/* =========================================================
   RESULTADOS
   ========================================================= */

.hf-filter-count {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;

  color: #98a2b3 !important;

  font-size: 13px !important;
  font-weight: 500 !important;

  white-space: nowrap !important;
}

.hf-filter-count svg {
  width: 15px !important;
  height: 15px !important;
}


/* =========================================================
   BACKDROP
   ========================================================= */

.hf-filter-modal-backdrop {
  position: fixed !important;
  inset: 0 !important;

  z-index: 99999 !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  padding: 24px !important;

  background: rgba(13,26,45,.42) !important;

  backdrop-filter: blur(5px) !important;
  -webkit-backdrop-filter: blur(5px) !important;
}


/* =========================================================
   MODAL
   ========================================================= */

.hf-filter-modal {
  width: min(680px, calc(100vw - 48px)) !important;
  max-width: 680px !important;

  max-height: calc(100vh - 48px) !important;

  display: flex !important;
  flex-direction: column !important;

  overflow: hidden !important;

  background: #ffffff !important;

  border: 1px solid #e5eaf2 !important;
  border-radius: 18px !important;

  box-shadow:
    0 24px 70px rgba(15,23,42,.18),
    0 8px 24px rgba(15,23,42,.08) !important;

  animation: sapphireFilterModal .18s ease-out !important;
}

@keyframes sapphireFilterModal {

  from {
    opacity: 0;
    transform: translateY(8px) scale(.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

}


/* =========================================================
   CABEÇALHO
   ========================================================= */

.hf-filter-modal-header {
  min-height: 76px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;

  padding: 18px 22px !important;

  background: #ffffff !important;

  border-bottom: 1px solid #edf1f6 !important;
}

.hf-filter-modal-header > div:first-child {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}

.hf-filter-modal-header h3 {
  margin: 0 !important;

  color: #172033 !important;

  font-family: inherit !important;
  font-size: 19px !important;
  font-weight: 700 !important;
  letter-spacing: -.2px !important;
}

.hf-filter-modal-header p {
  margin: 0 !important;

  color: #98a2b3 !important;

  font-size: 13px !important;
}


/* =========================================================
   FECHAR
   ========================================================= */

.hf-filter-modal-close {
  width: 34px !important;
  height: 34px !important;

  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;

  padding: 0 !important;

  border: 0 !important;
  border-radius: 9px !important;

  background: transparent !important;
  color: #98a2b3 !important;

  font-size: 21px !important;
  line-height: 1 !important;

  cursor: pointer !important;

  transition: .15s ease !important;
}

.hf-filter-modal-close:hover {
  background: #f2f4f7 !important;
  color: #344054 !important;
}


/* =========================================================
   CORPO
   ========================================================= */

.hf-filter-modal-body {
  display: grid !important;

  grid-template-columns: repeat(2, minmax(0,1fr)) !important;

  gap: 18px !important;

  padding: 22px !important;

  overflow-y: auto !important;

  background: #ffffff !important;
}


/* =========================================================
   CAMPOS
   ========================================================= */

.hf-filter-modal-body > label {
  display: flex !important;
  flex-direction: column !important;

  gap: 7px !important;

  min-width: 0 !important;

  margin: 0 !important;
}

.hf-filter-modal-body > label > span {
  color: #667085 !important;

  font-size: 13px !important;
  font-weight: 600 !important;
}


/* =========================================================
   SELECTS
   ========================================================= */

.hf-filter-modal-body select {
  width: 100% !important;
  height: 44px !important;

  box-sizing: border-box !important;

  padding: 0 13px !important;

  border: 1px solid #dce3ed !important;
  border-radius: 10px !important;

  background: #ffffff !important;
  color: #344054 !important;

  font-family: inherit !important;
  font-size: 14px !important;
  font-weight: 500 !important;

  outline: none !important;

  cursor: pointer !important;

  transition: all .15s ease !important;
}

.hf-filter-modal-body select:hover {
  border-color: #bcc9df !important;
  background: #fcfdff !important;
}

.hf-filter-modal-body select:focus {
  border-color: #4770f5 !important;

  box-shadow:
    0 0 0 3px rgba(47,91,234,.08) !important;
}


/* =========================================================
   EXECUÇÃO
   ========================================================= */

.hf-execution-filter-modal {
  width: 100% !important;
  height: 44px !important;

  box-sizing: border-box !important;

  display: flex !important;
  align-items: center !important;

  padding: 0 11px !important;

  border: 1px solid #dce3ed !important;
  border-radius: 10px !important;

  background: #ffffff !important;

  color: #8491a5 !important;
}

.hf-execution-filter-modal:focus-within {
  border-color: #4770f5 !important;

  box-shadow:
    0 0 0 3px rgba(47,91,234,.08) !important;
}

.hf-execution-filter-modal svg {
  width: 17px !important;
  height: 17px !important;

  color: #8190a5 !important;
}

.hf-execution-filter-modal input {
  flex: 1 !important;
  min-width: 0 !important;

  margin-left: 8px !important;

  border: 0 !important;
  outline: 0 !important;

  background: transparent !important;

  color: #344054 !important;

  font-family: inherit !important;
  font-size: 14px !important;
}

.hf-execution-filter-modal button {
  width: 26px !important;
  height: 26px !important;

  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;

  border: 0 !important;
  border-radius: 7px !important;

  background: #f2f4f7 !important;
  color: #667085 !important;

  cursor: pointer !important;
}


/* =========================================================
   RODAPÉ
   ========================================================= */

.hf-filter-modal-footer {
  min-height: 74px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;

  padding: 15px 22px !important;

  border-top: 1px solid #edf1f6 !important;

  background: #fbfcfe !important;
}

.hf-filter-clear,
.hf-filter-apply {
  height: 42px !important;

  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;

  padding: 0 18px !important;

  border-radius: 9px !important;

  font-family: inherit !important;
  font-size: 14px !important;
  font-weight: 600 !important;

  cursor: pointer !important;

  transition: all .15s ease !important;
}

.hf-filter-clear {
  border: 1px solid #dce3ed !important;

  background: #ffffff !important;
  color: #667085 !important;
}

.hf-filter-clear:hover {
  background: #f7f9fc !important;
  color: #344054 !important;
}

.hf-filter-apply {
  min-width: 145px !important;

  border: 0 !important;

  background: #2f5bea !important;
  color: #ffffff !important;

  box-shadow: 0 5px 14px rgba(47,91,234,.20) !important;
}

.hf-filter-apply:hover {
  background: #244bd0 !important;

  box-shadow: 0 7px 18px rgba(47,91,234,.25) !important;

  transform: translateY(-1px) !important;
}


/* =========================================================
   MOBILE
   ========================================================= */

@media (max-width: 700px) {

  .hf-filter-modal-backdrop {
    align-items: flex-start !important;
    padding: 10px !important;
  }

  .hf-filter-modal {
    width: calc(100vw - 20px) !important;
    max-width: none !important;
    max-height: calc(100vh - 20px) !important;
  }

/* =========================================================
   DASHBOARD - CSS LIMPO E FINAL
   ========================================================= */

/* ---------- GRID PRINCIPAL ---------- */

.hf-dashboard-kpis{
  display:grid !important;
  grid-template-columns:repeat(5,minmax(0,1fr)) !important;
  gap:16px !important;
  width:100% !important;
}

.hf-dashboard-secondary{
  display:grid !important;
  grid-template-columns:repeat(5,minmax(0,1fr)) !important;
  gap:16px !important;
  width:100% !important;
}

.hf-dashboard-main-grid{
  display:grid !important;
  grid-template-columns:minmax(0,1.45fr) minmax(360px,.85fr) !important;
  gap:18px !important;
  align-items:stretch !important;
}

.hf-dashboard-main-grid > *{
  min-width:0 !important;
}

.hf-chart-panel,
.hf-hours-chart-panel{
  width:100% !important;
  min-width:0 !important;
  box-sizing:border-box !important;
  min-height:360px !important;
}

.hf-dashboard-demand-panel{
  width:100% !important;
  margin-top:18px !important;
}

/* ---------- CARDS ---------- */

.hf-dashboard-kpis > *,
.hf-dashboard-secondary > *{
  min-width:0 !important;
  box-sizing:border-box !important;
}

/* ---------- GRÁFICO ---------- */


/* DASHBOARD STATUS - FINAL */
.hf-status-chart{display:grid !important;grid-template-columns:210px minmax(0,1fr) !important;align-items:center !important;gap:28px !important;width:100% !important;margin-top:18px !important;}
.hf-donut{width:200px !important;height:200px !important;min-width:200px !important;flex:0 0 200px !important;position:relative !important;display:flex !important;align-items:center !important;justify-content:center !important;background:none !important;}
.hf-donut::after{content:'' !important;position:absolute !important;width:122px !important;height:122px !important;border-radius:50% !important;background:#fff !important;z-index:2 !important;}
.hf-donut-svg{width:100% !important;height:100% !important;display:block !important;position:relative !important;z-index:1 !important;}
.hf-donut-segment{cursor:pointer !important;transition:stroke-width .2s ease,opacity .2s ease,filter .2s ease !important;}
.hf-donut-segment:hover{stroke-width:22 !important;opacity:1 !important;filter:drop-shadow(0 4px 8px rgba(15,23,42,.25)) !important;}
.hf-donut-dynamic:hover .hf-donut-segment:not(:hover){opacity:.28 !important;}
.hf-donut-center{position:absolute !important;inset:0 !important;z-index:5 !important;display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;pointer-events:none !important;}
.hf-donut-center strong{font-size:32px !important;font-weight:800 !important;line-height:1 !important;color:#18243b !important;}
.hf-donut-center span{margin-top:6px !important;font-size:12px !important;color:#8a96a8 !important;}
.hf-chart-legend{display:flex !important;flex-direction:column !important;gap:0 !important;width:100% !important;min-width:0 !important;}
.hf-chart-legend-row{display:grid !important;grid-template-columns:minmax(0,1fr) 45px 45px !important;align-items:center !important;min-height:42px !important;padding:6px 10px !important;border-bottom:1px solid #edf0f5 !important;border-radius:8px !important;transition:background .18s ease,transform .18s ease !important;}
.hf-chart-legend-row:last-child{border-bottom:0 !important;}
.hf-chart-legend-row:hover{background:#f7f9fc !important;transform:translateX(3px) !important;}
.hf-chart-legend-label{display:flex !important;align-items:center !important;gap:10px !important;min-width:0 !important;color:#334155 !important;font-size:14px !important;}
.hf-status-dot{width:10px !important;height:10px !important;min-width:10px !important;border-radius:50% !important;}
.hf-chart-legend-row strong{text-align:right !important;font-size:14px !important;font-weight:700 !important;color:#18243b !important;}
.hf-chart-legend-row small{text-align:right !important;font-size:12px !important;color:#8c98aa !important;}
@media(max-width:900px){.hf-status-chart{grid-template-columns:180px minmax(0,1fr) !important;gap:20px !important;}.hf-donut{width:175px !important;height:175px !important;min-width:175px !important;flex-basis:175px !important;}}
@media(max-width:700px){.hf-status-chart{grid-template-columns:1fr !important;justify-items:center !important;}.hf-chart-legend{width:100% !important;}.hf-donut{width:170px !important;height:170px !important;min-width:170px !important;flex-basis:170px !important;}}
/* Remove o antigo donut CSS */
.hf-donut.hf-donut-dynamic::after{
  display:none !important;
  content:none !important;
}

/* SVG do gráfico */
.hf-donut-svg{
  position:absolute !important;
  inset:0 !important;
  width:100% !important;
  height:100% !important;
  display:block !important;
  visibility:visible !important;
  opacity:1 !important;
  overflow:visible !important;
  z-index:1 !important;
}

/* círculo de fundo */
.hf-donut-svg circle:first-child{
  stroke:#edf1f7 !important;
}

/* segmentos */
.hf-donut-segment{
  cursor:pointer !important;
  opacity:1 !important;
  transition:
    stroke-width .2s ease,
    opacity .2s ease,
    filter .2s ease !important;
}

/* hover no segmento */
.hf-donut-segment:hover{
  stroke-width:22 !important;
  opacity:1 !important;
  filter:drop-shadow(0 4px 7px rgba(15,23,42,.25)) !important;
}

/* quando passa sobre o gráfico */
.hf-donut-dynamic:hover .hf-donut-segment:not(:hover){
  opacity:.35 !important;
}

/* centro */
.hf-donut-center{
  position:absolute !important;
  inset:0 !important;
  z-index:5 !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
  pointer-events:none !important;
}

.hf-donut-center strong{
  font-size:32px !important;
  font-weight:800 !important;
  line-height:1 !important;
  color:#18243b !important;
}

.hf-donut-center span{
  margin-top:6px !important;
  font-size:12px !important;
  color:#8a96a8 !important;
}

/* ---------- LEGENDA ---------- */

.hf-chart-legend{
  display:flex !important;
  flex-direction:column !important;
  gap:0 !important;
  min-width:0 !important;
  width:100% !important;
}

.hf-chart-legend-row{
  display:grid !important;
  grid-template-columns:minmax(0,1fr) 45px 40px !important;
  align-items:center !important;
  min-height:42px !important;
  padding:7px 8px !important;
  border-bottom:1px solid #edf0f5 !important;
  border-radius:8px !important;
  cursor:pointer !important;
  transition:
    background .18s ease,
    transform .18s ease !important;
}

.hf-chart-legend-row:last-child{
  border-bottom:0 !important;
}

.hf-chart-legend-row:hover{
  background:#f7f9fc !important;
  transform:translateX(3px) !important;
}

.hf-chart-legend-label{
  display:flex !important;
  align-items:center !important;
  gap:10px !important;
  min-width:0 !important;
}

.hf-chart-legend-label > span:last-child{
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  white-space:nowrap !important;
}

.hf-chart-legend-row strong{
  text-align:right !important;
  font-size:14px !important;
  color:#18243b !important;
}

.hf-chart-legend-row small{
  text-align:right !important;
  font-size:12px !important;
  color:#8c98aa !important;
}

.hf-status-dot{
  width:9px !important;
  height:9px !important;
  min-width:9px !important;
  border-radius:50% !important;
  display:inline-block !important;
  transition:
    transform .18s ease,
    box-shadow .18s ease !important;
}

.hf-chart-legend-row:hover .hf-status-dot{
  transform:scale(1.35) !important;
  box-shadow:0 0 0 4px rgba(71,112,245,.10) !important;
}

/* Cores dos status */
.hf-status-dot.dot-aguardando-analise{
  background:#94a3b8 !important;
}

.hf-status-dot.dot-em-analise{
  background:#3b82f6 !important;
}

.hf-status-dot.dot-analisada{
  background:#8b5cf6 !important;
}

.hf-status-dot.dot-em-desenvolvimento{
  background:#06b6d4 !important;
}

.hf-status-dot.dot-em-homologacao{
  background:#f59e0b !important;
}

.hf-status-dot.dot-concluida{
  background:#22c55e !important;
}

/* ---------- RESUMO DE HORAS ---------- */

.hf-hours-summary{
  padding:4px 20px 20px !important;
  min-width:0 !important;
}

.hf-big-number{
  margin:8px 0 4px !important;
  font-size:38px !important;
  font-weight:800 !important;
  line-height:1.05 !important;
  color:#18243b !important;
}

.hf-hours-bars{
  display:flex !important;
  flex-direction:column !important;
  gap:18px !important;
  margin-top:25px !important;
}

.hf-hours-bar-track{
  width:100% !important;
  height:9px !important;
  border-radius:999px !important;
  background:#edf1f7 !important;
  overflow:hidden !important;
}

.hf-hours-bar-fill{
  height:100% !important;
  min-width:2px !important;
  border-radius:999px !important;
  transition:width .45s ease !important;
}

.hf-hours-footer{
  display:grid !important;
  grid-template-columns:1fr 1fr !important;
  gap:20px !important;
  margin-top:22px !important;
  padding-top:17px !important;
  border-top:1px solid #edf0f5 !important;
}

/* ---------- PAINEL DE DEMANDAS ---------- */

.hf-dashboard-demand-panel{
  border-radius:16px !important;
  border:1px solid #e5eaf2 !important;
  box-shadow:0 3px 12px rgba(15,23,42,.035) !important;
}

/* ---------- RESPONSIVO ---------- */

@media (max-width:1200px){

  .hf-dashboard-kpis,
  .hf-dashboard-secondary{
    grid-template-columns:repeat(3,minmax(0,1fr)) !important;
  }

  .hf-dashboard-main-grid{
    grid-template-columns:1fr !important;
  }
}

@media (max-width:800px){

  .hf-dashboard-kpis,
  .hf-dashboard-secondary{
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
  }

  .hf-status-chart{
    grid-template-columns:1fr !important;
  }

  .hf-donut.hf-donut-dynamic{
    margin:0 auto !important;
  }
}

@media (max-width:520px){

  .hf-dashboard-kpis,
  .hf-dashboard-secondary{
    grid-template-columns:1fr !important;
  }

  .hf-donut.hf-donut-dynamic{
    width:175px !important;
    height:175px !important;
    min-width:175px !important;
  }

  .hf-chart-legend-row{
    grid-template-columns:minmax(0,1fr) 35px 35px !important;
  }
}

.hf-donut-segment{cursor:pointer!important;transition:stroke-width .2s ease,opacity .2s ease,filter .2s ease!important}.hf-donut-segment:hover{stroke-width:23!important;opacity:1!important;filter:drop-shadow(0 4px 8px rgba(15,23,42,.28))!important}.hf-donut-dynamic:hover .hf-donut-segment:not(:hover){opacity:.22!important}.hf-chart-legend-row:hover{background:#f5f8ff!important;transform:translateX(4px)!important;box-shadow:0 3px 10px rgba(15,23,42,.06)!important}.hf-chart-legend-row:hover .hf-status-dot{transform:scale(1.35)!important;box-shadow:0 0 0 4px rgba(71,112,245,.10)!important}.hf-status-dot{transition:transform .18s ease,box-shadow .18s ease!important}.hf-chart-legend-row{cursor:default!important;transition:background .18s ease,transform .18s ease,box-shadow .18s ease!important}
 
/* =====================================================
   DASHBOARD MODERNA - GRAFICO DE PIZZA
   ===================================================== */

.hf-status-modern{
  display:grid !important;
  grid-template-columns:240px minmax(0,1fr) !important;
  align-items:center !important;
  gap:32px !important;
  width:100% !important;
  min-height:280px !important;
  margin-top:18px !important;
}

.hf-pie-wrap{
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
}

.hf-pie-chart{
  width:215px !important;
  height:215px !important;
  border-radius:50% !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  box-shadow:0 8px 25px rgba(15,23,42,.08) !important;
}

.hf-pie-hole{
  width:120px !important;
  height:120px !important;
  border-radius:50% !important;
  background:#fff !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
  box-shadow:0 2px 8px rgba(15,23,42,.06) !important;
}

.hf-pie-hole strong{
  font-size:32px !important;
  font-weight:800 !important;
  line-height:1 !important;
  color:#18243b !important;
}

.hf-pie-hole span{
  margin-top:6px !important;
  font-size:12px !important;
  color:#8b97a8 !important;
}

.hf-pie-legend{
  display:flex !important;
  flex-direction:column !important;
  width:100% !important;
}

.hf-pie-row{
  display:grid !important;
  grid-template-columns:minmax(0,1fr) 55px 45px !important;
  align-items:center !important;
  min-height:44px !important;
  padding:7px 10px !important;
  border-bottom:1px solid #edf1f6 !important;
  border-radius:8px !important;
  transition:background .18s ease,transform .18s ease !important;
}

.hf-pie-row:last-child{
  border-bottom:0 !important;
}

.hf-pie-row:hover{
  background:#f7f9fc !important;
  transform:translateX(3px) !important;
}

.hf-pie-name{
  display:flex !important;
  align-items:center !important;
  gap:10px !important;
  font-size:14px !important;
  color:#334155 !important;
}

.hf-pie-dot{
  width:10px !important;
  height:10px !important;
  min-width:10px !important;
  border-radius:50% !important;
}

.hf-pie-row strong{
  text-align:right !important;
  font-size:14px !important;
  color:#18243b !important;
}

.hf-pie-row small{
  text-align:right !important;
  font-size:12px !important;
  color:#8b97a8 !important;
}

@media(max-width:900px){

  .hf-status-modern{
    grid-template-columns:190px minmax(0,1fr) !important;
    gap:22px !important;
  }

  .hf-pie-chart{
    width:180px !important;
    height:180px !important;
  }

  .hf-pie-hole{
    width:100px !important;
    height:100px !important;
  }

}

@media(max-width:700px){

  .hf-status-modern{
    grid-template-columns:1fr !important;
    gap:22px !important;
  }

  .hf-pie-chart{
    width:175px !important;
    height:175px !important;
  }

  .hf-pie-hole{
    width:98px !important;
    height:98px !important;
  }

}
/* =========================================================
   CORRECAO DEFINITIVA - GRAFICO DE STATUS
   ========================================================= */

.hf-status-modern{
  display:grid !important;
  grid-template-columns:240px minmax(0,1fr) !important;
  align-items:center !important;
  gap:32px !important;
  width:100% !important;
  min-height:260px !important;
  margin-top:18px !important;
  box-sizing:border-box !important;
}

.hf-status-modern .hf-pie-wrap{
  width:240px !important;
  height:240px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  position:relative !important;
  flex:none !important;
}

.hf-status-modern .hf-pie-chart{
  width:210px !important;
  height:210px !important;
  min-width:210px !important;
  min-height:210px !important;
  max-width:210px !important;
  max-height:210px !important;
  flex:none !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  position:relative !important;
  border-radius:50% !important;
  overflow:hidden !important;
  box-sizing:border-box !important;
  background-color:#edf1f7 !important;
}

.hf-status-modern .hf-pie-hole{
  width:118px !important;
  height:118px !important;
  min-width:118px !important;
  min-height:118px !important;
  border-radius:50% !important;
  background:#ffffff !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
  position:absolute !important;
  top:50% !important;
  left:50% !important;
  transform:translate(-50%,-50%) !important;
  z-index:20 !important;
  box-sizing:border-box !important;
}

.hf-status-modern .hf-pie-hole strong{
  display:block !important;
  font-size:32px !important;
  font-weight:800 !important;
  line-height:1 !important;
  color:#18243b !important;
}

.hf-status-modern .hf-pie-hole span{
  display:block !important;
  margin-top:6px !important;
  font-size:12px !important;
  line-height:1 !important;
  color:#8b97a8 !important;
}

.hf-status-modern .hf-pie-legend{
  display:flex !important;
  flex-direction:column !important;
  width:100% !important;
  min-width:0 !important;
  gap:0 !important;
}

.hf-status-modern .hf-pie-row{
  display:grid !important;
  grid-template-columns:minmax(0,1fr) 50px 50px !important;
  align-items:center !important;
  width:100% !important;
  min-height:42px !important;
  padding:6px 10px !important;
  margin:0 !important;
  box-sizing:border-box !important;
  border-bottom:1px solid #edf1f6 !important;
  border-radius:7px !important;
}

.hf-status-modern .hf-pie-row:last-child{
  border-bottom:0 !important;
}

.hf-status-modern .hf-pie-row:hover{
  background:#f7f9fc !important;
  transform:translateX(3px) !important;
}

.hf-status-modern .hf-pie-name{
  display:flex !important;
  align-items:center !important;
  gap:10px !important;
  min-width:0 !important;
  font-size:14px !important;
  line-height:1.2 !important;
  color:#334155 !important;
}

.hf-status-modern .hf-pie-dot{
  display:block !important;
  width:10px !important;
  height:10px !important;
  min-width:10px !important;
  max-width:10px !important;
  border-radius:50% !important;
}

.hf-status-modern .hf-pie-row strong{
  display:block !important;
  text-align:right !important;
  font-size:14px !important;
  font-weight:700 !important;
  line-height:1.2 !important;
  color:#18243b !important;
}

.hf-status-modern .hf-pie-row small{
  display:block !important;
  text-align:right !important;
  font-size:12px !important;
  line-height:1.2 !important;
  color:#8b97a8 !important;
}

@media(max-width:900px){

  .hf-status-modern{
    grid-template-columns:190px minmax(0,1fr) !important;
    gap:20px !important;
  }

  .hf-status-modern .hf-pie-wrap{
    width:190px !important;
    height:190px !important;
  }

  .hf-status-modern .hf-pie-chart{
    width:175px !important;
    height:175px !important;
    min-width:175px !important;
    min-height:175px !important;
    max-width:175px !important;
    max-height:175px !important;
  }

  .hf-status-modern .hf-pie-hole{
    width:98px !important;
    height:98px !important;
    min-width:98px !important;
    min-height:98px !important;
  }

}

@media(max-width:700px){

  .hf-status-modern{
    grid-template-columns:1fr !important;
    justify-items:center !important;
    gap:20px !important;
  }

  .hf-status-modern .hf-pie-legend{
    width:100% !important;
  }

}

/* =========================================================
   ESPACAMENTO - ULTIMAS DEMANDAS
   Nao altera o grafico ou os dados
   ========================================================= */

.hf-dashboard-demand-panel{
  margin-top:28px !important;
  padding:0 !important;
  border-radius:16px !important;
  overflow:hidden !important;
}

.hf-dashboard-demand-panel .hf-panel-title{
  padding:24px 24px 18px !important;
  margin:0 !important;
}

.hf-dashboard-demand-panel .hf-panel-title h2{
  margin:0 !important;
  font-size:18px !important;
  line-height:1.3 !important;
}

.hf-dashboard-demand-panel .hf-panel-title p{
  margin:7px 0 0 !important;
  font-size:13px !important;
  line-height:1.5 !important;
  color:#8b97a8 !important;
}

.hf-dashboard-demand-panel .hf-dashboard-demand-table{
  margin-top:4px !important;
}

.hf-dashboard-demand-panel table{
  border-collapse:separate !important;
  border-spacing:0 !important;
}

.hf-dashboard-demand-panel th{
  padding:13px 12px !important;
  height:44px !important;
  vertical-align:middle !important;
}

.hf-dashboard-demand-panel td{
  padding:15px 12px !important;
  height:62px !important;
  vertical-align:middle !important;
}

.hf-dashboard-demand-panel tbody tr{
  transition:background .18s ease !important;
}

.hf-dashboard-demand-panel tbody tr:hover{
  background:#f8fafc !important;
}

.hf-dashboard-demand-panel .hf-table-actions{
  padding-right:18px !important;
}

@media(max-width:900px){
  .hf-dashboard-demand-panel .hf-panel-title{
    padding:20px 18px 15px !important;
  }

  .hf-dashboard-demand-panel td{
    padding:13px 9px !important;
  }

  .hf-dashboard-demand-panel th{
    padding:11px 9px !important;
  }
}

/* ESPACO REAL DA SECAO ULTIMAS DEMANDAS */
.hf-ultimas-demandas{
  margin-top:32px !important;
  padding:0 !important;
  border-radius:16px !important;
  overflow:hidden !important;
}

.hf-ultimas-demandas > .hf-panel-title{
  padding:26px 24px 20px !important;
  margin:0 !important;
}

.hf-ultimas-demandas > .hf-panel-title h2{
  margin:0 !important;
  line-height:1.35 !important;
}

.hf-ultimas-demandas > .hf-panel-title p{
  margin-top:8px !important;
  margin-bottom:0 !important;
  line-height:1.5 !important;
}

.hf-ultimas-demandas table{
  margin-top:8px !important;
}

.hf-ultimas-demandas th{
  padding-top:14px !important;
  padding-bottom:14px !important;
}

.hf-ultimas-demandas td{
  padding-top:16px !important;
  padding-bottom:16px !important;
}

.hf-ultimas-demandas tbody tr{
  min-height:62px !important;
}

@media(max-width:900px){
  .hf-ultimas-demandas > .hf-panel-title{
    padding:22px 18px 17px !important;
  }

  .hf-ultimas-demandas td{
    padding-top:13px !important;
    padding-bottom:13px !important;
  }
}
`



























































































































































































































