import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { GenerationInput } from '../types';

interface GenerationFormState {
  formData: GenerationInput;
  selectedRefId: number | null;
  baseImageOnly: boolean;
  tempFields: Set<string>;
}

interface GenerationFormContextType extends GenerationFormState {
  setFormData: (data: GenerationInput | ((prev: GenerationInput) => GenerationInput)) => void;
  setSelectedRefId: (id: number | null) => void;
  setBaseImageOnly: (value: boolean) => void;
  setTempFields: (fields: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  clearForm: () => void;
}

const defaultFormData: GenerationInput = {
  book_title: '',
  author_name: '',
  cover_ideas: '',
  description: '',
  genres: [],
  aspect_ratio: '2:3',
  character_description: '',
};

const GenerationFormContext = createContext<GenerationFormContextType | undefined>(undefined);

export function GenerationFormProvider({ children }: { children: ReactNode }) {
  const [formData, setFormDataRaw] = useState<GenerationInput>({ ...defaultFormData });
  const [selectedRefId, setSelectedRefId] = useState<number | null>(null);
  const [baseImageOnly, setBaseImageOnly] = useState(false);
  const [tempFields, setTempFieldsRaw] = useState<Set<string>>(new Set());

  const setFormData = useCallback((data: GenerationInput | ((prev: GenerationInput) => GenerationInput)) => {
    setFormDataRaw(data);
  }, []);

  const setTempFields = useCallback((fields: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setTempFieldsRaw(fields);
  }, []);

  const clearForm = useCallback(() => {
    setFormDataRaw({ ...defaultFormData });
    setSelectedRefId(null);
    setBaseImageOnly(false);
    setTempFieldsRaw(new Set());
  }, []);

  const value = useMemo(() => ({
    formData,
    selectedRefId,
    baseImageOnly,
    tempFields,
    setFormData,
    setSelectedRefId,
    setBaseImageOnly,
    setTempFields,
    clearForm,
  }), [
    formData,
    selectedRefId,
    baseImageOnly,
    tempFields,
    setFormData,
    setSelectedRefId,
    setBaseImageOnly,
    setTempFields,
    clearForm,
  ]);

  return (
    <GenerationFormContext.Provider value={value}>
      {children}
    </GenerationFormContext.Provider>
  );
}

export function useGenerationForm() {
  const context = useContext(GenerationFormContext);
  if (context === undefined) {
    throw new Error('useGenerationForm must be used within a GenerationFormProvider');
  }
  return context;
}
