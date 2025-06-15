import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, ColorSchemeProvider, ColorScheme } from '@mantine/core';
import { supabase } from './lib/supabase';
import { isMasterAdmin } from './lib/supabase';
import DashboardLayout from './components/Layout/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClubsList from './pages/ClubsList';
import ClubDetail from './pages/ClubDetail';
import SuspendedClubBanner from './components/SuspendedClubBanner';

// Placeholder for future components
const UsersList = () => <div>Users List</div>;
const ScheduleManagement = () => <div>Schedule Management</div>;
const Analytics = () => <div>Analytics</div>;
const Billing = () => <div>Billing</div>;
const AdminSettings = () => <div>Admin Settings</div>;

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
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
          // Check if master admin
          try {
            const { data, error } = await supabase
              .from('master_admins')
              .select('*')
              .eq('user_id', session.user.id);
            
            console.log('Admin check:', { data, error });
            setDebugInfo(prev => `${prev}\nAdmin check: ${JSON.stringify({ 
              found: data && data.length > 0,
              userId: session.user.id,
              error: error?.message
            })}`);
            
            const isAdminUser = data && data.length > 0 && !error;
            setIsAdmin(isAdminUser);
          } catch (adminError) {
            console.error('Error checking admin status:', adminError);
            setDebugInfo(prev => `${prev}\nAdmin check error: ${JSON.stringify(adminError)}`);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setDebugInfo(prev => `${prev}\nError: ${JSON.stringify(error)}`);
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isAuthenticated === null || isAdmin === null) {
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
  
  if (!isAdmin) {
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

// Club member route component for the mobile app
const ClubMemberRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [clubInfo, setClubInfo] = useState<{name: string, is_suspended: boolean} | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkClubStatus = async () => {
      try {
        // Check session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const isAuth = !!session;
        setIsAuthenticated(isAuth);
        
        if (session) {
          // Check if user belongs to a suspended club
          const { data: userData, error: userError } = await supabase
            .from('admin_profiles')
            .select('user_id')
            .eq('user_id', session.user.id)
            .single();
          
          if (userData) {
            // User is a club admin, check if club is suspended
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
            const { data: coachData, error: coachError } = await supabase
              .from('coaches')
              .select('club_id')
              .eq('user_id', session.user.id)
              .single();
            
            if (coachData) {
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
  
  return (
    <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
      <MantineProvider theme={{ colorScheme }} withGlobalStyles withNormalizeCSS>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/clubs" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <ClubsList />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/clubs/:id" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <ClubDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/users" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <UsersList />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/schedule" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <ScheduleManagement />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <Analytics />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/billing" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <Billing />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                    <AdminSettings />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Router>
      </MantineProvider>
    </ColorSchemeProvider>
  );
};

export default App; 