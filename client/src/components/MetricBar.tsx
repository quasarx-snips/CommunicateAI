interface MetricBarProps {
  label: string;
  value: number;
  color?: "green" | "blue" | "orange" | "red";
}

const colorStyles = {
  green: {
    bar: "bg-gradient-to-r from-green-500 via-green-500 to-emerald-500",
    glow: "shadow-[0_0_12px_rgba(34,197,94,0.4)]",
    text: "text-green-600 dark:text-green-400",
  },
  blue: {
    bar: "bg-gradient-to-r from-blue-500 via-blue-500 to-cyan-500",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.4)]",
    text: "text-blue-600 dark:text-blue-400",
  },
  orange: {
    bar: "bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500",
    glow: "shadow-[0_0_12px_rgba(249,115,22,0.4)]",
    text: "text-orange-600 dark:text-orange-400",
  },
  red: {
    bar: "bg-gradient-to-r from-red-500 via-red-500 to-rose-500",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]",
    text: "text-red-600 dark:text-red-400",
  },
};

export default function MetricBar({ label, value, color = "green" }: MetricBarProps) {
  const config = colorStyles[color] || colorStyles.green;
  
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground tracking-wide">{label}</span>
        <span className={`text-sm font-bold ${config.text} tabular-nums`}>{value}%</span>
      </div>
      <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner">
        <div
          className={`absolute inset-y-0 left-0 ${config.bar} ${config.glow} transition-all duration-1000 ease-out rounded-full`}
          style={{ width: `${value}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}
