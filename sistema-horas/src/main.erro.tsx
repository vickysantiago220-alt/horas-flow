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
  Users,
  X,
  Clipboard,
} from 'lucide-react';
import './styles.css';

const API_URL = 'http://localhost:3001/api';

type Status =
  | 'Aguardando análise'
  | 'Em análise'
  | 'Aguardando aprovação'
  | 'Em desenvolvimento'
  | 'Em homologação'
  | 'Concluída'
  | 'Reprovada';

type Priority = 'Baixa' | 'Média' | 'Alta' | 'Urgente';

type Demand = {
  id: number;
  number: number;
  problem: string;
  treatment: string;
  analysisHours: number;
  requiredHours: number;
  priority: Priority;
  status: Status;
  approval: 'Pendente' | 'Aprovada' | 'Reprovada';
  approvedBy: string | null;
  paid: number | boolean;
  createdAt: string;
  updatedAt: string;
};

type NewDemandForm = {
  problem: string;
  treatment: string;
  analysisHours: number;
  requiredHours: number;
  priority: Priority;
  status: Status;
  responsible: string;
};

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

function normalizeDemand(item: any): Demand {
  return {
    id: Number(item.id),
    number: Number(item.number),
    problem: item.problem ?? '',
    treatment: item.treatment ?? '',
    analysisHours: Number(item.analysisHours ?? 0),
    requiredHours: Number(item.requiredHours ?? 0),
    priority: item.priority ?? 'Média',
    status: item.status ?? 'Aguardando análise',
    approval: item.approval ?? 'Pendente',
    approvedBy: item.approvedBy ?? null,
    paid: Boolean(item.paid),
    createdAt: item.createdAt ?? '',
    updatedAt: item.updatedAt ?? '',
  };
}

function formatDate(value: string) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('pt-BR');
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
      <div className="card-title">{title}</div>
      <div className="card-icon">{icon}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

function App() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [tab, setTab] = useState<'dashboard' | 'demandas'>('dashboard');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [period, setPeriod] = useState('Todos');

  const [showDemandModal, setShowDemandModal] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [newDemandForm, setNewDemandForm] =
    useState<NewDemandForm>({
      problem: '',
      treatment: '',
      analysisHours: 0,
      requiredHours: 0,
      priority: 'Média',
      status: 'Aguardando análise',
      responsible: '',
    });

  const loadDemands = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch(`${API_URL}/demands`);

      if (!response.ok) {
        throw new Error(
          `Erro HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.message || 'Erro ao carregar demandas.'
        );
      }

      setDemands(
        Array.isArray(result.data)
          ? result.data.map(normalizeDemand)
          : []
      );
    } catch (error) {
      console.error('Erro ao carregar demandas:', error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar as demandas.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemands();
  }, []);

  const openNewDemand = () => {
  setEditingDemand(null);

  setErrorMessage('');

  setNewDemandForm({
    problem: '',
    treatment: '',
    analysisHours: 0,
    requiredHours: 0,
    priority: 'Média',
    status: 'Aguardando análise',
    responsible: '',
  });

  setShowDemandModal(true);
};
    setErrorMessage('');

    setNewDemandForm({
      problem: '',
      treatment: '',
      analysisHours: 0,
      requiredHours: 0,
      priority: 'Média',
      status: 'Aguardando análise',
      responsible: '',
    });

    setShowDemandModal(true);
  };

  const openEditDemand = (demand: Demand) => {
    setEditingDemand(demand);
    setErrorMessage('');

    setNewDemandForm({
      problem: demand.problem,
      treatment: demand.treatment,
      analysisHours: Number(demand.analysisHours) || 0,
      requiredHours: Number(demand.requiredHours) || 0,
      priority: demand.priority,
      status: demand.status,
      responsible: '',
    });

    setShowDemandModal(true);
  };

  const closeNewDemand = () => {
    if (creating) return;

    setShowDemandModal(false);
  };

  const addDemand = async () => {
    if (!newDemandForm.problem.trim()) {
      alert('Informe a identificação do problema.');
      return;
    }

    if (!newDemandForm.treatment.trim()) {
      alert('Informe o tratamento do problema.');
      return;
    }

    try {
      setCreating(true);

      const url = editingDemand
  ? `${API_URL}/demands/${editingDemand.id}`
  : `${API_URL}/demands`;

const method = editingDemand
  ? 'PUT'
  : 'POST';

const response = await fetch(url, {
  method,
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    problem: newDemandForm.problem.trim(),
    treatment: newDemandForm.treatment.trim(),
    analysisHours:
      Number(newDemandForm.analysisHours) || 0,
    requiredHours:
      Number(newDemandForm.requiredHours) || 0,
    priority: newDemandForm.priority,
    status: newDemandForm.status,
    approval: editingDemand
      ? editingDemand.approval
      : 'Pendente',
    approvedBy: editingDemand
      ? editingDemand.approvedBy
      : null,
    paid: editingDemand
      ? Boolean(editingDemand.paid)
      : false,
  }),
});

      const contentType =
        response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        const text = await response.text();

        console.error(
          'Resposta não JSON do backend:',
          text
        );

        throw new Error(
          'O backend não retornou JSON. Verifique se o servidor está rodando na porta 3001.'
        );
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Não foi possível salvar a demanda.'
        );
      }

      const createdDemand = normalizeDemand(
        result.data
      );

      if (editingDemand) {
  setDemands((current) =>
    current.map((demand) =>
      demand.id === editingDemand.id
        ? createdDemand
        : demand
    )
  );
} else {
  setDemands((current) => [
    createdDemand,
    ...current,
  ]);
}

setEditingDemand(null);
setShowDemandModal(false);
      setTab('demandas');

      setNewDemandForm({
        problem: '',
        treatment: '',
        analysisHours: 0,
        requiredHours: 0,
        priority: 'Média',
        status: 'Aguardando análise',
        responsible: '',
      });
    } catch (error) {
      console.error('Erro ao criar demanda:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a demanda.'
      );
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return demands.filter((demand) => {
      const matchesSearch =
        !term ||
        String(demand.number)
          .toLowerCase()
          .includes(term) ||
        demand.problem
          .toLowerCase()
          .includes(term) ||
        demand.treatment
          .toLowerCase()
          .includes(term) ||
        demand.priority
          .toLowerCase()
          .includes(term) ||
        demand.status
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === 'Todos' ||
        demand.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'Todas' ||
        demand.priority === priorityFilter;

      let matchesPeriod = true;

      if (period !== 'Todos') {
        matchesPeriod =
          demand.createdAt.startsWith(period);
      }

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

  const totalAnalysis = filtered.reduce(
    (total, demand) =>
      total + demand.analysisHours,
    0
  );

  const totalNeeded = filtered.reduce(
    (total, demand) =>
      total + demand.requiredHours,
    0
  );

  const totalHours =
    totalAnalysis + totalNeeded;

  const approvedCount = filtered.filter(
    (demand) =>
      demand.approval === 'Aprovada'
  ).length;

  const paidCount = filtered.filter(
    (demand) => Boolean(demand.paid)
  ).length;

  const developmentCount = filtered.filter(
    (demand) =>
      demand.status === 'Em desenvolvimento'
  ).length;

  const homologationCount = filtered.filter(
    (demand) =>
      demand.status === 'Em homologação'
  ).length;

  const statusCounts = statuses.map((status) => ({
    status,
    count: filtered.filter(
      (demand) => demand.status === status
    ).length,
  }));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">H</div>

          <div>
            <strong>HoraFlow</strong>
            <span>Gestão de demandas</span>
          </div>
        </div>

        <nav className="navigation">
          <button
            className={
              tab === 'dashboard'
                ? 'nav active'
                : 'nav'
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
                ? 'nav active'
                : 'nav'
            }
            onClick={() =>
              setTab('demandas')
            }
          >
            <Clipboard size={18} />
            Demandas
          </button>

          <button
            className="nav"
            type="button"
            onClick={() =>
              alert(
                'Módulo de horas será implementado na próxima etapa.'
              )
            }
          >
            <Clock3 size={18} />
            Horas
          </button>

          <button
            className="nav"
            type="button"
            onClick={() =>
              alert(
                'Módulo de usuários será implementado na próxima etapa.'
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
            <Plus size={18} />
            Cadastre uma nova demanda
          </button>
        </header>

        <section className="filters">
          <div className="search">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="Todos">
              Todos
            </option>

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
            onChange={(event) =>
              setPriorityFilter(
                event.target.value
              )
            }
          >
            <option value="Todas">
              Todas
            </option>

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
            onChange={(event) =>
              setPeriod(event.target.value)
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

        {errorMessage && (
          <div className="error-box">
            {errorMessage}
          </div>
        )}

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
                  <div>
                    <h2>Demandas por status</h2>
                    <p>
                      Distribuição das demandas
                      atuais.
                    </p>
                  </div>
                </div>

                <div className="status-list">
                  {statusCounts.map(
                    ({ status, count }) => (
                      <div
                        className="status-row"
                        key={status}
                      >
                        <span>
                          {status}
                        </span>

                        <strong>
                          {count}
                        </strong>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      Resumo do período
                    </h2>
                    <p>
                      Horas no filtro atual.
                    </p>
                  </div>
                </div>

                <div className="summary-hours">
                  <strong>
                    {totalHours}h
                  </strong>

                  <span>
                    Horas totais
                  </span>
                </div>

                <div className="summary-grid">
                  <div>
                    <strong>
                      {totalAnalysis}h
                    </strong>
                    <span>Análise</span>
                  </div>

                  <div>
                    <strong>
                      {totalNeeded}h
                    </strong>
                    <span>
                      Desenvolvimento
                    </span>
                  </div>

                  <div>
                    <strong>
                      {paidCount}
                    </strong>
                    <span>Pagas</span>
                  </div>
                </div>
              </div>
            </section>

            <DemandTable
           demands={filtered}
           loading={loading}
          onEdit={openEditDemand}
            />
          </>
        ) : (
          <DemandTable
            demands={filtered}
            loading={loading}
            onEdit={openEditDemand}
          />
        )}
      </main>

      {showDemandModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeNewDemand();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>
  {editingDemand
    ? `Editar demanda #${editingDemand.number}`
    : 'Nova demanda'}
</h2>
               <p>
  {editingDemand
    ? 'Altere os dados da demanda e salve as modificações.'
    : 'Cadastre uma nova demanda.'}
</p>
              </div>

              <button
                className="icon-button"
                onClick={closeNewDemand}
                disabled={creating}
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-grid">
              <label className="field full">
                <span>
                  Identificação do problema *
                </span>

                <textarea
                  value={
                    newDemandForm.problem
                  }
                  onChange={(event) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        problem:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Descreva o problema..."
                  rows={4}
                />
              </label>

              <label className="field full">
                <span>
                  Tratamento do problema *
                </span>

                <textarea
                  value={
                    newDemandForm.treatment
                  }
                  onChange={(event) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        treatment:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Informe o tratamento..."
                  rows={4}
                />
              </label>

              <label className="field">
                <span>
                  Horas de análise
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    newDemandForm.analysisHours
                  }
                  onChange={(event) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        analysisHours:
                          Number(
                            event.target.value
                          ),
                      })
                    )
                  }
                />
              </label>

              <label className="field">
                <span>
                  Horas necessárias
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    newDemandForm.requiredHours
                  }
                  onChange={(event) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        requiredHours:
                          Number(
                            event.target.value
                          ),
                      })
                    )
                  }
                />
              </label>

              <label className="field">
                <span>Prioridade</span>

                <select
                  value={
                    newDemandForm.priority
                  }
                  onChange={(event) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        priority:
                          event.target
                            .value as Priority,
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

              <label className="field">
                <span>Status</span>

                <select
                  value={
                    newDemandForm.status
                  }
                  onChange={(event) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value as Status,
                      })
                    )
                  }
                >
                  {statuses.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field full">
                <span>Responsável</span>

                <input
                  value={
                    newDemandForm.responsible
                  }
                  onChange={(event) =>
                    setNewDemandForm(
                      (current) => ({
                        ...current,
                        responsible:
                          event.target.value,
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
                onClick={closeNewDemand}
                disabled={creating}
              >
                Cancelar
              </button>

              <button
                className="primary"
                onClick={addDemand}
                disabled={creating}
              >
                <Plus size={18} />

                {creating
                  ? 'Salvando...'
                  : editingDemand
                    ? 'Salvar alterações'
                    : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DemandTable({
  demands,
  loading,
  onEdit,
}: {
  demands: Demand[];
  loading: boolean;
  onEdit: (demand: Demand) => void;
}) {
  return (
    <section className="panel demands-panel">
      <div className="panel-header">
        <div>
          <h2>Planilha de demandas</h2>

          <p>
            {demands.length} demanda
            {demands.length === 1
              ? ''
              : 's'}{' '}
            •{' '}
            {demands.reduce(
              (total, demand) =>
                total +
                demand.analysisHours +
                demand.requiredHours,
              0
            )}
            h totais
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          Carregando demandas...
        </div>
      ) : demands.length === 0 ? (
        <div className="empty-state">
          <Search size={36} />

          <strong>
            Nenhuma demanda encontrada
          </strong>

          <span>
            Ajuste os filtros ou crie uma nova
            demanda.
          </span>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>
                  Identificação do problema
                </th>
                <th>
                  Tratamento do problema
                </th>
                <th>Análise</th>
                <th>Horas necessárias</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Aprovação</th>
                <th>Pago</th>
                <th>Criada em</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {demands.map((demand) => (
                <tr key={demand.id}>
                  <td>
                    <strong>
                      #{demand.number}
                    </strong>
                  </td>

                  <td>
                    {demand.problem}
                  </td>

                  <td>
                    {demand.treatment}
                  </td>

                  <td>
                    {demand.analysisHours}h
                  </td>

                  <td>
                    {demand.requiredHours}h
                  </td>

                  <td>
                    <span
                      className={`badge priority-${demand.priority
                        .toLowerCase()
                        .replace(
                          'é',
                          'e'
                        )}`}
                    >
                      {demand.priority}
                    </span>
                  </td>

                  <td>
                    <span className="badge">
                      {demand.status}
                    </span>
                  </td>

                  <td>
                    <span className="badge">
                      {demand.approval}
                    </span>
                  </td>

                  <td>
                    {Boolean(demand.paid)
                      ? 'Sim'
                      : 'Não'}
                  </td>

                  <td>
                    {formatDate(
                      demand.createdAt
                    )}
                  </td>
                  <td>
               <button
               className="table-action"
               onClick={() => onEdit(demand)}
               type="button"
              >
             Editar
           </button>
            </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


