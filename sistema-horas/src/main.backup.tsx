import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Filter,
  History,
  LayoutDashboard,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  Clipboard,
  CalendarDays,
} from 'lucide-react';
import './styles.css';

type Status =
  | 'Aguardando análise'
  | 'Em análise'
  | 'Aguardando aprovação'
  | 'Em desenvolvimento'
  | 'Em homologação'
  | 'Concluída'
  | 'Reprovada';

type Priority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

type HistoryItem = {
  id: string;
  date: string;
  user: string;
  field: string;
  oldValue: string;
  newValue: string;
};

type Demand = {
  id: string;
  numero: number;
  problema: string;
  tratamento: string;
  horasAnalise: number;
  horasNecessarias: number;
  prioridade: Priority;
  status: Status;
  aprovacao: 'Pendente' | 'Aprovada' | 'Reprovada';
  aprovadoPor: string;
  aprovadoEm: string;
  pago: boolean;
  responsavel: string;
  criadoEm: string;
  history: HistoryItem[];
};

type NewDemandForm = {
  problema: string;
  tratamento: string;
  horasAnalise: number;
  horasNecessarias: number;
  prioridade: Priority;
  status: Status;
  responsavel: string;
};

const API_URL = 'http://localhost:3001/api';

const statuses: Status[] = [
  'Aguardando análise',
  'Em análise',
  'Aguardando aprovação',
  'Em desenvolvimento',
  'Em homologação',
  'Concluída',
  'Reprovada',
];

const priorities: Priority[] = [
  'Baixa',
  'Média',
  'Alta',
  'Urgente',
];

const emptyForm: NewDemandForm = {
  problema: '',
  tratamento: '',
  horasAnalise: 0,
  horasNecessarias: 0,
  prioridade: 'Média',
  status: 'Aguardando análise',
  responsavel: '',
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function App() {
  const [demands, setDemands] = useState<Demand[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [period, setPeriod] = useState('Todos');

  const [tab, setTab] = useState<'dashboard' | 'demandas'>(
    'dashboard'
  );

  const [showDemandModal, setShowDemandModal] =
    useState(false);

  const [newDemandForm, setNewDemandForm] =
    useState<NewDemandForm>(emptyForm);

  const [historyDemand, setHistoryDemand] =
    useState<Demand | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDemands();
  }, []);

  const loadDemands = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/demands`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Erro ao carregar demandas.'
        );
      }

      setDemands(result.data || []);
    } catch (error) {
      console.error(
        'Erro ao carregar demandas:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return demands.filter((demand) => {
      const text = search.toLowerCase().trim();

      const matchesSearch =
        !text ||
        String(demand.numero)
          .toLowerCase()
          .includes(text) ||
        demand.problema
          .toLowerCase()
          .includes(text) ||
        demand.tratamento
          .toLowerCase()
          .includes(text) ||
        demand.responsavel
          .toLowerCase()
          .includes(text);

      const matchesStatus =
        statusFilter === 'Todos' ||
        demand.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'Todas' ||
        demand.prioridade === priorityFilter;

      const matchesPeriod =
        period === 'Todos' ||
        demand.criadoEm?.startsWith(period);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesPeriod
      );
    });
  }, [
    demands,
    search,
    statusFilter,
    priorityFilter,
    period,
  ]);

  const totalAnalysis = useMemo(
    () =>
      filtered.reduce(
        (total, demand) =>
          total + Number(demand.horasAnalise || 0),
        0
      ),
    [filtered]
  );

  const totalNeeded = useMemo(
    () =>
      filtered.reduce(
        (total, demand) =>
          total + Number(demand.horasNecessarias || 0),
        0
      ),
    [filtered]
  );

  const totalHours = totalAnalysis + totalNeeded;

  const approvedCount = filtered.filter(
    (demand) => demand.aprovacao === 'Aprovada'
  ).length;

  const paidCount = filtered.filter(
    (demand) => demand.pago
  ).length;

  const developmentCount = filtered.filter(
    (demand) =>
      demand.status === 'Em desenvolvimento'
  ).length;

  const homologationCount = filtered.filter(
    (demand) =>
      demand.status === 'Em homologação'
  ).length;

  const updateField = async (
    id: string,
    field: keyof Demand,
    value: unknown
  ) => {
    const demand = demands.find(
      (item) => item.id === id
    );

    if (!demand) return;

    const oldValue = String(
      demand[field] ?? ''
    );

    const newValue = String(value ?? '');

    if (oldValue === newValue) return;

    const labels: Record<string, string> = {
      problema: 'Identificação do problema',
      tratamento: 'Tratamento do problema',
      horasAnalise: 'Horas de análise',
      horasNecessarias: 'Horas necessárias',
      prioridade: 'Prioridade',
      status: 'Status',
      responsavel: 'Responsável',
      pago: 'Pago',
    };

    const historyItem: HistoryItem = {
      id: uid(),
      date: new Date().toLocaleString(
        'pt-BR'
      ),
      user: 'Usuário atual',
      field: labels[field] || field,
      oldValue,
      newValue,
    };

    const updatedDemand = {
      ...demand,
      [field]: value,
      history: [
        historyItem,
        ...(demand.history || []),
      ],
    };

    try {
      const response = await fetch(
        `${API_URL}/demands/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            updatedDemand
          ),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Erro ao atualizar demanda.'
        );
      }

      setDemands((current) =>
        current.map((item) =>
          item.id === id
            ? result.data
            : item
        )
      );
    } catch (error) {
      console.error(
        'Erro ao atualizar demanda:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a alteração.'
      );
    }
  };

  const openNewDemand = () => {
    setNewDemandForm({
      ...emptyForm,
    });

    setShowDemandModal(true);
  };

  const addDemand = async () => {
    if (!newDemandForm.problema.trim()) {
      alert(
        'Informe a identificação do problema.'
      );
      return;
    }

    if (!newDemandForm.tratamento.trim()) {
      alert(
        'Informe o tratamento do problema.'
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/demands`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            problem:
              newDemandForm.problema,
            treatment:
              newDemandForm.tratamento,
            analysisHours:
              Number(
                newDemandForm.horasAnalise
              ) || 0,
            requiredHours:
              Number(
                newDemandForm.horasNecessarias
              ) || 0,
            priority:
              newDemandForm.prioridade,
            status:
              newDemandForm.status,
            approval: 'Pendente',
            approvedBy: null,
            paid: false,
            responsavel:
              newDemandForm.responsavel,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Erro ao criar demanda.'
        );
      }

      setDemands((current) => [
        result.data,
        ...current,
      ]);

      setNewDemandForm({
        ...emptyForm,
      });

      setShowDemandModal(false);
      setTab('demandas');
    } catch (error) {
      console.error(
        'Erro ao criar demanda:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a demanda.'
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteDemand = async (id: string) => {
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir esta demanda?'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/demands/${id}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Erro ao excluir demanda.'
        );
      }

      setDemands((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );
    } catch (error) {
      console.error(
        'Erro ao excluir demanda:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir a demanda.'
      );
    }
  };

  const approveDemand = async (
    demand: Demand
  ) => {
    const approvedBy =
      window.prompt(
        'Informe quem aprovou a demanda:'
      );

    if (!approvedBy?.trim()) return;

    try {
      const response = await fetch(
        `${API_URL}/demands/${demand.id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            approvedBy,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Erro ao aprovar demanda.'
        );
      }

      setDemands((current) =>
        current.map((item) =>
          item.id === demand.id
            ? result.data
            : item
        )
      );
    } catch (error) {
      console.error(
        'Erro ao aprovar demanda:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível aprovar a demanda.'
      );
    }
  };

  const payDemand = async (
    demand: Demand
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/demands/${demand.id}/pay`,
        {
          method: 'POST',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Erro ao marcar demanda como paga.'
        );
      }

      setDemands((current) =>
        current.map((item) =>
          item.id === demand.id
            ? result.data
            : item
        )
      );
    } catch (error) {
      console.error(
        'Erro ao pagar demanda:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível marcar como paga.'
      );
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            H
          </div>

          <div>
            <strong>HoraFlow</strong>
            <span>Gestão de demandas</span>
          </div>
        </div>

        <nav>
          <button
            className={
              tab === 'dashboard'
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              setTab('dashboard')
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>

          <button
            className={
              tab === 'demandas'
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              setTab('demandas')
            }
          >
            <Clipboard size={18} />
            Demandas
          </button>

          <button
            className="nav-item"
            onClick={() =>
              alert(
                'Módulo de horas disponível em breve.'
              )
            }
          >
            <Clock3 size={18} />
            Horas
          </button>

          <button
            className="nav-item"
            onClick={() =>
              alert(
                'Módulo de usuários disponível em breve.'
              )
            }
          >
            <Users size={18} />
            Usuários
          </button>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>
              {tab === 'dashboard'
                ? 'Dashboard'
                : 'Demandas'}
            </h1>

            <p>
              Acompanhe demandas, aprovações e
              horas desempenhadas.
            </p>
          </div>

          <button
            className="primary"
            onClick={openNewDemand}
          >
            <Plus size={17} />
            Nova demanda
          </button>
        </header>

        <section className="filters">
          <div className="search">
            <Search size={17} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Buscar..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option>Todos</option>

            {statuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value)
            }
          >
            <option>Todas</option>

            {priorities.map((priority) => (
              <option
                key={priority}
                value={priority}
              >
                {priority}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value)
            }
          >
            <option value="Todos">
              Períodos
            </option>

            <option value="2026-08">
              Agosto/2026
            </option>

            <option value="2026-07">
              Julho/2026
            </option>
          </select>

          <span className="filter-label">
            <Filter size={15} />
            {filtered.length} resultados
          </span>
        </section>

        {tab === 'dashboard' ? (
          <>
            <section className="cards">
              <Card
                title="Demandas"
                value={filtered.length}
                icon={<BarChart3 />}
              />

              <Card
                title="Horas de análise"
                value={`${totalAnalysis}h`}
                icon={<Clock3 />}
              />

              <Card
                title="Horas necessárias"
                value={`${totalNeeded}h`}
                icon={<Clock3 />}
              />

              <Card
                title="Horas totais"
                value={`${totalHours}h`}
                icon={<CheckCircle2 />}
              />
            </section>

            <section className="cards small-cards">
              <Card
                title="Aprovadas"
                value={approvedCount}
                icon={<CheckCircle2 />}
              />

              <Card
                title="Pagas"
                value={paidCount}
                icon={<CheckCircle2 />}
              />

              <Card
                title="Em desenvolvimento"
                value={developmentCount}
                icon={<BarChart3 />}
              />

              <Card
                title="Em homologação"
                value={homologationCount}
                icon={<BarChart3 />}
              />
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <div className="panel-header">
                  <h2>Demandas por status</h2>
                </div>

                <div className="status-list">
                  {statuses.map((status) => {
                    const count =
                      filtered.filter(
                        (demand) =>
                          demand.status ===
                          status
                      ).length;

                    const percentage =
                      filtered.length > 0
                        ? (count /
                            filtered.length) *
                          100
                        : 0;

                    return (
                      <div
                        className="status-row"
                        key={status}
                      >
                        <span>{status}</span>

                        <strong>{count}</strong>

                        <div className="progress">
                          <div
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>
                    <CalendarDays size={18} />
                    Resumo do período
                  </h2>
                </div>

                <div className="period-summary">
                  <strong>
                    {totalHours}h
                  </strong>

                  <span>
                    Horas totais no filtro atual
                  </span>

                  <div className="summary-values">
                    <div>
                      <small>Análise</small>
                      <strong>
                        {totalAnalysis}h
                      </strong>
                    </div>

                    <div>
                      <small>Desenvolvimento</small>
                      <strong>
                        {totalNeeded}h
                      </strong>
                    </div>

                    <div>
                      <small>Pagas</small>
                      <strong>
                        {paidCount}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Últimas demandas</h2>

                <button
                  className="link-button"
                  onClick={() =>
                    setTab('demandas')
                  }
                >
                  Ver todas
                </button>
              </div>

              <DemandTable
                demands={filtered.slice(0, 5)}
                onUpdate={updateField}
                onDelete={deleteDemand}
                onHistory={setHistoryDemand}
                onApprove={approveDemand}
                onPay={payDemand}
              />
            </section>
          </>
        ) : (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Planilha de demandas</h2>

                <p>
                  {filtered.length} demandas •{' '}
                  {totalHours}h totais
                </p>
              </div>

              <button
                className="secondary"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(
                      filtered
                        .map(
                          (demand) =>
                            `${demand.numero}\t${demand.problema}\t${demand.tratamento}\t${demand.horasAnalise}\t${demand.horasNecessarias}\t${demand.prioridade}\t${demand.status}`
                        )
                        .join('\n')
                    )
                    .then(() =>
                      alert(
                        'Tabela copiada!'
                      )
                    );
                }}
              >
                <Clipboard size={16} />
                Copiar tabela
              </button>
            </div>

            <DemandTable
              demands={filtered}
              onUpdate={updateField}
              onDelete={deleteDemand}
              onHistory={setHistoryDemand}
              onApprove={approveDemand}
              onPay={payDemand}
            />
          </section>
        )}

        {loading && (
          <div className="loading">
            Carregando...
          </div>
        )}
      </main>

      {showDemandModal && (
        <div
          className="modal-overlay"
          onMouseDown={() =>
            setShowDemandModal(false)
          }
        >
          <div
            className="modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>Nova demanda</h2>
                <p>
                  Cadastre uma nova demanda.
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setShowDemandModal(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="form">
              <label>
                Identificação do problema *
                <textarea
                  value={
                    newDemandForm.problema
                  }
                  onChange={(e) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        problema:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="Descreva o problema..."
                />
              </label>

              <label>
                Tratamento do problema *
                <textarea
                  value={
                    newDemandForm.tratamento
                  }
                  onChange={(e) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        tratamento:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="Informe o tratamento..."
                />
              </label>

              <div className="form-grid">
                <label>
                  Horas de análise
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={
                      newDemandForm.horasAnalise
                    }
                    onChange={(e) =>
                      setNewDemandForm(
                        (current) => ({
                          ...current,
                          horasAnalise:
                            Number(
                              e.target.value
                            ),
                        })
                      )
                    }
                  />
                </label>

                <label>
                  Horas necessárias
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={
                      newDemandForm.horasNecessarias
                    }
                    onChange={(e) =>
                      setNewDemandForm(
                        (current) => ({
                          ...current,
                          horasNecessarias:
                            Number(
                              e.target.value
                            ),
                        })
                      )
                    }
                  />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Prioridade
                  <select
                    value={
                      newDemandForm.prioridade
                    }
                    onChange={(e) =>
                      setNewDemandForm(
                        (current) => ({
                          ...current,
                          prioridade:
                            e.target.value as Priority,
                        })
                      )
                    }
                  >
                    {priorities.map(
                      (priority) => (
                        <option
                          key={priority}
                          value={priority}
                        >
                          {priority}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={
                      newDemandForm.status
                    }
                    onChange={(e) =>
                      setNewDemandForm(
                        (current) => ({
                          ...current,
                          status:
                            e.target.value as Status,
                        })
                      )
                    }
                  >
                    {statuses.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <label>
                Responsável
                <input
                  value={
                    newDemandForm.responsavel
                  }
                  onChange={(e) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        responsavel:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="Nome do responsável"
                />
              </label>
            </div>

            <div className="modal-footer">
              <button
                className="secondary"
                onClick={() =>
                  setShowDemandModal(false)
                }
              >
                Cancelar
              </button>

              <button
                className="primary"
                onClick={addDemand}
                disabled={loading}
              >
                <Plus size={17} />
                Criar demanda
              </button>
            </div>
          </div>
        </div>
      )}

      {historyDemand && (
        <div
          className="modal-overlay"
          onMouseDown={() =>
            setHistoryDemand(null)
          }
        >
          <div
            className="modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>Histórico da demanda</h2>

                <p>
                  Demanda #
                  {historyDemand.numero}
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setHistoryDemand(null)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="history">
              {historyDemand.history?.length ? (
                historyDemand.history.map(
                  (item) => (
                    <div
                      className="history-item"
                      key={item.id}
                    >
                      <div className="history-icon">
                        <History size={16} />
                      </div>

                      <div>
                        <strong>
                          {item.field}
                        </strong>

                        <p>
                          {item.oldValue ||
                            'Vazio'}{' '}
                          →{' '}
                          {item.newValue ||
                            'Vazio'}
                        </p>

                        <small>
                          {item.user} •{' '}
                          {item.date}
                        </small>
                      </div>
                    </div>
                  )
                )
              ) : (
                <div className="empty">
                  Nenhuma alteração registrada.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-title">
        <span>{title}</span>
        {icon}
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function DemandTable({
  demands,
  onUpdate,
  onDelete,
  onHistory,
  onApprove,
  onPay,
}: {
  demands: Demand[];
  onUpdate: (
    id: string,
    field: keyof Demand,
    value: unknown
  ) => void;
  onDelete: (id: string) => void;
  onHistory: (demand: Demand) => void;
  onApprove: (demand: Demand) => void;
  onPay: (demand: Demand) => void;
}) {
  if (!demands.length) {
    return (
      <div className="empty">
        <Search size={35} />
        <strong>
          Nenhuma demanda encontrada
        </strong>
        <span>
          Ajuste os filtros ou crie uma nova
          demanda.
        </span>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nº</th>
            <th>Identificação do problema</th>
            <th>Tratamento do problema</th>
            <th>Análise</th>
            <th>Horas necessárias</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Aprovação</th>
            <th>Responsável</th>
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          {demands.map((demand) => (
            <tr key={demand.id}>
              <td>
                <strong>
                  #{demand.numero}
                </strong>
              </td>

              <td>
                <input
                  value={demand.problema || ''}
                  onChange={(e) =>
                    onUpdate(
                      demand.id,
                      'problema',
                      e.target.value
                    )
                  }
                />
              </td>

              <td>
                <input
                  value={
                    demand.tratamento || ''
                  }
                  onChange={(e) =>
                    onUpdate(
                      demand.id,
                      'tratamento',
                      e.target.value
                    )
                  }
                />
              </td>

              <td>
                <input
                  className="small-input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    demand.horasAnalise || 0
                  }
                  onChange={(e) =>
                    onUpdate(
                      demand.id,
                      'horasAnalise',
                      Number(
                        e.target.value
                      )
                    )
                  }
                />
              </td>

              <td>
                <input
                  className="small-input"
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    demand.horasNecessarias ||
                    0
                  }
                  onChange={(e) =>
                    onUpdate(
                      demand.id,
                      'horasNecessarias',
                      Number(
                        e.target.value
                      )
                    )
                  }
                />
              </td>

              <td>
                <select
                  value={
                    demand.prioridade
                  }
                  onChange={(e) =>
                    onUpdate(
                      demand.id,
                      'prioridade',
                      e.target.value
                    )
                  }
                >
                  {priorities.map(
                    (priority) => (
                      <option
                        key={priority}
                        value={priority}
                      >
                        {priority}
                      </option>
                    )
                  )}
                </select>
              </td>

              <td>
                <select
                  value={demand.status}
                  onChange={(e) =>
                    onUpdate(
                      demand.id,
                      'status',
                      e.target.value
                    )
                  }
                >
                  {statuses.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>
              </td>

              <td>
                <span
                  className={
                    demand.aprovacao ===
                    'Aprovada'
                      ? 'badge success'
                      : 'badge'
                  }
                >
                  {demand.aprovacao}
                </span>
              </td>

              <td>
                <input
                  value={
                    demand.responsavel ||
                    ''
                  }
                  onChange={(e) =>
                    onUpdate(
                      demand.id,
                      'responsavel',
                      e.target.value
                    )
                  }
                />
              </td>

              <td>
                <div className="actions">
                  {demand.aprovacao !==
                    'Aprovada' && (
                    <button
                      title="Aprovar"
                      className="icon-button"
                      onClick={() =>
                        onApprove(demand)
                      }
                    >
                      <CheckCircle2
                        size={16}
                      />
                    </button>
                  )}

                  {!demand.pago && (
                    <button
                      title="Marcar como pago"
                      className="icon-button"
                      onClick={() =>
                        onPay(demand)
                      }
                    >
                      <CheckCircle2
                        size={16}
                      />
                    </button>
                  )}

                  <button
                    title="Histórico"
                    className="icon-button"
                    onClick={() =>
                      onHistory(demand)
                    }
                  >
                    <History size={16} />
                  </button>

                  <button
                    title="Excluir"
                    className="icon-button danger"
                    onClick={() =>
                      onDelete(demand.id)
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

