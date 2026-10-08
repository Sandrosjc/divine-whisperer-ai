CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL AND lower(new.email) IN ('acheqetto@otlook.com','acheqetto@outlook.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT new.id, 'admin'::app_role
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = new.id AND role = 'admin');
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_owner_admin AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin();