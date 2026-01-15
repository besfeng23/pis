import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Asset = {
  id: string;
  name: string;
  threatLevel: 'High' | 'Low';
  estimatedValue: number;
};

const assets: Asset[] = [
  { id: 'TGT-001', name: 'John "Viper" Doe', threatLevel: 'High', estimatedValue: 500000 },
  { id: 'TGT-002', name: 'Jane "Ghost" Smith', threatLevel: 'Low', estimatedValue: 150000 },
  { id: 'TGT-003', name: 'Alex "Spectre" Johnson', threatLevel: 'High', estimatedValue: 750000 },
  { id: 'TGT-004', name: 'Emily "Rogue" Williams', threatLevel: 'Low', estimatedValue: 200000 },
  { id: 'TGT-005', name: 'Michael "Shadow" Brown', threatLevel: 'High', estimatedValue: 950000 },
];

export default function AssetsPage() {
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
        {assets.map(asset => (
          <Card
            key={asset.id}
            className="flex flex-col justify-between transition-colors hover:bg-white/5"
          >
            <CardHeader className="p-4">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-medium leading-tight">
                  {asset.name}
                </CardTitle>
                <Badge
                  variant={asset.threatLevel === 'High' ? 'destructive' : 'default'}
                  className={
                    asset.threatLevel === 'Low'
                      ? 'border-accent bg-transparent text-accent'
                      : ''
                  }
                >
                  {asset.threatLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-sm font-semibold text-primary">
                ${asset.estimatedValue.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">{asset.id}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
