'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams?.get('reset') === 'success') {
            toast.success('Contraseña actualizada. Ya puedes iniciar sesión con la nueva contraseña.');
            router.replace('/login', { scroll: false });
        }
    }, [searchParams, router]);

    const [credentials, setCredentials] = useState({
        username: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                username: credentials.username,
                password: credentials.password,
                redirect: false,
            });

            if (result?.error) {
                toast.error('Usuario o contraseña inválidos');
            } else {
                toast.success('¡Inicio de sesión exitoso!');
                router.push('/dashboard');
            }
        } catch (error) {
            toast.error('Ocurrió un error durante el inicio de sesión');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#fafafa]">
            {/* Black stripe with IPMACH logo - repuestos CAT theme */}
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
                                Sistema de Repuestos
                            </h1>
                            <p className="mt-1 text-sm text-ipmach-gray-light">
                                Inicie sesión en su cuenta
                            </p>
                        </div>
                        <form className="px-8 pb-8 space-y-5" onSubmit={handleSubmit}>
                            <div className="space-y-1">
                                <label htmlFor="username" className="block text-sm font-medium text-ipmach-dark">
                                    Correo electrónico
                                </label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    autoComplete="email"
                                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-ipmach-dark placeholder-gray-400 shadow-sm focus:border-ipmach-yellow focus:ring-1 focus:ring-ipmach-yellow sm:text-sm"
                                    placeholder="correo@ejemplo.com"
                                    value={credentials.username}
                                    onChange={(e) =>
                                        setCredentials({ ...credentials, username: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <label htmlFor="password" className="block text-sm font-medium text-ipmach-dark">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-ipmach-dark placeholder-gray-400 shadow-sm focus:border-ipmach-yellow focus:ring-1 focus:ring-ipmach-yellow sm:text-sm"
                                        placeholder="Contraseña"
                                        value={credentials.password}
                                        onChange={(e) =>
                                            setCredentials({ ...credentials, password: e.target.value })
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-ipmach-dark"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showPassword ? (
                                            <EyeSlashIcon className="h-5 w-5" />
                                        ) : (
                                            <EyeIcon className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Link
                                    href="/forgot-password"
                                    className="text-sm text-ipmach-dark/80 hover:text-ipmach-dark underline"
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center items-center py-3 px-4 rounded-lg text-sm font-semibold text-ipmach-dark bg-ipmach-yellow hover:bg-ipmach-yellow-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ipmach-yellow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? (
                                    <div className="h-5 w-5 rounded-full border-2 border-ipmach-dark/30 border-t-ipmach-dark animate-spin" />
                                ) : (
                                    'Iniciar sesión'
                                )}
                            </button>
                            <p className="text-center text-sm text-ipmach-gray-light">
                                ¿No tienes cuenta?{' '}
                                <Link href="/register" className="font-medium text-ipmach-dark hover:underline">
                                    Registrarse
                                </Link>
                            </p>
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
