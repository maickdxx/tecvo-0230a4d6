import { useState, useCallback, useRef } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { isOrgDocumentReady } from "@/lib/isOrgDocumentReady";

/**
 * Hook that gates document emission behind org data completion.
 * Usage:
 *   const { guardAction, modalOpen, closeModal, onDataSaved } = useDocumentGuard();
 *   // Instead of calling handleDownloadPDF() directly:
 *   guardAction(handleDownloadPDF);
 */
export function useDocumentGuard() {
  const { organization } = useOrganization();
  const [modalOpen, setModalOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const guardAction = useCallback(
    (action: () => void) => {
      const check = isOrgDocumentReady(organization);
      if (check.ready) {
        action();
      } else {
        pendingAction.current = action;
        setModalOpen(true);
      }
    },
    [organization]
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    pendingAction.current = null;
  }, []);

  const onDataSaved = useCallback(() => {
    setModalOpen(false);
    // Execute the pending action after a short delay for state to propagate
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) {
      setTimeout(action, 300);
    }
  }, []);

  return { guardAction, modalOpen, closeModal, onDataSaved };
}
