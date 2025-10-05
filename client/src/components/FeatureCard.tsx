import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  color: "green" | "blue" | "orange" | "purple";
}

const colorStyles = {
  green: {
    light: "from-green-50 to-green-100/50 border-green-200",
    dark: "from-green-950/40 to-green-900/20 border-green-800/30",
    icon: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
  },
  blue: {
    light: "from-blue-50 to-blue-100/50 border-blue-200",
    dark: "from-blue-950/40 to-blue-900/20 border-blue-800/30",
    icon: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  },
  orange: {
    light: "from-orange-50 to-orange-100/50 border-orange-200",
    dark: "from-orange-950/40 to-orange-900/20 border-orange-800/30",
    icon: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
  },
  purple: {
    light: "from-purple-50 to-purple-100/50 border-purple-200",
    dark: "from-purple-950/40 to-purple-900/20 border-purple-800/30",
    icon: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  },
};

export default function FeatureCard({ icon: Icon, title, color }: FeatureCardProps) {
  return (
    <div className={`group relative bg-gradient-to-br ${colorStyles[color].light} dark:${colorStyles[color].dark} rounded-2xl border ${colorStyles[color].light.split(' ')[2]} dark:${colorStyles[color].dark.split(' ')[2]} p-4 sm:p-6 text-center transition-all duration-300 hover:shadow-xl hover:scale-105 hover:-translate-y-1 cursor-default`}>
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${colorStyles[color].icon} mx-auto mb-3 sm:mb-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-sm`}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2} />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-foreground">{title}</h3>
    </div>
  );
}
