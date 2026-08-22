import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthUser, UserRole } from '../auth';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não informado.',
      });
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'Formato de autenticação inválido.',
      });
    }

    const user = verifyToken(token);

    if (!user || !user.id || !user.role) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação inválido.',
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado.',
    });
  }
}

export function authorize(...roles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Você não possui permissão para esta ação.',
      });
    }

    next();
  };
}