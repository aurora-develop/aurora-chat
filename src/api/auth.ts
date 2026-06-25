import { apiRequest } from './client';
import type { AuthResponse } from '../types/api';

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}

export async function sessionToToken(sessionToken: string): Promise<AuthResponse> {
  return apiRequest('/auth/session', {
    method: 'POST',
    body: { session_token: sessionToken },
  });
}
