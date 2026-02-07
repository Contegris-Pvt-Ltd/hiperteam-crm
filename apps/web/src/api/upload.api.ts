import { api } from './contacts.api';

export const uploadApi = {
  uploadAvatar: async (entityType: 'contacts' | 'accounts', entityId: string, file: File): Promise<{ path: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const { data } = await api.post(`/upload/avatar/${entityType}/${entityId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  uploadDocument: async (file: File): Promise<{ path: string; url: string; originalName: string; mimeType: string; sizeBytes: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const { data } = await api.post('/upload/document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};