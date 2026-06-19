'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    UserIcon,
    EnvelopeIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { ClientSourceConfig } from '@/types';
import { getDefaultSourceConfig } from '@/lib/utils/source-config';
interface User {
    id: number;
    username: string;
    email: string;
    phoneNumber?: string;
    role: 'admin' | 'agent' | 'client';
    isActive: boolean;
    sourceConfig?: ClientSourceConfig | null;
    identification?: string;
    clientType?: number;
    /** Loaded from Filipo-Web GET /api/v1/customers (not stored in Motor DB). */
    hasCredit?: boolean;
    /** Loaded from Filipo-Web GET /api/v1/customers (not stored in Motor DB). */
    creditLimit?: number | null;
    /** Filipo `credit_days_limit` — loaded from Filipo-Web, not Motor DB. */
    filipoCreditDaysLimit?: number | null;
    createdAt: string;
    updatedAt: string;
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
    allowOrdersWithOverduePortfolio?: boolean;
    incoterm?: string | null;
}

interface Source {
    originCode: string;
    name: string;
    isActive: boolean;
}

interface UserManagementProps {
    userRole?: string;
}

export function UserManagement({ userRole }: UserManagementProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const [createForm, setCreateForm] = useState({
        username: '',
        email: '',
        password: '',
        phoneNumber: '',
        role: 'agent' as User['role'],
        identification: '',
        clientType: undefined as number | undefined,
        isCompany: false,
        clientName: '',
        phoneCountryCode: '+57',
        country: '',
        stateOrDepartment: '',
        city: '',
        address: '',
        marketingSource: '',
        surveyCatPct: undefined as number | undefined,
        surveyKomatsuPct: undefined as number | undefined,
        surveyJohnDeerePct: undefined as number | undefined,
        incoterm: '',
    });

    const [editForm, setEditForm] = useState({
        username: '',
        email: '',
        phoneNumber: '',
        role: 'agent' as User['role'],
        isActive: true,
        sourceConfig: null as ClientSourceConfig | null,
        identification: '',
        clientType: undefined as number | undefined,
        hasCredit: false,
        creditLimit: undefined as number | undefined,
        /** Max days until due in Filipo (optional; not stored in Motor DB). */
        filipoCreditDaysLimit: undefined as number | undefined,
        newPassword: '',
        isCompany: false,
        clientName: '',
        phoneCountryCode: '',
        country: '',
        stateOrDepartment: '',
        city: '',
        address: '',
        marketingSource: '',
        surveyCatPct: undefined as number | undefined,
        surveyKomatsuPct: undefined as number | undefined,
        surveyJohnDeerePct: undefined as number | undefined,
        allowOrdersWithOverduePortfolio: false,
        incoterm: '',
    });

    const [isLoadingClientInfo, setIsLoadingClientInfo] = useState(false);
    const [loadingFilipoCredit, setLoadingFilipoCredit] = useState(false);
    const [filipoCreditError, setFilipoCreditError] = useState<string | null>(null);

    const [availableSources, setAvailableSources] = useState<Source[]>([]);
    const [isLoadingSources, setIsLoadingSources] = useState(false);

    // Client search states for identification field
    const [clientOptions, setClientOptions] = useState<Array<{ id: number; name: string; code?: string; identification?: string; clientType?: number }>>([]);
    const [isLoadingClientSearch, setIsLoadingClientSearch] = useState(false);
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const clientSearchAbortRef = useRef<AbortController | null>(null);

    // Filter states
    const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'agent' | 'client'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showClientDropdown) {
                const target = event.target as HTMLElement;
                if (!target.closest('.client-dropdown-container')) {
                    setShowClientDropdown(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showClientDropdown]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/users', { credentials: 'include' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const msg = data?.error || 'No se pudieron obtener los usuarios';
                const is500 = response.status === 500;
                const looksLikeSchemaDrift =
                    /column|does not exist|creditPaymentTermDays|P20\d{2}/i.test(msg);
                const genericServerError =
                    is500 && (msg.includes('Internal') || msg === 'Failed to fetch users');
                throw new Error(
                    genericServerError && !looksLikeSchemaDrift
                        ? 'Error al cargar la lista. Si antes veía usuarios, aplique el esquema en esta BD: npx prisma migrate deploy (o npx prisma db push en desarrollo).'
                        : msg
                );
            }
            setUsers(Array.isArray(data.data) ? data.data : []);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error al obtener usuarios';
            console.error('Error al obtener usuarios:', error);
            toast.error(message, { duration: message.includes('migraciones') ? 8000 : 4000 });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('¿Está seguro que desea eliminar este usuario?')) {
            return;
        }

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'No se pudo eliminar el usuario');
            }

            toast.success('Usuario eliminado correctamente');
            fetchUsers();
        } catch (error: any) {
            console.error('Error al eliminar usuario:', error);
            toast.error(error.message || 'Error al eliminar usuario');
        }
    };

    const loadAvailableSources = async () => {
        setIsLoadingSources(true);
        try {
            const response = await fetch('/api/config/endpoints');
            if (response.ok) {
                const data = await response.json();
                const sources = (data.endpoints || []).map((e: any) => ({
                    originCode: e.originCode,
                    name: e.name,
                    isActive: e.isActive,
                }));
                setAvailableSources(sources);
            }
        } catch (error) {
            console.error('Error loading sources:', error);
        } finally {
            setIsLoadingSources(false);
        }
    };

    const handleOpenEdit = async (user: User) => {
        setEditingUser(user);

        // Load available sources if editing a client
        if (user.role === 'client') {
            await loadAvailableSources();
        }

        // Initialize source config
        let sourceConfig: ClientSourceConfig | null = null;
        if (user.role === 'client') {
            // Wait for sources to load
            if (availableSources.length === 0) {
                await loadAvailableSources();
            }

            // Ensure we have all available sources in the config
            const existingConfig = user.sourceConfig && user.sourceConfig.sources && user.sourceConfig.sources.length > 0
                ? user.sourceConfig
                : { sources: [] };

            const existingOriginCodes = new Set(existingConfig.sources.map(s => s.originCode));

            // Create a map of existing sources for quick lookup
            const existingSourcesMap = new Map(
                existingConfig.sources.map(s => [s.originCode, s])
            );

            // Build complete config with all available sources
            // Use existing config if available, otherwise create new entries
            const allSources = availableSources.map(source => {
                const existing = existingSourcesMap.get(source.originCode);
                if (existing) {
                    // Use existing configuration
                    return existing;
                } else {
                    // Create new entry with default values
                    return {
                        originCode: source.originCode,
                        enabled: false, // Default to disabled for new sources
                        profitValue: 0.6,
                    };
                }
            });

            sourceConfig = {
                sources: allSources,
            };
        }

        setFilipoCreditError(null);

        setEditForm({
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber || '',
            role: user.role,
            isActive: user.isActive,
            sourceConfig,
            identification: user.identification || '',
            clientType: user.clientType,
            hasCredit: false,
            creditLimit: undefined,
            newPassword: '',
            isCompany: user.isCompany ?? false,
            clientName: user.clientName || '',
            phoneCountryCode: user.phoneCountryCode || '',
            country: user.country || '',
            stateOrDepartment: user.stateOrDepartment || '',
            city: user.city || '',
            address: user.address || '',
            marketingSource: user.marketingSource || '',
            surveyCatPct: user.surveyCatPct,
            surveyKomatsuPct: user.surveyKomatsuPct,
            surveyJohnDeerePct: user.surveyJohnDeerePct,
            filipoCreditDaysLimit: undefined,
            allowOrdersWithOverduePortfolio: Boolean(user.allowOrdersWithOverduePortfolio),
            incoterm: user.incoterm ?? '',
        });

        if (user.role === 'client') {
            setLoadingFilipoCredit(true);
            try {
                const res = await fetch(`/api/users/${user.id}`);
                const json = await res.json();
                const d = json?.data;
                if (d && typeof d === 'object') {
                    setEditForm((prev) => ({
                        ...prev,
                        hasCredit: typeof d.hasCredit === 'boolean' ? d.hasCredit : prev.hasCredit,
                        creditLimit: d.creditLimit != null ? Number(d.creditLimit) : prev.creditLimit,
                        filipoCreditDaysLimit:
                            typeof d.filipoCreditDaysLimit === 'number'
                                ? d.filipoCreditDaysLimit
                                : prev.filipoCreditDaysLimit,
                        allowOrdersWithOverduePortfolio:
                            typeof d.allowOrdersWithOverduePortfolio === 'boolean'
                                ? d.allowOrdersWithOverduePortfolio
                                : prev.allowOrdersWithOverduePortfolio,
                    }));
                } else {
                    setFilipoCreditError('Filipo no devolvio datos de credito para este cliente.');
                }
            } catch {
                setFilipoCreditError('No se pudo conectar con Filipo para obtener datos de credito.');
            } finally {
                setLoadingFilipoCredit(false);
            }
        }
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const submitData: any = {
                username: createForm.username,
                email: createForm.email,
                password: createForm.password,
                phoneNumber: createForm.phoneNumber,
                role: createForm.role,
                identification: createForm.identification || undefined,
                clientType: createForm.role === 'client' ? (createForm.clientType ?? 17) : createForm.clientType,
                isCompany: createForm.role === 'client' ? createForm.isCompany : undefined,
                clientName: createForm.role === 'client' ? (createForm.clientName || undefined) : undefined,
                phoneCountryCode: createForm.role === 'client' ? (createForm.phoneCountryCode || undefined) : undefined,
                country: createForm.role === 'client' ? (createForm.country || undefined) : undefined,
                stateOrDepartment: createForm.role === 'client' ? (createForm.stateOrDepartment || undefined) : undefined,
                city: createForm.role === 'client' ? (createForm.city || undefined) : undefined,
                address: createForm.role === 'client' ? (createForm.address || undefined) : undefined,
                marketingSource: createForm.role === 'client' ? (createForm.marketingSource || undefined) : undefined,
                surveyCatPct: createForm.role === 'client' ? createForm.surveyCatPct : undefined,
                surveyKomatsuPct: createForm.role === 'client' ? createForm.surveyKomatsuPct : undefined,
                surveyJohnDeerePct: createForm.role === 'client' ? createForm.surveyJohnDeerePct : undefined,
                incoterm: createForm.role === 'client' ? (createForm.incoterm?.trim() || undefined) : undefined,
            };

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'No se pudo crear el usuario');
            }
            toast.success('Usuario creado correctamente');
            setShowCreateForm(false);
            setCreateForm({
                username: '', email: '', password: '', phoneNumber: '', role: 'agent', identification: '', clientType: undefined,
                isCompany: false, clientName: '', phoneCountryCode: '+57', country: '', stateOrDepartment: '', city: '', address: '',
                marketingSource: '', surveyCatPct: undefined, surveyKomatsuPct: undefined, surveyJohnDeerePct: undefined,
                incoterm: '',
            });
            fetchUsers();
        } catch (error: any) {
            console.error('Error al crear usuario:', error);
            toast.error(error.message || 'No se pudo crear el usuario');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSourceToggle = (originCode: string, enabled: boolean) => {
        if (!editForm.sourceConfig) {
            // Initialize sourceConfig if it doesn't exist
            const newConfig: ClientSourceConfig = {
                sources: [{
                    originCode,
                    enabled,
                    profitValue: 0.6,
                }],
            };
            setEditForm({ ...editForm, sourceConfig: newConfig });
            return;
        }

        // Check if source exists in config
        const existingSource = editForm.sourceConfig.sources.find(s => s.originCode === originCode);

        if (existingSource) {
            // Update existing source
            const updatedConfig: ClientSourceConfig = {
                sources: editForm.sourceConfig.sources.map((s) =>
                    s.originCode === originCode ? { ...s, enabled } : s
                ),
            };
            setEditForm({ ...editForm, sourceConfig: updatedConfig });
        } else {
            // Add new source to config
            const updatedConfig: ClientSourceConfig = {
                sources: [
                    ...editForm.sourceConfig.sources,
                    {
                        originCode,
                        enabled,
                        profitValue: 0.6,
                    },
                ],
            };
            setEditForm({ ...editForm, sourceConfig: updatedConfig });
        }
    };

    const handleProfitChange = (originCode: string, profitValue: number) => {
        if (!editForm.sourceConfig) return;

        const updatedConfig: ClientSourceConfig = {
            sources: editForm.sourceConfig.sources.map((s) =>
                s.originCode === originCode ? { ...s, profitValue: Math.max(0.01, Math.min(0.99, profitValue)) } : s
            ),
        };
        setEditForm({ ...editForm, sourceConfig: updatedConfig });
    };

    // Client search as user types (for identification field)
    useEffect(() => {
        const identification = createForm.role === 'client' ? createForm.identification : editForm.role === 'client' ? editForm.identification : '';
        const q = identification?.trim() || '';

        if (q.length < 2) {
            setClientOptions([]);
            setShowClientDropdown(false);
            return;
        }

        const handler = setTimeout(async () => {
            try {
                clientSearchAbortRef.current?.abort();
                const controller = new AbortController();
                clientSearchAbortRef.current = controller;
                setIsLoadingClientSearch(true);
                const res = await fetch(`/api/clients/search?searchTerm=${encodeURIComponent(q)}`, { signal: controller.signal });
                const data = await res.json();
                const list = (data?.clients || []).map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    code: c.code,
                    identification: c.identification || c.code,
                    clientType: c.clientType,
                }));
                setClientOptions(list);
                setShowClientDropdown(list.length > 0);
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Error searching clients:', error);
                }
            } finally {
                setIsLoadingClientSearch(false);
            }
        }, 300);

        return () => {
            clearTimeout(handler);
            clientSearchAbortRef.current?.abort();
        };
    }, [createForm.identification, createForm.role, editForm.identification, editForm.role]);

    const handleClientSelect = (client: { id: number; name: string; code?: string; identification?: string; clientType?: number }, isCreate: boolean) => {
        if (isCreate) {
            setCreateForm(prev => ({
                ...prev,
                identification: client.identification || client.code || '',
                clientType: client.clientType,
                username: prev.username || client.name?.toLowerCase().replace(/\s+/g, '.') || prev.username,
            }));
        } else {
            setEditForm(prev => ({
                ...prev,
                identification: client.identification || client.code || '',
                clientType: client.clientType,
            }));
        }
        setClientOptions([]);
        setShowClientDropdown(false);
        toast.success(`Cliente seleccionado: ${client.name}`);
    };

    const fetchClientInfo = async (identification: string, isCreate: boolean = false) => {
        if (!identification || identification.trim().length < 3) {
            return;
        }

        setIsLoadingClientInfo(true);
        try {
            const response = await fetch(`/api/clients/by-identification?identification=${encodeURIComponent(identification.trim())}`);
            const data = await response.json();

            if (response.ok && data.success && data.client) {
                const client = data.client;
                toast.success(`Cliente encontrado: ${client.name || 'Sin nombre'}`);

                if (isCreate) {
                    setCreateForm(prev => ({
                        ...prev,
                        clientType: client.clientType,
                        // Optionally auto-fill name if available
                        username: prev.username || client.name?.toLowerCase().replace(/\s+/g, '.') || prev.username,
                    }));
                } else {
                    setEditForm(prev => ({
                        ...prev,
                        clientType: client.clientType,
                    }));
                }
            } else {
                toast.error('Cliente no encontrado con esta identificación');
            }
        } catch (error) {
            console.error('Error fetching client info:', error);
            toast.error('Error al buscar información del cliente');
        } finally {
            setIsLoadingClientInfo(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSubmitting(true);
        try {
            const submitData: any = {
                username: editForm.username,
                email: editForm.email,
                phoneNumber: editForm.phoneNumber,
                role: editForm.role,
                isActive: editForm.isActive,
                identification: editForm.identification,
                clientType: editForm.clientType,
                hasCredit: editForm.hasCredit,
                creditLimit: editForm.creditLimit !== undefined ? Number(editForm.creditLimit) : null,
                allowOrdersWithOverduePortfolio: editForm.allowOrdersWithOverduePortfolio,
            };
            if (editForm.role === 'client' && editForm.filipoCreditDaysLimit !== undefined) {
                submitData.filipoCreditDaysLimit = editForm.filipoCreditDaysLimit;
            }

            if (editForm.newPassword && editForm.newPassword.trim().length >= 6) {
                submitData.password = editForm.newPassword.trim();
            }

            if (editForm.role === 'client' && editForm.sourceConfig) {
                submitData.sourceConfig = editForm.sourceConfig;
            }

            if (editForm.role === 'client') {
                submitData.isCompany = editForm.isCompany;
                submitData.clientName = editForm.clientName;
                submitData.phoneCountryCode = editForm.phoneCountryCode;
                submitData.country = editForm.country;
                submitData.stateOrDepartment = editForm.stateOrDepartment;
                submitData.city = editForm.city;
                submitData.address = editForm.address;
                submitData.marketingSource = editForm.marketingSource;
                submitData.surveyCatPct = editForm.surveyCatPct;
                submitData.surveyKomatsuPct = editForm.surveyKomatsuPct;
                submitData.surveyJohnDeerePct = editForm.surveyJohnDeerePct;
                submitData.incoterm = editForm.incoterm?.trim() || null;
            }

            const response = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(submitData),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'No se pudo actualizar el usuario');
            }
            const fs = data?.filipoSync as { ok?: boolean; skipped?: boolean; error?: string } | undefined;
            if (editForm.role === 'client') {
                if (fs?.skipped) {
                    toast.success('Usuario actualizado correctamente');
                } else if (fs?.ok) {
                    toast.success(
                        'Usuario actualizado y sincronizado con Filipo.'
                    );
                } else {
                    toast.error(
                        `Usuario guardado en Motor, pero Filipo no se actualizó: ${fs?.error ?? 'error desconocido'}`
                    );
                }
            } else {
                toast.success('Usuario actualizado correctamente');
            }
            setEditingUser(null);
            fetchUsers();
        } catch (error: any) {
            console.error('Error al actualizar usuario:', error);
            toast.error(error.message || 'No se pudo actualizar el usuario');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-red-100 text-red-800';
            case 'agent':
                return 'bg-blue-100 text-blue-800';
            case 'client':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getClientTypeLabel = (clientType: number | undefined): string => {
        if (clientType === undefined || clientType === null) return '—';
        switch (clientType) {
            case 14: return 'CIPARCOL';
            case 15: return 'PREMIUM';
            case 16: return 'AA';
            case 17: return 'Tipo A';
            default: return `Tipo ${clientType}`;
        }
    };

    const getClientDataCompleteness = (user: User): { percentage: number; isComplete: boolean } => {
        if (user.role !== 'client') return { percentage: 0, isComplete: false };
        const fields = [
            !!user.clientName?.trim(),
            !!(user.phoneNumber?.trim() || user.phoneCountryCode?.trim()),
            !!user.country?.trim(),
            !!user.stateOrDepartment?.trim(),
            !!user.city?.trim(),
            !!user.address?.trim(),
            !!user.identification?.trim(),
            !!user.marketingSource?.trim(),
            user.surveyCatPct !== undefined && user.surveyCatPct !== null,
            user.surveyKomatsuPct !== undefined && user.surveyKomatsuPct !== null,
            user.surveyJohnDeerePct !== undefined && user.surveyJohnDeerePct !== null,
        ];
        const filled = fields.filter(Boolean).length;
        const total = fields.length;
        const percentage = total === 0 ? 0 : Math.round((filled / total) * 100);
        return { percentage, isComplete: percentage === 100 };
    };

    // Filter users based on current filters
    const filteredUsers = users.filter((user) => {
        // Role filter
        if (filterRole !== 'all' && user.role !== filterRole) {
            return false;
        }

        // Status filter
        if (filterStatus !== 'all') {
            if (filterStatus === 'active' && !user.isActive) {
                return false;
            }
            if (filterStatus === 'inactive' && user.isActive) {
                return false;
            }
        }

        // Search filter (username, email)
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            const matchesUsername = user.username.toLowerCase().includes(searchLower);
            const matchesEmail = user.email.toLowerCase().includes(searchLower);
            if (!matchesUsername && !matchesEmail) {
                return false;
            }
        }

        return true;
    });

    // Count users by filter
    const activeUsersCount = users.filter(u => u.isActive).length;
    const inactiveUsersCount = users.filter(u => !u.isActive).length;
    const adminCount = users.filter(u => u.role === 'admin').length;
    const agentCount = users.filter(u => u.role === 'agent').length;
    const clientCount = users.filter(u => u.role === 'client').length;

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 bg-white rounded-lg border">
                        <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters Section */}
            <div className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                        <FunnelIcon className="h-5 w-5 text-gray-400" />
                        <h3 className="text-sm font-medium text-gray-900">Filtros</h3>
                    </div>
                    {(filterRole !== 'all' || filterStatus !== 'all' || searchTerm.trim()) && (
                        <button
                            onClick={() => {
                                setFilterRole('all');
                                setFilterStatus('all');
                                setSearchTerm('');
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search Filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Buscar
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Usuario o email..."
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    {/* Role Filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Rol
                        </label>
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                            <option value="all">Todos ({users.length})</option>
                            <option value="admin">Admin ({adminCount})</option>
                            <option value="agent">Agente ({agentCount})</option>
                            <option value="client">Cliente ({clientCount})</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Estado
                        </label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                            <option value="all">Todos ({users.length})</option>
                            <option value="active">Activos ({activeUsersCount})</option>
                            <option value="inactive">Inactivos ({inactiveUsersCount})</option>
                        </select>
                    </div>
                </div>

                {/* Results count */}
                {filteredUsers.length !== users.length && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                            Mostrando <span className="font-medium text-gray-900">{filteredUsers.length}</span> de <span className="font-medium text-gray-900">{users.length}</span> usuarios
                        </p>
                    </div>
                )}
            </div>

            {/* Users List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {filteredUsers.length === 0 ? (
                        <li>
                            <div className="px-4 py-8 text-center">
                                <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron usuarios</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    {searchTerm || filterRole !== 'all' || filterStatus !== 'all'
                                        ? 'Intente ajustar los filtros para ver más resultados.'
                                        : 'Comience creando un nuevo usuario.'}
                                </p>
                            </div>
                        </li>
                    ) : (
                        filteredUsers.map((user) => (
                            <li key={user.id}>
                                <div className="px-4 py-4 flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <UserIcon className="h-10 w-10 text-gray-400" />
                                        </div>
                                        <div className="ml-4 flex-1 min-w-0">
                                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                                <p className="text-sm font-medium text-gray-900">{user.clientName || user.username}</p>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                                                    {user.role}
                                                </span>
                                                {user.role === 'client' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800" title="Tipo de cliente">
                                                        {getClientTypeLabel(user.clientType)}
                                                    </span>
                                                )}
                                                {!user.isActive && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        Inactivo
                                                    </span>
                                                )}
                                                {user.role === 'client' && (() => {
                                                    const { percentage, isComplete } = getClientDataCompleteness(user);
                                                    return (
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                                                            title="Datos del perfil completados"
                                                        >
                                                            {isComplete ? '100% datos' : `${percentage}% datos`}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex items-center mt-1">
                                                <EnvelopeIcon className="h-4 w-4 text-gray-400 mr-1 flex-shrink-0" />
                                                <p className="text-sm text-gray-500 truncate">{user.email}</p>
                                            </div>
                                            {user.phoneNumber && (
                                                <div className="flex items-center mt-1">
                                                    <svg className="h-4 w-4 text-gray-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    <p className="text-sm text-gray-500">{user.phoneNumber}</p>
                                                </div>
                                            )}
                                            <div className="flex items-center mt-2 text-sm font-medium text-gray-700">
                                                <CalendarDaysIcon className="h-4 w-4 text-gray-500 mr-1.5 flex-shrink-0" aria-hidden />
                                                <span>Registro: {new Date(user.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {userRole === 'admin' && (
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => handleOpenEdit(user)} className="text-blue-600 hover:text-blue-900">
                                                <PencilIcon className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            {users.length === 0 && !isLoading && (
                <div className="text-center py-12">
                    <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron usuarios</h3>
                    <p className="mt-1 text-sm text-gray-500">Comience creando un nuevo usuario.</p>
                </div>
            )}

            {userRole === 'admin' && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Agregar Usuario
                    </button>
                </div>
            )}

            {showCreateForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateForm(false)} />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
                        {/* Fixed Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                            <h3 className="text-lg font-medium text-gray-900">Crear Usuario</h3>
                            <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Scrollable Content */}
                        <form id="create-user-form" onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Usuario</label>
                                    <input
                                        required
                                        type="text"
                                        value={createForm.username}
                                        onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
                                    <input
                                        required
                                        type="email"
                                        value={createForm.email}
                                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={createForm.phoneNumber}
                                        onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="+57 300 123 4567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                                    <input
                                        required
                                        type="password"
                                        value={createForm.password}
                                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Rol</label>
                                    <select
                                        value={createForm.role}
                                        onChange={(e) => {
                                            const newRole = e.target.value as User['role'];
                                            setCreateForm({
                                                ...createForm,
                                                role: newRole,
                                                clientType: newRole === 'client' ? (createForm.clientType ?? 17) : createForm.clientType,
                                            });
                                            if (newRole === 'client') {
                                                loadAvailableSources();
                                            }
                                        }}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    >
                                        <option value="admin">Administrador</option>
                                        <option value="agent">Agente</option>
                                        <option value="client">Cliente</option>
                                    </select>
                                </div>

                                {/* Client-specific fields */}
                                {createForm.role === 'client' && (
                                    <>
                                        <div>
                                            <span className="block text-sm font-medium text-gray-700">¿Empresa o persona natural?</span>
                                            <div className="mt-1 flex gap-4">
                                                <label className="inline-flex items-center">
                                                    <input type="radio" checked={!createForm.isCompany} onChange={() => setCreateForm({ ...createForm, isCompany: false })} className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                    <span className="ml-2 text-sm">Persona</span>
                                                </label>
                                                <label className="inline-flex items-center">
                                                    <input type="radio" checked={createForm.isCompany} onChange={() => setCreateForm({ ...createForm, isCompany: true })} className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                    <span className="ml-2 text-sm">Empresa</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Nombre del cliente (persona o empresa)</label>
                                            <input type="text" value={createForm.clientName} onChange={(e) => setCreateForm({ ...createForm, clientName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder={createForm.isCompany ? 'Nombre de la empresa' : 'Nombre completo'} />
                                        </div>
                                        <div className="relative client-dropdown-container">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Identificación (NIT, ID, etc.)
                                            </label>
                                            <div className="mt-1 relative">
                                                <input
                                                    type="text"
                                                    value={createForm.identification}
                                                    onChange={(e) => {
                                                        setCreateForm({ ...createForm, identification: e.target.value });
                                                        setShowClientDropdown(true);
                                                    }}
                                                    onFocus={() => {
                                                        if (clientOptions.length > 0) {
                                                            setShowClientDropdown(true);
                                                        }
                                                    }}
                                                    placeholder="Buscar cliente por identificación, nombre o código"
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                />
                                                {/* Client suggestions dropdown */}
                                                {(clientOptions.length > 0 || isLoadingClientSearch) && showClientDropdown && createForm.identification && createForm.identification.trim().length >= 2 && (
                                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                                        {isLoadingClientSearch && (
                                                            <div className="px-3 py-2 text-sm text-gray-500">Buscando clientes...</div>
                                                        )}
                                                        {clientOptions.map((c) => (
                                                            <button
                                                                type="button"
                                                                key={c.id}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                                                onClick={() => handleClientSelect(c, true)}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-900">{c.name}</div>
                                                                        {c.identification && (
                                                                            <div className="text-xs text-gray-500">ID: {c.identification}</div>
                                                                        )}
                                                                    </div>
                                                                    {typeof c.clientType === 'number' && (
                                                                        <span className="ml-2 text-xs text-gray-400">Tipo {c.clientType}</span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Ingrese la identificación del cliente para buscar y seleccionar automáticamente
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Tipo de Cliente</label>
                                            <select
                                                value={createForm.clientType ?? 17}
                                                onChange={(e) => setCreateForm({ ...createForm, clientType: e.target.value ? Number(e.target.value) : 17 })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            >
                                                <option value="14">CIPARCOL (Tipo 14)</option>
                                                <option value="15">PREMIUM (Tipo 15)</option>
                                                <option value="16">AA (Tipo 16)</option>
                                                <option value="17">A (Tipo 17)</option>
                                            </select>
                                            <p className="mt-1 text-xs text-gray-500">Por defecto Tipo 17 (A)</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Código país teléfono</label>
                                            <input type="text" value={createForm.phoneCountryCode} onChange={(e) => setCreateForm({ ...createForm, phoneCountryCode: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="+57" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">País</label>
                                            <input type="text" value={createForm.country} onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Colombia" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Estado / Departamento</label>
                                            <input type="text" value={createForm.stateOrDepartment} onChange={(e) => setCreateForm({ ...createForm, stateOrDepartment: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Cundinamarca" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Ciudad</label>
                                            <input type="text" value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Bogotá" />
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Dirección</label>
                                            <input type="text" value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Calle 123 #45-67" />
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Incoterm</label>
                                            <input
                                                type="text"
                                                value={createForm.incoterm}
                                                onChange={(e) => setCreateForm({ ...createForm, incoterm: e.target.value.slice(0, 32) })}
                                                maxLength={32}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="ej. EXW, FOB"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">¿Cómo se enteró de nosotros?</label>
                                            <select value={createForm.marketingSource} onChange={(e) => setCreateForm({ ...createForm, marketingSource: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                                <option value="">Seleccione...</option>
                                                <option value="redes_sociales">Redes sociales</option>
                                                <option value="referido">Referido</option>
                                                <option value="busqueda_web">Búsqueda web</option>
                                                <option value="ferias">Ferias</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">% máquinas CAT (0-100)</label>
                                            <input type="number" min={0} max={100} value={createForm.surveyCatPct ?? ''} onChange={(e) => setCreateForm({ ...createForm, surveyCatPct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">% máquinas Komatsu (0-100)</label>
                                            <input type="number" min={0} max={100} value={createForm.surveyKomatsuPct ?? ''} onChange={(e) => setCreateForm({ ...createForm, surveyKomatsuPct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">% máquinas John Deere (0-100)</label>
                                            <input type="number" min={0} max={100} value={createForm.surveyJohnDeerePct ?? ''} onChange={(e) => setCreateForm({ ...createForm, surveyJohnDeerePct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="0" />
                                        </div>
                                    </>
                                )}

                                {/* Source Configuration Section - Only for client role in create form - Full width */}
                                {createForm.role === 'client' && (
                                    <div className="col-span-1 md:col-span-2 border-t border-gray-200 pt-4 mt-4">
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                                            Configuración de Fuentes Externas
                                        </h4>
                                        <p className="text-xs text-gray-500 mb-4">
                                            Seleccione las fuentes disponibles para este cliente y configure el porcentaje de ganancia por fuente.
                                        </p>
                                        <p className="text-xs text-gray-400 italic">
                                            Nota: Puede configurar las fuentes después de crear el usuario.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </form>
                        {/* Fixed Footer */}
                        <div className="flex justify-end space-x-2 px-6 py-4 border-t border-gray-200 flex-shrink-0">
                            <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                Cancelar
                            </button>
                            <button type="submit" form="create-user-form" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                                {isSubmitting ? 'Creando...' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setEditingUser(null)} />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
                        {/* Fixed Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Editar Usuario</h3>
                                {editingUser.createdAt && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Creado: {new Date(editingUser.createdAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Scrollable Content */}
                        <form id="edit-user-form" onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Usuario</label>
                                    <input
                                        required
                                        type="text"
                                        value={editForm.username}
                                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
                                    <input
                                        required
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={editForm.phoneNumber}
                                        onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="+57 300 123 4567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Rol</label>
                                    <select
                                        value={editForm.role}
                                        onChange={async (e) => {
                                            const newRole = e.target.value as User['role'];
                                            let newSourceConfig: ClientSourceConfig | null = editForm.sourceConfig;

                                            // If changing to client role, initialize source config
                                            if (newRole === 'client' && editForm.role !== 'client') {
                                                // Load sources first
                                                const sourcesResponse = await fetch('/api/config/endpoints');
                                                if (sourcesResponse.ok) {
                                                    const sourcesData = await sourcesResponse.json();
                                                    const sources = (sourcesData.endpoints || []).map((e: any) => ({
                                                        originCode: e.originCode,
                                                        name: e.name,
                                                    }));
                                                    if (sources.length > 0) {
                                                        newSourceConfig = getDefaultSourceConfig(sources);
                                                    }
                                                }
                                                await loadAvailableSources(); // Update state for UI
                                            } else if (newRole !== 'client') {
                                                // Clear source config if not client
                                                newSourceConfig = null;
                                            }

                                            setEditForm({
                                                ...editForm,
                                                role: newRole,
                                                sourceConfig: newSourceConfig
                                            });
                                        }}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="agent">Agent</option>
                                        <option value="client">Client</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Nueva Contraseña (opcional)
                                    </label>
                                    <input
                                        type="password"
                                        value={editForm.newPassword}
                                        onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Dejar en blanco para no cambiar"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Mínimo 6 caracteres. Solo se actualizará si ingresa una nueva contraseña.
                                    </p>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        id="isActive"
                                        type="checkbox"
                                        checked={editForm.isActive}
                                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">Activo</label>
                                </div>

                                {/* Client-specific fields */}
                                {editForm.role === 'client' && (
                                    <>
                                        <div>
                                            <span className="block text-sm font-medium text-gray-700">¿Empresa o persona?</span>
                                            <div className="mt-1 flex gap-4">
                                                <label className="inline-flex items-center">
                                                    <input type="radio" checked={!editForm.isCompany} onChange={() => setEditForm({ ...editForm, isCompany: false })} className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                    <span className="ml-2 text-sm">Persona</span>
                                                </label>
                                                <label className="inline-flex items-center">
                                                    <input type="radio" checked={editForm.isCompany} onChange={() => setEditForm({ ...editForm, isCompany: true })} className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                    <span className="ml-2 text-sm">Empresa</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Nombre del cliente</label>
                                            <input type="text" value={editForm.clientName} onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="Nombre o empresa" />
                                        </div>
                                        <div className="relative client-dropdown-container">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Identificación (NIT, ID, etc.)
                                            </label>
                                            <div className="mt-1 relative">
                                                <input
                                                    type="text"
                                                    value={editForm.identification}
                                                    onChange={(e) => {
                                                        setEditForm({ ...editForm, identification: e.target.value });
                                                        setShowClientDropdown(true);
                                                    }}
                                                    onFocus={() => {
                                                        if (clientOptions.length > 0) {
                                                            setShowClientDropdown(true);
                                                        }
                                                    }}
                                                    placeholder="Buscar cliente por identificación, nombre o código"
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                />
                                                {/* Client suggestions dropdown */}
                                                {(clientOptions.length > 0 || isLoadingClientSearch) && showClientDropdown && editForm.identification && editForm.identification.trim().length >= 2 && (
                                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                                        {isLoadingClientSearch && (
                                                            <div className="px-3 py-2 text-sm text-gray-500">Buscando clientes...</div>
                                                        )}
                                                        {clientOptions.map((c) => (
                                                            <button
                                                                type="button"
                                                                key={c.id}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                                                onClick={() => handleClientSelect(c, false)}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-900">{c.name}</div>
                                                                        {c.identification && (
                                                                            <div className="text-xs text-gray-500">ID: {c.identification}</div>
                                                                        )}
                                                                    </div>
                                                                    {typeof c.clientType === 'number' && (
                                                                        <span className="ml-2 text-xs text-gray-400">Tipo {c.clientType}</span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Ingrese la identificación del cliente para buscar y seleccionar automáticamente
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Tipo de Cliente</label>
                                            <select
                                                value={editForm.clientType ?? ''}
                                                onChange={(e) => setEditForm({ ...editForm, clientType: e.target.value ? Number(e.target.value) : undefined })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            >
                                                <option value="">Seleccione tipo</option>
                                                <option value="14">CIPARCOL (Tipo 14)</option>
                                                <option value="15">PREMIUM (Tipo 15)</option>
                                                <option value="16">AA (Tipo 16)</option>
                                                <option value="17">A (Tipo 17)</option>
                                            </select>
                                        </div>
                                        <div className="col-span-1 md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                                            <div className="flex items-start">
                                                <input
                                                    id="allowOrdersWithOverduePortfolio"
                                                    type="checkbox"
                                                    checked={editForm.allowOrdersWithOverduePortfolio}
                                                    onChange={(e) =>
                                                        setEditForm({
                                                            ...editForm,
                                                            allowOrdersWithOverduePortfolio: e.target.checked,
                                                        })
                                                    }
                                                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <label htmlFor="allowOrdersWithOverduePortfolio" className="ml-2 block text-sm text-gray-900">
                                                    Permitir crear órdenes aunque tenga cartera vencida (excepción manual)
                                                </label>
                                            </div>
                                            <p className="mt-1 text-xs text-gray-600">
                                                Solo úselo para clientes perfilados. Esta excepción omite el bloqueo por mora al crear pedidos.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Código país teléfono</label>
                                            <input type="text" value={editForm.phoneCountryCode} onChange={(e) => setEditForm({ ...editForm, phoneCountryCode: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="+57" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">País</label>
                                            <input type="text" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Estado / Departamento</label>
                                            <input type="text" value={editForm.stateOrDepartment} onChange={(e) => setEditForm({ ...editForm, stateOrDepartment: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Ciudad</label>
                                            <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Dirección</label>
                                            <input type="text" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700">Incoterm</label>
                                            <input
                                                type="text"
                                                value={editForm.incoterm}
                                                onChange={(e) => setEditForm({ ...editForm, incoterm: e.target.value.slice(0, 32) })}
                                                maxLength={32}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                placeholder="ej. EXW, FOB"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">Se muestra en PDF de órdenes y facturas (término comercial acordado).</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">¿Cómo se enteró?</label>
                                            <select value={editForm.marketingSource} onChange={(e) => setEditForm({ ...editForm, marketingSource: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                                <option value="">—</option>
                                                <option value="redes_sociales">Redes sociales</option>
                                                <option value="referido">Referido</option>
                                                <option value="busqueda_web">Búsqueda web</option>
                                                <option value="ferias">Ferias</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">% CAT</label>
                                            <input type="number" min={0} max={100} value={editForm.surveyCatPct ?? ''} onChange={(e) => setEditForm({ ...editForm, surveyCatPct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">% Komatsu</label>
                                            <input type="number" min={0} max={100} value={editForm.surveyKomatsuPct ?? ''} onChange={(e) => setEditForm({ ...editForm, surveyKomatsuPct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">% John Deere</label>
                                            <input type="number" min={0} max={100} value={editForm.surveyJohnDeerePct ?? ''} onChange={(e) => setEditForm({ ...editForm, surveyJohnDeerePct: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" />
                                        </div>
                                        {/* Credit section — data from Filipo-Web */}
                                        <div className="col-span-1 md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <h4 className="text-sm font-medium text-gray-900">Datos de Crédito</h4>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                    Filipo-Web
                                                </span>
                                            </div>

                                            {loadingFilipoCredit ? (
                                                <div className="flex items-center gap-2 py-4">
                                                    <svg className="animate-spin h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    <span className="text-sm text-gray-600">Cargando datos de crédito desde Filipo...</span>
                                                </div>
                                            ) : filipoCreditError ? (
                                                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-3">
                                                    <div className="flex">
                                                        <svg className="h-5 w-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                        </svg>
                                                        <div className="ml-3">
                                                            <p className="text-sm text-amber-800">{filipoCreditError}</p>
                                                            <p className="mt-1 text-xs text-amber-600">
                                                                Puede editar los campos manualmente. Al guardar, se enviaran a Filipo.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}

                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center">
                                                    <input
                                                        id="hasCredit"
                                                        type="checkbox"
                                                        checked={editForm.hasCredit}
                                                        disabled={loadingFilipoCredit}
                                                        onChange={(e) =>
                                                            setEditForm({
                                                                ...editForm,
                                                                hasCredit: e.target.checked,
                                                            })
                                                        }
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                                    />
                                                    <label htmlFor="hasCredit" className="ml-2 block text-sm text-gray-900">
                                                        Tiene crédito con IPMach
                                                    </label>
                                                </div>
                                                {editForm.hasCredit && (
                                                    <div className="flex-1">
                                                        <label htmlFor="creditLimit" className="block text-sm font-medium text-gray-700">
                                                            Límite de crédito (USD)
                                                        </label>
                                                        <input
                                                            id="creditLimit"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            disabled={loadingFilipoCredit}
                                                            value={editForm.creditLimit ?? ''}
                                                            onChange={(e) => setEditForm({
                                                                ...editForm,
                                                                creditLimit: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0,
                                                            })}
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
                                                            placeholder="Ej: 10000"
                                                        />
                                                        <p className="mt-1 text-xs text-gray-500">
                                                            Cupo disponible = límite menos órdenes pendientes/en proceso y deuda
                                                            general (cartera externa).
                                                        </p>
                                                        <div className="mt-3">
                                                            <label htmlFor="filipoCreditDaysLimit" className="block text-sm font-medium text-gray-700">
                                                                Días plazo cartera
                                                            </label>
                                                            <input
                                                                id="filipoCreditDaysLimit"
                                                                type="number"
                                                                min={0}
                                                                max={365}
                                                                step={1}
                                                                disabled={loadingFilipoCredit}
                                                                value={editForm.filipoCreditDaysLimit ?? ''}
                                                                onChange={(e) =>
                                                                    setEditForm({
                                                                        ...editForm,
                                                                        filipoCreditDaysLimit:
                                                                            e.target.value === ''
                                                                                ? undefined
                                                                                : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                                                                    })
                                                                }
                                                                className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-100"
                                                                placeholder="Ej: 30 (0 = sin tope)"
                                                            />
                                                            <p className="mt-1 text-xs text-gray-500">
                                                                Se guarda en Filipo como <code className="text-xs">credit_days_limit</code>. Deje vacío
                                                                para no cambiar el valor actual en Filipo al guardar.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs text-gray-400">
                                                Estos datos se leen y guardan exclusivamente en Filipo-Web. No se almacenan en la base de datos de Motor.
                                            </p>
                                        </div>
                                    </>
                                )}

                            </div>

                            {/* Source Configuration Section - Only for client role - Full width */}
                            {editForm.role === 'client' && (
                                <div className="col-span-1 md:col-span-2 border-t border-gray-200 pt-4 mt-4">
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                                        Configuración de Fuentes Externas
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-4">
                                        Seleccione las fuentes disponibles para este cliente y configure el porcentaje de ganancia por fuente.
                                    </p>

                                    {isLoadingSources ? (
                                        <div className="text-sm text-gray-500">Cargando fuentes...</div>
                                    ) : editForm.sourceConfig && availableSources.length > 0 ? (
                                        <div className="space-y-3 max-h-64 overflow-y-auto">
                                            {availableSources.map((source) => {
                                                const sourceConfig = editForm.sourceConfig?.sources.find(
                                                    (s) => s.originCode === source.originCode
                                                ) || { originCode: source.originCode, enabled: false, profitValue: 0.6 };

                                                return (
                                                    <div key={source.originCode} className="flex items-center space-x-4 p-2 border border-gray-200 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={sourceConfig.enabled}
                                                            onChange={(e) => handleSourceToggle(source.originCode, e.target.checked)}
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                        />
                                                        <label className="flex-1 text-sm text-gray-900">
                                                            {source.name} ({source.originCode})
                                                        </label>
                                                        {sourceConfig.enabled && (
                                                            <div className="flex items-center space-x-2">
                                                                <label className="text-xs text-gray-600">Divisor:</label>
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    max="0.99"
                                                                    step="0.01"
                                                                    value={sourceConfig.profitValue}
                                                                    onChange={(e) => handleProfitChange(source.originCode, parseFloat(e.target.value) || 0.6)}
                                                                    className="w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                                                    title="Divisor value: price will be divided by this value (e.g., 0.6 means price / 0.6)"
                                                                />
                                                                <span className="text-xs text-gray-500">(÷ {sourceConfig.profitValue})</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-500">No hay fuentes disponibles</div>
                                    )}
                                </div>
                            )}
                        </form>
                        {/* Fixed Footer */}
                        <div className="flex justify-end space-x-2 px-6 py-4 border-t border-gray-200 flex-shrink-0">
                            <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                Cancelar
                            </button>
                            <button type="submit" form="edit-user-form" disabled={isSubmitting || loadingFilipoCredit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                                {isSubmitting ? 'Guardando...' : loadingFilipoCredit ? 'Cargando crédito...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
