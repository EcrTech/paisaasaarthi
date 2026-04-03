import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useLOSPermissions } from "@/hooks/useLOSPermissions";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Eye, FileText, Sparkles, UserPlus, CalendarIcon, X, MapPinOff, Pencil } from "lucide-react";
import { AssignmentDialog } from "@/components/LOS/AssignmentDialog";
import { differenceInHours, format } from "date-fns";
import { LoadingState } from "@/components/common/LoadingState";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";
import { cn } from "@/lib/utils";

import { STAGE_LABELS, STAGE_OPTIONS, STATUS_COLORS } from "@/constants/loanStages";

export default function Applications() {
  const navigate = useNavigate();
  const { orgId } = useOrgContext();
  const { permissions } = useLOSPermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedAppForAssignment, setSelectedAppForAssignment] = useState<{
    id: string;
    assigneeId: string | null;
    assigneeName: string | null;
  } | null>(null);

  const isFreshApplication = (createdAt: string) => {
    return differenceInHours(new Date(), new Date(createdAt)) < 48;
  };

const { data: applications = [], isLoading } = useQuery({
    queryKey: ["loan-applications", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(`
          id,
          loan_id,
          application_number,
          status,
          current_stage,
          rejection_reason,
          requested_amount,
          tenure_days,
          source,
          created_at,
          assigned_to,
          loan_applicants(first_name, last_name, mobile, current_address),
          contacts(first_name, last_name, phone),
          assigned_profile:profiles!loan_applications_assigned_to_fkey(first_name, last_name)
        `)
        .eq("org_id", orgId)
        .or("status.neq.draft,current_stage.eq.lead")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching loan applications:", error);
        throw error;
      }
      return data as any[];
    },
    enabled: !!orgId,
    staleTime: 30000, // 30 seconds - reduce unnecessary refetches
  });

  // Fetch negative areas list
  const { data: negativeAreas = [] } = useQuery({
    queryKey: ["negative-areas", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_negative_areas")
        .select("area_value")
        .eq("org_id", orgId)
        .eq("area_type", "pincode")
        .eq("is_active", true);
      if (error) throw error;
      return data.map(a => a.area_value);
    },
    enabled: !!orgId,
  });

  // Helper function to check if application is from negative area
  const isNegativeAreaApplication = (app: any) => {
    const pincode = app.loan_applicants?.[0]?.current_address?.pincode;
    return pincode && negativeAreas.includes(pincode);
  };

  const filteredApplications = useMemo(() => applications.filter((app) => {
    if (stageFilter !== "all" && app.current_stage !== stageFilter) return false;
    
    // Date range filter
    const appDate = new Date(app.created_at);
    if (dateFrom) {
      const fromStart = new Date(dateFrom);
      fromStart.setHours(0, 0, 0, 0);
      if (appDate < fromStart) return false;
    }
    if (dateTo) {
      const toEnd = new Date(dateTo);
      toEnd.setHours(23, 59, 59, 999);
      if (appDate > toEnd) return false;
    }
    
    const searchLower = searchQuery.toLowerCase();
    if (!searchLower) return true;
    
    const applicant = app.loan_applicants?.[0];
    const applicantName = applicant
      ? `${applicant.first_name || ""} ${applicant.last_name || ""}`.toLowerCase()
      : "";
    const contactName = app.contacts
      ? `${app.contacts.first_name} ${app.contacts.last_name || ""}`.toLowerCase()
      : "";
    return (
      (app.application_number || "").toLowerCase().includes(searchLower) ||
      applicantName.includes(searchLower) ||
      contactName.includes(searchLower)
    );
  }), [applications, stageFilter, dateFrom, dateTo, searchQuery]);

  const pagination = usePagination({
    defaultPageSize: 100,
    totalRecords: filteredApplications.length,
  });

  const paginatedApplications = filteredApplications.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getApplicantName = (app: any) => {
    if (app.loan_applicants?.[0]) {
      return `${app.loan_applicants[0].first_name} ${app.loan_applicants[0].last_name || ""}`.trim();
    }
    if (app.contacts) {
      return `${app.contacts.first_name} ${app.contacts.last_name || ""}`.trim();
    }
    return "Not linked";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading applications..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Loan Applications</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track all loan applications
            </p>
          </div>
          {/* Applications can only be created via referral links */}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by application number or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !dateFrom && !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom && dateTo
                  ? `${format(dateFrom, "MMM dd")} - ${format(dateTo, "MMM dd")}`
                  : dateFrom
                  ? `From ${format(dateFrom, "MMM dd, yyyy")}`
                  : dateTo
                  ? `Until ${format(dateTo, "MMM dd, yyyy")}`
                  : "Filter by date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex items-center justify-between gap-2 p-3 border-b">
                <span className="text-sm font-medium">Date Range</span>
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex">
                <div className="p-2 border-r">
                  <p className="text-xs text-muted-foreground mb-2 px-2">From Date</p>
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    className="pointer-events-auto"
                    disabled={(date) => dateTo ? date > dateTo : false}
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs text-muted-foreground mb-2 px-2">To Date</p>
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    className="pointer-events-auto"
                    disabled={(date) => dateFrom ? date < dateFrom : false}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Applications</CardTitle>
            <CardDescription>
              {filteredApplications.length} application{filteredApplications.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredApplications.length === 0 ? (
              <div className="text-center py-12 px-6">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No applications found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" || stageFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Share your referral link to receive applications"}
                </p>
                <Button onClick={() => navigate("/los/my-referrals")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Get Referral Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Loan ID</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Application #</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Applicant</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Status</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Stage</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Assigned To</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Amount</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Tenure</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs">Created</TableHead>
                        <TableHead className="font-semibold text-foreground py-2 text-xs text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedApplications.map((app) => (
                        <TableRow
                          key={app.id}
                          className={cn(
                            "cursor-pointer hover:bg-muted/30",
                            isNegativeAreaApplication(app) && "bg-red-50 hover:bg-red-100 border-red-200"
                          )}
                          onClick={() => navigate(`/los/applications/${app.id}`)}
                        >
                          <TableCell className="py-2">
                            <span className="font-mono text-xs text-primary">{app.loan_id || "-"}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs">{app.application_number}</span>
                              {isFreshApplication(app.created_at) && (
                                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 text-[10px] px-1.5 py-0 h-4">
                                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                  NEW
                                </Badge>
                              )}
                              {app.source === "referral_link" && (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] px-1.5 py-0 h-4">
                                  <UserPlus className="h-2.5 w-2.5 mr-0.5" />
                                  Referral
                                </Badge>
                              )}
                              {isNegativeAreaApplication(app) && (
                                <Badge className="bg-red-500 text-white border-0 text-[10px] px-1.5 py-0 h-4">
                                  <MapPinOff className="h-2.5 w-2.5 mr-0.5" />
                                  Negative Area
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-xs">
                            {getApplicantName(app)}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex flex-col gap-0.5">
                              <Badge className={`${STATUS_COLORS[app.status] || "bg-muted"} text-white text-[10px] px-2 py-0 h-5 w-fit`}>
                                {app.status.replace("_", " ").toUpperCase()}
                              </Badge>
                              {app.status === "rejected" && app.rejection_reason && (
                                <span className="text-[10px] text-red-600 leading-tight">
                                  {app.rejection_reason}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="text-[10px] px-2 py-0 h-5">
                              {STAGE_LABELS[app.current_stage] || app.current_stage}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs truncate max-w-[100px]">
                                {app.assigned_profile
                                  ? `${app.assigned_profile.first_name} ${app.assigned_profile.last_name || ""}`.trim()
                                  : "Unassigned"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppForAssignment({
                                    id: app.id,
                                    assigneeId: app.assigned_to || null,
                                    assigneeName: app.assigned_profile
                                      ? `${app.assigned_profile.first_name} ${app.assigned_profile.last_name || ""}`.trim()
                                      : null,
                                  });
                                  setAssignmentDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-xs font-medium text-green-600">
                            {formatCurrency(app.requested_amount)}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">
                            {app.tenure_days}d
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">
                            {format(new Date(app.created_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="py-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/los/applications/${app.id}`);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="px-6 pb-4">
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
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignment Dialog */}
        {selectedAppForAssignment && (
          <AssignmentDialog
            open={assignmentDialogOpen}
            onOpenChange={setAssignmentDialogOpen}
            applicationId={selectedAppForAssignment.id}
            currentAssigneeId={selectedAppForAssignment.assigneeId}
            currentAssigneeName={selectedAppForAssignment.assigneeName}
            orgId={orgId!}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
