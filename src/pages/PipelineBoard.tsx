import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { useNotification } from "@/hooks/useNotification";
import { Search, FileCheck, FileX, Phone, Mail, UserPlus, Upload, Calendar } from "lucide-react";
import { BulkLeadUploadDialog } from "@/components/Pipeline/BulkLeadUploadDialog";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/common/PaginationControls";
import { useOrgContext } from "@/hooks/useOrgContext";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssignmentDialog } from "@/components/LOS/AssignmentDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LoanApplication {
  id: string;
  requested_amount: number | null;
  tenure_days: number | null;
  status: string | null;
  source: string | null;
  created_at: string;
  assigned_to: string | null;
  loan_applicants: {
    first_name: string | null;
    last_name: string | null;
    mobile: string | null;
    email: string | null;
    current_address: {
      state?: string;
      pincode?: string;
    } | null;
  }[] | null;
  contacts: {
    first_name: string;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

interface DocumentCount {
  application_id: string;
  count: number;
  document_types: string[];
}

interface Filters {
  name: string;
  phone: string;
  source: string;
  statusFilter: string;
}

const STATUS_FILTERS = ["all", "new", "approved", "rejected", "in_progress"];

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "in_progress", label: "In-progress" },
];

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  new: "New",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In-progress",
};

const SOURCE_OPTIONS = [
  { value: "all", label: "All Sources" },
  { value: "website", label: "Website" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "fb", label: "Facebook" },
  { value: "direct", label: "Direct" },
  { value: "referral_link", label: "Referral" },
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "repeat_loan", label: "Repeat Loan" },
  { value: "others", label: "Others" },
];

const SOURCE_DISPLAY: Record<string, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
  email: "Email",
  fb: "Facebook",
  direct: "Direct",
  referral_link: "Referral",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  repeat_loan: "Repeat Loan",
  others: "Others",
};

const REQUIRED_DOCUMENTS = [
  "pan_card",
  "aadhaar_card",
  "salary_slip_1",
  "salary_slip_2",
  "salary_slip_3",
];

const DOCUMENT_LABELS: Record<string, string> = {
  pan_card: "PAN Card",
  aadhaar_card: "Aadhaar Card",
  salary_slip_1: "Salary Slip 1",
  salary_slip_2: "Salary Slip 2",
  salary_slip_3: "Salary Slip 3",
};

function DocumentChecklist({ uploaded, applicationId }: { uploaded: string[]; applicationId: string }) {
  const uploadedSet = new Set(uploaded.map(d => d.toLowerCase().replace(/\s+/g, '_')));
  const uploadedCount = REQUIRED_DOCUMENTS.filter(doc => uploadedSet.has(doc)).length;
  const totalRequired = REQUIRED_DOCUMENTS.length;
  
  let colorClass = "text-destructive";
  if (uploadedCount === totalRequired) {
    colorClass = "text-green-600";
  } else if (uploadedCount > 0) {
    colorClass = "text-yellow-600";
  }

  const missing = REQUIRED_DOCUMENTS.filter(doc => !uploadedSet.has(doc));
  const present = REQUIRED_DOCUMENTS.filter(doc => uploadedSet.has(doc));

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 font-medium cursor-help ${colorClass}`}>
            {uploadedCount === totalRequired ? (
              <FileCheck className="h-3.5 w-3.5" />
            ) : (
              <FileX className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">{uploadedCount}/{totalRequired}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-xs space-y-1">
            {present.length > 0 && (
              <div>
                <span className="font-medium text-green-600">Uploaded:</span>
                <ul className="ml-2">
                  {present.map(doc => (
                    <li key={doc}>✓ {DOCUMENT_LABELS[doc]}</li>
                  ))}
                </ul>
              </div>
            )}
            {missing.length > 0 && (
              <div>
                <span className="font-medium text-destructive">Missing:</span>
                <ul className="ml-2">
                  {missing.map(doc => (
                    <li key={doc}>✗ {DOCUMENT_LABELS[doc]}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function PipelineBoard() {
  const [filters, setFilters] = useState<Filters>({
    name: "",
    phone: "",
    source: "all",
    statusFilter: "all"
  });
  
  const notify = useNotification();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId } = useOrgContext();
  
  const tablePagination = usePagination({ defaultPageSize: 50 });

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [assignmentDialog, setAssignmentDialog] = useState<{
    open: boolean;
    applicationId: string;
    currentAssigneeId: string | null;
    currentAssigneeName: string | null;
  } | null>(null);

  const getInitials = (firstName: string, lastName?: string | null) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  // Fetch loan applications with applicant info
  const { data: applicationsData, isLoading } = useQuery({
    queryKey: ['leads-applications', orgId, filters, tablePagination.currentPage, tablePagination.pageSize],
    queryFn: async () => {
      if (!orgId) return { data: [], count: 0 };
      
      const offset = (tablePagination.currentPage - 1) * tablePagination.pageSize;
      
      let query = supabase
        .from("loan_applications")
        .select(`
          id,
          requested_amount,
          tenure_days,
          status,
          source,
          created_at,
          assigned_to,
          loan_applicants (
            first_name,
            last_name,
            mobile,
            email,
            current_address
          ),
          contacts (
            first_name,
            last_name,
            phone,
            email
          )
        `, { count: 'exact' })
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      
      // Apply status filter
      if (filters.statusFilter !== "all") {
        if (filters.statusFilter === "new") {
          query = query.or("status.eq.new,status.eq.draft,status.is.null");
        } else {
          query = query.eq("status", filters.statusFilter);
        }
      }
      
      // Apply source filter
      if (filters.source !== "all") {
        query = query.eq("source", filters.source);
      }
      
      query = query.range(offset, offset + tablePagination.pageSize - 1);
      
      const { data, error, count } = await query;
      if (error) throw error;
      
      return { data: data as LoanApplication[], count: count || 0 };
    },
    enabled: !!orgId,
  });

  // Fetch document counts for all applications
  const applicationIds = applicationsData?.data?.map(a => a.id) || [];
  
  const { data: documentCounts } = useQuery({
    queryKey: ['application-documents', applicationIds],
    queryFn: async () => {
      if (applicationIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("loan_documents")
        .select("loan_application_id, document_type")
        .in("loan_application_id", applicationIds);
      
      if (error) throw error;
      
      // Group by loan_application_id
      const counts: Record<string, string[]> = {};
      (data || []).forEach((doc: { loan_application_id: string; document_type: string }) => {
        if (!counts[doc.loan_application_id]) {
          counts[doc.loan_application_id] = [];
        }
        counts[doc.loan_application_id].push(doc.document_type);
      });
      
      return counts;
    },
    enabled: applicationIds.length > 0,
  });

  // Fetch assigned users for applications
  const assignedUserIds = [...new Set(applicationsData?.data?.filter(a => a.assigned_to).map(a => a.assigned_to) || [])];
  
  const { data: assignedUsers } = useQuery({
    queryKey: ['assigned-users', assignedUserIds],
    queryFn: async () => {
      if (assignedUserIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", assignedUserIds as string[]);
      
      if (error) throw error;
      
      const userMap: Record<string, { first_name: string; last_name: string | null }> = {};
      (data || []).forEach((user) => {
        userMap[user.id] = { first_name: user.first_name, last_name: user.last_name };
      });
      
      return userMap;
    },
    enabled: assignedUserIds.length > 0,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      const { error } = await supabase
        .from("loan_applications")
        .update({ status })
        .eq("id", applicationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-applications'] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    },
  });

  useEffect(() => {
    if (applicationsData) {
      tablePagination.setTotalRecords(applicationsData.count);
    }
  }, [applicationsData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    tablePagination.setPage(1);
  }, [filters]);

  const rawApplications = applicationsData?.data || [];

  // Deduplicate by phone number: keep most processed stage, fallback to latest
  const applications = (() => {
    const stagePriority: Record<string, number> = {
      'application_login': 1,
      'video_kyc': 2,
      'credit_assessment': 3,
      'assessment': 3,
      'approval_pending': 4,
      'rejected': 4,
      'sanctioned': 5,
      'disbursement_pending': 6,
      'disbursed': 7,
    };

    const grouped: Record<string, typeof rawApplications[0]> = {};
    const noPhone: typeof rawApplications = [];

    for (const app of rawApplications) {
      const applicant = app.loan_applicants?.[0];
      const contact = app.contacts;
      const phone = applicant?.mobile || contact?.phone;

      if (!phone || phone === '-') {
        noPhone.push(app);
        continue;
      }

      const existing = grouped[phone];
      if (!existing) {
        grouped[phone] = app;
        continue;
      }

      const appPriority = stagePriority[app.status || ''] || 0;
      const existingPriority = stagePriority[existing.status || ''] || 0;

      if (appPriority > existingPriority ||
          (appPriority === existingPriority && app.created_at > existing.created_at)) {
        grouped[phone] = app;
      }
    }

    return [...Object.values(grouped), ...noPhone];
  })();

  const handleStatusChange = (applicationId: string, status: string) => {
    updateStatusMutation.mutate({ applicationId, status });
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      name: "",
      phone: "",
      source: "all",
      statusFilter: "all"
    });
  };

  // Helper to get applicant/contact info
  const getApplicantInfo = (app: LoanApplication) => {
    const applicant = app.loan_applicants?.[0];
    const contact = app.contacts;
    
    return {
      name: applicant?.first_name 
        ? `${applicant.first_name} ${applicant.last_name || ''}`.trim()
        : contact 
          ? `${contact.first_name} ${contact.last_name || ''}`.trim()
          : '-',
      phone: applicant?.mobile || contact?.phone || '-',
      email: applicant?.email || contact?.email || '-',
      state: applicant?.current_address?.state || '-',
      pinCode: applicant?.current_address?.pincode || '-',
    };
  };

  // Filter by name and phone client-side (since they span multiple tables)
  const filteredApplications = applications.filter(app => {
    const info = getApplicantInfo(app);
    
    if (filters.name.trim()) {
      const nameMatch = info.name.toLowerCase().includes(filters.name.toLowerCase());
      if (!nameMatch) return false;
    }
    
    if (filters.phone.trim()) {
      const phoneMatch = info.phone.includes(filters.phone);
      if (!phoneMatch) return false;
    }
    
    return true;
  });

  const hasActiveFilters = filters.name || filters.phone || filters.source !== "all" || filters.statusFilter !== "all";

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading leads..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">Loan applications overview</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowBulkUpload(true)} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <Button onClick={() => navigate('/pipeline/advanced-search')} variant="outline" size="sm">
              <Search className="h-4 w-4 mr-2" />
              Advanced Search
            </Button>
          </div>
        </div>

        <BulkLeadUploadDialog
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          orgId={orgId}
          onComplete={() => queryClient.invalidateQueries({ queryKey: ['leads-applications'] })}
        />

        {/* Status Filter Tabs */}
        <Tabs value={filters.statusFilter} onValueChange={(value) => handleFilterChange("statusFilter", value)} className="w-full">
          <TabsList className="h-8">
            {STATUS_FILTERS.map((status) => (
              <TabsTrigger key={status} value={status} className="text-xs capitalize px-3 py-1">
                {STATUS_LABELS[status]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Compact Filter Bar */}
        <Card className="border">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 flex-1 min-w-[150px]">
                <Label htmlFor="filter-name" className="text-xs text-muted-foreground">Name</Label>
                <Input
                  id="filter-name"
                  placeholder="Search name..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange("name", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[150px]">
                <Label htmlFor="filter-phone" className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  id="filter-phone"
                  placeholder="Search phone..."
                  value={filters.phone}
                  onChange={(e) => handleFilterChange("phone", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1 min-w-[130px]">
                <Label htmlFor="filter-source" className="text-xs text-muted-foreground">Source</Label>
                <Select value={filters.source} onValueChange={(value) => handleFilterChange("source", value)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 text-xs">
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compact Leads Table */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{STATUS_LABELS[filters.statusFilter]} Leads</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {filteredApplications.length} results
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium py-2 px-3">Date</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">Name</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">Phone</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">Email</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3 text-right">Amount</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3 text-center">Tenure</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">State</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">Pin Code</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3 text-center">Docs</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">Status</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">Source</TableHead>
                    <TableHead className="text-xs font-medium py-2 px-3">Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map(app => {
                    const info = getApplicantInfo(app);
                    const docs = documentCounts?.[app.id] || [];
                    
                    return (
                      <TableRow
                        key={app.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/los/applications/${app.id}`)}
                      >
                        <TableCell className="py-2 px-3">
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            <div>{new Date(app.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                            <div>{new Date(app.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <span className="text-sm font-medium">{info.name}</span>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{info.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-1 max-w-[150px]">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs truncate">{info.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right">
                          <span className="text-xs font-medium">
                            {app.requested_amount ? `₹${app.requested_amount.toLocaleString('en-IN')}` : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <span className="text-xs">{app.tenure_days ? `${app.tenure_days}d` : '-'}</span>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <span className="text-xs">{info.state}</span>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <span className="text-xs">{info.pinCode}</span>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <DocumentChecklist uploaded={docs} applicationId={app.id} />
                        </TableCell>
                        <TableCell className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={app.status || "new"}
                            onValueChange={(value) => handleStatusChange(app.id, value)}
                          >
                            <SelectTrigger className="h-7 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value} className="text-xs">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <Badge variant="outline" className="text-xs font-normal">
                            {SOURCE_DISPLAY[app.source || ''] || app.source || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {app.assigned_to && assignedUsers?.[app.assigned_to] ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[10px] bg-primary/10">
                                    {getInitials(assignedUsers[app.assigned_to].first_name, assignedUsers[app.assigned_to].last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs">
                                  {assignedUsers[app.assigned_to].first_name} {assignedUsers[app.assigned_to].last_name || ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unassigned</span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                const assignedUser = app.assigned_to && assignedUsers?.[app.assigned_to];
                                setAssignmentDialog({
                                  open: true,
                                  applicationId: app.id,
                                  currentAssigneeId: app.assigned_to,
                                  currentAssigneeName: assignedUser
                                    ? `${assignedUser.first_name} ${assignedUser.last_name || ''}`.trim()
                                    : null
                                });
                              }}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredApplications.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground text-sm">
                        No leads found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {tablePagination.totalRecords > tablePagination.pageSize && (
              <div className="p-3 border-t">
                <PaginationControls
                  currentPage={tablePagination.currentPage}
                  totalPages={tablePagination.totalPages}
                  pageSize={tablePagination.pageSize}
                  totalRecords={tablePagination.totalRecords}
                  startRecord={tablePagination.startRecord}
                  endRecord={tablePagination.endRecord}
                  onPageChange={tablePagination.setPage}
                  onPageSizeChange={tablePagination.setPageSize}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {assignmentDialog && (
        <AssignmentDialog
          open={assignmentDialog.open}
          onOpenChange={(open) => {
            if (!open) setAssignmentDialog(null);
          }}
          applicationId={assignmentDialog.applicationId}
          currentAssigneeId={assignmentDialog.currentAssigneeId}
          currentAssigneeName={assignmentDialog.currentAssigneeName}
          orgId={orgId || ""}
          onAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ['leads-applications'] });
            queryClient.invalidateQueries({ queryKey: ['assigned-users'] });
          }}
        />
      )}
    </DashboardLayout>
  );
}
