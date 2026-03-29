import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "./useOrgContext";
import { TaskWithUsers } from "@/types/tasks";

interface UseTasksOptions {
  filter?: "all" | "assigned_to_me" | "assigned_by_me";
  status?: "pending" | "in_progress" | "completed";
  limit?: number;
  offset?: number;
}

export function useTasks(options: UseTasksOptions = {}) {
  const { orgId } = useOrgContext();
  const { filter = "all", status, limit, offset = 0 } = options;

  return useQuery({
    queryKey: ["tasks", orgId, filter, status, limit, offset],
    queryFn: async () => {
      if (!orgId) throw new Error("No organization context");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("tasks")
        .select(`
          *,
          assignee:assigned_to(id, first_name, last_name, email),
          creator:assigned_by(id, first_name, last_name, email)
        `)
        .eq("org_id", orgId);

      // Apply filter
      if (filter === "assigned_to_me") {
        query = query.eq("assigned_to", user.id);
      } else if (filter === "assigned_by_me") {
        query = query.eq("assigned_by", user.id);
      }

      // Apply status filter
      if (status) {
        query = query.eq("status", status);
      }

      // Get total count for pagination
      const countQuery = supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId);

      if (filter === "assigned_to_me") {
        countQuery.eq("assigned_to", user.id);
      } else if (filter === "assigned_by_me") {
        countQuery.eq("assigned_by", user.id);
      }

      if (status) {
        countQuery.eq("status", status);
      }

      const { count } = await countQuery;

      // Order by due date, apply pagination
      query = query.order("due_date", { ascending: true });
      
      if (limit) {
        query = query.limit(limit);
      }

      if (offset) {
        query = query.range(offset, offset + (limit || 10) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate overdue status
      const tasksWithMetadata = data.map((task: any) => ({
        ...task,
        isOverdue: new Date(task.due_date) < new Date() && task.status !== "completed",
        dueInDays: Math.ceil(
          (new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

      return {
        tasks: tasksWithMetadata as (TaskWithUsers & {
          isOverdue: boolean;
          dueInDays: number;
        })[],
        totalCount: count || 0,
      };
    },
    enabled: !!orgId,
  });
}
