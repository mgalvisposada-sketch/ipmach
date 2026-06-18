'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const LOGO_PROSHEL =
  'https://static.wixstatic.com/media/98128d_67c070158fb04780a3d8aee6b81b1733~mv2.png/v1/crop/x_0,y_169,w_500,h_168/fill/w_188,h_63,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/2.png';

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-md border-b border-slate-200'
          : 'bg-white/90 backdrop-blur-md border-b border-slate-100'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 group">
            <Image
              src={LOGO_PROSHEL}
              alt="Proshel Corp"
              width={188}
              height={63}
              className="h-9 w-auto hover:opacity-90 transition-opacity duration-300"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <Link
              href="/"
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-proshel-accent rounded-lg hover:bg-slate-50 transition-all duration-200"
            >
              Inicio
            </Link>

            {/* Dropdown Líneas */}
            <div className="relative group">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-proshel-accent rounded-lg hover:bg-slate-50 transition-all duration-200 flex items-center gap-1"
              >
                Líneas
                <svg
                  className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              <div className="absolute top-full left-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 -translate-y-2">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 min-w-[240px] overflow-hidden">
                  <Link
                    href="/ipmach"
                    className="block px-5 py-3 text-sm text-slate-700 hover:bg-proshel-accent/10 hover:text-proshel-accent transition-colors duration-200 border-l-2 border-transparent hover:border-proshel-accent"
                  >
                    <div className="font-semibold">IPMach</div>
                    <div className="text-xs text-slate-500 mt-0.5">Repuestos</div>
                  </Link>
                  <Link
                    href="/#lineas"
                    className="block px-5 py-3 text-sm text-slate-700 hover:bg-proshel-accent/10 hover:text-proshel-accent transition-colors duration-200 border-l-2 border-transparent hover:border-proshel-accent"
                  >
                    <div className="font-semibold">Pro-Logistic</div>
                    <div className="text-xs text-slate-500 mt-0.5">Fulfillment</div>
                  </Link>
                  <Link
                    href="/#lineas"
                    className="block px-5 py-3 text-sm text-slate-700 hover:bg-proshel-accent/10 hover:text-proshel-accent transition-colors duration-200 border-l-2 border-transparent hover:border-proshel-accent"
                  >
                    <div className="font-semibold">Pro-Tech</div>
                    <div className="text-xs text-slate-500 mt-0.5">IA & Tech</div>
                  </Link>
                </div>
              </div>
            </div>

            <Link
              href="/#servicios"
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-proshel-accent rounded-lg hover:bg-slate-50 transition-all duration-200"
            >
              Servicios
            </Link>

            <Link
              href="/#nosotros"
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-proshel-accent rounded-lg hover:bg-slate-50 transition-all duration-200"
            >
              Nosotros
            </Link>

            <Link
              href="/#contacto"
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-proshel-accent rounded-lg hover:bg-slate-50 transition-all duration-200"
            >
              Contacto
            </Link>

            {/* Cotizar Button */}
            <Link
              href="/#contacto"
              className="ml-2 px-6 py-2.5 rounded-xl bg-proshel-accent text-white font-bold text-sm shadow-lg shadow-proshel-accent/20 hover:shadow-xl hover:bg-proshel-accent-light transition-all duration-300"
            >
              Cotizar
            </Link>
          </nav>

          {/* Login Button */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="group relative px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all duration-300 overflow-hidden shadow-lg shadow-slate-900/10"
            >
              <span className="relative z-10 flex items-center gap-2">
                Inicio de sesión
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
