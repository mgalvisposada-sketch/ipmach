'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const MIN_PASSWORD_LENGTH = 6;

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams?.get('token') ?? '';

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Enlace inválido o expirado. Solicita uno nuevo desde Recuperar contraseña.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data?.success) {
                router.push('/login?reset=success');
                return;
            }
            setError(data?.error || 'Enlace inválido o expirado. Solicita uno nuevo desde Recuperar contraseña.');
        } catch {
            setError('No se pudo restablecer la contraseña. Intenta de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex flex-col bg-[#fafafa]">
                <header className="w-full h-[5rem] min-h-[5rem] bg-[#0f0f0f] flex items-center justify-center px-2 overflow-visible">
                    <Link href="/" className="flex items-center" aria-label="IPMach">
                        <Image
                            src="/ipmach-logo-header.png"
                            alt="IPMach by Proshel Corp"
                            width={560}
                            height={160}
                            className="h-[11.7rem] sm:h-[13.2rem] md:h-[14.82rem] lg:h-[18rem] w-auto opacity-95"
                            priority
                        />
                    </Link>
                </header>
                <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
                    <div className="w-full max-w-md">
                        <div className="bg-white rounded-xl shadow-lg border border-ipmach-dark/10 overflow-hidden px-8 py-8">
                            <p className="text-sm text-amber-800 rounded-lg bg-amber-50 border border-amber-200 p-4">
                                Enlace inválido o expirado. Solicita uno nuevo desde Recuperar contraseña.
                            </p>
                            <Link
                                href="/forgot-password"
                                className="mt-4 block w-full text-center py-2.5 rounded-lg text-sm font-medium text-ipmach-dark bg-ipmach-yellow hover:bg-ipmach-yellow-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ipmach-yellow transition-colors"
                            >
                                Solicitar nuevo enlace
                            </Link>
                            <Link
                                href="/login"
                                className="mt-3 block w-full text-center py-2.5 text-sm font-medium text-ipmach-dark/80 hover:text-ipmach-dark"
                            >
                                Volver al inicio de sesión
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#fafafa]">
            <header className="w-full h-[5rem] min-h-[5rem] bg-[#0f0f0f] flex items-center justify-center px-2 overflow-visible">
                <Link href="/" className="flex items-center" aria-label="IPMach">
                    <Image
                        src="/ipmach-logo-header.png"
                        alt="IPMach by Proshel Corp"
                        width={560}
                        height={160}
                        className="h-[11.7rem] sm:h-[13.2rem] md:h-[14.82rem] lg:h-[18rem] w-auto opacity-95"
                        priority
                    />
                </Link>
            </header>

            <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-xl shadow-lg border border-ipmach-dark/10 overflow-hidden">
                        <div className="px-8 pt-8 pb-2">
                            <h1 className="text-xl font-bold text-ipmach-dark">
                                Nueva contraseña
                            </h1>
                            <p className="mt-1 text-sm text-ipmach-gray-light">
                                Elige una contraseña de al menos 6 caracteres.
                            </p>
                        </div>
                        <form className="px-8 pb-8 space-y-5" onSubmit={handleSubmit}>
                            {error && (
                                <p className="text-sm text-amber-800 rounded-lg bg-amber-50 border border-amber-200 p-3">
                                    {error}
                                </p>
                            )}
                            <div className="space-y-1">
                                <label htmlFor="newPassword" className="block text-sm font-medium text-ipmach-dark">
                                    Nueva contraseña
                                </label>
                                <input
                                    id="newPassword"
                                    name="newPassword"
                                    type="password"
                                    required
                                    minLength={MIN_PASSWORD_LENGTH}
                                    autoComplete="new-password"
                                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-ipmach-dark placeholder-gray-400 shadow-sm focus:border-ipmach-yellow focus:ring-1 focus:ring-ipmach-yellow sm:text-sm"
                                    placeholder="Mínimo 6 caracteres"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-ipmach-dark">
                                    Confirmar contraseña
                                </label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    minLength={MIN_PASSWORD_LENGTH}
                                    autoComplete="new-password"
                                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-ipmach-dark placeholder-gray-400 shadow-sm focus:border-ipmach-yellow focus:ring-1 focus:ring-ipmach-yellow sm:text-sm"
                                    placeholder="Repite la contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center py-3 px-4 rounded-lg text-sm font-semibold text-ipmach-dark bg-ipmach-yellow hover:bg-ipmach-yellow-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ipmach-yellow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? (
                                    <div className="h-5 w-5 rounded-full border-2 border-ipmach-dark/30 border-t-ipmach-dark animate-spin" />
                                ) : (
                                    'Restablecer contraseña'
                                )}
                            </button>
                            <Link
                                href="/login"
                                className="block w-full text-center py-2.5 text-sm font-medium text-ipmach-dark/80 hover:text-ipmach-dark"
                            >
                                Volver al inicio de sesión
                            </Link>
                        </form>
                    </div>
                    <p className="mt-6 text-center text-xs text-ipmach-gray-light">
                        Repuestos para maquinaria pesada · CAT, Komatsu, John Deere
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col bg-[#fafafa] items-center justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-ipmach-dark/30 border-t-ipmach-dark animate-spin" />
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
