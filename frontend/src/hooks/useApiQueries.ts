import { useQuery, useQueryClient } from '@tanstack/react-query';
import { generationApi } from '../services/api';
import type { Generation, PaginatedResponse, AspectRatioInfo, StyleReference } from '../types';

export const queryKeys = {
  genres: ['genres'] as const,
  aspectRatios: ['aspect-ratios'] as const,
  styleReferences: ['style-references'] as const,
  generations: (page: number, perPage: number) => ['generations', page, perPage] as const,
};

export function useGenres() {
  return useQuery<string[]>({
    queryKey: queryKeys.genres,
    queryFn: generationApi.getGenres,
    staleTime: Infinity,
  });
}

export function useAspectRatios() {
  return useQuery<Record<string, AspectRatioInfo>>({
    queryKey: queryKeys.aspectRatios,
    queryFn: generationApi.getAspectRatios,
    staleTime: Infinity,
  });
}

export function useStyleReferences() {
  return useQuery<StyleReference[]>({
    queryKey: queryKeys.styleReferences,
    queryFn: generationApi.getStyleReferences,
  });
}

export function useGenerations(page: number, perPage = 12) {
  return useQuery<PaginatedResponse<Generation>>({
    queryKey: queryKeys.generations(page, perPage),
    queryFn: () => generationApi.getAll(page, perPage),
  });
}

export function useInvalidateStyleReferences() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.styleReferences });
}

export function useInvalidateGenerations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['generations'] });
}
