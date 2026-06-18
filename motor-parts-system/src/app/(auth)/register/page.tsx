'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const MARKETING_OPTIONS = [
    { value: 'redes_sociales', label: 'Redes sociales' },
    { value: 'referido', label: 'Referido' },
    { value: 'busqueda_web', label: 'Búsqueda web' },
    { value: 'ferias', label: 'Ferias' },
    { value: 'otro', label: 'Otro' },
];

const COMMON_COUNTRY_CODES = ['+57', '+1', '+52', '+51', '+58', '+593', '+54', '+56', '+598', '+595', '+55', '+34', '+39', '+33', '+49', '+44'];

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState({
        isCompany: false,
        email: '',
        password: '',
        clientName: '',
        identification: '',
        phoneCountryCode: '+57',
        phoneNumber: '',
        country: '',
        stateOrDepartment: '',
        city: '',
        address: '',
        marketingSource: '',
        surveyCatPct: '' as string | number,
        surveyKomatsuPct: '' as string | number,
        surveyJohnDeerePct: '' as string | number,
    });

    const inputClass = 'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-ipmach-dark placeholder-gray-400 shadow-sm focus:border-ipmach-yellow focus:ring-1 focus:ring-ipmach-yellow sm:text-sm';
    const labelClass = 'block text-sm font-medium text-ipmach-dark';

    const handleStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.email.trim() || !form.password) {
            toast.error('Correo y contraseña son obligatorios');
            return;
        }
        if (form.password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        setStep(2);
    };

    const handleStep2 = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clientName.trim()) {
            toast.error('El nombre es obligatorio');
            return;
        }
        if (form.isCompany && !form.identification.trim()) {
            toast.error('La identificación fiscal (NIT) es obligatoria para empresas');
            return;
        }
        setStep(3);
    };

    const handleStep3 = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const payload = {
                email: form.email.trim().toLowerCase(),
                password: form.password,
                isCompany: form.isCompany,
                clientName: form.clientName.trim(),
                identification: form.identification.trim() || undefined,
                phoneCountryCode: form.phoneCountryCode || undefined,
                phoneNumber: form.phoneNumber.trim() || undefined,
                country: form.country.trim() || undefined,
                stateOrDepartment: form.stateOrDepartment.trim() || undefined,
                city: form.city.trim() || undefined,
                address: form.address.trim() || undefined,
                marketingSource: form.marketingSource || undefined,
                surveyCatPct: form.surveyCatPct === '' ? undefined : Number(form.surveyCatPct),
                surveyKomatsuPct: form.surveyKomatsuPct === '' ? undefined : Number(form.surveyKomatsuPct),
                surveyJohnDeerePct: form.surveyJohnDeerePct === '' ? undefined : Number(form.surveyJohnDeerePct),
            };
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.success) {
                toast.success('Cuenta creada. Ya puedes iniciar sesión.');
                router.push('/login');
                return;
            }
            toast.error(data?.error || 'No se pudo crear la cuenta');
        } catch {
            toast.error('Error de conexión');
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
                                Registro de cliente
                            </h1>
                            <p className="mt-1 text-sm text-ipmach-gray-light">
                                Paso {step} de 3
                            </p>
                        </div>

                        {step === 1 && (
                            <form className="px-8 pb-8 space-y-5" onSubmit={handleStep1}>
                                <div>
                                    <span className={labelClass}>¿Eres empresa o persona natural?</span>
                                    <div className="mt-2 flex gap-4">
                                        <label className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                name="isCompany"
                                                checked={!form.isCompany}
                                                onChange={() => setForm({ ...form, isCompany: false })}
                                                className="rounded-full border-gray-300 text-ipmach-yellow focus:ring-ipmach-yellow"
                                            />
                                            <span className="ml-2 text-sm text-ipmach-dark">Persona natural</span>
                                        </label>
                                        <label className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                name="isCompany"
                                                checked={form.isCompany}
                                                onChange={() => setForm({ ...form, isCompany: true })}
                                                className="rounded-full border-gray-300 text-ipmach-yellow focus:ring-ipmach-yellow"
                                            />
                                            <span className="ml-2 text-sm text-ipmach-dark">Empresa</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="email" className={labelClass}>Correo electrónico</label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        className={inputClass}
                                        placeholder="correo@ejemplo.com"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="password" className={labelClass}>Contraseña</label>
                                    <div className="relative">
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            autoComplete="new-password"
                                            className={`${inputClass} pr-10`}
                                            placeholder="Mínimo 6 caracteres"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-ipmach-dark"
                                            onClick={() => setShowPassword(!showPassword)}
                                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        >
                                            {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-ipmach-dark bg-ipmach-yellow hover:bg-ipmach-yellow-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ipmach-yellow transition-colors"
                                >
                                    Siguiente
                                </button>
                            </form>
                        )}

                        {step === 2 && (
                            <form className="px-8 pb-8 space-y-4" onSubmit={handleStep2}>
                                <div className="space-y-1">
                                    <label htmlFor="clientName" className={labelClass}>
                                        {form.isCompany ? 'Nombre de la empresa' : 'Nombre completo'}
                                    </label>
                                    <input
                                        id="clientName"
                                        type="text"
                                        required
                                        className={inputClass}
                                        placeholder={form.isCompany ? 'Nombre de la empresa' : 'Nombre completo'}
                                        value={form.clientName}
                                        onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="identification" className={labelClass}>
                                        Identificación fiscal (NIT / cédula) {form.isCompany && '*'}
                                    </label>
                                    <input
                                        id="identification"
                                        type="text"
                                        required={form.isCompany}
                                        className={inputClass}
                                        placeholder={form.isCompany ? 'NIT obligatorio' : 'Opcional'}
                                        value={form.identification}
                                        onChange={(e) => setForm({ ...form, identification: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label htmlFor="phoneCountryCode" className={labelClass}>Código país</label>
                                        <select
                                            id="phoneCountryCode"
                                            className={inputClass}
                                            value={form.phoneCountryCode}
                                            onChange={(e) => setForm({ ...form, phoneCountryCode: e.target.value })}
                                        >
                                            {COMMON_COUNTRY_CODES.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label htmlFor="phoneNumber" className={labelClass}>Teléfono</label>
                                        <input
                                            id="phoneNumber"
                                            type="tel"
                                            className={inputClass}
                                            placeholder="300 123 4567"
                                            value={form.phoneNumber}
                                            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="country" className={labelClass}>País</label>
                                    <input id="country" type="text" className={inputClass} placeholder="Colombia" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="stateOrDepartment" className={labelClass}>Estado / Departamento</label>
                                    <input id="stateOrDepartment" type="text" className={inputClass} placeholder="Cundinamarca" value={form.stateOrDepartment} onChange={(e) => setForm({ ...form, stateOrDepartment: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="city" className={labelClass}>Ciudad</label>
                                    <input id="city" type="text" className={inputClass} placeholder="Bogotá" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label htmlFor="address" className={labelClass}>Dirección</label>
                                    <input id="address" type="text" className={inputClass} placeholder="Calle 123 #45-67" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ipmach-dark border border-gray-300 hover:bg-gray-50"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-ipmach-dark bg-ipmach-yellow hover:bg-ipmach-yellow-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ipmach-yellow"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 3 && (
                            <form className="px-8 pb-8 space-y-4" onSubmit={handleStep3}>
                                <div className="space-y-1">
                                    <label htmlFor="marketingSource" className={labelClass}>¿Cómo se enteró de nosotros?</label>
                                    <select
                                        id="marketingSource"
                                        className={inputClass}
                                        value={form.marketingSource}
                                        onChange={(e) => setForm({ ...form, marketingSource: e.target.value })}
                                    >
                                        <option value="">Seleccione...</option>
                                        {MARKETING_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-sm text-ipmach-dark font-medium">Por favor ingrese el % de máquinas con las que tiene relación en su mercado (0-100 por marca)</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label htmlFor="surveyCatPct" className={labelClass}>CAT %</label>
                                        <input
                                            id="surveyCatPct"
                                            type="number"
                                            min={0}
                                            max={100}
                                            className={inputClass}
                                            placeholder="0"
                                            value={form.surveyCatPct}
                                            onChange={(e) => setForm({ ...form, surveyCatPct: e.target.value === '' ? '' : e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="surveyKomatsuPct" className={labelClass}>Komatsu %</label>
                                        <input
                                            id="surveyKomatsuPct"
                                            type="number"
                                            min={0}
                                            max={100}
                                            className={inputClass}
                                            placeholder="0"
                                            value={form.surveyKomatsuPct}
                                            onChange={(e) => setForm({ ...form, surveyKomatsuPct: e.target.value === '' ? '' : e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="surveyJohnDeerePct" className={labelClass}>John Deere %</label>
                                        <input
                                            id="surveyJohnDeerePct"
                                            type="number"
                                            min={0}
                                            max={100}
                                            className={inputClass}
                                            placeholder="0"
                                            value={form.surveyJohnDeerePct}
                                            onChange={(e) => setForm({ ...form, surveyJohnDeerePct: e.target.value === '' ? '' : e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-medium text-ipmach-dark border border-gray-300 hover:bg-gray-50"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-ipmach-dark bg-ipmach-yellow hover:bg-ipmach-yellow-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ipmach-yellow disabled:opacity-50"
                                    >
                                        {isLoading ? 'Creando cuenta...' : 'Registrarme'}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="px-8 pb-6">
                            <Link href="/login" className="block text-center text-sm text-ipmach-dark/80 hover:text-ipmach-dark">
                                Ya tengo cuenta · Iniciar sesión
                            </Link>
                        </div>
                    </div>
                    <p className="mt-6 text-center text-xs text-ipmach-gray-light">
                        Repuestos para maquinaria pesada · CAT, Komatsu, John Deere
                    </p>
                </div>
            </div>
        </div>
    );
}
