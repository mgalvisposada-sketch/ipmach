interface BrandLogoProps {
  brand: 'CATERPILLAR' | 'KOMATSU' | 'JOHN DEERE' | 'CTP';
  className?: string;
}

export function BrandLogo({ brand, className = '' }: BrandLogoProps) {
  const colors = {
    'CATERPILLAR': '#FFCD00',
    'KOMATSU': '#D32F2F',
    'JOHN DEERE': '#367C2B',
    'CTP': '#64748B'
  };
  
  return (
    <div 
      className={`w-32 h-20 rounded-lg bg-white flex items-center justify-center border-2 shadow-sm hover:shadow-md transition-shadow ${className}`}
      style={{ borderColor: colors[brand] }}
    >
      <span 
        className="font-bold text-sm text-center px-2"
        style={{ color: colors[brand] }}
      >
        {brand}
      </span>
    </div>
  );
}
