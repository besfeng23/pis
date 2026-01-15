// src/ai/flows/generate-asset-description.ts
'use server';

/**
 * @fileOverview Generates a description of an asset based on key attributes using GenAI.
 *
 * - generateAssetDescription - A function that generates the asset description.
 * - GenerateAssetDescriptionInput - The input type for the generateAssetDescription function.
 * - GenerateAssetDescriptionOutput - The return type for the generateAssetDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAssetDescriptionInputSchema = z.object({
  assetName: z.string().describe('The name of the asset.'),
  assetType: z.string().describe('The type of asset (e.g., server, database, application).'),
  criticality: z.string().describe('The criticality of the asset (e.g., high, medium, low).'),
  owner: z.string().describe('The owner of the asset.'),
});

export type GenerateAssetDescriptionInput = z.infer<
  typeof GenerateAssetDescriptionInputSchema
>;

const GenerateAssetDescriptionOutputSchema = z.object({
  description: z.string().describe('A detailed description of the asset.'),
});

export type GenerateAssetDescriptionOutput = z.infer<
  typeof GenerateAssetDescriptionOutputSchema
>;

export async function generateAssetDescription(
  input: GenerateAssetDescriptionInput
): Promise<GenerateAssetDescriptionOutput> {
  return generateAssetDescriptionFlow(input);
}

const generateAssetDescriptionPrompt = ai.definePrompt({
  name: 'generateAssetDescriptionPrompt',
  input: {schema: GenerateAssetDescriptionInputSchema},
  output: {schema: GenerateAssetDescriptionOutputSchema},
  prompt: `You are an AI assistant that generates descriptions for assets based on their key attributes.

  Given the following attributes, generate a detailed and informative description of the asset.

  Asset Name: {{assetName}}
  Asset Type: {{assetType}}
  Criticality: {{criticality}}
  Owner: {{owner}}

  Description:`,
});

const generateAssetDescriptionFlow = ai.defineFlow(
  {
    name: 'generateAssetDescriptionFlow',
    inputSchema: GenerateAssetDescriptionInputSchema,
    outputSchema: GenerateAssetDescriptionOutputSchema,
  },
  async input => {
    const {output} = await generateAssetDescriptionPrompt(input);
    return output!;
  }
);
