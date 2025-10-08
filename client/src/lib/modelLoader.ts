
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import * as poseDetection from "@tensorflow-models/pose-detection";
import * as faceapi from "@vladmandic/face-api";

interface ModelCache {
  poseDetector: poseDetection.PoseDetector | null;
  faceApiLoaded: boolean;
  tfBackend: string | null;
}

interface ModelCacheStatus {
  poseDetectorCached: boolean;
  faceApiCached: boolean;
  timestamp: number;
}

const CACHE_KEY = 'ai_models_cache_status';
const CACHE_VERSION = 'v1';

class ModelLoaderService {
  private cache: ModelCache = {
    poseDetector: null,
    faceApiLoaded: false,
    tfBackend: null,
  };

  private initPromise: Promise<void> | null = null;
  private isInitializing = false;
  private cacheStatus: ModelCacheStatus = {
    poseDetectorCached: false,
    faceApiCached: false,
    timestamp: 0
  };

  constructor() {
    // Load cache status from localStorage
    this.loadCacheStatus();
  }

  private loadCacheStatus(): void {
    try {
      const stored = localStorage.getItem(`${CACHE_KEY}_${CACHE_VERSION}`);
      if (stored) {
        this.cacheStatus = JSON.parse(stored);
        console.log('📦 Cache status loaded:', this.cacheStatus);
      }
    } catch (error) {
      console.warn('Could not load cache status:', error);
    }
  }

  private saveCacheStatus(): void {
    try {
      localStorage.setItem(
        `${CACHE_KEY}_${CACHE_VERSION}`,
        JSON.stringify(this.cacheStatus)
      );
      console.log('💾 Cache status saved');
    } catch (error) {
      console.warn('Could not save cache status:', error);
    }
  }

  async initialize(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.cache.poseDetector && this.cache.faceApiLoaded) {
      console.log('✅ Models already initialized from cache');
      return Promise.resolve();
    }

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        console.log('🚀 Preloading AI models...');

        // Initialize TensorFlow backend once
        if (!this.cache.tfBackend) {
          await tf.ready();
          try {
            await tf.setBackend('webgl');
            this.cache.tfBackend = 'webgl';
            console.log('✅ TensorFlow backend: WebGL');
          } catch (e) {
            await tf.setBackend('cpu');
            this.cache.tfBackend = 'cpu';
            console.log('⚠️ TensorFlow backend: CPU (fallback)');
          }
        }

        // Load both models in parallel
        const [poseResult, faceResult] = await Promise.allSettled([
          this.loadPoseDetector(),
          this.loadFaceAPI(),
        ]);

        if (poseResult.status === 'fulfilled') {
          this.cacheStatus.poseDetectorCached = true;
          console.log('✅ Pose detector cached permanently');
        } else {
          console.error('❌ Pose detector failed:', poseResult.reason);
        }

        if (faceResult.status === 'fulfilled') {
          this.cacheStatus.faceApiCached = true;
          console.log('✅ Face-API models cached permanently');
        } else {
          console.error('❌ Face-API failed:', faceResult.reason);
        }

        // Save cache status with timestamp
        this.cacheStatus.timestamp = Date.now();
        this.saveCacheStatus();

        console.log('🎉 AI models preloaded and cached successfully');
      } catch (error) {
        console.error('Model initialization error:', error);
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  private async loadPoseDetector(): Promise<void> {
    if (this.cache.poseDetector) {
      console.log('♻️ Reusing cached pose detector');
      return;
    }

    console.log('📥 Loading pose detector...');
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    };

    this.cache.poseDetector = await poseDetection.createDetector(model, detectorConfig);
  }

  private async loadFaceAPI(): Promise<void> {
    if (this.cache.faceApiLoaded) {
      console.log('♻️ Reusing cached face-API models');
      return;
    }

    console.log('📥 Loading face-API models...');
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);

    this.cache.faceApiLoaded = true;
  }

  getPoseDetector(): poseDetection.PoseDetector | null {
    return this.cache.poseDetector;
  }

  isFaceAPILoaded(): boolean {
    return this.cache.faceApiLoaded;
  }

  getTFBackend(): string | null {
    return this.cache.tfBackend;
  }

  isReady(): boolean {
    return !this.isInitializing && 
           this.cache.poseDetector !== null && 
           this.cache.faceApiLoaded;
  }

  getCacheStatus(): ModelCacheStatus {
    return { ...this.cacheStatus };
  }

  isCached(): boolean {
    return this.cacheStatus.poseDetectorCached && this.cacheStatus.faceApiCached;
  }

  clearCache(): void {
    try {
      localStorage.removeItem(`${CACHE_KEY}_${CACHE_VERSION}`);
      this.cacheStatus = {
        poseDetectorCached: false,
        faceApiCached: false,
        timestamp: 0
      };
      console.log('🗑️ Cache status cleared');
    } catch (error) {
      console.warn('Could not clear cache:', error);
    }
  }

  // Clean up resources if needed
  async dispose(): Promise<void> {
    if (this.cache.poseDetector) {
      await this.cache.poseDetector.dispose();
      this.cache.poseDetector = null;
    }
    this.cache.faceApiLoaded = false;
    this.cache.tfBackend = null;
    this.initPromise = null;
  }
}

// Singleton instance
export const modelLoader = new ModelLoaderService();
