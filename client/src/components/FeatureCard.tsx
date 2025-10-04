import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  color: "green" | "blue" | "orange" | "purple";
}

const colorStyles = {
  green: "bg-green-100 text-green-600",
  blue: "bg-blue-100 text-blue-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
};

export default function FeatureCard({ icon: Icon, title, color }: FeatureCardProps) {
  return (
    <div className={`bg-card rounded-xl border-2 ${colorStyles[color]} p-3 sm:p-6 text-center transition-all duration-200 hover:shadow-lg hover:scale-105`}>
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-opacity-20 mx-auto mb-2 sm:mb-4 flex items-center justify-center" style={{ backgroundColor: `var(--${color}-100)` }}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: `var(--${color}-600)` }} />
      </div>
      <h3 className="text-xs sm:text-sm font-semibold text-card-foreground">{title}</h3>
    </div>
  );
}