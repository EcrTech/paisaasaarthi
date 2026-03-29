import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Building2, 
  Settings, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  RefreshCw,
  Search,
  Copy
} from "lucide-react";
import MandateStatusBadge from "@/components/LOS/Mandate/MandateStatusBadge";

interface NupayConfig {
  id: string;
  org_id: string;
  environment: "uat" | "production";
  api_key: string;
  api_endpoint: string;
  esign_api_key: string | null;
  webhook_url: string | null;
  redirect_url: string | null;
  is_active: boolean;
  access_key: string | null;
  access_secret: string | null;
  collection_api_endpoint: string | null;
  provider_id: string | null;
  collection_enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

interface NupayMandate {
  id: string;
  loan_no: string;
  status: string;
  collection_amount: number;
  account_holder_name: string;
  bank_name: string | null;
  umrn: string | null;
  rejection_reason_code: string | null;
  rejection_reason_desc: string | null;
  rejected_by: string | null;
  created_at: string;
}

const NupaySettings = () => {
  const { orgId } = useOrgContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("configuration");
  const [bankSearchQuery, setBankSearchQuery] = useState("");

  // eMandate Form states
  const [uatApiKey, setUatApiKey] = useState("");
  const [uatEndpoint, setUatEndpoint] = useState("https://nachuat.nupaybiz.com");
  const [uatEsignEndpoint, setUatEsignEndpoint] = useState("https://esignuat.nupaybiz.com");
  const [uatEsignApiKey, setUatEsignApiKey] = useState("");
  const [uatRedirectUrl, setUatRedirectUrl] = useState("");
  const [prodApiKey, setProdApiKey] = useState("");
  const [prodEndpoint, setProdEndpoint] = useState("https://nach.nupaybiz.com");
  const [prodEsignEndpoint, setProdEsignEndpoint] = useState("https://esign.nupaybiz.com");
  const [prodEsignApiKey, setProdEsignApiKey] = useState("");
  const [prodRedirectUrl, setProdRedirectUrl] = useState("");
  
  // Fetch Nupay configurations
  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ["nupay-config", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("nupay_config")
        .select("*")
        .eq("org_id", orgId);
      
      if (error) throw error;
      
      // Set form values from existing config
      const uatConfig = data?.find(c => c.environment === "uat");
      const prodConfig = data?.find(c => c.environment === "production");
      
      if (uatConfig) {
        setUatApiKey(uatConfig.api_key || "");
        setUatEndpoint(uatConfig.api_endpoint || "https://nachuat.nupaybiz.com");
        setUatEsignEndpoint((uatConfig as unknown as { esign_api_endpoint?: string }).esign_api_endpoint || "https://esignuat.nupaybiz.com");
        setUatEsignApiKey(uatConfig.esign_api_key || "");
        setUatRedirectUrl(uatConfig.redirect_url || "");
      }
      if (prodConfig) {
        setProdApiKey(prodConfig.api_key || "");
        setProdEndpoint(prodConfig.api_endpoint || "https://nach.nupaybiz.com");
        setProdEsignEndpoint((prodConfig as unknown as { esign_api_endpoint?: string }).esign_api_endpoint || "https://esign.nupaybiz.com");
        setProdEsignApiKey(prodConfig.esign_api_key || "");
        setProdRedirectUrl(prodConfig.redirect_url || "");
      }
      
      return data as NupayConfig[];
    },
    enabled: !!orgId,
  });

  // Fetch banks
  const { data: banksData, isLoading: banksLoading, refetch: refetchBanks } = useQuery({
    queryKey: ["nupay-banks", orgId],
    queryFn: async () => {
      if (!orgId) return { banks: [], count: 0 };
      
      const { data, error } = await supabase
        .from("nupay_banks")
        .select("*")
        .eq("org_id", orgId)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return { banks: data || [], count: data?.length || 0 };
    },
    enabled: !!orgId,
  });

  // Fetch recent mandates
  const { data: mandates, isLoading: mandatesLoading } = useQuery({
    queryKey: ["nupay-mandates", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("nupay_mandates")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as NupayMandate[];
    },
    enabled: !!orgId,
  });

  // Save eMandate config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async ({ environment, apiKey, endpoint, esignEndpoint, esignApiKey, redirectUrl, isActive }: {
      environment: "uat" | "production";
      apiKey: string;
      endpoint: string;
      esignEndpoint: string;
      esignApiKey: string;
      redirectUrl: string;
      isActive: boolean;
    }) => {
      if (!orgId) throw new Error("No organization selected");

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/nupay-webhook-handler`;

      const { error } = await supabase
        .from("nupay_config")
        .upsert({
          org_id: orgId,
          environment,
          api_key: apiKey,
          api_endpoint: endpoint,
          esign_api_endpoint: esignEndpoint || null,
          esign_api_key: esignApiKey || null,
          webhook_url: webhookUrl,
          redirect_url: redirectUrl || null,
          is_active: isActive,
        }, {
          onConflict: "org_id,environment"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration saved");
      queryClient.invalidateQueries({ queryKey: ["nupay-config"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to save configuration", { description: error.message });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ environment, isActive }: { environment: "uat" | "production"; isActive: boolean }) => {
      if (!orgId) throw new Error("No organization selected");

      // If activating, deactivate the other environment first
      if (isActive) {
        await supabase
          .from("nupay_config")
          .update({ is_active: false })
          .eq("org_id", orgId)
          .neq("environment", environment);
      }

      const { error } = await supabase
        .from("nupay_config")
        .update({ is_active: isActive })
        .eq("org_id", orgId)
        .eq("environment", environment);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration updated");
      queryClient.invalidateQueries({ queryKey: ["nupay-config"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update", { description: error.message });
    },
  });

  // Refresh banks mutation
  const refreshBanksMutation = useMutation({
    mutationFn: async () => {
      const activeConfig = configs?.find(c => c.is_active);
      if (!activeConfig) throw new Error("No active configuration found");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("nupay-get-banks", {
        body: { 
          org_id: orgId, 
          environment: activeConfig.environment,
          refresh: true 
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Bank list refreshed: ${data.count} banks loaded`);
      queryClient.invalidateQueries({ queryKey: ["nupay-banks"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to refresh banks", { description: error.message });
    },
  });

  const uatConfig = configs?.find(c => c.environment === "uat");
  const prodConfig = configs?.find(c => c.environment === "production");
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co"}/functions/v1/nupay-webhook-handler`;

  const filteredBanks = banksData?.banks?.filter(bank => 
    bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
    bank.bank_code.toLowerCase().includes(bankSearchQuery.toLowerCase())
  ) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Nupay eMandate Integration
          </h1>
          <p className="text-muted-foreground">
            Configure NPCI eMandate for automated loan collections
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="configuration" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              eMandate
            </TabsTrigger>
            <TabsTrigger value="banks" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Banks
            </TabsTrigger>
            <TabsTrigger value="mandates" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Mandates
            </TabsTrigger>
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="space-y-6 mt-6">
            {/* UAT Environment */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      UAT Environment
                      {uatConfig?.is_active && (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Testing environment for integration development</CardDescription>
                  </div>
                  {uatConfig && (
                    <Switch
                      checked={uatConfig.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ environment: "uat", isActive: checked })
                      }
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="uatApiKey">API Key</Label>
                  <Input
                    id="uatApiKey"
                    type="password"
                    value={uatApiKey}
                    onChange={(e) => setUatApiKey(e.target.value)}
                    placeholder="Enter your Nupay UAT API key"
                  />
                </div>
                <div>
                  <Label htmlFor="uatEndpoint">eMandate API Endpoint</Label>
                  <Input
                    id="uatEndpoint"
                    value={uatEndpoint}
                    onChange={(e) => setUatEndpoint(e.target.value)}
                    placeholder="https://nachuat.nupaybiz.com"
                  />
                </div>
                <div>
                  <Label htmlFor="uatEsignEndpoint">E-Sign API Endpoint</Label>
                  <Input
                    id="uatEsignEndpoint"
                    value={uatEsignEndpoint}
                    onChange={(e) => setUatEsignEndpoint(e.target.value)}
                    placeholder="https://esignuat.nupaybiz.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separate endpoint for Aadhaar e-signature service
                  </p>
                </div>
                <div>
                  <Label htmlFor="uatEsignApiKey">E-Sign API Key (Optional)</Label>
                  <Input
                    id="uatEsignApiKey"
                    type="password"
                    value={uatEsignApiKey}
                    onChange={(e) => setUatEsignApiKey(e.target.value)}
                    placeholder="Leave blank to use main API key"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separate API key for e-signature if provided by Nupay (falls back to main API key if empty)
                  </p>
                </div>
                <div>
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input value={webhookUrl} readOnly className="bg-muted" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        toast.success("Webhook URL copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure this URL in your Nupay dashboard
                  </p>
                </div>
                <div>
                  <Label htmlFor="uatRedirectUrl">Redirect URL (Optional)</Label>
                  <Input
                    id="uatRedirectUrl"
                    value={uatRedirectUrl}
                    onChange={(e) => setUatRedirectUrl(e.target.value)}
                    placeholder="https://yourapp.com/mandate-callback"
                  />
                </div>
                <Button
                  onClick={() => saveConfigMutation.mutate({
                    environment: "uat",
                    apiKey: uatApiKey,
                    endpoint: uatEndpoint,
                    esignEndpoint: uatEsignEndpoint,
                    esignApiKey: uatEsignApiKey,
                    redirectUrl: uatRedirectUrl,
                    isActive: uatConfig?.is_active || false,
                  })}
                  disabled={!uatApiKey || saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save UAT Configuration
                </Button>
              </CardContent>
            </Card>

            {/* Production Environment */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Production Environment
                      {prodConfig?.is_active && (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Live environment for real transactions</CardDescription>
                  </div>
                  {prodConfig && (
                    <Switch
                      checked={prodConfig.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ environment: "production", isActive: checked })
                      }
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prodApiKey">API Key</Label>
                  <Input
                    id="prodApiKey"
                    type="password"
                    value={prodApiKey}
                    onChange={(e) => setProdApiKey(e.target.value)}
                    placeholder="Enter your Nupay Production API key"
                  />
                </div>
                <div>
                  <Label htmlFor="prodEndpoint">eMandate API Endpoint</Label>
                  <Input
                    id="prodEndpoint"
                    value={prodEndpoint}
                    onChange={(e) => setProdEndpoint(e.target.value)}
                    placeholder="https://nach.nupaybiz.com"
                  />
                </div>
                <div>
                  <Label htmlFor="prodEsignEndpoint">E-Sign API Endpoint</Label>
                  <Input
                    id="prodEsignEndpoint"
                    value={prodEsignEndpoint}
                    onChange={(e) => setProdEsignEndpoint(e.target.value)}
                    placeholder="https://esign.nupaybiz.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separate endpoint for Aadhaar e-signature service
                  </p>
                </div>
                <div>
                  <Label htmlFor="prodEsignApiKey">E-Sign API Key (Optional)</Label>
                  <Input
                    id="prodEsignApiKey"
                    type="password"
                    value={prodEsignApiKey}
                    onChange={(e) => setProdEsignApiKey(e.target.value)}
                    placeholder="Leave blank to use main API key"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separate API key for e-signature if provided by Nupay (falls back to main API key if empty)
                  </p>
                </div>
                <div>
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input value={webhookUrl} readOnly className="bg-muted" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        toast.success("Webhook URL copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="prodRedirectUrl">Redirect URL (Optional)</Label>
                  <Input
                    id="prodRedirectUrl"
                    value={prodRedirectUrl}
                    onChange={(e) => setProdRedirectUrl(e.target.value)}
                    placeholder="https://yourapp.com/mandate-callback"
                  />
                </div>
                <Button
                  onClick={() => saveConfigMutation.mutate({
                    environment: "production",
                    apiKey: prodApiKey,
                    endpoint: prodEndpoint,
                    esignEndpoint: prodEsignEndpoint,
                    esignApiKey: prodEsignApiKey,
                    redirectUrl: prodRedirectUrl,
                    isActive: prodConfig?.is_active || false,
                  })}
                  disabled={!prodApiKey || saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save Production Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Banks Tab */}
          <TabsContent value="banks" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Supported Banks</CardTitle>
                    <CardDescription>
                      {banksData?.count || 0} banks available for eMandate registration
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => refreshBanksMutation.mutate()}
                    disabled={refreshBanksMutation.isPending || !configs?.some(c => c.is_active)}
                  >
                    {refreshBanksMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh Bank List
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search banks..."
                      value={bankSearchQuery}
                      onChange={(e) => setBankSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {banksLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredBanks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Building2 className="h-12 w-12 mb-4" />
                    <p>No banks found</p>
                    <p className="text-sm">
                      {configs?.some(c => c.is_active) 
                        ? "Click 'Refresh Bank List' to fetch banks from Nupay"
                        : "Please activate a configuration first"}
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-md max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bank Name</TableHead>
                          <TableHead>Bank Code</TableHead>
                          <TableHead>Mode</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBanks.map((bank) => (
                          <TableRow key={`${bank.bank_id}-${bank.mode}`}>
                            <TableCell className="font-medium">{bank.name}</TableCell>
                            <TableCell>{bank.bank_code}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {bank.mode === "netbanking" ? "NetBanking" : "Debit Card"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mandates Tab */}
          <TabsContent value="mandates" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Mandates</CardTitle>
                <CardDescription>eMandate registrations and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {mandatesLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !mandates || mandates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <History className="h-12 w-12 mb-4" />
                    <p>No mandates yet</p>
                    <p className="text-sm">Mandates will appear here once created</p>
                  </div>
                ) : (
                  <div className="border rounded-md overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Loan No</TableHead>
                          <TableHead>Account Holder</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>UMRN</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mandates.map((mandate) => (
                          <TableRow key={mandate.id}>
                            <TableCell>
                              {format(new Date(mandate.created_at), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="font-medium">{mandate.loan_no}</TableCell>
                            <TableCell>{mandate.account_holder_name}</TableCell>
                            <TableCell>{mandate.bank_name || "-"}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(mandate.collection_amount)}
                            </TableCell>
                            <TableCell>
                              <MandateStatusBadge
                                status={mandate.status as any}
                                rejectionReasonCode={mandate.rejection_reason_code || undefined}
                                rejectionReasonDesc={mandate.rejection_reason_desc || undefined}
                                rejectedBy={mandate.rejected_by || undefined}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {mandate.umrn || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default NupaySettings;
