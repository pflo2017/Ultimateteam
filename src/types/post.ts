export interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  team_id?: string;
  media_urls?: string[];
  is_published: boolean;
} 