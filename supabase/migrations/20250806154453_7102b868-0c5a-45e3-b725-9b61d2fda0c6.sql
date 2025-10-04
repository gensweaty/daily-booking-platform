-- Create sub_users table to store external users who register for public boards
CREATE TABLE public.sub_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fullname TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure uniqueness per board owner (not across platform)
  CONSTRAINT unique_email_per_owner UNIQUE (board_owner_id, email),
  CONSTRAINT unique_fullname_per_owner UNIQUE (board_owner_id, fullname)
);

-- Enable RLS
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- Create policies for sub_users
CREATE POLICY "Board owners can view their sub users" 
ON public.sub_users 
FOR SELECT 
USING (auth.uid() = board_owner_id);

CREATE POLICY "Board owners can delete their sub users" 
ON public.sub_users 
FOR DELETE 
USING (auth.uid() = board_owner_id);

CREATE POLICY "Allow creating sub users during registration" 
ON public.sub_users 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow updating sub users last login" 
ON public.sub_users 
FOR UPDATE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sub_users_updated_at
BEFORE UPDATE ON public.sub_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();