import { apiRequest, streamSSE } from './client';
import type { ChatRequest, ChatResponse, StreamDelta, Message } from '../types/api';

export async function chatCompletion(
  request: ChatRequest
): Promise<ChatResponse> {
  return apiRequest('/v1/chat/completions', {
    method: 'POST',
    body: request,
  });
}

export async function* chatCompletionStream(
  request: ChatRequest
): AsyncGenerator<StreamDelta> {
  yield* streamSSE<StreamDelta>('/v1/chat/completions', {
    ...request,
    stream: true,
  });
}

export function createMessage(
  role: 'user' | 'assistant' | 'system',
  content: string | Message['content']
): Message {
  return { role, content };
}
