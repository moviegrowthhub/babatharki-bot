import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CreditCard,
  TrendingUp,
  Hash,
  Bot,
  UserCheck,
  UserX,
  Clock,
  IndianRupee,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { Payment, Member } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/stats"],
    refetchInterval: 15000,
  });

  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    refetchInterval: 15000,
  });

  const { data: members } = useQuery<Member[]>({
    queryKey: ["/api/members"],
  });

  const recentPayments = payments?.slice(0, 5) || [];
  const recentMembers = members?.slice(0, 5) || [];

  const statCards = [
    {
      title: "Active Members",
      value: stats?.activeMembers ?? 0,
      icon: UserCheck,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      title: "Total Revenue",
      value: `₹${stats?.totalRevenue ?? 0}`,
      icon: IndianRupee,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "Pending Payments",
      value: stats?.pendingPayments ?? 0,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
    {
      title: "Expired Members",
      value: stats?.expiredMembers ?? 0,
      icon: UserX,
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
    {
      title: "Verified Payments",
      value: stats?.verifiedPayments ?? 0,
      icon: CheckCircle,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Channels",
      value: stats?.totalChannels ?? 0,
      icon: Hash,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
      verified: "bg-green-400/10 text-green-400 border-green-400/20",
      rejected: "bg-red-400/10 text-red-400 border-red-400/20",
      active: "bg-green-400/10 text-green-400 border-green-400/20",
      expired: "bg-red-400/10 text-red-400 border-red-400/20",
    };
    return map[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor your VIP channel bot</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border/50">
          <Bot className={`w-4 h-4 ${stats?.botActive ? "text-green-400" : "text-red-400"}`} />
          <span className={`text-sm font-medium ${stats?.botActive ? "text-green-400" : "text-red-400"}`}>
            {stats?.botActive ? "Bot Active" : "Bot Offline"}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border-border/50 bg-card/60 backdrop-blur-sm">
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No payments yet</div>
            ) : (
              recentPayments.map((p) => (
                <div
                  key={p.id}
                  data-testid={`payment-row-${p.id}`}
                  className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border border-border/30"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      @{p.username || p.firstName || p.telegramUserId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.planName} · ₹{p.amount}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Members */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Recent Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No members yet</div>
            ) : (
              recentMembers.map((m) => (
                <div
                  key={m.id}
                  data-testid={`member-row-${m.id}`}
                  className="flex items-center justify-between p-2.5 rounded-md bg-background/50 border border-border/30"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {m.firstName || ""} {m.username ? `@${m.username}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.planName || "N/A"} ·{" "}
                      {m.expiresAt
                        ? `expires ${new Date(m.expiresAt).toLocaleDateString("en-IN")}`
                        : "Lifetime"}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge(m.status)}`}>
                    {m.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
