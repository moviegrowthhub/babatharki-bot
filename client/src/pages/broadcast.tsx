import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Send, Users, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";

export default function Broadcast() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [showAi, setShowAi] = useState(false);

  const { data: stats } = useQuery<any>({ queryKey: ["/api/stats"] });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/broadcast", { message });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Broadcast bej diya!",
        description: `Bheja: ${data.sent}, Failed: ${data.failed}`,
      });
      setMessage("");
    },
    onError: () =>
      toast({ title: "Error", description: "Broadcast bhejne mein problem aayi.", variant: "destructive" }),
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-broadcast", { topic: aiTopic });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.message) {
        setMessage(data.message);
        setShowAi(false);
        setAiTopic("");
        toast({ title: "AI ne message likh diya!", description: "Check karo aur edit karo agar chahiye." });
      }
    },
    onError: () =>
      toast({ title: "AI Error", description: "Message generate nahi hua. Dobara try karo.", variant: "destructive" }),
  });

  const templates = [
    "🔥 *Special Offer!* Apna subscription renew karo aur 10% off pao! /start se plans dekho.",
    "⚠️ Aapka subscription jaldi expire hone wala hai. Abhi /start se renew karo VIP access banaye rakho!",
    "🎉 *Naya content aa gaya!* Channel mein exclusive updates dekho. VIP membership enjoy karo!",
    "📢 *Important Notice:* Channel 1 ghante ke liye down rahega. Inconvenience ke liye maafi.",
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Broadcast</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sabhi active members ko message bhejo</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border/50">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm">
          Yeh message{" "}
          <strong className="text-foreground">{stats?.activeMembers ?? 0} active members</strong>{" "}
          ko jayega
        </span>
      </div>

      {/* AI Generator */}
      <Card className="border-primary/20 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI se Message Banao
            </CardTitle>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowAi(!showAi)}
              className="h-7 text-xs"
            >
              {showAi ? "Band Karo" : "AI Use Karo"}
            </Button>
          </div>
        </CardHeader>
        {showAi && (
          <CardContent className="space-y-3 pt-0">
            <p className="text-xs text-muted-foreground">
              Topic likhो — AI apne aap ek professional broadcast message banayega
            </p>
            <div className="flex gap-2">
              <Input
                data-testid="input-ai-topic"
                placeholder="e.g. new content added, special offer 20% off, maintenance tonight..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                className="bg-background/50 border-border/50 text-sm"
                onKeyDown={(e) => e.key === "Enter" && aiTopic.trim() && aiGenerateMutation.mutate()}
              />
              <Button
                data-testid="button-ai-generate"
                onClick={() => aiGenerateMutation.mutate()}
                disabled={!aiTopic.trim() || aiGenerateMutation.isPending}
                className="shrink-0"
              >
                {aiGenerateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            </div>
            {aiGenerateMutation.isPending && (
              <p className="text-xs text-muted-foreground animate-pulse">AI likh raha hai...</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Compose */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            Message Likho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Telegram markdown support: *bold*, _italic_, `code`
            </p>
            <Textarea
              data-testid="input-broadcast-message"
              placeholder="Sabhi VIP members ko message type karo..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="bg-background/50 border-border/50 resize-none font-mono text-sm"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">{message.length} characters</span>
              <Button
                data-testid="button-send-broadcast"
                onClick={() => broadcastMutation.mutate()}
                disabled={!message.trim() || broadcastMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {broadcastMutation.isPending ? "Bhej raha hai..." : "Broadcast Bhejo"}
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
              className="w-full text-left p-3 rounded-md bg-background/50 border border-border/30 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {t.substring(0, 85)}...
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
