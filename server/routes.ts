import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analyzeBodyLanguage } from "./gemini";
import { insertAnalysisSchema } from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
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

  const httpServer = createServer(app);
  return httpServer;
}
