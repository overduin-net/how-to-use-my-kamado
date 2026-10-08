import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode: double-run effects would announce every cook twice.
createRoot(document.getElementById('root')!).render(<App />);
