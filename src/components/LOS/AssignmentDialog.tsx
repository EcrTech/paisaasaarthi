import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Sentinel value for "Unassigned" option (Radix UI forbids empty strings)
const UNASSIGNED_VALUE = "__unassigned__";

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  orgId: string;
  onAssigned?: () => void;
}

export function AssignmentDialog({
  open,
  onOpenChange,
  applicationId,
  currentAssigneeId,
  currentAssigneeName,
  orgId,
  onAssigned,
}: AssignmentDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(
    currentAssigneeId || UNASSIGNED_VALUE
  );
  const queryClient = useQueryClient();

  // Fetch all users in the organization
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["org-users", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("org_id", orgId)
        .order("first_name");

      if (error) throw error;
      return data;
    },
    enabled: open && !!orgId,
  });

  const assignMutation = useMutation({
    mutationFn: async (userId: string | null) => {
      const { error } = await supabase.rpc("assign_application", {
        p_application_id: applicationId,
        p_new_assignee: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      const isUnassigning = selectedUserId === UNASSIGNED_VALUE;
      const selectedUser = users.find((u) => u.id === selectedUserId);
      const userName = selectedUser
        ? `${selectedUser.first_name} ${selectedUser.last_name || ""}`.trim()
        : "Unassigned";
      toast.success(
        !isUnassigning
          ? `Application assigned to ${userName}`
          : "Application unassigned"
      );
      queryClient.invalidateQueries({ queryKey: ["loan-application"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      onOpenChange(false);
      onAssigned?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign application");
    },
  });

  const handleAssign = () => {
    // Convert sentinel value back to null for database
    const userIdToSave = selectedUserId === UNASSIGNED_VALUE ? null : selectedUserId;
    assignMutation.mutate(userIdToSave);
  };

  const getInitials = (firstName: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const isUnassigned = selectedUserId === UNASSIGNED_VALUE;
  const isSameAsCurrentAssignee = 
    (selectedUserId === currentAssigneeId) || 
    (isUnassigned && !currentAssigneeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Reassign Application
          </DialogTitle>
          <DialogDescription>
            Select a team member to assign this application to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentAssigneeName && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(
                    currentAssigneeName.split(" ")[0],
                    currentAssigneeName.split(" ")[1]
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Currently assigned to</p>
                <p className="text-sm font-medium">{currentAssigneeName}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="assignee">Assign to</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isLoadingUsers}
            >
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Select a team member..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(user.first_name, user.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>
                        {user.first_name} {user.last_name || ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assignMutation.isPending || isSameAsCurrentAssignee}
          >
            {assignMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {!isUnassigned ? "Reassign" : "Unassign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
