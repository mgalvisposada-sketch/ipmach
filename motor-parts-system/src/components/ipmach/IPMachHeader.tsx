'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function IPMachHeader() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B1120]/95 backdrop-blur-md border-b border-white/5 shadow-2xl h-16 sm:h-20 md:h-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full">
                    <div className="flex items-center justify-between h-full relative">
                        <Link href="/ipmach" className="flex items-center gap-3 group relative z-10">
                            <div className="relative h-20 sm:h-28 md:h-32 flex items-center">
                                <Image
                                    src="/ipmach-logo-header.png"
                                    alt="IPMach"
                                    width={420}
                                    height={168}
                                    className="h-full w-auto drop-shadow-2xl brightness-110"
                                />
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-8">
                            <Link
                                href="/ipmach#como-funciona"
                                className="text-xs font-bold text-slate-300 hover:text-ipmach-yellow transition-colors tracking-wide uppercase"
                            >
                                Cómo funciona
                            </Link>
                            <Link
                                href="/ipmach#contacto"
                                className="text-xs font-bold text-slate-300 hover:text-ipmach-yellow transition-colors tracking-wide uppercase"
                            >
                                Contacto
                            </Link>
                            <Link
                                href="/login"
                                className="px-6 py-2 rounded-xl bg-ipmach-yellow text-[#0B1120] font-black text-xs hover:bg-ipmach-yellow-light transition-all shadow-lg shadow-ipmach-yellow/20 uppercase tracking-tighter"
                            >
                                Iniciar sesión
                            </Link>
                        </nav>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center gap-4">
                            <Link
                                href="/login"
                                className="px-4 py-1.5 rounded-lg bg-ipmach-yellow text-[#0B1120] font-black text-[10px] sm:text-xs hover:bg-ipmach-yellow-light transition-all shadow-lg shadow-ipmach-yellow/20 uppercase tracking-tighter"
                            >
                                Entrar
                            </Link>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="p-2 text-slate-300 hover:text-white transition-colors"
                                aria-label="Menu"
                            >
                                {isMenuOpen ? (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Backdrop */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* Mobile Menu Content */}
            <div
                className={`fixed top-0 right-0 bottom-0 w-[280px] bg-white z-[70] md:hidden flex flex-col p-6 shadow-2xl transition-transform duration-300 ease-out border-l border-slate-100 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex justify-end mb-8">
                    <button
                        onClick={() => setIsMenuOpen(false)}
                        className="p-2 text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <nav className="flex flex-col gap-6">
                    <Link
                        href="/ipmach#como-funciona"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-lg font-bold text-slate-700 hover:text-ipmach-yellow transition-colors uppercase tracking-widest"
                    >
                        Cómo funciona
                    </Link>
                    <Link
                        href="/ipmach#contacto"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-lg font-bold text-slate-700 hover:text-ipmach-yellow transition-colors uppercase tracking-widest"
                    >
                        Contacto
                    </Link>
                    <div className="h-px bg-slate-100 my-2" />
                    <Link
                        href="/login"
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full py-4 rounded-xl bg-ipmach-yellow text-[#0B1120] font-black text-center hover:bg-ipmach-yellow-light transition-all shadow-xl shadow-ipmach-yellow/10 uppercase tracking-tighter"
                    >
                        Iniciar sesión
                    </Link>
                </nav>
            </div>
        </>
    );
}
