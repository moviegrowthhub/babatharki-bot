import { pgTable, text, integer, timestamp, boolean, serial, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  channelName: text("channel_name").notNull(),
  channelUsername: text("channel_username"),
  inviteLink: text("invite_link"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  durationDays: integer("duration_days").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  channelId: text("channel_id").notNull(),
  planId: integer("plan_id"),
  planName: text("plan_name"),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  status: text("status").notNull().default("active"), // active, expired, pending, banned
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  txnId: text("txn_id").notNull(),
  planId: integer("plan_id"),
  planName: text("plan_name"),
  amount: integer("amount"),
  channelId: text("channel_id"),
  status: text("status").notNull().default("pending"), // pending, verified, rejected
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
});

export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true });
export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true });
export const insertMemberSchema = createInsertSchema(members).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });

export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Channel = typeof channels.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Setting = typeof settings.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
