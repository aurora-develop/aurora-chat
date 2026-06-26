// API 类型定义

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ContentPart {
  type: 'text' | 'input_file' | 'input_image';
  text?: string;
  file_id?: string;
  image_url?: string | { url: string };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | 'any' | { type: 'function'; function: { name: string } };
  reasoning_effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatChoice {
  index: number;
  message: Message;
  finish_reason: string;
}

export interface StreamDelta {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<Message>;
    finish_reason: string | null;
  }[];
}

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ImageRequest {
  model?: string;
  prompt: string;
  n?: number;
  size?: string;
  response_format?: 'url' | 'b64_json';
  stream?: boolean;
}

export interface ImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export interface ImageEditRequest {
  model?: string;
  prompt?: string;
  image: File | string;
  n?: number;
  size?: string;
  response_format?: 'url' | 'b64_json';
}

export interface TTSRequest {
  model: string;
  input: string;
  voice: string;
  response_format?: string;
}

export interface TranscriptionRequest {
  file: File;
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'verbose_json';
  temperature?: number;
}

export interface TranslationRequest {
  file: File;
  model?: string;
  response_format?: 'json' | 'text' | 'verbose_json';
  temperature?: number;
}

export interface FileUploadResponse {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  session_token?: string;
}
