import React, { ReactNode, useState, useRef } from 'react';
import styles from './Tooltip.module.scss';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string; // Allow custom classes for the tooltip itself
  wrapperClassName?: string; // Allow custom classes for the wrapper element
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
  wrapperClassName = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false); // For keyboard focus
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(true);
  };

  const hideTooltip = (delay: number = 100) => { // Add a small delay to allow moving mouse from child to tooltip
    timeoutRef.current = setTimeout(() => {
      if (!isFocused) { // Don't hide if child is focused
        setIsVisible(false);
      }
    }, delay);
  };
  
  const handleFocus = () => {
    setIsFocused(true);
    showTooltip();
  };

  const handleBlur = () => {
    setIsFocused(false);
    hideTooltip(0); // Hide immediately on blur if not hovered
  };


  const tooltipClasses = `
    ${styles.tooltipContent}
    ${styles[position]}
    ${isVisible ? styles.visible : styles.hidden}
    ${className}
  `;

  const wrapperClasses = `
    ${styles.tooltipWrapper}
    ${wrapperClassName}
  `;

  return (
    <div
      className={wrapperClasses.trim()}
      onMouseEnter={showTooltip}
      onMouseLeave={() => hideTooltip()}
      onFocus={handleFocus} // Show on focus for accessibility
      onBlur={handleBlur}   // Hide on blur
      tabIndex={0} // Make the wrapper focusable
    >
      {children}
      {isVisible && (
        <div
          className={tooltipClasses.trim()}
          role="tooltip"
          // Allow mouse over tooltip content without hiding immediately
          onMouseEnter={showTooltip} 
          onMouseLeave={() => hideTooltip(100)}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
