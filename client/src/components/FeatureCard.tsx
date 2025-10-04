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
    <div className="flex items-center gap-4 p-6 bg-white rounded-xl border border-gray-200">
      <div className={`w-12 h-12 rounded-full ${colorStyles[color]} flex items-center justify-center shrink-0`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-lg font-medium text-foreground">{title}</p>
    </div>
  );
}
