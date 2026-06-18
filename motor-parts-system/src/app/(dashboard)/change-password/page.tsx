'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function ChangePasswordPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error('Por favor complete todos los campos');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('La nueva contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Las contraseñas nuevas no coinciden');
            return;
        }

        if (currentPassword === newPassword) {
            toast.error('La nueva contraseña debe ser diferente a la actual');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al cambiar la contraseña');
            }

            toast.success('Contraseña cambiada exitosamente');
            
            // Clear form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);
        } catch (error: any) {
            console.error('Error changing password:', error);
            toast.error(error.message || 'Error al cambiar la contraseña. Inténtelo de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeftIcon className="h-4 w-4 mr-1" />
                    Volver
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Cambiar Contraseña</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Ingrese su contraseña actual y la nueva contraseña para actualizar su cuenta.
                </p>
            </div>

            <div className="card max-w-2xl">
                <div className="card-header">
                    <h2 className="text-lg font-medium text-gray-900">Actualizar Contraseña</h2>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Current Password */}
                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Contraseña Actual <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="currentPassword"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="input-field pr-10"
                                    placeholder="Ingrese su contraseña actual"
                                    required
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    disabled={isSubmitting}
                                >
                                    {showCurrentPassword ? (
                                        <EyeSlashIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Nueva Contraseña <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="input-field pr-10"
                                    placeholder="Ingrese su nueva contraseña (mínimo 6 caracteres)"
                                    required
                                    minLength={6}
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    disabled={isSubmitting}
                                >
                                    {showNewPassword ? (
                                        <EyeSlashIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                La contraseña debe tener al menos 6 caracteres
                            </p>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                Confirmar Nueva Contraseña <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="input-field pr-10"
                                    placeholder="Confirme su nueva contraseña"
                                    required
                                    minLength={6}
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    disabled={isSubmitting}
                                >
                                    {showConfirmPassword ? (
                                        <EyeSlashIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="btn-secondary"
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="spinner"></div>
                                        <span>Cambiando...</span>
                                    </div>
                                ) : (
                                    'Cambiar Contraseña'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}


