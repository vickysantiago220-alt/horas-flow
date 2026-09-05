import { pool } from '../db';
import { SaphireScope } from './saphire-permissions';

function buildDemandScope(scope: SaphireScope) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (scope.clientId !== null) {
    conditions.push('d.client_id = ?');
    params.push(scope.clientId);
  }

  if (scope.period !== null) {
    conditions.push(`
      DATE_FORMAT(
        CASE
          WHEN d.status = 'Analisada' THEN d.analysis_month
          WHEN d.status = 'Concluída' THEN d.delivery_date
          ELSE d.request_date
        END,
        '%Y-%m'
      ) = ?
    `);

    params.push(scope.period);
  }

  const where =
    conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

  return { where, params };
}

export async function getSaphireContext(scope: SaphireScope) {
  const { where, params } = buildDemandScope(scope);

  const [summaryRows] = await pool.query(
    `
    SELECT
      COUNT(*) AS totalDemands,

      SUM(
        CASE
          WHEN d.status = 'Concluída' THEN 1
          ELSE 0
        END
      ) AS completedDemands,

      SUM(
        CASE
          WHEN d.status = 'Analisada' THEN 1
          ELSE 0
        END
      ) AS analyzedDemands,

      SUM(
        CASE
          WHEN d.status NOT IN ('Concluída', 'Analisada')
          THEN 1
          ELSE 0
        END
      ) AS pendingDemands,

      COALESCE(
        SUM(
          CASE
            WHEN d.status = 'Concluída'
            THEN
              COALESCE(d.analysis_hours, 0) +
              COALESCE(d.required_hours, 0)

            WHEN d.status = 'Analisada'
            THEN
              COALESCE(d.analysis_hours, 0)

            ELSE 0
          END
        ),
        0
      ) AS totalHours,

      COALESCE(
        SUM(
          CASE
            WHEN d.status = 'Concluída'
            THEN
              COALESCE(d.analysis_hours, 0) +
              COALESCE(d.required_hours, 0)

            WHEN d.status = 'Analisada'
            THEN
              COALESCE(d.analysis_hours, 0)

            ELSE 0
          END
        ),
        0
      ) AS productiveHours,

      COALESCE(
        SUM(
          CASE
            WHEN d.status = 'Analisada'
            THEN COALESCE(d.analysis_hours, 0)
            ELSE 0
          END
        ),
        0
      ) AS analysisHours,

      COALESCE(
        SUM(
          CASE
            WHEN d.status = 'Concluída'
            THEN COALESCE(d.required_hours, 0)
            ELSE 0
          END
        ),
        0
      ) AS requiredHours

    FROM demands d
    ${where}
    `,
    params
  );

  const [statusRows] = await pool.query(
    `
    SELECT
      d.status,
      COUNT(*) AS total,
      COALESCE(
        SUM(
          CASE
            WHEN d.status = 'Concluída'
            THEN
              COALESCE(d.analysis_hours, 0) +
              COALESCE(d.required_hours, 0)

            WHEN d.status = 'Analisada'
            THEN
              COALESCE(d.analysis_hours, 0)

            ELSE 0
          END
        ),
        0
      ) AS hours
    FROM demands d
    ${where}
    GROUP BY d.status
    ORDER BY total DESC
    `,
    params
  );

  const [responsibleRows] = await pool.query(
    `
    SELECT
      COALESCE(d.responsible, 'Não informado') AS responsible,
      COUNT(*) AS totalDemands,

      COALESCE(
        SUM(
          CASE
            WHEN d.status = 'Concluída'
            THEN
              COALESCE(d.analysis_hours, 0) +
              COALESCE(d.required_hours, 0)

            WHEN d.status = 'Analisada'
            THEN
              COALESCE(d.analysis_hours, 0)

            ELSE 0
          END
        ),
        0
      ) AS totalHours

    FROM demands d
    ${where}
    GROUP BY d.responsible
    ORDER BY totalHours DESC
    `,
    params
  );

  const [clientRows] = await pool.query(
    `
    SELECT
      d.client_id AS clientId,
      COALESCE(c.name, CONCAT('Cliente #', d.client_id)) AS clientName,
      COUNT(*) AS totalDemands,

      COALESCE(
        SUM(
          CASE
            WHEN d.status = 'Concluída'
            THEN
              COALESCE(d.analysis_hours, 0) +
              COALESCE(d.required_hours, 0)

            WHEN d.status = 'Analisada'
            THEN
              COALESCE(d.analysis_hours, 0)

            ELSE 0
          END
        ),
        0
      ) AS totalHours

    FROM demands d

    LEFT JOIN clients c
      ON c.id = d.client_id

    ${where}

    GROUP BY
      d.client_id,
      c.name

    ORDER BY totalHours DESC
    `,
    params
  );

  const [overdueRows] = await pool.query(
    `
    SELECT
      d.id,
      d.number,
      d.problem,
      d.status,
      d.priority,
      d.responsible,
      d.delivery_date AS deliveryDate,

      COALESCE(
        c.name,
        CONCAT('Cliente #', d.client_id)
      ) AS clientName,

      DATEDIFF(
        CURDATE(),
        d.delivery_date
      ) AS daysOverdue

    FROM demands d

    LEFT JOIN clients c
      ON c.id = d.client_id

    ${where ? `${where} AND` : 'WHERE'}

    d.delivery_date IS NOT NULL
    AND d.delivery_date < CURDATE()
    AND d.status <> 'Concluída'

    ORDER BY daysOverdue DESC

    LIMIT 50
    `,
    params
  );

  const [upcomingRows] = await pool.query(
    `
    SELECT
      d.id,
      d.number,
      d.problem,
      d.status,
      d.priority,
      d.responsible,
      d.delivery_date AS deliveryDate,

      COALESCE(
        c.name,
        CONCAT('Cliente #', d.client_id)
      ) AS clientName,

      DATEDIFF(
        d.delivery_date,
        CURDATE()
      ) AS daysUntilDelivery

    FROM demands d

    LEFT JOIN clients c
      ON c.id = d.client_id

    ${where ? `${where} AND` : 'WHERE'}

    d.delivery_date IS NOT NULL
    AND d.delivery_date >= CURDATE()
    AND d.delivery_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    AND d.status <> 'Concluída'

    ORDER BY d.delivery_date ASC

    LIMIT 50
    `,
    params
  );

  return {
    scope: {
      clientId: scope.clientId,
      period: scope.period,
      canSeeAllClients: scope.canSeeAllClients,
    },

    summary: (summaryRows as any[])[0] || {},

    byStatus: statusRows,

    byResponsible: responsibleRows,

    byClient: scope.canSeeAllClients
      ? clientRows
      : [],

    overdueDemands: overdueRows,

    upcomingDemands: upcomingRows,
  };
}
