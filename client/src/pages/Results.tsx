import { ArrowLeft, User, Hand, Activity, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import ScoreDisplay from "@/components/ScoreDisplay";
import DetectionResult from "@/components/DetectionResult";
import InsightSection from "@/components/InsightSection";
import MetricBar from "@/components/MetricBar";

export default function Results() {
  const [, setLocation] = useLocation();

  // todo: remove mock functionality - this would come from actual analysis
  const mockResults = {
    score: "Good",
    rating: "good" as const,
    description: "Good body language with room for minor improvements.",
    detections: [
      { icon: User, label: "Pose", value: 1, color: "green" as const },
      { icon: Activity, label: "Gesture", value: 1, color: "blue" as const },
      { icon: Hand, label: "Hands", value: 0, color: "orange" as const },
    ],
    strengths: [
      "Good posture and confident stance",
      "Good engagement and forward presence"
    ],
    improvements: [
      "Try to keep arms uncrossed and open"
    ],
    recommendations: [
      "Practice relaxation techniques before important conversations",
      "Practice maintaining a slight smile for approachability"
    ],
    metrics: [
      { label: "Confidence", value: 91, color: "green" as const },
      { label: "Openness", value: 100, color: "green" as const },
      { label: "Engagement", value: 100, color: "green" as const },
      { label: "Stress Level", value: 80, color: "orange" as const },
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Analysis Results</h1>

        <div className="space-y-8">
          {/* Analyzed Image Placeholder */}
          <div className="bg-gray-200 rounded-xl h-64 flex items-center justify-center">
            <p className="text-muted-foreground">Analyzed image would appear here</p>
          </div>

          {/* Overall Score */}
          <ScoreDisplay 
            score={mockResults.score}
            description={mockResults.description}
            rating={mockResults.rating}
          />

          {/* Detection Results */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Detection Results</h2>
            <div className="grid grid-cols-3 gap-6 bg-gray-50 rounded-xl p-6">
              {mockResults.detections.map((detection) => (
                <DetectionResult
                  key={detection.label}
                  icon={detection.icon}
                  label={detection.label}
                  value={detection.value}
                  color={detection.color}
                />
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="space-y-6">
            <InsightSection
              icon={CheckCircle2}
              title="Strengths"
              variant="success"
              items={mockResults.strengths}
            />
            
            <InsightSection
              icon={AlertTriangle}
              title="Areas for Improvement"
              variant="warning"
              items={mockResults.improvements}
            />
            
            <InsightSection
              icon={Lightbulb}
              title="Recommendations"
              variant="info"
              items={mockResults.recommendations}
            />
          </div>

          {/* Body Language Metrics */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Body Language Metrics</h2>
            <div className="space-y-6">
              {mockResults.metrics.map((metric) => (
                <MetricBar
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  color={metric.color}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
