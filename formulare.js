// Kostentracker Test: js/ui/formulare.js
// Functions share the existing app state; initialize only in app/start.js.

        function enterToNext(current, next) {
            if (!current || !next) return;

            current.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    next.focus();
                }
            };
            if (current.tagName === "INPUT") current.enterKeyHint = "next";
        }

        function setupEnterSequence(ids, submitFn) {
            const fields = ids.map(id => document.getElementById(id)).filter(Boolean);
            if (!fields.length) return null;

            fields.forEach((field, index) => {
                if (field.tagName === "INPUT") {
                    field.enterKeyHint = index === fields.length - 1 ? "done" : "next";
                }
                field.onkeydown = (e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (index < fields.length - 1) {
                        fields[index + 1].focus();
                    } else if (typeof submitFn === "function") {
                        submitFn();
                    }
                };
            });
            return fields[0]?.id || null;
        }

        function setupUniversalAddEnterFlow(panelId) {
            const flows = {
                reisenAddPanel: { ids: ["landInput"], submit: () => addLand() },
                versAddPanel: { ids: ["versName","versBetrag","versDatum","versAnbieter","versNummer","versIntervall","versMonat"], submit: () => addVersicherung() },
                hausAddPanel: { ids: ["hausBetrag","hausText","hausDatum"], submit: () => addHaushalt() },
                freizeitAddPanel: { ids: ["freizeitBetrag","freizeitText","freizeitDatum"], submit: () => addFreizeit() },
                einnahmenAddPanel: { ids: ["einnahmenText","einnahmenBetrag","einnahmenVon","einnahmenDatum","einnahmenWiederholung"], submit: () => addEinnahme() },
                kostenAddPanel: { ids: ["costText","costBetrag","costInfo","costHaendler","costZuordnungTage","costDatum"], submit: () => addKosten() }
            };
            const flow = flows[panelId];
            if (!flow) return null;
            return setupEnterSequence(flow.ids, flow.submit);
        }

        function setupReisenEnterFlow() {
            const first = setupEnterSequence(["betrag", "text", "datum"], () => {
                addEintrag();
                setTimeout(() => document.getElementById("betrag")?.focus(), 50);
            });
            if (first) document.getElementById(first)?.focus();
        }

        function setupQuickAddEnterFlow() {

            const betrag = document.getElementById("quickBetrag");
            const text = document.getElementById("quickText");

            if (!betrag || !text) return;

            enterToNext(betrag, text);

            text.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveQuickAdd();
                    setTimeout(() => betrag.focus(), 10);
                }
            };

            betrag.focus();
        }

        function setupReiseEditEnterFlow(id) {
            const first = setupEnterSequence(["editBetrag-" + id, "editText-" + id, "editDatum-" + id], () => saveEditReise(id));
            if (first) document.getElementById(first)?.focus();
        }

        function setupLandEnter() {
            const first = setupEnterSequence(["landInput", "landBudget", "landVon", "landBis"], () => addLand());
            if (first) document.getElementById(first)?.focus();
        }

        function setupLandEditEnterFlow(name) {

            const input = document.getElementById("editLand-" + safeId(name));
            if (!input) return;

            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveEditLand(name);
                }
            };

            input.focus();
        }

        function setupKategorieEditEnterFlow(name) {

            const input = document.getElementById("editKategorie-" + safeId(name));

            if (!input) return;

            input.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveEditKategorie(name);
                }
            };

            input.focus();
        }

        function setupVersicherungEnterFlow() {

            const name = document.getElementById("versName");
            const betrag = document.getElementById("versBetrag");
            const datum = document.getElementById("versDatum");
            const anbieter = document.getElementById("versAnbieter");
            const nummer = document.getElementById("versNummer");

            if (!name || !betrag || !datum || !anbieter || !nummer) return;

            enterToNext(name, betrag);
            enterToNext(betrag, datum);
            enterToNext(datum, anbieter);
            enterToNext(anbieter, nummer);

            nummer.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    addVersicherung();
                    name.focus();
                }
            };

            name.focus();
        }

        function setupVersicherungEditEnterFlow(id) {

            const name = document.getElementById("editName-" + id);
            const betrag = document.getElementById("editBetrag-" + id);
            const anbieter = document.getElementById("editAnbieter-" + id);
            const nummer = document.getElementById("editNummer-" + id);

            if (!name || !betrag || !anbieter || !nummer) return;

            enterToNext(name, betrag);
            enterToNext(betrag, anbieter);
            enterToNext(anbieter, nummer);

            nummer.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveEditVersicherung(id);
                }
            };

            name.focus();
        }

        function setupHaushaltEnterFlow() {
            const first = setupEnterSequence(["hausBetrag", "hausText", "hausDatum"], () => addHaushalt());
            if (first) document.getElementById(first)?.focus();
        }

        function setupFreizeitEnterFlow() {
            const first = setupEnterSequence(["freizeitBetrag", "freizeitText", "freizeitDatum"], () => addFreizeit());
            if (first) document.getElementById(first)?.focus();
        }

        function setupFreizeitEditEnterFlow(id) {
            const first = setupEnterSequence(["editFreizeitBetrag-" + id, "editFreizeitText-" + id, "editFreizeitDatum-" + id], () => saveEditFreizeit(id));
            if (first) document.getElementById(first)?.focus();
        }

        function setupHaushaltEditEnterFlow(id) {
            const first = setupEnterSequence(["editBetrag-" + id, "editText-" + id, "editDatum-" + id], () => saveEditHaushalt(id));
            if (first) document.getElementById(first)?.focus();
        }

        function setupKostenEnterFlow() {

            const text = document.getElementById("costText");
            const betrag = document.getElementById("costBetrag");
            const info = document.getElementById("costInfo");
            const datum = document.getElementById("costDatum");

            if (!text || !betrag || !info || !datum) return;

            enterToNext(text, betrag);
            enterToNext(betrag, info);
            const haendler = document.getElementById("costHaendler");
            const tage = document.getElementById("costZuordnungTage");
            enterToNext(info, haendler || datum);
            if (haendler) enterToNext(haendler, tage || datum);
            if (tage) enterToNext(tage, datum);

            datum.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    addKosten();
                    text.focus();
                }
            };

            text.focus();
        }

        function setupKostenEditEnterFlow(id) {

            const text = document.getElementById("editKostenText-" + id);
            const betrag = document.getElementById("editKostenBetrag-" + id);
            const info = document.getElementById("editKostenInfo-" + id);
            const datum = document.getElementById("editKostenDatum-" + id);

            if (!text || !betrag || !info || !datum) return;

            enterToNext(text, betrag);
            enterToNext(betrag, info);
            const haendler = document.getElementById("editKostenHaendler-" + id);
            const tage = document.getElementById("editKostenZuordnungTage-" + id);
            enterToNext(info, haendler || datum);
            if (haendler) enterToNext(haendler, tage || datum);
            if (tage) enterToNext(tage, datum);

            datum.onkeydown = (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    saveEditKosten(id);
                }
            };

            text.focus();
        }
