// API 客户端基础配置

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** 获取当前生效的 API 配置（支持自定义 API） */
function getApiConfig(): { baseUrl: string; apiKey: string; isCustom: boolean } {
  try {
    const settings = JSON.parse(localStorage.getItem('aurora-settings') || '{}');
    const state = settings.state || {};

    if (state.useCustomApi && state.customApiUrl) {
      const url = state.customApiUrl.replace(/\/+$/, '');
      // 基本 URL 校验
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.warn('⚠️ 自定义 API URL 格式不正确，应以 http:// 或 https:// 开头');
      }
      return {
        baseUrl: url,
        apiKey: state.customApiKey || '',
        isCustom: true,
      };
    }

    return {
      baseUrl: API_BASE_URL,
      apiKey: localStorage.getItem('aurora_token') || '',
      isCustom: false,
    };
  } catch {
    // localStorage 格式损坏时降级到默认配置
    console.warn('⚠️ 读取 API 配置失败，使用默认配置');
    return {
      baseUrl: API_BASE_URL,
      apiKey: '',
      isCustom: false,
    };
  }
}

/** 构建请求 headers（消除 4 处重复）。
 *  GET 请求不加 Content-Type，避免触发 CORS preflight OPTIONS。 */
function createHeaders(apiConfig: { apiKey: string; isCustom: boolean }, method = 'POST', extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }
  if (apiConfig.apiKey) {
    headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
  }
  return headers;
}

/** P1-5: 判断错误是否可重试 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  const msg = (error as Error).message || '';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return true;
  const statusMatch = msg.match(/API Error: (\d+)/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1]);
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
  return false;
}

/** P1-5: 带指数退避的重试包装 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryableError(error)) throw error;
      // 指数退避：1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[重试] 第 ${attempt + 1} 次重试，等待 ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  stream?: boolean;
  signal?: AbortSignal;
}

export async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { method = 'POST', headers = {}, body, stream = false, signal } = config;

  return withRetry(async () => {
    const apiConfig = getApiConfig();

    const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
      method,
      headers: { ...createHeaders(apiConfig, method), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    if (stream) {
      return response as any;
    }

    return response.json();
  });
}

export async function* streamSSE<T>(
  endpoint: string,
  body: any,
  signal?: AbortSignal
): AsyncGenerator<T> {
  const apiConfig = getApiConfig();

  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: createHeaders(apiConfig),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          yield JSON.parse(data);
        } catch (e) {
          console.error('Failed to parse SSE data:', data);
        }
      }
    }
  }
}

export async function uploadFile(
  endpoint: string,
  formData: FormData,
  signal?: AbortSignal
): Promise<any> {
  const apiConfig = getApiConfig();

  // 文件上传不设置 Content-Type（浏览器自动设置 multipart/form-data）
  const headers: Record<string, string> = {};
  if (apiConfig.apiKey) {
    headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
  }

  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function downloadBlob(
  endpoint: string,
  body: any,
  signal?: AbortSignal
): Promise<Blob> {
  const apiConfig = getApiConfig();

  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: createHeaders(apiConfig),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.blob();
}
