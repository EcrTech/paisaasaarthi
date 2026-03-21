import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/hooks/useNotification";
import { Loader2, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface QueueJob {
  id: string;
  org_id: string;
  user_id: string;
  operation_type: string;
  payload: any;
  status: string;
  priority: number;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  result: any;
  created_at: string;
  updated_at: string;
}

const QueueStatus = () => {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<QueueJob[]>([]);

  useEffect(() => {
    if (orgId) {
      fetchJobs();
    }
  }, [orgId]);

  const fetchJobs = async () => {
    if (!orgId) return;
    
    try {
      const { data, error } = await supabase
        .from("operation_queue" as any)
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setJobs((data as unknown as QueueJob[]) || []);
    } catch (error: any) {
      console.error("Error fetching queue jobs:", error);
      notify.error("Error", "Failed to load queue status");
    } finally {
      setLoading(false);
    }
  };

  useRealtimeSync({
    table: 'operation_queue',
    onUpdate: fetchJobs,
    onInsert: fetchJobs,
    onDelete: fetchJobs,
    enabled: !!orgId,
  });

  const handleCancel = async (jobId: string) => {
    try {
      const serviceClient = createClient(
        import.meta.env.VITE_SUPABASE_URL || "https://newvgnbygvtnmyomxbmu.supabase.co",
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      );

      const { error } = await (serviceClient as any)
        .from("operation_queue")
        .update({ 
          status: 'failed', 
          error_message: 'Cancelled by user' 
        })
        .eq('id', jobId)
        .eq('status', 'queued');

      if (error) throw error;

      notify.success("Success", "Operation cancelled");

      fetchJobs();
    } catch (error: any) {
      console.error("Error cancelling job:", error);
      notify.error("Error", "Failed to cancel operation");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      queued: "secondary",
      processing: "default",
      completed: "outline",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getOperationLabel = (type: string) => {
    const labels: Record<string, string> = {
      bulk_whatsapp_send: "Bulk WhatsApp Campaign",
      template_sync: "Template Sync",
      contact_import: "Contact Import",
      webhook_lead_processing: "Webhook Lead Processing",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Queue Status</h1>
          <p className="text-muted-foreground mt-2">
            Track the status of your queued operations
          </p>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No queued operations</h3>
              <p className="text-muted-foreground text-center">
                All your operations are processing normally
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <CardTitle className="text-lg">
                          {getOperationLabel(job.operation_type)}
                        </CardTitle>
                        <CardDescription>
                          Created {format(new Date(job.created_at), "PPp")}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                      {job.status === 'queued' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(job.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Scheduled for:</span>
                      <p className="font-medium">
                        {format(new Date(job.scheduled_for), "PPp")}
                      </p>
                    </div>
                    {job.started_at && (
                      <div>
                        <span className="text-muted-foreground">Started:</span>
                        <p className="font-medium">
                          {format(new Date(job.started_at), "PPp")}
                        </p>
                      </div>
                    )}
                    {job.completed_at && (
                      <div>
                        <span className="text-muted-foreground">Completed:</span>
                        <p className="font-medium">
                          {format(new Date(job.completed_at), "PPp")}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Priority:</span>
                      <p className="font-medium">{job.priority}</p>
                    </div>
                  </div>
                  {job.error_message && (
                    <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive">
                      <span className="font-medium">Error:</span> {job.error_message}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default QueueStatus;
