import { useState, useCallback } from 'react';
import { ApiClient } from '../api/client';
import { ApiResponse } from '../interfaces';

// Create singleton instance of ApiClient
const apiClient = new ApiClient();

export function useApi() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const execute = useCallback(async <T>(
    apiCall: () => Promise<ApiResponse<T>>,
    operationKey: string
  ) => {
    try {
      setLoading(prev => ({ ...prev, [operationKey]: true }));
      const response = await apiCall();
      return response;
    } finally {
      setLoading(prev => ({ ...prev, [operationKey]: false }));
    }
  }, []);

  // Agent operations
  const getAgents = useCallback(() => 
    execute(apiClient.getAgents.bind(apiClient), 'getAgents'), 
  [execute]);

  const getAgentById = useCallback((id: string) => 
    execute(() => apiClient.getAgentById(id), `getAgent-${id}`),
  [execute]);

  // Task operations
  const createTask = useCallback((agentId: string, input: string, priority?: string) => 
    execute(() => apiClient.createTask(agentId, input, priority), 'createTask'),
  [execute]);

  const getTasks = useCallback(() => 
    execute(apiClient.getTasks.bind(apiClient), 'getTasks'),
  [execute]);

  const getTaskById = useCallback((id: string) => 
    execute(() => apiClient.getTaskById(id), `getTask-${id}`),
  [execute]);

  // Message operations
  const getMessages = useCallback((taskId: string) => 
    execute(() => apiClient.getMessages(taskId), `getMessages-${taskId}`),
  [execute]);

  const sendMessage = useCallback((taskId: string, content: string) => 
    execute(() => apiClient.sendMessage(taskId, content), `sendMessage-${taskId}`),
  [execute]);

  return {
    loading,
    isLoading: (key: string) => !!loading[key],
    // Agent operations
    getAgents,
    getAgentById,
    // Task operations
    createTask,
    getTasks,
    getTaskById,
    // Message operations
    getMessages,
    sendMessage,
  };
} 