'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 2000;

export default function IPMachRegisterPage() {
  const searchParams = useSearchParams();
  const referenceFromQuery = searchParams?.get('reference')?.trim() ?? '';

  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setReference(referenceFromQuery);
  }, [referenceFromQuery]);

  const validate = useCallback((): string | null => {
    const ref = reference.trim();
    const n = name.trim();
    const e = email.trim();
    if (!ref) return 'La referencia es obligatoria.';
    if (ref.length > 50) return 'Referencia demasiado larga.';
    if (!n) return 'El nombre es obligatorio.';
    if (n.length > MAX_NAME) return `Nombre máximo ${MAX_NAME} caracteres.`;
    if (!e) return 'El email es obligatorio.';
    if (!EMAIL_REGEX.test(e)) return 'Email no válido.';
    if (e.length > MAX_EMAIL) return 'Email demasiado largo.';
    if (message.length > MAX_MESSAGE) return `Mensaje máximo ${MAX_MESSAGE} caracteres.`;
    return null;
  }, [reference, name, email, message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setSubmitError(err);
      setSubmitResult('error');
      return;
    }
    setSubmitError(null);
    setSubmitResult(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/ipmach/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.trim(),
          name: name.trim(),
          email: email.trim(),
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Error al enviar');
        setSubmitResult('error');
        return;
      }
      setSubmitResult('success');
    } catch {
      setSubmitError('No se pudo conectar. Intenta de nuevo.');
      setSubmitResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="bg-[#0B1120]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <Link
            href="/ipmach"
            className="text-slate-300 hover:text-ipmach-yellow text-sm font-semibold transition-colors"
          >
            ← Volver al buscador IPMach
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-ipmach-dark mb-2">
          Registrar solicitud
        </h1>
        <p className="text-ipmach-gray-light text-sm mb-8">
          Completa el formulario. Te contactaremos por email.
        </p>

        {submitResult === 'success' && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
            Recibimos tu solicitud. Te contactaremos a la brevedad.
          </div>
        )}

        {submitResult === 'error' && submitError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-ipmach-dark mb-1.5">
              Referencia (part number)
            </label>
            <input
              id="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={50}
              placeholder="Ej: 1R-0750"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-ipmach-dark placeholder:text-slate-400 focus:border-ipmach-yellow focus:ring-2 focus:ring-ipmach-yellow/20 outline-none"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-ipmach-dark mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME}
              required
              placeholder="Tu nombre completo"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-ipmach-dark placeholder:text-slate-400 focus:border-ipmach-yellow focus:ring-2 focus:ring-ipmach-yellow/20 outline-none"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ipmach-dark mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={MAX_EMAIL}
              required
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-ipmach-dark placeholder:text-slate-400 focus:border-ipmach-yellow focus:ring-2 focus:ring-ipmach-yellow/20 outline-none"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-ipmach-dark mb-1.5">
              Mensaje o comentario (opcional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_MESSAGE}
              rows={4}
              placeholder="Cantidad, plazo, etc."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-ipmach-dark placeholder:text-slate-400 focus:border-ipmach-yellow focus:ring-2 focus:ring-ipmach-yellow/20 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-ipmach-yellow text-ipmach-dark font-bold hover:bg-ipmach-yellow-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      </main>
    </div>
  );
}
