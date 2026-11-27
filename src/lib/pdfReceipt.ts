import { jsPDF } from 'jspdf';
import type { Donation, DonationTarget } from '@/types/amanat';
import { getPublicAppUrl } from '@/lib/utils';

export function downloadAmanatCertificatePDF(
  donation: Donation,
  target: DonationTarget,
  qrCanvasElement?: HTMLCanvasElement | null
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Deep emerald header banner
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, 210, 48, 'F');

  // Gold accent strip
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 48, 210, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('AMANAT — SACRED TRUST CERTIFICATE', 16, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text('Direct Vendor Escrow Receipt · 0% Platform Fee · Punjab, Pakistan', 16, 32);
  doc.text(`Certificate QR Hash: ${donation.receipt_qr_hash}`, 16, 40);

  // Body card border
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 249);
  doc.roundedRect(14, 60, 182, 128, 4, 4, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('VERIFIED ESCROW CONTRIBUTION SUMMARY', 22, 74);

  doc.setFontSize(10.5);
  const rows: [string, string][] = [
    ['Target ID', target.code],
    ['Initiative', target.title_en.slice(0, 56)],
    ['District', `${target.district}, Punjab`],
    ['Funding Classification', target.funding_type === 'zakat_eligible' ? 'Zakat Eligible' : 'Sadaqah / General'],
    ['Named Escrow Vendor', target.vendor_name.slice(0, 54)],
    ['Contribution Amount', `PKR ${donation.amount_pkr.toLocaleString('en-PK')}`],
    ['Payment Channel', donation.payment_channel.replace('_', ' ').toUpperCase()],
    ['Transaction Reference', donation.transaction_ref],
    ['Current Escrow Status', donation.status.replace(/_/g, ' ').toUpperCase()],
    ['Timestamp (UTC)', new Date(donation.created_at).toLocaleString('en-GB')],
  ];

  let y = 86;
  for (const [label, val] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`${label}:`, 22, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val, 78, y);
    y += 9.5;
  }

  // Embed QR code canvas if present
  if (qrCanvasElement) {
    try {
      const qrImg = qrCanvasElement.toDataURL('image/png');
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(142, 198, 52, 56, 3, 3, 'FD');
      doc.addImage(qrImg, 'PNG', 148, 203, 40, 40);
      doc.setFontSize(8);
      doc.setTextColor(6, 78, 59);
      doc.text('Scan to Verify Escrow', 168, 249, { align: 'center' });
    } catch {
      // Fallback text if canvas unavailable
    }
  }

  // Integrity pledge box
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(14, 198, 122, 56, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(6, 78, 59);
  doc.text('DIRECT VENDOR ESCROW GUARANTEE', 20, 210);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(30, 41, 59);
  const pledgeLines = doc.splitTextToSize(
    'This contribution is ring-fenced exclusively for settlement against the verified pro-forma invoice of the named vendor above. Zero cash is disbursed to intermediaries and 0% administrative fee is deducted.',
    110
  );
  doc.text(pledgeLines, 20, 219);

  const verifyUrl = `${getPublicAppUrl()}/?verify=${encodeURIComponent(donation.receipt_qr_hash)}`;

  doc.setFontSize(8.2);
  doc.setTextColor(6, 78, 59);
  doc.text(`Verify live online: ${verifyUrl}`, 105, 270, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Generated locally in your browser by Amanat PWA — Sacred Trust & Direct Welfare.',
    105,
    278,
    { align: 'center' }
  );

  doc.save(`Amanat-Certificate-${target.code}-${donation.receipt_qr_hash}.pdf`);
}
