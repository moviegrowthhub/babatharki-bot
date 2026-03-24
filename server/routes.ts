import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyPaymentAndAddMember, getBot, handleWebhookUpdate } from "./bot";
import { insertChannelSchema, insertPlanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Telegram webhook endpoint (production mode)
  app.post("/api/telegram-webhook", async (req, res) => {
    try {
      await handleWebhookUpdate(req.body);
      res.json({ ok: true });
    } catch (e) {
      res.json({ ok: false });
    }
  });

  // Dashboard stats
  app.get("/api/stats", async (req, res) => {
    const [allMembers, allPayments, allPlans, allChannels] = await Promise.all([
      storage.getMembers(),
      storage.getPayments(),
      storage.getPlans(),
      storage.getChannels(),
    ]);
    const activeMembers = allMembers.filter((m) => m.status === "active").length;
    const expiredMembers = allMembers.filter((m) => m.status === "expired").length;
    const pendingPayments = allPayments.filter((p) => p.status === "pending").length;
    const verifiedPayments = allPayments.filter((p) => p.status === "verified").length;
    const totalRevenue = allPayments
      .filter((p) => p.status === "verified")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({
      totalMembers: allMembers.length,
      activeMembers,
      expiredMembers,
      pendingPayments,
      verifiedPayments,
      totalRevenue,
      totalPlans: allPlans.length,
      totalChannels: allChannels.length,
      botActive: !!getBot(),
    });
  });

  // Channels
  app.get("/api/channels", async (req, res) => {
    const list = await storage.getChannels();
    res.json(list);
  });
  app.post("/api/channels", async (req, res) => {
    const parsed = insertChannelSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const ch = await storage.createChannel(parsed.data);
    res.json(ch);
  });
  app.put("/api/channels/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const ch = await storage.updateChannel(id, req.body);
    res.json(ch);
  });
  app.delete("/api/channels/:id", async (req, res) => {
    await storage.deleteChannel(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Plans
  app.get("/api/plans", async (req, res) => {
    const list = await storage.getPlans();
    res.json(list);
  });
  app.post("/api/plans", async (req, res) => {
    const parsed = insertPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const plan = await storage.createPlan(parsed.data);
    res.json(plan);
  });
  app.put("/api/plans/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const plan = await storage.updatePlan(id, req.body);
    res.json(plan);
  });
  app.delete("/api/plans/:id", async (req, res) => {
    await storage.deletePlan(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Members
  app.get("/api/members", async (req, res) => {
    const list = await storage.getMembers();
    res.json(list);
  });
  app.put("/api/members/:id/status", async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    await storage.updateMemberStatus(id, status);
    res.json({ ok: true });
  });
  // Extend membership
  app.post("/api/members/:id/extend", async (req, res) => {
    const id = parseInt(req.params.id);
    const { days } = req.body;
    if (!days || isNaN(Number(days))) return res.status(400).json({ error: "days required" });
    const member = await storage.getMemberById(id);
    if (!member) return res.status(404).json({ error: "Not found" });
    const base = member.expiresAt && new Date(member.expiresAt) > new Date()
      ? new Date(member.expiresAt) : new Date();
    const newExpiry = new Date(base.getTime() + Number(days) * 86400000);
    await storage.updateMemberExpiry(id, newExpiry, "active", member.planName || undefined);
    const bot = getBot();
    if (bot) {
      try {
        await bot.sendMessage(Number(member.telegramUserId),
          `🎁 *Membership Extended!*\n\nAdmin has extended your VIP access by *${days} days*.\n📅 New expiry: *${newExpiry.toLocaleDateString("en-IN")}*\n\nEnjoy! 🎉`,
          { parse_mode: "Markdown" }
        );
      } catch (e) {}
    }
    res.json({ ok: true, newExpiry });
  });
  // Send message to member
  app.post("/api/members/:id/notify", async (req, res) => {
    const id = parseInt(req.params.id);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });
    const member = await storage.getMemberById(id);
    if (!member) return res.status(404).json({ error: "Not found" });
    const bot = getBot();
    if (!bot) return res.status(503).json({ error: "Bot offline" });
    try {
      await bot.sendMessage(Number(member.telegramUserId), message, { parse_mode: "Markdown" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // Manually add member
  app.post("/api/members/add", async (req, res) => {
    const { telegramUserId, username, firstName, planId, channelId } = req.body;
    if (!telegramUserId || !planId || !channelId) return res.status(400).json({ error: "telegramUserId, planId, channelId required" });
    const plan = await storage.getPlanById(Number(planId));
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
    const existing = await storage.getMemberByUserAndChannel(String(telegramUserId), String(channelId));
    if (existing) {
      const base = existing.expiresAt && new Date(existing.expiresAt) > new Date() ? new Date(existing.expiresAt) : new Date();
      const newExpiry = new Date(base.getTime() + plan.durationDays * 86400000);
      await storage.updateMemberExpiry(existing.id, newExpiry, "active", plan.name);
    } else {
      await storage.createMember({ telegramUserId: String(telegramUserId), username: username || "", firstName: firstName || "", channelId: String(channelId), planId: plan.id, planName: plan.name, expiresAt, status: "active" });
    }
    const bot = getBot();
    if (bot) {
      try {
        let inviteLink = "";
        const channels = await storage.getChannels();
        const ch = channels.find(c => c.channelId === String(channelId));
        try {
          const link = await bot.createChatInviteLink(String(channelId), { expire_date: Math.floor(expiresAt.getTime() / 1000), member_limit: 1 });
          inviteLink = link.invite_link;
        } catch (e) {}
        await bot.sendMessage(Number(telegramUserId),
          `🎉 *You have been added to VIP Zone!*\n\n📦 Plan: *${plan.name}*\n📅 Expires: *${expiresAt.toLocaleDateString("en-IN")}*\n\n${inviteLink ? `🔗 *Join here:*\n${inviteLink}` : "Contact admin for the invite link."}`,
          { parse_mode: "Markdown" }
        );
      } catch (e) {}
    }
    res.json({ ok: true });
  });
  app.delete("/api/members/:id", async (req, res) => {
    const member = await storage.getMemberById(parseInt(req.params.id));
    if (member) {
      await storage.updateMemberStatus(member.id, "banned");
      const bot = getBot();
      if (bot) {
        try {
          await bot.banChatMember(member.channelId, Number(member.telegramUserId));
        } catch (e) {}
        try {
          await bot.sendMessage(Number(member.telegramUserId),
            `🚫 *Your VIP access has been revoked.*\n\nContact admin if you think this is a mistake.`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {}
      }
    }
    res.json({ ok: true });
  });

  // Payments
  app.get("/api/payments", async (req, res) => {
    const list = await storage.getPayments();
    res.json(list);
  });
  app.post("/api/payments/:id/verify", async (req, res) => {
    const id = parseInt(req.params.id);
    const ok = await verifyPaymentAndAddMember(id);
    res.json({ ok });
  });
  // Get payment screenshot (proxied from Telegram)
  app.get("/api/payments/:id/screenshot", async (req, res) => {
    const id = parseInt(req.params.id);
    const payment = await storage.getPaymentById(id);
    if (!payment?.screenshotFileId) return res.status(404).json({ error: "No screenshot" });
    const bot = getBot();
    if (!bot) return res.status(503).json({ error: "Bot offline" });
    try {
      const fileLink = await bot.getFileLink(payment.screenshotFileId);
      res.redirect(fileLink);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch screenshot" });
    }
  });

  app.post("/api/payments/:id/reject", async (req, res) => {
    const id = parseInt(req.params.id);
    const { note } = req.body;
    const payment = await storage.getPaymentById(id);
    if (!payment) return res.status(404).json({ error: "Not found" });
    await storage.updatePaymentStatus(id, "rejected", note || "Rejected by admin");
    const bot = getBot();
    if (bot) {
      try {
        await bot.sendMessage(
          Number(payment.telegramUserId),
          `❌ *Payment Rejected*\n\nTxn ID: \`${payment.txnId}\` was rejected.\n${note ? `Reason: ${note}\n` : ""}Please contact support.`,
          { parse_mode: "Markdown" }
        );
      } catch (e) {}
    }
    res.json({ ok: true });
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    const keys = ["upi_id", "upi_name", "bitcoin_address", "bot_username", "welcome_msg"];
    const result: Record<string, string> = {};
    for (const key of keys) {
      const s = await storage.getSetting(key);
      result[key] = s?.value || "";
    }
    res.json(result);
  });
  app.post("/api/settings", async (req, res) => {
    const { key, value } = req.body;
    await storage.setSetting(key, value);
    res.json({ ok: true });
  });

  // Broadcast message
  app.post("/api/broadcast", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    const bot = getBot();
    if (!bot) return res.status(503).json({ error: "Bot not running" });
    const activeMembers = (await storage.getMembers()).filter((m) => m.status === "active");
    let sent = 0;
    let failed = 0;
    for (const m of activeMembers) {
      try {
        await bot.sendMessage(Number(m.telegramUserId), message, { parse_mode: "Markdown" });
        sent++;
      } catch (e) {
        failed++;
      }
    }
    res.json({ sent, failed });
  });

  return httpServer;
}
