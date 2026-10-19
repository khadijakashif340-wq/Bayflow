import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { verifyTenantAccess } from '@/lib/tenant-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ShopRole, UserType } from '@prisma/client';

const addMemberSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(7, 'Phone number is required'),
  role: z.nativeEnum(ShopRole),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { shopId } = await params;
    const access = await verifyTenantAccess(prisma, session.userId, shopId, [ShopRole.OWNER]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const members = await prisma.shopMember.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return apiSuccess(members);
  } catch (error: any) {
    console.error('Fetch members error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to retrieve team members', 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) return apiError('UNAUTHORIZED', 'Not authenticated', 401);

    const { shopId } = await params;
    const access = await verifyTenantAccess(prisma, session.userId, shopId, [ShopRole.OWNER]);
    if (!access.allowed) {
      return apiError(access.error.code, access.error.message, access.error.statusCode);
    }

    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fields[err.path[0].toString()] = err.message;
      });
      return apiError('VALIDATION_ERROR', 'Please verify staff details', 400, fields);
    }

    const { name, email, phone, role } = parsed.data;

    const member = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        const defaultPassword = await bcrypt.hash('bayflow2026', 10);
        user = await tx.user.create({
          data: {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            passwordHash: defaultPassword,
            userType: UserType.STAFF,
          },
        });
      }

      // Check if already member
      const existingMember = await tx.shopMember.findUnique({
        where: {
          shopId_userId: {
            shopId,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        if (!existingMember.isActive) {
          // Reactivate
          return await tx.shopMember.update({
            where: { id: existingMember.id },
            data: { role, isActive: true },
            include: { user: true },
          });
        }
        throw new Error('MEMBER_EXISTS');
      }

      return await tx.shopMember.create({
        data: {
          shopId,
          userId: user.id,
          role,
          isActive: true,
        },
        include: { user: true },
      });
    });

    return apiSuccess(member, 201);
  } catch (error: any) {
    if (error.message === 'MEMBER_EXISTS') {
      return apiError('MEMBER_EXISTS', 'This staff member is already assigned to this shop', 409);
    }
    console.error('Add member error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to add staff member', 500);
  }
}
