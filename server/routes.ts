import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analyzeBodyLanguage } from "./gemini";
import { insertAnalysisSchema, insertLiveSessionSchema } from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Note: Facial expression analysis is now done locally in the browser using face-api.js
  // No server-side processing needed for expression detection

  // Live analysis endpoint (lightweight, faster responses)
  app.post("/api/analyze-live", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { buffer, mimetype } = req.file;

      // Simplified prompt for faster live analysis
      const analysisResult = await analyzeBodyLanguage(buffer, mimetype, "live-frame.jpg");

      // Return only essential feedback for live display
      res.json({
        improvements: analysisResult.improvements,
        metrics: analysisResult.metrics,
      });
    } catch (error) {
      console.error("Live analysis error:", error);
      res.status(500).json({ error: "Failed to analyze frame" });
    }
  });

  // Upload and analyze endpoint
  app.post("/api/analyze", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { buffer, mimetype, originalname } = req.file;
      const deviceId = req.body.deviceId || 'unknown';

      // Analyze with Gemini
      const analysisResult = await analyzeBodyLanguage(buffer, mimetype, originalname);

      // Convert buffer to base64 for storage
      const fileUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;

      // Save to storage
      const analysis = await storage.createAnalysis({
        fileName: originalname,
        fileType: mimetype,
        fileUrl,
        result: analysisResult,
        deviceId,
      });

      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze file" });
    }
  });

  // Get analysis by ID
  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Get analysis error:", error);
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  // Get all analyses
  app.get("/api/analyses", async (req, res) => {
    try {
      const analyses = await storage.getAllAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Get analyses error:", error);
      res.status(500).json({ error: "Failed to get analyses" });
    }
  });

  // Get analyses by device
  app.get("/api/analyses/device/:deviceId", async (req, res) => {
    try {
      const analyses = await storage.getAnalysesByDevice(req.params.deviceId);
      res.json(analyses);
    } catch (error) {
      console.error("Get device analyses error:", error);
      res.status(500).json({ error: "Failed to get device analyses" });
    }
  });

  // Clear device history
  app.delete("/api/analyses/device/:deviceId", async (req, res) => {
    try {
      const deletedCount = await storage.clearDeviceHistory(req.params.deviceId);
      res.json({ deletedCount });
    } catch (error) {
      console.error("Clear device history error:", error);
      res.status(500).json({ error: "Failed to clear device history" });
    }
  });

  // Live Session Routes
  
  // Create live session
  app.post("/api/live-sessions", async (req, res) => {
    try {
      const sessionData = insertLiveSessionSchema.parse(req.body);
      const session = await storage.createLiveSession(sessionData);
      res.json(session);
    } catch (error) {
      console.error("Create live session error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid session data", details: error.message });
      }
      res.status(500).json({ error: "Failed to create live session" });
    }
  });

  // Get live session by ID
  app.get("/api/live-sessions/:id", async (req, res) => {
    try {
      const session = await storage.getLiveSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Live session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Get live session error:", error);
      res.status(500).json({ error: "Failed to get live session" });
    }
  });

  // Update live session
  app.patch("/api/live-sessions/:id", async (req, res) => {
    try {
      const updates = insertLiveSessionSchema.partial().parse(req.body);
      const session = await storage.updateLiveSession(req.params.id, updates);
      if (!session) {
        return res.status(404).json({ error: "Live session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Update live session error:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid update data", details: error.message });
      }
      res.status(500).json({ error: "Failed to update live session" });
    }
  });

  // Get live sessions by device
  app.get("/api/live-sessions/device/:deviceId", async (req, res) => {
    try {
      const sessions = await storage.getLiveSessionsByDevice(req.params.deviceId);
      res.json(sessions);
    } catch (error) {
      console.error("Get device live sessions error:", error);
      res.status(500).json({ error: "Failed to get device live sessions" });
    }
  });

  // Delete live session
  app.delete("/api/live-sessions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLiveSession(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Live session not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete live session error:", error);
      res.status(500).json({ error: "Failed to delete live session" });
    }
  });

  // Clear device live sessions
  app.delete("/api/live-sessions/device/:deviceId", async (req, res) => {
    try {
      const deletedCount = await storage.clearDeviceLiveSessions(req.params.deviceId);
      res.json({ deletedCount });
    } catch (error) {
      console.error("Clear device live sessions error:", error);
      res.status(500).json({ error: "Failed to clear device live sessions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
