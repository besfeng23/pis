'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, Bot, FileText, CheckCircle, XCircle, Loader, Server, Clock } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytesResumable, UploadTaskSnapshot } from 'firebase/storage';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

type FileStatus = 'pending' | 'uploading' | 'complete' | 'error';

type FileQueueItem = {
  id: string;
  file: File;
  status: FileStatus;
  message: string;
  progress: number;
};

type IngestionLog = {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  interceptCount?: number;
  error?: string;
  createdAt: { seconds: number, nanoseconds: number };
};

function IngestionLogs() {
    const { firestore } = useFirebase();
  
    const logsQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'ingestion_logs'), orderBy('createdAt', 'desc'), limit(10)) : null),
      [firestore]
    );
  
    const { data: logs, isLoading } = useCollection<IngestionLog>(logsQuery);
  
    const getStatusIcon = (status: IngestionLog['status']) => {
      switch (status) {
        case 'PENDING':
          return <Clock className="h-5 w-5 text-yellow-500" />;
        case 'PROCESSING':
          return <Loader className="h-5 w-5 animate-spin text-accent" />;
        case 'COMPLETED':
          return <CheckCircle className="h-5 w-5 text-green-500" />;
        case 'ERROR':
          return <XCircle className="h-5 w-5 text-destructive" />;
        default:
          return <Server className="h-5 w-5 text-muted-foreground" />;
      }
    };
  
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Ingestions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading ingestion logs...</p>}
          {!isLoading && (!logs || logs.length === 0) && (
            <p className="text-sm text-muted-foreground">No recent ingestion activity.</p>
          )}
          {logs && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-4 rounded-lg border bg-card/50 p-3">
                  {getStatusIcon(log.status)}
                  <div className="flex-1">
                    <p className="font-medium truncate">{log.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.status === 'COMPLETED' && `${log.interceptCount || 0} intercepts indexed.`}
                      {log.status === 'ERROR' && `Error: ${log.error || 'Unknown error'}`}
                      {log.status !== 'COMPLETED' && log.status !== 'ERROR' && `Status: ${log.status}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={
                      log.status === 'COMPLETED' ? 'default' :
                      log.status === 'ERROR' ? 'destructive' : 'secondary'
                    } className={log.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}>
                      {log.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt.seconds * 1000), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

export default function OpsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useFirebase();
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFileItems: FileQueueItem[] = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      status: 'pending',
      message: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      progress: 0,
    }));
    setFileQueue(prev => [...prev, ...newFileItems]);

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleUploadAll = async () => {
    if (fileQueue.every(f => f.status !== 'pending')) return;
    setIsUploading(true);

    const storage = getStorage();

    const uploadPromises = fileQueue
      .filter(item => item.status === 'pending')
      .map(item => {
        return new Promise<void>((resolve, reject) => {
          const file = item.file;
          const filePath = `raw-intel/${Date.now()}_${file.name}`;
          const fileStorageRef = storageRef(storage, filePath);
          const uploadTask = uploadBytesResumable(
            fileStorageRef,
            file,
            user?.uid ? { customMetadata: { ownerUid: user.uid } } : undefined
          );

          uploadTask.on('state_changed',
            (snapshot: UploadTaskSnapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading', progress, message: `Uploading... ${Math.round(progress)}%` } : f));
            },
            (error) => {
              console.error(`Upload failed for ${file.name}:`, error);
              setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', message: `Upload failed: ${error.code}` } : f));
              reject(error);
            },
            () => {
              setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'complete', progress: 100, message: 'Handed off for processing.' } : f));
              resolve();
            }
          );
        });
      });
      
    try {
        await Promise.all(uploadPromises);
        toast({
            title: 'Uploads Complete',
            description: 'All files have been handed off for background processing.',
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Upload Error',
            description: 'One or more files failed to upload.',
        });
    } finally {
        setIsUploading(false);
    }
  };

  const handleDeepAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/execute-sweep', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to start background analysis.');
      
      toast({
        title: 'Background Protocol Initiated',
        description: 'Deep analysis is running on the server. You may leave this page.',
      });

    } catch (error) {
      console.error("Error triggering deep analysis:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not start the deep analysis process.',
      });
    }

    setIsAnalyzing(false);
  };
  
  const StatusIcon = ({ status }: { status: FileStatus }) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-5 w-5 text-muted-foreground" />;
      case 'uploading':
        return <Loader className="h-5 w-5 animate-spin text-accent" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">OPS</h1>
        <p className="text-sm text-muted-foreground">Data ingestion and system-wide operations.</p>
      </header>

      <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border-2 border-dashed border-border p-8">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.zip,.json"
          multiple
          disabled={isUploading || isAnalyzing}
        />
        <Button onClick={handleUploadClick} size="lg" className="w-full max-w-xs" disabled={isUploading || isAnalyzing}>
          <UploadCloud className="mr-2 h-6 w-6" />
          SELECT INTEL
        </Button>
        <p className="text-xs text-muted-foreground">Supports multiple .csv, .json, and .zip files.</p>
      </div>

      {fileQueue.length > 0 && (
        <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Ingestion Queue</h2>
            <div className="space-y-3">
                {fileQueue.map(item => (
                    <div key={item.id} className="flex items-center gap-4 rounded-lg border bg-card p-3">
                        <StatusIcon status={item.status} />
                        <div className="flex-1">
                            <p className="font-medium truncate">{item.file.name}</p>
                            <p className="text-xs text-muted-foreground">{item.message}</p>
                            {item.status === 'uploading' && (
                                <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-1 bg-accent" style={{ width: `${item.progress}%` }} />
                                </div>
                            )}
                        </div>
                         <Badge variant={
                             item.status === 'complete' ? 'default' :
                             item.status === 'error' ? 'destructive' : 'secondary'
                         } className={item.status === 'complete' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}>
                             {item.status.toUpperCase()}
                         </Badge>
                    </div>
                ))}
            </div>
            <Button onClick={handleUploadAll} size="lg" className="mt-6 w-full" disabled={isUploading || isAnalyzing || fileQueue.every(f => f.status !== 'pending')}>
                {isUploading ? 'UPLOADING...' : `UPLOAD ${fileQueue.filter(f => f.status === 'pending').length} FILES`}
            </Button>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center justify-center space-y-6 rounded-lg border-2 border-dashed border-border p-8">
        <Button
          onClick={handleDeepAnalysis}
          size="lg"
          variant="outline"
          className="w-full max-w-xs"
          disabled={isUploading || isAnalyzing}
        >
          <Bot className="mr-2 h-6 w-6" />
          {isAnalyzing ? 'Initiating...' : 'RUN DEEP ANALYSIS'}
        </Button>
      </div>
      
      <IngestionLogs />
    </div>
  );
}
