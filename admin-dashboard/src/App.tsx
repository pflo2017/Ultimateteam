import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, ColorSchemeProvider, ColorScheme } from '@mantine/core';
import { supabase, refreshToken } from './lib/supabase';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { isMasterAdmin } from './lib/supabase';
import DashboardLayout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClubsList from './pages/ClubsList';
import ClubDetail from './pages/ClubDetail';
import UsersList from './pages/UsersList';
import CoachesList from './pages/CoachesList';
import PlayersPage from './pages/PlayersPage';
import Parents from './pages/Parents';
import PaymentsPage from './pages/PaymentsPage';
import AdminPasswordReset from './pages/AdminPasswordReset';
import ResetPasswordConfirmation from './pages/ResetPasswordConfirmation';
import SuspendedClubBanner from './components/SuspendedClubBanner';
import { Notifications } from '@mantine/notifications';
import ScheduleManagement from './pages/ScheduleManagement';
import TeamsPage from './pages/TeamsPage';

// Add global error handler for 401 Unauthorized errors
const setupGlobalErrorHandler = () => {
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch.call(this, input as RequestInfo, init);
    
    // Check if we got a 401 Unauthorized error
    if (response.status === 401) {
      console.log('Received 401 Unauthorized response, attempting token refresh');
      
      // Try to refresh the token
      const refreshed = await refreshToken();
      
      if (refreshed) {
        // If token refresh was successful, retry the original request
        console.log('Token refreshed successfully, retrying request');
        return originalFetch.call(this, input as RequestInfo, init);
      } else {
        // If token refresh failed, redirect to login
        console.log('Token refresh failed, redirecting to login');
        window.location.href = '/login';
      }
    }
    
    return response;
  };
};

// Call the setup function
setupGlobalErrorHandler();

// Placeholder for future components
const Analytics = () => <div>Analytics</div>;
const Billing = () => <div>Billing</div>;
const AdminSettings = () => <div>Admin Settings</div>;

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check session
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const isAuth = !!session;
        setIsAuthenticated(isAuth);
        
        console.log('Auth check:', { isAuth, session, sessionError });
        setDebugInfo(prev => `${prev}\nAuth check: ${JSON.stringify({ isAuth, hasSession: !!session })}`);
        
        if (session) {
          // Get user role from localStorage
          const userRole = localStorage.getItem('userRole');
          
          if (userRole === 'masterAdmin') {
            // Verify master admin status
            const { data, error: userError } = await supabase
              .from('master_admins')
              .select('*')
              .eq('user_id', session.user.id);
            
            console.log('Master admin check:', { data, userError });
            setDebugInfo(prev => `${prev}\nMaster admin check: ${JSON.stringify({ 
              found: data && data.length > 0,
              userId: session.user.id,
              error: userError?.message
            })}`);
            
            const isAdminUser = data && data.length > 0 && !userError;
            setIsAuthorized(isAdminUser);
          } else if (userRole === 'clubAdmin') {
            // Verify club admin status
            const { data, error: userError } = await supabase
              .from('clubs')
              .select('*')
              .eq('admin_id', session.user.id);
            
            console.log('Club admin check:', { data, userError });
            setDebugInfo(prev => `${prev}\nClub admin check: ${JSON.stringify({ 
              found: data && data.length > 0,
              userId: session.user.id,
              error: userError?.message
            })}`);
            
            const isClubAdminUser = data && data.length > 0 && !userError;
            setIsAuthorized(isClubAdminUser);
          } else {
            // No valid role found
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setDebugInfo(prev => `${prev}\nError: ${JSON.stringify(error)}`);
        setIsAuthenticated(false);
        setIsAuthorized(false);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isAuthenticated === null || isAuthorized === null) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading...</h2>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          background: '#f5f5f5', 
          padding: 10, 
          border: '1px solid #ddd',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {debugInfo || 'No debug info available'}
        </pre>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (!isAuthorized) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this area.</p>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          background: '#f5f5f5', 
          padding: 10, 
          border: '1px solid #ddd',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {debugInfo || 'No debug info available'}
        </pre>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Master Admin only route
const MasterAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const isAuth = !!session;
        setIsAuthenticated(isAuth);
        
        console.log('Auth check:', { isAuth, session, sessionError });
        setDebugInfo(prev => `${prev}\nAuth check: ${JSON.stringify({ isAuth, hasSession: !!session })}`);
        
        if (session) {
          // Check if the user is a master admin
          const { data, error: userError } = await supabase
            .from('master_admins')
            .select('*')
            .eq('user_id', session.user.id);
          
          console.log('Master admin check:', { data, userError });
          setDebugInfo(prev => `${prev}\nMaster admin check: ${JSON.stringify({ 
            found: data && data.length > 0,
            userId: session.user.id,
            error: userError?.message
          })}`);
          
          const isAdminUser = data && data.length > 0 && !userError;
          setIsMasterAdmin(isAdminUser);
        } else {
          setIsMasterAdmin(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setDebugInfo(prev => `${prev}\nError: ${JSON.stringify(error)}`);
        setIsAuthenticated(false);
        setIsMasterAdmin(false);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isAuthenticated === null || isMasterAdmin === null) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading...</h2>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          background: '#f5f5f5', 
          padding: 10, 
          border: '1px solid #ddd',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {debugInfo || 'No debug info available'}
        </pre>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (!isMasterAdmin) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Access Denied</h2>
        <p>Only Master Administrators can access this area.</p>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          background: '#f5f5f5', 
          padding: 10, 
          border: '1px solid #ddd',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {debugInfo || 'No debug info available'}
        </pre>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Club Admin only route
const ClubAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isClubAdmin, setIsClubAdmin] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const isAuth = !!session;
        setIsAuthenticated(isAuth);
        
        console.log('Auth check:', { isAuth, session, sessionError });
        setDebugInfo(prev => `${prev}\nAuth check: ${JSON.stringify({ isAuth, hasSession: !!session })}`);
        
        if (session) {
          // Check if the user is a club admin
          const { data, error: userError } = await supabase
            .from('clubs')
            .select('*')
            .eq('admin_id', session.user.id);
          
          console.log('Club admin check:', { data, userError });
          setDebugInfo(prev => `${prev}\nClub admin check: ${JSON.stringify({ 
            found: data && data.length > 0,
            userId: session.user.id,
            error: userError?.message
          })}`);
          
          const isClubAdminUser = data && data.length > 0 && !userError;
          setIsClubAdmin(isClubAdminUser);
          
          if (isClubAdminUser && data && data.length > 0) {
            // Store club info in localStorage if not already there
            if (!localStorage.getItem('clubId')) {
              localStorage.setItem('clubId', data[0].id);
              localStorage.setItem('clubName', data[0].name);
              localStorage.setItem('userRole', 'clubAdmin');
            }
          }
        } else {
          setIsClubAdmin(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setDebugInfo(prev => `${prev}\nError: ${JSON.stringify(error)}`);
        setIsAuthenticated(false);
        setIsClubAdmin(false);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isAuthenticated === null || isClubAdmin === null) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading...</h2>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          background: '#f5f5f5', 
          padding: 10, 
          border: '1px solid #ddd',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {debugInfo || 'No debug info available'}
        </pre>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (!isClubAdmin) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Access Denied</h2>
        <p>Only Club Administrators can access this area.</p>
        <pre style={{ 
          whiteSpace: 'pre-wrap', 
          background: '#f5f5f5', 
          padding: 10, 
          border: '1px solid #ddd',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {debugInfo || 'No debug info available'}
        </pre>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Club member route component for the mobile app
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ClubMemberRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [clubInfo, setClubInfo] = useState<{name: string, is_suspended: boolean} | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkClubStatus = async () => {
      try {
        // Check session
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const isAuth = !!session;
        setIsAuthenticated(isAuth);
        
        if (session) {
          // Check if user belongs to a suspended club
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { data: userData, error: userError } = await supabase
            .from('admin_profiles')
            .select('user_id')
            .eq('user_id', session.user.id)
            .single();
          
          if (userData) {
            // User is a club admin, check if club is suspended
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { data: clubData, error: clubError } = await supabase
              .from('clubs')
              .select('name, is_suspended')
              .eq('admin_id', session.user.id)
              .single();
            
            if (clubData) {
              setClubInfo(clubData);
            }
          } else {
            // Check if user is a coach
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { data: coachData, error: coachError } = await supabase
              .from('coaches')
              .select('club_id')
              .eq('user_id', session.user.id)
              .single();
            
            if (coachData) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { data: clubData, error: clubError } = await supabase
                .from('clubs')
                .select('name, is_suspended')
                .eq('id', coachData.club_id)
                .single();
              
              if (clubData) {
                setClubInfo(clubData);
              }
            }
          }
        }
      } catch (error) {
        console.error('Club status check error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkClubStatus();
  }, []);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // If club is suspended, show the banner but still allow access
  if (clubInfo?.is_suspended) {
    return (
      <>
        <SuspendedClubBanner clubName={clubInfo.name} />
        {children}
      </>
    );
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');
  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));
  
  // Add state to track if user has explicitly logged in during this session
  const [hasExplicitLogin, setHasExplicitLogin] = useState<boolean>(false);
  
  // Check localStorage on component mount to see if we should clear auth
  useEffect(() => {
    // Clear any existing auth session when the app loads
    const clearSession = async () => {
      // Only clear if user hasn't explicitly logged in during this session
      if (!hasExplicitLogin) {
        localStorage.removeItem('userRole');
        localStorage.removeItem('clubId');
        localStorage.removeItem('clubName');
        await supabase.auth.signOut();
      }
    };
    
    clearSession();
  }, [hasExplicitLogin]);
  
  return (
    <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
      <MantineProvider theme={{ colorScheme }} withGlobalStyles withNormalizeCSS>
        <Notifications />
        <Router>
          <Routes>
            <Route path="/login" element={<Login setHasExplicitLogin={setHasExplicitLogin} />} />
            
            {/* Public routes */}
            <Route path="/reset-admin-password" element={<AdminPasswordReset />} />
            <Route path="/reset-password-confirmation" element={<ResetPasswordConfirmation />} />
            
            {/* Redirect root to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Protected routes that both master and club admins can access */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            {/* Master admin only routes */}
            <Route path="/clubs" element={
              <MasterAdminRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <ClubsList />
                </DashboardLayout>
              </MasterAdminRoute>
            } />
            
            <Route path="/clubs/:id" element={
              <MasterAdminRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <ClubDetail />
                </DashboardLayout>
              </MasterAdminRoute>
            } />
            
            <Route path="/users" element={
              <MasterAdminRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <UsersList />
                </DashboardLayout>
              </MasterAdminRoute>
            } />
            
            {/* Club admin only routes */}
            <Route path="/schedule" element={
              <ClubAdminRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <ScheduleManagement />
                </DashboardLayout>
              </ClubAdminRoute>
            } />
            
            <Route path="/teams" element={
              <ClubAdminRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <TeamsPage />
                </DashboardLayout>
              </ClubAdminRoute>
            } />
            
            {/* Routes accessible by both admin types */}
            <Route path="/coaches" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <CoachesList />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/players" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <PlayersPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/parents" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <Parents />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/payments" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <PaymentsPage />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/analytics" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <Analytics />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/billing" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <Billing />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                  <AdminSettings />
                </DashboardLayout>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </MantineProvider>
    </ColorSchemeProvider>
  );
};

export default App; 