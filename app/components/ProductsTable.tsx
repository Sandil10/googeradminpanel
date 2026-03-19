"use client";

import { useEffect, useState } from "react";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Product {
    id: number;
    user_id: string;
    username: string; // Seller name
    title: string;
    price: string;
    promo_price?: string;
    category: string;
    sub_category?: string;
    level3_category?: string;
    status: string;
    views: number;
    created_at: string;
    updated_at?: string;
    image_url: string;
    description?: string;
    stock?: number;
    seller_id?: string;
    return_policy?: any;
    warranty_info?: any;
    delivery_info?: any;
    variants?: any;
    variants_data?: any;
    commission_data?: any;
    payment_data?: any;
    shipping_data?: any;
    delivery_data?: any;
    return_data?: any;
    warranty_data?: any;
}

interface ProductsTableProps {
    title: string;
    description: string;
    statusFilter?: string;
}

export default function ProductsTable({ title, description, statusFilter }: ProductsTableProps) {
    const pathname = usePathname();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<"newest" | "oldest" | "modified">("newest");
    const [isSortOpen, setIsSortOpen] = useState(false);

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

    const parseImages = (imageUrl: any): string[] => {
        if (!imageUrl) return [];
        
        // Handle cases where the database might already return an array (JSONB)
        if (Array.isArray(imageUrl)) {
            return imageUrl.map(img => cleanImageUrl(typeof img === 'object' ? (img.url || img.image_url || img) : img)).filter(Boolean);
        }

        try {
            const val = String(imageUrl).trim();
            if (!val) return [];

            // 1. Try parsing as JSON first (handles ["url1", "url2"])
            if (val.startsWith('[') || val.startsWith('{')) {
                try {
                    const parsed = JSON.parse(val);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    return items.map(img => cleanImageUrl(typeof img === 'object' ? (img.url || img.image_url || img) : img)).filter(Boolean);
                } catch (e) { /* ignore and fallback */ }
            }

            // 2. Handle Data URL sequences (Base64) - specific check to avoid splitting inside the base64 string
            if (val.includes('data:')) {
                // Look for data:... patterns that are likely separate images
                const dataUrlMatches = val.match(/data:image\/[a-zA-Z+-]+;base64,[^,]+(?=,data:image|$)/g);
                if (dataUrlMatches && dataUrlMatches.length > 0) {
                    return dataUrlMatches.map(m => cleanImageUrl(m)).filter(Boolean);
                }
            }

            // 3. Standard comma-separated URLs fallback
            return val.split(',').map(s => cleanImageUrl(s.trim())).filter(url => url !== '');
        } catch (e) {
            console.error("Image parsing failed:", e);
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

    const filteredProducts = products.filter(p => {
        if (!p) return false;
        if (!searchTerm) return true;
        try {
            const search = searchTerm.toLowerCase();
            const pidString = String(p.id || '');
            const userIdString = String(p.user_id || '');
            const usernameString = String(p.username || '');
            const sellerIdString = String(p.seller_id || '');
            const titleString = String(p.title || '');
            const categoryString = String(p.category || '');
            
            const searchableText = `${pidString} PID-${pidString} ${userIdString} ${usernameString} ${sellerIdString} ${titleString} ${categoryString}`.toLowerCase();
            return searchableText.includes(search);
        } catch (e) {
            console.error("Filter error:", e);
            return false;
        }
    });

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === "modified") {
            const dateA = new Date(a.updated_at || a.created_at).getTime();
            const dateB = new Date(b.updated_at || b.created_at).getTime();
            return dateB - dateA;
        }
        return 0;
    });

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

    const openProductDetails = (product: Product) => {
        // Collect ALL images from primary image_url AND variants
        let allImages: string[] = [];
        
        // 1. Add from primary image_url
        if (product.image_url) {
            parseImages(product.image_url).forEach(img => {
                if (!allImages.includes(img) && img) allImages.push(img);
            });
        }
        
        // 2. Check variants for more images (check both variants and variants_data)
        const variantSources = [product.variants_data, product.variants].filter(Boolean);
        
        variantSources.forEach(source => {
            try {
                const parsedVariants = typeof source === 'string' ? JSON.parse(source) : source;
                if (Array.isArray(parsedVariants)) {
                    parsedVariants.forEach(v => {
                        // Check both image_url and url properties in the variant object
                        const vImageUrl = v.image_url || v.url;
                        if (vImageUrl) {
                            parseImages(vImageUrl).forEach(img => {
                                if (!allImages.includes(img) && img) allImages.push(img);
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("Error parsing variants for images:", e);
            }
        });

        setSelectedProduct(product);
        setSelectedImages(allImages);
        setCurrentImageIndex(0);
    };

    const parseJsonField = (val: any) => {
        if (!val) return null;
        try {
            return typeof val === 'string' ? JSON.parse(val) : val;
        } catch (e) {
            return val;
        }
    };

    const renderSafe = (val: any, fallback: string = '-') => {
        if (val === null || val === undefined || val === '') return fallback;
        if (typeof val === 'object') {
            if (val.text) return val.text;
            if (val.name) return val.name;
            if (val.warranty) return val.warranty;
            if (val.custom) return val.custom;
            return JSON.stringify(val);
        }
        return String(val);
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
                
                <div className="p-6 border-b border-[#1a1a1a] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                            <IonIcon name="search-outline" className="text-lg" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search PID, User ID, or Seller Name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button 
                                onClick={() => setIsSortOpen(!isSortOpen)}
                                className="h-11 px-4 rounded-2xl bg-[#0c0c0e] border border-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-500/30 transition-all flex items-center gap-2"
                            >
                                <IonIcon name="swap-vertical-outline" className="text-sm" />
                                {sortBy === 'newest' ? 'Newest First' : sortBy === 'oldest' ? 'Oldest First' : 'Date Modified'}
                            </button>
                            
                            {isSortOpen && (
                                <>
                                    <div className="fixed inset-0 z-[60]" onClick={() => setIsSortOpen(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl z-[70] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <button 
                                            onClick={() => { setSortBy("newest"); setIsSortOpen(false); }}
                                            className={`w-full flex items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${sortBy === 'newest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                                        >
                                            <IonIcon name="time-outline" /> Newest First
                                        </button>
                                        <button 
                                            onClick={() => { setSortBy("oldest"); setIsSortOpen(false); }}
                                            className={`w-full flex items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${sortBy === 'oldest' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                                        >
                                            <IonIcon name="hourglass-outline" /> Oldest First
                                        </button>
                                        <button 
                                            onClick={() => { setSortBy("modified"); setIsSortOpen(false); }}
                                            className={`w-full flex items-center gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${sortBy === 'modified' ? 'text-blue-400 bg-white/5' : 'text-slate-400 hover:bg-white/5'}`}
                                        >
                                            <IonIcon name="refresh-outline" /> Date Modified
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="px-4 py-2 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sortedProducts.length} Results</span>
                        </div>
                    </div>
                </div>

                <div className="w-full overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[800px]">
                        <thead>
                            <tr className="bg-[#1a1a1a]/50 text-slate-300 text-[9px] font-black uppercase tracking-[0.2em]">
                                <th className="px-2 py-5 w-auto">Product Details</th>
                                <th className="px-2 py-5 w-[200px]">Seller</th>
                                <th className="px-2 py-5 text-right w-[400px]">Moderation Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1a1a]">
                            {filteredProducts.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center text-slate-500 font-medium italic">
                                        {searchTerm ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <IonIcon name="search-outline" className="text-4xl text-slate-700" />
                                                <p>No matches found for <span className="text-white">"{searchTerm}"</span></p>
                                                <button onClick={() => setSearchTerm("")} className="text-blue-400 font-bold hover:underline">Clear Search</button>
                                            </div>
                                        ) : "No products found in this category."}
                                    </td>
                                </tr>
                            ) : (
                                sortedProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-white/[0.02] transition-all group border-b border-[#1a1a1a]">
                                        <td className="px-2 py-6">
                                            <div className="flex items-start gap-5">
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openProductDetails(product);
                                                    }}
                                                    className="w-20 h-20 rounded-2xl bg-black border border-white/5 flex items-center justify-center text-slate-700 text-xl shrink-0 cursor-pointer hover:border-white/20 transition-all overflow-hidden relative group/thumb"
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
                                                                sizes="80px"
                                                                className="object-cover group-hover/thumb:scale-110 transition-transform duration-500"
                                                            />
                                                        );
                                                    })()}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                        <IonIcon name="expand-outline" className="text-white text-sm" />
                                                    </div>
                                                </div>
                                                <div className="min-w-0 space-y-2">
                                                    <div>
                                                        <p className="font-bold text-white group-hover:text-blue-400 transition-colors text-sm mb-0.5">{renderSafe(product.title)}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">PID-{product.id}</p>
                                                    </div>
                                                    
                                                    <div className="flex flex-col gap-1.5 mt-2">
                                                        <span className="text-xs font-bold text-white">R {parseFloat(product.price || '0').toLocaleString()}</span>
                                                        <span className="text-[11px] text-slate-200 uppercase tracking-widest">{product.category || 'Uncategorized'}</span>
                                                        <span className={`text-[11px] uppercase tracking-widest font-black ${
                                                            product.status === 'active' ? 'text-emerald-400' : 
                                                            product.status === 'pending' || product.status === 'review' || product.status === 'reviewing' ? 'text-purple-400' : 
                                                            'text-rose-400'
                                                        }`}>
                                                            {product.status}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 font-medium">
                                                            {product.created_at ? new Date(product.created_at).toLocaleDateString() : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4">
                                            <div className="flex flex-col">
                                                <Link href={`/admin/users/${product.user_id}?returnTo=${pathname}&from=Products`} className="text-white hover:text-blue-400 font-bold text-sm tracking-tight transition-colors">
                                                    {renderSafe(product.username) || 'Unknown'}
                                                </Link>
                                                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1">ID: {product.seller_id || product.user_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {(statusFilter === 'reviewing' || statusFilter === 'review') ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction(product.id, 'active')}
                                                            className="h-8 px-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                                                        >
                                                            <IonIcon name="checkmark-circle-outline" className="text-xs" />
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(product.id, 'rejected')}
                                                            className="h-8 px-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
                                                        >
                                                            <IonIcon name="ban-outline" className="text-xs" />
                                                            Reject
                                                        </button>
                                                    </>
                                                ) : statusFilter === 'rejected' ? (
                                                    <button
                                                        onClick={() => handleAction(product.id, 'active')}
                                                        className="h-8 px-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                                                    >
                                                        <IonIcon name="checkmark-circle-outline" className="text-xs" />
                                                        Approve
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAction(product.id, 'inactive')}
                                                        className="h-8 px-3 rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all flex items-center gap-1.5"
                                                    >
                                                        <IonIcon name="close-circle-outline" className="text-xs" />
                                                        Inactive
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleAction(product.id, 'Delete')}
                                                    className="h-8 px-3 rounded-lg bg-white/5 text-slate-400 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 transition-all flex items-center gap-1.5"
                                                >
                                                    <IonIcon name="trash-outline" className="text-xs" />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product Details Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/95" onClick={() => setSelectedProduct(null)}></div>
                    
                    <div className="relative w-full max-w-2xl bg-[#0c0c0e] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] z-[110] flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 md:p-8 flex justify-between items-center border-b border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/30 overflow-hidden">
                                    <IonIcon name="person" className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seller Profile</p>
                                    <Link href={`/admin/users/${selectedProduct.user_id}?returnTo=${pathname}&from=Products`} className="text-sm font-bold text-white hover:text-blue-400 hover:underline transition-colors mt-0.5 inline-block">
                                        {selectedProduct.username}
                                    </Link>
                                </div>
                            </div>
                             <div className="flex-1"></div>
                            <div className="flex items-center gap-4">
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                    selectedProduct.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                    selectedProduct.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                }`}>
                                    {selectedProduct.status}
                                </span>
                                <button 
                                    onClick={() => setSelectedProduct(null)}
                                    className="p-2 text-slate-500 hover:text-white transition-colors"
                                >
                                    <IonIcon name="close" className="text-2xl" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
                            {/* Product Title & Categories */}
                            <div className="space-y-4">
                                <h2 className="text-2xl font-black text-white leading-tight uppercase tracking-tight">{selectedProduct.title}</h2>
                                <div className="flex flex-wrap gap-2">
                                    {[selectedProduct.category, selectedProduct.sub_category, selectedProduct.level3_category].filter(Boolean).map((cat, i) => (
                                        <span key={i} className="px-4 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                                            {renderSafe(cat)}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Premium Image Carousel */}
                            <div className="relative group/carousel">
                                <div className="aspect-square md:aspect-video rounded-[2.5rem] overflow-hidden bg-black/50 border border-white/10 relative shadow-2xl">
                                    <div 
                                        className="h-full flex transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
                                        style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                                    >
                                        {selectedImages.length > 0 ? (
                                            selectedImages.map((img, idx) => (
                                                <div key={idx} className="w-full h-full min-w-full relative flex items-center justify-center bg-black">
                                                    {img.startsWith('data:') ? (
                                                        <img src={img} alt="" className="w-full h-full object-contain p-4" />
                                                    ) : (
                                                        <Image src={img} alt="" fill className="object-contain p-4" priority={idx === 0} />
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                                                <IonIcon name="image-outline" className="text-7xl opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Images Available</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Carousel Controls */}
                                    {selectedImages.length > 1 && (
                                        <>
                                            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/40 to-transparent pointer-events-none opacity-0 group-hover/carousel:opacity-100 transition-opacity"></div>
                                            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/40 to-transparent pointer-events-none opacity-0 group-hover/carousel:opacity-100 transition-opacity"></div>
                                            
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : selectedImages.length - 1)) }}
                                                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl text-white border border-white/20 opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-white hover:text-black hover:scale-110 active:scale-95 shadow-2xl flex items-center justify-center z-10"
                                            >
                                                <IonIcon name="chevron-back" className="text-xl" />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev < selectedImages.length - 1 ? prev + 1 : 0)) }}
                                                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl text-white border border-white/20 opacity-0 group-hover/carousel:opacity-100 transition-all hover:bg-white hover:text-black hover:scale-110 active:scale-95 shadow-2xl flex items-center justify-center z-10"
                                            >
                                                <IonIcon name="chevron-forward" className="text-xl" />
                                            </button>

                                            {/* Progress Indicators */}
                                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                                                {selectedImages.map((_, idx) => (
                                                    <div 
                                                        key={idx}
                                                        onClick={() => setCurrentImageIndex(idx)}
                                                        className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${currentImageIndex === idx ? 'w-8 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    
                                    {/* Image Counter Badge */}
                                    {selectedImages.length > 0 && (
                                        <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-black text-white uppercase tracking-widest z-10">
                                            {currentImageIndex + 1} / {selectedImages.length}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Multi-column Stats Card */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group/card">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 group-hover/card:bg-blue-500/10 transition-colors"></div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                                        Pricing Details
                                    </p>
                                    <div className="flex items-baseline gap-4">
                                        <span className="text-4xl font-black text-white tracking-tighter italic">R {parseFloat(selectedProduct.price).toLocaleString()}</span>
                                        {selectedProduct.promo_price && (
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-500 line-through font-bold">R {parseFloat(selectedProduct.promo_price).toLocaleString()}</span>
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                                                    SAVE {Math.round((1 - parseFloat(selectedProduct.price) / parseFloat(selectedProduct.promo_price)) * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group/card">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16 group-hover/card:bg-purple-500/10 transition-colors"></div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-purple-500"></div>
                                        Stock Availability
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-4xl font-black tracking-tighter ${selectedProduct.stock && selectedProduct.stock > 0 ? 'text-white' : 'text-rose-500 italic'}`}>
                                            {selectedProduct.stock || 0} Units
                                        </span>
                                        {selectedProduct.stock && selectedProduct.stock < 10 && selectedProduct.stock > 0 && (
                                            <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 text-[8px] font-black uppercase border border-rose-500/20 ml-2 animate-pulse">Low Stock</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Product Description */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-px flex-1 bg-white/5"></div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Story & Details</p>
                                    <div className="h-px flex-1 bg-white/5"></div>
                                </div>
                                <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 shadow-inner">
                                    <div className="text-xs text-slate-400 leading-relaxed font-medium">
                                        {renderSafe(parseJsonField(selectedProduct.description), "No detailed description provided for this listing.")}
                                    </div>
                                </div>
                            </div>

                            {/* Product Variants Section - REDESIGNED */}
                            {(() => {
                                const vars = parseJsonField(selectedProduct.variants_data || selectedProduct.variants);
                                if (!Array.isArray(vars) || vars.length === 0) return null;
                                return (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Available Variants</p>
                                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase border border-blue-500/20">{vars.length} Options</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {vars.map((v, idx) => (
                                                <div key={idx} className="p-5 rounded-[2rem] bg-[#0f0f11] border border-white/5 flex flex-col gap-4 group/variant hover:border-blue-500/30 transition-all shadow-lg active:scale-[0.98]">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner">
                                                            {v.image_url ? (
                                                                <img src={getPrimaryImage(v.image_url) || ''} alt="" className="w-full h-full object-cover group-hover/variant:scale-110 transition-transform duration-500" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                                    <IonIcon name="cube-outline" className="text-slate-700 text-xl" />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-blue-500/0 group-hover/variant:bg-blue-500/10 transition-colors"></div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-[11px] font-black text-white uppercase truncate tracking-tight">{v.color || v.uom || 'Variant'}</p>
                                                                {v.promo_price && <span className="text-[10px] font-black text-blue-400">R {parseFloat(v.promo_price).toLocaleString()}</span>}
                                                            </div>
                                                            
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                {/* Display UOM and Sizes specifically if present */}
                                                                {v.selections && Array.isArray(v.selections) ? v.selections.map((s: any, sIdx: number) => (
                                                                    <div key={sIdx} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                                                        {s.isUOM ? 'UOM:' : 'SIZE:'} {s.value}
                                                                    </div>
                                                                )) : (
                                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">{v.uom || v.details || v.specific_details || 'Standard'}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                            {v.selections && Array.isArray(v.selections) && v.selections.slice(0, 3).map((s: any, sIdx: number) => (
                                                                <div key={sIdx} className="w-5 h-5 rounded-full bg-white/10 border-2 border-[#0f0f11] flex items-center justify-center text-[7px] font-black text-white uppercase">
                                                                    {s.value.charAt(0)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${parseInt(v.stock || v.in_stock || 0) > 0 ? 'text-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.1)]' : 'text-rose-400/80'}`}>
                                                            {v.stock || v.in_stock || 0} IN STOCK
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Logistics & Shipping */}
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Logistics & Shipping</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/[0.03] border border-white/5 rounded-[1.5rem] p-5 space-y-4">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Shipping Strategy</p>
                                            <p className="text-xs font-bold text-white uppercase">{renderSafe(parseJsonField(selectedProduct.shipping_data)?.strategy, 'Unified Fee')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Global Shipping Date</p>
                                            <p className="text-xs font-bold text-white">{renderSafe(parseJsonField(selectedProduct.shipping_data)?.date, '1-3 days')}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-[1.5rem] p-5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Shipping Countries</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(() => {
                                                const shipping = parseJsonField(selectedProduct.shipping_data);
                                                const countries = shipping?.countries || ['Sri Lanka'];
                                                return countries.map((c: string, i: number) => (
                                                    <span key={i} className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase border border-blue-500/20">
                                                        #{c.trim()}
                                                    </span>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Return & Warranty */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/[0.03] border border-white/5 rounded-[1.5rem] p-5">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3">Return Policy</p>
                                    {(() => {
                                        const policy = parseJsonField(selectedProduct.return_data || selectedProduct.return_policy);
                                        return (
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-white">{policy?.text || policy?.days || (typeof policy === 'string' ? policy : '-')}</p>
                                                {policy?.date && <p className="text-[9px] text-slate-500 font-black uppercase">Valid until: {policy.date}</p>}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 rounded-[1.5rem] p-5">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3">Warranty Info</p>
                                    {(() => {
                                        const warranty = parseJsonField(selectedProduct.warranty_data || selectedProduct.warranty_info);
                                        return (
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-white">{warranty?.warranty || warranty?.custom || (typeof warranty === 'string' ? warranty : 'No Warranty')}</p>
                                                {warranty?.duration && <p className="text-[9px] text-slate-500 font-black uppercase">Duration: {warranty.duration}</p>}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Payment & Commissions */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Commissions & Payments</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/[0.03] border border-white/5 rounded-[1.5rem] p-5 space-y-4">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resell Commission</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-white uppercase">Percentage</span>
                                            <span className="text-[10px] font-black text-blue-400">{renderSafe(parseJsonField(selectedProduct.commission_data)?.resell_percent, '20')}%</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-white uppercase">Fixed Amount</span>
                                            <span className="text-[10px] font-black text-blue-400">R {renderSafe(parseJsonField(selectedProduct.commission_data)?.resell_fixed, '20.00')}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-[1.5rem] p-5 space-y-4">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Platform Fees</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-white uppercase">Googer Comm.</span>
                                            <span className="text-[10px] font-black text-rose-400">{renderSafe(parseJsonField(selectedProduct.commission_data)?.googer_percent, '5')}%</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-white uppercase">Discount</span>
                                            <span className="text-[10px] font-black text-rose-400">{renderSafe(parseJsonField(selectedProduct.commission_data)?.discount_percent, '2')}%</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-5 rounded-[1.5rem] bg-indigo-500/5 border border-indigo-500/10">
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">Accepted Payment Methods</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(() => {
                                            const methods = parseJsonField(selectedProduct.payment_data)?.methods || ['Rupieer Payments', 'COD', 'Credit/Debit Card'];
                                            return methods.map((m: string, i: number) => (
                                                <span key={i} className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-300 text-[9px] font-black uppercase border border-indigo-500/20 flex items-center gap-2">
                                                    <IonIcon name="card-outline" />
                                                    {m}
                                                </span>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                         <div className="p-6 md:p-8 border-t border-white/5 flex gap-4 bg-black/20">
                            {(statusFilter === 'reviewing' || statusFilter === 'review') ? (
                                <>
                                    <button 
                                        onClick={() => {
                                            handleAction(selectedProduct.id, 'active');
                                            setSelectedProduct(null);
                                        }}
                                        className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all border border-emerald-500/20 flex items-center justify-center gap-3"
                                    >
                                        <IonIcon name="checkmark-circle-outline" className="text-lg" />
                                        Approve
                                    </button>
                                    <button 
                                        onClick={() => {
                                            handleAction(selectedProduct.id, 'rejected');
                                            setSelectedProduct(null);
                                        }}
                                        className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-black text-[10px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all border border-rose-500/20 flex items-center justify-center gap-3"
                                    >
                                        <IonIcon name="ban-outline" className="text-lg" />
                                        Reject
                                    </button>
                                </>
                            ) : statusFilter === 'rejected' ? (
                                <button 
                                    onClick={() => {
                                        handleAction(selectedProduct.id, 'active');
                                        setSelectedProduct(null);
                                    }}
                                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all border border-emerald-500/20 flex items-center justify-center gap-3"
                                >
                                    <IonIcon name="checkmark-circle-outline" className="text-lg" />
                                    Approve
                                </button>
                            ) : (
                                <button 
                                    onClick={() => {
                                        handleAction(selectedProduct.id, 'inactive');
                                        setSelectedProduct(null);
                                    }}
                                    className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-black text-[10px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all border border-purple-500/20 flex items-center justify-center gap-3"
                                >
                                    <IonIcon name="close-circle-outline" className="text-lg" />
                                    Inactive
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    handleAction(selectedProduct.id, 'Delete');
                                    setSelectedProduct(null);
                                }}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] py-4 rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-3"
                            >
                                <IonIcon name="trash-outline" className="text-lg" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
