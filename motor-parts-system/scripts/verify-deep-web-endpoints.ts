import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const endpoints = await prisma.deepWebEndpoint.findMany({
        where: {
            isActive: true,
        },
    });

    console.log(`\n📋 Found ${endpoints.length} active DeepWebEndpoint(s):\n`);
    
    endpoints.forEach((endpoint) => {
        console.log(`  • ${endpoint.name} (${endpoint.originCode})`);
        console.log(`    URL: ${endpoint.url}`);
        console.log(`    Method: ${endpoint.method}`);
        console.log(`    Requires Login: ${endpoint.requiresLogin ? 'Yes' : 'No'}`);
        if (endpoint.requiresLogin) {
            console.log(`    Login URL: ${endpoint.loginUrl}`);
            console.log(`    Username: ${endpoint.loginUsername}`);
        }
        console.log('');
    });
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

