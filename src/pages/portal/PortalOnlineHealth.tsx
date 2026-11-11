import { PortalLayout } from "@/components/portal/PortalLayout";
import { OnlineHealthEmbed } from "@/components/online-health/OnlineHealthEmbed";

/**
 * Client-facing entry point for Business Online Health.
 *
 * The module is a separate app; this page only frames it for the signed-in
 * client's own connection. The portal sidebar stays visible, so the client has
 * its usual way back, and the module's embed mode supplies the slim bar.
 */
export default function PortalOnlineHealth() {
  return (
    <PortalLayout wide>
      {(connection) => (
        <OnlineHealthEmbed
          connectionId={connection.id}
          clientName={connection.business_name || connection.client_label}
        />
      )}
    </PortalLayout>
  );
}
