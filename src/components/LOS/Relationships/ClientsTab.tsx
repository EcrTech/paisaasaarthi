import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useCustomerRelationships, CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { CustomerDetailDialog } from "./CustomerDetailDialog";
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
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Download, IndianRupee, AlertCircle, Eye, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { STAGE_LABELS } from "@/constants/loanStages";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export function ClientsTab() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRelationship | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: customers, isLoading } = useCustomerRelationships(debouncedSearch);

  const filteredCustomers = useMemo(() => (customers || []).filter((c) => {
    if (statusFilter === "repeat") return c.totalLoans > 1;
    if (statusFilter === "active") return c.outstandingAmount > 0;
    if (statusFilter === "overdue") return c.overdueLoans > 0;
    if (statusFilter === "cleared") return c.outstandingAmount === 0;
    return true;
  }), [customers, statusFilter]);

  const pagination = usePagination({ defaultPageSize: 100, totalRecords: filteredCustomers.length });
  const paginatedCustomers = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.pageSize;
    return filteredCustomers.slice(start, start + pagination.pageSize);
  }, [filteredCustomers, pagination.currentPage, pagination.pageSize]);

  const handleViewDetails = (customer: CustomerRelationship) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredCustomers.length) return;

    const filename = `clients-${format(new Date(), "yyyy-MM-dd")}${statusFilter !== "all" ? `_${statusFilter}` : ""}`;

    const headers = [
      "Name", "Mobile", "PAN", "Total Loans",
      "Disbursed Amount", "Outstanding Amount",
      "Overdue Loans", "Max Days Overdue", "Last Activity",
    ];

    const rows = filteredCustomers.map((c) => [
      `"${c.name}"`,
      c.mobile,
      c.panNumber,
      c.totalLoans,
      c.disbursedAmount,
      c.outstandingAmount,
      c.overdueLoans,
      c.maxDaysOverdue,
      c.lastActivityDate ? format(new Date(c.lastActivityDate), "dd/MM/yyyy") : "",
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

  const total = customers?.length || 0;
  const repeatBorrowers = customers?.filter((c) => c.totalLoans > 1).length || 0;
  const activeClients = customers?.filter((c) => c.outstandingAmount > 0).length || 0;
  const overdueClients = customers?.filter((c) => c.overdueLoans > 0).length || 0;
  const clearedClients = customers?.filter((c) => c.outstandingAmount === 0).length || 0;
  const totalDisbursed = customers?.reduce((sum, c) => sum + c.disbursedAmount, 0) || 0;
  const totalOutstanding = customers?.reduce((sum, c) => sum + c.outstandingAmount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/10 to-sky-500/5 border border-sky-500/20 p-4 transition-all hover:shadow-lg hover:shadow-sky-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Clients</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{total}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><Users className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-4 transition-all hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Repeat Borrowers</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{repeatBorrowers}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><RefreshCw className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 p-4 transition-all hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{activeClients}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><Users className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 p-4 transition-all hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Overdue</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{overdueClients}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><AlertCircle className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-4 transition-all hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cleared</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{clearedClients}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><Users className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 p-4 transition-all hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Disbursed</span>
          <p className="text-xl font-extrabold text-foreground mt-1">{formatCurrency(totalDisbursed)}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><IndianRupee className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 p-4 transition-all hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Outstanding</span>
          <p className="text-xl font-extrabold text-foreground mt-1">{formatCurrency(totalOutstanding)}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><IndianRupee className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Search & Filter</CardTitle>
              <CardDescription>Find clients by name, mobile, or PAN</CardDescription>
            </div>
            <Button onClick={handleExportCSV} variant="outline" disabled={!filteredCustomers.length}>
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
                placeholder="Search by name, mobile, or PAN..."
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
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="repeat">Repeat Borrowers</SelectItem>
                <SelectItem value="active">Active (Outstanding)</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cleared">Cleared</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <LoadingState message="Loading clients..." />
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="No clients found"
              message={
                searchTerm
                  ? "Try adjusting your search or filters"
                  : "Clients will appear here once loans are disbursed"
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
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead className="text-center">Loans</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-center">Overdue</TableHead>
                    <TableHead className="text-center">Max Days</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.map((customer) => (
                    <TableRow
                      key={customer.customerId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(customer)}
                    >
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-sm">{customer.mobile}</TableCell>
                      <TableCell className="font-mono text-sm">{customer.panNumber}</TableCell>
                      <TableCell className="text-center">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center"
                            >
                              <Badge
                                variant={customer.totalLoans > 1 ? "default" : "secondary"}
                                className={`cursor-pointer ${customer.totalLoans > 1 ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                              >
                                {customer.totalLoans} {customer.totalLoans > 1 ? "Loans" : "Loan"}
                              </Badge>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                            <div className="p-3 border-b">
                              <p className="text-sm font-semibold">{customer.name} — Loan History</p>
                            </div>
                            <div className="max-h-60 overflow-y-auto divide-y">
                              {customer.applications.map((app) => (
                                <div key={app.applicationId} className="px-3 py-2 flex items-center justify-between gap-2 text-sm hover:bg-muted/50">
                                  <div className="min-w-0">
                                    <button
                                      onClick={() => navigate(`/los/applications/${app.applicationId}?mode=review`)}
                                      className="text-primary hover:underline font-mono text-xs font-medium truncate block"
                                    >
                                      {app.applicationNumber}
                                    </button>
                                    <p className="text-[11px] text-muted-foreground">
                                      {STAGE_LABELS[app.currentStage] || app.currentStage} · {app.disbursedAmount ? formatCurrency(app.disbursedAmount) : "—"}
                                    </p>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {format(new Date(app.createdAt), "dd MMM yy")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(customer.disbursedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={customer.outstandingAmount > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                          {formatCurrency(customer.outstandingAmount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={customer.overdueLoans > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {customer.overdueLoans}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={customer.maxDaysOverdue > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {customer.maxDaysOverdue > 0 ? customer.maxDaysOverdue : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {customer.lastActivityDate
                          ? format(new Date(customer.lastActivityDate), "dd MMM yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(customer);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredCustomers.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalRecords={filteredCustomers.length}
          startRecord={pagination.startRecord}
          endRecord={pagination.endRecord}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}

      <CustomerDetailDialog
        customer={selectedCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
