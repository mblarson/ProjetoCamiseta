
import React from 'react';
import { Modal, Button } from './UI';
import { handlePdfOutput } from '../services/pdfService';

interface PdfActionModalProps {
  pdfData: { doc: any, filename: string } | null;
  onClose: () => void;
}

export const PdfActionModal: React.FC<PdfActionModalProps> = ({ pdfData, onClose }) => {
  if (!pdfData) return null;

  const handleAction = async (action: 'view' | 'share') => {
    await handlePdfOutput(pdfData.doc, pdfData.filename, action);
    onClose();
  };

  return (
    <Modal isOpen={!!pdfData} onClose={onClose} title="Opções do PDF">
      <div className="flex flex-col gap-4 py-4">
        <Button onClick={() => handleAction('view')} className="h-16 text-base w-full">
          <i className="fas fa-eye mr-2"></i> VISUALIZAR PDF
        </Button>
        <Button variant="outline" onClick={() => handleAction('share')} className="h-16 text-base w-full">
          <i className="fas fa-share-nodes mr-2"></i> COMPARTILHAR PDF
        </Button>
      </div>
    </Modal>
  );
};
