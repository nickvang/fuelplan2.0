interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  variant?: 'default' | 'highlight' | 'dark';
}

export function MetricCard({ icon, label, value, unit, sublabel, variant = 'default' }: MetricCardProps) {
  const base = 'flex flex-col items-center p-4 sm:p-5 rounded-2xl border text-center transition-all duration-300';
  const variants = {
    default: 'border-border/60 bg-card hover:border-primary/30',
    highlight: 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/10',
    dark: 'border-zinc-700 bg-zinc-900 text-white',
  };

  return (
    <div className={`${base} ${variants[variant]}`}>
      <div className="mb-2 opacity-80">{icon}</div>
      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-black metric-number leading-none">
        {value}
        {unit && <span className="text-sm sm:text-base font-bold ml-0.5">{unit}</span>}
      </p>
      {sublabel && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{sublabel}</p>
      )}
    </div>
  );
}
