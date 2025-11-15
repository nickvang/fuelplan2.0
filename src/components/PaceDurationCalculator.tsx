import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { InfoTooltip } from '@/components/InfoTooltip';

interface PaceDurationCalculatorProps {
  discipline: string;
  raceDistance?: string;
  currentPace?: string;
  currentDuration?: number;
  onPaceChange: (pace: string) => void;
  onDurationChange: (duration: number) => void;
}

// Distance mapping in kilometers
const raceDistanceMap: { [key: string]: number } = {
  '5 km': 5,
  '10 km': 10,
  '15 km': 15,
  'Half Marathon': 21.0975,
  'Marathon': 42.195,
  '50 km': 50,
  '100 km': 100,
  'Sprint Triathlon': 5, // run portion
  'Olympic Triathlon': 10,
  'Half Ironman': 21.0975,
  'Ironman': 42.195,
};

export function PaceDurationCalculator({
  discipline,
  raceDistance,
  currentPace,
  currentDuration,
  onPaceChange,
  onDurationChange,
}: PaceDurationCalculatorProps) {
  const [inputValue, setInputValue] = useState('');
  const [calculatedValue, setCalculatedValue] = useState('');
  const [detectedType, setDetectedType] = useState<'pace' | 'duration' | null>(null);

  useEffect(() => {
    // Initialize with current values
    if (currentDuration) {
      setInputValue(currentDuration.toString());
      setDetectedType('duration');
    } else if (currentPace) {
      setInputValue(currentPace);
      setDetectedType('pace');
    }
  }, [currentPace, currentDuration]);

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

    // Parse running/hiking pace (e.g., "5:30" means 5 minutes 30 seconds per km)
    if (discipline === 'Running' || discipline === 'Hiking') {
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

  // Calculate pace from duration
  const calculatePaceFromDuration = (duration: number, distance?: string): string | null => {
    if (!duration || !distance) return null;

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

    const totalMinutes = duration * 60;

    if (discipline === 'Running' || discipline === 'Hiking') {
      const minutesPerKm = totalMinutes / distanceKm;
      const mins = Math.floor(minutesPerKm);
      const secs = Math.round((minutesPerKm - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    if (discipline === 'Swimming') {
      const distanceMeters = distanceKm * 1000;
      const minutesPer100m = totalMinutes / (distanceMeters / 100);
      const mins = Math.floor(minutesPer100m);
      const secs = Math.round((minutesPer100m - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, '0')}/100m`;
    }

    if (discipline === 'Cycling') {
      const kmPerHour = distanceKm / duration;
      return `${kmPerHour.toFixed(1)} km/h`;
    }

    return null;
  };

  const detectInputType = (value: string): 'pace' | 'duration' | null => {
    if (!value) return null;
    
    // Check if it's a complete pace format (e.g., "5:30" or "1:45/100m")
    // Require at least 2 digits for seconds to ensure complete input
    const pacePattern = /^\d+:\d{2}/;
    if (pacePattern.test(value)) {
      return 'pace';
    }
    
    // Check if it's a cycling speed (contains "km/h" or "W")
    if (discipline === 'Cycling' && (value.includes('km/h') || value.includes('W'))) {
      return 'pace';
    }
    
    // Check if it's a number (duration in hours)
    if (!isNaN(parseFloat(value)) && value.match(/^\d+(\.\d+)?$/)) {
      return 'duration';
    }
    
    return null;
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    const type = detectInputType(value);
    setDetectedType(type);

    if (type === 'pace') {
      onPaceChange(value);
      
      // Auto-calculate duration if we have race distance
      if (raceDistance) {
        const calculatedDuration = calculateDurationFromPace(value, raceDistance);
        if (calculatedDuration !== null) {
          setCalculatedValue(`${calculatedDuration.toFixed(1)} hours`);
          onDurationChange(calculatedDuration);
        }
      }
    } else if (type === 'duration') {
      const durationNum = parseFloat(value);
      onDurationChange(durationNum);
      
      // Auto-calculate pace if we have race distance
      if (raceDistance) {
        const calculatedPace = calculatePaceFromDuration(durationNum, raceDistance);
        if (calculatedPace !== null) {
          setCalculatedValue(calculatedPace);
          onPaceChange(calculatedPace);
        }
      }
    }
  };

  const getPacePlaceholder = () => {
    switch (discipline) {
      case 'Swimming':
        return 'e.g., 1:45/100m';
      case 'Cycling':
        return 'e.g., 30 km/h or 250W';
      case 'Hiking':
        return 'e.g., 3-4 km/hr or 15-20 min/km';
      default:
        return 'e.g., 5:30/km';
    }
  };

  const getPaceLabel = () => {
    switch (discipline) {
      case 'Swimming':
        return 'Average Swim Pace';
      case 'Cycling':
        return 'Average Power/Speed';
      case 'Hiking':
        return 'Average Hiking Pace';
      default:
        return 'Average Run Pace';
    }
  };

  const getInputPlaceholder = () => {
    switch (discipline) {
      case 'Swimming':
        return 'e.g., 1:45/100m or 1.5 (hours)';
      case 'Cycling':
        return 'e.g., 30 km/h or 1.5 (hours)';
      case 'Hiking':
        return 'e.g., 15:00/km or 2 (hours)';
      default:
        return 'e.g., 5:00/km or 1.5 (hours)';
    }
  };

  const getTooltipContent = () => {
    const paceExample = getPacePlaceholder().replace('e.g., ', '');
    return `Enter either your pace (${paceExample}) or session duration in hours (e.g., 1.5). ${raceDistance ? 'The other value will be calculated automatically based on your race distance.' : ''}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="pace-duration-input">
          Pace or Session Duration *
        </Label>
        <InfoTooltip content={getTooltipContent()} />
      </div>
      <Input
        id="pace-duration-input"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={getInputPlaceholder()}
      />
      {raceDistance && calculatedValue && detectedType && (
        <p className="text-sm text-muted-foreground">
          {detectedType === 'pace' ? 'Calculated duration: ' : 'Calculated pace: '}
          {calculatedValue}
        </p>
      )}
    </div>
  );
}
