'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import {
    Cog6ToothIcon,
    UserIcon,
    BellIcon,
    ShieldCheckIcon,
    GlobeAltIcon,
    CircleStackIcon
} from '@heroicons/react/24/outline';

export default function SettingsPage() {
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState('general');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Simulate saving settings
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success('¡Configuración guardada correctamente!');
        } catch (error) {
            toast.error('No se pudo guardar la configuración');
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'general', name: 'General', icon: Cog6ToothIcon },
        { id: 'profile', name: 'Perfil', icon: UserIcon },
        { id: 'notifications', name: 'Notificaciones', icon: BellIcon },
        { id: 'security', name: 'Seguridad', icon: ShieldCheckIcon },
        { id: 'integrations', name: 'Integraciones', icon: GlobeAltIcon },
        { id: 'database', name: 'Base de Datos', icon: CircleStackIcon },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Configuración General</h3>
                            <p className="text-sm text-gray-500">Configure la configuración general de la aplicación.</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Idioma Predeterminado</label>
                                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                    <option>Inglés</option>
                                    <option>Español</option>
                                    <option>Francés</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Zona Horaria</label>
                                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                    <option>UTC-5 (Hora del Este)</option>
                                    <option>UTC-6 (Hora Central)</option>
                                    <option>UTC-7 (Hora de la Montaña)</option>
                                    <option>UTC-8 (Hora del Pacífico)</option>
                                </select>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="darkMode"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="darkMode" className="ml-2 block text-sm text-gray-900">
                                    Habilitar modo oscuro
                                </label>
                            </div>
                        </div>
                    </div>
                );
            case 'profile':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Configuración de Perfil</h3>
                            <p className="text-sm text-gray-500">Actualice su información personal.</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre de usuario</label>
                                <input
                                    type="text"
                                    defaultValue={session?.user?.name || ''}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
                                <input
                                    type="email"
                                    defaultValue={session?.user?.email || ''}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Rol</label>
                                <input
                                    type="text"
                                    value={session?.user?.role || ''}
                                    disabled
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'notifications':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Configuración de Notificaciones</h3>
                            <p className="text-sm text-gray-500">Configure cómo desea recibir notificaciones.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Notificaciones por correo</h4>
                                    <p className="text-sm text-gray-500">Reciba notificaciones por correo electrónico</p>
                                </div>
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Actualizaciones de cotizaciones</h4>
                                    <p className="text-sm text-gray-500">Reciba avisos cuando se actualicen cotizaciones</p>
                                </div>
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Alertas del sistema</h4>
                                    <p className="text-sm text-gray-500">Reciba alertas de mantenimiento del sistema</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'security':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Configuración de Seguridad</h3>
                            <p className="text-sm text-gray-500">Administre la seguridad de su cuenta.</p>
                        </div>
                        <div className="space-y-4">
                            <button className="btn-secondary">Cambiar contraseña</button>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Autenticación de dos factores</h4>
                                    <p className="text-sm text-gray-500">Agregue una capa extra de seguridad</p>
                                </div>
                                <button className="btn-primary">Habilitar</button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Tiempo de sesión</h4>
                                    <p className="text-sm text-gray-500">Cerrar sesión automáticamente tras inactividad</p>
                                </div>
                                <select className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                    <option>15 minutos</option>
                                    <option>30 minutos</option>
                                    <option>1 hora</option>
                                    <option>2 horas</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );
            case 'integrations':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Integraciones</h3>
                            <p className="text-sm text-gray-500">Administre integraciones con servicios externos.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Servicio de Stock</h4>
                                    <p className="text-sm text-gray-500">Conectar con el servicio externo de stock</p>
                                </div>
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                    Conectado
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Currency API</h4>
                                    <p className="text-sm text-gray-500">Conversión de divisas en tiempo real</p>
                                </div>
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                    Conectado
                                </span>
                            </div>
                        </div>
                    </div>
                );
            case 'database':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Configuración de Base de Datos</h3>
                            <p className="text-sm text-gray-500">Administre la configuración y mantenimiento de la base de datos.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Estado de la base de datos</h4>
                                    <p className="text-sm text-gray-500">Estado actual de la conexión</p>
                                </div>
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                    En línea
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">Última copia de seguridad</h4>
                                    <p className="text-sm text-gray-500">Copia de seguridad más reciente</p>
                                </div>
                                <span className="text-sm text-gray-500">hace 2 horas</span>
                            </div>
                            <button className="btn-secondary">Crear copia de seguridad</button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Administre la configuración y preferencias de su cuenta.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {/* Settings Navigation */}
                <div className="lg:col-span-1">
                    <nav className="space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeTab === tab.id
                                        ? 'bg-blue-100 text-blue-900'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                                    {tab.name}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Settings Content */}
                <div className="lg:col-span-3">
                    <div className="card">
                        <div className="card-body">
                            {renderTabContent()}
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="btn-primary"
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
