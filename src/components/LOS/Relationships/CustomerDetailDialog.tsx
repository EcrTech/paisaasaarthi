import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { STAGE_LABELS, STAGE_BADGE_VARIANTS } from "@/constants/loanStages";

interface CustomerDetailDialogProps {
  customer: CustomerRelationship | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export function CustomerDetailDialog({
  customer,
  open,
  onOpenChange
}: CustomerDetailDialogProps) {
  const navigate = useNavigate();

  if (!customer) return null;

  const handleShareReferralLink = () => {
    navigate("/los/my-referrals");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Customer Details</span>
            <Button size="sm" onClick={handleShareReferralLink}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Share Referral Link
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Compact Customer Overview */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-2 text-sm border rounded-lg p-4 bg-muted/30">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">Name</p>
                <p className="font-semibold">{customer.name}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">PAN</p>
                <p className="font-mono font-medium">{customer.panNumber}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">Aadhaar</p>
                <p className="font-medium">{customer.aadhaarNumber}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">Mobile</p>
                <p className="font-medium">{customer.mobile}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">Email</p>
                <p className="font-medium truncate">{customer.email || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">Last Activity</p>
                <p className="font-medium">
                  {customer.lastActivityDate ? format(new Date(customer.lastActivityDate), "dd MMM yyyy") : "—"}
                </p>
              </div>
            </div>

            {/* Compact Financial Summary — single row of inline stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm px-1">
              <span className="font-semibold">{customer.totalLoans} Loan{customer.totalLoans !== 1 ? "s" : ""}</span>
              <span className="text-muted-foreground">|</span>
              <span>Disbursed: <strong>{formatCurrency(customer.disbursedAmount)}</strong></span>
              <span className="text-muted-foreground">|</span>
              <span>Outstanding: <strong className={customer.outstandingAmount > 0 ? "text-orange-600" : "text-green-600"}>{formatCurrency(customer.outstandingAmount)}</strong></span>
              {customer.overdueLoans > 0 && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {customer.overdueLoans} overdue (max {customer.maxDaysOverdue}d)
                  </span>
                </>
              )}
            </div>

            {/* Loan History — Table */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Loan History ({customer.applications.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Loan ID</TableHead>
                      <TableHead className="text-xs font-semibold">Application #</TableHead>
                      <TableHead className="text-xs font-semibold">Stage</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Requested</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Approved</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Disbursed</TableHead>
                      <TableHead className="text-xs font-semibold">Disb. Date</TableHead>
                      <TableHead className="text-xs font-semibold">Due Date</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Tenure</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Overdue</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.applications.map((app) => (
                      <TableRow key={app.applicationId} className={app.daysOverdue > 0 ? "bg-red-50/50" : ""}>
                        <TableCell className="font-mono text-xs font-medium">{app.loanId || "—"}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => navigate(`/los/applications/${app.applicationId}?mode=review`)}
                            className="text-primary hover:underline font-mono text-xs font-medium"
                          >
                            {app.applicationNumber}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STAGE_BADGE_VARIANTS[app.currentStage] || "outline"} className="text-[10px]">
                            {STAGE_LABELS[app.currentStage] || app.currentStage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(app.requestedAmount)}</TableCell>
                        <TableCell className="text-right text-xs">{app.approvedAmount ? formatCurrency(app.approvedAmount) : "—"}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{app.disbursedAmount ? formatCurrency(app.disbursedAmount) : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {app.disbursementDate ? format(new Date(app.disbursementDate), "dd MMM yy") : "—"}
                        </TableCell>
                        <TableCell className={`text-xs ${app.daysOverdue > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          {app.dueDate ? format(new Date(app.dueDate), "dd MMM yy") : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs">{app.tenureDays}d</TableCell>
                        <TableCell className="text-center text-xs">
                          {app.daysOverdue > 0 ? (
                            <span className="text-red-600 font-medium">{app.daysOverdue}d</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => navigate(`/los/applications/${app.applicationId}?mode=review`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
