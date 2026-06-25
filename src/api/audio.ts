import { uploadFile, downloadBlob } from './client';
import type { TTSRequest, TranscriptionRequest, TranslationRequest } from '../types/api';

export async function textToSpeech(request: TTSRequest): Promise<Blob> {
  return downloadBlob('/v1/audio/speech', request);
}

export async function transcribeAudio(
  request: TranscriptionRequest
): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('model', request.model || 'whisper-1');
  if (request.language) formData.append('language', request.language);
  if (request.prompt) formData.append('prompt', request.prompt);
  formData.append('response_format', request.response_format || 'json');
  if (request.temperature !== undefined) {
    formData.append('temperature', String(request.temperature));
  }

  return uploadFile('/v1/audio/transcriptions', formData);
}

export async function translateAudio(
  request: TranslationRequest
): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('model', request.model || 'whisper-1');
  formData.append('response_format', request.response_format || 'json');
  if (request.temperature !== undefined) {
    formData.append('temperature', String(request.temperature));
  }

  return uploadFile('/v1/audio/translations', formData);
}

export function playAudioBlob(blob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  return audio;
}
