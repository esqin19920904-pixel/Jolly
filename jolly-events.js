/* ============================================================
   JOLLY Events
   Store OS Event Bus
   Version: 1.0
============================================================ */

const JollyEvents = (() => {

    const listeners = {};
    const onceListeners = {};
    const history = [];

    let debug = false;
    const MAX_HISTORY = 100;

    function addHistory(name, payload) {
        history.unshift({
            event: name,
            payload,
            time: Date.now()
        });

        if (history.length > MAX_HISTORY) {
            history.pop();
        }
    }

    function on(event, callback) {
        if (!listeners[event]) {
            listeners[event] = [];
        }

        listeners[event].push(callback);
    }

    function once(event, callback) {

        if (!onceListeners[event]) {
            onceListeners[event] = [];
        }

        onceListeners[event].push(callback);
    }

    function off(event, callback) {

        if (!listeners[event]) return;

        listeners[event] =
            listeners[event].filter(fn => fn !== callback);

    }

    function emit(event, payload = {}) {

        addHistory(event, payload);

        if (debug) {
            console.log(
                "[JollyEvents]",
                event,
                payload
            );
        }

        const normal = listeners[event] || [];
        const wildcard = listeners["*"] || [];
        const once = onceListeners[event] || [];

        [...normal, ...wildcard].forEach(fn => {

            try {
                fn(payload, event);
            } catch (e) {
                console.error(
                    "Event Error:",
                    event,
                    e
                );
            }

        });

        once.forEach(fn => {

            try {
                fn(payload, event);
            } catch (e) {
                console.error(e);
            }

        });

        delete onceListeners[event];

    }

    function enableDebug() {
        debug = true;
    }

    function disableDebug() {
        debug = false;
    }

    function getHistory() {
        return [...history];
    }

    function clearHistory() {
        history.length = 0;
    }

    return {

        on,
        once,
        off,
        emit,

        enableDebug,
        disableDebug,

        history: getHistory,
        clearHistory

    };

})();

window.JollyEvents = JollyEvents;
