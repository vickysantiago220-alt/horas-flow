import 'dotenv/config';
import express, { Response } from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';

import { pool } from './db';
import { askGemini } from './ai/gemini';
import { resolveSaphireScope } from './ai/saphire-permissions';
import { getSaphireContext } from './ai/saphire-context';
import { calculateSaphireMetrics } from './ai/saphire-metrics';
import {
  comparePassword,
  createToken,
  hashPassword,
} from './auth';

import {
  authenticate,
  authorize,
  AuthenticatedRequest,
} from './middleware/authMiddleware';

const app = express();

const PORT = Number(process.env.PORT) || 3001;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'demand-comment-attachments';

app.use(cors());
app.use(express.json());


// =====================================================
// TIPOS / HELPERS
// =====================================================

function getUser(req: AuthenticatedRequest) {
  return req.user;
}

function getId(value: string | string[] | undefined): number | null {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const id = Number(normalizedValue);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function clientExists(clientId: number | null): Promise<boolean> {
  if (!clientId) return false;

  const [rows] = await pool.query(
    'SELECT id FROM clients WHERE id = ? LIMIT 1',
    [clientId]
  );

  return (rows as any[]).length > 0;
}


async function recordDemandHistory(
  demandId: number,
  req: AuthenticatedRequest,
  field: string,
  oldValue: any,
  newValue: any
) {
  const normalize = (value: any) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const oldNormalized = normalize(oldValue);
  const newNormalized = normalize(newValue);

  if (oldNormalized === newNormalized) return;

  await pool.execute(
    `
      INSERT INTO demand_history (
        demand_id,
        user_id,
        user_name,
        field,
        old_value,
        new_value
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      demandId,
      req.user?.id || null,
      req.user?.name || null,
      field,
      oldNormalized,
      newNormalized,
    ]
  );
}


const DEMAND_SELECT = `
  SELECT
    id,
    number,
    problem,
    treatment,
    analysis_hours AS analysisHours,
    analysis_month AS analysisMonth,
    required_hours AS requiredHours,
    priority,
    status,
    approval,
    approved_by AS approvedBy,
    approved_by_user_id AS approvedByUserId,
    approved_at AS approvedAt,
    rejection_reason AS rejectionReason,
    execution_month AS executionMonth,
    responsible,
    client_id AS clientId,
    paid,
    created_at AS createdAt,
    updated_at AS updatedAt,
    request_date AS requestDate,
    delivery_date AS deliveryDate,
    requester_user_id AS requesterUserId
  FROM demands
`;


// =====================================================
// HEALTH CHECK
// =====================================================

// =====================================================

app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT NOW() AS now'
    );

    return res.json({
      success: true,
      message: 'Backend do HoraFlow funcionando!',
      database: 'MySQL conectado',
      serverTime: rows,
    });

  } catch (error: any) {
    console.error('ERRO MYSQL:', error);

    return res.status(500).json({
      success: false,
      message: 'Erro ao conectar ao MySQL.',
      error: error?.message,
      code: error?.code,
    });
  }
});


// =====================================================
// USUÃRIOS
// SOMENTE ADMIN
// =====================================================


// LISTAR USUÃRIOS

app.get(
  '/api/users',
  authenticate,
  authorize('ADMIN'),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.client_id AS clientId,
          c.name AS clientName,
          u.active,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt
        FROM users u
        LEFT JOIN clients c
          ON c.id = u.client_id
        ORDER BY u.name ASC
        `
      );

      return res.json({
        success: true,
        data: rows,
      });

    } catch (error: any) {
      console.error('ERRO LISTAR USUÃRIOS:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao listar usuÃ¡rios.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// CADASTRAR USUÃRIO

app.post(
  '/api/users',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role,
        clientId = null,
        active = true,
      } = req.body;

      if (
        !name?.trim() ||
        !email?.trim() ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Nome, e-mail e senha sÃ£o obrigatÃ³rios.',
        });
      }

      const validRoles = [
        'ADMIN',
        'INTERNO',
        'CLIENTE',
      ];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Perfil de usuÃ¡rio invÃ¡lido.',
        });
      }

      if (
        role === 'CLIENTE' &&
        !clientId
      ) {
        return res.status(400).json({
          success: false,
          message:
            'UsuÃ¡rio CLIENTE precisa estar vinculado a um cliente.',
        });
      }

      const [existingRows] = await pool.query(
        `
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
        [email.trim().toLowerCase()]
      );

      if ((existingRows as any[]).length > 0) {
        return res.status(409).json({
          success: false,
          message:
            'JÃ¡ existe um usuÃ¡rio cadastrado com este e-mail.',
        });
      }

      const passwordHash = hashPassword(password);

      const [result] = await pool.execute(
        `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          client_id,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          name.trim(),
          email.trim().toLowerCase(),
          passwordHash,
          role,
          clientId
            ? Number(clientId)
            : null,
          active ? 1 : 0,
        ]
      );

      const insertResult = result as any;

      const [rows] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          role,
          client_id AS clientId,
          active,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE id = ?
        `,
        [insertResult.insertId]
      );

      return res.status(201).json({
        success: true,
        message: 'UsuÃ¡rio cadastrado com sucesso.',
        data: (rows as any[])[0],
      });

    } catch (error: any) {
      console.error('ERRO CADASTRAR USUÃRIO:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao cadastrar usuÃ¡rio.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// EDITAR USUÃRIO

app.put(
  '/api/users/:id',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuÃ¡rio invÃ¡lido.',
        });
      }

      const {
        name,
        email,
        role,
        clientId = null,
        active = true,
        password,
      } = req.body;

      if (
        !name?.trim() ||
        !email?.trim() ||
        !role
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Nome, e-mail e perfil sÃ£o obrigatÃ³rios.',
        });
      }

      const validRoles = [
        'ADMIN',
        'INTERNO',
        'CLIENTE',
      ];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Perfil invÃ¡lido.',
        });
      }

      if (
        role === 'CLIENTE' &&
        !clientId
      ) {
        return res.status(400).json({
          success: false,
          message:
            'UsuÃ¡rio CLIENTE precisa estar vinculado a um cliente.',
        });
      }

      if (password?.trim()) {
        const passwordHash = hashPassword(password);

        await pool.execute(
          `
          UPDATE users
          SET
            name = ?,
            email = ?,
            password_hash = ?,
            role = ?,
            client_id = ?,
            active = ?,
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            name.trim(),
            email.trim().toLowerCase(),
            passwordHash,
            role,
            clientId
              ? Number(clientId)
              : null,
            active ? 1 : 0,
            id,
          ]
        );

      } else {
        await pool.execute(
          `
          UPDATE users
          SET
            name = ?,
            email = ?,
            role = ?,
            client_id = ?,
            active = ?,
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            name.trim(),
            email.trim().toLowerCase(),
            role,
            clientId
              ? Number(clientId)
              : null,
            active ? 1 : 0,
            id,
          ]
        );
      }

      const [rows] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          role,
          client_id AS clientId,
          active,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE id = ?
        `,
        [id]
      );

      if ((rows as any[]).length === 0) {
        return res.status(404).json({
          success: false,
          message: 'UsuÃ¡rio nÃ£o encontrado.',
        });
      }

      return res.json({
        success: true,
        message: 'UsuÃ¡rio atualizado com sucesso.',
        data: (rows as any[])[0],
      });

    } catch (error: any) {
      console.error('ERRO EDITAR USUÃRIO:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao editar usuÃ¡rio.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// ATIVAR / INATIVAR USUÃRIO

app.patch(
  '/api/users/:id/status',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const id = getId(req.params.id);
      const { active } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuÃ¡rio invÃ¡lido.',
        });
      }

      if (
        typeof active !== 'boolean'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'O campo active deve ser booleano.',
        });
      }

      const [result] = await pool.execute(
        `
        UPDATE users
        SET
          active = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          active ? 1 : 0,
          id,
        ]
      );

      const updateResult = result as any;

      if (
        updateResult.affectedRows === 0
      ) {
        return res.status(404).json({
          success: false,
          message: 'UsuÃ¡rio nÃ£o encontrado.',
        });
      }

      return res.json({
        success: true,
        message: active
          ? 'UsuÃ¡rio ativado com sucesso.'
          : 'UsuÃ¡rio inativado com sucesso.',
      });

    } catch (error: any) {
      console.error(
        'ERRO STATUS USUÃRIO:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao alterar status do usuÃ¡rio.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// =====================================================
// CLIENTES
// SOMENTE ADMIN
// =====================================================


// LISTAR CLIENTES

app.get(
  '/api/clients',
  authenticate,
  authorize('ADMIN'),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          active,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM clients
        ORDER BY name ASC
        `
      );

      return res.json({
        success: true,
        data: rows,
      });

    } catch (error: any) {
      console.error(
        'ERRO LISTAR CLIENTES:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Erro ao listar clientes.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// CADASTRAR CLIENTE

app.post(
  '/api/clients',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const {
        name,
        email = null,
      } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'Nome do cliente Ã© obrigatÃ³rio.',
        });
      }

      const [result] = await pool.execute(
        `
        INSERT INTO clients (
          name,
          email,
          active
        )
        VALUES (?, ?, 1)
        `,
        [
          name.trim(),
          email
            ? String(email)
                .trim()
                .toLowerCase()
            : null,
        ]
      );

      const insertResult = result as any;

      const [rows] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          active,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM clients
        WHERE id = ?
        `,
        [insertResult.insertId]
      );

      return res.status(201).json({
        success: true,
        message:
          'Cliente cadastrado com sucesso.',
        data: (rows as any[])[0],
      });

    } catch (error: any) {
      console.error(
        'ERRO CADASTRAR CLIENTE:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao cadastrar cliente.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);



// BUSCAR CLIENTE
app.get(
  '/api/clients/:id',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID do cliente invÃ¡lido.',
        });
      }

      const [rows] = await pool.query(
        `
        SELECT
          c.id,
          c.name,
          c.email,
          c.active,
          c.created_at AS createdAt,
          c.updated_at AS updatedAt,
          COUNT(DISTINCT u.id) AS usersCount,
          COUNT(DISTINCT d.id) AS demandsCount
        FROM clients c
        LEFT JOIN users u ON u.client_id = c.id
        LEFT JOIN demands d ON d.client_id = c.id
        WHERE c.id = ?
        GROUP BY
          c.id, c.name, c.email, c.active,
          c.created_at, c.updated_at
        LIMIT 1
        `,
        [id]
      );

      const client = (rows as any[])[0];

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Cliente nÃ£o encontrado.',
        });
      }

      return res.json({
        success: true,
        data: client,
      });
    } catch (error: any) {
      console.error('ERRO BUSCAR CLIENTE:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar cliente.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// EDITAR CLIENTE
app.put(
  '/api/clients/:id',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const id = getId(req.params.id);
      const { name, email = null } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID do cliente invÃ¡lido.',
        });
      }

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Nome do cliente Ã© obrigatÃ³rio.',
        });
      }

      const [result] = await pool.execute(
        `
        UPDATE clients
        SET
          name = ?,
          email = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          name.trim(),
          email
            ? String(email).trim().toLowerCase()
            : null,
          id,
        ]
      );

      const updateResult = result as any;

      if (updateResult.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente nÃ£o encontrado.',
        });
      }

      const [rows] = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          active,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM clients
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      return res.json({
        success: true,
        message: 'Cliente atualizado com sucesso.',
        data: (rows as any[])[0],
      });
    } catch (error: any) {
      console.error('ERRO EDITAR CLIENTE:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao editar cliente.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// ATIVAR / INATIVAR CLIENTE
app.patch(
  '/api/clients/:id/status',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const id = getId(req.params.id);
      const { active } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID do cliente invÃ¡lido.',
        });
      }

      if (typeof active !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'O campo active deve ser booleano.',
        });
      }

      // NÃ£o permite inativar cliente que ainda possui
      // usuÃ¡rios CLIENTE ativos vinculados.
      if (!active) {
        const [userRows] = await pool.query(
          `
          SELECT COUNT(*) AS total
          FROM users
          WHERE client_id = ?
            AND role = 'CLIENTE'
            AND active = 1
          `,
          [id]
        );

        const totalUsers = Number(
          (userRows as any[])[0]?.total || 0
        );

        if (totalUsers > 0) {
          return res.status(409).json({
            success: false,
            message:
              'NÃ£o Ã© possÃ­vel inativar o cliente enquanto houver usuÃ¡rios CLIENTE ativos vinculados.',
          });
        }
      }

      const [result] = await pool.execute(
        `
        UPDATE clients
        SET
          active = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [active ? 1 : 0, id]
      );

      const updateResult = result as any;

      if (updateResult.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cliente nÃ£o encontrado.',
        });
      }

      return res.json({
        success: true,
        message: active
          ? 'Cliente ativado com sucesso.'
          : 'Cliente inativado com sucesso.',
      });
    } catch (error: any) {
      console.error('ERRO STATUS CLIENTE:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao alterar status do cliente.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// =====================================================
// DEMANDAS - PROTEGIDAS
// =====================================================

app.use(
  '/api/demands',
  authenticate
);


// =====================================================
// LISTAR DEMANDAS
// =====================================================

app.get(
  '/api/demands',
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const user = getUser(req);

      let query = DEMAND_SELECT;

      const params: any[] = [];

      if (user?.role === 'CLIENTE') {
        query += `
          WHERE client_id = ?
        `;

        params.push(
          user.clientId
        );
      }

      query += `
        ORDER BY id DESC
      `;

      const [rows] = await pool.query(
        query,
        params
      );

      return res.json({
        success: true,
        data: rows,
      });

    } catch (error: any) {
      console.error(
        'ERRO REAL AO LISTAR DEMANDAS:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao listar demandas.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// =====================================================
// BUSCAR DEMANDA
// =====================================================

app.get(
  '/api/demands/:id',
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            'ID da demanda invÃ¡lido.',
        });
      }

      const [rows] = await pool.query(
        `
        ${DEMAND_SELECT}
        WHERE id = ?
        `,
        [id]
      );

      const demand =
        (rows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message:
            'Demanda nÃ£o encontrada.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(demand.clientId) !==
          Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            'VocÃª nÃ£o possui acesso a esta demanda.',
        });
      }

      const [historyRows] = await pool.query(
        `
          SELECT
            id,
            demand_id AS demandId,
            user_id AS userId,
            user_name AS userName,
            field,
            old_value AS oldValue,
            new_value AS newValue,
            created_at AS createdAt
          FROM demand_history
          WHERE demand_id = ?
          ORDER BY created_at DESC, id DESC
        `,
        [id]
      );

      return res.json({
        success: true,
        data: {
          ...demand,
          history: historyRows,
        },
      });

    } catch (error: any) {
      console.error(
        'ERRO BUSCAR DEMANDA:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao buscar demanda.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// =====================================================
// CRIAR DEMANDA
// ADMIN / INTERNO
// =====================================================

app.post(
  '/api/demands',
  authorize('ADMIN', 'INTERNO'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const {
        problem,
        treatment,
        analysisHours = 0,
        requiredHours = 0,
        priority = 'Média',
        status = 'Aguardando anÃ¡lise',
        clientId = null,
        responsible = null,
        requesterUserId = null,
        ticketId = null,
      } = req.body;

      if (
        !problem?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Problema é obrigatório.',
        });
      }

      const validPriorities = [
        'Baixa',
        'Média',
        'Alta',
        'Urgente',
      ];

      if (
        !validPriorities.includes(priority)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Prioridade invÃ¡lida.',
        });
      }

      if (clientId !== null && clientId !== undefined && clientId !== '') {
        const normalizedClientId = Number(clientId);

        if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Cliente invÃ¡lido.',
          });
        }

        if (!(await clientExists(normalizedClientId))) {
          return res.status(400).json({
            success: false,
            message: 'Cliente nÃ£o encontrado ou estÃ¡ inativo.',
          });
        }
      }

      const [lastRows] =
        await pool.query(
          `
          SELECT
            COALESCE(MAX(number), 0) + 1
            AS nextNumber
          FROM demands
          `
        );

      const nextNumber = Number(
        (lastRows as any[])[0]
          .nextNumber
      );

      const [result] =
        await pool.execute(
          `
          INSERT INTO demands (
            number,
            problem,
            treatment,
            analysis_hours,
            analysis_month,
            required_hours,
            priority,
            status,
            approval,
            approved_by,
            approved_by_user_id,
            approved_at,
            rejection_reason,
            request_date,
            delivery_date,
            responsible,
            requester_user_id,
            client_id,
            paid
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'Pendente',
            NULL,
            NULL,
            NULL,
            NULL,
            ?,
            ?,
            ?,
            ?,
            ?,
            0
          )
          `,
          [
            nextNumber,
            problem.trim(),
            (treatment || '').trim(),
            Number(analysisHours) || 0,
            req.body.analysisMonth ? (String(req.body.analysisMonth) + '-01') : null,
            Number(requiredHours) || 0,
            priority,
            status,
            req.body.requestDate
              ? String(req.body.requestDate)
              : null,
            req.body.deliveryDate
              ? String(req.body.deliveryDate)
              : null,
            responsible?.trim()
              ? responsible.trim()
              : null,
            requesterUserId
              ? Number(requesterUserId)
              : null,
            clientId
              ? Number(clientId)
              : null,
          ]
        );

      const insertResult =
        result as any;

      const id =
        insertResult.insertId;

      if (ticketId) {
        const normalizedTicketId = Number(ticketId);

        if (!Number.isInteger(normalizedTicketId) || normalizedTicketId <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Chamado inválido.',
          });
        }

        const [ticketRows] = await pool.query(
          `
          SELECT
            id,
            client_id AS clientId,
            demand_id AS demandId
          FROM tickets
          WHERE id = ?
          LIMIT 1
          `,
          [normalizedTicketId]
        );

        const ticket = (ticketRows as any[])[0];

        if (!ticket) {
          return res.status(404).json({
            success: false,
            message: 'Chamado não encontrado.',
          });
        }

        if (ticket.demandId) {
          return res.status(409).json({
            success: false,
            message: 'Este chamado já foi convertido em uma demanda.',
            demandId: ticket.demandId,
          });
        }

        if (
          clientId !== null &&
          clientId !== undefined &&
          clientId !== '' &&
          Number(ticket.clientId) !== Number(clientId)
        ) {
          return res.status(403).json({
            success: false,
            message: 'O chamado não pertence ao cliente informado na demanda.',
          });
        }

        await pool.execute(
          `
          UPDATE tickets
          SET
            demand_id = ?,
            status = 'Convertido em demanda',
            updated_at = NOW()
          WHERE id = ?
            AND demand_id IS NULL
          `,
          [id, normalizedTicketId]
        );
      }

      const [rows] =
        await pool.query(
          `
          ${DEMAND_SELECT}
          WHERE id = ?
          `,
          [id]
        );

      return res.status(201).json({
        success: true,
        message:
          'Demanda criada com sucesso.',
        data:
          (rows as any[])[0],
      });

    } catch (error: any) {
      console.error(
        'ERRO CRIAR DEMANDA:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao criar demanda no MySQL.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


//// =====================================================
// CHAMADOS
// =====================================================

app.get(
  '/api/tickets',
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      let query = `
        SELECT
          t.id,
          t.number,
          t.client_id AS clientId,
          t.requester_user_id AS requesterUserId,
          t.problem,
          t.priority,
          t.request_date AS requestDate,
          t.status,
          t.demand_id AS demandId,
          t.created_at AS createdAt,
          t.updated_at AS updatedAt
        FROM tickets t
      `;

      const params: any[] = [];

      if (req.user?.role === 'CLIENTE') {
        query += ' WHERE t.client_id = ?';
        params.push(req.user.clientId);
      }

      query += ' ORDER BY t.created_at DESC';

      const [rows] = await pool.query(query, params);

      return res.json({
        success: true,
        data: rows,
      });
    } catch (error: any) {
      console.error('ERRO AO LISTAR CHAMADOS:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar chamados.',
        error: error?.message,
      });
    }
  }
);


// CRIAR CHAMADO
app.post(
  '/api/tickets',
  authorize('CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        problem,
        priority = 'Média',
        requestDate,
      } = req.body;

      if (!problem?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Problema é obrigatório.',
        });
      }

      if (!req.user?.id || !req.user?.clientId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário não está vinculado a um cliente.',
        });
      }

      const validPriorities = [
        'Baixa',
        'Média',
        'Alta',
        'Urgente',
      ];

      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Prioridade inválida.',
        });
      }

      const [lastRows] = await pool.query(`
        SELECT COALESCE(MAX(number), 0) + 1 AS nextNumber
        FROM tickets
      `);

      const nextNumber = Number(
        (lastRows as any[])[0]?.nextNumber || 1
      );

      const [result] = await pool.execute(
        `
        INSERT INTO tickets (
          number,
          client_id,
          requester_user_id,
          problem,
          priority,
          request_date,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'Aberto')
        `,
        [
          nextNumber,
          Number(req.user.clientId),
          Number(req.user.id),
          problem.trim(),
          priority,
          requestDate
            ? String(requestDate)
            : new Date().toISOString().slice(0, 10),
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Chamado criado com sucesso.',
        data: { id: (result as any).insertId, number: nextNumber, problem: problem.trim(), priority, requestDate: requestDate ? String(requestDate) : new Date().toISOString().slice(0, 10), status: 'Aberto', clientId: Number(req.user.clientId), requesterUserId: Number(req.user.id) },
      });
    } catch (error: any) {
      console.error('ERRO AO CRIAR CHAMADO:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao criar chamado.',
        error: error?.message,
      });
    }
  }
);


// BUSCAR CHAMADO
app.get(
  '/api/tickets/:id',
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const ticketId = getId(req.params.id);

      const [rows] = await pool.query(
        `
        SELECT
          t.id,
          t.number,
          t.client_id AS clientId,
          t.requester_user_id AS requesterUserId,
          t.problem,
          t.priority,
          t.request_date AS requestDate,
          t.status,
          t.demand_id AS demandId,
          t.created_at AS createdAt,
          t.updated_at AS updatedAt
        FROM tickets t
        WHERE t.id = ?
        `,
        [ticketId]
      );

      const ticket = (rows as any[])[0];

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Chamado não encontrado.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(ticket.clientId) !== Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado.',
        });
      }

      return res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      console.error('ERRO AO BUSCAR CHAMADO:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar chamado.',
        error: error?.message,
      });
    }
  }
);


// =====================================================
// EDITAR DEMANDA
// ADMIN / INTERNO
// =====================================================

app.put(
  '/api/demands/:id',
  authorize('ADMIN', 'INTERNO'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            'ID da demanda invÃ¡lido.',
        });
      }

      const {
        problem,
        treatment,
        analysisHours = 0,
        analysisMonth = null,
        requestDate = null,
        deliveryDate = null,
        requiredHours = 0,
        priority = 'Média',
        status = 'Aguardando anÃ¡lise',
        clientId = null,
        responsible = null,
      } = req.body;

      if (
        !problem?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Problema é obrigatório.',
        });
      }

      if (clientId !== null && clientId !== undefined && clientId !== '') {
        const normalizedClientId = Number(clientId);

        if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Cliente invÃ¡lido.',
          });
        }

        if (!(await clientExists(normalizedClientId))) {
          return res.status(400).json({
            success: false,
            message: 'Cliente nÃ£o encontrado ou estÃ¡ inativo.',
          });
        }
      }

      const [beforeRows] = await pool.query(
        `
          ${DEMAND_SELECT}
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

      const beforeDemand = (beforeRows as any[])[0];

      if (!beforeDemand) {
        return res.status(404).json({
          success: false,
          message: 'Demanda nÃ£o encontrada.',
        });
      }

      await pool.execute(
        `
        UPDATE demands
        SET
          problem = ?,
          treatment = ?,
          analysis_hours = ?,
          analysis_month = ?,
          required_hours = ?,
          priority = ?,
          status = ?,
          request_date = ?,
          delivery_date = ?,
          client_id = ?,
          responsible = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          problem.trim(),
          (treatment || '').trim(),
          Number(analysisHours) || 0,
          analysisMonth ? (String(analysisMonth) + '-01') : null,
          Number(requiredHours) || 0,
          priority,
          status,
          requestDate
            ? String(requestDate)
            : null,
          deliveryDate
            ? String(deliveryDate)
            : null,
          clientId
            ? Number(clientId)
            : null,
          responsible?.trim()
            ? responsible.trim()
            : null,
          id,
        ]
      );

      await recordDemandHistory(
        id,
        req,
        'Problema',
        beforeDemand.problem,
        problem.trim()
      );
      await recordDemandHistory(
        id,
        req,
        'Tratamento',
        beforeDemand.treatment,
        (treatment || '').trim()
      );
      await recordDemandHistory(
        id,
        req,
        'Horas de anÃ¡lise',
        beforeDemand.analysisHours,
        Number(analysisHours) || 0
      );
      await recordDemandHistory(
        id,
        req,
        'Horas necessÃ¡rias',
        beforeDemand.requiredHours,
        Number(requiredHours) || 0
      );
      await recordDemandHistory(
        id,
        req,
        'Prioridade',
        beforeDemand.priority,
        priority
      );
      await recordDemandHistory(
        id,
        req,
        'Status',
        beforeDemand.status,
        status
      );
      await recordDemandHistory(
        id,
        req,
        'Cliente',
        beforeDemand.clientId,
        clientId ? Number(clientId) : null
      );
      await recordDemandHistory(
        id,
        req,
        'ResponsÃ¡vel',
        beforeDemand.responsible,
        responsible?.trim() ? responsible.trim() : null
      );

      const [rows] =
        await pool.query(
          `
          ${DEMAND_SELECT}
          WHERE id = ?
          `,
          [id]
        );

      if (
        (rows as any[]).length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Demanda nÃ£o encontrada.',
        });
      }

      // Retorna tambÃ©m o histÃ³rico atualizado para o frontend
      // nÃ£o depender de uma segunda chamada apÃ³s salvar.
      const [historyRows] = await pool.query(
        `
          SELECT
            id,
            demand_id AS demandId,
            user_id AS userId,
            user_name AS userName,
            field,
            old_value AS oldValue,
            new_value AS newValue,
            created_at AS createdAt
          FROM demand_history
          WHERE demand_id = ?
          ORDER BY created_at DESC, id DESC
        `,
        [id]
      );

      return res.json({
        success: true,
        message:
          'Demanda atualizada com sucesso.',
        data: {
          ...(rows as any[])[0],
          history: historyRows,
        },
      });

    } catch (error: any) {
      console.error(
        'ERRO EDITAR DEMANDA:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao atualizar demanda.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// =====================================================
// ALTERAR PRIORIDADE
// ADMIN / INTERNO / CLIENTE
// CLIENTE SÃ“ DA PRÃ“PRIA DEMANDA
// =====================================================

app.patch(
  '/api/demands/:id/priority',
  authorize(
    'ADMIN',
    'INTERNO',
    'CLIENTE'
  ),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);
      const { priority } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            'ID da demanda invÃ¡lido.',
        });
      }

      const validPriorities = [
        'Baixa',
        'Média',
        'Alta',
        'Urgente',
      ];

      if (
        !validPriorities.includes(priority)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Prioridade invÃ¡lida.',
        });
      }

      const [rows] =
        await pool.query(
          `
          SELECT
            id,
            client_id AS clientId,
            priority
          FROM demands
          WHERE id = ?
          `,
          [id]
        );

      const demand =
        (rows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message:
            'Demanda nÃ£o encontrada.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(demand.clientId) !==
          Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            'VocÃª nÃ£o possui acesso a esta demanda.',
        });
      }

      await pool.execute(
        `
        UPDATE demands
        SET
          priority = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          priority,
          id,
        ]
      );

      await recordDemandHistory(
        id,
        req,
        'Prioridade',
        demand.priority,
        priority
      );

      return res.json({
        success: true,
        message:
          'Prioridade atualizada com sucesso.',
      });

    } catch (error: any) {
      console.error(
        'ERRO ALTERAR PRIORIDADE:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao alterar prioridade.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);
// =====================================================
// HISTÃ“RICO DA DEMANDA
// ADMIN / INTERNO / CLIENTE
// CLIENTE SÃ“ DA PRÃ“PRIA DEMANDA
// =====================================================

app.get(
  '/api/demands/:id/history',
  authorize(
    'ADMIN',
    'INTERNO',
    'CLIENTE'
  ),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID da demanda invÃ¡lido.',
        });
      }

      const [demandRows] = await pool.query(
        `
          SELECT
            id,
            client_id AS clientId,
            approval,
            status,
            rejection_reason AS rejectionReason,
            request_date AS requestDate,
            delivery_date AS deliveryDate
          FROM demands
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

      const demand = (demandRows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message: 'Demanda nÃ£o encontrada.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(demand.clientId) !== Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'VocÃª nÃ£o possui acesso a esta demanda.',
        });
      }

      const [historyRows] = await pool.query(
        `
          SELECT
            id,
            demand_id AS demandId,
            user_id AS userId,
            user_name AS userName,
            field,
            old_value AS oldValue,
            new_value AS newValue,
            created_at AS createdAt
          FROM demand_history
          WHERE demand_id = ?
          ORDER BY created_at DESC, id DESC
        `,
        [id]
      );

      return res.json({
        success: true,
        data: historyRows,
      });
    } catch (error: any) {
      console.error('ERRO HISTÃ“RICO DEMANDA:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao carregar histÃ³rico da demanda.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// =====================================================
// EXCLUIR DEMANDA
// ADMIN / INTERNO
// =====================================================


app.get(
  '/api/demands/:id/comments',
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const demandId = Number(req.params.id);

      if (!Number.isInteger(demandId) || demandId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Demanda inválida.',
        });
      }

      const [demandRows] = await pool.query(
        `SELECT id, client_id AS clientId FROM demands WHERE id = ? LIMIT 1`,
        [demandId]
      );

      const demand = (demandRows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message: 'Demanda não encontrada.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(demand.clientId) !== Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Você não possui acesso a esta demanda.',
        });
      }

      const [rows] = await pool.query(
        `
          SELECT
            c.id,
            c.demand_id AS demandId,
            c.user_id AS userId,
            u.name AS userName,
            c.comment,
            c.created_at AS createdAt,
            COALESCE(
              (
                SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                    'id', a.id,
                    'fileName', a.file_name,
                    'fileUrl', a.file_url,
                    'fileType', a.file_type,
                    'fileSize', a.file_size
                  )
                )
                FROM demand_comment_attachments a
                WHERE a.comment_id = c.id
              ),
              JSON_ARRAY()
            ) AS attachments
          FROM demand_comments c
          LEFT JOIN users u ON u.id = c.user_id
          WHERE c.demand_id = ?
          ORDER BY c.created_at ASC, c.id ASC
        `,
        [demandId]
      );

      return res.json({
        success: true,
        data: rows,
      });
    } catch (error: any) {
      console.error('Erro ao listar comentários:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao listar comentários.',
        error: error?.message,
      });
    }
  }
);

app.get(
  '/api/notifications',
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.'
        });
      }

      const [rows] = await pool.query(
        `
          SELECT
            id,
            type,
            title,
            description,
            demand_id AS demandId,
            read_at AS readAt,
            created_at AS createdAt
          FROM notifications
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 100
        `,
        [req.user.id]
      );

      return res.json({
        success: true,
        data: rows
      });
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar notificações.'
      });
    }
  }
);
app.patch(
  '/api/notifications/:id/read',
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.'
        });
      }

      const notificationId = Number(req.params.id);

      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Notificação inválida.'
        });
      }

      await pool.execute(
        "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [notificationId, req.user.id]
      );

      return res.json({
        success: true,
        message: 'Notificação marcada como lida.'
      });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao marcar notificação como lida.'
      });
    }
  }
);
app.patch(
  '/api/notifications/:id/read',
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.'
        });
      }

      const notificationId = Number(req.params.id);

      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Notificação inválida.'
        });
      }

      await pool.execute(
        "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [notificationId, req.user.id]
      );

      return res.json({
        success: true,
        message: 'Notificação marcada como lida.'
      });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao marcar notificação como lida.'
      });
    }
  }
);
app.patch(
  '/api/notifications/:id/read',
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.'
        });
      }

      const notificationId = Number(req.params.id);

      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Notificação inválida.'
        });
      }

      await pool.execute(
        "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [notificationId, req.user.id]
      );

      return res.json({
        success: true,
        message: 'Notificação marcada como lida.'
      });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao marcar notificação como lida.'
      });
    }
  }
);
app.post(
  '/api/demands/:id/comments',
  upload.array('attachments', 5),
  authorize('ADMIN', 'INTERNO', 'CLIENTE'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const demandId = Number(req.params.id);
      const comment = String(req.body?.comment || '').trim();

      if (!Number.isInteger(demandId) || demandId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Demanda inválida.',
        });
      }

      if (!comment) {
        return res.status(400).json({
          success: false,
          message: 'O comentário é obrigatório.',
        });
      }

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.',
        });
      }

      const [demandRows] = await pool.query(
        `SELECT id, client_id AS clientId FROM demands WHERE id = ? LIMIT 1`,
        [demandId]
      );

      const demand = (demandRows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message: 'Demanda não encontrada.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(demand.clientId) !== Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Você não possui acesso a esta demanda.',
        });
      }

      const [result] = await pool.execute(
        `
          INSERT INTO demand_comments (
            demand_id,
            user_id,
            comment
          )
          VALUES (?, ?, ?)
        `,
        [demandId, req.user.id, comment]
      );

      const commentId = (result as any).insertId;

      const [responsibleRows] = await pool.query(
        "SELECT u.id AS userId, u.name AS userName FROM demands d INNER JOIN users u ON LOWER(TRIM(u.name)) = LOWER(TRIM(d.responsible)) WHERE d.id = ? AND d.responsible IS NOT NULL AND TRIM(d.responsible) <> '' AND u.active = 1 LIMIT 1",
        [demandId]
      );

      const responsibleUser = (responsibleRows as any[])[0];

      if (
        responsibleUser &&
        Number(responsibleUser.userId) !== Number(req.user.id)
      ) {
        const [demandNumberRows] = await pool.query(
          "SELECT number FROM demands WHERE id = ? LIMIT 1",
          [demandId]
        );

        const demandNumber =
          Number((demandNumberRows as any[])[0]?.number || demandId);

        const [commenterRows] = await pool.query(
          "SELECT name FROM users WHERE id = ? LIMIT 1",
          [req.user.id]
        );

        const commenterName =
          String((commenterRows as any[])[0]?.name || "Usuário");

        await pool.execute(
          "INSERT INTO notifications (user_id, type, title, description, demand_id) VALUES (?, ?, ?, ?, ?)",
          [
            responsibleUser.userId,
            "comment",
            "Novo comentário na demanda #" + String(demandNumber).padStart(3, "0"),
            commenterName + " adicionou um comentário.",
            demandId
          ]
        );
      }
      const files = ((req as any).files || []) as Express.Multer.File[];

      for (const file of files) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `demands/${demandId}/comments/${commentId}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          console.error('Erro ao enviar anexo para o Supabase:', uploadError);
          throw new Error("Falha no upload do anexo: " + uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .getPublicUrl(filePath);

        await pool.execute(
          `
            INSERT INTO demand_comment_attachments (
              comment_id,
              file_name,
              file_url,
              file_type,
              file_size
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [
            commentId,
            file.originalname,
            publicUrlData.publicUrl,
            file.mimetype,
            file.size,
          ]
        );
      }

      const [rows] = await pool.query(
        `
          SELECT
            c.id,
            c.demand_id AS demandId,
            c.user_id AS userId,
            u.name AS userName,
            c.comment,
            c.created_at AS createdAt,
            COALESCE(
              (
                SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                    'id', a.id,
                    'fileName', a.file_name,
                    'fileUrl', a.file_url,
                    'fileType', a.file_type,
                    'fileSize', a.file_size
                  )
                )
                FROM demand_comment_attachments a
                WHERE a.comment_id = c.id
              ),
              JSON_ARRAY()
            ) AS attachments
          FROM demand_comments c
          LEFT JOIN users u ON u.id = c.user_id
          WHERE c.id = ?
          LIMIT 1
        `,
        [commentId]
      );

      return res.status(201).json({
        success: true,
        message: 'Comentário adicionado com sucesso.',
        data: (rows as any[])[0],
      });
    } catch (error: any) {
      console.error('Erro ao adicionar comentário:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao adicionar comentário.',
        error: error?.message,
      });
    }
  }
);
app.delete(
  '/api/demands/:id',
  authorize('ADMIN', 'INTERNO'),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID da demanda invÃ¡lido.',
        });
      }

      const [rows] = await pool.query(
        `
          SELECT id
          FROM demands
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

      const demand = (rows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message: 'Demanda nÃ£o encontrada.',
        });
      }

      await pool.execute(
        `
          DELETE FROM demands
          WHERE id = ?
        `,
        [id]
      );

      return res.json({
        success: true,
        message: 'Demanda excluÃ­da com sucesso.',
      });

    } catch (error: any) {
      console.error(
        'ERRO EXCLUIR DEMANDA:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Erro ao excluir demanda.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);

// =====================================================
// APROVAR DEMANDA
// ADMIN / CLIENTE
// =====================================================

app.post(
  '/api/demands/:id/approve',
  authorize(
    'ADMIN',
    'CLIENTE'
  ),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID da demanda invÃ¡lido.',
        });
      }

      const [rows] = await pool.query(
        `
        SELECT
          id,
          client_id AS clientId,
          approval
        FROM demands
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      const demand = (rows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message: 'Demanda nÃ£o encontrada.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(demand.clientId) !== Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'VocÃª nÃ£o possui acesso a esta demanda.',
        });
      }

      await pool.execute(
        `
        UPDATE demands
        SET
          approval = 'Aprovada',
          approved_by = ?,
          approved_by_user_id = ?,
          approved_at = NOW(),
          rejection_reason = NULL,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          req.user?.name || null,
          req.user?.id || null,
          id,
        ]
      );

      await recordDemandHistory(
        id,
        req,
        'AprovaÃ§Ã£o',
        demand.approval,
        'Aprovada'
      );

      return res.json({
        success: true,
        message: 'Demanda aprovada com sucesso.',
      });

    } catch (error: any) {
      console.error(
        'ERRO APROVAR DEMANDA:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Erro ao aprovar demanda.',
        error: error?.message,
      });
    }
  }
)
app.post(
  '/api/demands/:id/reject',
  authorize(
    'ADMIN',
    'CLIENTE'
  ),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);
      const { reason } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            'ID da demanda invÃ¡lido.',
        });
      }

      if (!reason?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'Informe o motivo da reprovaÃ§Ã£o.',
        });
      }

      const [rows] =
        await pool.query(
          `
          SELECT
            id,
            client_id AS clientId
          FROM demands
          WHERE id = ?
          `,
          [id]
        );

      const demand =
        (rows as any[])[0];

      if (!demand) {
        return res.status(404).json({
          success: false,
          message:
            'Demanda nÃ£o encontrada.',
        });
      }

      if (
        req.user?.role === 'CLIENTE' &&
        Number(demand.clientId) !==
          Number(req.user.clientId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            'VocÃª nÃ£o possui acesso a esta demanda.',
        });
      }

      await pool.execute(
        `
        UPDATE demands
        SET
          approval = 'Reprovada',
          status = 'Pendente',
          approved_by = ?,
          approved_by_user_id = ?,
          approved_at = NOW(),
          rejection_reason = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          req.user?.name || null,
          req.user?.id || null,
          reason.trim(),
          id,
        ]
      );

      await recordDemandHistory(
        id,
        req,
        'AprovaÃ§Ã£o',
        demand.approval,
        'Reprovada'
      );
      await recordDemandHistory(
        id,
        req,
        'Status',
        demand.status,
        'Pendente'
      );
      await recordDemandHistory(
        id,
        req,
        'Motivo da reprovaÃ§Ã£o',
        demand.rejectionReason,
        reason.trim()
      );

      return res.json({
        success: true,
        message:
          'Demanda reprovada com sucesso.',
      });

    } catch (error: any) {
      console.error(
        'ERRO REPROVAR DEMANDA:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao reprovar demanda.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// =====================================================
// MARCAR COMO PAGO
// ADMIN / INTERNO
// =====================================================

app.post(
  '/api/demands/:id/pay',
  authorize(
    'ADMIN',
    'INTERNO'
  ),
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const id = getId(req.params.id);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            'ID da demanda invÃ¡lido.',
        });
      }

      const [beforePayRows] = await pool.query(
        `
          SELECT paid
          FROM demands
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

      const beforePay = (beforePayRows as any[])[0];

      if (!beforePay) {
        return res.status(404).json({
          success: false,
          message: 'Demanda nÃ£o encontrada.',
        });
      }

      const [result] =
        await pool.execute(
          `
          UPDATE demands
          SET
            paid = 1,
            updated_at = NOW()
          WHERE id = ?
          `,
          [id]
        );

      const updateResult =
        result as any;

      if (
        updateResult.affectedRows === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            'Demanda nÃ£o encontrada.',
        });
      }

      await recordDemandHistory(
        id,
        req,
        'Pagamento',
        beforePay.paid ? 'Pago' : 'NÃ£o pago',
        'Pago'
      );

      return res.json({
        success: true,
        message:
          'Demanda marcada como paga.',
      });

    } catch (error: any) {
      console.error(
        'ERRO MARCAR PAGO:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao marcar demanda como paga.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// =====================================================
// DASHBOARD
// =====================================================

app.get(
  '/api/dashboard',
  authenticate,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      let where = '';
      const params: any[] = [];

      if (
        req.user?.role === 'CLIENTE'
      ) {
        where =
          ' WHERE client_id = ? ';

        params.push(
          req.user.clientId
        );
      }

      const period =
        typeof req.query.period === 'string'
          ? req.query.period
          : null;

      const [rows] =
        await pool.query(
          `
          SELECT
            COUNT(*) AS totalDemands,

            COALESCE(
              SUM(analysis_hours),
              0
            ) AS analysisHours,

            COALESCE(
              SUM(required_hours),
              0
            ) AS requiredHours,

            COALESCE(
              SUM(
                analysis_hours +
                required_hours
              ),
              0
            ) AS totalHours,

            COALESCE(
              SUM(
                CASE
                  WHEN approval = 'Aprovada'
                    AND (
                      ? IS NULL
                      OR DATE_FORMAT(delivery_date,
                        '%Y-%m'
                      ) = ?
                    )
                  THEN 1
                  ELSE 0
                END
              ),
              0
            ) AS approvedDemands,

            COALESCE(
              SUM(
                CASE
                  WHEN status = 'ConcluÃ­da'
                    AND (
                      ? IS NULL
                      OR DATE_FORMAT(delivery_date,
                        '%Y-%m'
                      ) = ?
                    )
                  THEN
                    COALESCE(analysis_hours, 0) +
                    COALESCE(required_hours, 0)
                  ELSE 0
                END
              ),
              0
            ) AS finishedHours,

            COALESCE(
              SUM(
                CASE
                  WHEN status = 'ConcluÃ­da'
                    AND (
                      ? IS NULL
                      OR DATE_FORMAT(delivery_date,
                        '%Y-%m'
                      ) = ?
                    )
                  THEN 1
                  ELSE 0
                END
              ),
              0
            ) AS finishedDemands,

            COALESCE(
              SUM(
                CASE
                  WHEN approval = 'Pendente'
                    AND (
                      ? IS NULL
                      OR DATE_FORMAT(delivery_date,
                        '%Y-%m'
                      ) = ?
                    )
                  THEN
                    COALESCE(analysis_hours, 0) +
                    COALESCE(required_hours, 0)
                  ELSE 0
                END
              ),
              0
            ) AS pendingApprovalHours,

            SUM(
              CASE
                WHEN approval = 'Pendente'
                  AND (
                    ? IS NULL
                    OR DATE_FORMAT(delivery_date,
                      '%Y-%m'
                    ) = ?
                  )
                THEN 1
                ELSE 0
              END
            ) AS pendingApprovalDemands,

            COALESCE(
              SUM(
                CASE
                  WHEN approval = 'Pendente'
                  THEN COALESCE(analysis_hours, 0) + COALESCE(required_hours, 0)
                  ELSE 0
                END
              ),
              0
            ) AS pendingApprovalHoursTotal,

            COALESCE(
              SUM(
                CASE
                  WHEN status = 'Analisada'
                  THEN COALESCE(analysis_hours, 0)
                  ELSE 0
                END
              ),
              0
            ) AS analyzedHours

          FROM demands
          ${where}
          `,
          [
            period,
            period,
            period,
            period,
            period,
            period,
            period,
            period,
            period,
            period,
            ...params
          ]
        );

      const [statusRows] =
        await pool.query(
          `
          SELECT
            status,
            COUNT(*) AS total
          FROM demands
          ${where}
          GROUP BY status
          `,
          params
        );

      const summary =
        (rows as any[])[0];      
      // Horas analisadas: usa o mÃªs de anÃ¡lise quando um perÃ­odo Ã© selecionado.
      const analyzedHoursConditions: string[] = [];
      const analyzedHoursParams: any[] = [];

      analyzedHoursConditions.push("status = 'Analisada'");

      if (period && period !== 'Todos') {
        analyzedHoursConditions.push(
          "DATE_FORMAT(analysis_month, '%Y-%m') = ?"
        );
        analyzedHoursParams.push(period);
      }

      if (req.user?.role === 'CLIENTE') {
        analyzedHoursConditions.push('client_id = ?');
        analyzedHoursParams.push(req.user.clientId);
      }

      const analyzedHoursWhere =
        `WHERE ${analyzedHoursConditions.join(' AND ')}`;

      const [analyzedRows] =
        await pool.query(
          `
          SELECT
            COALESCE(
              SUM(analysis_hours),
              0
            ) AS analyzedHours
          FROM demands
          ${analyzedHoursWhere}
          `,
          analyzedHoursParams
        );

      const analyzedHoursGlobal =
        Number(
          (analyzedRows as any[])[0]?.analyzedHours ?? 0
        );

      const byStatus:
        Record<string, number> = {};

      for (
        const row of
          statusRows as any[]
      ) {
        byStatus[row.status] =
          Number(row.total);
      }

      return res.json({
        success: true,
        data: {
          totalDemands:
            Number(
              summary.totalDemands
            ),

          totalHours:
            Number(
              summary.totalHours
            ),

          analysisHours:
            Number(
              summary.analysisHours
            ),

          requiredHours:
            Number(
              summary.requiredHours
            ),

          analyzedHours:
            analyzedHoursGlobal,

          approvedDemands:
            Number(
              summary.approvedDemands ?? 0
            ),

          finishedHours:
            Number(
              summary.finishedHours || 0
            ),

          finishedDemands:
            Number(summary.finishedDemands ?? 0),

          pendingApproval:
            Number(
              summary.pendingApprovalDemands || 0
            ),

          pendingApprovalHours:
            Number(
              summary.pendingApprovalHours || 0
            ),

          pendingApprovalDemands:
            Number(
              summary.pendingApprovalDemands || 0
            ),

          pendingApprovalHoursTotal:
            Number(
              summary.pendingApprovalHoursTotal || 0
            ),

          byStatus,
        },
      });

    } catch (error: any) {
      console.error(
        'ERRO DASHBOARD:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao carregar dashboard.',
        error: error?.message,
        code: error?.code,
        sqlMessage:
          error?.sqlMessage,
      });
    }
  }
);


// =====================================================
// 404
// =====================================================

app.use(
  (_req, res) => {
    return res.status(404).json({
      success: false,
      message:
        'Rota nÃ£o encontrada.',
    });
  }
);


// =====================================================
// ERRO GLOBAL
// =====================================================

app.use(
  (
    error: any,
    _req: import('express').Request,
    res: Response,
    _next: import('express').NextFunction
  ) => {
    console.error(
      'ERRO GLOBAL:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Erro interno do servidor.',
      error:
        error?.message,
    });
  }
);


// =====================================================
// SERVIDOR
// =====================================================

async function startServer() {
  try {
    const [columns] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'demands'
        AND COLUMN_NAME = 'analysis_month'
      `
    );

    const [dateColumns] = await pool.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'demands'
        AND COLUMN_NAME IN ('request_date', 'delivery_date')
    `);

    const existingDateColumns = new Set(
      (dateColumns as any[]).map((row) => row.COLUMN_NAME)
    );

    if (!existingDateColumns.has('request_date')) {
      await pool.query(`
        ALTER TABLE demands
        ADD COLUMN request_date DATE NULL
      `);
      console.log('Coluna request_date criada com sucesso.');
    }

    if (!existingDateColumns.has('delivery_date')) {
      await pool.query(`
        ALTER TABLE demands
        ADD COLUMN delivery_date DATE NULL
      `);
      console.log('Coluna delivery_date criada com sucesso.');
    }
    const hasAnalysisMonth =
      Number((columns as any[])[0]?.total || 0) > 0;

    if (!hasAnalysisMonth) {
      await pool.query(
        `
        ALTER TABLE demands
        ADD COLUMN analysis_month DATE NULL
        `
      );

      console.log(
        'Coluna analysis_month criada com sucesso.'
      );
    } else {
      console.log(
        'Coluna analysis_month jÃ¡ existe.'
      );
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        demand_id BIGINT NULL,
        read_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_notifications_user_created (user_id, created_at),
        KEY idx_notifications_demand (demand_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('Tabela notifications criada/verificada com sucesso.');
    app.listen(
      PORT,
      () => {
        console.log(
          `Backend rodando em http://localhost:${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      'ERRO AO INICIALIZAR BANCO:',
      error
    );

    process.exit(1);
  }
}

startServer();








































