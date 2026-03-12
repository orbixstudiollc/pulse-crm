-- ============================================================================
-- Phase 16: Email System — Accounts, Threads, Messages, Tracking
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE email_provider AS ENUM ('gmail', 'microsoft', 'custom_imap');
CREATE TYPE email_account_status AS ENUM ('active', 'disconnected', 'error', 'warming_up');
CREATE TYPE email_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE email_message_status AS ENUM (
  'draft', 'queued', 'sending', 'sent', 'delivered',
  'opened', 'clicked', 'replied', 'bounced', 'failed'
);
CREATE TYPE tracking_event_type AS ENUM (
  'sent', 'delivered', 'opened', 'clicked', 'bounced',
  'complaint', 'unsubscribed'
);

-- ── Email Accounts ──────────────────────────────────────────────────────────

CREATE TABLE email_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        email_provider NOT NULL,
  email_address   TEXT NOT NULL,
  display_name    TEXT,
  status          email_account_status NOT NULL DEFAULT 'active',
  -- OAuth tokens
  oauth_tokens    JSONB,
  -- IMAP/SMTP credentials (encrypted passwords)
  imap_config     JSONB,
  smtp_config     JSONB,
  -- Rate limiting & health
  daily_send_limit  INT NOT NULL DEFAULT 50,
  daily_sent_count  INT NOT NULL DEFAULT 0,
  last_sent_at      TIMESTAMPTZ,
  last_synced_at    TIMESTAMPTZ,
  last_error        TEXT,
  -- Settings
  signature_html  TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email_address)
);

CREATE TRIGGER trg_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_email_accounts_org ON email_accounts(organization_id);
CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);

-- ── Email Threads ───────────────────────────────────────────────────────────

CREATE TABLE email_threads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  -- CRM entity linkage
  lead_id          UUID REFERENCES leads(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  -- Thread metadata
  subject          TEXT NOT NULL DEFAULT '',
  snippet          TEXT,
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_count    INT NOT NULL DEFAULT 0,
  -- State
  is_read          BOOLEAN NOT NULL DEFAULT false,
  is_starred       BOOLEAN NOT NULL DEFAULT false,
  is_archived      BOOLEAN NOT NULL DEFAULT false,
  -- Sequence linkage
  enrollment_id    UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_email_threads_org ON email_threads(organization_id);
CREATE INDEX idx_email_threads_account ON email_threads(email_account_id);
CREATE INDEX idx_email_threads_lead ON email_threads(lead_id);
CREATE INDEX idx_email_threads_last_msg ON email_threads(last_message_at DESC);

-- ── Email Messages ──────────────────────────────────────────────────────────

CREATE TABLE email_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id        UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  -- Addressing
  from_address     TEXT NOT NULL,
  to_addresses     TEXT[] NOT NULL DEFAULT '{}',
  cc_addresses     TEXT[] DEFAULT '{}',
  bcc_addresses    TEXT[] DEFAULT '{}',
  reply_to         TEXT,
  -- Content
  subject          TEXT NOT NULL DEFAULT '',
  body_html        TEXT NOT NULL DEFAULT '',
  body_text        TEXT,
  -- Direction & Status
  direction        email_direction NOT NULL,
  status           email_message_status NOT NULL DEFAULT 'draft',
  -- External IDs (for syncing)
  provider_message_id TEXT,
  message_id_header   TEXT,
  in_reply_to         TEXT,
  references_header   TEXT,
  -- Tracking
  tracking_pixel_id   UUID,
  open_count       INT NOT NULL DEFAULT 0,
  click_count      INT NOT NULL DEFAULT 0,
  first_opened_at  TIMESTAMPTZ,
  last_opened_at   TIMESTAMPTZ,
  -- Sequence linkage
  enrollment_id    UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  step_id          UUID REFERENCES sequence_steps(id) ON DELETE SET NULL,
  -- Error info
  error_message    TEXT,
  bounce_type      TEXT,
  -- Scheduling
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  received_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX idx_email_messages_account ON email_messages(email_account_id);
CREATE INDEX idx_email_messages_tracking ON email_messages(tracking_pixel_id);
CREATE INDEX idx_email_messages_status ON email_messages(status);
CREATE INDEX idx_email_messages_scheduled ON email_messages(scheduled_at) WHERE status = 'queued';
CREATE INDEX idx_email_messages_sent ON email_messages(sent_at DESC);

-- ── Tracking Events ─────────────────────────────────────────────────────────

CREATE TABLE email_tracking_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  event_type  tracking_event_type NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_events_message ON email_tracking_events(message_id);
CREATE INDEX idx_tracking_events_type ON email_tracking_events(event_type);
CREATE INDEX idx_tracking_events_created ON email_tracking_events(created_at DESC);

-- ── Link Tracking ───────────────────────────────────────────────────────────

CREATE TABLE email_link_tracking (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  tracking_url TEXT NOT NULL UNIQUE,
  click_count  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_link_tracking_message ON email_link_tracking(message_id);

-- ── RLS Policies ────────────────────────────────────────────────────────────

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_email_accounts" ON email_accounts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_email_threads" ON email_threads FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_email_messages" ON email_messages FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_email_tracking_events" ON email_tracking_events FOR ALL
  USING (message_id IN (
    SELECT id FROM email_messages WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));

ALTER TABLE email_link_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_email_link_tracking" ON email_link_tracking FOR ALL
  USING (message_id IN (
    SELECT id FROM email_messages WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  ));
