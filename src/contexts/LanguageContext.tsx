import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'da';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations = {
  en: {
    // Header
    'app.title': 'Personalized Hydration Guide',
    'app.subtitle': 'Get science-backed hydration recommendations tailored to your training',
    
    // Steps
    'step.body': 'Body & Physiology',
    'step.activity': 'Activity & Terrain',
    'step.environment': 'Environment',
    'step.sweat': 'Sweat Profile',
    'step.nutrition': 'Nutrition',
    'step.goals': 'Goals',
    'step.optional': 'Optional Data',
    
    // Common
    'common.next': 'Next',
    'common.back': 'Back',
    'common.complete': 'Complete',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.optional': 'Optional',
    'common.required': 'Required',
    
    // Body fields
    'body.age': 'Age',
    'body.sex': 'Sex',
    'body.weight': 'Weight (kg)',
    'body.height': 'Height (cm)',
    'body.male': 'Male',
    'body.female': 'Female',
    
    // Activity fields
    'activity.discipline': 'Sport/Discipline',
    'activity.sessionDuration': 'Typical Session Duration (hours)',
    'activity.indoor': 'Indoor',
    'activity.outdoor': 'Outdoor',
    'activity.both': 'Both',
    
    // Environment
    'env.temperature': 'Training Temperature',
    'env.humidity': 'Humidity (%)',
    'env.sunExposure': 'Sun Exposure',
    'env.shade': 'Shade',
    'env.partial': 'Partial Sun',
    'env.fullSun': 'Full Sun',
    'env.wind': 'Wind Conditions',
    'env.calm': 'Calm',
    'env.moderate': 'Moderate',
    'env.windy': 'Windy',
    
    // Sweat Profile
    'sweat.rate': 'Sweat Rate',
    'sweat.saltiness': 'Sweat Saltiness',
    'sweat.low': 'Low',
    'sweat.medium': 'Medium',
    'sweat.high': 'High',
    'sweat.cramping': 'Do you experience cramping?',
    
    // Nutrition
    'nutrition.saltIntake': 'Daily Salt Intake',
    'nutrition.waterIntake': 'Daily Water Intake (liters)',
    'nutrition.caffeine': 'Daily Caffeine Intake (mg)',
    'nutrition.diet': 'Diet Type',
    
    // Goals
    'goals.primary': 'Primary Goal',
    'goals.performance': 'Performance',
    'goals.endurance': 'Endurance',
    'goals.recovery': 'Recovery',
    'goals.weightLoss': 'Weight Loss',
    'goals.health': 'General Health',
    'goals.concerns': 'Specific Concerns',
    
    // Consent
    'consent.gdpr': 'I consent to my data being stored in accordance with GDPR for analysis purposes',
    'consent.required': 'Consent is required to continue',
    
    // File Upload
    'upload.title': 'Upload Smartwatch Data',
    'upload.description': 'Upload training files from your smartwatch for more accurate analysis',
    'upload.drop': 'Drop files here or click to upload',
    'upload.formats': 'Supported formats: FIT, TCX, GPX',
    
    // Validation
    'validation.ageRequired': 'Age is required',
    'validation.weightRequired': 'Weight is required',
    'validation.disciplineRequired': 'Please select at least one discipline',
    'validation.sessionRequired': 'Session duration is required',
    
    // Buttons
    'button.startNew': 'Start New Plan',
    'button.download': 'Download Plan',
    'button.share': 'Share Results',
    
    // Plan
    'plan.title': 'Your Personalized Hydration Plan',
    'plan.fluidLoss': 'Estimated Fluid Loss',
    'plan.preActivity': 'PRE-ACTIVITY',
    'plan.duringActivity': 'DURING ACTIVITY',
    'plan.postActivity': 'POST-ACTIVITY',
    'plan.water': 'Water',
    'plan.electrolytes': 'Electrolytes',
    
    // Footer
    'footer.disclaimer': 'This hydration guide is for informational purposes only and should not replace professional medical advice.',
    'footer.contact': 'Contact',
  },
  da: {
    // Header
    'app.title': 'Personlig Væskebalance Guide',
    'app.subtitle': 'Få videnskabsbaserede væskebalance anbefalinger skræddersyet til din træning',
    
    // Steps
    'step.body': 'Krop & Fysiologi',
    'step.activity': 'Aktivitet & Terræn',
    'step.environment': 'Miljø',
    'step.sweat': 'Svedprofil',
    'step.nutrition': 'Ernæring',
    'step.goals': 'Mål',
    'step.optional': 'Valgfrie Data',
    
    // Common
    'common.next': 'Næste',
    'common.back': 'Tilbage',
    'common.complete': 'Fuldfør',
    'common.yes': 'Ja',
    'common.no': 'Nej',
    'common.optional': 'Valgfri',
    'common.required': 'Påkrævet',
    
    // Body fields
    'body.age': 'Alder',
    'body.sex': 'Køn',
    'body.weight': 'Vægt (kg)',
    'body.height': 'Højde (cm)',
    'body.male': 'Mand',
    'body.female': 'Kvinde',
    
    // Activity fields
    'activity.discipline': 'Sport/Disciplin',
    'activity.sessionDuration': 'Typisk Sessionslængde (timer)',
    'activity.indoor': 'Indendørs',
    'activity.outdoor': 'Udendørs',
    'activity.both': 'Begge',
    
    // Environment
    'env.temperature': 'Træningstemperatur',
    'env.humidity': 'Fugtighed (%)',
    'env.sunExposure': 'Soleksponering',
    'env.shade': 'Skygge',
    'env.partial': 'Delvis Sol',
    'env.fullSun': 'Fuld Sol',
    'env.wind': 'Vindforhold',
    'env.calm': 'Stille',
    'env.moderate': 'Moderat',
    'env.windy': 'Blæsende',
    
    // Sweat Profile
    'sweat.rate': 'Svedhastighed',
    'sweat.saltiness': 'Svedsalthed',
    'sweat.low': 'Lav',
    'sweat.medium': 'Mellem',
    'sweat.high': 'Høj',
    'sweat.cramping': 'Oplever du kramper?',
    
    // Nutrition
    'nutrition.saltIntake': 'Dagligt Saltindtag',
    'nutrition.waterIntake': 'Dagligt Vandindtag (liter)',
    'nutrition.caffeine': 'Dagligt Koffeinindtag (mg)',
    'nutrition.diet': 'Kosttype',
    
    // Goals
    'goals.primary': 'Primært Mål',
    'goals.performance': 'Præstation',
    'goals.endurance': 'Udholdenhed',
    'goals.recovery': 'Restituering',
    'goals.weightLoss': 'Vægttab',
    'goals.health': 'Generel Sundhed',
    'goals.concerns': 'Specifikke Bekymringer',
    
    // Consent
    'consent.gdpr': 'Jeg samtykker til at mine data opbevares i overensstemmelse med GDPR til analyseformål',
    'consent.required': 'Samtykke er påkrævet for at fortsætte',
    
    // File Upload
    'upload.title': 'Upload Smartwatch Data',
    'upload.description': 'Upload træningsfiler fra dit smartwatch for mere præcis analyse',
    'upload.drop': 'Slip filer her eller klik for at uploade',
    'upload.formats': 'Understøttede formater: FIT, TCX, GPX',
    
    // Validation
    'validation.ageRequired': 'Alder er påkrævet',
    'validation.weightRequired': 'Vægt er påkrævet',
    'validation.disciplineRequired': 'Vælg venligst mindst en disciplin',
    'validation.sessionRequired': 'Sessionslængde er påkrævet',
    
    // Buttons
    'button.startNew': 'Start Ny Plan',
    'button.download': 'Download Plan',
    'button.share': 'Del Resultater',
    
    // Plan
    'plan.title': 'Din Personlige Væskebalance Plan',
    'plan.fluidLoss': 'Estimeret Væsketab',
    'plan.preActivity': 'FØR AKTIVITET',
    'plan.duringActivity': 'UNDER AKTIVITET',
    'plan.postActivity': 'EFTER AKTIVITET',
    'plan.water': 'Vand',
    'plan.electrolytes': 'Elektrolytter',
    
    // Footer
    'footer.disclaimer': 'Denne væskebalance guide er kun til informationsformål og bør ikke erstatte professionel medicinsk rådgivning.',
    'footer.contact': 'Kontakt',
  },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('supplme-language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('supplme-language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
