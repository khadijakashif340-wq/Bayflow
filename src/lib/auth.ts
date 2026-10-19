import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { UserType, ShopRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'bayflow_super_secret_jwt_key_2026_production_at_least_32_chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const COOKIE_NAME = 'bayflow_token';

export type TokenPayload = {
  userId: string;
  email: string;
  name: string;
  userType: UserType;
};

export function signJwtToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyJwtToken(token);
  } catch {
    return null;
  }
}
