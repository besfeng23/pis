'use client';

import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';

type Asset = {
  id: string;
  name: string;
  threat_level: 'Green' | 'Red';
  estimatedValue?: number;
};

export default function AssetsPage() {
  const { firestore } = useFirebase();

  const assetsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'assets') : null),
    [firestore]
  );

  const { data: assets, isLoading } = useCollection<Asset>(assetsCollection);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <header className="mb-6">
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">
            ASSETS
          </h1>
          <p className="text-sm text-muted-foreground">
            List of high-value targets and contacts.
          </p>
        </header>
        <div className="text-center">Loading assets...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">
          ASSETS
        </h1>
        <p className="text-sm text-muted-foreground">
          List of high-value targets and contacts.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {assets?.map(asset => (
          <Link href={`/assets/${asset.id}`} key={asset.id}>
            <Card className="flex h-full flex-col justify-between transition-colors hover:bg-white/5">
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-medium leading-tight">
                    {asset.name}
                  </CardTitle>
                  <Badge
                    variant={
                      asset.threat_level === 'Red' ? 'destructive' : 'default'
                    }
                    className={
                      asset.threat_level === 'Green'
                        ? 'border-accent bg-transparent text-accent'
                        : ''
                    }
                  >
                    {asset.threat_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-sm font-semibold text-primary">
                  ${(asset.estimatedValue || 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">{asset.id}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
