import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  IconMoonStars
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabase';

interface DashboardLayoutProps {
  children: React.ReactNode;
  colorScheme: 'light' | 'dark';
  toggleColorScheme: () => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  children, 
  colorScheme, 
  toggleColorScheme 
}) => {
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  
  const navItems = [
    { label: 'Dashboard', icon: <IconDashboard size={20} />, path: '/' },
    { label: 'Clubs', icon: <IconBuildingCommunity size={20} />, path: '/clubs' },
    { label: 'Users', icon: <IconUsers size={20} />, path: '/users' },
    { label: 'Schedule', icon: <IconCalendarEvent size={20} />, path: '/schedule' },
    { label: 'Analytics', icon: <IconReportAnalytics size={20} />, path: '/analytics' },
    { label: 'Billing', icon: <IconReportAnalytics size={20} />, path: '/billing' },
    { label: 'Settings', icon: <IconSettings size={20} />, path: '/settings' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                icon={item.icon}
                active={location.pathname === item.path}
                onClick={() => {
                  navigate(item.path);
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
              <Title order={3}>UltimateTeam Admin</Title>
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
                          Admin User
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
      {children}
    </AppShell>
  );
};

export default DashboardLayout; 