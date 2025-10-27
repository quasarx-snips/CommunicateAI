import { useEffect, useState } from "react";
import { modelLoader } from "@/lib/modelLoader";
import LoadingScreen from "@/components/LoadingScreen";

export default function ModelPreloader() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    let mounted = true;

    const cached = modelLoader.isCached();
    setIsCached(cached);

    modelLoader.initialize()
      .then(() => {
        if (mounted) {
          setTimeout(() => setIsLoading(false), 500);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 dark:border-destructive/30 text-destructive dark:text-destructive px-4 py-2 rounded-lg text-sm shadow-lg" data-testid="error-model-loading">
        Model loading failed
      </div>
    );
  }

  return (
    <LoadingScreen 
      isLoading={isLoading} 
      loadingMessage={isCached ? "Loading from cache" : "Downloading AI models"}
    />
  );
}
