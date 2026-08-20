CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  result := json_build_object('status', 'success');
  RETURN result;
END;
$$;
