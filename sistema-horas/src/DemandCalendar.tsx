import React, { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type DemandCalendarProps = {
  demands: any[];
  clients?: any[];
  onOpen?: (demand: any) => void;
};

const STATUS_CLASS: Record<string, string> = {
  'Concluída': 'completed',
  'Em andamento': 'progress',
  'Aguardando análise': 'pending',
  'Aguardando aprovação': 'approval',
  'Reprovada': 'rejected',
  'Pendente': 'pending',
};

const normalizeStatus = (status: any) =>
  String(status || '').trim();

const getDeliveryDate = (demand: any) => {
  const value = demand?.deliveryDate ?? demand?.delivery_date ?? '';
  if (!value) return null;

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function DemandCalendar({
  demands,
  clients = [],
  onOpen,
}: DemandCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
      }),
    [monthStart.getTime(), monthEnd.getTime()]
  );

  const demandsByDay = useMemo(() => {
    const map = new Map<string, any[]>();

    demands.forEach((demand) => {
      const date = getDeliveryDate(demand);
      if (!date) return;

      const key = format(date, 'yyyy-MM-dd');

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(demand);
    });

    return map;
  }, [demands]);

  const getClientName = (demand: any) => {
    if (demand?.clientName) return demand.clientName;

    const client = clients.find(
      (item: any) =>
        String(item?.id) === String(demand?.clientId)
    );

    return client?.name || client?.nome || 'Cliente não informado';
  };

  const goPreviousMonth = () => {
    setCurrentMonth((month) => subMonths(month, 1));
  };

  const goNextMonth = () => {
    setCurrentMonth((month) => addMonths(month, 1));
  };

  const goToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <section className="hf-demand-calendar">
      <div className="hf-calendar-header">
        <div className="hf-calendar-title">
          <div>
            <h2>Calendário de entregas</h2>
            <span>
              Acompanhe as demandas pela data de entrega
            </span>
          </div>
        </div>

        <div className="hf-calendar-controls">
          <button
            type="button"
            className="hf-secondary"
            onClick={goToday}
          >
            Hoje
          </button>

          <div className="hf-calendar-navigation">
            <button
              type="button"
              onClick={goPreviousMonth}
              aria-label="Mês anterior"
            >
              ‹
            </button>

            <strong>
              {format(currentMonth, 'MMMM yyyy', {
                locale: ptBR,
              })}
            </strong>

            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Próximo mês"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="hf-calendar-weekdays">
        {[
          'Segunda',
          'Terça',
          'Quarta',
          'Quinta',
          'Sexta',
          'Sábado',
          'Domingo',
        ].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="hf-calendar-grid">
        {calendarDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayDemands = demandsByDay.get(key) || [];
          const outsideMonth = !isSameMonth(day, currentMonth);

          return (
            <div
              key={key}
              className={[
                'hf-calendar-day',
                outsideMonth ? 'outside-month' : '',
                isToday(day) ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="hf-calendar-day-number">
                <span>{format(day, 'd')}</span>

                {dayDemands.length > 0 && (
                  <small>
                    {dayDemands.length}{' '}
                    {dayDemands.length === 1
                      ? 'demanda'
                      : 'demandas'}
                  </small>
                )}
              </div>

              <div className="hf-calendar-events">
                {dayDemands.map((demand) => {
                  const status = normalizeStatus(demand.status);
                  const statusClass =
                    STATUS_CLASS[status] || 'default';

                  return (
                    <button
                      type="button"
                      key={String(demand.id)}
                      className={`hf-calendar-event ${statusClass}`}
                      onClick={() => onOpen?.(demand)}
                      title={demand.problema || 'Demanda'}
                    >
                      <strong>
                        #{String(demand.numero ?? demand.number ?? 0).padStart(3, '0')}
                      </strong>

                      <span>
                        {demand.problema || 'Sem descrição'}
                      </span>

                      <small>
                        {getClientName(demand)}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
