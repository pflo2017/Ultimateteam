export type ActivityType = 'training' | 'game' | 'tournament' | 'other';

export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceRecord {
  activity_id: string;
  activity_title: string;
  activity_type: ActivityType;
  activity_date: string;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
  status: AttendanceStatus;
  recorded_by: string;
  recorded_by_name: string;
  recorded_at: string;
}

export interface AttendanceStats {
  activity_id: string;
  activity_title: string;
  activity_type: ActivityType;
  activity_date: string;
  team_id: string;
  team_name: string;
  present_count: number;
  absent_count: number;
  total_players: number;
  attendance_percentage: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: {
    teams: string[];
    types: ActivityType[];
    dateRange: {
      start: Date;
      end: Date;
    };
    status: AttendanceStatus[];
    players: string[];
  };
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  sortable: boolean;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  attendanceRate: number;
  trendData: Array<{
    date: string;
    rate: number;
  }>;
} 