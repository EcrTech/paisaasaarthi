import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LoanApplicationSummary } from "@/hooks/useCustomerRelationships";

interface ApplicationHistoryCardProps {
  application: LoanApplicationSummary;
}

const stageLabels: Record<string, string> = {
  application_login: "Application Login",
  document_collection: "Document Collection",
  verification: "Verification",
  credit_assessment: "Credit Assessment",
  approval_pending: "Approval Pending",
  approved: "Approved",
  rejected: "Rejected",
  sanctioned: "Sanctioned",
  agreement_pending: "Agreement Pending",
  disbursement_pending: "Disbursement Pending",
  disbursed: "Disbursed",
  closed: "Closed",
};

const stageBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  application_login: "outline",
  document_collection: "outline",
  verification: "secondary",
  credit_assessment: "secondary",
  approval_pending: "secondary",
  approved: "default",
  rejected: "destructive",
  sanctioned: "default",
  agreement_pending: "secondary",
  disbursement_pending: "secondary",
  disbursed: "default",
  closed: "outline",
};

export function ApplicationHistoryCard({ application }: ApplicationHistoryCardProps) {
  const navigate = useNavigate();

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd MMM yyyy");
  };

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-sm font-medium">
                {application.loanId || application.applicationNumber}
              </CardTitle>
              {application.loanId && (
                <p className="text-xs text-muted-foreground">{application.applicationNumber}</p>
              )}
            </div>
            <Badge variant={stageBadgeVariants[application.currentStage] || "outline"}>
              {stageLabels[application.currentStage] || application.currentStage}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/los/applications/${application.applicationId}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Requested</p>
            <p className="font-medium">{formatCurrency(application.requestedAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Approved</p>
            <p className="font-medium">{formatCurrency(application.approvedAmount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Disbursed</p>
            <p className="font-medium">{formatCurrency(application.disbursedAmount || null)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t">
          <div>
            <p className="text-muted-foreground text-xs">Application Date</p>
            <p>{formatDate(application.createdAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Disbursement Date</p>
            <p>{formatDate(application.disbursementDate)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
