import { useState, useRef } from "react";
import { Camera, Video, Mic, Loader2 } from "lucide-react";
import { Smile, User, Hand, TrendingUp } from "lucide-react";
import Header from "@/components/Header";
import FeatureCard from "@/components/FeatureCard";
import UploadButton from "@/components/UploadButton";
import { useLocation } from "wouter";
import { analyzeFile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [, setLocation] = useLocation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeFile(file);
      setLocation(`/results/${analysis.id}`);
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze file",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleUploadVideo = () => {
    videoInputRef.current?.click();
  };

  const handleRecordAudio = () => {
    audioInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileAnalysis(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 sm:py-12 max-w-4xl">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            Analyze Your Body Language
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Get instant insights into your posture, facial expressions, and gestures to improve your communication skills.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-12">
          <FeatureCard icon={Smile} title="Emotion Detection" color="green" />
          <FeatureCard icon={User} title="Posture Analysis" color="blue" />
          <FeatureCard icon={Hand} title="Gesture Recognition" color="orange" />
          <FeatureCard icon={TrendingUp} title="Actionable Insights" color="purple" />
        </div>

        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground">Get Started</h2>
          <div className="max-w-md mx-auto">
            {isAnalyzing ? (
              <Button disabled className="w-full h-auto py-4 sm:py-6 px-6 sm:px-8 text-base sm:text-lg font-semibold">
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 animate-spin" />
                Analyzing...
              </Button>
            ) : (
              <UploadButton icon={Camera} label="Take Photo" onClick={handleTakePhoto} />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto">
            <UploadButton 
              icon={Video} 
              label="Upload Video" 
              onClick={handleUploadVideo}
              disabled={isAnalyzing}
            />
            <UploadButton 
              icon={Mic} 
              label="Record Audio" 
              onClick={handleRecordAudio}
              disabled={isAnalyzing}
            />
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          data-testid="input-photo-file"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
          data-testid="input-video-file"
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
          data-testid="input-audio-file"
        />
      </main>
    </div>
  );
}
