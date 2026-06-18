import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const quoteId = parseInt(id);
        const { searchParams } = new URL(request.url);
        const printReference = searchParams.get('printReference') === '1';
        if (!quoteId || quoteId <= 0) {
            return NextResponse.json(
                { error: 'Invalid quote ID' },
                { status: 400 }
            );
        }

        // Fetch the quote with all necessary fields
        const quote = await prisma.quotes.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                agentId: true,
                clientId: true,
                clientName: true,
                items: true,
                status: true,
                createdAt: true,
                totalAmount: true,
                discountPercent: true,
                discountAmount: true,
                ivaPercent: true,
                ivaAmount: true,
                observations: true,
            },
        });

        if (!quote) {
            return NextResponse.json(
                { error: 'Quote not found' },
                { status: 404 }
            );
        }

        // Fetch agent information separately
        const agent = await prisma.users.findUnique({
            where: { id: quote.agentId },
            select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
                role: true,
            },
        });

        // Fetch client information separately if clientId exists
        const client = quote.clientId ? await prisma.users.findUnique({
            where: { id: quote.clientId },
            select: {
                id: true,
                clientName: true,
                email: true,
                phoneNumber: true,
                address: true,
                city: true,
                stateOrDepartment: true,
                country: true,
            },
        }) : null;

        // Check permissions:
        // - Admins can see all quotes
        // - Agents can only see their own quotes (where agentId matches their ID)
        // - Clients can only see their own quotes (where clientId matches their ID)
        const userId = parseInt(session.user.id);
        const isAdmin = session.user.role === 'admin';
        const isAgent = session.user.role === 'agent';
        const isClient = session.user.role === 'client';

        const canAccess = isAdmin ||
            (isAgent && quote.agentId === userId) ||
            (isClient && quote.clientId === userId);

        if (!canAccess) {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }

        // Create PDF
        const pdfDoc = await PDFDocument.create();
        let currentPage = pdfDoc.addPage([595.28, 841.89]); // A4 size
        const { width, height } = currentPage.getSize();

        // Load fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Colors
        const black = rgb(0, 0, 0);
        const gray = rgb(0.5, 0.5, 0.5);
        const lightGray = rgb(0.95, 0.95, 0.95);
        const logoBlue = rgb(0 / 255, 115 / 255, 185 / 255); // Blue from Image 2
        const lightBlueBg = rgb(236 / 255, 246 / 255, 254 / 255); // Light blue from Image 2

        // Store logos for reuse
        let proshelLogo: any = null;
        let ipmachLogo: any = null;

        // Load logos
        try {
            const publicDir = path.join(process.cwd(), 'public');

            // Proshel Logo (New Protagonist)
            const proshelLogoPath = path.join(publicDir, 'proshel-logo-new.png');
            if (fs.existsSync(proshelLogoPath)) {
                const logoBytes = new Uint8Array(fs.readFileSync(proshelLogoPath));
                proshelLogo = await pdfDoc.embedPng(logoBytes);
            }

            // Pro-mach Logo (New IPMach version)
            const promachLogoPath = path.join(publicDir, 'promach-solutions-logo.png');
            if (fs.existsSync(promachLogoPath)) {
                const logoBytes = new Uint8Array(fs.readFileSync(promachLogoPath));
                ipmachLogo = await pdfDoc.embedPng(logoBytes);
            }
        } catch (error) {
            console.error('Error loading logos:', error);
        }

        // Draw first page header using NEW design
        let yPosition = drawNewPageHeader(
            currentPage,
            proshelLogo,
            ipmachLogo,
            quote.id,
            height,
            font,
            boldFont,
            logoBlue
        );

        // Bill to / Ship to section with light blue background
        yPosition -= 40;
        currentPage.drawRectangle({
            x: 40,
            y: yPosition - 100,
            width: width - 80,
            height: 120,
            color: lightBlueBg,
        });

        const billToY = yPosition;
        // Bill to
        currentPage.drawText('Bill to', { x: 50, y: billToY, size: 10, font: boldFont, color: black });
        let currentBillToY = billToY - 15;
        currentPage.drawText(sanitizeTextForPDF(quote.clientName || 'Cliente No especificado'), {
            x: 50, y: currentBillToY, size: 10, font: font, color: black
        });
        currentBillToY -= 12;
        if (client?.address) {
            const addressLines = wrapText(client.address, 40, font, 10);
            for (const line of addressLines) {
                currentPage.drawText(sanitizeTextForPDF(line), { x: 50, y: currentBillToY, size: 10, font: font, color: black });
                currentBillToY -= 12;
            }
        }
        const cityState = [client?.city, client?.stateOrDepartment].filter(Boolean).join(', ');
        if (cityState) {
            currentPage.drawText(sanitizeTextForPDF(cityState), { x: 50, y: currentBillToY, size: 10, font: font, color: black });
            currentBillToY -= 12;
        }
        if (client?.country) {
            currentPage.drawText(sanitizeTextForPDF(client.country), { x: 50, y: currentBillToY, size: 10, font: font, color: black });
        }

        // Ship to (using same info as Bill to for now, as per Image 2)
        currentPage.drawText('Ship to', { x: 300, y: billToY, size: 10, font: boldFont, color: black });
        let currentShipToY = billToY - 15;
        currentPage.drawText(sanitizeTextForPDF(quote.clientName || 'Cliente No especificado'), {
            x: 300, y: currentShipToY, size: 10, font: font, color: black
        });
        currentShipToY -= 12;
        if (client?.address) {
            const addressLines = wrapText(client.address, 40, font, 10);
            for (const line of addressLines) {
                currentPage.drawText(sanitizeTextForPDF(line), { x: 300, y: currentShipToY, size: 10, font: font, color: black });
                currentShipToY -= 12;
            }
        }
        if (cityState) {
            currentPage.drawText(sanitizeTextForPDF(cityState), { x: 300, y: currentShipToY, size: 10, font: font, color: black });
            currentShipToY -= 12;
        }
        if (client?.country) {
            currentPage.drawText(sanitizeTextForPDF(client.country), { x: 300, y: currentShipToY, size: 10, font: font, color: black });
        }

        yPosition -= 110;

        // Details Row
        currentPage.drawText('Estimate details', { x: 50, y: yPosition, size: 10, font: boldFont, color: black });
        currentPage.drawText('Sales Rep: ' + sanitizeTextForPDF(agent?.username || ''), { x: 300, y: yPosition, size: 10, font: font, color: black });
        yPosition -= 15;
        currentPage.drawText(`Estimate no.: ${quote.id}`, { x: 50, y: yPosition, size: 9, font: font, color: black });
        currentPage.drawText('ICOTERM: DAP', { x: 300, y: yPosition, size: 9, font: font, color: black });
        yPosition -= 12;
        currentPage.drawText(`Estimate date: ${new Date(quote.createdAt).toLocaleDateString('es-CO')}`, { x: 50, y: yPosition, size: 9, font: font, color: black });

        yPosition -= 30;

        // Draw table headers
        yPosition = drawTableHeaders(
            currentPage,
            yPosition,
            printReference,
            font,
            boldFont,
            black,
            gray,
            lightGray
        );

        // Items
        const items = Array.isArray(quote.items) ? (quote.items as unknown as any[]) : [];
        const minYPosition = 150; // Minimum Y position before creating new page (leave room for totals)

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // Guard against null/undefined or non-object items coming from JSON
            if (!item || typeof item !== 'object') {
                yPosition -= 15;
                continue;
            }

            // Check if we need a new page (leave room for at least one more item + totals section)
            if (yPosition < minYPosition) {
                // Create new page and redraw headers
                currentPage = pdfDoc.addPage([595.28, 841.89]);
                const newHeaderY = drawNewPageHeader(
                    currentPage,
                    proshelLogo,
                    ipmachLogo,
                    quote.id,
                    height,
                    font,
                    boldFont,
                    logoBlue
                );
                // Continuation pages repeat only the header (no Bill-to block); large offset caused excess blank space.
                yPosition = newHeaderY - 56;

                // Redraw table headers on new page
                currentPage.drawText('ÍTEMS (continuación)', {
                    x: 50,
                    y: yPosition,
                    size: 14,
                    font: boldFont,
                    color: logoBlue,
                });
                yPosition -= 20;
                yPosition = drawTableHeaders(
                    currentPage,
                    yPosition,
                    printReference,
                    font,
                    boldFont,
                    black,
                    gray,
                    lightGray
                );
            }

            // Draw index #
            currentPage.drawText((i + 1).toString() + '.', {
                x: 42,
                y: yPosition,
                size: 9,
                font: font,
                color: black,
            });

            // Reference (optional)
            if (printReference) {
                const reference = typeof (item as any).reference === 'string' ? (item as any).reference : '';
                currentPage.drawText(sanitizeTextForPDF(reference), {
                    x: 65,
                    y: yPosition,
                    size: 9,
                    font: font,
                    color: black,
                });
            }

            // Description (replace "Costex" with "Importacion" and truncate if too long)
            let description = typeof (item as any).description === 'string' ? (item as any).description : '';
            // Add brand to description if it exists
            const brand = typeof (item as any).brand === 'string' ? (item as any).brand : '';
            if (brand) {
                description = description ? `${brand} - ${description}` : brand;
            }
            // Replace all occurrences of "Costex" with "Importacion" in description
            description = description.replace(/Costex/gi, 'Importacion');
            // Sanitize description to remove newlines and control characters
            description = sanitizeTextForPDF(description);
            const truncatedDesc = description.length > 35 ? description.substring(0, 35) + '...' : description;
            currentPage.drawText(truncatedDesc, {
                x: printReference ? 150 : 65,
                y: yPosition,
                size: 9,
                font: font,
                color: black,
            });

            // Quantity
            const quantityVal = typeof (item as any).quantity === 'number' ? (item as any).quantity : 1;
            currentPage.drawText(quantityVal.toString(), {
                x: printReference ? 350 : 320,
                y: yPosition,
                size: 9,
                font: font,
                color: black,
            });

            // Unit Price
            const unitPriceVal = typeof (item as any).unitPrice === 'number' ? (item as any).unitPrice : 0;
            currentPage.drawText(formatCurrencyForPDF(unitPriceVal), {
                x: printReference ? 420 : 390,
                y: yPosition,
                size: 9,
                font: font,
                color: black,
            });

            // Total
            const totalPriceVal = typeof (item as any).totalPrice === 'number' ? (item as any).totalPrice : (unitPriceVal * quantityVal);
            currentPage.drawText(formatCurrencyForPDF(totalPriceVal), {
                x: printReference ? 500 : 480,
                y: yPosition,
                size: 9,
                font: font,
                color: black,
            });

            // Draw separator line just below this row (so it does not overlap the next row's text)
            const lineY = yPosition - 3;
            currentPage.drawLine({
                start: { x: 40, y: lineY },
                end: { x: 555, y: lineY },
                thickness: 0.5,
                color: rgb(0.9, 0.9, 0.9),
            });
            yPosition -= 20;
        }

        // Totals breakdown
        if (yPosition < 200) {
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            const newHeaderY = drawNewPageHeader(
                currentPage,
                proshelLogo,
                ipmachLogo,
                quote.id,
                height,
                font,
                boldFont,
                logoBlue
            );
            yPosition = newHeaderY - 100;
        }

        yPosition -= 20;
        currentPage.drawLine({
            start: { x: 350, y: yPosition },
            end: { x: 555, y: yPosition },
            thickness: 1,
            color: gray,
        });

        const parseNumber = (value: unknown, fallback: number): number => {
            if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
            if (typeof value === 'string') {
                const n = Number(value);
                return Number.isFinite(n) ? n : fallback;
            }
            return fallback;
        };

        const subtotal = items.reduce((sum, it: any) => {
            const q = parseNumber(it?.quantity, 1);
            const unit = parseNumber(it?.unitPrice, 0);
            const fallbackLine = unit * q;
            const line = parseNumber(it?.totalPrice, fallbackLine);
            const safeLine = Number.isFinite(line) ? Number(line) : 0;
            return sum + (safeLine > 0 ? safeLine : 0);
        }, 0);

        const discountPercent = Number.isFinite(Number(quote.discountPercent)) ? Number(quote.discountPercent) : 0;
        const computedDiscountAmount = subtotal * (Math.max(0, discountPercent) / 100);
        const discountAmount = Number.isFinite(Number(quote.discountAmount)) && Number(quote.discountAmount) >= 0
            ? Number(quote.discountAmount)
            : computedDiscountAmount;

        const base = Math.max(0, subtotal - Math.min(discountAmount, subtotal));
        const total = base;

        yPosition -= 16;
        currentPage.drawText('Subtotal:', { x: 420, y: yPosition, size: 10, font: font, color: black });
        currentPage.drawText(formatCurrencyForPDF(subtotal), { x: 500, y: yPosition, size: 10, font: font, color: black });

        yPosition -= 16;
        currentPage.drawText(`Descuento (${discountPercent.toFixed(1)}%):`, { x: 380, y: yPosition, size: 10, font: font, color: black });
        currentPage.drawText(`-${formatCurrencyForPDF(discountAmount)}`, { x: 500, y: yPosition, size: 10, font: font, color: black });

        yPosition -= 25;
        // Total row styling
        currentPage.drawRectangle({
            x: 350,
            y: yPosition - 5,
            width: 205,
            height: 25,
            color: lightGray,
        });
        currentPage.drawText('TOTAL:', {
            x: 380,
            y: yPosition,
            size: 14,
            font: boldFont,
            color: black,
        });
        currentPage.drawText(formatCurrencyForPDF(total), {
            x: 480,
            y: yPosition,
            size: 14,
            font: boldFont,
            color: black,
        });

        // Observations section (kept similar but with new design accent)
        if (quote.observations && quote.observations.trim()) {
            yPosition -= 50;
            if (yPosition < 100) {
                currentPage = pdfDoc.addPage([595.28, 841.89]);
                const newHeaderY = drawNewPageHeader(
                    currentPage,
                    proshelLogo,
                    ipmachLogo,
                    quote.id,
                    height,
                    font,
                    boldFont,
                    logoBlue
                );
                yPosition = newHeaderY - 100;
            }

            currentPage.drawText('OBSERVACIONES:', {
                x: 50,
                y: yPosition,
                size: 11,
                font: boldFont,
                color: logoBlue,
            });
            yPosition -= 20;

            const sanitizedObservations = sanitizeTextForPDF(quote.observations);
            const obsLines = wrapText(sanitizedObservations, 90, font, 10);

            for (const line of obsLines) {
                if (yPosition < 50) {
                    currentPage = pdfDoc.addPage([595.28, 841.89]);
                    const newHeaderY = drawNewPageHeader(
                        currentPage,
                        proshelLogo,
                        ipmachLogo,
                        quote.id,
                        height,
                        font,
                        boldFont,
                        logoBlue
                    );
                    yPosition = newHeaderY - 50;
                }
                currentPage.drawText(line, { x: 50, y: yPosition, size: 10, font: font, color: black });
                yPosition -= 15;
            }
        }

        // Accepted date / Accepted by (footer like Image 2)
        yPosition -= 60;
        if (yPosition < 100) {
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            yPosition = height - 100;
        }

        currentPage.drawLine({ start: { x: 50, y: yPosition }, end: { x: 250, y: yPosition }, thickness: 1, color: black });
        currentPage.drawText('Accepted date', { x: 50, y: yPosition - 15, size: 10, font: boldFont, color: black });

        currentPage.drawLine({ start: { x: 300, y: yPosition }, end: { x: 550, y: yPosition }, thickness: 1, color: black });
        currentPage.drawText('Accepted by', { x: 300, y: yPosition - 15, size: 10, font: boldFont, color: black });

        // Add page numbers to all pages
        const totalPagesCount = pdfDoc.getPageCount();
        for (let i = 0; i < totalPagesCount; i++) {
            const page = pdfDoc.getPage(i);
            drawPageNumber(page, i + 1, totalPagesCount, font, gray);
        }

        // Generate PDF bytes
        const pdfBytes = await pdfDoc.save();
        const buffer = Buffer.from(pdfBytes);

        // Return PDF
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="cotizacion-${quote.id}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('PDF export error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}

/**
 * Draw NEW page header following Image 2 style
 */
function drawNewPageHeader(
    page: any,
    proshelLogo: any,
    ipmachLogo: any,
    quoteId: number,
    height: number,
    font: any,
    boldFont: any,
    blue: any
): number {
    const marginY = height - 60;

    // Top Left: Estimate Title
    page.drawText('Estimate', {
        x: 50,
        y: marginY,
        size: 24,
        font: boldFont,
        color: blue,
    });

    // Company Info Below Title
    const companyInfoY = marginY - 25;
    page.drawText('Proshel Corp', { x: 50, y: companyInfoY, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText('7768 NW 64th St', { x: 50, y: companyInfoY - 12, size: 10, font: font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Miami, FL 33166', { x: 50, y: companyInfoY - 24, size: 10, font: font, color: rgb(0.3, 0.3, 0.3) });

    // Center: Contact Info
    const centerX = 240;
    page.drawText('ipmach@ipmach.com', { x: centerX, y: marginY - 25, size: 10, font: font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('+57 300 8487000', { x: centerX, y: marginY - 37, size: 10, font: font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('www.ipmach.com', { x: centerX, y: marginY - 49, size: 10, font: font, color: rgb(0.3, 0.3, 0.3) });

    // Top Right: Logos
    // Handle Proshel Logo (Protagonist)
    if (proshelLogo) {
        const pTargetHeight = 70; // Larger as protagonist
        const pScale = pTargetHeight / proshelLogo.height;
        const pWidth = proshelLogo.width * pScale;
        page.drawImage(proshelLogo, {
            x: 550 - pWidth,
            y: marginY - 45,
            width: pWidth,
            height: pTargetHeight,
        });

        // Handle Pro-mach Logo (Sub-branding, coexisting below or to the left)
        if (ipmachLogo) {
            const iTargetHeight = 62.5; // Increased by 150% (2.5x from 25)
            const iScale = iTargetHeight / ipmachLogo.height;
            const iWidth = ipmachLogo.width * iScale;
            // Place it horizontally aligned to the left of Proshel or below
            // For Image 2 style, let's place it slightly to the left or below.
            // Below might be better for "coexisting naturally"
            page.drawImage(ipmachLogo, {
                x: 550 - iWidth - 5, // Slightly offset from right
                y: marginY - 100, // Adjusted Y for larger logo
                width: iWidth,
                height: iTargetHeight,
            });
        }
    } else if (ipmachLogo) {
        // Fallback if only Pro-mach logo exists
        const scale = 50 / ipmachLogo.height;
        const width = ipmachLogo.width * scale;
        page.drawImage(ipmachLogo, {
            x: 550 - width,
            y: marginY - 40,
            width: width,
            height: 50,
        });
    }

    return marginY - 80;
}

/**
 * Draw table headers with background color
 */
function drawTableHeaders(
    page: any,
    yPosition: number,
    printReference: boolean,
    font: any,
    boldFont: any,
    black: any,
    gray: any,
    lightGray: any
): number {
    // Header background
    page.drawRectangle({
        x: 40,
        y: yPosition - 5,
        width: 515,
        height: 20,
        color: lightGray,
    });

    const headerTextY = yPosition;
    page.drawText('#', { x: 42, y: headerTextY, size: 10, font: boldFont, color: black });

    if (printReference) {
        page.drawText('Referencia', { x: 65, y: headerTextY, size: 10, font: boldFont, color: black });
        page.drawText('Descripción', { x: 150, y: headerTextY, size: 10, font: boldFont, color: black });
        page.drawText('Cant.', { x: 350, y: headerTextY, size: 10, font: boldFont, color: black });
        page.drawText('Precio Unit.', { x: 420, y: headerTextY, size: 10, font: boldFont, color: black });
        page.drawText('Total', { x: 500, y: headerTextY, size: 10, font: boldFont, color: black });
    } else {
        page.drawText('Descripción', { x: 65, y: headerTextY, size: 10, font: boldFont, color: black });
        page.drawText('Cant.', { x: 320, y: headerTextY, size: 10, font: boldFont, color: black });
        page.drawText('Precio Unit.', { x: 390, y: headerTextY, size: 10, font: boldFont, color: black });
        page.drawText('Total', { x: 480, y: headerTextY, size: 10, font: boldFont, color: black });
    }

    return yPosition - 25;
}

/**
 * Wrap text into lines that fit a certain width
 */
function wrapText(text: string, maxChars: number, font: any, size: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + word).length > maxChars) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    }
    if (currentLine) lines.push(currentLine.trim());
    return lines;
}

/**
 * Sanitize text for PDF rendering
 */
function sanitizeTextForPDF(text: string | null | undefined): string {
    if (!text) return '';
    return String(text)
        .replace(/\r\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();
}

function formatCurrencyForPDF(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount || 0);
}

function drawPageNumber(page: any, pageNum: number, totalPages: number, font: any, color: any) {
    page.drawText(`Página ${pageNum} de ${totalPages}`, {
        x: 500,
        y: 15,
        size: 8,
        font: font,
        color: color,
    });
}