-- Migration: Add RBAC and Trial Period System
-- Created: 2026-01-09
-- Description: Adds role-based access control fields and trial period management to daily_user table

-- Add new columns to daily_user table
ALTER TABLE public.daily_user
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Add check constraint for subscription_status (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_user_subscription_status_check'
  ) THEN
    ALTER TABLE public.daily_user
    ADD CONSTRAINT daily_user_subscription_status_check 
    CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired'));
  END IF;
END $$;

-- Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_daily_user_is_admin ON public.daily_user(is_admin) WHERE is_admin = true;

-- Create index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_daily_user_subscription_status ON public.daily_user(subscription_status);

-- Create index for trial expiration checks
CREATE INDEX IF NOT EXISTS idx_daily_user_trial_ends_at ON public.daily_user(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- Add comment to document the schema
COMMENT ON COLUMN public.daily_user.is_admin IS 'Flag indicating if user has administrator privileges';
COMMENT ON COLUMN public.daily_user.subscription_status IS 'Current subscription status: trial, active, cancelled, or expired';
COMMENT ON COLUMN public.daily_user.trial_ends_at IS 'Timestamp when trial period ends (7 days from registration)';
COMMENT ON COLUMN public.daily_user.subscription_ends_at IS 'Timestamp when paid subscription ends';

-- Update existing users: set trial_ends_at to 7 days from their created_at if not already set
UPDATE public.daily_user
SET 
  trial_ends_at = created_at + INTERVAL '7 days',
  subscription_status = CASE 
    WHEN created_at + INTERVAL '7 days' > NOW() THEN 'trial'
    ELSE 'expired'
  END
WHERE trial_ends_at IS NULL;

-- Create a function to automatically set trial period on user creation
CREATE OR REPLACE FUNCTION public.set_trial_period()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set trial if not already set
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '7 days';
  END IF;
  
  -- Set default subscription status if not set
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'trial';
  END IF;
  
  -- Ensure new users are not admins by default
  IF NEW.is_admin IS NULL THEN
    NEW.is_admin := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set trial period on insert
DROP TRIGGER IF EXISTS trigger_set_trial_period ON public.daily_user;
CREATE TRIGGER trigger_set_trial_period
  BEFORE INSERT ON public.daily_user
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trial_period();

-- Create a function to check if subscription is active
CREATE OR REPLACE FUNCTION public.is_subscription_active(user_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT 
    is_admin,
    subscription_status,
    trial_ends_at,
    subscription_ends_at
  INTO user_record
  FROM public.daily_user
  WHERE id = user_id;
  
  -- Admins always have active access
  IF user_record.is_admin THEN
    RETURN true;
  END IF;
  
  -- Check subscription status
  IF user_record.subscription_status = 'active' THEN
    -- Check if subscription hasn't expired
    IF user_record.subscription_ends_at IS NULL OR user_record.subscription_ends_at > NOW() THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Check trial status
  IF user_record.subscription_status = 'trial' THEN
    IF user_record.trial_ends_at IS NOT NULL AND user_record.trial_ends_at > NOW() THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_subscription_active(BIGINT) TO authenticated;

-- Add RLS (Row Level Security) policies if not already enabled
ALTER TABLE public.daily_user ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own data" ON public.daily_user;
DROP POLICY IF EXISTS "Users can update their own data" ON public.daily_user;
DROP POLICY IF EXISTS "Admins can view all users" ON public.daily_user;
DROP POLICY IF EXISTS "Admins can update all users" ON public.daily_user;
DROP POLICY IF EXISTS "Admins can delete users" ON public.daily_user;

-- Policy: Users can view their own data
CREATE POLICY "Users can view their own data" ON public.daily_user
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Policy: Admins can view all users
CREATE POLICY "Admins can view all users" ON public.daily_user
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_user
      WHERE auth_user_id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Users can update their own data (excluding is_admin field)
CREATE POLICY "Users can update their own data" ON public.daily_user
  FOR UPDATE
  USING (auth.uid() = auth_user_id)
  WITH CHECK (
    auth.uid() = auth_user_id 
    AND is_admin = (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid())
  );

-- Policy: Admins can update all users
CREATE POLICY "Admins can update all users" ON public.daily_user
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_user
      WHERE auth_user_id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can delete users
CREATE POLICY "Admins can delete users" ON public.daily_user
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_user
      WHERE auth_user_id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Authenticated users can insert (for registration)
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.daily_user;
CREATE POLICY "Authenticated users can insert" ON public.daily_user
  FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id AND is_admin = false);
