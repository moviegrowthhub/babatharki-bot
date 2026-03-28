import TelegramBot from "node-telegram-bot-api";
import cron from "node-cron";
import { storage } from "./storage";
import path from "path";
import fs from "fs";

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot | null {
  return bot;
}

const userStates: Map<string, {
  step: string;
  planId?: number;
  planName?: string;
  amount?: number;
  paymentMethod?: string;
  screenshotFileId?: string;
}> = new Map();

// ── Admin Panel ───────────────────────────────────────────────────────────────
async function sendAdminPanel(chatId: number, editMsgId?: number) {
  if (!bot) return;
  const allMembers = await storage.getMembers();
  const allPayments = await storage.getPayments();
  const active = allMembers.filter(m => m.status === "active").length;
  const expired = allMembers.filter(m => m.status === "expired").length;
  const pending = allPayments.filter(p => p.status === "pending").length;
  const revenue = allPayments.filter(p => p.status === "verified").reduce((s, p) => s + (p.amount || 0), 0);
  const today = allPayments.filter(p => p.status === "verified" && p.verifiedAt && new Date(p.verifiedAt).toDateString() === new Date().toDateString()).reduce((s, p) => s + (p.amount || 0), 0);

  const text =
    `🛡️ *VIP Zone — Admin Panel*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 Active Members: *${active}*\n` +
    `⌛ Expired Members: *${expired}*\n` +
    `⏳ Pending Payments: *${pending}*\n` +
    `💰 Total Revenue: *₹${revenue}*\n` +
    `📅 Today's Revenue: *₹${today}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Select an action:_`;

  const banned = allMembers.filter(m => m.status === "banned").length;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📊 Live Stats", callback_data: "admin_stats" },
        { text: `⏳ Pending (${pending})`, callback_data: "admin_pending" },
      ],
      [
        { text: "👥 Active Members", callback_data: "admin_members" },
        { text: "❌ Expired Members", callback_data: "admin_expired" },
      ],
      [
        { text: `🚫 Banned (${banned})`, callback_data: "admin_banned" },
        { text: "➕ Add Member", callback_data: "admin_addmember" },
      ],
      [
        { text: "📢 Broadcast", callback_data: "admin_broadcast" },
        { text: "💰 Revenue Report", callback_data: "admin_revenue" },
      ],
      [
        { text: "⚙️ Settings", callback_data: "admin_settings" },
        { text: "🔄 Refresh", callback_data: "admin_menu" },
      ],
    ],
  };

  if (editMsgId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: editMsgId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      return;
    } catch (_) {}
  }
  await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: keyboard });
}

// ── Admin Stats ───────────────────────────────────────────────────────────────
async function sendAdminStats(chatId: number, editMsgId?: number) {
  if (!bot) return;
  const allMembers = await storage.getMembers();
  const allPayments = await storage.getPayments();
  const active = allMembers.filter(m => m.status === "active").length;
  const expired = allMembers.filter(m => m.status === "expired").length;
  const banned = allMembers.filter(m => m.status === "banned").length;
  const pending = allPayments.filter(p => p.status === "pending").length;
  const verified = allPayments.filter(p => p.status === "verified").length;
  const rejected = allPayments.filter(p => p.status === "rejected").length;
  const revenue = allPayments.filter(p => p.status === "verified").reduce((s, p) => s + (p.amount || 0), 0);
  const todayPayments = allPayments.filter(p => p.status === "verified" && p.verifiedAt && new Date(p.verifiedAt).toDateString() === new Date().toDateString());
  const todayRevenue = todayPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const text =
    `📊 *Detailed Stats*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 *Members*\n` +
    `  ✅ Active: *${active}*\n` +
    `  ❌ Expired: *${expired}*\n` +
    `  🚫 Banned: *${banned}*\n` +
    `  📌 Total: *${allMembers.length}*\n\n` +
    `💳 *Payments*\n` +
    `  ⏳ Pending: *${pending}*\n` +
    `  ✅ Verified: *${verified}*\n` +
    `  ❌ Rejected: *${rejected}*\n\n` +
    `💰 *Revenue*\n` +
    `  📅 Today: *₹${todayRevenue}* (${todayPayments.length} payments)\n` +
    `  📈 Total: *₹${revenue}*\n` +
    `━━━━━━━━━━━━━━━━━━━━`;

  const opts: any = {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
  };
  if (editMsgId) {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: editMsgId, ...opts });
      return;
    } catch (_) {}
  }
  await bot.sendMessage(chatId, text, opts);
}

export async function handleWebhookUpdate(update: any) {
  if (!bot) return;
  bot.processUpdate(update);
}

export async function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminId = process.env.TELEGRAM_ADMIN_ID;

  if (!token) {
    console.log("[Bot] TELEGRAM_BOT_TOKEN not set — bot not started.");
    return;
  }

  const isProd = process.env.NODE_ENV === "production";

  const allowedUpdates = ["message", "callback_query", "chat_member", "my_chat_member"];

  try {
    if (isProd) {
      // Production: use webhook, no polling
      bot = new TelegramBot(token, { polling: false });
      const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAIN;
      if (domain) {
        const webhookUrl = `https://${domain}/api/telegram-webhook`;
        await (bot as any).setWebHook(webhookUrl, { allowed_updates: allowedUpdates });
        console.log(`[Bot] Webhook set to: ${webhookUrl}`);
      } else {
        console.log("[Bot] No domain found for webhook, falling back to polling.");
        (bot as any).startPolling({ params: { allowed_updates: allowedUpdates } });
        bot.on("polling_error", (err) => console.error("[Bot] Polling error:", err.message));
      }
    } else {
      // Development: use polling
      bot = new TelegramBot(token, {
        polling: { params: { allowed_updates: JSON.stringify(allowedUpdates) } as any },
      });
      bot.on("polling_error", (err) => console.error("[Bot] Polling error:", err.message));
    }
    console.log(`[Bot] Started successfully (${isProd ? "webhook" : "polling"} mode).`);

    // ─── Auto-revoke invite link when member joins ─────────────────────────
    (bot as any).on("chat_member", async (update: any) => {
      try {
        const newMember = update.new_chat_member;
        const inviteLink = update.invite_link;

        const justJoined =
          newMember.status === "member" &&
          (update.old_chat_member?.status === "left" || update.old_chat_member?.status === "kicked");

        if (justJoined && inviteLink?.invite_link) {
          try {
            await bot!.revokeChatInviteLink(String(update.chat.id), inviteLink.invite_link);
            console.log(`[Bot] ✅ Invite link revoked after user ${newMember.user.id} joined chat ${update.chat.id}`);
          } catch (e: any) {
            console.error("[Bot] Failed to revoke invite link:", e.message);
          }
        }
      } catch (e: any) {
        console.error("[Bot] chat_member handler error:", e.message);
      }
    });

    // ─── Auto-register group when bot is added as admin ──────────────────────
    (bot as any).on("my_chat_member", async (update: any) => {
      try {
        const newStatus = update.new_chat_member?.status;
        const chat = update.chat;
        if (!chat || chat.type === "private") return;

        const isPromotedToAdmin = (newStatus === "administrator" || newStatus === "member") &&
          (update.old_chat_member?.status === "left" || update.old_chat_member?.status === "kicked" || update.old_chat_member?.status === "restricted");

        if (isPromotedToAdmin || newStatus === "administrator") {
          const channelId = String(chat.id);
          const channelName = chat.title || channelId;
          const existing = await storage.getChannels();
          const alreadyExists = existing.find(c => c.channelId === channelId);
          if (!alreadyExists) {
            await storage.createChannel({
              channelId,
              channelName,
              channelUsername: chat.username || undefined,
              inviteLink: `https://t.me/+BrUETfNf9sM0YWE9`,
              isActive: true,
            });
            console.log(`[Bot] ✅ Auto-registered group: ${channelName} (${channelId})`);
            const adminId = process.env.TELEGRAM_ADMIN_ID;
            if (adminId) {
              await bot!.sendMessage(Number(adminId),
                `✅ *Group Auto-Registered!*\n\n📌 Name: *${channelName}*\n🆔 ID: \`${channelId}\`\n\nPayment verified users will now be sent invite links to this group.`,
                { parse_mode: "Markdown" }
              );
            }
          }
        }
      } catch (e: any) {
        console.error("[Bot] my_chat_member handler error:", e.message);
      }
    });

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

      const channels = await storage.getChannels();
      for (const ch of channels) {
        const member = await storage.getMemberByUserAndChannel(userId, ch.channelId);
        if (member && member.status === "active") {
          const expiry = member.expiresAt
            ? new Date(member.expiresAt).toLocaleDateString("en-IN")
            : "Lifetime";
          const daysLeft = member.expiresAt
            ? Math.max(0, Math.ceil((new Date(member.expiresAt).getTime() - Date.now()) / 86400000))
            : null;
          await bot!.sendMessage(chatId,
            `✅ *Active Membership Found!*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📦 Plan: *${member.planName || "VIP"}*\n` +
            `📅 Expires: *${expiry}*\n` +
            (daysLeft !== null ? `⏳ Days Left: *${daysLeft}*\n` : "") +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `To renew or upgrade, choose a plan below 👇`,
            { parse_mode: "Markdown" }
          );
        }
      }

      const welcomeText =
        `🔥 *WELCOME TO VIP ZONE* 🔥\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👋 Hey *${firstName}*! Ready for premium access?\n\n` +
        `✨ *What you get:*\n` +
        `  🚀 Exclusive premium signals\n` +
        `  ⚡ Real-time alerts\n` +
        `  🔒 Private VIP community\n` +
        `  💎 Expert analysis\n\n` +
        `📦 *Choose your plan below:*`;

      const planButtons = plans.map(p => ([{
        text: `💎 ${p.name} — ₹${p.price} (${p.durationDays} days)`,
        callback_data: `select_plan:${p.id}`,
      }]));
      planButtons.push([{ text: "📊 My Membership Status", callback_data: "my_status" }]);

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
        `📚 *Help Menu*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `/start — Choose a plan & subscribe\n` +
        `/status — Check your membership\n` +
        `/help — Show this menu\n\n` +
        `*How to subscribe:*\n` +
        `1️⃣ Use /start and pick a plan\n` +
        `2️⃣ Pay via UPI or Bitcoin\n` +
        `3️⃣ Send payment screenshot\n` +
        `4️⃣ Send your UTR/reference number\n` +
        `5️⃣ Get verified & receive invite link!\n\n` +
        `⏱ Usually verified in under 5 minutes.\n` +
        `📞 Need help? Contact the admin.`,
        { parse_mode: "Markdown" }
      );
    });

    // ─── /admin ───────────────────────────────────────────────────────────────
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

    // ─── Messages ─────────────────────────────────────────────────────────────
    bot.on("message", async (msg) => {
      if (msg.text?.startsWith("/")) return;
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      const state = userStates.get(userId);
      if (!state) return;

      // Admin: Broadcast
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
          `✅ *Broadcast Complete!*\n\n📤 Sent: *${sent}*\n❌ Failed: *${failed}*`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
        );
        return;
      }

      // Admin: Add member — waiting for user ID
      if (state.step === "admin_add_userid" && userId === adminId) {
        const inputId = msg.text?.trim();
        if (!inputId) return;
        userStates.set(userId, { ...state, step: "admin_add_plan", screenshotFileId: inputId });
        const plans = await storage.getActivePlans();
        const planButtons = plans.map(p => ([{
          text: `${p.name} — ₹${p.price} (${p.durationDays}d)`,
          callback_data: `admin_doaddmember:${inputId}:${p.id}`,
        }]));
        planButtons.push([{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]);
        await bot!.sendMessage(chatId,
          `👤 *User ID:* \`${inputId}\`\n\nSelect a plan to assign:`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: planButtons } }
        );
        return;
      }

      // Admin: Ban member — waiting for user ID
      if (state.step === "admin_ban_userid" && userId === adminId) {
        const inputId = msg.text?.trim();
        if (!inputId) return;
        userStates.delete(userId);
        const members = await storage.getMembers();
        const member = members.find(m => m.telegramUserId === inputId);
        if (!member) {
          await bot!.sendMessage(chatId,
            `❌ Member with ID \`${inputId}\` not found.`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
          );
          return;
        }
        await storage.updateMemberStatus(member.id, "banned");
        if (bot) {
          try { await bot!.banChatMember(member.channelId, Number(member.telegramUserId)); } catch (e) {}
          try {
            await bot!.sendMessage(Number(member.telegramUserId),
              `🚫 *Your VIP access has been revoked.*\n\nContact admin if you believe this is an error.`,
              { parse_mode: "Markdown" }
            );
          } catch (e) {}
        }
        await bot!.sendMessage(chatId,
          `✅ *Member Banned*\n\n👤 ${member.firstName || ""} (ID: \`${inputId}\`) has been banned.`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
        );
        return;
      }

      // Step 1: Screenshot
      if (state.step === "awaiting_screenshot") {
        if (msg.photo && msg.photo.length > 0) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          userStates.set(userId, { ...state, step: "awaiting_utr", screenshotFileId: fileId });
          const label = state.paymentMethod === "bitcoin" ? "Transaction Hash (TX ID)" : "UTR / Reference Number";
          await bot!.sendMessage(chatId,
            `✅ *Screenshot received!*\n\n` +
            `📝 *Step 2: Enter your ${label}*\n\n` +
            `${state.paymentMethod === "bitcoin"
              ? "Copy the Transaction ID from your Bitcoin wallet and paste below."
              : "Open GPay/PhonePe → Transaction History → copy the 12-digit UTR."
            }\n\n👇 Type/paste it now:`,
            { parse_mode: "Markdown" }
          );
        } else {
          await bot!.sendMessage(chatId,
            `📸 *Please send a photo/screenshot* of your payment.\n\nOr tap below to enter UTR directly:`,
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

      // Step 2: UTR
      if (state.step === "awaiting_utr") {
        const utr = msg.text?.trim();
        if (!utr || utr.length < 6) {
          await bot!.sendMessage(chatId, "❌ Please send a valid UTR/Reference number (minimum 6 characters).");
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
        try { await bot!.answerCallbackQuery(query.id); } catch (_) {}

        const data = query.data || "";

        // ── Plan selection ──
        if (data.startsWith("select_plan:")) {
          const planId = parseInt(data.split(":")[1]);
          const plan = await storage.getPlanById(planId);
          if (!plan) { await bot!.sendMessage(chatId, "❌ Plan not found. Use /start to try again."); return; }

          userStates.set(userId, { step: "select_payment", planId: plan.id, planName: plan.name, amount: plan.price });

          const text =
            `💎 *${plan.name} Plan Selected*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 Amount: *₹${plan.price}*\n` +
            `⏱ Duration: *${plan.durationDays} days*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Choose your payment method:`;

          try {
            await bot!.editMessageText(text, {
              chat_id: chatId, message_id: msgId,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🏦 Pay via UPI", callback_data: `pay_upi:${planId}` }],
                  [{ text: "₿ Pay via Bitcoin", callback_data: `pay_btc:${planId}` }],
                  [{ text: "◀ Back to Plans", callback_data: "back_plans" }],
                ],
              },
            });
          } catch (_) {
            await bot!.sendMessage(chatId, text, {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🏦 Pay via UPI", callback_data: `pay_upi:${planId}` }],
                  [{ text: "₿ Pay via Bitcoin", callback_data: `pay_btc:${planId}` }],
                  [{ text: "◀ Back to Plans", callback_data: "back_plans" }],
                ],
              },
            });
          }
        }

        // ── UPI Payment ──
        else if (data.startsWith("pay_upi:")) {
          const planId = parseInt(data.split(":")[1]);
          const plan = await storage.getPlanById(planId);
          if (!plan) return;

          const upiId = (await storage.getSetting("upi_id"))?.value || "bs883653-2@oksbi";
          const upiName = (await storage.getSetting("upi_name"))?.value || "Bindar Singh";

          userStates.set(userId, { step: "awaiting_confirm", planId: plan.id, planName: plan.name, amount: plan.price, paymentMethod: "upi" });

          const upiCaption =
            `💳 *UPI Payment Instructions*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📦 Plan: *${plan.name}*\n` +
            `💰 Pay Exactly: *₹${plan.price}*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🏦 UPI ID: \`${upiId}\`\n` +
            `👤 Name: *${upiName}*\n\n` +
            `📱 Scan the QR code or enter UPI ID manually in GPay, PhonePe, or Paytm.\n\n` +
            `After paying, tap below 👇`;

          const upiButtons = {
            inline_keyboard: [
              [{ text: "✅ I've Paid — Send Screenshot", callback_data: `confirm_paid:${planId}:upi` }],
              [{ text: "◀ Back", callback_data: "back_plans" }],
            ],
          };

          const qrPath = path.join(process.cwd(), "client", "public", "upi-qr.jpg");
          try {
            if (fs.existsSync(qrPath)) {
              await bot!.sendPhoto(chatId, qrPath, { caption: upiCaption, parse_mode: "Markdown", reply_markup: upiButtons });
            } else {
              await bot!.sendMessage(chatId, upiCaption, { parse_mode: "Markdown", reply_markup: upiButtons });
            }
          } catch (e: any) {
            await bot!.sendMessage(chatId, upiCaption, { parse_mode: "Markdown", reply_markup: upiButtons });
          }
        }

        // ── Bitcoin Payment ──
        else if (data.startsWith("pay_btc:")) {
          const planId = parseInt(data.split(":")[1]);
          const plan = await storage.getPlanById(planId);
          if (!plan) return;

          const btcAddress = (await storage.getSetting("bitcoin_address"))?.value || "bc1qe6q4g9gng3f9f3raezx4002yeuv3572v40acuc";

          userStates.set(userId, { step: "awaiting_confirm", planId: plan.id, planName: plan.name, amount: plan.price, paymentMethod: "bitcoin" });

          await bot!.sendMessage(chatId,
            `₿ *Bitcoin Payment Instructions*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📦 Plan: *${plan.name}*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📬 *BTC Address:*\n\`${btcAddress}\`\n\n` +
            `⚠️ Send equivalent BTC for *₹${plan.price}*\n` +
            `(Check current BTC/INR rate before sending)\n\n` +
            `After sending, tap below 👇`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "✅ I've Paid — Send Screenshot", callback_data: `confirm_paid:${planId}:bitcoin` }],
                  [{ text: "◀ Back", callback_data: "back_plans" }],
                ],
              },
            }
          );
        }

        // ── Confirm paid → screenshot ──
        else if (data.startsWith("confirm_paid:")) {
          const parts = data.split(":");
          const planId = parseInt(parts[1]);
          const method = parts[2] || "upi";
          const plan = await storage.getPlanById(planId);
          if (!plan) return;

          userStates.set(userId, { step: "awaiting_screenshot", planId: plan.id, planName: plan.name, amount: plan.price, paymentMethod: method });

          await bot!.sendMessage(chatId,
            `📸 *Step 1 of 2 — Send Payment Screenshot*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Please send a *photo/screenshot* of your payment confirmation.\n\n` +
            `📱 GPay/PhonePe → Transactions → Screenshot\n` +
            `₿ Bitcoin → Transaction confirmation screenshot\n\n` +
            `👇 Send the photo now:`,
            { parse_mode: "Markdown" }
          );
        }

        // ── Skip screenshot ──
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
            `📝 *Step 2 of 2 — Enter your ${label}*\n\n` +
            `${method === "bitcoin"
              ? "Copy the Transaction ID from your Bitcoin wallet."
              : "Open GPay/PhonePe → Transaction History → copy the 12-digit UTR."
            }\n\n👇 Type/paste it now:`,
            { parse_mode: "Markdown" }
          );
        }

        // ── Back to plans ──
        else if (data === "back_plans") {
          userStates.delete(userId);
          const plans = await storage.getActivePlans();
          const planButtons = plans.map(p => ([{
            text: `💎 ${p.name} — ₹${p.price} (${p.durationDays} days)`,
            callback_data: `select_plan:${p.id}`,
          }]));
          planButtons.push([{ text: "📊 My Membership Status", callback_data: "my_status" }]);

          try {
            await bot!.editMessageText(
              `👇 *Select your plan:*`,
              { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", reply_markup: { inline_keyboard: planButtons } }
            );
          } catch (_) {
            await bot!.sendMessage(chatId, `👇 *Select your plan:*`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: planButtons } });
          }
        }

        // ── My Status ──
        else if (data === "my_status") {
          await handleStatus(chatId, userId);
        }

        // ─────────────────────────────────────────────────────────────────────
        // ── ADMIN CALLBACKS ──
        // ─────────────────────────────────────────────────────────────────────

        else if (data === "admin_menu") {
          if (userId !== adminId) return;
          await sendAdminPanel(chatId, msgId);
        }

        else if (data === "admin_stats") {
          if (userId !== adminId) return;
          await sendAdminStats(chatId, msgId);
        }

        else if (data === "admin_pending") {
          if (userId !== adminId) return;
          const allPayments = await storage.getPayments();
          const pending = allPayments.filter(p => p.status === "pending");
          if (!pending.length) {
            try {
              await bot!.editMessageText(
                `✅ *No Pending Payments!*\n\nAll payments have been reviewed.`,
                { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
              );
            } catch (_) {
              await bot!.sendMessage(chatId, `✅ No pending payments right now!`, { reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } });
            }
            return;
          }

          await bot!.sendMessage(chatId,
            `⏳ *Pending Payments (${pending.length})*\n\nShowing latest ${Math.min(pending.length, 10)}:`,
            { parse_mode: "Markdown" }
          );

          for (const p of pending.slice(0, 10)) {
            const caption =
              `⏳ *Payment Request #${p.id}*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 User: *${p.firstName || "Unknown"}*${p.username ? ` (@${p.username})` : ""}\n` +
              `🆔 ID: \`${p.telegramUserId}\`\n` +
              `📋 ${p.paymentMethod === "bitcoin" ? "TX Hash" : "UTR"}: \`${p.txnId}\`\n` +
              `📦 Plan: *${p.planName}* — ₹${p.amount}\n` +
              `🏦 Method: *${p.paymentMethod === "bitcoin" ? "Bitcoin" : "UPI"}*\n` +
              `📸 Screenshot: ${p.screenshotFileId ? "✅ Attached" : "❌ Not provided"}\n` +
              `⏰ ${p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN") : "Unknown"}\n` +
              `━━━━━━━━━━━━━━━━━━━━`;

            const buttons = {
              inline_keyboard: [[
                { text: "✅ Verify & Add", callback_data: `admin_verify:${p.id}` },
                { text: "❌ Reject", callback_data: `admin_reject:${p.id}` },
              ]],
            };

            if (p.screenshotFileId) {
              try {
                await bot!.sendPhoto(chatId, p.screenshotFileId, { caption, parse_mode: "Markdown", reply_markup: buttons });
              } catch (_) {
                await bot!.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: buttons });
              }
            } else {
              await bot!.sendMessage(chatId, caption, { parse_mode: "Markdown", reply_markup: buttons });
            }
          }

          await bot!.sendMessage(chatId,
            `_Showing ${Math.min(pending.length, 10)} of ${pending.length} pending payments_`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
          );
        }

        else if (data === "admin_members") {
          if (userId !== adminId) return;
          const allMembers = await storage.getMembers();
          const active = allMembers.filter(m => m.status === "active");
          if (!active.length) {
            try {
              await bot!.editMessageText(`ℹ️ *No active members yet.*`, {
                chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
              });
            } catch (_) {}
            return;
          }
          let text = `👥 *Active Members (${active.length})*\n━━━━━━━━━━━━━━━━━━━━\n`;
          for (const m of active.slice(0, 20)) {
            const days = m.expiresAt ? Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / 86400000) : null;
            text += `• *${m.firstName || "Unknown"}*${m.username ? ` @${m.username}` : ""} — ${m.planName || "N/A"} — ${days !== null ? `${Math.max(0, days)}d left` : "∞"}\n`;
          }
          if (active.length > 20) text += `\n_...and ${active.length - 20} more_`;

          try {
            await bot!.editMessageText(text, {
              chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [
                [{ text: "🚫 Ban a Member", callback_data: "admin_banlist" }],
                [{ text: "◀ Back to Panel", callback_data: "admin_menu" }],
              ]},
            });
          } catch (_) {
            await bot!.sendMessage(chatId, text, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [
                [{ text: "🚫 Ban a Member", callback_data: "admin_banlist" }],
                [{ text: "◀ Back to Panel", callback_data: "admin_menu" }],
              ]},
            });
          }
        }

        else if (data === "admin_banlist") {
          if (userId !== adminId) return;
          const allMembers = await storage.getMembers();
          const active = allMembers.filter(m => m.status === "active");
          if (!active.length) {
            await bot!.sendMessage(chatId, `ℹ️ *No active members to ban.*`, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
            });
            return;
          }
          const banButtons = active.slice(0, 20).map(m => ([{
            text: `🚫 ${m.firstName || "Unknown"}${m.username ? ` (@${m.username})` : ""} — ${m.planName || "N/A"}`,
            callback_data: `admin_banmember:${m.id}`,
          }]));
          banButtons.push([{ text: "◀ Back", callback_data: "admin_members" }]);
          await bot!.sendMessage(chatId,
            `🚫 *Select member to ban:*\n━━━━━━━━━━━━━━━━━━━━\n_Tap a name to ban that member immediately._`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: banButtons } }
          );
        }

        else if (data.startsWith("admin_banmember:")) {
          if (userId !== adminId) return;
          const memberId = parseInt(data.split(":")[1]);
          const allMembers = await storage.getMembers();
          const member = allMembers.find(m => m.id === memberId);
          if (!member) {
            await bot!.sendMessage(chatId, `❌ Member not found.`, { reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } });
            return;
          }
          await storage.updateMemberStatus(member.id, "banned");
          try { await bot!.banChatMember(member.channelId, Number(member.telegramUserId)); } catch (e) {}
          try {
            await bot!.sendMessage(Number(member.telegramUserId),
              `🚫 *Aapki VIP membership cancel kar di gayi hai.*\n\nKisi galti ke liye admin se contact karein.`,
              { parse_mode: "Markdown" }
            );
          } catch (e) {}
          await bot!.sendMessage(chatId,
            `✅ *Member Banned!*\n\n👤 *${member.firstName || "Unknown"}*${member.username ? ` (@${member.username})` : ""}\n🆔 ID: \`${member.telegramUserId}\`\n\nGroup se remove kar diya gaya hai.`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
              [{ text: "🚫 Ban Another", callback_data: "admin_banlist" }],
              [{ text: "◀ Back to Panel", callback_data: "admin_menu" }],
            ]}}
          );
        }

        else if (data === "admin_banned") {
          if (userId !== adminId) return;
          const allMembers = await storage.getMembers();
          const banned = allMembers.filter(m => m.status === "banned");
          if (!banned.length) {
            try {
              await bot!.editMessageText(`✅ *No banned members.*`, {
                chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
              });
            } catch (_) {
              await bot!.sendMessage(chatId, `✅ *No banned members.*`, {
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
              });
            }
            return;
          }
          const unbanButtons = banned.slice(0, 20).map(m => ([{
            text: `✅ Unban: ${m.firstName || "Unknown"}${m.username ? ` (@${m.username})` : ""}`,
            callback_data: `admin_unbanmember:${m.id}`,
          }]));
          unbanButtons.push([{ text: "◀ Back to Panel", callback_data: "admin_menu" }]);
          const text = `🚫 *Banned Members (${banned.length})*\n━━━━━━━━━━━━━━━━━━━━\n_Tap to unban:_`;
          try {
            await bot!.editMessageText(text, {
              chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
              reply_markup: { inline_keyboard: unbanButtons },
            });
          } catch (_) {
            await bot!.sendMessage(chatId, text, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: unbanButtons },
            });
          }
        }

        else if (data.startsWith("admin_unbanmember:")) {
          if (userId !== adminId) return;
          const memberId = parseInt(data.split(":")[1]);
          const allMembers = await storage.getMembers();
          const member = allMembers.find(m => m.id === memberId);
          if (!member) {
            await bot!.sendMessage(chatId, `❌ Member not found.`);
            return;
          }
          await storage.updateMemberStatus(member.id, "expired");
          try { await bot!.unbanChatMember(member.channelId, Number(member.telegramUserId)); } catch (e) {}
          try {
            await bot!.sendMessage(Number(member.telegramUserId),
              `✅ *Aapka ban hata diya gaya hai.*\n\nDobara join karne ke liye /start karein.`,
              { parse_mode: "Markdown" }
            );
          } catch (e) {}
          await bot!.sendMessage(chatId,
            `✅ *Member Unbanned!*\n\n👤 *${member.firstName || "Unknown"}*${member.username ? ` (@${member.username})` : ""}\n\nAbh woh dobara subscribe kar sakte hain.`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
          );
        }

        else if (data === "admin_expired") {
          if (userId !== adminId) return;
          const allMembers = await storage.getMembers();
          const expired = allMembers.filter(m => m.status === "expired");
          if (!expired.length) {
            try {
              await bot!.editMessageText(`✅ *No expired members.*`, {
                chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
              });
            } catch (_) {}
            return;
          }
          let text = `❌ *Expired Members (${expired.length})*\n━━━━━━━━━━━━━━━━━━━━\n`;
          for (const m of expired.slice(0, 20)) {
            const expiry = m.expiresAt ? new Date(m.expiresAt).toLocaleDateString("en-IN") : "N/A";
            text += `• *${m.firstName || "Unknown"}*${m.username ? ` @${m.username}` : ""} — ${m.planName || "N/A"} — exp: ${expiry}\n`;
          }
          if (expired.length > 20) text += `\n_...and ${expired.length - 20} more_`;

          try {
            await bot!.editMessageText(text, {
              chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
            });
          } catch (_) {
            await bot!.sendMessage(chatId, text, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
            });
          }
        }

        else if (data === "admin_revenue") {
          if (userId !== adminId) return;
          const allPayments = await storage.getPayments();
          const verified = allPayments.filter(p => p.status === "verified");
          const today = verified.filter(p => p.verifiedAt && new Date(p.verifiedAt).toDateString() === new Date().toDateString());
          const thisWeek = verified.filter(p => {
            if (!p.verifiedAt) return false;
            const d = new Date(p.verifiedAt);
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            return d >= weekAgo;
          });
          const thisMonth = verified.filter(p => {
            if (!p.verifiedAt) return false;
            const d = new Date(p.verifiedAt);
            return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
          });

          const text =
            `💰 *Revenue Report*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📅 Today: *₹${today.reduce((s, p) => s + (p.amount || 0), 0)}* (${today.length} payments)\n` +
            `📆 This Week: *₹${thisWeek.reduce((s, p) => s + (p.amount || 0), 0)}* (${thisWeek.length} payments)\n` +
            `🗓 This Month: *₹${thisMonth.reduce((s, p) => s + (p.amount || 0), 0)}* (${thisMonth.length} payments)\n` +
            `📈 All Time: *₹${verified.reduce((s, p) => s + (p.amount || 0), 0)}* (${verified.length} payments)\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Recent Payments:*\n` +
            verified.slice(-5).reverse().map(p =>
              `• ₹${p.amount} — ${p.firstName || "Unknown"} — ${p.planName || "N/A"}`
            ).join("\n");

          try {
            await bot!.editMessageText(text, {
              chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
            });
          } catch (_) {
            await bot!.sendMessage(chatId, text, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
            });
          }
        }

        else if (data === "admin_settings") {
          if (userId !== adminId) return;
          const upiId = (await storage.getSetting("upi_id"))?.value || "Not set";
          const upiName = (await storage.getSetting("upi_name"))?.value || "Not set";
          const btcAddress = (await storage.getSetting("bitcoin_address"))?.value || "Not set";
          const plans = await storage.getActivePlans();
          const channels = await storage.getChannels();

          const text =
            `⚙️ *Bot Settings*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🏦 *UPI ID:* \`${upiId}\`\n` +
            `👤 *UPI Name:* ${upiName}\n` +
            `₿ *BTC Address:* \`${btcAddress.length > 20 ? btcAddress.slice(0, 20) + "..." : btcAddress}\`\n\n` +
            `📦 *Plans:* ${plans.length} active\n` +
            `📺 *Channels:* ${channels.length} configured\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `_To update settings, use the admin dashboard._`;

          try {
            await bot!.editMessageText(text, {
              chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
            });
          } catch (_) {
            await bot!.sendMessage(chatId, text, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] },
            });
          }
        }

        else if (data === "admin_broadcast") {
          if (userId !== adminId) return;
          userStates.set(userId, { step: "admin_broadcast" });
          try {
            await bot!.editMessageText(
              `📢 *Broadcast Message*\n━━━━━━━━━━━━━━━━━━━━\nType your message below.\nSupports *bold*, _italic_, \`code\`\n\n✍️ Send your message now:`,
              {
                chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] },
              }
            );
          } catch (_) {
            await bot!.sendMessage(chatId,
              `📢 *Broadcast Message*\n\nType your message:`,
              { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] } }
            );
          }
        }

        else if (data === "admin_addmember") {
          if (userId !== adminId) return;
          userStates.set(userId, { step: "admin_add_userid" });
          try {
            await bot!.editMessageText(
              `➕ *Add Member Manually*\n━━━━━━━━━━━━━━━━━━━━\nSend the Telegram *User ID* of the person to add.\n\n_Tip: User can forward any message to @userinfobot to get their ID_`,
              {
                chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] },
              }
            );
          } catch (_) {
            await bot!.sendMessage(chatId, `➕ *Add Member Manually*\n\nSend the user's Telegram ID:`,
              { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] } }
            );
          }
        }

        else if (data === "admin_ban") {
          if (userId !== adminId) return;
          userStates.set(userId, { step: "admin_ban_userid" });
          try {
            await bot!.editMessageText(
              `🚫 *Ban Member*\n━━━━━━━━━━━━━━━━━━━━\nSend the Telegram *User ID* of the member to ban.\n\n⚠️ They will be removed from the channel and notified.`,
              {
                chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] },
              }
            );
          } catch (_) {
            await bot!.sendMessage(chatId, `🚫 *Ban Member*\n\nSend the user's Telegram ID:`,
              { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel_state" }]] } }
            );
          }
        }

        // ── Admin inline verify ──
        else if (data.startsWith("admin_verify:")) {
          if (userId !== adminId) return;
          const paymentId = parseInt(data.split(":")[1]);
          try {
            await bot!.editMessageReplyMarkup({ inline_keyboard: [[{ text: "⏳ Verifying...", callback_data: "noop" }]] }, { chat_id: chatId, message_id: msgId });
          } catch (_) {}
          const ok = await verifyPaymentAndAddMember(paymentId);
          if (ok) {
            try {
              await bot!.editMessageReplyMarkup({ inline_keyboard: [[{ text: "✅ Verified", callback_data: "noop" }]] }, { chat_id: chatId, message_id: msgId });
            } catch (_) {}
            await bot!.sendMessage(chatId,
              `✅ *Payment #${paymentId} Verified!*\nInvite link sent to user.`,
              { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
            );
          }
        }

        else if (data.startsWith("admin_reject:")) {
          if (userId !== adminId) return;
          const paymentId = parseInt(data.split(":")[1]);
          const payment = await storage.getPaymentById(paymentId);
          if (!payment) return;
          await storage.updatePaymentStatus(payment.id, "rejected", "Rejected by admin");
          try {
            await bot!.editMessageReplyMarkup({ inline_keyboard: [[{ text: "❌ Rejected", callback_data: "noop" }]] }, { chat_id: chatId, message_id: msgId });
          } catch (_) {}
          await bot!.sendMessage(chatId,
            `❌ *Payment #${payment.id} Rejected*\n\nUser has been notified.`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
          );
          try {
            await bot!.sendMessage(Number(payment.telegramUserId),
              `❌ *Payment Rejected*\n\nYour payment of ₹${payment.amount} (Ref: \`${payment.txnId}\`) has been rejected.\n\nPlease contact admin if you believe this is an error.`,
              { parse_mode: "Markdown" }
            );
          } catch (e) {}
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
            await bot!.sendMessage(chatId, "❌ No active channel configured. Please add a channel first.");
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
            const link = await bot!.createChatInviteLink(channel.channelId, { expire_date: Math.floor(expiresAt.getTime() / 1000), member_limit: 1 });
            inviteLink = link.invite_link;
          } catch (e) {}
          await bot!.sendMessage(chatId,
            `✅ *Member Added Successfully!*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 User ID: \`${targetUserId}\`\n` +
            `📦 Plan: *${plan.name}*\n` +
            `📅 Expires: *${expiresAt.toLocaleDateString("en-IN")}*`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "◀ Back to Panel", callback_data: "admin_menu" }]] } }
          );
          try {
            await bot!.sendMessage(Number(targetUserId),
              `🎉 *You've been added to VIP Zone!*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📦 Plan: *${plan.name}*\n` +
              `📅 Expires: *${expiresAt.toLocaleDateString("en-IN")}*\n\n` +
              `${inviteLink ? `🔗 *Your One-Time Invite Link:*\n${inviteLink}\n\n⚠️ *This link will self-destruct after you join!*\n🚫 Do NOT share with anyone!` : "Contact admin for the invite link."}`,
              { parse_mode: "Markdown" }
            );
          } catch (e) {}
        }

        else if (data === "admin_cancel_state") {
          if (userId !== adminId) return;
          userStates.delete(userId);
          await sendAdminPanel(chatId, msgId);
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

    setTimeout(expireMembers, 10000);

  } catch (err) {
    console.error("[Bot] Failed to initialize:", err);
  }
}

// ── Submit payment ─────────────────────────────────────────────────────────────
async function submitPayment(
  chatId: number,
  userId: string,
  username: string,
  firstName: string,
  utr: string,
  state: { planId?: number; planName?: string; amount?: number; paymentMethod?: string; screenshotFileId?: string }
) {
  const adminId = process.env.TELEGRAM_ADMIN_ID;

  const existing = await storage.getPaymentByTxnId(utr);
  if (existing) {
    await bot!.sendMessage(chatId,
      `⚠️ *This UTR/TXN has already been submitted!*\n\nIf you need help, please contact admin.`,
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
    `✅ *Payment Submitted Successfully!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 Ref: \`${utr}\`\n` +
    `📦 Plan: *${state.planName}*\n` +
    `💰 Amount: *₹${state.amount}*\n` +
    `🏦 Method: *${state.paymentMethod === "bitcoin" ? "Bitcoin" : "UPI"}*\n` +
    `📸 Screenshot: ${state.screenshotFileId ? "✅ Attached" : "❌ Not provided"}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⏳ *Under review...*\n` +
    `You'll receive your channel invite link automatically once verified!\n` +
    `⏱ Usually takes less than 5 minutes.`,
    { parse_mode: "Markdown" }
  );

  // Notify admin
  if (adminId) {
    const adminText =
      `🔔 *New Payment Request!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Name: *${firstName}*${username ? ` (@${username})` : ""}\n` +
      `🆔 User ID: \`${userId}\`\n` +
      `📋 ${state.paymentMethod === "bitcoin" ? "TX Hash" : "UTR"}: \`${utr}\`\n` +
      `📦 Plan: *${state.planName}* — ₹${state.amount}\n` +
      `🏦 Method: *${state.paymentMethod === "bitcoin" ? "Bitcoin" : "UPI"}*\n` +
      `📸 Screenshot: ${state.screenshotFileId ? "✅ Attached ⬇️" : "❌ Not provided"}\n` +
      `⏰ ${new Date().toLocaleString("en-IN")}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    const adminButtons = {
      inline_keyboard: [[
        { text: "✅ Verify & Send Link", callback_data: `admin_verify:${payment.id}` },
        { text: "❌ Reject", callback_data: `admin_reject:${payment.id}` },
      ]],
    };

    // Step 1: Always send text notification first (guaranteed delivery)
    try {
      await bot!.sendMessage(Number(adminId), adminText, {
        parse_mode: "Markdown",
        reply_markup: adminButtons,
      });
    } catch (e: any) {
      console.error("[Bot] Failed to send admin text notification:", e.message);
    }

    // Step 2: If screenshot exists, send it separately as photo
    if (state.screenshotFileId) {
      try {
        await bot!.sendPhoto(Number(adminId), state.screenshotFileId, {
          caption: `📸 *Screenshot for Payment #${payment.id}*\n👤 ${firstName}${username ? ` @${username}` : ""} — ₹${state.amount}`,
          parse_mode: "Markdown",
          reply_markup: adminButtons,
        });
      } catch (e: any) {
        console.error("[Bot] Failed to send admin screenshot:", e.message);
        // Screenshot failed but text was already sent — admin is still notified
      }
    }
  }
}

// ── Status handler ─────────────────────────────────────────────────────────────
async function handleStatus(chatId: number, userId: string) {
  const channels = await storage.getChannels();
  let found = false;
  for (const ch of channels) {
    const member = await storage.getMemberByUserAndChannel(userId, ch.channelId);
    if (member) {
      found = true;
      const expiry = member.expiresAt ? new Date(member.expiresAt).toLocaleDateString("en-IN") : "Lifetime";
      const daysLeft = member.expiresAt ? Math.max(0, Math.ceil((new Date(member.expiresAt).getTime() - Date.now()) / 86400000)) : null;
      const statusEmoji = member.status === "active" ? "✅" : member.status === "expired" ? "❌" : "⏳";
      await bot!.sendMessage(chatId,
        `📊 *Your Membership*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📺 Channel: *${ch.channelName}*\n` +
        `📦 Plan: *${member.planName || "VIP"}*\n` +
        `Status: ${statusEmoji} *${member.status.toUpperCase()}*\n` +
        `📅 Expires: *${expiry}*\n` +
        (daysLeft !== null ? `⏳ Days Left: *${daysLeft}*\n` : "") +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${member.status === "expired" ? "🔄 Use /start to renew your membership!" : "🎉 Enjoy your VIP access!"}`,
        { parse_mode: "Markdown" }
      );
    }
  }
  if (!found) {
    await bot!.sendMessage(chatId,
      `ℹ️ *No membership found.*\n\nUse /start to subscribe and get VIP access!`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🚀 Subscribe Now", callback_data: "back_plans" }]] } }
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
            `⚠️ *Membership Expired!*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Your access to *${ch.channelName}* has ended.\n\n` +
            `🔄 Renew instantly — use /start and choose a plan!\n` +
            `💎 Don't miss out on VIP content.`,
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
    if (bot && adminChatId) await bot.sendMessage(adminChatId, "ℹ️ This payment is already verified.");
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
      const base = existing.expiresAt && new Date(existing.expiresAt) > new Date() ? new Date(existing.expiresAt) : new Date();
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
      let inviteLink = channel.inviteLink || "";
      try {
        const link = await bot.createChatInviteLink(channel.channelId, {
          creates_join_request: false,
          expire_date: Math.floor(expiresAt.getTime() / 1000),
          member_limit: 1,
        });
        inviteLink = link.invite_link;
      } catch (e: any) {
        console.error("[Bot] Invite link error:", e.message);
      }

      try {
        await bot.sendMessage(Number(payment.telegramUserId),
          `🎉 *Payment Verified! Welcome to VIP Zone!*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 Plan: *${plan.name}*\n` +
          `⏱ Duration: *${plan.durationDays} days*\n` +
          `📅 Expires: *${expiresAt.toLocaleDateString("en-IN")}*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🔗 *Your One-Time Invite Link:*\n${inviteLink || "Contact admin for the link."}\n\n` +
          `⚠️ *This link is for YOU only — it will self-destruct after you join!*\n` +
          `🚫 Do NOT share this link with anyone!`,
          { parse_mode: "Markdown" }
        );
      } catch (e: any) {
        console.error("[Bot] Message user error:", e.message);
      }
    }
  }

  if (bot && adminChatId) {
    await bot.sendMessage(adminChatId,
      `✅ *Payment #${paymentId} Verified!*\n\nMember added and invite link sent.`,
      { parse_mode: "Markdown" }
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
  await bot!.sendMessage(adminChatId, `❌ *Rejected:* \`${txnId}\``, { parse_mode: "Markdown" });
  try {
    await bot!.sendMessage(Number(payment.telegramUserId),
      `❌ *Payment Rejected*\n\nRef: \`${payment.txnId}\`\nContact admin for assistance.`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {}
}
