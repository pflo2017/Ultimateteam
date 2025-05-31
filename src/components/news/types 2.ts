export interface TeamInfo {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  title?: string;
  content: string;
  author_id?: string;
  author_name?: string;
  author_avatar?: string;
  author_role?: string;
  created_at: string;
  teams?: TeamInfo[];
  comment_count?: number;
  reaction_count?: number;
} 