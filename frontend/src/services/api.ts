import axios from 'axios';
import { supabase } from '../lib/supabase';
import type { User, UserPreferences, Generation, GenerationInput, PaginatedResponse, AspectRatioInfo, StyleReference } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {

        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
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

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

export const generationApi = {
  getGenres: async (): Promise<string[]> => {
    const response = await api.get('/api/genres');
    return response.data.genres;
  },

  getMoods: async (): Promise<string[]> => {
    const response = await api.get('/api/moods');
    return response.data.moods;
  },

  getAspectRatios: async (): Promise<Record<string, AspectRatioInfo>> => {
    const response = await api.get('/api/aspect-ratios');
    return response.data.aspect_ratios;
  },

  create: async (input: GenerationInput): Promise<Generation> => {
    const response = await api.post('/api/generate', input);
    return response.data;
  },

  getAll: async (page = 1, perPage = 20): Promise<PaginatedResponse<Generation>> => {
    const response = await api.get('/api/generations', {
      params: { page, per_page: perPage },
    });
    return response.data;
  },

  getById: async (id: number): Promise<Generation> => {
    const response = await api.get(`/api/generations/${id}`);
    return response.data;
  },

  regenerate: async (id: number): Promise<Generation> => {
    const response = await api.post(`/api/generations/${id}/regenerate`);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/generations/${id}`);
  },

  analyzeStyle: async (imageBase64: string, title?: string): Promise<StyleReference> => {
    const response = await api.post('/api/analyze-style', {
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
    data: Partial<Pick<StyleReference, 'title' | 'feeling' | 'layout' | 'illustration_rules' | 'typography'>>,
  ): Promise<StyleReference> => {
    const response = await api.put(`/api/style-references/${id}`, data);
    return response.data;
  },

  deleteStyleReference: async (id: number): Promise<void> => {
    await api.delete(`/api/style-references/${id}`);
  },
};

export default api;
