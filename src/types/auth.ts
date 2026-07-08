export interface RegisterFormValues {
  email: string;
  password: string;
  username: string;
  displayName: string;
  dateOfBirth: string;
  acceptedTerms: boolean;
}

export type AuthResult = { error: string | null };
