import React, { ReactNode } from 'react';
import styles from './Badge.module.scss';

interface BadgeProps {
  children: ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info'; // Added info
  variant?: 'filled' | 'outlined';
  className?: string; // Allow custom classes
}

const Badge: React.FC<BadgeProps> = ({
  children,
  color = 'primary',
  variant = 'filled',
  className = '',
}) => {
  const badgeClasses = `
    ${styles.badge}
    ${styles[color]}
    ${styles[variant]}
    ${className}
  `;

  return (
    <span className={badgeClasses.trim()}>
      {children}
    </span>
  );
};

export default Badge;
