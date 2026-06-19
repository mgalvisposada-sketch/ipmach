/**
 * Generates an order PDF as a Buffer. Used by the export API route and by the order confirmation email.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface OrderForPdf {
  id: number;
  clientId: number;
  clientName: string | null;
  items: unknown;
  status: string;
  createdAt: Date;
  totalAmount: number | { toNumber?: () => number };
  discountPercent?: number | { toNumber?: () => number } | null;
  discountAmount?: number | { toNumber?: () => number } | null;
  ivaPercent?: number | { toNumber?: () => number } | null;
  ivaAmount?: number | { toNumber?: () => number } | null;
  observations: string | null;
  orderName?: string | null;
  dispatchType?: string | null;
  pickupEntity?: string | null;
  pickupName?: string | null;
  carrierName?: string | null;
  carrierAddress?: string | null;
  carrierPhone?: string | null;
  carrierContactName?: string | null;
  paymentMethod?: string | null;
}

export interface ClientForPdf {
  id?: number;
  username?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  city?: string | null;
  stateOrDepartment?: string | null;
  country?: string | null;
  /** Commercial term with client (e.g. EXW); shown below document date when set. */
  incoterm?: string | null;
}

export interface GenerateOrderPdfOptions {
  printReference?: boolean;
  /** Header title (default: Order). Use Invoice / Delivery note for billing documents. */
  headerTitle?: string;
  detailsSectionTitle?: string;
  documentNumberLabel?: string;
  /** Shown after documentNumberLabel (default: order id). */
  documentNumberValue?: string;
  dateLabel?: string;
  /** Right column on the date row (e.g. legal line). */
  rightDetailCaption?: string;
  /** When false, hides nombre / despacho / forma de pago (used for Filipo invoices). Default true. */
  showDispatchAndPaymentDetails?: boolean;
  /** When set, subtotal/discount/total rows use these values (e.g. Filipo document totals). */
  totalsOverride?: {
    subtotal: number;
    discountAmount: number;
    discountPercent: number;
    total: number;
  };
}

function toNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function sanitizeTextForPDF(text: string): string {
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
  }).format(amount);
}

function drawOrderPageHeader(
  page: any,
  proshelLogo: unknown,
  ipmachLogo: unknown,
  _orderId: number,
  height: number,
  font: unknown,
  boldFont: unknown,
  blue: unknown,
  headerTitle: string = 'Orden'
): number {
  const marginY = height - 60;
  page.drawText(headerTitle, { x: 50, y: marginY, size: 24, font: boldFont, color: blue });
  const companyInfoY = marginY - 25;
  page.drawText('Proshel Corp', { x: 50, y: companyInfoY, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('7768 NW 64th St', { x: 50, y: companyInfoY - 12, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Miami, FL 33166', { x: 50, y: companyInfoY - 24, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  const centerX = 240;
  page.drawText('ipmach@ipmach.com', { x: centerX, y: marginY - 25, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('+57 300 8487000', { x: centerX, y: marginY - 37, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('www.ipmach.com', { x: centerX, y: marginY - 49, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  if (proshelLogo) {
    const p = proshelLogo as { width: number; height: number };
    const pTargetHeight = 70;
    const pScale = pTargetHeight / p.height;
    const pWidth = p.width * pScale;
    page.drawImage(proshelLogo, { x: 550 - pWidth, y: marginY - 45, width: pWidth, height: pTargetHeight });
    if (ipmachLogo) {
      const i = ipmachLogo as { width: number; height: number };
      const iTargetHeight = 62.5;
      const iScale = iTargetHeight / i.height;
      const iWidth = i.width * iScale;
      page.drawImage(ipmachLogo, { x: 550 - iWidth - 5, y: marginY - 100, width: iWidth, height: iTargetHeight });
    }
  } else if (ipmachLogo) {
    const i = ipmachLogo as { width: number; height: number };
    const scale = 50 / i.height;
    const w = i.width * scale;
    page.drawImage(ipmachLogo, { x: 550 - w, y: marginY - 40, width: w, height: 50 });
  }
  return marginY - 80;
}

function drawOrderTableHeaders(
  page: any,
  yPosition: number,
  printReference: boolean,
  font: unknown,
  boldFont: unknown,
  black: unknown,
  lightGray: unknown
): number {
  page.drawRectangle({ x: 40, y: yPosition - 5, width: 515, height: 20, color: lightGray });
  const headerTextY = yPosition;
  page.drawText('#', { x: 42, y: headerTextY, size: 10, font: boldFont, color: black });
  if (printReference) {
    page.drawText('Reference', { x: 65, y: headerTextY, size: 10, font: boldFont, color: black });
    page.drawText('Description', { x: 150, y: headerTextY, size: 10, font: boldFont, color: black });
    page.drawText('Qty.', { x: 350, y: headerTextY, size: 10, font: boldFont, color: black });
    page.drawText('Unit price', { x: 420, y: headerTextY, size: 10, font: boldFont, color: black });
    page.drawText('Total', { x: 500, y: headerTextY, size: 10, font: boldFont, color: black });
  } else {
    page.drawText('Description', { x: 65, y: headerTextY, size: 10, font: boldFont, color: black });
    page.drawText('Qty.', { x: 320, y: headerTextY, size: 10, font: boldFont, color: black });
    page.drawText('Unit price', { x: 390, y: headerTextY, size: 10, font: boldFont, color: black });
    page.drawText('Total', { x: 480, y: headerTextY, size: 10, font: boldFont, color: black });
  }
  return yPosition - 25;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + word).length > maxChars) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
}

function drawPageNumber(
  page: any,
  pageNumber: number,
  totalPages: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  gray: unknown
): void {
  const pageText = `Page ${pageNumber} of ${totalPages}`;
  const textWidth = font.widthOfTextAtSize(pageText, 8);
  page.drawText(pageText, { x: (595.28 - textWidth) / 2, y: 30, size: 8, font, color: gray });
}

/**
 * drawOrderPageHeader returns an anchor below the title row; logos extend further down (~y = marginY - 100).
 * Continuation pages have no Bill-to block — do not use a large offset (e.g. -260) or a huge blank gap appears.
 */
const ORDER_PDF_CONTINUATION_ITEMS_Y_OFFSET = 56;

/**
 * Generates the order PDF and returns it as a Buffer.
 */
export async function generateOrderPdfBuffer(
  order: OrderForPdf,
  client: ClientForPdf | null,
  options: GenerateOrderPdfOptions = {}
): Promise<Buffer> {
  const printReference = options.printReference === true;
  const headerTitle = options.headerTitle ?? 'Order';
  const detailsSectionTitle = options.detailsSectionTitle ?? 'Order details';
  const documentNumberLabel = options.documentNumberLabel ?? 'Order no.:';
  const documentNumberValue = options.documentNumberValue ?? String(order.id);
  const dateLabel = options.dateLabel ?? 'Order date:';
  const rightDetailCaption =
    options.rightDetailCaption ?? 'Valid per applicable terms and conditions';
  const showDispatchAndPaymentDetails = options.showDispatchAndPaymentDetails !== false;

  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = currentPage.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.5, 0.5, 0.5);
  const lightGray = rgb(0.95, 0.95, 0.95);
  const logoBlue = rgb(0 / 255, 115 / 255, 185 / 255);
  const lightBlueBg = rgb(236 / 255, 246 / 255, 254 / 255);

  let proshelLogo: unknown = null;
  let ipmachLogo: unknown = null;
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const proshelLogoPath = path.join(publicDir, 'proshel-logo-new.png');
    if (fs.existsSync(proshelLogoPath)) {
      proshelLogo = await pdfDoc.embedPng(new Uint8Array(fs.readFileSync(proshelLogoPath)));
    }
    const promachLogoPath = path.join(publicDir, 'promach-solutions-logo.png');
    if (fs.existsSync(promachLogoPath)) {
      ipmachLogo = await pdfDoc.embedPng(new Uint8Array(fs.readFileSync(promachLogoPath)));
    }
  } catch (error) {
    console.error('Error loading logos for order PDF:', error);
  }

  let yPosition = drawOrderPageHeader(
    currentPage,
    proshelLogo,
    ipmachLogo,
    order.id,
    height,
    font,
    boldFont,
    logoBlue,
    headerTitle
  );

  yPosition -= 40;
  currentPage.drawRectangle({
    x: 40,
    y: yPosition - 100,
    width: width - 80,
    height: 120,
    color: lightBlueBg,
  });

  const billToY = yPosition;
  const clientDisplayName = order.clientName || client?.username || `ID: ${order.clientId}`;
  currentPage.drawText('Bill to', { x: 50, y: billToY, size: 10, font: boldFont, color: black });
  let currentBillToY = billToY - 15;
  currentPage.drawText(sanitizeTextForPDF(clientDisplayName), { x: 50, y: currentBillToY, size: 10, font, color: black });
  currentBillToY -= 12;
  if (client?.address) {
    for (const line of wrapText(client.address, 40)) {
      currentPage.drawText(sanitizeTextForPDF(line), { x: 50, y: currentBillToY, size: 10, font, color: black });
      currentBillToY -= 12;
    }
  }
  const cityState = [client?.city, client?.stateOrDepartment].filter(Boolean).join(', ');
  if (cityState) {
    currentPage.drawText(sanitizeTextForPDF(cityState), { x: 50, y: currentBillToY, size: 10, font, color: black });
    currentBillToY -= 12;
  }
  if (client?.country) {
    currentPage.drawText(sanitizeTextForPDF(client.country), { x: 50, y: currentBillToY, size: 10, font, color: black });
  }
  if (client?.email) {
    currentBillToY -= 12;
    currentPage.drawText(sanitizeTextForPDF(client.email), { x: 50, y: currentBillToY, size: 9, font, color: black });
  }
  if (client?.phoneNumber) {
    currentBillToY -= 10;
    currentPage.drawText(sanitizeTextForPDF(client.phoneNumber), { x: 50, y: currentBillToY, size: 9, font, color: black });
  }

  currentPage.drawText('Ship to', { x: 300, y: billToY, size: 10, font: boldFont, color: black });
  let currentShipToY = billToY - 15;
  currentPage.drawText(sanitizeTextForPDF(clientDisplayName), { x: 300, y: currentShipToY, size: 10, font, color: black });
  currentShipToY -= 12;
  if (client?.address) {
    for (const line of wrapText(client.address, 40)) {
      currentPage.drawText(sanitizeTextForPDF(line), { x: 300, y: currentShipToY, size: 10, font, color: black });
      currentShipToY -= 12;
    }
  }
  if (cityState) {
    currentPage.drawText(sanitizeTextForPDF(cityState), { x: 300, y: currentShipToY, size: 10, font, color: black });
    currentShipToY -= 12;
  }
  if (client?.country) {
    currentPage.drawText(sanitizeTextForPDF(client.country), { x: 300, y: currentShipToY, size: 10, font, color: black });
  }

  yPosition -= 110;
  currentPage.drawText(detailsSectionTitle, { x: 50, y: yPosition, size: 10, font: boldFont, color: black });
  currentPage.drawText(`${documentNumberLabel} ${documentNumberValue}`, { x: 300, y: yPosition, size: 10, font, color: black });
  yPosition -= 15;
  currentPage.drawText(
    `${dateLabel} ${new Date(order.createdAt).toLocaleDateString('en-US')}`,
    { x: 50, y: yPosition, size: 9, font, color: black }
  );
  currentPage.drawText(rightDetailCaption, { x: 300, y: yPosition, size: 9, font, color: black });
  yPosition -= 14;
  const incotermTrimmed = client?.incoterm?.trim();
  if (incotermTrimmed) {
    currentPage.drawText(`Incoterm: ${sanitizeTextForPDF(incotermTrimmed)}`, {
      x: 50,
      y: yPosition,
      size: 9,
      font: boldFont,
      color: black,
    });
    yPosition -= 12;
  }
  yPosition -= 6;

  // Order details: name, dispatch, payment
  const hasOrderDetails =
    showDispatchAndPaymentDetails && !!(order.orderName || order.dispatchType || order.paymentMethod);
  if (hasOrderDetails) {
    currentPage.drawText('Order details', { x: 50, y: yPosition, size: 10, font: boldFont, color: black });
    yPosition -= 14;

    if (order.orderName?.trim()) {
      currentPage.drawText(`Name: ${sanitizeTextForPDF(order.orderName)}`, { x: 50, y: yPosition, size: 9, font, color: black });
      yPosition -= 12;
    }

    if (order.dispatchType?.trim()) {
      const dispatchLabel = order.dispatchType === 'pickup'
        ? 'Customer pickup at IPMach warehouse'
        : order.dispatchType === 'international_carrier'
          ? 'IPMach ships to carrier (Miami)'
          : order.dispatchType;
      let dispatchLine = `Dispatch: ${dispatchLabel}`;
      if (order.dispatchType === 'pickup' && (order.pickupEntity?.trim() || order.pickupName?.trim())) {
        dispatchLine += ` – ${[order.pickupEntity, order.pickupName].filter(Boolean).join(', ')}`;
      } else if (order.dispatchType === 'international_carrier' && order.carrierName?.trim()) {
        dispatchLine += ` – ${sanitizeTextForPDF(order.carrierName)}`;
        if (order.carrierAddress?.trim() || order.carrierPhone?.trim() || order.carrierContactName?.trim()) {
          const extra = [order.carrierAddress, order.carrierPhone, order.carrierContactName].filter(Boolean).map((s) => sanitizeTextForPDF(String(s)));
          if (extra.length) dispatchLine += ` (${extra.join(', ')})`;
        }
      }
      for (const line of wrapText(dispatchLine, 75)) {
        currentPage.drawText(line, { x: 50, y: yPosition, size: 9, font, color: black });
        yPosition -= 12;
      }
    }

    if (order.paymentMethod?.trim()) {
      const paymentLabel = order.paymentMethod === 'credit_line'
        ? 'Credit line'
        : order.paymentMethod === 'transfer'
          ? 'Bank transfer'
          : order.paymentMethod === 'zelle'
            ? 'Zelle'
            : order.paymentMethod === 'stripe'
              ? 'Card (Stripe)'
            : order.paymentMethod;
      currentPage.drawText(`Payment method: ${sanitizeTextForPDF(paymentLabel)}`, { x: 50, y: yPosition, size: 9, font, color: black });
      yPosition -= 12;
    }

    yPosition -= 8;
  }

  yPosition = drawOrderTableHeaders(currentPage, yPosition, printReference, font, boldFont, black, lightGray);

  const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
  const minYPosition = 150;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      yPosition -= 15;
      continue;
    }

    if (yPosition < minYPosition) {
      currentPage = pdfDoc.addPage([595.28, 841.89]);
      const newHeaderY = drawOrderPageHeader(
        currentPage,
        proshelLogo,
        ipmachLogo,
        order.id,
        height,
        font,
        boldFont,
        logoBlue,
        headerTitle
      );
      yPosition = newHeaderY - ORDER_PDF_CONTINUATION_ITEMS_Y_OFFSET;
      currentPage.drawText('ITEMS (continued)', { x: 50, y: yPosition, size: 14, font: boldFont, color: logoBlue });
      yPosition -= 20;
      yPosition = drawOrderTableHeaders(currentPage, yPosition, printReference, font, boldFont, black, lightGray);
    }

    currentPage.drawText((i + 1).toString() + '.', { x: 42, y: yPosition, size: 9, font, color: black });

    if (printReference) {
      const reference = typeof item.reference === 'string' ? item.reference : '';
      currentPage.drawText(sanitizeTextForPDF(reference), { x: 65, y: yPosition, size: 9, font, color: black });
    }

    let description = typeof item.description === 'string' ? item.description : '';
    const brand = typeof item.brand === 'string' ? item.brand : '';
    if (brand) description = description ? `${brand} - ${description}` : brand;
    description = (description as string).replace(/Costex/gi, 'Importacion');
    description = sanitizeTextForPDF(description);
    const truncatedDesc = description.length > 35 ? description.substring(0, 35) + '...' : description;
    currentPage.drawText(truncatedDesc, {
      x: printReference ? 150 : 65,
      y: yPosition,
      size: 9,
      font,
      color: black,
    });

    const quantityVal = typeof item.quantity === 'number' ? item.quantity : 1;
    currentPage.drawText(String(quantityVal), {
      x: printReference ? 350 : 320,
      y: yPosition,
      size: 9,
      font,
      color: black,
    });

    const unitPriceVal = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
    currentPage.drawText(formatCurrencyForPDF(unitPriceVal), {
      x: printReference ? 420 : 390,
      y: yPosition,
      size: 9,
      font,
      color: black,
    });

    const totalPriceVal = typeof item.totalPrice === 'number' ? item.totalPrice : unitPriceVal * quantityVal;
    currentPage.drawText(formatCurrencyForPDF(totalPriceVal), {
      x: printReference ? 500 : 480,
      y: yPosition,
      size: 9,
      font,
      color: black,
    });

    const lineY = yPosition - 3;
    currentPage.drawLine({
      start: { x: 40, y: lineY },
      end: { x: 555, y: lineY },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
    yPosition -= 20;
  }

  if (yPosition < 200) {
    currentPage = pdfDoc.addPage([595.28, 841.89]);
    const newHeaderY = drawOrderPageHeader(
      currentPage,
      proshelLogo,
      ipmachLogo,
      order.id,
      height,
      font,
      boldFont,
      logoBlue,
      headerTitle
    );
    yPosition = newHeaderY - 100;
  }

  const summedSubtotal = items.reduce((sum, it) => {
    const q = toNum(it?.quantity);
    const unit = toNum(it?.unitPrice);
    const fallbackLine = unit * (q || 1);
    const line = toNum(it?.totalPrice) || fallbackLine;
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0);

  const override = options.totalsOverride;
  let subtotal: number;
  let discountPercent: number;
  let discountAmount: number;
  let total: number;
  if (override && Number.isFinite(override.total)) {
    subtotal = override.subtotal;
    discountAmount = Math.max(0, override.discountAmount);
    discountPercent = Math.max(0, override.discountPercent);
    total = Math.max(0, override.total);
  } else {
    subtotal = summedSubtotal;
    discountPercent = toNum(order.discountPercent);
    const computedDiscountAmount = subtotal * (Math.max(0, discountPercent) / 100);
    discountAmount = toNum(order.discountAmount) >= 0 ? toNum(order.discountAmount) : computedDiscountAmount;
    total = Math.max(0, subtotal - Math.min(discountAmount, subtotal));
  }

  yPosition -= 16;
  currentPage.drawText('Subtotal:', { x: 420, y: yPosition, size: 10, font, color: black });
  currentPage.drawText(formatCurrencyForPDF(subtotal), { x: 500, y: yPosition, size: 10, font, color: black });
  yPosition -= 16;
  currentPage.drawText(`Discount (${discountPercent.toFixed(1)}%):`, { x: 380, y: yPosition, size: 10, font, color: black });
  currentPage.drawText(`${discountAmount > 0 ? '-' : ''}${formatCurrencyForPDF(Math.abs(discountAmount))}`, { x: 500, y: yPosition, size: 10, font, color: black });
  yPosition -= 14;
  currentPage.drawLine({ start: { x: 350, y: yPosition }, end: { x: 555, y: yPosition }, thickness: 1, color: gray });
  yPosition -= 18;
  currentPage.drawText('TOTAL:', { x: 440, y: yPosition, size: 12, font: boldFont, color: black });
  currentPage.drawText(formatCurrencyForPDF(total), { x: 500, y: yPosition, size: 12, font: boldFont, color: black });

  if (order.observations?.trim()) {
    yPosition -= 50;
    if (yPosition < 100) {
      currentPage = pdfDoc.addPage([595.28, 841.89]);
      const newHeaderY = drawOrderPageHeader(
        currentPage,
        proshelLogo,
        ipmachLogo,
        order.id,
        height,
        font,
        boldFont,
        logoBlue,
        headerTitle
      );
      yPosition = newHeaderY - 100;
    }
    currentPage.drawText('NOTES:', { x: 50, y: yPosition, size: 12, font: boldFont, color: black });
    yPosition -= 20;
    const sanitizedObservations = sanitizeTextForPDF(order.observations);
    const maxWidth = 500;
    const words = sanitizedObservations.split(' ');
    let currentLine = '';
    const lines: string[] = [];
    for (const word of words) {
      const testLine = sanitizeTextForPDF(currentLine + (currentLine ? ' ' : '') + word);
      const textWidth = font.widthOfTextAtSize(testLine, 10);
      if (textWidth > maxWidth && currentLine) {
        lines.push(sanitizeTextForPDF(currentLine));
        currentLine = sanitizeTextForPDF(word);
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(sanitizeTextForPDF(currentLine));
    for (const line of lines) {
      if (yPosition < 50) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        const newHeaderY = drawOrderPageHeader(
          currentPage,
          proshelLogo,
          ipmachLogo,
          order.id,
          height,
          font,
          boldFont,
          logoBlue,
          headerTitle
        );
        yPosition = newHeaderY - 50;
      }
      currentPage.drawText(sanitizeTextForPDF(line), { x: 50, y: yPosition, size: 10, font, color: black });
      yPosition -= 15;
    }
  }

  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const page = pdfDoc.getPage(i);
    drawPageNumber(page, i + 1, totalPages, font, gray);
    if (i === totalPages - 1) {
      page.drawText('Spare parts system - Motor Parts System', { x: 50, y: 15, size: 8, font, color: gray });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
