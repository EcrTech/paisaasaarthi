import DashboardLayout from "@/components/Layout/DashboardLayout";
import { TaskList } from "@/components/Tasks/TaskList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

export default function Tasks() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your tasks</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tasks</CardTitle>
            <CardDescription>View and manage tasks assigned to you or by you</CardDescription>
          </CardHeader>
          <CardContent>
            <TaskList filter="all" showCreateButton={true} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
