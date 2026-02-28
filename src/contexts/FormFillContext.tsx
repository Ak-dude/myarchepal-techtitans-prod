import { createContext, useContext } from 'react';

export interface FormFillContextValue {
  siteId: string;
  submissionId: string;
  orgId: string;
}

export const FormFillContext = createContext<FormFillContextValue | null>(null);

export function useFormFillContext(): FormFillContextValue {
  const ctx = useContext(FormFillContext);
  if (!ctx) throw new Error('useFormFillContext must be used inside FormFillContext.Provider');
  return ctx;
}
