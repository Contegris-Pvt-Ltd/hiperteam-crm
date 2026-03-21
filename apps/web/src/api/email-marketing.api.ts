import { api } from './contacts.api';

export const emailMarketingApi = {
  getLists: async () => {
    const { data } = await api.get('/email-marketing/lists');
    return data;
  },
  refreshLists: async () => {
    const { data } = await api.post('/email-marketing/lists/refresh');
    return data;
  },
  testConnection: async () => {
    const { data } = await api.post('/email-marketing/test-connection');
    return data;
  },
  subscribeContact: async (contactId: string, body: { listId: string; listName: string; tags?: string[] }) => {
    const { data } = await api.post(`/email-marketing/contacts/${contactId}/subscribe`, body);
    return data;
  },
  unsubscribeContact: async (contactId: string, listId: string) => {
    await api.delete(`/email-marketing/contacts/${contactId}/lists/${listId}`);
  },
  getContactStats: async (contactId: string) => {
    const { data } = await api.get(`/email-marketing/contacts/${contactId}/stats`);
    return data;
  },
  getAccountContactsStats: async (accountId: string) => {
    const { data } = await api.get(`/email-marketing/accounts/${accountId}/stats`);
    return data;
  },
};
