import { apiRequest, streamSSE, uploadFile } from './client';
import type { ImageRequest, ImageResponse, ImageEditRequest } from '../types/api';

export async function generateImage(request: ImageRequest): Promise<ImageResponse> {
  return apiRequest('/v1/images/generations', {
    method: 'POST',
    body: request,
  });
}

export async function* generateImageStream(
  request: ImageRequest
): AsyncGenerator<any> {
  yield* streamSSE('/v1/images/generations', {
    ...request,
    stream: true,
  });
}

export async function editImage(
  request: ImageEditRequest
): Promise<ImageResponse> {
  const formData = new FormData();
  formData.append('model', request.model || 'gpt-image-2');
  if (request.prompt) formData.append('prompt', request.prompt);
  formData.append('n', String(request.n || 1));
  formData.append('response_format', request.response_format || 'url');

  if (typeof request.image === 'string') {
    formData.append('image_url', request.image);
  } else {
    formData.append('image', request.image);
  }

  return uploadFile('/v1/images/edits', formData);
}

export async function downloadImage(url: string): Promise<Blob> {
  const response = await fetch(url);
  return response.blob();
}
