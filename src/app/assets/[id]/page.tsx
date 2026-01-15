'use client';

import { useParams } from 'next/navigation';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { summarizeDossier } from '@/ai/flows/summarize-dossier';

type Asset = {
  id: string;
  name: string;
  threat_level: 'Green' | 'Red';
  commercial_niche?: 'Health' | 'Wealth' | 'Lifestyle' | 'Relationships';
  psych_profile?: string; // JSON string
  estimatedValue?: number;
};

type PsychProfile = {
  emotional_baseline: string;
  weaknesses: string[];
  active_needs: string[];
};

export default function AssetDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { firestore } = useFirebase();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIntercepts, setGeneratedIntercepts] = useState<string[]>([]);

  const assetRef = useMemoFirebase(
    () => (firestore && id ? doc(firestore, 'assets', id) : null),
    [firestore, id]
  );

  const { data: asset, isLoading } = useDoc<Asset>(assetRef);

  const psychProfile: PsychProfile | null = asset?.psych_profile
    ? JSON.parse(asset.psych_profile)
    : null;

  const handleGenerateIntercept = async () => {
    if (!asset || !psychProfile) return;
    setIsGenerating(true);
    setGeneratedIntercepts([]);
    try {
      const needs = psychProfile.active_needs.join(', ');
      const dossierContent = `Generate 3 distinct, short, and compelling messages to send to ${asset.name}. The messages should subtly target their active needs which are: ${needs}. The goal is to initiate a conversation. Frame them as if you are a helpful acquaintance.`;
      const result = await summarizeDossier({ dossierContent });
      // The AI will likely return a numbered or bulleted list in a single string.
      const intercepts = result.summary
        .split(/\n\d\.\s|\n-\s|\n\*\s/)
        .map(s => s.trim())
        .filter(Boolean);
      setGeneratedIntercepts(intercepts);
    } catch (error) {
      console.error('Failed to generate intercepts:', error);
    }
    setIsGenerating(false);
  };

  if (isLoading) {
    return <div className="p-4 md:p-6 text-center">Loading dossier...</div>;
  }

  if (!asset) {
    return <div className="p-4 md:p-6 text-center">Asset not found.</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6 flex items-center gap-4">
        <Image
          src={`https://picsum.photos/seed/${asset.id}/100/100`}
          alt="Asset Photo"
          width={80}
          height={80}
          className="rounded-full border-4 border-card"
          data-ai-hint="person face"
        />
        <div>
          <h1 className="font-headline text-3xl font-semibold tracking-tight text-primary">
            {asset.name}
          </h1>
          <Badge
            variant={asset.threat_level === 'Red' ? 'destructive' : 'default'}
            className={
              asset.threat_level === 'Green'
                ? 'border-accent bg-transparent text-accent'
                : ''
            }
          >
            {asset.threat_level}
          </Badge>
        </div>
      </header>

      <Tabs defaultValue="psych" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="psych">PSYCH</TabsTrigger>
          <TabsTrigger value="market">MARKET</TabsTrigger>
        </TabsList>
        <TabsContent value="psych">
          <Card>
            <CardHeader>
              <CardTitle>Psychological Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-muted-foreground">
                  Emotional Baseline
                </h3>
                <p className="text-foreground">
                  {psychProfile?.emotional_baseline || 'Not available.'}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-muted-foreground">
                  Weaknesses
                </h3>
                {psychProfile?.weaknesses &&
                psychProfile.weaknesses.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {psychProfile.weaknesses.map((weakness, i) => (
                      <li key={i}>{weakness}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No weaknesses identified.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="market">
          <Card>
            <CardHeader>
              <CardTitle>Market Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-muted-foreground">Niche</h3>
                <p className="text-foreground">
                  {asset.commercial_niche || 'Uncategorized'}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-muted-foreground">
                  Estimated Value
                </h3>
                <p className="text-foreground">
                  ${(asset.estimatedValue || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-muted-foreground">
                  Active Needs
                </h3>
                {psychProfile?.active_needs &&
                psychProfile.active_needs.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {psychProfile.active_needs.map((need, i) => (
                      <li key={i}>{need}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No active needs identified.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="fixed bottom-20 left-0 right-0 z-40 border-t border-border bg-background p-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              className="w-full"
              onClick={handleGenerateIntercept}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'GENERATE INTERCEPT'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generated Intercepts for {asset.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {generatedIntercepts.length > 0 ? (
                generatedIntercepts.map((intercept, i) => (
                  <Card key={i} className="bg-muted/50">
                    <CardContent className="p-4">
                      <p>{intercept}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p>
                  {isGenerating
                    ? 'AI is drafting messages...'
                    : 'Could not generate intercepts.'}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </footer>
    </div>
  );
}
