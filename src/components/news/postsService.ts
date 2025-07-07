import { Post } from './types';
import { supabase } from '../../lib/supabase';

// Helper to fetch comment count for a post
async function fetchCommentCount(postId: string): Promise<number> {
  const { count } = await supabase
    .from('post_comments')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)
    .eq('is_active', true);
  return count || 0;
}

export const fetchPosts = async (filters?: { team_ids?: string[]; club_id?: string }) : Promise<Post[]> => {
  // If no filters, fetch all general posts and all team posts for the user's teams
  let teamIds = filters?.team_ids || [];
  let clubId = filters?.club_id;
  let userId = null;
  let userRole = null;

  console.log('=== FETCH POSTS DEBUGGING ===');
  console.log('Filters provided:', { teamIds, clubId });

  if (!clubId) {
    console.warn('No club_id provided for fetchPosts, this may result in seeing posts from other clubs');
    // Early return empty array if no club_id is provided - DON'T SHOW ANY POSTS
    // This is necessary to prevent mixing data between clubs
    return [];
  }

  // Get current user ID and determine role
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      
      // Check if user is an admin
      const { data: admin } = await supabase
        .from('admin_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();
        
      if (admin) {
        userRole = 'admin';
      } else {
        // Check if user is a coach
        const { data: coach } = await supabase
          .from('coaches')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (coach) {
          userRole = 'coach';
        }
      }
    }
    console.log('Current user:', { userId, userRole });
  } catch (e) {
    console.log('Error determining user role:', e);
  }

  // If no team_ids provided but user is a coach, fetch their teams
  if (teamIds.length === 0 && userRole === 'coach' && userId) {
    try {
      // Check if user is a coach
      const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!coachError && coach) {
        console.log('Coach detected, fetching assigned teams');
        // Get coach's teams
        const { data: coachTeams, error: teamsError } = await supabase
          .rpc('get_coach_teams', { p_coach_id: coach.id });
          
        if (!teamsError && coachTeams && coachTeams.length > 0) {
          teamIds = coachTeams.map((team: any) => team.team_id);
          console.log('Coach teams:', teamIds);
        } else {
          console.log('No teams found for coach or error:', teamsError);
          // If coach has no teams, only show general posts
          teamIds = [];
        }
      }
    } catch (e) {
      console.log('Error checking if user is coach:', e);
    }
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

  // 2. Fetch team posts based on user role
  let teamPosts: any[] = [];
  
  if (userRole === 'admin') {
    // Admins see all team posts for their club
    if (teamIds.length > 0) {
      // If specific teams are selected, filter by those teams
      console.log('Admin fetching team posts for specific teams:', teamIds);
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
        console.log('Admin team posts count (filtered):', teamPosts.length);
      }
    } else {
      // If no specific teams selected, show all team posts for this club
      console.log('Admin fetching all team posts for club_id:', clubId);
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
        console.log('Admin team posts count (all):', teamPosts.length);
      }
    }
  } else if (userRole === 'coach' && userId) {
    // Coaches see team posts for their assigned teams OR posts they created
    if (teamIds.length > 0) {
      console.log('Coach fetching team posts for their teams:', teamIds);
      
      // First, get posts for teams the coach is assigned to
      const { data: teamData, error: teamError } = await supabase
        .from('posts')
        .select(`
          id, title, content, author_id, author_name, author_role, created_at, is_general, club_id, media_urls,
          post_teams:post_teams!inner ( team_id, team:team_id ( id, name ) )
        `)
        .eq('is_general', false)
        .eq('is_active', true)
        .eq('club_id', clubId)
        .in('post_teams.team_id', teamIds)
        .eq('author_role', 'admin') // Only admin posts for their teams
        .order('created_at', { ascending: false });
      
      // Then, get posts the coach created themselves
      const { data: ownData, error: ownError } = await supabase
        .from('posts')
        .select(`
          id, title, content, author_id, author_name, author_role, created_at, is_general, club_id, media_urls,
          post_teams:post_teams ( team_id, team:team_id ( id, name ) )
        `)
        .eq('is_general', false)
        .eq('is_active', true)
        .eq('club_id', clubId)
        .eq('author_id', userId) // Posts created by this coach
        .order('created_at', { ascending: false });
      
      if (!teamError && teamData) {
        teamPosts = [...teamPosts, ...teamData];
      }
      
      if (!ownError && ownData) {
        teamPosts = [...teamPosts, ...ownData];
      }
      
      console.log('Coach team posts count:', teamPosts.length);
    }
  } else {
    // For parents or other roles, only show posts for their teams
    if (teamIds.length > 0) {
      console.log('User fetching team posts for their teams:', teamIds);
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
        console.log('User team posts count:', teamPosts.length);
      }
    }
  }

  // Merge and format posts
  const allPosts = [...generalPosts, ...teamPosts];
  console.log('Total posts after merging:', allPosts.length);
  
  // Remove duplicates (in case of overlap)
  const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());
  console.log('Total posts after removing duplicates:', uniquePosts.length);
  
  // Format posts to match the Post type
  const postsWithCounts = await Promise.all(
    uniquePosts.map(async post => ({
      id: post.id,
      title: post.title,
      content: post.content,
      author_id: post.author_id,
      author_name: post.author_name,
      author_role: post.author_role,
      created_at: post.created_at,
      is_general: post.is_general,
      club_id: post.club_id,
      media_urls: post.media_urls,
      teams: post.post_teams?.map((pt: any) => pt.team) || [],
      comment_count: await fetchCommentCount(post.id),
    }))
  );
  return postsWithCounts;
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