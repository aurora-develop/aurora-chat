// API 客户端基础配置

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** 获取当前生效的 API 配置（支持自定义 API） */
function getApiConfig(): { baseUrl: string; apiKey: string; isCustom: boolean } {
  const settings = JSON.parse(localStorage.getItem('aurora-settings') || '{}');
  const state = settings.state || {};

  if (state.useCustomApi && state.customApiUrl) {
    return {
      baseUrl: state.customApiUrl.replace(/\/+$/, ''),
      apiKey: state.customApiKey || '',
      isCustom: true,
    };
  }

  return {
    baseUrl: API_BASE_URL,
    apiKey: localStorage.getItem('aurora_token') || '',
    isCustom: false,
  };
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  stream?: boolean;
  signal?: AbortSignal;
  /** 强制使用自定义 API 配置 */
  useCustomApi?: boolean;
}

export async function apiRequest<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<T> {
  const { method = 'POST', headers = {}, body, stream = false, signal } = config;

  const apiConfig = getApiConfig();

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiConfig.isCustom) {
    if (apiConfig.apiKey) {
      defaultHeaders['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    }
  } else {
    const token = localStorage.getItem('aurora_token');
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method,
    headers: { ...defaultHeaders, ...headers },
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
}

export async function* streamSSE<T>(
  endpoint: string,
  body: any,
  signal?: AbortSignal
): AsyncGenerator<T> {
  const apiConfig = getApiConfig();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiConfig.isCustom) {
    if (apiConfig.apiKey) {
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    }
  } else {
    const token = localStorage.getItem('aurora_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
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

  const headers: Record<string, string> = {};

  if (apiConfig.isCustom) {
    if (apiConfig.apiKey) {
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    }
  } else {
    const token = localStorage.getItem('aurora_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiConfig.isCustom) {
    if (apiConfig.apiKey) {
      headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
    }
  } else {
    const token = localStorage.getItem('aurora_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response.blob();
}
