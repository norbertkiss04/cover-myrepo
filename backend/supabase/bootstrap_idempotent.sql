BEGIN;

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS picture TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 200;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.users ALTER COLUMN preferences SET DEFAULT '{}'::jsonb;
ALTER TABLE public.users ALTER COLUMN credits SET DEFAULT 200;
ALTER TABLE public.users ALTER COLUMN is_admin SET DEFAULT FALSE;
ALTER TABLE public.users ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.users ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.users SET preferences = '{}'::jsonb WHERE preferences IS NULL;
UPDATE public.users SET credits = 200 WHERE credits IS NULL;
UPDATE public.users SET is_admin = FALSE WHERE is_admin IS NULL;
UPDATE public.users SET created_at = NOW() WHERE created_at IS NULL;
UPDATE public.users SET updated_at = NOW() WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.style_references (
    id BIGSERIAL PRIMARY KEY
);

ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS feeling TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS layout TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS illustration_rules TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS typography TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS original_image_path TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS clean_image_path TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS text_layer_path TEXT;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS text_layer_cleaned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS text_layer_selected_texts JSONB;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS detected_text JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS selected_text_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.style_references ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.style_references ALTER COLUMN text_layer_cleaned SET DEFAULT FALSE;
ALTER TABLE public.style_references ALTER COLUMN detected_text SET DEFAULT '[]'::jsonb;
ALTER TABLE public.style_references ALTER COLUMN selected_text_ids SET DEFAULT '[]'::jsonb;
ALTER TABLE public.style_references ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.style_references SET text_layer_cleaned = FALSE WHERE text_layer_cleaned IS NULL;
UPDATE public.style_references SET detected_text = '[]'::jsonb WHERE detected_text IS NULL;
UPDATE public.style_references SET selected_text_ids = '[]'::jsonb WHERE selected_text_ids IS NULL;
UPDATE public.style_references SET created_at = NOW() WHERE created_at IS NULL;

CREATE TABLE IF NOT EXISTS public.cover_templates (
    id BIGSERIAL PRIMARY KEY
);

ALTER TABLE public.cover_templates ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE public.cover_templates ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.cover_templates ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '2:3';
ALTER TABLE public.cover_templates ADD COLUMN IF NOT EXISTS title_box JSONB;
ALTER TABLE public.cover_templates ADD COLUMN IF NOT EXISTS author_box JSONB;
ALTER TABLE public.cover_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.cover_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.cover_templates ALTER COLUMN aspect_ratio SET DEFAULT '2:3';
ALTER TABLE public.cover_templates ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.cover_templates ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.cover_templates SET title_box = '{}'::jsonb WHERE title_box IS NULL;
UPDATE public.cover_templates SET author_box = '{}'::jsonb WHERE author_box IS NULL;
UPDATE public.cover_templates SET created_at = NOW() WHERE created_at IS NULL;
UPDATE public.cover_templates SET updated_at = NOW() WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.generations (
    id BIGSERIAL PRIMARY KEY
);

ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS book_title TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS cover_ideas TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS genres JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS mood TEXT DEFAULT '';
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS color_preference TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS character_description TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS keywords JSONB;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS style_analysis JSONB;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS style_reference_id BIGINT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS cover_template_id BIGINT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS use_style_image BOOLEAN DEFAULT FALSE;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS base_image_only BOOLEAN DEFAULT FALSE;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS reference_mode TEXT DEFAULT 'both';
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS two_step_generation BOOLEAN DEFAULT TRUE;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '2:3';
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS base_prompt TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS text_prompt TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS base_image_url TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS final_image_url TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS current_step INTEGER;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS total_steps INTEGER;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS step_message TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS credits_used INTEGER;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.generations ALTER COLUMN description SET DEFAULT '';
ALTER TABLE public.generations ALTER COLUMN genres SET DEFAULT '[]'::jsonb;
ALTER TABLE public.generations ALTER COLUMN mood SET DEFAULT '';
ALTER TABLE public.generations ALTER COLUMN use_style_image SET DEFAULT FALSE;
ALTER TABLE public.generations ALTER COLUMN base_image_only SET DEFAULT FALSE;
ALTER TABLE public.generations ALTER COLUMN reference_mode SET DEFAULT 'both';
ALTER TABLE public.generations ALTER COLUMN two_step_generation SET DEFAULT TRUE;
ALTER TABLE public.generations ALTER COLUMN aspect_ratio SET DEFAULT '2:3';
ALTER TABLE public.generations ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.generations ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.generations SET description = '' WHERE description IS NULL;
UPDATE public.generations SET genres = '[]'::jsonb WHERE genres IS NULL;
UPDATE public.generations SET mood = '' WHERE mood IS NULL;
UPDATE public.generations SET use_style_image = FALSE WHERE use_style_image IS NULL;
UPDATE public.generations SET base_image_only = FALSE WHERE base_image_only IS NULL;
UPDATE public.generations SET reference_mode = 'both' WHERE reference_mode IS NULL;
UPDATE public.generations SET two_step_generation = TRUE WHERE two_step_generation IS NULL;
UPDATE public.generations SET aspect_ratio = '2:3' WHERE aspect_ratio IS NULL;
UPDATE public.generations SET status = 'pending' WHERE status IS NULL;
UPDATE public.generations SET created_at = NOW() WHERE created_at IS NULL;

CREATE TABLE IF NOT EXISTS public.invites (
    id BIGSERIAL PRIMARY KEY
);

ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS created_by BIGINT;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS used_by_google_id TEXT;

ALTER TABLE public.invites ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.invites SET created_at = NOW() WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_generations_user_id_created_at
    ON public.generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_user_id_status_created_at
    ON public.generations(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_style_reference_id
    ON public.generations(style_reference_id);

CREATE INDEX IF NOT EXISTS idx_generations_cover_template_id
    ON public.generations(cover_template_id);

CREATE INDEX IF NOT EXISTS idx_style_references_user_id_created_at
    ON public.style_references(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cover_templates_user_id_created_at
    ON public.cover_templates(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invites_created_by_created_at
    ON public.invites(created_by, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_users_google_id_unique'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.users
            WHERE google_id IS NOT NULL
            GROUP BY google_id
            HAVING COUNT(*) > 1
        ) THEN
            CREATE UNIQUE INDEX idx_users_google_id_unique
                ON public.users(google_id)
                WHERE google_id IS NOT NULL;
        END IF;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_users_email_unique'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.users
            WHERE email IS NOT NULL
            GROUP BY email
            HAVING COUNT(*) > 1
        ) THEN
            CREATE UNIQUE INDEX idx_users_email_unique
                ON public.users(email)
                WHERE email IS NOT NULL;
        END IF;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_users_api_token_unique'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.users
            WHERE api_token IS NOT NULL
            GROUP BY api_token
            HAVING COUNT(*) > 1
        ) THEN
            CREATE UNIQUE INDEX idx_users_api_token_unique
                ON public.users(api_token)
                WHERE api_token IS NOT NULL;
        END IF;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_invites_code_unique'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.invites
            WHERE code IS NOT NULL
            GROUP BY code
            HAVING COUNT(*) > 1
        ) THEN
            CREATE UNIQUE INDEX idx_invites_code_unique
                ON public.invites(code)
                WHERE code IS NOT NULL;
        END IF;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'style_references_user_id_fkey') THEN
        ALTER TABLE public.style_references
            ADD CONSTRAINT style_references_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cover_templates_user_id_fkey') THEN
        ALTER TABLE public.cover_templates
            ADD CONSTRAINT cover_templates_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invites_created_by_fkey') THEN
        ALTER TABLE public.invites
            ADD CONSTRAINT invites_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'generations_user_id_fkey') THEN
        ALTER TABLE public.generations
            ADD CONSTRAINT generations_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'generations_style_reference_id_fkey') THEN
        ALTER TABLE public.generations
            ADD CONSTRAINT generations_style_reference_id_fkey
            FOREIGN KEY (style_reference_id) REFERENCES public.style_references(id) ON DELETE SET NULL NOT VALID;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'generations_cover_template_id_fkey') THEN
        ALTER TABLE public.generations
            ADD CONSTRAINT generations_cover_template_id_fkey
            FOREIGN KEY (cover_template_id) REFERENCES public.cover_templates(id) ON DELETE SET NULL NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'users'
          AND policyname = 'Users can only access own profile'
    ) THEN
        CREATE POLICY "Users can only access own profile"
            ON public.users
            FOR ALL
            USING (google_id = auth.uid()::text)
            WITH CHECK (google_id = auth.uid()::text);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'generations'
          AND policyname = 'Users can only access own generations'
    ) THEN
        CREATE POLICY "Users can only access own generations"
            ON public.generations
            FOR ALL
            USING (user_id = (SELECT id FROM public.users WHERE google_id = auth.uid()::text))
            WITH CHECK (user_id = (SELECT id FROM public.users WHERE google_id = auth.uid()::text));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'style_references'
          AND policyname = 'Users can only access own style references'
    ) THEN
        CREATE POLICY "Users can only access own style references"
            ON public.style_references
            FOR ALL
            USING (user_id = (SELECT id FROM public.users WHERE google_id = auth.uid()::text))
            WITH CHECK (user_id = (SELECT id FROM public.users WHERE google_id = auth.uid()::text));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'invites'
          AND policyname = 'Users can manage own invites'
    ) THEN
        CREATE POLICY "Users can manage own invites"
            ON public.invites
            FOR ALL
            USING (created_by = (SELECT id FROM public.users WHERE google_id = auth.uid()::text))
            WITH CHECK (created_by = (SELECT id FROM public.users WHERE google_id = auth.uid()::text));
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'cover_templates'
          AND policyname = 'Users can only access own cover templates'
    ) THEN
        CREATE POLICY "Users can only access own cover templates"
            ON public.cover_templates
            FOR ALL
            USING (user_id = (SELECT id FROM public.users WHERE google_id = auth.uid()::text))
            WITH CHECK (user_id = (SELECT id FROM public.users WHERE google_id = auth.uid()::text));
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id BIGINT, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_credits INT;
    new_credits INT;
BEGIN
    SELECT credits INTO current_credits
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF current_credits IS NULL OR current_credits < p_amount THEN
        RETURN NULL;
    END IF;

    UPDATE public.users
    SET credits = credits - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
      AND credits >= p_amount
    RETURNING credits INTO new_credits;

    RETURN new_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id BIGINT, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_credits INT;
BEGIN
    UPDATE public.users
    SET credits = credits + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING credits INTO new_credits;

    RETURN new_credits;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_invite(p_code TEXT, p_google_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite_id BIGINT;
BEGIN
    UPDATE public.invites
    SET used_at = NOW(),
        used_by_google_id = p_google_id
    WHERE code = p_code
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING id INTO invite_id;

    RETURN invite_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_credits(BIGINT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(BIGINT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_invite(TEXT, TEXT) TO authenticated, service_role;

COMMIT;
