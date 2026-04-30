import { PortalLayout } from "@/components/portal/PortalLayout";
import { SocialSyncEmbed } from "@/components/dashboard/SocialSyncEmbed";

export default function PortalSocial() {
  return (
    <PortalLayout>
      {(connection) => (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-[#EEF1FA]">Social Sync</h1>
            <p className="text-sm text-[rgba(238,241,250,0.55)] mt-1">
              Plan and publish posts across all your channels.
            </p>
          </div>
          <SocialSyncEmbed
            clientId={connection.id}
            clientName={connection.business_name || connection.client_label}
          />
        </div>
      )}
    </PortalLayout>
  );
}
