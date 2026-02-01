export interface UserPreferences {
  visible_fields?: string[];
}

export interface User {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  preferences: UserPreferences | null;
  credits: number;
  is_admin: boolean;
  unlimited_credits: boolean;
  created_at: string;
}

export interface AspectRatioInfo {
  width: number;
  height: number;
  name: string;
}

export type ReferenceMode = 'both' | 'background' | 'text';

export type TextBlendingMode = 'ai' | 'programmatic';

export interface DetectedText {
  id: number;
  text: string;
  text_type: 'title' | 'subtitle' | 'author_name' | 'tagline' | 'series_name' | 'publisher' | 'other';
  position: string;
  style_description: string;
}

export interface StyleReference {
  id: number;
  title: string;
  image_url: string;
  original_image_url: string | null;
  clean_image_url: string | null;
  text_layer_url: string | null;
  text_layer_cleaned: boolean;
  detected_text: DetectedText[];
  selected_text_ids: number[];
  created_at: string;
}

export interface Generation {
  id: number;
  book_title: string;
  author_name: string;
  cover_ideas: string | null;
  description: string;
  genres: string[];
  mood: string;
  color_preference: string | null;
  character_description: string | null;
  keywords: string[] | null;
  reference_image_description: string | null;
  style_reference_id: number | null;
  use_style_image: boolean;
  base_image_only: boolean;
  reference_mode: ReferenceMode;
  two_step_generation: boolean;
  aspect_ratio: string;
  aspect_ratio_info: AspectRatioInfo | null;
  base_prompt: string | null;
  text_prompt: string | null;
  base_image_url: string | null;
  final_image_url: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface GenerationInput {
  book_title: string;
  author_name: string;
  cover_ideas?: string;
  description?: string;
  genres?: string[];
  aspect_ratio?: string;
  character_description?: string;
  style_reference_id?: number;
  use_style_image?: boolean;
  base_image_only?: boolean;
  reference_mode?: ReferenceMode;
  two_step_generation?: boolean;
  text_blending_mode?: TextBlendingMode;
}

export interface PaginatedResponse<T> {
  generations: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ApiError {
  error: string;
  details?: string;
}

export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'failed';

export interface GenerationProgress {
  generation_id: number;
  step: number;
  total_steps: number;
  message: string;
}

export interface GenerationState {
  status: GenerationStatus;
  generationId: number | null;
  bookTitle: string | null;
  authorName: string | null;
  step: number;
  totalSteps: number;
  stepMessage: string;
  result: Generation | null;
  error: string | null;
}

export interface Invite {
  id: number;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}
