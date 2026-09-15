import React from 'react';

type DemandGanttProps = {
  demands: any[];
  onEdit: (demand: any) => void;
  period?: string;
};

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  'Aguardando análise': { color: '#e5a11a', bg: '#fff5df', label: 'Aguardando análise' },
  'Em análise': { color: '#3b82f6', bg: '#eaf2ff', label: 'Em análise' },
  'Analisada': { color: '#6366f1', bg: '#eef0ff', label: 'Analisada' },
  'Em desenvolvimento': { color: '#8b5cf6', bg: '#f2ebff', label: 'Em desenvolvimento' },
  'Em homologação': { color: '#f59e0b', bg: '#fff4df', label: 'Em homologação' },
  'Concluída': { color: '#22a06b', bg: '#e8f8f1', label: 'Concluída' },
};

const normalizeStatus = (value: any) => {
  const text = String(value || '').trim().toLowerCase();

  if (text.includes('aguardando análise')) return 'Aguardando análise';
  if (text.includes('em análise')) return 'Em análise';
  if (text.includes('analisada')) return 'Analisada';
  if (text.includes('em desenvolvimento')) return 'Em desenvolvimento';
  if (text.includes('em homologação')) return 'Em homologação';
  if (text.includes('conclu')) return 'Concluída';

  return 'Aguardando análise';
};
const parseDate = (value: any) => {
  if (!value) return null;

  const text = String(value).slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const DemandGantt: React.FC<DemandGanttProps> = ({ demands, onEdit, period }) => {
  const currentParts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date());
  const currentYear = Number(currentParts.find(p=>p.type==='year')?.value);
  const currentMonth = Number(currentParts.find(p=>p.type==='month')?.value)-1;
  const currentDay = Number(currentParts.find(p=>p.type==='day')?.value);

  const fallbackDemandDate = demands
    .map((demand) => normalizeStatus(demand.status) === 'Analisada'
      ? parseDate(demand.analysisMonth ?? demand.analysis_month ?? demand.deliveryDate ?? demand.delivery_date)
      : parseDate(
          demand.deliveryDate ??
          demand.delivery_date ??
          demand.requestDate ??
          demand.request_date ??
          demand.criadoEm ??
          demand.createdAt
        )
    )
    .find((date) => date);

  const year = period && period !== 'Todos'
    ? Number(period.slice(0,4))
    : (fallbackDemandDate ? fallbackDemandDate.getUTCFullYear() : currentYear);

  const month = period && period !== 'Todos'
    ? Number(period.slice(5,7)) - 1
    : (fallbackDemandDate ? fallbackDemandDate.getUTCMonth() : currentMonth);

  const today = year === currentYear && month === currentMonth
    ? currentDay
    : 0;

  const now = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).format(now);

  const getDate = (demand: any) =>
    parseDate(
      demand.deliveryDate ??
      demand.delivery_date ??
      demand.requestDate ??
      demand.request_date ??
      demand.criadoEm ??
      demand.createdAt
    );

  const getStartDay = (demand: any) => {
    const date = parseDate(
      demand.requestDate ??
      demand.request_date ??
      demand.criadoEm ??
      demand.createdAt
    );

    if (!date) return 1;

    const day = date.getUTCMonth() === month && date.getUTCFullYear() === year
      ? date.getUTCDate()
      : 1;

    return Math.max(1, Math.min(daysInMonth, day));
  };

  const getEndDay = (demand: any) => {
    const date = getDate(demand);

    if (!date) return daysInMonth;

    if (date.getUTCFullYear() < year ||
        (date.getUTCFullYear() === year && date.getUTCMonth() < month)) {
      return 1;
    }

    if (date.getUTCFullYear() > year ||
        (date.getUTCFullYear() === year && date.getUTCMonth() > month)) {
      return daysInMonth;
    }

    return Math.max(1, Math.min(daysInMonth, date.getUTCDate()));
  };

  const getProgress = (demand: any) => {
    const value = Number(
      demand.progress ??
      demand.progresso ??
      demand.percentual ??
      demand.percentage ??
      0
    );

    if (Number.isFinite(value) && value > 0) {
      return Math.max(0, Math.min(100, value));
    }

    const status = normalizeStatus(demand.status ?? demand.statusLabel);

    if (status === 'Aguardando análise') return 30;
    if (status === 'Em análise') return 60;
    if (status === 'Analisada') return 70;
    if (status === 'Em desenvolvimento') return 40;
    if (status === 'Em homologação') return 80;
    if (status === 'Concluída') return 100;

    return 0;
  };
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);

  const sortedDemands = [...demands].sort((a, b) => {
    const da = getDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = getDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  });

  return (
    <div className="hf-demand-gantt">
      <div className="hf-gantt-header">
        <div>
          <h3>Gantt de Demandas</h3>
          <p>Acompanhe o cronograma das demandas ao longo do mês.</p>
        </div>

        <div className="hf-gantt-month">
          {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        </div>
      </div>

      <div className="hf-gantt-legend">
        {Object.entries(statusConfig).map(([key, config]) => (
          <span key={key}>
            <i style={{ background: config.color }} />
            {config.label}
          </span>
        ))}
      </div>

      <div className="hf-gantt-scroll">
        <div
          className="hf-gantt-grid"
          style={{
            gridTemplateColumns: `330px 140px 130px repeat(${daysInMonth}, minmax(34px, 1fr))`
          }}
        >
          <div className="hf-gantt-corner">DEMANDA</div>
          <div className="hf-gantt-corner">APROVADO POR</div>
          <div className="hf-gantt-corner">STATUS</div>

          {days.map(day => (
            <div
              key={day}
              className={`hf-gantt-day ${day === today ? 'today' : ''}`}
            >
              <strong>{String(day).padStart(2, '0')}</strong>
            </div>
          ))}

          {sortedDemands.map((demand, index) => {
            const status = normalizeStatus(demand.status ?? demand.statusLabel);
            const config = statusConfig[status] ?? { color: '#94a3b8', bg: '#f1f5f9', label: status || 'Aguardando análise' };
            const startDay = getStartDay(demand);
            const endDay = Math.max(startDay, getEndDay(demand));
            const progress = getProgress(demand);
            const width = ((endDay - startDay + 1) / daysInMonth) * 100;

            const approvedBy =
              demand.aprovadoPor ??
              demand.approvedBy ??
              demand.approved_by ??
              '—';

            const problem =
              demand.problema ??
              demand.problem ??
              demand.title ??
              'Demanda sem descrição';

            const number =
              demand.numero ??
              demand.number ??
              demand.id ??
              index + 1;

            return (
              <React.Fragment key={demand.id ?? index}>
                <button
                  type="button"
                  className="hf-gantt-demand"
                  onClick={() => onEdit(demand)}
                  title={problem}
                >
                  <span className="hf-gantt-number">
                    #{String(number).padStart(3, '0')}
                  </span>
                  <span>{problem}</span>
                </button>

                <div className="hf-gantt-approved" title={String(approvedBy)}>
                  {approvedBy}
                </div>

                <div className="hf-gantt-status">
                  <span
                    style={{
                      color: config.color,
                      background: config.bg
                    }}
                  >
                    <i style={{ background: config.color }} />
                    {config.label}
                  </span>
                </div>

                <div className="hf-gantt-timeline">
                  {days.map(day => (
                    <div
                      key={day}
                      className={`hf-gantt-cell ${day === today ? 'today-column' : ''}`}
                    />
                  ))}

                  <button
                    type="button"
                    className="hf-gantt-bar"
                    onClick={() => onEdit(demand)}
                    style={{
                      left: `${((startDay - 1) / daysInMonth) * 100}%`,
                      width: `${width}%`,
                      background: config.bg,
                      borderColor: config.color
                    }}
                    title={`${problem} • ${progress}%`}
                  >
                    <span
                      style={{
                        width: `${progress}%`,
                        background: config.color
                      }}
                    />

                    {width > 8 && (
                      <strong>
                        {progress}%
                      </strong>
                    )}
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div
          className="hf-gantt-today-line"
          style={{
            left: `${600 + ((1650 - 600) * ((today - 0.5) / daysInMonth))}px`
          }}
        >
          <span>Hoje</span>
        </div>
      </div>

      {sortedDemands.length === 0 && (
        <div className="hf-gantt-empty">
          Nenhuma demanda encontrada para este período.
        </div>
      )}
    </div>
  );
};

export default DemandGantt;
















