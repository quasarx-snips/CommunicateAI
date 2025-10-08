import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Loader2, ArrowLeft, StopCircle, Activity } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as faceapi from "@vladmandic/face-api";
import { getComposureAdjective } from "@/utils/adjectives";
import { modelLoader } from "@/lib/modelLoader";

type AnalysisMode = "composure" | "expressions" | "decoder";

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
  const [faceTracking, setFaceTracking] = useState<boolean>(false);
  const [decodedTexts, setDecodedTexts] = useState<string[]>([]);
  const [currentDecoding, setCurrentDecoding] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const faceApiLoadedRef = useRef<boolean>(false);
  const animationRef = useRef<number | null>(null);
  const emotionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  
  // Smoothing and stability refs
  const metricsHistoryRef = useRef<Array<{ label: string; value: number; color: string }[]>>([]);
  const scoreHistoryRef = useRef<number[]>([]);
  const adjectiveStableRef = useRef<{ adjective: string; score: number }>({ adjective: "Neutral", score: 0 });
  const frameSkipCounterRef = useRef(0);
  const faceBoxHistoryRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);
  const lastDecodedActionRef = useRef<string>("");
  const decodingHistoryRef = useRef<string[]>([]);
  const lastPoseRef = useRef<any>(null);
  
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

  // Smooth face box calculation with exponential moving average
  const smoothFaceBox = (newBox: { x: number; y: number; width: number; height: number }) => {
    const BOX_HISTORY_SIZE = 4;
    const SMOOTHING_WEIGHT = 0.4; // Higher weight = more responsive, lower = smoother
    
    faceBoxHistoryRef.current.push(newBox);
    if (faceBoxHistoryRef.current.length > BOX_HISTORY_SIZE) {
      faceBoxHistoryRef.current.shift();
    }

    if (faceBoxHistoryRef.current.length === 1) {
      return newBox;
    }

    // Calculate weighted average for each dimension
    let smoothedBox = { ...newBox };
    const history = faceBoxHistoryRef.current;
    
    ['x', 'y', 'width', 'height'].forEach((key) => {
      let value = history[history.length - 1][key as keyof typeof newBox];
      for (let i = history.length - 2; i >= 0; i--) {
        value = history[i][key as keyof typeof newBox] * (1 - SMOOTHING_WEIGHT) + value * SMOOTHING_WEIGHT;
      }
      smoothedBox[key as keyof typeof smoothedBox] = value;
    });

    return smoothedBox;
  };

  const initializePoseDetector = async () => {
    try {
      setIsLoading(true);

      // Use cached model if available
      const cachedDetector = modelLoader.getPoseDetector();
      if (cachedDetector) {
        detectorRef.current = cachedDetector;
        setDetectorReady(true);
        setIsLoading(false);
        console.log('✅ Using cached pose detector');
        return true;
      }

      // Fallback: initialize if not cached
      console.log('⏳ Pose detector not cached, initializing...');
      await modelLoader.initialize();
      detectorRef.current = modelLoader.getPoseDetector();
      
      if (detectorRef.current) {
        setDetectorReady(true);
        setIsLoading(false);
        console.log('✅ Pose detector initialized');
        return true;
      } else {
        throw new Error('Failed to get pose detector from cache');
      }
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

      // Use cached model if available
      if (modelLoader.isFaceAPILoaded()) {
        faceApiLoadedRef.current = true;
        setFaceDetectorReady(true);
        setIsLoading(false);
        console.log('✅ Using cached face-API models');
        return true;
      }

      // Fallback: initialize if not cached
      console.log('⏳ Face-API not cached, initializing...');
      await modelLoader.initialize();
      
      if (modelLoader.isFaceAPILoaded()) {
        faceApiLoadedRef.current = true;
        setFaceDetectorReady(true);
        setIsLoading(false);
        console.log('✅ Face-API models initialized');
        return true;
      } else {
        throw new Error('Failed to load face-API from cache');
      }
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

  const decodeBodyLanguage = (keypoints: any[]): string => {
    const getKeypoint = (name: string) => keypoints.find((kp) => kp.name === name);
    
    const leftWrist = getKeypoint("left_wrist");
    const rightWrist = getKeypoint("right_wrist");
    const leftElbow = getKeypoint("left_elbow");
    const rightElbow = getKeypoint("right_elbow");
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");
    const leftHip = getKeypoint("left_hip");
    const rightHip = getKeypoint("right_hip");
    const nose = getKeypoint("nose");
    const leftEye = getKeypoint("left_eye");
    const rightEye = getKeypoint("right_eye");

    const CONF = 0.5;
    
    // Hand raising detection
    if (rightWrist && rightShoulder && rightWrist.score > CONF && rightShoulder.score > CONF) {
      if (rightWrist.y < rightShoulder.y - 0.15) {
        return "Raising right hand to signal attention or ask a question";
      }
    }
    
    if (leftWrist && leftShoulder && leftWrist.score > CONF && leftShoulder.score > CONF) {
      if (leftWrist.y < leftShoulder.y - 0.15) {
        return "Raising left hand to signal attention or ask a question";
      }
    }

    // Pointing gesture
    if (rightWrist && rightElbow && rightShoulder && 
        rightWrist.score > CONF && rightElbow.score > CONF) {
      const armAngle = Math.atan2(rightWrist.y - rightElbow.y, rightWrist.x - rightElbow.x);
      if (rightWrist.x > rightElbow.x && Math.abs(armAngle) < 0.5) {
        return "Pointing to the right, directing attention";
      }
      if (rightWrist.x < rightElbow.x && Math.abs(Math.PI - Math.abs(armAngle)) < 0.5) {
        return "Pointing to the left, indicating direction";
      }
    }

    // Arms crossed - defensive or closed off
    if (leftWrist && rightWrist && leftShoulder && rightShoulder &&
        leftWrist.score > CONF && rightWrist.score > CONF) {
      if (leftWrist.x > rightShoulder.x && rightWrist.x < leftShoulder.x) {
        return "Arms crossed over chest, showing defensiveness or contemplation";
      }
    }

    // Hands on hips - confidence or authority
    if (leftWrist && rightWrist && leftHip && rightHip &&
        leftWrist.score > CONF && rightWrist.score > CONF) {
      const leftDist = Math.abs(leftWrist.x - leftHip.x) + Math.abs(leftWrist.y - leftHip.y);
      const rightDist = Math.abs(rightWrist.x - rightHip.x) + Math.abs(rightWrist.y - rightHip.y);
      if (leftDist < 0.2 && rightDist < 0.2) {
        return "Hands on hips, displaying confidence and authority";
      }
    }

    // Hand to face - thinking or uncertain
    if (nose && (leftWrist || rightWrist)) {
      if (rightWrist && rightWrist.score > CONF) {
        const distance = Math.sqrt(Math.pow(nose.x - rightWrist.x, 2) + Math.pow(nose.y - rightWrist.y, 2));
        if (distance < 0.18) {
          return "Hand near face, suggesting thinking or uncertainty";
        }
      }
      if (leftWrist && leftWrist.score > CONF) {
        const distance = Math.sqrt(Math.pow(nose.x - leftWrist.x, 2) + Math.pow(nose.y - leftWrist.y, 2));
        if (distance < 0.18) {
          return "Hand touching face, indicating contemplation or doubt";
        }
      }
    }

    // Open arms - welcoming or explaining
    if (leftWrist && rightWrist && leftShoulder && rightShoulder &&
        leftWrist.score > CONF && rightWrist.score > CONF) {
      const armSpan = Math.abs(leftWrist.x - rightWrist.x);
      const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x);
      if (armSpan > shoulderSpan * 1.7) {
        if (leftWrist.y > leftShoulder.y && rightWrist.y > rightShoulder.y) {
          return "Arms spread wide open, expressing welcome or emphasizing a point";
        }
        if (leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
          return "Arms raised and spread, showing excitement or celebration";
        }
      }
    }

    // Leaning forward - engagement
    if (nose && leftShoulder && rightShoulder && leftHip && rightHip &&
        nose.score > 0.6 && leftShoulder.score > CONF && rightShoulder.score > CONF) {
      const shoulderMid = { x: (leftShoulder.x + leftShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      
      if (nose.y > shoulderMid.y && Math.abs(nose.x - shoulderMid.x) < 0.15) {
        const vertDist = Math.abs(shoulderMid.y - hipMid.y);
        const horizDist = Math.abs(shoulderMid.x - hipMid.x);
        if (horizDist > vertDist * 0.15) {
          return "Leaning forward, showing active engagement and interest";
        }
      }
    }

    // Hands behind back - formal or reserved
    if (leftWrist && rightWrist && leftHip && rightHip &&
        leftWrist.score > CONF && rightWrist.score > CONF) {
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      if (leftWrist.y > hipMid.y && rightWrist.y > hipMid.y &&
          Math.abs(leftWrist.x - rightWrist.x) < 0.15) {
        return "Hands clasped behind back, displaying formal posture or restraint";
      }
    }

    // Fidgeting hands - nervousness
    if (lastPoseRef.current && leftWrist && rightWrist) {
      const lastLeftWrist = lastPoseRef.current.keypoints.find((kp: any) => kp.name === "left_wrist");
      const lastRightWrist = lastPoseRef.current.keypoints.find((kp: any) => kp.name === "right_wrist");
      
      if (lastLeftWrist && lastRightWrist && leftWrist.score > CONF && rightWrist.score > CONF) {
        const leftMovement = Math.sqrt(Math.pow(leftWrist.x - lastLeftWrist.x, 2) + Math.pow(leftWrist.y - lastLeftWrist.y, 2));
        const rightMovement = Math.sqrt(Math.pow(rightWrist.x - lastRightWrist.x, 2) + Math.pow(rightWrist.y - lastRightWrist.y, 2));
        
        if (leftMovement > 0.08 && rightMovement > 0.08) {
          return "Hands moving rapidly, indicating nervousness or restlessness";
        }
      }
    }

    // Slouching - low energy or disinterest
    if (leftShoulder && rightShoulder && leftHip && rightHip &&
        leftShoulder.score > CONF && rightShoulder.score > CONF) {
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      
      const vertDist = Math.abs(shoulderMid.y - hipMid.y);
      const horizDist = Math.abs(shoulderMid.x - hipMid.x);
      
      if (vertDist > 0 && horizDist / vertDist > 0.25) {
        return "Slouching posture, suggesting low energy or lack of interest";
      }
    }

    // Standing tall - confidence
    if (leftShoulder && rightShoulder && leftHip && rightHip &&
        leftShoulder.score > CONF && rightShoulder.score > CONF) {
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      
      const vertDist = Math.abs(shoulderMid.y - hipMid.y);
      const horizDist = Math.abs(shoulderMid.x - hipMid.x);
      
      if (vertDist > 0 && horizDist / vertDist < 0.1) {
        const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y);
        if (shoulderLevel < 0.05) {
          return "Standing upright with level shoulders, projecting confidence";
        }
      }
    }

    return "Maintaining neutral stance";
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

  const drawFaceMesh = (detections: any[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections && detections.length > 0) {
      setFaceTracking(true);
    } else {
      setFaceTracking(false);
    }
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

      // Calculate face bounding box with improved accuracy
      const faceLandmarks = ["nose", "left_eye", "right_eye", "left_ear", "right_ear"];
      const facePoints = faceLandmarks
        .map(name => getKeypoint(name))
        .filter(kp => kp && kp.score > 0.5);

      if (facePoints.length >= 3) {
        // Calculate raw bounding box
        const faceXs = facePoints.map((kp: any) => kp.x);
        const faceYs = facePoints.map((kp: any) => kp.y);
        const rawMinX = Math.min(...faceXs);
        const rawMaxX = Math.max(...faceXs);
        const rawMinY = Math.min(...faceYs);
        const rawMaxY = Math.max(...faceYs);

        // Calculate center and dimensions
        const centerX = (rawMinX + rawMaxX) / 2;
        const centerY = (rawMinY + rawMaxY) / 2;
        const rawWidth = rawMaxX - rawMinX;
        const rawHeight = rawMaxY - rawMinY;

        // Expand box to ensure full face coverage
        // Use aspect ratio to maintain proper proportions
        const targetAspectRatio = 0.85; // Slightly wider than tall for natural face shape
        let boxWidth = rawWidth * 2.2; // Expand to capture full face
        let boxHeight = rawHeight * 2.4;

        // Adjust dimensions to maintain aspect ratio
        if (boxWidth / boxHeight < targetAspectRatio) {
          boxWidth = boxHeight * targetAspectRatio;
        } else {
          boxHeight = boxWidth / targetAspectRatio;
        }

        // Create smooth box with center-based positioning
        const rawBox = {
          x: centerX - boxWidth / 2,
          y: centerY - boxHeight / 2,
          width: boxWidth,
          height: boxHeight
        };

        // Apply smoothing
        const smoothedBox = smoothFaceBox(rawBox);
        const { x: boxX, y: boxY, width: finalWidth, height: finalHeight } = smoothedBox;
        
        const cornerRadius = 10;

        // Draw lightweight face box with subtle styling
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(59, 130, 246, 0.4)";
        
        ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(boxX + cornerRadius, boxY);
        ctx.lineTo(boxX + finalWidth - cornerRadius, boxY);
        ctx.arcTo(boxX + finalWidth, boxY, boxX + finalWidth, boxY + cornerRadius, cornerRadius);
        ctx.lineTo(boxX + finalWidth, boxY + finalHeight - cornerRadius);
        ctx.arcTo(boxX + finalWidth, boxY + finalHeight, boxX + finalWidth - cornerRadius, boxY + finalHeight, cornerRadius);
        ctx.lineTo(boxX + cornerRadius, boxY + finalHeight);
        ctx.arcTo(boxX, boxY + finalHeight, boxX, boxY + finalHeight - cornerRadius, cornerRadius);
        ctx.lineTo(boxX, boxY + cornerRadius);
        ctx.arcTo(boxX, boxY, boxX + cornerRadius, boxY, cornerRadius);
        ctx.closePath();
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        // Draw lightweight adjective label
        ctx.font = "600 18px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        
        const textMetrics = ctx.measureText(adjective);
        const textWidth = textMetrics.width + 24;
        const textHeight = 32;
        const textX = boxX + finalWidth / 2;
        const textY = boxY - 10;

        // Subtle gradient background
        const bgGradient = ctx.createLinearGradient(textX - textWidth/2, textY - textHeight, textX + textWidth/2, textY);
        bgGradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
        bgGradient.addColorStop(0.5, "rgba(15, 15, 25, 0.85)");
        bgGradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
        
        ctx.fillStyle = bgGradient;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.moveTo(textX - textWidth/2 + 6, textY - textHeight);
        ctx.lineTo(textX + textWidth/2 - 6, textY - textHeight);
        ctx.arcTo(textX + textWidth/2, textY - textHeight, textX + textWidth/2, textY - textHeight + 6, 6);
        ctx.lineTo(textX + textWidth/2, textY - 6);
        ctx.arcTo(textX + textWidth/2, textY, textX + textWidth/2 - 6, textY, 6);
        ctx.lineTo(textX - textWidth/2 + 6, textY);
        ctx.arcTo(textX - textWidth/2, textY, textX - textWidth/2, textY - 6, 6);
        ctx.lineTo(textX - textWidth/2, textY - textHeight + 6);
        ctx.arcTo(textX - textWidth/2, textY - textHeight, textX - textWidth/2 + 6, textY - textHeight, 6);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;

        // Draw text with subtle glow
        ctx.shadowBlur = 3;
        ctx.shadowColor = "rgba(59, 130, 246, 0.6)";
        ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
        ctx.fillText(adjective, textX, textY - 7);
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
          if (!faceApiLoadedRef.current || !faceDetectorReady) return;
          
          // Detect faces with landmarks and expressions using face-api.js
          const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
              inputSize: 512,
              scoreThreshold: 0.5
            }))
            .withFaceLandmarks()
            .withFaceExpressions();

          if (detections && detections.length > 0) {
            drawFaceMesh(detections, overlayCanvas);
            setFaceTracking(true);

            // Update emotions from face-api.js (real-time, no API needed)
            const expressions = detections[0].expressions;
            setEmotions({
              neutral: Math.round(expressions.neutral * 100),
              happy: Math.round(expressions.happy * 100),
              surprise: Math.round(expressions.surprised * 100),
              angry: Math.round(expressions.angry * 100),
              disgust: Math.round(expressions.disgusted * 100),
              fear: Math.round(expressions.fearful * 100),
              sad: Math.round(expressions.sad * 100),
            });
          } else {
            setFaceTracking(false);
            const ctx = overlayCanvas.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }
        } else if (mode === "composure") {
          if (!detectorRef.current || !detectorReady) return;
          
          // Smart frame skipping: process every 2nd frame when stable for better performance
          const shouldProcess = !isStable || frameSkipCounterRef.current % 2 === 0;
          frameSkipCounterRef.current++;
          
          if (shouldProcess) {
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
        } else if (mode === "decoder") {
          if (!detectorRef.current || !detectorReady) return;
          
          const poses = await detectorRef.current.estimatePoses(video, {
            flipHorizontal: false,
          });

          if (poses && poses.length > 0) {
            const decodedText = decodeBodyLanguage(poses[0].keypoints);
            
            // Only add to history if it's a new action (not "Maintaining neutral stance")
            if (decodedText !== lastDecodedActionRef.current && decodedText !== "Maintaining neutral stance") {
              lastDecodedActionRef.current = decodedText;
              decodingHistoryRef.current.push(decodedText);
              setDecodedTexts([...decodingHistoryRef.current]);
            }
            
            setCurrentDecoding(decodedText);
            drawPoseLandmarks(poses, overlayCanvas);
            lastPoseRef.current = poses[0];
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



  // Note: Emotion detection is now done locally using face-api.js in the detection loop
  // No API calls needed - all processing happens in the browser!

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
      // Optimized video settings for mobile devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user", 
          width: { ideal: 640 },  // Lower resolution for better mobile performance
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);

        videoRef.current.onloadeddata = () => {
          // Start the detection loop for real-time analysis
          detectLoop();
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
    if (emotionIntervalRef.current) {
      clearInterval(emotionIntervalRef.current);
      emotionIntervalRef.current = null;
    }
    
    // Clear smoothing buffers for fresh start
    metricsHistoryRef.current = [];
    scoreHistoryRef.current = [];
    adjectiveStableRef.current = { adjective: "Neutral", score: 0 };
    faceBoxHistoryRef.current = [];
    lastDecodedActionRef.current = "";
    decodingHistoryRef.current = [];
    lastPoseRef.current = null;
    
    setIsStreaming(false);
    setFeedback([]);
    setMetrics([]);
    setFps(0);
    setFaceTracking(false);
    setCurrentGesture("Neutral");
    setCurrentAdjective("Neutral");
    setComposureScore(0);
    setIsStable(false);
    setDecodedTexts([]);
    setCurrentDecoding("");
    setEmotions({
      neutral: 0, happy: 0, surprise: 0, angry: 0, disgust: 0, fear: 0, sad: 0
    });
  };

  const switchMode = (newMode: AnalysisMode) => {
    stopCamera();
    setMode(newMode);
  };

  useEffect(() => {
    if (mode === "composure" || mode === "decoder") {
      initializePoseDetector();
    } else {
      initializeFaceDetector();
    }

    return () => {
      stopCamera();
      // Don't dispose detector - it's shared from cache
      detectorRef.current = null;
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
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="composure" data-testid="tab-composure">
                Composure
              </TabsTrigger>
              <TabsTrigger value="expressions" data-testid="tab-expressions">
                Expressions
              </TabsTrigger>
              <TabsTrigger value="decoder" data-testid="tab-decoder">
                Body Language Decoder
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
            {mode === "decoder" ? (
              <>
                <Card className="p-4 bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30">
                  <h2 className="text-lg font-semibold mb-3">Current Action</h2>
                  <div className="bg-black/40 rounded-lg p-4 min-h-[80px] flex items-center justify-center">
                    <p className="text-center text-white font-medium" data-testid="current-decoding">
                      {currentDecoding || "Waiting for movement..."}
                    </p>
                  </div>
                </Card>

                <Card className="p-4 bg-black/90 dark:bg-black/95">
                  <h2 className="text-lg font-semibold mb-3 text-white">Session History</h2>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto" data-testid="decoding-history">
                    {decodedTexts.length > 0 ? (
                      decodedTexts.map((text, index) => (
                        <div
                          key={index}
                          className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-lg p-3 border border-purple-500/20"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-purple-400 font-bold text-sm mt-0.5">#{index + 1}</span>
                            <p className="text-gray-200 text-sm flex-1">{text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">
                        {isStreaming ? "Tracking your movements..." : "Start camera to begin decoding"}
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="p-4 bg-black/90 dark:bg-black/95">
                  <h2 className="text-lg font-semibold mb-3 text-white">How It Works</h2>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>• Raise hands to signal attention</p>
                    <p>• Point to indicate direction</p>
                    <p>• Cross arms to show contemplation</p>
                    <p>• Hands on hips for confidence</p>
                    <p>• Open arms to express welcome</p>
                    <p>• Touch face when thinking</p>
                    <p>• Stand tall to project confidence</p>
                  </div>
                </Card>
              </>
            ) : mode === "composure" ? (
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
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}