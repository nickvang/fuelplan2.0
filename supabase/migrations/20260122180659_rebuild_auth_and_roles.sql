-- 1. Setup Role System
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

-- 2. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Robust Role Check Function (Avoids recursion, handles nulls)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
$$;

-- 5. Policies for user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- 6. Modernized profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- 7. Trigger for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Automatically make the first user an admin if you want, 
  -- or leave it for manual assignment.
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Updated hydration_profiles policies (Fixed schema query error)
ALTER TABLE public.hydration_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert hydration profiles" ON public.hydration_profiles;
CREATE POLICY "Anyone can insert hydration profiles"
  ON public.hydration_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users and admins can view profiles" ON public.hydration_profiles;
CREATE POLICY "Users and admins can view profiles"
  ON public.hydration_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    (auth.jwt() ->> 'email') = user_email 
    OR user_email IS NULL
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.hydration_profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.hydration_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 9. Secure Admin View Function
CREATE OR REPLACE FUNCTION public.get_all_hydration_profiles_admin()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  profile_data JSONB,
  plan_data JSONB,
  consent_given BOOLEAN,
  has_smartwatch_data BOOLEAN,
  user_email TEXT,
  ip_address INET
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    hp.id,
    hp.created_at,
    hp.profile_data,
    hp.plan_data,
    hp.consent_given,
    hp.has_smartwatch_data,
    hp.user_email,
    hp.ip_address
  FROM public.hydration_profiles hp
  ORDER BY hp.created_at DESC;
END;
$$;
