export type UserRole = 'administrator' | 'coach' | 'parent';

export interface LoginCredentials {
  administrator?: {
    email: string;
    password: string;
  };
  coach?: {
    accessCode: string;
  };
  parent?: {
    phoneNumber: string;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  userRole: UserRole | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
} 