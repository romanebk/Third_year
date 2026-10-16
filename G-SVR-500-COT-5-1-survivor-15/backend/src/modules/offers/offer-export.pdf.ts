import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { Offer } from '@prisma/client';
import { wgs84ToLambert93 } from '../geocoding/lambert93';

const FOREST = '#1B4332';
const INK = '#141715';
const MUTED = '#6B726E';

/** Fiche PDF imprimable d'une offre, identité neutre (vert forêt + Inter/Helvetica en fallback PDF). */
export function streamOfferPdf(res: Response, offer: Offer & { companyName: string }): void {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="offre-${offer.id}.pdf"`);
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 90).fill(FOREST);
  doc
    .fillColor('#FFFFFF')
    .fontSize(20)
    .text('GéoEmploi', 56, 34, { continued: false });

  doc.moveDown(3);
  doc.fillColor(INK).fontSize(22).text(offer.title, { width: 480 });
  doc.fillColor(MUTED).fontSize(12).text(offer.companyName);
  doc.moveDown(1);

  const line = (label: string, value: string | null | undefined) => {
    if (!value) return;
    doc.fillColor(MUTED).fontSize(10).text(label.toUpperCase(), { continued: false });
    doc.fillColor(INK).fontSize(12).text(value);
    doc.moveDown(0.6);
  };

  line('Commune', offer.commune);
  line('Contrat', offer.contractType);
  line(
    'Salaire',
    offer.salaryMin || offer.salaryMax
      ? `${offer.salaryMin ?? '?'} - ${offer.salaryMax ?? '?'} € (${offer.salaryKind ?? 'brut'})`
      : null,
  );
  line('Expérience', offer.experienceLevel);
  line('Temps de travail', offer.workTime);

  // Coordonnées en Lambert-93 (EPSG:2154), en plus du WGS84 conservé en base :
  // exigence T. Vignal, toute coordonnée exposée dans un export doit l'être
  // dans les deux systèmes.
  const lambert = wgs84ToLambert93(offer.latitude, offer.longitude);
  line('Coordonnées (WGS84)', `${offer.latitude}, ${offer.longitude}`);
  line('Coordonnées (Lambert-93, EPSG:2154)', `X=${lambert.x} m, Y=${lambert.y} m`);

  doc.moveDown(0.5);
  doc.fillColor(MUTED).fontSize(10).text('DESCRIPTION');
  doc.fillColor(INK).fontSize(11).text(offer.description, { width: 480 });

  doc.moveDown(2);
  doc
    .fontSize(8.5)
    .fillColor(MUTED)
    .text('Démonstrateur technique, ne constitue pas un service public en exploitation.', {
      width: 480,
    });

  doc.end();
}
