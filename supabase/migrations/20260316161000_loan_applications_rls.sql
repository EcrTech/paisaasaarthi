-- Allow authenticated users to SELECT loan_applications belonging to their org
CREATE POLICY "Users can view loan_applications in their org"
  ON public.loan_applications
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to INSERT loan_applications in their org
CREATE POLICY "Users can insert loan_applications in their org"
  ON public.loan_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to UPDATE loan_applications in their org
CREATE POLICY "Users can update loan_applications in their org"
  ON public.loan_applications
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Also grant RLS policies for loan_applicants (needed to copy applicant data for repeat loans)
CREATE POLICY "Users can view loan_applicants in their org"
  ON public.loan_applicants
  FOR SELECT
  TO authenticated
  USING (
    loan_application_id IN (
      SELECT id FROM public.loan_applications WHERE org_id IN (
        SELECT org_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert loan_applicants in their org"
  ON public.loan_applicants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    loan_application_id IN (
      SELECT id FROM public.loan_applications WHERE org_id IN (
        SELECT org_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );
