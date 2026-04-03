import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useLoansList, LoanListItem } from "@/hooks/useLoansList";
import { LoanDetailDialog } from "./LoanDetailDialog";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";
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
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Search, Banknote, Download, TrendingUp, AlertCircle, CheckCircle, IndianRupee, Eye } from "lucide-react";

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  on_track: { label: "On Track", color: "bg-green-500" },
  overdue: { label: "Overdue", color: "bg-red-500" },
  completed: { label: "Settled", color: "bg-blue-500" },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export function LoansTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoan, setSelectedLoan] = useState<LoanListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: loans, isLoading } = useLoansList(debouncedSearch);

  const filteredLoans = useMemo(() => (loans || []).filter((loan) => {
    if (statusFilter === "on_track") return loan.paymentStatus === "on_track";
    if (statusFilter === "overdue") return loan.paymentStatus === "overdue";
    if (statusFilter === "completed") return loan.paymentStatus === "completed";
    return true;
  }), [loans, statusFilter]);

  const pagination = usePagination({ defaultPageSize: 100, totalRecords: filteredLoans.length });
  const paginatedLoans = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.pageSize;
    return filteredLoans.slice(start, start + pagination.pageSize);
  }, [filteredLoans, pagination.currentPage, pagination.pageSize]);

  const handleViewDetails = (loan: LoanListItem) => {
    setSelectedLoan(loan);
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredLoans.length) return;

    const filename = `loans-${format(new Date(), "yyyy-MM-dd")}${statusFilter !== "all" ? `_${statusFilter}` : ""}`;

    const headers = [
      "Loan ID", "Application #", "Customer", "PAN", "Mobile",
      "Disbursed", "Outstanding", "Disbursement Date", "Due Date",
      "Days Overdue", "Status",
    ];

    const rows = filteredLoans.map((l) => [
      l.loanId, l.applicationNumber, `"${l.applicantName}"`, l.panNumber, l.mobile,
      l.disbursedAmount, l.outstandingAmount,
      l.disbursementDate ? format(new Date(l.disbursementDate), "dd/MM/yyyy") : "",
      l.dueDate ? format(new Date(l.dueDate), "dd/MM/yyyy") : "",
      l.daysOverdue, l.paymentStatus,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats — count actual loans
  const computeStats = () => {
    if (!loans || loans.length === 0) return { total: 0, onTrack: 0, overdue: 0, completed: 0, totalDisbursed: 0, totalOutstanding: 0 };

    const counts = { total: loans.length, onTrack: 0, overdue: 0, completed: 0 };
    for (const loan of loans) {
      if (loan.paymentStatus === "overdue") counts.overdue++;
      else if (loan.paymentStatus === "on_track") counts.onTrack++;
      else if (loan.paymentStatus === "completed") counts.completed++;
    }

    return {
      ...counts,
      totalDisbursed: loans.reduce((sum, l) => sum + l.disbursedAmount, 0),
      totalOutstanding: loans.reduce((sum, l) => sum + l.outstandingAmount, 0),
    };
  };
  const stats = computeStats();

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Loans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xl font-bold">{stats.onTrack}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Settled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(stats.totalDisbursed)}</p>
                <p className="text-xs text-muted-foreground">Total Disbursed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xl font-bold">{formatCurrency(stats.totalOutstanding)}</p>
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Loans</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Settled</SelectItem>
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
                    <TableHead>Customer</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Disbursement</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-center">Days Overdue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLoans.map((loan) => {
                    const statusConfig = paymentStatusConfig[loan.paymentStatus] || { label: loan.paymentStatus, color: "bg-gray-500" };

                    return (
                      <TableRow
                        key={loan.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(loan)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {loan.loanId}
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
                        <TableCell className="text-sm text-muted-foreground">
                          {loan.disbursementDate ? format(new Date(loan.disbursementDate), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {loan.dueDate ? format(new Date(loan.dueDate), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={loan.daysOverdue > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {loan.daysOverdue > 0 ? loan.daysOverdue : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig.color} text-white`}>
                            {statusConfig.label}
                          </Badge>
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

      {filteredLoans.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalRecords={filteredLoans.length}
          startRecord={pagination.startRecord}
          endRecord={pagination.endRecord}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}

      <LoanDetailDialog
        loan={selectedLoan}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
