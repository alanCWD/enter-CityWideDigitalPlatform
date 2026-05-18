import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SocialInbox() {
  return (
    <DashboardLayout>
      <TopBar title="Social Inbox" subtitle="Manage your unified conversations." />
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Unified Inbox</CardTitle></CardHeader>
          <CardContent className="h-96 flex items-center justify-center text-muted-foreground">
            Inbox implementation coming soon.
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
