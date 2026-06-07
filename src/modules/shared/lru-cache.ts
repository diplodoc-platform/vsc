export class LruCache<K, V> {
    private readonly _map = new Map<K, V>();
    private readonly _maxSize: number;

    constructor(maxSize: number) {
        this._maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this._map.get(key);

        if (value === undefined && !this._map.has(key)) {
            return undefined;
        }

        this._map.delete(key);
        this._map.set(key, value as V);

        return value;
    }

    has(key: K): boolean {
        return this._map.has(key);
    }

    set(key: K, value: V): void {
        if (this._map.has(key)) {
            this._map.delete(key);
        } else if (this._map.size >= this._maxSize) {
            const oldest = this._map.keys().next().value;

            if (oldest !== undefined) {
                this._map.delete(oldest);
            }
        }

        this._map.set(key, value);
    }

    delete(key: K): void {
        this._map.delete(key);
    }

    clear(): void {
        this._map.clear();
    }

    get size(): number {
        return this._map.size;
    }
}
