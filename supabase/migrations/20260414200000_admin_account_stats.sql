-- ============================================================
-- Admin RPC: account counts + retention stats
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_account_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT json_build_object(

    -- Total registered accounts
    'total_accounts', (
      SELECT COUNT(*) FROM public.profiles
    ),

    -- Accounts that have submitted at least one plan (activation)
    'activated_accounts', (
      SELECT COUNT(DISTINCT uid) FROM (
        SELECT COALESCE(user_id, auth_user_id) AS uid
        FROM public.hydration_profiles
        WHERE COALESCE(user_id, auth_user_id) IS NOT NULL
      ) sub
    ),

    -- Accounts that have submitted 2+ plans (retained)
    'retained_accounts', (
      SELECT COUNT(*) FROM (
        SELECT COALESCE(user_id, auth_user_id) AS uid
        FROM public.hydration_profiles
        WHERE COALESCE(user_id, auth_user_id) IS NOT NULL
        GROUP BY uid
        HAVING COUNT(*) >= 2
      ) sub
    ),

    -- New accounts grouped by ISO week (Monday), all time
    'accounts_by_week', (
      SELECT COALESCE(json_agg(row_to_json(w) ORDER BY w.week_start), '[]'::json)
      FROM (
        SELECT
          (date_trunc('week', created_at))::date AS week_start,
          COUNT(*) AS count
        FROM public.profiles
        GROUP BY week_start
        ORDER BY week_start
      ) w
    )

  ) INTO result;

  RETURN result;
END;
$$;
