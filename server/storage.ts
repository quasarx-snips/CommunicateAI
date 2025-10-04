import { type User, type InsertUser, type Analysis, type InsertAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  getAllAnalyses(): Promise<Analysis[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private analyses: Map<string, Analysis>;

  constructor() {
    this.users = new Map();
    this.analyses = new Map();
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
      deviceId: insertAnalysis.deviceId,
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
}

export const storage = new MemStorage();
