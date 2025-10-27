
import { LucideIcon } from "lucide-react";

interface InsightSectionProps {
  icon: LucideIcon;
  title: string;
  items: string[];
  variant: "success" | "warning" | "info";
}

const variantStyles = {
  success: {
    iconBg: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    iconColor: "text-green-600 dark:text-green-400",
  },
  warning: {
    iconBg: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  info: {
    iconBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
};

export default function InsightSection({ icon: Icon, title, items, variant }: InsightSectionProps) {
  const styles = variantStyles[variant];

  return (
    <div className="bg-card rounded-xl border border-card-border p-6" data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-muted-foreground mt-1">•</span>
            <span className="text-sm text-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
