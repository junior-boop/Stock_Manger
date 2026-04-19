import { useState, useRef, useEffect } from 'react';
import { openNewProductWindow } from "../context/open_product";
import { useDatabase } from "../databaseProvider";
import { Article, UniteArticle, DimensionsArticle, StatutActif } from "../Databases/db.d";
import { useParams } from 'react-router-dom';

export default function NewProduct() {
    const { open_state, open_set } = openNewProductWindow();
    const { collections, sousCollections, createArticle, updateCollection, isLoading, articles } = useDatabase();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { id } = useParams()

    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const [formData, setFormData] = useState({
        collectionId: id,
        sousCollectionId: '',
        nom: '',
        description: '',
        reference: '',
        unite: 'unité' as UniteArticle,
        prixHT: 0,
        tauxTVA: 18,
        dimensions: {
            longueur: '',
            largeur: '',
            hauteur: '',
            poids: ''
        } as DimensionsArticle,
        images: [] as string[],
        stockTotal: 0,
        statut: 'actif' as StatutActif
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (formData.collectionId) {
            generateReference(formData.collectionId);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name.startsWith('dimension.')) {
            const field = name.replace('dimension.', '');
            setFormData(prev => ({
                ...prev,
                dimensions: {
                    ...prev.dimensions,
                    [field]: value ? Number(value) : undefined
                }
            }));
        } else if (name === 'prixHT' || name === 'tauxTVA' || name === 'stockTotal') {
            setFormData(prev => ({ ...prev, [name]: Number(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!formData.nom.trim()) newErrors.nom = 'Le nom est requis';
        if (!formData.reference.trim()) newErrors.reference = 'La référence est requise';
        if (formData.prixHT <= 0) newErrors.prixHT = 'Le prix HT doit être positif';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newPreviews: string[] = [];
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    newPreviews.push(e.target.result as string);
                    setImagePreviews(prev => [...prev, ...newPreviews]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveImage = (index: number) => {
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (!files) return;

        const newPreviews: string[] = [];
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        newPreviews.push(e.target.result as string);
                        setImagePreviews(prev => [...prev, ...newPreviews]);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const generateReference = async (collectionId: string) => {
        if (collectionId) {
            const ref = await window.db.articles.generateReference(collectionId);
            if (ref) {
                setFormData(prev => ({ ...prev, reference: ref }));
            }
        }
    };

    const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value, sousCollectionId: '' }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        generateReference(value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        const now = new Date().toISOString();
        const prixTTC = Math.round(formData.prixHT * (1 + formData.tauxTVA / 100));

        const savedImagePaths: string[] = [];
        for (let i = 0; i < imagePreviews.length; i++) {
            const base64Data = imagePreviews[i];
            const extension = base64Data?.match(/^data:image\/(\w+);base64,/)?.[1] || 'jpg';
            const filename = `${Date.now()}_${i}.${extension}`;
            try {
                const filePath = await window.db.images.save(base64Data, filename);
                savedImagePaths.push(filePath);
            } catch (error) {
                console.error('Erreur lors de la sauvegarde de l\'image:', error);
            }
        }

        const newArticle: Partial<Article> = {
            collectionId: formData.collectionId,
            sousCollectionId: formData.sousCollectionId || undefined,
            nom: formData.nom,
            description: formData.description || undefined,
            reference: formData.reference,
            unite: formData.unite,
            prixHT: formData.prixHT,
            tauxTVA: formData.tauxTVA,
            prixTTC,
            dimensions: formData.dimensions.longueur || formData.dimensions.largeur || formData.dimensions.hauteur || formData.dimensions.poids
                ? {
                    longueur: formData.dimensions.longueur || undefined,
                    largeur: formData.dimensions.largeur || undefined,
                    hauteur: formData.dimensions.hauteur || undefined,
                    poids: formData.dimensions.poids || undefined
                }
                : undefined,
            images: savedImagePaths,
            stockTotal: formData.stockTotal,
            statut: formData.statut,
            createdAt: now,
            updatedAt: now,
            createdBy: ''
        };

        await createArticle(newArticle);
        const listeArticles = articles.filter(el => el.collectionId === id)
        await updateCollection(id as string, { quantite: listeArticles.length + 1 })
        open_set();
    };

    const filteredSousCollections = sousCollections.filter(sc => sc.collectionId === id);

    return (
        <div className="absolute right-0 top-0 p-8 rounded-l-3xl bg-white h-full w-[700px] slide-enter overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-inter-semibold">Nouveau Produit</h2>
                <button
                    onClick={open_set}
                    className="text-gray-500 hover:text-gray-700"
                >
                    ✕
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Collection</label>
                        <input
                            type="text"
                            value={collections.find(c => c.id === formData.collectionId)?.nom || ''}
                            readOnly
                            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                        {errors.collectionId && <p className="text-red-500 text-xs mt-1">{errors.collectionId}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Sous-collection</label>
                        <select
                            name="sousCollectionId"
                            value={formData.sousCollectionId}
                            onChange={handleChange}
                            disabled={!formData.collectionId}
                            className={`w-full p-2 border rounded-lg ${errors.sousCollectionId ? 'border-red-500' : 'border-gray-300'} ${!formData.collectionId ? 'bg-gray-100' : ''}`}
                        >
                            <option value="">Sélectionner</option>
                            {filteredSousCollections.map(sc => (
                                <option key={sc.id} value={sc.id}>{sc.nom}</option>
                            ))}
                        </select>
                        {errors.sousCollectionId && <p className="text-red-500 text-xs mt-1">{errors.sousCollectionId}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nom du produit *</label>
                        <input
                            type="text"
                            name="nom"
                            value={formData.nom}
                            onChange={handleChange}
                            className={`w-full p-2 border rounded-lg ${errors.nom ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Référence *</label>
                        <input
                            type="text"
                            name="reference"
                            value={formData.reference}
                            onChange={handleChange}
                            placeholder="ART-0001"
                            className={`w-full p-2 border rounded-lg ${errors.reference ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {errors.reference && <p className="text-red-500 text-xs mt-1">{errors.reference}</p>}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Prix HT (FCFA) *</label>
                        <input
                            type="number"
                            name="prixHT"
                            value={formData.prixHT}
                            onChange={handleChange}
                            className={`w-full p-2 border rounded-lg ${errors.prixHT ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {errors.prixHT && <p className="text-red-500 text-xs mt-1">{errors.prixHT}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Taux TVA (%)</label>
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
                            min="0"
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Longueur (cm)</label>
                        <input
                            type="number"
                            step={"0.1"}
                            name="dimension.longueur"
                            value={formData.dimensions.longueur || ''}
                            onChange={handleChange}
                            min="0"
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Largeur (cm)</label>
                        <input
                            type="number"
                            step={"0.1"}
                            name="dimension.largeur"
                            value={formData.dimensions.largeur || ''}
                            onChange={handleChange}
                            min="0"
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Hauteur (cm)</label>
                        <input
                            type="number"
                            step={"0.1"}
                            name="dimension.hauteur"
                            value={formData.dimensions.hauteur || ''}
                            onChange={handleChange}
                            min="0"
                            className="w-full p-2 border border-gray-gray-300 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Poids (kg)</label>
                        <input
                            type="number"
                            step={"0.1"}
                            name="dimension.poids"
                            value={formData.dimensions.poids || ''}
                            onChange={handleChange}
                            min="0"
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Images</label>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />
                    <div
                        onClick={triggerFileInput}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                            }`}
                    >
                        <p className="text-gray-500 text-sm">
                            Cliquez ou glissez des images ici
                        </p>
                    </div>

                    {imagePreviews.length > 0 && (
                        <div className="mt-4 grid grid-cols-4 gap-3">
                            {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative group">
                                    <img
                                        src={preview}
                                        alt={`Preview ${index + 1}`}
                                        className="w-full h-24 object-cover rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(index)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
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

                <div className="flex justify-end gap-4 pt-4">
                    <button
                        type="button"
                        onClick={open_set}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </form>
        </div>
    );
}