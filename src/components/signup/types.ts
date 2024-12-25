export interface SignUpFormProps {
  onSubmit: (data: { email: string; username: string; password: string }) => Promise<void>;
  isLoading: boolean;
}

export interface TrialInfoProps {
  daysLeft: number;
}