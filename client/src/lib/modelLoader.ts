
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

class ModelLoaderService {
  private cache: ModelCache = {
    poseDetector: null,
    faceApiLoaded: false,
    tfBackend: null,
  };

  private initPromise: Promise<void> | null = null;
  private isInitializing = false;

  async initialize(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.cache.poseDetector && this.cache.faceApiLoaded) {
      return Promise.resolve();
    }

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        console.log("🚀 Preloading AI models...");

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
          console.log('✅ Pose detector cached');
        } else {
          console.error('❌ Pose detector failed:', poseResult.reason);
        }

        if (faceResult.status === 'fulfilled') {
          console.log('✅ Face-API models cached');
        } else {
          console.error('❌ Face-API failed:', faceResult.reason);
        }

        console.log('🎉 AI models preloaded successfully');
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
    if (this.cache.poseDetector) return;

    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    };

    this.cache.poseDetector = await poseDetection.createDetector(model, detectorConfig);
  }

  private async loadFaceAPI(): Promise<void> {
    if (this.cache.faceApiLoaded) return;

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
