import TelegramBot from "node-telegram-bot-api";
import cron from "node-cron";
import { storage } from "./storage";

let bot: TelegramBot | null = null;

export function getBot(): TelegramBot | null {
  return bot;
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

    bot.on("polling_error", (err) => {
      console.error("[Bot] Polling error:", err.message);
    });

    console.log("[Bot] Started successfully.");

    // /start command
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      const firstName = msg.from?.first_name || "Friend";
      const username = msg.from?.username;

      const plans = await storage.getActivePlans();
      const plansText = plans.length > 0
        ? plans.map(p => `• *${p.name}* — ₹${p.price} / ${p.durationDays} days`).join("\n")
        : "• No plans available yet.";

      const welcomeText =
        `🔥 *WELCOME TO VIP ZONE* 🔥\n\n` +
        `👋 Hey *${firstName}*! Ready for premium access?\n\n` +
        `✨ *What we offer:*\n` +
        `🚀 Exclusive premium content\n` +
        `⚡ Lightning fast access\n` +
        `🔒 Secure & private community\n` +
        `💎 VIP member benefits\n\n` +
        `📋 *Membership Plans:*\n${plansText}\n\n` +
        `📋 *Quick Start:*\n` +
        `1️⃣ Choose your perfect plan\n` +
        `2️⃣ Pay via UPI\n` +
        `3️⃣ Use /paid <txn\\_id> <plan\\_name> to submit payment\n\n` +
        `⚠️ Example: /paid TXN123456 monthly\n` +
        `📚 Need help? Use /help for all commands\n\n` +
        `🎯 Ready to join the elite? 👇`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📋 View Plans", callback_data: "view_plans" },
            { text: "💰 Pay via UPI", callback_data: "pay_upi" },
          ],
          [
            { text: "📊 My Status", callback_data: "my_status" },
            { text: "❓ Help", callback_data: "help" },
          ],
        ],
      };

      await bot!.sendMessage(chatId, welcomeText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    });

    // /paid command
    bot.onText(/\/paid (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      const username = msg.from?.username || "";
      const firstName = msg.from?.first_name || "";
      const args = match![1].trim().split(/\s+/);

      if (args.length < 2) {
        await bot!.sendMessage(
          chatId,
          "❌ *Wrong format!*\n\nUse: `/paid <txn_id> <plan_name>`\nExample: `/paid TXN123456 monthly`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const txnId = args[0];
      const planName = args.slice(1).join(" ");

      const plans = await storage.getActivePlans();
      const plan = plans.find(
        (p) => p.name.toLowerCase() === planName.toLowerCase()
      );

      if (!plan) {
        const planList = plans.map((p) => `• ${p.name}`).join("\n");
        await bot!.sendMessage(
          chatId,
          `❌ *Plan not found!*\n\nAvailable plans:\n${planList}\n\nUse: \`/paid ${txnId} <plan_name>\``,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Check duplicate txn
      const existing = await storage.getPaymentByTxnId(txnId);
      if (existing) {
        await bot!.sendMessage(
          chatId,
          `⚠️ *Transaction ID already submitted!*\n\nTxn: \`${txnId}\` is already being processed.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      await storage.createPayment({
        telegramUserId: userId,
        username,
        firstName,
        txnId,
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        channelId: "",
        status: "pending",
      });

      await bot!.sendMessage(
        chatId,
        `✅ *Payment Submitted!*\n\n` +
          `📋 Txn ID: \`${txnId}\`\n` +
          `📦 Plan: *${plan.name}*\n` +
          `💰 Amount: ₹${plan.price}\n\n` +
          `⏳ Your payment is under review. You'll get channel access once verified!\n\n` +
          `Usually verified within 30 minutes.`,
        { parse_mode: "Markdown" }
      );

      // Notify admin
      if (adminId) {
        try {
          await bot!.sendMessage(
            adminId,
            `🔔 *New Payment Received!*\n\n` +
              `👤 User: @${username || firstName} (ID: ${userId})\n` +
              `📋 Txn ID: \`${txnId}\`\n` +
              `📦 Plan: *${plan.name}*\n` +
              `💰 Amount: ₹${plan.price}\n\n` +
              `✅ Verify via dashboard or reply:\n` +
              `/verify ${txnId}\n` +
              `/reject ${txnId}`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {
          console.error("[Bot] Failed to notify admin:", e);
        }
      }
    });

    // Admin /verify command
    bot.onText(/\/verify (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (userId !== adminId) {
        await bot!.sendMessage(chatId, "❌ Unauthorized.");
        return;
      }
      const txnId = match![1].trim();
      await handleVerify(txnId, chatId);
    });

    // Admin /reject command
    bot.onText(/\/reject (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (userId !== adminId) {
        await bot!.sendMessage(chatId, "❌ Unauthorized.");
        return;
      }
      const txnId = match![1].trim();
      const payment = await storage.getPaymentByTxnId(txnId);
      if (!payment) {
        await bot!.sendMessage(chatId, `❌ Payment not found: \`${txnId}\``, { parse_mode: "Markdown" });
        return;
      }
      await storage.updatePaymentStatus(payment.id, "rejected", "Rejected by admin");
      await bot!.sendMessage(chatId, `❌ Payment \`${txnId}\` rejected.`, { parse_mode: "Markdown" });
      try {
        await bot!.sendMessage(
          Number(payment.telegramUserId),
          `❌ *Payment Rejected*\n\nYour payment Txn ID \`${txnId}\` was rejected.\n\nPlease contact support if you believe this is a mistake.`,
          { parse_mode: "Markdown" }
        );
      } catch (e) {}
    });

    // /status command
    bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      const channels = await storage.getChannels();
      let found = false;
      for (const ch of channels) {
        const member = await storage.getMemberByUserAndChannel(userId, ch.channelId);
        if (member) {
          found = true;
          const expiry = member.expiresAt
            ? new Date(member.expiresAt).toLocaleDateString("en-IN")
            : "Lifetime";
          const statusEmoji = member.status === "active" ? "✅" : member.status === "expired" ? "❌" : "⏳";
          await bot!.sendMessage(
            chatId,
            `📊 *Your Membership Status*\n\n` +
              `Channel: *${ch.channelName}*\n` +
              `Plan: *${member.planName || "N/A"}*\n` +
              `Status: ${statusEmoji} *${member.status.toUpperCase()}*\n` +
              `Expires: *${expiry}*`,
            { parse_mode: "Markdown" }
          );
        }
      }
      if (!found) {
        await bot!.sendMessage(
          chatId,
          "ℹ️ *No active membership found.*\n\nUse /start to get started!",
          { parse_mode: "Markdown" }
        );
      }
    });

    // /help command
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      await bot!.sendMessage(
        chatId,
        `📚 *Available Commands:*\n\n` +
          `/start — Welcome message & plans\n` +
          `/paid <txn_id> <plan> — Submit payment\n` +
          `/status — Check your membership\n` +
          `/help — Show this help message\n\n` +
          `*Examples:*\n` +
          `\`/paid TXN123456 monthly\`\n` +
          `\`/paid UPI12345 weekly\``,
        { parse_mode: "Markdown" }
      );
    });

    // Callback queries (inline buttons)
    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id;
      const userId = String(query.from.id);
      if (!chatId) return;

      await bot!.answerCallbackQuery(query.id);

      if (query.data === "view_plans") {
        const plans = await storage.getActivePlans();
        if (plans.length === 0) {
          await bot!.sendMessage(chatId, "ℹ️ No plans available right now. Check back soon!");
          return;
        }
        const text =
          `💎 *VIP Membership Plans*\n\n` +
          plans
            .map(
              (p) =>
                `📦 *${p.name}*\n` +
                `   💰 Price: ₹${p.price}\n` +
                `   ⏱ Duration: ${p.durationDays} days\n` +
                (p.description ? `   📝 ${p.description}\n` : "")
            )
            .join("\n") +
          `\nPay via UPI then use:\n\`/paid <txn_id> <plan_name>\``;
        await bot!.sendMessage(chatId, text, { parse_mode: "Markdown" });
      } else if (query.data === "pay_upi") {
        const upiSetting = await storage.getSetting("upi_id");
        const upiId = upiSetting?.value || "your-upi@bank";
        await bot!.sendMessage(
          chatId,
          `💰 *Pay via UPI*\n\n` +
            `UPI ID: \`${upiId}\`\n\n` +
            `After payment, send:\n\`/paid <txn_id> <plan_name>\`\n\n` +
            `Example: \`/paid TXN123456 monthly\``,
          { parse_mode: "Markdown" }
        );
      } else if (query.data === "my_status") {
        const channels = await storage.getChannels();
        let found = false;
        for (const ch of channels) {
          const member = await storage.getMemberByUserAndChannel(userId, ch.channelId);
          if (member) {
            found = true;
            const expiry = member.expiresAt
              ? new Date(member.expiresAt).toLocaleDateString("en-IN")
              : "Lifetime";
            const statusEmoji = member.status === "active" ? "✅" : "❌";
            await bot!.sendMessage(
              chatId,
              `📊 *Your Status*\n\nChannel: *${ch.channelName}*\nPlan: *${member.planName || "N/A"}*\nStatus: ${statusEmoji} *${member.status.toUpperCase()}*\nExpires: *${expiry}*`,
              { parse_mode: "Markdown" }
            );
          }
        }
        if (!found) {
          await bot!.sendMessage(chatId, "ℹ️ No active membership. Use /start to subscribe!");
        }
      } else if (query.data === "help") {
        await bot!.sendMessage(
          chatId,
          `📚 *Commands:*\n/start — Welcome\n/paid <txn> <plan> — Submit payment\n/status — Your membership\n/help — Help`,
          { parse_mode: "Markdown" }
        );
      }
    });

    // Cron: Check expired members every hour
    cron.schedule("0 * * * *", async () => {
      console.log("[Cron] Checking expired members...");
      await expireMembers();
    });

    // Also run on start
    setTimeout(expireMembers, 5000);
  } catch (err) {
    console.error("[Bot] Failed to initialize:", err);
  }
}

async function expireMembers() {
  const expired = await storage.getExpiredActiveMembers();
  for (const member of expired) {
    await storage.updateMemberStatus(member.id, "expired");
    console.log(`[Cron] Expired member: ${member.telegramUserId} in ${member.channelId}`);

    // Kick from channel
    if (bot) {
      const channels = await storage.getChannels();
      const ch = channels.find((c) => c.channelId === member.channelId);
      if (ch) {
        try {
          await bot.banChatMember(ch.channelId, Number(member.telegramUserId));
          await bot.unbanChatMember(ch.channelId, Number(member.telegramUserId));
          console.log(`[Cron] Removed ${member.telegramUserId} from ${ch.channelName}`);
        } catch (e: any) {
          console.error(`[Cron] Failed to remove ${member.telegramUserId}:`, e.message);
        }
        // Notify user
        try {
          await bot.sendMessage(
            Number(member.telegramUserId),
            `⚠️ *Membership Expired*\n\nYour access to *${ch.channelName}* has expired.\n\nRenew with /start to continue enjoying VIP benefits!`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {}
      }
    }
  }
}

export async function verifyPaymentAndAddMember(paymentId: number): Promise<boolean> {
  const payment = await storage.getPaymentById(paymentId);
  if (!payment) return false;

  const plan = payment.planId ? await storage.getPlanById(payment.planId) : null;
  const channels = await storage.getChannels();
  const channel = channels.find((c) => c.isActive);

  await storage.updatePaymentStatus(paymentId, "verified", undefined, new Date());

  if (channel && plan) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    const existing = await storage.getMemberByUserAndChannel(payment.telegramUserId, channel.channelId);
    if (existing) {
      // Extend existing membership
      const newExpiry = existing.expiresAt && new Date(existing.expiresAt) > new Date()
        ? new Date(new Date(existing.expiresAt).getTime() + plan.durationDays * 86400000)
        : expiresAt;
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

    // Send invite link
    if (bot) {
      let inviteLink = channel.inviteLink;
      if (!inviteLink) {
        try {
          const link = await bot.createChatInviteLink(channel.channelId, {
            creates_join_request: false,
            member_limit: 1,
          });
          inviteLink = link.invite_link;
        } catch (e: any) {
          console.error("[Bot] Failed to create invite link:", e.message);
        }
      }

      try {
        await bot.sendMessage(
          Number(payment.telegramUserId),
          `✅ *Payment Verified!*\n\n` +
            `Welcome to VIP Zone, ${payment.firstName || "friend"}!\n\n` +
            `📦 Plan: *${plan.name}*\n` +
            `⏱ Valid for: *${plan.durationDays} days*\n\n` +
            `🔗 *Join your channel:*\n${inviteLink || "Contact admin for link."}`,
          { parse_mode: "Markdown" }
        );
      } catch (e: any) {
        console.error("[Bot] Failed to message user:", e.message);
      }
    }
  }

  return true;
}

export async function handleVerify(txnId: string, adminChatId?: number) {
  const payment = await storage.getPaymentByTxnId(txnId);
  if (!payment) {
    if (bot && adminChatId) {
      await bot.sendMessage(adminChatId, `❌ Payment not found: \`${txnId}\``, { parse_mode: "Markdown" });
    }
    return false;
  }
  const success = await verifyPaymentAndAddMember(payment.id);
  if (bot && adminChatId) {
    await bot.sendMessage(
      adminChatId,
      success
        ? `✅ Payment \`${txnId}\` verified! Member added.`
        : `❌ Failed to verify \`${txnId}\`.`,
      { parse_mode: "Markdown" }
    );
  }
  return success;
}
