import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  color: "green" | "blue" | "orange" | "purple";
}

const colorStyles = {
  green: {
    light: "from-green-50 to-green-100/70 border-green-300",
    dark: "from-green-950/50 to-green-900/30 border-green-700/40",
    icon: "bg-green-500/15 text-green-700 dark:bg-green-500/25 dark:text-green-300 shadow-sm",
  },
  blue: {
    light: "from-blue-50 to-blue-100/70 border-blue-300",
    dark: "from-blue-950/50 to-blue-900/30 border-blue-700/40",
    icon: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300 shadow-sm",
  },
  orange: {
    light: "from-orange-50 to-orange-100/70 border-orange-300",
    dark: "from-orange-950/50 to-orange-900/30 border-orange-700/40",
    icon: "bg-orange-500/15 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300 shadow-sm",
  },
  purple: {
    light: "from-purple-50 to-purple-100/70 border-purple-300",
    dark: "from-purple-950/50 to-purple-900/30 border-purple-700/40",
    icon: "bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300 shadow-sm",
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
