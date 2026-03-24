import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, UserX, RefreshCw, Search, Calendar, Plus,
  Send, Clock, UserPlus, Shield, MessageSquare, ChevronDown,
} from "lucide-react";
import { useState } from "react";
import type { Member, Plan, Channel } from "@shared/schema";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Members() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "pending">("all");

  // Dialogs
  const [msgDialog, setMsgDialog] = useState<{ open: boolean; memberId: number | null; name: string }>({ open: false, memberId: null, name: "" });
  const [msgText, setMsgText] = useState("");
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ telegramUserId: "", username: "", firstName: "", planId: "", channelId: "" });

  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ["/api/members"],
    refetchInterval: 15000,
  });
  const { data: plans } = useQuery<Plan[]>({ queryKey: ["/api/plans"] });
  const { data: channels } = useQuery<Channel[]>({ queryKey: ["/api/channels"] });

  const kickMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Member banned", description: "User removed and notified." });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/members/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Status updated" });
    },
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, days }: { id: number; days: number }) =>
      apiRequest("POST", `/api/members/${id}/extend`, { days }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Membership extended", description: "User has been notified via Telegram." });
    },
    onError: () => toast({ title: "Error extending membership", variant: "destructive" }),
  });

  const notifyMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) =>
      apiRequest("POST", `/api/members/${id}/notify`, { message }),
    onSuccess: () => {
      toast({ title: "Message sent", description: "User received the message on Telegram." });
      setMsgDialog({ open: false, memberId: null, name: "" });
      setMsgText("");
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/members/add", addForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Member added", description: "Invite link sent to user via Telegram." });
      setAddDialog(false);
      setAddForm({ telegramUserId: "", username: "", firstName: "", planId: "", channelId: "" });
    },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
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
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage channel members and subscriptions</p>
        </div>
        <Button data-testid="button-add-member" onClick={() => setAddDialog(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
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
            <span className="text-xs opacity-70">{counts[f as keyof typeof counts]}</span>
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
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)
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
                className={`border-border/50 bg-card/60 backdrop-blur-sm ${isExpiring ? "border-yellow-400/20" : ""}`}
              >
                <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                  {/* Avatar */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full gradient-purple text-white font-bold text-sm shrink-0">
                    {(m.firstName || m.username || "?")[0].toUpperCase()}
                  </div>

                  {/* Info */}
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
                      <span>ID: <code className="bg-muted/50 px-1 rounded">{m.telegramUserId}</code></span>
                      <span>Plan: <strong className="text-foreground/80">{m.planName || "N/A"}</strong></span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {m.expiresAt
                          ? `Expires ${new Date(m.expiresAt).toLocaleDateString("en-IN")} (${days}d left)`
                          : "No expiry"}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Extend Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          data-testid={`button-extend-${m.id}`}
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          disabled={extendMutation.isPending}
                        >
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          Extend
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {[7, 15, 30, 60, 90].map((d) => (
                          <DropdownMenuItem
                            key={d}
                            data-testid={`extend-${d}-${m.id}`}
                            onClick={() => extendMutation.mutate({ id: m.id, days: d })}
                          >
                            +{d} Days
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Message Button */}
                    <Button
                      data-testid={`button-message-${m.id}`}
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      onClick={() => {
                        setMsgDialog({ open: true, memberId: m.id, name: m.firstName || m.username || "User" });
                        setMsgText("");
                      }}
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1" />
                      Message
                    </Button>

                    {/* Reactivate if expired */}
                    {m.status === "expired" && (
                      <Button
                        data-testid={`button-reactivate-${m.id}`}
                        size="sm"
                        variant="secondary"
                        className="h-8"
                        onClick={() => statusMutation.mutate({ id: m.id, status: "active" })}
                        disabled={statusMutation.isPending}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Reactivate
                      </Button>
                    )}

                    {/* Ban Button */}
                    <Button
                      data-testid={`button-kick-${m.id}`}
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      onClick={() => kickMutation.mutate(m.id)}
                      disabled={kickMutation.isPending}
                    >
                      <UserX className="w-3.5 h-3.5 mr-1" />
                      Ban
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Send Message Dialog */}
      <Dialog open={msgDialog.open} onOpenChange={(o) => setMsgDialog(prev => ({ ...prev, open: o }))}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Send Message to {msgDialog.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Supports Telegram markdown: *bold*, _italic_, `code`</p>
            <Textarea
              data-testid="input-member-message"
              placeholder="Type your message..."
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              rows={4}
              className="bg-background/50 border-border/50 resize-none text-sm"
            />
            <div className="flex gap-2 flex-wrap">
              {["⚠️ Your membership is expiring soon! Renew with /start", "🎉 Thank you for being a VIP member!", "🔔 Important announcement — check the channel now"].map((t, i) => (
                <button
                  key={i}
                  onClick={() => setMsgText(t)}
                  className="text-xs px-2 py-1 rounded bg-muted/50 border border-border/30 text-muted-foreground hover:text-foreground"
                >
                  {t.substring(0, 30)}...
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMsgDialog({ open: false, memberId: null, name: "" })}>Cancel</Button>
            <Button
              data-testid="button-send-member-message"
              onClick={() => msgDialog.memberId && notifyMutation.mutate({ id: msgDialog.memberId, message: msgText })}
              disabled={!msgText.trim() || notifyMutation.isPending}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {notifyMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Add Member Manually
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground bg-muted/30 border border-border/30 rounded-md p-3">
              User will receive an invite link automatically on Telegram.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Telegram User ID *</label>
                <Input
                  data-testid="input-add-user-id"
                  placeholder="123456789"
                  value={addForm.telegramUserId}
                  onChange={(e) => setAddForm(f => ({ ...f, telegramUserId: e.target.value }))}
                  className="bg-background/50 border-border/50 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">First Name</label>
                <Input
                  data-testid="input-add-first-name"
                  placeholder="John"
                  value={addForm.firstName}
                  onChange={(e) => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                  className="bg-background/50 border-border/50 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Username</label>
                <Input
                  data-testid="input-add-username"
                  placeholder="@username"
                  value={addForm.username}
                  onChange={(e) => setAddForm(f => ({ ...f, username: e.target.value }))}
                  className="bg-background/50 border-border/50 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Plan *</label>
                <Select value={addForm.planId} onValueChange={(v) => setAddForm(f => ({ ...f, planId: v }))}>
                  <SelectTrigger data-testid="select-add-plan" className="bg-background/50 border-border/50 text-sm h-9">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {(plans || []).filter(p => p.isActive).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — ₹{p.price} ({p.durationDays}d)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Channel *</label>
                <Select value={addForm.channelId} onValueChange={(v) => setAddForm(f => ({ ...f, channelId: v }))}>
                  <SelectTrigger data-testid="select-add-channel" className="bg-background/50 border-border/50 text-sm h-9">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {(channels || []).map(c => (
                      <SelectItem key={c.id} value={c.channelId}>
                        {c.channelName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button
              data-testid="button-submit-add-member"
              onClick={() => addMutation.mutate()}
              disabled={!addForm.telegramUserId || !addForm.planId || !addForm.channelId || addMutation.isPending}
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              {addMutation.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
