import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ORGANIZATION_ID } from "@/config/organization";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotification } from "@/hooks/useNotification";
import { LoadingState } from "@/components/common/LoadingState";
import { Loader2, MessageSquare, CheckCircle2 } from "lucide-react";

interface WhatsAppSettings {
  id?: string;
  exotel_sid: string;
  exotel_api_key: string;
  exotel_api_token: string;
  exotel_subdomain: string;
  whatsapp_source_number: string;
  waba_id: string;
  is_active: boolean;
}

const WhatsAppSettings = () => {
  const notify = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WhatsAppSettings>({
    exotel_sid: "",
    exotel_api_key: "",
    exotel_api_token: "",
    exotel_subdomain: "api.exotel.com",
    whatsapp_source_number: "",
    waba_id: "",
    is_active: true,
  });
  const [templateCount, setTemplateCount] = useState(0);

  useEffect(() => {
    fetchSettings();
    fetchTemplateCount();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .eq("org_id", ORGANIZATION_ID)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          exotel_sid: data.exotel_sid || "",
          exotel_api_key: data.exotel_api_key || "",
          exotel_api_token: data.exotel_api_token || "",
          exotel_subdomain: data.exotel_subdomain || "api.exotel.com",
          whatsapp_source_number: data.whatsapp_source_number || "",
          waba_id: data.waba_id || "",
          is_active: data.is_active,
        });
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      notify.error("Error", "Failed to load WhatsApp settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateCount = async () => {
    try {
      const { count } = await supabase
        .from("communication_templates")
        .select("*", { count: "exact", head: true })
        .eq("org_id", ORGANIZATION_ID)
        .eq("template_type", "whatsapp");

      setTemplateCount(count || 0);
    } catch (error) {
      console.error("Error fetching template count:", error);
    }
  };

  const handleSave = async () => {
    console.log("🔴 [1] handleSave CALLED at:", Date.now());
    
    if (!settings.exotel_sid || !settings.exotel_api_key || !settings.exotel_api_token || !settings.whatsapp_source_number) {
      console.log("🔴 [2] VALIDATION FAILED");
      notify.error("Validation Error", "Please fill in all required fields");
      return;
    }

    console.log("🔴 [3] VALIDATION PASSED, calling setSaving(true)");
    setSaving(true);
    
    try {
      console.log("🔴 [4] ABOUT TO CALL supabase.upsert with org_id:", ORGANIZATION_ID);
      
      const { error } = await supabase
        .from("whatsapp_settings")
        .upsert({
          org_id: ORGANIZATION_ID,
          exotel_sid: settings.exotel_sid,
          exotel_api_key: settings.exotel_api_key,
          exotel_api_token: settings.exotel_api_token,
          exotel_subdomain: settings.exotel_subdomain,
          whatsapp_source_number: settings.whatsapp_source_number,
          waba_id: settings.waba_id,
          is_active: settings.is_active,
        }, { onConflict: 'org_id' });

      console.log("🔴 [5] SUPABASE RETURNED, error:", error);

      if (error) throw error;

      console.log("🔴 [6] SUCCESS - showing notification");
      notify.success("Success", "WhatsApp settings saved successfully");
      fetchSettings();
    } catch (error: any) {
      console.error("🔴 [CATCH] Error:", error);
      notify.error("Error", error.message || "Failed to save settings");
    } finally {
      console.log("🔴 [FINALLY] Setting saving to false");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading WhatsApp settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Configure your Exotel WhatsApp Business API credentials and webhook
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Exotel API Credentials
              </CardTitle>
              <CardDescription>
                Enter your Exotel API credentials to enable WhatsApp messaging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exotel-sid">Exotel SID *</Label>
                <Input
                  id="exotel-sid"
                  type="text"
                  placeholder="Enter your Exotel SID"
                  value={settings.exotel_sid}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_sid: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Exotel API Key *</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Exotel API key"
                  value={settings.exotel_api_key}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_api_key: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-token">Exotel API Token *</Label>
                <Input
                  id="api-token"
                  type="password"
                  placeholder="Enter your Exotel API token"
                  value={settings.exotel_api_token}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_api_token: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Exotel Subdomain</Label>
                <Input
                  id="subdomain"
                  type="text"
                  placeholder="api.exotel.com"
                  value={settings.exotel_subdomain}
                  onChange={(e) =>
                    setSettings({ ...settings, exotel_subdomain: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Default: api.exotel.com (change if using a different region)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source-number">WhatsApp Source Number *</Label>
                <Input
                  id="source-number"
                  type="text"
                  placeholder="+917738919680"
                  value={settings.whatsapp_source_number}
                  onChange={(e) =>
                    setSettings({ ...settings, whatsapp_source_number: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Enter the phone number with + and country code
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="waba-id">WhatsApp Business Account ID (WABA ID) *</Label>
                <Input
                  id="waba-id"
                  type="text"
                  placeholder="Enter your WABA ID"
                  value={settings.waba_id}
                  onChange={(e) =>
                    setSettings({ ...settings, waba_id: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Required for submitting templates to WhatsApp for approval. Find this in your Meta Business Manager.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/whatsapp-webhook`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/whatsapp-webhook`);
                      notify.success("Copied!", "Webhook URL copied to clipboard");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure this URL in your Exotel dashboard to receive message status updates
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is-active">Enable WhatsApp</Label>
                <Switch
                  id="is-active"
                  checked={settings.is_active}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, is_active: checked })
                  }
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Templates
              </CardTitle>
              <CardDescription>
                Manage your WhatsApp message templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Local Templates
                </div>
                <div className="text-3xl font-bold">{templateCount}</div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => navigate("/templates")}
                  variant="secondary"
                  className="w-full"
                >
                  View All Templates
                </Button>

                <Button
                  onClick={() => navigate("/templates/create")}
                  variant="outline"
                  className="w-full"
                >
                  Create New Template
                </Button>
              </div>

              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-semibold text-sm">Quick Guide:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create templates in the Templates section</li>
                  <li>Use variables like {"{{1}}"}, {"{{2}}"} for personalization</li>
                  <li>Send messages to contacts via WhatsApp</li>
                  <li>Track delivery status in message history</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppSettings;
