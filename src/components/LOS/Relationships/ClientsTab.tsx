import { useState } from "react";
import { format } from "date-fns";
import { useCustomerRelationships, CustomerRelationship } from "@/hooks/useCustomerRelationships";
import { CustomerDetailDialog } from "./CustomerDetailDialog";
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
import { Search, Users, Download, IndianRupee, AlertCircle, Eye } from "lucide-react";

export function ClientsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRelationship | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: customers, isLoading } = useCustomerRelationships(debouncedSearch);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  // Filter customers
  const filteredCustomers = customers?.filter((customer) => {
    if (statusFilter === "active" && customer.totalLoans === 0) return false;
    if (statusFilter === "overdue" && customer.delayedPayments === 0) return false;
    return true;
  }) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewDetails = (customer: CustomerRelationship) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredCustomers.length) return;

    let filename = `clients-${format(new Date(), "yyyy-MM-dd")}`;
    if (statusFilter !== "all") filename += `_${statusFilter}`;
    if (debouncedSearch) filename += `_search`;

    const filterParts = [];
    filterParts.push(`Status: ${statusFilter === "all" ? "All" : statusFilter}`);
    if (debouncedSearch) filterParts.push(`Search: "${debouncedSearch}"`);
    const filterInfo = [`"Filters Applied: ${filterParts.join(", ")}"`];

    const headers = [
      "Customer ID",
      "Name",
      "Mobile",
      "Total Applications",
      "Total Loans",
      "Disbursed Amount",
      "Outstanding Amount",
      "Delayed Payments",
      "Max Days Delayed",
      "Last Activity",
    ];

    const rows = filteredCustomers.map((c) => [
      c.customerId,
      `"${c.name}"`,
      c.mobile,
      c.totalApplications,
      c.totalLoans,
      c.disbursedAmount,
      c.outstandingAmount,
      c.delayedPayments,
      c.maxDaysDelayed,
      c.lastActivityDate ? format(new Date(c.lastActivityDate), "dd/MM/yyyy") : "",
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

  // Summary stats
  const stats = {
    total: customers?.length || 0,
    totalDisbursed: customers?.reduce((sum, c) => sum + c.disbursedAmount, 0) || 0,
    totalOutstanding: customers?.reduce((sum, c) => sum + c.outstandingAmount, 0) || 0,
    overdueClients: customers?.filter((c) => c.delayedPayments > 0).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalDisbursed)}</p>
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
                <p className="text-lg font-bold">{formatCurrency(stats.totalOutstanding)}</p>
                <p className="text-xs text-muted-foreground">Total Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.overdueClients}</p>
                <p className="text-xs text-muted-foreground">Overdue Clients</p>
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
              <CardDescription>Find clients by mobile, name, or customer ID</CardDescription>
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
                placeholder="Search by mobile, name, or customer ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="active">With Active Loans</SelectItem>
                <SelectItem value="overdue">With Overdue EMIs</SelectItem>
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
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-center">Applications</TableHead>
                    <TableHead className="text-center">Loans</TableHead>
                    <TableHead className="text-right">Disbursed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-center">Delayed</TableHead>
                    <TableHead className="text-center">Days Delayed</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer.customerId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(customer)}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {customer.customerId}
                      </TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-sm">{customer.mobile}</TableCell>
                      <TableCell className="text-center">{customer.totalApplications}</TableCell>
                      <TableCell className="text-center">{customer.totalLoans}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(customer.disbursedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={customer.outstandingAmount > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                          {formatCurrency(customer.outstandingAmount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={customer.delayedPayments > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {customer.delayedPayments}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={customer.maxDaysDelayed > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {customer.maxDaysDelayed > 0 ? customer.maxDaysDelayed : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {customer.lastActivityDate
                          ? format(new Date(customer.lastActivityDate), "dd MMM yyyy")
                          : "-"
                        }
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

      <CustomerDetailDialog
        customer={selectedCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
