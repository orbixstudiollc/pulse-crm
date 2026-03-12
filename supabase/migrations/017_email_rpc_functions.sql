-- ============================================================================
-- Email System RPC Functions
-- ============================================================================

-- Increment daily sent count for an email account
CREATE OR REPLACE FUNCTION increment_daily_sent_count(account_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_accounts
  SET daily_sent_count = daily_sent_count + 1
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment open count for a message
CREATE OR REPLACE FUNCTION increment_message_open_count(msg_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_messages
  SET open_count = open_count + 1
  WHERE id = msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment click count for a message
CREATE OR REPLACE FUNCTION increment_message_click_count(msg_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_messages
  SET click_count = click_count + 1
  WHERE id = msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment click count for a tracked link
CREATE OR REPLACE FUNCTION increment_link_click_count(link_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE email_link_tracking
  SET click_count = click_count + 1
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset daily sent counts (called by cron at midnight)
CREATE OR REPLACE FUNCTION reset_daily_sent_counts()
RETURNS void AS $$
BEGIN
  UPDATE email_accounts SET daily_sent_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
