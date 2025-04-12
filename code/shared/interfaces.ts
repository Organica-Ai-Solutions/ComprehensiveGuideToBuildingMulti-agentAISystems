/**
 * Shared interfaces for communication between services
 */

// --- Agent Interfaces ---
export enum AgentRole {
  PLANNER = "planner",
  RESEARCHER = "researcher",
  WRITER = "writer",
  CODER = "coder",
  CRITIC = "critic"
}

export enum AgentStatus {
  IDLE = "idle",
  WORKING = "working",
  WAITING = "waiting",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  status: AgentStatus;
  capabilities: string[];
}

// --- Task Interfaces ---
export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed"
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

export interface TaskCreate {
  title: string;
  description: string;
  priority?: TaskPriority;
  assigned_agents: string[];
  context?: Record<string, any>;
}

export interface Task extends TaskCreate {
  id: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  result?: any;
}

// --- LLM Interfaces ---
export enum LLMProvider {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
  AZURE_OPENAI = "azure_openai"
}

export enum LLMModel {
  GPT_3_5 = "gpt-3.5-turbo",
  GPT_4 = "gpt-4",
  GPT_4_TURBO = "gpt-4-turbo-preview",
  CLAUDE_2 = "claude-2",
  CLAUDE_3_OPUS = "claude-3-opus",
  CLAUDE_3_SONNET = "claude-3-sonnet",
  CLAUDE_3_HAIKU = "claude-3-haiku"
}

export enum MessageRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
  FUNCTION = "function",
  TOOL = "tool"
}

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  type: string;
  function: FunctionCall;
}

export interface Tool {
  type: string;
  function: FunctionDefinition;
}

export interface CompletionRequest {
  model: LLMModel;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  provider?: LLMProvider;
  tools?: Tool[];
  stream?: boolean;
  request_id?: string;
}

export interface CompletionResponse {
  id: string;
  model: string;
  provider: LLMProvider;
  choices: any[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  created: number;
  tool_calls?: ToolCall[];
}

// --- Memory Interfaces ---
export interface MemoryItem {
  id: string;
  content_type: string;
  content: any;
  metadata: Record<string, any>;
  created_at: string;
  ttl?: number;
}

export interface VectorSearchRequest {
  query: string;
  filter?: Record<string, any>;
  limit?: number;
  namespace?: string;
}

export interface VectorSearchResponse {
  results: MemoryItem[];
  similarity_scores: number[];
}

// --- Service Request/Response Interfaces ---
export interface ServiceRequest {
  service: string;
  endpoint: string;
  method: string;
  data?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface ServiceResponse {
  status_code: number;
  data: any;
  headers: Record<string, string>;
}

// --- React/CoT Interfaces ---
export interface ReasoningStep {
  step_number: number;
  thought: string;
  action?: string;
  action_input?: Record<string, any>;
  observation?: string;
}

export interface CoTTrace {
  steps: ReasoningStep[];
  final_answer?: string;
}

// --- API Response interfaces ---
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, any>;
} 