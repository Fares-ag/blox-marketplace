import type { ReactNode } from 'react';
import { DocumentMeta } from '@drivemarket/shared';
import { MarketplaceNav } from './MarketplaceNav';
import { CustomerAccountNav } from './CustomerAccountNav';

type CustomerPortalLayoutProps = {
  metaTitle?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  headerExtra?: ReactNode;
  hideSubNav?: boolean;
  bodyClassName?: string;
  contentClassName?: string;
  contentMax?: 'default' | 'narrow' | 'wide';
  children: ReactNode;
};

export function CustomerPortalLayout({
  metaTitle,
  eyebrow,
  title,
  lead,
  headerExtra,
  hideSubNav = false,
  bodyClassName,
  contentClassName,
  contentMax = 'default',
  children,
}: CustomerPortalLayoutProps) {
  const contentMaxClass =
    contentMax === 'narrow'
      ? 'dm-portal__inner--narrow'
      : contentMax === 'wide'
        ? 'dm-portal__inner--wide'
        : '';

  return (
    <div className="dm-portal">
      {metaTitle ? <DocumentMeta title={metaTitle} /> : null}
      <header className="dm-band dm-portal__head">
        <div className="dm-band__inner">
          <MarketplaceNav />
          {!hideSubNav ? <CustomerAccountNav /> : null}
          {eyebrow || title || lead ? (
            <div className="dm-portal__intro">
              {eyebrow ? <p className="dm-band__eyebrow">{eyebrow}</p> : null}
              {title ? <h1>{title}</h1> : null}
              {lead ? <p className="dm-band__lead">{lead}</p> : null}
            </div>
          ) : null}
          {headerExtra}
        </div>
      </header>
      <main className={['dm-portal__body', bodyClassName].filter(Boolean).join(' ')}>
        <div className={['dm-portal__inner', contentMaxClass, contentClassName].filter(Boolean).join(' ')}>
          {children}
        </div>
      </main>
    </div>
  );
}
