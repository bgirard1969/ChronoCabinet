import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { MovementsService } from './movements.service';
import * as XLSX from 'xlsx';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

const TYPE_LABELS: Record<string, string> = {
  prelevement: 'Pr\u00e9l\u00e8vement',
  reception: 'R\u00e9ception',
  placement: 'Plac\u00e9',
  consommation: 'Consomm\u00e9',
  facturation: 'Factur\u00e9',
  retour: 'Retour',
};

@UseGuards(AuthGuard('jwt'))
@Controller('api/movements')
export class MovementsController {
  constructor(private readonly service: MovementsService) {}

  @Get()
  findAll(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('type') type?: string,
    @Query('serial_number') sn?: string,
    @Query('lot_number') lot?: string,
  ) {
    return this.service.findAll({ date_from: dateFrom, date_to: dateTo, type, serial_number: sn, lot_number: lot });
  }

  @Get('export/excel')
  async exportExcel(
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('type') type: string,
    @Query('serial_number') sn: string,
    @Query('lot_number') lot: string,
    @Res() res: Response,
  ) {
    const data = await this.service.exportData({ date_from: dateFrom, date_to: dateTo, type, serial_number: sn, lot_number: lot });
    const rows = data.map((m: any) => ({
      'Date': m.timestamp ? new Date(m.timestamp).toISOString().slice(0, 10) : '',
      'Type': TYPE_LABELS[m.type] || m.type,
      'Produit': m.product_description || '',
      'N\u00b0 S\u00e9rie': m.serial_number || '',
      'N\u00b0 Lot': m.lot_number || '',
      'Emplacement': m.location_display || '',
      'Utilisateur': m.user_name || '',
      'D\u00e9tail': m.reason || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mouvements');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `mouvements_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${filename}`,
    });
    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPdf(
    @Query('date_from') dateFrom: string,
    @Query('date_to') dateTo: string,
    @Query('type') type: string,
    @Query('serial_number') sn: string,
    @Query('lot_number') lot: string,
    @Res() res: Response,
  ) {
    const data = await this.service.exportData({ date_from: dateFrom, date_to: dateTo, type, serial_number: sn, lot_number: lot });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    // Title
    doc.fontSize(16).text('Mouvements - Chrono DMI', { align: 'center' });
    doc.fontSize(9).text(`Export du ${new Date().toLocaleDateString('fr-CA')}`, { align: 'center' });
    doc.moveDown(1);

    // Table header
    const cols = [
      { label: 'Date', x: 30, w: 80 },
      { label: 'Type', x: 110, w: 80 },
      { label: 'Produit', x: 190, w: 180 },
      { label: 'N\u00b0 S\u00e9rie', x: 370, w: 100 },
      { label: 'N\u00b0 Lot', x: 470, w: 80 },
      { label: 'Emplacement', x: 550, w: 100 },
      { label: 'Utilisateur', x: 650, w: 90 },
      { label: 'D\u00e9tail', x: 740, w: 72 },
    ];

    let y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    for (const c of cols) {
      doc.text(c.label, c.x, y, { width: c.w, ellipsis: true });
    }
    y += 14;
    doc.moveTo(30, y).lineTo(812 - 30, y).stroke();
    y += 4;

    doc.font('Helvetica').fontSize(7);
    for (const m of data as any[]) {
      if (y > 560) {
        doc.addPage();
        y = 30;
        doc.font('Helvetica-Bold').fontSize(8);
        for (const c of cols) doc.text(c.label, c.x, y, { width: c.w, ellipsis: true });
        y += 14;
        doc.moveTo(30, y).lineTo(812 - 30, y).stroke();
        y += 4;
        doc.font('Helvetica').fontSize(7);
      }
      const ts = m.timestamp ? new Date(m.timestamp).toISOString().slice(0, 10) : '';
      doc.text(ts, cols[0].x, y, { width: cols[0].w, ellipsis: true });
      doc.text(TYPE_LABELS[m.type] || m.type, cols[1].x, y, { width: cols[1].w, ellipsis: true });
      doc.text(m.product_description || '', cols[2].x, y, { width: cols[2].w, ellipsis: true });
      doc.text(m.serial_number || '', cols[3].x, y, { width: cols[3].w, ellipsis: true });
      doc.text(m.lot_number || '', cols[4].x, y, { width: cols[4].w, ellipsis: true });
      doc.text(m.location_display || '', cols[5].x, y, { width: cols[5].w, ellipsis: true });
      doc.text(m.user_name || '', cols[6].x, y, { width: cols[6].w, ellipsis: true });
      doc.text(m.reason || '', cols[7].x, y, { width: cols[7].w, ellipsis: true });
      y += 12;
    }

    doc.end();
    const pdfBuffer = await pdfReady;
    const filename = `mouvements_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`,
    });
    res.send(pdfBuffer);
  }
}
