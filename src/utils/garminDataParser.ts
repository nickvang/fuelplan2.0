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

interface ParsedWhoopData {
  workouts?: Array<{
    date: string;
    duration: number;
    strain: number;
    maxHR: number;
    avgHR: number;
    calories: number;
  }>;
  physiologicalCycles?: Array<{
    date: string;
    recoveryScore: number;
    restingHR: number;
    hrv: number;
    skinTemp: number;
    bloodOxygen: number;
    sleepDuration: number;
    sleepPerformance: number;
    respiratoryRate: number;
  }>;
  sleeps?: Array<{
    date: string;
    duration: number;
    remDuration: number;
    deepDuration: number;
    lightDuration: number;
    sleepPerformance: number;
    sleepEfficiency: number;
  }>;
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

async function parseWhoopFiles(files: File[]): Promise<ParsedWhoopData> {
  const parsedData: ParsedWhoopData = {};
  
  for (const file of files) {
    const content = await file.text();
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.includes('workout')) {
        const rows = parseCSV(content);
        parsedData.workouts = rows.slice(1).map(row => ({
          date: row['Workout start time'] || row['Cycle start time'] || '',
          duration: parseFloat(row['Duration (min)']) || 0,
          strain: parseFloat(row['Activity Strain']) || 0,
          maxHR: parseFloat(row['Max HR (bpm)']) || 0,
          avgHR: parseFloat(row['Average HR (bpm)']) || 0,
          calories: parseFloat(row['Energy burned (cal)']) || 0,
        })).filter(w => w.duration > 0);
      }
      
      if (fileName.includes('physiological_cycle')) {
        const rows = parseCSV(content);
        parsedData.physiologicalCycles = rows.slice(1).map(row => ({
          date: row['Cycle start time'] || '',
          recoveryScore: parseFloat(row['Recovery score %']) || 0,
          restingHR: parseFloat(row['Resting heart rate (bpm)']) || 0,
          hrv: parseFloat(row['Heart rate variability (ms)']) || 0,
          skinTemp: parseFloat(row['Skin temp (celsius)']) || 0,
          bloodOxygen: parseFloat(row['Blood oxygen %']) || 0,
          sleepDuration: parseFloat(row['Asleep duration (min)']) || 0,
          sleepPerformance: parseFloat(row['Sleep performance %']) || 0,
          respiratoryRate: parseFloat(row['Respiratory rate (rpm)']) || 0,
        })).filter(c => c.date);
      }
      
      if (fileName.includes('sleep')) {
        const rows = parseCSV(content);
        parsedData.sleeps = rows.slice(1).map(row => ({
          date: row['Sleep onset'] || row['Cycle start time'] || '',
          duration: parseFloat(row['Asleep duration (min)']) || 0,
          remDuration: parseFloat(row['REM duration (min)']) || 0,
          deepDuration: parseFloat(row['Deep (SWS) duration (min)']) || 0,
          lightDuration: parseFloat(row['Light sleep duration (min)']) || 0,
          sleepPerformance: parseFloat(row['Sleep performance %']) || 0,
          sleepEfficiency: parseFloat(row['Sleep efficiency %']) || 0,
        })).filter(s => s.duration > 0);
      }
    } catch (error) {
      console.error(`Error parsing Whoop file ${file.name}:`, error);
    }
  }
  
  return parsedData;
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

function mapWhoopDataToProfile(parsedData: ParsedWhoopData): Partial<HydrationProfile> {
  const profile: Partial<HydrationProfile> = {};
  
  // Extract resting HR and HRV from physiological cycles
  if (parsedData.physiologicalCycles && parsedData.physiologicalCycles.length > 0) {
    const recent = parsedData.physiologicalCycles.slice(-30); // Last 30 days
    
    const avgRestingHR = recent.reduce((sum, c) => sum + c.restingHR, 0) / recent.length;
    const avgHRV = recent.reduce((sum, c) => sum + c.hrv, 0) / recent.length;
    
    profile.restingHeartRate = Math.round(avgRestingHR);
    profile.hrv = `${Math.round(avgHRV)}ms`;
    
    // Extract sleep data
    const avgSleepHours = recent.reduce((sum, c) => sum + c.sleepDuration, 0) / recent.length / 60;
    profile.sleepHours = Math.round(avgSleepHours * 10) / 10;
    
    const avgSleepPerformance = recent.reduce((sum, c) => sum + c.sleepPerformance, 0) / recent.length;
    profile.sleepQuality = Math.round(avgSleepPerformance / 10); // Convert % to 1-10 scale
  }
  
  // Extract workout data
  if (parsedData.workouts && parsedData.workouts.length > 0) {
    const recentWorkouts = parsedData.workouts.slice(-30); // Last 30 workouts
    
    // Calculate average session duration
    const avgDuration = recentWorkouts.reduce((sum, w) => sum + w.duration, 0) / recentWorkouts.length / 60;
    profile.sessionDuration = Math.round(avgDuration * 10) / 10;
    
    // Calculate training frequency (workouts per week)
    const daysSpan = 30; // Assuming last 30 days
    profile.trainingFrequency = Math.round((recentWorkouts.length / daysSpan) * 7);
    
    // Infer primary discipline based on workout patterns
    const avgStrain = recentWorkouts.reduce((sum, w) => sum + w.strain, 0) / recentWorkouts.length;
    const avgDurationMin = recentWorkouts.reduce((sum, w) => sum + w.duration, 0) / recentWorkouts.length;
    
    // High strain + moderate duration = Running
    // High strain + long duration = Endurance sports
    // Moderate strain + short duration = Gym/Strength
    if (avgStrain > 12 && avgDurationMin > 45) {
      profile.disciplines = ['Run'];
    } else if (avgStrain > 10 && avgDurationMin < 60) {
      profile.disciplines = ['Strength Training'];
    } else {
      profile.disciplines = ['Run']; // Default
    }
  }
  
  return profile;
}

export async function parseSmartWatchFiles(files: File[]): Promise<Partial<HydrationProfile>> {
  // Detect file type based on filenames
  const fileNames = files.map(f => f.name.toLowerCase());
  
  const isWhoop = fileNames.some(name => 
    name.includes('physiological_cycle') || 
    name.includes('workout') && name.includes('cycle')
  );
  
  const isGarmin = fileNames.some(name => 
    name.includes('total_distance') || 
    name.includes('total_activity_time') ||
    name.includes('fitness_age')
  );
  
  if (isWhoop) {
    const whoopData = await parseWhoopFiles(files);
    return mapWhoopDataToProfile(whoopData);
  } else if (isGarmin) {
    const garminData = await parseGarminFiles(files);
    return mapGarminDataToProfile(garminData);
  }
  
  return {};
}
