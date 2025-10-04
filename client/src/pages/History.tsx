
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Loader2, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { getDeviceHistory, clearDeviceHistory } from "@/lib/api";
import type { Analysis } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function History() {
  const [, setLocation] = useLocation();
  const [history, setHistory] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const data = await getDeviceHistory();
      setHistory(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearHistory = async () => {
    try {
      setIsClearing(true);
      const result = await clearDeviceHistory();
      toast({
        title: "Success",
        description: `Cleared ${result.deletedCount} analysis record(s)`,
      });
      setHistory([]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear history",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={history.length === 0 || isClearing}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Analysis History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all analysis records from this device. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory}>
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 text-center">
          Analysis History
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">No analysis history yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start analyzing to build your history
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((analysis) => (
              <div
                key={analysis.id}
                onClick={() => setLocation(`/results/${analysis.id}`)}
                className="bg-card border border-card-border rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-card-foreground truncate mb-2">
                      {analysis.fileName}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(analysis.createdAt)}
                      </div>
                      <div className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
                        {analysis.result.rating}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {analysis.result.score}
                    </div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
