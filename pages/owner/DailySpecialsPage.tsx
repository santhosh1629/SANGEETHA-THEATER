import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getMenu, addMenuItem, updateMenuItem, removeMenuItem } from '../../services/mockApi';
import { useAuth } from '../../context/AuthContext';
import type { MenuItem } from '../../types';

type FormState = {
    name: string;
    price: number | '';
    imageUrl: string;
    isAvailable: boolean;
    emoji: string;
    description: string;
    isCombo: boolean;
    comboItemIds: string[];
};

const initialFormState: FormState = {
    name: '', price: '', imageUrl: '', isAvailable: true, emoji: '', description: '', isCombo: false, comboItemIds: [],
};

// Fix: Defined the missing InputField component used in the form
const InputField: React.FC<{
    label: string;
    name: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    step?: string;
    min?: string;
    className?: string;
}> = ({ label, name, value, onChange, type = 'text', placeholder, required, step, min, className = '' }) => (
    <div>
        <label htmlFor={name} className="block text-gray-300 font-semibold mb-1 text-sm">{label}</label>
        <input
            id={name}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            step={step}
            min={min}
            className={`w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-500 ${className}`}
        />
    </div>
);

const processAndCompressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Increased from 250 for better quality

                if (img.width > MAX_WIDTH) {
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context failed'));

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Use a higher quality setting for jpeg compression
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // Increased quality from 0.7
                resolve(dataUrl);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const AddItemCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="flex items-center justify-center">
        <button
            onClick={onClick}
            className="group flex flex-col items-center justify-center w-full h-full min-h-[220px] bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-2xl text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-all duration-300 shadow-lg hover:shadow-indigo-500/20"
        >
            <svg className="w-12 h-12 mb-2 transition-transform group-hover:scale-110 group-hover:rotate-12 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-bold text-lg">Add New Food Item</span>
        </button>
    </div>
);

const OwnerMenuItemCard: React.FC<{ item: MenuItem; onEdit: (item: MenuItem) => void; onDelete: (itemId: string) => void; }> = ({ item, onEdit, onDelete }) => (
     <div className={`bg-gray-800 rounded-2xl shadow-md border border-gray-700 overflow-hidden flex flex-col transition-all duration-300 ${!item.isAvailable ? 'opacity-60' : ''}`}>
        <div className="relative group">
            <img src={item.imageUrl} alt={item.name} className={`w-full h-40 object-cover transition-transform duration-500 group-hover:scale-105 ${!item.isAvailable ? 'grayscale' : ''}`} />
             <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full text-white ${item.isAvailable ? 'bg-green-600/80' : 'bg-red-600/80'} backdrop-blur-sm`}>
                {item.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
            </span>
        </div>
        <div className="p-4 flex-grow flex flex-col">
            <h3 className="font-bold text-gray-200 flex-grow text-lg">{item.emoji} {item.name}</h3>
            <p className="font-bold text-indigo-400 text-lg mt-1">₹{item.price.toFixed(2)}</p>
        </div>
        <div className="bg-gray-700/50 p-2 flex justify-end gap-2 border-t border-gray-700">
            <button onClick={() => onEdit(item)} className="text-xs bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-500 transition-colors">EDIT</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="text-xs bg-red-600/20 text-red-400 border border-red-600/50 font-bold px-3 py-1.5 rounded-lg hover:bg-red-600 hover:text-white transition-colors">DELETE</button>
        </div>
    </div>
);


const DailySpecialsPage: React.FC = () => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [formData, setFormData] = useState<FormState>(initialFormState);
    const { user } = useAuth();
    
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageError, setImageError] = useState('');


    const fetchMenu = useCallback(async () => {
        try {
            const data = await getMenu();
            setMenuItems(data);
        } catch (error) { console.error("Failed to fetch menu", error); } 
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchMenu().finally(() => setLoading(false));
    }, [fetchMenu]);
    
    const regularMenuItems = useMemo(() => menuItems.filter(item => !item.isCombo), [menuItems]);

    const handleOpenDrawer = (item: MenuItem | null = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name, price: item.price, imageUrl: item.imageUrl, isAvailable: item.isAvailable,
                emoji: item.emoji || '', description: item.description || '', isCombo: item.isCombo || false,
                comboItemIds: item.comboItems?.map(ci => ci.id) || [],
            });
            setImagePreview(item.imageUrl);
        } else {
            setEditingItem(null);
            setFormData(initialFormState);
            setImagePreview(null);
        }
        setImageError('');
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => { 
        setIsDrawerOpen(false); 
        setEditingItem(null); 
        setFormData(initialFormState);
        if (imagePreview && imagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);
        setImageError('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: isCheckbox ? checked : (name === 'price' ? (value === '' ? '' : parseFloat(value)) : value) }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setImageError('File too large (max 5MB)');
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setImageError('Invalid file type (JPG, PNG, WEBP only)');
            return;
        }

        if (imagePreview && imagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview);
        }

        setImageError('');
        setIsProcessingImage(true);
        
        const newPreviewUrl = URL.createObjectURL(file);
        setImagePreview(newPreviewUrl);

        try {
            const compressedDataUrl = await processAndCompressImage(file);
            setFormData(prev => ({...prev, imageUrl: compressedDataUrl}));
        } catch (err) {
            setImageError('Could not process image.');
            setImagePreview(null);
            URL.revokeObjectURL(newPreviewUrl);
        } finally {
            setIsProcessingImage(false);
        }
    };


    const handleComboItemChange = (itemId: string) => {
        setFormData(prev => {
            const newComboItemIds = new Set(prev.comboItemIds);
            newComboItemIds.has(itemId) ? newComboItemIds.delete(itemId) : newComboItemIds.add(itemId);
            return { ...prev, comboItemIds: Array.from(newComboItemIds) };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Authentication required.' } }));
            return;
        }
        if (formData.price === '' || !formData.imageUrl) {
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Price and Image are required.' } }));
            return;
        }
        
        setIsSaving(true);
        const comboItems = formData.isCombo ? formData.comboItemIds.map(id => ({ id, name: regularMenuItems.find(i => i.id === id)?.name || 'Unknown' })) : [];
        const itemData: any = { ...formData, price: formData.price, comboItems };

        try {
            if (editingItem) {
                await updateMenuItem(editingItem.id, itemData);
            } else {
                await addMenuItem(itemData, user.id);
            }
            await fetchMenu();
            handleCloseDrawer();
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: `Food item ${editingItem ? 'updated' : 'added'} successfully!` } }));

        } catch (error: any) { 
            // Extract meaningful message from Error or Supabase object
            const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            console.error("Save failure details:", errorMsg);
            
            window.dispatchEvent(new CustomEvent('show-owner-toast', { 
                detail: { message: `Failed to save: ${errorMsg}` } 
            }));
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (itemId: string) => {
        if (!window.confirm("Are you sure you want to delete this menu item?")) {
            return;
        }

        try { 
            await removeMenuItem(itemId); 
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: 'Menu item deleted successfully' } }));
            setMenuItems(prevItems => prevItems.filter(item => item.id !== itemId));
        } 
        catch (error: any) { 
            const msg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            console.error("Delete failure details:", msg);
            window.dispatchEvent(new CustomEvent('show-owner-toast', { detail: { message: `Failed to delete: ${msg}` } }));
        }
    }
    
    if (loading) return <p className="text-gray-300">Loading menu...</p>;

    return (
        <div className="relative min-h-screen pb-10">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-gray-200">Manage Menu 📋</h1>
                    <p className="text-gray-400 mt-1">Add, edit, or remove items from your canteen menu.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AddItemCard onClick={() => handleOpenDrawer()} />
                {menuItems.map(item => (
                    <OwnerMenuItemCard 
                        key={item.id} 
                        item={item}
                        onEdit={handleOpenDrawer}
                        onDelete={handleDelete}
                    />
                ))}
            </div>

            <div className={`fixed inset-0 z-50 overflow-hidden flex justify-end md:items-center transition-all duration-300 ${isDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <div 
                    className={`absolute inset-0 bg-black/60 md:bg-black/20 backdrop-blur-sm md:backdrop-blur-none transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'}`} 
                    onClick={handleCloseDrawer}
                ></div>

                <div 
                    className={`
                        relative w-full bg-gray-900 shadow-2xl flex flex-col border-l border-gray-700
                        transform transition-transform duration-300 ease-out
                        ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
                        h-full md:w-[400px] md:h-[85vh] md:mr-6 md:rounded-3xl md:border
                    `}
                >
                    <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10 md:rounded-t-3xl">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            {editingItem ? '✏️ Edit Item' : '➕ New Item'}
                        </h2>
                        <button onClick={handleCloseDrawer} className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-5 scrollbar-thin">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3">
                                    <InputField label="Item Name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Chicken Biryani" required />
                                </div>
                                <div className="col-span-1">
                                    <InputField label="Emoji" name="emoji" value={formData.emoji} placeholder="🍗" onChange={handleInputChange} className="text-center"/>
                                </div>
                            </div>

                            <InputField label="Price (₹)" name="price" type="number" value={formData.price} onChange={handleInputChange} required step="0.01" min="0" placeholder="0.00" />
                            
                             <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                <label className="block text-gray-300 font-semibold mb-3 text-sm">Item Image</label>
                                <div className="flex items-start gap-4">
                                    <div className="w-24 h-24 flex-shrink-0 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border border-gray-600 relative group">
                                        {isProcessingImage ? (
                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                                        ) : imagePreview ? (
                                            <>
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-xs text-white font-bold">Change</span>
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-gray-500 text-xs text-center p-2">Upload Image</span>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <input id="image-upload" type="file" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="block w-full text-xs text-gray-400 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer" />
                                        <p className="text-xs text-gray-500 mt-2">JPG, PNG or WEBP (Max 5MB)</p>
                                        {imageError && <p className="text-red-400 text-xs mt-1">{imageError}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                <label className="block text-gray-300 font-semibold mb-3 text-sm">Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={3}
                                    placeholder="Tell customers what's special about this item..."
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-500"
                                />
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" name="isCombo" checked={formData.isCombo} onChange={handleInputChange} className="sr-only" />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${formData.isCombo ? 'bg-indigo-600' : 'bg-gray-600'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isCombo ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-200">This is a Combo Deal</span>
                                </label>

                                {formData.isCombo && (
                                    <div className="pt-2 space-y-2 max-h-40 overflow-y-auto scrollbar-thin pr-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Items in Combo</p>
                                        {regularMenuItems.length > 0 ? regularMenuItems.map(item => (
                                            <label key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.comboItemIds.includes(item.id)}
                                                    onChange={() => handleComboItemChange(item.id)}
                                                    className="rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-800"
                                                />
                                                <span className="text-sm text-gray-300">{item.emoji} {item.name}</span>
                                            </label>
                                        )) : (
                                            <p className="text-xs text-gray-500 italic">No regular items available to create a combo.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={handleInputChange} className="sr-only" />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${formData.isAvailable ? 'bg-green-600' : 'bg-red-600'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isAvailable ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-200">Item is Available to Order</span>
                                </label>
                            </div>

                            <div className="pt-6 pb-4">
                                <button
                                    type="submit"
                                    disabled={isSaving || isProcessingImage}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all transform active:scale-95 disabled:bg-indigo-800 disabled:opacity-50"
                                >
                                    {isSaving ? 'Processing...' : (editingItem ? 'Update Menu Item' : 'Add to Menu')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Fix: Exported the component as default to resolve App.tsx import error
export default DailySpecialsPage;