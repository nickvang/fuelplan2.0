import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationWarningProps {
  message: string;
}

export const ValidationWarning = ({ message }: ValidationWarningProps) => {
  return (
    <Alert variant="destructive" className="mt-2">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="text-sm">{message}</AlertDescription>
    </Alert>
  );
};

export const getValidationWarnings = (profile: any): string[] => {
  const warnings: string[] = [];

  // Weight validations
  if (profile.weight && (profile.weight < 40 || profile.weight > 150)) {
    warnings.push('Unusual weight detected. Please verify this value for accurate calculations.');
  }

  // Age validations
  if (profile.age && (profile.age < 15 || profile.age > 80)) {
    warnings.push('Unusual age detected. Consider consulting with a sports physician for personalized guidance.');
  }

  // Session duration validations
  if (profile.sessionDuration && profile.sessionDuration > 12) {
    warnings.push('Extended session duration detected. Ultra-endurance events require specialized hydration strategies - consider professional guidance.');
  }

  // Sweat rate validations
  if (profile.sweatRate === 'high' && profile.sweatSaltiness === 'high') {
    warnings.push('High sweat rate with high saltiness suggests significant sodium loss. Professional sweat testing highly recommended.');
  }

  // Temperature validations
  if (profile.trainingTempRange?.max && profile.trainingTempRange.max > 35) {
    warnings.push('Extreme heat conditions detected. Exercise caution and consider adjusting activity timing.');
  }

  // Humidity validations
  if (profile.humidity && profile.humidity > 80) {
    warnings.push('Very high humidity significantly impairs cooling. Reduce intensity and increase fluid intake.');
  }

  // Cramping validations
  if (profile.crampTiming && profile.crampTiming !== 'none') {
    warnings.push('Regular cramping may indicate electrolyte imbalance or other issues. Consider medical evaluation.');
  }

  // Elevation gain validations
  if (profile.elevationGain && profile.elevationGain > 2000) {
    warnings.push('Significant elevation gain increases energy and fluid demands. Plan accordingly.');
  }

  return warnings;
};
