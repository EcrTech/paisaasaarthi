GRANT EXECUTE ON FUNCTION public.nextval_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nextval_text(text) TO anon;
GRANT USAGE, SELECT ON SEQUENCE loan_application_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE loan_application_number_seq TO anon;
