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
import { getComposureAdjective } from "@/utils/adjectives";

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
  const [currentAdjective, setCurrentAdjective] = useState<string>("Neutral");
  const [composureScore, setComposureScore] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(false);
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
  
  // Smoothing and stability refs
  const metricsHistoryRef = useRef<Array<{ label: string; value: number; color: string }[]>>([]);
  const scoreHistoryRef = useRef<number[]>([]);
  const adjectiveStableRef = useRef<{ adjective: string; score: number }>({ adjective: "Neutral", score: 0 });
  
  const { toast } = useToast();

  // Smoothing function with exponential moving average
  const smoothMetrics = (
    newMetrics: { label: string; value: number; color: string }[]
  ): { label: string; value: number; color: string }[] => {
    const HISTORY_SIZE = 5; // Keep last 5 frames
    const SMOOTHING_FACTOR = 0.3; // Weight for new value (0.3 = 30% new, 70% old)
    
    metricsHistoryRef.current.push(newMetrics);
    if (metricsHistoryRef.current.length > HISTORY_SIZE) {
      metricsHistoryRef.current.shift();
    }

    if (metricsHistoryRef.current.length === 1) {
      return newMetrics;
    }

    // Calculate exponentially weighted average
    const smoothed = newMetrics.map((metric, idx) => {
      const history = metricsHistoryRef.current
        .map(frame => frame[idx]?.value || metric.value)
        .filter(val => val !== undefined);

      let smoothedValue = history[history.length - 1];
      for (let i = history.length - 2; i >= 0; i--) {
        smoothedValue = history[i] * (1 - SMOOTHING_FACTOR) + smoothedValue * SMOOTHING_FACTOR;
      }

      // Update color based on smoothed value
      let color = "hsl(0 80% 50%)";
      if (smoothedValue > 80) color = "hsl(140 60% 45%)";
      else if (smoothedValue > 60) color = "hsl(30 90% 55%)";

      return {
        ...metric,
        value: Math.round(smoothedValue),
        color
      };
    });

    return smoothed;
  };

  // Smooth composure score with hysteresis
  const smoothComposureScore = (newScore: number): number => {
    const SCORE_HISTORY_SIZE = 8;
    
    scoreHistoryRef.current.push(newScore);
    if (scoreHistoryRef.current.length > SCORE_HISTORY_SIZE) {
      scoreHistoryRef.current.shift();
    }

    // Calculate weighted moving average (more weight to recent values)
    const weights = scoreHistoryRef.current.map((_, idx) => idx + 1);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedScore = scoreHistoryRef.current.reduce(
      (sum, score, idx) => sum + score * weights[idx],
      0
    ) / totalWeight;

    return Math.round(weightedScore);
  };

  // Stable adjective selection with hysteresis
  const getStableAdjective = (score: number): { adjective: string; isStable: boolean } => {
    const CHANGE_THRESHOLD = 10; // Only change if score differs by 10+ points
    
    const scoreDiff = Math.abs(score - adjectiveStableRef.current.score);
    
    if (scoreDiff >= CHANGE_THRESHOLD || adjectiveStableRef.current.adjective === "Neutral") {
      const newAdjective = getComposureAdjective(score);
      adjectiveStableRef.current = { adjective: newAdjective, score };
      return { adjective: newAdjective, isStable: false };
    }
    
    return { adjective: adjectiveStableRef.current.adjective, isStable: true };
  };

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

    // Higher confidence threshold for more stable readings
    const CONFIDENCE_THRESHOLD = 0.5;
    
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");
    const nose = getKeypoint("nose");
    const leftEye = getKeypoint("left_eye");
    const rightEye = getKeypoint("right_eye");
    const leftHip = getKeypoint("left_hip");
    const rightHip = getKeypoint("right_hip");
    const leftEar = getKeypoint("left_ear");
    const rightEar = getKeypoint("right_ear");

    const metrics: { label: string; value: number; color: string }[] = [];
    const feedbackMessages: string[] = [];

    // 1. SPINAL ALIGNMENT - Based on research paper's postural biomechanics
    if (leftShoulder && rightShoulder && leftHip && rightHip && 
        leftShoulder.score > CONFIDENCE_THRESHOLD && rightShoulder.score > CONFIDENCE_THRESHOLD && 
        leftHip.score > CONFIDENCE_THRESHOLD && rightHip.score > CONFIDENCE_THRESHOLD) {
      
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      
      // Normalized spinal deviation (relative to body size)
      const bodyHeight = Math.abs(shoulderMid.y - hipMid.y);
      const spineDeviation = Math.abs(shoulderMid.x - hipMid.x);
      const normalizedDeviation = bodyHeight > 0 ? spineDeviation / bodyHeight : 0;
      const spinalAlignment = Math.max(0, (1 - normalizedDeviation * 3)) * 100;

      metrics.push({
        label: "Spinal Alignment",
        value: Math.round(spinalAlignment),
        color: spinalAlignment > 80 ? "hsl(140 60% 45%)" : spinalAlignment > 60 ? "hsl(30 90% 55%)" : "hsl(0 80% 50%)",
      });

      if (spinalAlignment < 75) {
        feedbackMessages.push("Center your body - align spine over hips");
      }
    }

    // 2. SHOULDER POSITIONING - Level shoulders indicate confidence
    if (leftShoulder && rightShoulder && leftShoulder.score > CONFIDENCE_THRESHOLD && rightShoulder.score > CONFIDENCE_THRESHOLD) {
      // Normalized shoulder difference (relative to shoulder width)
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      const normalizedDiff = shoulderWidth > 0 ? shoulderDiff / shoulderWidth : 0;
      const shoulderLevelness = Math.max(0, (1 - normalizedDiff * 4)) * 100;

      metrics.push({
        label: "Shoulder Position",
        value: Math.round(shoulderLevelness),
        color: shoulderLevelness > 85 ? "hsl(140 60% 45%)" : shoulderLevelness > 70 ? "hsl(30 90% 55%)" : "hsl(0 80% 50%)",
      });

      if (shoulderLevelness < 80) {
        feedbackMessages.push("Level your shoulders - appears more professional");
      }

      // Shoulder openness - more accurate calculation
      if (leftHip && rightHip && leftHip.score > CONFIDENCE_THRESHOLD && rightHip.score > CONFIDENCE_THRESHOLD) {
        const hipWidth = Math.abs(leftHip.x - rightHip.x);
        const shoulderToHipRatio = hipWidth > 0 ? shoulderWidth / hipWidth : 1;
        const shoulderOpenness = Math.min(100, shoulderToHipRatio * 90);

        metrics.push({
          label: "Shoulder Openness",
          value: Math.round(shoulderOpenness),
          color: shoulderOpenness > 85 ? "hsl(140 60% 45%)" : shoulderOpenness > 70 ? "hsl(30 90% 55%)" : "hsl(0 80% 50%)",
        });

        if (shoulderOpenness < 80) {
          feedbackMessages.push("Roll shoulders back - project confidence");
        }
      }
    }

    // 3. HEAD POSITION AND STABILITY - Critical for professional presence
    if (nose && leftEye && rightEye && nose.score > 0.6 && leftEye.score > 0.6 && rightEye.score > 0.6) {
      const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
      const eyeDistance = Math.abs(leftEye.x - rightEye.x);
      
      // Normalized head tilt (relative to eye distance)
      const headTilt = Math.abs(nose.x - eyeCenter.x);
      const normalizedTilt = eyeDistance > 0 ? headTilt / eyeDistance : 0;
      const headStability = Math.max(0, (1 - normalizedTilt * 1.5)) * 100;

      metrics.push({
        label: "Head Stability",
        value: Math.round(headStability),
        color: headStability > 85 ? "hsl(140 60% 45%)" : headStability > 70 ? "hsl(30 90% 55%)" : "hsl(0 80% 50%)",
      });

      if (headStability < 80) {
        feedbackMessages.push("Keep head steady and centered");
      }

      // Head orientation - improved calculation
      if (leftShoulder && rightShoulder && leftShoulder.score > CONFIDENCE_THRESHOLD && rightShoulder.score > CONFIDENCE_THRESHOLD) {
        const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const headDeviation = Math.abs(nose.x - shoulderMid.x);
        const normalizedHeadDeviation = shoulderWidth > 0 ? headDeviation / shoulderWidth : 0;
        const headForwardness = Math.max(0, (1 - normalizedHeadDeviation * 2)) * 100;

        metrics.push({
          label: "Head Orientation",
          value: Math.round(headForwardness),
          color: headForwardness > 80 ? "hsl(140 60% 45%)" : headForwardness > 65 ? "hsl(30 90% 55%)" : "hsl(0 80% 50%)",
        });

        if (headForwardness < 75) {
          feedbackMessages.push("Face the camera directly");
        }
      }
    }

    // 4. OVERALL UPRIGHTNESS - Body angle indicates engagement
    if (leftShoulder && rightShoulder && leftHip && rightHip && nose &&
        leftShoulder.score > CONFIDENCE_THRESHOLD && rightShoulder.score > CONFIDENCE_THRESHOLD && 
        leftHip.score > CONFIDENCE_THRESHOLD && rightHip.score > CONFIDENCE_THRESHOLD && nose.score > 0.6) {
      
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      
      // More accurate uprightness calculation
      const verticalDistance = Math.abs(shoulderMid.y - hipMid.y);
      const horizontalDistance = Math.abs(shoulderMid.x - hipMid.x);
      const uprightness = verticalDistance > 0 ? (verticalDistance / Math.sqrt(verticalDistance * verticalDistance + horizontalDistance * horizontalDistance)) * 100 : 0;

      metrics.push({
        label: "Body Uprightness",
        value: Math.round(uprightness),
        color: uprightness > 90 ? "hsl(140 60% 45%)" : uprightness > 80 ? "hsl(30 90% 55%)" : "hsl(0 80% 50%)",
      });

      if (uprightness < 88) {
        feedbackMessages.push("Sit/stand more upright - shows engagement");
      }
    }

    // 5. PROFESSIONAL PRESENCE SCORE - Overall composure indicator (only high confidence keypoints)
    const highConfidenceKeypoints = keypoints.filter(kp => kp.score > CONFIDENCE_THRESHOLD);
    const avgConfidence = highConfidenceKeypoints.length > 0 
      ? highConfidenceKeypoints.reduce((sum, kp) => sum + kp.score, 0) / highConfidenceKeypoints.length 
      : 0;
    const visibility = avgConfidence * 100;

    metrics.push({
      label: "Detection Quality",
      value: Math.round(visibility),
      color: visibility > 75 ? "hsl(140 60% 45%)" : visibility > 60 ? "hsl(30 90% 55%)" : "hsl(0 80% 50%)",
    });

    if (visibility < 70) {
      feedbackMessages.push("Improve lighting and positioning");
    }

    // Calculate overall composure score
    const avgScore = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length 
      : 0;

    return { 
      metrics, 
      feedback: feedbackMessages.slice(0, 3),
      composureScore: Math.round(avgScore)
    };
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

  // Enhanced composure visualization with premium skeletal overlay and face box
  const drawComposureAnalysis = (poses: any[], canvas: HTMLCanvasElement, adjective: string) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !poses.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    poses.forEach((pose) => {
      const keypoints = pose.keypoints;
      const getKeypoint = (name: string) => keypoints.find((kp: any) => kp.name === name);

      // Skeletal connections with hierarchy
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

      // Draw glowing skeletal lines with gradient
      connections.forEach(([start, end]) => {
        const startKp = getKeypoint(start);
        const endKp = getKeypoint(end);

        if (startKp && endKp && startKp.score > 0.4 && endKp.score > 0.4) {
          // Glow effect
          ctx.shadowBlur = 12;
          ctx.shadowColor = "rgba(34, 197, 94, 0.6)";
          
          // Gradient line
          const gradient = ctx.createLinearGradient(startKp.x, startKp.y, endKp.x, endKp.y);
          gradient.addColorStop(0, "rgba(34, 197, 94, 0.9)");
          gradient.addColorStop(0.5, "rgba(16, 185, 129, 0.9)");
          gradient.addColorStop(1, "rgba(34, 197, 94, 0.9)");
          
          ctx.beginPath();
          ctx.moveTo(startKp.x, startKp.y);
          ctx.lineTo(endKp.x, endKp.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.shadowBlur = 0;
        }
      });

      // Draw enhanced keypoints with glow
      keypoints.forEach((keypoint: any) => {
        if (keypoint.score > 0.4) {
          // Outer glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = keypoint.score > 0.7 ? "rgba(34, 197, 94, 0.8)" : "rgba(251, 191, 36, 0.8)";
          
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = keypoint.score > 0.7 ? "rgba(34, 197, 94, 0.9)" : "rgba(251, 191, 36, 0.9)";
          ctx.fill();
          
          // Inner bright core
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();
        }
      });

      // Calculate face bounding box
      const faceLandmarks = ["nose", "left_eye", "right_eye", "left_ear", "right_ear"];
      const facePoints = faceLandmarks
        .map(name => getKeypoint(name))
        .filter(kp => kp && kp.score > 0.5);

      if (facePoints.length >= 3) {
        const faceXs = facePoints.map((kp: any) => kp.x);
        const faceYs = facePoints.map((kp: any) => kp.y);
        const faceMinX = Math.min(...faceXs);
        const faceMaxX = Math.max(...faceXs);
        const faceMinY = Math.min(...faceYs);
        const faceMaxY = Math.max(...faceYs);

        const padding = 25;
        const boxX = faceMinX - padding;
        const boxY = faceMinY - padding;
        const boxWidth = (faceMaxX - faceMinX) + (padding * 2);
        const boxHeight = (faceMaxY - faceMinY) + (padding * 2);
        const cornerRadius = 12;

        // Draw premium face box with rounded corners and glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(59, 130, 246, 0.6)";
        
        ctx.strokeStyle = "rgba(59, 130, 246, 0.95)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(boxX + cornerRadius, boxY);
        ctx.lineTo(boxX + boxWidth - cornerRadius, boxY);
        ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + cornerRadius, cornerRadius);
        ctx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerRadius);
        ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - cornerRadius, boxY + boxHeight, cornerRadius);
        ctx.lineTo(boxX + cornerRadius, boxY + boxHeight);
        ctx.arcTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - cornerRadius, cornerRadius);
        ctx.lineTo(boxX, boxY + cornerRadius);
        ctx.arcTo(boxX, boxY, boxX + cornerRadius, boxY, cornerRadius);
        ctx.closePath();
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        // Draw premium adjective label with gradient background
        ctx.font = "bold 20px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        
        const textMetrics = ctx.measureText(adjective);
        const textWidth = textMetrics.width + 30;
        const textHeight = 36;
        const textX = boxX + boxWidth / 2;
        const textY = boxY - 12;

        // Gradient background
        const bgGradient = ctx.createLinearGradient(textX - textWidth/2, textY - textHeight, textX + textWidth/2, textY);
        bgGradient.addColorStop(0, "rgba(0, 0, 0, 0.85)");
        bgGradient.addColorStop(0.5, "rgba(20, 20, 30, 0.9)");
        bgGradient.addColorStop(1, "rgba(0, 0, 0, 0.85)");
        
        ctx.fillStyle = bgGradient;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.moveTo(textX - textWidth/2 + 8, textY - textHeight);
        ctx.lineTo(textX + textWidth/2 - 8, textY - textHeight);
        ctx.arcTo(textX + textWidth/2, textY - textHeight, textX + textWidth/2, textY - textHeight + 8, 8);
        ctx.lineTo(textX + textWidth/2, textY - 8);
        ctx.arcTo(textX + textWidth/2, textY, textX + textWidth/2 - 8, textY, 8);
        ctx.lineTo(textX - textWidth/2 + 8, textY);
        ctx.arcTo(textX - textWidth/2, textY, textX - textWidth/2, textY - 8, 8);
        ctx.lineTo(textX - textWidth/2, textY - textHeight + 8);
        ctx.arcTo(textX - textWidth/2, textY - textHeight, textX - textWidth/2 + 8, textY - textHeight, 8);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;

        // Draw text with subtle glow
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(59, 130, 246, 0.8)";
        ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
        ctx.fillText(adjective, textX, textY - 8);
        ctx.shadowBlur = 0;
      }
    });
  };


  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !overlayCanvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (video.readyState === 4) {
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      try {
        if (mode === "expressions") {
          if (!faceDetectorRef.current || !faceDetectorReady) return;
          const faces = await faceDetectorRef.current.estimateFaces(video, {
            flipHorizontal: false,
          });

          if (faces && faces.length > 0) {
            drawFaceMesh(faces, overlayCanvas);
            setFaceTracking(true);
          } else {
            setFaceTracking(false);
            const ctx = overlayCanvas.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }
        } else if (mode === "composure") {
          if (!detectorRef.current || !detectorReady) return;
          const poses = await detectorRef.current.estimatePoses(video, {
            flipHorizontal: false,
          });

          if (poses && poses.length > 0) {
            const { metrics: rawMetrics, feedback: newFeedback, composureScore: rawScore } = calculatePostureMetrics(
              poses[0].keypoints
            );
            
            // Apply smoothing for stability
            const smoothedMetrics = smoothMetrics(rawMetrics);
            const smoothedScore = smoothComposureScore(rawScore);
            const { adjective: stableAdjective, isStable: readingIsStable } = getStableAdjective(smoothedScore);
            
            setMetrics(smoothedMetrics);
            setFeedback(newFeedback);
            setComposureScore(smoothedScore);
            setCurrentAdjective(stableAdjective);
            setIsStable(readingIsStable && metricsHistoryRef.current.length >= 5);

            drawComposureAnalysis(poses, overlayCanvas, stableAdjective);

            const gesture = detectGesture(poses[0].keypoints);
            setCurrentGesture(gesture);
          } else {
            const ctx = overlayCanvas.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }
        }

        const now = performance.now();
        frameCountRef.current++;
        if (now - lastFrameTimeRef.current >= 1000) {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      } catch (error) {
        console.error("Detection loop error:", error);
        // Handle specific errors if needed
      }
    }

    animationRef.current = requestAnimationFrame(detectLoop);
  }, [mode, detectorReady, faceDetectorReady]);



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
          if (mode === "expressions" && faceDetectorReady) {
            if (geminiIntervalRef.current) clearInterval(geminiIntervalRef.current);
            geminiIntervalRef.current = setInterval(() => {
              sendFrameToGeminiExpressions();
            }, 3000);
          }
          detectLoop(); // Start the combined detection loop
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
    
    // Clear smoothing buffers for fresh start
    metricsHistoryRef.current = [];
    scoreHistoryRef.current = [];
    adjectiveStableRef.current = { adjective: "Neutral", score: 0 };
    
    setIsStreaming(false);
    setFeedback([]);
    setMetrics([]);
    setFps(0);
    setFaceTracking(false);
    setCurrentGesture("Neutral");
    setCurrentAdjective("Neutral");
    setComposureScore(0);
    setIsStable(false);
    setEmotions({
      neutral: 0, happy: 0, surprise: 0, angry: 0, disgust: 0, fear: 0, sad: 0
    });
    setAge(0);
    setGender("Unknown");
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
                <Card className="p-4 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">Composure Analysis</h2>
                    {isStable && isStreaming && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30" data-testid="stability-indicator">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-medium text-green-400">Locked</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center space-y-2" data-testid="composure-score-display">
                    <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent transition-all duration-500" data-testid="composure-score">
                      {composureScore}%
                    </div>
                    <div className="text-2xl font-semibold text-foreground transition-all duration-700" data-testid="composure-adjective">
                      {currentAdjective}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Overall Presence Score
                    </div>
                  </div>
                </Card>

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