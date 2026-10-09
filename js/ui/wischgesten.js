
        (() => {
            const touchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
            if (!touchDevice) return;

            let activeShell = null;
            let startX = 0;
            let startY = 0;
            let startOffset = 0;
            let horizontal = false;
            let openShell = null;
            let activeRailWidth = 0;
            let activeShellWidth = 0;
            let activeDeleteThreshold = 0;
            let latestOffset = 0;
            let latestDeleteVisualProgress = 0;
            let framePending = false;
            let frameId = 0;
            let activeCard = null;
            let activeRightRail = null;
            let activeDeleteButton = null;
            let dragDirection = '';
            let lastTouchX = 0;
            let lastTouchTime = 0;
            let swipeVelocity = 0;
            const swipeReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

            function eventTime(event) { return event.timeStamp || performance.now(); }

            function flushSwipeFrame(shell) {
                cancelPendingFrame();
                const card = shell === activeShell ? activeCard : cardOf(shell);
                if (card) card.style.transform = `translate3d(${-latestOffset}px,0,0)`;
                shell?.style.setProperty('--swipe-delete-progress', latestDeleteVisualProgress.toFixed(3));
            }

            function setDragDirection(direction) {
                if (dragDirection === direction) return;
                dragDirection = direction;
                activeShell.classList.toggle('swipe-entry-dragging', direction === 'left');
                activeShell.classList.toggle('swipe-entry-right-dragging', direction === 'right');
            }

            /* Long Press -> neuer, DOM-basierter Auswahlmodus.
               Bewusst ohne App-Render beim Antippen, damit die Swipe-Wrapper stabil bleiben. */
            let selectionMode = false;
            const selectedShells = new Set();
            let longPressTimer = 0;
            let longPressStartX = 0;
            let longPressStartY = 0;
            let longPressShell = null;
            let longPressTriggered = false;
            let suppressClickUntil = 0;
            let suppressClickShell = null;

            function setCardOffset(shell, offset, deleteVisualProgress = 0) {
                latestOffset = offset;
                latestDeleteVisualProgress = Math.max(0, Math.min(1, deleteVisualProgress));
                if (framePending) return;
                framePending = true;
                frameId = requestAnimationFrame(() => {
                    framePending = false;
                    frameId = 0;
                    const card = shell === activeShell ? activeCard : cardOf(shell);
                    if (card) card.style.transform = `translate3d(${-latestOffset}px,0,0)`;
                    if (shell?.isConnected) {
                        shell.style.setProperty('--swipe-delete-progress', latestDeleteVisualProgress.toFixed(3));
                    }
                });
            }

            function setCardTranslate(shell, translateX) {
                setCardOffset(shell, -translateX, 0);
            }


            function cancelPendingFrame() {
                if (frameId) cancelAnimationFrame(frameId);
                frameId = 0;
                framePending = false;
            }

            function cardOf(shell) {
                return shell?.querySelector(':scope > .item.swipe-entry-ready') || null;
            }

            function closeSwipe(shell = openShell, animate = true) {
                if (!shell || shell.classList.contains('swipe-entry-removing')) return;
                const card = cardOf(shell);
                cancelPendingFrame();
                shell.classList.remove('swipe-entry-open', 'swipe-entry-dragging', 'swipe-entry-right-dragging', 'swipe-delete-progress', 'swipe-delete-armed');
                shell.style.setProperty('--swipe-delete-progress', '0');
                latestDeleteVisualProgress = 0;
                if (card) {
                    if (!animate) card.style.transition = 'none';
                    card.style.transform = 'translate3d(0,0,0)';
                    if (!animate) requestAnimationFrame(() => { card.style.transition = ''; });
                }
                if (openShell === shell) openShell = null;
            }

            function animateSwipeDelete(shell, deleteButton, width) {
                animateSwipeRemoval(shell, width, -1, () => {
                    const oldConfirm = window.confirm;
                    try {
                        window.confirm = () => true;
                        deleteButton.click();
                    } finally { window.confirm = oldConfirm; }
                });
            }

            function animateSwipeRemoval(shell, width, direction, action) {
                if (!shell || shell.classList.contains('swipe-entry-removing')) return;
                const card = cardOf(shell);
                const originalHeight = shell.style.height;
                const originalMarginTop = shell.style.marginTop;
                const originalMarginBottom = shell.style.marginBottom;
                const originalTransition = shell.style.transition;
                const originalSlideDuration = shell.style.getPropertyValue('--swipe-removal-duration');
                const slideDuration = direction > 0 ? 420 : 240;
                const finish = () => {
                    if (!shell.isConnected) return;
                    try {
                        // Keep the existing persistence and undo path for either action.
                        action();
                    } finally {
                        // A failed save must leave the entry visible and usable.
                        shell.classList.remove('swipe-entry-removing', 'swipe-entry-hiding');
                        shell.style.height = originalHeight;
                        shell.style.marginTop = originalMarginTop;
                        shell.style.marginBottom = originalMarginBottom;
                        shell.style.transition = originalTransition;
                        if (originalSlideDuration) shell.style.setProperty('--swipe-removal-duration', originalSlideDuration);
                        else shell.style.removeProperty('--swipe-removal-duration');
                        if (shell.isConnected) closeSwipe(shell, false);
                    }
                };
                if (swipeReducedMotion?.matches) { finish(); return; }
                shell.style.height = `${shell.getBoundingClientRect().height}px`;
                shell.classList.remove('swipe-entry-open', 'swipe-entry-right-dragging');
                shell.style.setProperty('--swipe-removal-duration', `${slideDuration}ms`);
                shell.classList.add('swipe-entry-removing');
                shell.classList.toggle('swipe-entry-hiding', direction > 0);
                shell.style.setProperty('--swipe-delete-progress', direction < 0 ? '1' : '0');
                if (card) card.style.transform = `translate3d(${direction * width}px,0,0)`;
                // Slide out, hold the action color briefly, then close the gap in the list.
                window.setTimeout(() => {
                    if (!shell.isConnected) return;
                    shell.style.transition = 'height .26s cubic-bezier(.25,.6,.25,1), margin-top .26s cubic-bezier(.25,.6,.25,1), margin-bottom .26s cubic-bezier(.25,.6,.25,1)';
                    shell.style.height = '0px';
                    shell.style.marginTop = '0px';
                    shell.style.marginBottom = '0px';
                    window.setTimeout(finish, 260);
                }, slideDuration + 80);
            }

            function railWidth(shell) {
                const rail = shell.querySelector(':scope > .swipe-action-rail');
                return Math.max(58, rail ? rail.getBoundingClientRect().width : 0);
            }


            function clearLongPressTimer() {
                if (longPressTimer) clearTimeout(longPressTimer);
                longPressTimer = 0;
                longPressShell = null;
            }

            function isVisibleShell(shell) {
                if (!shell || !shell.isConnected) return false;
                const rect = shell.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            }

            function isSelectableShell(shell) {
                return !!(shell && !shell.classList.contains('swipe-entry-removing') && shell.querySelector(':scope > .swipe-action-rail .delete'));
            }

            function ensureSelectionDot(shell) {
                if (!shell || shell.querySelector(':scope > .swipe-selection-dot')) return;
                const dot = document.createElement('span');
                dot.className = 'swipe-selection-dot';
                dot.setAttribute('aria-hidden', 'true');
                shell.appendChild(dot);
            }

            function updateSelectionToolbar() {
                const toolbar = document.getElementById('longSelectToolbar');
                if (!toolbar) return;
                for (const shell of [...selectedShells]) {
                    if (!shell.isConnected || !shell.classList.contains('swipe-selection-mode')) selectedShells.delete(shell);
                }
                const count = selectedShells.size;
                const countEl = toolbar.querySelector('.long-select-toolbar-count');
                const deleteBtn = toolbar.querySelector('.long-select-toolbar-delete');
                if (countEl) countEl.textContent = `${count} ausgewählt`;
                if (deleteBtn) {
                    deleteBtn.disabled = count === 0;
                    deleteBtn.textContent = count ? `🗑️ ${count}` : '🗑️';
                }
            }

            function setShellSelected(shell, selected) {
                if (!shell || !shell.classList.contains('swipe-selection-mode')) return;
                shell.classList.toggle('swipe-selection-selected', selected);
                if (selected) selectedShells.add(shell);
                else selectedShells.delete(shell);
                updateSelectionToolbar();
            }

            function toggleShellSelected(shell) {
                if (!selectionMode || !shell?.classList.contains('swipe-selection-mode')) return;
                setShellSelected(shell, !selectedShells.has(shell));
            }

            function createSelectionToolbar() {
                document.getElementById('longSelectToolbar')?.remove();
                const toolbar = document.createElement('div');
                toolbar.id = 'longSelectToolbar';
                toolbar.className = 'long-select-toolbar';
                toolbar.setAttribute('role', 'toolbar');
                toolbar.setAttribute('aria-label', 'Auswahlaktionen');
                toolbar.innerHTML = `
                    <div class="long-select-toolbar-count" aria-live="polite">0 ausgewählt</div>
                    <button type="button" class="long-select-toolbar-delete" disabled>🗑️</button>
                    <button type="button" class="long-select-toolbar-done">Fertig</button>`;
                toolbar.querySelector('.long-select-toolbar-delete')?.addEventListener('click', deleteSelectedEntries);
                toolbar.querySelector('.long-select-toolbar-done')?.addEventListener('click', () => exitSelectionMode());
                document.body.appendChild(toolbar);
            }

            function enterSelectionMode(initialShell) {
                if (!initialShell || !isSelectableShell(initialShell)) return;
                if (openShell) closeSwipe(openShell, false);
                if (activeShell) closeSwipe(activeShell, false);
                cancelPendingFrame();

                selectionMode = true;
                selectedShells.clear();
                document.querySelectorAll('.swipe-entry-shell').forEach(shell => {
                    if (!isVisibleShell(shell) || !isSelectableShell(shell)) return;
                    closeSwipe(shell, false);
                    shell.classList.add('swipe-selection-mode');
                    ensureSelectionDot(shell);
                });
                createSelectionToolbar();
                setShellSelected(initialShell, true);
            }

            function exitSelectionMode() {
                clearLongPressTimer();
                selectionMode = false;
                selectedShells.clear();
                document.querySelectorAll('.swipe-entry-shell.swipe-selection-mode').forEach(shell => {
                    shell.classList.remove('swipe-selection-mode', 'swipe-selection-selected');
                    shell.querySelector(':scope > .swipe-selection-dot')?.remove();
                });
                document.getElementById('longSelectToolbar')?.remove();
                activeShell = null;
                horizontal = false;
                activeRailWidth = 0;
                activeShellWidth = 0;
                activeDeleteThreshold = 0;
            }

            function deleteSelectedEntries() {
                const shells = [...selectedShells].filter(shell => shell.isConnected && shell.classList.contains('swipe-selection-mode'));
                if (!shells.length) return;
                const buttons = shells.map(shell => shell.querySelector(':scope > .swipe-action-rail .delete')).filter(Boolean);
                if (!buttons.length) return;
                const count = buttons.length;
                if (!confirm(`${count} ausgewählte ${count === 1 ? 'Position' : 'Positionen'} löschen?`)) return;

                /* Ein gemeinsamer Undo-Snapshot fuer die komplette Mehrfachloeschung.
                   Die vorhandenen Delete-Handler werden weiterverwendet, ihre einzelnen
                   Confirm-/Undo-Aufrufe werden nur fuer diesen Batch unterdrueckt. */
                const oldConfirm = window.confirm;
                const oldBeginUndo = window.beginUndoDelete;
                const oldFinishUndo = window.finishUndoDelete;
                try {
                    if (typeof oldBeginUndo === 'function') oldBeginUndo(`${count} Einträge gelöscht`);
                    window.confirm = () => true;
                    if (typeof oldBeginUndo === 'function') window.beginUndoDelete = () => {};
                    if (typeof oldFinishUndo === 'function') window.finishUndoDelete = () => {};
                    exitSelectionMode();
                    buttons.forEach(button => button.click());
                } finally {
                    window.confirm = oldConfirm;
                    if (typeof oldBeginUndo === 'function') window.beginUndoDelete = oldBeginUndo;
                    if (typeof oldFinishUndo === 'function') window.finishUndoDelete = oldFinishUndo;
                }
                if (typeof oldFinishUndo === 'function') oldFinishUndo(`${count} Einträge gelöscht`);
            }

            function clearNativeTextSelection() {
                const selection = window.getSelection?.();
                if (selection && selection.rangeCount) selection.removeAllRanges();
            }

            /* iOS/Safari kann trotz CSS bei langem Halten kurz eine Textauswahl starten.
               Fuer unsere wischbaren Eintraege wird sie deshalb auch auf Event-Ebene blockiert. */
            document.addEventListener('selectstart', event => {
                if (event.target.closest?.('.swipe-entry-shell')) {
                    event.preventDefault();
                    clearNativeTextSelection();
                }
            }, true);

            document.addEventListener('contextmenu', event => {
                if (event.target.closest?.('.swipe-entry-shell')) {
                    event.preventDefault();
                    clearNativeTextSelection();
                }
            }, true);

            document.addEventListener('selectionchange', () => {
                if (activeShell || longPressShell || selectionMode) clearNativeTextSelection();
            });

            function startLongPress(shell, x, y) {
                clearLongPressTimer();
                longPressTriggered = false;
                if (selectionMode || !isSelectableShell(shell)) return;
                longPressShell = shell;
                longPressStartX = x;
                longPressStartY = y;
                longPressTimer = window.setTimeout(() => {
                    const target = longPressShell;
                    if (!target || !target.isConnected) return;
                    longPressTriggered = true;
                    suppressClickUntil = Date.now() + 350;
                    suppressClickShell = target;
                    clearNativeTextSelection();
                    enterSelectionMode(target);
                    activeShell = null;
                    horizontal = false;
                    clearLongPressTimer();
                }, 400);
            }

            function shellEntryMeta(shell) {
                const btn = shell?.querySelector(':scope > .swipe-action-rail button[onclick*="moveAusgabe("]');
                const code = btn?.getAttribute('onclick') || '';
                const match = code.match(/moveAusgabe\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
                return match ? { type: match[1], id: match[2] } : null;
            }

            function rightSwipeConfigFor(shell) {
                let action = typeof getRightSwipeAction === 'function' ? getRightSwipeAction() : 'aus';
                if (action === 'aus') return null;
                const meta = shellEntryMeta(shell);
                if (!meta) return null;
                // Ist ein Eintrag bereits ausgeblendet, wird die eingestellte Aktion
                // „Ausblenden“ automatisch zur passenden Rückgängig-Aktion.
                if (action === 'ausblenden' && typeof istEintragAusgeblendet === 'function' && istEintragAusgeblendet(meta.type, meta.id)) {
                    action = 'einblenden';
                }
                if (action === 'erneut' && !['haushalt','freizeit','reisen'].includes(meta.type)) return null;
                if (action === 'bearbeiten' && !shell.querySelector(':scope > .item .actions .edit')) return null;
                return { action, meta };
            }

            function refreshRightRail(shell) {
                shell?.querySelector(':scope > .swipe-right-action-rail')?.remove();
                const cfg = rightSwipeConfigFor(shell);
                if (!cfg) return;
                const labels = { erneut:'↻ Erneut', ausblenden:'👁️‍🗨️ Ausblenden', einblenden:'👁️ Einblenden', bearbeiten:'✏️ Bearbeiten', verschieben:'↪️ Verschieben' };
                const rail = document.createElement('div');
                rail.className = 'swipe-right-action-rail';
                rail.dataset.action = cfg.action;
                rail.setAttribute('aria-hidden', 'true');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = labels[cfg.action] || 'Aktion';
                rail.appendChild(btn);
                shell.appendChild(rail);
            }

            function executeRightSwipe(shell) {
                const cfg = rightSwipeConfigFor(shell);
                if (!cfg) return;
                const { action, meta } = cfg;
                if (action === 'erneut') erneutBuchenEintrag(meta.type, meta.id);
                else if (action === 'ausblenden') ausblendenEintrag(meta.type, meta.id);
                else if (action === 'einblenden') eintragEinblenden(meta.type, meta.id);
                else if (action === 'bearbeiten') shell.querySelector(':scope > .item .actions .edit')?.click();
                else if (action === 'verschieben') shell.querySelector(':scope > .item .actions button[onclick*="moveAusgabe("]')?.click();
            }

            function enhanceItem(item) {
                if (!item || item.classList.contains('swipe-entry-ready')) return;
                if (item.querySelector('input, select, textarea')) return;

                const actions = item.querySelector('.actions');
                if (!actions || !actions.querySelector('button')) return;

                const computed = getComputedStyle(item);
                const shell = document.createElement('div');
                shell.className = 'swipe-entry-shell';
                shell.style.marginTop = computed.marginTop;
                shell.style.marginRight = computed.marginRight;
                shell.style.marginBottom = computed.marginBottom;
                shell.style.marginLeft = computed.marginLeft;
                shell.style.borderRadius = computed.borderRadius;

                /* Bei eingerueckten Eintraegen (z. B. im Archiv) darf die
                   Swipe-Shell nicht zusaetzlich 100% breit bleiben, sonst ragt
                   sie um den Einzug rechts aus dem Container. */
                const horizontalMargin =
                    (parseFloat(computed.marginLeft) || 0) +
                    (parseFloat(computed.marginRight) || 0);
                if (horizontalMargin > 0) {
                    shell.style.width = `calc(100% - ${horizontalMargin}px)`;
                }

                const parent = item.parentNode;
                parent.insertBefore(shell, item);
                shell.appendChild(item);

                /* Die bisherigen Aussenabstaende liegen nun auf der Shell,
                   damit die komplette sichtbare Karte ohne Layoutsprung gleitet. */
                item.style.margin = '0';

                const rail = document.createElement('div');
                rail.className = 'swipe-action-rail';
                rail.setAttribute('aria-hidden', 'true');
                actions.querySelectorAll('button').forEach(btn => {
                    const clone = btn.cloneNode(true);
                    clone.addEventListener('click', event => {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        btn.click();
                        closeSwipe(shell);
                    }, true);
                    rail.appendChild(clone);
                });

                actions.classList.add('swipe-original-actions');
                item.classList.add('swipe-entry-ready');
                shell.appendChild(rail);
                refreshRightRail(shell);
            }

            function enhanceAll(root = document) {
                root.querySelectorAll('.item').forEach(enhanceItem);
            }

            document.addEventListener('touchstart', event => {
                if (event.touches.length !== 1) {
                    clearLongPressTimer();
                    if (activeShell) closeSwipe(activeShell);
                    activeShell = null;
                    horizontal = false;
                    return;
                }
                const shell = event.target.closest('.swipe-entry-shell');

                if (!shell) {
                    if (openShell) closeSwipe(openShell);
                    activeShell = null;
                    return;
                }

                if (shell.classList.contains('swipe-entry-removing')) return;
                if (event.target.closest('.swipe-action-rail')) return;

                /* Im Auswahlmodus sind normale Taps nur Auswahl-Taps; Swipe bleibt aus. */
                if (selectionMode) {
                    activeShell = null;
                    clearLongPressTimer();
                    return;
                }

                if (openShell && openShell !== shell) closeSwipe(openShell);

                const touch = event.touches[0];
                clearNativeTextSelection();
                cancelPendingFrame();
                activeShell = shell;
                activeCard = cardOf(shell);
                activeRightRail = shell.querySelector(':scope > .swipe-right-action-rail');
                activeDeleteButton = shell.querySelector('.swipe-action-rail .delete');
                dragDirection = '';
                lastTouchX = touch.clientX;
                lastTouchTime = eventTime(event);
                swipeVelocity = 0;
                startLongPress(shell, touch.clientX, touch.clientY);
                startX = touch.clientX;
                startY = touch.clientY;
                activeRailWidth = railWidth(shell);
                activeShellWidth = Math.max(activeRailWidth, shell.getBoundingClientRect().width);
                activeDeleteThreshold = Math.max(activeRailWidth + 56, activeShellWidth * 0.72);
                startOffset = shell.classList.contains('swipe-entry-open') ? activeRailWidth : 0;
                // Read the current visual position once, including a still-settling card.
                const transform = activeCard ? getComputedStyle(activeCard).transform : '';
                const matrix = transform?.match(/^matrix(3d)?\(([^)]+)\)$/);
                if (matrix) {
                    const parts = matrix[2].split(',').map(Number);
                    const translate = parts[matrix[1] ? 12 : 4];
                    if (Number.isFinite(translate)) startOffset = -translate;
                }
                latestOffset = startOffset;
                latestDeleteVisualProgress = 0;
                shell.style.setProperty('--swipe-delete-progress', '0');
                horizontal = false;
            }, { passive: true });

            document.addEventListener('touchmove', event => {
                if (!activeShell || event.touches.length !== 1) return;
                const touch = event.touches[0];
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                const now = eventTime(event);
                const elapsed = now - lastTouchTime;
                if (elapsed > 0) {
                    const sample = (touch.clientX - lastTouchX) / elapsed;
                    swipeVelocity = elapsed > 80 ? sample : swipeVelocity * .25 + sample * .75;
                    lastTouchTime = now;
                    lastTouchX = touch.clientX;
                }

                if (longPressShell) {
                    const ldx = touch.clientX - longPressStartX;
                    const ldy = touch.clientY - longPressStartY;
                    if (Math.hypot(ldx, ldy) > 10) clearLongPressTimer();
                }

                if (!horizontal) {
                    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                    if (Math.abs(dy) > Math.abs(dx)) {
                        clearLongPressTimer();
                        activeShell = null;
                        return;
                    }
                    clearLongPressTimer();
                    horizontal = true;
                    suppressClickUntil = Date.now() + 450;
                    suppressClickShell = activeShell;
                }

                event.preventDefault();

                const rightRail = activeRightRail;
                if (startOffset <= 0 && dx > 0 && rightRail) {
                    setDragDirection('right');
                    const isHideGesture = rightRail.dataset.action === 'ausblenden';
                    const limit = isHideGesture ? activeShellWidth : activeShellWidth * 0.42;
                    const travel = dx - startOffset;
                    // Hiding removes the row, so follow the finger beyond the middle.
                    // Actions that keep the row still use resistance at their reveal limit.
                    const rightOffset = isHideGesture
                        ? Math.min(activeShellWidth, travel)
                        : (travel <= limit ? travel : limit + (travel - limit) * .18);
                    setCardTranslate(activeShell, rightOffset);
                    return;
                }

                setDragDirection('left');
                const offset = Math.max(0, Math.min(activeShellWidth, startOffset - dx));

                /* Hinter den normalen Aktionen beginnt die rote Voll-Swipe-Zone.
                   Transform und Rot-Fortschritt werden gemeinsam nur einmal pro
                   Animation-Frame aktualisiert. */
                const hasDelete = !!activeDeleteButton;
                const deleteVisualStart = activeRailWidth + 8;
                const deleteVisualRange = Math.max(1, activeDeleteThreshold - deleteVisualStart);
                const deleteVisualProgress = hasDelete
                    ? Math.max(0, Math.min(1, (offset - deleteVisualStart) / deleteVisualRange))
                    : 0;
                setCardOffset(activeShell, offset, deleteVisualProgress);
            }, { passive: false });

            document.addEventListener('touchend', event => {
                clearLongPressTimer();
                if (longPressTriggered) {
                    longPressTriggered = false;
                    activeShell = null;
                    horizontal = false;
                    activeRailWidth = 0;
                    activeShellWidth = 0;
                    activeDeleteThreshold = 0;
                    latestDeleteVisualProgress = 0;
                    return;
                }
                if (!activeShell) return;
                const shell = activeShell;
                const touch = event.changedTouches && event.changedTouches[0];
                const dx = touch ? touch.clientX - startX : 0;
                const max = activeRailWidth || railWidth(shell);
                const shellWidth = activeShellWidth || Math.max(max, shell.getBoundingClientRect().width);

                const rightRail = activeRightRail;
                const velocity = eventTime(event) - lastTouchTime <= 80 ? swipeVelocity : 0;
                if (horizontal) {
                    suppressClickUntil = Date.now() + 350;
                    suppressClickShell = shell;
                    // Paint the last finger position before enabling the settling animation.
                    flushSwipeFrame(shell);
                    if (activeCard) void activeCard.offsetWidth;
                }
                if (horizontal && startOffset <= 0 && dx > 0 && rightRail) {
                    const trigger = Math.min(120, Math.max(86, shellWidth * 0.28));
                    const shouldRun = dx >= trigger;
                    const card = cardOf(shell);
                    cancelPendingFrame();
                    shell.classList.remove('swipe-entry-right-dragging', 'swipe-entry-dragging');
                    const cfg = shouldRun ? rightSwipeConfigFor(shell) : null;
                    const shouldHide = cfg?.action === 'ausblenden';
                    if (shouldHide) {
                        animateSwipeRemoval(shell, shellWidth, 1, () => ausblendenEintrag(cfg.meta.type, cfg.meta.id));
                    } else if (card) card.style.transform = 'translate3d(0,0,0)';
                    activeShell = null;
                    horizontal = false;
                    activeRailWidth = 0;
                    activeShellWidth = 0;
                    activeDeleteThreshold = 0;
                    latestDeleteVisualProgress = 0;
                    if (shouldRun && !shouldHide) window.setTimeout(() => {
                        if (shell.isConnected && !selectionMode) executeRightSwipe(shell);
                    }, swipeReducedMotion?.matches ? 0 : 380);
                    return;
                }

                const offset = Math.max(0, Math.min(shellWidth, startOffset - dx));
                const deleteThreshold = activeDeleteThreshold || Math.max(max + 56, shellWidth * 0.72);
                const deleteButton = activeDeleteButton;
                const shouldDelete = horizontal && !!deleteButton && offset >= deleteThreshold;
                const wasOpen = shell.classList.contains('swipe-entry-open');
                const projectedOffset = Math.max(0, offset - velocity * 140);
                const shouldOpen = !shouldDelete && (horizontal
                    ? projectedOffset > (wasOpen ? max * .55 : Math.min(46, max * .32))
                    : wasOpen);

                cancelPendingFrame();
                shell.classList.remove('swipe-entry-dragging', 'swipe-delete-progress', 'swipe-delete-armed');
                shell.style.setProperty('--swipe-delete-progress', '0');
                latestDeleteVisualProgress = 0;

                if (shouldDelete) {
                    animateSwipeDelete(shell, deleteButton, shellWidth);
                    openShell = null;
                } else {
                    const card = cardOf(shell);
                    latestOffset = shouldOpen ? max : 0;
                    if (card && horizontal) card.style.transform = `translate3d(${shouldOpen ? -max : 0}px,0,0)`;
                    shell.classList.toggle('swipe-entry-open', shouldOpen);
                    openShell = shouldOpen ? shell : null;
                }

                activeShell = null;
                horizontal = false;
                activeRailWidth = 0;
                activeShellWidth = 0;
                activeDeleteThreshold = 0;
                latestDeleteVisualProgress = 0;
            }, { passive: true });

            document.addEventListener('touchcancel', () => {
                clearLongPressTimer();
                longPressTriggered = false;
                if (activeShell) closeSwipe(activeShell);
                activeShell = null;
                horizontal = false;
                activeRailWidth = 0;
                activeShellWidth = 0;
                activeDeleteThreshold = 0;
                latestDeleteVisualProgress = 0;
            }, { passive: true });

            document.addEventListener('click', event => {
                /* Nur den synthetischen Klick des Eintrags schlucken, der den Long Press
                   ausgeloest hat. Andere Eintraege sind sofort anklickbar. */
                const clickedShell = event.target.closest('.swipe-entry-shell');
                if (event.isTrusted && clickedShell?.classList.contains('swipe-entry-removing')) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                // Block Safari's follow-up tap, while allowing the swipe's programmatic action click.
                if (event.isTrusted && Date.now() < suppressClickUntil && clickedShell && clickedShell === suppressClickShell) {
                    suppressClickUntil = 0;
                    suppressClickShell = null;
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                if (Date.now() >= suppressClickUntil) suppressClickShell = null;

                if (event.target.closest('#longSelectToolbar')) return;

                if (selectionMode) {
                    const shell = event.target.closest('.swipe-entry-shell.swipe-selection-mode');
                    if (shell) {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleShellSelected(shell);
                    }
                    return;
                }

                /* Die komplette sichtbare Karte oeffnet/schliesst die Details.
                   Ausgenommen bleiben echte Bedienelemente und die Swipe-Aktionsleiste.
                   Klickt man bereits auf den bisherigen Detailbereich, darf dessen
                   vorhandener onclick-Handler normal weiterlaufen. */
                const card = event.target.closest('.item');
                if (card && !event.target.closest('button, input, select, textarea, a, label, .actions, .swipe-action-rail')) {
                    const detailSelector = [
                        '[onclick*="toggleAlltagsDetails("]',
                        '[onclick*="toggleFixkostenDetails("]',
                        '[onclick*="toggleVersicherungDetails("]',
                        '[onclick*="toggleEinnahmeDetails("]',
                        '[onclick*="toggleReiseDetails("]',
                        '[onclick*="toggleArchivDetails("]'
                    ].join(',');
                    const directDetailTarget = event.target.closest(detailSelector);
                    if (!directDetailTarget) {
                        const detailTarget = card.querySelector(detailSelector);
                        if (detailTarget) {
                            event.preventDefault();
                            event.stopPropagation();
                            detailTarget.click();
                            return;
                        }
                    }
                }

                if (openShell && !openShell.contains(event.target)) closeSwipe(openShell);
            }, true);

            document.addEventListener('kostentracker:rightSwipeSettingChanged', () => {
                document.querySelectorAll('.swipe-entry-shell').forEach(refreshRightRail);
            });

            const observer = new MutationObserver(mutations => {
                let listWasRendered = false;
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (!(node instanceof Element)) return;
                        if (node.matches('.item') || node.querySelector?.('.item')) listWasRendered = true;
                        if (node.matches('.item')) enhanceItem(node);
                        enhanceAll(node);
                    });
                });
                /* Suche, Bearbeiten oder andere Renderer koennen die Liste austauschen.
                   Dann lieber den Auswahlmodus sauber beenden als tote Referenzen behalten. */
                if (selectionMode && listWasRendered) exitSelectionMode();
            });

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    enhanceAll();
                    observer.observe(document.body, { childList: true, subtree: true });
                }, { once: true });
            } else {
                enhanceAll();
                observer.observe(document.body, { childList: true, subtree: true });
            }
        })();
    