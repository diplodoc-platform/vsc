import {createRoot} from 'react-dom/client';
import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';
import '@gravity-ui/markdown-editor/styles/styles.css';

import '../globals.scss';
import {getEmptyHtml} from '../html';

import {App} from './Sidebar/Sidebar';

const container = document.getElementById('sidebar');

if (container) {
    createRoot(container).render(<App />);
} else {
    document.body.innerHTML = getEmptyHtml();
}
