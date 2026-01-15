'use server';
/**
 * @fileOverview Summarizes a dossier using GenAI to provide a quick understanding of the key information.
 *
 * - summarizeDossier - A function that handles the dossier summarization process.
 * - SummarizeDossierInput - The input type for the summarizeDossier function.
 * - SummarizeDossierOutput - The return type for the summarizeDossier function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeDossierInputSchema = z.object({
  dossierContent: z
    .string()
    .describe('The content of the dossier to be summarized.'),
});
export type SummarizeDossierInput = z.infer<typeof SummarizeDossierInputSchema>;

const SummarizeDossierOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the dossier content.'),
});
export type SummarizeDossierOutput = z.infer<typeof SummarizeDossierOutputSchema>;

export async function summarizeDossier(input: SummarizeDossierInput): Promise<SummarizeDossierOutput> {
  return summarizeDossierFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeDossierPrompt',
  input: {schema: SummarizeDossierInputSchema},
  output: {schema: SummarizeDossierOutputSchema},
  prompt: `Summarize the following dossier content in a concise and informative manner:\n\n{{{dossierContent}}}`,
});

const summarizeDossierFlow = ai.defineFlow(
  {
    name: 'summarizeDossierFlow',
    inputSchema: SummarizeDossierInputSchema,
    outputSchema: SummarizeDossierOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
