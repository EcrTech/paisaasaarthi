import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollectionRecord } from "@/hooks/useCollections";
import { IndianRupee } from "lucide-react";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: CollectionRecord | null;
  onSubmit: (data: {
    scheduleId: string;
    applicationId: string;
    paymentDate: string;
    paymentAmount: number;
    principalPaid: number;
    interestPaid: number;
    lateFeePaid: number;
    paymentMethod: string;
    transactionReference?: string;
    notes?: string;
  }) => void;
  isSubmitting: boolean;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  record,
  onSubmit,
  isSubmitting,
}: RecordPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>("upi");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Recalculate interest pro-rata based on payment date
  const getAdjustedDue = () => {
    if (!record || !record.disbursement_date || !record.interest_rate) {
      return { adjustedInterest: record?.interest || 0, adjustedTotal: record?.total_emi || 0 };
    }

    const disbDate = new Date(record.disbursement_date);
    const pmtDate = new Date(paymentDate);
    const actualDays = Math.max(1, Math.round((pmtDate.getTime() - disbDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Interest = Principal × Rate% × Days / 365
    const adjustedInterest = Math.round(record.principal * (record.interest_rate / 100) * actualDays / 365);
    const adjustedTotal = record.principal + adjustedInterest;

    return { adjustedInterest, adjustedTotal, actualDays };
  };

  const { adjustedInterest, adjustedTotal, actualDays } = getAdjustedDue();
  const adjustedRemaining = Math.max(0, adjustedTotal - record!?.amount_paid || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    const amount = parseFloat(paymentAmount) || 0;
    const principalPaid = Math.min(amount, record.principal - (record.amount_paid > adjustedInterest ? record.amount_paid - adjustedInterest : 0));
    const interestPaid = amount - principalPaid;

    onSubmit({
      scheduleId: record.id,
      applicationId: record.loan_application_id,
      paymentDate,
      paymentAmount: amount,
      principalPaid: Math.max(0, principalPaid),
      interestPaid: Math.max(0, interestPaid),
      lateFeePaid: 0,
      paymentMethod,
      transactionReference: transactionRef || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setPaymentAmount("");
    setTransactionRef("");
    setNotes("");
    setPaymentMethod("upi");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Application:</span>
                <span className="font-medium">{record.application_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applicant:</span>
                <span className="font-medium">{record.applicant_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Principal:</span>
                <span className="font-medium">{formatCurrency(record.principal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Interest ({actualDays || record.tenure_days} days @ {record.interest_rate}%):
                </span>
                <span className="font-medium">{formatCurrency(adjustedInterest)}</span>
              </div>
              {adjustedTotal !== record.total_emi && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Original due (full tenure):</span>
                  <span className="line-through text-muted-foreground">{formatCurrency(record.total_emi)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adjusted Due:</span>
                <span className="font-medium">{formatCurrency(adjustedTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-medium text-green-600">{formatCurrency(record.amount_paid)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground font-medium">Remaining:</span>
                <span className="font-bold text-primary">{formatCurrency(adjustedRemaining)}</span>
              </div>
              {adjustedRemaining <= 0 && (
                <div className="text-xs text-green-600 font-medium mt-1">
                  Loan fully settled based on payment date
                </div>
              )}
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="nach">NACH</SelectItem>
                  <SelectItem value="neft">NEFT</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="imps">IMPS</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount Received</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder={adjustedRemaining.toString()}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
              {adjustedRemaining > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPaymentAmount(adjustedRemaining.toString())}
                >
                  Fill full amount ({formatCurrency(adjustedRemaining)})
                </Button>
              )}
            </div>

            {/* Transaction Reference */}
            <div className="space-y-2">
              <Label htmlFor="transactionRef">Transaction Reference</Label>
              <Input
                id="transactionRef"
                placeholder="UTR / Reference Number"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !paymentAmount}>
              {isSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
