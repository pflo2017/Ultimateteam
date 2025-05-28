import { Post } from './types';
import { supabase } from '../../lib/supabase';

export const fetchPosts = async (filters?: { team_ids?: string[] }) : Promise<Post[]> => {
  // If no filters, fetch all general posts and all team posts for the user's teams
  let teamIds = filters?.team_ids || [];

  // 1. Fetch general posts
  let { data: generalPosts, error: generalError } = await supabase
    .from('posts')
    .select(`
      id, title, content, author_id, created_at, is_general, club_id,
      author:author_id ( id, full_name )
    `)
    .eq('is_general', true)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (generalError) generalPosts = [];

  // 2. Fetch team posts if teamIds are provided
  let teamPosts: any[] = [];
  if (teamIds.length > 0) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, content, author_id, created_at, is_general, club_id,
        author:author_id ( id, full_name ),
        post_teams:post_teams!inner ( team_id, team:team_id ( id, name ) )
      `)
      .eq('is_general', false)
      .eq('is_active', true)
      .in('post_teams.team_id', teamIds)
      .order('created_at', { ascending: false });
    if (!error && data) teamPosts = data;
  } else {
    // If no teamIds, fetch all team posts (for admin/coach views)
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, content, author_id, created_at, is_general, club_id,
        author:author_id ( id, full_name ),
        post_teams:post_teams ( team_id, team:team_id ( id, name ) )
      `)
      .eq('is_general', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (!error && data) teamPosts = data;
  }

  // Merge and format posts
  const allPosts = [...(generalPosts || []), ...(teamPosts || [])];
  // Remove duplicates (in case of overlap)
  const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());

  // Format posts for UI
  return uniquePosts.map((p: any) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    author_id: p.author_id,
    author_name: p.author?.full_name || 'Unknown',
    created_at: p.created_at,
    teams: (p.post_teams || []).map((pt: any) => pt.team),
    // comment_count, reaction_count can be added with more queries if needed
  }));
}; 