import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Product, ProductVariant, CartItem, Customer, Category, Sale, User, Store } from '../types';
import { TrashIcon, BarcodeIcon, PlusIcon, SparklesIcon } from './Icons';
import { translations } from '../translations';
import { GoogleGenAI, Type } from "@google/genai";

// IMPORTANT: To enable AI receipt scanning, you must provide a Google Gemini API key here.
// You can get one from Google AI Studio.
const GEMINI_API_KEY = ""; // <-- Add your Gemini API Key here

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface SelectVariantModalProps {
  product: Product;
  variants: ProductVariant[];
  stockMap: Map<string, number>;
  onClose: () => void;
  onSelectVariant: (variant: ProductVariant) => void;
  t: TFunction;
  isReturnMode: boolean;
}

const SelectVariantModal: React.FC<SelectVariantModalProps> = ({ product, variants, stockMap, onClose, onSelectVariant, t, isReturnMode }) => {
  return (
    <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('selectVariantFor')} "{product.name}"</h3>
        <div className="flex-grow overflow-y-auto pr-2 space-y-2">
          {variants.map(variant => {
            const stock = stockMap.get(variant.id) || 0;
            const isOutOfStock = !isReturnMode && stock <= 0;
            return (
              <div 
                key={variant.id} 
                onClick={() => !isOutOfStock && onSelectVariant(variant)}
                className={`flex items-center p-3 border dark:border-slate-700 rounded-lg gap-4 ${isOutOfStock ? 'bg-gray-100 dark:bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-white dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-slate-700 cursor-pointer'}`}
              >
                <img src={variant.image} alt={variant.name} className="w-16 h-16 object-cover rounded-md bg-gray-200" />
                <div className="flex-grow">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{variant.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{variant.price.toFixed(2)} DH</p>
                </div>
                <div className="text-right rtl:text-left">
                   <p className={`font-semibold ${stock > variant.lowStockThreshold ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>{t('stock')}: {stock}</p>
                   {isOutOfStock && <p className="text-xs font-bold text-red-600 dark:text-red-400">{t('outOfStock')}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pt-4 mt-4 border-t dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
};

const AddCustomItemModal: React.FC<{
  onSave: (name: string, quantity: number, price: number) => void;
  onClose: () => void;
  t: TFunction;
}> = ({ onSave, onClose, t }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [price, setPrice] = useState<number | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || quantity === '' || quantity <= 0 || price === '' || price <= 0) {
      alert(t('fillAllFields'));
      return;
    }
    onSave(name, quantity, price);
  };

  return (
    <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('enterItemDetails')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="itemName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('customItemName')}</label>
            <input
              id="itemName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
              placeholder={t('itemNamePlaceholder')}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="itemQuantity" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('quantity')}</label>
              <input
                id="itemQuantity"
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
              <label htmlFor="itemPrice" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('unitPriceLabel')}</label>
              <input
                id="itemPrice"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
            <button type="submit" className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('add')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface PointOfSaleProps {
  store: Store;
  user: User;
  products: Product[];
  variants: ProductVariant[];
  customers: Customer[];
  categories: Category[];
  sales: Sale[];
  stockMap: Map<string, number>;
  variantMap: Map<string, ProductVariant>;
  variantsByProduct: Map<string, ProductVariant[]>;
  barcodeMap: Map<string, ProductVariant>;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  completeSale: (downPayment: number, customerId: string | undefined, finalTotal: number, printMode: 'invoice' | 'orderForm') => Promise<void>;
  processReturn: (itemsToReturn: CartItem[]) => Promise<void>;
  payCustomerDebt: (customerId: string, amount: number) => Promise<void>;
  t: TFunction;
  language: Language;
}

const PointOfSale: React.FC<PointOfSaleProps> = ({ 
  store, user, products, variants, customers, categories, sales, 
  stockMap, variantMap, variantsByProduct, barcodeMap,
  cart, setCart, completeSale, processReturn, payCustomerDebt, 
  t, language 
}) => {
  const [downPayment, setDownPayment] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showServices, setShowServices] = useState(false);
  const [customerDebt, setCustomerDebt] = useState(0);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState<string>('');
  const [manualTotal, setManualTotal] = useState<string>('');
  const [selectingVariantFor, setSelectingVariantFor] = useState<Product | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddingCustomItem, setIsAddingCustomItem] = useState(false);
  const [priceLevel, setPriceLevel] = useState<'unit' | 'semiWholesale' | 'wholesale'>('unit');
  
  const barcodeBuffer = useRef('');
  const scannerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + item.price * item.quantity, 0), [cart]);
  const totalTTC = manualTotal ? parseFloat(manualTotal) : subtotal;
  const totalHT = totalTTC / 1.2;
  const tvaAmount = totalTTC - totalHT;
  const remainingAmount = totalTTC - downPayment;

  const getPriceForLevel = useCallback((
    item: Product | ProductVariant,
    level: 'unit' | 'semiWholesale' | 'wholesale'
  ): number => {
    if (level === 'wholesale' && item.priceWholesale && item.priceWholesale > 0) {
      return item.priceWholesale;
    }
    if (level === 'semiWholesale' && item.priceSemiWholesale && item.priceSemiWholesale > 0) {
      return item.priceSemiWholesale;
    }
    return item.price || 0;
  }, []);

  useEffect(() => {
    setCart(prevCart => prevCart.map(cartItem => {
        let newPrice = cartItem.price;
        if (cartItem.type === 'good') {
            const variant = variantMap.get(cartItem.id);
            if (variant) newPrice = getPriceForLevel(variant, priceLevel);
        } else if (cartItem.type === 'service' && !cartItem.isCustom) {
            const service = products.find(p => p.id === cartItem.productId);
            if (service) newPrice = getPriceForLevel(service, priceLevel);
        }
        return { ...cartItem, price: newPrice };
    }));
  }, [priceLevel, variantMap, products, getPriceForLevel, setCart]);

  useEffect(() => {
    if (selectedCustomerId) {
        const debt = sales
            .filter(s => s.customerId === selectedCustomerId && s.remainingAmount > 0)
            .reduce((sum, s) => sum + s.remainingAmount, 0);
        setCustomerDebt(debt);
    } else {
        setCustomerDebt(0);
    }
  }, [selectedCustomerId, sales]);
  
  useEffect(() => {
    if(!selectedCustomerId) {
        setDownPayment(totalTTC);
    }
  }, [totalTTC, selectedCustomerId]);
  
  useEffect(() => {
      setManualTotal('');
  }, [cart])

  const addVariantToCart = useCallback((variant: ProductVariant) => {
    const currentStock = stockMap.get(variant.id) || 0;
    if (!isReturnMode && currentStock <= 0) {
        setNotification(t('productOutOfStock', { productName: variant.name }));
        setTimeout(() => setNotification(null), 3000);
        return;
    }

    setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id === variant.id);
        if (existingItem) {
            const newQuantity = existingItem.quantity + 1;
            if (!isReturnMode && newQuantity > currentStock) {
                setNotification(t('notEnoughStock', { productName: variant.name }));
                setTimeout(() => setNotification(null), 3000);
                return prevCart;
            }
            return prevCart.map(item =>
                item.id === variant.id ? { ...item, quantity: newQuantity } : item
            );
        }
        
        const parentProduct = products.find(p => p.id === variant.productId);
        const newCartItem: CartItem = {
            id: variant.id,
            storeId: variant.storeId,
            name: `${parentProduct?.name} - ${variant.name}`,
            type: 'good',
            price: getPriceForLevel(variant, priceLevel),
            purchasePrice: variant.purchasePrice,
            stock: currentStock,
            quantity: 1,
            image: variant.image,
            productId: variant.productId,
        };
        return [...prevCart, newCartItem];
    });
    setNotification(t('productAdded', { productName: variant.name }));
    setTimeout(() => setNotification(null), 3000);
  }, [setCart, isReturnMode, t, stockMap, products, getPriceForLevel, priceLevel]);

  const addServiceToCart = useCallback((service: Product) => {
    setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id === service.id);
        if (existingItem) {
             return prevCart.map(item =>
                item.id === service.id ? { ...item, quantity: item.quantity + 1 } : item
            );
        }
        const newCartItem: CartItem = {
            id: service.id,
            storeId: service.storeId,
            name: service.name,
            type: 'service',
            price: getPriceForLevel(service, priceLevel),
            quantity: 1,
            image: service.image,
            productId: service.id,
        };
        return [...prevCart, newCartItem];
    });
  }, [setCart, getPriceForLevel, priceLevel]);

  const addCustomItemToCart = (name: string, quantity: number, price: number) => {
    const id = crypto.randomUUID();
    const newItem: CartItem = {
      id,
      productId: id,
      storeId: user.storeId,
      name,
      price,
      quantity,
      type: 'service', // Treat as a service to not affect stock
      image: `https://via.placeholder.com/150/e9d5ff/a855f7?text=${encodeURIComponent(t('service'))}`,
      isCustom: true,
    };
    setCart(prev => [...prev, newItem]);
    setIsAddingCustomItem(false);
    setNotification(t('customItemAdded'));
    setTimeout(() => setNotification(null), 3000);
  };

  const handleScan = useCallback((barcode: string) => {
    const variant = barcodeMap.get(barcode);
    if (variant) {
        addVariantToCart(variant);
    } else {
        setNotification(t('productNotFound', { barcode }));
        setTimeout(() => setNotification(null), 3000);
    }
  }, [barcodeMap, addVariantToCart, t]);
  
  const handleReceiptScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!GEMINI_API_KEY) {
        setNotification(t('geminiApiKeyNotConfigured'));
        setTimeout(() => setNotification(null), 4000);
        if (event.target) {
            event.target.value = '';
        }
        return;
    }

    setIsScanning(true);
    setNotification(t('scanning'));

    try {
        const base64Image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });

        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const imagePart = {
            inlineData: {
                mimeType: file.type,
                data: base64Image,
            },
        };

        const textPart = {
            text: "From the provided receipt image, extract all purchase line items. For each item, provide its name (designation), quantity (quantite), and its unit price (prixHT). Return as a JSON array.",
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            designation: {
                                type: Type.STRING,
                                description: "Item name or description from the receipt.",
                            },
                            quantite: {
                                type: Type.NUMBER,
                                description: "The quantity of the item.",
                            },
                            prixHT: {
                                type: Type.NUMBER,
                                description: "The unit price of the item (Prix HT).",
                            },
                        },
                        required: ["designation", "quantite", "prixHT"],
                    },
                },
            },
        });
        
        const jsonResponse = JSON.parse(response.text);

        if (!Array.isArray(jsonResponse)) {
            throw new Error("AI response is not a valid array.");
        }

        const newCartItems: CartItem[] = jsonResponse.map((item: any) => {
            const id = crypto.randomUUID();
            return {
                id: id,
                productId: id,
                storeId: user.storeId,
                name: item.designation,
                price: item.prixHT,
                quantity: item.quantite,
                type: 'service',
                image: `https://via.placeholder.com/150/e9d5ff/a855f7?text=${encodeURIComponent(t('service'))}`,
                isCustom: true,
            };
        });

        setCart(prevCart => [...prevCart, ...newCartItems]);
        setNotification(t('itemsAddedFromReceipt', { count: newCartItems.length }));
        setTimeout(() => setNotification(null), 4000);

    } catch (error) {
        console.error("Error scanning receipt:", error);
        setNotification(t('receiptScanError'));
        setTimeout(() => setNotification(null), 4000);
    } finally {
        setIsScanning(false);
        if (event.target) {
            event.target.value = '';
        }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) && target.id !== 'pos-scanner-listener') {
            return;
        }

        if (scannerTimeout.current) {
            clearTimeout(scannerTimeout.current);
        }

        if (e.key === 'Enter') {
            if (barcodeBuffer.current.length > 3) {
                handleScan(barcodeBuffer.current);
            }
            barcodeBuffer.current = '';
            e.preventDefault();
            return;
        }

        if (e.key.length === 1) { // Only character keys
            barcodeBuffer.current += e.key;
        }

        scannerTimeout.current = setTimeout(() => {
            barcodeBuffer.current = '';
        }, 100);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (scannerTimeout.current) {
            clearTimeout(scannerTimeout.current);
        }
    };
  }, [handleScan]);

  const filteredProducts = useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();

    if (showServices) {
        const services = products.filter(p => p.type === 'service');
        if (!searchQuery) {
            return services;
        }
        return services.filter(p => p.name.toLowerCase().includes(lowerCaseQuery));
    }

    if (searchQuery.length < 1 && !selectedCategoryId) {
        return [];
    }
    
    const goods = products.filter(p => p.type === 'good');

    return goods.filter(p => {
        const categoryMatch = !selectedCategoryId || p.categoryId === selectedCategoryId;
        if (!categoryMatch) return false;
        
        if (!searchQuery) return true;

        const nameMatch = p.name.toLowerCase().includes(lowerCaseQuery);
        // Barcode search is handled by the keydown listener now.
        return nameMatch;
    });
  }, [products, selectedCategoryId, searchQuery, showServices]);

  const handleProductClick = (product: Product) => {
    if (product.type === 'service') {
        addServiceToCart(product);
    } else {
        setSelectingVariantFor(product);
    }
    setSearchQuery('');
  };
  
  const handleSelectVariant = (variant: ProductVariant) => {
    addVariantToCart(variant);
    setSelectingVariantFor(null);
  };


  const showResults = showServices || searchQuery.length > 0 || !!selectedCategoryId;

  const updateCartItem = (cartItemId: string, field: 'quantity' | 'price', value: number) => {
      setCart(prevCart => {
          const itemToUpdate = prevCart.find(item => item.id === cartItemId);
          if (!itemToUpdate) return prevCart;

          let newValue = value;
          if (field === 'quantity') {
              if (newValue < 0.5) newValue = 0.5;
              if (itemToUpdate.type === 'good' && !isReturnMode && itemToUpdate.stock && newValue > itemToUpdate.stock) {
                  newValue = itemToUpdate.stock;
              }
          }
          if (field === 'price' && newValue < 0) {
              newValue = 0;
          }

          return prevCart.map(item =>
              item.id === cartItemId ? { ...item, [field]: newValue } : item
          );
      });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.id !== cartItemId));
  };
  
  const clearCart = () => {
      setCart([]);
      setDownPayment(0);
      setManualTotal('');
      setSelectedCustomerId(undefined);
  }

  const handleFinalizeAndPrint = async (mode: 'invoice' | 'orderForm') => {
    if (cart.length === 0) {
        alert(t('emptyCartError'));
        return;
    }

    await completeSale(downPayment, selectedCustomerId, totalTTC, mode);
    setDownPayment(0);
    setSelectedCustomerId(undefined);
    setManualTotal('');
  }
  
  const handleProcessReturn = () => {
    if (cart.length === 0) {
        alert(t('emptyCartError'));
        return;
    }
    processReturn(cart);
  }
  
  const handlePayDebt = () => {
      const amount = parseFloat(debtPaymentAmount);
      if(selectedCustomerId && amount > 0) {
          if(amount > customerDebt){
              alert(t('enterValidPayment'));
              return;
          }
          payCustomerDebt(selectedCustomerId, amount);
          setDebtPaymentAmount('');
      }
  };

  useEffect(() => {
    clearCart();
    setShowServices(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReturnMode])

  return (
    <>
     {selectingVariantFor && (
        <SelectVariantModal
          product={selectingVariantFor}
          variants={variantsByProduct.get(selectingVariantFor.id) || []}
          stockMap={stockMap}
          onClose={() => setSelectingVariantFor(null)}
          onSelectVariant={handleSelectVariant}
          t={t}
          isReturnMode={isReturnMode}
        />
      )}
      {isAddingCustomItem && (
        <AddCustomItemModal
          onSave={addCustomItemToCart}
          onClose={() => setIsAddingCustomItem(false)}
          t={t}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg flex justify-center">
              <div className={`flex rounded-lg p-1 ${isReturnMode ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-gray-200 dark:bg-slate-700'}`}>
                  <button onClick={() => setIsReturnMode(false)} className={`px-8 py-2 rounded-md font-semibold transition-all ${!isReturnMode ? 'bg-white dark:bg-slate-800 shadow text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('saleMode')}</button>
                  <button onClick={() => setIsReturnMode(true)} className={`px-8 py-2 rounded-md font-semibold transition-all ${isReturnMode ? 'bg-white dark:bg-slate-800 shadow text-orange-700 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('returnMode')}</button>
              </div>
          </div>
           <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">{t('priceLevels')}</h3>
                    <div className="flex rounded-lg p-1 bg-gray-200 dark:bg-slate-700">
                        <button onClick={() => setPriceLevel('unit')} className={`px-4 py-2 rounded-md font-semibold transition-all text-sm ${priceLevel === 'unit' ? 'bg-white dark:bg-slate-800 shadow text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('unit')}</button>
                        <button onClick={() => setPriceLevel('semiWholesale')} className={`px-4 py-2 rounded-md font-semibold transition-all text-sm ${priceLevel === 'semiWholesale' ? 'bg-white dark:bg-slate-800 shadow text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('semiWholesale')}</button>
                        <button onClick={() => setPriceLevel('wholesale')} className={`px-4 py-2 rounded-md font-semibold transition-all text-sm ${priceLevel === 'wholesale' ? 'bg-white dark:bg-slate-800 shadow text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400'}`}>{t('wholesale')}</button>
                    </div>
                </div>
            </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg">
              <div className="flex items-center justify-center gap-3 bg-teal-50 dark:bg-slate-700 text-teal-700 dark:text-teal-300 p-3 rounded-lg">
                  <BarcodeIcon className="w-8 h-8"/>
                  <div>
                      <h2 className="text-lg font-bold">{t('barcodeScannerActive')}</h2>
                      <p className="text-sm">{t('scanToAdd')}</p>
                  </div>
              </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('manualAdd')}</h3>
                   <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsAddingCustomItem(true)}
                            className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <PlusIcon className="w-5 h-5" />
                            {t('addCustomItem')}
                        </button>
                        {store.enableAiReceiptScan && (
                          <button 
                              onClick={() => fileInputRef.current?.click()} 
                              disabled={isScanning}
                              className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 dark:disabled:bg-slate-500"
                          >
                              {isScanning ? (
                                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                              ) : (
                                  <SparklesIcon className="w-5 h-5" />
                              )}
                              {isScanning ? t('scanning') : t('scanReceipt')}
                          </button>
                        )}
                   </div>
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleReceiptScan}
                      className="hidden"
                      accept="image/*"
                  />
              </div>
              
              <div className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('filterByCategory')}</h4>
                  <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setSelectedCategoryId(null); setShowServices(false); }} className={`px-3 py-1 text-sm font-semibold rounded-full border-2 transition-all ${!selectedCategoryId && !showServices ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-teal-500 dark:hover:border-teal-500'}`}>{t('all')}</button>
                      {categories.map(cat => (
                          <button key={cat.id} onClick={() => { setSelectedCategoryId(cat.id); setShowServices(false); }} className={`px-3 py-1 text-sm font-semibold rounded-full border-2 transition-all ${selectedCategoryId === cat.id && !showServices ? 'bg-teal-600 text-white border-teal-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-teal-500 dark:hover:border-teal-500'}`}>{cat.name}</button>
                      ))}
                  </div>
              </div>
              
              <div className="mt-4">
                <button
                    onClick={() => { setShowServices(true); setSelectedCategoryId(null); }}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-bold rounded-lg border-2 transition-all ${showServices ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-gray-300 dark:border-slate-600 hover:border-purple-500 dark:hover:border-purple-500'}`}
                >
                    <SparklesIcon className="w-6 h-6" /> {t('services')}
                </button>
              </div>


              <div className="relative mt-4">
                  <input 
                      type="text" 
                      placeholder={t('searchPlaceholder')}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-teal-500 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  />
                  {showResults && (
                      <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                          {filteredProducts.length > 0 ? filteredProducts.map(p => (
                            <li key={p.id} className="flex items-center p-3 border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer" onClick={() => handleProductClick(p)}>
                                {p.type === 'good' ? (
                                <img src={p.image} alt={p.name} className="w-12 h-12 object-cover rounded-md mx-4 bg-gray-200" />
                                ) : (
                                <div className="w-12 h-12 flex items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/50 mx-4">
                                    <SparklesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400"/>
                                </div>
                                )}
                                <div className="flex-grow">
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                                    <div className="flex justify-between items-center">
                                       {p.type === 'service' && <p className="text-sm text-slate-500 dark:text-slate-400">{t('price')}: {p.price?.toFixed(2)} DH</p>}
                                       {p.type === 'good' && <p className="text-sm text-slate-500 dark:text-slate-400">{(variantsByProduct.get(p.id) || []).length} {t('variants')}</p>}
                                    </div>
                                </div>
                                <button className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 hover:bg-teal-200 font-bold py-2 px-3 rounded-lg text-sm flex items-center gap-1 pointer-events-none">
                                <PlusIcon className="w-4 h-4" /> {t('add')}
                                </button>
                            </li>
                          )) : <li className="p-3 text-slate-500 dark:text-slate-400">{t('productNotFound', {barcode: ''})}</li>}
                      </ul>
                  )}
              </div>
          </div>

          {notification && (
              <div className={`fixed bottom-4 left-4 z-50 p-4 text-center rounded-lg shadow-xl ${notification.includes('Impossible') || notification.includes('rupture') || notification.includes('Aucun') || notification.includes('Erreur') ? 'bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-200' : 'bg-teal-100 text-teal-800 dark:bg-teal-900/70 dark:text-teal-200'}`}>
                  {notification}
              </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <div className={`p-6 rounded-xl shadow-lg sticky top-6 flex flex-col h-[90vh] ${isReturnMode ? 'bg-orange-50 dark:bg-slate-800 border-2 border-orange-500/50' : 'bg-white dark:bg-slate-800'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isReturnMode ? t('returnReceipt') : t('invoice')}</h2>
              <button onClick={clearCart} title={isReturnMode ? t('returnReceipt') : t('invoice')} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 p-2 rounded-lg transition-colors">
                  <TrashIcon className="w-5 h-5"/>
              </button>
            </div>
            <div className="flex-grow overflow-y-auto pl-2 space-y-3 mb-4 text-sm">
              {cart.length > 0 ? cart.map(item => (
                <div key={item.id} className="grid grid-cols-6 items-center gap-2">
                  <div className="col-span-3">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{item.name}</p>
                    {item.type === 'good' || item.isCustom ? (
                       <p className="text-xs text-slate-500 dark:text-slate-400">{item.price.toFixed(2)} x {item.quantity}</p>
                    ) : (
                       <div className="flex items-center">
                          <input
                              type="number"
                              value={item.price}
                              onChange={(e) => updateCartItem(item.id, 'price', parseFloat(e.target.value))}
                              className="w-20 text-xs p-1 border rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                              min="0"
                              step="0.01"
                          />
                           <span className="text-xs text-slate-500 dark:text-slate-400 mx-1">x {item.quantity}</span>
                       </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateCartItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    min="0.5"
                    step="0.5"
                    max={isReturnMode || item.type === 'service' ? undefined : item.stock}
                    className="w-16 text-center border dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  />
                  <p className="font-bold text-slate-800 dark:text-slate-100 w-20 text-left col-span-1">{(item.price * item.quantity).toFixed(2)}</p>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 justify-self-center">
                    <TrashIcon className="w-5 h-5"/>
                  </button>
                </div>
              )) : <p className="text-center text-slate-500 dark:text-slate-400 py-16">{t('emptyCart')}</p>}
            </div>

            <div className="mt-auto pt-4 border-t-2 border-dashed dark:border-slate-600 space-y-4">
                {/* --- CUSTOMER & PAYMENTS (Sale mode only) --- */}
                {!isReturnMode && (
                <div className="space-y-3">
                    {/* Customer Select */}
                    <div className="flex justify-between items-center">
                    <label htmlFor="customer" className="font-semibold text-slate-600 dark:text-slate-300">{t('customer')}:</label>
                    <select id="customer" value={selectedCustomerId || ''} onChange={e => setSelectedCustomerId(e.target.value || undefined)} className="w-48 text-sm px-2 py-1 border rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600 focus:ring-teal-500">
                        <option value="">{t('cashCustomer')}</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    </div>
                    {/* Debt Payment */}
                    {customerDebt > 0 && (
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-300 dark:border-yellow-700 rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                        <h4 className="font-bold text-yellow-800 dark:text-yellow-300">{t('debtPayment')}</h4>
                        <span className="font-bold text-red-600 dark:text-red-400">{customerDebt.toFixed(2)} DH</span>
                        </div>
                        <div className="flex gap-2 items-center">
                        <input 
                            type="number"
                            placeholder={t('amount')}
                            value={debtPaymentAmount}
                            onChange={e => setDebtPaymentAmount(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                            min="0.01"
                            step="0.01"
                            max={customerDebt}
                        />
                        <button
                            onClick={handlePayDebt}
                            disabled={!debtPaymentAmount || parseFloat(debtPaymentAmount) <= 0}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg disabled:bg-gray-400 dark:disabled:bg-slate-500 whitespace-nowrap"
                        >
                            {t('save')}
                        </button>
                        </div>
                    </div>
                    )}
                    {/* Manual Total */}
                    <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                    <label htmlFor="manualTotal" className="font-semibold">{t('manualTotal')}</label>
                    <input 
                        type="number"
                        id="manualTotal"
                        placeholder={subtotal.toFixed(2)}
                        value={manualTotal}
                        onChange={e => setManualTotal(e.target.value)}
                        className="w-24 px-2 py-1 border rounded-md text-left bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 font-bold dark:border-slate-600"
                        min="0"
                        step="0.01"
                    />
                    </div>
                    {/* Down Payment */}
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <label htmlFor="downPayment" className="font-semibold">{t('downPayment')}</label>
                    <div className="flex items-center gap-2">
                        <input 
                        type="number"
                        id="downPayment"
                        value={downPayment}
                        onChange={(e) => setDownPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-24 px-2 py-1 border rounded-md text-left bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 disabled:bg-gray-200 dark:disabled:bg-slate-600 disabled:cursor-not-allowed dark:border-slate-600"
                        disabled={!selectedCustomerId}
                        readOnly={!selectedCustomerId}
                        step="0.01"
                        />
                        {selectedCustomerId && (<button onClick={() => setDownPayment(totalTTC)} className="text-xs bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 font-semibold px-2 py-1 rounded-md hover:bg-cyan-200 dark:hover:bg-cyan-800/50">{t('total')}</button>)}
                    </div>
                    </div>
                </div>
                )}

                {/* --- TOTALS & FINALIZE --- */}
                {isReturnMode ? (
                // Simple refund display for return mode
                <>
                    <div className={`flex justify-between font-bold text-2xl p-3 rounded-lg bg-orange-200 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300`}>
                    <span>{t('refundAmount')}:</span>
                    <span>{subtotal.toFixed(2)} DH</span>
                    </div>
                    <div className="mt-2">
                    <button onClick={handleProcessReturn} className="bg-orange-600 hover:bg-orange-700 w-full text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 dark:disabled:bg-slate-500" disabled={cart.length === 0}>
                        {t('processReturn')}
                    </button>
                    </div>
                </>
                ) : (
                // Detailed totals for sale mode
                <div className="space-y-3">
                    {/* Order Form Total and Button */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <div className="flex justify-between text-slate-700 dark:text-slate-300 mb-2">
                            <span className="font-bold">{t('total')}:</span>
                            <span className="font-bold">{totalTTC.toFixed(2)} DH</span>
                        </div>
                        <button onClick={() => handleFinalizeAndPrint('orderForm')} className="w-full bg-slate-600 text-white font-bold py-2 rounded-lg hover:bg-slate-700 transition-colors disabled:bg-gray-400 dark:disabled:bg-slate-500 text-sm" disabled={cart.length === 0}>
                            {t('finalizeAndPrintOrderForm')}
                        </button>
                    </div>

                    {/* TTC Total and Button */}
                    <div className="p-3 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg">
                        <div className="text-sm space-y-1">
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>{t('totalHT')}:</span>
                                <span>{totalHT.toFixed(2)} DH</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>{t('vat')}:</span>
                                <span>{tvaAmount.toFixed(2)} DH</span>
                            </div>
                            <div className="flex justify-between font-bold text-xl text-slate-800 dark:text-slate-100 mt-2 pt-2 border-t dark:border-slate-700">
                                <span>{t('totalTTC')}:</span>
                                <span>{totalTTC.toFixed(2)} DH</span>
                            </div>
                        </div>
                        <button onClick={() => handleFinalizeAndPrint('invoice')} className="mt-2 w-full bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 dark:disabled:bg-slate-500" disabled={cart.length === 0}>
                            {t('finalizeAndPrintInvoice')}
                        </button>
                    </div>

                    {/* Remaining Amount Banner */}
                    <div className={`flex justify-between font-bold text-2xl p-3 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300`}>
                        <span>{t('remaining')}:</span>
                        <span>{remainingAmount.toFixed(2)} DH</span>
                    </div>
                </div>
                )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default PointOfSale;