'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { UserManagement } from '@/components/users/UserManagement';

export default function UsersPage() {
    const { data: session } = useSession();
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Check if user has admin role
    if (session?.user?.role !== 'admin') {
        return (
            <div className="space-y-6">
                <div className="card">
                    <div className="card-body text-center py-12">
                        <div className="mx-auto h-12 w-12 text-gray-400">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Acceso denegado</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Necesita privilegios de administrador para acceder a la gestión de usuarios.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Administre los usuarios del sistema y sus permisos.
                </p>
            </div>

            {/* User Management Component */}
            <UserManagement userRole={session?.user?.role} />
        </div>
    );
}
