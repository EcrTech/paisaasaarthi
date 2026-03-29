import { useState } from "react";
import { useTasks } from "@/hooks/useTasks";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { Clock, AlertCircle, Plus, CheckCircle2, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskWithUsers } from "@/types/tasks";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskListProps {
  filter?: "all" | "assigned_to_me" | "assigned_by_me";
  limit?: number;
  showCreateButton?: boolean;
}

export function TaskList({ filter = "assigned_to_me", limit, showCreateButton = true }: TaskListProps) {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithUsers | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const offset = (currentPage - 1) * itemsPerPage;
  
  const { data, isLoading } = useTasks({
    filter,
    status: activeTab === "all" ? undefined : activeTab,
    limit: limit || itemsPerPage,
    offset,
  });

  const tasks = data?.tasks || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  
  const { markInProgress, markComplete } = useTaskMutations();

  // Reset to page 1 when filters change
  const handleTabChange = (value: string) => {
    setActiveTab(value as any);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "in_progress":
        return "secondary";
      case "completed":
        return "outline";
      default:
        return "default";
    }
  };

  const getDueDateDisplay = (task: any) => {
    if (task.isOverdue) {
      return (
        <span className="text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Overdue by {Math.abs(task.dueInDays)} days
        </span>
      );
    }
    if (task.dueInDays === 0) {
      return <span className="text-orange-600">Due today</span>;
    }
    if (task.dueInDays === 1) {
      return <span className="text-muted-foreground">Due tomorrow</span>;
    }
    return <span className="text-muted-foreground">Due in {task.dueInDays} days</span>;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Items per page:</span>
          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          {showCreateButton && (
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No tasks found
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedTask(task)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{task.title}</h3>
                      {task.isOverdue && task.status !== "completed" && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={getStatusColor(task.status)}>
                        {task.status.replace("_", " ")}
                      </Badge>
                      <Badge variant={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {getDueDateDisplay(task)}
                      </div>
                      <span className="text-muted-foreground">
                        Assigned to: {task.assignee?.first_name} {task.assignee?.last_name}
                      </span>
                    </div>
                  </div>
                  {task.status !== "completed" && (
                    <div className="flex gap-2">
                      {task.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            markInProgress(task.id);
                          }}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                      )}
                      {task.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            markComplete(task.id);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1} to {Math.min(offset + itemsPerPage, totalCount)} of {totalCount} tasks
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber: number;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                      className="cursor-pointer"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <CreateTaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </div>
  );
}
