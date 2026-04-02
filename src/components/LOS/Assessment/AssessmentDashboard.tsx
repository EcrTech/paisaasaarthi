import { lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const EligibilityCalculator = lazy(() => import("./EligibilityCalculator"));

interface AssessmentDashboardProps {
  applicationId: string;
  orgId: string;
}

export default function AssessmentDashboard({ applicationId, orgId }: AssessmentDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: eligibility } = useQuery({
    queryKey: ["loan-eligibility", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_eligibility")
        .select("*")
        .eq("loan_application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data;
    },
    enabled: !!applicationId,
  });

  const { data: application } = useQuery({
    queryKey: ["loan-application-basic", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("id", applicationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const updateStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const { data, error } = await supabase.rpc("transition_loan_stage", {
        p_application_id: applicationId,
        p_expected_current_stage: "evaluation",
        p_new_stage: newStage,
      });
      if (error) throw error;
      if (!data) throw new Error("Stage has already changed. Please refresh the page.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application-basic", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      toast({ title: "Application moved to approval queue" });
    },
  });

  const isEligible = eligibility?.is_eligible;
  const hasAssessment = !!eligibility;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {hasAssessment && (
        <>
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Summary</CardTitle>
              <CardDescription>
                Credit assessment results and eligibility status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Eligibility Status</div>
                  <div className="flex items-center gap-2 mt-2">
                    {isEligible ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <Badge className="bg-green-500">Eligible</Badge>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <Badge className="bg-red-500">Not Eligible</Badge>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">FOIR</div>
                  <div className="text-2xl font-bold mt-1">
                    {eligibility.foir_percentage?.toFixed(2)}%
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Eligible Amount</div>
                  <div className="text-2xl font-bold mt-1">
                    {formatCurrency(eligibility.eligible_loan_amount || 0)}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Net Income</div>
                  <div className="text-2xl font-bold mt-1">
                    {formatCurrency(eligibility.net_income || 0)}
                  </div>
                </div>
              </div>

              {isEligible && application?.current_stage === "evaluation" && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <p className="font-medium text-green-900">
                        Assessment complete! Ready for approval.
                      </p>
                    </div>
                    <Button onClick={() => updateStageMutation.mutate("approved")}>
                      Move to Approval
                    </Button>
                  </div>
                </div>
              )}

              {!isEligible && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <p className="font-medium text-red-900">
                      Application does not meet eligibility criteria. Review policy checks below.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Income Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Income & Obligations Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-3">Income Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gross Income</span>
                      <span className="font-medium">
                        {formatCurrency(eligibility.gross_income || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Deductions</span>
                      <span className="font-medium text-red-600">
                        - {formatCurrency(eligibility.total_deductions || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                      <span>Net Income</span>
                      <span>{formatCurrency(eligibility.net_income || 0)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">EMI Obligations</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Existing EMI</span>
                      <span className="font-medium">
                        {formatCurrency(eligibility.existing_emi_obligations || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Proposed EMI</span>
                      <span className="font-medium">
                        {formatCurrency(eligibility.proposed_emi || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                      <span>Total EMI</span>
                      <span>
                        {formatCurrency(
                          (eligibility.existing_emi_obligations || 0) +
                            (eligibility.proposed_emi || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loan Recommendation */}
          <Card>
            <CardHeader>
              <CardTitle>Loan Recommendation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-sm text-muted-foreground">Eligible Amount</Label>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(eligibility.eligible_loan_amount || 0)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Recommended Tenure</Label>
                  <div className="text-xl font-bold">
                    {eligibility.recommended_tenure_days || "N/A"} days
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Interest Rate</Label>
                  <div className="text-xl font-bold">
                    {eligibility.recommended_interest_rate || "N/A"}% per day
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Calculator Tab */}
      <Tabs defaultValue="calculator" className="w-full">
        <TabsList>
          <TabsTrigger value="calculator">
            <TrendingUp className="h-4 w-4 mr-2" />
            Eligibility Calculator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading calculator...</div>}>
            <EligibilityCalculator applicationId={applicationId} orgId={orgId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
