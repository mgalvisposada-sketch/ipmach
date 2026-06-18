import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IPMach — Consulta disponibilidad y precio de repuestos en tiempo real',
  description:
    'Repuestos homologados para Caterpillar, Komatsu y John Deere. Consulta part numbers, disponibilidad y precio al instante. Conectamos con inventario de proveedores. Asistente IA para dudas sobre referencias.',
  openGraph: {
    title: 'IPMach — Repuestos para maquinaria pesada',
    description: 'Consulta disponibilidad y precio en tiempo real. Asistente IA. Envíos internacionales.',
  },
};

export default function IPMachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
