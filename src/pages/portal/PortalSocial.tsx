import { useState } from "react";
import { Edit3, ListOrdered, Link2 } from "lucide-react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PostComposer } from "@/components/portal/PostComposer";
import { QueueManager } from "@/components/portal/QueueManager";
import { ConnectedAccounts } from "@/components/portal/ConnectedAccounts";

type Tab = "compose" | "queue" | "accounts";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "compose",  label: "Compose",   icon: Edit3 },
  { id: "queue",    label: "Queue",     icon: ListOrdered },
  { id: "accounts", label: "Accounts",  icon: Link2 },
];

export default function PortalSocial() {
  const [activeTab, setActiveTab] = useState<Tab>("compose");
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  const handlePostCreated = () => {
    setQueueRefreshKey((k) => k + 1);
    setActiveTab("queue");
  };

  return (
    <PortalLayout>
      {(connection) => (
        <div className="space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-foreground">Social Sync Pro</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compose, schedule, and track posts across all your channels — GBP first.
            </p>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit border border-border">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-primary text-white shadow-[0_2px_8px_rgba(0,120,215,0.4)]"
                      : "text-muted-foreground hover:text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {activeTab === "compose" && (
            <PostComposer
              clientId={connection.id}
              onPostCreated={handlePostCreated}
            />
          )}
          {activeTab === "queue" && (
            <QueueManager
              clientId={connection.id}
              refreshKey={queueRefreshKey}
            />
          )}
          {activeTab === "accounts" && (
            <ConnectedAccounts clientId={connection.id} />
          )}
        </div>
      )}
    </PortalLayout>
  );
}
