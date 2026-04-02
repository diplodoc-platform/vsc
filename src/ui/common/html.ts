import * as vscode from 'vscode';

export function getBaseHtml(
    id: string,
    scriptUri: vscode.Uri,
    styleUri: vscode.Uri,
    cspSource: string,
    lang: string = 'en'
): string {
    return `
        <!DOCTYPE html>
        <html lang="${lang}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy"
                    content="default-src 'none';
                        style-src ${cspSource} 'unsafe-inline';
                        script-src ${cspSource} 'unsafe-eval';
                        img-src ${cspSource} data: https: blob:;
                        font-src ${cspSource} data:;
                        worker-src blob:;">
                <link rel="stylesheet" href="${styleUri}">
                <style>
                    html, body, #root {
                        margin: 0;
                        padding: 0;
                        height: 100%;
                        width: 100%;
                    }
                </style>
            </head>
            <body>
                <div id=${id}></div>
                <script src="${scriptUri}"></script>
            </body>
        </html>
    `;
}
