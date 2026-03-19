ALTER TABLE garmin_activities ADD COLUMN data_type TEXT NOT NULL DEFAULT 'activity';
CREATE INDEX idx_garmin_activities_data_type ON garmin_activities(garmin_user_id, data_type);
