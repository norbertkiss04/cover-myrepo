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

export interface StyleAnalysis {
  feeling: string;
  layout: string;
  illustration_rules: string;
  typography: string;
}

export interface StyleReference {
  id: number;
  title: string;
  image_url: string;
  feeling: string | null;
  layout: string | null;
  illustration_rules: string | null;
  typography: string | null;
  created_at: string;
}

export interface Generation {
  id: number;
  book_title: string;
  author_name: string;
  cover_ideas: string | null;
  summary: string;
  genres: string[];
  mood: string;
  color_preference: string | null;
  character_description: string | null;
  keywords: string[] | null;
  reference_image_description: string | null;
  style_analysis: StyleAnalysis | null;
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
  summary?: string;
  genres?: string[];
  aspect_ratio?: string;
  character_description?: string;
  style_analysis?: StyleAnalysis;
  style_reference_id?: number;
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
