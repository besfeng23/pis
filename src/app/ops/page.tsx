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
  writeBatch,
} from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';


type Intercept = {
  asset_id: string;
  content: string;
  timestamp: any;
};

type MessageToProcess = {
  sender: string;
  content: string;
  timestamp: any;
};


// Helper function to fix character encoding issues in Facebook JSONs
const decodeFacebookString = (str: string | undefined) => {
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
    
    // Correct "Me" to "Joven Del Rosario Ong" and filter out duplicates
    const correctedNames = [...new Set(names.map(name => name === 'Me' ? 'Joven Del Rosario Ong' : name))];

    // Firestore 'in' queries are limited to 30 values.
    const nameChunks = [];
    for (let i = 0; i < correctedNames.length; i += 30) {
      nameChunks.push(correctedNames.slice(i, i + 30));
    }

    // Find existing assets in chunks
    for (const chunk of nameChunks) {
        if(chunk.length > 0) {
          const q = query(assetsCollection, where('name', 'in', chunk));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach(doc => {
              existingAssets.set(doc.data().name, doc.id);
          });
        }
    }
    
    const newAssetNames = correctedNames.filter(name => !existingAssets.has(name));

    // Create new assets if any
    if (newAssetNames.length > 0) {
        const batch = writeBatch(firestore);
        newAssetNames.forEach(name => {
            const newDocRef = doc(collection(firestore, 'assets'));
            batch.set(newDocRef, { name, threat_level: 'Green', estimatedValue: 0 });
            existingAssets.set(name, newDocRef.id);
        });
        await batch.commit();
    }

    // Create a map from original name to ID for the final mapping
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
      if (!firestore) return;
      const totalMessages = messages.length;
      if (totalMessages === 0) {
        setProgress(100);
        setIsProcessing(false);
        return;
      }
      
      const uniqueSenders = [...new Set(messages.map(m => m.sender))];
      const assetMap = await getOrCreateAssets(uniqueSenders);

      let processedCount = 0;
      
      for (const message of messages) {
          const assetId = assetMap.get(message.sender);
          if (assetId && message.content) {
            const interceptRef = collection(firestore, `assets/${assetId}/intercepts`);
            addDocumentNonBlocking(interceptRef, {
                asset_id: assetId,
                content: message.content,
                timestamp: message.timestamp,
            });
          }
          processedCount++;
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
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as { Date: string; Time: string; Name: string; Message: string }[];
          const messages = rows.map(row => ({
            sender: row.Name,
            content: row.Message,
            timestamp: new Date(`${row.Date} ${row.Time}`),
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
        
        let allMessages: {sender_name: string, content?: string, timestamp_ms: number}[] = [];
        for (const file of messageFiles) {
            const content = await file.async('string');
            const chatData = JSON.parse(content);
            if (chatData.messages) {
                allMessages.push(...chatData.messages);
            }
        }
        
        const messagesToProcess = allMessages.map(message => ({
            sender: decodeFacebookString(message.sender_name),
            content: decodeFacebookString(message.content),
            timestamp: new Date(message.timestamp_ms),
        })).filter(m => m.sender && m.content);
  
        await processMessages(messagesToProcess);
      } catch (error) {
        console.error("Error processing zip file:", error);
        setIsProcessing(false);
      }
    } else if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const chatData = JSON.parse(text);
          let messagesToProcess: MessageToProcess[] = [];
          if (chatData.messages) {
            messagesToProcess = chatData.messages.map((message: { sender_name: string, content?: string, timestamp_ms: number }) => ({
                sender: decodeFacebookString(message.sender_name),
                content: decodeFacebookString(message.content),
                timestamp: new Date(message.timestamp_ms),
            })).filter((m: MessageToProcess) => m.sender && m.content);
          }
          await processMessages(messagesToProcess);
        } catch (error) {
          console.error("Error processing JSON file:", error);
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
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
          accept=".csv,.zip,.json"
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
