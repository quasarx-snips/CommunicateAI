import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Loader2, ArrowLeft, StopCircle, Activity } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

export default function LiveAnalysis() {
  const [, setLocation] = useLocation();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<{ label: string; value: number; color: string }[]>([]);
  const [fps, setFps] = useState(0);
  const [detectorReady, setDetectorReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const animationRef = useRef<number | null>(null);
  const geminiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const { toast } = useToast();

  const initializePoseDetector = async () => {
    try {
      setIsLoading(true);
      
      await tf.ready();
      
      try {
        await tf.setBackend('webgl');
        console.log('Using WebGL backend');
      } catch (e) {
        console.warn('WebGL backend failed, falling back to CPU');
        await tf.setBackend('cpu');
      }
      
      const model = poseDetection.SupportedModels.MoveNet;
      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      };
      
      detectorRef.current = await poseDetection.createDetector(model, detectorConfig);
      setDetectorReady(true);
      setIsLoading(false);
      console.log('Pose detector initialized successfully');
      return true;
    } catch (error) {
      console.error("Error initializing pose detector:", error);
      setDetectorReady(false);
      toast({
        title: "Model Loading Failed",
        description: "Could not load pose detection model. Your device may not support this feature.",
        variant: "destructive",
      });
      setIsLoading(false);
      return false;
    }
  };

  const calculatePostureMetrics = (keypoints: any[]) => {
    const getKeypoint = (name: string) => keypoints.find((kp) => kp.name === name);
    
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");
    const nose = getKeypoint("nose");
    const leftEye = getKeypoint("left_eye");
    const rightEye = getKeypoint("right_eye");
    const leftHip = getKeypoint("left_hip");
    const rightHip = getKeypoint("right_hip");

    const metrics: { label: string; value: number; color: string }[] = [];
    const feedbackMessages: string[] = [];

    if (leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
      const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      const shoulderAlignment = Math.max(0, 100 - shoulderDiff * 200);
      
      metrics.push({
        label: "Posture Alignment",
        value: Math.round(shoulderAlignment),
        color: shoulderAlignment > 70 ? "hsl(140 60% 45%)" : "hsl(30 90% 55%)",
      });

      if (shoulderAlignment < 70) {
        feedbackMessages.push("Straighten your shoulders - they appear uneven");
      }
    }

    if (nose && leftEye && rightEye && nose.score > 0.4) {
      const eyeCenter = {
        x: (leftEye.x + rightEye.x) / 2,
        y: (leftEye.y + rightEye.y) / 2,
      };
      const headTilt = Math.abs(nose.x - eyeCenter.x);
      const headStability = Math.max(0, 100 - headTilt * 300);
      
      metrics.push({
        label: "Head Stability",
        value: Math.round(headStability),
        color: headStability > 70 ? "hsl(140 60% 45%)" : "hsl(30 90% 55%)",
      });

      if (headStability < 70) {
        feedbackMessages.push("Keep your head centered and steady");
      }
    }

    if (leftShoulder && rightShoulder && nose && leftShoulder.score > 0.3 && rightShoulder.score > 0.3 && nose.score > 0.4) {
      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      const spineAngle = Math.atan2(nose.y - shoulderMid.y, nose.x - shoulderMid.x);
      const uprightness = Math.abs(Math.cos(spineAngle)) * 100;
      
      metrics.push({
        label: "Body Uprightness",
        value: Math.round(uprightness),
        color: uprightness > 75 ? "hsl(140 60% 45%)" : "hsl(30 90% 55%)",
      });

      if (uprightness < 75) {
        feedbackMessages.push("Sit up straighter - improve your posture");
      }
    }

    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const hipWidth = Math.abs(leftHip.x - rightHip.x);
      const openness = Math.min(100, (shoulderWidth / hipWidth) * 100);
      
      metrics.push({
        label: "Body Openness",
        value: Math.round(openness),
        color: openness > 80 ? "hsl(140 60% 45%)" : "hsl(210 85% 55%)",
      });

      if (openness < 80) {
        feedbackMessages.push("Open up your posture - appear more confident");
      }
    }

    const avgConfidence = keypoints.reduce((sum, kp) => sum + kp.score, 0) / keypoints.length;
    const visibility = avgConfidence * 100;
    
    metrics.push({
      label: "Visibility Score",
      value: Math.round(visibility),
      color: visibility > 70 ? "hsl(140 60% 45%)" : "hsl(30 90% 55%)",
    });

    if (visibility < 70) {
      feedbackMessages.push("Ensure good lighting and face the camera directly");
    }

    return { metrics, feedback: feedbackMessages.slice(0, 3) };
  };

  const drawPoseLandmarks = (poses: any[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !poses.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    poses.forEach((pose) => {
      const keypoints = pose.keypoints;

      keypoints.forEach((keypoint: any) => {
        if (keypoint.score > 0.3) {
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = keypoint.score > 0.6 ? "#22c55e" : "#f59e0b";
          ctx.fill();
        }
      });

      const connections = [
        ["nose", "left_eye"],
        ["nose", "right_eye"],
        ["left_eye", "left_ear"],
        ["right_eye", "right_ear"],
        ["left_shoulder", "right_shoulder"],
        ["left_shoulder", "left_elbow"],
        ["right_shoulder", "right_elbow"],
        ["left_elbow", "left_wrist"],
        ["right_elbow", "right_wrist"],
        ["left_shoulder", "left_hip"],
        ["right_shoulder", "right_hip"],
        ["left_hip", "right_hip"],
        ["left_hip", "left_knee"],
        ["right_hip", "right_knee"],
        ["left_knee", "left_ankle"],
        ["right_knee", "right_ankle"],
      ];

      connections.forEach(([start, end]) => {
        const startKp = keypoints.find((kp: any) => kp.name === start);
        const endKp = keypoints.find((kp: any) => kp.name === end);

        if (startKp && endKp && startKp.score > 0.3 && endKp.score > 0.3) {
          ctx.beginPath();
          ctx.moveTo(startKp.x, startKp.y);
          ctx.lineTo(endKp.x, endKp.y);
          ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    });
  };

  const detectPoseLoop = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !overlayCanvasRef.current || !detectorReady) {
      return;
    }

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (video.readyState === 4) {
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      try {
        const poses = await detectorRef.current.estimatePoses(video);

        if (poses.length > 0) {
          const { metrics: newMetrics, feedback: newFeedback } = calculatePostureMetrics(
            poses[0].keypoints
          );
          setMetrics(newMetrics);
          setFeedback(newFeedback);
          drawPoseLandmarks(poses, overlayCanvas);
        }

        const now = performance.now();
        frameCountRef.current++;
        if (now - lastFrameTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      } catch (error) {
        console.error("Pose detection error:", error);
      }
    }

    animationRef.current = requestAnimationFrame(detectPoseLoop);
  }, [detectorReady]);

  const sendFrameToGemini = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

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
          
          if (data.improvements && data.improvements.length > 0) {
            setFeedback((prev) => {
              const combined = [...new Set([...prev, ...data.improvements])];
              return combined.slice(0, 4);
            });
          }
        }
      } catch (error) {
        console.error("Gemini analysis error:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, "image/jpeg", 0.85);
  }, [isAnalyzing]);

  const startCamera = async () => {
    if (!detectorReady) {
      const initialized = await initializePoseDetector();
      if (!initialized) {
        toast({
          title: "Cannot Start",
          description: "Pose detection model failed to initialize. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: false,
      });

      if (videoRef.current && detectorReady) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);

        videoRef.current.onloadeddata = () => {
          detectPoseLoop();
        };

        geminiIntervalRef.current = setInterval(() => {
          sendFrameToGemini();
        }, 15000);
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
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (geminiIntervalRef.current) {
      clearInterval(geminiIntervalRef.current);
      geminiIntervalRef.current = null;
    }
    setIsStreaming(false);
    setFeedback([]);
    setMetrics([]);
    setFps(0);
  };

  useEffect(() => {
    initializePoseDetector();
    return () => {
      stopCamera();
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              stopCamera();
              setLocation("/");
            }}
            data-testid="button-back-to-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="fps-counter">
              <Activity className="w-4 h-4 text-green-500" />
              <span>{fps} FPS</span>
            </div>
          )}
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-6 text-center">
          Live Body Language Analysis
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  data-testid="video-feed"
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  data-testid="pose-overlay-canvas"
                />
                <canvas ref={canvasRef} className="hidden" />

                {isAnalyzing && (
                  <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full flex items-center gap-2 shadow-lg" data-testid="deep-analysis-indicator">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Deep Analysis</span>
                  </div>
                )}

                {!isStreaming && !isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Button 
                      size="lg" 
                      onClick={startCamera} 
                      className="gap-2"
                      data-testid="button-start-camera"
                    >
                      <Camera className="w-5 h-5" />
                      Start Camera
                    </Button>
                  </div>
                )}

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-white text-sm">Loading AI Model...</p>
                    </div>
                  </div>
                )}
              </div>

              {isStreaming && (
                <div className="mt-4 flex justify-center">
                  <Button 
                    variant="destructive" 
                    onClick={stopCamera} 
                    className="gap-2"
                    data-testid="button-stop-camera"
                  >
                    <StopCircle className="w-5 h-5" />
                    Stop Analysis
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Feedback
              </h2>
              <div data-testid="live-feedback-list">
                {feedback.length > 0 ? (
                  <ul className="space-y-2">
                    {feedback.map((item, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm leading-relaxed"
                      >
                        <span className="text-orange-500 mt-0.5 flex-shrink-0">⚠️</span>
                        <span className="text-muted-foreground">{item}</span>
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
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-3">Current Metrics</h2>
              <div data-testid="live-metrics-list">
                {metrics.length > 0 ? (
                  <div className="space-y-3">
                    {metrics.map((metric, index) => (
                      <div key={index} data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-foreground">{metric.label}</span>
                          <span className="font-semibold" style={{ color: metric.color }}>
                            {metric.value}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300 ease-out rounded-full"
                            style={{
                              width: `${metric.value}%`,
                              backgroundColor: metric.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Metrics will appear here</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
