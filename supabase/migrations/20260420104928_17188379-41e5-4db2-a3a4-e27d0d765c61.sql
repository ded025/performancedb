-- Allow public (anon) read access to all data tables; admin writes are gated client-side via passcode
-- Drop authenticated-only SELECT policies and recreate as public read; allow public writes (managed by client passcode gate)

-- partners
DROP POLICY IF EXISTS "Authenticated can read partners" ON public.partners;
DROP POLICY IF EXISTS "Admins manage partners ins" ON public.partners;
DROP POLICY IF EXISTS "Admins manage partners upd" ON public.partners;
DROP POLICY IF EXISTS "Admins manage partners del" ON public.partners;
CREATE POLICY "Public read partners" ON public.partners FOR SELECT USING (true);
CREATE POLICY "Public insert partners" ON public.partners FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update partners" ON public.partners FOR UPDATE USING (true);
CREATE POLICY "Public delete partners" ON public.partners FOR DELETE USING (true);

-- monthly_accounts
DROP POLICY IF EXISTS "Authenticated can read monthly_accounts" ON public.monthly_accounts;
DROP POLICY IF EXISTS "Admins manage ma ins" ON public.monthly_accounts;
DROP POLICY IF EXISTS "Admins manage ma upd" ON public.monthly_accounts;
DROP POLICY IF EXISTS "Admins manage ma del" ON public.monthly_accounts;
CREATE POLICY "Public read monthly_accounts" ON public.monthly_accounts FOR SELECT USING (true);
CREATE POLICY "Public insert monthly_accounts" ON public.monthly_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update monthly_accounts" ON public.monthly_accounts FOR UPDATE USING (true);
CREATE POLICY "Public delete monthly_accounts" ON public.monthly_accounts FOR DELETE USING (true);

-- monthly_revenue
DROP POLICY IF EXISTS "Authenticated can read monthly_revenue" ON public.monthly_revenue;
DROP POLICY IF EXISTS "Admins manage mr ins" ON public.monthly_revenue;
DROP POLICY IF EXISTS "Admins manage mr upd" ON public.monthly_revenue;
DROP POLICY IF EXISTS "Admins manage mr del" ON public.monthly_revenue;
CREATE POLICY "Public read monthly_revenue" ON public.monthly_revenue FOR SELECT USING (true);
CREATE POLICY "Public insert monthly_revenue" ON public.monthly_revenue FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update monthly_revenue" ON public.monthly_revenue FOR UPDATE USING (true);
CREATE POLICY "Public delete monthly_revenue" ON public.monthly_revenue FOR DELETE USING (true);

-- historical_fy
DROP POLICY IF EXISTS "Authenticated can read historical_fy" ON public.historical_fy;
DROP POLICY IF EXISTS "Admins manage hf ins" ON public.historical_fy;
DROP POLICY IF EXISTS "Admins manage hf upd" ON public.historical_fy;
DROP POLICY IF EXISTS "Admins manage hf del" ON public.historical_fy;
CREATE POLICY "Public read historical_fy" ON public.historical_fy FOR SELECT USING (true);
CREATE POLICY "Public insert historical_fy" ON public.historical_fy FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update historical_fy" ON public.historical_fy FOR UPDATE USING (true);
CREATE POLICY "Public delete historical_fy" ON public.historical_fy FOR DELETE USING (true);

-- app_settings
DROP POLICY IF EXISTS "Authenticated can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins manage settings ins" ON public.app_settings;
DROP POLICY IF EXISTS "Admins manage settings upd" ON public.app_settings;
CREATE POLICY "Public read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Public insert app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update app_settings" ON public.app_settings FOR UPDATE USING (true);
