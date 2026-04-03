import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEMISchedule } from "@/hooks/useEMISchedule";
import { Calendar, IndianRupee } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import RecordPaymentDialog from "./RecordPaymentDialog";

interface EMIScheduleTableProps {
  applicationId: string;
}

export default function EMIScheduleTable({ applicationId }: EMIScheduleTableProps) {
  const { schedule, isLoading } = useEMISchedule(applicationId);
  const [selectedEMI, setSelectedEMI] = useState<any>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any }> = {
      paid: { label: "Paid", variant: "default" },
      pending: { label: "Pending", variant: "secondary" },
      overdue: { label: "Overdue", variant: "destructive" },
      partially_paid: { label: "Partial", variant: "outline" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return <LoadingState message="Loading repayment schedule..." />;
  }

  if (!schedule || schedule.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No repayment schedule generated yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPrincipal = schedule.reduce((sum, emi) => sum + emi.principal_amount, 0);
  const totalInterest = schedule.reduce((sum, emi) => sum + emi.interest_amount, 0);
  const totalAmount = schedule.reduce((sum, emi) => sum + emi.total_emi, 0);
  const amountPaid = schedule.reduce((sum, emi) => sum + emi.amount_paid, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Repayment Schedule
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {schedule.length} payment(s)
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Principal</div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(totalPrincipal)}
              </div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Interest</div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalInterest)}
              </div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-sm text-muted-foreground">Amount Paid</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatCurrency(amountPaid)}
              </div>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-sm text-muted-foreground">Balance</div>
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalAmount - amountPaid)}
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((emi) => (
                  <TableRow key={emi.id}>
                    <TableCell className="font-medium">{emi.emi_number}</TableCell>
                    <TableCell>{formatDate(emi.due_date)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(emi.principal_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(emi.interest_amount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(emi.total_emi)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(emi.amount_paid)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(emi.outstanding_principal)}
                    </TableCell>
                    <TableCell>{getStatusBadge(emi.status)}</TableCell>
                    <TableCell className="text-right">
                      {emi.status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedEMI(emi)}
                        >
                          <IndianRupee className="h-3 w-3 mr-1" />
                          Pay
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedEMI && (
        <RecordPaymentDialog
          open={!!selectedEMI}
          onOpenChange={(open) => !open && setSelectedEMI(null)}
          emiSchedule={selectedEMI}
          applicationId={applicationId}
        />
      )}
    </>
  );
}
