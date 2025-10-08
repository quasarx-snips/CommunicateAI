
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { modelLoader } from "@/lib/modelLoader";

export default function ModelPreloader() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    modelLoader.initialize()
      .then(() => {
        if (mounted) {
          setIsLoading(false);
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

  if (!isLoading && !error) {
    return null;
  }

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded-lg text-sm">
        Model loading failed
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Loading AI models...</span>
    </div>
  );
}
