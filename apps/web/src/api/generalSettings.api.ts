import { api } from './contacts.api';

export const generalSettingsApi = {
  getCompany: () => api.get('/general-settings/company').then(r => r.data),
  updateCompany: (data: any) => api.put('/general-settings/company', data).then(r => r.data),

  getCurrencies: () => api.get('/general-settings/currencies').then(r => r.data),
  getActiveCurrencies: () => api.get('/general-settings/currencies/active').then(r => r.data),
  createCurrency: (data: any) => api.post('/general-settings/currencies', data).then(r => r.data),
  updateCurrency: (id: string, data: any) => api.put(`/general-settings/currencies/${id}`, data).then(r => r.data),
  setDefaultCurrency: (id: string) => api.post(`/general-settings/currencies/${id}/set-default`).then(r => r.data),
  deleteCurrency: (id: string) => api.delete(`/general-settings/currencies/${id}`).then(r => r.data),

  // Account Statuses
  getAccountStatuses: async () => {
    const { data } = await api.get('/general-settings/account-statuses');
    return data;
  },
  updateAccountStatuses: async (statuses: any[]) => {
    const { data } = await api.put('/general-settings/account-statuses', statuses);
    return data;
  },

  // Contact Type Settings
  getContactTypeSettings: async () => {
    const { data } = await api.get('/general-settings/contact-type-settings');
    return data;
  },
  updateContactTypeSettings: async (settings: any) => {
    const { data } = await api.put('/general-settings/contact-type-settings', settings);
    return data;
  },

  // Data Management
  exportAllData: async () => {
    const response = await api.get('/general-settings/export-data', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const disposition = response.headers['content-disposition'];
    const fileName = disposition
      ? disposition.split('filename="')[1]?.replace('"', '') || 'crm-data-export.xlsx'
      : 'crm-data-export.xlsx';
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  purgeAllData: async (confirmationPhrase: string) => {
    const { data } = await api.post('/general-settings/purge-data', { confirmationPhrase });
    return data as { success: boolean; deleted: Record<string, number> };
  },
};
