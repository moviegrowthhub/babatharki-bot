import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, UserX, RefreshCw, Search, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { Member } from "@shared/schema";

export default function Members() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "pending">("all");

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
    refetchInterval: 15000,
  });

  const kickMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Member banned", description: "User has been removed from the channel." });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/members/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Member status updated" });
    },
  });

  const filtered = (members || []).filter((m) => {
    const matchSearch =
      !search ||
      (m.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.firstName || "").toLowerCase().includes(search.toLowerCase()) ||
      m.telegramUserId.includes(search);
    const matchFilter = filter === "all" || m.status === filter;
    return matchSearch && matchFilter;
  });

  const statusColor: Record<string, string> = {
    active: "bg-green-400/10 text-green-400 border-green-400/20",
    expired: "bg-red-400/10 text-red-400 border-red-400/20",
    pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    banned: "bg-muted text-muted-foreground border-border",
  };

  const counts = {
    all: members?.length || 0,
    active: members?.filter((m) => m.status === "active").length || 0,
    expired: members?.filter((m) => m.status === "expired").length || 0,
    pending: members?.filter((m) => m.status === "pending").length || 0,
  };

  const daysLeft = (expiresAt: Date | null | string) => {
    if (!expiresAt) return null;
    const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage channel members and subscriptions</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "active", "expired", "pending"] as const).map((f) => (
          <button
            key={f}
            data-testid={`member-filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border/50 text-muted-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            <span className="text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search-members"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-52 bg-card border-border/50 text-sm"
          />
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)
        ) : filtered.length === 0 ? (
          <Card className="border-border/50 bg-card/60">
            <CardContent className="py-16 text-center">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No members found</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((m) => {
            const days = daysLeft(m.expiresAt);
            const isExpiring = days !== null && days <= 3 && days >= 0;
            return (
              <Card
                key={m.id}
                data-testid={`member-card-${m.id}`}
                className={`border-border/50 bg-card/60 backdrop-blur-sm ${
                  isExpiring ? "border-yellow-400/20" : ""
                }`}
              >
                <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full gradient-purple text-white font-bold text-sm shrink-0">
                    {(m.firstName || m.username || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {m.firstName || ""} {m.username ? `@${m.username}` : ""}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[m.status] || statusColor.pending}`}>
                        {m.status}
                      </span>
                      {isExpiring && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                          Expiring soon
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>ID: {m.telegramUserId}</span>
                      <span>Plan: <strong className="text-foreground/80">{m.planName || "N/A"}</strong></span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {m.expiresAt
                          ? `Expires ${new Date(m.expiresAt).toLocaleDateString("en-IN")} (${days}d left)`
                          : "No expiry"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.status === "expired" && (
                      <Button
                        data-testid={`button-reactivate-${m.id}`}
                        size="sm"
                        variant="secondary"
                        onClick={() => statusMutation.mutate({ id: m.id, status: "active" })}
                        disabled={statusMutation.isPending}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Reactivate
                      </Button>
                    )}
                    <Button
                      data-testid={`button-kick-${m.id}`}
                      size="sm"
                      variant="destructive"
                      onClick={() => kickMutation.mutate(m.id)}
                      disabled={kickMutation.isPending}
                    >
                      <UserX className="w-3.5 h-3.5 mr-1.5" />
                      Ban
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
