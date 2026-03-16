import { useState } from "react";
import { format } from "date-fns";
import { useLoansList, LoanListItem } from "@/hooks/useLoansList";
import { LoanDetailDialog } from "./LoanDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Search, Banknote, Download, TrendingUp, AlertCircle, CheckCircle, IndianRupee, Eye } from "lucide-react";

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  on_track: { label: "On Track", color: "bg-green-500" },
  overdue: { label: "Overdue", color: "bg-red-500" },
  completed: { label: "Completed", color: "bg-blue-500" },
};

export function LoansTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<LoanListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: loans, isLoading } = useLoansList(debouncedSearch);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Filter loans
  const filteredLoans = loans?.filter((loan) => {
    if (statusFilter === "active" && loan.paymentStatus === "completed") {
      return false;
    }
    if (statusFilter === "closed" && loan.paymentStatus !== "completed") {
      return false;
    }
    if (paymentFilter === "on_track" && loan.paymentStatus !== "on_track") {
      return false;
    }
    if (paymentFilter === "overdue" && loan.paymentStatus !== "overdue") {
      return false;
    }
    if (paymentFilter === "completed" && loan.paymentStatus !== "completed") {
      return false;
    }
    return true;
  }) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewDetails = (loan: LoanListItem) => {
    setSelectedLoan(loan);
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredLoans.length) return;

    // Build filename with filter info
    let filename = `loans-${format(new Date(), "yyyy-MM-dd")}`;
    if (statusFilter !== "all") filename += `_${statusFilter}`;
    if (paymentFilter !== "all") filename += `_payment-${paymentFilter}`;
    if (debouncedSearch) filename += `_search`;

    // Build filter metadata row
    const filterParts = [];
    filterParts.push(`Loan Status: ${statusFilter === "all" ? "All" : statusFilter}`);
    filterParts.push(`Payment Status: ${paymentFilter === "all" ? "All" : paymentFilter}`);
    if (debouncedSearch) filterParts.push(`Search: "${debouncedSearch}"`);
    const filterInfo = [`"Filters Applied: ${filterParts.join(", ")}"`];

    const headers = [
      "Loan ID",
      "Application Number",
      "Applicant Name",
      "PAN",
      "Mobile",
      "Disbursed Amount",
      "Total Paid",
      "Outstanding",
      "EMI Count",
      "Paid EMIs",
      "Overdue EMIs",
      "Payment Status",
      "On-Time %",
      "Disbursement Date",
    ];

    const rows = filteredLoans.map((loan) => [
      loan.loanId,
      loan.applicationNumber,
      loan.applicantName,
      loan.panNumber,
      loan.mobile,
      loan.disbursedAmount,
      loan.totalPaid,
      loan.outstandingAmount,
      loan.emiCount,
      loan.paidEmiCount,
      loan.overdueEmiCount,
      loan.paymentStatus,
      loan.onTimePaymentPercent,
      loan.disbursementDate ? format(new Date(loan.disbursementDate), "dd/MM/yyyy") : "",
    ]);

    const csvContent = [filterInfo, headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats — each contact counted once at their highest lifecycle stage
  // Priority: Overdue > On Track > Completed (overdue is most urgent to surface)
  const computeLoanStats = () => {
    if (!loans || loans.length === 0) return { total: 0, active: 0, onTrack: 0, overdue: 0, completed: 0, totalDisbursed: 0, totalOutstanding: 0 };

    const PRIORITY: Record<string, number> = { overdue: 3, on_track: 2, completed: 1 };
    const contactHighest = new Map<string, string>();

    for (const loan of loans) {
      if (!loan.contactId) continue;
      const current = contactHighest.get(loan.contactId);
      if (!current || (PRIORITY[loan.paymentStatus] || 0) > (PRIORITY[current] || 0)) {
        contactHighest.set(loan.contactId, loan.paymentStatus);
      }
    }

    const counts = { total: contactHighest.size, active: 0, onTrack: 0, overdue: 0, completed: 0 };
    for (const status of contactHighest.values()) {
      if (status === "overdue") { counts.overdue++; counts.active++; }
      else if (status === "on_track") { counts.onTrack++; counts.active++; }
      else if (status === "completed") counts.completed++;
    }

    return {
      ...counts,
      totalDisbursed: loans.reduce((sum, l) => sum + l.disbursedAmount, 0),
      totalOutstanding: loans.reduce((sum, l) => sum + l.outstandingAmount, 0),
    };
  };
  const stats = computeLoanStats();

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Loans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.onTrack}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalDisbursed)}</p>
                <p className="text-xs text-muted-foreground">Total Disbursed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalOutstanding)}</p>
                <p className="text-xs text-muted-foreground">Total Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Search & Filter</CardTitle>
              <CardDescription>Find loans by ID, application number, PAN, or name</CardDescription>
            </div>
            <Button onClick={handleExportCSV} variant="outline" disabled={!filteredLoans.length}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by loan ID, application number, PAN, mobile, name..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Loan Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Loans</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <LoadingState message="Loading loans..." />
      ) : filteredLoans.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Banknote className="h-12 w-12" />}
              title="No loans found"
              message={
                searchTerm
                  ? "Try adjusting your search or filters"
                  : "Disbursed loans will appear here"
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan ID</TableHead>
                    <TableHead>Application #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>EMI Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead className="text-center">On-Time %</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => {
                    const statusConfig = paymentStatusConfig[loan.paymentStatus] || { label: loan.paymentStatus, color: "bg-gray-500" };
                    const emiProgress = loan.emiCount > 0 ? Math.round((loan.paidEmiCount / loan.emiCount) * 100) : 0;
                    
                    return (
                      <TableRow 
                        key={loan.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(loan)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {loan.loanId}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {loan.applicationNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{loan.applicantName}</p>
                            <p className="text-xs text-muted-foreground">{loan.mobile}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{loan.panNumber}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(loan.disbursedAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={loan.outstandingAmount > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                            {formatCurrency(loan.outstandingAmount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={emiProgress} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {loan.paidEmiCount}/{loan.emiCount}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig.color} text-white`}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {loan.nextDueDate ? (
                            <div className="text-sm">
                              <p>{format(new Date(loan.nextDueDate), "dd MMM")}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(loan.nextDueAmount || 0)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${
                            loan.onTimePaymentPercent >= 90 ? "text-green-600" :
                            loan.onTimePaymentPercent >= 70 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {loan.onTimePaymentPercent}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(loan);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <LoanDetailDialog
        loan={selectedLoan}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
