import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import Landing from './pages/Landing';
import DashboardLayout from './components/Layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ClubsList from './pages/ClubsList';
import ClubDetail from './pages/ClubDetail';
import UsersList from './pages/UsersList';
import TeamsPage from './pages/TeamsPage';
import TeamDetails from './pages/TeamDetails';
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
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const toggleColorScheme = (value?: 'light' | 'dark') =>
    setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));
  
  // Add state to track if user has explicitly logged in during this session
  const [hasExplicitLogin, setHasExplicitLogin] = useState<boolean>(false);

  return (
    <MantineProvider theme={{ colorScheme }} withGlobalStyles withNormalizeCSS>
      <Notifications />
      <Router>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<Landing />} />
          {/* Master admin login (hidden route) */}
          <Route path="/master" element={<Login />} />
          {/* Auth routes */}
          <Route path="/reset-password" element={<AdminPasswordReset />} />
          <Route path="/reset-password-confirmation" element={<ResetPasswordConfirmation />} />
          
          {/* Protected dashboard routes */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <DashboardLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme} />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="clubs" element={<ClubsList />} />
            <Route path="clubs/:id" element={<ClubDetail />} />
            <Route path="users" element={<UsersList />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="teams/:teamId" element={<TeamDetails />} />
            <Route path="coaches" element={<CoachesList />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="parents" element={<Parents />} />
            <Route path="schedule" element={<ScheduleManagement />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="attendance" element={<AttendanceStatistics />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MantineProvider>
  );
}

export default App;