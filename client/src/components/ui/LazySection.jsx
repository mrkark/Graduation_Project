import { useState, useEffect, useRef } from 'react';

/**
 * LazySection — компонент оптимизации загрузки страниц («1-й экран»).
 * 
 * На первом экране загружается только то, что пользователь видит немедленно.
 * Контент ниже первого экрана (below-the-fold) не монтируется и не грузит сеть/CPU,
 * пока пользователь не приблизится к нему при скролле (с упреждающим rootMargin: 250px)
 * или когда браузер освободится в idle-таймауте.
 * 
 * Сохраняет minHeight во избежание скачков разметки (CLS = 0).
 */
export default function LazySection({
  children,
  minHeight = '280px',
  rootMargin = '250px',
  className = '',
  id,
  style = {},
  priority = false, // если true — монтируется сразу (для первого экрана)
  idleFallback = true, // догрузить в периоды простоя, даже если пользователь не доскроллил
}) {
  const [isRendered, setIsRendered] = useState(priority);
  const containerRef = useRef(null);

  useEffect(() => {
    if (priority || isRendered) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsRendered(true);
      return;
    }

    let observer = null;
    let idleId = null;
    let timerId = null;

    observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsRendered(true);
          if (observer) observer.disconnect();
          if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
          if (timerId) clearTimeout(timerId);
        }
      },
      { rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Фоновая догрузка при простое браузера (idle callback)
    if (idleFallback) {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(
          () => {
            setIsRendered(true);
            if (observer) observer.disconnect();
          },
          { timeout: 3500 }
        );
      } else {
        timerId = setTimeout(() => {
          setIsRendered(true);
          if (observer) observer.disconnect();
        }, 2500);
      }
    }

    return () => {
      if (observer) observer.disconnect();
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timerId) clearTimeout(timerId);
    };
  }, [priority, isRendered, rootMargin, idleFallback]);

  if (isRendered) {
    return (
      <div id={id} className={`lazy-section lazy-section--visible ${className}`} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id={id}
      className={`lazy-section lazy-section--placeholder ${className}`}
      style={{
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      aria-busy="true"
    >
      <div className="lazy-section__shimmer" aria-hidden="true" />
    </div>
  );
}
