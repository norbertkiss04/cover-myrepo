import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { generationApi } from '../services/api';
import type { Generation, PaginatedResponse, AspectRatioInfo, StyleReference, CoverTemplate } from '../types';

export const queryKeys = {
  genres: ['genres'] as const,
  aspectRatios: ['aspect-ratios'] as const,
  styleReferences: ['style-references'] as const,
  templateFonts: ['template-fonts'] as const,
  coverTemplates: ['cover-templates'] as const,
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

export function useTemplateFonts() {
  return useQuery<string[]>({
    queryKey: queryKeys.templateFonts,
    queryFn: generationApi.getTemplateFonts,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useCoverTemplates() {
  return useQuery<CoverTemplate[]>({
    queryKey: queryKeys.coverTemplates,
    queryFn: generationApi.getCoverTemplates,
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

export function useInvalidateCoverTemplates() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.coverTemplates });
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

export function useDeleteCoverTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => generationApi.deleteCoverTemplate(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.coverTemplates });

      const previous = queryClient.getQueryData<CoverTemplate[]>(queryKeys.coverTemplates);

      queryClient.setQueryData<CoverTemplate[]>(
        queryKeys.coverTemplates,
        (old) => old?.filter((r) => r.id !== id) ?? []
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(queryKeys.coverTemplates, context?.previous);
      toast.error('Failed to delete template');
    },
  });
}

export function useUpdateStyleReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<StyleReference, 'title'>> }) =>
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

export function useUpdateTextSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, selectedTextIds }: { id: number; selectedTextIds: number[] }) =>
      generationApi.updateTextSelection(id, selectedTextIds),
    onMutate: async ({ id, selectedTextIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.styleReferences });

      const previous = queryClient.getQueryData<StyleReference[]>(queryKeys.styleReferences);

      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === id ? { ...r, selected_text_ids: selectedTextIds, text_layer_url: null } : r)) ?? []
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKeys.styleReferences, context?.previous);
      toast.error('Failed to update text selection');
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? []
      );
      toast.success('Text selection saved');
    },
  });
}

export function useRedetectText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => generationApi.redetectText(id),
    onError: () => {
      toast.error('Failed to re-detect text');
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? []
      );
      toast.success(`Detected ${updated.detected_text?.length || 0} text segments`);
    },
  });
}

export function useCropImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, crop }: { id: number; crop: { x: number; y: number; width: number; height: number } }) =>
      generationApi.cropImage(id, crop),
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      const message = error.response?.data?.error || 'Failed to crop image';
      toast.error(message);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? []
      );
      toast.success('Image cropped successfully');
    },
  });
}

export function useRegenerateCleanBackground() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => generationApi.regenerateCleanBackground(id),
    onError: () => {
      toast.error('Failed to generate clean background');
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? []
      );
      toast.success('Clean background generated');
    },
  });
}

export function useRegenerateTextLayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => generationApi.regenerateTextLayer(id),
    onError: () => {
      toast.error('Failed to generate text layer');
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StyleReference[]>(
        queryKeys.styleReferences,
        (old) => old?.map((r) => (r.id === updated.id ? updated : r)) ?? []
      );
      const cleanedMsg = updated.text_layer_cleaned ? ' (cleaned)' : '';
      toast.success(`Text layer generated${cleanedMsg}`);
    },
  });
}
