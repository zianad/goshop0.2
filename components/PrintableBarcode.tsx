import React, { useEffect } from 'react';
import type { Product, ProductVariant } from '../types.ts';
import { translations } from '../translations.ts';

type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface PrintableBarcodeProps {
    variant: ProductVariant;
    product: Product;
    onDone: () => void;
    t: TFunction;
}

export const PrintableBarcode: React.FC<PrintableBarcodeProps> = ({ variant, product, onDone, t }) => {
    useEffect(() => {
        const handleAfterPrint = () => {
            window.removeEventListener('afterprint', handleAfterPrint);
            onDone();
        };

        window.addEventListener('afterprint', handleAfterPrint);
        
        // Timeout as a fallback for browsers that might not fire afterprint consistently
        const timer = setTimeout(() => {
            handleAfterPrint();
        }, 500);

        window.print();

        return () => {
            clearTimeout(timer);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, [onDone]);

    if (!variant.barcode) return null;

    return (
        <div id="printable-barcode" className="p-2 bg-white text-black font-sans" style={{ width: '80mm', height: '40mm', boxSizing: 'border-box' }}>
            <div className="border border-black p-2 h-full flex flex-col justify-between items-center text-center">
                <div className="w-full">
                    <p className="font-bold text-lg truncate">{product.name}</p>
                    <p className="text-sm truncate">{variant.name}</p>
                </div>
                <div className="w-full my-1">
                    {/* A simple visual representation of a barcode */}
                    <div className="flex justify-center items-end h-10 overflow-hidden">
                        {variant.barcode.split('').map((char, index) => (
                            <div 
                                key={index} 
                                className="bg-black" 
                                style={{ 
                                    width: `${(parseInt(char, 16) % 3) + 1}px`, // Varying widths for visual effect
                                    height: `${(parseInt(char, 16) % 40) + 40}%`
                                }}
                            ></div>
                        ))}
                    </div>
                    <p className="font-mono tracking-widest text-lg mt-1">{variant.barcode}</p>
                </div>
                <p className="font-extrabold text-xl">{variant.price.toFixed(2)} DH</p>
            </div>
        </div>
    );
};
