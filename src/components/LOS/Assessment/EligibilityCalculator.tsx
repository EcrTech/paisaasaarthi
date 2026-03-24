import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, CheckCircle, XCircle, TrendingUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EligibilityCalculatorProps {
  applicationId: string;
  orgId: string;
}

const POLICY_RULES = [
  { key: "age", name: "Age Check", description: "Age between 21-58 years", critical: false },
  { key: "income", name: "Minimum Income", description: "Net monthly income ≥ ₹25,000", critical: true },
  { key: "employment", name: "Employment Stability", description: "Min 1 year in current company", critical: false },
  { key: "credit_score", name: "Credit Score", description: "CIBIL score ≥ 550", critical: true },
  { key: "foir", name: "FOIR Check", description: "FOIR should be ≤ 50%", critical: true },
  { key: "existing_loans", name: "Existing Loans", description: "Max 3 active loans", critical: false },
];

export default function EligibilityCalculator({ applicationId, orgId }: EligibilityCalculatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    gross_income: "",
    net_income: "",
    total_deductions: "",
    existing_emi_obligations: "",
    proposed_emi: "",
    foir_percentage: "0",
    max_allowed_foir: "50",
    eligible_loan_amount: "",
    recommended_tenure: "30",
    recommended_interest_rate: "1",
    loan_amount: "",
  });

  // Auto-calculate net income when gross income or deductions change
  useEffect(() => {
    const gross = parseFloat(formData.gross_income) || 0;
    const deductions = parseFloat(formData.total_deductions) || 0;
    const netIncome = gross - deductions;
    if (gross > 0) {
      setFormData(prev => ({ ...prev, net_income: netIncome > 0 ? netIncome.toString() : "0" }));
    }
  }, [formData.gross_income, formData.total_deductions]);

  // Auto-calculate proposed EMI based on loan amount, tenure (days), and daily interest rate
  useEffect(() => {
    const loanAmount = parseFloat(formData.loan_amount) || 0;
    const tenureDays = parseInt(formData.recommended_tenure) || 30;
    const dailyInterestRate = parseFloat(formData.recommended_interest_rate) || 1;
    
    if (loanAmount > 0 && tenureDays > 0) {
      // Simple interest calculation: Total Interest = Principal * Rate * Time
      const totalInterest = loanAmount * (dailyInterestRate / 100) * tenureDays;
      const totalRepayment = loanAmount + totalInterest;
      const proposedEMI = totalRepayment; // Total amount to be repaid
      setFormData(prev => ({ ...prev, proposed_emi: Math.round(proposedEMI).toString() }));
    }
  }, [formData.loan_amount, formData.recommended_tenure, formData.recommended_interest_rate]);

  const [policyChecks, setPolicyChecks] = useState<Record<string, { passed: boolean; details: string }>>({});
  const [hasCalculated, setHasCalculated] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");

  const { data: application } = useQuery({
    queryKey: ["loan-application", applicationId, orgId],
    queryFn: async () => {
        const { data, error } = await supabase
          .from("loan_applications")
          .select(`
            *,
            loan_applicants(
              *,
              loan_employment_details(*)
            ),
            loan_verifications(*),
            approved_by_profile:profiles!loan_applications_approved_by_fkey(first_name,last_name)
          `)
        .eq("id", applicationId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId && !!orgId,
  });

  const { data: existingEligibility } = useQuery({
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

  const isFinalized = application?.status === "approved" || application?.status === "rejected" || !["assessment", "credit_assessment"].includes(application?.current_stage);
  // Fetch salary slip documents for income calculation
  const { data: salaryDocs = [] } = useQuery({
    queryKey: ["loan-salary-docs", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_documents")
        .select("*")
        .eq("loan_application_id", applicationId)
        .in("document_type", ["salary_slip_1", "salary_slip_2", "salary_slip_3"]);

      if (error) throw error;
      return data || [];
    },
    enabled: !!applicationId,
    staleTime: 0,
  });

  // Calculate income averages from salary slips
  const incomeFromSalarySlips = useMemo(() => {
    const salaries: { gross: number; net: number }[] = [];

    salaryDocs.forEach((doc: any) => {
      if (doc.ocr_data) {
        const ocrData = doc.ocr_data;
        const gross = parseFloat(ocrData.gross_salary) || parseFloat(ocrData.gross_earnings) || 0;
        const net = parseFloat(ocrData.net_salary) || parseFloat(ocrData.net_pay) || 0;
        if (gross > 0 || net > 0) {
          salaries.push({ gross, net });
        }
      }
    });

    if (salaries.length === 0) return null;

    const avgGross = Math.round(salaries.reduce((sum, s) => sum + s.gross, 0) / salaries.length);
    const avgNet = Math.round(salaries.reduce((sum, s) => sum + s.net, 0) / salaries.length);

    return {
      avgGross,
      avgNet,
      deductions: avgGross - avgNet,
      slipsCount: salaries.length,
    };
  }, [salaryDocs]);

  // Calculate maximum eligible amount for display
  const maxEligibleAmount = useMemo(() => {
    const netIncome = parseFloat(formData.net_income) || 0;
    const existingEMI = parseFloat(formData.existing_emi_obligations) || 0;
    const maxFOIR = parseFloat(formData.max_allowed_foir) || 50;
    const dailyInterestRate = parseFloat(formData.recommended_interest_rate) || 1;
    const tenureDays = parseInt(formData.recommended_tenure) || 30;

    if (netIncome === 0) return 0;

    const maxRepayment = (netIncome * maxFOIR / 100) - existingEMI;
    const totalInterestMultiplier = 1 + (dailyInterestRate / 100) * tenureDays;
    const eligibleAmount = maxRepayment / totalInterestMultiplier;

    return Math.round(eligibleAmount > 0 ? eligibleAmount : 0);
  }, [formData.net_income, formData.existing_emi_obligations, formData.max_allowed_foir, formData.recommended_interest_rate, formData.recommended_tenure]);

  useEffect(() => {
    // Priority 1: Use existing saved eligibility
    if (existingEligibility) {
      setFormData({
        gross_income: existingEligibility.gross_income?.toString() || "",
        net_income: existingEligibility.net_income?.toString() || "",
        total_deductions: existingEligibility.total_deductions?.toString() || "",
        existing_emi_obligations: existingEligibility.existing_emi_obligations?.toString() || "",
        proposed_emi: existingEligibility.proposed_emi?.toString() || "",
        foir_percentage: existingEligibility.foir_percentage?.toString() || "0",
        max_allowed_foir: existingEligibility.max_allowed_foir?.toString() || "50",
        eligible_loan_amount: existingEligibility.eligible_loan_amount?.toString() || "",
        recommended_tenure: existingEligibility.recommended_tenure_days?.toString() || "30",
        recommended_interest_rate: existingEligibility.recommended_interest_rate?.toString() || "1",
        loan_amount: application?.requested_amount?.toString() || "",
      });
      setPolicyChecks(existingEligibility.policy_checks as any || {});
      setHasCalculated(true);
      return;
    }

    // Priority 2: Auto-populate from salary slips and application data
    if (incomeFromSalarySlips || application) {
      setFormData(prev => ({
        ...prev,
        gross_income: incomeFromSalarySlips?.avgGross?.toString() || prev.gross_income,
        net_income: incomeFromSalarySlips?.avgNet?.toString() || prev.net_income,
        total_deductions: incomeFromSalarySlips?.deductions?.toString() || prev.total_deductions,
        loan_amount: application?.requested_amount?.toString() || prev.loan_amount,
        recommended_tenure: application?.tenure_days?.toString() || prev.recommended_tenure || "30",
      }));
    }
  }, [existingEligibility, incomeFromSalarySlips, application]);

  const calculateFOIR = () => {
    const netIncome = parseFloat(formData.net_income) || 0;
    const existingEMI = parseFloat(formData.existing_emi_obligations) || 0;
    const proposedEMI = parseFloat(formData.proposed_emi) || 0;

    if (netIncome === 0) return 0;

    const foir = ((existingEMI + proposedEMI) / netIncome) * 100;
    return Math.round(foir * 100) / 100;
  };

  const calculateEligibleAmount = () => {
    const netIncome = parseFloat(formData.net_income) || 0;
    const existingEMI = parseFloat(formData.existing_emi_obligations) || 0;
    const maxFOIR = parseFloat(formData.max_allowed_foir) || 50;
    const dailyInterestRate = parseFloat(formData.recommended_interest_rate) || 1;
    const tenureDays = parseInt(formData.recommended_tenure) || 30;

    // Calculate max repayment capacity based on FOIR
    const maxRepayment = (netIncome * maxFOIR / 100) - existingEMI;

    // For simple daily interest: Total = Principal * (1 + rate * days)
    // So Principal = Total / (1 + rate * days)
    const totalInterestMultiplier = 1 + (dailyInterestRate / 100) * tenureDays;
    const eligibleAmount = maxRepayment / totalInterestMultiplier;

    return Math.round(eligibleAmount > 0 ? eligibleAmount : 0);
  };

  const runPolicyChecks = () => {
    const checks: Record<string, { passed: boolean; details: string }> = {};
    const applicant = application?.loan_applicants?.[0] as any;
    const employment = applicant?.loan_employment_details?.[0] || applicant?.loan_employment_details;
    const creditBureau = application?.loan_verifications?.find((v: any) => v.verification_type === "credit_bureau");
    const panVerification = application?.loan_verifications?.find((v: any) => v.verification_type === "pan");

    // Age check - use applicant DOB first, then fall back to PAN card DOB
    const applicantDob = applicant?.dob || (panVerification?.response_data as any)?.dob;
    if (applicantDob) {
      const age = Math.floor((Date.now() - new Date(applicantDob as string).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      checks.age = {
        passed: age >= 21 && age <= 58,
        details: `Applicant age: ${age} years${!applicant?.dob ? ' (from PAN)' : ''}`
      };
    } else {
      checks.age = { passed: false, details: "DOB not available - upload PAN card" };
    }

    // Income check
    const netIncome = parseFloat(formData.net_income) || 0;
    checks.income = {
      passed: netIncome >= 25000,
      details: `Net monthly income: ₹${netIncome.toLocaleString()}`
    };

    // Employment stability - check employment record first, then fall back to salary slip OCR data
    const dojFromEmployment = employment?.date_of_joining;
    const dojFromSalarySlip = salaryDocs?.find((d: any) => (d.ocr_data as any)?.date_of_joining)?.ocr_data as any;
    const dateOfJoining = dojFromEmployment || dojFromSalarySlip?.date_of_joining;
    
    if (dateOfJoining) {
      const monthsInCompany = Math.floor((Date.now() - new Date(dateOfJoining as string).getTime()) / (1000 * 60 * 60 * 24 * 30));
      checks.employment = {
        passed: monthsInCompany >= 12,
        details: `Months in current company: ${monthsInCompany}${!dojFromEmployment ? ' (from salary slip)' : ''}`
      };
    } else {
      checks.employment = { passed: false, details: "Date of joining not available" };
    }

    // Credit score from actual credit bureau verification
    const creditScore = (creditBureau?.response_data as any)?.credit_score || 0;
    checks.credit_score = {
      passed: creditScore >= 550,
      details: creditScore > 0 ? `CIBIL score: ${creditScore}` : "Credit bureau report not available - please upload CIBIL report"
    };

    // FOIR check
    const foir = calculateFOIR();
    checks.foir = {
      passed: foir <= parseFloat(formData.max_allowed_foir),
      details: `FOIR: ${foir.toFixed(2)}%`
    };

    // Existing loans (mock - would need actual data)
    const activeAccounts = (creditBureau?.response_data as any)?.active_accounts || 0;
    checks.existing_loans = {
      passed: activeAccounts <= 3,
      details: `Active loan accounts: ${activeAccounts}`
    };

    setPolicyChecks(checks);
    return checks;
  };

  const handleCalculate = () => {
    const foir = calculateFOIR();
    const eligibleAmount = calculateEligibleAmount();
    const checks = runPolicyChecks();

    setFormData({
      ...formData,
      foir_percentage: foir.toString(),
      eligible_loan_amount: eligibleAmount.toString(),
    });

    setHasCalculated(true);
    toast({ title: "Eligibility calculated successfully" });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const eligibleAmount = parseFloat(formData.eligible_loan_amount) || 0;
      const dailyInterestRate = parseFloat(formData.recommended_interest_rate) || 1;
      const tenureDays = parseInt(formData.recommended_tenure) || 30;
      
      // Calculate loan values using consistent formula (single source of truth)
      const totalInterest = eligibleAmount * (dailyInterestRate / 100) * tenureDays;
      const totalRepayment = eligibleAmount + totalInterest;
      
      const eligibilityData = {
        loan_application_id: applicationId,
        calculation_date: new Date().toISOString(),
        gross_income: parseFloat(formData.gross_income) || 0,
        net_income: parseFloat(formData.net_income) || 0,
        total_deductions: parseFloat(formData.total_deductions) || 0,
        existing_emi_obligations: parseFloat(formData.existing_emi_obligations) || 0,
        proposed_emi: parseFloat(formData.proposed_emi) || 0,
        foir_percentage: parseFloat(formData.foir_percentage) || 0,
        max_allowed_foir: parseFloat(formData.max_allowed_foir) || 50,
        eligible_loan_amount: eligibleAmount,
        recommended_tenure_days: tenureDays,
        recommended_interest_rate: dailyInterestRate,
        // Store calculated values - single source of truth
        total_interest: Math.round(totalInterest * 100) / 100,
        total_repayment: Math.round(totalRepayment * 100) / 100,
        daily_emi: 0, // ADHO model - no daily EMI
        policy_checks: policyChecks,
        is_eligible: POLICY_RULES.filter(r => r.critical).every(r => policyChecks[r.key]?.passed),
        calculation_details: {
          foir_formula: "(Existing EMI + Proposed EMI) / Net Income * 100",
          eligible_amount_formula: "Based on FOIR and tenure",
          interest_formula: "Principal × (Daily Rate / 100) × Tenure Days"
        }
      };

      if (existingEligibility) {
        const { error } = await supabase
          .from("loan_eligibility")
          .update(eligibilityData)
          .eq("id", existingEligibility.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_eligibility")
          .insert(eligibilityData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-eligibility", applicationId] });
      toast({ title: "Eligibility saved successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save eligibility",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const allCriticalChecksPassed = POLICY_RULES
    .filter(rule => rule.critical)
    .every(rule => policyChecks[rule.key]?.passed);

  const approveMutation = useMutation({
    mutationFn: async () => {
      // First save the eligibility data
      await saveMutation.mutateAsync();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Calculate the approved amount (lesser of requested and eligible)
      const requestedAmount = parseFloat(formData.loan_amount) || 0;
      const eligibleAmount = parseFloat(formData.eligible_loan_amount) || 0;
      const approvedAmount = eligibleAmount > 0 ? Math.min(requestedAmount, eligibleAmount) : requestedAmount;
      
      // Get tenure in days (convert from months if needed)
      const tenureDays = parseInt(formData.recommended_tenure) || null;
      
      // Get the recommended interest rate
      const interestRate = parseFloat(formData.recommended_interest_rate) || null;
      
      // Fetch current stage dynamically to avoid stale-stage mismatch
      const { data: currentApp } = await supabase
        .from("loan_applications")
        .select("current_stage")
        .eq("id", applicationId)
        .single();

      const currentStage = currentApp?.current_stage;
      if (!currentStage || !["assessment", "credit_assessment"].includes(currentStage)) {
        throw new Error("Application is no longer in assessment stage. Please refresh and try again.");
      }

      // Update application with approved values - guarded stage transition
      const { data: transitionResult, error } = await supabase
        .rpc("transition_loan_stage", {
          p_application_id: applicationId,
          p_expected_current_stage: currentStage,
          p_new_stage: "approval_pending",
          p_new_status: "in_progress",
          p_approved_amount: approvedAmount,
          p_tenure_days: tenureDays,
          p_interest_rate: interestRate,
        });

      if (error) throw error;
      if (!transitionResult) throw new Error("Application stage has changed. Please refresh and try again.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId, orgId] });
      toast({ title: "Application approved successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      // First save the eligibility data
      await saveMutation.mutateAsync();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch current stage dynamically to avoid stale-stage mismatch
      const { data: currentApp } = await supabase
        .from("loan_applications")
        .select("current_stage")
        .eq("id", applicationId)
        .single();

      const currentStage = currentApp?.current_stage;
      if (!currentStage || !["assessment", "credit_assessment"].includes(currentStage)) {
        throw new Error("Application is no longer in assessment stage. Please refresh and try again.");
      }

      // Then update application status - guarded stage transition
      const { data: transitionResult, error } = await supabase
        .rpc("transition_loan_stage", {
          p_application_id: applicationId,
          p_expected_current_stage: currentStage,
          p_new_stage: "rejected",
          p_new_status: "rejected",
        });

      if (error) throw error;
      if (!transitionResult) throw new Error("Application stage has changed. Please refresh and try again.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId, orgId] });
      toast({ title: "Application rejected" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = () => {
    if (!remarks.trim()) {
      setRemarksError("Remarks are mandatory before approval");
      return;
    }
    setRemarksError("");
    approveMutation.mutate();
  };

  const handleReject = () => {
    if (!remarks.trim()) {
      setRemarksError("Remarks are mandatory before rejection");
      return;
    }
    setRemarksError("");
    rejectMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Max Eligibility Banner */}
      {formData.net_income && parseFloat(formData.net_income) > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Maximum Eligible Loan Amount</p>
                  <p className="text-2xl font-bold text-primary">
                    ₹{maxEligibleAmount.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Based on {formData.max_allowed_foir}% FOIR</p>
                <p>{formData.recommended_tenure} days @ {formData.recommended_interest_rate}%/day</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Income & Obligations</CardTitle>
              <CardDescription>
                {incomeFromSalarySlips 
                  ? `Auto-populated from ${incomeFromSalarySlips.slipsCount} salary slip(s)` 
                  : "Enter applicant's income and existing obligations"}
              </CardDescription>
            </div>
            <Calculator className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Gross Monthly Income (₹)</Label>
              <Input
                type="number"
                value={formData.gross_income}
                onChange={(e) => setFormData({ ...formData, gross_income: e.target.value })}
                placeholder="100000"
              />
            </div>
            <div>
              <Label>Total Deductions (₹)</Label>
              <Input
                type="number"
                value={formData.total_deductions}
                onChange={(e) => setFormData({ ...formData, total_deductions: e.target.value })}
                placeholder="25000"
              />
            </div>
            <div>
              <Label>Net Monthly Income (₹)</Label>
              <Input
                type="number"
                value={formData.net_income}
                readOnly
                className="bg-muted"
                placeholder="Auto-calculated"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Existing EMI Obligations (₹)</Label>
              <Input
                type="number"
                value={formData.existing_emi_obligations}
                onChange={(e) => setFormData({ ...formData, existing_emi_obligations: e.target.value })}
                placeholder="15000"
              />
            </div>
            <div>
              <Label>Loan Amount Requested (₹)</Label>
              <Input
                type="number"
                value={formData.loan_amount}
                onChange={(e) => setFormData({ ...formData, loan_amount: e.target.value })}
                placeholder="50000"
              />
            </div>
            <div>
              <Label>Max Allowed FOIR (%)</Label>
              <Input
                type="number"
                value={formData.max_allowed_foir}
                onChange={(e) => setFormData({ ...formData, max_allowed_foir: e.target.value })}
                placeholder="50"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Recommended Tenure (days)</Label>
              <Input
                type="number"
                value={formData.recommended_tenure}
                onChange={(e) => setFormData({ ...formData, recommended_tenure: e.target.value })}
                placeholder="30"
              />
            </div>
            <div>
              <Label>Interest Rate (% per day)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.recommended_interest_rate}
                onChange={(e) => setFormData({ ...formData, recommended_interest_rate: e.target.value })}
                placeholder="1"
              />
            </div>
            <div>
              <Label>Total Repayment (₹)</Label>
              <Input
                type="number"
                value={formData.proposed_emi}
                readOnly
                className="bg-muted"
                placeholder="Auto-calculated"
              />
            </div>
          </div>

          <Button onClick={handleCalculate} className="w-full">
            <Calculator className="mr-2 h-4 w-4" />
            Calculate Eligibility
          </Button>
        </CardContent>
      </Card>

      {hasCalculated && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Calculation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">FOIR</div>
                  <div className="text-2xl font-bold">{formData.foir_percentage}%</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Eligible Amount</div>
                  <div className="text-2xl font-bold">
                    ₹{parseFloat(formData.eligible_loan_amount).toLocaleString()}
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge className={allCriticalChecksPassed ? "bg-green-500" : "bg-red-500"}>
                    {allCriticalChecksPassed ? "Eligible" : "Not Eligible"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Policy Checks</CardTitle>
              <CardDescription>Automated policy rule validation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {POLICY_RULES.map((rule) => {
                  const check = policyChecks[rule.key];
                  if (!check) return null;

                  return (
                    <div
                      key={rule.key}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {check.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {rule.name}
                            {rule.critical && (
                              <Badge variant="outline" className="text-xs">Critical</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{rule.description}</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">{check.details}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Loan Summary Card */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Loan Summary
              </CardTitle>
              <CardDescription>Final loan amount and repayment details</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const requestedAmount = parseFloat(formData.loan_amount || "0");
                const eligibleAmount = parseFloat(formData.eligible_loan_amount || "0");
                const approvedAmount = Math.min(requestedAmount, eligibleAmount);
                const dailyRate = parseFloat(formData.recommended_interest_rate || "1") / 100;
                const tenure = parseInt(formData.recommended_tenure || "30");
                const interestAmount = Math.round(approvedAmount * dailyRate * tenure);
                const totalRepayment = Math.round(approvedAmount + interestAmount);

                return (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="p-4 bg-background rounded-lg border border-primary/50">
                      <div className="text-sm text-muted-foreground">Approved Loan Amount</div>
                      <div className="text-2xl font-bold text-primary">
                        ₹{approvedAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {approvedAmount === requestedAmount ? "As requested" : "Based on eligibility"}
                      </div>
                    </div>
                    <div className="p-4 bg-background rounded-lg border">
                      <div className="text-sm text-muted-foreground">Interest Amount</div>
                      <div className="text-2xl font-bold">
                        ₹{interestAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        @ {formData.recommended_interest_rate}% per day × {tenure} days
                      </div>
                    </div>
                    <div className="p-4 bg-background rounded-lg border">
                      <div className="text-sm text-muted-foreground">Total Repayment</div>
                      <div className="text-2xl font-bold">
                        ₹{totalRepayment.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Principal + Interest
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {!isFinalized ? (
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
                <CardDescription>Provide remarks and approve or reject the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Remarks <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value);
                      if (e.target.value.trim()) setRemarksError("");
                    }}
                    placeholder="Enter remarks before approval or rejection..."
                    className={remarksError ? "border-destructive" : ""}
                    rows={3}
                  />
                  {remarksError && (
                    <p className="text-sm text-destructive mt-1">{remarksError}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleApprove}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    {approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
                <CardDescription>
                  Application has already been {application?.status?.toUpperCase()}
                  {((application?.approved_by_profile as any)?.first_name || (application?.approved_by_profile as any)?.last_name) && (
                    <span>
                      {" "}
                      by
                      {" "}
                      {[(application?.approved_by_profile as any)?.first_name, (application?.approved_by_profile as any)?.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                  {application?.updated_at && (
                    <span className="block mt-1">
                      on {new Date(application.updated_at).toLocaleDateString('en-IN', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric' 
                      })} at {new Date(application.updated_at).toLocaleTimeString('en-IN', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
