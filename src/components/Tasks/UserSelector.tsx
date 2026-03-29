import { useState, useEffect } from "react";
import { useOrgContext } from "@/hooks/useOrgContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface User {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
}

interface UserSelectorProps {
  selectedUserId: string;
  onChange: (userId: string) => void;
  label?: string;
}

export function UserSelector({ selectedUserId, onChange, label = "Assign To" }: UserSelectorProps) {
  const { orgId } = useOrgContext();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!orgId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("org_id", orgId)
        .order("first_name");

      if (!error && data) {
        setUsers(data);
      }
      setLoading(false);
    };

    fetchUsers();
  }, [orgId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={selectedUserId} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {user.first_name[0]}
                    {user.last_name?.[0] || ""}
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
  );
}
