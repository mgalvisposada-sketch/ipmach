import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { partequiposCombinedSteps } from '../prisma/steps';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating PARTEQUIPOS steps in database...');
  console.log(`📋 Steps count: ${partequiposCombinedSteps.length}`);
  console.log('');

  try {
    const updated = await (prisma as any).deepWebEndpoint.update({
      where: { originCode: 'PARTEQUIPOS' },
      data: {
        loginSteps: partequiposCombinedSteps,
        loginUsername: 'a.galvis@ciparcol.com',
        loginPassword: 'cip800145360*',
        requiresLogin: true,
        loginUrl: 'https://tienda.partequipos.com/customer/account',
      },
    });

    console.log('✅ PARTEQUIPOS steps updated successfully!');
    console.log(`   Origin Code: ${updated.originCode}`);
    console.log(`   Name: ${updated.name}`);
    console.log(`   Steps Count: ${Array.isArray(updated.loginSteps) ? updated.loginSteps.length : 0}`);
    console.log(`   Login Username: ${updated.loginUsername}`);
    console.log(`   Requires Login: ${updated.requiresLogin}`);
    console.log('');
    
    if (Array.isArray(updated.loginSteps) && updated.loginSteps.length > 0) {
      console.log('📋 First 3 steps:');
      updated.loginSteps.slice(0, 3).forEach((step: any, index: number) => {
        console.log(`   ${index + 1}. ${step.type}${step.url ? ` -> ${step.url}` : ''}${step.selector ? ` (${step.selector})` : ''}`);
      });
      console.log('');
      
      const searchSteps = updated.loginSteps.filter((step: any) => 
        step.type === 'goto' && step.url && step.url.includes('catalogsearch')
      );
      if (searchSteps.length > 0) {
        console.log('🔍 Search step found:');
        searchSteps.forEach((step: any) => {
          console.log(`   ${step.type} -> ${step.url}`);
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Error updating PARTEQUIPOS steps:', error.message);
    if (error.code === 'P2025') {
      console.error('   Record not found. Make sure PARTEQUIPOS endpoint exists in the database.');
      console.error('   You may need to create it first using the seed script or manually.');
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

