-- 0016 demo_directory(): scope each institution's people explicitly, not only through row-level security.
-- On hosted Postgres the function's owner can bypass RLS, so the sign-in screen listed both institutions' people
-- under each institution and half of them could not sign in ("That person is not in this institution").
CREATE OR REPLACE FUNCTION demo_directory()
RETURNS TABLE (
  institution_id uuid, institution_name text, institution_short text, buyer_category text, country text,
  principal_id uuid, display_name text, title text, role_key text, division text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE inst record;
BEGIN
  FOR inst IN SELECT * FROM institutions ORDER BY name LOOP
    PERFORM set_config('app.institution_id', inst.id::text, true);
    RETURN QUERY
      SELECT inst.id, inst.name, inst.short_name, inst.buyer_category, inst.country,
             p.id, p.display_name, p.title, pr.role_key, d.name
        FROM principals p
        JOIN principal_roles pr ON pr.principal_id = p.id AND pr.institution_id = inst.id
        LEFT JOIN divisions d ON d.id = p.division_id AND d.institution_id = inst.id
       WHERE p.is_demo AND p.institution_id = inst.id
       ORDER BY pr.role_key;
  END LOOP;
  PERFORM set_config('app.institution_id', '', true);
END $$;

REVOKE ALL ON FUNCTION demo_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION demo_directory() TO tigeris_app;
