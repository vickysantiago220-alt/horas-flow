import { AuthenticatedRequest } from '../middleware/authMiddleware';

export type SaphireScope = {
  clientId: number | null;
  period: string | null;
  canSeeAllClients: boolean;
};

export function resolveSaphireScope(
  req: AuthenticatedRequest,
  requestedClientId?: unknown,
  requestedPeriod?: unknown
): SaphireScope {
  const user = req.user;

  if (!user) {
    throw new Error('UsuÃ¡rio nÃ£o autenticado.');
  }

  const role = String(user.role || '').toUpperCase();

  /*
   * REGRA DE SEGURANÃ‡A:
   *
   * CLIENTE nunca pode escolher outro clientId pelo frontend.
   * O escopo vem exclusivamente do usuÃ¡rio autenticado.
   */
  if (role === 'CLIENTE') {
    const clientId = Number(user.clientId);

    if (!Number.isInteger(clientId) || clientId <= 0) {
      throw new Error('UsuÃ¡rio cliente sem cliente vinculado.');
    }

    return {
      clientId,
      period:
        requestedPeriod &&
        String(requestedPeriod) !== 'Todos'
          ? String(requestedPeriod)
          : null,
      canSeeAllClients: false,
    };
  }

  /*
   * ADMIN / INTERNO:
   * podem trabalhar com todos os clientes ou com um cliente
   * especÃ­fico enviado pelo frontend.
   */
  let clientId: number | null = null;

  if (
    requestedClientId !== undefined &&
    requestedClientId !== null &&
    String(requestedClientId) !== '' &&
    String(requestedClientId) !== 'Todos'
  ) {
    const parsedClientId = Number(requestedClientId);

    if (!Number.isInteger(parsedClientId) || parsedClientId <= 0) {
      throw new Error('Cliente invÃ¡lido.');
    }

    clientId = parsedClientId;
  }

  const period =
    requestedPeriod &&
    String(requestedPeriod) !== 'Todos'
      ? String(requestedPeriod)
      : null;

  return {
    clientId,
    period,
    canSeeAllClients: clientId === null,
  };
}

