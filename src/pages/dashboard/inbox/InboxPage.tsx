import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ConversationList } from "@/components/inbox/ConversationList";
import { MessageThread } from "@/components/inbox/MessageThread";
import { ProGate } from "@/components/inbox/ProGate";
import { BroadcastsPanel } from "@/components/inbox/BroadcastsPanel";
import { SequencesPanel } from "@/components/inbox/SequencesPanel";
import { AutomationsPanel } from "@/components/inbox/AutomationsPanel";
import { useZernioProfile } from "@/hooks/useZernioProfile";
import { useAgency } from "@/contexts/AgencyContext";
import { Crown } from "lucide-react";

function ProTabLabel({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <span className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
        <Crown className="w-2.5 h-2.5" />
        Pro
      </span>
    </span>
  );
}

export default function InboxPage() {
  const { agency } = useAgency();
  const { profileId } = useZernioProfile(agency.slug);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <TopBar
        title="Inbox"
        subtitle="All your DMs in one place — WhatsApp, Instagram, Messenger, Telegram, X, Reddit & Bluesky."
      />

      <div className="flex flex-col" style={{ height: "calc(100dvh - 89px)" }}>
        <Tabs defaultValue="conversations" className="flex flex-col h-full">
          {/* Tab bar */}
          <div className="border-b border-border px-4 flex-shrink-0">
            <TabsList className="h-10 bg-transparent gap-0 -mb-px p-0 rounded-none">
              <TabsTrigger
                value="conversations"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm px-4"
              >
                Conversations
              </TabsTrigger>
              <TabsTrigger
                value="broadcasts"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm px-4"
              >
                <ProTabLabel label="Broadcasts" />
              </TabsTrigger>
              <TabsTrigger
                value="sequences"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm px-4"
              >
                <ProTabLabel label="Sequences" />
              </TabsTrigger>
              <TabsTrigger
                value="automations"
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm px-4"
              >
                <ProTabLabel label="Automations" />
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Conversations */}
          <TabsContent value="conversations" className="flex-1 mt-0 min-h-0 overflow-hidden">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={32} minSize={22} maxSize={44}>
                <ConversationList
                  profileId={profileId}
                  selectedId={selectedConvId}
                  onSelect={setSelectedConvId}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={68}>
                <MessageThread conversationId={selectedConvId} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </TabsContent>

          {/* Pro: Broadcasts */}
          <TabsContent value="broadcasts" className="flex-1 mt-0 overflow-auto">
            <ProGate
              feature="Broadcasts"
              description="Send one-to-many DM blasts to segmented contact lists across WhatsApp, Instagram, and more."
            >
              <BroadcastsPanel />
            </ProGate>
          </TabsContent>

          {/* Pro: Sequences */}
          <TabsContent value="sequences" className="flex-1 mt-0 overflow-auto">
            <ProGate
              feature="Sequences"
              description="Enroll contacts into drip DM campaigns with timed follow-ups across any connected platform."
            >
              <SequencesPanel />
            </ProGate>
          </TabsContent>

          {/* Pro: Automations */}
          <TabsContent value="automations" className="flex-1 mt-0 overflow-auto">
            <ProGate
              feature="Automations"
              description="Automatically send a DM when someone comments on your posts — trigger on any keyword or hashtag."
            >
              <AutomationsPanel />
            </ProGate>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
