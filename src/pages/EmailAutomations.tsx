import { lazy, Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Zap, TrendingUp, Mail, AlertCircle, BarChart3, History, Settings, Play } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock } from "lucide-react";
const RuleBuilder = lazy(() => import("@/components/EmailAutomation/RuleBuilder").then(m => ({ default: m.RuleBuilder })));
import { AutomationAnalytics } from "@/components/EmailAutomation/AutomationAnalytics";
import { ExecutionHistoryTable } from "@/components/EmailAutomation/ExecutionHistoryTable";
import { RuleAnalyticsDialog } from "@/components/EmailAutomation/RuleAnalyticsDialog";
import { RuleTestDialog } from "@/components/EmailAutomation/RuleTestDialog";
import { AutomationDiagnostics } from "@/components/EmailAutomation/AutomationDiagnostics";
import { RuleTemplatesGallery } from "@/components/EmailAutomation/RuleTemplatesGallery";
import { RuleDependencyManager } from "@/components/EmailAutomation/RuleDependencyManager";
import { ApprovalQueueManager } from "@/components/EmailAutomation/ApprovalQueueManager";
import { AdvancedReporting } from "@/components/EmailAutomation/AdvancedReporting";

export default function EmailAutomations() {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [analyticsRuleId, setAnalyticsRuleId] = useState<string | null>(null);
  const [analyticsRuleName, setAnalyticsRuleName] = useState<string>("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testingRule, setTestingRule] = useState<any>(null);
  const [dependencyManagerOpen, setDependencyManagerOpen] = useState(false);
  const [dependencyRuleId, setDependencyRuleId] = useState<string | null>(null);

  // Fetch automation rules
  const { data: rules, isLoading, refetch } = useQuery({
    queryKey: ["email_automation_rules", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from("email_automation_rules")
        .select(`
          *,
          email_templates(name, subject)
        `)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch execution stats
  const { data: stats } = useQuery({
    queryKey: ["automation_stats", orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from("email_automation_executions")
        .select("status", { count: "exact" })
        .eq("org_id", orgId);

      if (error) throw error;

      const total = data?.length || 0;
      const sent = data?.filter(e => e.status === "sent").length || 0;
      const failed = data?.filter(e => e.status === "failed").length || 0;
      const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : "0";

      return { total, sent, failed, successRate };
    },
    enabled: !!orgId,
  });

  // Toggle rule active status
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("email_automation_rules")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_automation_rules"] });
      notify.success("Rule updated", "Automation rule status changed successfully");
    },
    onError: (error: any) => {
      notify.error("Error", error);
    },
  });

  // Delete rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_automation_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_automation_rules"] });
      notify.success("Rule deleted", "Automation rule deleted successfully");
    },
    onError: (error: any) => {
      notify.error("Error", error);
    },
  });

  const getTriggerTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stage_change: "Stage Change",
      disposition_set: "Call Disposition",
      activity_logged: "Activity Logged",
      field_updated: "Field Updated",
      inactivity: "Contact Inactivity",
      time_based: "Time Based",
      assignment_changed: "Assignment Changed",
    lead_score_change: "Lead Score Change",
    tag_assigned: "Tag Assigned",
    form_submitted: "Form Submitted",
  };
  return labels[type] || type;
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setIsRuleBuilderOpen(true);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setIsRuleBuilderOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Email Automations</h1>
          <p className="text-muted-foreground">
            Automate your email outreach based on pipeline changes and activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/email-automations/settings")}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button onClick={handleCreateRule}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="templates">
            <Zap className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="approvals">
            <Clock className="mr-2 h-4 w-4" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="diagnostics">
            <AlertCircle className="mr-2 h-4 w-4" />
            Diagnostics
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Execution History
          </TabsTrigger>
          <TabsTrigger value="reports">
            <TrendingUp className="mr-2 h-4 w-4" />
            Advanced Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules?.filter(r => r.is_active).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {rules?.length || 0} total rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sent || 0}</div>
            <p className="text-xs text-muted-foreground">automated emails</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate}%</div>
            <p className="text-xs text-muted-foreground">delivery success</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed || 0}</div>
            <p className="text-xs text-muted-foreground">requires attention</p>
          </CardContent>
        </Card>
      </div>

        {/* Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle>Automation Rules</CardTitle>
            <CardDescription>
              Manage your email automation rules and triggers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading automation rules...
              </div>
            ) : rules?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No automation rules yet. Create your first rule to get started!
                </p>
                <Button onClick={handleCreateRule}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Rule
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) =>
                            toggleRuleMutation.mutate({ id: rule.id, isActive: checked })
                          }
                        />
                      </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-sm text-muted-foreground">
                          {rule.description}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        {rule.enforce_business_hours && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Business Hours
                          </Badge>
                        )}
                        {rule.ab_test_enabled && (
                          <Badge variant="outline" className="text-xs">
                            A/B Test
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getTriggerTypeLabel(rule.trigger_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {rule.email_templates?.name || "No template"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div>Triggered: {rule.total_triggered}</div>
                          <div className="text-green-600">Sent: {rule.total_sent}</div>
                          {rule.total_failed > 0 && (
                            <div className="text-red-600">Failed: {rule.total_failed}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTestingRule(rule);
                              setTestDialogOpen(true);
                            }}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAnalyticsRuleId(rule.id);
                              setAnalyticsRuleName(rule.name);
                            }}
                          >
                            <BarChart3 className="h-3 w-3 mr-1" />
                            Analytics
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRule(rule)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this rule?")) {
                                deleteRuleMutation.mutate(rule.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Rule Templates</CardTitle>
              <CardDescription>
                Start with pre-built automation templates for common scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RuleTemplatesGallery
                onSelectTemplate={(template) => {
                  setEditingRule({
                    name: template.name,
                    description: template.description,
                    trigger_type: template.trigger_type,
                    trigger_config: template.trigger_config,
                    conditions: template.conditions,
                    condition_logic: template.condition_logic,
                    send_delay_minutes: template.send_delay_minutes,
                    cooldown_period_days: template.cooldown_period_days,
                    priority: template.priority,
                  });
                  setIsRuleBuilderOpen(true);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics">
          <AutomationDiagnostics />
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalQueueManager />
        </TabsContent>

        <TabsContent value="analytics">
          <AutomationAnalytics dateRange={30} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>
                View all automation executions across all rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExecutionHistoryTable limit={100} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <AdvancedReporting />
        </TabsContent>
      </Tabs>

      <Suspense fallback={null}>
        <RuleBuilder
          open={isRuleBuilderOpen}
          onOpenChange={setIsRuleBuilderOpen}
          editingRule={editingRule}
        />
      </Suspense>

      <RuleAnalyticsDialog
        open={!!analyticsRuleId}
        onOpenChange={(open) => {
          if (!open) {
            setAnalyticsRuleId(null);
            setAnalyticsRuleName("");
          }
        }}
        ruleId={analyticsRuleId || ""}
        ruleName={analyticsRuleName}
      />

      <RuleTestDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        rule={testingRule}
      />

      {dependencyRuleId && orgId && (
        <RuleDependencyManager
          open={dependencyManagerOpen}
          onOpenChange={setDependencyManagerOpen}
          ruleId={dependencyRuleId}
          orgId={orgId}
        />
      )}
    </div>
  );
}
