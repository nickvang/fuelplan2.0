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
    'app.why': 'Know exactly when to drink, how much, and how many Supplme sachets — so you perform at your best.',
    'home.hype': 'For those who train harder. Recover smarter. Perform better.',
    
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
    'version.select': 'Choose your path',
    'version.intro': 'Your personalized hydration plan. When to drink, how much water, and how many Supplme sachets. Science-backed. Choose how deep you go.',
    'version.recommend': 'We recommend Pro',
    'version.recommendBadge': 'Recommended',
    'version.simple.title': 'Quick',
    'version.simple.card': 'Activity + duration. Pre, during and post water & sachets.',
    'version.simple.short': 'Essential plan',
    'version.simple.steps': '2 steps',
    'version.simple.description': 'Quick hydration plan using generic assumptions. Perfect for getting started fast with essential info only.',
    'version.pro.title': 'Pro',
    'version.pro.card': 'Sweat, environment, smartwatch. AI insights and race-day protocol.',
    'version.pro.short': 'Full profile + AI',
    'version.pro.steps': '6 steps',
    'version.pro.description': 'Comprehensive analysis with environmental factors, sweat profile, and smartwatch integration.',
    'version.pro.pillAi': 'AI',
    'version.pro.pillEnv': 'Environment',
    'version.pro.pillSweat': 'Sweat',
    'version.pro.pillSmartwatch': 'Smartwatch',
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
    'consent.short': 'I agree to data use and privacy notice',
    'consent.required': 'Consent is required to continue',
    'gdpr.title': 'Data Privacy & GDPR Compliance',
    'gdpr.short': 'Privacy notice',
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
    'gdpr.deleteButton': 'Delete My Data (GDPR)',
    'gdpr.toastDeletedTitle': 'Data Deleted Successfully',
    'gdpr.toastDeletedDescription': 'Your data has been permanently deleted in compliance with GDPR.',
    'gdpr.toastDeletionFailedTitle': 'Deletion Failed',
    'gdpr.toastDeletionFailedDescription': 'Please contact info@supplme.com for manual data deletion.',
    
    // Result page – product & actions
    'result.supplmeTitle': 'Supplme Liquid Electrolyte',
    'result.supplmeSpec': '30ml sachets · {sodium}mg Sodium · {potassium}mg Potassium · {magnesium}mg Mg · {citrate}mg Citrate · {chloride}mg Chloride',
    'result.supplmeNoMixing': 'Drink directly from sachet — no mixing required',
    'result.buySupplme': 'Buy Supplme',
    'result.retake': 'Retake',
    'result.emailPlan': 'Email my plan',
    'result.emailPlanDescription': 'We’ll send your full hydration plan to this address. You’ll see everything from this page: activity, fluid loss, Pre/During/Post, and tips.',
    'result.emailLabel': 'Email address',
    'result.emailPlaceholder': 'you@example.com',
    'result.sendPlan': 'Send plan',
    'result.sendingPlan': 'Sending…',
    'result.planSentTitle': 'Plan sent',
    'result.planSentDescription': 'Check your inbox. If you don’t see it, check spam.',
    'result.planEmailErrorTitle': 'Couldn’t send',
    'result.planEmailErrorDescription': 'Something went wrong. Try again or contact support.',
    'result.planEmailNotConfigured': 'Email is not set up yet. Contact support to request this feature.',
    'result.emailInvalid': 'Please enter a valid email address.',
    'disclaimer.medicalTitle': 'Medical & Professional Disclaimer',
    'disclaimer.legalTitle': 'Legal Disclaimer',
    
    // File Upload
    'upload.title': 'Upload Smartwatch Data',
    'upload.description': 'Upload training files from your smartwatch for more accurate analysis',
    'smartwatch.uploaded': '✓ {count} file(s) uploaded',
    'smartwatch.remove': 'Remove',
    'smartwatch.chooseFiles': 'Choose files',
    'smartwatch.noFileChosen': 'No file chosen',
    'smartwatch.filesChosen': '{count} file(s) chosen',
    'smartwatch.multipleFiles': 'Upload Multiple Files',
    'smartwatch.uploadFolder': 'Or Upload Entire Folder',

    // Strava
    'strava.title': 'Connect with Strava',
    'strava.description': 'Connect to Strava for more accurate results.',
    'strava.connect': 'Connect with Strava',
    'strava.connected': 'Connected with Strava',
    'strava.error': 'Strava connection failed. Please try again.',
    'strava.notConfigured': 'Strava is not configured for this app.',
    'strava.shortFlowSweat': 'We used your Strava profile. Just sweat and nutrition left, then your plan is ready.',
    'strava.popupFallback': 'Opening in same tab…',

    // Garmin
    'garmin.title': 'Connect with Garmin',
    'garmin.description': 'Connect to Garmin Connect for more accurate results.',
    'garmin.connect': 'Connect with Garmin',
    'garmin.connected': 'Connected with Garmin',
    'garmin.error': 'Garmin connection failed. Please try again.',
    'garmin.notConfigured': 'Garmin Connect is not configured for this app.',
    'garmin.popupFallback': 'Opening in same tab...',
    'garmin.syncPending': 'Garmin connected. Activity data may take a few minutes to sync.',

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

    // Step titles & descriptions (questionnaire)
    'step1.title': 'Step 1: Activity & Terrain',
    'step1.description': 'Choose which activity guide you want',
    'step2.title': 'Step 2: Body & Physiology',
    'step2.description': 'Basic information to calculate your hydration needs',
    'step2.descriptionAnalyzed': 'Complete any missing information',
    'step3.description': 'Training conditions affect your hydration needs',
    'step4.description': 'Understanding your sweat rate and saltiness helps optimize electrolyte intake',
    'step4.descriptionAnalyzed': 'Complete any missing information',
    'step5.description': 'Your everyday nutrition affects hydration needs',
    'activity.selectGuide': 'Select the activity you want a hydration guide for',

    // Body step
    'body.fullNameOptional': 'Full Name (Optional)',
    'body.fullNamePlaceholder': 'Your full name',

    // Environment step
    'env.waterTempRange': 'Water Temperature Range (°C) *',
    'env.trainingTempRange': 'Training Temperature Range (°C) *',
    'env.raceWaterTempRange': 'Race Water Temperature Range (°C)',
    'env.raceTempRange': 'Race Temperature Range (°C)',
    'env.swimTempHint': 'Enter the typical water temperature for your swimming sessions',
    'env.minPlaceholder': 'Min',
    'env.maxPlaceholder': 'Max',
    'env.humidityPlaceholder': 'e.g., 60',
    'env.altitudeTooltip': 'Sea-level: 0-1000m, Moderate: 1000-2500m, High: >2500m. Higher altitude increases respiratory fluid loss and dehydration risk.',
    'env.altitudeTooltipPro': 'Select range or specify exact altitude below. Sea-level: 0-1000m, Moderate: 1000-2500m, High: >2500m. Higher altitude increases respiratory fluid loss and dehydration risk.',
    'env.exactAltitudeOptional': 'Exact Altitude (meters) - Optional',
    'env.humidityTooltip': 'High humidity (>70%) reduces sweat evaporation, increasing heat stress and fluid needs. Check weather apps for humidity levels.',

    // Sweat step
    'sweat.howToTitle': 'How to Determine Your Sweat Profile:',
    'sweat.sweatRateHowTo': 'Sweat Rate: Weigh yourself before and after a 1-hour workout. Weight loss (in kg) × 1000 + fluids consumed = sweat rate in ml/hour. High: >1000ml/h, Medium: 500-1000ml/h, Low: <500ml/h.',
    'sweat.saltinessHowTo': 'Sweat Saltiness: After exercise, check your skin and clothing. White crystalline residue = high salt loss. No visible residue = low salt loss. Can also be measured with sweat sodium test kits.',
    'sweat.foundIn': '💡 Found in: Garmin (Body Battery + Performance Widget), Coros (Training Insights), Whoop (Strain & Recovery), or manual weighing method.',
    'sweat.fromSmartwatch': '✓ This data was taken from your smartwatch',
    'sweat.minimalSweating': 'minimal sweating',
    'sweat.moderateSweating': 'moderate sweating',
    'sweat.heavySweating': 'heavy sweating',
    'sweat.noResidue': 'no white residue',
    'sweat.someResidue': 'some residue',
    'sweat.significantResidue': 'significant white residue',
    'sweat.rateTooltip': "Your sweat rate affects hydration needs. If you're unsure, choose 'medium'. High sweat rate = clothing soaked during exercise. Low = minimal sweating even during hard efforts.",
    'sweat.saltinessTooltip': 'Salty sweat = white residue on skin/clothing after exercise. This indicates higher sodium loss. Can be measured with a sweat sodium test at sports labs or with at-home kits.',
    'sweat.knownSodiumLossLabel': 'Known sodium loss (optional)',
    'sweat.knownSodiumLossPlaceholder': 'e.g. 800 (mg per hour)',
    'sweat.knownSodiumLossTooltip': 'If you know your sodium loss per hour from a sweat test or lab, enter it here in mg/hour. Typical range 300–1400. Leave blank to use the saltiness estimate above.',
    'sweat.knownSodiumLossHint': 'mg per hour — from sweat test or lab',
    'sweat.crampingTooltip': 'Exercise-associated muscle cramps often indicate electrolyte imbalance, particularly sodium and magnesium deficiency.',
    'sweat.hydrationStrategyLabel': 'Current Hydration Strategy',
    'sweat.hydrationStrategyPlaceholder': 'Describe what you currently drink during training/races',

    // Nutrition step
    'nutrition.waterPlaceholder': 'e.g., 2.5',
    'nutrition.caffeinePlaceholder': 'e.g., 200 (about 2 cups of coffee)',
    'nutrition.dietPlaceholder': 'e.g., omnivore, vegetarian, keto',
    'nutrition.notesLabel': 'Additional Nutrition Notes',
    'nutrition.notesPlaceholder': 'Any other relevant information about your diet or supplements',

    // Common placeholders / misc
    'common.bpm': 'bpm',
    'common.known': 'If known',
    'common.garminWhoop': 'If tracked via Garmin/Whoop/Oura',
    'common.hoursPerNight': 'hours/night',
    'common.oneToTen': '1-10',
    'common.healthExample': 'e.g., hypertension, kidney issues',
    'common.altitudeExample': 'e.g., 1500',

    // Nutrition salt intake labels (parenthetical)
    'nutrition.saltLowLabel': 'little added salt',
    'nutrition.saltMediumLabel': 'moderate salt',
    'nutrition.saltHighLabel': 'regular salt use',

    // Generating plan screen
    'plan.generatingTitle': 'CRAFTING YOUR ELITE HYDRATION PLAN',
    'plan.generatingSubtitle': 'Performance Optimization in Progress...',

    // Result page toasts & confirm
    'result.deleteConfirm': 'Are you sure you want to delete all your data? This action cannot be undone.',
    'result.cannotDeleteTitle': 'Cannot Delete Data',
    'result.cannotDeleteDescription': 'No deletion token found. Data may have already been deleted or expired.',
    'result.printFailedTitle': 'Print Failed',
    'result.printFailedDescription': 'Your browser could not open the print dialog.',
    'result.generatingImageTitle': 'Generating Image...',
    'result.generatingImageDescription': 'Creating your shareable protocol image',
    'result.imageSavedTitle': 'Image Saved!',
    'result.imageSavedDescription': 'Your protocol image is ready to share on Instagram, WhatsApp, or SMS!',
    'result.shareFailedTitle': 'Share Failed',
    'result.shareFailedDescription': 'Unable to generate image. Please try again.',
  },
  da: {
    // Header
    'app.title': 'Personlig Væskebalance Guide',
    'app.subtitle': 'Få videnskabsbaserede væskebalance anbefalinger skræddersyet til din træning',
    'app.why': 'Vid præcis hvornår du skal drikke, hvor meget og hvor mange Supplme sachets — så du yder dit bedste.',
    'home.hype': 'For dem der træner hårdere. Restituerer smartere. Præsterer bedre.',
    
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
    'version.select': 'Vælg din vej',
    'version.intro': 'Din personlige hydrationsplan. Hvornår og hvor meget at drikke, og hvor mange Supplme sachets. Videnskabsbaseret. Vælg hvor grundigt du vil gå.',
    'version.recommend': 'Vi anbefaler Pro',
    'version.recommendBadge': 'Anbefalet',
    'version.simple.title': 'Hurtig',
    'version.simple.card': 'Aktivitet + varighed. Pre, under og efter vand & sachets.',
    'version.simple.short': 'Grundplan',
    'version.simple.steps': '2 trin',
    'version.simple.description': 'Hurtig hydrationsplan ved brug af generelle antagelser. Perfekt til at komme hurtigt i gang med kun det nødvendige.',
    'version.pro.title': 'Pro',
    'version.pro.card': 'Sved, miljø, smartwatch. AI-indsigter og racedags-protokol.',
    'version.pro.short': 'Fuld profil + AI',
    'version.pro.steps': '6 trin',
    'version.pro.description': 'Omfattende analyse med miljøfaktorer, svedprofil og smartwatch-integration.',
    'version.pro.pillAi': 'AI',
    'version.pro.pillEnv': 'Miljø',
    'version.pro.pillSweat': 'Sved',
    'version.pro.pillSmartwatch': 'Smartwatch',
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
    'consent.short': 'Jeg accepterer databrug og privatlivspolitik',
    'consent.required': 'Samtykke er påkrævet for at fortsætte',
    'gdpr.title': 'Databeskyttelse & GDPR Overholdelse',
    'gdpr.short': 'Privatlivspolitik',
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
    'gdpr.deleteButton': 'Slet mine data (GDPR)',
    'gdpr.toastDeletedTitle': 'Data slettet',
    'gdpr.toastDeletedDescription': 'Dine data er blevet permanent slettet i overensstemmelse med GDPR.',
    'gdpr.toastDeletionFailedTitle': 'Sletning mislykkedes',
    'gdpr.toastDeletionFailedDescription': 'Kontakt info@supplme.com for manuel datasletning.',
    
    // Result page – product & actions
    'result.supplmeTitle': 'Supplme Liquid Electrolyte',
    'result.supplmeSpec': '30ml sachets · {sodium}mg Natrium · {potassium}mg Kalium · {magnesium}mg Mg · {citrate}mg Citrat · {chloride}mg Chlorid',
    'result.supplmeNoMixing': 'Drik direkte fra sachet — ingen blanding nødvendig',
    'result.buySupplme': 'Køb Supplme',
    'result.retake': 'Tag igen',
    'result.emailPlan': 'Email min plan',
    'result.emailPlanDescription': 'Vi sender din fulde hydrationsplan til denne adresse. Du får alt fra denne side: aktivitet, væsketab, Pre/Under/Efter og tips.',
    'result.emailLabel': 'E-mailadresse',
    'result.emailPlaceholder': 'dig@eksempel.dk',
    'result.sendPlan': 'Send plan',
    'result.sendingPlan': 'Sender…',
    'result.planSentTitle': 'Plan sendt',
    'result.planSentDescription': 'Tjek din indbakke. Tjek evt. spam.',
    'result.planEmailErrorTitle': 'Kunne ikke sende',
    'result.planEmailErrorDescription': 'Noget gik galt. Prøv igen eller kontakt support.',
    'result.planEmailNotConfigured': 'E-mail er endnu ikke konfigureret. Kontakt support for at anmode om denne funktion.',
    'result.emailInvalid': 'Angiv en gyldig e-mailadresse.',
    'disclaimer.medicalTitle': 'Medicinsk og faglig ansvarsfraskrivelse',
    'disclaimer.legalTitle': 'Juridisk ansvarsfraskrivelse',
    
    // File Upload
    'upload.title': 'Upload Smartwatch Data',
    'upload.description': 'Upload træningsfiler fra dit smartwatch for mere præcis analyse',
    'smartwatch.uploaded': '✓ {count} fil(er) uploadet',
    'smartwatch.remove': 'Fjern',
    'smartwatch.chooseFiles': 'Vælg filer',
    'smartwatch.noFileChosen': 'Ingen fil valgt',
    'smartwatch.filesChosen': '{count} fil(er) valgt',
    'smartwatch.multipleFiles': 'Upload Flere Filer',
    'smartwatch.uploadFolder': 'Eller Upload Hel Mappe',

    // Strava
    'strava.title': 'Forbind med Strava',
    'strava.description': 'Forbind til Strava for mere præcise resultater.',
    'strava.connect': 'Forbind med Strava',
    'strava.connected': 'Forbundet med Strava',
    'strava.error': 'Strava-forbindelsen mislykkedes. Prøv igen.',
    'strava.notConfigured': 'Strava er ikke konfigureret for denne app.',
    'strava.shortFlowSweat': 'Vi brugte din Strava-profil. Kun sved og kost tilbage, så er din plan klar.',
    'strava.popupFallback': 'Åbner i samme fane…',

    // Garmin
    'garmin.title': 'Forbind med Garmin',
    'garmin.description': 'Forbind til Garmin Connect for mere præcise resultater.',
    'garmin.connect': 'Forbind med Garmin',
    'garmin.connected': 'Forbundet med Garmin',
    'garmin.error': 'Garmin-forbindelsen mislykkedes. Prøv igen.',
    'garmin.notConfigured': 'Garmin er ikke konfigureret for denne app.',
    'garmin.popupFallback': 'Åbner i samme fane...',
    'garmin.syncPending': 'Garmin forbundet. Aktivitetsdata kan tage et par minutter at synkronisere.',

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

    // Step titles & descriptions (questionnaire)
    'step1.title': 'Trin 1: Aktivitet & Terræn',
    'step1.description': 'Vælg hvilken aktivitetsguide du ønsker',
    'step2.title': 'Trin 2: Krop & Fysiologi',
    'step2.description': 'Grundlæggende oplysninger til beregning af dit væskebehov',
    'step2.descriptionAnalyzed': 'Udfyld eventuelle manglende oplysninger',
    'step3.description': 'Træningsforhold påvirker dit væskebehov',
    'step4.description': 'Din svedhastighed og svedsalthed hjælper med at optimere elektrolytindtaget',
    'step4.descriptionAnalyzed': 'Udfyld eventuelle manglende oplysninger',
    'step5.description': 'Din daglige kost påvirker væskebehovet',
    'activity.selectGuide': 'Vælg den aktivitet, du ønsker en væskebalance-guide til',

    // Body step
    'body.fullNameOptional': 'Fulde navn (valgfrit)',
    'body.fullNamePlaceholder': 'Dit fulde navn',

    // Environment step
    'env.waterTempRange': 'Vandtemperatur (°C) *',
    'env.trainingTempRange': 'Træningstemperatur (°C) *',
    'env.raceWaterTempRange': 'Løbs vandtemperatur (°C)',
    'env.raceTempRange': 'Løbstemperatur (°C)',
    'env.swimTempHint': 'Angiv den typiske vandtemperatur for dine svømmepas',
    'env.minPlaceholder': 'Min',
    'env.maxPlaceholder': 'Maks',
    'env.humidityPlaceholder': 'f.eks. 60',
    'env.altitudeTooltip': 'Havniveau: 0-1000m, Moderat: 1000-2500m, Høj: >2500m. Højere højde øger væsketab og dehydreringsrisiko.',
    'env.altitudeTooltipPro': 'Vælg interval eller angiv nøjagtig højde nedenfor. Havniveau: 0-1000m, Moderat: 1000-2500m, Høj: >2500m. Højere højde øger væsketab og dehydreringsrisiko.',
    'env.exactAltitudeOptional': 'Nøjagtig højde (meter) - valgfrit',
    'env.humidityTooltip': 'Høj fugtighed (>70%) reducerer fordampning af sved og øger varmebelastning og væskebehov. Tjek vejrapporter for fugtighed.',

    // Sweat step
    'sweat.howToTitle': 'Sådan finder du din svedprofil:',
    'sweat.sweatRateHowTo': 'Svedhastighed: Vej dig før og efter en 1-times træning. Vægttab (i kg) × 1000 + indtaget væske = svedhastighed i ml/time. Høj: >1000 ml/t, Mellem: 500-1000 ml/t, Lav: <500 ml/t.',
    'sweat.saltinessHowTo': 'Svedsalthed: Efter træning, tjek din hud og tøj. Hvid krystallinsk rest = højt salttab. Ingen synlig rest = lavt salttab. Kan også måles med svednatrium-testkits.',
    'sweat.foundIn': '💡 Findes i: Garmin (Body Battery + Performance Widget), Coros (Training Insights), Whoop (Strain & Recovery) eller manuel vejningsmetode.',
    'sweat.fromSmartwatch': '✓ Disse data er hentet fra dit smartwatch',
    'sweat.minimalSweating': 'minimal sveden',
    'sweat.moderateSweating': 'moderat sveden',
    'sweat.heavySweating': 'kraftig sveden',
    'sweat.noResidue': 'ingen hvid rest',
    'sweat.someResidue': 'lidt rest',
    'sweat.significantResidue': 'tydelig hvid rest',
    'sweat.rateTooltip': 'Din svedhastighed påvirker væskebehovet. Ved usikkerhed, vælg "mellem". Høj = gennemblødt tøj under træning. Lav = minimal sveden selv ved hård indsats.',
    'sweat.saltinessTooltip': 'Salt sved = hvid rest på hud/tøj efter træning. Indikerer højere natriumtab. Kan måles med svednatrium-test på idrætsklinikker eller hjemmetest.',
    'sweat.knownSodiumLossLabel': 'Kendt natriumtab (valgfrit)',
    'sweat.knownSodiumLossPlaceholder': 'f.eks. 800 (mg per time)',
    'sweat.knownSodiumLossTooltip': 'Hvis du kender dit natriumtab per time fra en svedtest eller laboratorium, indtast det her i mg/time. Typisk interval 300–1400. Lad stå tomt for at bruge salthedsestimatet ovenfor.',
    'sweat.knownSodiumLossHint': 'mg per time — fra svedtest eller laboratorium',
    'sweat.crampingTooltip': 'Muskelkramper under træning skyldes ofte elektrolytubalance, særligt mangel på natrium og magnesium.',
    'sweat.hydrationStrategyLabel': 'Nuværende væskestrategi',
    'sweat.hydrationStrategyPlaceholder': 'Beskriv hvad du typisk drikker under træning/løb',

    // Nutrition step
    'nutrition.waterPlaceholder': 'f.eks. 2,5',
    'nutrition.caffeinePlaceholder': 'f.eks. 200 (ca. 2 kopper kaffe)',
    'nutrition.dietPlaceholder': 'f.eks. altæder, vegetar, keto',
    'nutrition.notesLabel': 'Yderligere kostnoter',
    'nutrition.notesPlaceholder': 'Anden relevant information om din kost eller kosttilskud',

    // Common placeholders / misc
    'common.bpm': 'bpm',
    'common.known': 'Hvis kendt',
    'common.garminWhoop': 'Hvis sporet via Garmin/Whoop/Oura',
    'common.hoursPerNight': 'timer/nat',
    'common.oneToTen': '1-10',
    'common.healthExample': 'f.eks. forhøjet blodtryk, nyreproblemer',
    'common.altitudeExample': 'f.eks. 1500',

    // Nutrition salt intake labels (parenthetical)
    'nutrition.saltLowLabel': 'lidt tilsat salt',
    'nutrition.saltMediumLabel': 'moderat salt',
    'nutrition.saltHighLabel': 'almindeligt saltforbrug',

    // Generating plan screen
    'plan.generatingTitle': 'UDARBEJDER DIN ELITE VÆSKEBALANCE PLAN',
    'plan.generatingSubtitle': 'Præstationsoptimering i gang...',

    // Result page toasts & confirm
    'result.deleteConfirm': 'Er du sikker på, at du vil slette alle dine data? Handlingen kan ikke fortrydes.',
    'result.cannotDeleteTitle': 'Kan ikke slette data',
    'result.cannotDeleteDescription': 'Ingen sletningstoken fundet. Data er muligvis allerede slettet eller udløbet.',
    'result.printFailedTitle': 'Udskriv fejlede',
    'result.printFailedDescription': 'Din browser kunne ikke åbne udskrivningsdialogen.',
    'result.generatingImageTitle': 'Opretter billede...',
    'result.generatingImageDescription': 'Opretter dit delbare protokolbillede',
    'result.imageSavedTitle': 'Billede gemt!',
    'result.imageSavedDescription': 'Dit protokolbillede er klar til deling på Instagram, WhatsApp eller SMS!',
    'result.shareFailedTitle': 'Deling fejlede',
    'result.shareFailedDescription': 'Kunne ikke generere billede. Prøv igen.',
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

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = language === 'da' ? 'da' : 'en';
    }
  }, [language]);

  const t = (key: string): string => {
    const lang = translations[language];
    const en = translations.en;
    return (lang[key as keyof typeof en] ?? en[key as keyof typeof en] ?? key) as string;
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
