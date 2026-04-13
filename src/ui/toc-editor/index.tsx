import {createRoot} from 'react-dom/client';
import {App} from './TocEditor';
import {getEmptyHtml} from '../html';
import '../globals.scss';

const container = document.getElementById('toc-editor');

if (container) {
    createRoot(container).render(<App />);
} else {
    document.body.innerHTML = getEmptyHtml();
}
