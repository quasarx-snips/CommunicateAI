
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, Loader2, Calendar, FileText, Video, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import { getDeviceHistory, clearDeviceHistory, getDeviceLiveSessions, clearDeviceLiveSessions } from "@/lib/api";
import type { Analysis, LiveSession } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

type HistoryTab = "all" | "files" | "sessions";

export default function History() {
  const [, setLocation] = useLocation();
  const [history, setHistory] = useState<Analysis[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const [fileData, sessionData] = await Promise.all([
        getDeviceHistory(),
        getDeviceLiveSessions(),
      ]);
      setHistory(fileData);
      setLiveSessions(sessionData);
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
      let fileCount = 0;
      let sessionCount = 0;
      
      if (activeTab === "all" || activeTab === "files") {
        const result = await clearDeviceHistory();
        fileCount = result.deletedCount;
      }
      if (activeTab === "all" || activeTab === "sessions") {
        const result = await clearDeviceLiveSessions();
        sessionCount = result.deletedCount;
      }
      
      toast({
        title: "Success",
        description: `Cleared ${fileCount} file analysis and ${sessionCount} live session(s)`,
      });
      
      if (activeTab === "all" || activeTab === "files") setHistory([]);
      if (activeTab === "all" || activeTab === "sessions") setLiveSessions([]);
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as HistoryTab)} className="mb-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Live Sessions
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (activeTab === "all" && history.length === 0 && liveSessions.length === 0) ||
             (activeTab === "files" && history.length === 0) ||
             (activeTab === "sessions" && liveSessions.length === 0) ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">No history yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start analyzing to build your history
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(activeTab === "all" || activeTab === "sessions") && liveSessions.map((session) => (
              <div
                key={session.id}
                className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-4 sm:p-6 hover:from-purple-900/30 hover:to-blue-900/30 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-5 h-5 text-purple-400" />
                      <h3 className="font-semibold text-foreground truncate">
                        {session.sessionName}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(session.createdAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(session.duration)}
                      </div>
                      <div className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-md text-xs font-medium uppercase">
                        {session.mode}
                      </div>
                      <div className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
                        {session.result.summary.rating}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-400">
                      {session.result.summary.overallScore}%
                    </div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                </div>
              </div>
            ))}
            
            {(activeTab === "all" || activeTab === "files") && history.map((analysis) => (
              <div
                key={analysis.id}
                onClick={() => setLocation(`/results/${analysis.id}`)}
                className="bg-card border border-card-border rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-card-foreground truncate">
                        {analysis.fileName}
                      </h3>
                    </div>
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
