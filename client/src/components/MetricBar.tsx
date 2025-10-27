interface MetricBarProps {
  label: string;
  value: number;
  color?: "green" | "blue" | "orange" | "red";
}

const colorStyles = {
  green: {
    bar: "bg-gradient-to-r from-green-600 via-green-500 to-emerald-600",
    glow: "shadow-[0_0_16px_rgba(34,197,94,0.5)]",
    text: "text-green-700 dark:text-green-300 font-semibold",
  },
  blue: {
    bar: "bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-600",
    glow: "shadow-[0_0_16px_rgba(59,130,246,0.5)]",
    text: "text-blue-700 dark:text-blue-300 font-semibold",
  },
  orange: {
    bar: "bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600",
    glow: "shadow-[0_0_16px_rgba(249,115,22,0.5)]",
    text: "text-orange-700 dark:text-orange-300 font-semibold",
  },
  red: {
    bar: "bg-gradient-to-r from-red-600 via-red-500 to-rose-600",
    glow: "shadow-[0_0_16px_rgba(239,68,68,0.5)]",
    text: "text-red-700 dark:text-red-300 font-semibold",
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