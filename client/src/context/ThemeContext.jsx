import { createContext, useContext } from 'react';

// Приложение по умолчанию — тёмная тема (по ТЗ); контекст оставлен как точка
// расширения, если в будущем понадобится светлая/альтернативная тема.
const ThemeContext = createContext({ theme: 'dark' });

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={{ theme: 'dark' }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
