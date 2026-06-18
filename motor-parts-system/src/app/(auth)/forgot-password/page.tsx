'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const SUCCESS_MESSAGE =
    'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña en unos minutos.';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setSubmitted(false);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            setSubmitted(true);
            if (data?.message) {
                setEmail('');
            }
        } catch {
            setSubmitted(true);
        } finally {
            setIsLoading(false);
        }
    };

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
                                Recuperar contraseña
                            </h1>
                            <p className="mt-1 text-sm text-ipmach-gray-light">
                                Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
                            </p>
                        </div>
                        {submitted ? (
                            <div className="px-8 pb-8 space-y-5">
                                <p className="text-sm text-ipmach-dark rounded-lg bg-green-50 border border-green-200 p-4">
                                    {SUCCESS_MESSAGE}
                                </p>
                                <Link
                                    href="/login"
                                    className="block w-full text-center py-2.5 rounded-lg text-sm font-medium text-ipmach-dark bg-ipmach-yellow hover:bg-ipmach-yellow-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ipmach-yellow transition-colors"
                                >
                                    Volver al inicio de sesión
                                </Link>
                            </div>
                        ) : (
                            <form className="px-8 pb-8 space-y-5" onSubmit={handleSubmit}>
                                <div className="space-y-1">
                                    <label htmlFor="email" className="block text-sm font-medium text-ipmach-dark">
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-ipmach-dark placeholder-gray-400 shadow-sm focus:border-ipmach-yellow focus:ring-1 focus:ring-ipmach-yellow sm:text-sm"
                                        placeholder="tu@correo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
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
                                        'Enviar enlace'
                                    )}
                                </button>
                                <Link
                                    href="/login"
                                    className="block w-full text-center py-2.5 rounded-lg text-sm font-medium text-ipmach-dark/80 hover:text-ipmach-dark border border-gray-200 hover:border-gray-300 transition-colors"
                                >
                                    Volver al inicio de sesión
                                </Link>
                            </form>
                        )}
                    </div>
                    <p className="mt-6 text-center text-xs text-ipmach-gray-light">
                        Repuestos para maquinaria pesada · CAT, Komatsu, John Deere
                    </p>
                </div>
            </div>
        </div>
    );
}
