import 'dotenv/config';
import express, { Response } from 'express';
import cors from 'cors';

import { pool } from './db';
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

app.use(cors());
app.use(express.json());


// =====================================================
// TIPOS / HELPERS
// =====================================================

function getUser(req: AuthenticatedRequest) {
  return req.user;
}

function getId(value: string | undefined): number | null {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function clientExists(clientId: number | null): Promise<boolean> {
  if (!clientId) return false;

  const [rows] = await pool.query(
    `SELECT id FROM clients WHERE id = ? AND active = 1 LIMIT 1`,
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
    required_hours AS requiredHours,
    priority,
    status,
    approval,
    approved_by AS approvedBy,
    approved_by_user_id AS approvedByUserId,
    approved_at AS approvedAt,
    rejection_reason AS rejectionReason,
    execution_month AS executionMonth,
    analysis_month AS analysisMonth,
    responsible,
    client_id AS clientId,
    paid,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM demands
`;


// =====================================================
// LOGIN
// =====================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'E-mail e senha são obrigatórios.',
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password_hash AS passwordHash,
        role,
        client_id AS clientId,
        active
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [String(email).trim().toLowerCase()]
    );

    const user = (rows as any[])[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'E-mail ou senha inválidos.',
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Usuário inativo.',
      });
    }

    const validPassword = comparePassword(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'E-mail ou senha inválidos.',
      });
    }

    const authUser = {
      id: Number(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      clientId:
        user.clientId !== null &&
        user.clientId !== undefined
          ? Number(user.clientId)
          : null,
    };

    const token = createToken(authUser);

    return res.json({
      success: true,
      message: 'Login realizado com sucesso.',
      data: {
        token,
        user: authUser,
      },
    });

  } catch (error: any) {
    console.error('ERRO LOGIN:', error);

    return res.status(500).json({
      success: false,
      message: 'Erro ao realizar login.',
      error: error?.message,
      code: error?.code,
    });
  }
});


// =====================================================
// USUÁRIO LOGADO
// =====================================================

app.get(
  '/api/auth/me',
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado.',
        });
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
        LIMIT 1
        `,
        [user.id]
      );

      const currentUser = (rows as any[])[0];

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado.',
        });
      }

      return res.json({
        success: true,
        data: currentUser,
      });

    } catch (error: any) {
      console.error('ERRO AUTH ME:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar usuário.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// =====================================================
// HEALTH CHECK
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
// USUÁRIOS
// SOMENTE ADMIN
// =====================================================


// LISTAR USUÁRIOS

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
      console.error('ERRO LISTAR USUÁRIOS:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao listar usuários.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// CADASTRAR USUÁRIO

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
            'Nome, e-mail e senha são obrigatórios.',
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
          message: 'Perfil de usuário inválido.',
        });
      }

      if (
        role === 'CLIENTE' &&
        !clientId
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Usuário CLIENTE precisa estar vinculado a um cliente.',
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
            'Já existe um usuário cadastrado com este e-mail.',
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
        message: 'Usuário cadastrado com sucesso.',
        data: (rows as any[])[0],
      });

    } catch (error: any) {
      console.error('ERRO CADASTRAR USUÁRIO:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao cadastrar usuário.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// EDITAR USUÁRIO

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
          message: 'ID do usuário inválido.',
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
            'Nome, e-mail e perfil são obrigatórios.',
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
          message: 'Perfil inválido.',
        });
      }

      if (
        role === 'CLIENTE' &&
        !clientId
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Usuário CLIENTE precisa estar vinculado a um cliente.',
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
          message: 'Usuário não encontrado.',
        });
      }

      return res.json({
        success: true,
        message: 'Usuário atualizado com sucesso.',
        data: (rows as any[])[0],
      });

    } catch (error: any) {
      console.error('ERRO EDITAR USUÁRIO:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao editar usuário.',
        error: error?.message,
        code: error?.code,
      });
    }
  }
);


// ATIVAR / INATIVAR USUÁRIO

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
          message: 'ID do usuário inválido.',
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
          message: 'Usuário não encontrado.',
        });
      }

      return res.json({
        success: true,
        message: active
          ? 'Usuário ativado com sucesso.'
          : 'Usuário inativado com sucesso.',
      });

    } catch (error: any) {
      console.error(
        'ERRO STATUS USUÁRIO:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao alterar status do usuário.',
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
            'Nome do cliente é obrigatório.',
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
          message: 'ID do cliente inválido.',
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
          message: 'Cliente não encontrado.',
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
          message: 'ID do cliente inválido.',
        });
      }

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Nome do cliente é obrigatório.',
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
          message: 'Cliente não encontrado.',
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
          message: 'ID do cliente inválido.',
        });
      }

      if (typeof active !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'O campo active deve ser booleano.',
        });
      }

      // Não permite inativar cliente que ainda possui
      // usuários CLIENTE ativos vinculados.
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
              'Não é possível inativar o cliente enquanto houver usuários CLIENTE ativos vinculados.',
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
          message: 'Cliente não encontrado.',
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
            'ID da demanda inválido.',
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
            'Demanda não encontrada.',
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
            'Você não possui acesso a esta demanda.',
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
        analysisMonth = null,
        priority = 'Média',
        status = 'Aguardando análise',
        clientId = null,
        responsible = null,
      } = req.body;

      if (
        !problem?.trim() ||
        !treatment?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Problema e tratamento são obrigatórios.',
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
            'Prioridade inválida.',
        });
      }

      if (clientId !== null && clientId !== undefined && clientId !== '') {
        const normalizedClientId = Number(clientId);

        if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Cliente inválido.',
          });
        }

        if (!(await clientExists(normalizedClientId))) {
          return res.status(400).json({
            success: false,
            message: 'Cliente não encontrado ou está inativo.',
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
            required_hours,
            priority,
            status,
            approval,
            approved_by,
            approved_by_user_id,
            approved_at,
            rejection_reason,
            execution_month,
            analysis_month,
            responsible,
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
            'Pendente',
            NULL,
            NULL,
            NULL,
            NULL,
            ?,
            ?,
            ?,
            0
          )
          `,
          [
            nextNumber,
            problem.trim(),
            treatment.trim(),
            Number(analysisHours) || 0,
            Number(requiredHours) || 0,
            priority,
            status,
            analysisMonth
              ? `${String(analysisMonth)}-01`
              : null,
            responsible?.trim()
              ? responsible.trim()
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
            'ID da demanda inválido.',
        });
      }

      const {
        problem,
        treatment,
        analysisHours = 0,
        requiredHours = 0,
        priority = 'Média',
        status = 'Aguardando análise',
        analysisMonth = null,
        executionMonth = null,
        clientId = null,
        responsible = null,
      } = req.body;

      if (
        !problem?.trim() ||
        !treatment?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Problema e tratamento são obrigatórios.',
        });
      }

      if (clientId !== null && clientId !== undefined && clientId !== '') {
        const normalizedClientId = Number(clientId);

        if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Cliente inválido.',
          });
        }

        if (!(await clientExists(normalizedClientId))) {
          return res.status(400).json({
            success: false,
            message: 'Cliente não encontrado ou está inativo.',
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
          message: 'Demanda não encontrada.',
        });
      }

      await pool.execute(
        `
        UPDATE demands
        SET
          problem = ?,
          treatment = ?,
          analysis_hours = ?,
          required_hours = ?,
          priority = ?,
          status = ?,
          analysis_month = ?,
          execution_month = ?,
          client_id = ?,
          responsible = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          problem.trim(),
          treatment.trim(),
          Number(analysisHours) || 0,
          Number(requiredHours) || 0,
          priority,
          status,
          analysisMonth
            ? `${String(analysisMonth)}-01`
            : null,
          executionMonth
            ? `${String(executionMonth)}-01`
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
        treatment.trim()
      );
      await recordDemandHistory(
        id,
        req,
        'Horas de análise',
        beforeDemand.analysisHours,
        Number(analysisHours) || 0
      );
      await recordDemandHistory(
        id,
        req,
        'Horas necessárias',
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
        'Responsável',
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
            'Demanda não encontrada.',
        });
      }

      // Retorna também o histórico atualizado para o frontend
      // não depender de uma segunda chamada após salvar.
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
// CLIENTE SÓ DA PRÓPRIA DEMANDA
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
            'ID da demanda inválido.',
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
            'Prioridade inválida.',
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
            'Demanda não encontrada.',
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
            'Você não possui acesso a esta demanda.',
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
// HISTÓRICO DA DEMANDA
// ADMIN / INTERNO / CLIENTE
// CLIENTE SÓ DA PRÓPRIA DEMANDA
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
          message: 'ID da demanda inválido.',
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
            execution_month AS executionMonth
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
      console.error('ERRO HISTÓRICO DEMANDA:', error);

      return res.status(500).json({
        success: false,
        message: 'Erro ao carregar histórico da demanda.',
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
          message: 'ID da demanda inválido.',
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
          message: 'Demanda não encontrada.',
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
        message: 'Demanda excluída com sucesso.',
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
      const { executionMonth } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            'ID da demanda inválido.',
        });
      }

      if (
        !executionMonth ||
        !/^\d{4}-\d{2}$/.test(String(executionMonth))
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Informe o mês de execução no formato YYYY-MM.',
        });
      }

      const [rows] =
        await pool.query(
          `
          SELECT
            id,
            client_id AS clientId,
            approval,
            execution_month AS executionMonth
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
            'Demanda não encontrada.',
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
            'Você não possui acesso a esta demanda.',
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
          execution_month = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          req.user?.name || null,
          req.user?.id || null,
          `${String(executionMonth)}-01`,
          id,
        ]
      );

      await recordDemandHistory(
        id,
        req,
        'Aprovação',
        demand.approval,
        'Aprovada'
      );
      await recordDemandHistory(
        id,
        req,
        'Mês de execução',
        demand.executionMonth,
        `${String(executionMonth)}-01`
      );

      return res.json({
        success: true,
        message:
          'Demanda aprovada com sucesso.',
      });

    } catch (error: any) {
      console.error(
        'ERRO APROVAR DEMANDA:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao aprovar demanda.',
        error: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
      });
    }
  }
);


// =====================================================
// REPROVAR DEMANDA
// ADMIN / CLIENTE
//
// Ao reprovar:
// approval = Reprovada
// status = Pendente
// salva responsável
// salva motivo
// =====================================================

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
            'ID da demanda inválido.',
        });
      }

      if (!reason?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'Informe o motivo da reprovação.',
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
            'Demanda não encontrada.',
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
            'Você não possui acesso a esta demanda.',
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
          execution_month = NULL,
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
        'Aprovação',
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
        'Motivo da reprovação',
        demand.rejectionReason,
        reason.trim()
      );
      await recordDemandHistory(
        id,
        req,
        'Mês de execução',
        demand.executionMonth,
        null
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
            'ID da demanda inválido.',
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
          message: 'Demanda não encontrada.',
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
            'Demanda não encontrada.',
        });
      }

      await recordDemandHistory(
        id,
        req,
        'Pagamento',
        beforePay.paid ? 'Pago' : 'Não pago',
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
                      OR DATE_FORMAT(
                        execution_month,
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
                  WHEN status = 'Concluída'
                    AND (
                      ? IS NULL
                      OR DATE_FORMAT(
                        execution_month,
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
                  WHEN status = 'Concluída'
                    AND (
                      ? IS NULL
                      OR DATE_FORMAT(
                        execution_month,
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
                      OR DATE_FORMAT(
                        execution_month,
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
                    OR DATE_FORMAT(
                      execution_month,
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
                   WHEN (
                     ? IS NULL
                     OR DATE_FORMAT(
                       analysis_month,
                       '%Y-%m'
                     ) = ?
                   )
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

      // Horas analisadas: independente do período selecionado.
      // Considera somente demandas com status "Analisada".
      // Para CLIENTE, respeita apenas o cliente logado.
      const analyzedHoursWhere =
        req.user?.role === 'CLIENTE'
          ? 'WHERE client_id = ?'
          : '';

      const analyzedHoursParams =
        req.user?.role === 'CLIENTE'
          ? [req.user.clientId]
          : [];

      const [analyzedRows] =
        await pool.query(
          `
          SELECT
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
        'Rota não encontrada.',
    });
  }
);


// =====================================================
// ERRO GLOBAL
// =====================================================

app.use(
  (
    error: any,
    _req,
    res: Response,
    _next
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

app.listen(
  PORT,
  () => {
    console.log(
      `Backend rodando em http://localhost:${PORT}`
    );
  }
);


























