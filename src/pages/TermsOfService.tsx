import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
  const { language } = useLanguage();
  const isDA = language === 'da';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <Link to="/" className="text-sm text-primary hover:underline">&larr; {isDA ? 'Tilbage' : 'Back to app'}</Link>

        <h1 className="text-3xl font-bold">{isDA ? 'Servicevilkar' : 'Terms of Service'}</h1>
        <p className="text-sm text-muted-foreground">{isDA ? 'Senest opdateret' : 'Last updated'}: 2026-03-20</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '1. Tjenestebeskrivelse' : '1. Service Description'}</h2>
          <p>{isDA
            ? 'Supplme / FuelPlan 2.0 er et vaerktoj til at generere personlige hydrationsanbefalinger til atleter. Tjenesten leveres "som den er" uden garanti for medicinsk noejagtighed.'
            : 'Supplme / FuelPlan 2.0 is a tool for generating personalized hydration recommendations for athletes. The service is provided "as is" without warranty of medical accuracy.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '2. Ikke medicinsk radgivning' : '2. Not Medical Advice'}</h2>
          <p>{isDA
            ? 'Vores anbefalinger er baseret pa videnskabelig forskning, men erstatter IKKE professionel medicinsk radgivning. Konsulter altid en laege for sundhedsrelaterede beslutniger. Brug tjenesten pa eget ansvar.'
            : 'Our recommendations are based on scientific research but are NOT a substitute for professional medical advice. Always consult a healthcare professional for health-related decisions. Use the service at your own risk.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '3. Brug af tjenesten' : '3. Use of Service'}</h2>
          <p>{isDA ? 'Du indvilliger i at:' : 'You agree to:'}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{isDA ? 'Angive noejagtige oplysninger i sporgeskermaet' : 'Provide accurate information in the questionnaire'}</li>
            <li>{isDA ? 'Ikke misbruge tjenesten eller forsoge at fa adgang til andre brugeres data' : 'Not misuse the service or attempt to access other users\' data'}</li>
            <li>{isDA ? 'Ikke bruge automatiserede vaerktoejer til at belaste tjenesten' : 'Not use automated tools to overload the service'}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '4. Intellektuel ejendomsret' : '4. Intellectual Property'}</h2>
          <p>{isDA
            ? 'Alt indhold, algoritmer og design tilhorer Supplme. Din genererede hydrationsplan er til personlig brug.'
            : 'All content, algorithms, and design belong to Supplme. Your generated hydration plan is for personal use.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '5. Ansvarsbegrensning' : '5. Limitation of Liability'}</h2>
          <p>{isDA
            ? 'Supplme er ikke ansvarlig for skader som folge af brug af tjenesten, herunder men ikke begreanset til dehydrering, overhydrering eller andre sundhedsproblemer. Maksimal erstatning er begranset til det belob, du har betalt for tjenesten.'
            : 'Supplme shall not be liable for damages arising from use of the service, including but not limited to dehydration, overhydration, or other health issues. Maximum liability is limited to the amount you paid for the service.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '6. Tredjepartsintegrationer' : '6. Third-Party Integrations'}</h2>
          <p>{isDA
            ? 'Tjenesten kan integreres med Strava og Garmin. Brug af disse integrationer er underlagt deres respektive vilkar og privatlivspolitikker.'
            : 'The service may integrate with Strava and Garmin. Use of these integrations is subject to their respective terms and privacy policies.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '7. Endringer' : '7. Changes'}</h2>
          <p>{isDA
            ? 'Vi forbeholder os retten til at aendre disse vilkar. Fortsat brug af tjenesten efter aendringer udgier accept af de nye vilkar.'
            : 'We reserve the right to modify these terms. Continued use of the service after changes constitutes acceptance of the new terms.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '8. Lovvalg' : '8. Governing Law'}</h2>
          <p>{isDA
            ? 'Disse vilkar er underlagt dansk ret. Tvister afgoeres ved de danske domstole.'
            : 'These terms are governed by Danish law. Disputes shall be resolved in Danish courts.'}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{isDA ? '9. Kontakt' : '9. Contact'}</h2>
          <p><a href="mailto:info@supplme.com" className="underline">info@supplme.com</a></p>
        </section>

        <p className="text-sm text-muted-foreground pt-4">
          <Link to="/privacy" className="underline">{isDA ? 'Privatlivspolitik' : 'Privacy Policy'}</Link>
        </p>
      </div>
    </div>
  );
};

export default TermsOfService;
