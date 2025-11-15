import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { InfoTooltip } from '@/components/InfoTooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
  const [inputMode, setInputMode] = useState<'pace' | 'duration'>('duration');
  const [paceValue, setPaceValue] = useState(currentPace || '');
  const [durationValue, setDurationValue] = useState(currentDuration?.toString() || '');

  useEffect(() => {
    setPaceValue(currentPace || '');
  }, [currentPace]);

  useEffect(() => {
    setDurationValue(currentDuration?.toString() || '');
  }, [currentDuration]);

  // Calculate duration from pace
  const calculateDurationFromPace = (pace: string, distance?: string): number | null => {
    if (!pace || !distance || !raceDistanceMap[distance]) return null;

    const distanceKm = raceDistanceMap[distance];

    // Parse running/hiking pace (e.g., "5:30" means 5 minutes 30 seconds per km)
    if (discipline === 'Running' || discipline === 'Hiking') {
      const paceMatch = pace.match(/(\d+):(\d+)/);
      if (paceMatch) {
        const minutes = parseInt(paceMatch[1]);
        const seconds = parseInt(paceMatch[2]);
        const minutesPerKm = minutes + seconds / 60;
        return (distanceKm * minutesPerKm) / 60; // Convert to hours
      }
    }

    // Parse swimming pace (e.g., "1:45/100m")
    if (discipline === 'Swimming') {
      const paceMatch = pace.match(/(\d+):(\d+)/);
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
    if (!duration || !distance || !raceDistanceMap[distance]) return null;

    const distanceKm = raceDistanceMap[distance];
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

  const handlePaceChange = (value: string) => {
    setPaceValue(value);
    onPaceChange(value);

    // Auto-calculate duration if we have race distance
    if (raceDistance) {
      const calculatedDuration = calculateDurationFromPace(value, raceDistance);
      if (calculatedDuration !== null) {
        setDurationValue(calculatedDuration.toFixed(1));
        onDurationChange(calculatedDuration);
      }
    }
  };

  const handleDurationChange = (value: string) => {
    setDurationValue(value);
    const durationNum = parseFloat(value);
    if (!isNaN(durationNum)) {
      onDurationChange(durationNum);

      // Auto-calculate pace if we have race distance
      if (raceDistance) {
        const calculatedPace = calculatePaceFromDuration(durationNum, raceDistance);
        if (calculatedPace !== null) {
          setPaceValue(calculatedPace);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label>Enter either pace or duration</Label>
        <InfoTooltip content={raceDistance ? "Enter either your pace or duration. The other will be calculated automatically based on your race distance." : "Enter either your typical pace or session duration."} />
      </div>

      <RadioGroup value={inputMode} onValueChange={(value) => setInputMode(value as 'pace' | 'duration')} className="flex gap-4">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="duration" id="duration-mode" />
          <Label htmlFor="duration-mode" className="cursor-pointer font-normal">
            Duration
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="pace" id="pace-mode" />
          <Label htmlFor="pace-mode" className="cursor-pointer font-normal">
            Pace
          </Label>
        </div>
      </RadioGroup>

      {inputMode === 'duration' ? (
        <div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sessionDuration">
              Session Duration (hours) *
            </Label>
            <InfoTooltip content="How long is your typical training session or race? Include warm-up and cool-down time." />
          </div>
          <Input
            id="sessionDuration"
            type="number"
            step="0.5"
            value={durationValue}
            onChange={(e) => handleDurationChange(e.target.value)}
            placeholder="e.g., 1.5"
          />
          {raceDistance && paceValue && (
            <p className="text-sm text-muted-foreground mt-2">
              Calculated pace: {paceValue}
            </p>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <Label htmlFor="avgPace">
              {getPaceLabel()}
            </Label>
            <InfoTooltip content={raceDistance ? "Enter your target pace. Duration will be calculated automatically." : "Enter your typical training pace."} />
          </div>
          <Input
            id="avgPace"
            value={paceValue}
            onChange={(e) => handlePaceChange(e.target.value)}
            placeholder={getPacePlaceholder()}
          />
          {raceDistance && durationValue && (
            <p className="text-sm text-muted-foreground mt-2">
              Calculated duration: {durationValue} hours
            </p>
          )}
        </div>
      )}
    </div>
  );
}
