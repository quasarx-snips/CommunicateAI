
import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Loader2, ArrowLeft, StopCircle } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

export default function LiveAnalysis() {
  const [, setLocation] = useLocation();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<{ label: string; value: number }[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        
        // Start analyzing frames every 3 seconds
        intervalRef.current = setInterval(() => {
          captureAndAnalyze();
        }, 3000);
      }
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to use live analysis",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
    setFeedback([]);
    setMetrics([]);
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      setIsAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");
        formData.append("isLive", "true");

        const response = await fetch("/api/analyze-live", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          
          // Update feedback with improvements
          if (data.improvements && data.improvements.length > 0) {
            setFeedback(data.improvements.slice(0, 3));
          }
          
          // Update metrics
          if (data.metrics) {
            setMetrics(data.metrics);
          }
        }
      } catch (error) {
        console.error("Live analysis error:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, "image/jpeg", 0.8);
  }, [isAnalyzing]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              stopCamera();
              setLocation("/");
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-6 text-center">
          Live Body Language Analysis
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {isAnalyzing && (
                  <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing...</span>
                  </div>
                )}

                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button
                      size="lg"
                      onClick={startCamera}
                      className="gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Start Camera
                    </Button>
                  </div>
                )}
              </div>

              {isStreaming && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="destructive"
                    onClick={stopCamera}
                    className="gap-2"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop Analysis
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Live Feedback */}
          <div className="space-y-4">
            {/* Real-time Feedback */}
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-3">Live Feedback</h2>
              {feedback.length > 0 ? (
                <ul className="space-y-2">
                  {feedback.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="text-orange-500 mt-0.5">⚠️</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isStreaming
                    ? "Analyzing your body language..."
                    : "Start the camera to get live feedback"}
                </p>
              )}
            </Card>

            {/* Metrics */}
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-3">Current Metrics</h2>
              {metrics.length > 0 ? (
                <div className="space-y-3">
                  {metrics.map((metric, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{metric.label}</span>
                        <span className="font-semibold">{metric.value}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Metrics will appear here
                </p>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
