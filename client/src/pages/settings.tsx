import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Bot, IndianRupee, Save, AlertTriangle, Bitcoin, Copy, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import upiQrPath from "@assets/image_1774286558077.jpg";

export default function Settings() {
  const { toast } = useToast();
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [btcAddress, setBtcAddress] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedBtc, setCopiedBtc] = useState(false);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setUpiId(settings.upi_id || "");
      setUpiName(settings.upi_name || "");
      setBtcAddress(settings.bitcoin_address || "");
      setBotUsername(settings.bot_username || "");
    }
  }, [settings]);

  const copyToClipboard = (text: string, type: "upi" | "btc") => {
    navigator.clipboard.writeText(text);
    if (type === "upi") { setCopiedUpi(true); setTimeout(() => setCopiedUpi(false), 2000); }
    else { setCopiedBtc(true); setTimeout(() => setCopiedBtc(false), 2000); }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = [
        ["upi_id", upiId],
        ["upi_name", upiName],
        ["bitcoin_address", btcAddress],
        ["bot_username", botUsername],
      ];
      for (const [key, value] of entries) {
        await apiRequest("POST", "/api/settings", { key, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure payment methods and bot settings</p>
      </div>

      {/* Security Warning */}
      <div className="flex items-start gap-3 p-4 rounded-md bg-yellow-400/5 border border-yellow-400/20">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-yellow-400">Security Reminder</p>
          <p className="text-muted-foreground text-xs mt-1">
            Your bot token was shared publicly. Please ensure you've revoked the old token via @BotFather and the new one is saved in Replit Secrets.
          </p>
        </div>
      </div>

      {/* UPI Settings */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-accent" />
            UPI Payment Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-col sm:flex-row">
            <div className="flex-1 space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">UPI ID</label>
                <div className="flex gap-2">
                  <Input
                    data-testid="input-upi-id"
                    placeholder="yourname@oksbi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="bg-background/50 border-border/50 font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => copyToClipboard(upiId, "upi")}
                    data-testid="button-copy-upi"
                  >
                    {copiedUpi ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">UPI Name (shown to payers)</label>
                <Input
                  data-testid="input-upi-name"
                  placeholder="Your Name"
                  value={upiName}
                  onChange={(e) => setUpiName(e.target.value)}
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="p-3 rounded-md bg-muted/30 border border-border/30 text-xs text-muted-foreground space-y-1">
                <p><strong className="text-foreground">UPI Deep Link Preview:</strong></p>
                <code className="text-xs break-all text-foreground/70">
                  upi://pay?pa={upiId}&pn={upiName}&am=299&cu=INR
                </code>
              </div>
            </div>
            {/* QR Preview */}
            <div className="shrink-0">
              <p className="text-xs font-medium text-muted-foreground mb-2">Your QR Code</p>
              <img
                src={upiQrPath}
                alt="UPI QR Code"
                className="w-36 h-36 rounded-md object-cover border border-border/30"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bitcoin Settings */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bitcoin className="w-4 h-4 text-orange-400" />
            Bitcoin Payment Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Bitcoin Address</label>
            <div className="flex gap-2">
              <Input
                data-testid="input-btc-address"
                placeholder="bc1q..."
                value={btcAddress}
                onChange={(e) => setBtcAddress(e.target.value)}
                className="bg-background/50 border-border/50 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyToClipboard(btcAddress, "btc")}
                data-testid="button-copy-btc"
              >
                {copiedBtc ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Users can pay in Bitcoin. They'll send the TX hash as their reference number.
          </p>
        </CardContent>
      </Card>

      {/* Bot Settings */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Bot Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Bot Username</label>
            <Input
              data-testid="input-bot-username"
              placeholder="@YourBotUsername"
              value={botUsername}
              onChange={(e) => setBotUsername(e.target.value)}
              className="bg-background/50 border-border/50"
            />
          </div>
          <div className="p-3 rounded-md bg-muted/30 border border-border/30 text-xs text-muted-foreground">
            <strong className="text-foreground">Bot Token & Admin ID</strong> are stored securely in Replit Secrets — not editable here.
          </div>
        </CardContent>
      </Card>

      {/* How Bot Works */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            How the Auto System Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { emoji: "1️⃣", text: "User sends /start → bot shows plans with inline buttons" },
              { emoji: "2️⃣", text: "User selects a plan → bot shows UPI QR + deep link (or Bitcoin address)" },
              { emoji: "3️⃣", text: "User pays → taps 'I've Paid' → sends UTR/TX hash (no /paid command needed!)" },
              { emoji: "4️⃣", text: "Admin gets instant Telegram notification with ✅ Verify / ❌ Reject buttons" },
              { emoji: "5️⃣", text: "Admin taps Verify → bot instantly sends private channel invite link to user" },
              { emoji: "6️⃣", text: "Bot auto-removes expired members every hour and notifies them to renew" },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base shrink-0">{step.emoji}</span>
                <span className="text-sm text-muted-foreground">{step.text}</span>
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
        size="lg"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save All Settings"}
      </Button>
    </div>
  );
}
