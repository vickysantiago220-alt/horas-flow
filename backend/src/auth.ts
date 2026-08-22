import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'horaflow-segredo-local-dev';

export type UserRole = 'ADMIN' | 'INTERNAL' | 'CLIENT';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  clientId: number | null;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(
  password: string,
  passwordHash: string
): boolean {
  return bcrypt.compareSync(password, passwordHash);
}

export function createToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
    },
    JWT_SECRET,
    {
      expiresIn: '8h',
    }
  );
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

  return {
    id: Number(decoded.id),
    name: decoded.name,
    email: decoded.email,
    role: decoded.role,
    clientId: decoded.clientId
      ? Number(decoded.clientId)
      : null,
  };
}