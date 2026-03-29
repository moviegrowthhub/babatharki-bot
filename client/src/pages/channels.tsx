import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { insertChannelSchema } from "@shared/schema";
import type { Channel, InsertChannel } from "@shared/schema";
import { Hash, Plus, Trash2, Check, Link, Pencil, X, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function Channels() {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editChannel, setEditChannel] = useState<Channel | null>(null);

  const { data: channels, isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const addForm = useForm<InsertChannel>({
    resolver: zodResolver(insertChannelSchema),
    defaultValues: { channelId: "", channelName: "", channelUsername: "", inviteLink: "", isActive: true },
  });

  const editForm = useForm<InsertChannel>({
    resolver: zodResolver(insertChannelSchema),
    defaultValues: { channelId: "", channelName: "", channelUsername: "", inviteLink: "", isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertChannel) => apiRequest("POST", "/api/channels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Channel added successfully" });
      addForm.reset();
      setAdding(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add channel.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertChannel> }) =>
      apiRequest("PUT", `/api/channels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      toast({ title: "Channel updated successfully" });
      setEditChannel(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update channel.", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PUT", `/api/channels/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/channels"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Channel removed" });
    },
  });

  const openEdit = (ch: Channel) => {
    setEditChannel(ch);
    editForm.reset({
      channelId: ch.channelId,
      channelName: ch.channelName,
      channelUsername: ch.channelUsername ?? "",
      inviteLink: ch.inviteLink ?? "",
      isActive: ch.isActive,
    });
  };

  const ChannelFormFields = ({ control, readOnlyId }: { control: any; readOnlyId?: boolean }) => (
    <div className="grid grid-cols-2 gap-4">
      <FormField control={control} name="channelId" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Channel ID</FormLabel>
          <FormControl>
            <Input
              data-testid="input-channel-id"
              placeholder="-1001234567890"
              {...field}
              readOnly={readOnlyId}
              className={`bg-background/50 border-border/50 ${readOnlyId ? "opacity-60 cursor-not-allowed" : ""}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="channelName" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Channel Name</FormLabel>
          <FormControl>
            <Input data-testid="input-channel-name" placeholder="VIP Zone" {...field} className="bg-background/50 border-border/50" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="channelUsername" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Username (optional)</FormLabel>
          <FormControl>
            <Input data-testid="input-channel-username" placeholder="@myvipzone" {...field} value={field.value ?? ""} className="bg-background/50 border-border/50" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="inviteLink" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Invite Link (optional)</FormLabel>
          <FormControl>
            <Input data-testid="input-invite-link" placeholder="https://t.me/+..." {...field} value={field.value ?? ""} className="bg-background/50 border-border/50" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage Telegram groups and channels</p>
        </div>
        <Button data-testid="button-add-channel" onClick={() => setAdding(!adding)}>
          {adding ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {adding ? "Cancel" : "Add Channel"}
        </Button>
      </div>

      {/* Add Channel Form */}
      {adding && (
        <div className="border border-primary/20 bg-card/60 backdrop-blur-sm rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Add New Channel
          </h3>
          <p className="text-xs text-muted-foreground mb-4 bg-muted/30 border border-border/30 rounded-md p-3">
            <strong>Channel ID kaise milega:</strong> @userinfobot ko apne channel mein admin banao, channel ka koi bhi message forward karo userinfobot ko — woh Channel ID batayega (-100 se shuru hoga).
          </p>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <ChannelFormFields control={addForm.control} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
                <Button data-testid="button-submit-channel" type="submit" disabled={createMutation.isPending}>
                  <Check className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? "Adding..." : "Add Channel"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* Channels List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : !channels?.length ? (
          <Card className="border-border/50 bg-card/60">
            <CardContent className="py-16 text-center">
              <Hash className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Koi channel add nahi hai</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Apna Telegram channel add karo members manage karne ke liye</p>
            </CardContent>
          </Card>
        ) : (
          channels.map((ch) => (
            <Card key={ch.id} data-testid={`channel-card-${ch.id}`} className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 shrink-0">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{ch.channelName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        ch.isActive
                          ? "bg-green-400/10 text-green-400 border-green-400/20"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }`}>
                        {ch.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>ID: <code className="bg-muted/50 px-1 rounded text-foreground/70">{ch.channelId}</code></span>
                      {ch.channelUsername && <span className="text-primary">{ch.channelUsername}</span>}
                      {ch.inviteLink && (
                        <a
                          href={ch.inviteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Join Link
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Toggle + Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      data-testid={`switch-channel-${ch.id}`}
                      checked={ch.isActive}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: ch.id, isActive: checked })}
                    />
                    <Button
                      data-testid={`button-edit-channel-${ch.id}`}
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(ch)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      data-testid={`button-delete-channel-${ch.id}`}
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(ch.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Channel Dialog */}
      <Dialog open={!!editChannel} onOpenChange={(o) => !o && setEditChannel(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Channel — {editChannel?.channelName}
            </DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editChannel && updateMutation.mutate({ id: editChannel.id, data }))} className="space-y-4">
              <ChannelFormFields control={editForm.control} readOnlyId={true} />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setEditChannel(null)}>Cancel</Button>
                <Button data-testid="button-save-channel" type="submit" disabled={updateMutation.isPending}>
                  <Check className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
