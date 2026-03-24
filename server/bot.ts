import TelegramBot from "node-telegram-bot-api";
import cron from "node-cron";
import { storage } from "./storage";
import path from "path";
import fs from "fs";

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot | null {
  return bot;
}

// Track user state for multi-step flow (in-memory, resets on restart)
const userStates: Map<string, {
  step: string;
  planId?: number;
  planName?: string;
  amount?: number;
  paymentMethod?: string;
  screenshotFileId?: string;
}> = new Map();

// ── Admin helper: send the main admin panel ───────────────────────────────────
async function sendAdminPanel(chatId: number) {
  if (!bot) return;
  const allMembers = await storage.getMembers();
  const allPayments = await storage.getPayments();
  const active = allMembers.filter(m => m.status === "active").length;
  const pending = allPayments.filter(p => p.status === "pending").length;
  const revenue = allPayments.filter(p => p.status === "verified").reduce((s, p) => s + (p.amount || 0), 0);

  await bot.sendMessage(chatId,
    `🛡️ *Admin Control Panel*\n\n` +
    `👥 Active Members: *${active}*\n` +
    `⏳ Pending Payments: *${pending}*\n` +
    `💰 Total Revenue: *₹${revenue}*\n\n` +
    `_Select an action below:_`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Live Stats", callback_data: "admin_stats" }, { text: "⏳ Pending Payments", callback_data: "admin_pending" }],
          [{ text: "👥 Active Members", callback_data: "admin_members" }, { text: "➕ Add Member", callback_data: "admin_addmember" }],
          [{ text: "📢 Broadcast Message", callback_data: "admin_broadcast" }],
        ],
      },
    }
  );
}

// ── Admin helper: send stats ──────────────────────────────────────────────────
async function sendAdminStats(chatId: number) {
  if (!bot) return;
  const allMembers = await storage.getMembers();
  const allPayments = await storage.getPayments();
  const active = allMembers.filter(m => m.status === "active").length;
  const expired = allMembers.filter(m => m.status === "expired").length;
  const banned = allMembers.filter(m => m.status === "banned").length;
  const pending = allPayments.filter(p => p.status === "pending").length;
  const verified = allPayments.filter(p => p.status === "verified").length;
  const revenue = allPayments.filter(p => p.status === "verified").reduce((s, p) => s + (p.amount || 0), 0);
  const today = allPayments.filter(p => p.status === "verified" && p.createdAt && new Date(p.createdAt).toDateString() === new Date().toDateString()).length;

  await bot.sendMessage(chatId,
    `📊 *Detailed Stats*\n\n` +
    `👥 Total Members: *${allMembers.length}*\n` +
    `✅ Active: *${active}*\n` +
    `❌ Expired: *${expired}*\n` +
    `🚫 Banned: *${banned}*\n\n` +
    `💳 Payments Today: *${today}*\n` +
    `⏳ Pending: *${pending}*\n` +
    `✅ Verified Total: *${verified}*\n` +
    `💰 Revenue: *₹${revenue}*`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀ Back to Admin Panel", callback_data: "admin_menu" }]] },
    }
  );
}

export async function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminId = process.env.TELEGRAM_ADMIN_ID;

  if (!token) {
    console.log("[Bot] TELEGRAM_BOT_TOKEN not set — bot not started.");
    return;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    bot.on("polling_error", (err) => console.error("[Bot] Polling error:", err.message));
    console.log("[Bot] Started successfully.");

    // ─── /start ──────────────────────────────────────────────────────────────
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      const firstName = msg.from?.first_name || "Friend";

      userStates.delete(userId);

      const plans = await storage.getActivePlans();
      if (!plans.length) {
        await bot!.sendMessage(chatId,
          `🔥 *WELCOME TO VIP ZONE* 🔥\n\n👋 Hey *${firstName}*!\n\nNo plans available yet. Check back soon!`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check existing membership
      const channels = await storage.getChannels();
      for (const ch of channels) {
        const member = await storage.getMemberByUserAndChannel(userId, ch.channelId);
        if (member && member.status === "active") {
          const expiry = member.expiresAt
            ? new Date(member.expiresAt).toLocaleDateString("en-IN")
            : "Lifetime";
          await bot!.sendMessage(chatId,
            `✅ *You already have an active membership!*\n\n` +
            `📦 Plan: *${member.planName || "VIP"}*\n` +
            `📅 Expires: *${expiry}*\n\n` +
            `To renew or upgrade, choose a plan below 👇`,
            { parse_mode: "Markdown" }
          );
        }
      }

      const welcomeText =
        `🔥 *WELCOME TO VIP ZONE* 🔥\n\n` +
        `👋 Hey *${firstName}*! Ready for premium access?\n\n` +
        `✨ *What you get:*\n` +
        `🚀 Exclusive premium content\n` +
        `⚡ Lightning fast access\n` +
        `🔒 Secure & private community\n` +
        `💎 VIP member benefits\n\n` +
        `👇 *Select your plan to get started:*`;

      const planButtons = plans.map(p => ([{
        text: `${p.name} — ₹${p.price} (${p.durationDays}d)`,
        callback_data: `select_plan:${p.id}`,
      }]));

      planButtons.push([{ text: "📊 My Status", callback_data: "my_status" }]);

      await bot!.sendMessage(chatId, welcomeText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: planButtons },
      });
    });

    // ─── /status ─────────────────────────────────────────────────────────────
    bot.onText(/\/status/, async (msg) => {
      await handleStatus(msg.chat.id, String(msg.from?.id));
    });

    // ─── /help ───────────────────────────────────────────────────────────────
    bot.onText(/\/help/, async (msg) => {
      await bot!.sendMessage(msg.chat.id,
        `📚 *Help Menu*\n\n` +
        `/start — Choose a plan & subscribe\n` +
        `/status — Check your membership status\n` +
        `/help — Show this menu\n\n` +
        `*How to subscribe:*\n` +
        `1️⃣ Use /start and pick a plan\n` +
        `2️⃣ Pay via UPI or Bitcoin\n` +
        `3️⃣ Send your UTR/reference number\n` +
        `4️⃣ Wait for verification (usually < 5 min)\n` +
        `5️⃣ Get your invite link automatically!\n\n` +
        `📞 Need help? Contact the admin.`,
        { parse_mode: "Markdown" }
      );
    });

    // ─── Admin commands ───────────────────────────────────────────────────────
    bot.onText(/\/admin/, async (msg) => {
      if (String(msg.from?.id) !== adminId) return;
      await sendAdminPanel(msg.chat.id);
    });

    bot.onText(/\/verify (.+)/, async (msg, match) => {
      if (String(msg.from?.id) !== adminId) return;
      await handleAdminVerify(match![1].trim(), msg.chat.id);
    });

    bot.onText(/\/reject (.+)/, async (msg, match) => {
      if (String(msg.from?.id) !== adminId) return;
      await handleAdminReject(match![1].trim(), msg.chat.id);
    });

    bot.onText(/\/stats/, async (msg) => {
      if (String(msg.from?.id) !== adminId) return;
      await sendAdminStats(msg.chat.id);
    });

    // ─── Messages (screenshot + UTR + admin states) ──────────────────────────
    bot.on("message", async (msg) => {
      if (msg.text?.startsWith("/")) return; // skip commands
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      const state = userStates.get(userId);
      if (!state) return;

      // ── Admin: Broadcast message ──
      if (state.step === "admin_broadcast" && userId === adminId) {
        const text = msg.text?.trim();
        if (!text) return;
        userStates.delete(userId);
        const activeMembers = (await storage.getMembers()).filter(m => m.status === "active");
        let sent = 0, failed = 0;
        for (const m of activeMembers) {
          try { await bot!.sendMessage(Number(m.telegramUserId), text, { parse_mode: "Markdown" }); sent++; }
          catch (e) { failed++; }
        }
        await bot!.sendMessage(chatId,
          `✅ *Broadcast sent!*\n\n📤 Sent: *${sent}*\n❌ Failed: *${failed}*`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Admin Panel", callback_data: "admin_menu" }]] } }
        );
        return;
      }

      // ── Admin: Add member — waiting for user ID ──
      if (state.step === "admin_add_userid" && userId === adminId) {
        const inputId = msg.text?.trim();
        if (!inputId) return;
        userStates.set(userId, { ...state, step: "admin_add_plan", screenshotFileId: inputId });
        const plans = await storage.getActivePlans();
        const planButtons = plans.map(p => ([{ text: `${p.name} — ₹${p.price} (${p.durationDays}d)`, callback_data: `admin_doaddmember:${inputId}:${p.id}` }]));
        planButtons.push([{ text: "◀ Cancel", callback_data: "admin_menu" }]);
        await bot!.sendMessage(chatId, `👤 User ID: \`${inputId}\`\n\nNow select a plan:`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: planButtons },
        });
        return;
      }

      // ── Step 1: Waiting for screenshot (photo) ──
      if (state.step === "awaiting_screenshot") {
        if (msg.photo && msg.photo.length > 0) {
          // Get highest-res photo
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          // Save file_id in state, move to UTR step
          userStates.set(userId, { ...state, step: "awaiting_utr", screenshotFileId: fileId });

          const label = state.paymentMethod === "bitcoin" ? "Transaction Hash (TX ID)" : "UTR / Reference Number";
          await bot!.sendMessage(chatId,
            `✅ *Screenshot received!*\n\n` +
            `📝 *Step 2: Send your ${label}*\n\n` +
            `${state.paymentMethod === "bitcoin"
              ? "Copy the Transaction ID from your Bitcoin wallet."
              : "Open GPay/PhonePe → Transaction History → copy the 12-digit UTR number."
            }\n\n` +
            `Just type/paste it below 👇`,
            { parse_mode: "Markdown" }
          );
        } else {
          // User sent text instead of photo
          await bot!.sendMessage(chatId,
            `📸 Please send a *photo/screenshot* of your payment.\n\nIf you don't have a screenshot, send your UTR/TX hash and we'll process it manually.`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[
                  { text: "⏭ Skip — Enter UTR directly", callback_data: `skip_screenshot:${state.planId}:${state.paymentMethod || "upi"}` }
                ]],
              },
            }
          );
        }
        return;
      }

      // ── Step 2: Waiting for UTR number (text) ──
      if (state.step === "awaiting_utr") {
        const utr = msg.text?.trim();
        if (!utr || utr.length < 6) {
          await bot!.sendMessage(chatId,
            "❌ Please send a valid UTR/Reference number (at least 6 characters)."
          );
          return;
        }
        await submitPayment(chatId, userId, msg.from?.username || "", msg.from?.first_name || "", utr, state);
        userStates.delete(userId);
      }
    });

    // ─── Callback queries ─────────────────────────────────────────────────────
    bot.on("callback_query", async (query) => {
      try {
      const chatId = query.message?.chat.id;
      const msgId = query.message?.message_id;
      const userId = String(query.from.id);
      const firstName = query.from.first_name || "Friend";
      const username = query.from.username || "";
      if (!chatId) return;
      await bot!.answerCallbackQuery(query.id);

      const data = query.data || "";

      // ── Plan selection ──
      if (data.startsWith("select_plan:")) {
        const planId = parseInt(data.split(":")[1]);
        const plan = await storage.getPlanById(planId);
        if (!plan) {
          await bot!.sendMessage(chatId, "❌ Plan not found. Use /start to try again.");
          return;
        }

        userStates.set(userId, { step: "select_payment", planId: plan.id, planName: plan.name, amount: plan.price });

        await bot!.sendMessage(chatId,
          `💎 *${plan.name} Plan Selected*\n\n` +
          `💰 Amount: *₹${plan.price}*\n` +
          `⏱ Duration: *${plan.durationDays} days*\n\n` +
          `Choose your payment method:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏦 Pay via UPI", callback_data: `pay_upi:${planId}` }],
                [{ text: "₿ Pay via Bitcoin", callback_data: `pay_btc:${planId}` }],
                [{ text: "◀ Back", callback_data: "back_plans" }],
              ],
            },
          }
        );
      }

      // ── UPI Payment ──
      else if (data.startsWith("pay_upi:")) {
        const planId = parseInt(data.split(":")[1]);
        const plan = await storage.getPlanById(planId);
        if (!plan) return;

        const upiSetting = await storage.getSetting("upi_id");
        const upiId = upiSetting?.value || "bs883653-2@oksbi";
        const upiNameSetting = await storage.getSetting("upi_name");
        const upiName = upiNameSetting?.value || "Bindar Singh";

        userStates.set(userId, { step: "awaiting_utr", planId: plan.id, planName: plan.name, amount: plan.price, paymentMethod: "upi" });

        const upiCaption =
          `💳 *UPI Payment*\n\n` +
          `📦 Plan: *${plan.name}*\n` +
          `💰 Pay Exactly: *₹${plan.price}*\n\n` +
          `🏦 UPI ID: \`${upiId}\`\n` +
          `👤 Name: *${upiName}*\n\n` +
          `📱 Scan the QR code or manually enter the UPI ID above in any UPI app (GPay, PhonePe, Paytm)\n\n` +
          `After paying, tap the button below 👇`;

        const upiButtons = {
          inline_keyboard: [
            [{ text: "✅ I've Paid — Enter UTR Number", callback_data: `confirm_paid:${planId}:upi` }],
            [{ text: "◀ Back", callback_data: "back_plans" }],
          ],
        };

        // Send QR image
        const qrPath = path.join(process.cwd(), "client", "public", "upi-qr.jpg");
        try {
          if (fs.existsSync(qrPath)) {
            await bot!.sendPhoto(chatId, qrPath, {
              caption: upiCaption,
              parse_mode: "Markdown",
              reply_markup: upiButtons,
            });
          } else {
            await bot!.sendMessage(chatId, upiCaption, {
              parse_mode: "Markdown",
              reply_markup: upiButtons,
            });
          }
        } catch (e: any) {
          console.error("[Bot] sendPhoto error:", e.message);
          await bot!.sendMessage(chatId, upiCaption, {
            parse_mode: "Markdown",
            reply_markup: upiButtons,
          });
        }
      }

      // ── Bitcoin Payment ──
      else if (data.startsWith("pay_btc:")) {
        const planId = parseInt(data.split(":")[1]);
        const plan = await storage.getPlanById(planId);
        if (!plan) return;

        const btcSetting = await storage.getSetting("bitcoin_address");
        const btcAddress = btcSetting?.value || "bc1qe6q4g9gng3f9f3raezx4002yeuv3572v40acuc";

        userStates.set(userId, { step: "awaiting_utr", planId: plan.id, planName: plan.name, amount: plan.price, paymentMethod: "bitcoin" });

        await bot!.sendMessage(chatId,
          `₿ *Bitcoin Payment*\n\n` +
          `📦 Plan: *${plan.name}*\n\n` +
          `📬 *BTC Address:*\n\`${btcAddress}\`\n\n` +
          `⚠️ Send the equivalent BTC for ₹${plan.price}\n` +
          `(Check current BTC/INR rate before sending)\n\n` +
          `After sending, tap below and send your *Transaction Hash*:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ I've Paid — Enter TX Hash", callback_data: `confirm_paid:${planId}:bitcoin` }],
                [{ text: "◀ Back", callback_data: "back_plans" }],
              ],
            },
          }
        );
      }

      // ── Confirm paid → ask for screenshot first ──
      else if (data.startsWith("confirm_paid:")) {
        const parts = data.split(":");
        const planId = parseInt(parts[1]);
        const method = parts[2] || "upi";
        const plan = await storage.getPlanById(planId);
        if (!plan) return;

        userStates.set(userId, { step: "awaiting_screenshot", planId: plan.id, planName: plan.name, amount: plan.price, paymentMethod: method });

        await bot!.sendMessage(chatId,
          `📸 *Step 1: Send Payment Screenshot*\n\n` +
          `Please send a *screenshot* of your payment confirmation from your payment app.\n\n` +
          `📱 GPay/PhonePe/Paytm → Transaction History → Screenshot\n` +
          `₿ Bitcoin → Copy transaction confirmation screenshot\n\n` +
          `Send the photo now 👇`,
          { parse_mode: "Markdown" }
        );
      }

      // ── Skip screenshot → go straight to UTR ──
      else if (data.startsWith("skip_screenshot:")) {
        const parts = data.split(":");
        const planId = parseInt(parts[1]);
        const method = parts[2] || "upi";
        const plan = await storage.getPlanById(planId);
        if (!plan) return;

        const existing = userStates.get(userId) || {};
        userStates.set(userId, { ...existing, step: "awaiting_utr", planId: plan.id, planName: plan.name, amount: plan.price, paymentMethod: method });

        const label = method === "bitcoin" ? "Transaction Hash (TX ID)" : "UTR / Reference Number";
        await bot!.sendMessage(chatId,
          `📝 *Send your ${label}*\n\n` +
          `${method === "bitcoin"
            ? "Copy the Transaction ID from your Bitcoin wallet."
            : "Open GPay/PhonePe → Transaction History → copy the 12-digit UTR number."
          }\n\n` +
          `Just type/paste it below 👇`,
          { parse_mode: "Markdown" }
        );
      }

      // ── Back to plans ──
      else if (data === "back_plans") {
        userStates.delete(userId);
        const plans = await storage.getActivePlans();
        const planButtons = plans.map(p => ([{
          text: `${p.name} — ₹${p.price} (${p.durationDays}d)`,
          callback_data: `select_plan:${p.id}`,
        }]));
        planButtons.push([{ text: "📊 My Status", callback_data: "my_status" }]);
        await bot!.sendMessage(chatId,
          `👇 *Select your plan:*`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: planButtons } }
        );
      }

      // ── My Status ──
      else if (data === "my_status") {
        await handleStatus(chatId, userId);
      }

      // ── Admin inline verification ──
      else if (data.startsWith("admin_verify:")) {
        if (userId !== adminId) return;
        const paymentId = parseInt(data.split(":")[1]);
        await verifyPaymentAndAddMember(paymentId, chatId);
      }

      else if (data.startsWith("admin_reject:")) {
        if (userId !== adminId) return;
        const paymentId = parseInt(data.split(":")[1]);
        const payment = await storage.getPaymentById(paymentId);
        if (!payment) return;
        await storage.updatePaymentStatus(payment.id, "rejected", "Rejected by admin");
        await bot!.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId });
        await bot!.sendMessage(chatId, `❌ Payment #${payment.id} rejected.`);
        try {
          await bot!.sendMessage(Number(payment.telegramUserId),
            `❌ *Payment Rejected*\n\nTxn: \`${payment.txnId}\`\nPlease contact the admin if you believe this is an error.`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {}
      }

      // ── Admin panel menu ──
      else if (data === "admin_menu") {
        if (userId !== adminId) return;
        await sendAdminPanel(chatId);
      }

      else if (data === "admin_stats") {
        if (userId !== adminId) return;
        await sendAdminStats(chatId);
      }

      else if (data === "admin_pending") {
        if (userId !== adminId) return;
        const allPayments = await storage.getPayments();
        const pending = allPayments.filter(p => p.status === "pending");
        if (!pending.length) {
          await bot!.sendMessage(chatId, `✅ No pending payments right now!`,
            { reply_markup: { inline_keyboard: [[{ text: "◀ Back", callback_data: "admin_menu" }]] } }
          );
          return;
        }
        for (const p of pending.slice(0, 8)) {
          await bot!.sendMessage(chatId,
            `⏳ *Pending #${p.id}*\n` +
            `👤 ${p.firstName || ""}${p.username ? ` @${p.username}` : ""}\n` +
            `📋 ${(p as any).paymentMethod === "bitcoin" ? "TX Hash" : "UTR"}: \`${p.txnId}\`\n` +
            `📦 ${p.planName} — ₹${p.amount}`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[
                { text: "✅ Verify", callback_data: `admin_verify:${p.id}` },
                { text: "❌ Reject", callback_data: `admin_reject:${p.id}` },
              ]] },
            }
          );
        }
        await bot!.sendMessage(chatId, `_Showing ${Math.min(pending.length, 8)} of ${pending.length} pending_`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back", callback_data: "admin_menu" }]] } }
        );
      }

      else if (data === "admin_members") {
        if (userId !== adminId) return;
        const allMembers = await storage.getMembers();
        const active = allMembers.filter(m => m.status === "active");
        if (!active.length) {
          await bot!.sendMessage(chatId, `ℹ️ No active members yet.`,
            { reply_markup: { inline_keyboard: [[{ text: "◀ Back", callback_data: "admin_menu" }]] } }
          );
          return;
        }
        let text = `👥 *Active Members (${active.length})*\n\n`;
        for (const m of active.slice(0, 15)) {
          const days = m.expiresAt ? Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / 86400000) : null;
          text += `• ${m.firstName || ""}${m.username ? ` @${m.username}` : ""} — ${m.planName || "N/A"} — ${days !== null ? `${days}d left` : "∞"}\n`;
        }
        if (active.length > 15) text += `\n_...and ${active.length - 15} more_`;
        await bot!.sendMessage(chatId, text, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "◀ Back", callback_data: "admin_menu" }]] },
        });
      }

      else if (data === "admin_broadcast") {
        if (userId !== adminId) return;
        userStates.set(userId, { step: "admin_broadcast" });
        await bot!.sendMessage(chatId,
          `📢 *Broadcast Message*\n\nType the message to send to all active members.\nSupports *bold*, _italic_, \`code\`\n\nSend your message now:`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] } }
        );
      }

      else if (data === "admin_addmember") {
        if (userId !== adminId) return;
        userStates.set(userId, { step: "admin_add_userid" });
        await bot!.sendMessage(chatId,
          `➕ *Add Member Manually*\n\nSend the Telegram *User ID* of the person to add.\n\n_Tip: User can forward any message to @userinfobot to get their ID_`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] } }
        );
      }

      else if (data.startsWith("admin_doaddmember:")) {
        if (userId !== adminId) return;
        const parts = data.split(":");
        const targetUserId = parts[1];
        const planId = parseInt(parts[2]);
        userStates.delete(userId);
        const plan = await storage.getPlanById(planId);
        if (!plan) return;
        const channels = await storage.getChannels();
        const channel = channels.find(c => c.isActive) || channels[0];
        if (!channel) {
          await bot!.sendMessage(chatId, "❌ No active channel configured.");
          return;
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
        const existing = await storage.getMemberByUserAndChannel(targetUserId, channel.channelId);
        if (existing) {
          const base = existing.expiresAt && new Date(existing.expiresAt) > new Date() ? new Date(existing.expiresAt) : new Date();
          const newExpiry = new Date(base.getTime() + plan.durationDays * 86400000);
          await storage.updateMemberExpiry(existing.id, newExpiry, "active", plan.name);
        } else {
          await storage.createMember({ telegramUserId: targetUserId, username: "", firstName: "", channelId: channel.channelId, planId: plan.id, planName: plan.name, expiresAt, status: "active" });
        }
        let inviteLink = "";
        try {
          const link = await bot!.createChatInviteLink(channel.channelId, { expire_date: Math.floor(expiresAt.getTime() / 1000) });
          inviteLink = link.invite_link;
        } catch (e) {}
        await bot!.sendMessage(chatId,
          `✅ *Member Added!*\n\nUser ID: \`${targetUserId}\`\nPlan: *${plan.name}*\nExpires: *${expiresAt.toLocaleDateString("en-IN")}*`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Admin Panel", callback_data: "admin_menu" }]] } }
        );
        try {
          await bot!.sendMessage(Number(targetUserId),
            `🎉 *You've been added to VIP Zone!*\n\n📦 Plan: *${plan.name}*\n📅 Expires: *${expiresAt.toLocaleDateString("en-IN")}*\n\n${inviteLink ? `🔗 *Join now:*\n${inviteLink}` : "Contact admin for the invite link."}`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {}
      }

      else if (data === "admin_cancel_state") {
        if (userId !== adminId) return;
        userStates.delete(userId);
        await sendAdminPanel(chatId);
      }
      } catch (cbErr: any) {
        console.error("[Bot] Callback handler error:", cbErr?.message || cbErr);
      }
    });

    // ─── Cron: Auto-expire every hour ────────────────────────────────────────
    cron.schedule("0 * * * *", async () => {
      console.log("[Cron] Checking expired members...");
      await expireMembers();
    });

    // Also run 10s after start
    setTimeout(expireMembers, 10000);

  } catch (err) {
    console.error("[Bot] Failed to initialize:", err);
  }
}

// ── Submit payment (after screenshot + UTR capture) ───────────────────────────
async function submitPayment(
  chatId: number,
  userId: string,
  username: string,
  firstName: string,
  utr: string,
  state: { planId?: number; planName?: string; amount?: number; paymentMethod?: string; screenshotFileId?: string }
) {
  const adminId = process.env.TELEGRAM_ADMIN_ID;

  // Check duplicate UTR
  const existing = await storage.getPaymentByTxnId(utr);
  if (existing) {
    await bot!.sendMessage(chatId,
      `⚠️ *This UTR/TXN has already been submitted!*\n\nIf you need help, contact the admin.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const channels = await storage.getChannels();
  const channel = channels.find(c => c.isActive);

  const payment = await storage.createPayment({
    telegramUserId: userId,
    username,
    firstName,
    txnId: utr,
    planId: state.planId,
    planName: state.planName,
    amount: state.amount,
    channelId: channel?.channelId || "",
    status: "pending",
    screenshotFileId: state.screenshotFileId || null,
    paymentMethod: state.paymentMethod || "upi",
  });

  await bot!.sendMessage(chatId,
    `✅ *Payment Submitted Successfully!*\n\n` +
    `📋 Ref: \`${utr}\`\n` +
    `📦 Plan: *${state.planName}*\n` +
    `💰 Amount: ₹${state.amount}\n` +
    `🏦 Method: ${state.paymentMethod === "bitcoin" ? "Bitcoin" : "UPI"}\n` +
    (state.screenshotFileId ? `📸 Screenshot: Attached ✓\n` : "") +
    `\n⏳ *Verification in progress...*\n` +
    `You'll receive your channel invite link automatically once verified!\n\n` +
    `Usually takes less than 5 minutes.`,
    { parse_mode: "Markdown" }
  );

  // Notify admin with quick action buttons
  if (adminId) {
    try {
      const adminText =
        `🔔 *New Payment Received!*\n\n` +
        `👤 User: ${firstName}${username ? ` (@${username})` : ""}\n` +
        `🆔 User ID: \`${userId}\`\n` +
        `📋 ${state.paymentMethod === "bitcoin" ? "TX Hash" : "UTR"}: \`${utr}\`\n` +
        `📦 Plan: *${state.planName}* — ₹${state.amount}\n` +
        `🏦 Method: ${state.paymentMethod === "bitcoin" ? "Bitcoin" : "UPI"}\n` +
        `📸 Screenshot: ${state.screenshotFileId ? "Attached below ⬇️" : "Not provided"}\n` +
        `⏰ ${new Date().toLocaleString("en-IN")}`;

      const adminButtons = {
        inline_keyboard: [[
          { text: "✅ Verify & Add", callback_data: `admin_verify:${payment.id}` },
          { text: "❌ Reject", callback_data: `admin_reject:${payment.id}` },
        ]],
      };

      // If screenshot exists, send it with caption + buttons
      if (state.screenshotFileId) {
        await bot!.sendPhoto(Number(adminId), state.screenshotFileId, {
          caption: adminText,
          parse_mode: "Markdown",
          reply_markup: adminButtons,
        });
      } else {
        await bot!.sendMessage(Number(adminId), adminText, {
          parse_mode: "Markdown",
          reply_markup: adminButtons,
        });
      }
    } catch (e) {
      console.error("[Bot] Failed to notify admin:", e);
    }
  }
}

// ── Status handler ────────────────────────────────────────────────────────────
async function handleStatus(chatId: number, userId: string) {
  const channels = await storage.getChannels();
  let found = false;
  for (const ch of channels) {
    const member = await storage.getMemberByUserAndChannel(userId, ch.channelId);
    if (member) {
      found = true;
      const expiry = member.expiresAt
        ? new Date(member.expiresAt).toLocaleDateString("en-IN")
        : "Lifetime";
      const daysLeft = member.expiresAt
        ? Math.ceil((new Date(member.expiresAt).getTime() - Date.now()) / 86400000)
        : null;
      const statusEmoji = member.status === "active" ? "✅" : member.status === "expired" ? "❌" : "⏳";
      await bot!.sendMessage(chatId,
        `📊 *Your Membership*\n\n` +
        `Channel: *${ch.channelName}*\n` +
        `Plan: *${member.planName || "VIP"}*\n` +
        `Status: ${statusEmoji} *${member.status.toUpperCase()}*\n` +
        `Expires: *${expiry}*\n` +
        (daysLeft !== null ? `Days Left: *${daysLeft > 0 ? daysLeft : 0}*\n` : "") +
        `\n${member.status === "expired" ? "🔄 Use /start to renew!" : "Keep enjoying VIP access! 🎉"}`,
        { parse_mode: "Markdown" }
      );
    }
  }
  if (!found) {
    await bot!.sendMessage(chatId,
      `ℹ️ *No active membership found.*\n\nUse /start to subscribe!`,
      { parse_mode: "Markdown" }
    );
  }
}

// ── Expire members ─────────────────────────────────────────────────────────────
async function expireMembers() {
  const expired = await storage.getExpiredActiveMembers();
  for (const member of expired) {
    await storage.updateMemberStatus(member.id, "expired");
    console.log(`[Cron] Expired: ${member.telegramUserId} in ${member.channelId}`);
    if (bot) {
      const channels = await storage.getChannels();
      const ch = channels.find(c => c.channelId === member.channelId);
      if (ch) {
        try {
          await bot.banChatMember(ch.channelId, Number(member.telegramUserId));
          await bot.unbanChatMember(ch.channelId, Number(member.telegramUserId));
        } catch (e: any) {
          console.error(`[Cron] Remove failed: ${e.message}`);
        }
        try {
          await bot.sendMessage(Number(member.telegramUserId),
            `⚠️ *Membership Expired!*\n\n` +
            `Your access to *${ch.channelName}* has ended.\n\n` +
            `🔄 Renew instantly with /start — choose a plan and pay via UPI!`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {}
      }
    }
  }
}

// ── Verify payment & add to channel ──────────────────────────────────────────
export async function verifyPaymentAndAddMember(paymentId: number, adminChatId?: number): Promise<boolean> {
  const payment = await storage.getPaymentById(paymentId);
  if (!payment) return false;
  if (payment.status === "verified") {
    if (bot && adminChatId) await bot.sendMessage(adminChatId, "ℹ️ Already verified.");
    return true;
  }

  const plan = payment.planId ? await storage.getPlanById(payment.planId) : null;
  const channels = await storage.getChannels();
  const channel = channels.find(c => c.isActive) || channels[0];

  await storage.updatePaymentStatus(paymentId, "verified", undefined, new Date());

  if (channel && plan) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    const existing = await storage.getMemberByUserAndChannel(payment.telegramUserId, channel.channelId);
    if (existing) {
      const base = existing.expiresAt && new Date(existing.expiresAt) > new Date()
        ? new Date(existing.expiresAt)
        : new Date();
      const newExpiry = new Date(base.getTime() + plan.durationDays * 86400000);
      await storage.updateMemberExpiry(existing.id, newExpiry, "active", plan.name);
    } else {
      await storage.createMember({
        telegramUserId: payment.telegramUserId,
        username: payment.username,
        firstName: payment.firstName,
        channelId: channel.channelId,
        planId: plan.id,
        planName: plan.name,
        expiresAt,
        status: "active",
      });
    }

    if (bot) {
      // Generate invite link valid for the plan duration
      let inviteLink = channel.inviteLink;
      try {
        const link = await bot.createChatInviteLink(channel.channelId, {
          creates_join_request: false,
          expire_date: Math.floor(expiresAt.getTime() / 1000), // expires when membership expires
        });
        inviteLink = link.invite_link;
      } catch (e: any) {
        console.error("[Bot] Invite link error:", e.message);
      }

      try {
        await bot.sendMessage(Number(payment.telegramUserId),
          `🎉 *Payment Verified! Welcome to VIP Zone!*\n\n` +
          `📦 Plan: *${plan.name}*\n` +
          `⏱ Duration: *${plan.durationDays} days*\n` +
          `📅 Expires: *${new Date(expiresAt).toLocaleDateString("en-IN")}*\n\n` +
          `🔗 *Join the Channel:*\n${inviteLink || "Contact admin for link."}\n\n` +
          `✅ This link stays valid until your membership expires.\n` +
          `⚠️ Do not share this link with others!`,
          { parse_mode: "Markdown" }
        );
      } catch (e: any) {
        console.error("[Bot] Message user error:", e.message);
      }
    }
  }

  if (bot && adminChatId) {
    await bot.sendMessage(adminChatId,
      `✅ Payment #${paymentId} verified! Member added to channel.`
    );
  }

  return true;
}

// ── Admin helpers ─────────────────────────────────────────────────────────────
async function handleAdminVerify(txnId: string, adminChatId: number) {
  const payment = await storage.getPaymentByTxnId(txnId);
  if (!payment) {
    await bot!.sendMessage(adminChatId, `❌ Not found: \`${txnId}\``, { parse_mode: "Markdown" });
    return;
  }
  await verifyPaymentAndAddMember(payment.id, adminChatId);
}

async function handleAdminReject(txnId: string, adminChatId: number) {
  const payment = await storage.getPaymentByTxnId(txnId);
  if (!payment) {
    await bot!.sendMessage(adminChatId, `❌ Not found: \`${txnId}\``, { parse_mode: "Markdown" });
    return;
  }
  await storage.updatePaymentStatus(payment.id, "rejected", "Rejected by admin");
  await bot!.sendMessage(adminChatId, `❌ Rejected: \`${txnId}\``, { parse_mode: "Markdown" });
  try {
    await bot!.sendMessage(Number(payment.telegramUserId),
      `❌ *Payment Rejected*\n\nRef: \`${payment.txnId}\`\nContact admin for assistance.`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {}
}
