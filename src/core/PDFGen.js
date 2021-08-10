import { PDFDocument, StandardFonts } from 'pdf-lib';
import config from '../config/config';
import * as util from '../util/util';

const fs = require('fs');

// Generate audit log PDF
export async function genAuditLog(sessID, patientName, sessData) {
      const pdf = await PDFDocument.create();

      const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
      const times = await pdf.embedFont(StandardFonts.TimesRoman);
      const courierBold = await pdf.embedFont(StandardFonts.CourierBold);

      const page = pdf.addPage();
      const { width, height } = page.getSize();
      const f1 = 15, 
            f2 = 12, 
            f3 = 10;
      const ls1 = f2 * 1.5, 
            ls2 = f2 * 3.5,
            ls3 = f3 * 1.2;

      // 0, 0 is bottom left of page
      const pdfX = 72;
      var pdfY = height - pdfX;

      page.drawText('Work Session Time Audit Log', { x: pdfX, y: pdfY, size: 16, font: timesBold, size: f1 }); pdfY -= ls1;
      page.drawText('Remote Patient Monitoring Clinical Work', { x: pdfX, y: pdfY, size: 16, font: timesBold, size: f1 }); pdfY -= ls2;

      page.drawText(`Patient Name: ${patientName}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
      const split = sessData.clinician_name.split(' ');
      page.drawText(`Care Manager: ${split[1]}, ${split[0]}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
      page.drawText(`Activity Type: ${sessData.work_type}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      page.drawText(`Time Logged By: ${sessData.clinician_name}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
      page.drawText(`IP Address: ${sessData.clinician_IP}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
      page.drawText(`Audit Software Version: ${sessData.log_method}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      const startSplit = sessData.start_time.split(', ');
      const endSplit = sessData.end_time.split(', ');
      page.drawText(`Date of Work Session: ${startSplit[0]}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
      page.drawText(`Work Session ID: ${sessID}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      const { hours, minutes, seconds } = util.deconstructDuration(sessData.duration);
      const durationStr = `${hours} hr, ${minutes} min, ${seconds} sec`;
      page.drawText(`Total Duration of Work Session: ${durationStr}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      page.drawText(`Video Audit Log: ${sessData.video_audit}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      page.drawText('AUDIT LOG:', { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      page.drawText(`${startSplit[1]} EDT to ${endSplit[1]} EDT (${durationStr})`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      page.drawText('Screen Recording?       YES', { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
      page.drawText(`Webcam Recording?    ${config.get('useWebcam') ? 'YES' : 'NO'}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

      const nowSplit = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }).split(', ');
      page.drawText(`This work session time audit log was programmatically generated, without`, { x: pdfX, y: pdfY, font: timesBold, size: f3 }); pdfY -= ls3;
      page.drawText(`human intervention, by tamper-proof software on ${nowSplit[0]} at ${nowSplit[1]} EDT`, { x: pdfX, y: pdfY, font: timesBold, size: f3 });

      fs.writeFileSync(`out/${sessID}/audit.pdf`, await pdf.save());
}