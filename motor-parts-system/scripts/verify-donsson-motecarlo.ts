import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Verifying DONSSON and MONTECARLO endpoints...\n');

    // Check DONSSON
    const donsson = await (prisma as any).deepWebEndpoint.findUnique({
        where: { originCode: 'DONSSON' },
    });

    if (donsson) {
        console.log('✅ DONSSON found:');
        console.log(`   - ID: ${donsson.id}`);
        console.log(`   - Name: ${donsson.name}`);
        console.log(`   - URL: ${donsson.url}`);
        console.log(`   - Active: ${donsson.isActive}`);
        console.log(`   - Requires Login: ${donsson.requiresLogin}`);
        console.log(`   - Login Username: ${donsson.loginUsername}`);
        console.log(`   - Has Login Steps: ${donsson.loginSteps ? 'Yes (' + (Array.isArray(donsson.loginSteps) ? donsson.loginSteps.length : 'N/A') + ' steps)' : 'No'}`);
        console.log('');
    } else {
        console.log('❌ DONSSON NOT FOUND in database\n');
    }

    // Check MONTECARLO
    const montecarlo = await (prisma as any).deepWebEndpoint.findUnique({
        where: { originCode: 'MONTECARLO' },
    });

    if (montecarlo) {
        console.log('✅ MONTECARLO found:');
        console.log(`   - ID: ${montecarlo.id}`);
        console.log(`   - Name: ${montecarlo.name}`);
        console.log(`   - URL: ${montecarlo.url}`);
        console.log(`   - Active: ${montecarlo.isActive}`);
        console.log(`   - Requires Login: ${montecarlo.requiresLogin}`);
        console.log(`   - Login Username: ${montecarlo.loginUsername}`);
        console.log(`   - Has Login Steps: ${montecarlo.loginSteps ? 'Yes (' + (Array.isArray(montecarlo.loginSteps) ? montecarlo.loginSteps.length : 'N/A') + ' steps)' : 'No'}`);
        console.log('');
    } else {
        console.log('❌ MONTECARLO NOT FOUND in database\n');
    }

    // List all active endpoints
    const allActive = await (prisma as any).deepWebEndpoint.findMany({
        where: { isActive: true },
        select: {
            originCode: true,
            name: true,
        },
        orderBy: {
            originCode: 'asc',
        },
    });

    console.log(`\n📋 Total active endpoints: ${allActive.length}`);
    allActive.forEach((ep: any) => {
        console.log(`   - ${ep.name} (${ep.originCode})`);
    });
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

