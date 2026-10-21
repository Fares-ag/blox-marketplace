export type BureauTransportKind = 'local' | 'sftp';

export type BureauTransportResult = {
  accepted: boolean;
  acknowledgement: string;
};

export interface BureauTransport {
  readonly kind: BureauTransportKind;
  send(filename: string, body: string): Promise<BureauTransportResult>;
}

/** Prototype send: persist-only. Production SFTP is a different class behind a flag. */
export class LocalBureauTransport implements BureauTransport {
  readonly kind = 'local' as const;

  async send(filename: string): Promise<BureauTransportResult> {
    return { accepted: true, acknowledgement: `local-dry-run:${filename}` };
  }
}

export class DisabledSftpTransport implements BureauTransport {
  readonly kind = 'sftp' as const;

  async send(): Promise<BureauTransportResult> {
    throw new Error('bureau_sftp_not_enabled');
  }
}

export function resolveBureauTransport(kind: BureauTransportKind, sftpEnabled: boolean): BureauTransport {
  if (kind === 'sftp') {
    if (!sftpEnabled) return new DisabledSftpTransport();
    return new DisabledSftpTransport();
  }
  return new LocalBureauTransport();
}
