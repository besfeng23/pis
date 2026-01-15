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
  status: 'Online' | 'Offline';
};

const assets: Asset[] = [
  { id: 'AS-001', name: 'Mainframe-Alpha', status: 'Online' },
  { id: 'AS-002', name: 'Database-Sigma', status: 'Online' },
  { id: 'AS-003', name: 'Firewall-Omega', status: 'Offline' },
  { id: 'AS-004', name: 'API-Gateway-Zeta', status: 'Online' },
  { id: 'AS-005', name: 'Orion-CI/CD', status: 'Online' },
  { id: 'AS-006', name: 'Cerberus-Auth', status: 'Offline' },
  { id: 'AS-007', name: 'Data-Lake-Hydra', status: 'Online' },
  { id: 'AS-008', name: 'K8s-Cluster-Titan', status: 'Online' },
  { id: 'AS-009', name: 'LoadBalancer-Gamma', status: 'Offline' },
  { id: 'AS-010', name: 'Cache-Redis-Epsilon', status: 'Online' },
];

export default function HomePage() {
  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">
          Asset Dossiers
        </h1>
        <p className="text-sm text-muted-foreground">
          Live status of critical system assets.
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
                  variant={asset.status === 'Offline' ? 'destructive' : 'outline'}
                  className={
                    asset.status === 'Online'
                      ? 'border-accent bg-transparent text-accent'
                      : ''
                  }
                >
                  {asset.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs text-muted-foreground">{asset.id}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
