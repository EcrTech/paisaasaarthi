import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Eye,
  Banknote,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { LoanListItem } from "@/hooks/useLoansList";

interface LoanCardProps {
  loan: LoanListItem;
  onViewDetails: (loan: LoanListItem) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  on_track: {
    label: "On Track",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <TrendingUp className="h-3 w-3" />
  },
  overdue: {
    label: "Overdue",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <AlertCircle className="h-3 w-3" />
  },
  completed: {
    label: "Settled",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <CheckCircle className="h-3 w-3" />
  },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export function LoanCard({ loan, onViewDetails }: LoanCardProps) {
  const status = statusConfig[loan.paymentStatus];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Loan Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                <span className="font-mono font-semibold text-foreground">
                  {loan.loanId}
                </span>
              </div>
              <Badge className={status.color}>
                <span className="flex items-center gap-1">
                  {status.icon}
                  {status.label}
                </span>
              </Badge>
            </div>

            {/* Applicant Info */}
            <div className="text-sm text-muted-foreground mb-3">
              <span className="font-medium text-foreground">{loan.applicantName}</span>
              <span className="mx-2">&bull;</span>
              <span className="font-mono">{loan.panNumber}</span>
              <span className="mx-2">&bull;</span>
              <span>{loan.mobile}</span>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Disbursed</p>
                <p className="font-semibold">{formatCurrency(loan.disbursedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className={`font-semibold ${loan.outstandingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {formatCurrency(loan.outstandingAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Due Date & Actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {loan.paymentStatus === "completed" ? (
              <div className="text-right p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Settled
                </p>
              </div>
            ) : loan.dueDate ? (
              <div className={`text-right p-3 rounded-lg ${loan.daysOverdue > 0 ? 'bg-red-50' : 'bg-muted/50'}`}>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due Date
                </p>
                <p className="font-medium text-sm">
                  {format(new Date(loan.dueDate), "dd MMM yyyy")}
                </p>
                {loan.daysOverdue > 0 && (
                  <p className="text-xs text-red-600 font-medium mt-1">
                    {loan.daysOverdue} days overdue
                  </p>
                )}
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(loan)}
              className="mt-2"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>App: {loan.applicationNumber}</span>
            <span>Tenure: {loan.tenureDays} days</span>
          </div>
          {loan.disbursementDate && (
            <span>Disbursed: {format(new Date(loan.disbursementDate), "dd MMM yyyy")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
