-- Create a one-time script to fix the current user to be admin
-- REPLACE 'your-email@example.com' with your actual email
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Find the user ID by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE';
  
  IF v_user_id IS NOT NULL THEN
    -- 2. Insert into user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- 3. Also ensure a profile exists
    INSERT INTO public.profiles (id, email)
    VALUES (v_user_id, 'YOUR_EMAIL_HERE')
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'User % has been promoted to admin', v_user_id;
  ELSE
    RAISE NOTICE 'User with email YOUR_EMAIL_HERE not found. Please sign up first!';
  END IF;
END $$;
