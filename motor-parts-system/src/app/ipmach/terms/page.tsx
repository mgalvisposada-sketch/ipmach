import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Términos de uso — IPMach',
  description: 'Términos y condiciones de uso del servicio IPMach.',
};

export default function IPMachTermsPage() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="bg-[#0f0f0f] border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Link href="/ipmach" className="inline-block">
            <Image src="/ipmach-logo-header.png" alt="IPMach" width={160} height={48} className="h-12 w-auto" />
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-3xl font-bold text-ipmach-dark mb-6">Términos de uso</h1>
        <p className="text-ipmach-gray-light leading-relaxed mb-6">
          Contenido de términos y condiciones. Consulta disponibilidad y uso del servicio de
          consulta de repuestos en tiempo real.
        </p>
        <Link
          href="/ipmach"
          className="text-ipmach-yellow font-semibold hover:underline"
        >
          ← Volver a IPMach
        </Link>
      </main>
    </div>
  );
}
