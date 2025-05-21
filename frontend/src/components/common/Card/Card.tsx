import React, { ReactNode } from 'react';
import styles from './Card.module.scss';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  headerContent?: ReactNode; // Optional: For custom content in header (e.g., buttons)
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  className = '',
  headerContent,
}) => {
  const cardClasses = `
    ${styles.card}
    ${className}
  `;

  return (
    <div className={cardClasses.trim()}>
      {(title || headerContent) && (
        <div className={styles.cardHeader}>
          {title && <h3 className={styles.cardTitle}>{title}</h3>}
          {headerContent && <div className={styles.cardHeaderContent}>{headerContent}</div>}
        </div>
      )}
      <div className={styles.cardBody}>
        {children}
      </div>
    </div>
  );
};

export default Card;
