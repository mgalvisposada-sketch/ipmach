import Link from 'next/link';
import Image from 'next/image';

const LOGO_PROSHEL =
  'https://static.wixstatic.com/media/98128d_67c070158fb04780a3d8aee6b81b1733~mv2.png/v1/crop/x_0,y_169,w_500,h_168/fill/w_188,h_63,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/2.png';

const QUICK_LINKS = [
  { label: 'Inicio', href: '/' },
  { label: 'Líneas de negocio', href: '/#lineas' },
  { label: 'Servicios', href: '/#servicios' },
  { label: 'Nosotros', href: '/#nosotros' },
  { label: 'Contacto', href: '/#contacto' },
];

const BUSINESS_LINES = [
  { label: 'IPMach — Repuestos', href: '/ipmach' },
  { label: 'Pro-Logistic — Fulfillment', href: '/#lineas' },
  { label: 'Pro-Tech — IA', href: '/#lineas' },
];

export function LandingFooter() {
  return (
    <footer className="relative bg-gradient-to-b from-proshel-navy to-proshel-slate text-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Main footer content */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Company info */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-6 group">
              <Image
                src={LOGO_PROSHEL}
                alt="Proshel Corp"
                width={188}
                height={63}
                className="h-10 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
              />
            </Link>
            <p className="text-white/70 mb-6 max-w-md leading-relaxed">
              Corporate Holding con base en Miami. Combinamos repuestos B2B,
              fulfillment y tecnología para impulsar tu negocio con rigor
              financiero y resultados medibles.
            </p>

            {/* Contact info */}
            <div className="space-y-3">
              <a
                href="tel:+13057803165"
                className="flex items-center gap-3 text-white/80 hover:text-proshel-accent transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-proshel-accent/10 flex items-center justify-center group-hover:bg-proshel-accent/20 transition-colors">
                  <svg
                    className="w-5 h-5 text-proshel-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <span className="font-medium">+1 305 780 3165</span>
              </a>

              <a
                href="mailto:Proshel@proshelcorp.com"
                className="flex items-center gap-3 text-white/80 hover:text-proshel-accent transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-proshel-accent/10 flex items-center justify-center group-hover:bg-proshel-accent/20 transition-colors">
                  <svg
                    className="w-5 h-5 text-proshel-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="font-medium">Proshel@proshelcorp.com</span>
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-bold text-lg mb-6 text-white">Enlaces</h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-proshel-accent transition-colors inline-flex items-center gap-2 group"
                  >
                    <svg
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Business lines */}
          <div>
            <h3 className="font-bold text-lg mb-6 text-white">
              Líneas de negocio
            </h3>
            <ul className="space-y-3">
              {BUSINESS_LINES.map((line) => (
                <li key={line.label}>
                  <Link
                    href={line.href}
                    className="text-white/70 hover:text-proshel-accent transition-colors inline-flex items-center gap-2 group"
                  >
                    <svg
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span>{line.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="text-white/60 text-sm">
                7778 NW 64 Street, Miami, Florida 33166
              </p>
              <p className="text-white/50 text-sm mt-2">
                © {new Date().getFullYear()} PROSHEL Corp. Todos los derechos
                reservados.
              </p>
            </div>

            {/* Social links placeholder */}
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-proshel-accent/20 border border-white/10 hover:border-proshel-accent/30 flex items-center justify-center transition-all duration-300 group"
                aria-label="LinkedIn"
              >
                <svg
                  className="w-5 h-5 text-white/60 group-hover:text-proshel-accent transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-proshel-accent/20 border border-white/10 hover:border-proshel-accent/30 flex items-center justify-center transition-all duration-300 group"
                aria-label="Instagram"
              >
                <svg
                  className="w-5 h-5 text-white/60 group-hover:text-proshel-accent transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>

              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-proshel-accent/20 border border-white/10 hover:border-proshel-accent/30 flex items-center justify-center transition-all duration-300 group"
                aria-label="Twitter"
              >
                <svg
                  className="w-5 h-5 text-white/60 group-hover:text-proshel-accent transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
