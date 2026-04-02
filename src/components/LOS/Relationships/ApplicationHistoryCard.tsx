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

import { STAGE_LABELS as stageLabels, STAGE_BADGE_VARIANTS as stageBadgeVariants } from "@/constants/loanStages";

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
    <Card className={`border-l-4 ${application.daysOverdue > 0 ? 'border-l-red-500' : 'border-l-primary/50'}`}>
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
            {application.daysOverdue > 0 && (
              <Badge variant="destructive">
                {application.daysOverdue}d overdue
              </Badge>
            )}
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t">
          <div>
            <p className="text-muted-foreground text-xs">Disbursement Date</p>
            <p>{formatDate(application.disbursementDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Due Date</p>
            <p className={application.daysOverdue > 0 ? "text-red-600 font-medium" : ""}>
              {formatDate(application.dueDate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tenure</p>
            <p>{application.tenureDays} days</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
