/* Zentrale Dienste der Testversion. Kein Build, keine externen Abhängigkeiten.
 * Datenformat und Schlüssel bleiben unverändert. Module erhalten begrenzte Ports.
 */
(() => {
    "use strict";
    const STORAGE_KEY = "kostenApp_test";
    let currentData;
    let lastSaved;
    const uiSession = Object.create(null);
    const exportsByName = new Map();
    const moduleIds = new Set();
    const proxyToRaw = new WeakMap();
    const object = value => value !== null && typeof value === "object";

    // Keine Proxies in gespeicherten Daten oder Snapshots zurücklassen. Identitäten
    // innerhalb des Arbeitszustands bleiben wie in der bisherigen App erhalten.
    function unwrap(value, seen = new WeakSet()) {
        if (!object(value)) return value;
        if (proxyToRaw.has(value)) return proxyToRaw.get(value);
        if (seen.has(value)) return value;
        seen.add(value);
        for (const key of Object.keys(value)) value[key] = unwrap(value[key], seen);
        return value;
    }
    function clone(value) {
        return structuredClone(unwrap(value));
    }
    const storage = Object.freeze({
        key: STORAGE_KEY,
        get lastSaved() { return lastSaved; },
        set lastSaved(value) { lastSaved = value; },
        getItem(key = STORAGE_KEY) {
            if (key !== STORAGE_KEY) throw new Error("Falscher Datenspeicher");
            return localStorage.getItem(STORAGE_KEY);
        },
        setItem(key, serialized) {
            if (key !== STORAGE_KEY) throw new Error("Falscher Datenspeicher");
            localStorage.setItem(STORAGE_KEY, serialized);
        }
    });

    function repository(spec) {
        const canRead = new Set([...spec.read, ...spec.write]);
        const canWrite = new Set(spec.write);
        const cached = new WeakMap();
        const permitted = (set, key) => set.has("*") || set.has(key);
        function wrap(value, area = null) {
            if (!object(value)) return value;
            let perArea = cached.get(value);
            if (!perArea) cached.set(value, perArea = new Map());
            if (perArea.has(area)) return perArea.get(area);
            const checkWrite = key => {
                const targetArea = area === null ? key : area;
                if (!permitted(canWrite, targetArea)) {
                    throw new Error(`${spec.id}: Schreibzugriff auf ${String(targetArea)} nicht erlaubt`);
                }
            };
            const proxy = new Proxy(value, {
                get(target, key, receiver) {
                    if (area === null && typeof key === "string" && key !== "toJSON" &&
                        Object.hasOwn(target, key) && !permitted(canRead, key)) {
                        throw new Error(`${spec.id}: Lesezugriff auf ${key} nicht erlaubt`);
                    }
                    return wrap(Reflect.get(target, key, receiver), area === null ? key : area);
                },
                set(target, key, next) {
                    checkWrite(key);
                    return Reflect.set(target, key, unwrap(next));
                },
                deleteProperty(target, key) {
                    checkWrite(key);
                    return Reflect.deleteProperty(target, key);
                },
                defineProperty(target, key, descriptor) {
                    checkWrite(key);
                    if ("value" in descriptor) descriptor.value = unwrap(descriptor.value);
                    return Reflect.defineProperty(target, key, descriptor);
                },
                setPrototypeOf() { throw new Error("Datenprototyp darf nicht geändert werden"); }
            });
            perArea.set(area, proxy);
            proxyToRaw.set(proxy, value);
            return proxy;
        }
        return Object.freeze({
            get view() { return wrap(currentData); },
            set view(value) {
                if (!spec.replace) throw new Error(`${spec.id}: Gesamtdaten dürfen nicht ersetzt werden`);
                currentData = unwrap(value);
            }
        });
    }
    function sessionPort(keys) {
        const port = {};
        for (const key of keys) Object.defineProperty(port, key, {
            enumerable: true,
            get: () => uiSession[key],
            set: value => { uiSession[key] = value; }
        });
        return Object.freeze(port);
    }
    function module(spec, factory) {
        if (moduleIds.has(spec.id)) throw new Error("Doppeltes Modul: " + spec.id);
        moduleIds.add(spec.id);
        const dependencies = {};
        for (const name of spec.dependencies) Object.defineProperty(dependencies, name, {
            enumerable: true,
            get: () => exportsByName.get(name)
        });
        Object.freeze(dependencies);
        const context = Object.freeze({
            repository: repository(spec),
            session: sessionPort(spec.session),
            storage: ["js/core/dateninitialisierung.js", "js/core/speicherung-backup.js", "js/app/start.js", "js/server/synchronisierung.js"].includes(spec.id) ? storage : undefined,
            clone
        });
        const api = factory(context, dependencies);
        for (const [name, fn] of Object.entries(api)) {
            if (exportsByName.has(name)) throw new Error("Doppelte Schnittstelle: " + name);
            if (typeof fn !== "function") throw new Error("Ungültige Schnittstelle: " + name);
            exportsByName.set(name, fn);
            // Ausschließlich Kompatibilität für bestehende inline HTML-Handler.
            // Module rufen diese Globals nicht auf; sie benutzen dependencies.
            Object.defineProperty(window, name, { configurable: true, value: fn, writable: true });
        }
    }
    Object.defineProperty(window, "Kostentracker", {
        value: Object.freeze({ module, storage: Object.freeze({key: STORAGE_KEY}) }),
        writable: false, configurable: false
    });
})();
