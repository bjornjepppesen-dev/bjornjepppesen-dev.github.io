# Brugerstyring for quiz

Denne tilføjelse giver en simpel passwordless brugerstyring (kun brugernavn + rolle). Funktioner:

- Login/opret: Elever og lærere kan oprette et brugernavn uden kodeord. Vælg rolle (elev/lærer).
- Elevens space: Hver elev kan åbne sit eget "space" (ny fane) og se tidligere afleveringer, LLM-feedback og eventuelle lærerkommentarer.
- Aflevering: Når elev afleverer gemmes svar i localStorage under `jp_submissions_<brugernavn>`.
- Vis svar: Eleven kan vælge at se svar inline under besvarelse, først efter aflevering, eller aldrig.
- Score: Eleven ser samlet score og per-spørgsmål feedback efter aflevering.
- Lærer: Lærere kan vælge en elev i lærer-panelet, se den seneste aflevering, se de rigtige svar og tilføje kommentarer — disse gemmes i elevens data og kan ses i elevens space.

LLM-integration (valgfri):
- For bedre evaluering af fritekstsvar kan du konfigurere en OpenAI-lignende endpoint og en API-nøgle i JavaScript ved at sætte:

```js
window.JP_LLM_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
window.JP_LLM_API_KEY = 'din-api-nokkel';
```

- Hvis ikke konfigureret bruges en heuristisk token-overlap metode som fallback.

Sikkerhed og grænser:
- Dette er en client-side løsning; alle data gemmes i browserens localStorage. Det er primært beregnet til lokal/klassebrug eller demo.
- For produktion: implementer server-side brugerstyring og lagring.
