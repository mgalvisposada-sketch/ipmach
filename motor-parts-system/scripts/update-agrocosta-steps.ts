/**
 * Script to update AGROCOSTA endpoint steps in the database
 * This bypasses the full seed script and directly updates the steps
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { agrocostaCombinedSteps } from '../prisma/steps';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating AGROCOSTA steps in database...');
  console.log(`📋 Steps count: ${agrocostaCombinedSteps.length}`);
  console.log('');

  try {
    const updated = await (prisma as any).deepWebEndpoint.update({
      where: { originCode: 'AGROCOSTA' },
      data: {
        loginSteps: agrocostaCombinedSteps,
      },
    });

    console.log('✅ AGROCOSTA steps updated successfully!');
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
        step.type === 'fill' && step.selector && step.selector.includes('referencia')
      );
      if (searchSteps.length > 0) {
        console.log('🔍 Search step found:');
        searchSteps.forEach((step: any) => {
          console.log(`   ${step.type} -> ${step.selector} with value: ${step.value}`);
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Error updating AGROCOSTA steps:', error.message);
    if (error.code === 'P2025') {
      console.error('   Record not found. Make sure AGROCOSTA endpoint exists in the database.');
      console.error('   You may need to run the seed script first to create the endpoint.');
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

