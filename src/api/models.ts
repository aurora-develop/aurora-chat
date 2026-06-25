import { apiRequest } from './client';
import type { Model } from '../types/api';

export async function getModels(): Promise<{ data: Model[] }> {
  return apiRequest('/v1/models', {
    method: 'GET',
  });
}
