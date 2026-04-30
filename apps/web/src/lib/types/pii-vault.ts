export type EncryptedAtom = {
  alg: "AES-256-GCM";
  ivB64: string;
  ctB64: string;
  tagB64: string;
};

export type DealPartyPiiVault = {
  v: 1;
  kmsKeyId: string;
  fields: {
    taxIdentifier?: EncryptedAtom;
    bankAccount?: EncryptedAtom;
    bankRouting?: EncryptedAtom;
    /** Driver license / government ID number (DOI context). */
    governmentId?: EncryptedAtom;
  };
};
