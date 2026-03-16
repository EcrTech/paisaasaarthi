import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNotification } from "@/hooks/useNotification";
import { useDialogState } from "@/hooks/useDialogState";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Plus, Pencil, Trash2, Webhook, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { WebhookConfig } from "@/components/Forms/WebhookConfig";
import { ConnectorLogs } from "@/components/Forms/ConnectorLogs";

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_active: boolean;
  applies_to_table?: string;
}

interface Connector {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  webhook_token?: string;
  webhook_config?: {
    http_method?: 'GET' | 'POST';
    target_table?: 'contacts' | 'contact_activities' | 'email_bulk_campaigns' | 'blog_posts' | 'whatsapp_bulk_campaigns' | 'call_logs' | 'email_conversations' | 'whatsapp_messages' | 'pipeline_stages' | 'teams' | 'profiles';
    source_name?: string;
    field_mappings?: Record<string, string>;
  };
  rate_limit_per_minute: number;
  log_count?: number;
  success_count?: number;
  error_count?: number;
}

export default function Connectors() {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConnectorLogs, setSelectedConnectorLogs] = useState<Connector | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const dialog = useDialogState({
    name: "",
    description: "",
    is_active: true,
    webhook_config: {
      http_method: 'POST' as 'GET' | 'POST',
      target_table: 'contacts' as 'contacts' | 'contact_activities' | 'email_bulk_campaigns' | 'blog_posts' | 'whatsapp_bulk_campaigns' | 'call_logs' | 'email_conversations' | 'whatsapp_messages' | 'pipeline_stages' | 'teams' | 'profiles',
      source_name: "" as string | undefined,
      field_mappings: {} as Record<string, string> | undefined,
    },
    rate_limit_per_minute: 60,
  });

  useEffect(() => {
    if (orgId) {
      fetchConnectors();
      fetchCustomFields();
    }
  }, [orgId]);

  const fetchConnectors = async () => {
    if (!orgId) return;
    
    try {
      const { data: connectorsData, error: connectorsError } = await supabase
        .from("forms")
        .select("*")
        .eq("org_id", orgId)
        .eq("connector_type", "webhook")
        .order("created_at", { ascending: false });

      if (connectorsError) throw connectorsError;

      const connectorsWithStats = await Promise.all(
        (connectorsData || []).map(async (connector) => {
          const { count: totalLogs } = await supabase
            .from("connector_logs")
            .select("*", { count: "exact", head: true })
            .eq("form_id", connector.id);

          const { count: successCount } = await supabase
            .from("connector_logs")
            .select("*", { count: "exact", head: true })
            .eq("form_id", connector.id)
            .eq("status", "success");

          const { count: errorCount } = await supabase
            .from("connector_logs")
            .select("*", { count: "exact", head: true })
            .eq("form_id", connector.id)
            .eq("status", "error");

          return {
            ...connector,
            log_count: totalLogs || 0,
            success_count: successCount || 0,
            error_count: errorCount || 0,
          };
        })
      );

      setConnectors(connectorsWithStats as any);
    } catch (error: any) {
      notify.error("Error loading connectors", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    if (!orgId) return;
    
    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, field_name, field_label, field_type, is_active, applies_to_table")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("field_order");

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error: any) {
      notify.error("Error loading fields", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgId) return;

    setLoading(true);

    try {
      if (dialog.isEditing) {
        const { error: updateError } = await supabase
          .from("forms")
          .update({
            name: dialog.formData.name,
            description: dialog.formData.description,
            is_active: dialog.formData.is_active,
            webhook_config: dialog.formData.webhook_config,
            rate_limit_per_minute: dialog.formData.rate_limit_per_minute,
          })
          .eq("id", dialog.editingItem.id);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("forms")
          .insert([{
            org_id: orgId,
            name: dialog.formData.name,
            description: dialog.formData.description,
            is_active: dialog.formData.is_active,
            connector_type: "webhook",
            webhook_config: dialog.formData.webhook_config,
            rate_limit_per_minute: dialog.formData.rate_limit_per_minute,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        
        console.log("Created webhook connector:", data);
      }

      notify.success(
        dialog.isEditing ? "Connector updated" : "Connector created",
        `Webhook connector has been ${dialog.isEditing ? "updated" : "created"} successfully`
      );

      dialog.closeDialog();
      fetchConnectors();
    } catch (error: any) {
      notify.error("Error", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      notify.success("Connector deleted", "Webhook connector has been removed successfully");
      fetchConnectors();
    } catch (error: any) {
      notify.error("Error deleting connector", error);
    } finally {
      setDeleteDialogOpen(false);
      setDeleteId(null);
    }
  };

  const getWebhookUrl = (token?: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/webhook-receiver/${token || '{webhook_token}'}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Webhook Connectors</h1>
            <p className="text-muted-foreground">Manage webhook integrations for automated lead capture</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedConnectorLogs(null)}
            >
              <Webhook className="mr-2 h-4 w-4" />
              View Connectors
            </Button>
            <Dialog open={dialog.isOpen} onOpenChange={(open) => open ? dialog.openDialog() : dialog.closeDialog()}>
              <DialogTrigger asChild>
                <Button onClick={() => dialog.openDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Connector
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{dialog.isEditing ? "Edit Connector" : "Create New Webhook Connector"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Connector Name *</Label>
                    <Input
                      id="name"
                      value={dialog.formData.name}
                      onChange={(e) => dialog.updateFormData({ name: e.target.value })}
                      placeholder="e.g., IndiaMART Webhook"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={dialog.formData.description}
                      onChange={(e) => dialog.updateFormData({ description: e.target.value })}
                      placeholder="Brief description of this connector"
                      rows={3}
                    />
                  </div>

                  <WebhookConfig
                    webhookToken={dialog.editingItem?.webhook_token}
                    webhookUrl={getWebhookUrl(dialog.editingItem?.webhook_token)}
                    sourceName={dialog.formData.webhook_config.source_name || ""}
                    rateLimit={dialog.formData.rate_limit_per_minute}
                    httpMethod={dialog.formData.webhook_config.http_method || 'POST'}
                    targetTable={dialog.formData.webhook_config.target_table || 'contacts'}
                    fieldMappings={dialog.formData.webhook_config.field_mappings || {}}
                    onSourceNameChange={(value) => dialog.updateFormData({
                      webhook_config: { ...dialog.formData.webhook_config, source_name: value }
                    })}
                    onRateLimitChange={(value) => dialog.updateFormData({
                      rate_limit_per_minute: value
                    })}
                    onHttpMethodChange={(value) => dialog.updateFormData({
                      webhook_config: { ...dialog.formData.webhook_config, http_method: value }
                    })}
                    onTargetTableChange={(value) => dialog.updateFormData({
                      webhook_config: { ...dialog.formData.webhook_config, target_table: value }
                    })}
                    onFieldMappingChange={(mappings) => dialog.updateFormData({
                      webhook_config: { ...dialog.formData.webhook_config, field_mappings: mappings }
                    })}
                    customFields={customFields}
                  />

                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={dialog.closeDialog} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? "Saving..." : dialog.isEditing ? "Update Connector" : "Create Connector"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {selectedConnectorLogs ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Connector Logs - {selectedConnectorLogs.name}</CardTitle>
                <Button variant="outline" onClick={() => setSelectedConnectorLogs(null)}>
                  Back to Connectors
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ConnectorLogs
                formId={selectedConnectorLogs.id}
                formName={selectedConnectorLogs.name}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {loading ? (
              <LoadingState message="Loading connectors..." />
            ) : connectors.length === 0 ? (
              <EmptyState
                icon={<Webhook className="h-12 w-12 text-muted-foreground" />}
                message="No webhook connectors created yet. Click 'Create Connector' to get started."
              />
            ) : (
              connectors.map((connector) => (
                <Card key={connector.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Webhook className="h-5 w-5 text-muted-foreground mt-1" />
                        <div className="space-y-2 flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {connector.name}
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Webhook className="h-3 w-3" />
                              Webhook
                            </Badge>
                            {!connector.is_active && (
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            <span className="block mb-2">{connector.description || "No description"}</span>
                            <span className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="text-primary">{connector.log_count || 0} requests</span>
                              <span>•</span>
                              <span className="text-green-600">{connector.success_count || 0} success</span>
                              {connector.error_count && connector.error_count > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-destructive">{connector.error_count} errors</span>
                                </>
                              )}
                              {connector.webhook_config?.source_name && (
                                <>
                                  <span>•</span>
                                  <span>Source: {connector.webhook_config.source_name}</span>
                                </>
                              )}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedConnectorLogs(connector)}
                          title="View webhook logs"
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => dialog.openDialog(connector)}
                          title="Edit connector"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDelete(connector.id)}
                          title="Delete connector"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Connector"
        description="This will delete the connector and all its logs. This action cannot be undone."
        onConfirm={handleDelete}
        confirmText="Delete"
      />
    </DashboardLayout>
  );
}
