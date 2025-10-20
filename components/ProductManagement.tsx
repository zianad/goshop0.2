
import React, { useState, useMemo, useEffect } from 'react';
import type { Product, ProductVariant, Supplier, Category, VariantFormData } from '../types';
import { TrashIcon, FileDownIcon, PlusIcon, EditIcon, ChevronDownIcon, SearchIcon, BarcodeIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons';
import { exportToPdf } from '../utils/helpers';
// FIX: Changed import path to be explicit for module resolution.
import { translations } from '../translations.ts';
import { PrintableBarcode } from './PrintableBarcode';

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

const AddStockModal: React.FC<{
  product: Product;
  variants: ProductVariant[];
  onClose: () => void;
  onSave: (data: { variantId: string, quantity: number, purchasePrice: number, sellingPrice: number }) => void;
  t: TFunction;
}> = ({ product, variants, onClose, onSave, t }) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [purchasePrice, setPurchasePrice] = useState<number | ''>(0);
  const [sellingPrice, setSellingPrice] = useState<number | ''>(0);

  useEffect(() => {
    if (variants.length === 1) {
        setSelectedVariantId(variants[0].id);
    }
  }, [variants]);

  useEffect(() => {
    const variant = variants.find(v => v.id === selectedVariantId);
    if (variant) {
      setPurchasePrice(variant.purchasePrice);
      setSellingPrice(variant.price);
      setQuantity(1); // Reset quantity on variant change
    } else {
      setPurchasePrice(0);
      setSellingPrice(0);
      setQuantity(1);
    }
  }, [selectedVariantId, variants]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId || quantity === '' || quantity <= 0 || purchasePrice === '' || purchasePrice < 0 || sellingPrice === '' || sellingPrice <= 0) {
      alert(t('fillAllFieldsError'));
      return;
    }
    if (sellingPrice <= purchasePrice) {
      alert(t('sellingPriceMustBeHigherError'));
      return;
    }
    onSave({
      variantId: selectedVariantId,
      quantity,
      purchasePrice,
      sellingPrice
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full p-6">
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('addStockFor', { name: product.name })}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            {/* FIX: Use 'selectVariant' key for the translation, as 'variant' is not a valid key. */}
            <label htmlFor="variant" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('selectVariant')}</label>
            <select
              id="variant"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
              required
            >
              <option value="" disabled>{t('selectVariant')}</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {selectedVariantId && (
            <>
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('quantityToAdd')}</label>
                <input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                  min="0.5"
                  step="0.5"
                  required
                />
              </div>
              <div>
                <label htmlFor="purchasePrice" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('purchasePrice')}</label>
                <input
                  id="purchasePrice"
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label htmlFor="sellingPrice" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('sellingPrice')}</label>
                <input
                  id="sellingPrice"
                  type="number"
                  value={sellingPrice}
                   onChange={(e) => setSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
            <button type="submit" disabled={!selectedVariantId} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 dark:disabled:bg-slate-500">{t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface ProductManagementProps {
  storeId: string;
  products: Product[];
  variants: ProductVariant[];
  suppliers: Supplier[];
  categories: Category[];
  stockMap: Map<string, number>;
  addProduct: (productData: Omit<Product, 'id'>, variantsData: Omit<VariantFormData, 'stockQuantity'>[]) => Promise<{ product: Product; variants: ProductVariant[] }>;
  updateProduct: (productData: Product, variantsData: VariantFormData[]) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addStockToVariant: (data: { variantId: string; quantity: number; purchasePrice: number; sellingPrice: number; supplierId: string | undefined; }) => Promise<void>;
  t: TFunction;
  language: Language;
}

const ITEMS_PER_PAGE = 20;

const ProductManagement: React.FC<ProductManagementProps> = ({ storeId, products, variants, suppliers, categories, stockMap, addProduct, updateProduct, deleteProduct, addStockToVariant, t, language }) => {
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addingStockTo, setAddingStockTo] = useState<Product | null>(null);
  
  const [productName, setProductName] = useState('');
  const [productCategoryId, setProductCategoryId] = useState('');
  const [productSupplierId, setProductSupplierId] = useState('');
  const [productImage, setProductImage] = useState<string>('');

  const [productVariants, setProductVariants] = useState<VariantFormData[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [printingBarcodeFor, setPrintingBarcodeFor] = useState<ProductVariant | null>(null);
  const [categoryPagination, setCategoryPagination] = useState<{ [key: string]: number }>({});

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    variants.forEach(variant => {
      const existing = map.get(variant.productId) || [];
      existing.push(variant);
      map.set(variant.productId, existing);
    });
    return map;
  }, [variants]);
  
  const filteredProducts = useMemo(() => {
    if (!searchQuery) {
        return products;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    
    const matchingProductIds = new Set(
        products.filter(p => p.name.toLowerCase().includes(lowerCaseQuery)).map(p => p.id)
    );

    const matchingCategoryIds = new Set(
        categories.filter(c => c.name.toLowerCase().includes(lowerCaseQuery)).map(c => c.id)
    );

    return products.filter(p => 
        matchingProductIds.has(p.id) || 
        (p.categoryId && matchingCategoryIds.has(p.categoryId))
    );
  }, [searchQuery, products, categories]);

  useEffect(() => {
    if (searchQuery) {
        const categoryIdsWithFilteredProducts = new Set(filteredProducts.map(p => p.categoryId || 'uncategorized'));
        setExpandedCategories(Array.from(categoryIdsWithFilteredProducts));
    } else {
        setExpandedCategories([]);
    }
    setCategoryPagination({});
  }, [searchQuery, filteredProducts]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
        prev.includes(categoryId)
            ? prev.filter(id => id !== categoryId)
            : [...prev, categoryId]
    );
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingProduct(null);
    setProductName('');
    setProductCategoryId('');
    setProductSupplierId('');
    setProductImage('');
    setProductVariants([]);
    const fileInput = document.getElementById('productImageFile') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };
  
  const handleEditClick = (product: Product) => {
    setIsEditing(true);
    setEditingProduct(product);
    setProductName(product.name);
    setProductCategoryId(product.categoryId || '');
    setProductSupplierId(product.supplierId || '');
    setProductImage(product.image);
    setProductVariants(variantsByProduct.get(product.id)?.map(v => ({ 
        ...v, 
        priceSemiWholesale: v.priceSemiWholesale || 0,
        priceWholesale: v.priceWholesale || 0,
        stockQuantity: stockMap.get(v.id) || 0 
    })) || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => setProductImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVariantChange = (index: number, field: keyof VariantFormData, value: string | number) => {
    const newVariants = [...productVariants];
    (newVariants[index] as any)[field] = value;
    setProductVariants(newVariants);
  };
  
  const handleVariantImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
          const newVariants = [...productVariants];
          newVariants[index].image = reader.result as string;
          setProductVariants(newVariants);
      }
      reader.readAsDataURL(file);
    }
  };

  const addVariant = () => {
    setProductVariants([...productVariants, {
        name: '',
        price: 0,
        priceSemiWholesale: 0,
        priceWholesale: 0,
        purchasePrice: 0,
        barcode: '',
        lowStockThreshold: 5,
        image: '',
        stockQuantity: 0
    }]);
  };
  
  const removeVariant = (index: number) => {
      setProductVariants(productVariants.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || productVariants.length === 0) {
        alert(t('fillNameAndPriceError')); // TODO: Better error message
        return;
    }
    
    for (const variant of productVariants) {
        if (!variant.name || variant.price <= 0) {
            alert(t('fillNameAndPriceError')); // TODO: better error
            return;
        }
        if (variant.price <= variant.purchasePrice) {
            alert(t('sellingPriceMustBeHigherError'));
            return;
        }
    }

    if (isEditing && editingProduct) {
        const productData: Product = {
            ...editingProduct,
            name: productName,
            categoryId: productCategoryId || undefined,
            supplierId: productSupplierId || undefined,
            image: productImage || `https://via.placeholder.com/200/f3f4f6/6b7280?text=${encodeURIComponent(productName)}`,
        };
        await updateProduct(productData, productVariants);
    } else {
        const productData: Omit<Product, 'id'> = {
            storeId,
            name: productName,
            type: 'good',
            categoryId: productCategoryId || undefined,
            supplierId: productSupplierId || undefined,
            image: productImage || `https://via.placeholder.com/200/f3f4f6/6b7280?text=${encodeURIComponent(productName)}`,
            createdAt: new Date().toISOString(),
        };
        const variantsToSave = productVariants.map(({ stockQuantity, ...rest }) => rest);
        await addProduct(productData, variantsToSave);
    }

    resetForm();
  };


  const handleDeleteProduct = async (id: string) => {
    if (window.confirm(t('confirmProductDelete'))) {
      await deleteProduct(id);
    }
  };
  
  const handleExport = () => {
    const headers = [
        t('productName'),
        t('variantName'),
        t('price'),
        t('purchasePrice'),
        t('stock'),
        t('barcode'),
        // FIX: Use 'categories' key for the translation, as 'category' is not a valid key.
        t('categories'),
        // FIX: Use 'suppliers' key for the translation, as 'supplier' is not a valid key.
        t('suppliers'),
    ];

    const dataToExport = variants.map(v => {
        const p = products.find(p => p.id === v.productId);
        return [
            p?.name || 'N/A',
            v.name,
            v.price,
            v.purchasePrice,
            stockMap.get(v.id) || 0,
            v.barcode || 'N/A',
            categories.find(c => c.id === p?.categoryId)?.name || 'N/A',
            suppliers.find(s => s.id === p?.supplierId)?.name || 'N/A',
        ];
    });
    
    exportToPdf(t('productList'), headers, dataToExport, 'products_with_variants', language, t('noDataToExport'));
  }

  const handleSaveStock = async (data: { variantId: string, quantity: number, purchasePrice: number, sellingPrice: number }) => {
    if (!addingStockTo) return;
    await addStockToVariant({
        ...data,
        supplierId: addingStockTo.supplierId,
    });
    setAddingStockTo(null);
  };

  const productForBarcode = printingBarcodeFor ? products.find(p => p.id === printingBarcodeFor.productId) : null;

  const renderProductList = (productList: Product[]) => {
    return productList.map(product => {
        const productVariants = variantsByProduct.get(product.id) || [];
        return (
            <div key={product.id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Col 1: Product Info */}
                <div className="flex items-center gap-3 md:col-span-5">
                    <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-md bg-gray-200" />
                    <span className="font-medium text-slate-700 dark:text-slate-100">{product.name}</span>
                </div>
                {/* Col 2: Variants */}
                <div className="md:col-span-5">
                    {productVariants.length > 0 ? (
                         <details>
                            <summary className="cursor-pointer text-sm font-semibold text-teal-700 dark:text-teal-400">{productVariants.length} {t('variants')}</summary>
                            <ul className="mt-2 space-y-2">
                                {productVariants.map(v => (
                                    <li key={v.id} className="flex items-center gap-3 text-xs p-1 bg-slate-50 dark:bg-slate-700/50 rounded-md">
                                        <img src={v.image} alt={v.name} className="w-8 h-8 rounded-md object-cover bg-gray-200"/>
                                        <span className="flex-grow font-semibold text-slate-600 dark:text-slate-300">{v.name}</span>
                                        <span className="font-mono text-cyan-700 dark:text-cyan-400">{v.price.toFixed(2)} DH</span>
                                        <span className={`px-2 py-0.5 font-medium rounded-full text-xs ${ (stockMap.get(v.id) || 0) > v.lowStockThreshold ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                                            {t('stock')}: {stockMap.get(v.id) || 0}
                                        </span>
                                         {v.barcode && (
                                            <button onClick={() => setPrintingBarcodeFor(v)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" title={t('printBarcodeLabel')}>
                                                <BarcodeIcon className="w-5 h-5"/>
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">{t('noVariants')}</span>
                    )}
                </div>
                {/* Col 3: Actions */}
                <div className="flex items-center gap-2 justify-end md:col-span-2">
                  <button onClick={() => setAddingStockTo(product)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" title={t('addStock')}>
                    <PlusIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleEditClick(product)} className="text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300">
                    <EditIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
            </div>
        )
    })
  };

  const renderPaginatedProductList = (productList: Product[], categoryKey: string) => {
    const totalProducts = productList.length;
    if (totalProducts === 0 && categoryKey === 'uncategorized') return null; // Don't show for empty uncategorized
    if (totalProducts === 0) return <p className="p-4 text-center text-slate-500 dark:text-slate-400">{t('noProductsInCategory')}</p>;

    const currentPage = categoryPagination[categoryKey] || 1;
    const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedProducts = productList.slice(startIndex, endIndex);

    const handlePageChange = (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) return;
      setCategoryPagination(prev => ({ ...prev, [categoryKey]: newPage }));
    };

    return (
      <>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {renderProductList(paginatedProducts)}
        </div>
        {totalPages > 1 && (
            <div className="p-4 flex justify-center items-center gap-4 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-slate-600"
                    aria-label={t('previous')}
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {t('page')} {currentPage} / {totalPages}
                </span>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-slate-600"
                    aria-label={t('next')}
                >
                    <ArrowRightIcon className="w-5 h-5" />
                </button>
            </div>
        )}
      </>
    );
  };


  return (
    <div className="space-y-6">
       {printingBarcodeFor && productForBarcode && (
        <PrintableBarcode
            variant={printingBarcodeFor}
            product={productForBarcode}
            onDone={() => setPrintingBarcodeFor(null)}
            t={t}
        />
       )}
      {addingStockTo && (
        <AddStockModal
            product={addingStockTo}
            variants={variantsByProduct.get(addingStockTo.id) || []}
            onClose={() => setAddingStockTo(null)}
            onSave={handleSaveStock}
            t={t}
        />
      )}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">{isEditing ? t('editProduct') : t('addNewProduct')}</h2>
            {isEditing && <button onClick={resetForm} className="bg-gray-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600">{t('cancel')}</button>}
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Template Section */}
            <div className="p-4 border-2 border-dashed rounded-lg dark:border-slate-600">
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-4">{t('productInfo')}</h3>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center justify-center p-2">
                        <img src={productImage || `https://via.placeholder.com/200/f3f4f6/6b7280?text=${t('productImagePreview')}`} alt={t('productImagePreview')} className="w-32 h-32 object-cover rounded-lg mb-4 bg-gray-200" />
                        <input type="file" id="productImageFile" accept="image/*" onChange={handleProductImageChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/50 dark:file:text-teal-300 dark:hover:file:bg-teal-900" />
                    </div>
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('productName')}</label>
                            <input type="text" value={productName} onChange={e => setProductName(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" placeholder={t('productNamePlaceholder')} required />
                        </div>
                        <div>
                            {/* FIX: Use 'categories' key for the translation, as 'category' is not a valid key. */}
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('categories')}</label>
                            <select value={productCategoryId} onChange={e => setProductCategoryId(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600">
                                <option value="">{t('selectCategory')}</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                         <div>
                            {/* FIX: Use 'suppliers' key for the translation, as 'supplier' is not a valid key. */}
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('suppliers')}</label>
                            <select value={productSupplierId} onChange={e => setProductSupplierId(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600">
                                <option value="">{t('selectSupplier')}</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                 </div>
            </div>

            {/* Variants Section */}
            <div className="p-4 border-2 border-dashed rounded-lg dark:border-slate-600">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">{t('productVariants')}</h3>
                    <button type="button" onClick={addVariant} className="bg-teal-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-teal-600 flex items-center gap-1"><PlusIcon className="w-5 h-5"/>{t('addVariant')}</button>
                 </div>
                 <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {productVariants.map((variant, index) => (
                        <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 relative">
                            <button type="button" onClick={() => removeVariant(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                               <div className="flex flex-col items-center justify-center p-2">
                                    {/* FIX: Use 'variants' key for the translation, as 'variant' is not a valid key. */}
                                    <img src={variant.image || `https://via.placeholder.com/150/f1f5f9/64748b?text=${t('variants')}`} alt="variant" className="w-24 h-24 object-cover rounded-lg mb-2 bg-gray-200" />
                                    <input type="file" accept="image/*" onChange={e => handleVariantImageChange(index, e)} className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 dark:file:bg-purple-900/50 dark:file:text-purple-300 dark:hover:file:bg-purple-900" />
                                </div>
                                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                     <div className="sm:col-span-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('variantName')}</label>
                                        <input type="text" value={variant.name} onChange={e => handleVariantChange(index, 'name', e.target.value)} placeholder={t('variantNamePlaceholder')} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required />
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('purchasePrice')}</label>
                                        <input type="number" value={variant.purchasePrice} onChange={e => handleVariantChange(index, 'purchasePrice', parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required min="0" step="0.01"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sellingPrice')}</label>
                                        <input type="number" value={variant.price} onChange={e => handleVariantChange(index, 'price', parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required min="0" step="0.01"/>
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('semiWholesalePrice')}</label>
                                        <input type="number" value={variant.priceSemiWholesale || ''} onChange={e => handleVariantChange(index, 'priceSemiWholesale', parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" min="0" step="0.01"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('wholesalePrice')}</label>
                                        <input type="number" value={variant.priceWholesale || ''} onChange={e => handleVariantChange(index, 'priceWholesale', parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" min="0" step="0.01"/>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stockQuantity')}</label>
                                        <input type="number" value={variant.stockQuantity} onChange={e => handleVariantChange(index, 'stockQuantity', parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" min="0" step="0.5"/>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('lowStockThreshold')}</label>
                                        <input type="number" value={variant.lowStockThreshold} onChange={e => handleVariantChange(index, 'lowStockThreshold', parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" required min="0" step="0.5"/>
                                    </div>

                                    <div className="sm:col-span-3">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('barcode')}</label>
                                        <input type="text" value={variant.barcode || ''} onChange={e => handleVariantChange(index, 'barcode', e.target.value)} placeholder={t('barcodePlaceholder')} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 dark:border-slate-600" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center text-lg">
              {isEditing ? t('saveChanges') : t('saveProduct')}
            </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('productList')}</h2>
            <div className="flex items-center gap-4 w-full sm:w-auto">
                 <button
                    onClick={() => {
                        resetForm();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm shrink-0"
                >
                    <PlusIcon className="w-4 h-4" /> {t('addNewProduct')}
                </button>
                <div className="relative flex-grow">
                    <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-3 rtl:pl-0 rtl:pr-3 pointer-events-none">
                        <SearchIcon className="w-5 h-5 text-slate-400" />
                    </span>
                    <input
                        type="text"
                        placeholder={t('searchProducts')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64 px-4 py-2 pl-10 rtl:pr-10 rtl:pl-4 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600 focus:ring-2 focus:ring-teal-500 transition"
                    />
                </div>
                <button onClick={handleExport} className="bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 text-sm shrink-0">
                    <FileDownIcon className="w-4 h-4"/> {t('exportToPdf')}
                </button>
            </div>
        </div>
        <div className="mt-6 space-y-3">
            {categories.map(category => {
                const categoryProducts = filteredProducts.filter(p => p.categoryId === category.id);
                if (categoryProducts.length === 0) return null;
                
                const isExpanded = expandedCategories.includes(category.id);
                return (
                    <div key={category.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleCategory(category.id)}
                            className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            aria-expanded={isExpanded}
                            aria-controls={`category-panel-${category.id}`}
                        >
                            <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200">{category.name} <span className="text-sm font-medium text-slate-500">({categoryProducts.length})</span></h3>
                            <ChevronDownIcon className={`w-6 h-6 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                            <div id={`category-panel-${category.id}`}>
                                {renderPaginatedProductList(categoryProducts, category.id)}
                            </div>
                        )}
                    </div>
                )
            })}
             {(() => {
                const uncategorized = filteredProducts.filter(p => !p.categoryId);
                if (uncategorized.length === 0) return null;
                 
                 const isExpanded = expandedCategories.includes('uncategorized');
                 return (
                     <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleCategory('uncategorized')}
                            className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            aria-expanded={isExpanded}
                            aria-controls="category-panel-uncategorized"
                        >
                            <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200">{t('uncategorized')} <span className="text-sm font-medium text-slate-500">({uncategorized.length})</span></h3>
                            <ChevronDownIcon className={`w-6 h-6 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                            <div id="category-panel-uncategorized">
                                {renderPaginatedProductList(uncategorized, 'uncategorized')}
                            </div>
                        )}
                     </div>
                 );
             })()}

            {products.length > 0 && filteredProducts.length === 0 && (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noResultsFound')}</p>
            )}
            
            {products.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noProductsAdded')}</p>}
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;
