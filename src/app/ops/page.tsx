'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud } from 'lucide-react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import {
  useFirebase,
  addDocumentNonBlocking,
  setDocumentNonBlocking,
} from '@/firebase';
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

type Asset = {
  id?: string;
  name: string;
  threat_level: 'Green' | 'Red';
};

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

  const upsertAsset = async (name: string): Promise<string> => {
    if (!firestore) throw new Error('Firestore not initialized');
    const assetsCollection = collection(firestore, 'assets');
    const q = query(assetsCollection, where('name', '==', name));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    } else {
      const newAsset: Asset = {
        name,
        threat_level: 'Green', // Default threat level
      };
      // We need to get the ID, so we can't use the non-blocking version here for the initial asset creation.
      const docRef = doc(collection(firestore, 'assets'));
      await setDoc(docRef, newAsset);
      return docRef.id;
    }
  };

  const saveIntercept = (intercept: Intercept) => {
    if (!firestore) throw new Error('Firestore not initialized');
    const interceptsCollection = collection(
      firestore,
      `assets/${intercept.asset_id}/intercepts`
    );
    addDocumentNonBlocking(interceptsCollection, {
      ...intercept,
      timestamp: serverTimestamp(), // Use server timestamp for consistency
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setMessageCount(0);
    let processedMessages = 0;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        worker: true,
        step: async (results, parser) => {
          const row = results.data as string[];
          // Skip header or empty rows
          if (row.length < 5 || row[0] === 'Date') return;

          const [timestamp, , sender, , message] = row;
          if (sender && message) {
            try {
              const assetId = await upsertAsset(sender);
              saveIntercept({
                asset_id: assetId,
                content: message,
                timestamp,
              });
              processedMessages++;
            } catch (e) {
              console.error('Error processing row:', e);
              parser.abort();
            }
          }
          // Simple progress, not based on file size
          setProgress(prev => (prev < 95 ? prev + 0.1 : 95));
        },
        complete: () => {
          setProgress(100);
          setMessageCount(processedMessages);
          setIsProcessing(false);
        },
      });
    } else if (file.name.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(file);
      const messageFiles = Object.values(zip.files).filter(f =>
        f.name.endsWith('message_1.json')
      );
      let totalMessages = 0;
      let currentProgress = 0;

      for (const file of messageFiles) {
        const content = await file.async('string');
        const chat = JSON.parse(content);
        totalMessages += chat.messages.length;
      }


      for (const file of messageFiles) {
        const content = await file.async('string');
        const chatData = JSON.parse(content);
        const messages = chatData.messages;

        for (const message of messages) {
          if (message.sender_name && message.content) {
             try {
                const assetId = await upsertAsset(message.sender_name);
                saveIntercept({
                    asset_id: assetId,
                    content: message.content,
                    timestamp: new Date(message.timestamp_ms),
                });
                processedMessages++;
                currentProgress = (processedMessages / totalMessages) * 100;
                setProgress(currentProgress);
             } catch(e) {
                console.error("Error processing message from zip:", e);
             }
          }
        }
      }
      setProgress(100);
      setMessageCount(processedMessages);
      setIsProcessing(false);
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
