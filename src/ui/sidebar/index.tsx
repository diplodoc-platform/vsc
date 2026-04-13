import {createRoot} from 'react-dom/client';
import {App} from './Sidebar/Sidebar';
import {getEmptyHtml} from '../html';
import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import '../globals.scss';

const container = document.getElementById('sidebar');

if (container) {
    createRoot(container).render(<App />);
} else {
    document.body.innerHTML = getEmptyHtml();
}
