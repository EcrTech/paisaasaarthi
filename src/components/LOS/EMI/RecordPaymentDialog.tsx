import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEMIPayments } from "@/hooks/useEMIPayments";
import { IndianRupee } from "lucide-react";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emiSchedule: any;
  applicationId: string;
}

export default function RecordPaymentDialog({
  open,
  onOpenChange,
  emiSchedule,
  applicationId,
}: RecordPaymentDialogProps) {
  const { recordPayment, isRecording } = useEMIPayments(applicationId);
  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [paymentAmount, setPaymentAmount] = useState(
    emiSchedule.total_emi - emiSchedule.amount_paid
  );
  const [paymentMethod, setPaymentMethod] = useState("neft");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const remainingAmount = emiSchedule.total_emi - emiSchedule.amount_paid;
    const actualPayment = Math.min(paymentAmount, remainingAmount);

    // Calculate principal and interest proportions
    const totalEMI = emiSchedule.total_emi;
    const principalRatio = emiSchedule.principal_amount / totalEMI;
    const interestRatio = emiSchedule.interest_amount / totalEMI;

    recordPayment(
      {
        scheduleId: emiSchedule.id,
        applicationId,
        paymentDate,
        paymentAmount: actualPayment,
        principalPaid: actualPayment * principalRatio,
        interestPaid: actualPayment * interestRatio,
        lateFeePaid: 0,
        paymentMethod,
        transactionReference: transactionRef || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const remainingAmount = emiSchedule.total_emi - emiSchedule.amount_paid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Record Payment - EMI #{emiSchedule.emi_number}
          </DialogTitle>
          <DialogDescription>
            Record a payment for this EMI installment
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 bg-primary/10 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total EMI:</span>
              <span className="font-semibold">
                {formatCurrency(emiSchedule.total_emi)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Already Paid:</span>
              <span className="font-semibold">
                {formatCurrency(emiSchedule.amount_paid)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-bold text-primary text-lg">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment Date *</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount *</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              max={remainingAmount}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="neft">NEFT</SelectItem>
                <SelectItem value="rtgs">RTGS</SelectItem>
                <SelectItem value="imps">IMPS</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-ref">Transaction Reference</Label>
            <Input
              id="transaction-ref"
              placeholder="UTR / Transaction ID"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this payment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isRecording || paymentAmount <= 0}
              className="flex-1"
            >
              {isRecording ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
