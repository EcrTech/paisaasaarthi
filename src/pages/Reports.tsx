import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, CalendarIcon, Phone, Target, TrendingUp, AlertTriangle, Users, IndianRupee, CreditCard, Building2 } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import { useNavigate } from "react-router-dom";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import CampaignAnalyticsTab from "@/components/Reports/Analytics/CampaignAnalyticsTab";
import CallingDashboardTab from "@/components/Reports/CallingDashboard/CallingDashboardTab";
import OverdueBucketReport from "@/components/LOS/Reports/OverdueBucketReport";
import StaffPerformanceDashboard from "@/components/LOS/Reports/StaffPerformanceDashboard";
import CollectionReport from "@/components/LOS/Reports/CollectionReport";
import DisbursalReport from "@/components/LOS/Reports/DisbursalReport";
import CICReport from "@/components/LOS/Reports/CICReport";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface SalesReport {
  user_name: string;
  total_contacts: number;
  total_calls: number;
  total_emails: number;
  total_meetings: number;
  deals_won: number;
  conversion_rate: number;
}

interface PipelineReport {
  stage_name: string;
  contact_count: number;
  stage_color: string;
}

export default function Reports() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 30));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<string>("sales");
  const notify = useNotification();
  const { orgId } = useOrgContext();

  // Load and persist tab from localStorage and URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const savedTab = localStorage.getItem('reports-active-tab');
    
    if (hash) {
      setActiveTab(hash);
    } else if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('reports-active-tab', activeTab);
    window.location.hash = activeTab;
  }, [activeTab]);

  // Optimized sales reports query
  const { data: salesReports = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-reports', fromDate, toDate, orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('get_sales_performance_report', {
        p_org_id: orgId,
        p_start_date: fromDate.toISOString(),
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Optimized pipeline reports query
  const { data: pipelineReports = [], isLoading: pipelineLoading } = useQuery({
    queryKey: ['pipeline-reports', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('get_pipeline_performance_report', {
        p_org_id: orgId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      notify.error("No data", "There is no data to export");
      return;
    }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${format(fromDate, 'yyyy-MM-dd')}_to_${format(toDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    notify.success("Export successful", `Report exported as ${filename}.csv`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Sales Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Unified view of sales performance, campaigns, and call analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "dd MMM yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(date) => date && setFromDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !toDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "dd MMM yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(date) => date && setToDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="sales">
              <Target className="h-4 w-4 mr-2" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <TrendingUp className="h-4 w-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="calling">
              <Phone className="h-4 w-4 mr-2" />
              Calls
            </TabsTrigger>
            <TabsTrigger value="od-buckets">
              <AlertTriangle className="h-4 w-4 mr-2" />
              OD Buckets
            </TabsTrigger>
            <TabsTrigger value="staff-performance">
              <Users className="h-4 w-4 mr-2" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="collections">
              <IndianRupee className="h-4 w-4 mr-2" />
              Collections
            </TabsTrigger>
            <TabsTrigger value="disbursals">
              <CreditCard className="h-4 w-4 mr-2" />
              Disbursals
            </TabsTrigger>
            <TabsTrigger value="cic">
              <Building2 className="h-4 w-4 mr-2" />
              CIC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Sales Performance</h2>
                <p className="text-muted-foreground">Individual sales metrics and pipeline analysis</p>
              </div>
              
              <Tabs defaultValue="performance" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="performance">Team Performance</TabsTrigger>
                  <TabsTrigger value="pipeline">Pipeline Analysis</TabsTrigger>
                  <TabsTrigger value="activity">Activity Metrics</TabsTrigger>
                </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Sales Performance</CardTitle>
                  <CardDescription>Individual performance metrics</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(salesReports, "sales_performance")}
                  disabled={salesLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : salesReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sales data available for this period
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Contacts</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Emails</TableHead>
                        <TableHead className="text-right">Meetings</TableHead>
                        <TableHead className="text-right">Deals Won</TableHead>
                        <TableHead className="text-right">Conversion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReports.map((report, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{report.user_name}</TableCell>
                          <TableCell className="text-right">{report.total_contacts}</TableCell>
                          <TableCell className="text-right">{report.total_calls}</TableCell>
                          <TableCell className="text-right">{report.total_emails}</TableCell>
                          <TableCell className="text-right">{report.total_meetings}</TableCell>
                          <TableCell className="text-right">{report.deals_won}</TableCell>
                          <TableCell className="text-right">{report.conversion_rate}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pipeline Stage Analysis</CardTitle>
                  <CardDescription>Performance metrics by stage</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(pipelineReports, "pipeline_analysis")}
                  disabled={pipelineLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {pipelineLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : pipelineReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pipeline data available
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Contacts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineReports.map((report, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: report.stage_color }}
                              />
                              {report.stage_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{report.contact_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {salesReports.reduce((sum, r) => sum + r.total_calls + r.total_emails + r.total_meetings, 0)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Across all team members
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {salesReports.reduce((sum, r) => sum + r.total_calls, 0)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Phone conversations
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Conversion</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {salesReports.length > 0
                          ? Math.round(
                              salesReports.reduce((sum, r) => sum + Number(r.conversion_rate), 0) /
                                salesReports.length
                            )
                          : 0}
                        %
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Average across team
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <CampaignAnalyticsTab />
          </TabsContent>

          <TabsContent value="calling" className="space-y-4">
            <CallingDashboardTab />
          </TabsContent>

          <TabsContent value="od-buckets" className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">OD Bucket Report</h2>
              <p className="text-muted-foreground">Overdue EMIs categorized by aging — 30, 60, 90+ days</p>
            </div>
            <OverdueBucketReport />
          </TabsContent>

          <TabsContent value="staff-performance" className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Staff Performance</h2>
              <p className="text-muted-foreground">Staff-wise metrics from leads to disbursement and collections</p>
            </div>
            <StaffPerformanceDashboard fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="collections" className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Collection Report</h2>
              <p className="text-muted-foreground">Digi collection report — loan-wise payment details with Excel export</p>
            </div>
            <CollectionReport fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="disbursals" className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Disbursal Report</h2>
              <p className="text-muted-foreground">Digi disbursal report — loan-wise disbursement details with Excel export</p>
            </div>
            <DisbursalReport fromDate={fromDate} toDate={toDate} />
          </TabsContent>

          <TabsContent value="cic" className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">CIC Report</h2>
              <p className="text-muted-foreground">
                Credit Information Company report — all 72 fields in the prescribed format, ready for submission
              </p>
            </div>
            <CICReport fromDate={fromDate} toDate={toDate} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
