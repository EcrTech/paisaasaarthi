import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  IndianRupee,
  Users,
  AlertCircle,
  MapPinOff,
} from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";

import { useLOSPermissions } from "@/hooks/useLOSPermissions";

export default function LOSDashboard() {
  const { orgId } = useOrgContext();
  const navigate = useNavigate();
  const { permissions } = useLOSPermissions();

  // Fetch all stats in a single query function with Promise.all for parallel execution
  const { data: stats, isLoading } = useQuery({
    queryKey: ["los-stats", orgId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      // Helper to fetch all rows with pagination (PostgREST caps at 1000 per request)
      const fetchAllRows = async (buildQuery: () => any) => {
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          allData = allData.concat(data || []);
          hasMore = (data?.length || 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return allData;
      };

      // Lifecycle priority: each contact counted once in their highest stage
      const STAGE_PRIORITY: Record<string, number> = {
        disbursed: 6,
        disbursement_pending: 5,
        sanctioned: 5,
        approval_pending: 4,
        credit_assessment: 3,
        field_verification: 3,
        document_collection: 3,
        application_login: 3,
        rejected: 1,
        cancelled: 1,
        closed: 7,
      };

      // Dashboard card mapping from lifecycle priority
      const priorityToCard = (priority: number) => {
        if (priority >= 7) return "disbursed";    // closed = fully done
        if (priority >= 6) return "disbursed";
        if (priority >= 4) return "pendingApproval"; // approval_pending, sanctioned, disbursement_pending
        if (priority >= 3) return "inProgress";      // application stages
        return "other";                              // rejected, cancelled
      };

      // Execute ALL queries in parallel
      const [
        allAppsData,
        approvedAppsData,
        disbursementsData,
        pendingEMIsRes,
        overdueEMIsRes,
        negativeAreasRes,
        applicantsWithAddressRes
      ] = await Promise.all([
        // All non-draft apps with contact_id and current_stage (paginated)
        fetchAllRows(() =>
          supabase
            .from("loan_applications")
            .select("contact_id, current_stage")
            .eq("org_id", orgId)
            .neq("status", "draft")
            .not("contact_id", "is", null)
        ),

        // Total sanctioned/approved amount (paginated)
        fetchAllRows(() =>
          supabase
            .from("loan_applications")
            .select("approved_amount")
            .eq("org_id", orgId)
            .not("approved_amount", "is", null)
            .in("status", ["approved", "disbursed", "closed"])
        ),

        // Total disbursed amount (paginated)
        fetchAllRows(() =>
          supabase
            .from("loan_disbursements")
            .select("disbursement_amount, loan_applications!inner(org_id)")
            .eq("status", "completed")
            .eq("loan_applications.org_id", orgId)
        ),

        // Pending EMIs
        supabase
          .from("loan_repayment_schedule")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("status", "pending"),

        // Overdue EMIs
        supabase
          .from("loan_repayment_schedule")
          .select("*", { count: "exact", head: true })
          .eq("org_id", orgId)
          .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`),

        // Negative area pin codes
        supabase
          .from("loan_negative_areas")
          .select("area_value")
          .eq("org_id", orgId)
          .eq("area_type", "pincode")
          .eq("is_active", true),

        // Applicants with address to check against negative areas
        fetchAllRows(() =>
          supabase
            .from("loan_applicants")
            .select("loan_application_id, current_address")
            .not("current_address", "is", null)
        ),
      ]);

      // Deduplicate: each contact counted once at their highest lifecycle stage
      const contactHighest = new Map<string, number>();
      for (const app of allAppsData) {
        const priority = STAGE_PRIORITY[app.current_stage] || 2;
        const current = contactHighest.get(app.contact_id) || 0;
        if (priority > current) {
          contactHighest.set(app.contact_id, priority);
        }
      }

      let pendingApproval = 0;
      let inProgress = 0;
      let disbursed = 0;
      for (const priority of contactHighest.values()) {
        const card = priorityToCard(priority);
        if (card === "disbursed") disbursed++;
        else if (card === "pendingApproval") pendingApproval++;
        else if (card === "inProgress") inProgress++;
      }

      const totalSanctioned = approvedAppsData.reduce(
        (sum: number, app: any) => sum + (app.approved_amount || 0),
        0
      );

      const totalDisbursedAmount = disbursementsData.reduce(
        (sum: number, d: any) => sum + d.disbursement_amount,
        0
      );

      // Count applications from negative areas
      const negativePincodes = new Set(negativeAreasRes.data?.map(a => a.area_value) || []);
      const negativeAreaApps = applicantsWithAddressRes.filter((a: any) => {
        const pincode = (a.current_address as any)?.pincode;
        return pincode && negativePincodes.has(pincode);
      }).length || 0;

      return {
        totalApps: contactHighest.size,
        pendingApproval,
        disbursed,
        inProgress,
        totalSanctioned,
        totalDisbursedAmount,
        pendingEMIs: pendingEMIsRes.count || 0,
        overdueEMIs: overdueEMIsRes.count || 0,
        negativeAreaApps,
      };
    },
    enabled: !!orgId,
  });

  const { data: recentApplications } = useQuery({
    queryKey: ["recent-applications", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          *,
          loan_applicants(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const STAGE_LABELS: Record<string, string> = {
    application_login: "Application Login",
    document_collection: "Document Collection",
    field_verification: "Field Verification",
    credit_assessment: "Credit Assessment",
    approval_pending: "Approval Pending",
    sanctioned: "Sanctioned",
    rejected: "Rejected",
    disbursement_pending: "Disbursement Pending",
    disbursed: "Disbursed",
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading dashboard..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">LOS Dashboard</h1>
            <p className="text-muted-foreground">
              Loan Origination System overview and statistics
            </p>
          </div>
          {/* Applications can only be created via referral links */}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalApps || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {stats?.pendingApproval || 0}
              </div>
              <Button
                variant="link"
                className="p-0 h-auto mt-2"
                onClick={() => navigate("/los/approval-queue")}
              >
                View Queue →
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stats?.inProgress || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Disbursed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats?.disbursed || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Total Sanctioned Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats?.totalSanctioned || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-green-600" />
                Total Disbursed Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats?.totalDisbursedAmount || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Pending EMIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats?.pendingEMIs || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Overdue EMIs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats?.overdueEMIs || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPinOff className="h-4 w-4 text-red-600" />
                Negative Area Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats?.negativeAreaApps || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                From blocked pin codes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Applications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Applications</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/los/applications")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentApplications && recentApplications.length > 0 ? (
              <div className="space-y-4">
                {recentApplications.map((app: any) => {
                  const applicant = app.loan_applicants?.[0];
                  return (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                      onClick={() => navigate(`/los/applications/${app.id}`)}
                    >
                      <div className="space-y-1">
                        <div className="font-medium">
                          {app.application_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {applicant?.first_name} {applicant?.last_name || ""}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="font-medium">
                          {formatCurrency(app.requested_amount)}
                        </div>
                        <Badge variant="outline">
                          {STAGE_LABELS[app.current_stage] || app.current_stage}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No applications yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/los/my-referrals")}
              >
                <FileText className="h-6 w-6" />
                <span>My Referrals</span>
              </Button>
              {permissions.canApproveLoans && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate("/los/approval-queue")}
                >
                  <AlertCircle className="h-6 w-6" />
                  <span>Approval Queue</span>
                </Button>
              )}
              {permissions.canViewApplications && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate("/los/applications")}
                >
                  <Users className="h-6 w-6" />
                  <span>All Applications</span>
                </Button>
              )}
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate("/los/bulk-payment-report")}
              >
                <FileText className="h-6 w-6" />
                <span>Bulk Payment Report</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
