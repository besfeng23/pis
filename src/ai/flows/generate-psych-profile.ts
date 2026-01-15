'use server';
/**
 * @fileOverview Generates a psychological profile based on an asset's entire message history.
 *
 * - generatePsychProfile - A function that handles the profile generation.
 * - GeneratePsychProfileInput - The input type for the generatePsychProfile function.
 * - GeneratePsychProfileOutput - The return type for the generatePsychProfile function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {HarmCategory, HarmBlockThreshold} from '@google/generative-ai';

const GeneratePsychProfileInputSchema = z.object({
  messageHistory: z
    .array(z.string())
    .describe(
      "The complete message history of the asset, with each message as an element in the array."
    ),
});
export type GeneratePsychProfileInput = z.infer<
  typeof GeneratePsychProfileInputSchema
>;

const GeneratePsychProfileOutputSchema = z.object({
  tacticalAssets: z
    .array(z.string())
    .describe('Strengths and shared bonds that build rapport.'),
  vulnerabilities: z
    .array(z.string())
    .describe('Topics or behaviors that cause friction and conflict.'),
  riskFactors: z
    .array(z.string())
    .describe('Factors that increase the probability of churn or ghosting.'),
  operationalStatus: z
    .string()
    .describe('The current standing of the relationship: "Secure" or "Compromised".'),
});
export type GeneratePsychProfileOutput = z.infer<
  typeof GeneratePsychProfileOutputSchema
>;

export async function generatePsychProfile(
  input: GeneratePsychProfileInput
): Promise<GeneratePsychProfileOutput> {
  return generatePsychProfileFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePsychProfilePrompt',
  input: {schema: GeneratePsychProfileInputSchema},
  output: {schema: GeneratePsychProfileOutputSchema},
  prompt: `You are a conflict resolution and relationship analyst. Based on the following message history, generate a summary for improving communication.

Message History:
{{#each messageHistory}}
- {{{this}}}
{{/each}}

Provide the following analysis:
- **Tactical Assets:** What are the core strengths and shared bonds in this relationship?
- **Vulnerabilities:** What topics or behaviors consistently lead to friction?
- **Risk Factors:** What are the key indicators or risks that could lead to the relationship ending?
- **Operational Status:** Based on the overall tone, is the relationship currently "Secure" or "Compromised"?`,
});

const generatePsychProfileFlow = ai.defineFlow(
  {
    name: 'generatePsychProfileFlow',
    inputSchema: GeneratePsychProfileInputSchema,
    outputSchema: GeneratePsychProfileOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {
      model: 'googleai/gemini-1.5-flash',
      config: {
        temperature: 0.4,
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
