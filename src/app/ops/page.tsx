'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, Bot, FileText, CheckCircle, XCircle, Loader } from 'lucide-react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { useFirebase } from '@/firebase';
import { collection, doc, writeBatch, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { analyzeSentiment } from '@/ai/flows/analyze-sentiment';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';


type MessageToProcess = {
  sender: string;
  content: string;
  timestamp: Date;
};

type FileStatus = 'pending' | 'processing' | 'complete' | 'error';

type FileQueueItem = {
  id: string;
  file: File;
  status: FileStatus;
  message: string;
};

// Helper function to fix character encoding issues in Facebook JSONs
const decodeFacebookString = (str: string | undefined): string => {
  if (!str) return '';
  try {
    // This sequence helps correctly decode mojibake from Facebook's JSON files
    return decodeURIComponent(escape(str));
  } catch (e) {
    // If it fails, return the original string
    return str;
  }
};

export default function OpsPage() {
  const { firestore } = useFirebase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const getOrCreateAssets = async (names: string[]): Promise<Map<string, string>> => {
    if (!firestore) throw new Error('Firestore not initialized');
    const assetsCollection = collection(firestore, 'assets');
    const existingAssets = new Map<string, string>();

    const correctedNames = [...new Set(names.map(name => (name === 'Me' ? 'Joven Del Rosario Ong' : name)))];

    const nameChunks = [];
    for (let i = 0; i < correctedNames.length; i += 30) {
      nameChunks.push(correctedNames.slice(i, i + 30));
    }

    for (const chunk of nameChunks) {
      if (chunk.length > 0) {
        const q = query(assetsCollection, where('name', 'in', chunk));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
          existingAssets.set(doc.data().name, doc.id);
        });
      }
    }

    const newAssetNames = correctedNames.filter(name => !existingAssets.has(name));

    if (newAssetNames.length > 0) {
      const batch = writeBatch(firestore);
      newAssetNames.forEach(name => {
        const newDocRef = doc(collection(firestore, 'assets'));
        batch.set(newDocRef, { name, threat_level: 'Green', estimatedValue: 0 });
        existingAssets.set(name, newDocRef.id);
      });
      await batch.commit();
    }

    const finalMap = new Map<string, string>();
    names.forEach(originalName => {
      const correctedName = originalName === 'Me' ? 'Joven Del Rosario Ong' : originalName;
      const assetId = existingAssets.get(correctedName);
      if (assetId) {
        finalMap.set(originalName, assetId);
      }
    });

    return finalMap;
  };

  const processMessages = async (messages: MessageToProcess[]) => {
    if (!firestore || messages.length === 0) return 0;
    
    const uniqueSenders = [...new Set(messages.map(m => m.sender))];
    const assetMap = await getOrCreateAssets(uniqueSenders);

    const sentimentPromises = messages.map(async message => {
       const assetId = assetMap.get(message.sender);
       if (assetId && message.content) {
         const sentimentResponse = await analyzeSentiment({ message: message.content });
         const interceptRef = collection(firestore, `assets/${assetId}/intercepts`);
         addDocumentNonBlocking(interceptRef, {
           asset_id: assetId,
           content: message.content,
           timestamp: Timestamp.fromDate(message.timestamp),
           sentiment_score: sentimentResponse.sentimentScore,
         });
       }
    });

    await Promise.all(sentimentPromises);
    return messages.length;
  };

  const parseFile = (file: File): Promise<MessageToProcess[]> => {
    return new Promise((resolve, reject) => {
      if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: results => {
            const rows = results.data as { Date: string; Time: string; Name: string; Message: string }[];
            const messages = rows
              .map(row => ({
                sender: row.Name,
                content: row.Message,
                timestamp: new Date(`${row.Date} ${row.Time}`),
              }))
              .filter(m => m.sender && m.content);
            resolve(messages);
          },
          error: error => reject(new Error(`CSV Parse Error: ${error.message}`)),
        });
      } else if (file.name.endsWith('.zip')) {
        JSZip.loadAsync(file).then(async zip => {
          const messageFiles = Object.values(zip.files).filter(f => f.name.endsWith('message_1.json') && !f.dir);
          let allMessages: { sender_name: string; content?: string; timestamp_ms: number }[] = [];
          for (const file of messageFiles) {
            const content = await file.async('string');
            const chatData = JSON.parse(content);
            if (chatData.messages) {
              allMessages.push(...chatData.messages);
            }
          }
          const messagesToProcess = allMessages
            .map(message => ({
              sender: decodeFacebookString(message.sender_name),
              content: decodeFacebookString(message.content),
              timestamp: new Date(message.timestamp_ms),
            }))
            .filter(m => m.sender && m.content);
          resolve(messagesToProcess);
        }).catch(err => reject(new Error(`ZIP Error: ${err.message}`)));
      } else if (file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const text = e.target?.result as string;
            const chatData = JSON.parse(text);
            let messagesToProcess: MessageToProcess[] = [];
            if (chatData.messages) {
              messagesToProcess = chatData.messages
                .map((message: { sender_name: string; content?: string; timestamp_ms: number }) => ({
                  sender: decodeFacebookString(message.sender_name),
                  content: decodeFacebookString(message.content),
                  timestamp: new Date(message.timestamp_ms),
                }))
                .filter((m: MessageToProcess) => m.sender && m.content);
            }
            resolve(messagesToProcess);
          } catch (error: any) {
            reject(new Error(`JSON Parse Error: ${error.message}`));
          }
        };
        reader.onerror = () => reject(new Error('File could not be read.'));
        reader.readAsText(file);
      } else {
        reject(new Error('Unsupported file type'));
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFileItems: FileQueueItem[] = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}`,
      file,
      status: 'pending',
      message: `${(file.size / 1024).toFixed(2)} KB`,
    }));
    setFileQueue(prev => [...prev, ...newFileItems]);
    // Reset the input value to allow selecting the same file again
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleProcessAll = async () => {
    if (fileQueue.every(f => f.status !== 'pending')) return;
    setIsProcessing(true);

    const processingPromises = fileQueue
      .filter(item => item.status === 'pending')
      .map(async item => {
        // Update status to processing
        setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing', message: 'Parsing...' } : f));
        
        try {
          const messages = await parseFile(item.file);
          setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, message: `Processing ${messages.length} messages...` } : f));
          
          const processedCount = await processMessages(messages);
          setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'complete', message: `Ingested ${processedCount} intercepts.` } : f));
        } catch (error: any) {
          console.error(`Failed to process ${item.file.name}:`, error);
          setFileQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', message: error.message } : f));
        }
      });
      
    await Promise.all(processingPromises);
    setIsProcessing(false);
  };

  const handleDeepAnalysis = async () => {
    if (!firestore) return;
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/execute-sweep', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to start background analysis.');
      }
      
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
      case 'processing':
        return <Loader className="h-5 w-5 animate-spin text-accent" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">OPS</h1>
        <p className="text-sm text-muted-foreground">Settings and data upload.</p>
      </header>

      <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border-2 border-dashed border-border p-8">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.zip,.json"
          multiple // Allow multiple files
          disabled={isProcessing || isAnalyzing}
        />
        <Button onClick={handleUploadClick} size="lg" className="w-full max-w-xs" disabled={isProcessing || isAnalyzing}>
          <UploadCloud className="mr-2 h-6 w-6" />
          SELECT INTEL
        </Button>
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
            <Button onClick={handleProcessAll} size="lg" className="mt-6 w-full" disabled={isProcessing || isAnalyzing || fileQueue.every(f => f.status !== 'pending')}>
                {isProcessing ? 'INGESTING INTEL...' : `INGEST ${fileQueue.filter(f => f.status === 'pending').length} FILES`}
            </Button>
        </div>
      )}


      <div className="mt-8 flex flex-col items-center justify-center space-y-6 rounded-lg border-2 border-dashed border-border p-8">
        <Button
          onClick={handleDeepAnalysis}
          size="lg"
          variant="outline"
          className="w-full max-w-xs"
          disabled={isProcessing || isAnalyzing}
        >
          <Bot className="mr-2 h-6 w-6" />
          {isAnalyzing ? 'Initiating...' : 'RUN DEEP ANALYSIS'}
        </Button>
      </div>
    </div>
  );
}
