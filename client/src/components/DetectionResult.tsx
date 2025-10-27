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
  const styles = colorStyles[color];

  return (
    <div className="flex flex-col items-center text-center">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${styles.bg} ${styles.icon} flex items-center justify-center mb-2 sm:mb-3`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
      </div>
      <p className="text-lg sm:text-xl font-bold text-foreground mb-1">{value}%</p>
      <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
    </div>
  );
}