import { streamSSE, apiRequest } from './client';
import type { ChatRequest, ChatResponse, StreamDelta, Message } from '../types/api';

export async function chatCompletion(
  request: ChatRequest,
  signal?: AbortSignal
): Promise<ChatResponse> {
  return apiRequest('/v1/chat/completions', {
    method: 'POST',
    body: request,
    signal,
  });
}

export async function* chatCompletionStream(
  request: ChatRequest,
  signal?: AbortSignal
): AsyncGenerator<StreamDelta> {
  yield* streamSSE<StreamDelta>('/v1/chat/completions', {
    ...request,
    stream: true,
  }, signal);
}

export function createMessage(
  role: 'user' | 'assistant' | 'system',
  content: string | Message['content']
): Message {
  return { role, content };
}
