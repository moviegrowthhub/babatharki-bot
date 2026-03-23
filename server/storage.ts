import { db } from "./db";
import { channels, plans, members, payments, settings } from "@shared/schema";
import type { Channel, Plan, Member, Payment, Setting, InsertChannel, InsertPlan, InsertMember, InsertPayment } from "@shared/schema";
import { eq, and, lt, desc } from "drizzle-orm";

export interface IStorage {
  getChannels(): Promise<Channel[]>;
  getChannelById(id: number): Promise<Channel | undefined>;
  createChannel(ch: InsertChannel): Promise<Channel>;
  updateChannel(id: number, data: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<void>;

  getPlans(): Promise<Plan[]>;
  getActivePlans(): Promise<Plan[]>;
  getPlanById(id: number): Promise<Plan | undefined>;
  createPlan(p: InsertPlan): Promise<Plan>;
  updatePlan(id: number, data: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: number): Promise<void>;

  getMembers(): Promise<Member[]>;
  getMemberById(id: number): Promise<Member | undefined>;
  getMemberByUserAndChannel(userId: string, channelId: string): Promise<Member | undefined>;
  createMember(m: InsertMember): Promise<Member>;
  updateMemberStatus(id: number, status: string): Promise<void>;
  updateMemberExpiry(id: number, expiresAt: Date, status: string, planName?: string): Promise<void>;
  getExpiredActiveMembers(): Promise<Member[]>;

  getPayments(): Promise<Payment[]>;
  getPaymentById(id: number): Promise<Payment | undefined>;
  getPaymentByTxnId(txnId: string): Promise<Payment | undefined>;
  createPayment(p: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: number, status: string, adminNote?: string, verifiedAt?: Date): Promise<void>;

  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getChannels(): Promise<Channel[]> {
    return db.select().from(channels).orderBy(desc(channels.createdAt));
  }
  async getChannelById(id: number): Promise<Channel | undefined> {
    const [ch] = await db.select().from(channels).where(eq(channels.id, id));
    return ch;
  }
  async createChannel(ch: InsertChannel): Promise<Channel> {
    const [created] = await db.insert(channels).values(ch).returning();
    return created;
  }
  async updateChannel(id: number, data: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [updated] = await db.update(channels).set(data).where(eq(channels.id, id)).returning();
    return updated;
  }
  async deleteChannel(id: number): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
  }

  async getPlans(): Promise<Plan[]> {
    return db.select().from(plans).orderBy(desc(plans.createdAt));
  }
  async getActivePlans(): Promise<Plan[]> {
    return db.select().from(plans).where(eq(plans.isActive, true));
  }
  async getPlanById(id: number): Promise<Plan | undefined> {
    const [p] = await db.select().from(plans).where(eq(plans.id, id));
    return p;
  }
  async createPlan(p: InsertPlan): Promise<Plan> {
    const [created] = await db.insert(plans).values(p).returning();
    return created;
  }
  async updatePlan(id: number, data: Partial<InsertPlan>): Promise<Plan | undefined> {
    const [updated] = await db.update(plans).set(data).where(eq(plans.id, id)).returning();
    return updated;
  }
  async deletePlan(id: number): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
  }

  async getMembers(): Promise<Member[]> {
    return db.select().from(members).orderBy(desc(members.createdAt));
  }
  async getMemberById(id: number): Promise<Member | undefined> {
    const [m] = await db.select().from(members).where(eq(members.id, id));
    return m;
  }
  async getMemberByUserAndChannel(userId: string, channelId: string): Promise<Member | undefined> {
    const [m] = await db.select().from(members).where(
      and(eq(members.telegramUserId, userId), eq(members.channelId, channelId))
    );
    return m;
  }
  async createMember(m: InsertMember): Promise<Member> {
    const [created] = await db.insert(members).values(m).returning();
    return created;
  }
  async updateMemberStatus(id: number, status: string): Promise<void> {
    await db.update(members).set({ status }).where(eq(members.id, id));
  }
  async updateMemberExpiry(id: number, expiresAt: Date, status: string, planName?: string): Promise<void> {
    await db.update(members).set({ expiresAt, status, ...(planName ? { planName } : {}) }).where(eq(members.id, id));
  }
  async getExpiredActiveMembers(): Promise<Member[]> {
    return db.select().from(members).where(
      and(eq(members.status, "active"), lt(members.expiresAt, new Date()))
    );
  }

  async getPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }
  async getPaymentById(id: number): Promise<Payment | undefined> {
    const [p] = await db.select().from(payments).where(eq(payments.id, id));
    return p;
  }
  async getPaymentByTxnId(txnId: string): Promise<Payment | undefined> {
    const [p] = await db.select().from(payments).where(eq(payments.txnId, txnId));
    return p;
  }
  async createPayment(p: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(p).returning();
    return created;
  }
  async updatePaymentStatus(id: number, status: string, adminNote?: string, verifiedAt?: Date): Promise<void> {
    await db.update(payments).set({
      status,
      ...(adminNote !== undefined ? { adminNote } : {}),
      ...(verifiedAt ? { verifiedAt } : {}),
    }).where(eq(payments.id, id));
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [s] = await db.select().from(settings).where(eq(settings.key, key));
    return s;
  }
  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }
}

export const storage = new DbStorage();
