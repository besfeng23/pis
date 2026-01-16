'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { generateIntercepts } from '@/ai/flows/generate-intercepts';
import { generateCounterMeasures } from '@/ai/flows/generate-counter-measures';
import { Copy, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

type Asset = {
  id: string;
  name: string;
  threat_level: 'Green' | 'Red';
  commercial_niche?: 'Health' | 'Wealth' | 'Lifestyle' | 'Relationships';
  psych_profile?: string; // JSON string
  estimatedValue?: number;
};

type Intercept = {
  id: string;
  content: string;
  timestamp: { seconds: number; nanoseconds: number };
  sentiment_score?: number;
};

type PsychProfile = {
  tacticalAssets: string[];
  vulnerabilities: string[];
  riskFactors: string[];
  operationalStatus: string;
};

type InterceptDrafts = {
  draftA: string;
  draftB: string;
  draftC: string;
};

type CounterMeasures = {
  optionAlpha: string;
  optionBravo: string;
  optionCharlie: string;
};

export default function AssetDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isGeneratingIntercepts, setIsGeneratingIntercepts] = useState(false);
  const [generatedIntercepts, setGeneratedIntercepts] = useState<InterceptDrafts | null>(null);

  const [isGeneratingCounterMeasures, setIsGeneratingCounterMeasures] = useState(false);
  const [generatedCounterMeasures, setGeneratedCounterMeasures] = useState<CounterMeasures | null>(null);

  const assetRef = useMemoFirebase(
    () => (firestore && id ? doc(firestore, 'assets', id) : null),
    [firestore, id]
  );
  const { data: asset, isLoading: isAssetLoading } = useDoc<Asset>(assetRef);

  const interceptsRef = useMemoFirebase(
    () => (firestore && id ? collection(firestore, 'assets', id, 'intercepts') : null),
    [firestore, id]
  );

  const interceptsQuery = useMemoFirebase(
    () => (interceptsRef ? query(interceptsRef, orderBy('timestamp', 'asc')) : null),
    [interceptsRef]
  );

  const { data: intercepts, isLoading: areInterceptsLoading } = useCollection<Intercept>(interceptsQuery);

  const psychProfile: PsychProfile | null = asset?.psych_profile ? JSON.parse(asset.psych_profile) : null;

  const handleGenerateIntercept = async () => {
    if (!asset) return;
    setIsGeneratingIntercepts(true);
    setGeneratedIntercepts(null);
    try {
      const result = await generateIntercepts({
        assetName: asset.name,
        assetNiche: asset.commercial_niche,
        threatLevel: asset.threat_level,
        activeNeeds: [], // This was from an old schema, let's pass empty for now
      });
      setGeneratedIntercepts(result);
    } catch (error) {
      console.error('Failed to generate intercepts:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Intercepts',
        description: 'Could not connect to the AI service.',
      });
    }
    setIsGeneratingIntercepts(false);
  };

  const handleGenerateCounterMeasures = async () => {
    if (!asset || !firestore) return;
    setIsGeneratingCounterMeasures(true);
    setGeneratedCounterMeasures(null);
    try {
      // Fetch the entire conversation history, sorted oldest to newest
      const fullHistoryQuery = query(
        collection(firestore, 'assets', id, 'intercepts'),
        orderBy('timestamp', 'asc')
      );
      const snapshot = await getDocs(fullHistoryQuery);
      const fullHistoryMessages = snapshot.docs.map(doc => doc.data().content as string);

      const result = await generateCounterMeasures({
        assetName: asset.name,
        recentMessages: fullHistoryMessages,
      });
      setGeneratedCounterMeasures(result);
    } catch (error) {
      console.error('Failed to generate counter measures:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Counter-Measures',
        description: 'Could not connect to the AI service.',
      });
    }
    setIsGeneratingCounterMeasures(false);
  };


  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to Clipboard',
    });
  };

  const chartData = useMemoFirebase(
    () =>
      intercepts
        ?.filter(i => i.sentiment_score !== undefined && i.timestamp)
        .map(i => ({
          date: format(new Date(i.timestamp.seconds * 1000), 'MMM d'),
          sentiment: i.sentiment_score,
          content: i.content,
        })) || [],
    [intercepts]
  );

  const isLoading = isAssetLoading || areInterceptsLoading;

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
              asset.threat_level === 'Green' ? 'border-accent bg-transparent text-accent' : ''
            }
          >
            {asset.threat_level}
          </Badge>
        </div>
      </header>

      <Tabs defaultValue="psych_deep_dive" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="psych_deep_dive">INTELLIGENCE</TabsTrigger>
          <TabsTrigger value="psych">PSYCH</TabsTrigger>
          <TabsTrigger value="market">MARKET</TabsTrigger>
        </TabsList>

        <TabsContent value="psych_deep_dive">
          <Card>
            <CardHeader>
              <CardTitle>INTELLIGENCE SUMMARY</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-2 font-semibold tracking-widest text-primary">
                  SIGINT: EMOTIONAL VOLATILITY
                </h3>
                {chartData.length > 0 ? (
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis
                          domain={[-1, 1]}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                  <p className="text-sm font-bold text-primary">{label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {payload[0].payload.content}
                                  </p>
                                  <p
                                    className={`text-sm font-semibold ${
                                      payload[0].value > 0 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    Sentiment: {payload[0].value.toFixed(2)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <Line
                          type="monotone"
                          dataKey="sentiment"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 2, fill: 'hsl(var(--primary))' }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No sentiment data available.</p>
                )}
              </div>

              {psychProfile ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">TACTICAL ASSETS</CardTitle>
                      <CardDescription>Strengths / Shared Bonds</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc space-y-1 pl-5">
                        {psychProfile.tacticalAssets.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">VULNERABILITIES</CardTitle>
                      <CardDescription>Friction Points / Weaknesses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc space-y-1 pl-5">
                        {psychProfile.vulnerabilities.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">RISK FACTORS</CardTitle>
                      <CardDescription>Probability of Churn / Ghosting</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc space-y-1 pl-5">
                        {psychProfile.riskFactors.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-base">OPERATIONAL STATUS</CardTitle>
                      <CardDescription>Current Standing</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`font-bold ${
                          psychProfile.operationalStatus === 'Compromised'
                            ? 'text-destructive'
                            : 'text-accent'
                        }`}
                      >
                        {psychProfile.operationalStatus}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Psychological profile not yet generated. Run deep analysis on the OPS page.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="psych">
          <Card>
            <CardHeader>
              <CardTitle>Psychological Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A basic psychological profile is generated from the initial data. For a more
                in-depth analysis, please see the &quot;Intelligence&quot; tab.
              </p>
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
                <p className="text-foreground">{asset.commercial_niche || 'Uncategorized'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-muted-foreground">Estimated Value</h3>
                <p className="text-foreground">
                  ${(asset.estimatedValue || 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur supports-[padding:env(safe-area-inset-bottom)]:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGenerateIntercept}
                disabled={isGeneratingIntercepts}
              >
                {isGeneratingIntercepts ? 'Generating...' : 'TACTICAL INTERCEPT'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tactical Intercept Options for {asset.name}</DialogTitle>
                <DialogDescription>
                  Select the best-fit response and copy the draft to deploy in the field.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {isGeneratingIntercepts && <p>AI is drafting messages...</p>}
                {generatedIntercepts && (
                  <div className="flex flex-col gap-4">
                    <Card className="bg-muted/50">
                      <CardHeader className="flex-row items-center justify-between p-3">
                        <CardTitle className="text-base">Option Alpha</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyToClipboard(generatedIntercepts.draftA)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p>{generatedIntercepts.draftA}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardHeader className="flex-row items-center justify-between p-3">
                        <CardTitle className="text-base">Option Bravo</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyToClipboard(generatedIntercepts.draftB)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p>{generatedIntercepts.draftB}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardHeader className="flex-row items-center justify-between p-3">
                        <CardTitle className="text-base">Option Charlie</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyToClipboard(generatedIntercepts.draftC)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p>{generatedIntercepts.draftC}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
                {!isGeneratingIntercepts && !generatedIntercepts && (
                  <p>Could not generate intercepts.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                className="w-full"
                onClick={handleGenerateCounterMeasures}
                disabled={isGeneratingCounterMeasures}
              >
                <Bot className="mr-2" />
                {isGeneratingCounterMeasures ? 'Analyzing...' : 'COUNTER-MEASURES'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generated Counter-Measures for {asset.name}</DialogTitle>
                <DialogDescription>
                  Based on the entire message history, here are three strategic options.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {isGeneratingCounterMeasures && <p>AI is drafting strategies...</p>}
                {generatedCounterMeasures && (
                  <div className="flex flex-col gap-4">
                    <Card className="border-blue-500/50">
                      <CardHeader className="p-3">
                        <CardTitle className="text-base text-blue-400">OPTION ALPHA (De-Escalate)</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p>{generatedCounterMeasures.optionAlpha}</p>
                      </CardContent>
                    </Card>
                     <Card className="border-green-500/50">
                      <CardHeader className="p-3">
                        <CardTitle className="text-base text-green-400">OPTION BRAVO (Pivot)</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p>{generatedCounterMeasures.optionBravo}</p>
                      </CardContent>
                    </Card>
                     <Card className="border-gray-500/50">
                      <CardHeader className="p-3">
                        <CardTitle className="text-base text-gray-400">OPTION CHARLIE (Ghost Protocol)</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <p>{generatedCounterMeasures.optionCharlie}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
                {!isGeneratingCounterMeasures && !generatedCounterMeasures && (
                  <p>Could not generate counter-measures.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </footer>
    </div>
  );
}
