import {createRoot} from 'react-dom/client';
import {Sidebar} from './Sidebar';
import '../globals.scss';

const container = document.getElementById('sidebar');

if (container) {
    createRoot(container).render(<Sidebar />);
} else {
    document.body.innerHTML = '<div style="padding:16px;color:red">root element not found</div>';
}
