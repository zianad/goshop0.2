import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { amiriFont } from './fonts';

export const setupPdfDoc = (doc: jsPDF, language: 'fr' | 'ar') => {
    try {
        if (!amiriFont || !amiriFont.includes(',')) {
            throw new Error('Invalid font data URI');
        }
        const amiriFontB64 = amiriFont.split(',')[1];
        
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontB64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
    } catch (e) {
        console.error("Error loading custom font for PDF, falling back to default.", e);
        // Fallback to a default font if Amiri fails to load
        doc.setFont('helvetica');
    }
};

export const exportToPdf = (title: string, headers: string[], body: (string|number)[][], filename: string, language: 'fr' | 'ar', noDataMessage: string) => {
    if (body.length === 0) {
        alert(noDataMessage);
        return;
    }

    const doc = new jsPDF();
    setupPdfDoc(doc, language);

    doc.setFontSize(18);
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    autoTable(doc, {
        head: [headers],
        body: body,
        startY: 30,
        theme: 'grid',
        styles: {
            font: 'Amiri',
            halign: language === 'ar' ? 'right' : 'left',
            cellPadding: 2,
            fontSize: 10
        },
        headStyles: {
            fillColor: [38, 166, 154], // teal-like color
            textColor: 255,
            halign: 'center',
        },
    });

    const dateSuffix = new Date().toLocaleDateString(language.split('-')[0]);
    doc.save(`${filename}_${dateSuffix}.pdf`);
};


export const filterByDateRange = <T extends { date: string }>(
  items: T[], 
  range: string, 
  customRange: { start: string, end: string }
): T[] => {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = new Date();
  endDate.setHours(23, 59, 59, 999);

  switch (range) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'custom':
      startDate = customRange.start ? new Date(customRange.start) : null;
      endDate = customRange.end ? new Date(customRange.end) : null;
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(23, 59, 59, 999);
      break;
    default: // 'all'
      return items;
  }

  return items.filter(item => {
    const itemDate = new Date(item.date);
    const afterStart = startDate ? itemDate >= startDate : true;
    const beforeEnd = endDate ? itemDate <= endDate : true;
    return afterStart && beforeEnd;
  });
};
