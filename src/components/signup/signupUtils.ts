export const validatePassword = (password: string) => {
  if (password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
};

export const createTrialSubscription = async (userId: string, selectedPlan: string) => {
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 14);
  
  return {
    user_id: userId,
    plan_type: selectedPlan,
    status: 'trial',
    trial_end_date: trialEndDate.toISOString(),
  };
};