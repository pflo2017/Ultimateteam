import React from 'react';
import { Paper, Text, Group, Button, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface SuspendedClubBannerProps {
  clubName: string;
  contactEmail?: string;
}

const SuspendedClubBanner: React.FC<SuspendedClubBannerProps> = ({ clubName, contactEmail = 'support@ultimateteam.com' }) => {
  return (
    <Paper 
      withBorder 
      p="md" 
      radius="md" 
      sx={(theme) => ({
        backgroundColor: theme.colors.red[0],
        borderColor: theme.colors.red[6],
      })}
    >
      <Group position="apart" noWrap>
        <Group noWrap>
          <ThemeIcon color="red" size="lg" variant="filled">
            <IconAlertTriangle size={20} />
          </ThemeIcon>
          <div>
            <Text weight={700} size="md">Club Access Suspended</Text>
            <Text size="sm">
              {clubName} has been temporarily suspended. Please contact your club administrator 
              or our support team for assistance.
            </Text>
          </div>
        </Group>
        <Button 
          variant="white" 
          color="red" 
          onClick={() => window.location.href = `mailto:${contactEmail}?subject=Club%20Suspension%20Inquiry%20-%20${encodeURIComponent(clubName)}`}
          sx={{ flexShrink: 0 }}
        >
          Contact Support
        </Button>
      </Group>
    </Paper>
  );
};

export default SuspendedClubBanner; 