import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, ColorSchemeProvider, ColorScheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ClubsList from './pages/ClubsList';
import ClubDetail from './pages/ClubDetail';
import UsersList from './pages/UsersList';
import TeamsPage from './pages/TeamsPage';
import CoachesList from './pages/CoachesList';
import PlayersPage from './pages/PlayersPage';
import Parents from './pages/Parents';
import ScheduleManagement from './pages/ScheduleManagement';
import PaymentsPage from './pages/PaymentsPage';
import AdminPasswordReset from './pages/AdminPasswordReset';
import ResetPasswordConfirmation from './pages/ResetPasswordConfirmation';
import Analytics from './pages/Analytics';
import AttendanceStatistics from './pages/AttendanceStatistics';
import { isMasterAdmin } from './lib/supabase';
import { supabase, refreshToken } from './lib/supabase';

// Protected route component
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      // First, check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // If we have a session, check if it's expired
        const tokenExpiryTime = new Date(session.expires_at! * 1000);
        const now = new Date();
        
        // If token is expired or about to expire in the next 5 minutes, refresh it
        if (tokenExpiryTime.getTime() - now.getTime() < 5 * 60 * 1000) {
          console.log('Token expired or about to expire, refreshing...');
          await refreshToken();
        }
        
        setIsAuthenticated(true);
        
        // Check user role
        const storedRole = localStorage.getItem('userRole');
        setUserRole(storedRole);
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isAuthenticated === null) {
    // Still checking authentication
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    // Not authenticated, redirect to login
    return <Navigate to="/login" replace />;
  }
  
  // If a specific role is required, check for it
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  
  // User is authenticated and has the required role (if any)
  return <>{children}</>;
};

function App() {
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');
  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));
  
  // Add state to track if user has explicitly logged in during this session
  const [hasExplicitLogin, setHasExplicitLogin] = useState<boolean>(false);

  return (
    <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
      <MantineProvider theme={{ colorScheme }} withGlobalStyles withNormalizeCSS>
        <Notifications />
        <Router>
          <Routes>
            <Route path="/login" element={<Login setHasExplicitLogin={setHasExplicitLogin} />} />
            <Route path="/reset-password" element={<AdminPasswordReset />} />
            <Route path="/reset-password-confirmation" element={<ResetPasswordConfirmation />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme} />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              
              {/* Master Admin Routes */}
              <Route path="clubs" element={
                <ProtectedRoute requiredRole="masterAdmin">
                  <ClubsList />
                </ProtectedRoute>
              } />
              <Route path="clubs/:id" element={
                <ProtectedRoute requiredRole="masterAdmin">
                  <ClubDetail />
                </ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute requiredRole="masterAdmin">
                  <UsersList />
                </ProtectedRoute>
              } />
              
              {/* Club Admin Routes */}
              <Route path="teams" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <TeamsPage />
                </ProtectedRoute>
              } />
              <Route path="coaches" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <CoachesList />
                </ProtectedRoute>
              } />
              <Route path="players" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <PlayersPage />
                </ProtectedRoute>
              } />
              <Route path="parents" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <Parents />
                </ProtectedRoute>
              } />
              <Route path="schedule" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <ScheduleManagement />
                </ProtectedRoute>
              } />
              <Route path="payments" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <PaymentsPage />
                </ProtectedRoute>
              } />
              <Route path="analytics" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <Analytics />
                </ProtectedRoute>
              } />
              <Route path="attendance" element={
                <ProtectedRoute requiredRole="clubAdmin">
                  <AttendanceStatistics />
                </ProtectedRoute>
              } />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </MantineProvider>
    </ColorSchemeProvider>
  );
}

export default App;