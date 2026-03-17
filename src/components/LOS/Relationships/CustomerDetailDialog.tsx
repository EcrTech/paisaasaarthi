import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Phone,
  Mail,
  CreditCard,
  FileText,
  RefreshCw,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  Shield,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { ApplicationHistoryCard } from "./ApplicationHistoryCard";

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

  const initials = customer.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Customer Details</span>
            <Button onClick={handleShareReferralLink}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Share Referral Link
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Customer Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <Avatar className="h-24 w-24 border-2 border-border">
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{customer.name}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CreditCard className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">PAN</p>
                        <p className="font-medium font-mono">{customer.panNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Aadhaar</p>
                        <p className="font-medium">{customer.aadhaarNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Mobile</p>
                        <p className="font-medium">{customer.mobile}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{customer.email || "—"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Activity</p>
                      <p className="font-medium">
                        {customer.lastActivityDate
                          ? format(new Date(customer.lastActivityDate), "dd MMM yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{customer.totalLoans}</p>
                      <p className="text-xs text-muted-foreground">Loans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(customer.disbursedAmount)}</p>
                      <p className="text-xs text-muted-foreground">Disbursed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(customer.outstandingAmount)}</p>
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold">{customer.overdueLoans}</p>
                      <p className="text-xs text-muted-foreground">Overdue Loans</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Warning */}
            {customer.overdueLoans > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800">
                        {customer.overdueLoans} overdue loan{customer.overdueLoans > 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-red-600">
                        Max {customer.maxDaysOverdue} days overdue
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Application History */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Loan History ({customer.applications.length})
              </h3>
              <div className="space-y-3">
                {customer.applications.map((app) => (
                  <ApplicationHistoryCard key={app.applicationId} application={app} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
