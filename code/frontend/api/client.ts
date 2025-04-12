import { Agent, Message, Task, ApiResponse } from '../interfaces';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiClient {
  private async request<T>(
    endpoint: string, 
    method: string = 'GET', 
    data?: any
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: responseData.error || `HTTP Error: ${response.status}`,
        };
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Agent endpoints
  async getAgents(): Promise<ApiResponse<Agent[]>> {
    return this.request<Agent[]>('/agents');
  }

  async getAgentById(id: string): Promise<ApiResponse<Agent>> {
    return this.request<Agent>(`/agents/${id}`);
  }

  // Task endpoints
  async createTask(agentId: string, input: string, priority: string = 'medium'): Promise<ApiResponse<Task>> {
    return this.request<Task>(
      '/tasks', 
      'POST', 
      { agentId, input, priority }
    );
  }

  async getTasks(): Promise<ApiResponse<Task[]>> {
    return this.request<Task[]>('/tasks');
  }

  async getTaskById(id: string): Promise<ApiResponse<Task>> {
    return this.request<Task>(`/tasks/${id}`);
  }

  // Message endpoints
  async getMessages(taskId: string): Promise<ApiResponse<Message[]>> {
    return this.request<Message[]>(`/tasks/${taskId}/messages`);
  }

  async sendMessage(taskId: string, content: string): Promise<ApiResponse<Message>> {
    return this.request<Message>(
      `/tasks/${taskId}/messages`, 
      'POST', 
      { content }
    );
  }
} 