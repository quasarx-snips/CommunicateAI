import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from "@shared/schema";

// Using blueprint:javascript_gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeBodyLanguage(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<AnalysisResult> {
  try {
    const systemPrompt = `You are an expert body language and communication analyst. Analyze the provided image/video/audio for:

1. Vocal Dynamics (if audio/video): Pitch variation, pace, volume, emotional tonality, filler words
2. Kinetic & Postural Analysis (if image/video): Eye contact, facial micro-expressions, posture (open vs closed), hand gestures
3. Communication Cohesion Score: Congruence between tone, body language, and semantic content

Provide a comprehensive analysis with:
- Overall score (Excellent/Good/Fair/Poor) with description
- Detection results for Pose, Gesture, and Hands (count detected)
- Strengths (2-3 positive observations)
- Areas for improvement (1-3 actionable items)
- Recommendations (2-3 specific suggestions)
- Metrics: Confidence (0-100%), Openness (0-100%), Engagement (0-100%), Stress Level (0-100%)

Respond in JSON format matching this structure exactly.`;

    const contents = [
      {
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: mimeType,
        },
      },
      `${systemPrompt}

Analyze this image/video/audio for body language and communication patterns.`,
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
