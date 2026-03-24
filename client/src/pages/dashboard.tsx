import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users, CreditCard, UserCheck, UserX, Clock,
  IndianRupee, CheckCircle, XCircle, Bot, Hash, Zap, Camera,
} from "lucide-react";
import type { Payment, Member } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/stats"],
    refetchInterval: 10000,
  });

  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    refetchInterval: 8000,
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/members"],
    refetchInterval: 15000,
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/payments/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Payment verified", description: "Invite link sent to user." });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/payments/${id}/reject`, { note: "Rejected by admin" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Payment rejected" });
    },
  });

  const pendingPayments = (payments || []).filter(p => p.status === "pending");
  const recentVerified = (payments || []).filter(p => p.status === "verified").slice(0, 4);
  const recentMembers = (members || []).filter(m => m.status === "active").slice(0, 4);

  const statusColor: Record<string, string> = {
    active: "text-green-400",
    expired: "text-red-400",
    pending: "text-yellow-400",
    verified: "text-green-400",
    rejected: "text-red-400",
  };

  const statCards = [
    { title: "Active Members", value: stats?.activeMembers ?? 0, icon: UserCheck, color: "text-green-400", bg: "bg-green-400/10" },
    { title: "Total Revenue", value: `₹${stats?.totalRevenue ?? 0}`, icon: IndianRupee, color: "text-accent", bg: "bg-accent/10" },
    { title: "Pending Reviews", value: stats?.pendingPayments ?? 0, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10", highlight: (stats?.pendingPayments ?? 0) > 0 },
    { title: "Expired Members", value: stats?.expiredMembers ?? 0, icon: UserX, color: "text-red-400", bg: "bg-red-400/10" },
    { title: "Verified Payments", value: stats?.verifiedPayments ?? 0, icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
    { title: "Channels", value: stats?.totalChannels ?? 0, icon: Hash, color: "text-blue-400", bg: "bg-blue-400/10" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">VIP Zone Bot — Real-time overview</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${
          stats?.botActive ? "bg-green-400/10 border-green-400/20" : "bg-red-400/10 border-red-400/20"
        }`}>
          <Bot className={`w-4 h-4 ${stats?.botActive ? "text-green-400" : "text-red-400"}`} />
          <span className={`text-sm font-medium ${stats?.botActive ? "text-green-400" : "text-red-400"}`}>
            {stats?.botActive ? "Bot Online" : "Bot Offline"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statCards.map((card) => (
          <Card
            key={card.title}
            className={`border-border/50 bg-card/60 backdrop-blur-sm ${
              (card as any).highlight ? "border-yellow-400/30 glow-gold" : ""
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-md ${card.bg} shrink-0`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <div className="min-w-0">
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12 mb-1" />
                  ) : (
                    <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">{card.title}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Payments — Quick Action */}
      {pendingPayments.length > 0 && (
        <Card className="border-yellow-400/20 bg-yellow-400/5 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-400">
              <Zap className="w-4 h-4" />
              Pending Payments — Quick Verify
              <span className="ml-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pendingPayments.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingPayments.map((p) => (
              <div
                key={p.id}
                data-testid={`pending-${p.id}`}
                className="flex items-center gap-3 p-3 rounded-md bg-background/60 border border-yellow-400/10 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {p.firstName || ""} {p.username ? `@${p.username}` : `ID:${p.telegramUserId}`}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {p.planName} · ₹{p.amount}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>UTR/Ref: <code className="text-foreground/80 bg-muted/50 px-1 rounded">{p.txnId}</code></span>
                    {(p as any).screenshotFileId && (
                      <a
                        href={`/api/payments/${p.id}/screenshot`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
                        data-testid={`link-screenshot-dash-${p.id}`}
                      >
                        <Camera className="w-3 h-3" /> View Screenshot
                      </a>
                    )}
                    <span>{p.createdAt ? new Date(p.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    data-testid={`btn-verify-${p.id}`}
                    size="sm"
                    className="bg-green-600 text-white border-0 h-8"
                    onClick={() => verifyMutation.mutate(p.id)}
                    disabled={verifyMutation.isPending}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Verify
                  </Button>
                  <Button
                    data-testid={`btn-reject-${p.id}`}
                    size="sm"
                    variant="destructive"
                    className="h-8"
                    onClick={() => rejectMutation.mutate(p.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Verified Payments */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Recent Verified Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentVerified.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No verified payments yet</div>
            ) : (
              recentVerified.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border border-border/30">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {p.firstName || ""} {p.username ? `@${p.username}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.planName} · ₹{p.amount}</span>
                  </div>
                  <span className="text-xs text-green-400 font-medium">Verified</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Active Members */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Active Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No active members yet</div>
            ) : (
              recentMembers.map((m) => {
                const daysLeft = m.expiresAt
                  ? Math.ceil((new Date(m.expiresAt).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <div key={m.id} className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full gradient-purple flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(m.firstName || m.username || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {m.firstName || ""} {m.username ? `@${m.username}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">{m.planName}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${daysLeft !== null && daysLeft <= 3 ? "text-yellow-400" : "text-green-400"}`}>
                      {daysLeft !== null ? `${daysLeft}d left` : "∞"}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
