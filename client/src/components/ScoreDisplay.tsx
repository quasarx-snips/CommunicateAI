import { Badge } from "@/components/ui/badge";

interface ScoreDisplayProps {
  score: string;
  description: string;
  rating: "excellent" | "good" | "fair" | "poor";
}

const ratingStyles = {
  excellent: "bg-green-500 hover:bg-green-500",
  good: "bg-orange-500 hover:bg-orange-500",
  fair: "bg-yellow-500 hover:bg-yellow-500",
  poor: "bg-red-500 hover:bg-red-500",
};

export default function ScoreDisplay({ score, description, rating }: ScoreDisplayProps) {
  return (
    <div className="text-center py-8" data-testid="score-display">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Overall Score</h2>
        <Badge className={`${ratingStyles[rating]} text-white text-lg px-4 py-1 no-default-hover-elevate`} data-testid="badge-score">
          {score}
        </Badge>
      </div>
      <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-score-description">
        {description}
      </p>
    </div>
  );
}
