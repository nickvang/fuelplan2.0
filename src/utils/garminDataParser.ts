import { HydrationProfile } from '@/types/hydration';

interface ParsedGarminData {
  activities?: Array<{ month: string; activityType: string; value: number }>;
  totalDistance?: Array<{ month: string; activityType: string; value: number }>;
  totalActivityTime?: Array<{ month: string; activityType: string; value: number }>;
  maxHeartRate?: Array<{ date: string; value: number }>;
  averageHeartRate?: Array<{ date: string; value: number }>;
  averagePace?: Array<{ date: string; value: number; pace: string }>;
  averageSpeed?: Array<{ date: string; value: number }>;
  fitnessAge?: Array<{ date: string; value: number }>;
  activityCalories?: Array<{ month: string; activityType: string; value: number }>;
}

function parseCSV(content: string): any[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Remove BOM if present and get headers
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
  const data: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }
  
  return data;
}

export async function parseGarminFiles(files: File[]): Promise<ParsedGarminData> {
  const parsedData: ParsedGarminData = {};
  
  for (const file of files) {
    const content = await file.text();
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.includes('activities_')) {
        const rows = parseCSV(content);
        parsedData.activities = rows.map(row => ({
          month: row[''] || row['Month'],
          activityType: row['Activity Type'],
          value: parseFloat(row['Value']) || 0
        }));
      }
      
      if (fileName.includes('total_distance')) {
        const rows = parseCSV(content);
        parsedData.totalDistance = rows.map(row => ({
          month: row[''] || row['Month'],
          activityType: row['Activity Type'],
          value: parseFloat(row['Value']) || 0
        }));
      }
      
      if (fileName.includes('total_activity_time')) {
        const rows = parseCSV(content);
        parsedData.totalActivityTime = rows.map(row => ({
          month: row[''] || row['Month'],
          activityType: row['Activity Type'],
          value: parseFloat(row['Value']) || 0
        }));
      }
      
      if (fileName.includes('max_heart_rate')) {
        const rows = parseCSV(content);
        parsedData.maxHeartRate = rows.map(row => ({
          date: row[''] || row['Date'],
          value: parseFloat(row['Value']) || 0
        }));
      }
      
      if (fileName.includes('average_heart_rate')) {
        const rows = parseCSV(content);
        parsedData.averageHeartRate = rows.map(row => ({
          date: row[''] || row['Date'],
          value: parseFloat(row['Value']) || 0
        }));
      }
      
      if (fileName.includes('average_pace')) {
        const rows = parseCSV(content);
        parsedData.averagePace = rows.map(row => ({
          date: row[''] || row['Date'],
          value: parseFloat(row['Value']) || 0,
          pace: row['Pace'] || ''
        }));
      }
      
      if (fileName.includes('average_speed')) {
        const rows = parseCSV(content);
        parsedData.averageSpeed = rows.map(row => ({
          date: row[''] || row['Date'],
          value: parseFloat(row['Value']) || 0
        }));
      }
      
      if (fileName.includes('fitness_age')) {
        const rows = parseCSV(content);
        parsedData.fitnessAge = rows.map(row => ({
          date: row[''] || row['Date'],
          value: parseFloat(row['Fitness Age']) || 0
        }));
      }
      
      if (fileName.includes('activity_calories')) {
        const rows = parseCSV(content);
        parsedData.activityCalories = rows.map(row => ({
          month: row[''] || row['Month'],
          activityType: row['Activity Type'],
          value: parseFloat(row['Value']) || 0
        }));
      }
    } catch (error) {
      console.error(`Error parsing ${file.name}:`, error);
    }
  }
  
  return parsedData;
}

export function mapGarminDataToProfile(parsedData: ParsedGarminData): Partial<HydrationProfile> {
  const profile: Partial<HydrationProfile> = {};
  
  // Determine primary discipline from activities
  if (parsedData.activities && parsedData.activities.length > 0) {
    const activityCounts: Record<string, number> = {};
    parsedData.activities.forEach(activity => {
      if (activity.activityType && activity.activityType !== 'Other') {
        activityCounts[activity.activityType] = (activityCounts[activity.activityType] || 0) + activity.value;
      }
    });
    
    const sortedActivities = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]);
    if (sortedActivities.length > 0) {
      const primaryActivity = sortedActivities[0][0];
      
      // Map Garmin activity types to disciplines
      const disciplineMap: Record<string, string> = {
        'Running': 'Run',
        'Gym & Fitness Equipment': 'Strength Training',
        'Water Sports': 'Swim',
        'Cycling': 'Bike',
        'Trail Running': 'Trail Run'
      };
      
      const mappedDiscipline = disciplineMap[primaryActivity] || primaryActivity;
      profile.disciplines = [mappedDiscipline];
      
      // Calculate training frequency (average activities per month)
      const recentMonths = parsedData.activities
        .filter(a => a.activityType === primaryActivity)
        .slice(-3);
      
      if (recentMonths.length > 0) {
        const avgActivitiesPerMonth = recentMonths.reduce((sum, a) => sum + a.value, 0) / recentMonths.length;
        profile.trainingFrequency = Math.round(avgActivitiesPerMonth);
      }
    }
  }
  
  // Calculate average session duration from activity time
  if (parsedData.totalActivityTime && parsedData.activities) {
    const primaryActivityType = profile.disciplines?.[0];
    
    // Find corresponding Garmin activity type
    const reverseMap: Record<string, string> = {
      'Run': 'Running',
      'Strength Training': 'Gym & Fitness Equipment',
      'Swim': 'Water Sports',
      'Bike': 'Cycling',
      'Trail Run': 'Trail Running'
    };
    
    const garminActivityType = reverseMap[primaryActivityType || ''] || 'Running';
    
    const recentTimes = parsedData.totalActivityTime
      .filter(t => t.activityType === garminActivityType)
      .slice(-3);
    
    const recentCounts = parsedData.activities
      .filter(a => a.activityType === garminActivityType)
      .slice(-3);
    
    if (recentTimes.length > 0 && recentCounts.length > 0) {
      const totalTime = recentTimes.reduce((sum, t) => sum + t.value, 0);
      const totalActivities = recentCounts.reduce((sum, a) => sum + a.value, 0);
      
      if (totalActivities > 0) {
        // Convert minutes to hours and round to 1 decimal
        profile.sessionDuration = Math.round((totalTime / totalActivities / 60) * 10) / 10;
      }
    }
  }
  
  // Extract average heart rate (use as estimate for resting HR - typically 10-20 bpm lower)
  if (parsedData.averageHeartRate && parsedData.averageHeartRate.length > 0) {
    const recentHR = parsedData.averageHeartRate.slice(-3);
    const avgHR = recentHR.reduce((sum, hr) => sum + hr.value, 0) / recentHR.length;
    // Estimate resting HR as approximately 30-35 bpm lower than average exercise HR
    profile.restingHeartRate = Math.round(avgHR - 33);
  }
  
  // Max heart rate data available but not in profile type
  // Could be used for additional calculations if needed in the future
  
  // Extract average pace
  if (parsedData.averagePace && parsedData.averagePace.length > 0) {
    const recentPace = parsedData.averagePace[parsedData.averagePace.length - 1];
    profile.avgPace = recentPace.pace;
  }
  
  // Use fitness age to estimate actual age (fitness age is typically close to actual age for regular athletes)
  if (parsedData.fitnessAge && parsedData.fitnessAge.length > 0) {
    const recentFitnessAge = parsedData.fitnessAge[parsedData.fitnessAge.length - 1];
    // Use fitness age as a baseline, but it's just an estimate
    profile.age = recentFitnessAge.value;
  }
  
  return profile;
}
