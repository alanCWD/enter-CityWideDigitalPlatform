import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Instagram, Linkedin, Twitter, Facebook, Youtube, CheckCircle2 } from "lucide-react";

const PLATFORMS = [
  { id: "google_business", name: "Google Business", icon: Globe },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin },
  { id: "twitter", name: "X (Twitter)", icon: Twitter },
  { id: "facebook", name: "Facebook", icon: Facebook },
  { id: "youtube", name: "YouTube", icon: Youtube },
];

export default function SocialProfiles() {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConnections() {
      try {
        const { data, error } = await supabase
          .from("social_accounts")
          .select("platform")
          .eq("client_id", "citywide")
          .eq("status", "connected");

        if (error) throw error;
        setConnectedPlatforms(data.map(d => d.platform));
      } catch (e) {
        console.error("Failed to fetch connections:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchConnections();
  }, []);

  async function handleConnect(platform: string) {
    setConnecting(platform);
    try {
      // Use 'citywide' as the client_id for agency-level connections
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "social.connect", payload: { platform, client_id: "citywide" } },
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error("No data returned from edge function");
      
      if (data.error) {
        // Handle specific Zernio 402 Payment Required error
        if (data.error.includes("402") || data.error.includes("PAYMENT_REQUIRED")) {
          throw new Error("Account limit reached. Please add a payment method in Zernio to connect more accounts.");
        }
        throw new Error(data.error);
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Success", description: data.message });
      }
    } catch (e) {
      console.error("Connection error:", e);
      toast({ title: "Connection Failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setConnecting(null);
    }
  }

  return (
    <DashboardLayout>
      <TopBar title="Social Profiles" subtitle="Connect and manage your social media accounts." />
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLATFORMS.map((p) => {
          const isConnected = connectedPlatforms.includes(p.id);
          return (
            <Card key={p.id} className={isConnected ? "border-green-500/50 bg-green-500/5" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {p.name}
                  {isConnected && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </CardTitle>
                <p.icon className={`h-4 w-4 ${isConnected ? "text-green-500" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                {isConnected ? (
                  <div className="text-sm font-medium text-green-500 flex items-center justify-center h-10 bg-green-500/10 rounded-md">
                    Connected
                  </div>
                ) : (
                  <Button 
                    className="w-full" 
                    onClick={() => handleConnect(p.id)}
                    disabled={connecting === p.id || loading}
                  >
                    {connecting === p.id ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
