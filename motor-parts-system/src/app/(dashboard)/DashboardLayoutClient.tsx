'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { QuoteProvider, useQuote } from '@/contexts/QuoteContext';
import { formatCurrency } from '@/lib/utils';
import {
    Bars3Icon,
    XMarkIcon,
    HomeIcon,
    MagnifyingGlassIcon,
    DocumentTextIcon,
    UsersIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon,
    ShoppingCartIcon,
    ClipboardDocumentListIcon,
    KeyIcon,
    ChevronDownIcon,
    CreditCardIcon,
    DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { AIAssistantWidget } from '@/components/ipmach/AIAssistantWidget';
import { GlobalClientSearchBar } from '@/components/search/GlobalClientSearchBar';

function QuoteIndicator({ isClientTheme = false }: { isClientTheme?: boolean }) {
    const { getQuoteItemCount, getQuoteTotal, currentQuote } = useQuote();
    const itemCount = getQuoteItemCount();
    const total = getQuoteTotal();

    if (!currentQuote || itemCount === 0) {
        return null;
    }

    return (
        <div className={`flex items-center gap-x-2 px-3 py-1 rounded-full border ${isClientTheme
            ? 'bg-ipmach-yellow/10 border-ipmach-yellow/30 text-ipmach-dark'
            : 'bg-blue-50 border-blue-200'
            }`}>
            <ShoppingCartIcon className={`h-4 w-4 flex-shrink-0 ${isClientTheme ? 'text-ipmach-yellow-dark' : 'text-blue-600'}`} />
            <span className={`text-sm font-medium ${isClientTheme ? 'text-ipmach-dark' : 'text-blue-900'}`}>
                {itemCount} ítems
            </span>
            <span className={`text-sm ${isClientTheme ? 'text-ipmach-dark/90' : 'text-blue-700'}`}>
                {formatCurrency(total, 'USD')}
            </span>
        </div>
    );
}

const navigation = [
    { name: 'Panel', href: '/dashboard', icon: HomeIcon, roles: ['admin', 'agent', 'client'] },
    { name: 'Buscar', href: '/search', icon: MagnifyingGlassIcon, roles: ['admin', 'agent'] },
    { name: 'Buscar', href: '/client-search', icon: MagnifyingGlassIcon, roles: ['client'] },
    { name: 'Crédito', href: '/credit', icon: CreditCardIcon, roles: ['client'] },
    { name: 'Cotizaciones', href: '/quotes', icon: ClipboardDocumentListIcon, roles: ['admin', 'agent', 'client'] },
    { name: 'Órdenes', href: '/orders', icon: ClipboardDocumentListIcon, roles: ['client', 'admin', 'agent'] },
    { name: 'Facturas', href: '/facturas', icon: DocumentDuplicateIcon, roles: ['admin', 'agent', 'client'] },
    { name: 'Base de conocimiento', href: '/knowledge', icon: DocumentTextIcon, roles: ['admin'] },
    { name: 'Usuarios', href: '/users', icon: UsersIcon, roles: ['admin'] },
];

export default function DashboardLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const handleSignOut = () => {
        signOut({ callbackUrl: '/login' });
    };

    const filteredNavigation = navigation.filter((item) => {
        if (item.roles) {
            const userRole = session?.user?.role || '';
            const isIncluded = item.roles.includes(userRole);
            return isIncluded;
        }
        return true;
    });

    const isClientTheme = session?.user?.role === 'client';

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className={`animate-spin rounded-full h-32 w-32 border-b-2 ${isClientTheme ? 'border-ipmach-yellow' : 'border-blue-600'}`}></div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return null;
    }

    return (
        <QuoteProvider>
            <div className={`h-full ${isClientTheme ? 'theme-client' : ''}`}>
                <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
                    <div className={`fixed inset-y-0 left-0 flex w-64 flex-col bg-white ${isClientTheme ? 'border-r border-ipmach-dark/10' : ''}`}>
                        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100">
                            <h1 className={`text-lg font-semibold ${isClientTheme ? 'text-ipmach-dark' : 'text-gray-900'}`}>Sistema de Repuestos</h1>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <nav className="flex-1 space-y-1 px-2 py-4">
                            {filteredNavigation.map((item, index) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={`${item.href}-${index}`}
                                        href={item.href}
                                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive
                                            ? isClientTheme
                                                ? 'bg-ipmach-yellow/15 text-ipmach-dark border-l-4 border-ipmach-yellow'
                                                : 'bg-blue-100 text-blue-900'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <item.icon
                                            className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? (isClientTheme ? 'text-ipmach-yellow-dark' : 'text-blue-500') : 'text-gray-400 group-hover:text-gray-500'}`}
                                        />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:z-30 pointer-events-auto">
                    <div className={`flex flex-col flex-grow bg-white pointer-events-auto ${isClientTheme ? 'border-r border-ipmach-dark/10' : 'border-r border-gray-200'}`}>
                        <div className="flex h-16 items-center px-4 border-b border-gray-100 pointer-events-auto">
                            <h1 className={`text-lg font-semibold ${isClientTheme ? 'text-ipmach-dark' : 'text-gray-900'}`}>Sistema de Repuestos</h1>
                        </div>
                        <nav className="flex-1 space-y-1 px-2 py-4 relative z-30 pointer-events-auto">
                            {filteredNavigation.map((item, index) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={`${item.href}-${index}`}
                                        href={item.href}
                                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md relative z-30 pointer-events-auto ${isActive
                                            ? isClientTheme
                                                ? 'bg-ipmach-yellow/15 text-ipmach-dark border-l-4 border-ipmach-yellow'
                                                : 'bg-blue-100 text-blue-900'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <item.icon
                                            className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? (isClientTheme ? 'text-ipmach-yellow-dark' : 'text-blue-500') : 'text-gray-400 group-hover:text-gray-500'}`}
                                        />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                <div className="lg:pl-64 relative z-10">
                    {/* Black stripe with IPMACH logo (client theme only) */}
                    {isClientTheme && (
                        <div className="sticky top-0 z-50 w-full h-[6.4rem] min-h-[6.4rem] bg-[#0f0f0f] flex items-center justify-center px-2 overflow-visible">
                            <Link href="/client-search" className="flex items-center" aria-label="IPMach inicio">
                                <Image
                                    src="/ipmach-logo-header.png"
                                    alt="IPMach"
                                    width={520}
                                    height={160}
                                    className="h-[7.8rem] sm:h-[9.36rem] md:h-[10.92rem] lg:h-[12.48rem] w-auto opacity-95 hover:opacity-100 transition-opacity"
                                />
                            </Link>
                        </div>
                    )}
                    <div className={`sticky z-40 flex h-16 shrink-0 items-center gap-x-4 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 ${isClientTheme ? 'border-b border-ipmach-dark/10 top-[6.4rem]' : 'border-b border-gray-200 top-0'}`}>
                        <button
                            type="button"
                            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <span className="sr-only">Abrir menú lateral</span>
                            <Bars3Icon className="h-6 w-6" />
                        </button>

                        <div className="flex min-w-0 flex-1 gap-x-4 self-stretch lg:gap-x-6">
                            <div className="flex min-w-0 flex-1 items-center">
                                <GlobalClientSearchBar />
                            </div>
                            <div className="flex items-center gap-x-4 lg:gap-x-6">
                                <QuoteIndicator isClientTheme={isClientTheme} />
                                <div
                                    className="relative"
                                    onMouseEnter={() => setUserMenuOpen(true)}
                                    onMouseLeave={() => setUserMenuOpen(false)}
                                >
                                    <div className="flex items-center gap-x-2 cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors">
                                        <span className="text-sm text-gray-700">
                                            Bienvenido, {session?.user?.name}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isClientTheme ? 'bg-ipmach-yellow/20 text-ipmach-dark' : 'bg-blue-100 text-blue-800'}`}>
                                            {session?.user?.role}
                                        </span>
                                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                                    </div>

                                    {userMenuOpen && (
                                        <div className="absolute right-0 top-full pt-1 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                            <div className="py-1">
                                                <Link
                                                    href="/change-password"
                                                    className={`flex items-center px-4 py-2 text-sm transition-colors ${isClientTheme ? 'text-ipmach-dark hover:bg-ipmach-yellow/10' : 'text-gray-700 hover:bg-gray-100'}`}
                                                >
                                                    <KeyIcon className="mr-3 h-5 w-5 text-gray-400" />
                                                    Cambiar Contraseña
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <a
                                    href="https://wa.me/573226774363"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md border border-green-600 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                                    title="Soporte por WhatsApp"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-4 w-4 fill-current text-green-600">
                                        <path d="M19.11 17.35c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1.01 1.24-.19.21-.37.24-.69.08-.32-.16-1.36-.5-2.59-1.59-.96-.86-1.61-1.92-1.8-2.24-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.72-.97-2.36-.26-.62-.53-.53-.71-.54l-.61-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63s1.13 3.06 1.29 3.27c.16.21 2.22 3.39 5.39 4.75.75.32 1.33.51 1.78.65.75.24 1.43.21 1.97.13.6-.09 1.88-.77 2.15-1.51.27-.74.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37z" />
                                        <path d="M26.02 5.98C23.2 3.16 19.72 1.63 16 1.63 8.64 1.63 2.63 7.64 2.63 15c0 2.2.57 4.35 1.65 6.26L2 30l8.93-2.22c1.83 1 3.9 1.53 6.07 1.53 7.36 0 13.37-6.01 13.37-13.37 0-3.56-1.39-6.91-3.91-9.43zM16 27.37c-1.95 0-3.85-.52-5.51-1.51l-.4-.24-5.3 1.32 1.41-5.16-.26-.42C4.51 19.63 3.88 17.35 3.88 15 3.88 8.83 8.83 3.88 16 3.88c3.03 0 5.88 1.18 8.02 3.32C26.16 8.34 27.37 11.09 27.37 15c0 7.17-4.95 12.37-11.37 12.37z" />
                                    </svg>
                                    <span>Soporte</span>
                                </a>
                                <button
                                    onClick={handleSignOut}
                                    className={`flex items-center gap-x-2 text-sm ${isClientTheme ? 'text-ipmach-dark hover:text-ipmach-dark/80' : 'text-gray-700 hover:text-gray-900'}`}
                                >
                                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                                    Cerrar sesión
                                </button>
                            </div>
                        </div>
                    </div>

                    <main className={`py-6 ${isClientTheme ? 'bg-[#fafafa]' : ''}`}>
                        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>

            {/* AI Assistant widget for clients — available on all client pages */}
            {session?.user?.role === 'client' && <AIAssistantWidget />}
        </QuoteProvider>
    );
}
