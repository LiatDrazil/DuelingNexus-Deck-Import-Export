(function () {
    "use strict";

    const BTN_CLASS = "ydke-export-btn";
    const ICON_DOWNLOAD = "M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z";

    function toBase64(ids) {
        const buffer = new ArrayBuffer(ids.length * 4);
        const view = new DataView(buffer);
        ids.forEach((id, i) => view.setUint32(i * 4, id, true));
        let bin = "";
        new Uint8Array(buffer).forEach((b) => (bin += String.fromCharCode(b)));
        return btoa(bin);
    }

    function parseSection(value) {
        if (!value) return [];
        const list = Array.isArray(value) ? value : String(value).split(",");
        return list
            .map((v) => Number(v) % 1e11)
            .filter((n) => Number.isFinite(n) && n > 0);
    }

    function toYdke(deck) {
        return (
            "ydke://" +
            toBase64(parseSection(deck.main_deck)) + "!" +
            toBase64(parseSection(deck.extra_deck)) + "!" +
            toBase64(parseSection(deck.side_deck)) + "!"
        );
    }

    // Current site (Vue 2): the deck list component is reachable from the root element.
    function findDecksComponent() {
        const root = document.getElementById("app");
        const start = root && root.__vue__;
        if (!start) return null;
        const stack = [start];
        while (stack.length) {
            const vm = stack.pop();
            if (Array.isArray(vm.decks) && typeof vm.retrieveDecks === "function") return vm;
            if (vm.$children) stack.push(...vm.$children);
        }
        return null;
    }

    let deckListCache = null;
    async function fetchDeckList() {
        if (deckListCache && Date.now() - deckListCache.time < 5000) return deckListCache.decks;
        const res = await fetch("/api/list-decks.php", { credentials: "include" });
        const data = await res.json();
        const decks = data.decks || [];
        deckListCache = { time: Date.now(), decks };
        return decks;
    }

    async function resolveDeck(actions, li) {
        // Beta site (Vue 3): the actions component receives the deck as a prop.
        let inst = actions.__vueParentComponent;
        for (let i = 0; inst && i < 3; i++, inst = inst.parent) {
            if (inst.props && inst.props.deck) return inst.props.deck;
        }

        const vm = findDecksComponent();
        if (vm) {
            const items = Array.from(document.querySelectorAll("li.deck-item"));
            const deck = (vm.searchedDecks || vm.decks)[items.indexOf(li)];
            if (deck) return deck;
        }

        // Fallback: ask the API and match by the editor link id, then by deck name.
        const decks = await fetchDeckList();
        const hrefs = Array.from(li.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
        for (const href of hrefs) {
            const m = href.match(/(\d+)\/?(?:[?#].*)?$/);
            const found = m && decks.find((d) => String(d.id) === m[1]);
            if (found) return found;
        }
        const title = li.querySelector("h3, .deck-title-grid-view, .deck-name-list");
        const name = title && title.textContent.trim();
        const byName = name ? decks.filter((d) => d.name === name) : [];
        if (byName.length === 1) return byName[0];
        throw new Error("no match (" + decks.length + " decks loaded)");
    }
    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
        }
    }

    function flash(btn, message) {
        const label = btn.querySelector(".button-label");
        const set = (text, opacity) => {
            btn.title = text;
            btn.setAttribute("aria-label", text);
            if (label) {
                label.textContent = text;
                label.style.opacity = opacity;
            }
        };
        set(message, "1");
        setTimeout(() => set("Export", ""), 1500);
    }

    function toYdk(deck) {
        const section = (ids) => ids.map((id) => id + "\n").join("");
        return (
            "#created by Dueling Nexus - Deck Import & Export\n#main\n" +
            section(parseSection(deck.main_deck)) +
            "#extra\n" + section(parseSection(deck.extra_deck)) +
            "!side\n" + section(parseSection(deck.side_deck))
        );
    }

    // Omega code: raw deflate of [main+extra count (u8)][side count (u8)][u32 LE ids...], base64.
    async function toOmega(deck) {
        const main = parseSection(deck.main_deck);
        const extra = parseSection(deck.extra_deck);
        const side = parseSection(deck.side_deck);
        const ids = main.concat(extra, side);
        const raw = new Uint8Array(2 + ids.length * 4);
        const view = new DataView(raw.buffer);
        raw[0] = main.length + extra.length;
        raw[1] = side.length;
        ids.forEach((id, i) => view.setUint32(2 + i * 4, id, true));

        const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"));
        const packed = new Uint8Array(await new Response(stream).arrayBuffer());
        let bin = "";
        packed.forEach((b) => (bin += String.fromCharCode(b)));
        return btoa(bin);
    }

    function downloadText(filename, text) {
        const a = document.createElement("a");
        a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
        a.download = filename;
        a.style.display = "none";
        a.addEventListener("click", (e) => e.stopPropagation());
        document.documentElement.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
    }

    const OPTIONS = [
        { label: "Download YDK", icon: ICON_DOWNLOAD, viewBox: "0 0 24 24", run: async (deck) => downloadText((deck.name || "deck").replace(/[\\/:*?"<>|]/g, "_") + ".ydk", toYdk(deck)), done: "Downloaded!" },
        { label: "Omega code", icon: "M8 3a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2H3v2h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2v-2H8v-5a2 2 0 0 0-2-2 2 2 0 0 0 2-2V5h2V3zm6 0a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1v2h-1a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2v-2h2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5h-2V3z", viewBox: "0 0 24 24", run: async (deck) => copyText(await toOmega(deck)), done: "Omega copied!" },
        { label: "YDKE URL", icon: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z", viewBox: "0 0 24 24", run: async (deck) => copyText(toYdke(deck)), done: "YDKE copied!" },
    ];

    let openMenu = null;
    function closeMenu() {
        if (openMenu) openMenu.remove();
        openMenu = null;
    }
    document.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    function showMenu(btn, options, getArg) {
        closeMenu();
        const menu = document.createElement("div");
        Object.assign(menu.style, {
            position: "fixed",
            zIndex: "2147483647",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            padding: "6px",
            minWidth: "170px",
            background: "#0b1120",
            border: "1px solid #334155",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,.5)",
            font: "600 13px/1 Inconsolata, monospace",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
        });

        options.forEach((opt) => {
            const item = document.createElement("button");
            item.type = "button";
            item.innerHTML =
                '<svg width="16" height="16" viewBox="' + opt.viewBox + '" fill="currentColor" style="flex:none"><path d="' + opt.icon + '"/></svg>';
            item.appendChild(document.createTextNode(opt.label));
            Object.assign(item.style, {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textAlign: "left",
                padding: "10px 12px",
                color: "#e2e8f0",
                background: "transparent",
                borderRadius: "6px",
                cursor: "pointer",
            });
            item.onmouseenter = () => (item.style.background = "#7e22ce");
            item.onmouseleave = () => (item.style.background = "transparent");
            item.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const show = (text) => {
                    item.textContent = text;
                    item.style.color = text.startsWith("Error") ? "#f87171" : "#4ade80";
                };
                try {
                    const arg = getArg ? await getArg() : null;
                    const result = await opt.run(arg);
                    show(result || opt.done);
                } catch (err) {
                    show("Error: " + (err && err.message ? err.message : err));
                }
                setTimeout(() => {
                    if (openMenu === menu) closeMenu();
                }, 1800);
            };
            menu.appendChild(item);
        });
        menu.addEventListener("click", (e) => e.stopPropagation());

        document.body.appendChild(menu);
        const r = btn.getBoundingClientRect();
        const left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8);
        const top = r.bottom + 4 + menu.offsetHeight > window.innerHeight ? r.top - menu.offsetHeight - 4 : r.bottom + 4;
        menu.style.left = Math.max(8, left) + "px";
        menu.style.top = Math.max(8, top) + "px";
        openMenu = menu;
    }

    function addButton(del) {
        const actions = del.parentElement;
        const li = del.closest("li");
        if (!actions || !li || actions.querySelector("." + BTN_CLASS)) return;
        const copy = del.previousElementSibling;
        if (!copy || copy.tagName !== "BUTTON") return;

        const btn = copy.cloneNode(true);
        btn.classList.add(BTN_CLASS);
        btn.classList.remove("text-green-400!");
        btn.title = "Export";
        btn.setAttribute("aria-label", "Export");
        const label = btn.querySelector(".button-label");
        if (label) label.textContent = "Export";

        const svg = btn.querySelector("svg");
        if (!svg) return;
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.innerHTML = '<path fill="currentColor" d="' + ICON_DOWNLOAD + '"/>';

        // The current site's button container is a fixed 3-column grid; make room for the 4th button.
        if (actions.classList.contains("grid-cols-3")) {
            actions.style.gridTemplateColumns = "repeat(4, auto)";
        }

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            closeMenu();
            showMenu(btn, OPTIONS, async () => {
                const deck = await resolveDeck(actions, li);
                if (!deck) throw new Error("deck not found");
                return deck;
            });
        });
        actions.insertBefore(btn, del);
    }

    // ---------- Deck editor (/editor/<id>) ----------

    const ICON_UPLOAD = "M5 20h14v-2H5v2zM9 16h6v-6h4l-7-7-7 7h4v6z";
    const ICON_BRACES = OPTIONS[1].icon;
    const ICON_LINK = OPTIONS[2].icon;

    function bytesToIds(bin) {
        const out = [];
        for (let i = 0; i + 4 <= bin.length; i += 4) {
            out.push((bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8) | (bin.charCodeAt(i + 2) << 16) | (bin.charCodeAt(i + 3) << 24)) >>> 0);
        }
        return out;
    }

    function parseYdkeCode(code) {
        const m = code.trim().match(/^ydke:\/\/([^!]*)!([^!]*)!([^!]*)!?/i);
        if (!m) throw new Error("invalid YDKE URL");
        const [main, extra, side] = [m[1], m[2], m[3]].map((s) => bytesToIds(atob(decodeURIComponent(s))));
        return { main, extra, side };
    }

    function parseYdkText(text) {
        const deck = { main: [], extra: [], side: [] };
        let target = null;
        text.replace(/\r/g, "").split("\n").forEach((raw) => {
            const line = raw.trim();
            if (line === "#main") target = deck.main;
            else if (line === "#extra") target = deck.extra;
            else if (line === "!side") target = deck.side;
            else if (line && !line.startsWith("#") && target) {
                const n = parseInt(line, 10);
                if (!isNaN(n)) target.push(n);
            }
        });
        return deck;
    }

    // Omega code: base64 -> raw inflate -> [main+extra count][side count][u32 LE ids]. Extra Deck cards are split out
    // with the editor's own card database, since the code only stores the main+extra total.
    async function parseOmegaCode(code) {
        let bin;
        try {
            bin = atob(code.trim());
        } catch (e) {
            throw new Error("invalid Omega code");
        }
        const packed = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
        let raw;
        try {
            const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
            raw = new Uint8Array(await new Response(stream).arrayBuffer());
        } catch (e) {
            throw new Error("invalid Omega code");
        }
        if (raw.length < 2) throw new Error("invalid Omega code");
        const mainExtraCount = raw[0];
        const sideCount = raw[1];
        let ids = bytesToIds(String.fromCharCode(...raw.subarray(2)));
        if (ids.length < mainExtraCount + sideCount) throw new Error("invalid Omega code");
        ids = ids.slice(0, mainExtraCount + sideCount);
        const isExtra = (id) => {
            const data = window.Engine && Engine.getCardData(id % 1e11);
            return !!(data && data.isExtra());
        };
        const mainExtra = ids.slice(0, mainExtraCount);
        return {
            main: mainExtra.filter((id) => !isExtra(id)),
            extra: mainExtra.filter(isExtra),
            side: ids.slice(mainExtraCount),
        };
    }

    function isEditorPage() {
        return location.pathname.startsWith("/editor/");
    }

    // The editor keeps the deck in memory; updateDeck() syncs it into window.Deck (includes unsaved changes).
    async function getEditorDeck() {
        if (!window.Editor || !window.Deck) throw new Error("editor not ready");
        Editor.updateDeck();
        const nameEl = document.getElementById("editor-deck-name");
        return {
            name: (nameEl && nameEl.textContent.trim()) || "deck",
            main_deck: window.Deck.main.slice(),
            extra_deck: window.Deck.extra.slice(),
            side_deck: window.Deck.side.slice(),
        };
    }

    function pickFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".ydk,text/plain";
            input.style.display = "none";
            input.addEventListener("change", () => {
                const file = input.files && input.files[0];
                input.remove();
                if (!file) return reject(new Error("no file selected"));
                const reader = new FileReader();
                reader.onload = () => resolve({ name: file.name.replace(/\.ydk$/i, ""), text: String(reader.result) });
                reader.onerror = () => reject(new Error("could not read file"));
                reader.readAsText(file);
            });
            document.body.appendChild(input);
            input.click();
        });
    }

    // Replaces the deck open in the editor. Nothing is saved until the user clicks Save.
    function applyToEditor(deck) {
        if (!window.Editor) throw new Error("editor not ready");
        const total = deck.main.length + deck.extra.length + deck.side.length;
        if (total === 0) throw new Error("empty deck");
        if (!confirm("Replace the current deck with the imported one? (You can still Undo, and nothing is saved until you click Save.)")) {
            throw new Error("cancelled");
        }

        // restoringState suppresses one undo step per card; a single step is recorded at the end.
        window.restoringState = true;
        let skipped = 0;
        try {
            Editor.clear();
            ["main", "extra", "side"].forEach((loc) => {
                deck[loc].forEach((id) => {
                    if (Editor.addCard(id, loc, -1, true) === false) skipped++;
                });
            });
        } finally {
            window.restoringState = false;
        }
        Editor.updateCounters();
        Editor.saveState(false);
        return skipped ? "Imported! " + skipped + " card(s) skipped" : "Imported! Click Save";
    }

    const IMPORT_OPTIONS = [
        {
            label: "Upload YDK", icon: ICON_UPLOAD, viewBox: "0 0 24 24",
            run: async () => {
                const file = await pickFile();
                return applyToEditor(parseYdkText(file.text));
            },
        },
        {
            label: "Omega code", icon: ICON_BRACES, viewBox: "0 0 24 24",
            run: async () => {
                const code = prompt("Paste the Omega code:");
                if (!code || !code.trim()) throw new Error("cancelled");
                return applyToEditor(await parseOmegaCode(code));
            },
        },
        {
            label: "YDKE URL", icon: ICON_LINK, viewBox: "0 0 24 24",
            run: async () => {
                const code = prompt("Paste the YDKE URL:");
                if (!code || !code.trim()) throw new Error("cancelled");
                return applyToEditor(parseYdkeCode(code));
            },
        },
    ];

    // Finds the editor's "Test" button so the new buttons can clone its look.
    function findToolbarAnchor() {
        const candidates = Array.from(document.querySelectorAll("button, a, input[type=button], div, span"))
            .filter((el) => !el.closest("#ydke-editor-panel") && !el.classList.contains("ydke-editor-btn"))
            .filter((el) => (el.value || el.textContent || "").trim().toLowerCase() === "test");
        const rank = (el) => (el.tagName === "BUTTON" || el.tagName === "INPUT" ? 0 : el.tagName === "A" ? 1 : 2);
        candidates.sort((a, b) => rank(a) - rank(b) || a.querySelectorAll("*").length - b.querySelectorAll("*").length);
        return candidates[0] || null;
    }

    function makeToolbarButton(anchor, label, options, getArg) {
        const btn = anchor.cloneNode(true);
        btn.removeAttribute("id");
        btn.removeAttribute("onclick");
        btn.removeAttribute("href");
        btn.removeAttribute("disabled");
        btn.classList.add("ydke-editor-btn");
        btn.title = label;
        if (btn.tagName === "INPUT") btn.value = label;
        else btn.textContent = label;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            showMenu(btn, options, getArg);
        });
        return btn;
    }

    function ensureEditorButtons() {
        if (!isEditorPage()) return;
        if (document.querySelector(".ydke-editor-btn")) return;
        const anchor = findToolbarAnchor();
        if (!anchor || !anchor.parentElement) return;
        const exportBtn = makeToolbarButton(anchor, "Export", OPTIONS, getEditorDeck);
        const importBtn = makeToolbarButton(anchor, "Import", IMPORT_OPTIONS, null);
        // The site's buttons are inline and spaced by whitespace text nodes, so add the same.
        anchor.after(document.createTextNode(" "), importBtn, document.createTextNode(" "), exportBtn);
    }

    function scan() {
        ensureEditorButtons();
        // The delete button is the only red button inside a deck card on both sites.
        document.querySelectorAll('li button[class*="text-red-"]').forEach(addButton);
    }

    let scheduled = false;
    new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            scan();
        });
    }).observe(document.body, { childList: true, subtree: true });

    scan();
})();
