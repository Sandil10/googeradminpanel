"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import IonIcon from "@/components/IonIcon";
import { adminService } from "@/services/adminService";
import Link from "next/link";
import { toManagedMediaUrl } from "../../../utils/mediaUrl";

interface ProductDetails {
    id: number;
    user_id: string;
    username: string;
    title: string;
    description: string;
    price: string;
    currency: string;
    category: string;
    image_url: string;
    status: string;
    views: number;
    created_at: string;
    updated_at: string;
    stock: number;
    promo_price: string;
    variants: any;
    shipping_info: string;
    payment_methods: string;
    warranty_info: string;
    return_policy: string;
    delivery_info: string;
}

export default function ProductDetailsPage({ params }: { params: Promise<{ productId: string }> }) {
    const { productId } = use(params);
    const [product, setProduct] = useState<ProductDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const cleanImageUrl = (url: string) => {
        if (!url) return '';
        let cleaned = String(url).replace(/\s/g, '').replace(/[\\"]/g, '');
        if (cleaned.startsWith('data:') || cleaned.startsWith('http') || cleaned.startsWith('/') || cleaned.startsWith('./')) {
            if (cleaned.startsWith('data:') && cleaned.includes('base64') && !cleaned.includes('base64,')) {
                cleaned = cleaned.replace('base64', 'base64,');
            }
            return cleaned;
        }
        if (cleaned.length > 4 && cleaned.includes('.')) return toManagedMediaUrl(cleaned) || cleaned;
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

    useEffect(() => {
        const loadProduct = async () => {
            try {
                setLoading(true);
                const data = await adminService.fetchProductDetails(productId);
                setProduct(data);
                const images = parseImages(data.image_url);
                if (images.length > 0) {
                    setSelectedImage(images[0]);
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [productId]);

    const handleAction = async (status: string) => {
        if (!product) return;
        try {
            if (status === 'Delete') {
                if (!confirm("Are you sure you want to delete this product?")) return;
                await adminService.deleteProduct(product.id.toString());
                window.location.href = '/admin/products/all';
            } else {
                await adminService.updateProductStatus(product.id.toString(), status);
                setProduct({ ...product, status });
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    if (loading) return <div className="p-20 text-center text-white font-black uppercase tracking-widest animate-pulse">Loading Product Data...</div>;
    if (error || !product) return (
        <div className="p-20 text-center space-y-4">
            <div className="text-rose-500 text-6xl"><IonIcon name="alert-circle-outline" /></div>
            <p className="text-white font-bold">Error: {error || "Product not found"}</p>
            <Link href="/admin/products/all" className="inline-block px-8 py-3 bg-white text-black rounded-full font-black text-xs uppercase tracking-widest">Back to List</Link>
        </div>
    );
    const images = parseImages(product.image_url);

    const formatValue = (val: any) => {
        if (!val || val === 'null' || val === 'undefined') return 'Not specified';
        
        let data = val;
        // If it's a string that looks like JSON, try to parse it
        if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
            try {
                data = JSON.parse(val);
            } catch (e) {
                return val;
            }
        }

        if (typeof data === 'object' && data !== null) {
            try {
                // Payment Methods (Array)
                if (Array.isArray(data)) {
                    return data.join(', ');
                }
                // Shipping Info
                if (data.rates && Array.isArray(data.rates)) {
                    return data.rates.map((r: any) => 
                        `${r.country || 'Global'}: ${r.date || 'Standard'} (R ${r.charge || 0})`
                    ).join(' | ');
                }
                // Warranty
                if (data.warranty) {
                    return data.warranty + (data.custom ? ` - ${data.custom}` : '');
                }
                // Return Policy
                if (data.text) {
                    return data.text + (data.date ? ` (${data.date})` : '');
                }
                // Unified/Generic Object handling
                if (data.unified !== undefined) return data.unified ? "Unified" : "Standard";
                
                return JSON.stringify(data);
            } catch (e) {
                return String(val);
            }
        }
        return String(val);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Breadcrumb & Quick Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
                        <IonIcon name="chevron-forward" />
                        <Link href="/admin/products/all" className="hover:text-white transition-colors">Products</Link>
                        <IonIcon name="chevron-forward" />
                        <span className="text-white">PID-{product.id}</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{formatValue(product.title)}</h1>
                </div>

                <div className="flex gap-3">
                    <button 
                         onClick={() => handleAction('Delete')}
                         className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest border border-rose-500/20"
                    >
                        <IonIcon name="trash-outline" />
                        Delete
                    </button>
                    {(product.status === 'review' || product.status === 'reviewing' || product.status === 'pending') && (
                        <>
                            <button 
                                onClick={() => handleAction('rejected')}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest"
                            >
                                <IonIcon name="close-circle-outline" />
                                Reject
                            </button>
                            <button 
                                onClick={() => handleAction('active')}
                                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all font-black text-[10px] uppercase tracking-widest"
                            >
                                <IonIcon name="checkmark-circle-outline" />
                                Approve Product
                            </button>
                        </>
                    )}
                    {product.status === 'active' && (
                        <button 
                            onClick={() => handleAction('deactivated')}
                            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-black transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            <IonIcon name="pause-circle-outline" />
                            Deactivate
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Visual Section */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2.5rem] overflow-hidden shadow-2xl group relative">
                        <div className="relative aspect-square w-full flex items-center justify-center p-4 bg-black/50 overflow-hidden">
                            {selectedImage && selectedImage.startsWith('data:') ? (
                                <img
                                    src={selectedImage}
                                    alt={product.title}
                                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700"
                                />
                            ) : (
                                <Image
                                    src={selectedImage || 'https://via.placeholder.com/800x800?text=No+Image'}
                                    alt={product.title}
                                    fill
                                    priority
                                    className="object-contain p-8 group-hover:scale-105 transition-transform duration-700"
                                    unoptimized={!!selectedImage?.startsWith('data:')}
                                />
                            )}
                        </div>
                    </div>

                    {images.length > 1 && (
                        <div className="flex flex-wrap gap-4 justify-center">
                            {images.map((img, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedImage(img)}
                                    className={`relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer transition-all border-2 ${
                                        selectedImage === img ? 'border-blue-500 ring-4 ring-blue-500/20 scale-110 shadow-2xl' : 'border-white/5 opacity-40 hover:opacity-100 hover:scale-105'
                                    }`}
                                >
                                    {img.startsWith('data:') ? (
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Image src={img} alt="" fill sizes="96px" className="object-cover" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="lg:col-span-5 space-y-8">
                    {/* Status Card */}
                    <div className="bg-gradient-to-br from-[#1a1a1a] to-black border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
                        
                        <div className="flex justify-between items-center relative z-10">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Current Status</span>
                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                product.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                product.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                product.status === 'pending' || product.status === 'review' || product.status === 'reviewing' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                                {product.status}
                            </span>
                        </div>

                        <div className="space-y-1 relative z-10">
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Pricing & Stock</p>
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-4xl font-black text-white">R {parseFloat(product.price || '0').toLocaleString()}</h2>
                                {product.promo_price && (
                                    <span className="text-slate-500 line-through text-lg">R {parseFloat(product.promo_price).toLocaleString()}</span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Stock</p>
                                <p className="text-white font-bold">{formatValue(product.stock || 0)} Units</p>
                            </div>
                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Views</p>
                                <p className="text-white font-bold">{formatValue(product.views || 0)} Views</p>
                            </div>
                        </div>

                        {(product.status === 'review' || product.status === 'reviewing' || product.status === 'pending') && (
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => handleAction('rejected')}
                                    className="flex-1 py-4 rounded-2xl bg-rose-500/10 text-rose-500 font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 flex items-center justify-center gap-2"
                                >
                                    <IonIcon name="close-outline" />
                                    Reject
                                </button>
                                <button 
                                    onClick={() => handleAction('active')}
                                    className="flex-[2] py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-3"
                                >
                                    <IonIcon name="sparkles" />
                                    Approve for Sale
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Information Grid */}
                    <div className="space-y-4">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-4">Seller Information</p>
                        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-3xl p-6 flex items-center gap-4 group hover:border-white/20 transition-all">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 text-slate-500 flex items-center justify-center text-2xl border border-white/5">
                                <IonIcon name="person" />
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-black">{formatValue(product.username) || 'Anonymous Seller'}</p>
                                <p className="text-xs text-slate-500 font-medium">Internal ID: {product.user_id}</p>
                            </div>
                            <Link href={`/admin/users/${product.user_id}`} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white">
                                <IonIcon name="arrow-forward" />
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-4">Category Details</p>
                        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-3xl p-6 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400 font-medium">Main Category</span>
                                <span className="text-white font-black uppercase text-[10px] tracking-widest">{formatValue(product.category)}</span>
                            </div>
                            <div className="h-px bg-white/5"></div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400 font-medium">Listing Date</span>
                                <span className="text-white font-bold">{new Date(product.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Full-Width Section */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-white ml-2 flex items-center gap-2">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            Description
                        </h3>
                        <div className="bg-[#09090b] border border-[#1a1a1a] rounded-[2rem] p-8 text-slate-400 leading-loose text-sm italic">
                            {typeof product.description === 'string' ? product.description : formatValue(product.description)}
                        </div>
                    </div>

                    <div className="space-y-6">
                         <h3 className="text-lg font-black text-white ml-2 flex items-center gap-2">
                            <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                            Logistical Data
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {[
                                { label: 'Shipping Info', value: product.shipping_info, icon: 'bus-outline' },
                                { label: 'Warranty', value: product.warranty_info, icon: 'shield-checkmark-outline' },
                                { label: 'Return Policy', value: product.return_policy, icon: 'refresh-outline' },
                                { label: 'Payment Methods', value: product.payment_methods, icon: 'card-outline' }
                            ].map((item, i) => (
                                <div key={i} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex gap-4 group hover:bg-white/5 transition-all">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg text-slate-500 group-hover:text-white transition-colors border border-white/5">
                                        <IonIcon name={item.icon} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-400">{item.label}</p>
                                        <p className="text-sm text-slate-300 font-medium">{formatValue(item.value)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
