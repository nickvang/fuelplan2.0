CREATE TABLE garmin_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garmin_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE garmin_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garmin_user_id TEXT NOT NULL,
  activity_data JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_garmin_connections_user_id ON garmin_connections(garmin_user_id);
CREATE INDEX idx_garmin_activities_user_id ON garmin_activities(garmin_user_id);
