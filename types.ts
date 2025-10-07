export interface Store {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  ice?: string;
  isActive: boolean;
  licenseKey: string;
  licenseProof: string | null;
  trialStartDate?: string | null;
  trialDurationDays: number;
  enableAiReceiptScan?: boolean;
}

export interface Customer {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  email?: string;
}

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  email?: string;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  type: 'good' | 'service';
  image: string; // Main image for template / service
  createdAt: string;
  supplierId?: string;
  categoryId?: string;
  // For services only
  price?: number; 
  priceSemiWholesale?: number;
  priceWholesale?: number;
}

export interface ProductVariant {
  id: string;
  storeId: string;
  productId: string; // FK to Product
  name: string; // e.g. "Red, Large"
  price: number;
  priceSemiWholesale?: number;
  priceWholesale?: number;
  purchasePrice: number;
  barcode?: string;
  lowStockThreshold: number;
  image: string; // Variant-specific image
}

export interface StockBatch {
    id: string;
    storeId: string;
    variantId: string; // Changed from productId
    quantity: number;
    purchasePrice: number;
    createdAt: string;
}

export interface CartItem {
  id: string; // variantId for goods, productId for services
  storeId: string;
  name: string; // Full descriptive name, e.g. "T-Shirt - Red"
  price: number;
  quantity: number;
  image: string;
  type: 'good' | 'service';
  productId: string; // Parent product ID. For services, this is same as `id`.
  purchasePrice?: number; 
  stock?: number;
  isCustom?: boolean;
}

export interface Sale {
  id: string;
  storeId: string;
  userId: string;
  date: string;
  items: CartItem[];
  total: number;
  discount?: number;
  downPayment: number;
  remainingAmount: number;
  profit: number;
  customerId?: string;
}

export interface Expense {
  id: string;
  storeId: string;
  description: string;
  amount: number;
  date: string;
}

export interface User {
  id: string;
  storeId: string;
  name: string;
  email?: string; // For admins
  password?: string; // For admins
  pin?: string;   // For sellers
  role: 'admin' | 'seller';
}

export interface Return {
  id: string;
  storeId: string;
  userId: string;
  saleId?: string;
  date: string;
  items: CartItem[];
  refundAmount: number;
  profitLost: number;
}

export interface PurchaseItem {
  variantId: string;
  productId: string;
  productName: string; // Parent product name
  variantName: string; // Variant name
  quantity: number;
  purchasePrice: number; 
}

export interface Purchase {
  id: string;
  storeId: string;
  supplierId?: string;
  date: string;
  items: PurchaseItem[];
  totalAmount: number;
  reference?: string;
  amountPaid: number;
  remainingAmount: number;
  paymentMethod: string;
}

export enum Tab {
  POS = 'POS',
  Products = 'Products',
  Services = 'Services',
  Finance = 'Finance',
  Customers = 'Customers',
  Suppliers = 'Suppliers',
  Categories = 'Categories',
  Settings = 'Settings',
}

export interface StoreTypeMap {
  products: Product[];
  productVariants: ProductVariant[];
  sales: Sale[];
  expenses: Expense[];
  users: User[];
  returns: Return[];
  stores: Store[];
  customers: Customer[];
  suppliers: Supplier[];
  categories: Category[];
  purchases: Purchase[];
  stockBatches: StockBatch[];
}