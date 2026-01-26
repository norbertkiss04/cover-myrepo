export interface UserPreferences {
  visible_fields?: string[];
}

export interface User {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  preferences: UserPreferences | null;
  created_at: string;
}

export interface AspectRatioInfo {
  width: number;
  height: number;
  name: string;
}

export interface Generation {
  id: number;
  book_title: string;
  author_name: string;
  summary: string;
  genres: string[];
  mood: string;
  color_preference: string | null;
  character_description: string | null;
  keywords: string[] | null;
  reference_image_description: string | null;
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
  summary?: string;
  genres?: string[];
  mood?: string;
  aspect_ratio?: string;
  color_preference?: string;
  character_description?: string;
  keywords?: string[];
  reference_image_description?: string;
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
