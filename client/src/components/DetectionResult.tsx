import { LucideIcon } from "lucide-react";

interface DetectionResultProps {
  icon: LucideIcon;
  label: string;
  value: number;
  color: "green" | "blue" | "orange";
}

const colorStyles = {
  green: "bg-green-100 text-green-600",
  blue: "bg-blue-100 text-blue-600",
  orange: "bg-orange-100 text-orange-600",
};

export default function DetectionResult({ icon: Icon, label, value, color }: DetectionResultProps) {
  return (
    <div className="flex flex-col items-center gap-3" data-testid={`detection-${label.toLowerCase()}`}>
      <div className={`w-16 h-16 rounded-full ${colorStyles[color]} flex items-center justify-center`}>
        <Icon className="w-8 h-8" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground" data-testid={`value-${label.toLowerCase()}`}>{value}</p>
    </div>
  );
}
