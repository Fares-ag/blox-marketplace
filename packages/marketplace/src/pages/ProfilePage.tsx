import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DocumentMeta,
  apiFetch,
  apiFileUrl,
  documentUploadRejection,
  getAppLocale,
  setAppLocale,
  useAuthStore,
  type AppLocale,
  type CustomerDocumentCategoryDto,
  type CustomerDocumentDto,
  type CustomerProfileDto,
  type GenderDto,
} from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';
import { YourDataSection } from '../components/YourDataSection';
import { formatDate, todayInputValue } from '../lib/dates';
import { uploadMultipart } from '../lib/multipart';

const VAULT_CATEGORIES: CustomerDocumentCategoryDto[] = [
  'qid_front',
  'qid_back',
  'passport',
  'driving_licence',
  'residence_proof',
  'salary_certificate',
  'bank_statement',
  'other',
];

const GENDER_OPTIONS: Array<{ value: '' | GenderDto; labelKey: string }> = [
  { value: '', labelKey: 'customerProfile.contact.genderUnset' },
  { value: 'male', labelKey: 'customerProfile.contact.genderMale' },
  { value: 'female', labelKey: 'customerProfile.contact.genderFemale' },
];

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  gender: '' | GenderDto;
  dateOfBirth: string;
  nationality: string;
  preferredLanguage: AppLocale;
  channels: { email: boolean; sms: boolean; push: boolean; whatsapp: boolean };
  reminders: { payments: boolean; documents: boolean; takaful: boolean };
  address: { line1: string; area: string; city: string; zone: string; poBox: string };
};

function formFromProfile(p: CustomerProfileDto): ProfileForm {
  return {
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    phone: p.phone ?? '',
    gender: p.gender ?? '',
    dateOfBirth: p.date_of_birth ? p.date_of_birth.slice(0, 10) : '',
    nationality: p.nationality ?? '',
    preferredLanguage: p.preferred_language === 'ar' ? 'ar' : 'en',
    channels: {
      email: p.notification_preferences?.channels?.email ?? true,
      sms: p.notification_preferences?.channels?.sms ?? true,
      push: p.notification_preferences?.channels?.push ?? true,
      whatsapp: p.notification_preferences?.channels?.whatsapp ?? false,
    },
    reminders: {
      payments: p.notification_preferences?.reminders?.payments ?? true,
      documents: p.notification_preferences?.reminders?.documents ?? true,
      takaful: p.notification_preferences?.reminders?.takaful ?? true,
    },
    address: {
      line1: p.address?.line1 ?? '',
      area: p.address?.area ?? '',
      city: p.address?.city ?? '',
      zone: p.address?.zone ?? '',
      poBox: p.address?.po_box ?? '',
    },
  };
}

function trimmedOrUndefined(value: string): string | undefined {
  const v = value.trim();
  return v ? v : undefined;
}

function toPatchBody(form: ProfileForm): Record<string, unknown> {
  const address: Record<string, string> = {};
  const line1 = trimmedOrUndefined(form.address.line1);
  const area = trimmedOrUndefined(form.address.area);
  const city = trimmedOrUndefined(form.address.city);
  const zone = trimmedOrUndefined(form.address.zone);
  const poBox = trimmedOrUndefined(form.address.poBox);
  if (line1) address.line1 = line1;
  if (area) address.area = area;
  if (city) address.city = city;
  if (zone) address.zone = zone;
  if (poBox) address.po_box = poBox;
  return {
    first_name: trimmedOrUndefined(form.firstName),
    last_name: trimmedOrUndefined(form.lastName),
    phone: trimmedOrUndefined(form.phone),
    gender: form.gender || undefined,
    date_of_birth: form.dateOfBirth || undefined,
    nationality: trimmedOrUndefined(form.nationality),
    preferred_language: form.preferredLanguage,
    notification_preferences: { channels: form.channels, reminders: form.reminders },
    ...(Object.keys(address).length ? { address } : {}),
  };
}

type VaultForm = {
  category: CustomerDocumentCategoryDto;
  file: File | null;
  documentNumber: string;
  issuedAt: string;
  expiresAt: string;
};

const EMPTY_VAULT_FORM: VaultForm = {
  category: 'qid_front',
  file: null,
  documentNumber: '',
  issuedAt: '',
  expiresAt: '',
};

type Notice = { tone: 'ok' | 'error'; text: string } | null;

export function ProfilePage() {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const revokeAllSessions = useAuthStore((s) => s.revokeAllSessions);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const profile = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => apiFetch<CustomerProfileDto>('/api/me/profile'),
  });
  const documents = useQuery({
    queryKey: ['me-documents'],
    queryFn: () => apiFetch<CustomerDocumentDto[]>('/api/me/documents'),
  });

  const [form, setForm] = useState<ProfileForm | null>(null);
  const [dirty, setDirty] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultForm, setVaultForm] = useState<VaultForm>(EMPTY_VAULT_FORM);
  const [vaultNotice, setVaultNotice] = useState<Notice>(null);
  const [securityNotice, setSecurityNotice] = useState<Notice>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vaultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (profile.data && !dirty) setForm(formFromProfile(profile.data));
    // Only re-seed the form from the server while the customer has not started editing.
  }, [profile.data]);

  useEffect(() => {
    if (location.hash === '#vault' && documents.data) {
      vaultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, documents.data]);

  function patch(update: (prev: ProfileForm) => ProfileForm) {
    setForm((prev) => (prev ? update(prev) : prev));
    setDirty(true);
    setProfileNotice(null);
  }

  const saveProfile = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<CustomerProfileDto>('/api/me/profile', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(['me-profile'], data);
      setForm(formFromProfile(data));
      setDirty(false);
      setProfileNotice({ tone: 'ok', text: t('customerProfile.saved') });
      void refreshProfile();
    },
    onError: () => setProfileNotice({ tone: 'error', text: t('customerProfile.saveError') }),
  });

  function onSubmitProfile(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setProfileNotice(null);
    saveProfile.mutate(toPatchBody(form));
  }

  function onLanguageChange(next: AppLocale) {
    patch((prev) => ({ ...prev, preferredLanguage: next }));
    setAppLocale(next);
  }

  const uploadDocument = useMutation({
    mutationFn: async (input: VaultForm) => {
      const body = new FormData();
      body.append('file', input.file!);
      body.append('category', input.category);
      if (input.documentNumber.trim()) body.append('document_number', input.documentNumber.trim());
      if (input.issuedAt) body.append('issued_at', input.issuedAt);
      if (input.expiresAt) body.append('expires_at', input.expiresAt);
      return uploadMultipart<CustomerDocumentDto>('/api/me/documents', body);
    },
    onSuccess: () => {
      setVaultForm(EMPTY_VAULT_FORM);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setVaultOpen(false);
      setVaultNotice({ tone: 'ok', text: t('customerProfile.vault.uploaded') });
      void qc.invalidateQueries({ queryKey: ['me-documents'] });
    },
    onError: () => setVaultNotice({ tone: 'error', text: t('customerProfile.vault.uploadError') }),
  });

  const removeDocument = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/me/documents/${id}`, { method: 'DELETE' }),
    onMutate: (id) => setRemovingId(id),
    onSettled: () => setRemovingId(null),
    onSuccess: () => {
      setVaultNotice({ tone: 'ok', text: t('customerProfile.vault.removed') });
      void qc.invalidateQueries({ queryKey: ['me-documents'] });
    },
    onError: () => setVaultNotice({ tone: 'error', text: t('customerProfile.vault.removeError') }),
  });

  function onSubmitVault(e: FormEvent) {
    e.preventDefault();
    setVaultNotice(null);
    if (!vaultForm.file) {
      setVaultNotice({ tone: 'error', text: t('customerProfile.vault.fileRequired') });
      return;
    }
    const rejection = documentUploadRejection(vaultForm.file);
    if (rejection) {
      setVaultNotice({
        tone: 'error',
        text:
          rejection.code === 'type'
            ? t('applyFlow.docs.rejectType', { ...rejection.params, defaultValue: t('customerProfile.vault.uploadError') })
            : t('applyFlow.docs.rejectSize', { ...rejection.params, defaultValue: t('customerProfile.vault.uploadError') }),
      });
      return;
    }
    uploadDocument.mutate(vaultForm);
  }

  const signOutEverywhere = useMutation({
    mutationFn: async () => {
      const result = await revokeAllSessions();
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      setSecurityNotice({ tone: 'ok', text: t('customerProfile.security.sessionsDone') });
      navigate('/auth/login', { replace: true });
    },
    onError: () => setSecurityNotice({ tone: 'error', text: t('customerProfile.security.sessionsError') }),
  });

  const docs = [...(documents.data ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  function expiryBadge(doc: CustomerDocumentDto) {
    const days = doc.days_to_expiry;
    switch (doc.expiry_state) {
      case 'expired':
        return {
          tone: 'danger',
          label: t('customerProfile.vault.expired'),
          detail:
            days != null && days < 0
              ? t('customerProfile.vault.expiredDaysAgo', { days: Math.abs(days) })
              : formatDate(doc.expires_at, locale),
        };
      case 'expiring_soon':
        return {
          tone: 'warn',
          label: t('customerProfile.vault.expiresSoon'),
          detail:
            days === 0
              ? t('customerProfile.vault.expiresToday')
              : days != null
                ? t('customerProfile.vault.expiresIn', { days })
                : formatDate(doc.expires_at, locale),
        };
      case 'valid':
        return {
          tone: 'ok',
          label: t('customerProfile.vault.valid'),
          detail:
            days != null
              ? t('customerProfile.vault.expiresIn', { days })
              : t('customerProfile.vault.expires', { date: formatDate(doc.expires_at, locale) }),
        };
      default:
        return { tone: 'quiet', label: t('customerProfile.vault.noExpiry'), detail: '' };
    }
  }

  const residencyLabel =
    profile.data?.residency === 'qatari'
      ? t('customerProfile.contact.residencyQatari')
      : profile.data?.residency === 'expat'
        ? t('customerProfile.contact.residencyExpat')
        : null;

  return (
    <div className="dm-profile">
      <DocumentMeta title={t('customerProfile.title')} />
      <div className="dm-profile__top">
        <div className="dm-profile__inner">
          <MarketplaceNav />
          <p className="dm-profile__back">
            <Link to="/app/dashboard">← {t('customerProfile.backDashboard')}</Link>
          </p>
          <h1>{t('customerProfile.title')}</h1>
          <p className="dm-profile__lead">{t('customerProfile.subtitle')}</p>
        </div>
      </div>

      <div className="dm-profile__body">
        <div className="dm-profile__inner dm-profile__grid">
          <div className="dm-profile__col">
            {profile.isLoading && <p className="dm-profile__muted">{t('customerProfile.loading')}</p>}
            {profile.isError && <p className="dm-profile__error">{t('customerProfile.loadError')}</p>}

            {form && profile.data && (
              <form className="dm-profile__form" onSubmit={onSubmitProfile}>
                <section className="dm-profile__card" aria-labelledby="dm-profile-contact">
                  <h2 id="dm-profile-contact">{t('customerProfile.contact.title')}</h2>
                  <div className="dm-profile__identity">
                    <div>
                      <span className="dm-profile__identity-label">{t('customerProfile.contact.qid')}</span>
                      <strong className="dm-money">{profile.data.qid_masked || t('customerProfile.contact.qidNone')}</strong>
                    </div>
                    {residencyLabel && <span className="dm-profile__chip">{residencyLabel}</span>}
                    {profile.data.nationality && !form.nationality && (
                      <span className="dm-profile__chip">{profile.data.nationality}</span>
                    )}
                    <p className="dm-profile__hint">{t('customerProfile.contact.qidHint')}</p>
                  </div>
                  <div className="dm-profile__fields">
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.contact.firstName')}</span>
                      <input
                        value={form.firstName}
                        autoComplete="given-name"
                        onChange={(e) => patch((p) => ({ ...p, firstName: e.target.value }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.contact.lastName')}</span>
                      <input
                        value={form.lastName}
                        autoComplete="family-name"
                        onChange={(e) => patch((p) => ({ ...p, lastName: e.target.value }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.contact.phone')}</span>
                      <input
                        value={form.phone}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        dir="ltr"
                        onChange={(e) => patch((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.contact.email')}</span>
                      <input value={profile.data.email} readOnly aria-describedby="dm-profile-email-hint" dir="ltr" />
                      <small id="dm-profile-email-hint">{t('customerProfile.contact.emailLocked')}</small>
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.contact.gender')}</span>
                      <select
                        value={form.gender}
                        onChange={(e) => patch((p) => ({ ...p, gender: e.target.value as '' | GenderDto }))}
                      >
                        {GENDER_OPTIONS.map((o) => (
                          <option key={o.value || 'unset'} value={o.value}>
                            {t(o.labelKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.contact.dateOfBirth')}</span>
                      <input
                        type="date"
                        value={form.dateOfBirth}
                        max={todayInputValue()}
                        autoComplete="bday"
                        onChange={(e) => patch((p) => ({ ...p, dateOfBirth: e.target.value }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.contact.nationality')}</span>
                      <input
                        value={form.nationality}
                        autoComplete="country-name"
                        onChange={(e) => patch((p) => ({ ...p, nationality: e.target.value }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="dm-profile__card" aria-labelledby="dm-profile-address">
                  <h2 id="dm-profile-address">{t('customerProfile.address.title')}</h2>
                  <div className="dm-profile__fields">
                    <label className="dm-profile__field dm-profile__field--wide">
                      <span>{t('customerProfile.address.line1')}</span>
                      <input
                        value={form.address.line1}
                        autoComplete="address-line1"
                        onChange={(e) => patch((p) => ({ ...p, address: { ...p.address, line1: e.target.value } }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.address.area')}</span>
                      <input
                        value={form.address.area}
                        onChange={(e) => patch((p) => ({ ...p, address: { ...p.address, area: e.target.value } }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.address.city')}</span>
                      <input
                        value={form.address.city}
                        autoComplete="address-level2"
                        onChange={(e) => patch((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.address.zone')}</span>
                      <input
                        value={form.address.zone}
                        inputMode="numeric"
                        onChange={(e) => patch((p) => ({ ...p, address: { ...p.address, zone: e.target.value } }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>{t('customerProfile.address.poBox')}</span>
                      <input
                        value={form.address.poBox}
                        onChange={(e) => patch((p) => ({ ...p, address: { ...p.address, poBox: e.target.value } }))}
                      />
                    </label>
                  </div>
                </section>

                <section className="dm-profile__card" aria-labelledby="dm-profile-prefs">
                  <h2 id="dm-profile-prefs">{t('customerProfile.preferences.title')}</h2>
                  <fieldset className="dm-profile__fieldset">
                    <legend>{t('customerProfile.preferences.language')}</legend>
                    <div className="dm-profile__segmented" role="radiogroup" aria-label={t('customerProfile.preferences.language')}>
                      {(['en', 'ar'] as AppLocale[]).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          role="radio"
                          aria-checked={form.preferredLanguage === lang}
                          className={form.preferredLanguage === lang ? 'is-active' : ''}
                          onClick={() => onLanguageChange(lang)}
                        >
                          {lang === 'en'
                            ? t('customerProfile.preferences.languageEn')
                            : t('customerProfile.preferences.languageAr')}
                        </button>
                      ))}
                    </div>
                    <p className="dm-profile__hint">{t('customerProfile.preferences.languageHint')}</p>
                  </fieldset>
                  <fieldset className="dm-profile__fieldset">
                    <legend>{t('customerProfile.preferences.channels')}</legend>
                    <div className="dm-profile__checks">
                      {(
                        [
                          ['email', 'customerProfile.preferences.channelEmail'],
                          ['sms', 'customerProfile.preferences.channelSms'],
                          ['push', 'customerProfile.preferences.channelPush'],
                          ['whatsapp', 'customerProfile.preferences.channelWhatsapp'],
                        ] as Array<[keyof ProfileForm['channels'], string]>
                      ).map(([key, labelKey]) => (
                        <label key={key} className="dm-profile__check">
                          <input
                            type="checkbox"
                            checked={form.channels[key]}
                            onChange={(e) =>
                              patch((p) => ({ ...p, channels: { ...p.channels, [key]: e.target.checked } }))
                            }
                          />
                          <span>{t(labelKey)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="dm-profile__fieldset">
                    <legend>{t('customerProfile.preferences.reminders')}</legend>
                    <div className="dm-profile__checks">
                      {(
                        [
                          ['payments', 'customerProfile.preferences.reminderPayments'],
                          ['documents', 'customerProfile.preferences.reminderDocuments'],
                          ['takaful', 'customerProfile.preferences.reminderTakaful'],
                        ] as Array<[keyof ProfileForm['reminders'], string]>
                      ).map(([key, labelKey]) => (
                        <label key={key} className="dm-profile__check">
                          <input
                            type="checkbox"
                            checked={form.reminders[key]}
                            onChange={(e) =>
                              patch((p) => ({ ...p, reminders: { ...p.reminders, [key]: e.target.checked } }))
                            }
                          />
                          <span>{t(labelKey)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </section>

                <div className="dm-profile__savebar">
                  {profileNotice && (
                    <p className={`dm-profile__notice dm-profile__notice--${profileNotice.tone}`} role="status">
                      {profileNotice.text}
                    </p>
                  )}
                  <button type="submit" className="dm-btn-cta dm-profile__save" disabled={saveProfile.isPending || !dirty}>
                    {saveProfile.isPending ? t('customerProfile.saving') : t('customerProfile.save')}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="dm-profile__col">
            <section className="dm-profile__card" id="vault" ref={vaultRef} aria-labelledby="dm-profile-vault">
              <div className="dm-profile__card-head">
                <h2 id="dm-profile-vault">{t('customerProfile.vault.title')}</h2>
                {!vaultOpen && (
                  <button type="button" className="dm-profile__outline-btn" onClick={() => setVaultOpen(true)}>
                    {t('customerProfile.vault.upload')}
                  </button>
                )}
              </div>
              <p className="dm-profile__hint">{t('customerProfile.vault.intro')}</p>
              <p className="dm-profile__hint dm-profile__hint--note">{t('customerProfile.vault.reminderNote')}</p>

              {vaultNotice && (
                <p className={`dm-profile__notice dm-profile__notice--${vaultNotice.tone}`} role="status">
                  {vaultNotice.text}
                </p>
              )}

              {vaultOpen && (
                <form className="dm-profile__vault-form" onSubmit={onSubmitVault}>
                  <label className="dm-profile__field">
                    <span>{t('customerProfile.vault.category')}</span>
                    <select
                      value={vaultForm.category}
                      onChange={(e) =>
                        setVaultForm((p) => ({ ...p, category: e.target.value as CustomerDocumentCategoryDto }))
                      }
                    >
                      {VAULT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(`customerProfile.vault.categories.${c}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="dm-profile__field">
                    <span>{t('customerProfile.vault.file')}</span>
                    <label className="dm-profile__file">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={DOCUMENT_UPLOAD_ACCEPT}
                        onChange={(e) => setVaultForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                      />
                      <span className="dm-profile__file-btn">{t('customerProfile.vault.chooseFile')}</span>
                      <span className={`dm-profile__file-name${vaultForm.file ? ' is-selected' : ''}`}>
                        {vaultForm.file?.name ?? t('customerProfile.vault.noFile')}
                      </span>
                    </label>
                    <small>{t('customerProfile.vault.fileHint')}</small>
                  </div>
                  <label className="dm-profile__field">
                    <span>
                      {t('customerProfile.vault.number')} <em>{t('customerProfile.vault.optional')}</em>
                    </span>
                    <input
                      value={vaultForm.documentNumber}
                      dir="ltr"
                      autoComplete="off"
                      onChange={(e) => setVaultForm((p) => ({ ...p, documentNumber: e.target.value }))}
                    />
                    <small>{t('customerProfile.vault.numberHint')}</small>
                  </label>
                  <div className="dm-profile__fields">
                    <label className="dm-profile__field">
                      <span>
                        {t('customerProfile.vault.issuedAt')} <em>{t('customerProfile.vault.optional')}</em>
                      </span>
                      <input
                        type="date"
                        value={vaultForm.issuedAt}
                        max={todayInputValue()}
                        onChange={(e) => setVaultForm((p) => ({ ...p, issuedAt: e.target.value }))}
                      />
                    </label>
                    <label className="dm-profile__field">
                      <span>
                        {t('customerProfile.vault.expiresAt')} <em>{t('customerProfile.vault.optional')}</em>
                      </span>
                      <input
                        type="date"
                        value={vaultForm.expiresAt}
                        min={vaultForm.issuedAt || undefined}
                        onChange={(e) => setVaultForm((p) => ({ ...p, expiresAt: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="dm-profile__vault-actions">
                    <button type="submit" className="dm-btn-cta dm-profile__save" disabled={uploadDocument.isPending}>
                      {uploadDocument.isPending ? t('customerProfile.vault.uploading') : t('customerProfile.vault.add')}
                    </button>
                    <button
                      type="button"
                      className="dm-profile__outline-btn"
                      disabled={uploadDocument.isPending}
                      onClick={() => {
                        setVaultOpen(false);
                        setVaultForm(EMPTY_VAULT_FORM);
                      }}
                    >
                      {t('customerProfile.vault.cancel')}
                    </button>
                  </div>
                </form>
              )}

              {documents.isLoading && <p className="dm-profile__muted">{t('vehicles.loading')}</p>}
              {!documents.isLoading && docs.length === 0 && (
                <p className="dm-profile__muted">{t('customerProfile.vault.empty')}</p>
              )}
              {docs.length > 0 && (
                <>
                  <p className="dm-profile__count">{t('customerProfile.vault.count', { count: docs.length })}</p>
                  <ul className="dm-profile__docs">
                    {docs.map((doc) => {
                      const badge = expiryBadge(doc);
                      return (
                        <li key={doc.id} className="dm-profile__doc">
                          <div className="dm-profile__doc-main">
                            <strong>{t(`customerProfile.vault.categories.${doc.category}`, { defaultValue: doc.category })}</strong>
                            <span className="dm-profile__doc-meta">
                              {doc.original_name && <span className="dm-profile__doc-name">{doc.original_name}</span>}
                              {doc.document_number_masked && (
                                <span className="dm-money" dir="ltr">
                                  {doc.document_number_masked}
                                </span>
                              )}
                              {doc.issued_at && (
                                <span>{t('customerProfile.vault.issued', { date: formatDate(doc.issued_at, locale) })}</span>
                              )}
                            </span>
                            <span className="dm-profile__doc-badges">
                              <span className={`dm-profile__badge dm-profile__badge--${badge.tone}`}>
                                {badge.label}
                                {badge.detail ? ` · ${badge.detail}` : ''}
                              </span>
                              <span className={`dm-profile__badge dm-profile__badge--${doc.verified_at ? 'ok' : 'quiet'}`}>
                                {doc.verified_at
                                  ? t('customerProfile.vault.verified')
                                  : t('customerProfile.vault.unverified')}
                              </span>
                            </span>
                          </div>
                          <div className="dm-profile__doc-actions">
                            <a href={apiFileUrl(`/api/me/documents/${doc.id}/file`)} target="_blank" rel="noreferrer">
                              {t('customerProfile.vault.download')}
                            </a>
                            <button
                              type="button"
                              disabled={removingId === doc.id}
                              onClick={() => {
                                if (!window.confirm(t('customerProfile.vault.removeConfirm'))) return;
                                setVaultNotice(null);
                                removeDocument.mutate(doc.id);
                              }}
                            >
                              {t('customerProfile.vault.remove')}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            <YourDataSection />

            <section className="dm-profile__card" aria-labelledby="dm-profile-security">
              <h2 id="dm-profile-security">{t('customerProfile.security.title')}</h2>
              <div className="dm-profile__security-row">
                <div>
                  <strong>{t('customerProfile.security.consents')}</strong>
                  <p className="dm-profile__hint">{t('customerProfile.security.consentsHint')}</p>
                </div>
                <Link className="dm-profile__outline-btn" to="/app/consents">
                  {t('customerProfile.security.consents')}
                </Link>
              </div>
              <div className="dm-profile__security-row">
                <div>
                  <strong>{t('customerProfile.security.sessions')}</strong>
                  <p className="dm-profile__hint">{t('customerProfile.security.sessionsHint')}</p>
                </div>
                <button
                  type="button"
                  className="dm-profile__danger-btn"
                  disabled={signOutEverywhere.isPending}
                  onClick={() => {
                    if (!window.confirm(t('customerProfile.security.sessionsConfirm'))) return;
                    setSecurityNotice(null);
                    signOutEverywhere.mutate();
                  }}
                >
                  {t('customerProfile.security.sessions')}
                </button>
              </div>
              {securityNotice && (
                <p className={`dm-profile__notice dm-profile__notice--${securityNotice.tone}`} role="status">
                  {securityNotice.text}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>

      <style>{`
        .dm-profile {
          --dm-profile-max: min(100%, var(--bp-content-max, 1600px));
          --dm-profile-gutter: 24px;
          background: var(--dm-canvas);
          min-height: 100vh;
        }
        .dm-profile__inner {
          width: 100%;
          max-width: var(--dm-profile-max);
          margin-inline: auto;
          padding-inline: var(--dm-profile-gutter);
          box-sizing: border-box;
        }
        .dm-profile__top {
          background:
            radial-gradient(ellipse 80% 60% at 100% 0%, rgba(0, 207, 162, 0.18), transparent 55%),
            linear-gradient(180deg, #0f3f45 0%, var(--dm-graphite-900) 100%);
          color: #fff;
          padding: 16px 0 28px;
        }
        .dm-profile .dm-topnav {
          position: relative !important;
          inset: auto !important;
          top: auto !important;
          z-index: auto !important;
          padding: 0 !important;
          margin: 0 0 20px;
        }
        .dm-profile__back { margin: 0 0 10px; font-size: 14px; }
        .dm-profile__back a { color: rgba(255,255,255,0.8); text-decoration: none; }
        .dm-profile__back a:hover { color: #fff; text-decoration: underline; }
        .dm-profile__top h1 {
          margin: 0 0 8px;
          font-family: var(--dm-font-display);
          font-size: clamp(1.7rem, 3vw, 2.2rem);
          letter-spacing: -0.02em;
        }
        .dm-profile__lead { margin: 0; color: rgba(255,255,255,0.72); max-width: 60ch; line-height: 1.5; }
        .dm-profile__body { padding: 24px 0 64px; }
        .dm-profile__grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
          gap: 20px;
          align-items: start;
        }
        .dm-profile__col { display: grid; gap: 20px; min-width: 0; }
        .dm-profile__form { display: grid; gap: 20px; }
        .dm-profile__card {
          background: var(--dm-surface);
          border: 1px solid var(--dm-slate-200);
          border-radius: 16px;
          padding: 20px 22px;
          min-width: 0;
        }
        .dm-profile__card h2 {
          margin: 0 0 12px;
          font-family: var(--dm-font-display);
          font-size: 1.15rem;
          line-height: 1.3;
        }
        .dm-profile__card-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px 16px;
        }
        .dm-profile__card-head h2 { margin-bottom: 8px; }
        .dm-profile__muted { margin: 0; color: var(--dm-slate-600); font-size: 0.9rem; }
        .dm-profile__error { margin: 0; color: var(--dm-danger); font-size: 0.9rem; }
        .dm-profile__hint { margin: 0; font-size: 13px; color: var(--dm-slate-600); line-height: 1.5; }
        .dm-profile__hint--note { margin-top: 6px; margin-bottom: 14px; }
        .dm-profile__identity {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--dm-canvas);
          margin-bottom: 16px;
        }
        .dm-profile__identity > div { display: grid; gap: 2px; }
        .dm-profile__identity-label { font-size: 12px; color: var(--dm-slate-600); }
        .dm-profile__identity strong { font-size: 1rem; letter-spacing: 0.04em; }
        .dm-profile__identity .dm-profile__hint { flex-basis: 100%; }
        .dm-profile__chip {
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--dm-steel-soft);
          color: var(--dm-ink);
          font-size: 12px;
          font-weight: 650;
        }
        .dm-profile__fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
        }
        .dm-profile__field {
          display: grid;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--dm-slate-600);
          min-width: 0;
        }
        .dm-profile__field--wide { grid-column: 1 / -1; }
        .dm-profile__field em { font-style: normal; font-weight: 500; color: var(--dm-slate-400); }
        .dm-profile__field small { font-weight: 500; font-size: 12px; line-height: 1.4; }
        .dm-profile__field input:not([type="checkbox"]):not([type="file"]),
        .dm-profile__field select {
          min-height: 42px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--dm-slate-200);
          font: inherit;
          color: var(--dm-ink);
          background: var(--dm-surface);
          width: 100%;
          box-sizing: border-box;
        }
        .dm-profile__field input[readonly] { background: var(--dm-canvas); color: var(--dm-slate-600); }
        .dm-profile__fieldset { margin: 0 0 14px; padding: 0; border: none; min-width: 0; }
        .dm-profile__fieldset:last-child { margin-bottom: 0; }
        .dm-profile__fieldset legend { padding: 0; margin-bottom: 8px; font-size: 13px; font-weight: 650; color: var(--dm-slate-600); }
        .dm-profile__segmented {
          display: inline-flex;
          padding: 3px;
          border-radius: 10px;
          background: var(--dm-canvas);
          border: 1px solid var(--dm-slate-200);
          margin-bottom: 6px;
        }
        .dm-profile__segmented button {
          border: none;
          background: transparent;
          min-height: 34px;
          padding: 0 16px;
          border-radius: 8px;
          font: inherit;
          font-size: 14px;
          font-weight: 650;
          color: var(--dm-slate-600);
          cursor: pointer;
        }
        .dm-profile__segmented button.is-active { background: var(--dm-ink); color: #fff; }
        .dm-profile__checks { display: flex; flex-wrap: wrap; gap: 8px 18px; }
        .dm-profile__check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--dm-ink);
          cursor: pointer;
        }
        .dm-profile__check input { width: 16px; height: 16px; }
        .dm-profile__savebar {
          position: sticky;
          bottom: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 10px 16px;
          padding: 12px 0 4px;
          background: linear-gradient(180deg, transparent, var(--dm-canvas) 30%);
        }
        .dm-profile__save { min-height: 44px !important; padding: 0 22px !important; font-size: 0.95rem !important; }
        .dm-profile__save:disabled { opacity: 0.55; cursor: not-allowed; }
        .dm-profile__notice {
          margin: 0;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          flex: 1 1 240px;
        }
        .dm-profile__notice--ok { background: var(--dm-success-soft); color: var(--dm-ink); }
        .dm-profile__notice--error { background: var(--dm-danger-soft, #fcebea); color: var(--dm-danger, #b42318); }
        .dm-profile__card .dm-profile__notice { margin-bottom: 12px; }
        .dm-profile__outline-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border: 1.5px solid var(--dm-steel);
          border-radius: 8px;
          background: transparent;
          color: var(--dm-ink);
          font: inherit;
          font-size: 0.85rem;
          font-weight: 650;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
        }
        .dm-profile__outline-btn:hover:not(:disabled) { background: var(--dm-steel-soft); }
        .dm-profile__outline-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .dm-profile__danger-btn {
          min-height: 38px;
          padding: 0 14px;
          border: 1.5px solid var(--dm-danger, #b42318);
          border-radius: 8px;
          background: transparent;
          color: var(--dm-danger, #b42318);
          font: inherit;
          font-size: 0.85rem;
          font-weight: 650;
          cursor: pointer;
          white-space: nowrap;
        }
        .dm-profile__danger-btn:hover:not(:disabled) { background: rgba(180, 35, 24, 0.08); }
        .dm-profile__danger-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .dm-profile__vault-form {
          display: grid;
          gap: 12px;
          padding: 14px;
          margin-bottom: 16px;
          border-radius: 12px;
          border: 1px solid var(--dm-slate-200);
          background: var(--dm-canvas);
        }
        .dm-profile__vault-form .dm-profile__fields { gap: 12px; }
        .dm-profile__file {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 8px 10px;
          border: 1.5px dashed var(--dm-slate-200);
          border-radius: 10px;
          background: var(--dm-surface);
          cursor: pointer;
        }
        .dm-profile__file:hover { border-color: var(--dm-steel); background: var(--dm-steel-soft); }
        .dm-profile__file input[type="file"] {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        .dm-profile__file-btn {
          flex-shrink: 0;
          padding: 6px 12px;
          border-radius: 8px;
          background: var(--dm-ink);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 600;
          pointer-events: none;
        }
        .dm-profile__file-name {
          min-width: 0;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--dm-slate-600);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          pointer-events: none;
        }
        .dm-profile__file-name.is-selected { color: var(--dm-ink); font-weight: 600; }
        .dm-profile__vault-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .dm-profile__count { margin: 0 0 8px; font-size: 12px; font-weight: 650; color: var(--dm-slate-600); text-transform: uppercase; letter-spacing: 0.04em; }
        .dm-profile__docs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .dm-profile__doc {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px 16px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--dm-canvas);
          border: 1px solid var(--dm-slate-200);
        }
        .dm-profile__doc-main { display: grid; gap: 6px; min-width: 0; flex: 1 1 220px; }
        .dm-profile__doc-main strong { font-size: 14px; color: var(--dm-ink); }
        .dm-profile__doc-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--dm-slate-600); }
        .dm-profile__doc-name { overflow-wrap: anywhere; }
        .dm-profile__doc-badges { display: flex; flex-wrap: wrap; gap: 6px; }
        .dm-profile__badge {
          display: inline-block;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
        }
        .dm-profile__badge--ok { background: var(--dm-success-soft); color: var(--dm-success); }
        .dm-profile__badge--warn { background: var(--dm-warning-soft, #fff4e0); color: var(--dm-warning, #c47a00); }
        .dm-profile__badge--danger { background: var(--dm-danger-soft, #fcebea); color: var(--dm-danger, #b42318); }
        .dm-profile__badge--quiet { background: var(--dm-surface); border: 1px solid var(--dm-slate-200); color: var(--dm-slate-600); }
        .dm-profile__doc-actions { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }
        .dm-profile__doc-actions a { font-size: 13px; font-weight: 650; color: var(--dm-steel); text-decoration: none; }
        .dm-profile__doc-actions a:hover { text-decoration: underline; }
        .dm-profile__doc-actions button {
          background: none;
          border: none;
          padding: 0;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--dm-danger, #b42318);
          text-decoration: underline;
          cursor: pointer;
        }
        .dm-profile__doc-actions button:disabled { opacity: 0.5; cursor: wait; }
        .dm-profile__security-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px 16px;
          padding: 12px 0;
          border-top: 1px solid var(--dm-slate-200);
        }
        .dm-profile__security-row:first-of-type { border-top: none; padding-top: 0; }
        .dm-profile__security-row > div { flex: 1 1 240px; min-width: 0; }
        .dm-profile__security-row strong { display: block; margin-bottom: 2px; font-size: 14px; }
        @media (max-width: 1000px) {
          .dm-profile__grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .dm-profile__fields { grid-template-columns: 1fr; }
          .dm-profile__savebar { justify-content: stretch; }
          .dm-profile__save { width: 100%; }
        }
        @media (max-width: 480px) {
          .dm-profile { --dm-profile-gutter: 16px; }
          .dm-profile__card { padding: 16px; }
          .dm-profile__doc-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
