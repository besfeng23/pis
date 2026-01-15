import { config } from 'dotenv';
config();

import '@/ai/flows/generate-asset-description.ts';
import '@/ai/flows/summarize-dossier.ts';
import '@/ai/flows/generate-intercepts.ts';
import '@/ai/flows/analyze-sentiment.ts';
import '@/ai/flows/generate-psych-profile.ts';
import '@/ai/flows/generate-counter-measures.ts';
