/**
 * Script to update RETROTRAC steps in the database
 * Usage: tsx scripts/update-retrotrac-steps.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { retrotracCombinedSteps } from '../prisma/steps';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating RETROTRAC steps in database...');
  console.log(`📋 Steps count: ${retrotracCombinedSteps.length}`);
  console.log('');

  try {
    const updated = await (prisma as any).deepWebEndpoint.update({
      where: { originCode: 'RETROTRAC' },
      data: {
        loginSteps: retrotracCombinedSteps,
      },
    });

    console.log('✅ RETROTRAC steps updated successfully!');
    console.log(`   Origin Code: ${updated.originCode}`);
    console.log(`   Name: ${updated.name}`);
    console.log(`   Steps Count: ${Array.isArray(updated.loginSteps) ? updated.loginSteps.length : 0}`);
    console.log('');
    
    // Show first few steps for verification
    if (Array.isArray(updated.loginSteps) && updated.loginSteps.length > 0) {
      console.log('📋 First 3 steps:');
      updated.loginSteps.slice(0, 3).forEach((step: any, index: number) => {
        console.log(`   ${index + 1}. ${step.type}${step.url ? ` -> ${step.url}` : ''}${step.selector ? ` (${step.selector})` : ''}`);
      });
      console.log('');
      
      // Show search steps specifically
      const searchSteps = updated.loginSteps.filter((step: any) => 
        step.type === 'goto' && step.url && step.url.includes('categories-search')
      );
      if (searchSteps.length > 0) {
        console.log('🔍 Search step found:');
        searchSteps.forEach((step: any) => {
          console.log(`   ${step.type} -> ${step.url}`);
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Error updating RETROTRAC steps:', error.message);
    if (error.code === 'P2025') {
      console.error('   Record not found. Make sure RETROTRAC endpoint exists in the database.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });

