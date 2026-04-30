import { PortalLayout } from "@/components/portal/PortalLayout";
import { CoachEmbed } from "@/components/portal/CoachEmbed";

export default function PortalCoach() {
  return (
    <PortalLayout>
      {(connection) => (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-[#EEF1FA]">GSO Coach</h1>
            <p className="text-sm text-[rgba(238,241,250,0.55)] mt-1">
              AI-powered guidance for your Google search optimisation.
            </p>
          </div>
          <CoachEmbed
            clientId={connection.id}
            clientName={connection.business_name || connection.client_label}
          />
        </div>
      )}
    </PortalLayout>
  );
}
