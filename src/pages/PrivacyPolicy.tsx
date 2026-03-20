import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  const { language } = useLanguage();
  const isDA = language === 'da';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <Link to="/" className="text-sm text-primary hover:underline">&larr; {isDA ? 'Tilbage' : 'Back to app'}</Link>

        <h1 className="text-3xl font-bold">{isDA ? 'Privatlivspolitik' : 'Privacy Policy'}</h1>
        <p className="text-sm text-muted-foreground">{isDA ? 'Senest opdateret' : 'Last updated'}: 2026-03-20</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '1. Dataansvarlig' : '1. Data Controller'}</h2>
          <p>Supplme / FuelPlan 2.0<br />
            {isDA ? 'Kontakt' : 'Contact'}: <a href="mailto:info@supplme.com" className="underline">info@supplme.com</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '2. Data vi indsamler' : '2. Data We Collect'}</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>{isDA
              ? 'Krop & fysiologi: alder, kon, hojde, vaegt, kropsfedt, hvilepuls, HRV'
              : 'Body & physiology: age, sex, height, weight, body fat, resting HR, HRV'}</li>
            <li>{isDA
              ? 'Aktivitetsdata: disciplin, distance, varighed, tempo, hojde'
              : 'Activity data: discipline, distance, duration, pace, elevation'}</li>
            <li>{isDA
              ? 'Miljodata: temperatur, fugtighed, hojde, soleksponering'
              : 'Environmental data: temperature, humidity, altitude, sun exposure'}</li>
            <li>{isDA
              ? 'Svedprofil: svedrate, saltniveau, symptomer'
              : 'Sweat profile: sweat rate, salt level, symptoms'}</li>
            <li>{isDA
              ? 'Valgfrit: fuldt navn, e-mail, sundhedstilstande'
              : 'Optional: full name, email, health conditions'}</li>
            <li>{isDA
              ? 'Metadata: IP-adresse (anonymiseret), brugeragent, tidsstempel'
              : 'Metadata: IP address (anonymized), user agent, timestamp'}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '3. Formal med behandling' : '3. Purpose of Processing'}</h2>
          <p>{isDA
            ? 'Vi behandler dine data udelukkende for at generere din personlige hydrationsplan og forbedre vores anbefalingsalgoritmer. Retsgrundlaget er eksplicit samtykke (GDPR Art. 6(1)(a)).'
            : 'We process your data solely to generate your personalized hydration plan and to improve our recommendation algorithms. The legal basis is explicit consent (GDPR Art. 6(1)(a)).'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '4. Tredjepartsbehandlere' : '4. Third-Party Processors'}</h2>
          <p>{isDA
            ? 'Dine data kan behandles af folgende tredjeparter:'
            : 'Your data may be processed by the following third parties:'}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Supabase</strong> {isDA ? '(database & hosting)' : '(database & hosting)'} &mdash; {isDA ? 'EU-kompatibel cloud-infrastruktur' : 'EU-compliant cloud infrastructure'}</li>
            <li><strong>Google Gemini / OpenAI</strong> {isDA ? '(AI-anbefalinger)' : '(AI recommendations)'} &mdash; {isDA
              ? 'Anonymiserede data sendes til AI-udbydere for at generere personlige indsigter. Ingen personligt identificerbare oplysninger deles.'
              : 'Anonymized data is sent to AI providers to generate personalized insights. No personally identifiable information is shared.'}</li>
            <li><strong>Strava / Garmin</strong> ({isDA ? 'valgfri integration' : 'optional integration'}) &mdash; {isDA
              ? 'Kun hvis du vælger at forbinde din konto. Vi henter kun aktivitetsdata relevant for hydrationsberegninger.'
              : 'Only if you choose to connect your account. We fetch only activity data relevant to hydration calculations.'}</li>
            <li><strong>Resend</strong> ({isDA ? 'e-mail' : 'email'}) &mdash; {isDA
              ? 'Kun hvis du vælger at sende din plan via e-mail.'
              : 'Only if you choose to email your plan.'}</li>
          </ul>
          <p>{isDA ? 'Vi saelger aldrig dine data.' : 'We never sell your data.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '5. Opbevaring' : '5. Data Retention'}</h2>
          <p>{isDA
            ? 'Data opbevares i maksimalt 2 ar og slettes derefter automatisk (GDPR Art. 5(1)(e)). Lokalt gemte data (browserens localStorage) forbliver pa din enhed, indtil du rydder dem.'
            : 'Data is retained for a maximum of 2 years, then automatically deleted (GDPR Art. 5(1)(e)). Locally stored data (browser localStorage) remains on your device until you clear it.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '6. Dine rettigheder' : '6. Your Rights'}</h2>
          <p>{isDA ? 'Under GDPR har du ret til:' : 'Under GDPR you have the right to:'}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{isDA ? 'Indsigt i dine data (Art. 15)' : 'Access your data (Art. 15)'}</li>
            <li>{isDA ? 'Berigtigelse af data (Art. 16)' : 'Rectify your data (Art. 16)'}</li>
            <li>{isDA ? 'Sletning af data (Art. 17) - brug knappen "Slet mine data" i appen' : 'Erasure of data (Art. 17) - use the "Delete My Data" button in the app'}</li>
            <li>{isDA ? 'Begransning af behandling (Art. 18)' : 'Restrict processing (Art. 18)'}</li>
            <li>{isDA ? 'Dataportabilitet (Art. 20)' : 'Data portability (Art. 20)'}</li>
            <li>{isDA ? 'Indsigelse mod behandling (Art. 21)' : 'Object to processing (Art. 21)'}</li>
          </ul>
          <p>{isDA
            ? 'Kontakt info@supplme.com for at udove disse rettigheder.'
            : 'Contact info@supplme.com to exercise these rights.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '7. Cookies & lokal lagring' : '7. Cookies & Local Storage'}</h2>
          <p>{isDA
            ? 'Vi bruger ikke cookies. Vi bruger browserens localStorage til at gemme dine kropsmaalinger (sa du ikke skal indtaste dem igen) og dit sprog. Disse data forlader aldrig din enhed.'
            : 'We do not use cookies. We use browser localStorage to save your body measurements (so you don\'t have to re-enter them) and your language preference. This data never leaves your device.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '8. Sikkerhed' : '8. Security'}</h2>
          <p>{isDA
            ? 'Alle data krypteres under overforsel (TLS) og ved opbevaring. Adgang til databasen er begranset med Row Level Security-politikker og rate limiting.'
            : 'All data is encrypted in transit (TLS) and at rest. Database access is restricted with Row Level Security policies and rate limiting.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '9. Kontakt' : '9. Contact'}</h2>
          <p>{isDA
            ? 'For sporgsmal om privatlivets fred eller anmodninger om datasletning:'
            : 'For privacy questions or data deletion requests:'}</p>
          <p><a href="mailto:info@supplme.com" className="underline">info@supplme.com</a></p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
