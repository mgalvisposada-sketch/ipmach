import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { UserType } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const ROLES = {
    ADMIN: 'admin',
    AGENT: 'agent',
    CLIENT: 'client',
} as const;

export const PERMISSIONS = {
    [ROLES.ADMIN]: ['read:all', 'write:all', 'reports:all', 'manage:users'],
    [ROLES.AGENT]: ['read:own', 'write:quotes', 'reports:own', 'search:all'],
    [ROLES.CLIENT]: ['read:own', 'reports:own', 'search:own'],
} as const;

type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS][number];

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                username: { label: 'Username', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                try {
                    const loginInput = credentials.username.trim();
                    const isEmail = loginInput.includes('@');
                    const user = await prisma.users.findUnique({
                        where: isEmail
                            ? { email: loginInput }
                            : { username: loginInput },
                    });

                    if (!user || !user.isActive) {
                        return null;
                    }

                    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
                    if (!isValidPassword) {
                        return null;
                    }

                    const displayName = user.clientName ?? user.username;
                    return {
                        id: user.id.toString(),
                        email: user.email,
                        name: displayName,
                        role: user.role,
                    };
                } catch (error) {
                    console.error('Auth error:', error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as string;
                session.user.id = token.id as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
        signOut: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60, // 24 hours
    },
    secret: process.env.NEXTAUTH_SECRET,
};

export function hasPermission(userRole: string, permission: string): boolean {
    const userPermissions = PERMISSIONS[userRole as keyof typeof PERMISSIONS] || [];
    return (userPermissions as readonly string[]).includes(permission);
}

export function requireAuth(permission?: string) {
    return function (req: any, res: any, next: any) {
        // This would be implemented in middleware
        // For now, it's a placeholder
        return next();
    };
}

export interface CreateUserExtended {
    username: string;
    email: string;
    password: string;
    phoneNumber?: string;
    role: string;
    identification?: string;
    clientType?: number;
    isCompany?: boolean;
    clientName?: string;
    phoneCountryCode?: string;
    country?: string;
    stateOrDepartment?: string;
    city?: string;
    address?: string;
    marketingSource?: string;
    surveyCatPct?: number;
    surveyKomatsuPct?: number;
    surveyJohnDeerePct?: number;
}

export async function createUser(userData: CreateUserExtended) {
    try {
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        const user = await prisma.users.create({
            data: {
                username: userData.username,
                email: userData.email,
                passwordHash: hashedPassword,
                phoneNumber: userData.phoneNumber,
                role: userData.role as any,
                identification: userData.identification,
                clientType: userData.clientType,
                isActive: true,
                isCompany: userData.isCompany,
                clientName: userData.clientName,
                phoneCountryCode: userData.phoneCountryCode,
                country: userData.country,
                stateOrDepartment: userData.stateOrDepartment,
                city: userData.city,
                address: userData.address,
                marketingSource: userData.marketingSource,
                surveyCatPct: userData.surveyCatPct,
                surveyKomatsuPct: userData.surveyKomatsuPct,
                surveyJohnDeerePct: userData.surveyJohnDeerePct,
                allowOrdersWithOverduePortfolio: false,
            },
        });

        return { success: true, user: { ...user, passwordHash: undefined } };
    } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, error: 'Failed to create user' };
    }
}

export async function updateUser(userId: number, userData: {
    username?: string;
    email?: string;
    phoneNumber?: string | null;
    role?: string;
    isActive?: boolean;
    sourceConfig?: any;
    identification?: string | null;
    clientType?: number | null;
    password?: string;
    isCompany?: boolean;
    clientName?: string | null;
    phoneCountryCode?: string | null;
    country?: string | null;
    stateOrDepartment?: string | null;
    city?: string | null;
    address?: string | null;
    marketingSource?: string | null;
    surveyCatPct?: number | null;
    surveyKomatsuPct?: number | null;
    surveyJohnDeerePct?: number | null;
    allowOrdersWithOverduePortfolio?: boolean;
}) {
    try {
        const updateData: any = {
            ...userData,
            role: userData.role as any,
        };

        // Remove password from updateData to handle it separately
        delete updateData.password;
        delete updateData.creditPaymentTermDays;
        delete updateData.hasCredit;
        delete updateData.creditLimit;

        // Handle sourceConfig - ensure it's properly serialized
        if (userData.sourceConfig !== undefined) {
            updateData.sourceConfig = userData.sourceConfig ? JSON.parse(JSON.stringify(userData.sourceConfig)) : null;
        }

        // Hash password if provided
        if (userData.password !== undefined && userData.password.trim().length >= 6) {
            updateData.passwordHash = await bcrypt.hash(userData.password, 12);
        }

        const user = await prisma.users.update({
            where: { id: userId },
            data: updateData,
        });

        return { success: true, user: { ...user, passwordHash: undefined } };
    } catch (error: any) {
        console.error('Error updating user:', error);

        // Handle common Prisma Errors specifically
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'unknown field';
            return { success: false, error: `Ya existe un usuario con este ${field}. Por favor use uno diferente.` };
        }

        if (error.code === 'P2000') {
            return { success: false, error: "Uno de los campos es demasiado largo para la base de datos." };
        }

        const errorMessage = error.message || 'Failed to update user';
        return { success: false, error: errorMessage };
    }
}

export async function deleteUser(userId: number) {
    try {
        await prisma.users.delete({
            where: { id: userId },
        });

        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: 'Failed to delete user' };
    }
}

export async function getAllUsers() {
    try {
        const users = await prisma.users.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
                role: true,
                isActive: true,
                sourceConfig: true,
                identification: true,
                clientType: true,
                createdAt: true,
                updatedAt: true,
                isCompany: true,
                clientName: true,
                phoneCountryCode: true,
                country: true,
                stateOrDepartment: true,
                city: true,
                address: true,
                marketingSource: true,
                surveyCatPct: true,
                surveyKomatsuPct: true,
                surveyJohnDeerePct: true,
                allowOrdersWithOverduePortfolio: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return { success: true, users };
    } catch (error) {
        console.error('Error fetching users:', error);
        const message =
            error instanceof Error ? error.message : 'Failed to fetch users';
        return {
            success: false,
            error:
                process.env.NODE_ENV === 'development'
                    ? message
                    : 'Failed to fetch users',
        };
    }
}

export async function getUserById(userId: number) {
    try {
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
                role: true,
                isActive: true,
                sourceConfig: true,
                identification: true,
                clientType: true,
                createdAt: true,
                updatedAt: true,
                isCompany: true,
                clientName: true,
                phoneCountryCode: true,
                country: true,
                stateOrDepartment: true,
                city: true,
                address: true,
                marketingSource: true,
                surveyCatPct: true,
                surveyKomatsuPct: true,
                surveyJohnDeerePct: true,
                allowOrdersWithOverduePortfolio: true,
            },
        });

        return { success: true, user };
    } catch (error) {
        console.error('Error fetching user:', error);
        return { success: false, error: 'Failed to fetch user' };
    }
}
