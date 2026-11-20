Kostentracker.module({
    id: "js/ui/tab-wischen-animation.js",
    dependencies: ["prepareTabSwipeTargets"],
    session: [],
    read: [],
    write: [],
    replace: false
}, (context, dependencies) => {
    "use strict";

    const viewIds = ["home", "uebersichtView", "statistikView", "reisen", "travelOverviewView"];
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const activeView = () => viewIds.map(id => document.getElementById(id))
        .find(view => view && !view.classList.contains("hidden"));

    let overlay = null;
    let shadow = null;
    let tabSlide = null;
    let warmedTabs = null;
    let prepareFrame = 0;
    let prepareIdle = null;
    let touching = false;

    function ensureOverlay() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.inert = true;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:hidden;pointer-events:none;display:none;';
        shadow = overlay.attachShadow({mode:'closed'});
        const style = document.createElement('style');
        // Same-origin external stylesheets are loaded before this classic script executes.
        const sheetRules = Array.from(document.styleSheets || []).flatMap(sheet => {
            try { return Array.from(sheet.cssRules || []).map(rule => rule.cssText); }
            catch (_) { return []; }
        });
        style.textContent = (sheetRules.length ? sheetRules.join('\n') : [...document.querySelectorAll('style')].map(el => el.textContent).join('\n')).replace(/:root\[data-theme="(light|dark)"\]/g, ':host([data-theme="$1"])')
            .replace(/:root/g, ':host').replace(/\bbody\b/g, '.tab-slide-content').replace(/\bhtml\b/g, '.tab-slide-content') + `
            :host, :host * { pointer-events:none !important; }
            :host { font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",sans-serif; }
            .tab-slide-layer { position:absolute; inset:0; overflow:hidden; background:var(--bg); will-change:transform; contain:paint; }
            .tab-slide-content * { backdrop-filter:none !important; -webkit-backdrop-filter:none !important; animation:none !important; transition:none !important; }
            .tab-slide-content { position:absolute; left:0; width:100%; margin:0; box-sizing:border-box; }
            `;
        shadow.appendChild(style);
        const symbols = document.querySelector('.alltag-symbols');
        if (symbols) shadow.appendChild(symbols.cloneNode(true));
        document.body.appendChild(overlay);
    }

    function snapshot(view) {
        const copy = view.cloneNode(true);
        copy.classList.remove('hidden');
        // cloneNode copies attributes; live field values and canvas pixels need copying.
        const originalFields = view.querySelectorAll('input,textarea,select');
        copy.querySelectorAll('input,textarea,select').forEach((el,i) => {
            const original = originalFields[i];
            if (!original) return;
            if (el.type !== 'file') el.value = original.value;
            if ('checked' in el) el.checked = original.checked;
        });
        const canvases = view.querySelectorAll('canvas');
        copy.querySelectorAll('canvas').forEach((el,i) => {
            try { el.getContext('2d')?.drawImage(canvases[i],0,0); } catch (_) {}
        });
        return copy;
    }

    function syncPreviewTheme() {
        overlay.dataset.theme = document.documentElement.dataset.theme;
        const theme = getComputedStyle(document.documentElement);
        for (let i = 0; i < theme.length; i++) {
            const key = theme[i];
            if (key.startsWith('--')) overlay.style.setProperty(key, theme.getPropertyValue(key));
        }
    }

    function layer(node) {
        const page = document.createElement("div");
        page.className = "tab-slide-layer";
        const content = document.createElement("div");
        content.className = "tab-slide-content";
        content.style.top = "0";
        content.appendChild(node);
        page.appendChild(content);
        return page;
    }

    function cancelPreparation() {
        cancelAnimationFrame(prepareFrame);
        prepareFrame = 0;
        if (prepareIdle === null) return;
        if (window.requestIdleCallback && window.cancelIdleCallback) window.cancelIdleCallback(prepareIdle);
        else clearTimeout(prepareIdle);
        prepareIdle = null;
    }

    function schedulePreparation() {
        if (prepareFrame || prepareIdle !== null || touching || tabSlide || document.hidden || reducedMotion?.matches) return;
        prepareFrame = requestAnimationFrame(() => {
            prepareFrame = 0;
            const prepare = () => {
                prepareIdle = null;
                if (!touching && !tabSlide && !document.hidden) prepareTabLayers(activeView());
            };
            prepareIdle = window.requestIdleCallback
                ? window.requestIdleCallback(prepare, {timeout: 350})
                : setTimeout(prepare, 65);
        });
    }

    function prepareTabLayers(view) {
        if (!view || reducedMotion?.matches || warmedTabs?.view === view) return;
        const targets = dependencies.prepareTabSwipeTargets?.(view) || [];
        if (!targets.length) return;
        ensureOverlay();
        syncPreviewTheme();
        const current = layer(snapshot(view));
        const adjacent = new Map(targets.map(target => [target, layer(snapshot(target))]));
        warmedTabs = {view, current, adjacent};
    }

    function clearTabSlide() {
        const slide = tabSlide;
        if (!slide) return;
        tabSlide = null;
        cancelAnimationFrame(slide.frame);
        clearTimeout(slide.timer);
        slide.current.remove();
        slide.next.remove();
        overlay.style.bottom = '';
        slide.nav.style.zIndex = slide.navZIndex;
        overlay.style.display = "none";
        schedulePreparation();
    }

    function beginTabSlide(view, target, direction, prepareTarget) {
        if (tabSlide || reducedMotion?.matches) return false;
        const nav = document.getElementById('categoryBottomNav');
        if (!nav || nav.classList.contains('hidden')) return false;
        cancelPreparation();
        ensureOverlay();
        const width = window.innerWidth;
        const scroll = window.scrollY;
        const bottom = Math.max(0, window.innerHeight - nav.getBoundingClientRect().top);
        const prepared = warmedTabs?.view === view ? warmedTabs : null;
        warmedTabs = null;
        let current = prepared?.current;
        let next = prepared?.adjacent.get(target);
        if (!current || !next) {
            syncPreviewTheme();
            if (!next) {
                prepareTarget?.();
                next = layer(snapshot(target));
            }
            current ??= layer(snapshot(view));
        }
        current.firstElementChild.style.top = -scroll + 'px';
        shadow.appendChild(current);
        shadow.appendChild(next);
        const navZIndex = nav.style.zIndex;
        nav.style.zIndex = '10001';
        overlay.style.bottom = bottom + 'px';
        tabSlide = {current, next, width, direction, nav, navZIndex, distance:0, frame:0, timer:0, finishing:false, navigating:false};
        paintTabSlide(tabSlide);
        overlay.style.display = 'block';
        return true;
    }

    function paintTabSlide(slide) {
        const offset = slide.distance * slide.direction;
        slide.current.style.transform = `translate3d(${offset}px,0,0)`;
        slide.next.style.transform = `translate3d(${offset - slide.direction * slide.width}px,0,0)`;
    }

    function moveTabSlide(dx) {
        const slide = tabSlide;
        if (!slide || slide.finishing) return;
        slide.distance = Math.min(slide.width, Math.max(0, dx * slide.direction));
        if (!slide.frame) slide.frame = requestAnimationFrame(() => {
            slide.frame = 0;
            paintTabSlide(slide);
        });
    }

    function finishTabSlide(onCommit) {
        const slide = tabSlide;
        if (!slide || slide.finishing) return;
        slide.finishing = true;
        cancelAnimationFrame(slide.frame);
        paintTabSlide(slide);
        slide.current.getBoundingClientRect();
        const remaining = Math.abs((onCommit ? slide.width : 0) - slide.distance);
        const duration = Math.round(120 + 105 * remaining / slide.width);
        slide.current.style.transition = slide.next.style.transition = `transform ${duration}ms cubic-bezier(.2,.7,.25,1)`;
        slide.distance = onCommit ? slide.width : 0;
        paintTabSlide(slide);

        const complete = () => {
            if (tabSlide !== slide || slide.navigating) return;
            clearTimeout(slide.timer);
            if (!onCommit) { clearTabSlide(); return; }
            slide.navigating = true;
            try { onCommit(); }
            finally {
                slide.frame = requestAnimationFrame(() => {
                    slide.frame = requestAnimationFrame(() => {
                        if (tabSlide === slide) clearTabSlide();
                    });
                });
            }
        };
        slide.current.addEventListener('transitionend', event => {
            if (event.target === slide.current && event.propertyName === 'transform') complete();
        });
        slide.complete = complete;
        slide.timer = setTimeout(complete, duration + 50);
    }

    function invalidateTabLayers() {
        warmedTabs = null;
        schedulePreparation();
    }

    document.addEventListener("kostentracker:main-view-shown", () => {
        if (tabSlide && !tabSlide.navigating) clearTabSlide();
        invalidateTabLayers();
    });
    // Settle any previous tab slide before a new touch. Leave all touch
    // handling, including edge swipes, to the original event listeners.
    document.addEventListener("touchstart", () => {
        touching = true;
        cancelPreparation();
        tabSlide?.complete?.();
        clearTabSlide();
    }, {capture: true, passive: true});
    function endTouch(event) {
        touching = event.touches.length > 0;
        schedulePreparation();
    }
    document.addEventListener("touchend", endTouch, {capture: true, passive: true});
    document.addEventListener("touchcancel", endTouch, {capture: true, passive: true});
    const observer = new MutationObserver(mutations => {
        const view = activeView();
        if (mutations.some(change => change.target === document.documentElement ||
            view?.contains(change.target))) invalidateTabLayers();
    });
    for (const id of viewIds) {
        const view = document.getElementById(id);
        if (view) observer.observe(view, {subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ["class", "value", "checked", "selected"]});
    }
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme", "style"]});
    document.addEventListener("kostentracker:travelModeChanged", invalidateTabLayers);
    document.addEventListener("input", invalidateTabLayers, true);
    window.addEventListener("resize", () => {
        clearTabSlide();
        invalidateTabLayers();
    });
    function suspend() {
        touching = false;
        warmedTabs = null;
        clearTabSlide();
        cancelPreparation();
    }
    window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) suspend();
        else schedulePreparation();
    });

    schedulePreparation();
    return {beginTabSlide, moveTabSlide, finishTabSlide};
});
