import { useState } from "react";
import { Camera, Video, Mic } from "lucide-react";
import { Smile, User, Hand, TrendingUp } from "lucide-react";
import Header from "@/components/Header";
import FeatureCard from "@/components/FeatureCard";
import UploadButton from "@/components/UploadButton";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();

  const handleTakePhoto = () => {
    console.log("Take photo clicked");
    // todo: remove mock functionality - navigate to results for demo
    setLocation("/results");
  };

  const handleUploadVideo = () => {
    console.log("Upload video clicked");
    // todo: remove mock functionality - would trigger video upload
  };

  const handleRecordAudio = () => {
    console.log("Record audio clicked");
    // todo: remove mock functionality - would trigger audio recording
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Analyze Your Body Language
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get instant insights into your posture, facial expressions, and gestures to improve your communication skills.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <FeatureCard icon={Smile} title="Emotion Detection" color="green" />
          <FeatureCard icon={User} title="Posture Analysis" color="blue" />
          <FeatureCard icon={Hand} title="Gesture Recognition" color="orange" />
          <FeatureCard icon={TrendingUp} title="Actionable Insights" color="purple" />
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-foreground">Get Started</h2>
          <div className="max-w-md mx-auto">
            <UploadButton icon={Camera} label="Take Photo" onClick={handleTakePhoto} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
            <UploadButton icon={Video} label="Upload Video" onClick={handleUploadVideo} />
            <UploadButton icon={Mic} label="Record Audio" onClick={handleRecordAudio} />
          </div>
        </div>
      </main>
    </div>
  );
}
