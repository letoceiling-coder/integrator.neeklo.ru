import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CopilotPageContext {
  page: string;
  title?: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  hints?: string[];
}

interface CopilotContextValue {
  context: CopilotPageContext;
  setContext: (ctx: Partial<CopilotPageContext>) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [context, setCtx] = useState<CopilotPageContext>({ page: 'home', summary: 'NEEKLO Professional Workspace' });
  const [collapsed, setCollapsed] = useState(false);

  const value = useMemo(
    () => ({
      context,
      setContext: (patch: Partial<CopilotPageContext>) => setCtx((c) => ({ ...c, ...patch })),
      collapsed,
      setCollapsed,
    }),
    [context, collapsed],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
}

export function useCopilotPage(page: string, patch: Omit<CopilotPageContext, 'page'>) {
  const { setContext } = useCopilot();
  useEffect(() => {
    setContext({ page, ...patch });
  }, [page, patch.title, patch.entityId, patch.summary, setContext]);
}
