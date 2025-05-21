import React from 'react';
import styles from './Spinner.module.scss';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string; // Allow custom color via style prop
  className?: string; // Allow custom classes
}

const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  color,
  className = '',
}) => {
  const spinnerClasses = `
    ${styles.spinner}
    ${styles[size]}
    ${className}
  `;

  const spinnerStyle = color ? { borderColor: `${color} transparent transparent transparent` } : {};
  // The border-color trick makes 3 sides transparent and one colored to create the spinning effect.
  // For a single color spinner, you'd typically set border-top-color or similar,
  // but this example uses borderColor which will be overridden by specific border-X-color in CSS if needed.
  // A more common approach for single color is to set border-top-color. Let's adjust for that.
  
  const finalStyle = color ? { borderTopColor: color } : {};


  return (
    <div className={styles.spinnerWrapper}>
      <div
        className={spinnerClasses.trim()}
        style={finalStyle}
        role="status" // Accessibility: indicates a status message
        aria-live="polite" // Or "assertive" depending on importance
      >
        <span className={styles.visuallyHidden}>Loading...</span>
      </div>
    </div>
  );
};

export default Spinner;
