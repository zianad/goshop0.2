import React from 'react';
import type { Product, ProductVariant, Supplier } from '../types.ts';
import { translations } from '../translations.ts';

type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface LowStockAlertProps {
  products: Product[];
  variants: ProductVariant[];
  suppliers: Supplier[];
  t: TFunction;
}

const LowStockAlert: React.FC<LowStockAlertProps> = ({ products, variants, suppliers, t }) => {
  if (variants.length === 0) return null;

  return (
    <div className="bg-orange-100 dark:bg-orange-900/50 border-r-4 rtl:border-l-4 rtl:border-r-0 border-orange-500 text-orange-700 dark:text-orange-300 p-4 rounded-lg shadow-md mb-6" role="alert">
      <p className="font-bold">{t('lowStockAlert')}</p>
      <p className="text-sm">{t('lowStockMessage')}</p>
      <ul className="list-disc list-inside mr-2 rtl:ml-2 rtl:mr-0 mt-2 text-sm">
        {variants.map(v => {
          const product = products.find(p => p.id === v.productId);
          if (!product) return null;
          return (
            <li key={v.id}>
              <strong>{product.name} - {v.name}</strong>
              {product.supplierId && (
                  <span className="text-xs text-orange-600 dark:text-orange-400"> ({t('suppliers')}: {suppliers.find(s => s.id === product.supplierId)?.name || t('unknown')})</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LowStockAlert;