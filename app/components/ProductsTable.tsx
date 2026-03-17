"use client";

import { useEffect, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import Image from "next/image";
import Link from "next/link";

interface Product {
    id: number;
    user_id: string;
    username: string; // Seller name
    title: string;
    price: string;
    category: string;
    status: string;
    views: number;
    created_at: string;
    image_url: string;
}

interface ProductsTableProps {
    title: string;
    description: string;
    statusFilter?: string;
}

export default function ProductsTable({ title, description, statusFilter }: ProductsTableProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedImages, setSelectedImages] = useState<string[] | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [galleryProductId, setGalleryProductId] = useState<number | null>(null); // New state to store product ID for gallery

    const cleanImageUrl = (url: string) => {
        if (!url) return '';
        // 1. Remove all whitespace and common JSON/SQL escape characters
        let cleaned = String(url).replace(/\s/g, '').replace(/[\\"]/g, '');
        
        // 2. Ensure it starts with a valid protocol or path
        if (cleaned.startsWith('data:') || cleaned.startsWith('http') || cleaned.startsWith('/') || cleaned.startsWith('./')) {
            // 3. Fix common missing comma in base64 strings
            if (cleaned.startsWith('data:') && cleaned.includes('base64') && !cleaned.includes('base64,')) {
                cleaned = cleaned.replace('base64', 'base64,');
            }
            return cleaned;
        }
        
        // 4. Default to uploads if it's just a filename
        if (cleaned.length > 4 && cleaned.includes('.')) {
            return '/uploads/' + cleaned;
        }
        
        return '';
    };

    const parseImages = (imageUrl: string): string[] => {
        if (!imageUrl) return [];
        try {
            if (imageUrl.startsWith('[') || imageUrl.startsWith('{')) {
                const parsed = JSON.parse(imageUrl);
                const items = Array.isArray(parsed) ? parsed : [parsed];
                return items.map(i => cleanImageUrl(typeof i === 'object' ? (i.url || i.image_url) : i)).filter(url => url !== '');
            } else if (imageUrl.startsWith('data:')) {
                const parts = imageUrl.split('data:').filter(p => p.trim() !== '');
                if (parts.length > 1) return parts.map(p => cleanImageUrl('data:' + p)).filter(url => url !== '');
                return [cleanImageUrl(imageUrl)];
            } else {
                return imageUrl.split(',').map(s => cleanImageUrl(s)).filter(url => url !== '');
            }
        } catch (e) {
            const cleaned = cleanImageUrl(imageUrl);
            return cleaned ? [cleaned] : [];
        }
    };

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await adminService.fetchAllProducts(statusFilter);
            setProducts(data || []);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, [statusFilter]);

    const handleAction = async (productId: number, status: string) => {
        try {
            if (status === 'Delete') {
                if (!confirm("Are you sure you want to delete this product?")) return;
                await adminService.deleteProduct(productId.toString());
                setProducts(prev => prev.filter(p => p.id !== productId));
            } else {
                await adminService.updateProductStatus(productId.toString(), status);
                
                setProducts(prev => {
                    // Update the product in the full list first
                    const updatedList = prev.map(p => p.id === productId ? { ...p, status } : p);
                    
                    // If we have a status filter, we should check if the product still belongs in this view
                    if (statusFilter && statusFilter !== 'all') {
                        const activeFilters = statusFilter.split(',').map(s => s.trim());
                        return updatedList.filter(p => activeFilters.includes(p.status));
                    }
                    
                    return updatedList;
                });
            }
            setActiveMenu(null);
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const getPrimaryImage = (imageUrl: string) => {
        if (!imageUrl) return null;
        const images = parseImages(imageUrl);
        return images.length > 0 ? images[0] : null;
    };

    const openImageGallery = (productId: number, imageUrl: string) => {
        if (!imageUrl) return;
        const images = parseImages(imageUrl);
        
        if (images.length > 0) {
            setSelectedImages(images);
            setCurrentImageIndex(0);
            setGalleryProductId(productId); // Store the product ID
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{title}</h1>
                    <p className="text-slate-400 text-sm font-medium">{description}</p>
                </div>
            </div>

            <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[1.5rem] md:rounded-[2rem] relative min-h-[500px] md:min-h-[700px] shadow-2xl overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-[2rem]">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
                    </div>
                )}
                
                <div className="w-full overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[800px]">
                        <thead>
                            <tr className="bg-[#1a1a1a]/50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="px-6 py-5">Product Details</th>
                                <th className="px-6 py-5">Seller</th>
                                <th className="px-6 py-5">Price</th>
                                <th className="px-6 py-5">Category</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Date</th>
                                <th className="px-6 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1a1a]">
                            {products.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                                        No products found in this category.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product.id} className="hover:bg-white/[0.02] transition-all group border-b border-[#1a1a1a]">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openImageGallery(product.id, product.image_url);
                                                    }}
                                                    className="w-12 h-12 rounded-2xl bg-black border border-white/5 flex items-center justify-center text-slate-700 text-xl shrink-0 cursor-pointer hover:border-white/20 transition-all overflow-hidden relative group/thumb"
                                                >
                                                    {(() => {
                                                        const imgUrl = getPrimaryImage(product.image_url);
                                                        if (!imgUrl) return <IonIcon name="image-outline" />;
                                                        if (imgUrl.startsWith('data:')) {
                                                            return (
                                                                <img
                                                                    src={imgUrl}
                                                                    alt={product.title}
                                                                    className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500"
                                                                />
                                                            );
                                                        }
                                                        return (
                                                            <Image
                                                                src={imgUrl}
                                                                alt={product.title}
                                                                fill
                                                                sizes="48px"
                                                                className="object-cover group-hover/thumb:scale-110 transition-transform duration-500"
                                                            />
                                                        );
                                                    })()}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                        <IonIcon name="expand-outline" className="text-white text-sm" />
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-white group-hover:text-blue-400 transition-colors truncate max-w-[180px]">{product.title}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter">PID-{product.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm">{product.username || 'Unknown'}</span>
                                                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">ID: {product.user_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-white font-black text-sm">R {parseFloat(product.price || '0').toLocaleString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 rounded-full bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] border border-white/5">
                                                {product.category || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                product.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                product.status === 'pending' || product.status === 'review' || product.status === 'reviewing' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                                {product.status}
                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                                            {product.created_at ? new Date(product.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className={`px-6 py-4 text-right relative ${activeMenu === product.id ? 'z-[50]' : ''}`}>
                                            <button
                                                onClick={() => setActiveMenu(activeMenu === product.id ? null : product.id)}
                                                className={`p-2 hover:bg-[#1a1a1a] rounded-xl transition-all ${activeMenu === product.id ? 'text-white bg-[#1a1a1a]' : 'text-slate-500'}`}
                                            >
                                                <IonIcon name="ellipsis-vertical" className="text-lg" />
                                            </button>

                                            {activeMenu === product.id && (
                                                <>
                                                    <div className="fixed inset-0 z-[60]" onClick={() => setActiveMenu(null)}></div>
                                                    <div className="absolute right-12 top-0 w-60 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] z-[70] py-4 animate-in fade-in zoom-in-95 duration-200 text-left overflow-hidden">
                                                        <div className="px-5 py-2 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] border-b border-white/5 mb-2 flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                            Moderation
                                                        </div>

                                                        <Link
                                                            href={`/admin/products/${product.id}`}
                                                            className="flex items-center gap-3 px-5 py-3 text-xs text-white hover:bg-white/5 transition-colors"
                                                        >
                                                            <IonIcon name="eye-outline" className="text-lg text-slate-400" />
                                                            View Product
                                                        </Link>

                                                        {(product.status === 'pending' || product.status === 'review' || product.status === 'reviewing') && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAction(product.id, 'active')}
                                                                    className="w-full flex items-center gap-3 px-5 py-3 text-xs text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                                                                >
                                                                    <IonIcon name="checkmark-circle-outline" className="text-lg" />
                                                                    Approve Product
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAction(product.id, 'rejected')}
                                                                    className="w-full flex items-center gap-3 px-5 py-3 text-xs text-rose-400 hover:bg-rose-400/10 transition-colors"
                                                                >
                                                                    <IonIcon name="ban-outline" className="text-lg" />
                                                                    Reject Product
                                                                </button>
                                                            </>
                                                        )}

                                                        {product.status === 'active' && (
                                                            <button
                                                                onClick={() => handleAction(product.id, 'deactivated')}
                                                                className="w-full flex items-center gap-3 px-5 py-3 text-xs text-white hover:bg-white/5 transition-colors"
                                                            >
                                                                <IonIcon name="close-circle-outline" className="text-lg text-slate-400" />
                                                                Deactivate Product
                                                            </button>
                                                        )}

                                                        <div className="h-px bg-white/5 my-2 mx-5"></div>

                                                        <button
                                                            onClick={() => handleAction(product.id, 'Delete')}
                                                            className="w-full flex items-center gap-3 px-5 py-3 text-xs text-rose-500 hover:bg-rose-500/10 transition-colors"
                                                        >
                                                            <IonIcon name="trash-outline" className="text-lg" />
                                                            Delete Product
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Image Gallery Modal */}
            {selectedImages && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-10 animate-in fade-in duration-300">
                    <button 
                        onClick={() => setSelectedImages(null)}
                        className="absolute top-8 right-8 text-white/50 hover:text-white text-4xl transition-colors z-[110]"
                    >
                        <IonIcon name="close" />
                    </button>

                    <div className="relative w-full max-w-5xl h-full flex flex-col items-center justify-center gap-8">
                        <div className="relative w-full aspect-video md:h-[70vh] rounded-3xl overflow-hidden shadow-2xl bg-black/50 border border-white/20">
                            {(() => {
                                const currentImg = selectedImages[currentImageIndex];
                                if (currentImg.startsWith('data:')) {
                                    return (
                                        <img
                                            src={currentImg}
                                            alt="Gallery image"
                                            className="w-full h-full object-contain p-2"
                                        />
                                    );
                                }
                                return (
                                    <Image
                                        src={currentImg}
                                        alt="Gallery image"
                                        fill
                                        sizes="(max-width: 768px) 100vw, 1024px"
                                        className="object-contain p-2"
                                    />
                                );
                            })()}

                            {/* View Details Float Button */}
                            <div className="absolute top-6 right-6 z-10">
                                {galleryProductId && (
                                    <Link 
                                        href={`/admin/products/${galleryProductId}`}
                                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-white/90 transition-all shadow-2xl"
                                    >
                                        <IonIcon name="eye-outline" className="text-sm" />
                                        View Details
                                    </Link>
                                )}
                            </div>

                            {/* Navigation Arrows */}
                            {selectedImages.length > 1 && (
                                <>
                                    <button 
                                        onClick={() => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedImages.length - 1))}
                                        className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center text-2xl transition-all border border-white/10"
                                    >
                                        <IonIcon name="chevron-back" />
                                    </button>
                                    <button 
                                        onClick={() => setCurrentImageIndex(prev => (prev < selectedImages.length - 1 ? prev + 1 : 0))}
                                        className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center text-2xl transition-all border border-white/10"
                                    >
                                        <IonIcon name="chevron-forward" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Thumbnails */}
                        {selectedImages.length > 1 && (
                            <div className="flex gap-4 overflow-x-auto pb-4 max-w-full custom-scrollbar text-white">
                                {selectedImages.map((img, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`relative w-20 h-20 rounded-xl overflow-hidden cursor-pointer transition-all border-2 shrink-0 ${
                                            currentImageIndex === idx ? 'border-blue-500 scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'
                                        }`}
                                    >
                                        {img.startsWith('data:') ? (
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Image src={img} alt="" fill sizes="80px" className="object-cover" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <p className="text-white/50 text-sm font-black uppercase tracking-widest">
                            Image {currentImageIndex + 1} of {selectedImages.length}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
