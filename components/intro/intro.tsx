'use client';

import { useEffect, useState } from 'react';
import Logo from '../logo/logo';
import styles from './intro.module.css';

export default function Intro() {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 700);
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  if (!shouldRender) return null;

  return (
    <div className={`${styles.introOverlay} ${isVisible ? styles.visible : styles.hidden}`}>
      <div className={styles.bgGlow} />
      <div className={styles.content}>
        <div className={styles.logoBox}>
          <Logo />
        </div>
        <div className={styles.wordmark}>
          <span className={styles.title}>Chords</span>
          <span className={styles.tag}>midi runner</span>
        </div>
        <div className={styles.loader}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
