import Link from 'next/link';
import Image from 'next/image';
import { IPMachHeader } from '@/components/ipmach/IPMachHeader';
import { IPMachSearchBar } from '@/components/ipmach/IPMachSearchBar';
import { AIAssistantWidget } from '@/components/ipmach/AIAssistantWidget';
import { BrandLogo } from '@/components/ipmach/BrandLogo';
import { IPMachFooter } from '@/components/ipmach/IPMachFooter';
import { ScrollToTopButton, OpenAIWidgetButton } from '@/components/ipmach/IPMachClientActions';

export const dynamic = 'force-dynamic';

const BRANDS: Array<'CATERPILLAR' | 'KOMATSU' | 'JOHN DEERE' | 'CTP'> = [
  'CATERPILLAR',
  'KOMATSU',
  'JOHN DEERE',
  'CTP',
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Ingresa el part number',
    description:
      'Escribe el número de parte en el buscador. Consultamos nuestro inventario en tiempo real.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    step: '2',
    title: 'Resultado al instante',
    description:
      'Recibes disponibilidad, cantidad y precio en segundos. Cotización clara y sin esperas.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    step: '3',
    title: 'Cotización y pedido',
    description:
      'Solicita tu cotización formal. Gestionamos tu pedido; la entrega se realiza en nuestra bodega en Miami.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const TRUST_ITEMS = [
  {
    title: 'Inventario en tiempo real',
    description: 'Consulta disponibilidad, cantidad y precio al instante. Sin esperas.',
  },
  {
    title: 'Precio claro',
    description: 'Cotización al instante. Transparencia en cada paso.',
  },
  {
    title: 'Repuestos homologados',
    description: 'CAT, Komatsu, John Deere. Piezas certificadas y compatibles.',
  },
  {
    title: '¿Necesitas ayuda?',
    description: 'Consulta en el asistente información sobre una referencia (qué es, para qué máquinas sirve). También horarios y datos administrativos.',
  },
];

export default function IPMachPage() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <IPMachHeader />


      {/* Hero — search-first e-commerce */}
      <section
        id="search"
        className="relative min-h-[85vh] flex flex-col justify-center pt-24 sm:pt-28 pb-20 px-4 sm:px-6 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[#0B1120]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 50% -20%, #F5A623 0%, transparent 70%)',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        <div className="relative max-w-5xl mx-auto w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ipmach-yellow/10 border border-ipmach-yellow/20 text-ipmach-yellow text-xs font-bold uppercase tracking-widest mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ipmach-yellow opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-ipmach-yellow"></span>
            </span>
            Inventario en tiempo real
          </div>
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
            Repuestos para maquinaria <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ipmach-yellow to-ipmach-yellow-light">
              al instante
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-medium">
            Consulta disponibilidad, cantidad y precio de nuestro inventario en segundos.
            Sin esperas, sin complicaciones.
          </p>

          {/* Search — main CTA */}
          <div className="mb-10 max-w-3xl mx-auto">
            <IPMachSearchBar />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <p className="text-sm text-slate-500 font-medium whitespace-nowrap">¿Dudas sobre una referencia?</p>
            <OpenAIWidgetButton className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/90 text-sm font-semibold transition-all hover:scale-105">
              <svg className="w-5 h-5 text-ipmach-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Consultar con IA
            </OpenAIWidgetButton>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
              PROCESO IPM<span className="text-ipmach-yellow">ACH</span>
            </h2>
            <div className="h-1.5 w-24 bg-ipmach-yellow mx-auto rounded-full mb-6" />
            <p className="text-slate-500 max-w-xl mx-auto text-lg font-medium">
              Tres pasos simples para obtener tus repuestos con eficiencia Total.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {HOW_IT_WORKS.map((item, index) => (
              <div
                key={index}
                className="group relative"
              >
                <div className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 transition-all duration-500 group-hover:bg-white group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] group-hover:-translate-y-2">
                  <div className="flex items-start justify-between mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm text-ipmach-yellow flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                      {item.icon}
                    </div>
                    <span className="text-5xl font-black text-slate-200/50 transition-colors duration-500 group-hover:text-ipmach-yellow/10">0{item.step}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.title}</h3>
                  <p className="text-slate-500 text-base leading-relaxed font-medium">{item.description}</p>
                </div>
                {index < 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-6 transform -translate-y-1/2 z-10">
                    <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Why us */}
      <section className="py-20 md:py-28 bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ipmach-dark mb-3">
              Por qué consultar en IPMach
            </h2>
            <p className="text-ipmach-gray-light max-w-xl mx-auto">
              Información en tiempo real. Transparencia y rapidez.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST_ITEMS.map((item, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="font-bold text-ipmach-dark mb-2">{item.title}</h3>
                <p className="text-sm text-ipmach-gray-light leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marcas */}
      <section id="marcas" className="py-20 md:py-28 bg-[#0f0f0f] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Repuestos homologados
          </h2>
          <p className="text-white/60 mb-12 max-w-xl mx-auto">
            Consulta disponibilidad para las marcas líderes en maquinaria pesada.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 mb-10">
            {BRANDS.map((brand, index) => (
              <BrandLogo key={index} brand={brand} className="border-white/20" />
            ))}
          </div>
          <p className="text-sm text-white/50">+50,000 part numbers disponibles vía proveedor.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-ipmach-dark mb-4">
            ¿Listo para consultar?
          </h2>
          <p className="text-ipmach-gray-light mb-8">
            Ingresa un part number arriba y recibe disponibilidad y precio al instante.
          </p>
          <ScrollToTopButton className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-ipmach-yellow text-ipmach-dark font-bold hover:bg-ipmach-yellow-light transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Ir al buscador
          </ScrollToTopButton>
        </div>
      </section>

      {/* Contact */}
      <section id="contacto" className="py-16 bg-[#f5f5f5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display text-2xl font-bold text-ipmach-dark mb-2">Contacto</h2>
          <p className="text-ipmach-gray-light text-sm mb-6">
            ¿Necesitas ayuda con un pedido o cotización?
          </p>
          <div className="space-y-4 text-left max-w-md mx-auto">
            <p className="text-ipmach-dark text-sm flex items-start gap-3">
              <span className="text-ipmach-gray-light shrink-0" aria-hidden>📍</span>
              <a
                href="https://www.google.com/maps/search/?api=1&query=7778+NW+64+Street+Miami+FL+33166"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ipmach-dark hover:text-ipmach-yellow transition"
              >
                7778 NW 64 Street<br />
                Miami, Florida 33166
              </a>
            </p>
            <p className="text-ipmach-dark text-sm flex items-center gap-3">
              <span className="text-ipmach-gray-light shrink-0" aria-hidden>📞</span>
              <span>Bodega Miami:</span>
              <a href="tel:+13057803165" className="text-ipmach-yellow font-semibold hover:underline">
                +1 305 780 3165
              </a>
            </p>
            <p className="text-ipmach-dark text-sm flex items-center gap-3">
              <span className="text-ipmach-gray-light shrink-0" aria-hidden>💬</span>
              <span>Servicio al cliente (WhatsApp):</span>
              <a
                href="https://wa.me/573008487000"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ipmach-yellow font-semibold hover:underline"
              >
                +57 300 848 7000
              </a>
            </p>
            <p className="text-ipmach-dark text-sm flex items-start gap-3">
              <span className="text-ipmach-gray-light shrink-0" aria-hidden>✉️</span>
              <span className="flex flex-wrap gap-x-2 gap-y-1">
                <a href="mailto:Proshel@proshelcorp.com" className="text-ipmach-yellow font-semibold hover:underline">
                  Proshel@proshelcorp.com
                </a>
                <span className="text-ipmach-gray-light">y</span>
                <a href="mailto:ipmach@ipmach.com" className="text-ipmach-yellow font-semibold hover:underline">
                  ipmach@ipmach.com
                </a>
              </span>
            </p>
          </div>
        </div>
      </section>

      <IPMachFooter />
      <AIAssistantWidget />
    </div>
  );
}
