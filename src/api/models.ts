import type { Model } from '../types/api';

/**
 * 获取模型列表 — 直接 GET 请求，不带 Authorization header，避免 OPTIONS preflight
 */
export async function getModels(): Promise<{ data: Model[] }> {
  const settings = JSON.parse(localStorage.getItem('aurora-settings') || '{}');
  const state = settings.state || {};

  let baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  if (state.useCustomApi && state.customApiUrl) {
    baseUrl = state.customApiUrl.replace(/\/+$/, '');
  }

  const response = await fetch(`${baseUrl}/v1/models`);
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }
  return response.json();
}
