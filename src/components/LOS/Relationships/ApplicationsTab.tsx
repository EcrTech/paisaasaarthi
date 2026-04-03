import { useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useApplicationsList, ApplicationListItem } from "@/hooks/useApplicationsList";
import { ApplicationDetailDialog } from "./ApplicationDetailDialog";
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Search, FileText, Download, CheckCircle, Clock, XCircle, Banknote, Eye, Check, X, 
  CalendarIcon, ChevronDown, ChevronUp, SlidersHorizontal, RotateCcw 
} from "lucide-react";
import { cn } from "@/lib/utils";

import { STAGE_LABELS, STAGE_COLORS } from "@/constants/loanStages";

const stageConfig: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(STAGE_LABELS).map(([key, label]) => [key, { label, color: STAGE_COLORS[key] || "bg-muted" }]),
);

const tenureOptions = [
  { value: "all", label: "All Tenures" },
  { value: "1-7", label: "1-7 Days" },
  { value: "8-14", label: "8-14 Days" },
  { value: "15-30", label: "15-30 Days" },
  { value: "31-60", label: "31-60 Days" },
  { value: "60+", label: "60+ Days" },
];

export function ApplicationsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<ApplicationListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Advanced filters
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [tenureFilter, setTenureFilter] = useState<string>("all");
  const [sanctionedFilter, setSanctionedFilter] = useState<string>("all");
  const [disbursedFilter, setDisbursedFilter] = useState<string>("all");

  const { data: applications, isLoading } = useApplicationsList(debouncedSearch);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  };

  const resetFilters = () => {
    setStageFilter("all");
    setStatusFilter("all");
    setFromDate(undefined);
    setToDate(undefined);
    setMinAmount("");
    setMaxAmount("");
    setTenureFilter("all");
    setSanctionedFilter("all");
    setDisbursedFilter("all");
    pagination.setPage(1);
  };

  const hasActiveFilters = 
    stageFilter !== "all" || 
    statusFilter !== "all" || 
    fromDate || 
    toDate || 
    minAmount || 
    maxAmount || 
    tenureFilter !== "all" ||
    sanctionedFilter !== "all" ||
    disbursedFilter !== "all";

  // Filter applications — memoized for pagination
  const filteredApplications = useMemo(() => applications?.filter((app) => {
    // Stage filter
    if (stageFilter !== "all" && app.currentStage !== stageFilter) {
      return false;
    }

    // Date range filter
    if (fromDate || toDate) {
      const appDate = new Date(app.createdAt);
      if (fromDate && toDate) {
        if (!isWithinInterval(appDate, { start: startOfDay(fromDate), end: endOfDay(toDate) })) {
          return false;
        }
      } else if (fromDate && appDate < startOfDay(fromDate)) {
        return false;
      } else if (toDate && appDate > endOfDay(toDate)) {
        return false;
      }
    }

    // Amount range filter
    const minAmt = minAmount ? parseFloat(minAmount) : null;
    const maxAmt = maxAmount ? parseFloat(maxAmount) : null;
    if (minAmt !== null && app.requestedAmount < minAmt) {
      return false;
    }
    if (maxAmt !== null && app.requestedAmount > maxAmt) {
      return false;
    }

    // Tenure filter
    if (tenureFilter !== "all") {
      const tenure = app.tenureDays;
      if (tenureFilter === "1-7" && (tenure < 1 || tenure > 7)) return false;
      if (tenureFilter === "8-14" && (tenure < 8 || tenure > 14)) return false;
      if (tenureFilter === "15-30" && (tenure < 15 || tenure > 30)) return false;
      if (tenureFilter === "31-60" && (tenure < 31 || tenure > 60)) return false;
      if (tenureFilter === "60+" && tenure <= 60) return false;
    }

    // Sanctioned filter
    if (sanctionedFilter === "yes" && !app.isSanctioned) return false;
    if (sanctionedFilter === "no" && app.isSanctioned) return false;

    // Disbursed filter
    if (disbursedFilter === "yes" && !app.isDisbursed) return false;
    if (disbursedFilter === "no" && app.isDisbursed) return false;

    return true;
  }) || [], [applications, stageFilter, statusFilter, fromDate, toDate, minAmount, maxAmount, tenureFilter, sanctionedFilter, disbursedFilter]);

  const pagination = usePagination({ defaultPageSize: 100, totalRecords: filteredApplications.length });
  const paginatedApplications = useMemo(() => {
    const start = (pagination.currentPage - 1) * pagination.pageSize;
    return filteredApplications.slice(start, start + pagination.pageSize);
  }, [filteredApplications, pagination.currentPage, pagination.pageSize]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewDetails = (application: ApplicationListItem) => {
    setSelectedApplication(application);
    setDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (!filteredApplications.length) return;

    // Build filename with filter info
    let filename = `applications-${format(new Date(), "yyyy-MM-dd")}`;
    if (stageFilter !== "all") filename += `_stage-${stageFilter}`;
    if (statusFilter !== "all") filename += `_status-${statusFilter}`;
    if (debouncedSearch) filename += `_search`;
    if (fromDate) filename += `_from-${format(fromDate, "yyyyMMdd")}`;
    if (toDate) filename += `_to-${format(toDate, "yyyyMMdd")}`;

    // Build filter metadata row
    const filterParts = [];
    filterParts.push(`Stage: ${stageFilter === "all" ? "All" : stageFilter}`);
    filterParts.push(`Status: ${statusFilter === "all" ? "All" : statusFilter}`);
    if (debouncedSearch) filterParts.push(`Search: "${debouncedSearch}"`);
    if (fromDate) filterParts.push(`From: ${format(fromDate, "dd/MM/yyyy")}`);
    if (toDate) filterParts.push(`To: ${format(toDate, "dd/MM/yyyy")}`);
    if (minAmount) filterParts.push(`Min Amount: ${minAmount}`);
    if (maxAmount) filterParts.push(`Max Amount: ${maxAmount}`);
    if (tenureFilter !== "all") filterParts.push(`Tenure: ${tenureFilter}`);
    const filterInfo = [`"Filters Applied: ${filterParts.join(", ")}"`];

    const headers = [
      "Application Number",
      "Loan ID",
      "Stage",
      "Status",
      "Applicant Name",
      "PAN",
      "Mobile",
      "Requested Amount",
      "Approved Amount",
      "Sanctioned Amount",
      "Disbursed Amount",
      "Tenure (Days)",
      "Created Date",
    ];

    const rows = filteredApplications.map((app) => [
      app.applicationNumber,
      app.loanId || "",
      app.currentStage,
      app.status,
      app.applicantName,
      app.panNumber,
      app.mobile,
      app.requestedAmount,
      app.approvedAmount || "",
      app.sanctionedAmount || "",
      app.disbursedAmount || "",
      app.tenureDays,
      format(new Date(app.createdAt), "dd/MM/yyyy"),
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

  // Summary stats — count applications by actual current_stage
  const computeStats = () => {
    if (!applications || applications.length === 0) return { total: 0, application: 0, evaluation: 0, approved: 0, disbursement: 0, disbursed: 0, closed: 0, rejected: 0 };

    const counts = { total: applications.length, application: 0, evaluation: 0, approved: 0, disbursement: 0, disbursed: 0, closed: 0, rejected: 0 };
    for (const app of applications) {
      const stage = app.currentStage as keyof typeof counts;
      if (stage in counts) counts[stage]++;
      else counts.application++; // lead, documents → group under application
    }
    return counts;
  };
  const stats = computeStats();

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/10 to-sky-500/5 border border-sky-500/20 p-4 transition-all hover:shadow-lg hover:shadow-sky-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.total}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><FileText className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-4 transition-all hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Application</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.application}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><Clock className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 p-4 transition-all hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evaluation</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.evaluation}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><Search className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-4 transition-all hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Approved</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.approved}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><CheckCircle className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 p-4 transition-all hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Disbursement</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.disbursement}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><FileText className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-500/20 p-4 transition-all hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Disbursed</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.disbursed}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><Banknote className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-500/10 to-gray-500/5 border border-gray-500/20 p-4 transition-all hover:shadow-lg hover:shadow-gray-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Closed</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.closed}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><CheckCircle className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 p-4 transition-all hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rejected</span>
          <p className="text-2xl font-extrabold text-foreground mt-1">{stats.rejected}</p>
          <div className="absolute bottom-0 right-0 opacity-[0.07]"><XCircle className="h-14 w-14 -mb-2 -mr-2" /></div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Search & Filter</CardTitle>
              <CardDescription>Find applications by number, PAN, mobile, or name</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button onClick={resetFilters} variant="ghost" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
              <Button onClick={handleExportCSV} variant="outline" disabled={!filteredApplications.length}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Filters Row */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by application number, PAN, mobile, name..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="application">Application</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="disbursement">Disbursement</SelectItem>
                <SelectItem value="disbursed">Disbursed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters - Collapsible */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between border border-dashed">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Advanced Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      Active
                    </Badge>
                  )}
                </span>
                {advancedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !fromDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? format(fromDate, "dd/MM/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        onSelect={setFromDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !toDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {toDate ? format(toDate, "dd/MM/yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background" align="start">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={setToDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Amount Range */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Amount (₹)</Label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                  />
                </div>

                {/* Tenure Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tenure</Label>
                  <Select value={tenureFilter} onValueChange={setTenureFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Tenures" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenureOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sanctioned Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sanctioned</Label>
                  <Select value={sanctionedFilter} onValueChange={setSanctionedFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Disbursed Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Disbursed</Label>
                  <Select value={disbursedFilter} onValueChange={setDisbursedFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Active filters count */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Showing {filteredApplications.length} of {applications?.length || 0} applications</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <LoadingState message="Loading applications..." />
      ) : filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No applications found"
              message={
                searchTerm || hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "Applications will appear here once created"
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
                    <TableHead>Application #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-center">Sanctioned</TableHead>
                    <TableHead className="text-center">Disbursed</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedApplications.map((app) => {
                    const stage = stageConfig[app.currentStage] || { label: app.currentStage, color: "bg-gray-500" };
                    return (
                      <TableRow 
                        key={app.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(app)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {app.applicationNumber}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(app.createdAt), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">{app.applicantName}</TableCell>
                        <TableCell className="font-mono text-sm">{app.panNumber}</TableCell>
                        <TableCell className="text-sm">{app.mobile}</TableCell>
                        <TableCell>
                          <Badge className={`${stage.color} text-white`}>
                            {stage.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(app.requestedAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {app.approvedAmount ? formatCurrency(app.approvedAmount) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {app.isSanctioned ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {app.isDisbursed ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(app);
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

      {filteredApplications.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalRecords={filteredApplications.length}
          startRecord={pagination.startRecord}
          endRecord={pagination.endRecord}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}

      <ApplicationDetailDialog
        application={selectedApplication}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
