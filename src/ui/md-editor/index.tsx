import {createRoot} from 'react-dom/client';
import {App} from './MdEditor';
import {getEmptyHtml} from '../html';
import '../globals.scss';

const container = document.getElementById('md-editor');

if (container) {
    createRoot(container).render(<App />);
} else {
    document.body.innerHTML = getEmptyHtml();
}
