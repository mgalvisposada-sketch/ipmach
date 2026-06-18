'use client';

import Link from 'next/link';
import {
    MagnifyingGlassIcon,
    // DocumentTextIcon, // Removed - no longer used
    // ChartBarIcon, // Removed - no longer used
    UsersIcon,
    Cog6ToothIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';

interface QuickActionsProps {
    userRole?: string;
}

export function QuickActions({ userRole }: QuickActionsProps) {
    const getActionsForRole = (role?: string) => {
        const baseActions = [
            {
                name: 'Search Parts',
                description: 'Search for motor parts in inventory',
                href: '/search',
                icon: MagnifyingGlassIcon,
                color: 'bg-blue-500',
            },
            // Analytics and Reports buttons removed
        ];

        const adminActions = [
            {
                name: 'Manage Users',
                description: 'Add, edit, or remove users',
                href: '/users',
                icon: UsersIcon,
                color: 'bg-red-500',
            },
            {
                name: 'System Settings',
                description: 'Configure system preferences',
                href: '/settings',
                icon: Cog6ToothIcon,
                color: 'bg-gray-500',
            },
        ];

        const agentActions = [
            {
                name: 'Create Quote',
                description: 'Create a new quote for client',
                href: '/search',
                icon: PlusIcon,
                color: 'bg-orange-500',
            },
        ];

        if (role === 'admin') {
            return [...baseActions, ...adminActions];
        } else if (role === 'agent') {
            return [...baseActions, ...agentActions];
        } else {
            return baseActions;
        }
    };

    const actions = getActionsForRole(userRole);
    const isClient = userRole === 'client';

    // Compact single-row layout for client: button + links in one line, less empty space
    if (isClient) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                <Link
                    href="/client-search"
                    className="inline-flex items-center gap-2 rounded-lg border border-ipmach-yellow/80 bg-ipmach-yellow/15 px-3 py-2 text-sm font-semibold text-ipmach-dark hover:bg-ipmach-yellow/25 transition-colors"
                >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                    Buscar repuestos
                </Link>
                <div className="flex items-center gap-4 text-sm">
                    <Link href="/quotes" className="text-gray-600 hover:text-ipmach-dark hover:underline">
                        Ver mis cotizaciones
                    </Link>
                    <Link href="/orders" className="text-gray-600 hover:text-ipmach-dark hover:underline">
                        Ver mis órdenes
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {actions.map((action) => {
                const Icon = action.icon;
                return (
                    <Link
                        key={action.name}
                        href={action.href}
                        className="group relative rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                    >
                        <div className="flex items-center space-x-3">
                            <div className={`flex-shrink-0 rounded-lg p-2 ${action.color}`}>
                                <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                                    {action.name}
                                </h3>
                                <p className="text-sm text-gray-500">{action.description}</p>
                            </div>
                        </div>
                        <div className="absolute inset-0 rounded-lg ring-2 ring-transparent group-hover:ring-blue-500 group-hover:ring-opacity-20 transition-all duration-200" />
                    </Link>
                );
            })}
        </div>
    );
}
