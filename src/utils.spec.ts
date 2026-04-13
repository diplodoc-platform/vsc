import {describe, expect, it} from 'vitest';

import {insertElement} from './utils';

describe('insertElement', () => {
    it('returns markdown table', () => {
        const result = insertElement('table');

        expect(result).toContain('| --- | --- |');
        expect(result.split('\n')).toHaveLength(3);
    });

    it('returns note block', () => {
        const result = insertElement('note');

        expect(result).toContain('{% note info');
        expect(result).toContain('{% endnote %}');
    });
});
