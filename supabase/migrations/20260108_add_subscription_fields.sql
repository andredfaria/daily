-- Add subscription tracking fields to daily_user table
ALTER TABLE public.daily_user 
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS subscription_ends_at timestamp with time zone;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_daily_user_subscription_status ON public.daily_user(subscription_status);

-- Comments for documentation
COMMENT ON COLUMN public.daily_user.subscription_status IS 'Status of the user subscription: trial, active, cancelled, expired';
COMMENT ON COLUMN public.daily_user.trial_ends_at IS 'Timestamp when the free trial ends';
COMMENT ON COLUMN public.daily_user.subscription_ends_at IS 'Timestamp when the paid subscription ends';
