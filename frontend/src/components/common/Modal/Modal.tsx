import React, { ReactNode, useEffect } from 'react';
import styles from './Modal.module.scss';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string; // Allow custom classes for the modal content
  overlayClassName?: string; // Allow custom classes for the overlay
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  className = '',
  overlayClassName = '',
}) => {
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'auto'; // Restore background scrolling
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const modalOverlayClasses = `
    ${styles.modalOverlay}
    ${overlayClassName}
  `;

  const modalContentClasses = `
    ${styles.modalContent}
    ${className}
  `;

  return (
    <div
      className={modalOverlayClasses.trim()}
      onClick={onClose} // Close if overlay is clicked
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={modalContentClasses.trim()}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside content
      >
        <div className={styles.modalHeader}>
          {title && <h2 id="modal-title" className={styles.modalTitle}>{title}</h2>}
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            &times; {/* Simple 'X' character for close */}
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
