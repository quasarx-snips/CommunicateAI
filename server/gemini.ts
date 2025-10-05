import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeBodyLanguage(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<AnalysisResult> {
  try {
    const systemPrompt = `You are an expert body language analyst trained in interview performance evaluation. Analyze the provided media with professional precision.

ANALYSIS FRAMEWORK:

1. POSTURAL ANALYSIS (Visual Media):
   - Spinal alignment and uprightness
   - Shoulder positioning (open vs. closed, level vs. tilted)
   - Head position and stability
   - Overall body orientation (toward vs. away from camera)
   - Sitting/standing posture quality

2. FACIAL EXPRESSION & MICRO-EXPRESSIONS (Visual Media):
   - Eye contact quality and duration
   - Facial symmetry and emotional congruence
   - Micro-expressions indicating confidence or stress
   - Blink rate and eye movement patterns
   - Smile authenticity (Duchenne vs. social smile)

3. GESTURAL COMMUNICATION (Visual Media):
   - Hand gesture frequency and purposefulness
   - Fidgeting or self-soothing behaviors
   - Gesture-speech synchronization
   - Hand positioning (visible, expressive, or hidden)
   - Proxemics and space utilization

4. VOCAL DYNAMICS (Audio/Video):
   - Pitch variation and tonal range
   - Speaking pace and rhythm
   - Volume modulation
   - Filler word frequency (um, uh, like)
   - Voice confidence and clarity
   - Pauses and breathing patterns

5. PROFESSIONAL PRESENCE:
   - Overall confidence projection
   - Engagement and attentiveness
   - Professionalism and composure
   - Stress indicators
   - Communication effectiveness

SCORING GUIDELINES:
- Excellent (85-100%): Exceptional presence, highly confident, minimal areas for improvement
- Good (70-84%): Strong performance, clear strengths, minor adjustments needed
- Fair (50-69%): Adequate baseline, several actionable improvements available
- Poor (0-49%): Significant development needed, multiple critical areas to address

Provide specific, actionable feedback that candidates can immediately apply to improve their interview performance.`;

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

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            score: { type: "string" },
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
                  value: { type: "number" },
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
                  value: { type: "number" },
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
    
    if (rawJson) {
      const data: AnalysisResult = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error(`Failed to analyze: ${error}`);
  }
}
