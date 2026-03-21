import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNotification } from "@/hooks/useNotification";
import { LoadingState } from "@/components/common/LoadingState";
import { Loader2, CheckCircle2, AlertCircle, Copy, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/Layout/DashboardLayout";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  ttl?: string;
  priority?: number;
  record?: string;
}

interface EmailSettings {
  id: string;
  org_id: string;
  sending_domain: string;
  resend_domain_id: string;
  verification_status: string;
  dns_records: DnsRecord[];
  verified_at: string;
  is_active: boolean;
  inbound_routing_enabled: boolean;
  inbound_webhook_url: string;
}

const EmailSettings = () => {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-resend-domain', {
        body: { action: 'get-domain' },
      });

      if (error) throw error;
      return data as EmailSettings;
    },
  });

  useEffect(() => {
    if (settings) {
      setDomain(settings.sending_domain);
      setIsActive(settings.is_active);
    }
  }, [settings]);

  const createDomainMutation = useMutation({
    mutationFn: async (domainName: string) => {
      const { data, error } = await supabase.functions.invoke('manage-resend-domain', {
        body: { action: 'create-domain', domain: domainName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      notify.success("Domain added", "Your domain has been added to Resend. Please add the DNS records below.");
    },
    onError: (error: Error) => {
      notify.error("Error", error);
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-resend-domain', {
        body: { action: 'verify-domain' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      if (data.status === 'verified') {
        notify.success("Domain verified!", "Your domain is now verified and ready to send emails.");
      } else {
        notify.error("Verification pending", "DNS records not yet propagated. Please wait a few minutes and try again.");
      }
      setIsVerifying(false);
    },
    onError: (error: Error) => {
      notify.error("Verification failed", error);
      setIsVerifying(false);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('email_settings')
        .update({ is_active: isActive })
        .eq('org_id', settings?.org_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      notify.success("Settings updated", "Email settings have been saved successfully.");
    },
    onError: (error: Error) => {
      notify.error("Error", error);
    },
  });

  const handleAddDomain = () => {
    if (!domain) {
      notify.error("Error", "Please enter a domain name");
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}\.)?[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      notify.error("Invalid domain", "Please enter a valid domain name (e.g., mail.yourcompany.com)");
      return;
    }

    createDomainMutation.mutate(domain);
  };

  const handleVerifyDomain = () => {
    setIsVerifying(true);
    verifyDomainMutation.mutate();
  };

  const handleRefreshStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['email-settings'] });
    notify.success("Refreshed", "Domain status has been refreshed.");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success("Copied!", "DNS record value copied to clipboard.");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading email settings..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Email Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your email sending domain for transactional emails
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Domain Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Domain Configuration</CardTitle>
              <CardDescription>
                Add and verify your sending domain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Sending Domain</Label>
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    placeholder="mail.yourcompany.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={!!settings?.resend_domain_id}
                  />
                  {!settings?.resend_domain_id && (
                    <Button
                      onClick={handleAddDomain}
                      disabled={createDomainMutation.isPending}
                    >
                      {createDomainMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Add Domain"
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {settings && (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(settings.verification_status)}
                      <div>
                        <p className="font-medium">Verification Status</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {settings.verification_status}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshStatus}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Email Sending</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow emails to be sent from this domain
                      </p>
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => updateSettingsMutation.mutate()}
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Save Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* DNS Records */}
          {settings?.dns_records && (
            <Card>
              <CardHeader>
                <CardTitle>DNS Records</CardTitle>
                <CardDescription>
                  Add these records to your DNS provider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.isArray(settings.dns_records) ? (
                  settings.dns_records.map((record: DnsRecord, index: number) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{record.record || record.type}</span>
                        {record.status && getStatusIcon(record.status)}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type: </span>
                          <span className="font-mono">{record.type}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Name: </span>
                          <span className="font-mono">{record.name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Value: </span>
                          <div className="flex items-start gap-2 mt-1">
                            <code className="flex-1 bg-muted p-2 rounded text-xs break-all">
                              {record.value}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(record.value)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {record.priority && (
                          <div>
                            <span className="text-muted-foreground">Priority: </span>
                            <span className="font-mono">{record.priority}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <Alert>
                    <AlertDescription>
                      No DNS records available. Try refreshing the domain status.
                    </AlertDescription>
                  </Alert>
                )}

                {settings.verification_status !== 'verified' && (
                  <Button
                    className="w-full"
                    onClick={handleVerifyDomain}
                    disabled={isVerifying || verifyDomainMutation.isPending}
                  >
                    {isVerifying || verifyDomainMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Verify DNS Records
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Inbound Email Routing Status */}
          {settings?.verification_status === 'verified' && (
            <Card>
              <CardHeader>
                <CardTitle>Inbound Email Routing</CardTitle>
                <CardDescription>
                  Receive email replies directly in Customer Journey
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {settings.inbound_routing_enabled ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">Routing Status</p>
                      <p className="text-sm text-muted-foreground">
                        {settings.inbound_routing_enabled ? 'Active' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                </div>

                {settings.inbound_webhook_url && (
                  <div className="space-y-2">
                    <Label>Webhook Endpoint</Label>
                    <code className="block bg-muted p-2 rounded text-xs break-all">
                      {settings.inbound_webhook_url}
                    </code>
                  </div>
                )}

                {settings.inbound_routing_enabled ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Inbound routing is active. Email replies will automatically appear in Customer Journey timeline.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertDescription className="space-y-3">
                      <p className="font-semibold">Manual Configuration Required:</p>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Go to <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Resend Domains</a></li>
                        <li>Select your verified domain</li>
                        <li>Navigate to the "Inbound" tab</li>
                        <li>Add the MX record to your DNS</li>
                        <li>Configure the webhook URL below:</li>
                      </ol>
                      <div className="mt-2 p-2 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs flex-1 break-all">
                            {`${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/email-inbound-webhook`}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/email-inbound-webhook`);
                              notify.success("Copied to clipboard");
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Step 1: Add Your Domain</h4>
              <p className="text-sm text-muted-foreground">
                Enter your sending domain (e.g., mail.yourcompany.com) and click "Add Domain".
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Step 2: Add DNS Records</h4>
              <p className="text-sm text-muted-foreground">
                Copy the DNS records shown above and add them to your domain's DNS settings through your domain provider (e.g., Cloudflare, GoDaddy, Namecheap).
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Step 3: Verify Domain</h4>
              <p className="text-sm text-muted-foreground">
                After adding the DNS records, wait 5-60 minutes for DNS propagation, then click "Verify DNS Records". Once verified, you can start sending emails!
              </p>
            </div>
            <Alert>
              <AlertDescription>
                <strong>Note:</strong> DNS propagation can take anywhere from a few minutes to 48 hours depending on your DNS provider. If verification fails, please wait and try again later.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EmailSettings;
