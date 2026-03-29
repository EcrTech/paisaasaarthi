import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "./useNotification";
import { useOrgContext } from "./useOrgContext";

export function useTaskMutations() {
  const notify = useNotification();
  const queryClient = useQueryClient();
  const { orgId } = useOrgContext();

  const createTask = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      assigned_to: string;
      due_date: string;
      priority?: "low" | "medium" | "high";
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("tasks").insert([
        {
          ...data,
          org_id: orgId,
          assigned_by: user.id,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Task created successfully");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      notify.error("Failed to create task", error);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        title: string;
        description: string;
        assigned_to: string;
        due_date: string;
        priority: "low" | "medium" | "high";
        status: "pending" | "in_progress" | "completed";
      }>;
    }) => {
      const { error } = await supabase.from("tasks").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Task updated successfully");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      notify.error("Failed to update task", error);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Task deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      notify.error("Failed to delete task", error);
    },
  });

  const markInProgress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Task marked as in progress");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      notify.error("Failed to update task status", error);
    },
  });

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      notify.success("Task marked as complete");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      notify.error("Failed to complete task", error);
    },
  });

  return {
    createTask: createTask.mutate,
    updateTask: updateTask.mutate,
    deleteTask: deleteTask.mutate,
    markInProgress: markInProgress.mutate,
    markComplete: markComplete.mutate,
    isLoading:
      createTask.isPending ||
      updateTask.isPending ||
      deleteTask.isPending ||
      markInProgress.isPending ||
      markComplete.isPending,
  };
}
