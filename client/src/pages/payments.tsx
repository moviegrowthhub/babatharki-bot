import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, CreditCard, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { Payment } from "@shared/schema";

export default function Payments() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");

  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    refetchInterval: 10000,
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/payments/${id}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Payment verified", description: "Member has been added to the channel." });
    },
    onError: () => toast({ title: "Error", description: "Failed to verify payment.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/payments/${id}/reject`, { note: "Rejected by admin" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Payment rejected" });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject payment.", variant: "destructive" }),
  });

  const filtered = (payments || []).filter((p) => {
    const matchSearch =
      !search ||
      p.txnId.toLowerCase().includes(search.toLowerCase()) ||
      (p.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.firstName || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || p.status === filter;
    return matchSearch && matchFilter;
  });

  const statusConfig: Record<string, { color: string; icon: any }> = {
    pending: { color: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", icon: Clock },
    verified: { color: "bg-green-400/10 text-green-400 border-green-400/20", icon: CheckCircle },
    rejected: { color: "bg-red-400/10 text-red-400 border-red-400/20", icon: XCircle },
  };

  const counts = {
    all: payments?.length || 0,
    pending: payments?.filter((p) => p.status === "pending").length || 0,
    verified: payments?.filter((p) => p.status === "verified").length || 0,
    rejected: payments?.filter((p) => p.status === "rejected").length || 0,
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Verify and manage payment requests</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "verified", "rejected"] as const).map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border/50 text-muted-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 relative">
          <Search className="w-4 h-4 absolute left-2.5 text-muted-foreground" />
          <Input
            data-testid="input-search-payments"
            placeholder="Search txn, username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-56 bg-card border-border/50 text-sm"
          />
        </div>
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))
        ) : filtered.length === 0 ? (
          <Card className="border-border/50 bg-card/60">
            <CardContent className="py-16 text-center">
              <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No payments found</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((p) => {
            const sc = statusConfig[p.status] || statusConfig.pending;
            const StatusIcon = sc.icon;
            const isPending = p.status === "pending";
            return (
              <Card
                key={p.id}
                data-testid={`payment-card-${p.id}`}
                className={`border-border/50 bg-card/60 backdrop-blur-sm transition-all ${
                  isPending ? "border-yellow-400/20" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className={`p-2 rounded-md ${sc.color.split(" ")[0]} shrink-0`}>
                      <StatusIcon className={`w-4 h-4 ${sc.color.split(" ")[1]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {p.firstName || ""} {p.username ? `@${p.username}` : `ID: ${p.telegramUserId}`}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.color}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>Txn: <code className="text-foreground/80 bg-muted/50 px-1 rounded">{p.txnId}</code></span>
                        <span>Plan: <strong className="text-foreground/80">{p.planName || "N/A"}</strong></span>
                        <span>₹{p.amount || 0}</span>
                        <span>{p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN") : ""}</span>
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          data-testid={`button-verify-${p.id}`}
                          size="sm"
                          onClick={() => verifyMutation.mutate(p.id)}
                          disabled={verifyMutation.isPending}
                          className="bg-green-600 text-white border-0"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                          Verify
                        </Button>
                        <Button
                          data-testid={`button-reject-${p.id}`}
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMutation.mutate(p.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Reject
                        </Button>
                      </div>
                    )}
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
