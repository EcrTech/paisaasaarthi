import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Phone, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/common/LoadingState";
import { Link } from "react-router-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DashboardStats {
  totalContacts: number;
  activeDeals: number;
  callsToday: number;
  conversionRate: number;
  newContactsThisWeek: number;
  dealsWonThisMonth: number;
  contactGrowth: number;
  dealGrowth: number;
}

interface PipelineData {
  stage: string;
  count: number;
  value: number;
}

interface ActivityData {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
}

const COLORS = ['#01B8AA', '#168980', '#8AD4EB', '#F2C80F', '#A66999', '#FE9666', '#FD625E'];

export default function Dashboard() {
  const { orgId, isLoading: authLoading, profileError, isInitialized } = useAuth();
  

  // Fetch optimized dashboard stats using database function
  const { data: rawStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["dashboard-stats", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000, // 2 minutes - reasonable cache time
  });

  // Fetch pipeline distribution
  const { data: pipelineRaw = [], isLoading: pipelineLoading } = useQuery({
    queryKey: ["pipeline-distribution", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_pipeline_distribution", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch activity trends
  const { data: activityRaw = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["activity-trends", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_activity_trends", {
        p_org_id: orgId,
        p_days: 7,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch demo stats for this month
  const { data: demoStats } = useQuery({
    queryKey: ["demo-stats", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");
      const { data, error } = await supabase.rpc("get_demo_stats_this_month", {
        p_org_id: orgId,
      });
      if (error) throw error;
      return data?.[0] || { demos_done: 0, demos_upcoming: 0 };
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });


  // Only show loading during initial auth - not blocking on orgId
  const loading = !isInitialized;

  // Process stats from database function
  const stats: DashboardStats = useMemo(() => {
    if (!rawStats) {
      return {
        totalContacts: 0,
        activeDeals: 0,
        callsToday: 0,
        conversionRate: 0,
        newContactsThisWeek: 0,
        dealsWonThisMonth: 0,
        contactGrowth: 0,
        dealGrowth: 0,
      };
    }

    const {
      total_contacts,
      active_deals,
      calls_today,
      prev_month_contacts,
      conversion_rate,
    } = rawStats;

    // Calculate growth percentages
    const currentMonthContacts = total_contacts - prev_month_contacts;
    const contactGrowth =
      prev_month_contacts > 0
        ? Math.round(((currentMonthContacts - prev_month_contacts) / prev_month_contacts) * 100)
        : 0;

    return {
      totalContacts: total_contacts,
      activeDeals: active_deals,
      callsToday: calls_today,
      conversionRate: conversion_rate || 0,
      newContactsThisWeek: 0, // Placeholder
      dealsWonThisMonth: 0, // Placeholder
      contactGrowth,
      dealGrowth: 0, // Placeholder
    };
  }, [rawStats]);

  // Process pipeline data
  const pipelineData: PipelineData[] = useMemo(() => {
    if (!pipelineRaw || pipelineRaw.length === 0) return [];

    return pipelineRaw.map((item: any) => ({
      stage: item.stage_name,
      count: Number(item.contact_count),
      value: Number(item.contact_count),
    }));
  }, [pipelineRaw]);

  // Process activity data
  const activityData: ActivityData[] = useMemo(() => {
    if (!activityRaw || activityRaw.length === 0) return [];

    // Group by date
    const dateMap = new Map<string, { calls: number; emails: number; meetings: number }>();
    
    activityRaw.forEach((item: any) => {
      const date = new Date(item.activity_date).toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
      });
      
      if (!dateMap.has(date)) {
        dateMap.set(date, { calls: 0, emails: 0, meetings: 0 });
      }
      
      const counts = dateMap.get(date)!;
      if (item.activity_type === "call") counts.calls += Number(item.activity_count);
      else if (item.activity_type === "email") counts.emails += Number(item.activity_count);
      else if (item.activity_type === "meeting") counts.meetings += Number(item.activity_count);
    });

    return Array.from(dateMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }, [activityRaw]);

  // Show error state if profile/org loading failed
  if (profileError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to Load Dashboard</AlertTitle>
            <AlertDescription>
              {profileError}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 w-full"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // Show loading only during initial auth
  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading dashboard data..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time insights into your sales performance</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalContacts}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {stats.contactGrowth >= 0 ? (
                  <>
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">{stats.contactGrowth}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">{Math.abs(stats.contactGrowth)}%</span>
                  </>
                )}
                {' '}from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Demos This Month</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className="text-green-600">{demoStats?.demos_done || 0}</span>
                {" / "}
                <span className="text-blue-600">{demoStats?.demos_upcoming || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Done / Upcoming demos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.callsToday}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.newContactsThisWeek} new contacts this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{`${stats.conversionRate}%`}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.dealsWonThisMonth} deals won this month
              </p>
            </CardContent>
          </Card>
        </div>


        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Distribution</CardTitle>
              <CardDescription>Contacts across pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelineData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No pipeline data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pipelineData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ stage, percent }) => `${stage}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pipelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Trends</CardTitle>
              <CardDescription>Last 7 days activity breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {activityData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No activity data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="calls" stroke="#01B8AA" strokeWidth={2} />
                    <Line type="monotone" dataKey="emails" stroke="#168980" strokeWidth={2} />
                    <Line type="monotone" dataKey="meetings" stroke="#8AD4EB" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Performance</CardTitle>
            <CardDescription>Activities completed over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            {activityData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No activity data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="#01B8AA" />
                  <Bar dataKey="emails" fill="#168980" />
                  <Bar dataKey="meetings" fill="#8AD4EB" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
