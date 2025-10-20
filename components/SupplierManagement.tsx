import React, { useState, useMemo, useEffect } from 'react';
import type { Supplier, Purchase, Product, ProductVariant, PurchaseItem, Category } from '../types';
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
                                                        {/* FIX: Use 'products' key for the translation, as 'product' is not a valid key. */}
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
}

// MODAL: New Purchase
const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({ supplier, products, variants, categories, onClose, onSave, addProduct, t, storeId }) => {
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
                                
                                <div className="flex justify-between items-center mb-4 mt-4 pt-4 border-t-2 border-dashed dark:border-slate-600">
                                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">{t('productVariants')}</h3>
                                    <button type="button" onClick={addVariantForm} className="bg-teal-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-teal-600 flex items-center gap-1"><PlusIcon className="w-5 h-5"/>{t('addVariant')}</button>
                                </div>

                                {newProductVariants.map((variant, index) => (
                                    <div key={index} className="p-4 bg-slate-50 dark:bg-slate-600/50 rounded-lg border dark:border-slate-500 relative">
                                        <button type="button" onClick={() => removeVariantForm(index)} className="absolute top-2 right-2 rtl:right-auto rtl:left-2 text-red-500 hover:text-red-700 z-10"><TrashIcon className="w-5 h-5"/></button>
                                        <