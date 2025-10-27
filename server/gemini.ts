import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface EmotionAnalysis {
  emotions: {
    neutral: number;
    happy: number;
    surprise: number;
    angry: number;
    disgust: number;
    fear: number;
    sad: number;
  };
  age: number;
  gender: string;
  faceDetected: boolean;
  status: {
    source: string;
    player: string;
    face: string;
    markers: string;
  };
}

export async function analyzeBodyLanguage(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<AnalysisResult> {
  try {
    const systemPrompt = `You are an expert body language analyst for Gestyx, an AI-powered interview preparation and communication coaching platform. Analyze the provided image or video with extreme precision using advanced computer vision, kinesics, and behavioral psychology principles.

ADVANCED ANALYSIS FRAMEWORK:

1. POSTURAL BIOMECHANICS (Visual Media):
   - Spinal alignment using skeletal mesh analysis
   - Shoulder positioning (open vs. closed, level vs. tilted)
   - Head position and stability with 3D orientation tracking
   - Overall body orientation (toward vs. away from camera)
   - Weight distribution and balance indicators
   - Sitting/standing posture quality with ergonomic assessment

2. FACIAL MICRO-EXPRESSION ANALYSIS (Visual Media):
   - Eye contact quality, duration, and directional patterns
   - Facial Action Coding System (FACS) evaluation
   - Micro-expressions indicating confidence, stress, or deception
   - Blink rate and saccadic eye movement patterns
   - Smile authenticity (Duchenne vs. social smile)
   - Emotional congruence across facial zones

3. GESTURAL COMMUNICATION & KINESICS (Visual Media):
   - Hand gesture frequency, amplitude, and purposefulness
   - Fidgeting or self-soothing behaviors (adaptors)
   - Gesture-speech synchronization patterns
   - Hand positioning (visible, expressive, or hidden)
   - Proxemics and personal space utilization
   - Emblematic gestures and cultural signifiers
   - Illustrator gestures supporting verbal communication
   - Detect specific actions: waving, pointing, crossed arms, hands on hips, thumbs up, open arms, thinking pose, etc.

4. VOCAL DYNAMICS (Audio/Video):
   - Pitch variation and tonal range analysis
   - Speaking pace and rhythm patterns
   - Volume modulation and projection
   - Filler word frequency (um, uh, like)
   - Voice confidence markers and clarity
   - Pauses, breathing patterns, and speech fluency

5. PROFESSIONAL PRESENCE & NEURAL CONFIDENCE INDICATORS:
   - Overall confidence projection using multi-modal analysis
   - Engagement and attentiveness markers
   - Professionalism and composure under observation
   - Stress indicators across posture, gesture, and voice
   - Communication effectiveness and impact
   - Power poses vs. defensive postures
   - Authenticity and congruence assessment

GESTURE RECOGNITION DATABASE (500+ patterns):
Analyze for common gestures including: waving, pointing, nodding, head shaking, shrugging, thumbs up/down, OK sign, crossed arms, hands on hips, hand steepling, fidgeting, self-touching, open arms, prayer hands, thinking pose, face touching, hair touching, and professional hand gestures.

SCORING GUIDELINES (0-100% scale):
- Excellent (85-100%): Exceptional presence, highly confident, minimal areas for improvement
- Good (70-84%): Strong performance, clear strengths, minor adjustments needed
- Fair (50-69%): Adequate baseline, several actionable improvements available
- Poor (0-49%): Significant development needed, multiple critical areas to address

Provide specific, actionable feedback that candidates can immediately apply to improve their interview performance with neural precision.`;

    const contents = [
      {
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: mimeType,
        },
      },
      `${systemPrompt}

Analyze this ${mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : 'audio'} for body language and communication patterns. Provide detailed, professional feedback.`,
    ];

    console.log(`📤 Sending request to Gemini API...`);

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            score: { 
              type: "string",
              description: "Overall score as percentage (0-100)"
            },
            rating: { 
              type: "string",
              enum: ["excellent", "good", "fair", "poor"]
            },
            description: { type: "string" },
            detections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { 
                    type: "number",
                    description: "Value as percentage from 0-100"
                  },
                  color: { type: "string" }
                },
                required: ["label", "value", "color"]
              }
            },
            strengths: {
              type: "array",
              items: { type: "string" }
            },
            improvements: {
              type: "array",
              items: { type: "string" }
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            },
            metrics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { 
                    type: "number",
                    description: "Value as percentage from 0-100, not decimal"
                  },
                  color: { type: "string" }
                },
                required: ["label", "value", "color"]
              }
            }
          },
          required: ["score", "rating", "description", "detections", "strengths", "improvements", "recommendations", "metrics"]
        },
      },
      contents: contents,
    });

    const rawJson = response.text;
    console.log(`📥 Received response from Gemini API: ${rawJson}`);

    if (rawJson) {
      const data: AnalysisResult = JSON.parse(rawJson);

      if (!data || typeof data !== 'object' || !data.detections || !data.metrics) {
        throw new Error("Invalid response structure from Gemini");
      }

      data.detections = data.detections.map(d => {
        if (typeof d.value !== 'number') throw new Error("Invalid detection value type");
        return {
          ...d,
          value: d.value <= 1 ? Math.round(d.value * 100) : Math.round(d.value)
        };
      });

      data.metrics = data.metrics.map(m => {
        if (typeof m.value !== 'number') throw new Error("Invalid metric value type");
        return {
          ...m,
          value: m.value <= 1 ? Math.round(m.value * 100) : Math.round(m.value)
        };
      });

      return data;
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error(`Failed to analyze: ${error}`);
  }
}

export async function analyzeFacialExpressions(
  fileBuffer: Buffer,
  mimeType: string
): Promise<EmotionAnalysis> {
  try {
    const systemPrompt = `You are an expert facial expression analyst specializing in emotion recognition and age estimation. Analyze the provided image with precision.

ANALYSIS REQUIREMENTS:

1. EMOTION DETECTION (percentage 0-100 for each):
   - Neutral: Absence of strong emotional expression
   - Happy: Smile, raised cheeks, crow's feet around eyes
   - Surprise: Raised eyebrows, wide eyes, open mouth
   - Angry: Furrowed brows, tense jaw, narrowed eyes
   - Disgust: Wrinkled nose, raised upper lip
   - Fear: Wide eyes, raised eyebrows, tense expression
   - Sad: Downturned mouth, drooping eyes, furrowed brow

2. AGE ESTIMATION:
   - Provide best estimate of person's age in years (e.g., 25, 30, 45)

3. GENDER DETECTION:
   - Estimate: "Male", "Female", or "Unknown"

4. FACE DETECTION STATUS:
   - Confirm if a clear face is detected: true/false

The percentages for all emotions must sum to 100. Provide accurate, professional analysis.`;

    const contents = [
      {
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: mimeType,
        },
      },
      `${systemPrompt}

Analyze this image for facial expressions, emotions, and age. Provide precise emotion percentages that sum to 100.`,
    ];

    console.log(`📤 Sending request to Gemini API...`);

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            emotions: {
              type: "object",
              properties: {
                neutral: { type: "number", description: "Percentage 0-100" },
                happy: { type: "number", description: "Percentage 0-100" },
                surprise: { type: "number", description: "Percentage 0-100" },
                angry: { type: "number", description: "Percentage 0-100" },
                disgust: { type: "number", description: "Percentage 0-100" },
                fear: { type: "number", description: "Percentage 0-100" },
                sad: { type: "number", description: "Percentage 0-100" }
              },
              required: ["neutral", "happy", "surprise", "angry", "disgust", "fear", "sad"]
            },
            age: { type: "number", description: "Estimated age in years" },
            gender: { type: "string", enum: ["Male", "Female", "Unknown"] },
            faceDetected: { type: "boolean" }
          },
          required: ["emotions", "age", "gender", "faceDetected"]
        },
      },
      contents: contents,
    });

    const rawJson = response.text;
    console.log(`📥 Received response from Gemini API: ${rawJson}`);

    if (rawJson) {
      const data = JSON.parse(rawJson);

      if (!data || typeof data !== 'object' || !data.emotions || typeof data.emotions !== 'object' || typeof data.age !== 'number' || typeof data.gender !== 'string' || typeof data.faceDetected !== 'boolean') {
        throw new Error("Invalid response structure from Gemini");
      }

      let emotions = {
        neutral: data.emotions.neutral <= 1 ? data.emotions.neutral * 100 : data.emotions.neutral,
        happy: data.emotions.happy <= 1 ? data.emotions.happy * 100 : data.emotions.happy,
        surprise: data.emotions.surprise <= 1 ? data.emotions.surprise * 100 : data.emotions.surprise,
        angry: data.emotions.angry <= 1 ? data.emotions.angry * 100 : data.emotions.angry,
        disgust: data.emotions.disgust <= 1 ? data.emotions.disgust * 100 : data.emotions.disgust,
        fear: data.emotions.fear <= 1 ? data.emotions.fear * 100 : data.emotions.fear,
        sad: data.emotions.sad <= 1 ? data.emotions.sad * 100 : data.emotions.sad
      };

      const emotionSum = Object.values(emotions).reduce((sum, val) => sum + val, 0);
      if (emotionSum > 0) {
        Object.keys(emotions).forEach(key => {
          emotions[key as keyof typeof emotions] = Math.round((emotions[key as keyof typeof emotions] / emotionSum) * 100);
        });
      }

      const normalizedSum = Object.values(emotions).reduce((sum, val) => sum + val, 0);
      if (normalizedSum !== 100 && normalizedSum > 0) {
        const maxEmotion = Object.entries(emotions).reduce((max, [key, val]) => 
          val > max.val ? { key, val } : max, { key: 'neutral', val: 0 }
        );
        emotions[maxEmotion.key as keyof typeof emotions] += (100 - normalizedSum);
      }

      return {
        emotions,
        age: Math.round(data.age),
        gender: data.gender,
        faceDetected: data.faceDetected,
        status: {
          source: "Webcam",
          player: "Playing",
          face: data.faceDetected ? "Tracking" : "Not Detected",
          markers: "Scale to face"
        }
      };
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Gemini facial analysis error:", error);
    throw new Error(`Failed to analyze facial expressions: ${error}`);
  }
}