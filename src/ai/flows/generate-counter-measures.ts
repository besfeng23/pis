'use server';
/**
 * @fileOverview Generates strategic counter-measures based on a complete message history.
 *
 * - generateCounterMeasures - A function that creates communication strategies.
 * - GenerateCounterMeasuresInput - The input type for the function.
 * - GenerateCounterMeasuresOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {HarmCategory, HarmBlockThreshold} from '@google/generative-ai';

const GenerateCounterMeasuresInputSchema = z.object({
  recentMessages: z
    .array(z.string())
    .describe('The entire communication history for analysis.'),
  assetName: z.string().describe('The name of the asset being communicated with.'),
});
export type GenerateCounterMeasuresInput = z.infer<
  typeof GenerateCounterMeasuresInputSchema
>;

const GenerateCounterMeasuresOutputSchema = z.object({
  optionAlpha: z.string().describe('De-escalation script to neutralize hostility.'),
  optionBravo: z.string().describe('Pivot script to shift to a safe, positive topic.'),
  optionCharlie: z.string().describe('Recommendation for strategic silence (Ghost Protocol).'),
});
export type GenerateCounterMeasuresOutput = z.infer<
  typeof GenerateCounterMeasuresOutputSchema
>;

export async function generateCounterMeasures(
  input: GenerateCounterMeasuresInput
): Promise<GenerateCounterMeasuresOutput> {
  return generateCounterMeasuresFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCounterMeasuresPrompt',
  input: {schema: GenerateCounterMeasuresInputSchema},
  output: {schema: GenerateCounterMeasuresOutputSchema},
  prompt: `You are analyzing the complete historical dossier of a multi-year relationship with {{assetName}}.

Phase 1: Scan the entire timeline for recurring conflict patterns and attachment triggers.
Phase 2: Based on this deep history, generate 3 strategic Counter-Measures for the current situation.
Phase 3: Ensure the advice accounts for long-standing issues, not just the recent mood.

Full Message History:
{{#each recentMessages}}
- {{{this}}}
{{/each}}

Based on this deep analysis, provide:
- **Option Alpha (De-Escalate):** A script to neutralize hostility or tension.
- **Option Bravo (Pivot):** A script to smoothly shift the conversation to a known positive topic or shared interest.
- **Option Charlie (Ghost Protocol):** A recommendation on whether strategic silence is the best option and for how long.`,
});

const generateCounterMeasuresFlow = ai.defineFlow(
  {
    name: 'generateCounterMeasuresFlow',
    inputSchema: GenerateCounterMeasuresInputSchema,
    outputSchema: GenerateCounterMeasuresOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {
      model: 'googleai/gemini-2.5-flash',
      config: {
        temperature: 0.7,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      },
    });
    return output!;
  }
);
