-- ============ ENUM ============
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============ DATA TABLES ============
CREATE TABLE public.partners (
  ap_code TEXT PRIMARY KEY,
  ap_name TEXT NOT NULL,
  rm_name TEXT NOT NULL DEFAULT '',
  lead_status TEXT NOT NULL DEFAULT '',
  status TEXT,
  created_time TIMESTAMPTZ,
  created_fy TEXT,
  commission_pct NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_partners_rm ON public.partners(rm_name);
CREATE INDEX idx_partners_fy ON public.partners(created_fy);

CREATE TABLE public.monthly_accounts (
  id TEXT PRIMARY KEY,
  ap_code TEXT NOT NULL,
  month TEXT NOT NULL,
  accounts_opened INTEGER NOT NULL DEFAULT 0,
  first_trades INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ma_month ON public.monthly_accounts(month);
CREATE INDEX idx_ma_ap ON public.monthly_accounts(ap_code);

CREATE TABLE public.monthly_revenue (
  id TEXT PRIMARY KEY,
  ap_code TEXT NOT NULL,
  month TEXT NOT NULL,
  total_brokerage NUMERIC NOT NULL DEFAULT 0,
  introducer_brokerage NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_revenue ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mr_month ON public.monthly_revenue(month);
CREATE INDEX idx_mr_ap ON public.monthly_revenue(ap_code);

CREATE TABLE public.historical_fy (
  id TEXT PRIMARY KEY,
  fy TEXT NOT NULL,
  ap_code TEXT NOT NULL,
  accounts_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
  revenue_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
  commission_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_by_month JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.historical_fy ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_hf_fy ON public.historical_fy(fy);

CREATE TABLE public.app_settings (
  id TEXT PRIMARY KEY,
  default_commission_pct NUMERIC NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES: any authenticated user can read ============
CREATE POLICY "Authenticated can read partners" ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read monthly_accounts" ON public.monthly_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read monthly_revenue" ON public.monthly_revenue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read historical_fy" ON public.historical_fy FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

-- ============ POLICIES: only admins can write ============
CREATE POLICY "Admins manage partners ins" ON public.partners FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage partners upd" ON public.partners FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage partners del" ON public.partners FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage ma ins" ON public.monthly_accounts FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage ma upd" ON public.monthly_accounts FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage ma del" ON public.monthly_accounts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage mr ins" ON public.monthly_revenue FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage mr upd" ON public.monthly_revenue FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage mr del" ON public.monthly_revenue FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage hf ins" ON public.historical_fy FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage hf upd" ON public.historical_fy FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage hf del" ON public.historical_fy FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage settings ins" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage settings upd" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partners_upd BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ma_upd BEFORE UPDATE ON public.monthly_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mr_upd BEFORE UPDATE ON public.monthly_revenue FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_hf_upd BEFORE UPDATE ON public.historical_fy FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_settings_upd BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AUTO-CREATE PROFILE + FIRST USER = ADMIN ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default settings row
INSERT INTO public.app_settings (id, default_commission_pct) VALUES ('global', 20)
ON CONFLICT (id) DO NOTHING;