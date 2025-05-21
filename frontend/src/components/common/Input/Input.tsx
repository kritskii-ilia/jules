import React, { ChangeEvent } from 'react';
import styles from './Input.module.scss';

interface InputProps {
  value: string | number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'password' | 'number' | 'email';
  placeholder?: string;
  disabled?: boolean;
  error?: string | boolean; // Can be a message string or just true
  label?: string;
  name?: string; // Useful for forms
  className?: string; // Allow custom classes
}

const Input: React.FC<InputProps> = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  error,
  label,
  name,
  className = '',
}) => {
  const inputWrapperClasses = `
    ${styles.inputWrapper}
    ${className}
  `;

  const inputClasses = `
    ${styles.input}
    ${error ? styles.errorInput : ''}
  `;

  return (
    <div className={inputWrapperClasses.trim()}>
      {label && <label htmlFor={name || placeholder} className={styles.label}>{label}</label>}
      <input
        type={type}
        name={name}
        id={name || placeholder} // Link label to input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses.trim()}
        aria-invalid={!!error} // Accessibility for error state
        aria-describedby={error && typeof error === 'string' ? `${name || placeholder}-error` : undefined}
      />
      {error && typeof error === 'string' && (
        <p id={`${name || placeholder}-error`} className={styles.errorMessage} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
