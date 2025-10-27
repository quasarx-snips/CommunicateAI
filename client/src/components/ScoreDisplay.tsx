import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Award, TrendingUp } from "lucide-react";

interface ScoreDisplayProps {
  score: string;
  description: string;
  rating: "excellent" | "good" | "fair" | "poor";
}

const ratingConfig = {
  excellent: {
    bg: "bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700",
    icon: Trophy,
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.3)]",
  },
  good: {
    bg: "bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700",
    icon: Star,
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.3)]",
  },
  fair: {
    bg: "bg-gradient-to-br from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700",
    icon: TrendingUp,
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.3)]",
  },
  poor: {
    bg: "bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700",
    icon: Award,
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.3)]",
  },
};

export default function ScoreDisplay({ score, description, rating }: ScoreDisplayProps) {
  const config = ratingConfig[rating];
  const IconComponent = config.icon;

  return (
    <div className="relative text-center py-10 px-4" data-testid="score-display">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl blur-xl" />
      <div className="relative">
        <div className="mb-6 flex flex-col items-center gap-4">
          <div className="relative">
            <div className={`absolute inset-0 ${config.glow} blur-xl rounded-full`} />
            <IconComponent className="relative w-16 h-16 text-primary/80 animate-pulse" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Overall Score
          </h2>
          <Badge 
            className={`${config.bg} text-white text-xl px-6 py-2.5 no-default-hover-elevate ${config.glow} transition-all duration-300 hover:scale-105`} 
            data-testid="badge-score"
          >
            <IconComponent className="w-5 h-5 mr-2 inline-block" strokeWidth={2.5} />
            {score}
          </Badge>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed" data-testid="text-score-description">
          {description}
        </p>
      </div>
    </div>
  );
}
