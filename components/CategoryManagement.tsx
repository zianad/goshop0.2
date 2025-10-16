

import React, { useState } from 'react';
import type { Category } from '../types.ts';
import { TagIcon, EditIcon, TrashIcon } from './Icons.tsx';
import { translations } from '../translations.ts';

type Language = 'fr' | 'ar';
type TFunction = (key: keyof typeof translations.fr, options?: { [key: string]: string | number }) => string;

interface EditCategoryModalProps {
    category: Category;
    onClose: () => void;
    onSave: (category: Category) => Promise<void>;
    t: TFunction;
}

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ category, onClose, onSave, t }) => {
    const [name, setName] = useState(category.name);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...category, name: name.trim() });
    };

    return (
        <div className="fixed inset-0 bg-slate-800 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">{t('editCategory')}</h3>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="editCategoryName" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('categoryName')}</label>
                    <input
                        id="editCategoryName"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600"
                        required
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                        <button type="submit" className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700">{t('save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface CategoryManagementProps {
  storeId: string;
  categories: Category[];
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category | undefined>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  t: TFunction;
  language: Language;
}

const CategoryManagement: React.FC<CategoryManagementProps> = ({ storeId, categories, addCategory, updateCategory, deleteCategory, t, language }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const clearFeedback = () => {
    setTimeout(() => setFeedback(null), 4000);
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: t('categoryNameEmptyError')});
      clearFeedback();
      return;
    }
    
    if (categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
        setFeedback({ type: 'error', message: t('categoryExistsError', { name: trimmedName }) });
        clearFeedback();
        return;
    }

    await addCategory({ name: trimmedName, storeId });
    setNewCategoryName('');
    setFeedback({ type: 'success', message: t('categoryAddedSuccess', { name: trimmedName })});
    clearFeedback();
  };
  
  const handleUpdateCategory = async (updatedCategory: Category) => {
    setFeedback(null);
    if (!updatedCategory.name) {
        setFeedback({ type: 'error', message: t('categoryNameEmptyError') });
        clearFeedback();
        return;
    }
    if (categories.some(c => c.name.toLowerCase() === updatedCategory.name.toLowerCase() && c.id !== updatedCategory.id)) {
        setFeedback({ type: 'error', message: t('categoryExistsError', { name: updatedCategory.name }) });
        clearFeedback();
        return;
    }
    await updateCategory(updatedCategory);
    setEditingCategory(null);
    setFeedback({ type: 'success', message: t('categoryUpdatedSuccess', { name: updatedCategory.name }) });
    clearFeedback();
  };

  const handleDeleteCategory = async (category: Category) => {
    setFeedback(null);
    if (window.confirm(t('confirmCategoryDelete', { name: category.name }))) {
      try {
        await deleteCategory(category.id);
        setFeedback({ type: 'success', message: t('categoryDeletedSuccess', { name: category.name }) });
      } catch (e) {
        setFeedback({ type: 'error', message: t('categoryDeleteError') });
      }
      clearFeedback();
    }
  };

  return (
    <>
      {editingCategory && (
        <EditCategoryModal
            category={editingCategory}
            onClose={() => setEditingCategory(null)}
            onSave={handleUpdateCategory}
            t={t}
        />
      )}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><TagIcon/>{t('addNewCategory')}</h2>
          <form onSubmit={handleAddCategory} className="grid sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('categoryName')}</label>
                <input type="text" id="name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:border-slate-600" required />
              </div>
              <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">
                {t('add')}
              </button>
          </form>
          {feedback && (
              <div className={`mt-4 p-3 rounded-lg text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                  {feedback.message}
              </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{t('categoryList')}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
              <thead className="text-xs text-slate-600 dark:text-slate-300 uppercase bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th scope="col" className="px-6 py-3">{t('categoryName')}</th>
                    <th scope="col" className="px-6 py-3 text-right rtl:text-left">{t('actions')}</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {categories.map(category => (
                  <tr key={category.id} className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <th scope="row" className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100 whitespace-nowrap">{category.name}</th>
                    <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-4">
                            <button onClick={() => setEditingCategory(category)} className="text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300" title={t('edit')}>
                                <EditIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={() => handleDeleteCategory(category)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title={t('delete')}>
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categories.length === 0 && <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noCategoriesAdded')}</p>}
          </div>
        </div>
      </div>
    </>
  );
};

export default CategoryManagement;
