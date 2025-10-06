import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Loader2, ArrowLeft, StopCircle, Activity } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

type AnalysisMode = "composure" | "expressions";

interface EmotionData {
  neutral: number;
  happy: number;
  surprise: number;
  angry: number;
  disgust: number;
  fear: number;
  sad: number;
}

export default function LiveAnalysis() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AnalysisMode>("composure");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<{ label: string; value: number; color: string }[]>([]);
  const [fps, setFps] = useState(0);
  const [detectorReady, setDetectorReady] = useState(false);
  const [faceDetectorReady, setFaceDetectorReady] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<string>("Neutral");
  const [emotions, setEmotions] = useState<EmotionData>({
    neutral: 0,
    happy: 0,
    surprise: 0,
    angry: 0,
    disgust: 0,
    fear: 0,
    sad: 0
  });
  const [age, setAge] = useState<number>(0);
  const [gender, setGender] = useState<string>("Unknown");
  const [faceTracking, setFaceTracking] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const faceDetectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
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

  const initializeFaceDetector = async () => {
    try {
      setIsLoading(true);
      
      await tf.ready();
      
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig = {
        runtime: 'tfjs' as const,
        refineLandmarks: true,
      };
      
      faceDetectorRef.current = await faceLandmarksDetection.createDetector(model, detectorConfig);
      setFaceDetectorReady(true);
      setIsLoading(false);
      console.log('Face detector initialized successfully');
      return true;
    } catch (error) {
      console.error("Error initializing face detector:", error);
      setFaceDetectorReady(false);
      toast({
        title: "Face Model Loading Failed",
        description: "Could not load face detection model. Your device may not support this feature.",
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
      const shoulderAlignment = Math.max(0, 1 - shoulderDiff * 2) * 100;
      
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
      const headStability = Math.max(0, 1 - headTilt * 3) * 100;
      
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
      const openness = Math.min(1, shoulderWidth / hipWidth) * 100;
      
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

  const detectGesture = (keypoints: any[]): string => {
    const getKeypoint = (name: string) => keypoints.find((kp) => kp.name === name);
    
    const leftWrist = getKeypoint("left_wrist");
    const rightWrist = getKeypoint("right_wrist");
    const leftElbow = getKeypoint("left_elbow");
    const rightElbow = getKeypoint("right_elbow");
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");
    const nose = getKeypoint("nose");
    
    if (rightWrist && rightElbow && rightShoulder && 
        rightWrist.score > 0.5 && rightElbow.score > 0.5 && rightShoulder.score > 0.5) {
      if (rightWrist.y < rightElbow.y && rightWrist.y < rightShoulder.y) {
        return "👋 Waving Right Hand";
      }
    }
    
    if (leftWrist && leftElbow && leftShoulder && 
        leftWrist.score > 0.5 && leftElbow.score > 0.5 && leftShoulder.score > 0.5) {
      if (leftWrist.y < leftElbow.y && leftWrist.y < leftShoulder.y) {
        return "👋 Waving Left Hand";
      }
    }
    
    if (leftWrist && rightWrist && leftShoulder && rightShoulder &&
        leftWrist.score > 0.5 && rightWrist.score > 0.5) {
      if (leftWrist.x > rightShoulder.x && rightWrist.x < leftShoulder.x) {
        return "🤝 Arms Crossed";
      }
    }
    
    if (leftWrist && rightWrist && leftShoulder && rightShoulder &&
        leftWrist.score > 0.5 && rightWrist.score > 0.5) {
      const leftHip = getKeypoint("left_hip");
      const rightHip = getKeypoint("right_hip");
      if (leftHip && rightHip) {
        const leftDist = Math.abs(leftWrist.x - leftHip.x) + Math.abs(leftWrist.y - leftHip.y);
        const rightDist = Math.abs(rightWrist.x - rightHip.x) + Math.abs(rightWrist.y - rightHip.y);
        if (leftDist < 0.15 && rightDist < 0.15) {
          return "💪 Hands on Hips - Confident";
        }
      }
    }
    
    if (rightWrist && rightElbow && rightShoulder &&
        rightWrist.score > 0.5 && rightElbow.score > 0.5) {
      if (rightWrist.y < rightShoulder.y && rightElbow.y < rightShoulder.y) {
        return "👍 Thumbs Up";
      }
    }
    
    if (nose && rightWrist && rightWrist.score > 0.5 && nose.score > 0.5) {
      const distance = Math.sqrt(Math.pow(nose.x - rightWrist.x, 2) + Math.pow(nose.y - rightWrist.y, 2));
      if (distance < 0.15) {
        return "🤔 Thinking Pose";
      }
    }
    
    if (nose && leftWrist && leftWrist.score > 0.5 && nose.score > 0.5) {
      const distance = Math.sqrt(Math.pow(nose.x - leftWrist.x, 2) + Math.pow(nose.y - leftWrist.y, 2));
      if (distance < 0.15) {
        return "🤔 Thinking Pose";
      }
    }
    
    if (leftWrist && rightWrist && leftShoulder && rightShoulder &&
        leftWrist.score > 0.5 && rightWrist.score > 0.5) {
      const armSpan = Math.abs(leftWrist.x - rightWrist.x);
      const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x);
      if (armSpan > shoulderSpan * 1.8 && leftWrist.y > leftShoulder.y && rightWrist.y > rightShoulder.y) {
        return "🙌 Open Arms - Welcoming";
      }
    }
    
    return "Neutral";
  };

  const drawPoseLandmarks = (poses: any[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !poses.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    poses.forEach((pose) => {
      const keypoints = pose.keypoints;

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
          const gradient = ctx.createLinearGradient(startKp.x, startKp.y, endKp.x, endKp.y);
          gradient.addColorStop(0, "rgba(59, 130, 246, 0.8)");
          gradient.addColorStop(0.5, "rgba(124, 58, 237, 0.8)");
          gradient.addColorStop(1, "rgba(59, 130, 246, 0.8)");
          
          ctx.beginPath();
          ctx.moveTo(startKp.x, startKp.y);
          ctx.lineTo(endKp.x, endKp.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(59, 130, 246, 0.5)";
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      keypoints.forEach((keypoint: any) => {
        if (keypoint.score > 0.3) {
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
          const glowGradient = ctx.createRadialGradient(
            keypoint.x, keypoint.y, 0,
            keypoint.x, keypoint.y, 8
          );
          glowGradient.addColorStop(0, keypoint.score > 0.6 ? "rgba(34, 197, 94, 0.6)" : "rgba(245, 158, 11, 0.6)");
          glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = glowGradient;
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = keypoint.score > 0.6 ? "#22c55e" : "#f59e0b";
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(keypoint.x - 1, keypoint.y - 1, 2, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fill();
        }
      });
      
      const faceLandmarks = ["nose", "left_eye", "right_eye", "left_ear", "right_ear"];
      const facePoints = faceLandmarks
        .map(name => keypoints.find((kp: any) => kp.name === name))
        .filter(kp => kp && kp.score > 0.4);
      
      if (facePoints.length >= 3) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
        ctx.lineWidth = 1;
        for (let i = 0; i < facePoints.length; i++) {
          const p1 = facePoints[i];
          const p2 = facePoints[(i + 1) % facePoints.length];
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
      }
    });
  };

  const drawFaceMesh = (faces: any[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !faces.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faces.forEach((face) => {
      const keypoints = face.keypoints;
      
      setFaceTracking(true);
      
      if (keypoints && keypoints.length > 0) {
        const xs = keypoints.map((kp: any) => kp.x);
        const ys = keypoints.map((kp: any) => kp.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        
        ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
        ctx.lineWidth = 1;
        
        for (let i = 0; i < keypoints.length; i++) {
          const kp = keypoints[i];
          
          if (i % 3 === 0 && i + 3 < keypoints.length) {
            ctx.beginPath();
            ctx.moveTo(kp.x, kp.y);
            const nextKp = keypoints[i + 3];
            ctx.lineTo(nextKp.x, nextKp.y);
            ctx.stroke();
          }
          
          if (i < 17 && i + 1 < keypoints.length) {
            ctx.beginPath();
            ctx.moveTo(kp.x, kp.y);
            const nextKp = keypoints[i + 1];
            ctx.lineTo(nextKp.x, nextKp.y);
            ctx.stroke();
          }
        }
        
        keypoints.forEach((kp: any, idx: number) => {
          if (idx % 4 === 0) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
            ctx.fill();
          }
        });
      }
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
          
          const gesture = detectGesture(poses[0].keypoints);
          setCurrentGesture(gesture);
          
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

  const detectFaceLoop = useCallback(async () => {
    if (!videoRef.current || !faceDetectorRef.current || !overlayCanvasRef.current || !faceDetectorReady) {
      return;
    }

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (video.readyState === 4) {
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      try {
        const faces = await faceDetectorRef.current.estimateFaces(video);

        if (faces.length > 0) {
          drawFaceMesh(faces, overlayCanvas);
        } else {
          setFaceTracking(false);
          const ctx = overlayCanvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }

        const now = performance.now();
        frameCountRef.current++;
        if (now - lastFrameTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      } catch (error) {
        console.error("Face detection error:", error);
      }
    }

    animationRef.current = requestAnimationFrame(detectFaceLoop);
  }, [faceDetectorReady]);

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

  const sendFrameToGeminiExpressions = useCallback(async () => {
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

        const response = await fetch("/api/analyze-expressions", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.emotions) {
            setEmotions(data.emotions);
          }
          if (data.age) {
            setAge(data.age);
          }
          if (data.gender) {
            setGender(data.gender);
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Expression analysis failed:", errorData);
          
          setEmotions({
            neutral: 0,
            happy: 0,
            surprise: 0,
            angry: 0,
            disgust: 0,
            fear: 0,
            sad: 0
          });
          setAge(0);
          setGender("Unknown");
          
          toast({
            title: "Analysis Error",
            description: "Failed to analyze facial expressions. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Gemini expression analysis error:", error);
        
        setEmotions({
          neutral: 0,
          happy: 0,
          surprise: 0,
          angry: 0,
          disgust: 0,
          fear: 0,
          sad: 0
        });
        setAge(0);
        setGender("Unknown");
        
        toast({
          title: "Connection Error",
          description: "Could not connect to analysis service.",
          variant: "destructive",
        });
      } finally {
        setIsAnalyzing(false);
      }
    }, "image/jpeg", 0.85);
  }, [isAnalyzing, toast]);

  const startCamera = async () => {
    if (mode === "composure") {
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
    } else {
      if (!faceDetectorReady) {
        const initialized = await initializeFaceDetector();
        if (!initialized) {
          toast({
            title: "Cannot Start",
            description: "Face detection model failed to initialize. Please try refreshing the page.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);

        videoRef.current.onloadeddata = () => {
          if (mode === "composure" && detectorReady) {
            detectPoseLoop();
            geminiIntervalRef.current = setInterval(() => {
              sendFrameToGemini();
            }, 15000);
          } else if (mode === "expressions" && faceDetectorReady) {
            detectFaceLoop();
            geminiIntervalRef.current = setInterval(() => {
              sendFrameToGeminiExpressions();
            }, 3000);
          }
        };
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
    setFaceTracking(false);
  };

  const switchMode = (newMode: AnalysisMode) => {
    stopCamera();
    setMode(newMode);
  };

  useEffect(() => {
    if (mode === "composure") {
      initializePoseDetector();
    } else {
      initializeFaceDetector();
    }
    
    return () => {
      stopCamera();
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
      if (faceDetectorRef.current) {
        faceDetectorRef.current.dispose();
      }
    };
  }, [mode]);

  const getEmotionColor = (emotion: string, value: number) => {
    if (value === 0) return "bg-gray-800 dark:bg-gray-900";
    
    switch (emotion.toLowerCase()) {
      case "happy":
        return "bg-green-500";
      case "surprise":
        return "bg-blue-500";
      case "angry":
        return "bg-red-500";
      case "disgust":
        return "bg-purple-500";
      case "fear":
        return "bg-yellow-500";
      case "sad":
        return "bg-cyan-500";
      default:
        return "bg-gray-500";
    }
  };

  const maxEmotion = Object.entries(emotions).reduce((max, [key, value]) => 
    value > max.value ? { emotion: key, value } : max, 
    { emotion: "", value: 0 }
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-7xl">
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
          Live Analysis
        </h1>

        <div className="mb-6 flex justify-center">
          <Tabs value={mode} onValueChange={(value) => switchMode(value as AnalysisMode)}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="composure" data-testid="tab-composure">
                Composure
              </TabsTrigger>
              <TabsTrigger value="expressions" data-testid="tab-expressions">
                Expressions
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

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
                  data-testid="overlay-canvas"
                />
                <canvas ref={canvasRef} className="hidden" />

                {isAnalyzing && (
                  <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full flex items-center gap-2 shadow-lg" data-testid="deep-analysis-indicator">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Deep Analysis</span>
                  </div>
                )}
                
                {isStreaming && mode === "composure" && currentGesture !== "Neutral" && (
                  <div className="absolute top-4 left-4 bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-xl animate-pulse">
                    <span className="text-lg">{currentGesture}</span>
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
            {mode === "composure" ? (
              <>
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
                        {isStreaming ? "Analysis in progress..." : "Start camera to begin"}
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="text-lg font-semibold mb-3">Posture Metrics</h2>
                  <div className="space-y-3" data-testid="posture-metrics-list">
                    {metrics.length > 0 ? (
                      metrics.map((metric, index) => (
                        <div key={index}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{metric.label}</span>
                            <span className="font-semibold" style={{ color: metric.color }}>
                              {metric.value}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${metric.value}%`,
                                backgroundColor: metric.color,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isStreaming ? "Calculating metrics..." : "Start camera to see metrics"}
                      </p>
                    )}
                  </div>
                </Card>
              </>
            ) : (
              <>
                <Card className="p-4 bg-black/90 dark:bg-black/95 text-white">
                  <h2 className="text-lg font-semibold mb-3">Emotion Analysis</h2>
                  {maxEmotion.value === 0 ? (
                    <div className="text-sm text-gray-400 py-4 text-center" data-testid="no-emotion-data">
                      {isStreaming ? "Analyzing expressions..." : "Start camera to begin"}
                    </div>
                  ) : (
                    <div className="space-y-2" data-testid="emotion-analysis-list">
                      {Object.entries(emotions).map(([emotion, value]) => (
                        <div key={emotion}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className={`capitalize ${maxEmotion.emotion === emotion && value > 0 ? 'text-white font-semibold' : 'text-gray-400'}`}>
                              {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                            </span>
                            <span className={maxEmotion.emotion === emotion && value > 0 ? 'text-white font-bold' : 'text-gray-400'}>
                              {value} %
                            </span>
                          </div>
                          <div className="w-full bg-gray-800 dark:bg-gray-900 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${getEmotionColor(emotion, value)}`}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4 bg-black/90 dark:bg-black/95 text-white">
                  <h2 className="text-lg font-semibold mb-3">Status:</h2>
                  <div className="space-y-2 text-sm" data-testid="status-info">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400">*</span>
                      <span className="text-gray-300">Source: Webcam</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400">*</span>
                      <span className="text-gray-300">Player: {isStreaming ? "Playing" : "Stopped"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400">*</span>
                      <span className="text-gray-300">Face: {faceTracking ? "Tracking" : "Not Detected"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400">*</span>
                      <span className="text-gray-300">Markers: Scale to face</span>
                    </div>
                  </div>
                  {age > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-sm text-gray-300">
                        <span className="font-semibold">Age Estimate:</span> {age} years
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        <span className="font-semibold">Gender:</span> {gender}
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
