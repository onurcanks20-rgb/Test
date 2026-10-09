
        // Interactive edge navigation. Visual copies live in a shadow root so
        // duplicate form IDs never affect the app's renderers or saved inputs.
        (() => {
            const viewIds = ['home','reisen','land','haushaltView','freizeitView','ausgabenArchivView','globalArchivView','geplanteAusgabenView','sparenInvestierenView','einnahmenView','kostenView','versicherungenView','uebersichtView','grafikView','settingsView','settingsBudgetView','settingsQuickAddView','settingsWarningsView','settingsDesignView','settingsGesturesView','settingsBackupView'];
            const cache = new Map();
            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
            const overlay = document.createElement('div');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.inert = true;
            overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;overflow:hidden;pointer-events:none;display:none;';
            const shadow = overlay.attachShadow({mode:'closed'});
            const style = document.createElement('style');
            // Same-origin external stylesheets are loaded before this classic script executes.
            const sheetRules = Array.from(document.styleSheets || []).flatMap(sheet => {
                try { return Array.from(sheet.cssRules || []).map(rule => rule.cssText); }
                catch (_) { return []; }
            });
            style.textContent = (sheetRules.length ? sheetRules.join('\n') : [...document.querySelectorAll('style')].map(el => el.textContent).join('\n')).replace(/:root\[data-theme="(light|dark)"\]/g, ':host([data-theme="$1"])')
                .replace(/:root/g, ':host').replace(/\bbody\b/g, '.edge-page-content').replace(/\bhtml\b/g, '.edge-page-content') + `
                :host { font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",sans-serif; }
                .edge-back-layer { position:absolute; inset:0; overflow:hidden; background:var(--bg); will-change:transform; contain:paint; }
                .edge-page-content * { backdrop-filter:none !important; -webkit-backdrop-filter:none !important; animation:none !important; transition:none !important; }
                .edge-back-front { box-shadow:-8px 0 24px rgba(0,0,0,.18); }
                .edge-page-content { position:absolute; left:0; width:100%; margin:0; box-sizing:border-box; }
                .edge-back-shade { position:absolute; inset:0; background:#000; pointer-events:none; will-change:opacity; }
                `;
            shadow.appendChild(style);
            document.body.appendChild(overlay);
            let gesture = null;
            let frame = 0;
            let cleanupTimer = 0;
            let suppressClickUntil = 0;
            let warmed = null;
            let prepareFrame = 0;
            let prepareIdle = 0;
            const activeView = () => viewIds.map(id => document.getElementById(id)).find(el => el && !el.classList.contains('hidden'));

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

            function cleanup() {
                cancelAnimationFrame(frame);
                clearTimeout(cleanupTimer);
                frame = 0;
                if (gesture?.front) gesture.front.remove();
                if (gesture?.back) gesture.back.remove();
                overlay.style.display = 'none';
                gesture = null;
                schedulePreparation();
            }

            function discardPrepared() {
                warmed?.front.remove();
                warmed?.back.remove();
                warmed = null;
            }

            function syncPreviewTheme() {
                overlay.dataset.theme = document.documentElement.dataset.theme;
                const theme = getComputedStyle(document.documentElement);
                for (let i = 0; i < theme.length; i++) {
                    const key = theme[i];
                    if (key.startsWith('--')) overlay.style.setProperty(key, theme.getPropertyValue(key));
                }
            }

            function prepareViews() {
                prepareIdle = 0;
                if (gesture || document.hidden || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
                discardPrepared();
                const view = activeView();
                const button = view?.querySelector('.back-btn');
                const targetId = button && destination(button);
                const target = targetId && document.getElementById(targetId);
                if (!target) return;
                syncPreviewTheme();
                const cached = cache.get(targetId);
                const back = layer(cached ? cached.node.cloneNode(true) : snapshot(target), cached?.scroll || 0, false);
                const sourceSnapshot = snapshot(view);
                const front = layer(sourceSnapshot, window.scrollY, true);
                warmed = {view,button,targetId,target,back,front,sourceSnapshot,width:window.innerWidth,shade:back.querySelector('.edge-back-shade')};
                front.style.transform = 'translate3d(0,0,0)';
                back.style.transform = `translate3d(${-window.innerWidth*.22}px,0,0)`;
                warmed.shade.style.opacity = '.22';
            }

            function cancelPreparation() {
                cancelAnimationFrame(prepareFrame);
                prepareFrame = 0;
                if (prepareIdle) {
                    if (window.cancelIdleCallback) window.cancelIdleCallback(prepareIdle);
                    else clearTimeout(prepareIdle);
                    prepareIdle = 0;
                }
            }

            function schedulePreparation() {
                if (prepareFrame || prepareIdle || gesture || document.hidden) return;
                // Wait until the page renderer has completed, then copy in idle time.
                prepareFrame = requestAnimationFrame(() => {
                    prepareFrame = 0;
                    prepareIdle = window.requestIdleCallback
                        ? window.requestIdleCallback(prepareViews, {timeout:250})
                        : setTimeout(prepareViews,40);
                });
            }

            function invalidatePrepared() {
                if (gesture) return;
                discardPrepared();
                schedulePreparation();
            }

            // Called before show() clears the outgoing travel lists.
            window.kostentrackerRememberView = nextId => {
                const view = activeView();
                if (gesture && !gesture.navigating) cleanup();
                if (view && view.id !== nextId) {
                    const prepared = gesture?.navigating && gesture.view === view;
                    cache.set(view.id, {node:prepared ? gesture.sourceSnapshot : snapshot(view),scroll:prepared ? gesture.sourceScroll : window.scrollY});
                }
            };

            function destination(button) {
                const action = (button.getAttribute('onclick') || '').trim();
                const targets = {'goHome()':'home','openUebersicht()':'uebersichtView','openSettings()':'settingsView','backToReisen()':'reisen'};
                if (action === 'closeAusgabenArchiv()') return state.ausgabenArchivTyp === 'freizeit' ? 'freizeitView' : 'haushaltView';
                return targets[action.replace(/;$/, '')];
            }

            function layer(node, scroll, front) {
                const el = document.createElement('div');
                el.className = 'edge-back-layer' + (front ? ' edge-back-front' : '');
                const content = document.createElement('div');
                content.className = 'edge-page-content';
                content.style.top = -scroll + 'px';
                content.appendChild(node);
                el.appendChild(content);
                if (!front) {
                    const shade = document.createElement('div');
                    shade.className = 'edge-back-shade';
                    el.appendChild(shade);
                }
                shadow.appendChild(el);
                return el;
            }

            function paint() {
                frame = 0;
                if (!gesture?.dragging || gesture.settling) return;
                const progress = gesture.distance / gesture.width;
                gesture.front.style.transform = `translate3d(${gesture.distance}px,0,0)`;
                gesture.back.style.transform = `translate3d(${-gesture.width * .22 * (1-progress)}px,0,0)`;
                gesture.shade.style.opacity = String(.22 * (1-progress));
            }

            function settle(commit) {
                const g = gesture;
                if (!g?.dragging || g.settling) { cleanup(); return; }
                cancelAnimationFrame(frame);
                paint();
                g.settling = true;
                const duration = reducedMotion?.matches ? 0 : (commit ? 380 : 300);
                // Resolve the current finger position before starting the release animation.
                g.front.getBoundingClientRect();
                g.front.style.transition = `transform ${duration}ms cubic-bezier(.25,.6,.25,1)`;
                g.back.style.transition = g.front.style.transition;
                g.shade.style.transition = `opacity ${duration}ms ease-out`;
                g.front.style.transform = `translate3d(${commit ? g.width : 0}px,0,0)`;
                g.back.style.transform = `translate3d(${commit ? 0 : -g.width*.22}px,0,0)`;
                g.shade.style.opacity = commit ? '0' : '.22';
                suppressClickUntil = performance.now() + duration + 180;
                const complete = () => {
                    if (gesture !== g) return;
                    if (commit && !g.navigating) navigate();
                    cleanup();
                };
                const navigate = () => {
                    if (gesture !== g || g.navigating) return;
                    g.navigating = true;
                    // Render only once the slide is finished: DOM work must not interrupt it.
                    g.button.click();
                    window.scrollTo(0, cache.get(g.targetId)?.scroll || 0);
                };
                g.front.addEventListener('transitionend', event => {
                    if (event.target === g.front && event.propertyName === 'transform') complete();
                });
                // The cached destination stays visible until the real view is ready.
                cleanupTimer = setTimeout(complete, duration + 70);
            }

            document.addEventListener('touchstart', event => {
                if (gesture?.settling) { event.stopImmediatePropagation(); return; }
                cleanup();
                if (event.touches.length !== 1) return;
                const touch = event.touches[0];
                if (touch.clientX > 24 || touch.clientX < 0) return;
                if (document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
                if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
                if ([...document.querySelectorAll('.sheet-backdrop')].some(el => !el.classList.contains('hidden'))) return;
                if (document.querySelector('.swipe-selection-mode')) return;
                const view = activeView();
                const button = view?.querySelector('.back-btn');
                if (!button) return;
                const targetId = destination(button);
                const target = document.getElementById(targetId);
                if (!target) return;
                cancelPreparation();
                if (warmed && (warmed.view !== view || warmed.targetId !== targetId || warmed.width !== window.innerWidth)) discardPrepared();
                const prepared = warmed;
                warmed = null;
                gesture = {view,button,targetId,target,startX:touch.clientX,startY:touch.clientY,lastX:touch.clientX,lastTime:performance.now(),velocity:0,distance:0,width:window.innerWidth,dragging:false,settling:false};
                if (prepared) {
                    Object.assign(gesture,prepared);
                    // Scrolling does not require copying the page again.
                    gesture.front.querySelector('.edge-page-content').style.top = -window.scrollY + 'px';
                } else {
                    // Fallback for an immediate swipe before the idle preparation ran.
                    syncPreviewTheme();
                    const cached = cache.get(targetId);
                    gesture.back = layer(cached ? cached.node.cloneNode(true) : snapshot(target), cached?.scroll || 0, false);
                    gesture.sourceSnapshot = snapshot(view);
                    gesture.front = layer(gesture.sourceSnapshot,window.scrollY,true);
                    gesture.shade = gesture.back.querySelector('.edge-back-shade');
                    gesture.front.style.transform = 'translate3d(0,0,0)';
                    gesture.back.style.transform = `translate3d(${-gesture.width*.22}px,0,0)`;
                    gesture.shade.style.opacity = '.22';
                }
                gesture.sourceScroll = window.scrollY;
                overlay.style.display = 'block';
                // Reserve only the edge strip; entry swipes elsewhere are untouched.
                event.stopImmediatePropagation();
            }, {capture:true,passive:true});

            document.addEventListener('touchmove', event => {
                const g = gesture;
                if (!g || g.settling) return;
                if (event.touches.length !== 1) { settle(false); return; }
                const touch = event.touches[0];
                const dx = touch.clientX - g.startX;
                const dy = touch.clientY - g.startY;
                if (!g.dragging) {
                    if (Math.max(Math.abs(dx),Math.abs(dy)) < 8) return;
                    if (dx <= 0 || Math.abs(dy) >= dx * .8 || !event.cancelable) { cleanup(); return; }
                    g.dragging = true;
                    overlay.style.display = 'block';
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                const now = performance.now();
                g.velocity = (touch.clientX - g.lastX) / Math.max(1,now-g.lastTime);
                g.lastX = touch.clientX;
                g.lastTime = now;
                g.distance = Math.min(g.width,Math.max(0,dx));
                if (!frame) frame = requestAnimationFrame(paint);
            }, {capture:true,passive:false});

            document.addEventListener('touchend', event => {
                const g = gesture;
                if (!g || g.settling) return;
                if (!g.dragging) { cleanup(); return; }
                event.preventDefault();
                event.stopImmediatePropagation();
                const touch = event.changedTouches?.[0];
                if (touch) g.distance = Math.min(g.width,Math.max(0,touch.clientX-g.startX));
                const quick = performance.now()-g.lastTime < 90 && g.velocity > .5;
                settle(g.distance >= g.width*.32 || (g.distance >= 50 && quick));
            }, {capture:true,passive:false});
            document.addEventListener('touchcancel', () => { if (gesture && !gesture.settling) settle(false); }, {capture:true,passive:true});
            document.addEventListener('click', event => {
                if (event.isTrusted && performance.now() < suppressClickUntil) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
            const observer = new MutationObserver(mutations => {
                const view = activeView();
                if (mutations.some(m => m.target === document.documentElement || view?.contains(m.target))) invalidatePrepared();
            });
            observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','value','checked','selected']});
            observer.observe(document.documentElement, {attributes:true,attributeFilter:['data-theme','style']});
            document.addEventListener('input',invalidatePrepared,true);
            document.addEventListener('change',invalidatePrepared,true);
            document.addEventListener('focusout',schedulePreparation,true);
            window.addEventListener('resize',() => { discardPrepared(); cleanup(); });
            window.addEventListener('pagehide',() => { discardPrepared(); cleanup(); cancelPreparation(); });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) { discardPrepared(); cleanup(); }
                else schedulePreparation();
            });
            schedulePreparation();
        })();
    