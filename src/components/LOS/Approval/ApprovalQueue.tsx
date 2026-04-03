import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import PaginationControls from "@/components/common/PaginationControls";
import { Eye, FileText, Search, CalendarIcon, X, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ApprovalQueueProps {
  orgId: string;
  userId: string;
}

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

import { STAGE_LABELS, STAGE_BADGE_COLORS as STAGE_COLORS } from "@/constants/loanStages";

export default function ApprovalQueue({ orgId, userId }: ApprovalQueueProps) {
  const navigate = useNavigate();

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedProductType, setSelectedProductType] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  const handleFilterChange = useCallback((setter: Function, value: any) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  // Fetch filter options (all unique stages, assignees, products) — independent of pagination
  const { data: filterOptions } = useQuery({
    queryKey: ["approval-queue-filters", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          current_stage,
          product_type,
          assigned_to,
          assigned_profile:profiles!assigned_to(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .eq("status", "in_progress");

      if (error) throw error;

      const assigneeMap = new Map<string, string>();
      const productSet = new Set<string>();
      const stageSet = new Set<string>();

      (data || []).forEach((app: any) => {
        if (app.assigned_to && app.assigned_profile) {
          const name = `${app.assigned_profile.first_name} ${app.assigned_profile.last_name || ""}`.trim();
          assigneeMap.set(app.assigned_to, name);
        }
        if (app.product_type) productSet.add(app.product_type);
        if (app.current_stage) stageSet.add(app.current_stage);
      });

      return {
        uniqueAssignees: Array.from(assigneeMap.entries()).map(([id, name]) => ({ id, name })),
        uniqueProductTypes: Array.from(productSet).sort(),
        uniqueStages: Array.from(stageSet).sort(),
      };
    },
    enabled: !!orgId,
  });

  // Main paginated query with server-side filters
  const { data: queryResult, isLoading } = useQuery({
    queryKey: [
      "approval-queue",
      orgId,
      debouncedSearch,
      selectedStages,
      selectedAssignee,
      amountMin,
      amountMax,
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
      selectedProductType,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      // Step 1: If search term, find matching applicant application IDs by name/phone
      let nameMatchIds: string[] = [];
      if (debouncedSearch) {
        const { data: nameMatches } = await supabase
          .from("loan_applicants")
          .select("loan_application_id")
          .or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,mobile.ilike.%${debouncedSearch}%`)
          .eq("org_id", orgId);

        nameMatchIds = (nameMatches || []).map((m: any) => m.loan_application_id);
      }

      // Step 2: Build main query
      let query = supabase
        .from("loan_applications")
        .select(
          `*,
          loan_applicants(*),
          assigned_profile:profiles!assigned_to(first_name, last_name)`,
          { count: "exact" }
        )
        .eq("org_id", orgId)
        .eq("status", "in_progress");

      // Text search — across loan_id, application_number, and name-matched IDs
      if (debouncedSearch) {
        if (nameMatchIds.length > 0) {
          query = query.or(
            `loan_id.ilike.%${debouncedSearch}%,application_number.ilike.%${debouncedSearch}%,id.in.(${nameMatchIds.join(",")})`
          );
        } else {
          query = query.or(
            `loan_id.ilike.%${debouncedSearch}%,application_number.ilike.%${debouncedSearch}%`
          );
        }
      }

      // Stage filter
      if (selectedStages.length > 0) {
        query = query.in("current_stage", selectedStages);
      }

      // Assignee filter
      if (selectedAssignee !== "all") {
        query = query.eq("assigned_to", selectedAssignee);
      }

      // Amount range
      if (amountMin) {
        query = query.gte("requested_amount", parseFloat(amountMin));
      }
      if (amountMax) {
        query = query.lte("requested_amount", parseFloat(amountMax));
      }

      // Date range
      if (dateFrom) {
        query = query.gte("created_at", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      // Product type
      if (selectedProductType !== "all") {
        query = query.eq("product_type", selectedProductType);
      }

      // Ordering + pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { applications: data || [], totalCount: count || 0 };
    },
    enabled: !!orgId,
  });

  const applications = queryResult?.applications || [];
  const totalCount = queryResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  const uniqueAssignees = filterOptions?.uniqueAssignees || [];
  const uniqueProductTypes = filterOptions?.uniqueProductTypes || [];
  const uniqueStages = filterOptions?.uniqueStages || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getApplicantName = (app: any) => {
    const applicants = app.loan_applicants;
    const applicant = Array.isArray(applicants) ? applicants[0] : applicants;
    if (!applicant) return "N/A";
    return `${applicant.first_name} ${applicant.last_name || ""}`.trim();
  };

  const getAssigneeName = (app: any) => {
    if (!app.assigned_profile) return "Unassigned";
    return `${app.assigned_profile.first_name} ${app.assigned_profile.last_name || ""}`.trim();
  };

  const toggleStage = (stage: string) => {
    setSelectedStages((prev) => {
      const next = prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage];
      setCurrentPage(1);
      return next;
    });
  };

  const hasActiveFilters = searchInput || selectedStages.length > 0 || selectedAssignee !== "all" || amountMin || amountMax || dateFrom || dateTo || selectedProductType !== "all";

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedStages([]);
    setSelectedAssignee("all");
    setAmountMin("");
    setAmountMax("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedProductType("all");
    setCurrentPage(1);
  };

  if (isLoading && currentPage === 1 && !hasActiveFilters) {
    return <LoadingState message="Loading applications..." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Approval Queue</h2>
        <p className="text-muted-foreground">Review and process in-progress loan applications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            In-Progress Applications
          </CardTitle>
          <CardDescription>
            {hasActiveFilters
              ? `Showing ${applications.length} of ${totalCount} result(s)`
              : `${totalCount} application(s) requiring attention`}
          </CardDescription>
        </CardHeader>

        {/* Filter Bar */}
        <div className="px-6 pb-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Loan ID, App #, Name, Phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Stage Multi-Select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  Stage
                  {selectedStages.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {selectedStages.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  {uniqueStages.map((stage) => (
                    <label
                      key={stage}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedStages.includes(stage)}
                        onCheckedChange={() => toggleStage(stage)}
                      />
                      {STAGE_LABELS[stage] || stage}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Assigned To */}
            <Select value={selectedAssignee} onValueChange={(v) => handleFilterChange(setSelectedAssignee, v)}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {uniqueAssignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product Type */}
            {uniqueProductTypes.length > 0 && (
              <Select value={selectedProductType} onValueChange={(v) => handleFilterChange(setSelectedProductType, v)}>
                <SelectTrigger className="w-[160px] h-10">
                  <SelectValue placeholder="Product Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {uniqueProductTypes.map((pt) => (
                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 gap-1">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Second row: Amount range + Date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                placeholder="Min Amount"
                value={amountMin}
                onChange={(e) => handleFilterChange(setAmountMin, e.target.value)}
                className="w-[130px] h-9"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                placeholder="Max Amount"
                value={amountMax}
                onChange={(e) => handleFilterChange(setAmountMax, e.target.value)}
                className="w-[130px] h-9"
              />
            </div>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "MMM dd, yy") : "From Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => handleFilterChange(setDateFrom, d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "MMM dd, yy") : "To Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => handleFilterChange(setDateTo, d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading...
            </div>
          ) : applications.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? "No matching applications" : "No applications in queue"}
              message={hasActiveFilters ? "Try adjusting your filters." : "There are no in-progress applications at this time."}
            />
          ) : (
            <>
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground py-2 text-xs">Loan ID</TableHead>
                    <TableHead className="font-semibold text-foreground py-2 text-xs">Application #</TableHead>
                    <TableHead className="font-semibold text-foreground py-2 text-xs">Applicant</TableHead>
                    <TableHead className="font-semibold text-foreground py-2 text-xs">Amount</TableHead>
                    <TableHead className="font-semibold text-foreground py-2 text-xs">Current Stage</TableHead>
                    <TableHead className="font-semibold text-foreground py-2 text-xs">Created</TableHead>
                    <TableHead className="font-semibold text-foreground py-2 text-xs">Assigned To</TableHead>
                    <TableHead className="font-semibold text-foreground py-2 text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium text-primary">
                        {app.loan_id || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {app.application_number}
                      </TableCell>
                      <TableCell>{getApplicantName(app)}</TableCell>
                      <TableCell>{formatCurrency(app.requested_amount)}</TableCell>
                      <TableCell>
                        <Badge className={STAGE_COLORS[app.current_stage] || "bg-muted"}>
                          {STAGE_LABELS[app.current_stage] || app.current_stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(app.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getAssigneeName(app)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/los/applications/${app.id}?mode=review`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalRecords={totalCount}
                startRecord={startRecord}
                endRecord={endRecord}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
