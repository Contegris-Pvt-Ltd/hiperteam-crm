import { api } from './contacts.api';

export const accountImportApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/account-import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  startImport: async (importData: any) => {
    const { data } = await api.post('/account-import/start', importData);
    return data;
  },
  getJobs: async (page = 1, limit = 10) => {
    const { data } = await api.get('/account-import/jobs', { params: { page, limit } });
    return data;
  },
  getJob: async (id: string) => {
    const { data } = await api.get(`/account-import/jobs/${id}`);
    return data;
  },
  cancelJob: async (id: string) => {
    const { data } = await api.post(`/account-import/jobs/${id}/cancel`);
    return data;
  },
  downloadFailed: async (id: string) => {
    const response = await api.get(`/account-import/jobs/${id}/failed-file`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `failed-accounts-${id.substring(0, 8)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadTemplate: async () => {
    const response = await api.get('/account-import/template', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'account-import-template.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  getFieldOptions: async () => {
    const { data } = await api.get('/account-import/field-options');
    return data;
  },
  getTemplates: async () => {
    const { data } = await api.get('/account-import/templates');
    return data;
  },
  saveTemplate: async (body: { name: string; columnMapping: any; fileHeaders?: string[]; settings?: any }) => {
    const { data } = await api.post('/account-import/templates', body);
    return data;
  },
  updateTemplate: async (id: string, body: any) => {
    const { data } = await api.post(`/account-import/templates/${id}`, body);
    return data;
  },
  deleteTemplate: async (id: string) => {
    const { data } = await api.post(`/account-import/templates/${id}/delete`);
    return data;
  },
};
