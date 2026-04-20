'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';

const MAX_IMAGES = 10;
const MAX_VIDEOS = 2;

// Noms et catégories : lettres (accentuées ou non), chiffres, espaces et ponctuation courante.
// On évite les regex Unicode `\p{L}` / `\p{N}` et le flag `u` pour rester compatibles avec une cible TS < ES6.
const ALLOWED_NAME = /^[A-Za-z0-9À-ÖØ-öø-ÿ\s\-',.?!:;()]*$/;
// Description : tout sauf < > \ (évite injection HTML/script). Autorise %, €, $, « », etc.
const ALLOWED_DESCRIPTION = /^[^<>\\]*$/;
const ALLOWED_CATEGORY = /^[A-Za-z0-9À-ÖØ-öø-ÿ\s\-',.?!:;()]*$/;

/** Icône trombone (pièce jointe) pour le choix de fichier */
function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

/** Évite "Unexpected end of JSON input" quand la réponse est vide ou non-JSON */
async function parseResJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function NewProductPage() {
  const { user, token, refreshUser } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [allowedCurrencies, setAllowedCurrencies] = useState<string[]>(['XOF']);
  const [loading, setLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<{ type: 'image' | 'video'; i: number } | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currencyOption, setCurrencyOption] = useState<string>('XOF');
  const [categoryId, setCategoryId] = useState('');
  const [categoryOther, setCategoryOther] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [videoUrls, setVideoUrls] = useState<string[]>(['']);

  const imageFileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const videoFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const canPublish = user?.role === 'SUPPLIER' || user?.role === 'SUPER_ADMIN' || user?.role === 'AFFILIATE';

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((list) => setCategories(Array.isArray(list) ? list : []));
  }, []);
  useEffect(() => {
    fetch('/api/currencies')
      .then((r) => r.json())
      .then((list) => setAllowedCurrencies(Array.isArray(list) && list.length > 0 ? list : ['XOF']));
  }, []);

  // Devise par défaut : celle du wallet si elle fait partie des devises autorisées
  useEffect(() => {
    if (!token || allowedCurrencies.length === 0) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((me) => {
        const walletCurrency = (me?.wallet as { currency?: string } | undefined)?.currency;
        if (walletCurrency && typeof walletCurrency === 'string') {
          const c = walletCurrency.trim().toUpperCase().slice(0, 10);
          if (allowedCurrencies.includes(c)) setCurrencyOption(c);
        }
      })
      .catch(() => {});
  }, [token, allowedCurrencies]);

  function addImage() {
    if (imageUrls.length >= MAX_IMAGES) return;
    setImageUrls((prev) => [...prev, '']);
  }
  function removeImage(i: number) {
    setImageUrls((prev) => prev.filter((_, idx) => idx !== i));
    if (mainImageIndex >= i && mainImageIndex > 0) setMainImageIndex(mainImageIndex - 1);
    else if (mainImageIndex === i && imageUrls.length > 1) setMainImageIndex(0);
  }
  function setImageUrl(i: number, url: string) {
    setImageUrls((prev) => {
      const next = [...prev];
      next[i] = url;
      return next;
    });
  }

  function addVideo() {
    if (videoUrls.length >= MAX_VIDEOS) return;
    setVideoUrls((prev) => [...prev, '']);
  }
  function removeVideo(i: number) {
    setVideoUrls((prev) => prev.filter((_, idx) => idx !== i));
  }
  function setVideoUrl(i: number, url: string) {
    setVideoUrls((prev) => {
      const next = [...prev];
      next[i] = url;
      return next;
    });
  }

  async function handleFileUpload(file: File, type: 'image' | 'video', index: number) {
    setUploadingIndex({ type, i: index });
    const formData = new FormData();
    formData.set('file', file);
    formData.set('type', type);
    try {
      const res = await fetch('/api/supplier/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await parseResJson(res);
      if (!res.ok) {
        const msg =
          data.error === 'image_too_large' ? t('uploadErrorImageTooLarge')
          : data.error === 'video_too_large' ? t('uploadErrorVideoTooLarge')
          : data.error === 'invalid_image_type' ? t('uploadErrorInvalidImageType')
          : data.error === 'invalid_video_type' ? t('uploadErrorInvalidVideoType')
          : data.error === 'upload_failed' ? t('uploadFailed')
          : (data.error ?? t('uploadFailed'));
        throw new Error(typeof msg === 'string' ? msg : String(msg ?? 'Upload failed'));
      }
      if (type === 'image') setImageUrl(index, (data.url as string) ?? '');
      else setVideoUrl(index, (data.url as string) ?? '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      setUploadingIndex(null);
    }
  }

  function onImageFileChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, 'image', i);
    e.target.value = '';
  }
  function onVideoFileChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, 'video', i);
    e.target.value = '';
  }

  function getCurrency(): string {
    return allowedCurrencies.includes(currencyOption) ? currencyOption : 'XOF';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nameTrim = name.trim();
    const descTrim = description.trim();
    const categoryNameTrim = categoryOther.trim();

    if (!nameTrim) {
      toast.error(t('nameRequired'));
      return;
    }
    if (!ALLOWED_NAME.test(nameTrim)) {
      toast.error(t('invalidCharactersName'));
      return;
    }
    if (descTrim && !ALLOWED_DESCRIPTION.test(descTrim)) {
      toast.error(t('invalidCharactersDescription'));
      return;
    }
    if (categoryNameTrim && !ALLOWED_CATEGORY.test(categoryNameTrim)) {
      toast.error(t('invalidCharactersCategory'));
      return;
    }

    const priceNum = parseFloat(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error(t('invalidPrice'));
      return;
    }

    const images = imageUrls.map((u) => u.trim()).filter(Boolean);
    const videos = videoUrls.map((u) => u.trim()).filter(Boolean);
    const mainIdx = Math.min(mainImageIndex, Math.max(0, images.length - 1));

    if (images.length === 0) {
      toast.error(t('atLeastOneImage'));
      return;
    }

    setLoading(true);
    const payload = {
      name: nameTrim,
      description: descTrim || null,
      price: priceNum,
      currency: getCurrency(),
      categoryId: (categoryId && categoryId !== '__other__') ? categoryId : null,
      categoryName: useCategoryOther ? categoryNameTrim || undefined : undefined,
      imageUrls: images,
      mainImageIndex: mainIdx,
      videoUrls: videos,
    };

    async function doSubmit(accessToken: string | null) {
      if (!accessToken) throw new Error(t('sessionExpired'));
      const res = await fetch('/api/supplier/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      const data = await parseResJson(res);
      if (res.status === 401) return null; // token invalide ou expiré → tenter refresh
      if (!res.ok) throw new Error((data.error as string) ?? 'Erreur');
      return true;
    }

    try {
      let ok = await doSubmit(token);
      if (ok === null) {
        const newToken = await refreshUser();
        ok = await doSubmit(newToken);
      }
      if (ok) {
        toast.success(t('saved') ?? 'Produit créé.');
        router.push('/dashboard/products');
        router.refresh();
      } else if (ok === null) {
        toast.error(t('sessionExpired'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="p-8">
        <p>{t('connectToAccessDashboard')}</p>
        <Link href="/auth/login" className="btn btn-primary mt-4">{t('login')}</Link>
      </div>
    );
  }
  if (!canPublish) {
    return (
      <div className="p-8">
        <p>Seuls les fournisseurs, affiliés et administrateurs peuvent publier des produits.</p>
        <Link href="/dashboard" className="btn btn-ghost mt-4">{t('back')}</Link>
      </div>
    );
  }

  const imagesFiltered = imageUrls.map((u) => u.trim()).filter(Boolean);
  const useCategoryOther = categoryId === '__other__';

  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar bg-base-100 shadow px-2 sm:px-4 min-h-12 py-1 gap-1 flex-nowrap overflow-x-hidden w-full max-w-full">
        <div className="navbar-start shrink-0 min-w-0 max-w-[80%] flex-nowrap gap-1">
          <AppLogo className="btn btn-ghost btn-sm px-1 truncate max-w-[120px] sm:max-w-none" />
          <Link href="/dashboard" className="btn btn-ghost btn-sm whitespace-nowrap shrink-0">← {t('dashboard')}</Link>
        </div>
        <div className="navbar-end shrink-0 flex-nowrap gap-1">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">{t('publishProduct')}</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-control">
            <label className="label"><span className="label-text">{t('productName')} *</span></label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">{t('productDescription')}</span></label>
            <textarea
              className="textarea textarea-bordered w-full min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              placeholder=""
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">{t('productPriceWithCurrency').replace('{currency}', getCurrency())} *</span></label>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="number"
                min={0}
                step={0.01}
                className="input input-bordered w-32"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="select select-bordered select-sm w-28"
                  value={allowedCurrencies.includes(currencyOption) ? currencyOption : 'XOF'}
                  onChange={(e) => setCurrencyOption(e.target.value)}
                >
                  {allowedCurrencies.map((c) => (
                    <option key={c} value={c}>{c === 'XOF' ? 'F CFA' : c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">{t('productCategory')}</span></label>
            <select
              className="select select-bordered w-full max-w-md"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__other__">{t('categoryOther')}</option>
            </select>
            {useCategoryOther && (
              <input
                type="text"
                className="input input-bordered w-full max-w-md mt-2"
                placeholder={t('categoryOther')}
                value={categoryOther}
                onChange={(e) => setCategoryOther(e.target.value.slice(0, 100))}
                maxLength={100}
              />
            )}
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">{t('productImages')}</span></label>
            {imageUrls.map((url, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center mb-2">
                <input
                  type="text"
                  className="input input-bordered flex-1 min-w-0 input-sm"
                  placeholder={`${t('addImageUrl')} ${i + 1}`}
                  value={url}
                  onChange={(e) => setImageUrl(i, e.target.value)}
                />
                <label htmlFor={`image-file-${i}`} className="btn btn-ghost btn-sm btn-square shrink-0" title={t('orChooseFile')}>
                  <PaperclipIcon />
                </label>
                <input
                  id={`image-file-${i}`}
                  ref={(el) => { imageFileRefs.current[i] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => onImageFileChange(i, e)}
                  disabled={!!uploadingIndex}
                />
                {uploadingIndex?.type === 'image' && uploadingIndex?.i === i && (
                  <span className="text-sm opacity-70">{t('uploadInProgress')}</span>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMainImageIndex(i)} title={t('setAsMain')}>
                  {mainImageIndex === i ? '★' : '☆'}
                </button>
                {imageUrls.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm btn-error" onClick={() => removeImage(i)}>×</button>
                )}
              </div>
            ))}
            {imageUrls.length < MAX_IMAGES && (
              <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={addImage}>+ {t('addImageUrl')}</button>
            )}
            {imagesFiltered.length > 0 && (
              <p className="text-xs opacity-70 mt-1">{t('mainImage')}: image #{mainImageIndex + 1}</p>
            )}
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text">{t('productVideos')}</span></label>
            {videoUrls.map((url, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-center mb-2">
                <input
                  type="text"
                  className="input input-bordered flex-1 min-w-0 input-sm"
                  placeholder={`${t('addVideoUrl')} ${i + 1}`}
                  value={url}
                  onChange={(e) => setVideoUrl(i, e.target.value)}
                />
                <label htmlFor={`video-file-${i}`} className="btn btn-ghost btn-sm btn-square shrink-0" title={t('orChooseVideo')}>
                  <PaperclipIcon />
                </label>
                <input
                  id={`video-file-${i}`}
                  ref={(el) => { videoFileRefs.current[i] = el; }}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => onVideoFileChange(i, e)}
                  disabled={!!uploadingIndex}
                />
                {uploadingIndex?.type === 'video' && uploadingIndex?.i === i && (
                  <span className="text-sm opacity-70">{t('uploadInProgress')}</span>
                )}
                {videoUrls.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm btn-error" onClick={() => removeVideo(i)}>×</button>
                )}
              </div>
            ))}
            {videoUrls.length < MAX_VIDEOS && (
              <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={addVideo}>+ {t('addVideoUrl')}</button>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : t('save')}
            </button>
            <Link href="/dashboard" className="btn btn-ghost">{t('back')}</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
