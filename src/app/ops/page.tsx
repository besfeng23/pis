'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud } from 'lucide-react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import {
  useFirebase,
} from '@/firebase';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

type Intercept = {
  asset_id: string;
  content: string;
  timestamp: any;
};

export default function OpsPage() {
  const { firestore } = useFirebase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const getOrCreateAssets = async (names: string[]): Promise<Map<string, string>> => {
    if (!firestore) throw new Error('Firestore not initialized');
    const assetsCollection = collection(firestore, 'assets');
    const existingAssets = new Map<string, string>();
    const newAssetNames = new Set<string>();

    const nameChunks = [];
    for (let i = 0; i < names.length; i += 30) {
      nameChunks.push(names.slice(i, i + 30));
    }

    for (const chunk of nameChunks) {
        const q = query(assetsCollection, where('name', 'in', chunk));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(doc => {
            existingAssets.set(doc.data().name, doc.id);
        });
    }

    names.forEach(name => {
      if (!existingAssets.has(name)) {
        newAssetNames.add(name);
      }
    });
    
    if (newAssetNames.size > 0) {
        const batch = writeBatch(firestore);
        newAssetNames.forEach(name => {
            const newDocRef = doc(collection(firestore, 'assets'));
            batch.set(newDocRef, { name, threat_level: 'Green', estimatedValue: 0 });
            existingAssets.set(name, newDocRef.id);
        });
        await batch.commit();
    }

    return existingAssets;
};

  const saveInterceptsBatch = async (intercepts: Intercept[]) => {
      if (!firestore || intercepts.length === 0) return;
      const batch = writeBatch(firestore);
      intercepts.forEach(intercept => {
          const interceptRef = doc(collection(firestore, `assets/${intercept.asset_id}/intercepts`));
          batch.set(interceptRef, { ...intercept, timestamp: serverTimestamp() });
      });
      await batch.commit();
  };

  const processMessages = async (messages: {sender: string, content: string, timestamp: any}[]) => {
      const totalMessages = messages.length;
      if (totalMessages === 0) {
        setProgress(100);
        setIsProcessing(false);
        return;
      }
      
      const uniqueSenders = [...new Set(messages.map(m => m.sender))];
      const assetMap = await getOrCreateAssets(uniqueSenders);

      const interceptsToSave: Intercept[] = [];

      for (const message of messages) {
          const assetId = assetMap.get(message.sender);
          if (assetId && message.content) {
              interceptsToSave.push({
                  asset_id: assetId,
                  content: message.content,
                  timestamp: message.timestamp,
              });
          }
      }

      let processedCount = 0;
      const batchSize = 500;
      for (let i = 0; i < interceptsToSave.length; i += batchSize) {
          const batch = interceptsToSave.slice(i, i + batchSize);
          await saveInterceptsBatch(batch);
          processedCount += batch.length;
          setProgress((processedCount / totalMessages) * 100);
      }

      setMessageCount(processedCount);
      setIsProcessing(false);
      setProgress(100);
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setMessageCount(0);
    
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        worker: true,
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as string[][];
          // Skip header row
          const messages = rows.slice(1).map(row => ({
            sender: row[2], // 'Name' column
            content: row[3], // 'Message' column
            timestamp: row[0], // 'Date' column
          })).filter(m => m.sender && m.content);
          await processMessages(messages);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          setIsProcessing(false);
        }
      });
    } else if (file.name.endsWith('.zip')) {
      try {
        const zip = await JSZip.loadAsync(file);
        const messageFiles = Object.values(zip.files).filter(f =>
          f.name.endsWith('message_1.json') && !f.dir
        );
        
        let allMessages: {sender_name: string, content: string, timestamp_ms: number}[] = [];
        for (const file of messageFiles) {
            const content = await file.async('string');
            const chatData = JSON.parse(content);
            if (chatData.messages) {
                allMessages.push(...chatData.messages);
            }
        }
        
        const messagesToProcess = allMessages.map(message => ({
            sender: message.sender_name,
            content: message.content,
            timestamp: new Date(message.timestamp_ms),
        })).filter(m => m.sender && m.content);
  
        await processMessages(messagesToProcess);
      } catch (error) {
        console.error("Error processing zip file:", error);
        setIsProcessing(false);
      }
    } else {
      console.error('Unsupported file type');
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">
          OPS
        </h1>
        <p className="text-sm text-muted-foreground">
          Settings and data upload.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center space-y-6 rounded-lg border-2 border-dashed border-border p-8">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.zip"
          disabled={isProcessing}
        />
        <Button
          onClick={handleUploadClick}
          size="lg"
          className="w-full max-w-xs"
          disabled={isProcessing}
        >
          <UploadCloud className="mr-2 h-6 w-6" />
          Upload Intel
        </Button>

        {isProcessing && (
          <div className="w-full max-w-xs text-center">
            <p className="mb-2 text-sm text-accent">HACKING THE MAINFRAME...</p>
            <Progress value={progress} className="h-2 [&>div]:bg-accent" />
          </div>
        )}

        {messageCount > 0 && !isProcessing && (
          <div className="text-center text-lg text-primary">
            Intel Acquired: {messageCount} Messages
          </div>
        )}
      </div>
    </div>
  );
}
