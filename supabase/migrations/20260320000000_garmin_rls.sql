-- Enable RLS on Garmin tables to prevent unauthorized access
ALTER TABLE garmin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;

-- Only allow service-role (edge functions) to access these tables.
-- No direct client access should be permitted.
CREATE POLICY "Service role only" ON garmin_connections
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON garmin_activities
  FOR ALL USING (auth.role() = 'service_role');
