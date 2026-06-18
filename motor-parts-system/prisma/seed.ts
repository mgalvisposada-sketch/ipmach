import { PrismaClient, UserType, QuoteStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seeding...');

    // Create sample users (only if they don't exist)
    const hashedPassword = await bcrypt.hash('password123', 12);

    const users = await Promise.all([
        // Admin users
        prisma.users.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                email: 'admin@ciparcol.com',
                passwordHash: hashedPassword,
                phoneNumber: '+57 300 123 4567',
                role: UserRole.admin,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'maria.gonzalez' },
            update: {},
            create: {
                username: 'maria.gonzalez',
                email: 'maria.gonzalez@ciparcol.com',
                passwordHash: hashedPassword,
                phoneNumber: '+57 300 234 5678',
                role: UserRole.admin,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'carlos.rodriguez' },
            update: {},
            create: {
                username: 'carlos.rodriguez',
                email: 'carlos.rodriguez@ciparcol.com',
                passwordHash: hashedPassword,
                phoneNumber: '+57 300 345 6789',
                role: UserRole.admin,
                isActive: true,
            },
        }),

        // Agent users
        prisma.users.upsert({
            where: { username: 'agent1' },
            update: {},
            create: {
                username: 'agent1',
                email: 'agent1@ciparcol.com',
                passwordHash: hashedPassword,
                phoneNumber: '+57 300 456 7890',
                role: UserRole.agent,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'ana.martinez' },
            update: {},
            create: {
                username: 'ana.martinez',
                email: 'ana.martinez@ciparcol.com',
                passwordHash: hashedPassword,
                phoneNumber: '+57 300 567 8901',
                role: UserRole.agent,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'jose.lopez' },
            update: {},
            create: {
                username: 'jose.lopez',
                email: 'jose.lopez@ciparcol.com',
                passwordHash: hashedPassword,
                phoneNumber: '+57 300 678 9012',
                role: UserRole.agent,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'lucia.fernandez' },
            update: {},
            create: {
                username: 'lucia.fernandez',
                email: 'lucia.fernandez@ciparcol.com',
                passwordHash: hashedPassword,
                role: UserRole.agent,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'diego.silva' },
            update: {},
            create: {
                username: 'diego.silva',
                email: 'diego.silva@ciparcol.com',
                passwordHash: hashedPassword,
                role: UserRole.agent,
                isActive: true,
            },
        }),

        // Client users
        prisma.users.upsert({
            where: { username: 'client1' },
            update: {},
            create: {
                username: 'client1',
                email: 'client1@company.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'tallermecanico.central' },
            update: {},
            create: {
                username: 'tallermecanico.central',
                email: 'contacto@tallermecanicocentral.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'autopartes.express' },
            update: {},
            create: {
                username: 'autopartes.express',
                email: 'ventas@autopartesexpress.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'repuestos.del.norte' },
            update: {},
            create: {
                username: 'repuestos.del.norte',
                email: 'info@repuestosdelnorte.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'motopartes.sur' },
            update: {},
            create: {
                username: 'motopartes.sur',
                email: 'pedidos@motopartessur.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'distribuidora.auto' },
            update: {},
            create: {
                username: 'distribuidora.auto',
                email: 'compras@distribuidoraauto.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'taller.san.miguel' },
            update: {},
            create: {
                username: 'taller.san.miguel',
                email: 'gerencia@tallersanmiguel.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
        prisma.users.upsert({
            where: { username: 'autoservicio.plus' },
            update: {},
            create: {
                username: 'autoservicio.plus',
                email: 'servicio@autoservicioplus.com',
                passwordHash: hashedPassword,
                role: UserRole.client,
                isActive: true,
            },
        }),
    ]);

    // Create sample search logs
    const searchLogs = await Promise.all([
        // Original search logs
        prisma.searchLogs.upsert({
            where: { id: 1 },
            update: {},
            create: {
                searchTerm: 'ABC123',
                hasStock: true,
                userType: UserType.agent,
                sessionId: 'sess-001',
                userId: 2, // agent1
                resultCount: 1,
                searchDuration: 150,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 2 },
            update: {},
            create: {
                searchTerm: 'XYZ789',
                hasStock: false,
                userType: UserType.agent,
                sessionId: 'sess-001',
                userId: 2, // agent1
                resultCount: 0,
                searchDuration: 200,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 3 },
            update: {},
            create: {
                searchTerm: 'DEF456',
                hasStock: true,
                userType: UserType.client,
                sessionId: 'sess-002',
                userId: 3, // client1
                resultCount: 1,
                searchDuration: 120,
            },
        }),

        // Additional search logs from new users
        prisma.searchLogs.upsert({
            where: { id: 4 },
            update: {},
            create: {
                searchTerm: 'FILTRO_AIR',
                hasStock: true,
                userType: UserType.agent,
                sessionId: 'sess-003',
                userId: 5, // ana.martinez
                resultCount: 3,
                searchDuration: 180,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 5 },
            update: {},
            create: {
                searchTerm: 'BOMBA_COMBUSTIBLE',
                hasStock: true,
                userType: UserType.client,
                sessionId: 'sess-004',
                userId: 9, // tallermecanico.central
                resultCount: 2,
                searchDuration: 220,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 6 },
            update: {},
            create: {
                searchTerm: 'PASTILLAS_FRENO',
                hasStock: true,
                userType: UserType.agent,
                sessionId: 'sess-005',
                userId: 6, // jose.lopez
                resultCount: 5,
                searchDuration: 160,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 7 },
            update: {},
            create: {
                searchTerm: 'ACEITE_MOTOR',
                hasStock: true,
                userType: UserType.client,
                sessionId: 'sess-006',
                userId: 10, // autopartes.express
                resultCount: 8,
                searchDuration: 140,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 8 },
            update: {},
            create: {
                searchTerm: 'BUJIA_ENCENDIDO',
                hasStock: false,
                userType: UserType.agent,
                sessionId: 'sess-007',
                userId: 7, // lucia.fernandez
                resultCount: 0,
                searchDuration: 190,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 9 },
            update: {},
            create: {
                searchTerm: 'CORREA_DISTRIBUCION',
                hasStock: true,
                userType: UserType.client,
                sessionId: 'sess-008',
                userId: 11, // repuestos.del.norte
                resultCount: 1,
                searchDuration: 170,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 10 },
            update: {},
            create: {
                searchTerm: 'FILTRO_AIR',
                hasStock: true,
                userType: UserType.agent,
                sessionId: 'sess-009',
                userId: 8, // diego.silva
                resultCount: 3,
                searchDuration: 155,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 11 },
            update: {},
            create: {
                searchTerm: 'BOMBA_COMBUSTIBLE',
                hasStock: true,
                userType: UserType.client,
                sessionId: 'sess-010',
                userId: 12, // motopartes.sur
                resultCount: 2,
                searchDuration: 210,
            },
        }),
        prisma.searchLogs.upsert({
            where: { id: 12 },
            update: {},
            create: {
                searchTerm: 'PASTILLAS_FRENO',
                hasStock: true,
                userType: UserType.client,
                sessionId: 'sess-011',
                userId: 13, // distribuidora.auto
                resultCount: 4,
                searchDuration: 165,
            },
        }),
    ]);

    // Create sample user sessions
    const userSessions = await Promise.all([
        prisma.userSessions.upsert({
            where: { sessionId: 'sess-001' },
            update: {
                userId: 2,
                userType: UserType.agent,
                searchCount: 2,
                quoteCount: 1,
            },
            create: {
                sessionId: 'sess-001',
                userId: 2, // agent1
                userType: UserType.agent,
                searchCount: 2,
                quoteCount: 1,
            },
        }),
        prisma.userSessions.upsert({
            where: { sessionId: 'sess-002' },
            update: {
                userId: 3,
                userType: UserType.client,
                searchCount: 1,
                quoteCount: 0,
            },
            create: {
                sessionId: 'sess-002',
                userId: 3, // client1
                userType: UserType.client,
                searchCount: 1,
                quoteCount: 0,
            },
        }),
    ]);

    // Create sample quotes - DISABLED: Skip creating sample quotes
    /*
    const quotes = await Promise.all([
        // Original quotes
        prisma.quotes.upsert({
            where: { id: 1 },
            update: {},
            create: {
                agentId: 2, // agent1
                clientId: 1,
                items: [
                    {
                        reference: 'ABC123',
                        quantity: 5,
                        unitPrice: 25.99,
                        totalPrice: 129.95,
                    },
                ],
                status: QuoteStatus.running,
                totalAmount: 129.95,
                pdfPath: '/pdfs/quote-001.pdf',
                observations: 'Este repuesto tiene garantía de 6 meses. Se requiere instalación especializada. Contactar con el cliente para confirmar disponibilidad de horario.',
            },
        }),
        prisma.quotes.upsert({
            where: { id: 2 },
            update: {},
            create: {
                agentId: 2, // agent1
                clientId: 2,
                items: [
                    {
                        reference: 'DEF456',
                        quantity: 3,
                        unitPrice: 15.50,
                        totalPrice: 46.50,
                    },
                ],
                status: QuoteStatus.hot,
                totalAmount: 46.50,
                pdfPath: '/pdfs/quote-002.pdf',
                observations: 'Precio especial por compra al por mayor. Descuento adicional del 5% si se paga al contado.',
            },
        }),

        // Additional quotes from new users
        prisma.quotes.upsert({
            where: { id: 3 },
            update: {},
            create: {
                agentId: 5, // ana.martinez
                clientId: 9, // tallermecanico.central
                clientName: 'Taller Mecánico Central',
                clientType: 5, // ALMACEN
                items: [
                    {
                        reference: 'FILTRO_AIR',
                        quantity: 10,
                        unitPrice: 12.50,
                        totalPrice: 125.00,
                    },
                    {
                        reference: 'ACEITE_MOTOR',
                        quantity: 5,
                        unitPrice: 8.75,
                        totalPrice: 43.75,
                    },
                ],
                status: QuoteStatus.warm,
                totalAmount: 168.75,
                pdfPath: '/pdfs/quote-003.pdf',
            },
        }),
        prisma.quotes.upsert({
            where: { id: 4 },
            update: {},
            create: {
                agentId: 6, // jose.lopez
                clientId: 10, // autopartes.express
                clientName: 'Autopartes Express',
                clientType: 6, // DISTRIBUIDOR
                items: [
                    {
                        reference: 'PASTILLAS_FRENO',
                        quantity: 20,
                        unitPrice: 18.99,
                        totalPrice: 379.80,
                    },
                ],
                status: QuoteStatus.hot,
                totalAmount: 379.80,
                pdfPath: '/pdfs/quote-004.pdf',
            },
        }),
        prisma.quotes.upsert({
            where: { id: 5 },
            update: {},
            create: {
                agentId: 7, // lucia.fernandez
                clientId: 11, // repuestos.del.norte
                clientName: 'Repuestos del Norte',
                clientType: 2, // A
                items: [
                    {
                        reference: 'CORREA_DISTRIBUCION',
                        quantity: 2,
                        unitPrice: 45.00,
                        totalPrice: 90.00,
                    },
                ],
                status: QuoteStatus.cold,
                totalAmount: 90.00,
                pdfPath: '/pdfs/quote-005.pdf',
            },
        }),
        prisma.quotes.upsert({
            where: { id: 6 },
            update: {},
            create: {
                agentId: 8, // diego.silva
                clientId: 12, // motopartes.sur
                clientName: 'Motopartes Sur',
                clientType: 3, // AA
                items: [
                    {
                        reference: 'BOMBA_COMBUSTIBLE',
                        quantity: 3,
                        unitPrice: 85.50,
                        totalPrice: 256.50,
                    },
                    {
                        reference: 'FILTRO_AIR',
                        quantity: 5,
                        unitPrice: 12.50,
                        totalPrice: 62.50,
                    },
                ],
                status: QuoteStatus.warm,
                totalAmount: 319.00,
                pdfPath: '/pdfs/quote-006.pdf',
            },
        }),
        prisma.quotes.upsert({
            where: { id: 7 },
            update: {},
            create: {
                agentId: 5, // ana.martinez
                clientId: 13, // distribuidora.auto
                clientName: 'Distribuidora Auto',
                clientType: 6, // DISTRIBUIDOR
                items: [
                    {
                        reference: 'BUJIA_ENCENDIDO',
                        quantity: 50,
                        unitPrice: 3.25,
                        totalPrice: 162.50,
                    },
                ],
                status: QuoteStatus.hot,
                totalAmount: 162.50,
                pdfPath: '/pdfs/quote-007.pdf',
            },
        }),
        prisma.quotes.upsert({
            where: { id: 8 },
            update: {},
            create: {
                agentId: 6, // jose.lopez
                clientId: 14, // taller.san.miguel
                clientName: 'Taller San Miguel',
                clientType: 5, // ALMACEN
                items: [
                    {
                        reference: 'ACEITE_MOTOR',
                        quantity: 15,
                        unitPrice: 8.75,
                        totalPrice: 131.25,
                    },
                    {
                        reference: 'FILTRO_AIR',
                        quantity: 8,
                        unitPrice: 12.50,
                        totalPrice: 100.00,
                    },
                ],
                status: QuoteStatus.running,
                totalAmount: 231.25,
                pdfPath: '/pdfs/quote-008.pdf',
            },
        }),
    ]);
    */
    const quotes: any[] = [];

    // Create sample quote logs - DISABLED: Skip creating sample quote logs
    /*
    const quoteLogs = await Promise.all([
        prisma.quoteLogs.create({
            data: {
                quoteId: 1,
                status: QuoteStatus.running,
                clientId: 1,
                agentId: 2, // agent1
                totalAmount: 129.95,
                itemCount: 1,
            },
        }),
        prisma.quoteLogs.create({
            data: {
                quoteId: 2,
                status: QuoteStatus.hot,
                clientId: 2,
                agentId: 2, // agent1
                totalAmount: 46.50,
                itemCount: 1,
            },
        }),
    ]);
    */
    const quoteLogs: any[] = [];

    // Create default configurations (upsert to avoid conflicts)
    const configurations = await Promise.all([
        // Weight and pricing adjustments
        prisma.configuration.upsert({
            where: { key: 'WEIGHT_ADJUSTMENT' },
            update: { value: 3.0 },
            create: {
                key: 'WEIGHT_ADJUSTMENT',
                value: 3.0,
                description: 'Weight adjustment percentage (3%)',
                category: 'pricing'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'POUNDS_PRICE' },
            update: { value: 2.5 },
            create: {
                key: 'POUNDS_PRICE',
                value: 2.5,
                description: 'Price per pound for weight-based pricing ($2.5)',
                category: 'pricing'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'COST_ADJUSTMENT' },
            update: { value: 5.0 },
            create: {
                key: 'COST_ADJUSTMENT',
                value: 5.0,
                description: 'Cost adjustment percentage (5%)',
                category: 'pricing'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CURRENCY_ADJUSTMENT' },
            update: { value: 300.0 },
            create: {
                key: 'CURRENCY_ADJUSTMENT',
                value: 300.0,
                description: 'Currency exchange rate adjustment (+300 COP)',
                category: 'pricing'
            }
        }),
        // Client type multipliers
        prisma.configuration.upsert({
            where: { key: 'DISTRIBUIDOR' },
            update: {},
            create: {
                key: 'DISTRIBUIDOR',
                value: 0.85,
                description: 'Price multiplier for Distribuidor client type',
                category: 'client_types'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'ALMACEN' },
            update: {},
            create: {
                key: 'ALMACEN',
                value: 0.90,
                description: 'Price multiplier for Almacen client type',
                category: 'client_types'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'AA' },
            update: {},
            create: {
                key: 'AA',
                value: 0.95,
                description: 'Price multiplier for AA client type',
                category: 'client_types'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'A' },
            update: {},
            create: {
                key: 'A',
                value: 1.0,
                description: 'Price multiplier for A client type',
                category: 'client_types'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'PREMIUM' },
            update: {},
            create: {
                key: 'PREMIUM',
                value: 1.1,
                description: 'Price multiplier for Premium client type',
                category: 'client_types'
            }
        }),
        // Client Type to Price List Mappings
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_0_PRICE_LIST' },
            update: { value: 1.0 },
            create: {
                key: 'CLIENT_TYPE_0_PRICE_LIST',
                value: 1.0,
                description: 'CLIENTE GENERAL → Price List 1',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_1_PRICE_LIST' },
            update: { value: 3.0 },
            create: {
                key: 'CLIENT_TYPE_1_PRICE_LIST',
                value: 3.0,
                description: 'CLIENTE A → Price List 3',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_2_PRICE_LIST' },
            update: { value: 3.0 },
            create: {
                key: 'CLIENT_TYPE_2_PRICE_LIST',
                value: 3.0,
                description: 'CLIENTE AA → Price List 3',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_4_PRICE_LIST' },
            update: { value: 4.0 },
            create: {
                key: 'CLIENT_TYPE_4_PRICE_LIST',
                value: 4.0,
                description: 'CLIENTE PREMIUM → Price List 4',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_5_PRICE_LIST' },
            update: { value: 5.0 },
            create: {
                key: 'CLIENT_TYPE_5_PRICE_LIST',
                value: 5.0,
                description: 'CLIENTE ALMACEN → Price List 5',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_6_PRICE_LIST' },
            update: { value: 6.0 },
            create: {
                key: 'CLIENT_TYPE_6_PRICE_LIST',
                value: 6.0,
                description: 'CLIENTE DISTRIBUIDOR → Price List 6',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_7_PRICE_LIST' },
            update: { value: 5.0 },
            create: {
                key: 'CLIENT_TYPE_7_PRICE_LIST',
                value: 5.0,
                description: 'CLIENTE PROVEEDOR → Price List 5',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_8_PRICE_LIST' },
            update: { value: 2.0 },
            create: {
                key: 'CLIENT_TYPE_8_PRICE_LIST',
                value: 2.0,
                description: 'COMPETENCIA → Price List 2',
                category: 'client_type_price_list'
            }
        }),
        prisma.configuration.upsert({
            where: { key: 'CLIENT_TYPE_9_PRICE_LIST' },
            update: { value: 2.0 },
            create: {
                key: 'CLIENT_TYPE_9_PRICE_LIST',
                value: 2.0,
                description: 'CLIENTE PERDIDO → Price List 2',
                category: 'client_type_price_list'
            }
        })
    ]);

    // Create DeepWebEndpoint configurations
    const deepWebEndpoints = await Promise.all([
        (prisma as any).deepWebEndpoint.upsert({
            where: { originCode: 'AGROCOSTA' },
            update: {},
            create: {
                originCode: 'AGROCOSTA',
                name: 'AgroCosta',
                url: 'https://agro-costa.com/consulta/consulta_inventario.php?tipo_busqueda=referencia&referencia={{reference}}&descripcion=&buscar=',
                method: 'POST',
                isActive: true,
                requiresLogin: true,
                loginUrl: 'https://agro-costa.com/consulta/login.php',
                loginUsername: 'ciparc',
                loginPassword: 'COL25',
                loginFormSelector: 'form',
                usernameField: 'input[name="usuario"]',
                passwordField: 'input[name="contraseña"]',
                timeoutMs: 30000,
                retryAttempts: 1,
            },
        }),
    ]);

    console.log('✅ Database seeding completed!');
    console.log(`Created ${users.length} users`);
    console.log(`Created ${searchLogs.length} search logs`);
    console.log(`Created ${userSessions.length} user sessions`);
    // console.log(`Created ${quotes.length} quotes`); // DISABLED: Sample quotes not created
    // console.log(`Created ${quoteLogs.length} quote logs`); // DISABLED: Sample quote logs not created
    console.log(`Created ${configurations.length} configurations`);
    console.log(`Created ${deepWebEndpoints.length} deep web endpoints`);
    console.log('\n📋 Default login credentials:');
    console.log('Admin: admin / password123');
    console.log('Agent: agent1 / password123');
    console.log('Client: client1 / password123');
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
