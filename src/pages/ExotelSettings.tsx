import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNotification } from "@/hooks/useNotification";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, Check, MessageCircle, Send } from "lucide-react";
import { useOrgContext } from "@/hooks/useOrgContext";

export default function ExotelSettings() {
  const notify = useNotification();
  const { orgId } = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({
    api_key: "",
    api_token: "",
    account_sid: "",
    subdomain: "api.exotel.com",
    caller_id: "",
    call_recording_enabled: true,
    is_active: true,
    sms_sender_id: "",
    dlt_entity_id: "",
  });
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/exotel-webhook`;
  const smsWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/sms-webhook`;

  useEffect(() => {
    if (orgId) {
      fetchSettings();
    }
  }, [orgId]);

  const fetchSettings = async () => {
    try {
      const { data, error} = await supabase
        .from('exotel_settings')
        .select('*')
        .eq('org_id', orgId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          api_key: data.api_key || "",
          api_token: data.api_token || "",
          account_sid: data.account_sid || "",
          subdomain: data.subdomain || "api.exotel.com",
          caller_id: data.caller_id || "",
          call_recording_enabled: data.call_recording_enabled ?? true,
          is_active: data.is_active ?? true,
          sms_sender_id: data.sms_sender_id || "",
          dlt_entity_id: data.dlt_entity_id || "",
        });
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.api_key || !settings.api_token || !settings.account_sid || !settings.caller_id) {
      notify.error("Missing fields", "Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('exotel_settings')
        .upsert({
          org_id: orgId,
          ...settings,
        });

      if (error) throw error;

      notify.success("Settings saved", "Exotel configuration has been updated");
    } catch (error: any) {
      console.error('Error saving settings:', error);
      notify.error("Error", error);
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    notify.success("Copied!", "Webhook URL copied to clipboard");
  };

  const handleSendTestSms = async () => {
    if (!testPhone) {
      notify.error("Missing phone", "Please enter a phone number");
      return;
    }
    if (!settings.sms_sender_id) {
      notify.error("Missing Sender ID", "Please configure SMS Sender ID first");
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          orgId: orgId,
          phoneNumber: testPhone,
          messageContent: 'This is a test SMS from your loan management system.',
          triggerType: 'manual',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      notify.success("SMS Sent", "Test SMS sent successfully");
      setTestPhone("");
    } catch (error: any) {
      console.error('Test SMS error:', error);
      notify.error("Failed to send", error.message || "Could not send test SMS");
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Exotel Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure Exotel integration for calling functionality
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Credentials</CardTitle>
            <CardDescription>
              Enter your Exotel API credentials. You can find these in your Exotel dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key *</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={settings.api_key}
                  onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                  placeholder="Enter your Exotel API key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_token">API Token *</Label>
                <Input
                  id="api_token"
                  type="password"
                  value={settings.api_token}
                  onChange={(e) => setSettings({ ...settings, api_token: e.target.value })}
                  placeholder="Enter your Exotel API token"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_sid">Account SID *</Label>
                <Input
                  id="account_sid"
                  value={settings.account_sid}
                  onChange={(e) => setSettings({ ...settings, account_sid: e.target.value })}
                  placeholder="Enter your Exotel Account SID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input
                  id="subdomain"
                  value={settings.subdomain}
                  onChange={(e) => setSettings({ ...settings, subdomain: e.target.value })}
                  placeholder="api.exotel.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caller_id">Caller ID *</Label>
                <Input
                  id="caller_id"
                  value={settings.caller_id}
                  onChange={(e) => setSettings({ ...settings, caller_id: e.target.value })}
                  placeholder="Enter verified Exotel number"
                />
                <p className="text-xs text-muted-foreground">
                  This number will be displayed when making calls
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-1">
                <Label htmlFor="recording">Call Recording</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically record all calls
                </p>
              </div>
              <Switch
                id="recording"
                checked={settings.call_recording_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, call_recording_enabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-1">
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable Exotel integration
                </p>
              </div>
              <Switch
                id="active"
                checked={settings.is_active}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, is_active: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              SMS Configuration (DLT Compliance)
            </CardTitle>
            <CardDescription>
              Configure SMS settings for DLT compliance. These are required for sending SMS in India.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sms_sender_id">SMS Sender ID (Header) *</Label>
                <Input
                  id="sms_sender_id"
                  value={settings.sms_sender_id}
                  onChange={(e) => setSettings({ ...settings, sms_sender_id: e.target.value })}
                  placeholder="e.g., PAISAA"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  6-character sender ID approved on DLT portal
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dlt_entity_id">DLT Entity ID *</Label>
                <Input
                  id="dlt_entity_id"
                  value={settings.dlt_entity_id}
                  onChange={(e) => setSettings({ ...settings, dlt_entity_id: e.target.value })}
                  placeholder="Enter your Principal Entity ID"
                />
                <p className="text-xs text-muted-foreground">
                  Your business Entity ID from TRAI DLT portal
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="mb-2 block">Test SMS</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter phone number (e.g., 9876543210)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="max-w-xs"
                />
                <Button onClick={handleSendTestSms} disabled={sendingTest || !testPhone}>
                  {sendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Send a test SMS to verify your configuration
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/50">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">SMS Delivery Webhook URL</p>
              <div className="flex gap-2 items-center">
                <code className="bg-background px-2 py-1 rounded text-xs">{smsWebhookUrl}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(smsWebhookUrl);
                    notify.success("Copied!", "SMS webhook URL copied");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              This webhook URL is automatically included in all Exotel API calls (no configuration needed in Exotel portal)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyWebhookUrl}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              This webhook receives call status updates from Exotel
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
