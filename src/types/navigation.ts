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
};

export type AdminTabParamList = {
  Home: undefined;
  Manage: { activeTab?: CardType };
  Payments: undefined;
  Chat: undefined;
  News: undefined;
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
  AdminRoot: { screen?: keyof AdminTabParamList } | undefined;
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
};

export type ParentStackParamList = {
  ParentTabs: undefined;
  Settings: undefined;
  EditChild: { childId: string };
  AddChild: undefined;
}; 