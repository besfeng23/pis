'use server';
/**
 * @fileOverview Generates tactical intercept messages for a given asset.
 *
 * - generateIntercepts - A function that handles the message generation process.
 * - GenerateInterceptsInput - The input type for the generateIntercepts function.
 * - GenerateInterceptsOutput - The return type for the generateIntercepts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {HarmBlockThreshold, HarmCategory} from '@google/generative-ai';

const GenerateInterceptsInputSchema = z.object({
  assetName: z.string().describe('The name of the target asset.'),
  assetNiche: z
    .string()
    .optional()
    .describe('The commercial niche of the asset (e.g., Health, Wealth).'),
  threatLevel: z
    .string()
    .describe("The asset's threat level (e.g., Green, Red)."),
  activeNeeds: z
    .array(z.string())
    .optional()
    .describe('A list of the asset\'s active needs or pain points.'),
});
export type GenerateInterceptsInput = z.infer<
  typeof GenerateInterceptsInputSchema
>;

const GenerateInterceptsOutputSchema = z.object({
  draftA: z
    .string()
    .describe('Option Alpha: A casual, low-pressure check-in.'),
  draftB: z
    .string()
    .describe('Option Bravo: A direct invitation or question about their interests.'),
  draftC: z
    .string()
    .describe(
      "Option Charlie: A formal, third-party sales script related to the asset's niche."
    ),
});
export type GenerateInterceptsOutput = z.infer<
  typeof GenerateInterceptsOutputSchema
>;

export async function generateIntercepts(
  input: GenerateInterceptsInput
): Promise<GenerateInterceptsOutput> {
  return generateInterceptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateInterceptsPrompt',
  input: {schema: GenerateInterceptsInputSchema},
  output: {schema: GenerateInterceptsOutputSchema},
  prompt: `You are a ghostwriter for an intelligence operative. Your task is to generate 3 distinct message drafts for a target asset.

  Target Name: {{assetName}}
  Threat Level: {{threatLevel}}
  {{#if assetNiche}}Commercial Niche: {{assetNiche}}{{/if}}
  {{#if activeNeeds}}Active Needs: {{#each activeNeeds}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}

  Based on the provided information, generate the following three drafts:

  - **Option Alpha**: Write a casual, low-pressure check-in. If the threat level is 'Red', make this message extra cautious and disarming. If the threat is 'Green', it can be a bit more friendly.
  - **Option Bravo**: Write a direct invitation or a question related to their interests or active needs. If the threat level is 'Green', be confident and engaging. If the threat is 'Red', this approach is not recommended, so generate a more neutral, information-gathering question instead.
  - **Option Charlie**: Write a formal, third-party style message. If a commercial niche is provided, frame it as a professional outreach related to that niche. The script should start with "Hi {{assetName}}, I saw your interest in {{assetNiche}}...". If no niche is available, create a generic professional networking request.`,
});

const generateInterceptsFlow = ai.defineFlow(
  {
    name: 'generateInterceptsFlow',
    inputSchema: GenerateInterceptsInputSchema,
    outputSchema: GenerateInterceptsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {
      model: 'googleai/gemini-2.5-flash',
      config: {
        temperature: 0.6,
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
