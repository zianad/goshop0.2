import React, { useState, useMemo, useEffect } from 'react';
import type { Customer, Sale } from '../types.ts';
import { UsersIcon, FileDownIcon, TrashIcon, PrinterIcon, FileTextIcon, HistoryIcon, XIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons.tsx';
import { exportToPdf, setupPdfDoc } from '../utils/helpers.ts';
import { translations } from '../translations.ts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface CustomerHistoryModalProps {
    customer: Customer;
    sales: Sale[];
    debt: number;
    onClose: () => void;
    t: TFunction;
    language: Language;
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({ customer, sales, debt, onClose, t, language }) => {
    const customerSales = useMemo(() => {
        return sales.filter(s => s.customerId === customer.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, customer.id]);

    const totalPurchases = useMemo(() => {
        return customerSales.reduce((sum, s) => sum + s.total, 0);
    }, [customerSales]);

    const handlePrintReport = () => {
        const doc = new jsPDF();
        setupPdfDoc(doc, language);

        // Header
        doc.setFontSize(18);
        const title = t('purchaseHistoryFor', { name: customer.name });
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

        // Customer Info & Summary
        doc.setFontSize(12);
        doc.text(`${t('customer')}: ${customer.name}`, 14, 30);
        doc.text(`${t('phone')}: ${customer.phone}`, 14, 36);
        doc.text(`${t('totalPurchases')}: ${totalPurchases.toFixed(2)} DH`, 14, 42);
        doc.text(`${t('currentDebt')}: ${debt.toFixed(2)} DH`, 14, 48);
        
        const tableBody: any[] = [];
        const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';

        customerSales.forEach(sale => {
            const saleDate = new Date(sale.date).toLocaleDateString(locale);
             tableBody.push([
                {
                    content: `${t('invoiceNumber')} ${sale.id.slice(-6).toUpperCase()} | ${saleDate} | Total: ${sale.total.toFixed(2)} DH | ${t('remainingAmountLabel')}: ${sale.remainingAmount.toFixed(2)} DH`,
                    colSpan: 4,
                    styles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' }
                }
            ]);
            
            sale.items.forEach(item => {
                tableBody.push([
                    `  ${item.name}`,
                    item.quantity,
                    item.price.toFixed(2),
                    (item.