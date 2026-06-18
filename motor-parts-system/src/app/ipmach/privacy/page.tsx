import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Privacidad — IPMach',
  description: 'Política de privacidad de IPMach.',
};

export default function IPMachPrivacyPage() {
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
        <h1 className="text-3xl font-bold text-ipmach-dark mb-6">Política de privacidad</h1>
        <p className="text-ipmach-gray-light leading-relaxed mb-6">
          Cómo tratamos tus datos. Información sobre consultas, cotizaciones y uso del asistente IA.
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
