import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Banknote,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Calendar,
  IndianRupee,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LoanListItem } from "@/hooks/useLoansList";

interface LoanDetailDialogProps {
  loan: LoanListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  on_track: { label: "On Track", color: "bg-green-100 text-green-800", icon: <TrendingUp className="h-3 w-3" /> },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
  completed: { label: "Settled", color: "bg-blue-100 text-blue-800", icon: <CheckCircle className="h-3 w-3" /> },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export function LoanDetailDialog({ loan, open, onOpenChange }: LoanDetailDialogProps) {
  const navigate = useNavigate();

  if (!loan) return null;

  const status = statusConfig[loan.paymentStatus];

  const handleViewApplication = () => {
    navigate(`/los/applications/${loan.applicationId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Loan {loan.loanId}
            </span>
            <Button onClick={handleViewApplication} size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              View Application
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Status Badge */}
            <Badge className={status.color}>
              <span className="flex items-center gap-1">
                {status.icon}
                {status.label}
              </span>
            </Badge>

            {/* Borrower Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Borrower Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{loan.applicantName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">PAN</p>
                    <p className="font-medium font-mono">{loan.panNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mobile</p>
                    <p className="font-medium">{loan.mobile}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Application</p>
                    <p className="font-medium font-mono">{loan.applicationNumber}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sanctioned Amount</p>
                    <p className="font-semibold">{formatCurrency(loan.sanctionedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Disbursed Amount</p>
                    <p className="font-semibold text-primary">{formatCurrency(loan.disbursedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Outstanding</p>
                    <p className={`font-semibold ${loan.outstandingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(loan.outstandingAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loan Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Loan Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Disbursement Date</p>
                    <p className="font-medium">
                      {loan.disbursementDate ? format(new Date(loan.disbursementDate), "dd MMM yyyy") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tenure</p>
                    <p className="font-medium">{loan.tenureDays} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {loan.dueDate ? format(new Date(loan.dueDate), "dd MMM yyyy") : "—"}
                    </p>
                  </div>
                  {loan.daysOverdue > 0 && (
                    <div>
                      <p className="text-muted-foreground">Days Overdue</p>
                      <p className="font-semibold text-red-600">{loan.daysOverdue}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Overdue Warning */}
            {loan.daysOverdue > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">
                        Payment overdue by {loan.daysOverdue} days
                      </p>
                      <p className="text-sm text-red-600">
                        Due date was {loan.dueDate ? format(new Date(loan.dueDate), "dd MMM yyyy") : "—"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
