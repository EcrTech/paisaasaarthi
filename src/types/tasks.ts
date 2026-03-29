export interface Task {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithUsers extends Task {
  assignee?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
  };
  creator?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
  };
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
