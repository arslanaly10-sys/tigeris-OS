-- 0003 Demo directory for the sign-in screen.
-- Before sign-in there is no tenant, and RLS hides every principal. This SECURITY DEFINER function
-- returns only demo principals (is_demo = true) with their role, one institution at a time, so the
-- sign-in screen can offer "choose who you are" without giving the app role cross-tenant reads.

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
        JOIN principal_roles pr ON pr.principal_id = p.id
        LEFT JOIN divisions d ON d.id = p.division_id
       WHERE p.is_demo
       ORDER BY pr.role_key;
  END LOOP;
  PERFORM set_config('app.institution_id', '', true);
END $$;

REVOKE ALL ON FUNCTION demo_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION demo_directory() TO tigeris_app;
