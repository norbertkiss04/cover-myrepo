import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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

export function useDeleteGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => generationApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['generations'] });

      const previousQueries = queryClient.getQueriesData<PaginatedResponse<Generation>>({ queryKey: ['generations'] });

      queryClient.setQueriesData<PaginatedResponse<Generation>>(
        { queryKey: ['generations'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            generations: old.generations.filter((g) => g.id !== id),
            total: old.total - 1,
          };
        }
      );

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      context?.previousQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error('Failed to delete generation');
    },
  });
}

export function useDeleteStyleReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => generationApi.deleteStyleReference(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.styleReferences });

      const previous = queryClient.getQueryData<StyleReference[]>(queryKeys.styleReferences);

      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.filter((r) => r.id !== id) ?? []
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(queryKeys.styleReferences, context?.previous);
      toast.error('Failed to delete style reference');
    },
  });
}

export function useUpdateStyleReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<StyleReference, 'title' | 'feeling' | 'layout' | 'illustration_rules' | 'typography'>> }) =>
      generationApi.updateStyleReference(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.styleReferences });

      const previous = queryClient.getQueryData<StyleReference[]>(queryKeys.styleReferences);

      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === id ? { ...r, ...data } : r)) ?? []
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKeys.styleReferences, context?.previous);
      toast.error('Failed to update style reference');
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? []
      );
    },
  });
}

export type RegeneratePart = 'clean' | 'text_layer' | 'feeling' | 'layout' | 'illustration_rules' | 'typography';

export function useRegenerateStyleReferencePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, part }: { id: number; part: RegeneratePart }) =>
      generationApi.regenerateStyleReferencePart(id, part),
    onSuccess: (updated) => {
      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? []
      );
    },
    onError: () => {
      toast.error('Failed to regenerate. Please try again.');
    },
  });
}
