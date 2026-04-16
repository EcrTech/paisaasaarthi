-- Reactivate all deactivated users
UPDATE public.profiles SET is_active = true WHERE is_active = false;
UPDATE public.user_roles SET is_active = true WHERE is_active = false;
