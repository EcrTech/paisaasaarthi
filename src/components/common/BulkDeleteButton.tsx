import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import { useUserRole } from "@/hooks/useUserRole";

interface BulkDeleteButtonProps {
  selectedIds: string[];
  tableName: "contacts";
  onSuccess: () => void;
  disabled?: boolean;
}

export function BulkDeleteButton({
  selectedIds,
  tableName,
  onSuccess,
  disabled = false,
}: BulkDeleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const notify = useNotification();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useUserRole();

  // Only show button to admins
  if (!isAdmin && !isSuperAdmin) {
    return null;
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        notify.error("Authentication required");
        return;
      }

      const response = await supabase.functions.invoke("bulk-delete", {
        body: {
          tableName,
          recordIds: selectedIds,
        },
      });

      if (response.error) {
        console.error("[BulkDelete] Error:", response.error);
        notify.error(response.error.message || "Failed to delete records");
        return;
      }

      const result = response.data;
      if (result.error) {
        console.error("[BulkDelete] Server error:", result.error);
        notify.error(result.error);
        return;
      }

      notify.success(
        result.message || `Successfully deleted ${result.deletedCount} record(s)`
      );
      onSuccess();
    } catch (error: any) {
      console.error("[BulkDelete] Unexpected error:", error);
      notify.error(error.message || "An unexpected error occurred");
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const isDisabled = disabled || selectedIds.length === 0 || roleLoading || isDeleting;

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={isDisabled}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Selected ({selectedIds.length})
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedIds.length}</strong>{" "}
              record(s) from your organization?
              <br />
              <br />
              This action cannot be undone and will permanently delete the selected
              records from your database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
