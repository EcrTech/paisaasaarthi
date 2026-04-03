import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEMISchedule } from "@/hooks/useEMISchedule";
import { Calendar, Calculator } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateLoanDetails, formatCurrency } from "@/utils/loanCalculations";

interface EMIScheduleGeneratorProps {
  applicationId: string;
  // Single source of truth: loan details from loan_applications
  application: {
    approved_amount: number;
    interest_rate: number; // Daily interest rate (e.g., 1 for 1%)
    tenure_days: number;
  };
  sanction: {
    id: string;
  };
  disbursement: {
    disbursement_date: string;
  };
}

export default function EMIScheduleGenerator({
  applicationId,
  application,
  sanction,
  disbursement,
}: EMIScheduleGeneratorProps) {
  const { schedule, generateSchedule, isGenerating } = useEMISchedule(applicationId);

  // Use shared calculation utility (daily flat rate model)
  const loanDetails = calculateLoanDetails(
    application.approved_amount,
    application.interest_rate,
    application.tenure_days
  );

  if (schedule && schedule.length > 0) {
    return (
      <Alert>
        <Calculator className="h-4 w-4" />
        <AlertDescription>
          Repayment schedule has already been generated with {schedule.length} payment(s).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Generate Repayment Schedule
        </CardTitle>
        <CardDescription>
          Create a bullet payment schedule based on the approved loan terms
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Loan Amount</div>
            <div className="text-lg font-semibold">
              {formatCurrency(application.approved_amount)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Interest Rate</div>
            <div className="text-lg font-semibold">{application.interest_rate}% per day</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Tenure</div>
            <div className="text-lg font-semibold">{application.tenure_days} days</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Total Repayment</div>
            <div className="text-lg font-semibold text-primary">
              {formatCurrency(loanDetails.totalRepayment)}
            </div>
          </div>

          <div className="space-y-1 md:col-span-2">
            <div className="text-sm text-muted-foreground">Disbursement Date</div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {new Date(disbursement.disbursement_date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="text-sm font-medium">Total Repayment</div>
          <div className="text-2xl font-bold">
            {formatCurrency(loanDetails.totalRepayment)}
          </div>
          <div className="text-xs text-muted-foreground">
            Total Interest: {formatCurrency(loanDetails.totalInterest)}
          </div>
        </div>

        <Button
          onClick={() =>
            generateSchedule({
              applicationId,
              sanctionId: sanction.id,
              loanAmount: application.approved_amount,
              interestRate: application.interest_rate,
              tenureDays: application.tenure_days,
              disbursementDate: disbursement.disbursement_date,
            })
          }
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? "Generating..." : "Generate Repayment Schedule"}
        </Button>
      </CardContent>
    </Card>
  );
}
