'use server';
/**
 * @fileOverview Generates a psychological and market profile based on an asset's entire message history.
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

const SWOTAnalysisSchema = z.object({
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

const GeneratePsychProfileOutputSchema = z.object({
  psych: z.object({
    threat_level: z.enum(['Green', 'Red']).describe("The asset's current threat level based on communication analysis."),
    attachment_style: z.string().describe("The asset's likely attachment style (e.g., Secure, Anxious, Avoidant)."),
    swot_analysis: SWOTAnalysisSchema,
  }),
  market: z.object({
    niche: z.enum(['Health', 'Wealth', 'Lifestyle', 'Relationships', 'Uncategorized']).describe("The primary commercial niche identified from the conversation."),
    estimated_spending_power: z.string().describe("An estimate of the asset's spending power (e.g., Low, Medium, High)."),
    lead_value: z.number().describe("An estimated monetary value of this asset as a lead."),
  }),
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
  prompt: `You are a conflict resolution and relationship analyst. Analyze this chat history. Return a JSON object with a 'psych' and 'market' profile.

Message History:
{{#each messageHistory}}
- {{{this}}}
{{/each}}

Based on the analysis, provide the following JSON structure:

- **psych**:
  - **threat_level**: Determine if the overall sentiment and conflict level suggests 'Green' (stable) or 'Red' (critical).
  - **attachment_style**: Infer the subject's likely attachment style.
  - **swot_analysis**:
    - **tacticalAssets**: Core strengths and shared bonds in this relationship.
    - **vulnerabilities**: Topics/behaviors that consistently lead to friction.
    - **riskFactors**: Key indicators that could lead to the relationship ending.
    - **operationalStatus**: Is the relationship currently "Secure" or "Compromised"?
- **market**:
  - **niche**: Categorize the conversation into 'Health', 'Wealth', 'Lifestyle', 'Relationships', or 'Uncategorized'.
  - **estimated_spending_power**: Estimate spending power as 'Low', 'Medium', or 'High'.
  - **lead_value**: Estimate the potential monetary value of this person as a business lead.`,
});

const generatePsychProfileFlow = ai.defineFlow(
  {
    name: 'generatePsychProfileFlow',
    inputSchema: GeneratePsychProfileInputSchema,
    outputSchema: GeneratePsychProfileOutputSchema,
    timeout: 60000, // 60 seconds
  },
  async input => {
    const {output} = await prompt(input, {
      model: 'googleai/gemini-2.5-flash',
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
