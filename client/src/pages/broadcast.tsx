import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Send, Users } from "lucide-react";
import { useState } from "react";

export default function Broadcast() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");

  const { data: stats } = useQuery<any>({ queryKey: ["/api/stats"] });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/broadcast", { message });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Broadcast sent!",
        description: `Sent: ${data.sent}, Failed: ${data.failed}`,
      });
      setMessage("");
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to send broadcast.", variant: "destructive" }),
  });

  const templates = [
    "🔥 *Special Offer!* Renew your subscription and get 10% off! Use /start to see plans.",
    "⚠️ Your subscription is expiring soon. Renew now with /start to keep your VIP access!",
    "🎉 *New content added!* Check the channel for exclusive updates. Enjoy your VIP membership!",
    "📢 *Maintenance notice:* The channel will be down for 1 hour. We apologize for any inconvenience.",
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Broadcast</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Send a message to all active members</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border/50">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm">
          This message will be sent to{" "}
          <strong className="text-foreground">{stats?.activeMembers ?? 0} active members</strong>
        </span>
      </div>

      {/* Compose */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            Compose Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Supports Telegram markdown: *bold*, _italic_, `code`
            </p>
            <Textarea
              data-testid="input-broadcast-message"
              placeholder="Type your message to all VIP members..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="bg-background/50 border-border/50 resize-none font-mono text-sm"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">{message.length} chars</span>
              <Button
                data-testid="button-send-broadcast"
                onClick={() => broadcastMutation.mutate()}
                disabled={!message.trim() || broadcastMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {broadcastMutation.isPending ? "Sending..." : "Send Broadcast"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Quick Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.map((t, i) => (
            <button
              key={i}
              data-testid={`template-${i}`}
              onClick={() => setMessage(t)}
              className="w-full text-left p-3 rounded-md bg-background/50 border border-border/30 text-sm text-muted-foreground hover-elevate transition-colors"
            >
              {t.substring(0, 80)}...
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
