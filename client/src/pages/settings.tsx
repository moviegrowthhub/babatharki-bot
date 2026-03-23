import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Bot, IndianRupee, Save, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

export default function Settings() {
  const { toast } = useToast();
  const [upiId, setUpiId] = useState("");
  const [botUsername, setBotUsername] = useState("");

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setUpiId(settings.upi_id || "");
      setBotUsername(settings.bot_username || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/settings", { key: "upi_id", value: upiId });
      await apiRequest("POST", "/api/settings", { key: "bot_username", value: botUsername });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your bot settings</p>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-3 p-4 rounded-md bg-yellow-400/5 border border-yellow-400/20">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-yellow-400">Security Reminder</p>
          <p className="text-muted-foreground text-xs mt-1">
            Your previous bot token was shared publicly. Please make sure you have revoked it via @BotFather and are now using a new token stored in Replit Secrets.
          </p>
        </div>
      </div>

      {/* Bot Info */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Bot Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Bot Username</label>
            <Input
              data-testid="input-bot-username"
              placeholder="@YourBotName"
              value={botUsername}
              onChange={(e) => setBotUsername(e.target.value)}
              className="bg-background/50 border-border/50"
            />
            <p className="text-xs text-muted-foreground">Your bot's Telegram username (for display purposes)</p>
          </div>
          <div className="p-3 rounded-md bg-muted/30 border border-border/30">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Bot Token</strong> and{" "}
              <strong className="text-foreground">Admin ID</strong> are stored securely in Replit Secrets and cannot be edited here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-accent" />
            Payment Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">UPI ID</label>
            <Input
              data-testid="input-upi-id"
              placeholder="yourname@paytm"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="bg-background/50 border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              This UPI ID is shown to users when they click "Pay via UPI" in the bot
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How to Use */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Bot Setup Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            {[
              "Add your bot to your Telegram channel as an administrator with 'Invite Users' permission",
              "Add your channel via the Channels page (you need the Channel ID starting with -100...)",
              "Create subscription plans in the Plans page",
              "Set your UPI ID above so users know where to send payment",
              "Users send /start to the bot, choose a plan, pay via UPI, then use /paid <txn_id> <plan>",
              "You verify payments in the Payments page — bot auto-sends invite link on verification",
              "Bot automatically removes expired members every hour",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        data-testid="button-save-settings"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
