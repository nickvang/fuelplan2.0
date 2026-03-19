import { createRoot } from "react-dom/client";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { RaceProvider } from '@/contexts/RaceContext';
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <RaceProvider>
      <App />
    </RaceProvider>
  </LanguageProvider>
);
