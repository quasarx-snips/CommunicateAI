import { type User, type InsertUser, type Analysis, type InsertAnalysis, type LiveSession, type InsertLiveSession } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  getAllAnalyses(): Promise<Analysis[]>;

  createLiveSession(session: InsertLiveSession): Promise<LiveSession>;
  getLiveSession(id: string): Promise<LiveSession | undefined>;
  updateLiveSession(id: string, updates: Partial<InsertLiveSession>): Promise<LiveSession | undefined>;
  getLiveSessionsByDevice(deviceId: string): Promise<LiveSession[]>;
  deleteLiveSession(id: string): Promise<boolean>;
  clearDeviceLiveSessions(deviceId: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private analyses: Map<string, Analysis>;
  private liveSessions: Map<string, LiveSession>;

  constructor() {
    this.users = new Map();
    this.analyses = new Map();
    this.liveSessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = randomUUID();
    const analysis: Analysis = {
      id,
      fileName: insertAnalysis.fileName,
      fileType: insertAnalysis.fileType,
      fileUrl: insertAnalysis.fileUrl,
      result: insertAnalysis.result as any,
      deviceId: insertAnalysis.deviceId ?? null,
      createdAt: new Date(),
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async getAllAnalyses(): Promise<Analysis[]> {
    return Array.from(this.analyses.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getAnalysesByDevice(deviceId: string): Promise<Analysis[]> {
    return Array.from(this.analyses.values())
      .filter(analysis => analysis.deviceId === deviceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteAnalysis(id: string): Promise<boolean> {
    return this.analyses.delete(id);
  }

  async clearDeviceHistory(deviceId: string): Promise<number> {
    const deviceAnalyses = await this.getAnalysesByDevice(deviceId);
    let deletedCount = 0;
    for (const analysis of deviceAnalyses) {
      if (this.analyses.delete(analysis.id)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async createLiveSession(insertSession: InsertLiveSession): Promise<LiveSession> {
    const id = randomUUID();
    const session: LiveSession = {
      id,
      sessionName: insertSession.sessionName,
      mode: insertSession.mode,
      duration: insertSession.duration,
      thumbnailUrl: insertSession.thumbnailUrl ?? null,
      result: insertSession.result as any,
      deviceId: insertSession.deviceId ?? null,
      createdAt: new Date(),
    };
    this.liveSessions.set(id, session);
    return session;
  }

  async getLiveSession(id: string): Promise<LiveSession | undefined> {
    return this.liveSessions.get(id);
  }

  async updateLiveSession(id: string, updates: Partial<InsertLiveSession>): Promise<LiveSession | undefined> {
    const existing = this.liveSessions.get(id);
    if (!existing) return undefined;

    const updated: LiveSession = {
      ...existing,
      ...(updates.sessionName !== undefined && { sessionName: updates.sessionName }),
      ...(updates.mode !== undefined && { mode: updates.mode }),
      ...(updates.duration !== undefined && { duration: updates.duration }),
      ...(updates.thumbnailUrl !== undefined && { thumbnailUrl: updates.thumbnailUrl ?? null }),
      ...(updates.result !== undefined && { result: updates.result as any }),
      ...(updates.deviceId !== undefined && { deviceId: updates.deviceId ?? null }),
    };

    this.liveSessions.set(id, updated);
    return updated;
  }

  async getLiveSessionsByDevice(deviceId: string): Promise<LiveSession[]> {
    return Array.from(this.liveSessions.values())
      .filter(session => session.deviceId === deviceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteLiveSession(id: string): Promise<boolean> {
    return this.liveSessions.delete(id);
  }

  async clearDeviceLiveSessions(deviceId: string): Promise<number> {
    const deviceSessions = await this.getLiveSessionsByDevice(deviceId);
    let deletedCount = 0;
    for (const session of deviceSessions) {
      if (this.liveSessions.delete(session.id)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }
}

export const storage = new MemStorage();
