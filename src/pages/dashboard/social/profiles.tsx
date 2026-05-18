import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Instagram, Linkedin, Twitter, Facebook, Youtube } from "lucide-react";

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

  async function handleConnect(platform: string) {
    setConnecting(platform);
    try {
      // Use 'citywide' as the client_id for agency-level connections
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "social.connect", payload: { platform, client_id: "citywide" } },
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error("No data returned from edge function");
      if (data.error) throw new Error(data.error);

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Success", description: data.message });
      }
    } catch (e) {
      console.error("Connection error:", e);
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setConnecting(null);
    }
  }

  return (
    <DashboardLayout>
      <TopBar title="Social Profiles" subtitle="Connect and manage your social media accounts." />
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLATFORMS.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{p.name}</CardTitle>
              <p.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => handleConnect(p.id)}
                disabled={connecting === p.id}
              >
                {connecting === p.id ? "Connecting..." : "Connect"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
