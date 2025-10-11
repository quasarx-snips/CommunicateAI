import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Loader2, ArrowLeft, StopCircle, Activity, GraduationCap, Briefcase, AlertTriangle, Eye, Save, Download } from "lucide-react";
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
import { createLiveSession } from "@/lib/api";
import type { LiveSessionResult } from "@shared/schema";

type AnalysisMode = "education" | "interview" | "expressions";

interface EmotionData {
  neutral: number;
  happy: number;
  surprise: number;
  angry: number;
  disgust: number;
  fear: number;
  sad: number;
}

interface EducationMetrics {
  attentionScore: number;
  engagementLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH";
  distractionFlags: string[];
  focusQuality: number;
  participationIndicators: string[];
  learningReadiness: number;
}

interface InterviewMetrics {
  confidenceScore: number;
  professionalismLevel: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
  energyLevel: number;
  stressIndicators: string[];
  authenticityScore: number;
  communicationQuality: number;
  bodyLanguageStrengths: string[];
  improvementAreas: string[];
}

export default function LiveAnalysis() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AnalysisMode>("education");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<{ label: string; value: number; color: string }[]>([]);
  const [fps, setFps] = useState(0);
  const [detectorReady, setDetectorReady] = useState(false);
  const [faceDetectorReady, setFaceDetectorReady] = useState(false);

  // Education Mode State
  const [educationMetrics, setEducationMetrics] = useState<EducationMetrics>({
    attentionScore: 0,
    engagementLevel: "MEDIUM",
    distractionFlags: [],
    focusQuality: 0,
    participationIndicators: [],
    learningReadiness: 0
  });

  // Interview Mode State
  const [interviewMetrics, setInterviewMetrics] = useState<InterviewMetrics>({
    confidenceScore: 0,
    professionalismLevel: "FAIR",
    energyLevel: 0,
    stressIndicators: [],
    authenticityScore: 0,
    communicationQuality: 0,
    bodyLanguageStrengths: [],
    improvementAreas: []
  });

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

  // Session recording state
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const metricsTimelineRef = useRef<Array<{ timestamp: number; metrics: Array<{ label: string; value: number }> }>>([]);
  const sessionPeakMetricsRef = useRef<Record<string, number>>({});

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
  const frameSkipCounterRef = useRef(0);
  const lastPoseRef = useRef<any>(null);
  const performanceStatsRef = useRef<{ frameTime: number; poseTime: number; faceTime: number }>({ frameTime: 0, poseTime: 0, faceTime: 0 });

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



  // ADVANCED FACE ANALYSIS HELPERS
  const lastHeadPositionRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const headMovementHistoryRef = useRef<Array<{ vertical: number; horizontal: number }>>([]);
  const eyeAspectRatioHistoryRef = useRef<number[]>([]);
  const gazeHistoryRef = useRef<string[]>([]);

  const analyzeHeadMovement = (landmarks: any): { nodding: boolean; shaking: boolean; tilt: number } => {
    if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) {
      return { nodding: false, shaking: false, tilt: 0 };
    }

    const positions = landmarks.positions;
    const nose = positions[30];
    const leftEye = positions[36];
    const rightEye = positions[45];

    const currentHead = {
      x: nose.x,
      y: nose.y,
      z: (leftEye.x + rightEye.x) / 2
    };

    if (lastHeadPositionRef.current) {
      const verticalMovement = currentHead.y - lastHeadPositionRef.current.y;
      const horizontalMovement = currentHead.x - lastHeadPositionRef.current.x;

      headMovementHistoryRef.current.push({ vertical: verticalMovement, horizontal: horizontalMovement });
      if (headMovementHistoryRef.current.length > 10) {
        headMovementHistoryRef.current.shift();
      }

      if (headMovementHistoryRef.current.length >= 6) {
        const recentVertical = headMovementHistoryRef.current.slice(-6);
        const verticalChanges = recentVertical.filter((m, i) => {
          if (i === 0) return false;
          return (m.vertical > 0) !== (recentVertical[i - 1].vertical > 0);
        }).length;
        const nodding = verticalChanges >= 3 && Math.abs(recentVertical[recentVertical.length - 1].vertical) > 3;

        const recentHorizontal = headMovementHistoryRef.current.slice(-6);
        const horizontalChanges = recentHorizontal.filter((m, i) => {
          if (i === 0) return false;
          return (m.horizontal > 0) !== (recentHorizontal[i - 1].horizontal > 0);
        }).length;
        const shaking = horizontalChanges >= 3 && Math.abs(recentHorizontal[recentHorizontal.length - 1].horizontal) > 3;

        const eyeY = (leftEye.y + rightEye.y) / 2;
        const tilt = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

        lastHeadPositionRef.current = currentHead;
        return { nodding, shaking, tilt };
      }
    }

    lastHeadPositionRef.current = currentHead;
    return { nodding: false, shaking: false, tilt: 0 };
  };

  const analyzeGazeDirection = (landmarks: any): string => {
    if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) {
      return "center";
    }

    const positions = landmarks.positions;
    const nose = positions[30];
    const leftEye = positions[36];
    const rightEye = positions[45];
    const leftEyeInner = positions[39];
    const rightEyeInner = positions[42];

    const eyeCenter = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const faceCenter = { x: (leftEyeInner.x + rightEyeInner.x) / 2, y: nose.y };

    const gazeOffsetX = nose.x - eyeCenter.x;
    const gazeOffsetY = nose.y - eyeCenter.y;

    let gaze = "center";
    if (Math.abs(gazeOffsetX) > 15) {
      gaze = gazeOffsetX > 0 ? "right" : "left";
    }
    if (Math.abs(gazeOffsetY) > 15) {
      gaze = gazeOffsetY > 0 ? "down" : "up";
    }

    gazeHistoryRef.current.push(gaze);
    if (gazeHistoryRef.current.length > 30) {
      gazeHistoryRef.current.shift();
    }

    return gaze;
  };

  const calculateEyeAspectRatio = (landmarks: any): { left: number; right: number; average: number; blinking: boolean } => {
    if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) {
      return { left: 0, right: 0, average: 0, blinking: false };
    }

    const positions = landmarks.positions;

    const leftEyeVertical1 = Math.abs(positions[37].y - positions[41].y);
    const leftEyeVertical2 = Math.abs(positions[38].y - positions[40].y);
    const leftEyeHorizontal = Math.abs(positions[36].x - positions[39].x);
    const leftEAR = (leftEyeVertical1 + leftEyeVertical2) / (2 * leftEyeHorizontal);

    const rightEyeVertical1 = Math.abs(positions[43].y - positions[47].y);
    const rightEyeVertical2 = Math.abs(positions[44].y - positions[46].y);
    const rightEyeHorizontal = Math.abs(positions[42].x - positions[45].x);
    const rightEAR = (rightEyeVertical1 + rightEyeVertical2) / (2 * rightEyeHorizontal);

    const avgEAR = (leftEAR + rightEAR) / 2;

    eyeAspectRatioHistoryRef.current.push(avgEAR);
    if (eyeAspectRatioHistoryRef.current.length > 15) {
      eyeAspectRatioHistoryRef.current.shift();
    }

    const blinking = avgEAR < 0.2 && eyeAspectRatioHistoryRef.current.length > 3;

    return { left: leftEAR, right: rightEAR, average: avgEAR, blinking };
  };

  const analyzeMicroExpressions = (expressions: any): { fearScore: number; stressScore: number; authenticityScore: number } => {
    if (!expressions) {
      return { fearScore: 0, stressScore: 0, authenticityScore: 70 };
    }

    const fearScore = Math.round((expressions.fearful || 0) * 100);
    const angerScore = Math.round((expressions.angry || 0) * 100);
    const disgustScore = Math.round((expressions.disgusted || 0) * 100);

    const stressScore = Math.min(100, fearScore + angerScore + disgustScore);

    const happyScore = Math.round((expressions.happy || 0) * 100);
    const neutralScore = Math.round((expressions.neutral || 0) * 100);
    const authenticityScore = Math.max(0, 100 - Math.abs(happyScore - 30) - Math.abs(neutralScore - 40));

    return { fearScore, stressScore, authenticityScore };
  };

  const analyzeEnergyLevel = (keypoints: any[], expressions: any, headMovement: any): number => {
    let energyLevel = 50;

    const getKeypoint = (name: string) => keypoints.find((kp: any) => kp.name === name);
    const leftWrist = getKeypoint("left_wrist");
    const rightWrist = getKeypoint("right_wrist");
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");

    if (leftWrist && rightWrist && leftShoulder && rightShoulder) {
      const wristMovement = lastPoseRef.current ?
        Math.sqrt(
          Math.pow((leftWrist.x - (lastPoseRef.current.keypoints.find((k: any) => k.name === "left_wrist")?.x || leftWrist.x)), 2) +
          Math.pow((rightWrist.x - (lastPoseRef.current.keypoints.find((k: any) => k.name === "right_wrist")?.x || rightWrist.x)), 2)
        ) : 0;

      if (wristMovement > 0.05) energyLevel += 20;

      if (leftWrist.y < leftShoulder.y || rightWrist.y < rightShoulder.y) {
        energyLevel += 15;
      }
    }

    if (headMovement && headMovement.nodding) {
      energyLevel += 10;
    }

    if (expressions) {
      const happyScore = (expressions.happy || 0) * 100;
      const surpriseScore = (expressions.surprised || 0) * 100;
      energyLevel += Math.min(20, (happyScore + surpriseScore) / 10);
    }

    return Math.max(0, Math.min(100, energyLevel));
  };

  // EDUCATION MODE: Attention & Engagement Tracking
  const analyzeEducationBehavior = (keypoints: any[], expressions?: any, faceLandmarks?: any): EducationMetrics => {
    const getKeypoint = (name: string) => keypoints.find((kp) => kp.name === name);

    const nose = getKeypoint("nose");
    const leftEye = getKeypoint("left_eye");
    const rightEye = getKeypoint("right_eye");
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");
    const leftWrist = getKeypoint("left_wrist");
    const rightWrist = getKeypoint("right_wrist");
    const leftHip = getKeypoint("left_hip");
    const rightHip = getKeypoint("right_hip");
    const leftElbow = getKeypoint("left_elbow");
    const rightElbow = getKeypoint("right_elbow");

    const CONF = 0.5;
    let attentionScore = 100;
    const distractionFlags: string[] = [];
    const participationIndicators: string[] = [];

    // 1. EYE CONTACT & GAZE DIRECTION - Focus on material
    if (nose && leftEye && rightEye && leftShoulder && rightShoulder) {
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2 };
      const faceDeviation = Math.abs(nose.x - shoulderMid.x);

      if (faceDeviation > 0.15) {
        attentionScore -= 25;
        distractionFlags.push("Looking away from screen");
      } else {
        participationIndicators.push("Focused on material");
      }

      // Eye level check (looking down at phone/notes)
      if (nose.y > leftShoulder.y + 0.12) {
        attentionScore -= 20;
        distractionFlags.push("Head down - possible distraction");
      }
    }

    // 2. NODDING & HEAD MOVEMENT - Acknowledgment and understanding
    if (nose && lastPoseRef.current) {
      const lastNose = lastPoseRef.current.keypoints.find((kp: any) => kp.name === "nose");
      if (lastNose && nose.score > 0.6) {
        const verticalMovement = Math.abs(nose.y - lastNose.y);
        // Nodding (vertical head movement)
        if (verticalMovement > 0.05 && verticalMovement < 0.15) {
          attentionScore = Math.min(100, attentionScore + 10);
          participationIndicators.push("Nodding - showing understanding");
        }
        // Excessive head shaking (confusion/disagreement)
        const horizontalMovement = Math.abs(nose.x - lastNose.x);
        if (horizontalMovement > 0.1) {
          attentionScore -= 8;
          distractionFlags.push("Head shaking - possible confusion");
        }
      }
    }

    // 3. HAND GESTURES - Writing, raising hand, or distracted?
    if (leftWrist && rightWrist && leftShoulder && rightShoulder) {
      // Hand raised (participation)
      if (rightWrist.y < rightShoulder.y - 0.15 || leftWrist.y < leftShoulder.y - 0.15) {
        attentionScore = Math.min(100, attentionScore + 20);
        participationIndicators.push("Hand raised - actively participating");
      }

      // Note-taking position (hands in front, writing)
      if (leftElbow && rightElbow && leftWrist.score > CONF && rightWrist.score > CONF) {
        const handsInFront = leftWrist.y > leftElbow.y && rightWrist.y > rightElbow.y;
        const closeToBody = Math.abs(leftWrist.x - rightWrist.x) < 0.3;
        if (handsInFront && closeToBody) {
          attentionScore = Math.min(100, attentionScore + 15);
          participationIndicators.push("Taking notes - engaged");
        }
      }

      // Hands on face (boredom/tiredness)
      if (nose && rightWrist.score > CONF) {
        const distance = Math.sqrt(Math.pow(nose.x - rightWrist.x, 2) + Math.pow(nose.y - rightWrist.y, 2));
        if (distance < 0.15) {
          attentionScore -= 15;
          distractionFlags.push("Hand on face - losing focus");
        }
      }

      // Hands below desk level (phone usage)
      if (leftHip && rightHip && leftWrist.y > leftHip.y && rightWrist.y > rightHip.y) {
        attentionScore -= 20;
        distractionFlags.push("Hands below desk - possible device use");
      }
    }

    // 4. POSTURE ENGAGEMENT - Leaning forward shows interest
    if (leftShoulder && rightShoulder && leftHip && rightHip && nose) {
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };

      const vertDist = Math.abs(shoulderMid.y - hipMid.y);
      const horizDist = Math.abs(shoulderMid.x - hipMid.x);

      if (horizDist > vertDist * 0.12 && nose.y > shoulderMid.y) {
        attentionScore = Math.min(100, attentionScore + 15);
        participationIndicators.push("Leaning forward - engaged");
      }
    }

    // 5. EMOTIONAL ENGAGEMENT
    if (expressions) {
      if (expressions.happy > 0.4 || expressions.surprised > 0.4) {
        attentionScore = Math.min(100, attentionScore + 10);
        participationIndicators.push("Positive emotional response");
      }
      if (expressions.neutral > 0.7 && expressions.happy < 0.1) {
        attentionScore -= 10;
        distractionFlags.push("Flat affect - possible disengagement");
      }
    }

    // 6. FIDGETING DETECTION
    if (lastPoseRef.current && leftWrist && rightWrist) {
      const lastLeftWrist = lastPoseRef.current.keypoints.find((kp: any) => kp.name === "left_wrist");
      const lastRightWrist = lastPoseRef.current.keypoints.find((kp: any) => kp.name === "right_wrist");

      if (lastLeftWrist && lastRightWrist) {
        const movement = Math.sqrt(
          Math.pow(leftWrist.x - lastLeftWrist.x, 2) + Math.pow(rightWrist.x - lastRightWrist.x, 2)
        );

        if (movement > 0.1) {
          attentionScore -= 15;
          distractionFlags.push("Excessive fidgeting detected");
        }
      }
    }

    // 7. ADVANCED FACE ANALYSIS - Attention and engagement indicators
    if (faceLandmarks) {
      const headMovement = analyzeHeadMovement(faceLandmarks);
      const gazeDirection = analyzeGazeDirection(faceLandmarks);
      const eyeData = calculateEyeAspectRatio(faceLandmarks);

      // Nodding (understanding/agreement indicator)
      if (headMovement.nodding) {
        attentionScore = Math.min(100, attentionScore + 15);
        participationIndicators.push("Nodding - showing understanding");
      }

      // Direct gaze (focused attention)
      if (gazeDirection === "center") {
        attentionScore = Math.min(100, attentionScore + 10);
        participationIndicators.push("Focused gaze - high attention");
      } else {
        attentionScore -= 12;
        distractionFlags.push(`Looking ${gazeDirection} - distracted`);
      }

      // Eye aspect ratio (drowsiness/fatigue detection)
      if (eyeData.average < 0.25 && !eyeData.blinking) {
        attentionScore -= 20;
        distractionFlags.push("Drowsy eyes - low alertness");
      }

      // Head tilt (confusion or disengagement)
      if (Math.abs(headMovement.tilt) > 15) {
        attentionScore -= 8;
        distractionFlags.push("Head tilted - possible confusion");
      }
    }

    // Calculate engagement level
    let engagementLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH" = "MEDIUM";
    if (attentionScore >= 85) engagementLevel = "VERY HIGH";
    else if (attentionScore >= 65) engagementLevel = "HIGH";
    else if (attentionScore >= 40) engagementLevel = "MEDIUM";
    else engagementLevel = "LOW";

    // Focus quality (0-100)
    const focusQuality = Math.max(0, Math.min(100, attentionScore));

    // Learning readiness (combines attention, posture, and emotional state)
    const learningReadiness = Math.max(0, Math.min(100, attentionScore - distractionFlags.length * 5));

    return {
      attentionScore: Math.max(0, Math.min(100, attentionScore)),
      engagementLevel,
      distractionFlags: distractionFlags.slice(0, 4),
      focusQuality,
      participationIndicators: participationIndicators.slice(0, 4),
      learningReadiness
    };
  };

  // INTERVIEW MODE: Confidence, Professionalism & Communication Quality
  const analyzeInterviewBehavior = (keypoints: any[], expressions?: any, faceLandmarks?: any): InterviewMetrics => {
    const getKeypoint = (name: string) => keypoints.find((kp) => kp.name === name);

    const nose = getKeypoint("nose");
    const leftEye = getKeypoint("left_eye");
    const rightEye = getKeypoint("right_eye");
    const leftShoulder = getKeypoint("left_shoulder");
    const rightShoulder = getKeypoint("right_shoulder");
    const leftWrist = getKeypoint("left_wrist");
    const rightWrist = getKeypoint("right_wrist");
    const leftHip = getKeypoint("left_hip");
    const rightHip = getKeypoint("right_hip");

    const CONF = 0.5;
    let confidenceScore = 50;
    let energyLevel = 50;
    let authenticityScore = 70;
    let communicationQuality = 60;
    const stressIndicators: string[] = [];
    const strengths: string[] = [];
    const improvements: string[] = [];

    // 1. POSTURE CONFIDENCE
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      // Shoulder level (confidence indicator)
      const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y);
      if (shoulderLevel < 0.05) {
        confidenceScore += 15;
        strengths.push("Level shoulders - confident posture");
      } else {
        confidenceScore -= 10;
        improvements.push("Level your shoulders for stronger presence");
      }

      // Upright posture
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      const vertDist = Math.abs(shoulderMid.y - hipMid.y);
      const horizDist = Math.abs(shoulderMid.x - hipMid.x);

      const uprightness = vertDist / Math.sqrt(vertDist * vertDist + horizDist * horizDist);
      if (uprightness > 0.95) {
        confidenceScore += 20;
        strengths.push("Excellent upright posture");
      } else if (uprightness < 0.85) {
        confidenceScore -= 15;
        improvements.push("Sit/stand more upright");
      }
    }

    // 2. EYE CONTACT & FACE DIRECTION
    if (nose && leftEye && rightEye && leftShoulder && rightShoulder) {
      const shoulderMid = { x: (leftShoulder.x + rightShoulder.x) / 2 };
      const faceDeviation = Math.abs(nose.x - shoulderMid.x);

      if (faceDeviation < 0.1) {
        confidenceScore += 15;
        communicationQuality += 20;
        strengths.push("Direct eye contact maintained");
      } else {
        confidenceScore -= 10;
        communicationQuality -= 15;
        improvements.push("Maintain direct eye contact");
      }
    }

    // 3. HAND GESTURES - Natural vs. Nervous
    if (leftWrist && rightWrist && leftShoulder && rightShoulder) {
      // Open hand gestures (confidence)
      const armSpan = Math.abs(leftWrist.x - rightWrist.x);
      const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x);

      if (armSpan > shoulderSpan * 1.2 && leftWrist.y < leftShoulder.y + 0.1) {
        confidenceScore += 15;
        energyLevel += 20;
        strengths.push("Expressive hand gestures - engaging");
      }

      // Fidgeting detection
      if (lastPoseRef.current) {
        const lastLeftWrist = lastPoseRef.current.keypoints.find((kp: any) => kp.name === "left_wrist");
        const lastRightWrist = lastPoseRef.current.keypoints.find((kp: any) => kp.name === "right_wrist");

        if (lastLeftWrist && lastRightWrist) {
          const movement = Math.sqrt(
            Math.pow(leftWrist.x - lastLeftWrist.x, 2) + Math.pow(rightWrist.y - lastRightWrist.y, 2)
          );

          if (movement > 0.15) {
            confidenceScore -= 15;
            stressIndicators.push("Excessive hand movement - nervousness");
            authenticityScore -= 10;
          }
        }
      }

      // Hand-to-face (stress indicator)
      if (nose && rightWrist.score > CONF) {
        const distance = Math.sqrt(Math.pow(nose.x - rightWrist.x, 2) + Math.pow(nose.y - rightWrist.y, 2));
        if (distance < 0.15) {
          confidenceScore -= 20;
          stressIndicators.push("Touching face - stress indicator");
        }
      }
    }

    // 4. EMOTIONAL AUTHENTICITY
    if (expressions) {
      // Genuine smile (Duchenne marker)
      if (expressions.happy > 0.5) {
        authenticityScore += 15;
        energyLevel += 15;
        strengths.push("Positive, approachable demeanor");
      }

      // Stress/anxiety markers
      if (expressions.fear > 0.4 || expressions.surprised > 0.5) {
        confidenceScore -= 15;
        stressIndicators.push("Anxiety detected in facial expression");
        authenticityScore -= 15;
      }

      // Anger/frustration
      if (expressions.angry > 0.3 || expressions.disgust > 0.3) {
        communicationQuality -= 20;
        stressIndicators.push("Negative emotion detected");
      }

      // Over-controlled (too neutral can seem inauthentic)
      if (expressions.neutral > 0.8) {
        authenticityScore -= 10;
        improvements.push("Show more natural expressions");
      }
    }

    // 5. ENERGY & ENGAGEMENT
    if (leftShoulder && rightShoulder && nose) {
      // Leaning forward (engagement)
      const shoulderMid = { y: (leftShoulder.y + rightShoulder.y) / 2 };
      if (nose.y > shoulderMid.y + 0.05) {
        energyLevel += 15;
        strengths.push("Engaged and attentive body language");
      }
    }

    // 6. ADVANCED FACE ANALYSIS - Confidence and communication indicators
    if (faceLandmarks) {
      const headMovement = analyzeHeadMovement(faceLandmarks);
      const gazeDirection = analyzeGazeDirection(faceLandmarks);
      const eyeData = calculateEyeAspectRatio(faceLandmarks);
      const microExp = analyzeMicroExpressions(expressions);

      // Direct gaze (confidence indicator)
      if (gazeDirection === "center") {
        confidenceScore += 15;
        communicationQuality += 15;
        strengths.push("Strong eye contact - confident presence");
      } else {
        confidenceScore -= 12;
        communicationQuality -= 12;
        improvements.push("Maintain direct eye contact");
      }

      // Nodding (active listening/agreement)
      if (headMovement.nodding) {
        communicationQuality += 10;
        energyLevel += 8;
        strengths.push("Nodding - active listening");
      }

      // Head shaking (disagreement/uncertainty)
      if (headMovement.shaking) {
        confidenceScore -= 8;
        stressIndicators.push("Head shaking - uncertainty detected");
      }

      // Stress and authenticity micro-expressions
      if (microExp.stressScore > 50) {
        confidenceScore -= 15;
        stressIndicators.push("High stress micro-expressions");
      }

      if (microExp.authenticityScore < 50) {
        authenticityScore = Math.min(authenticityScore, microExp.authenticityScore);
        improvements.push("Show more natural expressions");
      } else {
        authenticityScore = Math.max(authenticityScore, microExp.authenticityScore);
        strengths.push("Authentic emotional expressions");
      }

      // Energy level based on facial cues and movement
      const faceEnergyBoost = analyzeEnergyLevel(keypoints, expressions, headMovement);
      energyLevel = Math.max(energyLevel, faceEnergyBoost);
    }

    // 7. PROFESSIONALISM SCORING
    let professionalismLevel: "POOR" | "FAIR" | "GOOD" | "EXCELLENT" = "FAIR";
    const overallScore = (confidenceScore + communicationQuality + authenticityScore) / 3;

    if (overallScore >= 80) professionalismLevel = "EXCELLENT";
    else if (overallScore >= 65) professionalismLevel = "GOOD";
    else if (overallScore >= 45) professionalismLevel = "FAIR";
    else professionalismLevel = "POOR";

    return {
      confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
      professionalismLevel,
      energyLevel: Math.max(0, Math.min(100, energyLevel)),
      stressIndicators: stressIndicators.slice(0, 4),
      authenticityScore: Math.max(0, Math.min(100, authenticityScore)),
      communicationQuality: Math.max(0, Math.min(100, communicationQuality)),
      bodyLanguageStrengths: strengths.slice(0, 4),
      improvementAreas: improvements.slice(0, 4)
    };
  };



  const drawPoseLandmarks = (poses: any[], canvas: HTMLCanvasElement, scaleX: number = 1, scaleY: number = 1) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !poses.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply coordinate scaling for proper overlay alignment
    ctx.save();
    ctx.scale(scaleX, scaleY);

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

      // Thin skeletal lines matching the screenshot
      connections.forEach(([start, end]) => {
        const startKp = keypoints.find((kp: any) => kp.name === start);
        const endKp = keypoints.find((kp: any) => kp.name === end);

        if (startKp && endKp && startKp.score > 0.3 && endKp.score > 0.3) {
          ctx.beginPath();
          ctx.moveTo(startKp.x, startKp.y);
          ctx.lineTo(endKp.x, endKp.y);
          ctx.strokeStyle = "rgba(147, 51, 234, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // Small, clean keypoint dots
      keypoints.forEach((keypoint: any) => {
        if (keypoint.score > 0.3) {
          // Small circular keypoint
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = keypoint.score > 0.6 ? "rgba(147, 51, 234, 0.9)" : "rgba(168, 85, 247, 0.7)";
          ctx.fill();

          // Center highlight dot
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 1.5, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();
        }
      });
    });

    ctx.restore();
  };

  const drawFaceMesh = (detections: any[], canvas: HTMLCanvasElement, scaleX: number = 1, scaleY: number = 1) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections && detections.length > 0) {
      setFaceTracking(true);

      detections.forEach((detection: any) => {
        const landmarks = detection.landmarks;
        const positions = landmarks.positions;

        // Enhanced mesh with all-to-all connections
        ctx.strokeStyle = "rgba(34, 197, 94, 0.3)";
        ctx.lineWidth = 1;

        // Draw connections between ALL dots for complete mesh
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const distance = Math.sqrt(
              Math.pow(positions[i].x - positions[j].x, 2) +
              Math.pow(positions[i].y - positions[j].y, 2)
            );

            // Only connect nearby points to avoid clutter (within 80 pixels)
            if (distance < 80) {
              ctx.beginPath();
              ctx.moveTo(positions[i].x * scaleX, positions[i].y * scaleY);
              ctx.lineTo(positions[j].x * scaleX, positions[j].y * scaleY);
              ctx.stroke();
            }
          }
        }

        // Draw enhanced dots with better visibility
        positions.forEach((point: any) => {
          const x = point.x * scaleX;
          const y = point.y * scaleY;

          // Outer glow
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(34, 197, 94, 0.4)";
          ctx.fill();

          // Main dot
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
          ctx.fill();

          // Center highlight
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();
        });
      });
    } else {
      setFaceTracking(false);
    }
  };

  // EDUCATION MODE VISUALIZATION
  const drawEducationOverlay = (poses: any[], canvas: HTMLCanvasElement, metrics: EducationMetrics, scaleX: number = 1, scaleY: number = 1) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !poses.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply coordinate scaling for proper overlay alignment
    ctx.save();
    ctx.scale(scaleX, scaleY);

    const pose = poses[0];
    const keypoints = pose.keypoints;

    // Engagement color coding
    const engagementColors = {
      "VERY HIGH": "rgba(34, 197, 94, 0.9)",
      "HIGH": "rgba(59, 130, 246, 0.9)",
      "MEDIUM": "rgba(234, 179, 8, 0.9)",
      "LOW": "rgba(239, 68, 68, 0.9)"
    };

    const color = engagementColors[metrics.engagementLevel];

    // Complete skeletal visualization
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

    // THICK, DARK skeletal lines
    connections.forEach(([start, end]) => {
      const startKp = keypoints.find((kp: any) => kp.name === start);
      const endKp = keypoints.find((kp: any) => kp.name === end);

      if (startKp && endKp && startKp.score > 0.4 && endKp.score > 0.4) {
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = color.replace('0.9', '1'); // Full opacity
        ctx.lineWidth = 4; // Even thicker
        ctx.stroke();
      }
    });

    // Larger, more visible keypoints
    keypoints.forEach((kp: any) => {
      if (kp.score > 0.4) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI); // Bigger
        ctx.fillStyle = color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI); // Bigger highlight
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fill();
      }
    });


    // Attention score display
    const scoreText = `${metrics.engagementLevel} - ${metrics.attentionScore}%`;
    ctx.font = "bold 22px Inter, sans-serif";
    ctx.textAlign = "center";

    const textWidth = ctx.measureText(scoreText).width + 40;
    const textX = canvas.width / 2;
    const textY = 50;

    ctx.fillStyle = color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.roundRect(textX - textWidth/2, textY - 32, textWidth, 45, 10);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "white";
    ctx.fillText(scoreText, textX, textY);

    ctx.restore();
  };

  // INTERVIEW MODE VISUALIZATION
  const drawInterviewOverlay = (poses: any[], canvas: HTMLCanvasElement, metrics: InterviewMetrics, scaleX: number = 1, scaleY: number = 1) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !poses.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply coordinate scaling for proper overlay alignment
    ctx.save();
    ctx.scale(scaleX, scaleY);

    const pose = poses[0];
    const keypoints = pose.keypoints;

    // Professionalism color coding
    const profColors = {
      "EXCELLENT": "rgba(34, 197, 94, 0.9)",
      "GOOD": "rgba(59, 130, 246, 0.9)",
      "FAIR": "rgba(234, 179, 8, 0.9)",
      "POOR": "rgba(239, 68, 68, 0.9)"
    };

    const color = profColors[metrics.professionalismLevel];

    // Premium skeletal overlay
    const connections = [
      ["nose", "left_eye"],
      ["nose", "right_eye"],
      ["left_shoulder", "right_shoulder"],
      ["left_shoulder", "left_elbow"],
      ["right_shoulder", "right_elbow"],
      ["left_elbow", "left_wrist"],
      ["right_elbow", "right_wrist"],
      ["left_shoulder", "left_hip"],
      ["right_shoulder", "right_hip"],
      ["left_hip", "right_hip"],
    ];

    // THICK, DARK skeletal lines
    connections.forEach(([start, end]) => {
      const startKp = keypoints.find((kp: any) => kp.name === start);
      const endKp = keypoints.find((kp: any) => kp.name === end);

      if (startKp && endKp && startKp.score > 0.4 && endKp.score > 0.4) {
        ctx.beginPath();
        ctx.moveTo(startKp.x, startKp.y);
        ctx.lineTo(endKp.x, endKp.y);
        ctx.strokeStyle = color.replace('0.9', '1'); // Full opacity
        ctx.lineWidth = 4; // Even thicker
        ctx.stroke();
      }
    });

    // Larger, more visible keypoints
    keypoints.forEach((kp: any) => {
      if (kp.score > 0.4) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI); // Bigger
        ctx.fillStyle = color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI); // Bigger highlight
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fill();
      }
    });

    // Professionalism display
    const scoreText = `${metrics.professionalismLevel} - ${metrics.confidenceScore}%`;
    ctx.font = "bold 22px Inter, sans-serif";
    ctx.textAlign = "center";

    const textWidth = ctx.measureText(scoreText).width + 40;
    const textX = canvas.width / 2;
    const textY = 50;

    ctx.fillStyle = color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.roundRect(textX - textWidth/2, textY - 32, textWidth, 45, 10);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "white";
    ctx.fillText(scoreText, textX, textY);

    ctx.restore();
  };




  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !overlayCanvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;

    if (video.readyState === 4) {
      // Match canvas to video's actual dimensions, not display size
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (overlayCanvas.width !== videoWidth || overlayCanvas.height !== videoHeight) {
        overlayCanvas.width = videoWidth;
        overlayCanvas.height = videoHeight;
      }

      // No scaling needed - 1:1 mapping
      const scaleX = 1;
      const scaleY = 1;

      try {
        if (mode === "education" || mode === "interview") {
          if (!detectorRef.current || !detectorReady) return;

          // Adaptive frame skipping based on current FPS (target: 30 FPS minimum)
          const targetFPS = 30;
          const currentFPS = fps > 0 ? fps : 30;
          const skipFrames = currentFPS < targetFPS ? 1 : Math.floor(currentFPS / targetFPS);
          const currentFrameCount = frameSkipCounterRef.current;
          const shouldProcess = currentFrameCount % Math.max(1, skipFrames) === 0;
          // Check for face detection BEFORE incrementing (so alternating works correctly)
          const runFaceDetection = currentFrameCount % 4 === 0; // Run face detection every 4th frame
          frameSkipCounterRef.current++;

          if (shouldProcess) {
            const frameStart = performance.now();

            // Pose detection with timing
            const poseStart = performance.now();
            const poses = await detectorRef.current.estimatePoses(video, {
              flipHorizontal: false,
            });
            performanceStatsRef.current.poseTime = performance.now() - poseStart;

            // Optimized facial analysis (run less frequently for better performance)
            let expressions = null;
            let faceLandmarks = null;

            if (faceApiLoadedRef.current && faceDetectorReady && runFaceDetection) {
              const faceStart = performance.now();
              const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
                  inputSize: 224, // Reduced from 512 for better performance
                  scoreThreshold: 0.4 // Slightly lower for better detection
                }))
                .withFaceLandmarks()
                .withFaceExpressions();

              performanceStatsRef.current.faceTime = performance.now() - faceStart;

              if (detections && detections.length > 0) {
                expressions = detections[0].expressions;
                faceLandmarks = detections[0].landmarks;
                setFaceTracking(true);
              } else {
                setFaceTracking(false);
              }
            }

            if (poses && poses.length > 0) {
              if (mode === "education") {
                const eduMetrics = analyzeEducationBehavior(poses[0].keypoints, expressions, faceLandmarks);
                setEducationMetrics(eduMetrics);

                // Visual feedback
                drawEducationOverlay(poses, overlayCanvas, eduMetrics, scaleX, scaleY);
              } else if (mode === "interview") {
                const intMetrics = analyzeInterviewBehavior(poses[0].keypoints, expressions, faceLandmarks);
                setInterviewMetrics(intMetrics);

                // Visual feedback
                drawInterviewOverlay(poses, overlayCanvas, intMetrics, scaleX, scaleY);
              }

              lastPoseRef.current = poses[0];
            } else {
              const ctx = overlayCanvas.getContext("2d");
              if (ctx) ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            }
          }
        } else if (mode === "expressions") {
          if (!faceApiLoadedRef.current || !faceDetectorReady) return;

          // Optimized face detection for expressions mode
          const frameStart = performance.now();
          const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
              inputSize: 256, // Optimized size for better performance
              scoreThreshold: 0.4 // Balanced detection threshold
            }))
            .withFaceLandmarks()
            .withFaceExpressions();

          performanceStatsRef.current.faceTime = performance.now() - frameStart;

          if (detections && detections.length > 0) {
            drawFaceMesh(detections, overlayCanvas, scaleX, scaleY);
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

  // Session recording functions
  const captureThumbnail = (): string | null => {
    const video = videoRef.current;
    if (!video) return null;

    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = 320;
    thumbnailCanvas.height = 240;
    const ctx = thumbnailCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    return thumbnailCanvas.toDataURL('image/jpeg', 0.8);
  };

  const calculateSessionSummary = (): LiveSessionResult => {
    const avgMetrics = metrics.map(m => ({ label: m.label, value: m.value, color: m.color }));
    const overallScore = metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length)
      : 0;

    const rating = overallScore >= 80 ? "excellent" : overallScore >= 65 ? "good" : overallScore >= 50 ? "fair" : "poor";

    const strengths: string[] = [];
    const improvements: string[] = [];
    const keyInsights: string[] = [];

    if (mode === "education") {
      if (educationMetrics.attentionScore >= 70) strengths.push("Strong attention and focus");
      if (educationMetrics.focusQuality >= 70) strengths.push("High quality engagement");
      if (educationMetrics.attentionScore < 60) improvements.push("Improve attention and focus");
      if (educationMetrics.distractionFlags.length > 0) improvements.push("Reduce distractions");
      keyInsights.push(`Engagement Level: ${educationMetrics.engagementLevel}`);
      keyInsights.push(`Learning Readiness: ${educationMetrics.learningReadiness}%`);
    } else if (mode === "interview") {
      if (interviewMetrics.confidenceScore >= 70) strengths.push("Confident body language");
      if (interviewMetrics.communicationQuality >= 70) strengths.push("Excellent communication quality");
      if (interviewMetrics.confidenceScore < 60) improvements.push("Build more confidence");
      if (interviewMetrics.stressIndicators.length > 0) improvements.push("Manage stress indicators");
      keyInsights.push(`Professionalism: ${interviewMetrics.professionalismLevel}`);
      keyInsights.push(`Authenticity: ${interviewMetrics.authenticityScore}%`);
    } else if (mode === "composure") {
      if (composureScore >= 70) strengths.push("Strong overall composure");
      if (composureScore < 60) improvements.push("Improve overall composure");
      keyInsights.push(`Composure: ${currentAdjective}`);
      keyInsights.push(`Stability: ${isStable ? "Locked" : "Variable"}`);
    } else if (mode === "expressions") {
      const dominantEmotion = Object.entries(emotions).reduce((max, [key, value]) =>
        value > max.value ? { emotion: key, value } : max,
        { emotion: "", value: 0 }
      );
      keyInsights.push(`Dominant emotion: ${dominantEmotion.emotion} (${dominantEmotion.value}%)`);
      if (emotions.happy > 50) strengths.push("Positive emotional expression");
      if (emotions.angry > 40 || emotions.sad > 40) improvements.push("Work on emotional balance");
    } else if (mode === "decoder") {
      keyInsights.push(`Actions decoded: ${decodedTexts.length}`);
      if (decodedTexts.length > 5) strengths.push("Active and expressive body language");
      if (decodedTexts.length < 3) improvements.push("Be more expressive with gestures");
    }

    const modeSpecificData: any = {};
    if (mode === "education") modeSpecificData.educationMetrics = educationMetrics;
    if (mode === "interview") modeSpecificData.interviewMetrics = interviewMetrics;
    if (mode === "expressions") modeSpecificData.emotions = emotions;

    return {
      mode,
      duration: sessionDuration,
      averageMetrics: avgMetrics,
      summary: {
        overallScore,
        rating,
        strengths,
        improvements,
        keyInsights,
      },
      modeSpecificData,
      peakMetrics: sessionPeakMetricsRef.current,
      timeline: metricsTimelineRef.current,
    };
  };

  const saveSession = async () => {
    if (!sessionStartTime) {
      toast({
        title: "No Session",
        description: "Start a session before saving",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const thumbnail = captureThumbnail();
      const sessionResult = calculateSessionSummary();
      const sessionName = `${mode.charAt(0).toUpperCase() + mode.slice(1)} Session - ${new Date().toLocaleDateString()}`;

      await createLiveSession({
        sessionName,
        mode,
        duration: sessionDuration,
        thumbnailUrl: thumbnail || undefined,
        result: sessionResult,
      });

      toast({
        title: "Session Saved",
        description: "Your analysis session has been saved to history",
      });

      metricsTimelineRef.current = [];
      sessionPeakMetricsRef.current = {};
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save session",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export session as JSON
  const exportSessionJSON = () => {
    if (!sessionStartTime) {
      toast({
        title: "No Session Data",
        description: "Start and run a session before exporting",
        variant: "destructive",
      });
      return;
    }

    try {
      const sessionResult = calculateSessionSummary();
      const exportData = {
        sessionName: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Session`,
        exportDate: new Date().toISOString(),
        ...sessionResult,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `composure-sense-${mode}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exported Successfully",
        description: "Session data exported as JSON",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export session data",
        variant: "destructive",
      });
    }
  };

  // Export session as detailed text report
  const exportSessionReport = () => {
    if (!sessionStartTime) {
      toast({
        title: "No Session Data",
        description: "Start and run a session before exporting",
        variant: "destructive",
      });
      return;
    }

    try {
      const sessionResult = calculateSessionSummary();
      const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
      };

      let report = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPOSURE SENSE - ANALYSIS REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${new Date().toLocaleString()}
🎯 Mode: ${mode.toUpperCase()}
⏱️  Duration: ${formatDuration(sessionDuration)}
📊 Overall Score: ${sessionResult.summary.overallScore}/100
⭐ Rating: ${sessionResult.summary.rating.toUpperCase()}
🎥 FPS: ${fps}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METRICS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

      // Add average metrics
      sessionResult.averageMetrics.forEach(metric => {
        report += `${metric.label}: ${metric.value}%\n`;
      });

      report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

      sessionResult.summary.keyInsights.forEach((insight, idx) => {
        report += `${idx + 1}. ${insight}\n`;
      });

      if (sessionResult.summary.strengths.length > 0) {
        report += `\n✅ STRENGTHS:\n`;
        sessionResult.summary.strengths.forEach(strength => {
          report += `  • ${strength}\n`;
        });
      }

      if (sessionResult.summary.improvements.length > 0) {
        report += `\n🎯 AREAS FOR IMPROVEMENT:\n`;
        sessionResult.summary.improvements.forEach(improvement => {
          report += `  • ${improvement}\n`;
        });
      }

      // Mode-specific details
      if (mode === "education" && sessionResult.modeSpecificData.educationMetrics) {
        const edu = sessionResult.modeSpecificData.educationMetrics;
        report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDUCATION MODE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Attention Score: ${edu.attentionScore}%
Engagement Level: ${edu.engagementLevel}
Focus Quality: ${edu.focusQuality}%
Learning Readiness: ${edu.learningReadiness}%

Distraction Flags: ${edu.distractionFlags.length > 0 ? edu.distractionFlags.join(', ') : 'None'}
Participation Indicators: ${edu.participationIndicators.join(', ')}
`;
      } else if (mode === "interview" && sessionResult.modeSpecificData.interviewMetrics) {
        const int = sessionResult.modeSpecificData.interviewMetrics;
        report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERVIEW MODE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Confidence Score: ${int.confidenceScore}%
Professionalism: ${int.professionalismLevel}
Energy Level: ${int.energyLevel}%
Authenticity: ${int.authenticityScore}%
Communication Quality: ${int.communicationQuality}%

Stress Indicators: ${int.stressIndicators.length > 0 ? int.stressIndicators.join(', ') : 'None'}
Body Language Strengths: ${int.bodyLanguageStrengths.join(', ')}
Improvement Areas: ${int.improvementAreas.join(', ')}
`;
      }

      report += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by ComposureSense v1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      const dataBlob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `composure-sense-report-${mode}-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: "Detailed report downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate report",
        variant: "destructive",
      });
    }
  };

  const startCamera = async () => {
    if (mode === "education" || mode === "interview") {
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
      // Also initialize face API for comprehensive analysis
      if (!faceDetectorReady) {
        await initializeFaceDetector();
      }
    } else if (mode === "expressions") {
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

        // Initialize session tracking
        setSessionStartTime(Date.now());
        metricsTimelineRef.current = [];
        sessionPeakMetricsRef.current = {};

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
    lastPoseRef.current = null;

    setIsStreaming(false);
    setFeedback([]);
    setMetrics([]);
    setFps(0);
    setFaceTracking(false);
    setEmotions({
      neutral: 0, happy: 0, surprise: 0, angry: 0, disgust: 0, fear: 0, sad: 0
    });
  };

  const switchMode = (newMode: AnalysisMode) => {
    stopCamera();
    setMode(newMode);
  };

  useEffect(() => {
    if (mode === "education" || mode === "interview") {
      // Initialize both pose and face detectors for comprehensive analysis
      initializePoseDetector();
      initializeFaceDetector();
    } else if (mode === "expressions") {
      initializeFaceDetector();
    }

    return () => {
      stopCamera();
      detectorRef.current = null;
    };
  }, [mode]);

  // Session duration tracker
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isStreaming && sessionStartTime) {
      intervalId = setInterval(() => {
        const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
        setSessionDuration(duration);
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isStreaming, sessionStartTime]);

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

  // Calculate the dominant emotion for highlighting
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
            <TabsList className="grid w-full max-w-3xl grid-cols-3">
              <TabsTrigger value="education" data-testid="tab-education" className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Education
              </TabsTrigger>
              <TabsTrigger value="interview" data-testid="tab-interview" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Interview
              </TabsTrigger>
              <TabsTrigger value="expressions" data-testid="tab-expressions" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
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
                  className="w-full h-full object-contain brightness-[0.6]"
                  data-testid="video-feed"
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-10 object-contain"
                  data-testid="overlay-canvas"
                />
                <canvas ref={canvasRef} className="hidden" />

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
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <Activity className="w-4 h-4 text-green-500" />
                    <span>Session Duration: {Math.floor(sessionDuration / 60)}:{(sessionDuration % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex justify-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={saveSession}
                      disabled={isSaving || sessionDuration < 5}
                      className="gap-2"
                      data-testid="button-save-session"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={exportSessionJSON}
                      disabled={sessionDuration < 5}
                      className="gap-2"
                      data-testid="button-export-json"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      onClick={exportSessionReport}
                      disabled={sessionDuration < 5}
                      className="gap-2"
                      data-testid="button-export-report"
                    >
                      <Download className="w-4 h-4" />
                      Report
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={stopCamera}
                      className="gap-2"
                      data-testid="button-stop-camera"
                    >
                      <StopCircle className="w-4 h-4" />
                      Stop
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            {mode === "education" ? (
              <>
                <Card className={`p-4 border-2 ${
                  educationMetrics.engagementLevel === "VERY HIGH" ? "border-green-500 bg-green-500/10" :
                  educationMetrics.engagementLevel === "HIGH" ? "border-blue-500 bg-blue-500/10" :
                  educationMetrics.engagementLevel === "MEDIUM" ? "border-yellow-500 bg-yellow-500/10" :
                  "border-red-500 bg-red-500/10"
                }`}>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Engagement Monitor
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <div className="text-3xl font-bold text-center" data-testid="engagement-level">
                        {educationMetrics.engagementLevel}
                      </div>
                      <div className="text-sm text-center text-muted-foreground">
                        Attention: {educationMetrics.attentionScore}%
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="text-lg font-semibold mb-3">Learning Metrics</h2>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Focus Quality</span>
                        <span className="font-semibold">{educationMetrics.focusQuality}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${educationMetrics.focusQuality}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Learning Readiness</span>
                        <span className="font-semibold">{educationMetrics.learningReadiness}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-green-500" style={{ width: `${educationMetrics.learningReadiness}%` }} />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-green-950/30">
                  <h2 className="text-lg font-semibold mb-3 text-green-400">Participation Indicators</h2>
                  <div className="space-y-2">
                    {educationMetrics.participationIndicators.length > 0 ? (
                      educationMetrics.participationIndicators.map((indicator, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-green-200 bg-green-900/20 p-2 rounded">
                          <Zap className="w-4 h-4 mt-0.5 text-green-400" />
                          <span>{indicator}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">
                        {isStreaming ? "Monitoring for participation..." : "Start camera to begin"}
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="p-4 bg-black/90 dark:bg-black/95">
                  <h2 className="text-lg font-semibold mb-3 text-white">Distraction Alerts</h2>
                  <div className="space-y-2">
                    {educationMetrics.distractionFlags.length > 0 ? (
                      educationMetrics.distractionFlags.map((flag, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-orange-200 bg-orange-900/20 p-2 rounded">
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-orange-400" />
                          <span>{flag}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No distractions detected
                      </p>
                    )}
                  </div>
                </Card>
              </>
            ) : mode === "interview" ? (
              <>
                <Card className={`p-4 border-2 ${
                  interviewMetrics.professionalismLevel === "EXCELLENT" ? "border-green-500 bg-green-500/10" :
                  interviewMetrics.professionalismLevel === "GOOD" ? "border-blue-500 bg-blue-500/10" :
                  interviewMetrics.professionalismLevel === "FAIR" ? "border-yellow-500 bg-yellow-500/10" :
                  "border-red-500 bg-red-500/10"
                }`}>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Professional Assessment
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <div className="text-3xl font-bold text-center" data-testid="professionalism-level">
                        {interviewMetrics.professionalismLevel}
                      </div>
                      <div className="text-sm text-center text-muted-foreground">
                        Overall Rating
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="text-lg font-semibold mb-3">Performance Metrics</h2>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Confidence</span>
                        <span className="font-semibold">{interviewMetrics.confidenceScore}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${interviewMetrics.confidenceScore}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Energy Level</span>
                        <span className="font-semibold">{interviewMetrics.energyLevel}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-green-500" style={{ width: `${interviewMetrics.energyLevel}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Authenticity</span>
                        <span className="font-semibold">{interviewMetrics.authenticityScore}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-purple-500" style={{ width: `${interviewMetrics.authenticityScore}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Communication Quality</span>
                        <span className="font-semibold">{interviewMetrics.communicationQuality}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${interviewMetrics.communicationQuality}%` }} />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-green-950/30">
                  <h2 className="text-lg font-semibold mb-3 text-green-400">Strengths</h2>
                  <div className="space-y-2">
                    {interviewMetrics.bodyLanguageStrengths.length > 0 ? (
                      interviewMetrics.bodyLanguageStrengths.map((strength, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-green-200 bg-green-900/20 p-2 rounded">
                          <Zap className="w-4 h-4 mt-0.5 text-green-400" />
                          <span>{strength}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">
                        {isStreaming ? "Analyzing strengths..." : "Start camera to begin"}
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="p-4 bg-black/90 dark:bg-black/95">
                  <h2 className="text-lg font-semibold mb-3 text-white">Improvement Areas</h2>
                  <div className="space-y-2">
                    {interviewMetrics.improvementAreas.length > 0 ? (
                      interviewMetrics.improvementAreas.map((area, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-orange-200 bg-orange-900/20 p-2 rounded">
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-orange-400" />
                          <span>{area}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">
                        Excellent performance!
                      </p>
                    )}
                  </div>
                </Card>

                {interviewMetrics.stressIndicators.length > 0 && (
                  <Card className="p-4 bg-red-950/30">
                    <h2 className="text-lg font-semibold mb-3 text-red-400">Stress Indicators</h2>
                    <div className="space-y-2">
                      {interviewMetrics.stressIndicators.map((indicator, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm text-red-200 bg-red-900/20 p-2 rounded">
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-red-400" />
                          <span>{indicator}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
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