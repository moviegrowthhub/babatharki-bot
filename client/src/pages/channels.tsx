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
import { insertChannelSchema } from "@shared/schema";
import type { Channel, InsertChannel } from "@shared/schema";
import { Hash, Plus, Trash2, Check, Link } from "lucide-react";
import { useState } from "react";

export default function Channels() {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const { data: channels, isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels"],
  });

  const form = useForm<InsertChannel>({
    resolver: zodResolver(insertChannelSchema),
    defaultValues: {
      channelId: "",
      channelName: "",
      channelUsername: "",
      inviteLink: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertChannel) => apiRequest("POST", "/api/channels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Channel added" });
      form.reset();
      setAdding(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add channel.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Channel removed" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add Telegram channels to manage</p>
        </div>
        <Button data-testid="button-add-channel" onClick={() => setAdding(!adding)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Channel
        </Button>
      </div>

      {/* Add Channel Form */}
      {adding && (
        <Card className="border-primary/20 bg-card/60 backdrop-blur-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-4 bg-background/50 border border-border/30 rounded-md p-3">
              <strong>How to get Channel ID:</strong> Add @userinfobot to your channel as admin, forward a message from the channel to it, and it will show the Channel ID (starts with -100...).
            </p>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                className="grid grid-cols-2 gap-4"
              >
                <FormField
                  control={form.control}
                  name="channelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Channel ID</FormLabel>
                      <FormControl>
                        <Input data-testid="input-channel-id" placeholder="-1001234567890" {...field} className="bg-background/50 border-border/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="channelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Channel Name</FormLabel>
                      <FormControl>
                        <Input data-testid="input-channel-name" placeholder="VIP Zone" {...field} className="bg-background/50 border-border/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="channelUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Channel Username (optional)</FormLabel>
                      <FormControl>
                        <Input data-testid="input-channel-username" placeholder="@myvipzone" {...field} value={field.value ?? ""} className="bg-background/50 border-border/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inviteLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Invite Link (optional)</FormLabel>
                      <FormControl>
                        <Input data-testid="input-invite-link" placeholder="https://t.me/+..." {...field} value={field.value ?? ""} className="bg-background/50 border-border/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
                  <Button data-testid="button-submit-channel" type="submit" disabled={createMutation.isPending}>
                    <Check className="w-4 h-4 mr-2" />
                    Add Channel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Channels List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)
        ) : !channels?.length ? (
          <Card className="border-border/50 bg-card/60">
            <CardContent className="py-16 text-center">
              <Hash className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No channels added yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add your Telegram channel to start managing members</p>
            </CardContent>
          </Card>
        ) : (
          channels.map((ch) => (
            <Card key={ch.id} data-testid={`channel-card-${ch.id}`} className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                  <Hash className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{ch.channelName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      ch.isActive
                        ? "bg-green-400/10 text-green-400 border-green-400/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}>
                      {ch.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>ID: <code className="bg-muted/50 px-1 rounded">{ch.channelId}</code></span>
                    {ch.channelUsername && <span>{ch.channelUsername}</span>}
                    {ch.inviteLink && (
                      <a href={ch.inviteLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary">
                        <Link className="w-3 h-3" />
                        Invite Link
                      </a>
                    )}
                  </div>
                </div>
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
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
