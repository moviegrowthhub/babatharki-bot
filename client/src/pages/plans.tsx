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
import { insertPlanSchema } from "@shared/schema";
import type { Plan, InsertPlan } from "@shared/schema";
import { z } from "zod";
import { Package, Plus, Trash2, Check, Pencil, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

const formSchema = insertPlanSchema.extend({
  price: z.coerce.number().min(1, "Price must be at least 1"),
  durationDays: z.coerce.number().min(1, "Duration must be at least 1 day"),
});

export default function Plans() {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const addForm = useForm<InsertPlan>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", price: 99, durationDays: 30, description: "", isActive: true },
  });

  const editForm = useForm<InsertPlan>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", price: 99, durationDays: 30, description: "", isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertPlan) => apiRequest("POST", "/api/plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Plan created successfully" });
      addForm.reset();
      setAdding(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to create plan.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertPlan> }) =>
      apiRequest("PUT", `/api/plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ title: "Plan updated successfully" });
      setEditPlan(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update plan.", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PUT", `/api/plans/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/plans"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Plan deleted" });
    },
  });

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    editForm.reset({
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      description: plan.description ?? "",
      isActive: plan.isActive,
    });
  };

  const durationLabel = (days: number) => {
    if (days === 1) return "1 Day";
    if (days === 7) return "1 Week";
    if (days === 30) return "1 Month";
    if (days === 90) return "3 Months";
    if (days === 180) return "6 Months";
    if (days === 365) return "1 Year";
    return `${days} Days`;
  };

  const PlanFormFields = ({ control }: { control: any }) => (
    <div className="grid grid-cols-2 gap-4">
      <FormField control={control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Plan Name</FormLabel>
          <FormControl>
            <Input data-testid="input-plan-name" placeholder="e.g. Monthly" {...field} className="bg-background/50 border-border/50" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="price" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Price (₹)</FormLabel>
          <FormControl>
            <Input data-testid="input-plan-price" type="number" placeholder="299" {...field} className="bg-background/50 border-border/50" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="durationDays" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Duration (days)</FormLabel>
          <FormControl>
            <Input data-testid="input-plan-duration" type="number" placeholder="30" {...field} className="bg-background/50 border-border/50" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Description (optional)</FormLabel>
          <FormControl>
            <Input data-testid="input-plan-desc" placeholder="Best value..." {...field} value={field.value ?? ""} className="bg-background/50 border-border/50" />
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
          <h1 className="text-2xl font-bold">Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage subscription plans for your VIP channel</p>
        </div>
        <Button data-testid="button-add-plan" onClick={() => setAdding(!adding)}>
          {adding ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {adding ? "Cancel" : "Add Plan"}
        </Button>
      </div>

      {/* Add Plan Form */}
      {adding && (
        <div className="border border-primary/20 bg-card/60 backdrop-blur-sm rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            New Plan
          </h3>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <PlanFormFields control={addForm.control} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
                <Button data-testid="button-submit-plan" type="submit" disabled={createMutation.isPending}>
                  <Check className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? "Creating..." : "Create Plan"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* Plans Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : !plans?.length ? (
        <Card className="border-border/50 bg-card/60">
          <CardContent className="py-16 text-center">
            <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No plans yet. Create your first plan above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              data-testid={`plan-card-${plan.id}`}
              className={`relative rounded-lg border bg-card/60 backdrop-blur-sm p-5 space-y-4 transition-all ${
                plan.isActive
                  ? "border-primary/20 shadow-sm"
                  : "border-border/30 opacity-60"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-lg leading-tight">{plan.name}</div>
                  <div className="text-2xl font-extrabold text-accent mt-1">₹{plan.price}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Switch
                    data-testid={`switch-plan-${plan.id}`}
                    checked={plan.isActive}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: plan.id, isActive: checked })}
                  />
                  <span className={`text-xs font-medium ${plan.isActive ? "text-green-400" : "text-muted-foreground"}`}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {durationLabel(plan.durationDays)}
                </div>
                {plan.description && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                    {plan.description}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  data-testid={`button-edit-plan-${plan.id}`}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(plan)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  data-testid={`button-delete-plan-${plan.id}`}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => deleteMutation.mutate(plan.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Plan Dialog */}
      <Dialog open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edit Plan — {editPlan?.name}
            </DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editPlan && updateMutation.mutate({ id: editPlan.id, data }))} className="space-y-4">
              <PlanFormFields control={editForm.control} />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setEditPlan(null)}>Cancel</Button>
                <Button data-testid="button-save-plan" type="submit" disabled={updateMutation.isPending}>
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
