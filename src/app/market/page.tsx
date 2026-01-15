'use client';

import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Bot } from 'lucide-react';

type Asset = {
  id: string;
  name: string;
  threat_level: 'Green' | 'Red';
  commercial_niche?: 'Health' | 'Wealth' | 'Lifestyle' | 'Relationships';
};

const columns: {
  title: Asset['commercial_niche'] | 'Uncategorized';
  className: string;
}[] = [
  { title: 'Health', className: 'border-blue-500/50' },
  { title: 'Wealth', className: 'border-green-500/50' },
  { title: 'Lifestyle', className: 'border-yellow-500/50' },
  { title: 'Relationships', className: 'border-purple-500/50' },
  { title: 'Uncategorized', className: 'border-gray-500/50' },
];

export default function MarketPage() {
  const { firestore } = useFirebase();

  const assetsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'assets') : null),
    [firestore]
  );

  const { data: assets, isLoading } = useCollection<Asset>(assetsCollection);

  const getAssetsForColumn = (
    columnTitle: Asset['commercial_niche'] | 'Uncategorized'
  ) => {
    if (!assets) return [];
    if (columnTitle === 'Uncategorized') {
      return assets.filter(
        asset =>
          !asset.commercial_niche ||
          !columns.some(c => c.title === asset.commercial_niche)
      );
    }
    return assets.filter(asset => asset.commercial_niche === columnTitle);
  };

  return (
    <div className="flex h-screen flex-col p-4 md:p-6">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">
          MARKET
        </h1>
        <p className="text-sm text-muted-foreground">
          Kanban board for market operations.
        </p>
      </header>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Loading market assets...</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {columns.map(column => (
            <div
              key={column.title}
              className={`flex flex-col rounded-lg border-2 border-dashed ${column.className} bg-card/20`}
            >
              <h2 className="p-3 text-sm font-semibold tracking-widest text-primary">
                {column.title?.toUpperCase()}
              </h2>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {getAssetsForColumn(column.title).map(asset => (
                  <Card
                    key={asset.id}
                    className="flex flex-col justify-between transition-colors hover:bg-white/5"
                  >
                    <CardHeader className="p-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm font-medium leading-tight">
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
                    <CardContent className="p-3 pt-0">
                      <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                        <Bot className="mr-2 h-4 w-4" />
                        Generate Intercept
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
