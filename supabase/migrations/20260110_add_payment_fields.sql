-- Migration: Add Payment Fields for Hotmart Integration
-- Created: 2026-01-10
-- Description: Adds payment-related fields to daily_user table for subscription management

-- Add new columns to daily_user table
ALTER TABLE public.daily_user
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'hotmart',
ADD COLUMN IF NOT EXISTS payment_customer_id TEXT,
ADD COLUMN IF NOT EXISTS payment_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Add check constraint for subscription_plan
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_user_subscription_plan_check'
  ) THEN
    ALTER TABLE public.daily_user
    ADD CONSTRAINT daily_user_subscription_plan_check 
    CHECK (subscription_plan IN ('basic', 'premium', 'enterprise') OR subscription_plan IS NULL);
  END IF;
END $$;

-- Add check constraint for payment_provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_user_payment_provider_check'
  ) THEN
    ALTER TABLE public.daily_user
    ADD CONSTRAINT daily_user_payment_provider_check 
    CHECK (payment_provider IN ('hotmart', 'stripe', 'asaas', 'mercadopago') OR payment_provider IS NULL);
  END IF;
END $$;

-- Add check constraint for payment_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_user_payment_status_check'
  ) THEN
    ALTER TABLE public.daily_user
    ADD CONSTRAINT daily_user_payment_status_check 
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled') OR payment_status IS NULL);
  END IF;
END $$;

-- Create index for faster payment lookups
CREATE INDEX IF NOT EXISTS idx_daily_user_payment_subscription_id ON public.daily_user(payment_subscription_id) WHERE payment_subscription_id IS NOT NULL;

-- Create index for payment status queries
CREATE INDEX IF NOT EXISTS idx_daily_user_payment_status ON public.daily_user(payment_status) WHERE payment_status IS NOT NULL;

-- Create index for next billing date queries
CREATE INDEX IF NOT EXISTS idx_daily_user_next_billing_date ON public.daily_user(next_billing_date) WHERE next_billing_date IS NOT NULL;

-- Add comments to document the schema
COMMENT ON COLUMN public.daily_user.subscription_plan IS 'Subscription plan type: basic, premium, enterprise';
COMMENT ON COLUMN public.daily_user.payment_provider IS 'Payment gateway provider: hotmart, stripe, asaas, mercadopago';
COMMENT ON COLUMN public.daily_user.payment_customer_id IS 'Customer ID in the payment gateway';
COMMENT ON COLUMN public.daily_user.payment_subscription_id IS 'Subscription ID in the payment gateway (Hotmart subscriber_code)';
COMMENT ON COLUMN public.daily_user.payment_status IS 'Current payment status: pending, paid, failed, refunded, cancelled';
COMMENT ON COLUMN public.daily_user.next_billing_date IS 'Next billing date for recurring subscription';
