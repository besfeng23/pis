// src/app/api/execute-sweep/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { generatePsychProfile } from '@/ai/flows/generate-psych-profile';

// Initialize Firebase Admin SDK
// This ensures we're interacting with Firestore with admin privileges on the server.
if (!getApps().length) {
  initializeApp();
}
const firestore = getFirestore();

export async function POST(req: NextRequest) {
  try {
    console.log('Intelligence sweep initiated...');
    const assetsSnapshot = await firestore.collection('assets').get();
    
    if (assetsSnapshot.empty) {
      console.log('No assets found to analyze.');
      return NextResponse.json({ message: 'No assets found.' }, { status: 200 });
    }

    // We don't await this promise array, the function will run in the background
    const analysisPromises = assetsSnapshot.docs.map(async (assetDoc) => {
      const asset = assetDoc.data();
      const assetId = assetDoc.id;

      try {
        const interceptsSnapshot = await firestore.collection(`assets/${assetId}/intercepts`).get();
        const messageHistory = interceptsSnapshot.docs.map(doc => doc.data().content as string);

        if (messageHistory.length > 0) {
          console.log(`Analyzing ${asset.name} (${messageHistory.length} messages)...`);
          const analysisResult = await generatePsychProfile({ messageHistory });

          const assetRef = firestore.collection('assets').doc(assetId);
          await assetRef.update({
            commercial_niche: analysisResult.market.niche,
            threat_level: analysisResult.psych.threat_level,
            psych_profile: JSON.stringify(analysisResult.psych.swot_analysis),
            estimatedValue: analysisResult.market.lead_value,
          });
          console.log(`✔️ Successfully updated ${asset.name}.`);
        } else {
          console.log(`🟡 Skipped ${asset.name}: No message history.`);
        }
      } catch (error) {
        console.error(`❌ FAILED to process ${asset.name}:`, error);
      }
    });

    // Fire-and-forget: we don't wait for all analyses to complete.
    // The client gets an immediate response.
    Promise.all(analysisPromises).then(() => {
        console.log("Intelligence sweep background processing complete.");
    }).catch(err => {
        console.error("A failure occurred during background sweep:", err);
    })

    return NextResponse.json({ message: 'Background analysis initiated.' }, { status: 202 });

  } catch (error) {
    console.error('FATAL ERROR during sweep initiation:', error);
    return NextResponse.json({ error: 'Failed to initiate sweep.' }, { status: 500 });
  }
}

// Set a longer timeout for this specific API route
export const maxDuration = 300; // 5 minutes
