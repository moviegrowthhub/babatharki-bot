import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import Payments from "@/pages/payments";
import Plans from "@/pages/plans";
import Channels from "@/pages/channels";
import Settings from "@/pages/settings";
import Broadcast from "@/pages/broadcast";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/members" component={Members} />
      <Route path="/payments" component={Payments} />
      <Route path="/plans" component={Plans} />
      <Route path="/channels" component={Channels} />
      <Route path="/broadcast" component={Broadcast} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full overflow-hidden">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/30 backdrop-blur-sm shrink-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm text-muted-foreground">VIP Bot Dashboard</span>
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
