import React, { useState, ReactNode } from 'react';
import styles from './Tabs.module.scss';

export interface TabItem {
  label: string;
  content: ReactNode;
  key: string;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  defaultActiveKey?: string;
  onTabChange?: (activeKey: string) => void; // Callback for when tab changes
  className?: string; // Custom class for the Tabs container
  navClassName?: string; // Custom class for the tab navigation area
  contentClassName?: string; // Custom class for the tab content area
}

const Tabs: React.FC<TabsProps> = ({
  items,
  defaultActiveKey,
  onTabChange,
  className = '',
  navClassName = '',
  contentClassName = '',
}) => {
  const [activeKey, setActiveKey] = useState<string>(() => {
    if (defaultActiveKey) return defaultActiveKey;
    return items.length > 0 ? items[0].key : '';
  });

  const handleTabClick = (key: string, isDisabled?: boolean) => {
    if (isDisabled) return;
    if (key !== activeKey) {
      setActiveKey(key);
      if (onTabChange) {
        onTabChange(key);
      }
    }
  };

  const tabsContainerClasses = `
    ${styles.tabsContainer}
    ${className}
  `;

  const tabNavClasses = `
    ${styles.tabNav}
    ${navClassName}
  `;

  const tabContentClasses = `
    ${styles.tabContent}
    ${contentClassName}
  `;

  return (
    <div className={tabsContainerClasses.trim()}>
      <div className={tabNavClasses.trim()} role="tablist">
        {items.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={activeKey === item.key}
            aria-controls={`tabpanel-${item.key}`}
            id={`tab-${item.key}`}
            onClick={() => handleTabClick(item.key, item.disabled)}
            className={`
              ${styles.tabNavItem}
              ${activeKey === item.key ? styles.active : ''}
              ${item.disabled ? styles.disabled : ''}
            `}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={tabContentClasses.trim()}>
        {items.map((item) => (
          <div
            key={item.key}
            id={`tabpanel-${item.key}`}
            role="tabpanel"
            aria-labelledby={`tab-${item.key}`}
            className={`
              ${styles.tabPane}
              ${activeKey === item.key ? styles.activePane : styles.hiddenPane}
            `}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
