import { useEffect, useState } from "react";
import { ArrowLeft, User, Hand, Activity, CheckCircle2, AlertTriangle, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useRoute } from "wouter";
import Header from "@/components/Header";
import ScoreDisplay from "@/components/ScoreDisplay";
import DetectionResult from "@/components/DetectionResult";
import InsightSection from "@/components/InsightSection";
import MetricBar from "@/components/MetricBar";
import { getAnalysis } from "@/lib/api";
import type { Analysis } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Results() {
  const [, params] = useRoute("/results/:id");
  const [, setLocation] = useLocation();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadAnalysis = async () => {
      if (!params?.id) {
        setLocation("/");
        return;
      }

      try {
        const data = await getAnalysis(params.id);
        setAnalysis(data);
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load analysis",
          variant: "destructive",
        });
        setLocation("/");
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalysis();
  }, [params?.id, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const { result } = analysis;

  const iconMap: Record<string, any> = {
    "Pose": User,
    "Gesture": Activity,
    "Hands": Hand,
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

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 sm:mb-8 text-center">Analysis Results</h1>

        <div className="space-y-6 sm:space-y-8">
          {/* Uploaded Media Display */}
          <div className="bg-card border border-card-border rounded-xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4 text-center">Analyzed Media</h2>
            <div className="flex justify-center">
              {analysis.fileType?.startsWith('image/') && (
                <img 
                  src={analysis.fileUrl} 
                  alt="Analyzed content" 
                  className="max-w-full h-auto rounded-lg max-h-[400px] object-contain"
                />
              )}
              {analysis.fileType?.startsWith('video/') && (
                <video 
                  src={analysis.fileUrl} 
                  controls 
                  className="max-w-full h-auto rounded-lg max-h-[400px]"
                />
              )}
              {analysis.fileType?.startsWith('audio/') && (
                <div className="w-full max-w-md">
                  <audio 
                    src={analysis.fileUrl} 
                    controls 
                    className="w-full"
                  />
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center mt-3">{analysis.fileName}</p>
          </div>

          {/* Overall Score */}
          <ScoreDisplay 
            score={result.score}
            description={result.description}
            rating={result.rating}
          />

          {/* Detection Results */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Detection Results</h2>
            <div className="grid grid-cols-3 gap-3 sm:gap-6 bg-card border border-card-border rounded-xl p-4 sm:p-6">
              {result.detections.map((detection) => (
                <DetectionResult
                  key={detection.label}
                  icon={iconMap[detection.label] || User}
                  label={detection.label}
                  value={detection.value}
                  color={detection.color as any}
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
              items={result.strengths}
            />
            
            <InsightSection
              icon={AlertTriangle}
              title="Areas for Improvement"
              variant="warning"
              items={result.improvements}
            />
            
            <InsightSection
              icon={Lightbulb}
              title="Recommendations"
              variant="info"
              items={result.recommendations}
            />
          </div>

          {/* Body Language Metrics */}
          <div className="bg-card rounded-xl border border-card-border p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-6">Body Language Metrics</h2>
            <div className="space-y-4 sm:space-y-6">
              {result.metrics.map((metric) => (
                <MetricBar
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  color={metric.color as any}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
