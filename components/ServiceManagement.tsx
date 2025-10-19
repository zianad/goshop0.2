import React, { useState } from 'react';
import type { Product, ProductVariant } from '../types';
import { SparklesIcon, TrashIcon, EditIcon } from './Icons';
import { translations } from '../translations';

type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface EditServiceModalProps {
    service: Product;
    onClose: () => void;
    onSave: (service: Product) => Promise<void>;
    t: TFunction;
}

const EditServiceModal: React.FC<EditServiceModalProps> = ({ service, onClose, onSave, t }) => {
    const [editedService, setEditedService] = useState(service);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setEditedService(prev => ({ ...prev, [id]: e.target.type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(editedService);
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('editService')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('serviceName')}</label>
                        <input
                            type="text"
                            id="name"
                            value={editedService.name}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('price')}</label>
                            <input
                                type="number"
                                id="price"
                                value={editedService.price}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="priceSemiWholesale" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('semiWholesalePrice')}</label>
                            <input
                                type="number"
                                id="priceSemiWholesale"
                                value={editedService.priceSemiWholesale || ''}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label htmlFor="priceWholesale" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('wholesalePrice')}</label>
                            <input
                                type="number"
                                id="priceWholesale"
                                value={editedService.priceWholesale || ''}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                        <button type="submit" className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


interface ServiceManagementProps {
  storeId: string;
  services: Product[];
  addService: (service: Omit<Product, 'id'>) => Promise<{ product: Product, variants: ProductVariant[] }>;
  updateService: (service: Product) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  t: TFunction;
}

const ServiceManagement: React.FC<ServiceManagementProps> = ({ storeId, services, addService, updateService, deleteService, t }) => {
  const [newService, setNewService] = useState({ name: '', price: 0, priceSemiWholesale: 0, priceWholesale: 0 });
  const [editingService, setEditingService] = useState<Product | null>(null);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewService(prev => ({ ...prev, [id]: e.target.type === 'number' ? parseFloat(value) || 0 : value }));
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!newService.name || newService.price <= 0) {
      setFeedback({ type: 'error', message: t('fillNameAndPriceError') });
      return;
    }
    
    const serviceToAdd: Omit<Product, 'id'> = {
        name: newService.name,
        price: newService.price,
        priceSemiWholesale: newService.priceSemiWholesale || undefined,
        priceWholesale: newService.priceWholesale || undefined,
        type: 'service',
        storeId,
        image: `https://via.placeholder.com/200/e9d5ff/a855f7?text=${encodeURIComponent(t('services'))}`,
        createdAt: new Date().toISOString(),
    };

    await addService(serviceToAdd);
    setNewService({ name: '', price: 0, priceSemiWholesale: 0, priceWholesale: 0 });
    setFeedback({ type: 'success', message: t('serviceAddedSuccess', { name: newService.name }) });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDeleteService = async (id: string) => {
      if(window.confirm(t('confirmServiceDelete'))) {
          await deleteService(id);
      }
  }
  
  const handleUpdateService = async (service: Product) => {
    setFeedback(null);
    if (!service.name || (service.price ?? 0) <= 0) {
      setFeedback({ type: 'error', message: t('fillNameAndPriceError') });
      return;
    }
    await updateService(service);
    setEditingService(null);
    setFeedback({ type: 'success', message: t('serviceUpdatedSuccess', { name: service.name }) });
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <>
      {editingService && (
        <EditServiceModal
            service={editingService}
            onClose={() => setEditingService(null)}
            onSave={handleUpdateService}
            t={t}
        />
      )}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><SparklesIcon />{t('addNewService')}</h2>
          <form onSubmit={handleAddService} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('serviceName')}</label>
              <input
                type="text"
                id="name"
                value={newService.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                placeholder={t('serviceNamePlaceholder')}
                required
              />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                    <label htmlFor="price" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('sellingPrice')}</label>
                    <input
                        type="number"
                        id="price"
                        value={newService.price}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                        min="0"
                        step="0.01"
                        required
                    />
                </div>
                 <div>
                    <label htmlFor="priceSemiWholesale" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('semiWholesalePrice')}</label>
                    <input
                        type="number"
                        id="priceSemiWholesale"
                        value={newService.priceSemiWholesale}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                        min="0"
                        step="0.01"
                    />
                </div>
                <div>
                    <label htmlFor="priceWholesale" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('wholesalePrice')}</label>
                    <input
                        type="number"
                        id="priceWholesale"
                        value={newService.priceWholesale}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                        min="0"
                        step="0.01"
                    />
                </div>
            </div>
            <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 transition-colors">
              {t('saveService')}
            </button>
          </form>
          {feedback && (
              <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                  {feedback.message}
              </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('serviceList')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right rtl:text-left text-slate-500 dark:text-slate-400">
              <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3">{t('serviceName')}</th>
                  <th scope="col" className="px-6 py-3">{t('price')}</th>
                  <th scope="col" className="px-6 py-3 text-left rtl:text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {services.map(service => (
                  <tr key={service.id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{service.name}</th>
                    <td className="px-6 py-4">{(service.price ?? 0).toFixed(2)} DH</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-start gap-4">
                          <button onClick={() => setEditingService(service)} className="text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300">
                            <EditIcon className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDeleteService(service.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                              <TrashIcon className="w-5 h-5" />
                          </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {services.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noServicesAdded')}</p>}
          </div>
        </div>
      </div>
    </>
  );
};

export default ServiceManagement;