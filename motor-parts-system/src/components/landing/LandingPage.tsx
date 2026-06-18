'use client';

import { useState } from 'react';
import Image from 'next/image';

import {
  Globe2,
  Settings2,
  Truck,
  Bot,
  TrendingUp,
  Zap
} from 'lucide-react';

const IMG_IPMACH =
  'https://static.wixstatic.com/media/98128d_04a160d6a917400aa707c62c17e4c346~mv2.png/v1/crop/x_39,y_188,w_436,h_123/fill/w_176,h_49,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/4.png';
const IMG_LOGISTIC =
  'https://static.wixstatic.com/media/98128d_cc5476a1e46d44ffb778ac8f6c576810~mv2.png/v1/crop/x_30,y_191,w_406,h_127/fill/w_176,h_55,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/5.png';
const IMG_TECH =
  'https://static.wixstatic.com/media/98128d_712c7cf386734582a5c439acce183e68~mv2.png/v1/crop/x_38,y_187,w_400,h_118/fill/w_176,h_49,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/3.png';

const SERVICIOS = [
  {
    title: 'Expansión internacional',
    text: 'Te ayudamos a llevar tu negocio a nuevos países, cumpliendo con todos los requisitos legales y operativos para vender en Estados Unidos y Latinoamérica.',
    icon: Globe2,
  },
  {
    title: 'B2B Parts (IPMach)',
    text: 'Repuestos homologados para Caterpillar, Komatsu y John Deere, con soporte técnico, cotizaciones ágiles y envío internacional confiable.',
    link: '#lineas',
    icon: Settings2,
  },
  {
    title: 'Fulfillment (Pro-Logistic)',
    text: 'Almacenamiento, empaque y envío de tus productos, entregas rápidas, seguimiento y gestión de devoluciones.',
    icon: Truck,
  },
  {
    title: 'IA & Automatización (Pro-Tech)',
    text: 'Bots y sistemas automáticos que ahorran tiempo, integrando WhatsApp, ERP y CRM para optimizar tu negocio.',
    icon: Bot,
  },
  {
    title: 'Go-to-Market E-commerce',
    text: 'Estrategias para que tu marca venda más: SEO, anuncios, marketplaces y mejora de tiendas en línea.',
    icon: TrendingUp,
  },
  {
    title: 'Proyectos a medida',
    text: 'Soluciones a la medida de tu empresa, adaptadas a su etapa y necesidades tecnológicas.',
    icon: Zap,
  },
];

const STATS = [
  { value: '500+', label: 'Empresas confiando en nosotros' },
  { value: '98%', label: 'Tasa de satisfacción' },
  { value: '24/7', label: 'Soporte disponible' },
  { value: '15+', label: 'Años de experiencia' },
];

export function LandingPage() {
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    console.log(Object.fromEntries(data));
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 5000);
  };

  return (
    <>
      <section className="relative bg-[#0B1120] text-white overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '48px 48px'
        }} />

        {/* Glow effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-proshel-accent/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-32 lg:py-40">
          <div className="max-w-4xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-fade-in-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-proshel-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-proshel-accent"></span>
              </span>
              <span className="text-white/80 font-bold text-[10px] uppercase tracking-[0.2em]">
                Corporate Holding · Miami, FL
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] mb-8 animate-fade-in-up tracking-tight">
              Diseño integral para <br />
              <span className="text-proshel-accent italic">acelerar</span> tu negocio
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed mb-12 animate-fade-in-up font-medium">
              Repuestos B2B, fulfillment y tecnología. En Proshel, transformamos
              operaciones complejas en sistemas rentables y escalables.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-5 mb-16 animate-fade-in-up">
              <a
                href="#lineas"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-proshel-accent text-[#0B1120] font-bold text-lg shadow-xl shadow-proshel-accent/20 hover:shadow-2xl hover:bg-proshel-accent-light hover:-translate-y-1 transition-all duration-300"
              >
                Ver soluciones
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#contacto"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                Hablar con un asesor
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-x-12 gap-y-6 pt-10 border-t border-white/5 animate-fade-in-up">
              {STATS.slice(0, 3).map((stat, index) => (
                <div key={index}>
                  <div className="text-3xl font-extrabold text-white mb-0.5 tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Líneas de negocio - Mejorado */}
      <section
        id="lineas"
        className="py-24 md:py-32 bg-slate-50"
        aria-labelledby="lineas-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div className="max-w-2xl">
              <h2
                id="lineas-heading"
                className="font-display text-4xl md:text-6xl font-extrabold text-[#0B1120] mb-4 tracking-tight"
              >
                Nuestras <br />
                <span className="text-proshel-accent">Líneas de Impacto</span>
              </h2>
              <p className="text-lg text-slate-500 font-medium">
                Sistemas operativos diseñados para la escalabilidad.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                img: IMG_IPMACH,
                title: 'B2B Heavy Parts',
                description: 'Gestión inteligente de repuestos para maquinaria pesada. Stock real y logística global.',
                link: '/ipmach',
                linkText: 'Ver IPMach',
                badge: '01',
              },
              {
                img: IMG_LOGISTIC,
                title: 'Global Fulfillment',
                description: 'Almacenamiento y distribución desde Miami para el mundo. Full trazabilidad.',
                link: '#contacto',
                linkText: 'Consultar',
                badge: '02',
              },
              {
                img: IMG_TECH,
                title: 'Tech & AI Ops',
                description: 'Implementación de agentes de IA y automatización de flujos comerciales.',
                link: '#contacto',
                linkText: 'Conocer más',
                badge: '03',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="group bg-white rounded-3xl p-8 shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100"
              >
                <div className="mb-10 flex items-center justify-between">
                  <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-proshel-accent/5 transition-colors">
                    <Image
                      src={item.img}
                      alt={item.title}
                      width={160}
                      height={50}
                      className="h-10 w-auto object-contain grayscale group-hover:grayscale-0 transition-all duration-500"
                    />
                  </div>
                  <span className="text-4xl font-black text-slate-100 group-hover:text-proshel-accent/10 transition-colors">0{item.badge}</span>
                </div>

                <h3 className="text-2xl font-bold text-[#0B1120] mb-4 group-hover:text-proshel-accent transition-colors">
                  {item.title}
                </h3>

                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                  {item.description}
                </p>

                <a
                  href={item.link}
                  className="inline-flex items-center gap-2 text-proshel-accent font-bold hover:gap-3 transition-all"
                >
                  {item.linkText}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Servicios clave - Mejorado con iconos SVG */}
      <section
        id="servicios"
        className="py-20 md:py-32 bg-white relative overflow-hidden"
        aria-labelledby="servicios-heading"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-proshel-accent/5 blur-[120px] rounded-full" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2
              id="servicios-heading"
              className="font-display text-4xl md:text-5xl font-bold text-proshel-navy mb-4"
            >
              Servicios clave
            </h2>
            <p className="text-xl text-proshel-muted">
              Experiencia, tecnología y estrategia para potenciar tu negocio.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICIOS.map((servicio, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-proshel-light/30 hover:border-proshel-accent/40 hover:shadow-xl transition-all duration-300"
              >
                {/* Icon background */}
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-proshel-accent group-hover:text-white transition-all duration-500 shadow-sm">
                  <servicio.icon className="w-7 h-7 text-proshel-accent group-hover:text-white transition-colors duration-500" />
                </div>

                <h3 className="text-xl font-bold text-proshel-navy mb-3 group-hover:text-proshel-accent transition-colors">
                  {servicio.title}
                </h3>

                <p className="text-sm text-proshel-muted leading-relaxed mb-4">
                  {servicio.text}
                </p>

                {servicio.link && (
                  <a
                    href={servicio.link}
                    className="inline-flex items-center gap-1 text-proshel-accent font-medium text-sm group-hover/link:gap-2 transition-all"
                  >
                    Explorar
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quiénes somos - Mejorado */}
      <section
        id="nosotros"
        className="relative py-20 md:py-32 bg-gradient-to-br from-proshel-navy via-proshel-slate to-proshel-navy text-white overflow-hidden"
        aria-labelledby="nosotros-heading"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2
                id="nosotros-heading"
                className="font-display text-4xl md:text-5xl font-bold mb-6"
              >
                Quiénes somos
              </h2>

              <p className="text-xl text-white/90 leading-relaxed mb-8">
                Somos una holding operativa con base en Miami. Combinamos gestión
                gerencial, logística y tecnología para impulsar empresas con rigor
                financiero y ejecución pragmática. Nuestro enfoque: velocidad,
                trazabilidad y resultados medibles.
              </p>

              <div className="space-y-4 mb-10">
                {[
                  { icon: '✓', text: 'Gobernanza y procesos claros' },
                  { icon: '✓', text: 'Integración tecnológica real (no promesas)' },
                  { icon: '✓', text: 'Modelo multi-negocio con sinergias operativas' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-proshel-accent/20 flex items-center justify-center">
                      <span className="text-proshel-accent font-bold">{item.icon}</span>
                    </div>
                    <span className="text-lg text-white/90">{item.text}</span>
                  </div>
                ))}
              </div>

              <a
                href="#contacto"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-proshel-accent to-warning-500 text-proshel-navy font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                ¿Listo para empezar? Habla con nosotros
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>

            {/* Visual element — Integrated Image */}
            <div className="hidden lg:block relative">
              <div className="absolute inset-x-0 -inset-y-16 bg-gradient-to-br from-proshel-accent/10 to-transparent blur-3xl opacity-50" />
              <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl">
                <Image
                  src="/proshel-miami.png"
                  alt="Proshel Corporate Miami"
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-transparent to-transparent opacity-60" />

                {/* Floating badge over image */}
                <div className="absolute bottom-10 left-10 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl max-w-[240px]">
                  <div className="text-proshel-accent text-3xl font-extrabold mb-1 tracking-tight">MIAMI</div>
                  <div className="text-white/80 text-xs font-bold uppercase tracking-widest">Sede Principal · Florida, USA</div>
                </div>
              </div>

              {/* Animated accent circle */}
              <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-proshel-accent/20 blur-2xl animate-pulse-slow" />
            </div>
          </div>
        </div>
      </section>

      {/* Contacto + formulario - Mejorado */}
      <section
        id="contacto"
        className="py-20 md:py-32 bg-gradient-to-b from-proshel-light to-white"
        aria-labelledby="contacto-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2
              id="contacto-heading"
              className="font-display text-4xl md:text-5xl font-bold text-proshel-navy mb-4"
            >
              Contacto
            </h2>
            <p className="text-xl text-proshel-muted">
              Cuéntanos tu objetivo y armamos un plan concreto con hitos, costos y
              métricas.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-12 max-w-6xl mx-auto">
            {/* Contact info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-proshel-navy mb-2">
                  Proshel Corp
                </h3>
                <p className="text-proshel-muted">7778 NW 64 Street</p>
                <p className="text-proshel-muted">Miami, Florida 33166</p>
              </div>

              <div className="space-y-4">
                <a
                  href="tel:+13057803165"
                  className="flex items-center gap-3 text-proshel-navy hover:text-proshel-accent transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-proshel-accent/10 flex items-center justify-center group-hover:bg-proshel-accent/20 transition-colors">
                    <svg className="w-6 h-6 text-proshel-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-proshel-muted">Teléfono</div>
                    <div className="font-semibold">+1 305 780 3165</div>
                  </div>
                </a>

                <a
                  href="mailto:Proshel@proshelcorp.com"
                  className="flex items-center gap-3 text-proshel-navy hover:text-proshel-accent transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-proshel-accent/10 flex items-center justify-center group-hover:bg-proshel-accent/20 transition-colors">
                    <svg className="w-6 h-6 text-proshel-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-proshel-muted">Email</div>
                    <div className="font-semibold">Proshel@proshelcorp.com</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              <form
                className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl"
                onSubmit={handleContactSubmit}
              >
                {formSubmitted ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-proshel-navy mb-2">
                      ¡Mensaje enviado!
                    </h3>
                    <p className="text-proshel-muted">
                      Nos pondremos en contacto contigo pronto.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div>
                        <label
                          htmlFor="contact-nombre"
                          className="block text-sm font-semibold text-proshel-navy mb-2"
                        >
                          Nombre *
                        </label>
                        <input
                          id="contact-nombre"
                          type="text"
                          name="nombre"
                          required
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-proshel-accent focus:ring-2 focus:ring-proshel-accent/20 outline-none transition-all"
                          placeholder="Tu nombre"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-sm font-semibold text-proshel-navy mb-2"
                        >
                          Email *
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          name="email"
                          required
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-proshel-accent focus:ring-2 focus:ring-proshel-accent/20 outline-none transition-all"
                          placeholder="tu@email.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-empresa"
                        className="block text-sm font-semibold text-proshel-navy mb-2"
                      >
                        Empresa
                      </label>
                      <input
                        id="contact-empresa"
                        type="text"
                        name="empresa"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-proshel-accent focus:ring-2 focus:ring-proshel-accent/20 outline-none transition-all"
                        placeholder="Nombre de la empresa"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contact-linea"
                        className="block text-sm font-semibold text-proshel-navy mb-2"
                      >
                        Línea de interés
                      </label>
                      <select
                        id="contact-linea"
                        name="linea"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-proshel-accent focus:ring-2 focus:ring-proshel-accent/20 outline-none transition-all"
                      >
                        <option value="">Selecciona una opción</option>
                        <option value="ipmach">IPMach — Repuestos</option>
                        <option value="pro-logistic">
                          Pro-Logistic — Fulfillment
                        </option>
                        <option value="pro-tech">Pro-Tech — IA</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-mensaje"
                        className="block text-sm font-semibold text-proshel-navy mb-2"
                      >
                        Mensaje
                      </label>
                      <textarea
                        id="contact-mensaje"
                        name="mensaje"
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-proshel-accent focus:ring-2 focus:ring-proshel-accent/20 outline-none resize-none transition-all"
                        placeholder="Tu objetivo o consulta..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-proshel-accent to-warning-500 text-proshel-navy font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                    >
                      Enviar mensaje
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
