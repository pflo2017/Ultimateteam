import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  AppShell,
  Navbar,
  Header,
  Text,
  MediaQuery,
  Burger,
  useMantineTheme,
  Group,
  ActionIcon,
  Box,
  NavLink,
  Title,
  Divider,
  Avatar,
  Menu,
  UnstyledButton,
  ColorScheme,
} from '@mantine/core';
import { 
  IconDashboard, 
  IconUsers, 
  IconBuildingCommunity, 
  IconCalendarEvent, 
  IconReportAnalytics,
  IconSettings, 
  IconLogout,
  IconChevronDown,
  IconSun,
  IconMoonStars,
  IconCreditCard,
  IconUserCircle,
  IconCash,
  IconChartBar
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';
import { useColorScheme } from '@mantine/hooks';

interface DashboardLayoutProps {
  children?: React.ReactNode;
  colorScheme?: ColorScheme;
  toggleColorScheme?: () => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  colorScheme: propColorScheme, 
  toggleColorScheme: propToggleColorScheme 
}) => {
  const theme = useMantineTheme();
  const preferredColorScheme = useColorScheme();
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  
  // Local state for colorScheme if not provided via props
  const [localColorScheme, setLocalColorScheme] = useState<ColorScheme>(
    propColorScheme || preferredColorScheme || 'light'
  );
  
  // Use props if available, otherwise use local state
  const colorScheme = propColorScheme || localColorScheme;
  
  // Local toggle function if not provided via props
  const toggleLocalColorScheme = () => {
    setLocalColorScheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  
  // Use props if available, otherwise use local function
  const toggleColorScheme = propToggleColorScheme || toggleLocalColorScheme;
  
  // Get user role from localStorage on component mount
  useEffect(() => {
    const role = localStorage.getItem('userRole');
    setUserRole(role);
    
    if (role === 'clubAdmin') {
      const name = localStorage.getItem('clubName');
      setClubName(name);
    }
  }, []);
  
  // Define sidebar links based on user role
  const getSidebarLinks = (userRole: string | null) => {
    // Common links for all users
    const commonLinks = [
      { label: 'Dashboard', icon: <IconDashboard size={20} />, link: '/' },
    ];

    // Links specific to master admin
    const masterAdminLinks = [
      { label: 'Clubs', icon: <IconBuildingCommunity size={20} />, link: '/clubs' },
      { label: 'Users', icon: <IconUsers size={20} />, link: '/users' },
    ];

    // Links specific to club admin
    const clubAdminLinks = [
      { label: 'Teams', icon: <IconUsers size={20} />, link: '/teams' },
      { label: 'Coaches', icon: <IconUserCircle size={20} />, link: '/coaches' },
      { label: 'Players', icon: <IconUsers size={20} />, link: '/players' },
      { label: 'Parents', icon: <IconUsers size={20} />, link: '/parents' },
      { label: 'Schedule', icon: <IconCalendarEvent size={20} />, link: '/schedule' },
      { label: 'Payments', icon: <IconCash size={20} />, link: '/payments' },
      { label: 'Analytics', icon: <IconChartBar size={20} />, link: '/analytics' },
    ];

    // Return links based on user role
    if (userRole === 'masterAdmin') {
      return [...commonLinks, ...masterAdminLinks];
    } else if (userRole === 'clubAdmin') {
      return [...commonLinks, ...clubAdminLinks];
    }

    // Default to common links only
    return commonLinks;
  };
  
  // Navigation items for master admin
  const masterAdminNavItems = [
    { label: 'Dashboard', icon: <IconDashboard size={20} />, path: '/dashboard' },
    { label: 'Clubs', icon: <IconBuildingCommunity size={20} />, path: '/clubs' },
    { label: 'All Users', icon: <IconUsers size={20} />, path: '/users' },
    { label: 'Coaches', icon: <IconUsers size={20} />, path: '/coaches' },
    { label: 'Players', icon: <IconUsers size={20} />, path: '/players' },
    { label: 'Parents', icon: <IconUsers size={20} />, path: '/parents' },
    { label: 'Payments', icon: <IconCreditCard size={20} />, path: '/payments' },
    { label: 'Analytics', icon: <IconReportAnalytics size={20} />, path: '/analytics' },
    { label: 'Billing', icon: <IconCreditCard size={20} />, path: '/billing' },
    { label: 'Settings', icon: <IconSettings size={20} />, path: '/settings' },
  ];
  
  // Navigation items for club admin
  const clubAdminNavItems = [
    { label: 'Dashboard', icon: <IconDashboard size={20} />, path: '/dashboard' },
    { label: 'Teams', icon: <IconUsers size={20} />, path: '/teams' },
    { label: 'Coaches', icon: <IconUserCircle size={20} />, path: '/coaches' },
    { label: 'Players', icon: <IconUsers size={20} />, path: '/players' },
    { label: 'Parents', icon: <IconUsers size={20} />, path: '/parents' },
    { label: 'Schedule', icon: <IconCalendarEvent size={20} />, path: '/schedule' },
    { label: 'Payments', icon: <IconCreditCard size={20} />, path: '/payments' },
    { label: 'Settings', icon: <IconSettings size={20} />, path: '/settings' },
  ];
  
  // Select the appropriate nav items based on user role
  const navItems = userRole === 'clubAdmin' ? clubAdminNavItems : masterAdminNavItems;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear localStorage
    localStorage.removeItem('userRole');
    localStorage.removeItem('clubId');
    localStorage.removeItem('clubName');
    navigate('/login');
  };

  return (
    <AppShell
      padding="md"
      navbarOffsetBreakpoint="sm"
      navbar={
        <Navbar
          p="md"
          hiddenBreakpoint="sm"
          hidden={!opened}
          width={{ sm: 250, lg: 300 }}
        >
          <Navbar.Section grow>
            {getSidebarLinks(userRole).map((item) => (
              <NavLink
                key={item.link}
                label={item.label}
                icon={item.icon}
                active={location.pathname === item.link}
                onClick={() => {
                  navigate(item.link);
                  setOpened(false);
                }}
                mb={8}
              />
            ))}
          </Navbar.Section>
          <Navbar.Section>
            <Divider my="sm" />
            <NavLink
              label="Logout"
              icon={<IconLogout size={20} />}
              onClick={handleLogout}
            />
          </Navbar.Section>
        </Navbar>
      }
      header={
        <Header height={70} p="md">
          <Group position="apart" sx={{ height: '100%' }}>
            <Group>
              <MediaQuery largerThan="sm" styles={{ display: 'none' }}>
                <Burger
                  opened={opened}
                  onClick={() => setOpened((o) => !o)}
                  size="sm"
                  color={theme.colors.gray[6]}
                  mr="xl"
                />
              </MediaQuery>
              <Title order={3}>
                {userRole === 'clubAdmin' && clubName 
                  ? `${clubName} Admin` 
                  : 'UltimateTeam Admin'}
              </Title>
            </Group>

            <Group>
              <ActionIcon variant="default" onClick={toggleColorScheme} size={30}>
                {colorScheme === 'dark' ? <IconSun size={16} /> : <IconMoonStars size={16} />}
              </ActionIcon>

              <Menu
                width={200}
                position="bottom-end"
                onClose={() => setUserMenuOpened(false)}
                onOpen={() => setUserMenuOpened(true)}
              >
                <Menu.Target>
                  <UnstyledButton>
                    <Group spacing={7}>
                      <Avatar size={30} radius="xl" />
                      <Box sx={{ flex: 1 }}>
                        <Text size="sm" weight={500}>
                          {userRole === 'clubAdmin' ? 'Club Admin' : 'Master Admin'}
                        </Text>
                      </Box>
                      <IconChevronDown size={12} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item icon={<IconSettings size={14} />}>Account settings</Menu.Item>
                  <Menu.Item icon={<IconLogout size={14} />} onClick={handleLogout}>
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Header>
      }
      styles={(theme) => ({
        main: {
          backgroundColor:
            theme.colorScheme === 'dark' ? theme.colors.dark[8] : theme.colors.gray[0],
        },
      })}
    >
      {children || <Outlet />}
    </AppShell>
  );
};

export default DashboardLayout; 