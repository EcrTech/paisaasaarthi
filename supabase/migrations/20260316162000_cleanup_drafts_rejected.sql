-- Delete all draft applications (created before 2026-03-31)
-- Use IF EXISTS pattern to handle missing tables gracefully

DELETE FROM public.videokyc_recordings
WHERE application_id IN (
  SELECT id FROM public.loan_applications
  WHERE status = 'draft'
  AND created_at < '2026-03-31'
);

DELETE FROM public.loan_verifications
WHERE loan_application_id IN (
  SELECT id FROM public.loan_applications
  WHERE status = 'draft'
  AND created_at < '2026-03-31'
);

DELETE FROM public.loan_applicants
WHERE loan_application_id IN (
  SELECT id FROM public.loan_applications
  WHERE status = 'draft'
  AND created_at < '2026-03-31'
);

DELETE FROM public.loan_documents
WHERE loan_application_id IN (
  SELECT id FROM public.loan_applications
  WHERE status = 'draft'
  AND created_at < '2026-03-31'
);

DELETE FROM public.loan_disbursements
WHERE loan_application_id IN (
  SELECT id FROM public.loan_applications
  WHERE status = 'draft'
  AND created_at < '2026-03-31'
);

DELETE FROM public.loan_repayment_schedule
WHERE loan_application_id IN (
  SELECT id FROM public.loan_applications
  WHERE status = 'draft'
  AND created_at < '2026-03-31'
);

-- Finally delete the draft loan_applications
DELETE FROM public.loan_applications
WHERE status = 'draft'
AND created_at < '2026-03-31';
