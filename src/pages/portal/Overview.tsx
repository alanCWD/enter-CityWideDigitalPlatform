import { PortalLayout } from "@/components/portal/PortalLayout";
import { SectorOverview } from "@/components/portal/SectorOverview";

export default function Overview() {
  return (
    <PortalLayout>
      {(connection) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome, {connection.business_name || connection.client_label}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your business performance at a glance.
            </p>
          </div>
          <SectorOverview connection={connection} />
        </div>
      )}
    </PortalLayout>
  );
}
