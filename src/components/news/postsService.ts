import { Post } from './types';
import { supabase } from '../../lib/supabase';

export const fetchPosts = async (filters?: { team_ids?: string[]; club_id?: string }) : Promise<Post[]> => {
  // If no filters, fetch all general posts and all team posts for the user's teams
  let teamIds = filters?.team_ids || [];
  let clubId = filters?.club_id;

  console.log('=== FETCH POSTS DEBUGGING ===');
  console.log('Filters provided:', { teamIds, clubId });

  if (!clubId) {
    console.warn('No club_id provided for fetchPosts, this may result in seeing posts from other clubs');
    // Early return empty array if no club_id is provided - DON'T SHOW ANY POSTS
    // This is necessary to prevent mixing data between clubs
    return [];
  }

  // 1. Fetch general posts with club_id filter
  let generalPosts: any[] = [];
  const { data: generalData, error: generalError } = await supabase
    .from('posts')
    .select(`
      id, title, content, author_id, author_name, author_role, created_at, is_general, club_id, media_urls
    `)
    .eq('is_general', true)
    .eq('is_active', true)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });
    
  console.log(`Fetched general posts with club_id=${clubId}:`, generalData?.length || 0);
  if (!generalError && generalData) {
    generalPosts = generalData;
  }
    
  console.log('General posts:', generalPosts?.length || 0, 'Error:', generalError);

  // 2. Fetch team posts if teamIds are provided
  let teamPosts: any[] = [];
  if (teamIds.length > 0) {
    console.log('Team posts query with teamIds:', teamIds);
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, content, author_id, author_name, author_role, created_at, is_general, club_id, media_urls,
        post_teams:post_teams!inner ( team_id, team:team_id ( id, name ) )
      `)
      .eq('is_general', false)
      .eq('is_active', true)
      .eq('club_id', clubId)
      .in('post_teams.team_id', teamIds)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      teamPosts = data;
      console.log('Team posts count:', teamPosts.length);
      console.log('Team posts club_ids:', teamPosts.map(p => p.club_id));
    }
    console.log('Team posts (with teamIds):', teamPosts.length, 'Error:', error);
  } else {
    // If no teamIds, fetch all team posts for this club (for admin/coach views)
    console.log('Team posts query without teamIds for club_id:', clubId);
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, content, author_id, author_name, author_role, created_at, is_general, club_id, media_urls,
        post_teams:post_teams ( team_id, team:team_id ( id, name ) )
      `)
      .eq('is_general', false)
      .eq('is_active', true)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      teamPosts = data;
      console.log('Team posts count:', teamPosts.length);
      console.log('Team posts club_ids:', teamPosts.map(p => p.club_id));
    }
    console.log('Team posts (no teamIds):', teamPosts.length, 'Error:', error);
  }

  // Merge and format posts
  const allPosts = [...generalPosts, ...teamPosts];
  console.log('Total posts after merging:', allPosts.length);
  
  // Remove duplicates (in case of overlap)
  const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());
  console.log('Total posts after removing duplicates:', uniquePosts.length);
  console.log('Final posts club_ids:', uniquePosts.map(p => p.club_id));
  console.log('=== END DEBUGGING ===');

  // Fetch comment counts for all post ids
  const postIds = uniquePosts.map((p: any) => p.id);
  let commentCounts: Record<string, number> = {};
  if (postIds.length > 0) {
    const { data: counts, error: countError } = await supabase
      .from('post_comments')
      .select('post_id')
      .in('post_id', postIds)
      .eq('is_active', true);
    if (!countError && counts) {
      counts.forEach((row: any) => {
        commentCounts[row.post_id] = (commentCounts[row.post_id] || 0) + 1;
      });
    }
  }

  // --- Fetch author names ---
  const authorIds = Array.from(new Set(uniquePosts.map((p: any) => p.author_id).filter(Boolean)));
  let adminProfiles: any[] = [];
  let coachProfiles: any[] = [];
  let parentProfiles: any[] = [];

  console.log('Author IDs:', authorIds);

  if (authorIds.length > 0) {
    const [admins, coaches, parents] = await Promise.all([
      supabase.from('admin_profiles').select('user_id, admin_name').in('user_id', authorIds),
      supabase.from('coaches').select('user_id, name').in('user_id', authorIds),
      supabase.from('parents').select('id, name').in('id', authorIds),
    ]);
    adminProfiles = admins.data || [];
    coachProfiles = coaches.data || [];
    parentProfiles = parents.data || [];
    console.log('Fetched parentProfiles:', parentProfiles);
  }

  // Map author_id to name
  const authorNameMap: Record<string, string> = {};
  adminProfiles.forEach((a: any) => { authorNameMap[a.user_id] = a.admin_name; });
  coachProfiles.forEach((c: any) => { authorNameMap[c.user_id] = c.name; });
  parentProfiles.forEach((p: any) => { authorNameMap[p.id] = p.name; });

  // Format posts for UI
  const formattedPosts = uniquePosts.map((p: any) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    author_id: p.author_id,
    author_name: p.author_name,
    author_role: p.author_role,
    created_at: p.created_at,
    teams: (p.post_teams || []).map((pt: any) => pt.team),
    comment_count: commentCounts[p.id] || 0,
    media_urls: p.media_urls || [],
  }));

  // Sort by created_at descending (most recent first)
  formattedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return formattedPosts;
};

export const updatePost = async (postId: string, updates: { title?: string; content?: string }) => {
  const { data, error } = await supabase
    .from('posts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .select()
    .single();
  return { data, error };
};

export const deletePost = async (postId: string) => {
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .select()
    .single();
  return { data, error };
};