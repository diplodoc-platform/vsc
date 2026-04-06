import {useEffect, useState} from 'react';


function detectTheme(): 'dark' | 'light' {
    const kind = document.body.getAttribute('data-vscode-theme-kind');

    if (kind === 'vscode-dark' || kind === 'vscode-high-contrast') {
        return 'dark';
    }

    return 'light';
}

export function useVscodeTheme(): 'dark' | 'light' {
    const [theme, setTheme] = useState<'dark' | 'light'>(detectTheme);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setTheme(detectTheme());
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-vscode-theme-kind'],
        });
        
        return () => observer.disconnect();
    }, []);

    return theme;
}
