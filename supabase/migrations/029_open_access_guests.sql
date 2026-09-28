-- 029: open-access guests
-- Anonymous Supabase users (auth.signInAnonymously) have no email, but
-- profiles.email is NOT NULL and handle_new_user() copies NEW.email verbatim,
-- so the auth.users insert fails with "Database error saving new user".
-- Give guests a synthetic address instead. Safe to re-run.
-- Also enable "Allow anonymous sign-ins" under Authentication > Providers in
-- the Supabase dashboard; this file cannot do that.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@guest.local'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
