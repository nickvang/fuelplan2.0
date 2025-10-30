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
    'smartwatch.uploaded': '✓ {count} file(s) uploaded',
    'smartwatch.remove': 'Remove',
    'smartwatch.multipleFiles': 'Upload Multiple Files',
    'smartwatch.uploadFolder': 'Or Upload Entire Folder',
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
    'smartwatch.uploaded': '✓ {count} fil(er) uploadet',
    'smartwatch.remove': 'Fjern',
    'smartwatch.multipleFiles': 'Upload Flere Filer',
    'smartwatch.uploadFolder': 'Eller Upload Hel Mappe',
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
