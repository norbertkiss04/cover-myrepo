BEGIN;

INSERT INTO public.invites (code, created_by, created_at, expires_at)
VALUES (
    'DEV-SETUP',
    NULL,
    NOW(),
    '2099-12-31T23:59:59Z'
)
ON CONFLICT DO NOTHING;

COMMIT;
