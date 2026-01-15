'use server';
/**
 * @fileOverview Analyzes the sentiment of a given text message.
 *
 * - analyzeSentiment - A function that performs sentiment analysis.
 * - AnalyzeSentimentInput - The input type for the analyzeSentiment function.
 * - AnalyzeSentimentOutput - The return type for the analyzeSentiment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {HarmCategory, HarmBlockThreshold} from '@google/generative-ai';

const AnalyzeSentimentInputSchema = z.object({
  message: z.string().describe('The text message to analyze.'),
});
export type AnalyzeSentimentInput = z.infer<
  typeof AnalyzeSentimentInputSchema
>;

const AnalyzeSentimentOutputSchema = z.object({
  sentimentScore: z
    .number()
    .min(-1)
    .max(1)
    .describe(
      'A numerical score from -1.0 (very negative) to 1.0 (very positive), with 0 being neutral.'
    ),
});
export type AnalyzeSentimentOutput = z.infer<
  typeof AnalyzeSentimentOutputSchema
>;

export async function analyzeSentiment(
  input: AnalyzeSentimentInput
): Promise<AnalyzeSentimentOutput> {
  return analyzeSentimentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSentimentPrompt',
  input: {schema: AnalyzeSentimentInputSchema},
  output: {schema: AnalyzeSentimentOutputSchema},
  prompt: `Analyze the sentiment of the following message and provide a score from -1.0 to 1.0.

Message: "{{{message}}}"

Return only the JSON object with the sentimentScore.`,
});

const analyzeSentimentFlow = ai.defineFlow(
  {
    name: 'analyzeSentimentFlow',
    inputSchema: AnalyzeSentimentInputSchema,
    outputSchema: AnalyzeSentimentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {
      model: 'googleai/gemini-2.5-flash',
      config: {
        temperature: 0.2,
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
