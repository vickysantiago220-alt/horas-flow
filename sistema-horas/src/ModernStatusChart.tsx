import React, { useMemo } from 'react';

type Props = {
  demands: any[];
};

const STATUS = [
  { key: 'Aguardando análise', color: '#94A3B8' },
  { key: 'Em análise', color: '#3B82F6' },
  { key: 'Analisada', color: '#8B5CF6' },
  { key: 'Em desenvolvimento', color: '#06B6D4' },
  { key: 'Em homologação', color: '#F59E0B' },
  { key: 'Concluída', color: '#22C55E' }
];

const normalizeStatus = (value: any) => {
  const s = String(value ?? '').trim().toLowerCase();

  if (s.includes('aguardando') && s.includes('análise')) return 'Aguardando análise';
  if (s.includes('em análise')) return 'Em análise';
  if (s.includes('analisada')) return 'Analisada';
  if (s.includes('desenvolvimento')) return 'Em desenvolvimento';
  if (s.includes('homologa')) return 'Em homologação';
  if (s.includes('conclu')) return 'Concluída';

  return String(value ?? '');
};

const polar = (cx: number, cy: number, radius: number, angle: number) => {
  const rad = (angle - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad)
  };
};

const arc = (
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number
) => {
  const p1 = polar(cx, cy, radius, end);
  const p2 = polar(cx, cy, radius, start);
  const large = end - start > 180 ? 1 : 0;

  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${large} 0 ${p2.x} ${p2.y}`;
};

export default function ModernStatusChart({ demands }: Props) {

  const data = useMemo(() => {
    const total = demands.length;

    return STATUS.map(status => {
      const count = demands.filter(
        d => normalizeStatus(d?.status) === status.key
      ).length;

      return {
        ...status,
        count,
        percentage: total
          ? Math.round((count / total) * 100)
          : 0
      };
    });
  }, [demands]);

  const total = demands.length;

  let angle = 0;

  const segments = data
    .filter(item => item.count > 0)
    .map(item => {
      const sweep = (item.count / total) * 360;
      const start = angle + 1;
      const end = angle + sweep - 1;
      const middle = angle + sweep / 2;

      angle += sweep;

      return {
        ...item,
        start,
        end,
        middle
      };
    });

  return (
    <div className="modern-status-chart">

      <div className="modern-status-donut-area">

        <svg
          className="modern-status-donut"
          viewBox="0 0 360 360"
        >

          <circle
            cx="180"
            cy="180"
            r="132"
            fill="none"
            stroke="#EEF2F7"
            strokeWidth="48"
          />

          {segments.map(segment => (
            <path
              key={segment.key}
              d={arc(
                180,
                180,
                132,
                segment.start,
                segment.end
              )}
              fill="none"
              stroke={segment.color}
              strokeWidth="48"
            />
          ))}

          {segments
            .filter(segment => segment.percentage >= 5)
            .map(segment => {
              const point = polar(
                180,
                180,
                132,
                segment.middle
              );

              return (
                <text
                  key={`${segment.key}-percentage`}
                  x={point.x}
                  y={point.y + 6}
                  textAnchor="middle"
                  className="modern-status-percent"
                >
                  {segment.percentage}%
                </text>
              );
            })}

          <circle
            cx="180"
            cy="180"
            r="82"
            fill="white"
          />

          <text
            x="180"
            y="174"
            textAnchor="middle"
            className="modern-status-total"
          >
            {total}
          </text>

          <text
            x="180"
            y="201"
            textAnchor="middle"
            className="modern-status-label"
          >
            demandas
          </text>

        </svg>

      </div>

      <div className="modern-status-list">

        {data.map(item => (

          <div
            className="modern-status-row"
            key={item.key}
          >

            <span
              className="modern-status-dot"
              style={{
                backgroundColor: item.color
              }}
            />

            <div className="modern-status-name">
              {item.key}
            </div>

            <strong className="modern-status-count">
              {item.count}
            </strong>

            <span className="modern-status-percentage">
              {item.percentage}%
            </span>

            <div className="modern-status-progress">
              <div
                className="modern-status-progress-fill"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color
                }}
              />
            </div>

          </div>

        ))}

      </div>

    </div>
  );
}
