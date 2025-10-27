import { useEffect, useState } from "react";
import { Brain, Zap, Target, Eye } from "lucide-react";

interface LoadingScreenProps {
  isLoading: boolean;
  loadingMessage?: string;
}

export default function LoadingScreen({ isLoading, loadingMessage = "Initializing AI Models..." }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      return;
    }

    setProgress(0);
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 15;
      });
    }, 300);

    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(dotsInterval);
    };
  }, [isLoading]);

  if (!isLoading && progress < 100) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 bg-background dark:bg-background flex items-center justify-center transition-opacity duration-500 ${
        !isLoading && progress >= 100 ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      data-testid="loading-screen"
    >
      <div className="relative w-full max-w-md px-8">
        {/* Animated Background Glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 dark:bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        </div>

        {/* Main Content */}
        <div className="text-center space-y-8">
          {/* Animated Icons */}
          <div className="flex justify-center gap-6">
            <div className="relative">
              <Brain className="w-16 h-16 text-primary animate-pulse" strokeWidth={1.5} />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Brain className="w-16 h-16 text-primary" strokeWidth={1.5} />
              </div>
            </div>
            <div className="relative animation-delay-200">
              <Eye className="w-16 h-16 text-blue-500 dark:text-blue-400 animate-pulse" strokeWidth={1.5} />
              <div className="absolute inset-0 animate-ping opacity-20 animation-delay-200">
                <Eye className="w-16 h-16 text-blue-500 dark:text-blue-400" strokeWidth={1.5} />
              </div>
            </div>
            <div className="relative animation-delay-400">
              <Target className="w-16 h-16 text-green-500 dark:text-green-400 animate-pulse" strokeWidth={1.5} />
              <div className="absolute inset-0 animate-ping opacity-20 animation-delay-400">
                <Target className="w-16 h-16 text-green-500 dark:text-green-400" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground dark:text-foreground">
              ComposureSense
            </h2>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground">
              <Zap className="w-4 h-4 text-yellow-500 dark:text-yellow-400 animate-pulse" />
              <span>Powered by AI</span>
            </div>
          </div>

          {/* Loading Message */}
          <div className="space-y-4">
            <p className="text-lg font-medium text-foreground dark:text-foreground">
              {loadingMessage}{dots}
            </p>

            {/* Progress Bar */}
            <div className="relative h-3 bg-muted dark:bg-muted rounded-full overflow-hidden border border-border dark:border-border">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-blue-500 to-green-500 dark:from-primary dark:via-blue-400 dark:to-green-400 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${Math.min(progress, 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/30 dark:bg-white/20 animate-shimmer"></div>
              </div>
            </div>

            {/* Percentage */}
            <p className="text-sm font-mono text-muted-foreground dark:text-muted-foreground">
              {Math.round(Math.min(progress, 100))}%
            </p>
          </div>

          {/* Loading Tips */}
          <div className="pt-4 space-y-2 text-sm text-muted-foreground dark:text-muted-foreground">
            <p className="opacity-80">💡 Tip: Good lighting improves detection accuracy</p>
            <p className="opacity-60 text-xs">Preparing TensorFlow models for your device...</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        
        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  );
}
