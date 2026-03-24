import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { verifyPaymentAndAddMember, getBot } from "./bot";
import { insertChannelSchema, insertPlanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
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
  app.delete("/api/members/:id", async (req, res) => {
    const member = await storage.getMemberById(parseInt(req.params.id));
    if (member) {
      await storage.updateMemberStatus(member.id, "banned");
      const bot = getBot();
      if (bot) {
        try {
          await bot.banChatMember(member.channelId, Number(member.telegramUserId));
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
