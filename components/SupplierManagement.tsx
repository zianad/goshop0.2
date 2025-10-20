import React, { useState, useMemo, useEffect } from 'react';
// FIX: Add 'StockBatch' to type import.
import type { Supplier, Purchase, Product, ProductVariant, PurchaseItem, Category, StockBatch } from '../types';
import { TruckIcon, PlusIcon, TrashIcon, FileDownIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons';
import { exportToPdf } from '../utils/helpers';
import { translations } from '../translations';
import * as api from '../api';


type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

// MODAL: Purchase History
const PurchaseHistoryModal: React.FC<{
    supplier: Supplier;
    purchases: Purchase[];
    onClose: () => void;
    t: TFunction;
    language: Language;
}> = ({ supplier, purchases, onClose, t, language }) => {
    const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] flex flex-col">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('purchaseHistoryFor', { name: supplier.name })}</h3>
                <div className="flex-grow overflow-y-auto pr-2">
                    {purchases.length === 0 ? (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-16">{t('noPurchasesYet')}</p>
                    ) : (
                        <ul className="space-y-4">
                            {purchases.slice().reverse().map(p => (
                                <li key={p.id} className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-start mb-2 flex-wrap">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{t('purchaseDate')}: {new Date(p.date).toLocaleDateString(locale)}</p>
                                            {p.reference && <p className="text-sm text-slate-500 dark:text-slate-400">{t('reference')}: {p.reference}</p>}
                                        </div>
                                        <div className='text-right rtl:text-left'>
                                             <p className="font-bold text-teal-600 dark:text-teal-400 text-lg">{p.totalAmount.toFixed(2)} DH</p>
                                             {p.remainingAmount > 0 && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300">{t('remainingDebt')}: {p.remainingAmount.toFixed(2)} DH</span>}
                                        </div>
                                    </div>
                                    <details>
                                        <summary className="text-sm font-semibold text-teal-700 dark:text-teal-400 cursor-pointer">{t('purchaseDetails')}</summary>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm mt-2 text-slate-700 dark:text-slate-600">
                                                <thead className="bg-gray-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    <tr className={language === 'ar' ? 'text-right' : 'text-left'}>
                                                        <th className="p-2 font-semibold">{t('products')}</th>
                                                        <th className="p-2 font-semibold text-center">{t('quantity')}</th>
                                                        <th className="p-2 font-semibold text-center">{t('purchasePrice')}</th>
                                                        <th className="p-2 font-semibold">{t('total')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                {p.items.map((item, index) => (
                                                    <tr key={item.variantId + index} className={`border-b dark:border-slate-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                                        <td className="p-2 text-slate-800 dark:text-slate-200">{item.productName} - {item.variantName}</td>
                                                        <td className="p-2 text-center text-slate-800 dark:text-slate-200">{item.quantity}</td>
                                                        <td className="p-2 text-center text-slate-800 dark:text-slate-200">{item.purchasePrice.toFixed(2)} DH</td>
                                                        <td className="p-2 text-slate-800 dark:text-slate-200">{(item.quantity * item.purchasePrice).toFixed(2)} DH</td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('close')}</button>
                </div>
            </div>
        </div>
    );
};

type VariantFormData = Omit<ProductVariant, 'id' | 'productId' | 'storeId'> & { stockQuantity: number };

interface NewPurchaseModalProps {
    supplier: Supplier;
    products: Product[];
    variants: ProductVariant[];
    categories: Category[];
    onClose: () => void;
    onSave: (purchase: Omit<Purchase, 'id'>) => Promise<void>;
    addProduct: (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id' | 'productId' | 'storeId'> & { stockQuantity?: number | undefined })[]) => Promise<{ product: Product; variants: ProductVariant[]; }>;
    t: TFunction;
    storeId: string;
    language: Language; // FIX: Add language to props
}

// MODAL: New Purchase
const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({ supplier, products, variants, categories, onClose, onSave, addProduct, t, storeId, language }) => {
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [reference, setReference] = useState('');
    const [showNewProductForm, setShowNewProductForm] = useState(false);
    
    // State for the new product form
    const [newProductName, setNewProductName] = useState('');
    const [newProductImage, setNewProductImage] = useState('');
    const [newProductCategoryId, setNewProductCategoryId] = useState('');
    const [newProductVariants, setNewProductVariants] = useState<VariantFormData[]>([
        { name: '', price: 0, purchasePrice: 0, priceSemiWholesale: 0, priceWholesale: 0, barcode: '', lowStockThreshold: 5, image: '', stockQuantity: 1 }
    ]);

    
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState<number | ''>('');

    const productSelectRef = React.useRef<HTMLSelectElement>(null);
    const variantSelectRef = React.useRef<HTMLSelectElement>(null);

    const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);

    const totalAmount = useMemo(() => items.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0), [items]);
    
    useEffect(() => {
        setAmountPaid(totalAmount > 0 ? totalAmount : '');
    }, [totalAmount]);

    const remainingAmount = totalAmount - (typeof amountPaid === 'number' ? amountPaid : 0);

    const handleAddSelectedProduct = () => {
        const variantId = variantSelectRef.current?.value;
        if (!variantId || !selectedProductForVariant) return;
        
        const variant = variants.find(v => v.id === variantId);
        if (!variant) return;

        setItems(prevItems => [...prevItems, {
            variantId: variant.id,
            productId: selectedProductForVariant.id,
            productName: selectedProductForVariant.name,
            variantName: variant.name,
            quantity: 1,
            purchasePrice: variant.purchasePrice || 0
        }]);
        setSelectedProductForVariant(null);
    };

    const addVariantForm = () => {
        setNewProductVariants(prev => [...prev, { name: '', price: 0, purchasePrice: 0, priceSemiWholesale: 0, priceWholesale: 0, barcode: '', lowStockThreshold: 5, image: '', stockQuantity: 1 }]);
    };

    const removeVariantForm = (index: number) => {
        setNewProductVariants(prev => prev.filter((_, i) => i !== index));
    };

    const handleVariantFormChange = (index: number, field: keyof VariantFormData, value: string | number) => {
        const updatedVariants = [...newProductVariants];
        (updatedVariants[index] as any)[field] = value;
        setNewProductVariants(updatedVariants);
    };
    
    const handleNewProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewProductImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleVariantImageFormChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const updatedVariants = [...newProductVariants];
                updatedVariants[index].image = reader.result as string;
                setNewProductVariants(updatedVariants);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleAddNewProductAndToList = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newProductName || newProductVariants.some(v => !v.name || v.price <= 0 || v.purchasePrice <= 0 || v.price <= v.purchasePrice)) {
            alert(t('sellingPriceMustBeHigherError'));
            return;
        }

        const productData: Omit<Product, 'id'> = {
            name: newProductName,
            image: newProductImage || `https://via.placeholder.com/200/f3f4f6/6b7280?text=${encodeURIComponent(newProductName)}`,
            type: 'good',
            storeId,
            createdAt: new Date().toISOString(),
            supplierId: supplier.id,
            categoryId: newProductCategoryId || undefined,
        };
        
        const { product: newProduct, variants: createdVariants } = await addProduct(productData, newProductVariants);

        const itemsToAdd = createdVariants.map((variant, index) => ({
            variantId: variant.id,
            productId: newProduct.id,
            productName: newProduct.name,
            variantName: variant.name,
            quantity: newProductVariants[index].stockQuantity || 1,
            purchasePrice: variant.purchasePrice
        }));
        setItems(prev => [...prev, ...itemsToAdd]);

        // Reset form
        setShowNewProductForm(false);
        setNewProductName('');
        setNewProductImage('');
        setNewProductCategoryId('');
        setNewProductVariants([{ name: '', price: 0, purchasePrice: 0, priceSemiWholesale: 0, priceWholesale: 0, barcode: '', lowStockThreshold: 5, image: '', stockQuantity: 1 }]);
    };


    const handleItemChange = (index: number, field: 'quantity' | 'purchasePrice', value: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: Math.max(0, value) };
        setItems(newItems);
    };
    
    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (items.length === 0) {
            alert(t('noProductsInPurchase'));
            return;
        }
        const purchase: Omit<Purchase, 'id'> = {
            storeId,
            supplierId: supplier.id,
            date: new Date().toISOString(),
            items,
            totalAmount,
            reference,
            amountPaid: typeof amountPaid === 'number' ? amountPaid : 0,
            paymentMethod,
            remainingAmount
        };
        await onSave(purchase);
        onClose();
    };

    const availableProducts = products.filter(p => p.type === 'good' && !items.some(i => i.productId === p.id));
    const availableVariantsForSelectedProduct = variants.filter(v => v.productId === selectedProductForVariant?.id && !items.some(i => i.variantId === v.id));

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] flex flex-col">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('newPurchaseFor', { name: supplier.name })}</h3>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('reference')}</label>
                        <input type="text" value={reference} onChange={e => setReference(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" placeholder={t('referencePlaceholder')} />
                    </div>

                    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-slate-700/50">
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('addProductsToPurchase')}</h4>
                        {!showNewProductForm ? (
                            <>
                                <div className="flex flex-wrap gap-2">
                                    <select 
                                        ref={productSelectRef} 
                                        className="flex-grow px-4 py-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600 min-w-[200px]"
                                        onChange={e => setSelectedProductForVariant(products.find(p => p.id === e.target.value) || null)}
                                    >
                                        <option value="">{t('selectProducts')}</option>
                                        {availableProducts.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {selectedProductForVariant && (
                                        <>
                                            <select ref={variantSelectRef} className="flex-grow px-4 py-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600 min-w-[200px]">
                                                <option value="">{t('selectVariant')}</option>
                                                {availableVariantsForSelectedProduct.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                            </select>
                                            <button onClick={handleAddSelectedProduct} className="bg-teal-600 text-white font-bold p-2 px-3 rounded-lg hover:bg-teal-700 flex items-center justify-center">
                                                <PlusIcon className="w-5 h-5"/>
                                            </button>
                                        </>
                                    )}
                                </div>
                                <div className='text-center mt-4 p-3 bg-slate-100 dark:bg-slate-600 rounded-lg flex items-center justify-center gap-4'>
                                    <span className="text-sm text-slate-600 dark:text-slate-300">{t('orAddNewProductPrompt')}</span>
                                    <button type="button" onClick={() => setShowNewProductForm(true)} className="font-semibold text-teal-700 dark:text-teal-300 bg-teal-200 dark:bg-teal-800/50 hover:bg-teal-300 dark:hover:bg-teal-800 px-4 py-2 rounded-lg transition-colors text-sm">
                                        {t('addNewProductButton')}
                                    </button>
                                </div>
                            </>
                        ) : (
                             <form onSubmit={handleAddNewProductAndToList} className="space-y-4 p-4 border-2 border-dashed rounded-lg bg-white dark:bg-slate-700">
                                <div className="flex justify-between items-center">
                                    <h5 className="font-bold text-gray-700 dark:text-gray-300 text-lg">{t('productInfo')}</h5>
                                    <button type="button" onClick={() => setShowNewProductForm(false)} className="text-sm text-red-600 hover:underline">{t('cancel')}</button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="flex flex-col items-center justify-center p-2">
                                        <img src={newProductImage || `https://via.placeholder.com/200/f3f4f6/6b7280?text=${t('productImagePreview')}`} alt="Product Preview" className="w-24 h-24 object-cover rounded-lg mb-4 bg-gray-200" />
                                        <input type="file" accept="image/*" onChange={handleNewProductImageChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/50 dark:file:text-teal-300 dark:hover:file:bg-teal-900" />
                                    </div>
                                    <div className="md:col-span-3 grid grid-cols-1 gap-4">
                                        <input type="text" value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder={t('productNamePlaceholder')} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-600 text-gray-900 dark:text-slate-100 dark:border-slate-500 text-base" required />
                                        <select value={newProductCategoryId} onChange={e => setNewProductCategoryId(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-600 text-gray-900 dark:text-slate-100 dark:border-slate-500">
                                            <option value="">{t('selectCategory')}</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Variants form */}
                                <div className="space-y-3">
                                    {newProductVariants.map((variant, index) => (
                                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-600/50 rounded-lg border dark:border-slate-600 relative">
                                             <button type="button" onClick={() => removeVariantForm(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4"/></button>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                 <div className="sm:col-span-3">
                                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('variantName')}</label>
                                                    <input type="text" value={variant.name} onChange={e => handleVariantFormChange(index, 'name', e.target.value)} placeholder={t('variantNamePlaceholder')} className="w-full p-1.5 border rounded-lg bg-white dark:bg-slate-700 text-sm" required />
                                                </div>
                                                 <div>
                                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('purchasePrice')}</label>
                                                    <input type="number" value={variant.purchasePrice} onChange={e => handleVariantFormChange(index, 'purchasePrice', parseFloat(e.target.value) || 0)} className="w-full p-1.5 border rounded-lg bg-white dark:bg-slate-700 text-sm" required min="0.01" step="0.01"/>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('sellingPrice')}</label>
                                                    <input type="number" value={variant.price} onChange={e => handleVariantFormChange(index, 'price', parseFloat(e.target.value) || 0)} className="w-full p-1.5 border rounded-lg bg-white dark:bg-slate-700 text-sm" required min="0.01" step="0.01"/>
                                                </div>
                                                 <div>
                                                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('stockQuantity')}</label>
                                                    <input type="number" value={variant.stockQuantity} onChange={e => handleVariantFormChange(index, 'stockQuantity', parseFloat(e.target.value) || 0)} className="w-full p-1.5 border rounded-lg bg-white dark:bg-slate-700 text-sm" required min="0.5" step="0.5"/>
                                                </div>
                                                <div className="sm:col-span-3 flex items-center justify-center">
                                                     <input type="file" accept="image/*" onChange={e => handleVariantImageFormChange(index, e)} className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 dark:file:bg-purple-900/50 dark:file:text-purple-300 dark:hover:file:bg-purple-900" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addVariantForm} className="text-sm font-semibold text-teal-700 dark:text-teal-300 hover:underline">{t('addVariant')}</button>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">{t('saveAndAddToList')}</button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="pt-4 mt-4 border-t dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">{t('purchaseDetails')}</h3>
                     <div className="max-h-60 overflow-y-auto pr-2">
                         {items.length === 0 ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noProductsInPurchase')}</p>
                         ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={language === 'ar' ? 'text-right' : 'text-left'}>
                                        <th className="p-2 font-semibold text-slate-600 dark:text-slate-300">{t('products')}</th>
                                        <th className="p-2 font-semibold text-slate-600 dark:text-slate-300">{t('quantity')}</th>
                                        <th className="p-2 font-semibold text-slate-600 dark:text-slate-300">{t('purchasePrice')}</th>
                                        <th className="p-2 font-semibold text-slate-600 dark:text-slate-300">{t('total')}</th>
                                        <th className="p-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index} className={`border-b dark:border-slate-700 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                                            <td className="p-2 text-slate-800 dark:text-slate-200">{item.productName} - {item.variantName}</td>
                                            <td className="p-2">
                                                <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="w-20 p-1 border rounded-md bg-white dark:bg-slate-700" min="0.5" step="0.5" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" value={item.purchasePrice} onChange={e => handleItemChange(index, 'purchasePrice', parseFloat(e.target.value))} className="w-24 p-1 border rounded-md bg-white dark:bg-slate-700" min="0.01" step="0.01" />
                                            </td>
                                            <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{(item.quantity * item.purchasePrice).toFixed(2)}</td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         )}
                     </div>
                     <div className="mt-4 pt-4 border-t dark:border-slate-600 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('paymentMethod')}</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600">
                                    <option value="cash">{t('cash')}</option>
                                    <option value="card">{t('card')}</option>
                                    <option value="transfer">{t('transfer')}</option>
                                    <option value="check">{t('check')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('amountPaid')}</label>
                                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" min="0" max={totalAmount}/>
                            </div>
                        </div>
                        <div className="space-y-2 text-lg p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
                            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                                <span>{t('totalAmount')}:</span>
                                <span>{totalAmount.toFixed(2)} DH</span>
                            </div>
                             <div className={`flex justify-between font-bold ${remainingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                <span>{t('remainingAmountLabel')}:</span>
                                <span>{remainingAmount.toFixed(2)} DH</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                    <button onClick={handleSubmit} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">{t('completePurchase')}</button>
                </div>
            </div>
        </div>
    );
};


interface SupplierManagementProps {
  storeId: string;
  suppliers: Supplier[];
  purchases: Purchase[];
  products: Product[];
  variants: ProductVariant[];
  categories: Category[];
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<Supplier | undefined>;
  deleteSupplier: (id: string) => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, 'id'>) => Promise<{ newPurchase: Purchase; newStockBatches: StockBatch[]; }>;
  paySupplierDebt: (supplierId: string, amount: number) => Promise<void>;
  addProduct: (productData: Omit<Product, 'id'>, variantsData: (Omit<ProductVariant, 'id' | 'productId' | 'storeId'> & { stockQuantity?: number | undefined })[]) => Promise<{ product: Product; variants: ProductVariant[]; }>;
  t: TFunction;
  language: Language;
}

const ITEMS_PER_PAGE = 15;

const SupplierManagement: React.FC<SupplierManagementProps> = ({ 
    storeId, suppliers, purchases, products, variants, categories,
    addSupplier, deleteSupplier, addPurchase, paySupplierDebt, addProduct,
    t, language 
}) => {
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '' });
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<Supplier | null>(null);
  const [newPurchaseFor, setNewPurchaseFor] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
  const supplierDebts = useMemo(() => {
    const debts = new Map<string, number>();
    purchases.forEach(purchase => {
      if (purchase.supplierId && purchase.remainingAmount > 0) {
        const currentDebt = debts.get(purchase.supplierId) || 0;
        debts.set(purchase.supplierId, currentDebt + purchase.remainingAmount);
      }
    });
    return debts;
  }, [purchases]);

  const purchasesBySupplier = useMemo(() => {
    const map = new Map<string, Purchase[]>();
    purchases.forEach(p => {
        if(p.supplierId) {
            const existing = map.get(p.supplierId) || [];
            existing.push(p);
            map.set(p.supplierId, existing);
        }
    });
    return map;
  }, [purchases]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSupplier(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const clearFeedback = () => setTimeout(() => setFeedback(null), 4000);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!newSupplier.name || !newSupplier.phone) {
        setFeedback({type: 'error', message: t('nameAndPhoneRequired')});
        clearFeedback();
        return;
    }
     if (suppliers.some(c => c.phone === newSupplier.phone.trim())) {
        setFeedback({type: 'error', message: t('supplierExistsError', { phone: newSupplier.phone.trim() })});
        clearFeedback();
        return;
    }
    await addSupplier({ ...newSupplier, storeId });
    setNewSupplier({ name: '', phone: '', email: '' });
    setFeedback({ type: 'success', message: t('supplierAddedSuccess', { name: newSupplier.name }) });
    clearFeedback();
  };
  
  const handleDeleteSupplier = async (supplier: Supplier) => {
    setFeedback(null);
    if (window.confirm(t('confirmSupplierDelete', { name: supplier.name }))) {
      try {
        await deleteSupplier(supplier.id);
        setFeedback({ type: 'success', message: t('supplierDeletedSuccess', { name: supplier.name }) });
      } catch (error: any) {
        const debt = supplierDebts.get(supplier.id) || 0;
        const errorMessage = t((error.message || 'supplierDeleteError') as keyof typeof translations.fr, { name: supplier.name, debt: debt.toFixed(2) });
        setFeedback({ type: 'error', message: errorMessage });
      }
      clearFeedback();
    }
  };

  const handleExport = () => {
    const headers = [t('name'), t('phone'), t('email'), t('supplierDebt')];
    const data = suppliers.map(s => [
        s.name,
        s.phone,
        s.email || 'N/A',
        `${(supplierDebts.get(s.id) || 0).toFixed(2)} DH`
    ]);
    exportToPdf(t('supplierList'), headers, data, 'suppliers_report', language, t('noDataToExport'));
  };
  
   const handleSavePurchase = async (purchaseData: Omit<Purchase, 'id'>) => {
    await addPurchase(purchaseData);
    setFeedback({ type: 'success', message: 'Achat enregistré avec succès.' }); // TODO: Translate
    clearFeedback();
  };

  const handlePayDebt = async (supplierId: string, amount: number) => {
      await paySupplierDebt(supplierId, amount);
      setFeedback({ type: 'success', message: t('paymentRecorded') });
      clearFeedback();
  };

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) {
      return suppliers;
    }
    return suppliers.filter(s =>
      s.name.toLowerCase().startsWith(searchQuery.toLowerCase())
    );
  }, [suppliers, searchQuery]);

  const paginatedSuppliers = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredSuppliers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSuppliers, currentPage]);

  const totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);

  return (
    <>
      {viewingHistoryFor && (
        <PurchaseHistoryModal
          supplier={viewingHistoryFor}
          purchases={purchasesBySupplier.get(viewingHistoryFor.id) || []}
          onClose={() => setViewingHistoryFor(null)}
          t={t}
          language={language}
        />
      )}
      {newPurchaseFor && (
        <NewPurchaseModal
            supplier={newPurchaseFor}
            products={products}
            variants={variants}
            categories={categories}
            onClose={() => setNewPurchaseFor(null)}
            onSave={handleSavePurchase}
            addProduct={addProduct}
            t={t}
            storeId={storeId}
            language={language}
        />
      )}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><TruckIcon />{t('addNewSupplier')}</h2>
          <form onSubmit={handleAddSupplier} className="grid sm:grid-cols-4 gap-4 items-end">
             <div className="sm:col-span-1">
                <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('name')}</label>
                <input type="text" id="name" value={newSupplier.name} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" onChange={handleInputChange} required />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="phone" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('phone')}</label>
                <input type="tel" id="phone" value={newSupplier.phone} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" onChange={handleInputChange} required />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('email')} ({t('optional')})</label>
                <input type="email" id="email" value={newSupplier.email} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" onChange={handleInputChange} />
              </div>
              <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2">
                <PlusIcon className="w-5 h-5"/> {t('add')}
              </button>
          </form>
           {feedback && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                    {feedback.message}
                </div>
            )}
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
           <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
              <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('supplierList')}</h2>
              <div className="flex-grow max-w-sm">
                <input
                  type="text"
                  placeholder={t('searchByName')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                />
              </div>
              <button onClick={handleExport} className="bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm">
                  <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
              </button>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
               <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th scope="col" className="px-6 py-3">{t('name')}</th>
                    <th scope="col" className="px-6 py-3">{t('phone')}</th>
                    <th scope="col" className="px-6 py-3">{t('email')}</th>
                    <th scope="col" className="px-6 py-3">{t('supplierDebt')}</th>
                    <th scope="col" className="px-6 py-3 text-right rtl:text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSuppliers.map(supplier => {
                    const debt = supplierDebts.get(supplier.id) || 0;
                    return (
                      <tr key={supplier.id} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{supplier.name}</th>
                        <td className="px-6 py-4">{supplier.phone}</td>
                        <td className="px-6 py-4">{supplier.email || 'N/A'}</td>
                        <td className={`px-6 py-4 font-bold ${ debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {debt.toFixed(2)} DH
                        </td>
                        <td className="px-6 py-4 text-right rtl:text-left">
                           <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setNewPurchaseFor(supplier)} className="bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-full hover:bg-blue-700">{t('newPurchase')}</button>
                            {debt > 0 && (
                                <button onClick={() => alert('Feature to be implemented')} className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs font-bold py-1 px-3 rounded-full hover:bg-green-200 dark:hover:bg-green-800/50">
                                    {t('managePayments')}
                                </button>
                            )}
                            {debt <= 0 && <span className="text-xs font-semibold text-green-600 dark:text-green-400 px-3">{t('noDebt')}</span>}
                            <button onClick={() => setViewingHistoryFor(supplier)} className="text-cyan-600 hover:text-cyan-700 p-1 rounded-full hover:bg-cyan-100 dark:hover:bg-cyan-900/50" title={t('history', {name: ''})}>
                                <FileDownIcon className="w-5 h-5"/>
                            </button>
                             <button onClick={() => handleDeleteSupplier(supplier)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title={t('delete')}>
                                  <TrashIcon className="w-5 h-5"/>
                             </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
             </table>
             {totalPages > 1 && (
                <div className="pt-4 flex justify-center items-center gap-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-slate-600" aria-label={t('previous')}>
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {t('page')} {currentPage} / {totalPages}
                    </span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-slate-600" aria-label={t('next')}>
                        <ArrowRightIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
            {paginatedSuppliers.length === 0 && (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                {searchQuery ? t('noResultsFound') : t('noSuppliersAdded')}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// FIX: Add default export for SupplierManagement component
export default SupplierManagement;
