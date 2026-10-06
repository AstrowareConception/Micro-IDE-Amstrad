import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Icon.tsx';

export function AgentSettingsDialog({ children, onClose }: { children: ReactNode; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { if (element?.open) element.close(); }; }, []);
  return <dialog ref={dialog} className="command-dialog settings-dialog agent-settings" aria-label="Réglages de l’agent IA" onClose={onClose}>
    <h2>Réglages de l’agent IA</h2>
    {children}
    <div className="settings-actions"><Button icon="close" onClick={() => dialog.current?.close()}>Fermer les réglages IA</Button></div>
  </dialog>;
}
