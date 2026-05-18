import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContentCalendar() {
  return (
    <DashboardLayout>
      <TopBar title="Content Calendar" subtitle="Schedule and manage your social media posts." />
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Calendar View</CardTitle></CardHeader>
          <CardContent className="h-96 flex items-center justify-center text-muted-foreground">
            Calendar implementation coming soon.
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
