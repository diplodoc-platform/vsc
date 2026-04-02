import {createRoot} from 'react-dom/client';
import {App} from './MdEditor';
import '../globals.scss';

const container = document.getElementById('md-editor');

if (container) {
    createRoot(container).render(<App />);
} else {
    document.body.innerHTML = '<div style="padding:16px;color:red">root element not found</div>';
}
