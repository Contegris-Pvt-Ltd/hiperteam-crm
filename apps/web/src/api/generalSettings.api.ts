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
};
