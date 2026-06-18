import Link from 'next/link';
import Image from 'next/image';

const FOOTER_LINKS = {
  product: [
    { label: 'Buscar repuestos', href: '/ipmach#search' },
    { label: 'Cómo funciona', href: '/ipmach#como-funciona' },
    { label: 'Marcas', href: '/ipmach#marcas' },
  ],
  support: [
    { label: 'Ayuda', href: '/ipmach#search' },
    { label: 'Contacto', href: '/ipmach#contacto' },
    { label: 'Iniciar sesión', href: '/login' },
  ],
  legal: [
    { label: 'Términos de uso', href: '/ipmach/terms' },
    { label: 'Privacidad', href: '/ipmach/privacy' },
  ],
};

export function IPMachFooter() {
  return (
    <footer className="bg-[#0a0a0a] text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/ipmach" className="inline-block mb-4">
              <Image
                src="/ipmach-logo-header.png"
                alt="IPMach"
                width={160}
                height={48}
                className="h-12 w-auto"
              />
            </Link>
            <p className="text-sm text-white/60 leading-relaxed">
              Consulta disponibilidad y precio de repuestos en tiempo real.
              Repuestos homologados para maquinaria pesada.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Producto</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 hover:text-ipmach-yellow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-white mb-4">Soporte</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.support.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 hover:text-ipmach-yellow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} IPMach. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-6">
            {FOOTER_LINKS.legal.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-white/50 hover:text-white/70 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
