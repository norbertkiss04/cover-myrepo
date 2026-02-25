import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { GenerationInput, ReferenceMode, TextBlendingMode } from '../types';

interface GenerationFormState {
  formData: GenerationInput;
  selectedRefId: number | null;
  selectedTemplateId: number | null;
  baseImageOnly: boolean;
  referenceMode: ReferenceMode;
  twoStepGeneration: boolean;
  textBlendingMode: TextBlendingMode;
  tempFields: Set<string>;
}

interface GenerationFormContextType extends GenerationFormState {
  setFormData: (data: GenerationInput | ((prev: GenerationInput) => GenerationInput)) => void;
  setSelectedRefId: (id: number | null) => void;
  setSelectedTemplateId: (id: number | null) => void;
  setBaseImageOnly: (value: boolean) => void;
  setReferenceMode: (mode: ReferenceMode) => void;
  setTwoStepGeneration: (value: boolean) => void;
  setTextBlendingMode: (mode: TextBlendingMode) => void;
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
  const [selectedRefId, setSelectedRefIdRaw] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateIdRaw] = useState<number | null>(null);
  const [baseImageOnly, setBaseImageOnly] = useState(false);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('both');
  const [twoStepGeneration, setTwoStepGeneration] = useState(true);
  const [textBlendingMode, setTextBlendingMode] = useState<TextBlendingMode>('ai_blend');
  const [tempFields, setTempFieldsRaw] = useState<Set<string>>(new Set());

  const setSelectedRefId = useCallback((id: number | null) => {
    setSelectedRefIdRaw(id);
    if (id === null) {
      setReferenceMode('both');
    }
  }, []);

  const setFormData = useCallback((data: GenerationInput | ((prev: GenerationInput) => GenerationInput)) => {
    setFormDataRaw(data);
  }, []);

  const setSelectedTemplateId = useCallback((id: number | null) => {
    setSelectedTemplateIdRaw(id);
    if (id !== null) {
      setBaseImageOnly(false);
    }
  }, []);

  const setTempFields = useCallback((fields: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setTempFieldsRaw(fields);
  }, []);

  const clearForm = useCallback(() => {
    setFormDataRaw({ ...defaultFormData });
    setSelectedRefIdRaw(null);
    setSelectedTemplateIdRaw(null);
    setBaseImageOnly(false);
    setReferenceMode('both');
    setTwoStepGeneration(true);
    setTextBlendingMode('ai_blend');
    setTempFieldsRaw(new Set());
  }, []);

  const value = useMemo(() => ({
    formData,
    selectedRefId,
    selectedTemplateId,
    baseImageOnly,
    referenceMode,
    twoStepGeneration,
    textBlendingMode,
    tempFields,
    setFormData,
    setSelectedRefId,
    setSelectedTemplateId,
    setBaseImageOnly,
    setReferenceMode,
    setTwoStepGeneration,
    setTextBlendingMode,
    setTempFields,
    clearForm,
  }), [
    formData,
    selectedRefId,
    selectedTemplateId,
    baseImageOnly,
    referenceMode,
    twoStepGeneration,
    textBlendingMode,
    tempFields,
    setFormData,
    setSelectedRefId,
    setSelectedTemplateId,
    setBaseImageOnly,
    setReferenceMode,
    setTwoStepGeneration,
    setTextBlendingMode,
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
