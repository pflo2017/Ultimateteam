type CardType = 'teams' | 'coaches' | 'players' | 'payments';

export type AdminStackParamList = {
  AdminTabs: undefined;
  ClubSettings: undefined;
  AdminManage: { refresh?: boolean };
  AddTeam: undefined;
  AddCoach: undefined;
  AddPlayer: undefined;
  EditCoach: { coachId: string };
  EditTeam: { teamId: string };
  EditPlayer: { playerId: string };
  TeamDetails: { teamId: string };
  Manage: { activeTab?: CardType; refresh?: boolean };
  CreateActivity: { type: 'practice' | 'match' | 'event' };
  ActivityDetails: { activityId: string };
  PostEditor: {
    mode: 'create' | 'edit';
    post?: any;
    availableTeams?: any[];
    isAdmin?: boolean;
    onSave?: () => void;
  };
  PlayerDetails: { playerId: string; role: 'admin' };
};

export type AdminTabParamList = {
  Home: undefined;
  Manage: { activeTab?: CardType; refresh?: boolean };
  Schedule: undefined;
  Payments: undefined;
  Chat: undefined;
  News: undefined;
  Attendance: undefined;
};

export type CoachTabParamList = {
  CoachDashboard: undefined;
  Manage: undefined;
  Schedule: undefined;
  Payments: undefined;
  Chat: undefined;
  News: undefined;
  Attendance: undefined;
  PlayerDetails: { playerId: string; role: 'coach' };
};

export type ParentTabParamList = {
  Dashboard: undefined;
  Manage: undefined;
  Payments: undefined;
  Events: undefined;
  Chat: undefined;
  News: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  Coach: undefined;
  AdminLogin: undefined;
  AdminRegister: undefined;
  CoachLogin: undefined;
  CoachResetPassword: { phone: string };
  AdminRoot: { screen?: keyof AdminTabParamList; params?: any } | undefined;
  ClubSettings: undefined;
  AddTeam: undefined;
  AddCoach: undefined;
  AddPlayer: undefined;
  EditCoach: { coachId: string };
  EditTeam: { teamId: string };
  EditPlayer: { playerId: string };
  TeamDetails: { teamId: string };
  Manage: { activeTab?: CardType };
  ParentLogin: undefined;
  ParentPasswordLogin: {
    phoneNumber: string;
  };
  ParentTeamCode: {
    phoneNumber: string;
    teamId?: string;
  };
  ParentRegistration: {
    phoneNumber: string;
  };
  ParentVerification: {
    phoneNumber: string;
    isRegistration: boolean;
  };
  ParentResetPassword: {
    phoneNumber: string;
  };
  ParentDashboard: undefined;
  ParentProfile: undefined;
  ParentNavigator: {
    screen?: keyof ParentTabParamList;
  };
  Settings: undefined;
  AdminManage: { refresh?: boolean };
  CreateActivity: { type: 'practice' | 'match' | 'event' };
  ActivityDetails: { activityId: string };
  EditActivity: { activityId: string };
  AttendanceReportDetails: { activityId: string; selectedDate?: string };
  AddAttendance: { activityId?: string; teamId?: string };
  PlayerDetails: { playerId: string; role: 'admin' | 'coach' | 'parent' };
  StatisticsScreen: undefined;
  PlayerAttendanceReportScreen: { 
    playerId: string; 
    playerName: string; 
    teamName: string;
    selectedMonth: number;
    selectedYear: number;
    selectedActivityType: string;
  };
};

export type ParentStackParamList = {
  ParentTabs: undefined;
  Settings: undefined;
  EditChild: { childId: string };
  AddChild: undefined;
  ActivityDetails: { activityId: string };
  EditActivity: { activityId: string };
  PostEditor: undefined;
  PlayerDetails: { playerId: string; role: 'parent' };
}; 