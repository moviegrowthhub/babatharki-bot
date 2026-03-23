import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Hash,
  Settings,
  Megaphone,
  Bot,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Members", url: "/members", icon: Users },
  { title: "Plans", url: "/plans", icon: Package },
  { title: "Channels", url: "/channels", icon: Hash },
  { title: "Broadcast", url: "/broadcast", icon: Megaphone },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
  });

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md gradient-purple glow-purple shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground truncate">VIP Zone Bot</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${stats?.botActive ? "bg-green-400" : "bg-red-400"}`} />
              <span className="text-xs text-muted-foreground">
                {stats?.botActive ? "Bot Online" : "Bot Offline"}
              </span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {stats?.pendingPayments > 0 && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-md bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs text-accent font-medium">
                {stats.pendingPayments} payment{stats.pendingPayments > 1 ? "s" : ""} pending
              </span>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground/60 px-3 mb-1">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={`mx-1 rounded-md transition-colors ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70"
                      }`}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3 py-2">
                        <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                        <span className="text-sm">{item.title}</span>
                        {item.url === "/payments" && stats?.pendingPayments > 0 && (
                          <span className="ml-auto text-xs font-semibold bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">
                            {stats.pendingPayments}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border/50">
        <div className="flex flex-col gap-1">
          {stats && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Active Members</span>
                <span className="font-semibold text-green-400">{stats.activeMembers}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-semibold text-accent">₹{stats.totalRevenue}</span>
              </div>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
