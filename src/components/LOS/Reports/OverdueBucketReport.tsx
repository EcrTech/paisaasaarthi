import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { calcDaysOverdue, getTodayIST } from "@/utils/loanCalculations";

interface OverdueRecord {
  id: string;
  loan_application_id: string;
  emi_number: number;
  due_date: string;
  total_emi: number;
  amount_paid: number;
  principal: number;
  interest: number;
  application_number: string;
  loan_id: string | null;
  applicant_name: string;
  applicant_phone: string;
  days_overdue: number;
  bucket: string;
}

export default function OverdueBucketReport() {
  const { orgId } = useOrgContext();

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["od-bucket-report", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayment_schedule")
        .select(`
          id,
          loan_application_id,
          emi_number,
          due_date,
          total_emi,
          amount_paid,
          principal_amount,
          interest_amount,
          status,
          loan_applications:loan_application_id(
            application_number,
            loan_id,
            loan_applicants(first_name, last_name, mobile)
          )
        `)
        .eq("org_id", orgId!)
        .in("status", ["pending", "partially_paid"])
        .lt("due_date", getTodayIST())
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const overdueRecords: OverdueRecord[] = useMemo(() => {
    return rawData.map((item: any) => {
      const daysOverdue = calcDaysOverdue(item.due_date);
      const applicant = item.loan_applications?.loan_applicants?.[0];

      let bucket = "1-30 days";
      if (daysOverdue > 90) bucket = "90+ days";
      else if (daysOverdue > 60) bucket = "61-90 days";
      else if (daysOverdue > 30) bucket = "31-60 days";

      return {
        id: item.id,
        loan_application_id: item.loan_application_id,
        emi_number: item.emi_number,
        due_date: item.due_date,
        total_emi: item.total_emi,
        amount_paid: item.amount_paid || 0,
        principal: item.principal_amount,
        interest: item.interest_amount,
        application_number: item.loan_applications?.application_number || "N/A",
        loan_id: item.loan_applications?.loan_id || null,
        applicant_name: applicant
          ? `${applicant.first_name} ${applicant.last_name || ""}`.trim()
          : "N/A",
        applicant_phone: applicant?.mobile || "",
        days_overdue: daysOverdue,
        bucket,
      };
    });
  }, [rawData]);

  const bucketSummary = useMemo(() => {
    const buckets = {
      "1-30 days": { count: 0, amount: 0, color: "bg-yellow-500" },
      "31-60 days": { count: 0, amount: 0, color: "bg-orange-500" },
      "61-90 days": { count: 0, amount: 0, color: "bg-red-500" },
      "90+ days": { count: 0, amount: 0, color: "bg-red-800" },
    };

    overdueRecords.forEach((r) => {
      const b = buckets[r.bucket as keyof typeof buckets];
      if (b) {
        b.count++;
        b.amount += r.total_emi - r.amount_paid;
      }
    });

    return buckets;
  }, [overdueRecords]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  const exportToCSV = () => {
    if (overdueRecords.length === 0) return;
    const headers = "Loan ID,App#,Applicant,Phone,EMI#,Due Date,EMI Amount,Paid,Balance,Days Overdue,Bucket";
    const rows = overdueRecords.map((r) =>
      [
        r.loan_id || "",
        r.application_number,
        r.applicant_name,
        r.applicant_phone,
        r.emi_number,
        r.due_date,
        r.total_emi,
        r.amount_paid,
        r.total_emi - r.amount_paid,
        r.days_overdue,
        r.bucket,
      ].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `od_bucket_report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bucket Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Object.entries(bucketSummary).map(([bucket, data]) => (
          <Card key={bucket} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{bucket}</p>
                <p className="text-xl font-bold">{data.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(data.amount)}</p>
              </div>
              <Badge className={`${data.color} text-white`}>{bucket.split(" ")[0]}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Total Summary */}
      <Card className="p-4 bg-destructive/5 border-destructive/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold">Total Overdue</p>
              <p className="text-sm text-muted-foreground">
                {overdueRecords.length} EMIs • {formatCurrency(overdueRecords.reduce((s, r) => s + (r.total_emi - r.amount_paid), 0))} outstanding
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={overdueRecords.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Overdue EMI Details</CardTitle>
          <CardDescription>All overdue EMIs categorized by aging buckets</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs py-2">Loan ID</TableHead>
                  <TableHead className="text-xs py-2">Applicant</TableHead>
                  <TableHead className="text-xs py-2">Phone</TableHead>
                  <TableHead className="text-xs py-2 text-center">EMI #</TableHead>
                  <TableHead className="text-xs py-2">Due Date</TableHead>
                  <TableHead className="text-xs py-2 text-right">Amount</TableHead>
                  <TableHead className="text-xs py-2 text-right">Balance</TableHead>
                  <TableHead className="text-xs py-2 text-center">Days OD</TableHead>
                  <TableHead className="text-xs py-2">Bucket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No overdue EMIs found 🎉
                    </TableCell>
                  </TableRow>
                ) : (
                  overdueRecords.map((record) => {
                    const bucketColor =
                      record.bucket === "90+ days"
                        ? "destructive"
                        : record.bucket === "61-90 days"
                        ? "destructive"
                        : record.bucket === "31-60 days"
                        ? "secondary"
                        : "outline";

                    return (
                      <TableRow key={record.id}>
                        <TableCell className="py-2 text-xs font-medium text-primary">
                          {record.loan_id || record.application_number}
                        </TableCell>
                        <TableCell className="py-2 text-xs">{record.applicant_name}</TableCell>
                        <TableCell className="py-2 text-xs">{record.applicant_phone}</TableCell>
                        <TableCell className="py-2 text-xs text-center">{record.emi_number}</TableCell>
                        <TableCell className="py-2 text-xs">
                          {format(new Date(record.due_date), "dd MMM yy")}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right">
                          {formatCurrency(record.total_emi)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-right font-medium text-destructive">
                          {formatCurrency(record.total_emi - record.amount_paid)}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-center font-bold text-destructive">
                          {record.days_overdue}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant={bucketColor as any} className="text-[10px]">
                            {record.bucket}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
