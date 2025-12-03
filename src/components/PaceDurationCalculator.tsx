import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { InfoTooltip } from '@/components/InfoTooltip';

interface PaceDurationCalculatorProps {
  discipline: string;
  raceDistance?: string;
  goalTime?: string;
  currentPace?: string;
  onPaceChange: (pace: string) => void;
  onDurationChange: (duration: number) => void;
}

// Distance mapping in kilometers
const raceDistanceMap: { [key: string]: number } = {
  // Running distances
  '5 km': 5,
  '5km': 5,
  '5K': 5,
  '10 km': 10,
  '10km': 10,
  '10K': 10,
  '15 km': 15,
  '15km': 15,
  '15K': 15,
  'Half Marathon': 21.0975,
  'half marathon': 21.0975,
  'Marathon': 42.195,
  'marathon': 42.195,
  '50 km': 50,
  '50km': 50,
  '50K': 50,
  '100 km': 100,
  '100km': 100,
  '100K': 100,
  
  // Triathlon distances
  'Sprint': 5,
  'Sprint Triathlon': 5,
  'Olympic': 10,
  'Olympic Triathlon': 10,
  'Half Ironman': 21.0975,
  'Half Ironman (70.3)': 21.0975,
  '70.3': 21.0975,
  'Ironman': 42.195,
  
  // Cycling distances
  'Century': 160,
  'century': 160,
  'Half Century': 80,
  'Metric Century': 100,
};

export function PaceDurationCalculator({
  discipline,
  raceDistance,
  goalTime,
  currentPace,
  onPaceChange,
  onDurationChange,
}: PaceDurationCalculatorProps) {
  const [inputValue, setInputValue] = useState('');
  const [calculatedValue, setCalculatedValue] = useState('');
  const [finishTime, setFinishTime] = useState('');
  const [requiredPace, setRequiredPace] = useState('');

  useEffect(() => {
    // Initialize with current pace
    if (currentPace) {
      setInputValue(currentPace);
    }
  }, [currentPace]);

  // Calculate required pace from goal time OR use default pace if no goal time
  useEffect(() => {
    // Goal time always takes priority - auto-calculate pace from goal time
    if (goalTime && raceDistance) {
      const pace = calculatePaceFromGoalTime(goalTime, raceDistance);
      if (pace) {
        setRequiredPace(pace);
        // Always update the pace field to match goal time
        setInputValue(pace);
        onPaceChange(pace);
        
        // Duration equals goal time (parse the goal time directly)
        const timeMatch = goalTime.match(/(\d+):(\d+)(?::(\d+))?/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
          const duration = hours + minutes / 60 + seconds / 3600;
          
          setCalculatedValue(`${duration.toFixed(1)} hours`);
          onDurationChange(duration);
          setFinishTime(goalTime); // Display the goal time as-is
        }
      }
    } else {
      // No goal time - clear required pace but don't set default duration
      setRequiredPace('');
    }
  }, [goalTime, raceDistance, discipline, inputValue, onPaceChange, onDurationChange]);

  // Get default pace for discipline (used when no pace is entered)
  const getDefaultPaceForDiscipline = (disc: string): string => {
    switch (disc) {
      case 'Swimming':
        return '1:50/100m'; // Moderate swimming pace
      case 'Cycling':
        return '28 km/h'; // Moderate cycling speed
      case 'Running':
      default:
        return '6:00/km'; // Moderate running pace
    }
  };

  // Calculate pace from goal time
  const calculatePaceFromGoalTime = (time: string, distance: string): string | null => {
    if (!time || !distance) return null;

    // Parse goal time (e.g., "1:30:00" or "1:30")
    const timeMatch = time.match(/(\d+):(\d+)(?::(\d+))?/);
    if (!timeMatch) return null;

    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
    const totalMinutes = hours * 60 + minutes + seconds / 60;

    // Get distance
    let distanceKm = raceDistanceMap[distance];
    if (!distanceKm) {
      const numericDistance = parseFloat(distance);
      if (!isNaN(numericDistance)) {
        distanceKm = numericDistance;
      } else {
        return null;
      }
    }

    // Calculate required pace
    if (discipline === 'Running') {
      const minutesPerKm = totalMinutes / distanceKm;
      const paceMinutes = Math.floor(minutesPerKm);
      const paceSeconds = Math.round((minutesPerKm - paceMinutes) * 60);
      return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
    } else if (discipline === 'Cycling') {
      const kmPerHour = (distanceKm / totalMinutes) * 60;
      return `${kmPerHour.toFixed(1)} km/h`;
    } else if (discipline === 'Swimming') {
      const minutesPer100m = (totalMinutes / (distanceKm * 10));
      const paceMinutes = Math.floor(minutesPer100m);
      const paceSeconds = Math.round((minutesPer100m - paceMinutes) * 60);
      return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
    }

    return null;
  };

  // Calculate duration from pace
  const calculateDurationFromPace = (pace: string, distance?: string): number | null => {
    if (!pace || !distance) return null;

    // Try to get distance from map, or parse as number
    let distanceKm = raceDistanceMap[distance];
    if (!distanceKm) {
      // If not in map, try parsing as a number
      const numericDistance = parseFloat(distance);
      if (!isNaN(numericDistance)) {
        distanceKm = numericDistance;
      } else {
        return null;
      }
    }

    // Parse running pace (e.g., "5:30" means 5 minutes 30 seconds per km)
    if (discipline === 'Running') {
      // Parse pace format (min:sec per km)
      const paceMatch = pace.match(/(\d+):(\d{2})/);
      if (paceMatch) {
        const minutes = parseInt(paceMatch[1]);
        const seconds = parseInt(paceMatch[2]);
        const minutesPerKm = minutes + seconds / 60;
        const totalMinutes = distanceKm * minutesPerKm;
        return totalMinutes / 60; // Convert to hours
      }
    }

    // Parse swimming pace (e.g., "1:45/100m")
    if (discipline === 'Swimming') {
      const paceMatch = pace.match(/(\d+):(\d{2})/);
      if (paceMatch) {
        const minutes = parseInt(paceMatch[1]);
        const seconds = parseInt(paceMatch[2]);
        const minutesPer100m = minutes + seconds / 60;
        const distanceMeters = distanceKm * 1000;
        return (distanceMeters / 100 * minutesPer100m) / 60; // Convert to hours
      }
    }

    // Parse cycling speed (e.g., "30 km/h")
    if (discipline === 'Cycling') {
      const speedMatch = pace.match(/(\d+(?:\.\d+)?)\s*km\/h/);
      if (speedMatch) {
        const kmPerHour = parseFloat(speedMatch[1]);
        return distanceKm / kmPerHour;
      }
    }

    return null;
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onPaceChange(value);
    
    // Auto-calculate duration if we have race distance
    if (raceDistance) {
      const calculatedDuration = calculateDurationFromPace(value, raceDistance);
      if (calculatedDuration !== null) {
        setCalculatedValue(`${calculatedDuration.toFixed(1)} hours`);
        onDurationChange(calculatedDuration);
        
        // Calculate finish time in HH:MM format
        const hours = Math.floor(calculatedDuration);
        const minutes = Math.round((calculatedDuration - hours) * 60);
        setFinishTime(`${hours}:${minutes.toString().padStart(2, '0')}`);
      } else {
        setFinishTime('');
      }
    }
  };

  const getPacePlaceholder = () => {
    switch (discipline) {
      case 'Swimming':
        return 'e.g., 1:45/100m';
      case 'Cycling':
        return 'e.g., 30 km/h or 250W';
      default:
        return 'e.g., 5:30/km';
    }
  };

  const getPaceLabel = () => {
    switch (discipline) {
      case 'Swimming':
        return 'Pace';
      case 'Cycling':
        return 'Pace';
      default:
        return 'Pace';
    }
  };

  const getPaceTooltip = () => {
    switch (discipline) {
      case 'Swimming':
        return 'Enter your swim pace in minutes:seconds per 100 meters. For example, 1:45/100m means 1 minute 45 seconds per 100 meters.';
      case 'Cycling':
        return 'Enter your cycling speed in km/h (e.g., 30 km/h) or power in watts (e.g., 250W). Use the format that best represents your effort.';
      default:
        return 'Enter your running pace in minutes:seconds per kilometer. For example, 5:00/km means 5 minutes per kilometer. This is required to calculate accurate fluid needs.';
    }
  };

  return (
    <div className="space-y-4">
      {/* Pace Input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="pace" className="text-foreground">
            {getPaceLabel()} *
          </Label>
          <InfoTooltip content={getPaceTooltip()} />
        </div>
        <Input
          id="pace"
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={getPacePlaceholder()}
          className="font-mono bg-background text-foreground border-border placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
          disabled={!!goalTime}
          readOnly={!!goalTime}
        />
        {goalTime && inputValue && (
          <p className="text-xs text-muted-foreground italic">
            ✓ Pace auto-calculated from goal finish time
          </p>
        )}
        {requiredPace && (
          <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/30 animate-fade-in">
            <p className="text-xs font-medium text-primary uppercase tracking-wide">Required Pace to Hit Goal</p>
            <p className="text-lg font-bold text-foreground">{requiredPace}</p>
          </div>
        )}
        {calculatedValue && (
          <div className="mt-3 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estimated Duration</p>
                <p className="text-lg font-bold text-foreground">{calculatedValue}</p>
              </div>
              {finishTime && (
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expected Finish Time</p>
                  <p className="text-2xl font-black text-primary">{finishTime}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
