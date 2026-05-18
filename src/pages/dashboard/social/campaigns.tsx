import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SmartCampaigns() {
  return (
    <DashboardLayout>
      <TopBar title="Smart Campaigns" subtitle="Manage your ad campaigns and boosts." />
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Campaign Dashboard</CardTitle></CardHeader>
          <CardContent className="h-96 flex items-center justify-center text-muted-foreground">
            Campaigns implementation coming soon.
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
