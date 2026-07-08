import { useCallback, useEffect, useState, useRef } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { FluentChevronLeft32Filled, SvgSpinners180RingWithBg } from '../libs/icons';
import { UniteArticle } from '../Databases/db.d';
import ScrollArea from '../components/scroll_area';

export default function ArticleDetail() {
    const { productId } = useParams<{ productId: string }>();
    const { articles, collections, sousCollections, loadImage, updateArticle } = useDatabase();

    const article = articles.find(a => a.id === productId);
    const collection = collections.find(c => c.id === article?.collectionId);
    const sousCollection = sousCollections.find(sc => sc.id === article?.sousCollectionId);

    const imagesPaths = article?.images ? JSON.parse(article.images) : [];
    const dimensions = article?.dimensions ? JSON.parse(article.dimensions) : null;

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        nom: '',
        reference: '',
        description: '',
        unite: 'unité' as UniteArticle,
        prixHT: 0,
        tauxTVA: 18,
        stockTotal: 0,
        statut: 'actif' as const,
        dimensions: {
            longueur: '',
            largeur: '',
            hauteur: '',
            poids: ''
        }
    });
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
    const [removedImages, setRemovedImages] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[] | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isDraggingImg, setIsDraggingImg] = useState(false);

    const selectedImage = selectedImageIndex !== null ? images[selectedImageIndex] : null;

    useEffect(() => {
        if (article) {
            setFormData({
                nom: article.nom || '',
                reference: article.reference || '',
                description: article.description || '',
                unite: article.unite || 'unité',
                prixHT: article.prixHT || 0,
                tauxTVA: article.tauxTVA || 18,
                stockTotal: article.stockTotal || 0,
                statut: article.statut || 'actif',
                dimensions: {
                    longueur: dimensions?.longueur || '',
                    largeur: dimensions?.largeur || '',
                    hauteur: dimensions?.hauteur || '',
                    poids: dimensions?.poids || ''
                }
            });
        }
    }, [article]);

    useEffect(() => {
        if (!productId) return;
        setHistoryLoading(true);
        (window as any).db.articles.getHistory(productId)
            .then((events: any[]) => setHistory(events ?? []))
            .catch(() => setHistory([]))
            .finally(() => setHistoryLoading(false));
    }, [productId]);

    const loadImages = useCallback(async () => {
        if (imagesPaths && imagesPaths.length > 0) {
            setLoading(true);
            const loadedImages: string[] = [];
            for (const imgPath of imagesPaths) {
                const imgData = await loadImage(imgPath);
                if (imgData) loadedImages.push(imgData);
            }
            setImages(loadedImages);
            setLoading(false);
        } else {
            setLoading(false);
        }
    }, [imagesPaths, loadImage]);

    useEffect(() => {
        loadImages();
    }, []);

    const openImage = (index: number) => {
        setSelectedImageIndex(index);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    const closeImage = () => {
        setSelectedImageIndex(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (selectedImageIndex !== null && selectedImageIndex < images.length - 1) {
            setSelectedImageIndex(selectedImageIndex + 1);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        }
    };

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (selectedImageIndex !== null && selectedImageIndex > 0) {
            setSelectedImageIndex(selectedImageIndex - 1);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name.startsWith('dimension.')) {
            const field = name.replace('dimension.', '');
            setFormData(prev => ({
                ...prev,
                dimensions: { ...prev.dimensions, [field]: value }
            }));
        } else if (name === 'prixHT' || name === 'tauxTVA' || name === 'stockTotal') {
            setFormData(prev => ({ ...prev, [name]: Number(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newPreviews: string[] = [];
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    newPreviews.push(ev.target.result as string);
                    setNewImagePreviews(prev => [...prev, ...newPreviews]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index: number) => {
        setRemovedImages(prev => [...prev, imagesPaths[index]]);
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewImage = (index: number) => {
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!article) return;
        setSaving(true);

        try {
            const savedImagePaths: string[] = [];
            for (let i = 0; i < newImagePreviews.length; i++) {
                const base64Data = newImagePreviews[i];
                const ext = base64Data.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpg';
                const filename = `${Date.now()}_${i}.${ext}`;
                const filePath = await window.db.images.save(base64Data, filename);
                savedImagePaths.push(filePath);
            }

            const updatedImages = imagesPaths.filter((_, i) => !removedImages.includes(imagesPaths[i]));
            const allImages = [...updatedImages, ...savedImagePaths];

            const now = new Date().toISOString();
            const prixTTC = Math.round(formData.prixHT * (1 + formData.tauxTVA / 100));

            const dims = formData.dimensions;
            const dimensionsStr = (dims.longueur || dims.largeur || dims.hauteur || dims.poids)
                ? JSON.stringify({
                    longueur: dims.longueur ? Number(dims.longueur) : null,
                    largeur: dims.largeur ? Number(dims.largeur) : null,
                    hauteur: dims.hauteur ? Number(dims.hauteur) : null,
                    poids: dims.poids ? Number(dims.poids) : null
                })
                : null;

            await updateArticle(article.id, {
                nom: formData.nom,
                reference: formData.reference,
                description: formData.description || undefined,
                unite: formData.unite,
                prixHT: formData.prixHT,
                tauxTVA: formData.tauxTVA,
                prixTTC,
                stockTotal: formData.stockTotal,
                statut: formData.statut,
                images: allImages,
                dimensions: dimensionsStr
            });

            setIsEditing(false);
            setNewImagePreviews([]);
            setRemovedImages([]);
            loadImages();
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatPrix = (prix: number) =>
        Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(prix);

    const formatDimensions = (dims: any) => {
        if (!dims) return 'Non spécifiées';
        const parts = [];
        if (dims.longueur) parts.push(`L: ${dims.longueur}cm`);
        if (dims.largeur) parts.push(`l: ${dims.largeur}cm`);
        if (dims.hauteur) parts.push(`H: ${dims.hauteur}cm`);
        if (dims.poids) parts.push(`${dims.poids}kg`);
        return parts.join(' x ') || 'Non spécifiées';
    };

    if (!article) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Article non trouvé</p>
            </div>
        );
    }

    return (
        <>
            {selectedImage && (
                <div
                    className="lightbox-overlay fixed inset-0 bg-black/90 z-50 flex flex-col h-[calc(100dvh - 36px)] mt-9"
                    onClick={closeImage}
                >
                    <div className="lightbox-controls absolute top-4 right-4 z-10 flex items-center gap-2">
                        <button
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 active:scale-95 rounded-full flex items-center justify-center text-white text-xl backdrop-blur-sm transition-all duration-200"
                            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.25, 3)); }}
                        >
                            +
                        </button>
                        <button
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 active:scale-95 rounded-full flex items-center justify-center text-white text-xl backdrop-blur-sm transition-all duration-200"
                            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.25, 0.5)); }}
                        >
                            −
                        </button>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm backdrop-blur-sm transition-all duration-200">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 active:scale-95 hover:rotate-180 rounded-full flex items-center justify-center text-white text-sm backdrop-blur-sm transition-all duration-300"
                            onClick={(e) => { e.stopPropagation(); setZoom(1); setPosition({ x: 0, y: 0 }); }}
                        >
                            ↺
                        </button>
                        <button
                            className="w-10 h-10 bg-white/20 hover:bg-red-500/60 active:scale-95 hover:rotate-90 rounded-full flex items-center justify-center text-white text-xl backdrop-blur-sm transition-all duration-200"
                            onClick={(e) => { e.stopPropagation(); closeImage(); }}
                        >
                            ×
                        </button>
                    </div>

                    {images.length > 1 && (
                        <>
                            <button
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 hover:-translate-x-1 active:scale-95 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-sm z-10 transition-all duration-200"
                                onClick={prevImage}
                                disabled={selectedImageIndex === 0}
                                style={{ opacity: selectedImageIndex === 0 ? 0.3 : 1, transform: selectedImageIndex === 0 ? 'translateY(-50%)' : undefined }}
                            >
                                ‹
                            </button>
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 hover:translate-x-1 active:scale-95 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-sm z-10 transition-all duration-200"
                                onClick={nextImage}
                                disabled={selectedImageIndex === images.length - 1}
                                style={{ opacity: selectedImageIndex === images.length - 1 ? 0.3 : 1, transform: selectedImageIndex === images.length - 1 ? 'translateY(-50%)' : undefined }}
                            >
                                ›
                            </button>
                        </>
                    )}

                    <div
                        className="flex-1 flex items-center justify-center overflow-hidden cursor-grab"
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsDraggingImg(true);
                            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
                        }}
                        onMouseMove={(e) => {
                            if (isDraggingImg) {
                                setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                            }
                        }}
                        onMouseUp={() => setIsDraggingImg(false)}
                        onMouseLeave={() => setIsDraggingImg(false)}
                    >
                        <img
                            key={selectedImageIndex}
                            src={selectedImage}
                            alt={`${article.nom} ${(selectedImageIndex || 0) + 1}`}
                            className="lightbox-image max-h-[90vh] max-w-[90vw] object-contain select-none"
                            style={{
                                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                                cursor: isDraggingImg ? 'grabbing' : 'grab',
                                transition: isDraggingImg ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
                            }}
                            draggable={false}
                        />
                    </div>

                    {images.length > 1 && (
                        <span className="lightbox-controls absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                            {(selectedImageIndex || 0) + 1} / {images.length}
                        </span>
                    )}
                </div>
            )}

            <ScrollArea className="flex-1 flex flex-col h-full overflow-y-auto">
                <div className="h-[72px]"></div>

                <div className="px-10 py-4 border-b border-slate-100 flex justify-between items-center">
                    <NavLink to={`/produits/collections/${article.collectionId}`} className="text-blue-600 hover:underline flex items-center gap-4">
                        <FluentChevronLeft32Filled className='h-5 w-5' />
                        Retour à {collection?.nom}
                    </NavLink>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900"
                        >
                            Modifier
                        </button>
                    )}
                </div>

                <div className="p-10">
                    <div className="grid grid-cols-2 gap-10">
                        <div>
                            {loading ? (
                                <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center">
                                    <SvgSpinners180RingWithBg className="h-12 w-12 text-blue-600" />
                                </div>
                            ) : images.length > 0 || newImagePreviews.length > 0 ? (
                                <div className="grid grid-cols-2 gap-4">
                                    {[...images, ...newImagePreviews].map((img, index) => (
                                        <div
                                            key={index}
                                            className="thumb-pop relative group overflow-hidden rounded-2xl"
                                            style={{ animationDelay: `${Math.min(index * 40, 240)}ms`, opacity: 0 }}
                                        >
                                            <img
                                                src={img}
                                                alt={`${article.nom} ${index + 1}`}
                                                className="aspect-square object-cover rounded-2xl w-full transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                                                onClick={isEditing ? undefined : () => openImage(index)}
                                                draggable={!isEditing}
                                                style={{ cursor: isEditing ? 'default' : 'zoom-in' }}
                                            />
                                            {isEditing && (
                                                <button
                                                    onClick={() => index < images.length ? removeImage(index) : removeNewImage(index - images.length)}
                                                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 hover:scale-110 active:scale-95 text-white rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all duration-200"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center transition-colors duration-300">
                                    <span className="text-gray-400">Pas d'image</span>
                                </div>
                            )}

                            {isEditing && (
                                <div className="mt-4">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageSelect}
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 active:scale-[0.99] transition-all duration-200"
                                    >
                                        + Ajouter des images
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-6">
                            {isEditing ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Nom</label>
                                        <input
                                            type="text"
                                            name="nom"
                                            value={formData.nom}
                                            onChange={handleChange}
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Référence</label>
                                        <input
                                            type="text"
                                            name="reference"
                                            value={formData.reference}
                                            onChange={handleChange}
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Description</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            rows={4}
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Prix HT</label>
                                            <input
                                                type="number"
                                                name="prixHT"
                                                value={formData.prixHT}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">TVA (%)</label>
                                            <select
                                                name="tauxTVA"
                                                value={formData.tauxTVA}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            >
                                                <option value={0}>0%</option>
                                                <option value={10}>10%</option>
                                                <option value={18}>18%</option>
                                                <option value={19.25}>19.25%</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Prix TTC</label>
                                            <input
                                                type="text"
                                                value={Math.round(formData.prixHT * (1 + formData.tauxTVA / 100)).toLocaleString()}
                                                disabled
                                                className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Unité</label>
                                            <select
                                                name="unite"
                                                value={formData.unite}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            >
                                                <option value="unité">Unité</option>
                                                <option value="lot">Lot</option>
                                                <option value="m²">m²</option>
                                                <option value="m³">m³</option>
                                                <option value="ml">ml</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Stock</label>
                                            <input
                                                type="number"
                                                name="stockTotal"
                                                value={formData.stockTotal}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Longueur</label>
                                            <input
                                                type="number"
                                                name="dimension.longueur"
                                                value={formData.dimensions.longueur}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Largeur</label>
                                            <input
                                                type="number"
                                                name="dimension.largeur"
                                                value={formData.dimensions.largeur}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Hauteur</label>
                                            <input
                                                type="number"
                                                name="dimension.hauteur"
                                                value={formData.dimensions.hauteur}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Poids</label>
                                            <input
                                                type="number"
                                                name="dimension.poids"
                                                value={formData.dimensions.poids}
                                                onChange={handleChange}
                                                className="w-full p-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Statut</label>
                                        <select
                                            name="statut"
                                            value={formData.statut}
                                            onChange={handleChange}
                                            className="w-full p-2 border border-gray-300 rounded-lg"
                                        >
                                            <option value="actif">Actif</option>
                                            <option value="inactif">Inactif</option>
                                            <option value="archivé">Archivé</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-6 py-3 bg-blue-800 text-white rounded-lg hover:bg-blue-900 disabled:opacity-50"
                                        >
                                            {saving ? 'Enregistrement...' : 'Enregistrer'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <h1 className="text-3xl font-semibold">{article.nom}</h1>
                                        <p className="text-gray-500 mt-1">{article.reference}</p>
                                    </div>

                                    <div className="flex gap-4 flex-wrap">
                                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                            {collection?.nom}
                                        </span>
                                        {sousCollection && (
                                            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                                                {sousCollection.nom}
                                            </span>
                                        )}
                                        <span className={`px-3 py-1 rounded-full text-sm ${article.statut === 'actif' ? 'bg-green-100 text-green-800' :
                                            article.statut === 'inactif' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                            {article.statut}
                                        </span>
                                    </div>

                                    <div className="border-t border-b border-slate-200 py-4">
                                        <p className="text-3xl font-bold">{formatPrix(article.prixTTC)}</p>
                                        <p className="text-sm text-gray-500">
                                            {formatPrix(article.prixHT)} HT (TVA {article.tauxTVA}%)
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold mb-2">Description</h3>
                                        <p className="text-gray-600">{article.description || 'Aucune description'}</p>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold mb-2">Détails</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-500">Unité:</span>
                                                <p className="font-medium">{article.unite}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Stock:</span>
                                                <p className="font-medium">{article.stockTotal} unités</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Dimensions:</span>
                                                <p className="font-medium">{formatDimensions(dimensions)}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">Créé le:</span>
                                                <p className="font-medium">
                                                    {new Date(article.createdAt).toLocaleDateString('fr-FR')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                                            Dupliquer
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="mt-10 border-t border-slate-200 pt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Historique</h2>
                            {history && (
                                <span className="text-sm text-gray-500">{history.length} mouvement{history.length > 1 ? 's' : ''}</span>
                            )}
                        </div>
                        {historyLoading ? (
                            <div className="flex justify-center py-8">
                                <SvgSpinners180RingWithBg className="h-8 w-8 text-blue-600" />
                            </div>
                        ) : !history || history.length === 0 ? (
                            <p className="text-gray-500 text-sm py-6 text-center">Aucun mouvement enregistré.</p>
                        ) : (
                            <div className="overflow-hidden border border-slate-200 rounded-xl">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-gray-600">
                                        <tr>
                                            <th className="px-4 py-2 font-medium">Date</th>
                                            <th className="px-4 py-2 font-medium">Type</th>
                                            <th className="px-4 py-2 font-medium">Détails</th>
                                            <th className="px-4 py-2 font-medium">Qté</th>
                                            <th className="px-4 py-2 font-medium">Par</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {history.map((ev: any, idx: number) => {
                                            const dateStr = ev.date ? new Date(ev.date).toLocaleString('fr-FR') : '—';
                                            if (ev.type === 'vente') {
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2">{dateStr}</td>
                                                        <td className="px-4 py-2">
                                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs">Vente</span>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <div className="font-medium">{ev.factureNumero}</div>
                                                            <div className="text-gray-500 text-xs">
                                                                Client : {ev.clientNom ?? '—'} · {ev.statut}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 font-medium">-{ev.quantite}</td>
                                                        <td className="px-4 py-2 text-gray-700">{ev.vendeurNom ?? '—'}</td>
                                                    </tr>
                                                );
                                            }
                                            if (ev.type === 'transfert') {
                                                const sign = ev.sens === 'ajout' ? '+' : ev.sens === 'retrait' ? '-' : '↔';
                                                const route = ev.sens === 'transfert'
                                                    ? `${ev.sourceNom ?? '—'} → ${ev.destNom ?? '—'}`
                                                    : ev.sens === 'ajout'
                                                        ? `→ ${ev.destNom ?? '—'}`
                                                        : `${ev.sourceNom ?? '—'} →`;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-4 py-2">{dateStr}</td>
                                                        <td className="px-4 py-2">
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs capitalize">{ev.sens}</span>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <div className="font-medium">{route}</div>
                                                            {ev.note && <div className="text-gray-500 text-xs">{ev.note}</div>}
                                                        </td>
                                                        <td className="px-4 py-2 font-medium">{sign}{ev.quantite}</td>
                                                        <td className="px-4 py-2 text-gray-700">{ev.userNom ?? '—'}</td>
                                                    </tr>
                                                );
                                            }
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2">{dateStr}</td>
                                                    <td className="px-4 py-2">
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">Inventaire</span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="font-medium">Comptage validé</div>
                                                        <div className="text-gray-500 text-xs">Boutique : {ev.boutiqueNom ?? '—'}</div>
                                                    </td>
                                                    <td className="px-4 py-2 font-medium">={ev.quantiteCompte}</td>
                                                    <td className="px-4 py-2 text-gray-700">{ev.userNom ?? '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </>
    );
}