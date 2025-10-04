interface MetricBarProps {
  label: string;
  value: number;
  color?: "green" | "blue" | "orange" | "red";
}

const colorStyles = {
  green: "bg-gradient-to-r from-green-400 to-green-500",
  blue: "bg-gradient-to-r from-blue-400 to-blue-500",
  orange: "bg-gradient-to-r from-orange-400 to-orange-500",
  red: "bg-gradient-to-r from-red-400 to-red-500",
};

export default function MetricBar({ label, value, color = "green" }: MetricBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground uppercase tracking-wide">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}%</span>
      </div>
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorStyles[color]} transition-all duration-1000 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
