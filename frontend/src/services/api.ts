import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { supabase, getAccessToken, setCurrentSession } from '../lib/supabase';
import type { User, UserPreferences, Generation, PaginatedResponse, AspectRatioInfo, StyleReference, Invite } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function subscribeToRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeToRefresh((token: string) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !data.session) {
        await supabase.auth.signOut();
        setCurrentSession(null);
        window.location.href = '/login';
        return Promise.reject(error);
      }

      setCurrentSession(data.session);
      const newToken = data.session.access_token;

      onRefreshed(newToken);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch {
      await supabase.auth.signOut();
      setCurrentSession(null);
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);

export const authApi = {
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  syncUser: async (userData: { name?: string; picture?: string }): Promise<User> => {
    const response = await api.post('/auth/sync', userData);
    return response.data;
  },

  updatePreferences: async (preferences: UserPreferences): Promise<User> => {
    const response = await api.put('/auth/preferences', preferences);
    return response.data;
  },

  createInvite: async (): Promise<{ code: string; invite_url: string; expires_at: string }> => {
    const response = await api.post('/auth/invites');
    return response.data;
  },

  getInvites: async (): Promise<{ invites: Invite[] }> => {
    const response = await api.get('/auth/invites');
    return response.data;
  },

  deleteInvite: async (id: number): Promise<void> => {
    await api.delete(`/auth/invites/${id}`);
  },

  giveCredits: async (email: string, amount: number): Promise<{ success: boolean; email: string; new_balance: number }> => {
    const response = await api.post('/auth/credits', { email, amount });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

export const generationApi = {
  getGenres: async (): Promise<string[]> => {
    const response = await api.get('/api/genres');
    return response.data.genres;
  },

  getAspectRatios: async (): Promise<Record<string, AspectRatioInfo>> => {
    const response = await api.get('/api/aspect-ratios');
    return response.data.aspect_ratios;
  },

  getAll: async (page = 1, perPage = 12): Promise<PaginatedResponse<Generation>> => {
    const response = await api.get('/api/generations', {
      params: { page, per_page: perPage },
    });
    return response.data;
  },

  getById: async (id: number): Promise<Generation> => {
    const response = await api.get(`/api/generations/${id}`);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/generations/${id}`);
  },

  uploadStyleReference: async (imageBase64: string, title?: string): Promise<StyleReference> => {
    const response = await api.post('/api/upload-style-reference', {
      image: imageBase64,
      ...(title ? { title } : {}),
    });
    return response.data;
  },

  getStyleReferences: async (): Promise<StyleReference[]> => {
    const response = await api.get('/api/style-references');
    return response.data.style_references;
  },

  updateStyleReference: async (
    id: number,
    data: Partial<Pick<StyleReference, 'title'>>,
  ): Promise<StyleReference> => {
    const response = await api.put(`/api/style-references/${id}`, data);
    return response.data;
  },

  updateTextSelection: async (
    id: number,
    selectedTextIds: number[],
  ): Promise<StyleReference> => {
    const response = await api.put(`/api/style-references/${id}/text-selection`, {
      selected_text_ids: selectedTextIds,
    });
    return response.data;
  },

  deleteStyleReference: async (id: number): Promise<void> => {
    await api.delete(`/api/style-references/${id}`);
  },

  redetectText: async (id: number): Promise<StyleReference> => {
    const response = await api.post(`/api/style-references/${id}/detect-text`);
    return response.data;
  },

  cropImage: async (id: number, crop: { x: number; y: number; width: number; height: number }): Promise<StyleReference> => {
    const response = await api.post(`/api/style-references/${id}/crop`, { crop });
    return response.data;
  },

  regenerateCleanBackground: async (id: number): Promise<StyleReference> => {
    const response = await api.post(`/api/style-references/${id}/regenerate-clean`);
    return response.data;
  },

  regenerateTextLayer: async (id: number): Promise<StyleReference> => {
    const response = await api.post(`/api/style-references/${id}/regenerate-text-layer`);
    return response.data;
  },
};

export default api;
