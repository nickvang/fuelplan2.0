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
    'app.title': 'Personalized Hydration Guide by Supplme',
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
    'common.start': 'Start',
    'common.complete': 'Complete',
    
    // Version Selection
    'version.select': 'Choose Your Experience',
    'version.simple.title': 'Quick',
    'version.simple.description': 'Quick hydration plan using generic assumptions. Perfect for getting started fast with essential info only.',
    'version.simple.time': '2 minutes',
    'version.pro.title': 'Pro (Advanced)',
    'version.pro.description': 'Comprehensive analysis with environmental factors, sweat profile, and smartwatch integration.',
    'version.pro.time': '5-7 minutes',
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
    'body.other': 'Other',
    'body.bodyFat': 'Body Fat %',
    'body.restingHR': 'Resting HR',
    'body.hrv': 'HRV / Recovery Index',
    'body.avgSleep': 'Average Sleep (hours)',
    'body.sleepQuality': 'Sleep Quality (1-10)',
    'body.healthConditions': 'Known Health Conditions',
    'body.sweatSodiumTest': 'Sweat Sodium Test (mmol/L)',
    'body.tooltip.weight': 'Your body weight affects fluid requirements. Heavier athletes typically need more hydration.',
    
    // Activity fields
    'activity.primaryDiscipline': 'Primary Discipline',
    'activity.raceDistance': 'Typical Race Distance',
    'activity.sessionDuration': 'Session Duration (hours)',
    'activity.longestSession': 'Longest Session (hours)',
    'activity.indoor': 'Indoor',
    'activity.outdoor': 'Outdoor',
    'activity.both': 'Both',
    'activity.location': 'Training Location',
    'activity.elevationGain': 'Elevation Gain (meters)',
    'activity.trainingFrequency': 'Training Frequency (times per week)',
    
    // Environment
    'env.tempMin': 'Minimum Temperature (°C)',
    'env.tempMax': 'Maximum Temperature (°C)',
    'env.humidity': 'Humidity (%)',
    'env.altitude': 'Altitude',
    'env.seaLevel': 'Sea Level',
    'env.moderateAltitude': 'Moderate (1000-2000m)',
    'env.highAltitude': 'High (>2000m)',
    'env.sunExposure': 'Sun Exposure',
    'env.shade': 'Shade',
    'env.partial': 'Partial Sun',
    'env.fullSun': 'Full Sun',
    'env.wind': 'Wind Conditions',
    'env.calm': 'Calm',
    'env.moderateWind': 'Moderate',
    'env.windy': 'Windy',
    'env.clothing': 'Clothing Type',
    'env.minimal': 'Minimal',
    'env.light': 'Light',
    'env.moderateClothing': 'Moderate',
    'env.heavy': 'Heavy',
    
    // Sweat Profile
    'sweat.rate': 'Sweat Rate',
    'sweat.saltiness': 'Sweat Saltiness',
    'sweat.low': 'Low',
    'sweat.medium': 'Medium',
    'sweat.high': 'High',
    'sweat.cramping': 'Do you experience cramping?',
    'sweat.crampTiming': 'Cramp Timing',
    'sweat.none': 'None',
    'sweat.early': 'Early (first hour)',
    'sweat.mid': 'Mid-session',
    'sweat.late': 'Late (last hour)',
    'sweat.post': 'Post-activity',
    
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
    'goals.upcomingEvents': 'Upcoming Events',
    
    // Consent & GDPR
    'consent.gdpr': 'I have read and agree to the data privacy notice above. I consent to Supplme collecting and processing my anonymized data for product development purposes in accordance with GDPR regulations.',
    'consent.required': 'Consent is required to continue',
    'gdpr.title': 'Data Privacy & GDPR Compliance',
    'gdpr.ai.title': '🤖 AI-Powered Recommendations',
    'gdpr.ai.description': 'This tool uses artificial intelligence to generate personalized hydration recommendations based on peer-reviewed scientific research from PubMed.',
    'gdpr.compliance.title': '🇪🇺 GDPR Compliance - See more',
    'gdpr.compliance.intro': 'We comply with EU GDPR and Danish data protection laws:',
    'gdpr.dataCollection': 'Data Collection',
    'gdpr.dataCollection.text': 'Your data is collected anonymously with explicit consent (GDPR Art. 6(1)(a))',
    'gdpr.purpose': 'Purpose',
    'gdpr.purpose.text': 'Data used solely for product development and improving hydration recommendations',
    'gdpr.storage': 'Storage',
    'gdpr.storage.text': 'Data stored securely for max 2 years, then automatically deleted (GDPR Art. 5(1)(e))',
    'gdpr.rights': 'Your Rights',
    'gdpr.rights.text': 'You can request data deletion at any time by contacting us',
    'gdpr.noThirdParties': 'No Third Parties',
    'gdpr.noThirdParties.text': 'Data never sold or shared with third parties',
    'gdpr.anonymization': 'Anonymization',
    'gdpr.anonymization.text': 'All data anonymized - no personally identifiable information stored unless you choose to provide email',
    'gdpr.security.title': '🔒 Security',
    'gdpr.security.text': 'Data encrypted in transit and at rest. Compliant with industry standards.',
    'gdpr.contact': 'Contact: For data deletion requests or privacy questions, email info@supplme.com',
    
    // File Upload
    'upload.title': 'Upload Smartwatch Data',
    'upload.description': 'Upload training files from your smartwatch for more accurate analysis',
    'smartwatch.uploaded': '✓ {count} file(s) uploaded',
    'smartwatch.remove': 'Remove',
    'smartwatch.multipleFiles': 'Upload Multiple Files',
    'smartwatch.uploadFolder': 'Or Upload Entire Folder',
    
    // Analysis
    'analyzing.title': 'Analyzing Your Data...',
    'analyzing.processing': 'Processing {count} file(s) to extract your health metrics',
    'analysis.complete': '✓ Data analysis complete! We pre-filled:',
    'analysis.ageMetrics': '• Age and body metrics',
    'analysis.restingHR': '• Resting heart rate',
    'analysis.hrv': '• Heart rate variability',
    'analysis.activityData': '• Activity data (for reference - you still choose your guide)',
    'analysis.skipping': 'Skipping questions we could answer from your data.',
    
    // Step titles
    'step.1.title': '1. Body & Physiology',
    'step.2.title': '2. Activity & Terrain',
    'step.3.title': '3. Environment Data',
    'step.4.title': '4. Sweat Profile',
    'step.5.title': '5. Dietary Habits',
    'step.6.title': '6. Goals & Events',
    
    // Plan
    'plan.title': 'Your Personalized Hydration Plan',
    'plan.fluidLoss': 'Estimated Fluid Loss',
    'plan.preActivity': 'PRE-ACTIVITY',
    'plan.duringActivity': 'DURING ACTIVITY',
    'plan.postActivity': 'POST-ACTIVITY',
    'plan.water': 'Water',
    'plan.electrolytes': 'Electrolytes',
  },
  da: {
    // Header
    'app.title': 'Personlig Væskebalance Guide af Supplme',
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
    'common.start': 'Start',
    'common.complete': 'Fuldfør',
    
    // Version Selection
    'version.select': 'Vælg Din Oplevelse',
    'version.simple.title': 'Hurtig',
    'version.simple.description': 'Hurtig hydrationsplan ved brug af generelle antagelser. Perfekt til at komme hurtigt i gang med kun det nødvendige.',
    'version.simple.time': '2 minutter',
    'version.pro.title': 'Pro (Avanceret)',
    'version.pro.description': 'Omfattende analyse med miljøfaktorer, svedprofil og smartwatch-integration.',
    'version.pro.time': '5-7 minutter',
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
    'body.other': 'Andet',
    'body.bodyFat': 'Fedtprocent %',
    'body.restingHR': 'Hvilepuls',
    'body.hrv': 'HRV / Restituerings Index',
    'body.avgSleep': 'Gennemsnitlig Søvn (timer)',
    'body.sleepQuality': 'Søvnkvalitet (1-10)',
    'body.healthConditions': 'Kendte Helbredstilstande',
    'body.sweatSodiumTest': 'Sved Natrium Test (mmol/L)',
    'body.tooltip.weight': 'Din kropsvægt påvirker væskebehov. Tungere atleter har typisk behov for mere væske.',
    
    // Activity fields
    'activity.primaryDiscipline': 'Primær Disciplin',
    'activity.raceDistance': 'Typisk Løbsdistance',
    'activity.sessionDuration': 'Sessionslængde (timer)',
    'activity.longestSession': 'Længste Session (timer)',
    'activity.indoor': 'Indendørs',
    'activity.outdoor': 'Udendørs',
    'activity.both': 'Begge',
    'activity.location': 'Træningssted',
    'activity.elevationGain': 'Højdeforskel (meter)',
    'activity.trainingFrequency': 'Træningsfrekvens (gange per uge)',
    
    // Environment
    'env.tempMin': 'Minimumtemperatur (°C)',
    'env.tempMax': 'Maksimumtemperatur (°C)',
    'env.humidity': 'Fugtighed (%)',
    'env.altitude': 'Højde',
    'env.seaLevel': 'Havniveau',
    'env.moderateAltitude': 'Moderat (1000-2000m)',
    'env.highAltitude': 'Høj (>2000m)',
    'env.sunExposure': 'Soleksponering',
    'env.shade': 'Skygge',
    'env.partial': 'Delvis Sol',
    'env.fullSun': 'Fuld Sol',
    'env.wind': 'Vindforhold',
    'env.calm': 'Stille',
    'env.moderateWind': 'Moderat',
    'env.windy': 'Blæsende',
    'env.clothing': 'Beklædningstype',
    'env.minimal': 'Minimal',
    'env.light': 'Let',
    'env.moderateClothing': 'Moderat',
    'env.heavy': 'Tung',
    
    // Sweat Profile
    'sweat.rate': 'Svedhastighed',
    'sweat.saltiness': 'Svedsalthed',
    'sweat.low': 'Lav',
    'sweat.medium': 'Mellem',
    'sweat.high': 'Høj',
    'sweat.cramping': 'Oplever du kramper?',
    'sweat.crampTiming': 'Krampe Timing',
    'sweat.none': 'Ingen',
    'sweat.early': 'Tidligt (første time)',
    'sweat.mid': 'Midt-session',
    'sweat.late': 'Sent (sidste time)',
    'sweat.post': 'Efter-aktivitet',
    
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
    'goals.upcomingEvents': 'Kommende Begivenheder',
    
    // Consent & GDPR
    'consent.gdpr': 'Jeg har læst og accepterer databeskyttelsesmeddelelsen ovenfor. Jeg samtykker til, at Supplme indsamler og behandler mine anonymiserede data til produktudviklingsformål i overensstemmelse med GDPR-reglerne.',
    'consent.required': 'Samtykke er påkrævet for at fortsætte',
    'gdpr.title': 'Databeskyttelse & GDPR Overholdelse',
    'gdpr.ai.title': '🤖 AI-Drevne Anbefalinger',
    'gdpr.ai.description': 'Dette værktøj bruger kunstig intelligens til at generere personlige væskebalance anbefalinger baseret på peer-reviewed videnskabelig forskning fra PubMed.',
    'gdpr.compliance.title': '🇪🇺 GDPR Overholdelse - Se mere',
    'gdpr.compliance.intro': 'Vi overholder EU GDPR og danske databeskyttelseslove:',
    'gdpr.dataCollection': 'Dataindsamling',
    'gdpr.dataCollection.text': 'Dine data indsamles anonymt med eksplicit samtykke (GDPR Art. 6(1)(a))',
    'gdpr.purpose': 'Formål',
    'gdpr.purpose.text': 'Data bruges udelukkende til produktudvikling og forbedring af væskebalance anbefalinger',
    'gdpr.storage': 'Opbevaring',
    'gdpr.storage.text': 'Data opbevares sikkert i maks. 2 år, hvorefter de automatisk slettes (GDPR Art. 5(1)(e))',
    'gdpr.rights': 'Dine Rettigheder',
    'gdpr.rights.text': 'Du kan til enhver tid anmode om sletning af dine data ved at kontakte os',
    'gdpr.noThirdParties': 'Ingen Tredjeparter',
    'gdpr.noThirdParties.text': 'Data sælges eller deles aldrig med tredjeparter',
    'gdpr.anonymization': 'Anonymisering',
    'gdpr.anonymization.text': 'Alle data anonymiseres - ingen personligt identificerbare oplysninger opbevares, medmindre du vælger at angive e-mail',
    'gdpr.security.title': '🔒 Sikkerhed',
    'gdpr.security.text': 'Data krypteres under overførsel og ved opbevaring. Overholder industristandarder.',
    'gdpr.contact': 'Kontakt: For anmodninger om datasletning eller spørgsmål om privatlivets fred, send e-mail til info@supplme.com',
    
    // File Upload
    'upload.title': 'Upload Smartwatch Data',
    'upload.description': 'Upload træningsfiler fra dit smartwatch for mere præcis analyse',
    'smartwatch.uploaded': '✓ {count} fil(er) uploadet',
    'smartwatch.remove': 'Fjern',
    'smartwatch.multipleFiles': 'Upload Flere Filer',
    'smartwatch.uploadFolder': 'Eller Upload Hel Mappe',
    
    // Analysis
    'analyzing.title': 'Analyserer Dine Data...',
    'analyzing.processing': 'Behandler {count} fil(er) for at udtrække dine sundhedsmålinger',
    'analysis.complete': '✓ Dataanalyse fuldført! Vi har udfyldt:',
    'analysis.ageMetrics': '• Alder og kropsmålinger',
    'analysis.restingHR': '• Hvilepuls',
    'analysis.hrv': '• Pulsvariabilitet',
    'analysis.activityData': '• Aktivitetsdata (til reference - du vælger stadig din guide)',
    'analysis.skipping': 'Springer spørgsmål over, som vi kunne besvare ud fra dine data.',
    
    // Step titles
    'step.1.title': '1. Krop & Fysiologi',
    'step.2.title': '2. Aktivitet & Terræn',
    'step.3.title': '3. Miljødata',
    'step.4.title': '4. Svedprofil',
    'step.5.title': '5. Kostvaner',
    'step.6.title': '6. Mål & Begivenheder',
    
    // Plan
    'plan.title': 'Din Personlige Væskebalance Plan',
    'plan.fluidLoss': 'Estimeret Væsketab',
    'plan.preActivity': 'FØR AKTIVITET',
    'plan.duringActivity': 'UNDER AKTIVITET',
    'plan.postActivity': 'EFTER AKTIVITET',
    'plan.water': 'Vand',
    'plan.electrolytes': 'Elektrolytter',
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
