import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import EMIScheduleGenerator from "./EMIScheduleGenerator";
import EMIScheduleTable from "./EMIScheduleTable";
import PaymentHistoryTable from "./PaymentHistoryTable";

interface EMIDashboardProps {
  applicationId: string;
}

export default function EMIDashboard({ applicationId }: EMIDashboardProps) {
  const { orgId } = useOrgContext();

  // Single source of truth: read approved_amount, interest_rate, tenure_days from loan_applications
  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("approved_amount, interest_rate, tenure_days")
        .eq("id", applicationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sanction } = useQuery({
    queryKey: ["loan-sanction", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_sanctions")
        .select("*")
        .eq("loan_application_id", applicationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: disbursement } = useQuery({
    queryKey: ["loan-disbursement", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_disbursements")
        .select("*")
        .eq("loan_application_id", applicationId)
        .eq("status", "completed")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: emiStats, isLoading } = useQuery({
    queryKey: ["emi-stats", applicationId, orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_application_emi_stats", {
        p_application_id: applicationId,
        p_org_id: orgId!,
      });
      if (error) throw error;
      return data as {
        totalEMIs: number;
        paidEMIs: number;
        pendingEMIs: number;
        overdueEMIs: number;
        totalAmount: number;
        amountPaid: number;
        balanceAmount: number;
        nextEMI: any;
      };
    },
    enabled: !!applicationId && !!orgId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };


  if (isLoading) {
    return <LoadingState message="Loading repayment details..." />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {emiStats && emiStats.totalEMIs > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {emiStats.paidEMIs}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                of {emiStats.totalEMIs} payment(s)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {emiStats.pendingEMIs}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {emiStats.overdueEMIs}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Balance Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(emiStats.balanceAmount)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Next Payment Due */}
      {emiStats?.nextEMI && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Next Payment Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  Payment #{emiStats.nextEMI.emi_number}
                </div>
                <div className="text-2xl font-bold">
                  {formatCurrency(emiStats.nextEMI.total_emi)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Due on {formatDate(emiStats.nextEMI.due_date)}
                </div>
              </div>
              {emiStats.nextEMI.status === "overdue" && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate or View Schedule */}
      {emiStats && emiStats.totalEMIs === 0 && application && sanction && disbursement ? (
        <EMIScheduleGenerator
          applicationId={applicationId}
          application={{
            approved_amount: application.approved_amount || 0,
            interest_rate: application.interest_rate || 0,
            tenure_days: application.tenure_days || 0,
          }}
          sanction={{ id: sanction.id }}
          disbursement={disbursement}
        />
      ) : emiStats && emiStats.totalEMIs > 0 ? (
        <>
          <EMIScheduleTable applicationId={applicationId} />
          <PaymentHistoryTable applicationId={applicationId} />
        </>
      ) : null}
    </div>
  );
}
