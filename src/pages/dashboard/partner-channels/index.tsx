// /channels — the connect and reconnect surface for the OneProfile publishing
// engine.
//
// This is also the deep-link target of the engine's revocation notices
// (`<console_url>/channels`), so it must work as a cold landing page: pick the
// company, see which platform was revoked, reconnect it.
//
// The connect contract has no cross-origin handshake: the provider returns the
// browser to OneProfile's callback, never to this origin, so there is no
// postMessage to listen for. Polling `list_channels` is the only completion
// signal — and a user who simply closed the window connected nothing, which is
// what the two-minute timeout is for.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Building2, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PartnerSocialError,
  disconnectChannel,
  isPartnerSocialError,
  listBusinesses,
  listChannels,
  platformLabel,
  startConnect,
  type ChannelSnapshot,
  type PartnerBusiness,
  type PartnerChannel,
} from "@/lib/partner-social";
import { ChannelCard, type ChannelState } from "./ChannelCard";

const CONNECT_POLL_INTERVAL_MS = 3_000;
const CONNECT_POLL_TIMEOUT_MS = 120_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function asPartnerError(e: unknown): PartnerSocialError {
  if (isPartnerSocialError(e)) return e;
  return new PartnerSocialError("network_error", (e as Error)?.message || "Something went wrong.");
}

function describeError(e: PartnerSocialError): { title: string; body: string } {
  switch (e.code) {
    case "engine_unreachable":
      return {
        title: "Publishing engine not reachable",
        body: "Either this project sits on its own backend instead of the shared OneProfile one, or the engine is not deployed there yet. Wiring the project to the instance OneProfile already runs on is a Connections step in project settings. Reconnect links from a revocation notice land here too, and start working the moment this is wired.",
      };
    case "unauthorized":
      return {
        title: "The engine refused this session",
        body: "The engine executed and answered, so the wiring is right — it rejected the session. Sign in again; the project must share the engine's auth.",
      };
    case "forbidden":
      return {
        title: "No publishing access for your account",
        body: "Publishing access comes from an agency membership. Ask an agency admin to add you, then try again.",
      };
    case "partner_not_approved":
      return {
        title: "Agency not approved for publishing",
        body: "The partner registration behind this agency is not approved and active, so every publishing call is refused.",
      };
    case "not_found":
      return {
        title: "That company is not in your agency",
        body: "A company belonging to another agency answers exactly like one that does not exist — archived companies answer the same way.",
      };
    case "platform_not_available_yet":
      return {
        title: "That platform is not available yet",
        body: "The engine accepts the call but cannot publish to this platform on the business path yet.",
      };
    case "connect_failed":
      return {
        title: "The provider refused the connection",
        body: e.message,
      };
    default:
      return { title: "Could not load client companies", body: e.message };
  }
}

interface CardModel {
  platform: string;
  channel: PartnerChannel | null;
  state: ChannelState;
}

/** Connected channels first, then platforms that can still be connected. */
function buildCards(snapshot: ChannelSnapshot): CardModel[] {
  const cards: CardModel[] = [];
  for (const channel of snapshot.channels) {
    if (!channel.is_active) continue;
    cards.push({
      platform: channel.platform,
      channel,
      state: channel.needs_reconnect ? "needs-reconnect" : "connected",
    });
  }

  const taken = new Set(cards.map((card) => card.platform));
  for (const platform of [...snapshot.available_platforms, ...snapshot.upcoming_platforms]) {
    if (taken.has(platform)) continue;
    taken.add(platform);
    cards.push({
      platform,
      channel: null,
      state: snapshot.available_platforms.includes(platform) ? "available" : "upcoming",
    });
  }
  return cards;
}

function EmptyBook() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <Building2 className="mb-3 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">No client companies yet</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">
        The engine authorises publishing from the client book, and nothing has been pushed for
        your agency. An agency admin syncs the complete book once, and the companies appear here.
      </p>
    </div>
  );
}

export default function PartnerChannels() {
  const { toast } = useToast();
  const searchParams = useSearchParams()[0];
  // A company may be deep-linked, but nothing in the URL ever identifies a client.
  // The dashboard's own client id (`external_ref`) is what every call names.
  const deepLinkedRef = useRef(searchParams.get("business_ref"));

  const [businesses, setBusinesses] = useState<PartnerBusiness[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ChannelSnapshot | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [error, setError] = useState<PartnerSocialError | null>(null);
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);
  const [waitingPlatform, setWaitingPlatform] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const attemptRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1; // strands any in-flight poll
    };
  }, []);

  const loadBook = useCallback(async (prefer?: string | null) => {
    setLoadingBook(true);
    try {
      const list = await listBusinesses();
      if (!mountedRef.current) return;
      setBusinesses(list);
      setError(null);
      setSelectedRef((current) => {
        const wanted = prefer ?? current;
        if (wanted && list.some((b) => b.external_ref === wanted)) return wanted;
        return list[0]?.external_ref ?? null;
      });
    } catch (e) {
      if (!mountedRef.current) return;
      setBusinesses([]);
      setSelectedRef(null);
      setError(asPartnerError(e));
    } finally {
      if (mountedRef.current) setLoadingBook(false);
    }
  }, []);

  useEffect(() => {
    loadBook(deepLinkedRef.current);
  }, [loadBook]);

  const loadChannels = useCallback(async (businessRef: string) => {
    setLoadingChannels(true);
    try {
      const next = await listChannels(businessRef);
      if (!mountedRef.current) return;
      setSnapshot(next);
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(asPartnerError(e));
    } finally {
      if (mountedRef.current) setLoadingChannels(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedRef) {
      setSnapshot(null);
      return;
    }
    setSnapshot(null);
    loadChannels(selectedRef);
  }, [selectedRef, loadChannels]);

  /** Poll until the platform shows up active. That is the only signal we get. */
  const waitForChannel = useCallback(async (businessRef: string, platform: string) => {
    const attempt = ++attemptRef.current;
    const stillMine = () => mountedRef.current && attemptRef.current === attempt;
    const deadline = Date.now() + CONNECT_POLL_TIMEOUT_MS;

    setWaitingPlatform(platform);
    let landed = false;

    while (stillMine() && Date.now() < deadline) {
      await sleep(CONNECT_POLL_INTERVAL_MS);
      if (!stillMine()) return;
      try {
        const next = await listChannels(businessRef);
        if (!stillMine()) return;
        if (next.channels.some((c) => c.platform === platform && c.is_active)) {
          setSnapshot(next);
          landed = true;
          break;
        }
      } catch {
        /* a transient miss is not a failure — keep polling */
      }
    }

    if (!stillMine()) return;
    setWaitingPlatform(null);

    if (landed) {
      toast({
        title: `${platformLabel(platform)} connected`,
        description: "Publishing for this company now uses the account you authorised.",
      });
      loadBook(businessRef);
    } else {
      toast({
        title: "Nothing connected",
        description:
          "No channel appeared within two minutes. If you closed the authorisation window, nothing changed — try again.",
      });
    }
  }, [loadBook, toast]);

  async function connect(platform: string) {
    if (!selectedRef) return;
    setBusyPlatform(platform);
    try {
      const authUrl = await startConnect(selectedRef, platform);
      setBusyPlatform(null);
      const popup = window.open(authUrl, "partner-connect", "width=600,height=760");
      if (!popup) {
        // Popup blocked — finish the round trip as a full redirect instead.
        window.location.href = authUrl;
        return;
      }
      await waitForChannel(selectedRef, platform);
    } catch (e) {
      setBusyPlatform(null);
      const err = asPartnerError(e);
      toast({ title: "Could not start the connection", description: err.message, variant: "destructive" });
    }
  }

  async function disconnect(platform: string) {
    if (!selectedRef) return;
    const what = platform === "facebook" || platform === "instagram"
      ? "Facebook and Instagram (one Meta grant backs both)"
      : platformLabel(platform);
    if (!window.confirm(`Disconnect ${what} for this company?`)) return;

    setBusyPlatform(platform);
    try {
      const disconnected = await disconnectChannel(selectedRef, platform);
      const named = disconnected.length
        ? disconnected.map(platformLabel).join(", ")
        : platformLabel(platform);
      toast({ title: "Disconnected", description: `Removed: ${named}.` });
      await loadChannels(selectedRef);
      loadBook(selectedRef);
    } catch (e) {
      toast({ title: "Disconnect failed", description: asPartnerError(e).message, variant: "destructive" });
    } finally {
      setBusyPlatform(null);
    }
  }

  function cancelWait() {
    attemptRef.current += 1;
    setWaitingPlatform(null);
  }

  const selected = useMemo(
    () => businesses.find((b) => b.external_ref === selectedRef) ?? null,
    [businesses, selectedRef],
  );
  const cards = snapshot ? buildCards(snapshot) : [];
  const connectable = cards.filter((c) => c.state !== "upcoming").length;
  const connectedCount = cards.filter((c) => c.state === "connected").length;
  const failure = error ? describeError(error) : null;
  const engineMissing = error?.code === "engine_unreachable";

  return (
    <DashboardLayout>
      <TopBar
        title="Client Channels"
        subtitle="Connect and reconnect the channels your client companies publish through"
      />

      <div className="space-y-6 p-6">
        {error && failure && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              {engineMissing
                ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{failure.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{failure.body}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">{error.detail}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    loadBook(selectedRef);
                    if (selectedRef) loadChannels(selectedRef);
                  }}
                >
                  <RefreshCw />
                  Try again
                </Button>
              </div>
            </div>
          </div>
        )}

        {loadingBook ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading client companies…
          </div>
        ) : businesses.length === 0 ? (
          !error && <EmptyBook />
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Client companies
              </p>
              <div className="flex flex-wrap gap-2">
                {businesses.map((business) => {
                  const isSelected = business.external_ref === selectedRef;
                  return (
                    <button
                      key={business.external_ref}
                      onClick={() => setSelectedRef(business.external_ref)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{business.name || business.external_ref}</span>
                      {(business.needs_reconnect_platforms ?? []).length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/50 px-2 py-0.5 text-[10px] font-semibold text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          {(business.needs_reconnect_platforms ?? []).map(platformLabel).join(", ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selected && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {selected.name || selected.external_ref}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {connectedCount} of {connectable} available platform
                      {connectable === 1 ? "" : "s"} connected
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={loadingChannels}
                    onClick={() => loadChannels(selected.external_ref)}
                  >
                    <RefreshCw className={cn(loadingChannels && "animate-spin")} />
                    Refresh
                  </Button>
                </div>

                {loadingChannels && !snapshot ? (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading channels…
                  </div>
                ) : cards.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No platforms are available for this company yet.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {cards.map((card) => (
                      <ChannelCard
                        key={card.platform}
                        platform={card.platform}
                        channel={card.channel}
                        state={card.state}
                        busy={busyPlatform === card.platform}
                        waiting={waitingPlatform === card.platform}
                        locked={Boolean(waitingPlatform) && waitingPlatform !== card.platform}
                        onConnect={() => connect(card.platform)}
                        onDisconnect={() => disconnect(card.platform)}
                        onCancelWait={cancelWait}
                      />
                    ))}
                  </div>
                )}

                <p className="mt-4 text-[11px] text-muted-foreground">
                  A client company is never public: no profile, no username, no public page, and a
                  published post carries no authorship line. Disconnecting a channel is not a
                  revocation — it sends no notice and raises no reconnect flag.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
