export interface Agent {
  id: string;
  name: string;
  role: string;
  goal: string;
  capabilities: string[];
  status: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  type: 'user' | 'agent' | 'system';
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  agentId: string;
  input: string;
  status: TaskStatus;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  priority: TaskPriority;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
} 