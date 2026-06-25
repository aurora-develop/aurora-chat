import { uploadFile } from './client';
import type { FileUploadResponse } from '../types/api';

export async function uploadFileToServer(file: File): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'assistants');

  return uploadFile('/v1/files', formData);
}
