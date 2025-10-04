import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const analysisResultSchema = z.object({
  score: z.string(),
  rating: z.enum(["excellent", "good", "fair", "poor"]),
  description: z.string(),
  detections: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string(),
  })),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  recommendations: z.array(z.string()),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string(),
  })),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  result: jsonb("result").notNull().$type<AnalysisResult>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).pick({
  fileName: true,
  fileType: true,
  result: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;
