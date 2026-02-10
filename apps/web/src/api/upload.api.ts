import { api } from './contacts.api';

interface UploadResult {
  id?: string;
  path: string;
  url: string;
  name?: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export const uploadApi = {
  uploadAvatar: async (entityType: string, entityId: string, file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResult>(
      `/upload/avatar/${entityType}/${entityId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  uploadDocument: async (entityType: string, entityId: string, file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResult>(
      `/upload/document/${entityType}/${entityId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Simple file upload without creating document record
  uploadFile: async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResult>(
      '/upload/file',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
};