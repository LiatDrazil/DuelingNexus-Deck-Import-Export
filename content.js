(function () {
    "use strict";

    const BTN_CLASS = "ydke-export-btn";
    const ICON_DOWNLOAD = "M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z";
    const ICON_UPLOAD = "M9 16v-6H5l7-7l7 7h-4v6zm-4 4v-2h14v2z";
    const ICON_OMEGA = "M8 3a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2H3v2h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2v-2H8v-5a2 2 0 0 0-2-2a2 2 0 0 0 2-2V5h2V3m6 0a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1v2h-1a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2v-2h2v-5a2 2 0 0 1 2-2a2 2 0 0 1-2-2V5h-2V3z";
    const ICON_YDKE_LINK = "M10.59 13.41c.41.39.41 1.03 0 1.42c-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0a5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.98 2.98 0 0 0 0-4.24a2.98 2.98 0 0 0-4.24 0l-3.53 3.53a2.98 2.98 0 0 0 0 4.24m2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0a5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82-.12 1.64-.4 2.43l-.47.47a2.98 2.98 0 0 0 0 4.24a2.98 2.98 0 0 0 4.24 0l3.53-3.53a2.98 2.98 0 0 0 0-4.24a.973.973 0 0 1 0-1.42";
    const ICON_PREVIEW = "M12 5c-5 0-9.27 3.11-11 7c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10a5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6a3 3 0 0 0 0 6z";
    const ICON_ADD = "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z";
    const REPLAY_BUTTON_CLASS = "dne-replay-deck-button";

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
        // The current site passes the deck to its Vue 3 actions component.
        let inst = actions.__vueParentComponent;
        for (let i = 0; inst && i < 3; i++, inst = inst.parent) {
            if (inst.props && inst.props.deck) return inst.props.deck;
        }

        // Fallback for when the deck isn't exposed on the component instance.
        const decks = await fetchDeckList();
        const hrefs = Array.from(li.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
        for (const href of hrefs) {
            const m = href.match(/([^/]+)\/?(?:[?#].*)?$/);
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
        { label: "Omega code", icon: ICON_OMEGA, viewBox: "0 0 24 24", run: async (deck) => copyText(await toOmega(deck)), done: "Omega copied!" },
        { label: "YDKE URL", icon: ICON_YDKE_LINK, viewBox: "0 0 24 24", run: async (deck) => copyText(toYdke(deck)), done: "YDKE copied!" },
    ];

    let openMenu = null;
    let activeReplayPreview = null;
    let activeReplayPreviewButton = null;
    let activeReplayCardZoom = null;
    let replayCardDataCache = null;
    const replayDeckCache = new Map();
    function closeMenu() {
        if (openMenu) openMenu.remove();
        openMenu = null;
    }
    document.addEventListener("click", () => {
        closeMenu();
        closeReplayPreview();
    });
    window.addEventListener("scroll", (event) => {
        closeMenu();
        closeReplayCardZoom();
        if (activeReplayPreview && activeReplayPreview.contains(event.target)) return;
        closeReplayPreview();
    }, true);
    window.addEventListener("resize", () => {
        closeMenu();
        closeReplayPreview();
    });

    function showMenu(btn, options, getArg) {
        closeMenu();
        const editorMenu = isEditorPage();
        const menu = document.createElement("div");
        if (editorMenu) {
            Object.assign(menu.style, {
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                minWidth: "190px",
                padding: "6px",
                background: "#111925",
                border: "1px solid #777",
                borderRadius: "3px",
                boxShadow: "0 8px 24px rgba(0,0,0,.45)",
            });
        } else {
            menu.className = "min-w-48 flex flex-col gap-1 p-1.5 rounded-xl border border-line-strong bg-ink-void shadow-lg";
        }
        Object.assign(menu.style, {
            position: "fixed",
            zIndex: "2147483647",
        });

        options.forEach((opt) => {
            const item = document.createElement("button");
            item.type = "button";
            item.innerHTML =
                '<svg width="16" height="16" viewBox="' + opt.viewBox + '" class="iconify iconify--mdi" style="flex:none"><path fill="currentColor" d="' + opt.icon + '"/></svg>';
            item.appendChild(document.createTextNode(opt.label));
            if (editorMenu) {
                Object.assign(item.style, {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxSizing: "border-box",
                    width: "100%",
                    height: "32px",
                    margin: "2px 0",
                    padding: "1px 8px",
                    color: "#f0f0f0",
                    background: "#111925",
                    border: "1px solid #777",
                    borderRadius: "0",
                    fontFamily: '"Helvetica Neue", Helvetica, Verdana, Geneva, sans-serif',
                    fontSize: "14px",
                    fontWeight: "400",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 150ms ease",
                });
                item.onmouseenter = () => (item.style.background = "rgba(64, 64, 64, 0.8)");
                item.onmouseleave = () => (item.style.background = "#111925");
            } else {
                item.className = "flex items-center gap-2 px-3 py-2 rounded-lg font-display text-ui font-bold tracking-wider uppercase text-gray-300 cursor-pointer transition duration-150 ease-out hover:bg-highlight/50 hover:text-paper";
            }
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

    function addButton(copyLink) {
        const actions = copyLink.parentElement;
        const li = copyLink.closest("li");
        const moreActions = actions && actions.querySelector('button[aria-label^="More actions for "]');
        if (!actions || !li || !moreActions || actions.querySelector("." + BTN_CLASS)) return;

        const btn = copyLink.cloneNode(true);
        btn.classList.add(BTN_CLASS);
        const deckName = (copyLink.getAttribute("aria-label") || "").replace(/^Copy link to\s*/, "");
        btn.title = "Export " + deckName;
        btn.setAttribute("aria-label", "Export " + deckName);

        const svg = btn.querySelector("svg");
        if (!svg) return;
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.innerHTML = '<path fill="currentColor" d="' + ICON_DOWNLOAD + '"/>';

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
        actions.insertBefore(btn, moreActions);
    }

    function replayIdFromAnchor(anchor) {
        const url = new URL(anchor.href, location.href);
        const match = url.pathname.match(/^\/replay\/([^/]+)/);
        return match ? match[1] : null;
    }

    function normalizedName(name) {
        return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    }

    async function fetchReplayPlayers(replayId) {
        if (replayDeckCache.has(replayId)) return replayDeckCache.get(replayId);

        const request = (async () => {
            const response = await fetch("/replay/" + encodeURIComponent(replayId), { credentials: "include" });
            if (!response.ok) throw new Error("could not load replay");
            const html = await response.text();
            const hostMatch = html.match(/\bvar\s+Host\s*=\s*["']([^"']+)["']/);
            if (!hostMatch) throw new Error("replay server not found");

            const host = new URL(hostMatch[1]);
            if (host.protocol !== "wss:" || !(host.hostname === "duelingnexus.com" || host.hostname.endsWith(".duelingnexus.com"))) {
                throw new Error("invalid replay server");
            }

            return await new Promise((resolve, reject) => {
                const socket = new WebSocket(host.origin + "/gameserver/");
                const players = new Map();
                let finished = false;
                const timeout = setTimeout(() => finish(new Error("replay data timed out")), 15000);

                const finish = (error, value) => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timeout);
                    if (socket.readyState < WebSocket.CLOSING) socket.close();
                    if (error) reject(error);
                    else resolve(value);
                };

                socket.onopen = () => {
                    socket.send(JSON.stringify({ type: "LoadReplay", replayId }));
                };
                socket.onmessage = (event) => {
                    let message;
                    try {
                        message = JSON.parse(event.data);
                    } catch (error) {
                        finish(new Error("invalid replay response"));
                        return;
                    }

                    if (message.type === "RoomKicked") {
                        finish(new Error(message.message || "replay could not be loaded"));
                        return;
                    }
                    if (message.type === "RoomPlayerJoined" && Array.isArray(message.mainDeck) && Array.isArray(message.extraDeck)) {
                        players.set(Number(message.position), {
                            position: Number(message.position),
                            name: String(message.name || ""),
                            mainDeck: parseSection(message.mainDeck),
                            extraDeck: parseSection(message.extraDeck),
                        });
                    }
                    if (message.type === "GameStart") {
                        const decks = Array.from(players.values()).sort((a, b) => a.position - b.position);
                        if (decks.length < 2) finish(new Error("deck data unavailable"));
                        else finish(null, decks);
                    }
                };
                socket.onerror = () => finish(new Error("could not connect to replay server"));
                socket.onclose = () => {
                    if (!finished) finish(new Error("replay connection closed"));
                };
            });
        })();

        replayDeckCache.set(replayId, request);
        if (replayDeckCache.size > 30) replayDeckCache.delete(replayDeckCache.keys().next().value);
        try {
            return await request;
        } catch (error) {
            if (replayDeckCache.get(replayId) === request) replayDeckCache.delete(replayId);
            throw error;
        }
    }

    async function fetchReplayCardData() {
        if (replayCardDataCache) return replayCardDataCache;

        const request = (async () => {
            const [cardsResponse, namesResponse] = await Promise.all([
                fetch("/assets/data/cards.json", { credentials: "include" }),
                fetch("/assets/data/cards_en.json", { credentials: "include" }),
            ]);
            if (!cardsResponse.ok) throw new Error("could not load card data for sorting");
            if (!namesResponse.ok) throw new Error("could not load card names");
            const [data, localizedData] = await Promise.all([cardsResponse.json(), namesResponse.json()]);
            if (!data || !Array.isArray(data.cards)) throw new Error("invalid card data");
            if (!localizedData || !Array.isArray(localizedData.texts)) throw new Error("invalid card names");

            const names = new Map();
            localizedData.texts.forEach((card) => {
                const id = Number(card && card.id);
                if (Number.isSafeInteger(id) && typeof card.n === "string") names.set(id, card.n);
            });

            const cards = new Map();
            data.cards.forEach((card) => {
                const id = Number(card && card.id);
                if (Number.isSafeInteger(id)) {
                    card.name = names.get(id) || "";
                    cards.set(id, card);
                }
            });
            return cards;
        })();

        replayCardDataCache = request;
        try {
            return await request;
        } catch (error) {
            if (replayCardDataCache === request) replayCardDataCache = null;
            throw error;
        }
    }

    function compareReplayCards(leftId, rightId, cardData) {
        const left = cardData.get(Number(leftId));
        const right = cardData.get(Number(rightId));
        if (!left || !right) {
            if (!left && !right) return Number(leftId) - Number(rightId);
            return left ? -1 : 1;
        }

        const leftType = Number(left.typ) || 0;
        const rightType = Number(right.typ) || 0;
        if ((leftType & 7) !== (rightType & 7)) return (leftType & 7) - (rightType & 7);
        if (leftType & 1) {
            const leftKind = leftType & 75505856 ? leftType & 75505857 : leftType & 49;
            const rightKind = rightType & 75505856 ? rightType & 75505857 : rightType & 49;
            if (leftKind !== rightKind) return leftKind - rightKind;
            const leftLevel = (Number(left.lvl) || 0) & 65535;
            const rightLevel = (Number(right.lvl) || 0) & 65535;
            if (leftLevel !== rightLevel) return rightLevel - leftLevel;
            if (left.atk !== right.atk) return (Number(right.atk) || 0) - (Number(left.atk) || 0);
            if (left.def !== right.def) return (Number(right.def) || 0) - (Number(left.def) || 0);
        } else if ((leftType & 4294967288) !== (rightType & 4294967288)) {
            return (leftType & 4294967288) - (rightType & 4294967288);
        }
        return Number(left.id) - Number(right.id);
    }

    function sortReplayCards(ids, cardData) {
        return ids.slice().sort((left, right) => compareReplayCards(left, right, cardData));
    }

    async function resolveReplayDeck(replayId, side, playerNames, displayName) {
        const players = await fetchReplayPlayers(replayId);
        const cardData = await fetchReplayCardData();
        const wantedNames = (Array.isArray(playerNames) ? playerNames : [playerNames])
            .map(normalizedName)
            .filter(Boolean);
        const matchingPlayer = players.find((candidate) => wantedNames.includes(normalizedName(candidate.name)));
        const positionalPlayer = players.length === 2
            ? players.find((candidate) => candidate.position === side) || players[side]
            : null;
        const player = matchingPlayer || positionalPlayer;
        if (!player) throw new Error("deck not found");

        const mainDeck = sortReplayCards(player.mainDeck, cardData);
        const extraDeck = sortReplayCards(player.extraDeck, cardData);
        const cardNames = {};
        mainDeck.concat(extraDeck).forEach((id) => {
            const card = cardData.get(id);
            if (card && card.name) cardNames[id] = card.name;
        });

        return {
            name: player.name || displayName || "replay deck",
            displayName: displayName || player.name || "replay deck",
            playerName: player.name,
            main_deck: mainDeck,
            extra_deck: extraDeck,
            card_names: cardNames,
            side_deck: [],
        };
    }

    async function addReplayDeckToAccount(deck) {
        const defaultName = deck.displayName || deck.name || (deck.playerName || "Player") + "'s deck";
        const name = prompt("Enter the deck name", defaultName);
        if (name === null) throw new Error("cancelled");
        if (!name.trim()) throw new Error("deck name is required");

        const data = new FormData();
        data.set("name", name.trim());
        data.set("deck", JSON.stringify({
            main: parseSection(deck.main_deck),
            extra: parseSection(deck.extra_deck),
            side: [],
        }));
        const response = await fetch("/api/create-deck.php", {
            method: "post",
            body: data,
            credentials: "include",
        });
        if (!response.ok) throw new Error("could not add the deck to your account (" + response.status + ")");
        return "Deck added to account!";
    }

    function closeReplayCardZoom() {
        if (activeReplayCardZoom) activeReplayCardZoom.remove();
        activeReplayCardZoom = null;
    }

    function showReplayCardZoom(image) {
        closeReplayCardZoom();
        if (!image.src || (image.complete && !image.naturalWidth)) return;

        const zoom = document.createElement("img");
        const width = Math.max(1, Math.min(180, window.innerWidth - 16, (window.innerHeight - 16) * 59 / 86));
        const height = width * 86 / 59;
        zoom.src = image.currentSrc || image.src;
        zoom.alt = image.alt;
        zoom.setAttribute("aria-hidden", "true");
        Object.assign(zoom.style, {
            position: "fixed",
            zIndex: "2147483647",
            boxSizing: "border-box",
            width: width + "px",
            height: height + "px",
            objectFit: "contain",
            background: "#111925",
            border: "1px solid #4b5563",
            borderRadius: "6px",
            boxShadow: "0 8px 24px rgba(0,0,0,.65)",
            pointerEvents: "none",
        });
        zoom.onerror = () => {
            if (activeReplayCardZoom === zoom) closeReplayCardZoom();
        };
        document.body.appendChild(zoom);
        activeReplayCardZoom = zoom;

        const cardRect = image.getBoundingClientRect();
        const right = cardRect.right + 8;
        const left = right + width <= window.innerWidth - 8
            ? right
            : cardRect.left - width - 8;
        zoom.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + "px";
        zoom.style.top = Math.max(8, Math.min(cardRect.top, window.innerHeight - height - 8)) + "px";
    }

    function closeReplayPreview() {
        closeReplayCardZoom();
        if (activeReplayPreview) activeReplayPreview.remove();
        if (activeReplayPreviewButton) activeReplayPreviewButton.setAttribute("aria-expanded", "false");
        activeReplayPreview = null;
        activeReplayPreviewButton = null;
    }

    function positionReplayPreview(button, preview, side) {
        const buttonRect = button.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        const left = side === 0 ? buttonRect.left : buttonRect.right - previewRect.width;
        const top = buttonRect.bottom + previewRect.height + 4 <= window.innerHeight
            ? buttonRect.bottom + 2
            : Math.max(8, buttonRect.top - previewRect.height - 2);
        preview.style.left = Math.max(8, Math.min(left, window.innerWidth - previewRect.width - 8)) + "px";
        preview.style.top = top + "px";
    }

    function renderReplayPreview(preview, deck) {
        const title = document.createElement("div");
        title.textContent = deck.displayName || deck.playerName || "Replay deck";
        Object.assign(title.style, {
            overflow: "hidden",
            color: "#f3f4f6",
            fontSize: "13px",
            fontWeight: "700",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        });

        const subtitle = document.createElement("div");
        subtitle.textContent = deck.playerName || "";
        Object.assign(subtitle.style, { color: "#9ca3af", fontSize: "11px", marginTop: "2px" });

        const actions = document.createElement("div");
        Object.assign(actions.style, {
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "6px",
            marginTop: "10px",
        });
        const status = document.createElement("div");
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        Object.assign(status.style, { minHeight: "14px", marginTop: "6px", color: "#9ca3af", fontSize: "11px" });
        const actionOptions = [
            ...OPTIONS,
            { label: "Add to account", icon: ICON_ADD, viewBox: "0 0 24 24", run: addReplayDeckToAccount, done: "Deck added to account!" },
        ];
        actionOptions.forEach((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.setAttribute("aria-label", option.label);
            button.innerHTML =
                '<svg width="15" height="15" viewBox="' + option.viewBox + '" aria-hidden="true"><path fill="currentColor" d="' + option.icon + '"/></svg>';
            const label = document.createElement("span");
            label.textContent = option.label;
            button.appendChild(label);
            Object.assign(button.style, {
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: "7px",
                minWidth: "0",
                minHeight: "32px",
                padding: "5px 8px",
                color: "#d1d5db",
                background: "#1f2937",
                border: "1px solid #4b5563",
                borderRadius: "5px",
                fontFamily: '"Helvetica Neue", Helvetica, Verdana, Geneva, sans-serif',
                fontSize: "11px",
                textAlign: "left",
                cursor: "pointer",
            });
            button.addEventListener("mouseenter", () => (button.style.background = "#374151"));
            button.addEventListener("mouseleave", () => (button.style.background = "#1f2937"));
            button.addEventListener("click", async (event) => {
                event.stopPropagation();
                event.preventDefault();
                button.disabled = true;
                label.textContent = "Working...";
                try {
                    status.textContent = (await option.run(deck)) || option.done;
                    status.style.color = "#4ade80";
                } catch (error) {
                    status.textContent = error && error.message === "cancelled"
                        ? ""
                        : "Error: " + (error && error.message ? error.message : error);
                    status.style.color = "#f87171";
                } finally {
                    button.disabled = false;
                    label.textContent = option.label;
                }
            });
            actions.appendChild(button);
        });

        const createSection = (label, ids) => {
            const section = document.createElement("section");
            Object.assign(section.style, { marginTop: "10px" });

            const heading = document.createElement("div");
            heading.textContent = label + " (" + ids.length + ")";
            Object.assign(heading.style, {
                color: "#d1d5db",
                fontSize: "11px",
                fontWeight: "700",
                marginBottom: "6px",
            });

            const grid = document.createElement("div");
            Object.assign(grid.style, {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))",
                gap: "5px",
            });
            if (!ids.length) {
                const empty = document.createElement("div");
                empty.textContent = "No cards";
                Object.assign(empty.style, { color: "#9ca3af", fontSize: "12px", gridColumn: "1 / -1", padding: "12px 0" });
                grid.appendChild(empty);
            } else {
                ids.forEach((id) => {
                    const cell = document.createElement("div");
                    Object.assign(cell.style, {
                        aspectRatio: "59 / 86",
                        overflow: "hidden",
                        borderRadius: "4px",
                        background: "#0b111b",
                    });
                    const image = document.createElement("img");
                    image.src = "https://ygopro.online/assets/card-images/common/" + id + ".jpg";
                    const cardName = deck.card_names && deck.card_names[id] || "Card ID: " + id;
                    image.alt = cardName;
                    image.loading = "lazy";
                    Object.assign(image.style, { display: "block", width: "100%", height: "100%", objectFit: "cover" });
                    cell.style.cursor = "zoom-in";
                    cell.addEventListener("mouseenter", () => showReplayCardZoom(image));
                    cell.addEventListener("mouseleave", closeReplayCardZoom);
                    image.onerror = () => {
                        const fallback = document.createElement("span");
                        fallback.textContent = String(id);
                        Object.assign(fallback.style, {
                            display: "grid",
                            width: "100%",
                            height: "100%",
                            placeItems: "center",
                            color: "#9ca3af",
                            fontSize: "10px",
                        });
                        cell.replaceChildren(fallback);
                    };
                    cell.appendChild(image);
                    grid.appendChild(cell);
                });
            }

            section.append(heading, grid);
            return section;
        };

        preview.replaceChildren(
            title,
            subtitle,
            actions,
            status,
            createSection("Main Deck", parseSection(deck.main_deck)),
            createSection("Extra Deck", parseSection(deck.extra_deck))
        );
    }

    function showReplayPreview(button, getDeck, side) {
        closeReplayPreview();
        const preview = document.createElement("div");
        preview.className = "dne-replay-deck-preview";
        preview.setAttribute("role", "dialog");
        preview.setAttribute("aria-label", "Replay deck preview");
        Object.assign(preview.style, {
            position: "fixed",
            zIndex: "2147483647",
            boxSizing: "border-box",
            width: "460px",
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "calc(100vh - 16px)",
            overflow: "auto",
            padding: "10px",
            color: "#f3f4f6",
            background: "#111925",
            border: "1px solid #4b5563",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,.55)",
            fontFamily: '"Helvetica Neue", Helvetica, Verdana, Geneva, sans-serif',
        });
        preview.textContent = "Loading deck preview...";
        preview.addEventListener("click", (event) => event.stopPropagation());
        document.body.appendChild(preview);
        activeReplayPreview = preview;
        activeReplayPreviewButton = button;
        button.setAttribute("aria-expanded", "true");
        positionReplayPreview(button, preview, side);

        const deckPromise = typeof getDeck === "function" ? getDeck() : getDeck;
        Promise.resolve(deckPromise).then((deck) => {
            if (activeReplayPreview !== preview) return;
            preview.setAttribute("aria-label", (deck.displayName || deck.playerName || "Replay deck") + " preview");
            renderReplayPreview(preview, deck);
            positionReplayPreview(button, preview, side);
        }).catch((error) => {
            if (activeReplayPreview !== preview) return;
            preview.textContent = "Preview unavailable: " + (error && error.message ? error.message : error);
            preview.style.color = "#fca5a5";
            positionReplayPreview(button, preview, side);
        });
    }

    function makeReplayDeckButton(replayId, side, playerName, displayName) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = REPLAY_BUTTON_CLASS + " inline-flex items-center justify-center gap-2 font-display font-bold tracking-wider uppercase rounded-lg whitespace-nowrap cursor-pointer transition duration-150 ease-out disabled:opacity-45 disabled:cursor-not-allowed not-disabled:active:scale-[0.97] w-7 h-7 p-0 bg-transparent text-gray-300 border border-transparent not-disabled:hover:bg-highlight/50 not-disabled:hover:text-paper";
        button.setAttribute("aria-label", "Preview and export " + displayName);
        button.setAttribute("aria-expanded", "false");
        button.title = "Preview and export " + displayName;
        button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="' + ICON_PREVIEW + '"/></svg>';
        Object.assign(button.style, {
            position: "relative",
            zIndex: "11",
            display: "inline-flex",
            flex: "none",
            alignItems: "center",
            justifyContent: "center",
            padding: "0",
        });
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            closeMenu();
            if (activeReplayPreviewButton === button) {
                closeReplayPreview();
                return;
            }
            showReplayPreview(button, () => resolveReplayDeck(replayId, side, playerName, displayName), side);
        });
        return button;
    }

    function addReplayDeckButtons(anchor) {
        const li = anchor.closest("li");
        if (!li) return;
        const description = Array.from(li.querySelectorAll("p")).find((item) => /\s+vs\s+/i.test(item.textContent));
        if (!description || description.querySelector("." + REPLAY_BUTTON_CLASS)) return;
        const replayId = replayIdFromAnchor(anchor);
        if (!replayId) return;

        const labels = description.textContent.trim().split(/\s+vs\s+/i);
        if (labels.length < 2) return;
        const leftLabel = labels.shift().trim();
        const rightLabel = labels.join(" vs ").trim();
        if (!leftLabel || !rightLabel) return;
        const playerNameGroups = Array.from(anchor.children)
            .filter((item) => item.tagName === "SPAN" && item.textContent.trim().toLowerCase() !== "vs")
            .slice(0, 2)
            .map((group) => {
                const names = Array.from(group.querySelectorAll("span.truncate"))
                    .map((item) => item.textContent.trim())
                    .filter(Boolean);
                return names.length ? names : [group.textContent.trim()];
            });

        const makeGroup = (side, label, playerName) => {
            const group = document.createElement("span");
            Object.assign(group.style, {
                position: "relative",
                zIndex: "11",
                display: "flex",
                flex: "0 1 auto",
                minWidth: "0",
                alignItems: "center",
                gap: "4px",
            });
            const name = document.createElement("span");
            name.textContent = label;
            name.title = label;
            Object.assign(name.style, {
                minWidth: "0",
                overflow: "hidden",
                color: "#6b7280",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            });
            const button = makeReplayDeckButton(replayId, side, playerNameGroups[side] || [], label);
            group.append(button, name);
            return group;
        };

        const separator = document.createElement("span");
        separator.textContent = "vs";
        Object.assign(separator.style, { flex: "none", color: "#9ca3af", fontWeight: "700", padding: "0 2px" });

        Object.assign(description.style, {
            position: "relative",
            zIndex: "11",
            display: "flex",
            width: "100%",
            minWidth: "0",
            alignItems: "center",
            gap: "4px",
            overflow: "hidden",
        });
        description.replaceChildren(
            makeGroup(0, leftLabel, playerNameGroups[0] || []),
            separator,
            makeGroup(1, rightLabel, playerNameGroups[1] || [])
        );
    }

    // ---------- Deck editor (/editor/<id>) ----------

    const ICON_BRACES = ICON_OMEGA;
    const ICON_LINK = ICON_YDKE_LINK;

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
        document.querySelectorAll('li button[aria-label^="Copy link to "]').forEach(addButton);
        if (location.pathname === "/replays" || location.pathname === "/replays/") {
            document.querySelectorAll('li a[href*="/replay/"]').forEach(addReplayDeckButtons);
        }
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
