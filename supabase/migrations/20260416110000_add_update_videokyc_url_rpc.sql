-- RPC used by the R2 migration script to update recording_url inside
-- the loan_verifications.response_data JSONB field.
CREATE OR REPLACE FUNCTION public.update_videokyc_recording_url(
  p_application_id uuid,
  p_old_url text,
  p_new_url text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.loan_verifications
  SET response_data = jsonb_set(
    response_data,
    '{recording_url}',
    to_jsonb(p_new_url)
  )
  WHERE loan_application_id = p_application_id
    AND verification_type = 'video_kyc'
    AND response_data->>'recording_url' = p_old_url;
$$;
