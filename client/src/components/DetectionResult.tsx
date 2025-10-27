
import { LucideIcon } from "lucide-react";

interface DetectionResultProps {
  icon: LucideIcon;
  label: string;
  value: number;
  color: "green" | "blue" | "orange";
}

const colorStyles = {
  green: {
    bg: "bg-green-100 dark:bg-green-900/30",
    icon: "text-green-600 dark:text-green-400"
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    icon: "text-blue-600 dark:text-blue-400"
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    icon: "text-orange-600 dark:text-orange-400"
  },
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
