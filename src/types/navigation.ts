type CardType = 'teams' | 'coaches' | 'players' | 'payments';

export type AdminStackParamList = {
  AdminTabs: undefined;
  ClubSettings: undefined;
  AddTeam: undefined;
  AddCoach: undefined;
  EditCoach: { coachId: string };
  EditTeam: { teamId: string };
  TeamDetails: { teamId: string };
  Manage: { activeTab?: CardType };
};

export type AdminTabParamList = {
  Home: undefined;
  Manage: { activeTab?: CardType };
  Payments: undefined;
  Chat: undefined;
  Announcements: undefined;
}; 