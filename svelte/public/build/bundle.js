
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty$1() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    const id = writable(localStorage.getItem("id") || 0);
    id.subscribe((val) => localStorage.setItem("id", val));

    const logged = writable(localStorage.getItem("logged") || "false");
    logged.subscribe((val) => localStorage.setItem("logged", val));

    const intra = writable(localStorage.getItem("intra") || "false");
    intra.subscribe((val) => localStorage.setItem("intra", val));

    const TWOFA = writable(localStorage.getItem("TWOFA") || "false");
    TWOFA.subscribe((val) => localStorage.setItem("TWOFA", val));

    const level = writable(localStorage.getItem("level") || 0);
    level.subscribe((val) => localStorage.setItem("level", val));

    const losses = writable(localStorage.getItem("losses") || 0);
    losses.subscribe((val) => localStorage.setItem("losses", val));

    const wins = writable(localStorage.getItem("wins") || 0);
    wins.subscribe((val) => localStorage.setItem("wins", val));

    const username = writable(localStorage.getItem("username") || "player");
    username.subscribe((val) => localStorage.setItem("username", val));

    const username42 = writable(localStorage.getItem("username42") || "player");
    username42.subscribe((val) => localStorage.setItem("username42", val));

    const image_url = writable(localStorage.getItem("image_url") || "img/default_profile.png");
    image_url.subscribe((val) => localStorage.setItem("image_url", val));

    const firstname = writable(localStorage.getItem("firstname") || "");
    firstname.subscribe((val) => localStorage.setItem("firstname", val));

    const lastname = writable(localStorage.getItem("lastname") || "");
    lastname.subscribe((val) => localStorage.setItem("lastname", val));

    const cookie = writable(localStorage.getItem("cookie") || "");
    cookie.subscribe((val) => localStorage.setItem("cookie", val));

    const email = writable(localStorage.getItem("email") || "");
    email.subscribe((val) => localStorage.setItem("email", val));

    const ownmail = writable(localStorage.getItem("ownmail") || "");
    ownmail.subscribe((val) => localStorage.setItem("ownmail", val));

    const currentChat = writable(localStorage.getItem("currentChat") || "");
    currentChat.subscribe((val) => localStorage.setItem("currentChat", val));

    const currentProfile = writable(localStorage.getItem("currentProfile") || "");
    currentProfile.subscribe((val) => localStorage.setItem("currentProfile", val));

    const currentPage = writable(localStorage.getItem("currentPage") || "");
    currentPage.subscribe((val) => localStorage.setItem("currentPage", val));

    const otherUser = writable(localStorage.getItem("otherUser") || '');
    otherUser.subscribe((val) => localStorage.setItem("otherUser", val));

    const invitedPlayer = writable(localStorage.getItem("invitedPlayer") || '');
    invitedPlayer.subscribe((val) => localStorage.setItem("invitedPlayer", val));

    const invitation = writable(localStorage.getItem("invitation") || 'false');
    invitation.subscribe((val) => localStorage.setItem("invitation", val));

    const refresh = writable(localStorage.getItem("refresh") || '');
    refresh.subscribe((val) => localStorage.setItem("refresh", val));

    /**
     * @typedef {Object} WrappedComponent Object returned by the `wrap` method
     * @property {SvelteComponent} component - Component to load (this is always asynchronous)
     * @property {RoutePrecondition[]} [conditions] - Route pre-conditions to validate
     * @property {Object} [props] - Optional dictionary of static props
     * @property {Object} [userData] - Optional user data dictionary
     * @property {bool} _sveltesparouter - Internal flag; always set to true
     */

    /**
     * @callback AsyncSvelteComponent
     * @returns {Promise<SvelteComponent>} Returns a Promise that resolves with a Svelte component
     */

    /**
     * @callback RoutePrecondition
     * @param {RouteDetail} detail - Route detail object
     * @returns {boolean|Promise<boolean>} If the callback returns a false-y value, it's interpreted as the precondition failed, so it aborts loading the component (and won't process other pre-condition callbacks)
     */

    /**
     * @typedef {Object} WrapOptions Options object for the call to `wrap`
     * @property {SvelteComponent} [component] - Svelte component to load (this is incompatible with `asyncComponent`)
     * @property {AsyncSvelteComponent} [asyncComponent] - Function that returns a Promise that fulfills with a Svelte component (e.g. `{asyncComponent: () => import('Foo.svelte')}`)
     * @property {SvelteComponent} [loadingComponent] - Svelte component to be displayed while the async route is loading (as a placeholder); when unset or false-y, no component is shown while component
     * @property {object} [loadingParams] - Optional dictionary passed to the `loadingComponent` component as params (for an exported prop called `params`)
     * @property {object} [userData] - Optional object that will be passed to events such as `routeLoading`, `routeLoaded`, `conditionsFailed`
     * @property {object} [props] - Optional key-value dictionary of static props that will be passed to the component. The props are expanded with {...props}, so the key in the dictionary becomes the name of the prop.
     * @property {RoutePrecondition[]|RoutePrecondition} [conditions] - Route pre-conditions to add, which will be executed in order
     */

    /**
     * Wraps a component to enable multiple capabilities:
     * 1. Using dynamically-imported component, with (e.g. `{asyncComponent: () => import('Foo.svelte')}`), which also allows bundlers to do code-splitting.
     * 2. Adding route pre-conditions (e.g. `{conditions: [...]}`)
     * 3. Adding static props that are passed to the component
     * 4. Adding custom userData, which is passed to route events (e.g. route loaded events) or to route pre-conditions (e.g. `{userData: {foo: 'bar}}`)
     * 
     * @param {WrapOptions} args - Arguments object
     * @returns {WrappedComponent} Wrapped component
     */
    function wrap$1(args) {
        if (!args) {
            throw Error('Parameter args is required')
        }

        // We need to have one and only one of component and asyncComponent
        // This does a "XNOR"
        if (!args.component == !args.asyncComponent) {
            throw Error('One and only one of component and asyncComponent is required')
        }

        // If the component is not async, wrap it into a function returning a Promise
        if (args.component) {
            args.asyncComponent = () => Promise.resolve(args.component);
        }

        // Parameter asyncComponent and each item of conditions must be functions
        if (typeof args.asyncComponent != 'function') {
            throw Error('Parameter asyncComponent must be a function')
        }
        if (args.conditions) {
            // Ensure it's an array
            if (!Array.isArray(args.conditions)) {
                args.conditions = [args.conditions];
            }
            for (let i = 0; i < args.conditions.length; i++) {
                if (!args.conditions[i] || typeof args.conditions[i] != 'function') {
                    throw Error('Invalid parameter conditions[' + i + ']')
                }
            }
        }

        // Check if we have a placeholder component
        if (args.loadingComponent) {
            args.asyncComponent.loading = args.loadingComponent;
            args.asyncComponent.loadingParams = args.loadingParams || undefined;
        }

        // Returns an object that contains all the functions to execute too
        // The _sveltesparouter flag is to confirm the object was created by this router
        const obj = {
            component: args.asyncComponent,
            userData: args.userData,
            conditions: (args.conditions && args.conditions.length) ? args.conditions : undefined,
            props: (args.props && Object.keys(args.props).length) ? args.props : {},
            _sveltesparouter: true
        };

        return obj
    }

    function parse$1(str, loose) {
    	if (str instanceof RegExp) return { keys:false, pattern:str };
    	var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
    	arr[0] || arr.shift();

    	while (tmp = arr.shift()) {
    		c = tmp[0];
    		if (c === '*') {
    			keys.push('wild');
    			pattern += '/(.*)';
    		} else if (c === ':') {
    			o = tmp.indexOf('?', 1);
    			ext = tmp.indexOf('.', 1);
    			keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
    			pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
    			if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    		} else {
    			pattern += '/' + tmp;
    		}
    	}

    	return {
    		keys: keys,
    		pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
    	};
    }

    /* node_modules/svelte-spa-router/Router.svelte generated by Svelte v3.49.0 */

    const { Error: Error_1$1, Object: Object_1, console: console_1 } = globals;

    // (251:0) {:else}
    function create_else_block$6(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*props*/ 4)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$6.name,
    		type: "else",
    		source: "(251:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (244:0) {#if componentParams}
    function create_if_block$6(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [{ params: /*componentParams*/ ctx[1] }, /*props*/ ctx[2]];
    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    		switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*componentParams, props*/ 6)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
    					dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(244:0) {#if componentParams}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$6, create_else_block$6];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*componentParams*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		l: function claim(nodes) {
    			throw new Error_1$1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function wrap(component, userData, ...conditions) {
    	// Use the new wrap method and show a deprecation warning
    	// eslint-disable-next-line no-console
    	console.warn('Method `wrap` from `svelte-spa-router` is deprecated and will be removed in a future version. Please use `svelte-spa-router/wrap` instead. See http://bit.ly/svelte-spa-router-upgrading');

    	return wrap$1({ component, userData, conditions });
    }

    /**
     * @typedef {Object} Location
     * @property {string} location - Location (page/view), for example `/book`
     * @property {string} [querystring] - Querystring from the hash, as a string not parsed
     */
    /**
     * Returns the current location from the hash.
     *
     * @returns {Location} Location object
     * @private
     */
    function getLocation() {
    	const hashPosition = window.location.href.indexOf('#/');

    	let location = hashPosition > -1
    	? window.location.href.substr(hashPosition + 1)
    	: '/';

    	// Check if there's a querystring
    	const qsPosition = location.indexOf('?');

    	let querystring = '';

    	if (qsPosition > -1) {
    		querystring = location.substr(qsPosition + 1);
    		location = location.substr(0, qsPosition);
    	}

    	return { location, querystring };
    }

    const loc = readable(null, // eslint-disable-next-line prefer-arrow-callback
    function start(set) {
    	set(getLocation());

    	const update = () => {
    		set(getLocation());
    	};

    	window.addEventListener('hashchange', update, false);

    	return function stop() {
    		window.removeEventListener('hashchange', update, false);
    	};
    });

    const location$1 = derived(loc, $loc => $loc.location);
    const querystring = derived(loc, $loc => $loc.querystring);
    const params = writable(undefined);

    async function push(location) {
    	if (!location || location.length < 1 || location.charAt(0) != '/' && location.indexOf('#/') !== 0) {
    		throw Error('Invalid parameter location');
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	// Note: this will include scroll state in history even when restoreScrollState is false
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	window.location.hash = (location.charAt(0) == '#' ? '' : '#') + location;
    }

    async function pop() {
    	// Execute this code when the current call stack is complete
    	await tick();

    	window.history.back();
    }

    async function replace(location) {
    	if (!location || location.length < 1 || location.charAt(0) != '/' && location.indexOf('#/') !== 0) {
    		throw Error('Invalid parameter location');
    	}

    	// Execute this code when the current call stack is complete
    	await tick();

    	const dest = (location.charAt(0) == '#' ? '' : '#') + location;

    	try {
    		const newState = { ...history.state };
    		delete newState['__svelte_spa_router_scrollX'];
    		delete newState['__svelte_spa_router_scrollY'];
    		window.history.replaceState(newState, undefined, dest);
    	} catch(e) {
    		// eslint-disable-next-line no-console
    		console.warn('Caught exception while replacing the current page. If you\'re running this in the Svelte REPL, please note that the `replace` method might not work in this environment.');
    	}

    	// The method above doesn't trigger the hashchange event, so let's do that manually
    	window.dispatchEvent(new Event('hashchange'));
    }

    function link(node, opts) {
    	opts = linkOpts(opts);

    	// Only apply to <a> tags
    	if (!node || !node.tagName || node.tagName.toLowerCase() != 'a') {
    		throw Error('Action "link" can only be used with <a> tags');
    	}

    	updateLink(node, opts);

    	return {
    		update(updated) {
    			updated = linkOpts(updated);
    			updateLink(node, updated);
    		}
    	};
    }

    // Internal function used by the link function
    function updateLink(node, opts) {
    	let href = opts.href || node.getAttribute('href');

    	// Destination must start with '/' or '#/'
    	if (href && href.charAt(0) == '/') {
    		// Add # to the href attribute
    		href = '#' + href;
    	} else if (!href || href.length < 2 || href.slice(0, 2) != '#/') {
    		throw Error('Invalid value for "href" attribute: ' + href);
    	}

    	node.setAttribute('href', href);

    	node.addEventListener('click', event => {
    		// Prevent default anchor onclick behaviour
    		event.preventDefault();

    		if (!opts.disabled) {
    			scrollstateHistoryHandler(event.currentTarget.getAttribute('href'));
    		}
    	});
    }

    // Internal function that ensures the argument of the link action is always an object
    function linkOpts(val) {
    	if (val && typeof val == 'string') {
    		return { href: val };
    	} else {
    		return val || {};
    	}
    }

    /**
     * The handler attached to an anchor tag responsible for updating the
     * current history state with the current scroll state
     *
     * @param {string} href - Destination
     */
    function scrollstateHistoryHandler(href) {
    	// Setting the url (3rd arg) to href will break clicking for reasons, so don't try to do that
    	history.replaceState(
    		{
    			...history.state,
    			__svelte_spa_router_scrollX: window.scrollX,
    			__svelte_spa_router_scrollY: window.scrollY
    		},
    		undefined,
    		undefined
    	);

    	// This will force an update as desired, but this time our scroll state will be attached
    	window.location.hash = href;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, []);
    	let { routes = {} } = $$props;
    	let { prefix = '' } = $$props;
    	let { restoreScrollState = false } = $$props;

    	/**
     * Container for a route: path, component
     */
    	class RouteItem {
    		/**
     * Initializes the object and creates a regular expression from the path, using regexparam.
     *
     * @param {string} path - Path to the route (must start with '/' or '*')
     * @param {SvelteComponent|WrappedComponent} component - Svelte component for the route, optionally wrapped
     */
    		constructor(path, component) {
    			if (!component || typeof component != 'function' && (typeof component != 'object' || component._sveltesparouter !== true)) {
    				throw Error('Invalid component object');
    			}

    			// Path must be a regular or expression, or a string starting with '/' or '*'
    			if (!path || typeof path == 'string' && (path.length < 1 || path.charAt(0) != '/' && path.charAt(0) != '*') || typeof path == 'object' && !(path instanceof RegExp)) {
    				throw Error('Invalid value for "path" argument - strings must start with / or *');
    			}

    			const { pattern, keys } = parse$1(path);
    			this.path = path;

    			// Check if the component is wrapped and we have conditions
    			if (typeof component == 'object' && component._sveltesparouter === true) {
    				this.component = component.component;
    				this.conditions = component.conditions || [];
    				this.userData = component.userData;
    				this.props = component.props || {};
    			} else {
    				// Convert the component to a function that returns a Promise, to normalize it
    				this.component = () => Promise.resolve(component);

    				this.conditions = [];
    				this.props = {};
    			}

    			this._pattern = pattern;
    			this._keys = keys;
    		}

    		/**
     * Checks if `path` matches the current route.
     * If there's a match, will return the list of parameters from the URL (if any).
     * In case of no match, the method will return `null`.
     *
     * @param {string} path - Path to test
     * @returns {null|Object.<string, string>} List of paramters from the URL if there's a match, or `null` otherwise.
     */
    		match(path) {
    			// If there's a prefix, check if it matches the start of the path.
    			// If not, bail early, else remove it before we run the matching.
    			if (prefix) {
    				if (typeof prefix == 'string') {
    					if (path.startsWith(prefix)) {
    						path = path.substr(prefix.length) || '/';
    					} else {
    						return null;
    					}
    				} else if (prefix instanceof RegExp) {
    					const match = path.match(prefix);

    					if (match && match[0]) {
    						path = path.substr(match[0].length) || '/';
    					} else {
    						return null;
    					}
    				}
    			}

    			// Check if the pattern matches
    			const matches = this._pattern.exec(path);

    			if (matches === null) {
    				return null;
    			}

    			// If the input was a regular expression, this._keys would be false, so return matches as is
    			if (this._keys === false) {
    				return matches;
    			}

    			const out = {};
    			let i = 0;

    			while (i < this._keys.length) {
    				// In the match parameters, URL-decode all values
    				try {
    					out[this._keys[i]] = decodeURIComponent(matches[i + 1] || '') || null;
    				} catch(e) {
    					out[this._keys[i]] = null;
    				}

    				i++;
    			}

    			return out;
    		}

    		/**
     * Dictionary with route details passed to the pre-conditions functions, as well as the `routeLoading`, `routeLoaded` and `conditionsFailed` events
     * @typedef {Object} RouteDetail
     * @property {string|RegExp} route - Route matched as defined in the route definition (could be a string or a reguar expression object)
     * @property {string} location - Location path
     * @property {string} querystring - Querystring from the hash
     * @property {object} [userData] - Custom data passed by the user
     * @property {SvelteComponent} [component] - Svelte component (only in `routeLoaded` events)
     * @property {string} [name] - Name of the Svelte component (only in `routeLoaded` events)
     */
    		/**
     * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
     * 
     * @param {RouteDetail} detail - Route detail
     * @returns {boolean} Returns true if all the conditions succeeded
     */
    		async checkConditions(detail) {
    			for (let i = 0; i < this.conditions.length; i++) {
    				if (!await this.conditions[i](detail)) {
    					return false;
    				}
    			}

    			return true;
    		}
    	}

    	// Set up all routes
    	const routesList = [];

    	if (routes instanceof Map) {
    		// If it's a map, iterate on it right away
    		routes.forEach((route, path) => {
    			routesList.push(new RouteItem(path, route));
    		});
    	} else {
    		// We have an object, so iterate on its own properties
    		Object.keys(routes).forEach(path => {
    			routesList.push(new RouteItem(path, routes[path]));
    		});
    	}

    	// Props for the component to render
    	let component = null;

    	let componentParams = null;
    	let props = {};

    	// Event dispatcher from Svelte
    	const dispatch = createEventDispatcher();

    	// Just like dispatch, but executes on the next iteration of the event loop
    	async function dispatchNextTick(name, detail) {
    		// Execute this code when the current call stack is complete
    		await tick();

    		dispatch(name, detail);
    	}

    	// If this is set, then that means we have popped into this var the state of our last scroll position
    	let previousScrollState = null;

    	let popStateChanged = null;

    	if (restoreScrollState) {
    		popStateChanged = event => {
    			// If this event was from our history.replaceState, event.state will contain
    			// our scroll history. Otherwise, event.state will be null (like on forward
    			// navigation)
    			if (event.state && event.state.__svelte_spa_router_scrollY) {
    				previousScrollState = event.state;
    			} else {
    				previousScrollState = null;
    			}
    		};

    		// This is removed in the destroy() invocation below
    		window.addEventListener('popstate', popStateChanged);

    		afterUpdate(() => {
    			// If this exists, then this is a back navigation: restore the scroll position
    			if (previousScrollState) {
    				window.scrollTo(previousScrollState.__svelte_spa_router_scrollX, previousScrollState.__svelte_spa_router_scrollY);
    			} else {
    				// Otherwise this is a forward navigation: scroll to top
    				window.scrollTo(0, 0);
    			}
    		});
    	}

    	// Always have the latest value of loc
    	let lastLoc = null;

    	// Current object of the component loaded
    	let componentObj = null;

    	// Handle hash change events
    	// Listen to changes in the $loc store and update the page
    	// Do not use the $: syntax because it gets triggered by too many things
    	const unsubscribeLoc = loc.subscribe(async newLoc => {
    		lastLoc = newLoc;

    		// Find a route matching the location
    		let i = 0;

    		while (i < routesList.length) {
    			const match = routesList[i].match(newLoc.location);

    			if (!match) {
    				i++;
    				continue;
    			}

    			const detail = {
    				route: routesList[i].path,
    				location: newLoc.location,
    				querystring: newLoc.querystring,
    				userData: routesList[i].userData,
    				params: match && typeof match == 'object' && Object.keys(match).length
    				? match
    				: null
    			};

    			// Check if the route can be loaded - if all conditions succeed
    			if (!await routesList[i].checkConditions(detail)) {
    				// Don't display anything
    				$$invalidate(0, component = null);

    				componentObj = null;

    				// Trigger an event to notify the user, then exit
    				dispatchNextTick('conditionsFailed', detail);

    				return;
    			}

    			// Trigger an event to alert that we're loading the route
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick('routeLoading', Object.assign({}, detail));

    			// If there's a component to show while we're loading the route, display it
    			const obj = routesList[i].component;

    			// Do not replace the component if we're loading the same one as before, to avoid the route being unmounted and re-mounted
    			if (componentObj != obj) {
    				if (obj.loading) {
    					$$invalidate(0, component = obj.loading);
    					componentObj = obj;
    					$$invalidate(1, componentParams = obj.loadingParams);
    					$$invalidate(2, props = {});

    					// Trigger the routeLoaded event for the loading component
    					// Create a copy of detail so we don't modify the object for the dynamic route (and the dynamic route doesn't modify our object too)
    					dispatchNextTick('routeLoaded', Object.assign({}, detail, {
    						component,
    						name: component.name,
    						params: componentParams
    					}));
    				} else {
    					$$invalidate(0, component = null);
    					componentObj = null;
    				}

    				// Invoke the Promise
    				const loaded = await obj();

    				// Now that we're here, after the promise resolved, check if we still want this component, as the user might have navigated to another page in the meanwhile
    				if (newLoc != lastLoc) {
    					// Don't update the component, just exit
    					return;
    				}

    				// If there is a "default" property, which is used by async routes, then pick that
    				$$invalidate(0, component = loaded && loaded.default || loaded);

    				componentObj = obj;
    			}

    			// Set componentParams only if we have a match, to avoid a warning similar to `<Component> was created with unknown prop 'params'`
    			// Of course, this assumes that developers always add a "params" prop when they are expecting parameters
    			if (match && typeof match == 'object' && Object.keys(match).length) {
    				$$invalidate(1, componentParams = match);
    			} else {
    				$$invalidate(1, componentParams = null);
    			}

    			// Set static props, if any
    			$$invalidate(2, props = routesList[i].props);

    			// Dispatch the routeLoaded event then exit
    			// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
    			dispatchNextTick('routeLoaded', Object.assign({}, detail, {
    				component,
    				name: component.name,
    				params: componentParams
    			})).then(() => {
    				params.set(componentParams);
    			});

    			return;
    		}

    		// If we're still here, there was no match, so show the empty component
    		$$invalidate(0, component = null);

    		componentObj = null;
    		params.set(undefined);
    	});

    	onDestroy(() => {
    		unsubscribeLoc();
    		popStateChanged && window.removeEventListener('popstate', popStateChanged);
    	});

    	const writable_props = ['routes', 'prefix', 'restoreScrollState'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	function routeEvent_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function routeEvent_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('routes' in $$props) $$invalidate(3, routes = $$props.routes);
    		if ('prefix' in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ('restoreScrollState' in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    	};

    	$$self.$capture_state = () => ({
    		readable,
    		writable,
    		derived,
    		tick,
    		_wrap: wrap$1,
    		wrap,
    		getLocation,
    		loc,
    		location: location$1,
    		querystring,
    		params,
    		push,
    		pop,
    		replace,
    		link,
    		updateLink,
    		linkOpts,
    		scrollstateHistoryHandler,
    		onDestroy,
    		createEventDispatcher,
    		afterUpdate,
    		parse: parse$1,
    		routes,
    		prefix,
    		restoreScrollState,
    		RouteItem,
    		routesList,
    		component,
    		componentParams,
    		props,
    		dispatch,
    		dispatchNextTick,
    		previousScrollState,
    		popStateChanged,
    		lastLoc,
    		componentObj,
    		unsubscribeLoc
    	});

    	$$self.$inject_state = $$props => {
    		if ('routes' in $$props) $$invalidate(3, routes = $$props.routes);
    		if ('prefix' in $$props) $$invalidate(4, prefix = $$props.prefix);
    		if ('restoreScrollState' in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
    		if ('component' in $$props) $$invalidate(0, component = $$props.component);
    		if ('componentParams' in $$props) $$invalidate(1, componentParams = $$props.componentParams);
    		if ('props' in $$props) $$invalidate(2, props = $$props.props);
    		if ('previousScrollState' in $$props) previousScrollState = $$props.previousScrollState;
    		if ('popStateChanged' in $$props) popStateChanged = $$props.popStateChanged;
    		if ('lastLoc' in $$props) lastLoc = $$props.lastLoc;
    		if ('componentObj' in $$props) componentObj = $$props.componentObj;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*restoreScrollState*/ 32) {
    			// Update history.scrollRestoration depending on restoreScrollState
    			history.scrollRestoration = restoreScrollState ? 'manual' : 'auto';
    		}
    	};

    	return [
    		component,
    		componentParams,
    		props,
    		routes,
    		prefix,
    		restoreScrollState,
    		routeEvent_handler,
    		routeEvent_handler_1
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			routes: 3,
    			prefix: 4,
    			restoreScrollState: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get routes() {
    		throw new Error_1$1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error_1$1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get prefix() {
    		throw new Error_1$1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set prefix(value) {
    		throw new Error_1$1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get restoreScrollState() {
    		throw new Error_1$1("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set restoreScrollState(value) {
    		throw new Error_1$1("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const PACKET_TYPES = Object.create(null); // no Map = no polyfill
    PACKET_TYPES["open"] = "0";
    PACKET_TYPES["close"] = "1";
    PACKET_TYPES["ping"] = "2";
    PACKET_TYPES["pong"] = "3";
    PACKET_TYPES["message"] = "4";
    PACKET_TYPES["upgrade"] = "5";
    PACKET_TYPES["noop"] = "6";
    const PACKET_TYPES_REVERSE = Object.create(null);
    Object.keys(PACKET_TYPES).forEach(key => {
        PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
    });
    const ERROR_PACKET = { type: "error", data: "parser error" };

    const withNativeBlob$1 = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
    const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
    // ArrayBuffer.isView method is not defined in IE10
    const isView$1 = obj => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj && obj.buffer instanceof ArrayBuffer;
    };
    const encodePacket = ({ type, data }, supportsBinary, callback) => {
        if (withNativeBlob$1 && data instanceof Blob) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(data, callback);
            }
        }
        else if (withNativeArrayBuffer$2 &&
            (data instanceof ArrayBuffer || isView$1(data))) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(new Blob([data]), callback);
            }
        }
        // plain string
        return callback(PACKET_TYPES[type] + (data || ""));
    };
    const encodeBlobAsBase64 = (data, callback) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const content = fileReader.result.split(",")[1];
            callback("b" + content);
        };
        return fileReader.readAsDataURL(data);
    };

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // Use a lookup table to find the index.
    const lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup$1[chars.charCodeAt(i)] = i;
    }
    const decode$1 = (base64) => {
        let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
        if (base64[base64.length - 1] === '=') {
            bufferLength--;
            if (base64[base64.length - 2] === '=') {
                bufferLength--;
            }
        }
        const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
        for (i = 0; i < len; i += 4) {
            encoded1 = lookup$1[base64.charCodeAt(i)];
            encoded2 = lookup$1[base64.charCodeAt(i + 1)];
            encoded3 = lookup$1[base64.charCodeAt(i + 2)];
            encoded4 = lookup$1[base64.charCodeAt(i + 3)];
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
        return arraybuffer;
    };

    const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
    const decodePacket = (encodedPacket, binaryType) => {
        if (typeof encodedPacket !== "string") {
            return {
                type: "message",
                data: mapBinary(encodedPacket, binaryType)
            };
        }
        const type = encodedPacket.charAt(0);
        if (type === "b") {
            return {
                type: "message",
                data: decodeBase64Packet(encodedPacket.substring(1), binaryType)
            };
        }
        const packetType = PACKET_TYPES_REVERSE[type];
        if (!packetType) {
            return ERROR_PACKET;
        }
        return encodedPacket.length > 1
            ? {
                type: PACKET_TYPES_REVERSE[type],
                data: encodedPacket.substring(1)
            }
            : {
                type: PACKET_TYPES_REVERSE[type]
            };
    };
    const decodeBase64Packet = (data, binaryType) => {
        if (withNativeArrayBuffer$1) {
            const decoded = decode$1(data);
            return mapBinary(decoded, binaryType);
        }
        else {
            return { base64: true, data }; // fallback for old browsers
        }
    };
    const mapBinary = (data, binaryType) => {
        switch (binaryType) {
            case "blob":
                return data instanceof ArrayBuffer ? new Blob([data]) : data;
            case "arraybuffer":
            default:
                return data; // assuming the data is already an ArrayBuffer
        }
    };

    const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
    const encodePayload = (packets, callback) => {
        // some packets may be added to the array while encoding, so the initial length must be saved
        const length = packets.length;
        const encodedPackets = new Array(length);
        let count = 0;
        packets.forEach((packet, i) => {
            // force base64 encoding for binary packets
            encodePacket(packet, false, encodedPacket => {
                encodedPackets[i] = encodedPacket;
                if (++count === length) {
                    callback(encodedPackets.join(SEPARATOR));
                }
            });
        });
    };
    const decodePayload = (encodedPayload, binaryType) => {
        const encodedPackets = encodedPayload.split(SEPARATOR);
        const packets = [];
        for (let i = 0; i < encodedPackets.length; i++) {
            const decodedPacket = decodePacket(encodedPackets[i], binaryType);
            packets.push(decodedPacket);
            if (decodedPacket.type === "error") {
                break;
            }
        }
        return packets;
    };
    const protocol$1 = 4;

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter(obj) {
      if (obj) return mixin(obj);
    }

    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin(obj) {
      for (var key in Emitter.prototype) {
        obj[key] = Emitter.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.on =
    Emitter.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.off =
    Emitter.prototype.removeListener =
    Emitter.prototype.removeAllListeners =
    Emitter.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }

      // Remove event specific arrays for event types that no
      // one is subscribed for to avoid memory leak.
      if (callbacks.length === 0) {
        delete this._callbacks['$' + event];
      }

      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};

      var args = new Array(arguments.length - 1)
        , callbacks = this._callbacks['$' + event];

      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    // alias used for reserved events (protected method)
    Emitter.prototype.emitReserved = Emitter.prototype.emit;

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };

    const globalThisShim = (() => {
        if (typeof self !== "undefined") {
            return self;
        }
        else if (typeof window !== "undefined") {
            return window;
        }
        else {
            return Function("return this")();
        }
    })();

    function pick(obj, ...attr) {
        return attr.reduce((acc, k) => {
            if (obj.hasOwnProperty(k)) {
                acc[k] = obj[k];
            }
            return acc;
        }, {});
    }
    // Keep a reference to the real timeout functions so they can be used when overridden
    const NATIVE_SET_TIMEOUT = setTimeout;
    const NATIVE_CLEAR_TIMEOUT = clearTimeout;
    function installTimerFunctions(obj, opts) {
        if (opts.useNativeTimers) {
            obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
            obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
        }
        else {
            obj.setTimeoutFn = setTimeout.bind(globalThisShim);
            obj.clearTimeoutFn = clearTimeout.bind(globalThisShim);
        }
    }
    // base64 encoded buffers are about 33% bigger (https://en.wikipedia.org/wiki/Base64)
    const BASE64_OVERHEAD = 1.33;
    // we could also have used `new Blob([obj]).size`, but it isn't supported in IE9
    function byteLength(obj) {
        if (typeof obj === "string") {
            return utf8Length(obj);
        }
        // arraybuffer or blob
        return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
    }
    function utf8Length(str) {
        let c = 0, length = 0;
        for (let i = 0, l = str.length; i < l; i++) {
            c = str.charCodeAt(i);
            if (c < 0x80) {
                length += 1;
            }
            else if (c < 0x800) {
                length += 2;
            }
            else if (c < 0xd800 || c >= 0xe000) {
                length += 3;
            }
            else {
                i++;
                length += 4;
            }
        }
        return length;
    }

    class TransportError extends Error {
        constructor(reason, description, context) {
            super(reason);
            this.description = description;
            this.context = context;
            this.type = "TransportError";
        }
    }
    class Transport extends Emitter {
        /**
         * Transport abstract constructor.
         *
         * @param {Object} options.
         * @api private
         */
        constructor(opts) {
            super();
            this.writable = false;
            installTimerFunctions(this, opts);
            this.opts = opts;
            this.query = opts.query;
            this.readyState = "";
            this.socket = opts.socket;
        }
        /**
         * Emits an error.
         *
         * @param {String} reason
         * @param description
         * @param context - the error context
         * @return {Transport} for chaining
         * @api protected
         */
        onError(reason, description, context) {
            super.emitReserved("error", new TransportError(reason, description, context));
            return this;
        }
        /**
         * Opens the transport.
         *
         * @api public
         */
        open() {
            if ("closed" === this.readyState || "" === this.readyState) {
                this.readyState = "opening";
                this.doOpen();
            }
            return this;
        }
        /**
         * Closes the transport.
         *
         * @api public
         */
        close() {
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.doClose();
                this.onClose();
            }
            return this;
        }
        /**
         * Sends multiple packets.
         *
         * @param {Array} packets
         * @api public
         */
        send(packets) {
            if ("open" === this.readyState) {
                this.write(packets);
            }
        }
        /**
         * Called upon open
         *
         * @api protected
         */
        onOpen() {
            this.readyState = "open";
            this.writable = true;
            super.emitReserved("open");
        }
        /**
         * Called with data.
         *
         * @param {String} data
         * @api protected
         */
        onData(data) {
            const packet = decodePacket(data, this.socket.binaryType);
            this.onPacket(packet);
        }
        /**
         * Called with a decoded packet.
         *
         * @api protected
         */
        onPacket(packet) {
            super.emitReserved("packet", packet);
        }
        /**
         * Called upon close.
         *
         * @api protected
         */
        onClose(details) {
            this.readyState = "closed";
            super.emitReserved("close", details);
        }
    }

    // imported from https://github.com/unshiftio/yeast
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split(''), length = 64, map = {};
    let seed = 0, i = 0, prev;
    /**
     * Return a string representing the specified number.
     *
     * @param {Number} num The number to convert.
     * @returns {String} The string representation of the number.
     * @api public
     */
    function encode$1(num) {
        let encoded = '';
        do {
            encoded = alphabet[num % length] + encoded;
            num = Math.floor(num / length);
        } while (num > 0);
        return encoded;
    }
    /**
     * Yeast: A tiny growing id generator.
     *
     * @returns {String} A unique id.
     * @api public
     */
    function yeast() {
        const now = encode$1(+new Date());
        if (now !== prev)
            return seed = 0, prev = now;
        return now + '.' + encode$1(seed++);
    }
    //
    // Map each character to its index.
    //
    for (; i < length; i++)
        map[alphabet[i]] = i;

    // imported from https://github.com/galkn/querystring
    /**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */
    function encode(obj) {
        let str = '';
        for (let i in obj) {
            if (obj.hasOwnProperty(i)) {
                if (str.length)
                    str += '&';
                str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
            }
        }
        return str;
    }
    /**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */
    function decode(qs) {
        let qry = {};
        let pairs = qs.split('&');
        for (let i = 0, l = pairs.length; i < l; i++) {
            let pair = pairs[i].split('=');
            qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
        return qry;
    }

    // imported from https://github.com/component/has-cors
    let value = false;
    try {
        value = typeof XMLHttpRequest !== 'undefined' &&
            'withCredentials' in new XMLHttpRequest();
    }
    catch (err) {
        // if XMLHttp support is disabled in IE then it will throw
        // when trying to create
    }
    const hasCORS = value;

    // browser shim for xmlhttprequest module
    function XHR(opts) {
        const xdomain = opts.xdomain;
        // XMLHttpRequest can be disabled on IE
        try {
            if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
                return new XMLHttpRequest();
            }
        }
        catch (e) { }
        if (!xdomain) {
            try {
                return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
            }
            catch (e) { }
        }
    }

    function empty() { }
    const hasXHR2 = (function () {
        const xhr = new XHR({
            xdomain: false
        });
        return null != xhr.responseType;
    })();
    class Polling extends Transport {
        /**
         * XHR Polling constructor.
         *
         * @param {Object} opts
         * @api public
         */
        constructor(opts) {
            super(opts);
            this.polling = false;
            if (typeof location !== "undefined") {
                const isSSL = "https:" === location.protocol;
                let port = location.port;
                // some user agents have empty `location.port`
                if (!port) {
                    port = isSSL ? "443" : "80";
                }
                this.xd =
                    (typeof location !== "undefined" &&
                        opts.hostname !== location.hostname) ||
                        port !== opts.port;
                this.xs = opts.secure !== isSSL;
            }
            /**
             * XHR supports binary
             */
            const forceBase64 = opts && opts.forceBase64;
            this.supportsBinary = hasXHR2 && !forceBase64;
        }
        /**
         * Transport name.
         */
        get name() {
            return "polling";
        }
        /**
         * Opens the socket (triggers polling). We write a PING message to determine
         * when the transport is open.
         *
         * @api private
         */
        doOpen() {
            this.poll();
        }
        /**
         * Pauses polling.
         *
         * @param {Function} callback upon buffers are flushed and transport is paused
         * @api private
         */
        pause(onPause) {
            this.readyState = "pausing";
            const pause = () => {
                this.readyState = "paused";
                onPause();
            };
            if (this.polling || !this.writable) {
                let total = 0;
                if (this.polling) {
                    total++;
                    this.once("pollComplete", function () {
                        --total || pause();
                    });
                }
                if (!this.writable) {
                    total++;
                    this.once("drain", function () {
                        --total || pause();
                    });
                }
            }
            else {
                pause();
            }
        }
        /**
         * Starts polling cycle.
         *
         * @api public
         */
        poll() {
            this.polling = true;
            this.doPoll();
            this.emitReserved("poll");
        }
        /**
         * Overloads onData to detect payloads.
         *
         * @api private
         */
        onData(data) {
            const callback = packet => {
                // if its the first message we consider the transport open
                if ("opening" === this.readyState && packet.type === "open") {
                    this.onOpen();
                }
                // if its a close packet, we close the ongoing requests
                if ("close" === packet.type) {
                    this.onClose({ description: "transport closed by the server" });
                    return false;
                }
                // otherwise bypass onData and handle the message
                this.onPacket(packet);
            };
            // decode payload
            decodePayload(data, this.socket.binaryType).forEach(callback);
            // if an event did not trigger closing
            if ("closed" !== this.readyState) {
                // if we got data we're not polling
                this.polling = false;
                this.emitReserved("pollComplete");
                if ("open" === this.readyState) {
                    this.poll();
                }
            }
        }
        /**
         * For polling, send a close packet.
         *
         * @api private
         */
        doClose() {
            const close = () => {
                this.write([{ type: "close" }]);
            };
            if ("open" === this.readyState) {
                close();
            }
            else {
                // in case we're trying to close while
                // handshaking is in progress (GH-164)
                this.once("open", close);
            }
        }
        /**
         * Writes a packets payload.
         *
         * @param {Array} data packets
         * @param {Function} drain callback
         * @api private
         */
        write(packets) {
            this.writable = false;
            encodePayload(packets, data => {
                this.doWrite(data, () => {
                    this.writable = true;
                    this.emitReserved("drain");
                });
            });
        }
        /**
         * Generates uri for connection.
         *
         * @api private
         */
        uri() {
            let query = this.query || {};
            const schema = this.opts.secure ? "https" : "http";
            let port = "";
            // cache busting is forced
            if (false !== this.opts.timestampRequests) {
                query[this.opts.timestampParam] = yeast();
            }
            if (!this.supportsBinary && !query.sid) {
                query.b64 = 1;
            }
            // avoid port if default for schema
            if (this.opts.port &&
                (("https" === schema && Number(this.opts.port) !== 443) ||
                    ("http" === schema && Number(this.opts.port) !== 80))) {
                port = ":" + this.opts.port;
            }
            const encodedQuery = encode(query);
            const ipv6 = this.opts.hostname.indexOf(":") !== -1;
            return (schema +
                "://" +
                (ipv6 ? "[" + this.opts.hostname + "]" : this.opts.hostname) +
                port +
                this.opts.path +
                (encodedQuery.length ? "?" + encodedQuery : ""));
        }
        /**
         * Creates a request.
         *
         * @param {String} method
         * @api private
         */
        request(opts = {}) {
            Object.assign(opts, { xd: this.xd, xs: this.xs }, this.opts);
            return new Request(this.uri(), opts);
        }
        /**
         * Sends data.
         *
         * @param {String} data to send.
         * @param {Function} called upon flush.
         * @api private
         */
        doWrite(data, fn) {
            const req = this.request({
                method: "POST",
                data: data
            });
            req.on("success", fn);
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr post error", xhrStatus, context);
            });
        }
        /**
         * Starts a poll cycle.
         *
         * @api private
         */
        doPoll() {
            const req = this.request();
            req.on("data", this.onData.bind(this));
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr poll error", xhrStatus, context);
            });
            this.pollXhr = req;
        }
    }
    class Request extends Emitter {
        /**
         * Request constructor
         *
         * @param {Object} options
         * @api public
         */
        constructor(uri, opts) {
            super();
            installTimerFunctions(this, opts);
            this.opts = opts;
            this.method = opts.method || "GET";
            this.uri = uri;
            this.async = false !== opts.async;
            this.data = undefined !== opts.data ? opts.data : null;
            this.create();
        }
        /**
         * Creates the XHR object and sends the request.
         *
         * @api private
         */
        create() {
            const opts = pick(this.opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
            opts.xdomain = !!this.opts.xd;
            opts.xscheme = !!this.opts.xs;
            const xhr = (this.xhr = new XHR(opts));
            try {
                xhr.open(this.method, this.uri, this.async);
                try {
                    if (this.opts.extraHeaders) {
                        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                        for (let i in this.opts.extraHeaders) {
                            if (this.opts.extraHeaders.hasOwnProperty(i)) {
                                xhr.setRequestHeader(i, this.opts.extraHeaders[i]);
                            }
                        }
                    }
                }
                catch (e) { }
                if ("POST" === this.method) {
                    try {
                        xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                    }
                    catch (e) { }
                }
                try {
                    xhr.setRequestHeader("Accept", "*/*");
                }
                catch (e) { }
                // ie6 check
                if ("withCredentials" in xhr) {
                    xhr.withCredentials = this.opts.withCredentials;
                }
                if (this.opts.requestTimeout) {
                    xhr.timeout = this.opts.requestTimeout;
                }
                xhr.onreadystatechange = () => {
                    if (4 !== xhr.readyState)
                        return;
                    if (200 === xhr.status || 1223 === xhr.status) {
                        this.onLoad();
                    }
                    else {
                        // make sure the `error` event handler that's user-set
                        // does not throw in the same tick and gets caught here
                        this.setTimeoutFn(() => {
                            this.onError(typeof xhr.status === "number" ? xhr.status : 0);
                        }, 0);
                    }
                };
                xhr.send(this.data);
            }
            catch (e) {
                // Need to defer since .create() is called directly from the constructor
                // and thus the 'error' event can only be only bound *after* this exception
                // occurs.  Therefore, also, we cannot throw here at all.
                this.setTimeoutFn(() => {
                    this.onError(e);
                }, 0);
                return;
            }
            if (typeof document !== "undefined") {
                this.index = Request.requestsCount++;
                Request.requests[this.index] = this;
            }
        }
        /**
         * Called upon error.
         *
         * @api private
         */
        onError(err) {
            this.emitReserved("error", err, this.xhr);
            this.cleanup(true);
        }
        /**
         * Cleans up house.
         *
         * @api private
         */
        cleanup(fromError) {
            if ("undefined" === typeof this.xhr || null === this.xhr) {
                return;
            }
            this.xhr.onreadystatechange = empty;
            if (fromError) {
                try {
                    this.xhr.abort();
                }
                catch (e) { }
            }
            if (typeof document !== "undefined") {
                delete Request.requests[this.index];
            }
            this.xhr = null;
        }
        /**
         * Called upon load.
         *
         * @api private
         */
        onLoad() {
            const data = this.xhr.responseText;
            if (data !== null) {
                this.emitReserved("data", data);
                this.emitReserved("success");
                this.cleanup();
            }
        }
        /**
         * Aborts the request.
         *
         * @api public
         */
        abort() {
            this.cleanup();
        }
    }
    Request.requestsCount = 0;
    Request.requests = {};
    /**
     * Aborts pending requests when unloading the window. This is needed to prevent
     * memory leaks (e.g. when using IE) and to ensure that no spurious error is
     * emitted.
     */
    if (typeof document !== "undefined") {
        // @ts-ignore
        if (typeof attachEvent === "function") {
            // @ts-ignore
            attachEvent("onunload", unloadHandler);
        }
        else if (typeof addEventListener === "function") {
            const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
            addEventListener(terminationEvent, unloadHandler, false);
        }
    }
    function unloadHandler() {
        for (let i in Request.requests) {
            if (Request.requests.hasOwnProperty(i)) {
                Request.requests[i].abort();
            }
        }
    }

    const nextTick = (() => {
        const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
        if (isPromiseAvailable) {
            return cb => Promise.resolve().then(cb);
        }
        else {
            return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
        }
    })();
    const WebSocket = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
    const usingBrowserWebSocket = true;
    const defaultBinaryType = "arraybuffer";

    // detect ReactNative environment
    const isReactNative = typeof navigator !== "undefined" &&
        typeof navigator.product === "string" &&
        navigator.product.toLowerCase() === "reactnative";
    class WS extends Transport {
        /**
         * WebSocket transport constructor.
         *
         * @api {Object} connection options
         * @api public
         */
        constructor(opts) {
            super(opts);
            this.supportsBinary = !opts.forceBase64;
        }
        /**
         * Transport name.
         *
         * @api public
         */
        get name() {
            return "websocket";
        }
        /**
         * Opens socket.
         *
         * @api private
         */
        doOpen() {
            if (!this.check()) {
                // let probe timeout
                return;
            }
            const uri = this.uri();
            const protocols = this.opts.protocols;
            // React Native only supports the 'headers' option, and will print a warning if anything else is passed
            const opts = isReactNative
                ? {}
                : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
            if (this.opts.extraHeaders) {
                opts.headers = this.opts.extraHeaders;
            }
            try {
                this.ws =
                    usingBrowserWebSocket && !isReactNative
                        ? protocols
                            ? new WebSocket(uri, protocols)
                            : new WebSocket(uri)
                        : new WebSocket(uri, protocols, opts);
            }
            catch (err) {
                return this.emitReserved("error", err);
            }
            this.ws.binaryType = this.socket.binaryType || defaultBinaryType;
            this.addEventListeners();
        }
        /**
         * Adds event listeners to the socket
         *
         * @api private
         */
        addEventListeners() {
            this.ws.onopen = () => {
                if (this.opts.autoUnref) {
                    this.ws._socket.unref();
                }
                this.onOpen();
            };
            this.ws.onclose = closeEvent => this.onClose({
                description: "websocket connection closed",
                context: closeEvent
            });
            this.ws.onmessage = ev => this.onData(ev.data);
            this.ws.onerror = e => this.onError("websocket error", e);
        }
        /**
         * Writes data to socket.
         *
         * @param {Array} array of packets.
         * @api private
         */
        write(packets) {
            this.writable = false;
            // encodePacket efficient as it uses WS framing
            // no need for encodePayload
            for (let i = 0; i < packets.length; i++) {
                const packet = packets[i];
                const lastPacket = i === packets.length - 1;
                encodePacket(packet, this.supportsBinary, data => {
                    // always create a new object (GH-437)
                    const opts = {};
                    // Sometimes the websocket has already been closed but the browser didn't
                    // have a chance of informing us about it yet, in that case send will
                    // throw an error
                    try {
                        if (usingBrowserWebSocket) {
                            // TypeError is thrown when passing the second argument on Safari
                            this.ws.send(data);
                        }
                    }
                    catch (e) {
                    }
                    if (lastPacket) {
                        // fake drain
                        // defer to next tick to allow Socket to clear writeBuffer
                        nextTick(() => {
                            this.writable = true;
                            this.emitReserved("drain");
                        }, this.setTimeoutFn);
                    }
                });
            }
        }
        /**
         * Closes socket.
         *
         * @api private
         */
        doClose() {
            if (typeof this.ws !== "undefined") {
                this.ws.close();
                this.ws = null;
            }
        }
        /**
         * Generates uri for connection.
         *
         * @api private
         */
        uri() {
            let query = this.query || {};
            const schema = this.opts.secure ? "wss" : "ws";
            let port = "";
            // avoid port if default for schema
            if (this.opts.port &&
                (("wss" === schema && Number(this.opts.port) !== 443) ||
                    ("ws" === schema && Number(this.opts.port) !== 80))) {
                port = ":" + this.opts.port;
            }
            // append timestamp to URI
            if (this.opts.timestampRequests) {
                query[this.opts.timestampParam] = yeast();
            }
            // communicate binary support capabilities
            if (!this.supportsBinary) {
                query.b64 = 1;
            }
            const encodedQuery = encode(query);
            const ipv6 = this.opts.hostname.indexOf(":") !== -1;
            return (schema +
                "://" +
                (ipv6 ? "[" + this.opts.hostname + "]" : this.opts.hostname) +
                port +
                this.opts.path +
                (encodedQuery.length ? "?" + encodedQuery : ""));
        }
        /**
         * Feature detection for WebSocket.
         *
         * @return {Boolean} whether this transport is available.
         * @api public
         */
        check() {
            return !!WebSocket;
        }
    }

    const transports = {
        websocket: WS,
        polling: Polling
    };

    // imported from https://github.com/galkn/parseuri
    /**
     * Parses an URI
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */
    const re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
    const parts = [
        'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
    ];
    function parse(str) {
        const src = str, b = str.indexOf('['), e = str.indexOf(']');
        if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
        }
        let m = re.exec(str || ''), uri = {}, i = 14;
        while (i--) {
            uri[parts[i]] = m[i] || '';
        }
        if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
            uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
            uri.ipv6uri = true;
        }
        uri.pathNames = pathNames(uri, uri['path']);
        uri.queryKey = queryKey(uri, uri['query']);
        return uri;
    }
    function pathNames(obj, path) {
        const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
        if (path.substr(0, 1) == '/' || path.length === 0) {
            names.splice(0, 1);
        }
        if (path.substr(path.length - 1, 1) == '/') {
            names.splice(names.length - 1, 1);
        }
        return names;
    }
    function queryKey(uri, query) {
        const data = {};
        query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
            if ($1) {
                data[$1] = $2;
            }
        });
        return data;
    }

    class Socket$1 extends Emitter {
        /**
         * Socket constructor.
         *
         * @param {String|Object} uri or options
         * @param {Object} opts - options
         * @api public
         */
        constructor(uri, opts = {}) {
            super();
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = null;
            }
            if (uri) {
                uri = parse(uri);
                opts.hostname = uri.host;
                opts.secure = uri.protocol === "https" || uri.protocol === "wss";
                opts.port = uri.port;
                if (uri.query)
                    opts.query = uri.query;
            }
            else if (opts.host) {
                opts.hostname = parse(opts.host).host;
            }
            installTimerFunctions(this, opts);
            this.secure =
                null != opts.secure
                    ? opts.secure
                    : typeof location !== "undefined" && "https:" === location.protocol;
            if (opts.hostname && !opts.port) {
                // if no port is specified manually, use the protocol default
                opts.port = this.secure ? "443" : "80";
            }
            this.hostname =
                opts.hostname ||
                    (typeof location !== "undefined" ? location.hostname : "localhost");
            this.port =
                opts.port ||
                    (typeof location !== "undefined" && location.port
                        ? location.port
                        : this.secure
                            ? "443"
                            : "80");
            this.transports = opts.transports || ["polling", "websocket"];
            this.readyState = "";
            this.writeBuffer = [];
            this.prevBufferLen = 0;
            this.opts = Object.assign({
                path: "/engine.io",
                agent: false,
                withCredentials: false,
                upgrade: true,
                timestampParam: "t",
                rememberUpgrade: false,
                rejectUnauthorized: true,
                perMessageDeflate: {
                    threshold: 1024
                },
                transportOptions: {},
                closeOnBeforeunload: true
            }, opts);
            this.opts.path = this.opts.path.replace(/\/$/, "") + "/";
            if (typeof this.opts.query === "string") {
                this.opts.query = decode(this.opts.query);
            }
            // set on handshake
            this.id = null;
            this.upgrades = null;
            this.pingInterval = null;
            this.pingTimeout = null;
            // set on heartbeat
            this.pingTimeoutTimer = null;
            if (typeof addEventListener === "function") {
                if (this.opts.closeOnBeforeunload) {
                    // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                    // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                    // closed/reloaded)
                    addEventListener("beforeunload", () => {
                        if (this.transport) {
                            // silently close the transport
                            this.transport.removeAllListeners();
                            this.transport.close();
                        }
                    }, false);
                }
                if (this.hostname !== "localhost") {
                    this.offlineEventListener = () => {
                        this.onClose("transport close", {
                            description: "network connection lost"
                        });
                    };
                    addEventListener("offline", this.offlineEventListener, false);
                }
            }
            this.open();
        }
        /**
         * Creates transport of the given type.
         *
         * @param {String} transport name
         * @return {Transport}
         * @api private
         */
        createTransport(name) {
            const query = Object.assign({}, this.opts.query);
            // append engine.io protocol identifier
            query.EIO = protocol$1;
            // transport name
            query.transport = name;
            // session id if we already have one
            if (this.id)
                query.sid = this.id;
            const opts = Object.assign({}, this.opts.transportOptions[name], this.opts, {
                query,
                socket: this,
                hostname: this.hostname,
                secure: this.secure,
                port: this.port
            });
            return new transports[name](opts);
        }
        /**
         * Initializes transport to use and starts probe.
         *
         * @api private
         */
        open() {
            let transport;
            if (this.opts.rememberUpgrade &&
                Socket$1.priorWebsocketSuccess &&
                this.transports.indexOf("websocket") !== -1) {
                transport = "websocket";
            }
            else if (0 === this.transports.length) {
                // Emit error on next tick so it can be listened to
                this.setTimeoutFn(() => {
                    this.emitReserved("error", "No transports available");
                }, 0);
                return;
            }
            else {
                transport = this.transports[0];
            }
            this.readyState = "opening";
            // Retry with the next transport if the transport is disabled (jsonp: false)
            try {
                transport = this.createTransport(transport);
            }
            catch (e) {
                this.transports.shift();
                this.open();
                return;
            }
            transport.open();
            this.setTransport(transport);
        }
        /**
         * Sets the current transport. Disables the existing one (if any).
         *
         * @api private
         */
        setTransport(transport) {
            if (this.transport) {
                this.transport.removeAllListeners();
            }
            // set up transport
            this.transport = transport;
            // set up transport listeners
            transport
                .on("drain", this.onDrain.bind(this))
                .on("packet", this.onPacket.bind(this))
                .on("error", this.onError.bind(this))
                .on("close", reason => this.onClose("transport close", reason));
        }
        /**
         * Probes a transport.
         *
         * @param {String} transport name
         * @api private
         */
        probe(name) {
            let transport = this.createTransport(name);
            let failed = false;
            Socket$1.priorWebsocketSuccess = false;
            const onTransportOpen = () => {
                if (failed)
                    return;
                transport.send([{ type: "ping", data: "probe" }]);
                transport.once("packet", msg => {
                    if (failed)
                        return;
                    if ("pong" === msg.type && "probe" === msg.data) {
                        this.upgrading = true;
                        this.emitReserved("upgrading", transport);
                        if (!transport)
                            return;
                        Socket$1.priorWebsocketSuccess = "websocket" === transport.name;
                        this.transport.pause(() => {
                            if (failed)
                                return;
                            if ("closed" === this.readyState)
                                return;
                            cleanup();
                            this.setTransport(transport);
                            transport.send([{ type: "upgrade" }]);
                            this.emitReserved("upgrade", transport);
                            transport = null;
                            this.upgrading = false;
                            this.flush();
                        });
                    }
                    else {
                        const err = new Error("probe error");
                        // @ts-ignore
                        err.transport = transport.name;
                        this.emitReserved("upgradeError", err);
                    }
                });
            };
            function freezeTransport() {
                if (failed)
                    return;
                // Any callback called by transport should be ignored since now
                failed = true;
                cleanup();
                transport.close();
                transport = null;
            }
            // Handle any error that happens while probing
            const onerror = err => {
                const error = new Error("probe error: " + err);
                // @ts-ignore
                error.transport = transport.name;
                freezeTransport();
                this.emitReserved("upgradeError", error);
            };
            function onTransportClose() {
                onerror("transport closed");
            }
            // When the socket is closed while we're probing
            function onclose() {
                onerror("socket closed");
            }
            // When the socket is upgraded while we're probing
            function onupgrade(to) {
                if (transport && to.name !== transport.name) {
                    freezeTransport();
                }
            }
            // Remove all listeners on the transport and on self
            const cleanup = () => {
                transport.removeListener("open", onTransportOpen);
                transport.removeListener("error", onerror);
                transport.removeListener("close", onTransportClose);
                this.off("close", onclose);
                this.off("upgrading", onupgrade);
            };
            transport.once("open", onTransportOpen);
            transport.once("error", onerror);
            transport.once("close", onTransportClose);
            this.once("close", onclose);
            this.once("upgrading", onupgrade);
            transport.open();
        }
        /**
         * Called when connection is deemed open.
         *
         * @api private
         */
        onOpen() {
            this.readyState = "open";
            Socket$1.priorWebsocketSuccess = "websocket" === this.transport.name;
            this.emitReserved("open");
            this.flush();
            // we check for `readyState` in case an `open`
            // listener already closed the socket
            if ("open" === this.readyState &&
                this.opts.upgrade &&
                this.transport.pause) {
                let i = 0;
                const l = this.upgrades.length;
                for (; i < l; i++) {
                    this.probe(this.upgrades[i]);
                }
            }
        }
        /**
         * Handles a packet.
         *
         * @api private
         */
        onPacket(packet) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                this.emitReserved("packet", packet);
                // Socket is live - any packet counts
                this.emitReserved("heartbeat");
                switch (packet.type) {
                    case "open":
                        this.onHandshake(JSON.parse(packet.data));
                        break;
                    case "ping":
                        this.resetPingTimeout();
                        this.sendPacket("pong");
                        this.emitReserved("ping");
                        this.emitReserved("pong");
                        break;
                    case "error":
                        const err = new Error("server error");
                        // @ts-ignore
                        err.code = packet.data;
                        this.onError(err);
                        break;
                    case "message":
                        this.emitReserved("data", packet.data);
                        this.emitReserved("message", packet.data);
                        break;
                }
            }
        }
        /**
         * Called upon handshake completion.
         *
         * @param {Object} data - handshake obj
         * @api private
         */
        onHandshake(data) {
            this.emitReserved("handshake", data);
            this.id = data.sid;
            this.transport.query.sid = data.sid;
            this.upgrades = this.filterUpgrades(data.upgrades);
            this.pingInterval = data.pingInterval;
            this.pingTimeout = data.pingTimeout;
            this.maxPayload = data.maxPayload;
            this.onOpen();
            // In case open handler closes socket
            if ("closed" === this.readyState)
                return;
            this.resetPingTimeout();
        }
        /**
         * Sets and resets ping timeout timer based on server pings.
         *
         * @api private
         */
        resetPingTimeout() {
            this.clearTimeoutFn(this.pingTimeoutTimer);
            this.pingTimeoutTimer = this.setTimeoutFn(() => {
                this.onClose("ping timeout");
            }, this.pingInterval + this.pingTimeout);
            if (this.opts.autoUnref) {
                this.pingTimeoutTimer.unref();
            }
        }
        /**
         * Called on `drain` event
         *
         * @api private
         */
        onDrain() {
            this.writeBuffer.splice(0, this.prevBufferLen);
            // setting prevBufferLen = 0 is very important
            // for example, when upgrading, upgrade packet is sent over,
            // and a nonzero prevBufferLen could cause problems on `drain`
            this.prevBufferLen = 0;
            if (0 === this.writeBuffer.length) {
                this.emitReserved("drain");
            }
            else {
                this.flush();
            }
        }
        /**
         * Flush write buffers.
         *
         * @api private
         */
        flush() {
            if ("closed" !== this.readyState &&
                this.transport.writable &&
                !this.upgrading &&
                this.writeBuffer.length) {
                const packets = this.getWritablePackets();
                this.transport.send(packets);
                // keep track of current length of writeBuffer
                // splice writeBuffer and callbackBuffer on `drain`
                this.prevBufferLen = packets.length;
                this.emitReserved("flush");
            }
        }
        /**
         * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
         * long-polling)
         *
         * @private
         */
        getWritablePackets() {
            const shouldCheckPayloadSize = this.maxPayload &&
                this.transport.name === "polling" &&
                this.writeBuffer.length > 1;
            if (!shouldCheckPayloadSize) {
                return this.writeBuffer;
            }
            let payloadSize = 1; // first packet type
            for (let i = 0; i < this.writeBuffer.length; i++) {
                const data = this.writeBuffer[i].data;
                if (data) {
                    payloadSize += byteLength(data);
                }
                if (i > 0 && payloadSize > this.maxPayload) {
                    return this.writeBuffer.slice(0, i);
                }
                payloadSize += 2; // separator + packet type
            }
            return this.writeBuffer;
        }
        /**
         * Sends a message.
         *
         * @param {String} message.
         * @param {Function} callback function.
         * @param {Object} options.
         * @return {Socket} for chaining.
         * @api public
         */
        write(msg, options, fn) {
            this.sendPacket("message", msg, options, fn);
            return this;
        }
        send(msg, options, fn) {
            this.sendPacket("message", msg, options, fn);
            return this;
        }
        /**
         * Sends a packet.
         *
         * @param {String} packet type.
         * @param {String} data.
         * @param {Object} options.
         * @param {Function} callback function.
         * @api private
         */
        sendPacket(type, data, options, fn) {
            if ("function" === typeof data) {
                fn = data;
                data = undefined;
            }
            if ("function" === typeof options) {
                fn = options;
                options = null;
            }
            if ("closing" === this.readyState || "closed" === this.readyState) {
                return;
            }
            options = options || {};
            options.compress = false !== options.compress;
            const packet = {
                type: type,
                data: data,
                options: options
            };
            this.emitReserved("packetCreate", packet);
            this.writeBuffer.push(packet);
            if (fn)
                this.once("flush", fn);
            this.flush();
        }
        /**
         * Closes the connection.
         *
         * @api public
         */
        close() {
            const close = () => {
                this.onClose("forced close");
                this.transport.close();
            };
            const cleanupAndClose = () => {
                this.off("upgrade", cleanupAndClose);
                this.off("upgradeError", cleanupAndClose);
                close();
            };
            const waitForUpgrade = () => {
                // wait for upgrade to finish since we can't send packets while pausing a transport
                this.once("upgrade", cleanupAndClose);
                this.once("upgradeError", cleanupAndClose);
            };
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.readyState = "closing";
                if (this.writeBuffer.length) {
                    this.once("drain", () => {
                        if (this.upgrading) {
                            waitForUpgrade();
                        }
                        else {
                            close();
                        }
                    });
                }
                else if (this.upgrading) {
                    waitForUpgrade();
                }
                else {
                    close();
                }
            }
            return this;
        }
        /**
         * Called upon transport error
         *
         * @api private
         */
        onError(err) {
            Socket$1.priorWebsocketSuccess = false;
            this.emitReserved("error", err);
            this.onClose("transport error", err);
        }
        /**
         * Called upon transport close.
         *
         * @api private
         */
        onClose(reason, description) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                // clear timers
                this.clearTimeoutFn(this.pingTimeoutTimer);
                // stop event from firing again for transport
                this.transport.removeAllListeners("close");
                // ensure transport won't stay open
                this.transport.close();
                // ignore further transport communication
                this.transport.removeAllListeners();
                if (typeof removeEventListener === "function") {
                    removeEventListener("offline", this.offlineEventListener, false);
                }
                // set ready state
                this.readyState = "closed";
                // clear session id
                this.id = null;
                // emit close event
                this.emitReserved("close", reason, description);
                // clean buffers after, so users can still
                // grab the buffers on `close` event
                this.writeBuffer = [];
                this.prevBufferLen = 0;
            }
        }
        /**
         * Filters upgrades, returning only those matching client transports.
         *
         * @param {Array} server upgrades
         * @api private
         *
         */
        filterUpgrades(upgrades) {
            const filteredUpgrades = [];
            let i = 0;
            const j = upgrades.length;
            for (; i < j; i++) {
                if (~this.transports.indexOf(upgrades[i]))
                    filteredUpgrades.push(upgrades[i]);
            }
            return filteredUpgrades;
        }
    }
    Socket$1.protocol = protocol$1;

    /**
     * URL parser.
     *
     * @param uri - url
     * @param path - the request path of the connection
     * @param loc - An object meant to mimic window.location.
     *        Defaults to window.location.
     * @public
     */
    function url(uri, path = "", loc) {
        let obj = uri;
        // default to window.location
        loc = loc || (typeof location !== "undefined" && location);
        if (null == uri)
            uri = loc.protocol + "//" + loc.host;
        // relative path support
        if (typeof uri === "string") {
            if ("/" === uri.charAt(0)) {
                if ("/" === uri.charAt(1)) {
                    uri = loc.protocol + uri;
                }
                else {
                    uri = loc.host + uri;
                }
            }
            if (!/^(https?|wss?):\/\//.test(uri)) {
                if ("undefined" !== typeof loc) {
                    uri = loc.protocol + "//" + uri;
                }
                else {
                    uri = "https://" + uri;
                }
            }
            // parse
            obj = parse(uri);
        }
        // make sure we treat `localhost:80` and `localhost` equally
        if (!obj.port) {
            if (/^(http|ws)$/.test(obj.protocol)) {
                obj.port = "80";
            }
            else if (/^(http|ws)s$/.test(obj.protocol)) {
                obj.port = "443";
            }
        }
        obj.path = obj.path || "/";
        const ipv6 = obj.host.indexOf(":") !== -1;
        const host = ipv6 ? "[" + obj.host + "]" : obj.host;
        // define unique id
        obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
        // define href
        obj.href =
            obj.protocol +
                "://" +
                host +
                (loc && loc.port === obj.port ? "" : ":" + obj.port);
        return obj;
    }

    const withNativeArrayBuffer = typeof ArrayBuffer === "function";
    const isView = (obj) => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj.buffer instanceof ArrayBuffer;
    };
    const toString = Object.prototype.toString;
    const withNativeBlob = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            toString.call(Blob) === "[object BlobConstructor]");
    const withNativeFile = typeof File === "function" ||
        (typeof File !== "undefined" &&
            toString.call(File) === "[object FileConstructor]");
    /**
     * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
     *
     * @private
     */
    function isBinary(obj) {
        return ((withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
            (withNativeBlob && obj instanceof Blob) ||
            (withNativeFile && obj instanceof File));
    }
    function hasBinary(obj, toJSON) {
        if (!obj || typeof obj !== "object") {
            return false;
        }
        if (Array.isArray(obj)) {
            for (let i = 0, l = obj.length; i < l; i++) {
                if (hasBinary(obj[i])) {
                    return true;
                }
            }
            return false;
        }
        if (isBinary(obj)) {
            return true;
        }
        if (obj.toJSON &&
            typeof obj.toJSON === "function" &&
            arguments.length === 1) {
            return hasBinary(obj.toJSON(), true);
        }
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
     *
     * @param {Object} packet - socket.io event packet
     * @return {Object} with deconstructed packet and list of buffers
     * @public
     */
    function deconstructPacket(packet) {
        const buffers = [];
        const packetData = packet.data;
        const pack = packet;
        pack.data = _deconstructPacket(packetData, buffers);
        pack.attachments = buffers.length; // number of binary 'attachments'
        return { packet: pack, buffers: buffers };
    }
    function _deconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (isBinary(data)) {
            const placeholder = { _placeholder: true, num: buffers.length };
            buffers.push(data);
            return placeholder;
        }
        else if (Array.isArray(data)) {
            const newData = new Array(data.length);
            for (let i = 0; i < data.length; i++) {
                newData[i] = _deconstructPacket(data[i], buffers);
            }
            return newData;
        }
        else if (typeof data === "object" && !(data instanceof Date)) {
            const newData = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    newData[key] = _deconstructPacket(data[key], buffers);
                }
            }
            return newData;
        }
        return data;
    }
    /**
     * Reconstructs a binary packet from its placeholder packet and buffers
     *
     * @param {Object} packet - event packet with placeholders
     * @param {Array} buffers - binary buffers to put in placeholder positions
     * @return {Object} reconstructed packet
     * @public
     */
    function reconstructPacket(packet, buffers) {
        packet.data = _reconstructPacket(packet.data, buffers);
        packet.attachments = undefined; // no longer useful
        return packet;
    }
    function _reconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (data && data._placeholder === true) {
            const isIndexValid = typeof data.num === "number" &&
                data.num >= 0 &&
                data.num < buffers.length;
            if (isIndexValid) {
                return buffers[data.num]; // appropriate buffer (should be natural order anyway)
            }
            else {
                throw new Error("illegal attachments");
            }
        }
        else if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                data[i] = _reconstructPacket(data[i], buffers);
            }
        }
        else if (typeof data === "object") {
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    data[key] = _reconstructPacket(data[key], buffers);
                }
            }
        }
        return data;
    }

    /**
     * Protocol version.
     *
     * @public
     */
    const protocol = 5;
    var PacketType;
    (function (PacketType) {
        PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
        PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
        PacketType[PacketType["EVENT"] = 2] = "EVENT";
        PacketType[PacketType["ACK"] = 3] = "ACK";
        PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
        PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
        PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
    })(PacketType || (PacketType = {}));
    /**
     * A socket.io Encoder instance
     */
    class Encoder {
        /**
         * Encoder constructor
         *
         * @param {function} replacer - custom replacer to pass down to JSON.parse
         */
        constructor(replacer) {
            this.replacer = replacer;
        }
        /**
         * Encode a packet as a single string if non-binary, or as a
         * buffer sequence, depending on packet type.
         *
         * @param {Object} obj - packet object
         */
        encode(obj) {
            if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
                if (hasBinary(obj)) {
                    obj.type =
                        obj.type === PacketType.EVENT
                            ? PacketType.BINARY_EVENT
                            : PacketType.BINARY_ACK;
                    return this.encodeAsBinary(obj);
                }
            }
            return [this.encodeAsString(obj)];
        }
        /**
         * Encode packet as string.
         */
        encodeAsString(obj) {
            // first is type
            let str = "" + obj.type;
            // attachments if we have them
            if (obj.type === PacketType.BINARY_EVENT ||
                obj.type === PacketType.BINARY_ACK) {
                str += obj.attachments + "-";
            }
            // if we have a namespace other than `/`
            // we append it followed by a comma `,`
            if (obj.nsp && "/" !== obj.nsp) {
                str += obj.nsp + ",";
            }
            // immediately followed by the id
            if (null != obj.id) {
                str += obj.id;
            }
            // json data
            if (null != obj.data) {
                str += JSON.stringify(obj.data, this.replacer);
            }
            return str;
        }
        /**
         * Encode packet as 'buffer sequence' by removing blobs, and
         * deconstructing packet into object with placeholders and
         * a list of buffers.
         */
        encodeAsBinary(obj) {
            const deconstruction = deconstructPacket(obj);
            const pack = this.encodeAsString(deconstruction.packet);
            const buffers = deconstruction.buffers;
            buffers.unshift(pack); // add packet info to beginning of data list
            return buffers; // write all the buffers
        }
    }
    /**
     * A socket.io Decoder instance
     *
     * @return {Object} decoder
     */
    class Decoder extends Emitter {
        /**
         * Decoder constructor
         *
         * @param {function} reviver - custom reviver to pass down to JSON.stringify
         */
        constructor(reviver) {
            super();
            this.reviver = reviver;
        }
        /**
         * Decodes an encoded packet string into packet JSON.
         *
         * @param {String} obj - encoded packet
         */
        add(obj) {
            let packet;
            if (typeof obj === "string") {
                if (this.reconstructor) {
                    throw new Error("got plaintext data when reconstructing a packet");
                }
                packet = this.decodeString(obj);
                if (packet.type === PacketType.BINARY_EVENT ||
                    packet.type === PacketType.BINARY_ACK) {
                    // binary packet's json
                    this.reconstructor = new BinaryReconstructor(packet);
                    // no attachments, labeled binary but no binary data to follow
                    if (packet.attachments === 0) {
                        super.emitReserved("decoded", packet);
                    }
                }
                else {
                    // non-binary full packet
                    super.emitReserved("decoded", packet);
                }
            }
            else if (isBinary(obj) || obj.base64) {
                // raw binary data
                if (!this.reconstructor) {
                    throw new Error("got binary data when not reconstructing a packet");
                }
                else {
                    packet = this.reconstructor.takeBinaryData(obj);
                    if (packet) {
                        // received final buffer
                        this.reconstructor = null;
                        super.emitReserved("decoded", packet);
                    }
                }
            }
            else {
                throw new Error("Unknown type: " + obj);
            }
        }
        /**
         * Decode a packet String (JSON data)
         *
         * @param {String} str
         * @return {Object} packet
         */
        decodeString(str) {
            let i = 0;
            // look up type
            const p = {
                type: Number(str.charAt(0)),
            };
            if (PacketType[p.type] === undefined) {
                throw new Error("unknown packet type " + p.type);
            }
            // look up attachments if type binary
            if (p.type === PacketType.BINARY_EVENT ||
                p.type === PacketType.BINARY_ACK) {
                const start = i + 1;
                while (str.charAt(++i) !== "-" && i != str.length) { }
                const buf = str.substring(start, i);
                if (buf != Number(buf) || str.charAt(i) !== "-") {
                    throw new Error("Illegal attachments");
                }
                p.attachments = Number(buf);
            }
            // look up namespace (if any)
            if ("/" === str.charAt(i + 1)) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if ("," === c)
                        break;
                    if (i === str.length)
                        break;
                }
                p.nsp = str.substring(start, i);
            }
            else {
                p.nsp = "/";
            }
            // look up id
            const next = str.charAt(i + 1);
            if ("" !== next && Number(next) == next) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if (null == c || Number(c) != c) {
                        --i;
                        break;
                    }
                    if (i === str.length)
                        break;
                }
                p.id = Number(str.substring(start, i + 1));
            }
            // look up json data
            if (str.charAt(++i)) {
                const payload = this.tryParse(str.substr(i));
                if (Decoder.isPayloadValid(p.type, payload)) {
                    p.data = payload;
                }
                else {
                    throw new Error("invalid payload");
                }
            }
            return p;
        }
        tryParse(str) {
            try {
                return JSON.parse(str, this.reviver);
            }
            catch (e) {
                return false;
            }
        }
        static isPayloadValid(type, payload) {
            switch (type) {
                case PacketType.CONNECT:
                    return typeof payload === "object";
                case PacketType.DISCONNECT:
                    return payload === undefined;
                case PacketType.CONNECT_ERROR:
                    return typeof payload === "string" || typeof payload === "object";
                case PacketType.EVENT:
                case PacketType.BINARY_EVENT:
                    return Array.isArray(payload) && payload.length > 0;
                case PacketType.ACK:
                case PacketType.BINARY_ACK:
                    return Array.isArray(payload);
            }
        }
        /**
         * Deallocates a parser's resources
         */
        destroy() {
            if (this.reconstructor) {
                this.reconstructor.finishedReconstruction();
            }
        }
    }
    /**
     * A manager of a binary event's 'buffer sequence'. Should
     * be constructed whenever a packet of type BINARY_EVENT is
     * decoded.
     *
     * @param {Object} packet
     * @return {BinaryReconstructor} initialized reconstructor
     */
    class BinaryReconstructor {
        constructor(packet) {
            this.packet = packet;
            this.buffers = [];
            this.reconPack = packet;
        }
        /**
         * Method to be called when binary data received from connection
         * after a BINARY_EVENT packet.
         *
         * @param {Buffer | ArrayBuffer} binData - the raw binary data received
         * @return {null | Object} returns null if more binary data is expected or
         *   a reconstructed packet object if all buffers have been received.
         */
        takeBinaryData(binData) {
            this.buffers.push(binData);
            if (this.buffers.length === this.reconPack.attachments) {
                // done with buffer list
                const packet = reconstructPacket(this.reconPack, this.buffers);
                this.finishedReconstruction();
                return packet;
            }
            return null;
        }
        /**
         * Cleans up binary packet reconstruction variables.
         */
        finishedReconstruction() {
            this.reconPack = null;
            this.buffers = [];
        }
    }

    var parser = /*#__PURE__*/Object.freeze({
        __proto__: null,
        protocol: protocol,
        get PacketType () { return PacketType; },
        Encoder: Encoder,
        Decoder: Decoder
    });

    function on(obj, ev, fn) {
        obj.on(ev, fn);
        return function subDestroy() {
            obj.off(ev, fn);
        };
    }

    /**
     * Internal events.
     * These events can't be emitted by the user.
     */
    const RESERVED_EVENTS = Object.freeze({
        connect: 1,
        connect_error: 1,
        disconnect: 1,
        disconnecting: 1,
        // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
        newListener: 1,
        removeListener: 1,
    });
    class Socket extends Emitter {
        /**
         * `Socket` constructor.
         *
         * @public
         */
        constructor(io, nsp, opts) {
            super();
            this.connected = false;
            this.receiveBuffer = [];
            this.sendBuffer = [];
            this.ids = 0;
            this.acks = {};
            this.flags = {};
            this.io = io;
            this.nsp = nsp;
            if (opts && opts.auth) {
                this.auth = opts.auth;
            }
            if (this.io._autoConnect)
                this.open();
        }
        /**
         * Whether the socket is currently disconnected
         */
        get disconnected() {
            return !this.connected;
        }
        /**
         * Subscribe to open, close and packet events
         *
         * @private
         */
        subEvents() {
            if (this.subs)
                return;
            const io = this.io;
            this.subs = [
                on(io, "open", this.onopen.bind(this)),
                on(io, "packet", this.onpacket.bind(this)),
                on(io, "error", this.onerror.bind(this)),
                on(io, "close", this.onclose.bind(this)),
            ];
        }
        /**
         * Whether the Socket will try to reconnect when its Manager connects or reconnects
         */
        get active() {
            return !!this.subs;
        }
        /**
         * "Opens" the socket.
         *
         * @public
         */
        connect() {
            if (this.connected)
                return this;
            this.subEvents();
            if (!this.io["_reconnecting"])
                this.io.open(); // ensure open
            if ("open" === this.io._readyState)
                this.onopen();
            return this;
        }
        /**
         * Alias for connect()
         */
        open() {
            return this.connect();
        }
        /**
         * Sends a `message` event.
         *
         * @return self
         * @public
         */
        send(...args) {
            args.unshift("message");
            this.emit.apply(this, args);
            return this;
        }
        /**
         * Override `emit`.
         * If the event is in `events`, it's emitted normally.
         *
         * @return self
         * @public
         */
        emit(ev, ...args) {
            if (RESERVED_EVENTS.hasOwnProperty(ev)) {
                throw new Error('"' + ev + '" is a reserved event name');
            }
            args.unshift(ev);
            const packet = {
                type: PacketType.EVENT,
                data: args,
            };
            packet.options = {};
            packet.options.compress = this.flags.compress !== false;
            // event ack callback
            if ("function" === typeof args[args.length - 1]) {
                const id = this.ids++;
                const ack = args.pop();
                this._registerAckCallback(id, ack);
                packet.id = id;
            }
            const isTransportWritable = this.io.engine &&
                this.io.engine.transport &&
                this.io.engine.transport.writable;
            const discardPacket = this.flags.volatile && (!isTransportWritable || !this.connected);
            if (discardPacket) ;
            else if (this.connected) {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            }
            else {
                this.sendBuffer.push(packet);
            }
            this.flags = {};
            return this;
        }
        /**
         * @private
         */
        _registerAckCallback(id, ack) {
            const timeout = this.flags.timeout;
            if (timeout === undefined) {
                this.acks[id] = ack;
                return;
            }
            // @ts-ignore
            const timer = this.io.setTimeoutFn(() => {
                delete this.acks[id];
                for (let i = 0; i < this.sendBuffer.length; i++) {
                    if (this.sendBuffer[i].id === id) {
                        this.sendBuffer.splice(i, 1);
                    }
                }
                ack.call(this, new Error("operation has timed out"));
            }, timeout);
            this.acks[id] = (...args) => {
                // @ts-ignore
                this.io.clearTimeoutFn(timer);
                ack.apply(this, [null, ...args]);
            };
        }
        /**
         * Sends a packet.
         *
         * @param packet
         * @private
         */
        packet(packet) {
            packet.nsp = this.nsp;
            this.io._packet(packet);
        }
        /**
         * Called upon engine `open`.
         *
         * @private
         */
        onopen() {
            if (typeof this.auth == "function") {
                this.auth((data) => {
                    this.packet({ type: PacketType.CONNECT, data });
                });
            }
            else {
                this.packet({ type: PacketType.CONNECT, data: this.auth });
            }
        }
        /**
         * Called upon engine or manager `error`.
         *
         * @param err
         * @private
         */
        onerror(err) {
            if (!this.connected) {
                this.emitReserved("connect_error", err);
            }
        }
        /**
         * Called upon engine `close`.
         *
         * @param reason
         * @param description
         * @private
         */
        onclose(reason, description) {
            this.connected = false;
            delete this.id;
            this.emitReserved("disconnect", reason, description);
        }
        /**
         * Called with socket packet.
         *
         * @param packet
         * @private
         */
        onpacket(packet) {
            const sameNamespace = packet.nsp === this.nsp;
            if (!sameNamespace)
                return;
            switch (packet.type) {
                case PacketType.CONNECT:
                    if (packet.data && packet.data.sid) {
                        const id = packet.data.sid;
                        this.onconnect(id);
                    }
                    else {
                        this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                    }
                    break;
                case PacketType.EVENT:
                case PacketType.BINARY_EVENT:
                    this.onevent(packet);
                    break;
                case PacketType.ACK:
                case PacketType.BINARY_ACK:
                    this.onack(packet);
                    break;
                case PacketType.DISCONNECT:
                    this.ondisconnect();
                    break;
                case PacketType.CONNECT_ERROR:
                    this.destroy();
                    const err = new Error(packet.data.message);
                    // @ts-ignore
                    err.data = packet.data.data;
                    this.emitReserved("connect_error", err);
                    break;
            }
        }
        /**
         * Called upon a server event.
         *
         * @param packet
         * @private
         */
        onevent(packet) {
            const args = packet.data || [];
            if (null != packet.id) {
                args.push(this.ack(packet.id));
            }
            if (this.connected) {
                this.emitEvent(args);
            }
            else {
                this.receiveBuffer.push(Object.freeze(args));
            }
        }
        emitEvent(args) {
            if (this._anyListeners && this._anyListeners.length) {
                const listeners = this._anyListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, args);
                }
            }
            super.emit.apply(this, args);
        }
        /**
         * Produces an ack callback to emit with an event.
         *
         * @private
         */
        ack(id) {
            const self = this;
            let sent = false;
            return function (...args) {
                // prevent double callbacks
                if (sent)
                    return;
                sent = true;
                self.packet({
                    type: PacketType.ACK,
                    id: id,
                    data: args,
                });
            };
        }
        /**
         * Called upon a server acknowlegement.
         *
         * @param packet
         * @private
         */
        onack(packet) {
            const ack = this.acks[packet.id];
            if ("function" === typeof ack) {
                ack.apply(this, packet.data);
                delete this.acks[packet.id];
            }
        }
        /**
         * Called upon server connect.
         *
         * @private
         */
        onconnect(id) {
            this.id = id;
            this.connected = true;
            this.emitBuffered();
            this.emitReserved("connect");
        }
        /**
         * Emit buffered events (received and emitted).
         *
         * @private
         */
        emitBuffered() {
            this.receiveBuffer.forEach((args) => this.emitEvent(args));
            this.receiveBuffer = [];
            this.sendBuffer.forEach((packet) => {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            });
            this.sendBuffer = [];
        }
        /**
         * Called upon server disconnect.
         *
         * @private
         */
        ondisconnect() {
            this.destroy();
            this.onclose("io server disconnect");
        }
        /**
         * Called upon forced client/server side disconnections,
         * this method ensures the manager stops tracking us and
         * that reconnections don't get triggered for this.
         *
         * @private
         */
        destroy() {
            if (this.subs) {
                // clean subscriptions to avoid reconnections
                this.subs.forEach((subDestroy) => subDestroy());
                this.subs = undefined;
            }
            this.io["_destroy"](this);
        }
        /**
         * Disconnects the socket manually.
         *
         * @return self
         * @public
         */
        disconnect() {
            if (this.connected) {
                this.packet({ type: PacketType.DISCONNECT });
            }
            // remove socket from pool
            this.destroy();
            if (this.connected) {
                // fire events
                this.onclose("io client disconnect");
            }
            return this;
        }
        /**
         * Alias for disconnect()
         *
         * @return self
         * @public
         */
        close() {
            return this.disconnect();
        }
        /**
         * Sets the compress flag.
         *
         * @param compress - if `true`, compresses the sending data
         * @return self
         * @public
         */
        compress(compress) {
            this.flags.compress = compress;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
         * ready to send messages.
         *
         * @returns self
         * @public
         */
        get volatile() {
            this.flags.volatile = true;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
         * given number of milliseconds have elapsed without an acknowledgement from the server:
         *
         * ```
         * socket.timeout(5000).emit("my-event", (err) => {
         *   if (err) {
         *     // the server did not acknowledge the event in the given delay
         *   }
         * });
         * ```
         *
         * @returns self
         * @public
         */
        timeout(timeout) {
            this.flags.timeout = timeout;
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * @param listener
         * @public
         */
        onAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * @param listener
         * @public
         */
        prependAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @param listener
         * @public
         */
        offAny(listener) {
            if (!this._anyListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         *
         * @public
         */
        listenersAny() {
            return this._anyListeners || [];
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * @param listener
         *
         * <pre><code>
         *
         * socket.onAnyOutgoing((event, ...args) => {
         *   console.log(event);
         * });
         *
         * </pre></code>
         *
         * @public
         */
        onAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * @param listener
         *
         * <pre><code>
         *
         * socket.prependAnyOutgoing((event, ...args) => {
         *   console.log(event);
         * });
         *
         * </pre></code>
         *
         * @public
         */
        prependAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @param listener
         *
         * <pre><code>
         *
         * const handler = (event, ...args) => {
         *   console.log(event);
         * }
         *
         * socket.onAnyOutgoing(handler);
         *
         * // then later
         * socket.offAnyOutgoing(handler);
         *
         * </pre></code>
         *
         * @public
         */
        offAnyOutgoing(listener) {
            if (!this._anyOutgoingListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyOutgoingListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyOutgoingListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         *
         * @public
         */
        listenersAnyOutgoing() {
            return this._anyOutgoingListeners || [];
        }
        /**
         * Notify the listeners for each packet sent
         *
         * @param packet
         *
         * @private
         */
        notifyOutgoingListeners(packet) {
            if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
                const listeners = this._anyOutgoingListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, packet.data);
                }
            }
        }
    }

    /**
     * Initialize backoff timer with `opts`.
     *
     * - `min` initial timeout in milliseconds [100]
     * - `max` max timeout [10000]
     * - `jitter` [0]
     * - `factor` [2]
     *
     * @param {Object} opts
     * @api public
     */
    function Backoff(opts) {
        opts = opts || {};
        this.ms = opts.min || 100;
        this.max = opts.max || 10000;
        this.factor = opts.factor || 2;
        this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
        this.attempts = 0;
    }
    /**
     * Return the backoff duration.
     *
     * @return {Number}
     * @api public
     */
    Backoff.prototype.duration = function () {
        var ms = this.ms * Math.pow(this.factor, this.attempts++);
        if (this.jitter) {
            var rand = Math.random();
            var deviation = Math.floor(rand * this.jitter * ms);
            ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
        }
        return Math.min(ms, this.max) | 0;
    };
    /**
     * Reset the number of attempts.
     *
     * @api public
     */
    Backoff.prototype.reset = function () {
        this.attempts = 0;
    };
    /**
     * Set the minimum duration
     *
     * @api public
     */
    Backoff.prototype.setMin = function (min) {
        this.ms = min;
    };
    /**
     * Set the maximum duration
     *
     * @api public
     */
    Backoff.prototype.setMax = function (max) {
        this.max = max;
    };
    /**
     * Set the jitter
     *
     * @api public
     */
    Backoff.prototype.setJitter = function (jitter) {
        this.jitter = jitter;
    };

    class Manager extends Emitter {
        constructor(uri, opts) {
            var _a;
            super();
            this.nsps = {};
            this.subs = [];
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = undefined;
            }
            opts = opts || {};
            opts.path = opts.path || "/socket.io";
            this.opts = opts;
            installTimerFunctions(this, opts);
            this.reconnection(opts.reconnection !== false);
            this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
            this.reconnectionDelay(opts.reconnectionDelay || 1000);
            this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
            this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
            this.backoff = new Backoff({
                min: this.reconnectionDelay(),
                max: this.reconnectionDelayMax(),
                jitter: this.randomizationFactor(),
            });
            this.timeout(null == opts.timeout ? 20000 : opts.timeout);
            this._readyState = "closed";
            this.uri = uri;
            const _parser = opts.parser || parser;
            this.encoder = new _parser.Encoder();
            this.decoder = new _parser.Decoder();
            this._autoConnect = opts.autoConnect !== false;
            if (this._autoConnect)
                this.open();
        }
        reconnection(v) {
            if (!arguments.length)
                return this._reconnection;
            this._reconnection = !!v;
            return this;
        }
        reconnectionAttempts(v) {
            if (v === undefined)
                return this._reconnectionAttempts;
            this._reconnectionAttempts = v;
            return this;
        }
        reconnectionDelay(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelay;
            this._reconnectionDelay = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
            return this;
        }
        randomizationFactor(v) {
            var _a;
            if (v === undefined)
                return this._randomizationFactor;
            this._randomizationFactor = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
            return this;
        }
        reconnectionDelayMax(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelayMax;
            this._reconnectionDelayMax = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
            return this;
        }
        timeout(v) {
            if (!arguments.length)
                return this._timeout;
            this._timeout = v;
            return this;
        }
        /**
         * Starts trying to reconnect if reconnection is enabled and we have not
         * started reconnecting yet
         *
         * @private
         */
        maybeReconnectOnOpen() {
            // Only try to reconnect if it's the first time we're connecting
            if (!this._reconnecting &&
                this._reconnection &&
                this.backoff.attempts === 0) {
                // keeps reconnection from firing twice for the same reconnection loop
                this.reconnect();
            }
        }
        /**
         * Sets the current transport `socket`.
         *
         * @param {Function} fn - optional, callback
         * @return self
         * @public
         */
        open(fn) {
            if (~this._readyState.indexOf("open"))
                return this;
            this.engine = new Socket$1(this.uri, this.opts);
            const socket = this.engine;
            const self = this;
            this._readyState = "opening";
            this.skipReconnect = false;
            // emit `open`
            const openSubDestroy = on(socket, "open", function () {
                self.onopen();
                fn && fn();
            });
            // emit `error`
            const errorSub = on(socket, "error", (err) => {
                self.cleanup();
                self._readyState = "closed";
                this.emitReserved("error", err);
                if (fn) {
                    fn(err);
                }
                else {
                    // Only do this if there is no fn to handle the error
                    self.maybeReconnectOnOpen();
                }
            });
            if (false !== this._timeout) {
                const timeout = this._timeout;
                if (timeout === 0) {
                    openSubDestroy(); // prevents a race condition with the 'open' event
                }
                // set timer
                const timer = this.setTimeoutFn(() => {
                    openSubDestroy();
                    socket.close();
                    // @ts-ignore
                    socket.emit("error", new Error("timeout"));
                }, timeout);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(function subDestroy() {
                    clearTimeout(timer);
                });
            }
            this.subs.push(openSubDestroy);
            this.subs.push(errorSub);
            return this;
        }
        /**
         * Alias for open()
         *
         * @return self
         * @public
         */
        connect(fn) {
            return this.open(fn);
        }
        /**
         * Called upon transport open.
         *
         * @private
         */
        onopen() {
            // clear old subs
            this.cleanup();
            // mark as open
            this._readyState = "open";
            this.emitReserved("open");
            // add new subs
            const socket = this.engine;
            this.subs.push(on(socket, "ping", this.onping.bind(this)), on(socket, "data", this.ondata.bind(this)), on(socket, "error", this.onerror.bind(this)), on(socket, "close", this.onclose.bind(this)), on(this.decoder, "decoded", this.ondecoded.bind(this)));
        }
        /**
         * Called upon a ping.
         *
         * @private
         */
        onping() {
            this.emitReserved("ping");
        }
        /**
         * Called with data.
         *
         * @private
         */
        ondata(data) {
            this.decoder.add(data);
        }
        /**
         * Called when parser fully decodes a packet.
         *
         * @private
         */
        ondecoded(packet) {
            this.emitReserved("packet", packet);
        }
        /**
         * Called upon socket error.
         *
         * @private
         */
        onerror(err) {
            this.emitReserved("error", err);
        }
        /**
         * Creates a new socket for the given `nsp`.
         *
         * @return {Socket}
         * @public
         */
        socket(nsp, opts) {
            let socket = this.nsps[nsp];
            if (!socket) {
                socket = new Socket(this, nsp, opts);
                this.nsps[nsp] = socket;
            }
            return socket;
        }
        /**
         * Called upon a socket close.
         *
         * @param socket
         * @private
         */
        _destroy(socket) {
            const nsps = Object.keys(this.nsps);
            for (const nsp of nsps) {
                const socket = this.nsps[nsp];
                if (socket.active) {
                    return;
                }
            }
            this._close();
        }
        /**
         * Writes a packet.
         *
         * @param packet
         * @private
         */
        _packet(packet) {
            const encodedPackets = this.encoder.encode(packet);
            for (let i = 0; i < encodedPackets.length; i++) {
                this.engine.write(encodedPackets[i], packet.options);
            }
        }
        /**
         * Clean up transport subscriptions and packet buffer.
         *
         * @private
         */
        cleanup() {
            this.subs.forEach((subDestroy) => subDestroy());
            this.subs.length = 0;
            this.decoder.destroy();
        }
        /**
         * Close the current socket.
         *
         * @private
         */
        _close() {
            this.skipReconnect = true;
            this._reconnecting = false;
            this.onclose("forced close");
            if (this.engine)
                this.engine.close();
        }
        /**
         * Alias for close()
         *
         * @private
         */
        disconnect() {
            return this._close();
        }
        /**
         * Called upon engine close.
         *
         * @private
         */
        onclose(reason, description) {
            this.cleanup();
            this.backoff.reset();
            this._readyState = "closed";
            this.emitReserved("close", reason, description);
            if (this._reconnection && !this.skipReconnect) {
                this.reconnect();
            }
        }
        /**
         * Attempt a reconnection.
         *
         * @private
         */
        reconnect() {
            if (this._reconnecting || this.skipReconnect)
                return this;
            const self = this;
            if (this.backoff.attempts >= this._reconnectionAttempts) {
                this.backoff.reset();
                this.emitReserved("reconnect_failed");
                this._reconnecting = false;
            }
            else {
                const delay = this.backoff.duration();
                this._reconnecting = true;
                const timer = this.setTimeoutFn(() => {
                    if (self.skipReconnect)
                        return;
                    this.emitReserved("reconnect_attempt", self.backoff.attempts);
                    // check again for the case socket closed in above events
                    if (self.skipReconnect)
                        return;
                    self.open((err) => {
                        if (err) {
                            self._reconnecting = false;
                            self.reconnect();
                            this.emitReserved("reconnect_error", err);
                        }
                        else {
                            self.onreconnect();
                        }
                    });
                }, delay);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(function subDestroy() {
                    clearTimeout(timer);
                });
            }
        }
        /**
         * Called upon successful reconnect.
         *
         * @private
         */
        onreconnect() {
            const attempt = this.backoff.attempts;
            this._reconnecting = false;
            this.backoff.reset();
            this.emitReserved("reconnect", attempt);
        }
    }

    /**
     * Managers cache.
     */
    const cache = {};
    function lookup(uri, opts) {
        if (typeof uri === "object") {
            opts = uri;
            uri = undefined;
        }
        opts = opts || {};
        const parsed = url(uri, opts.path || "/socket.io");
        const source = parsed.source;
        const id = parsed.id;
        const path = parsed.path;
        const sameNamespace = cache[id] && path in cache[id]["nsps"];
        const newConnection = opts.forceNew ||
            opts["force new connection"] ||
            false === opts.multiplex ||
            sameNamespace;
        let io;
        if (newConnection) {
            io = new Manager(source, opts);
        }
        else {
            if (!cache[id]) {
                cache[id] = new Manager(source, opts);
            }
            io = cache[id];
        }
        if (parsed.query && !opts.query) {
            opts.query = parsed.queryKey;
        }
        return io.socket(parsed.path, opts);
    }
    // so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
    // namespace (e.g. `io.connect(...)`), for backward compatibility
    Object.assign(lookup, {
        Manager,
        Socket,
        io: lookup,
        connect: lookup,
    });

    const FRONTEND_URL = 'http://localhost:8080';
    const BACKEND_URL = 'http://localhost:3000';

    /* src/routes/Chat.svelte generated by Svelte v3.49.0 */
    const file$6 = "src/routes/Chat.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[94] = list[i];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[97] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[100] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[103] = list[i];
    	return child_ctx;
    }

    // (978:2) {:else}
    function create_else_block_8(ctx) {
    	let h1;

    	const block_1 = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "ACCESS DENIED";
    			set_style(h1, "text-align", "center");
    			set_style(h1, "color", "black");
    			add_location(h1, file$6, 978, 4, 35424);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_8.name,
    		type: "else",
    		source: "(978:2) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (518:2) {#if $logged == 'true'}
    function create_if_block$5(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*creation*/ ctx[7] == true) return create_if_block_1$5;
    		return create_else_block$5;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(518:2) {#if $logged == 'true'}",
    		ctx
    	});

    	return block_1;
    }

    // (574:4) {:else}
    function create_else_block$5(ctx) {
    	let div0;
    	let h1;
    	let t1;
    	let t2;
    	let div9;
    	let div3;
    	let h40;
    	let t4;
    	let div1;
    	let t5;
    	let div2;
    	let h41;
    	let t7;
    	let t8;
    	let div7;
    	let div4;
    	let t9;
    	let div5;
    	let form;
    	let input;
    	let t10;
    	let button0;
    	let t12;
    	let div6;
    	let button1;
    	let t14;
    	let show_if_1;
    	let t15;
    	let t16;
    	let div8;
    	let h42;
    	let t18;
    	let show_if = /*currentRoom*/ ctx[4] && /*myChannels*/ ctx[18].indexOf(/*currentRoom*/ ctx[4].name) != -1 && !/*currentUser*/ ctx[6];
    	let t19;
    	let mounted;
    	let dispose;

    	function select_block_type_2(ctx, dirty) {
    		if (/*currentRoom*/ ctx[4]) return create_if_block_34;
    		return create_else_block_7;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block0 = current_block_type(ctx);
    	let each_value_3 = /*rooms*/ ctx[3];
    	validate_each_argument(each_value_3);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let each_value_2 = /*privateMessages*/ ctx[2];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let if_block1 = /*currentRoom*/ ctx[4] && create_if_block_22(ctx);

    	function select_block_type_8(ctx, dirty) {
    		if (dirty[0] & /*currentRoom, myChannels*/ 262160) show_if_1 = null;
    		if (/*currentRoom*/ ctx[4] && /*currentRoom*/ ctx[4].isDirectMessage == true) return create_if_block_19$1;
    		if (/*currentRoom*/ ctx[4] && /*currentRoom*/ ctx[4].channelOwnerId == /*$id*/ ctx[22]) return create_if_block_20$1;
    		if (show_if_1 == null) show_if_1 = !!(/*currentRoom*/ ctx[4] && /*myChannels*/ ctx[18].indexOf(/*currentRoom*/ ctx[4].name) != -1);
    		if (show_if_1) return create_if_block_21;
    	}

    	let current_block_type_1 = select_block_type_8(ctx, [-1, -1, -1, -1]);
    	let if_block2 = current_block_type_1 && current_block_type_1(ctx);
    	let if_block3 = /*currentRoom*/ ctx[4] && /*currentRoom*/ ctx[4].channelOwnerId == /*$id*/ ctx[22] && /*currentRoom*/ ctx[4].isPublic == false && create_if_block_17$1(ctx);
    	let if_block4 = show_if && create_if_block_16$1(ctx);
    	let if_block5 = /*currentUser*/ ctx[6] && create_if_block_3$4(ctx);

    	const block_1 = {
    		c: function create() {
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Pong Chat";
    			t1 = space();
    			if_block0.c();
    			t2 = space();
    			div9 = element("div");
    			div3 = element("div");
    			h40 = element("h4");
    			h40.textContent = "Rooms";
    			t4 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t5 = space();
    			div2 = element("div");
    			h41 = element("h4");
    			h41.textContent = "Messages";
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			div7 = element("div");
    			div4 = element("div");
    			if (if_block1) if_block1.c();
    			t9 = space();
    			div5 = element("div");
    			form = element("form");
    			input = element("input");
    			t10 = space();
    			button0 = element("button");
    			button0.textContent = "⏎";
    			t12 = space();
    			div6 = element("div");
    			button1 = element("button");
    			button1.textContent = "Create new room";
    			t14 = space();
    			if (if_block2) if_block2.c();
    			t15 = space();
    			if (if_block3) if_block3.c();
    			t16 = space();
    			div8 = element("div");
    			h42 = element("h4");
    			h42.textContent = "Users";
    			t18 = space();
    			if (if_block4) if_block4.c();
    			t19 = space();
    			if (if_block5) if_block5.c();
    			set_style(h1, "text-align", "center");
    			attr_dev(h1, "class", "text-center");
    			add_location(h1, file$6, 576, 8, 19716);
    			attr_dev(div0, "class", "header");
    			add_location(div0, file$6, 575, 6, 19687);
    			attr_dev(h40, "class", "sectionTitle svelte-qd64xz");
    			add_location(h40, file$6, 594, 10, 20320);
    			attr_dev(div1, "class", "rooms svelte-qd64xz");
    			add_location(div1, file$6, 596, 10, 20389);
    			attr_dev(h41, "class", "sectionTitle svelte-qd64xz");
    			add_location(h41, file$6, 637, 12, 22172);
    			attr_dev(div2, "class", "privateMessages svelte-qd64xz");
    			add_location(div2, file$6, 636, 10, 22130);
    			attr_dev(div3, "class", "column1 svelte-qd64xz");
    			add_location(div3, file$6, 593, 8, 20288);
    			attr_dev(div4, "id", "messages");
    			attr_dev(div4, "class", "svelte-qd64xz");
    			add_location(div4, file$6, 667, 10, 23380);
    			attr_dev(input, "placeholder", "Enter message...");
    			add_location(input, file$6, 720, 14, 25569);
    			attr_dev(form, "class", "form-control svelte-qd64xz");
    			add_location(form, file$6, 719, 12, 25488);
    			attr_dev(button0, "class", "sendButton svelte-qd64xz");
    			add_location(button0, file$6, 722, 12, 25661);
    			attr_dev(div5, "class", "my-buttons svelte-qd64xz");
    			add_location(div5, file$6, 718, 10, 25451);
    			attr_dev(button1, "id", "createRoom");
    			attr_dev(button1, "class", "svelte-qd64xz");
    			add_location(button1, file$6, 727, 12, 25829);
    			attr_dev(div6, "class", "my-buttons svelte-qd64xz");
    			add_location(div6, file$6, 726, 10, 25792);
    			attr_dev(div7, "id", "chat");
    			attr_dev(div7, "class", "column2 svelte-qd64xz");
    			add_location(div7, file$6, 666, 8, 23338);
    			attr_dev(h42, "class", "sectionTitle2 svelte-qd64xz");
    			add_location(h42, file$6, 782, 10, 27909);
    			attr_dev(div8, "class", "column3 svelte-qd64xz");
    			add_location(div8, file$6, 781, 8, 27877);
    			attr_dev(div9, "class", "row svelte-qd64xz");
    			add_location(div9, file$6, 591, 6, 20238);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			if_block0.m(div0, null);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div3);
    			append_dev(div3, h40);
    			append_dev(div3, t4);
    			append_dev(div3, div1);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, h41);
    			append_dev(div2, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(div9, t8);
    			append_dev(div9, div7);
    			append_dev(div7, div4);
    			if (if_block1) if_block1.m(div4, null);
    			append_dev(div7, t9);
    			append_dev(div7, div5);
    			append_dev(div5, form);
    			append_dev(form, input);
    			set_input_value(input, /*Otext*/ ctx[0]);
    			append_dev(div5, t10);
    			append_dev(div5, button0);
    			append_dev(div7, t12);
    			append_dev(div7, div6);
    			append_dev(div6, button1);
    			append_dev(div6, t14);
    			if (if_block2) if_block2.m(div6, null);
    			append_dev(div7, t15);
    			if (if_block3) if_block3.m(div7, null);
    			append_dev(div9, t16);
    			append_dev(div9, div8);
    			append_dev(div8, h42);
    			append_dev(div8, t18);
    			if (if_block4) if_block4.m(div8, null);
    			append_dev(div8, t19);
    			if (if_block5) if_block5.m(div8, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_2*/ ctx[60]),
    					listen_dev(form, "submit", prevent_default(/*sendMessage*/ ctx[43]), false, true, false),
    					listen_dev(button0, "click", prevent_default(/*sendMessage*/ ctx[43]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*click_handler_9*/ ctx[61]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			}

    			if (dirty[0] & /*rooms, $id, currentRoom, myChannels*/ 4456472 | dirty[1] & /*changeConv*/ 1024) {
    				each_value_3 = /*rooms*/ ctx[3];
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_3(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_3.length;
    			}

    			if (dirty[0] & /*privateMessages, $id, currentRoom*/ 4194324 | dirty[1] & /*changeConvMessages*/ 2048) {
    				each_value_2 = /*privateMessages*/ ctx[2];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}

    			if (/*currentRoom*/ ctx[4]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_22(ctx);
    					if_block1.c();
    					if_block1.m(div4, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*Otext*/ 1 && input.value !== /*Otext*/ ctx[0]) {
    				set_input_value(input, /*Otext*/ ctx[0]);
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_8(ctx, dirty)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if (if_block2) if_block2.d(1);
    				if_block2 = current_block_type_1 && current_block_type_1(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div6, null);
    				}
    			}

    			if (/*currentRoom*/ ctx[4] && /*currentRoom*/ ctx[4].channelOwnerId == /*$id*/ ctx[22] && /*currentRoom*/ ctx[4].isPublic == false) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_17$1(ctx);
    					if_block3.c();
    					if_block3.m(div7, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*currentRoom, myChannels, currentUser*/ 262224) show_if = /*currentRoom*/ ctx[4] && /*myChannels*/ ctx[18].indexOf(/*currentRoom*/ ctx[4].name) != -1 && !/*currentUser*/ ctx[6];

    			if (show_if) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_16$1(ctx);
    					if_block4.c();
    					if_block4.m(div8, t19);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*currentUser*/ ctx[6]) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);
    				} else {
    					if_block5 = create_if_block_3$4(ctx);
    					if_block5.c();
    					if_block5.m(div8, null);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if_block0.d();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div9);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			if (if_block1) if_block1.d();

    			if (if_block2) {
    				if_block2.d();
    			}

    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(574:4) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (519:4) {#if creation == true}
    function create_if_block_1$5(ctx) {
    	let div4;
    	let h2;
    	let t1;
    	let div0;
    	let input0;
    	let t2;
    	let br0;
    	let t3;
    	let div1;
    	let label0;
    	let input1;
    	let t4;
    	let t5;
    	let label1;
    	let input2;
    	let t6;
    	let t7;
    	let br1;
    	let t8;
    	let div3;
    	let t9;
    	let div2;
    	let button0;
    	let t11;
    	let button1;
    	let mounted;
    	let dispose;
    	let if_block = /*password*/ ctx[19] == 'true' && create_if_block_2$5(ctx);

    	const block_1 = {
    		c: function create() {
    			div4 = element("div");
    			h2 = element("h2");
    			h2.textContent = "New Chat Room";
    			t1 = space();
    			div0 = element("div");
    			input0 = element("input");
    			t2 = space();
    			br0 = element("br");
    			t3 = space();
    			div1 = element("div");
    			label0 = element("label");
    			input1 = element("input");
    			t4 = text("\n            Public");
    			t5 = space();
    			label1 = element("label");
    			input2 = element("input");
    			t6 = text("\n            Private");
    			t7 = space();
    			br1 = element("br");
    			t8 = space();
    			div3 = element("div");
    			if (if_block) if_block.c();
    			t9 = space();
    			div2 = element("div");
    			button0 = element("button");
    			button0.textContent = "Create new room";
    			t11 = space();
    			button1 = element("button");
    			button1.textContent = "🔙";
    			add_location(h2, file$6, 521, 8, 18306);
    			attr_dev(input0, "placeholder", "Chat room's name");
    			add_location(input0, file$6, 523, 10, 18353);
    			add_location(div0, file$6, 522, 8, 18337);
    			add_location(br0, file$6, 525, 8, 18436);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "true";
    			input1.value = input1.__value;
    			/*$$binding_groups*/ ctx[47][0].push(input1);
    			add_location(input1, file$6, 528, 12, 18487);
    			add_location(label0, file$6, 527, 10, 18467);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "false";
    			input2.value = input2.__value;
    			/*$$binding_groups*/ ctx[47][0].push(input2);
    			add_location(input2, file$6, 538, 12, 18704);
    			add_location(label1, file$6, 537, 10, 18684);
    			add_location(div1, file$6, 526, 8, 18451);
    			add_location(br1, file$6, 547, 8, 18912);
    			attr_dev(button0, "class", "create svelte-qd64xz");
    			add_location(button0, file$6, 557, 10, 19160);
    			add_location(div2, file$6, 556, 10, 19144);
    			set_style(button1, "border", "none");
    			set_style(button1, "background-color", "transparent");
    			set_style(button1, "font-size", "36px");
    			add_location(button1, file$6, 561, 10, 19296);
    			add_location(div3, file$6, 548, 8, 18927);
    			attr_dev(div4, "id", "creation");
    			add_location(div4, file$6, 520, 6, 18278);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, h2);
    			append_dev(div4, t1);
    			append_dev(div4, div0);
    			append_dev(div0, input0);
    			set_input_value(input0, /*title*/ ctx[10]);
    			append_dev(div4, t2);
    			append_dev(div4, br0);
    			append_dev(div4, t3);
    			append_dev(div4, div1);
    			append_dev(div1, label0);
    			append_dev(label0, input1);
    			input1.checked = input1.__value === /*free*/ ctx[9];
    			append_dev(label0, t4);
    			append_dev(div1, t5);
    			append_dev(div1, label1);
    			append_dev(label1, input2);
    			input2.checked = input2.__value === /*free*/ ctx[9];
    			append_dev(label1, t6);
    			append_dev(div4, t7);
    			append_dev(div4, br1);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			if (if_block) if_block.m(div3, null);
    			append_dev(div3, t9);
    			append_dev(div3, div2);
    			append_dev(div2, button0);
    			append_dev(div3, t11);
    			append_dev(div3, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[45]),
    					listen_dev(input1, "click", /*removePassword*/ ctx[36], false, false, false),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[46]),
    					listen_dev(input2, "click", /*addPassword*/ ctx[34], false, false, false),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[48]),
    					listen_dev(button0, "click", prevent_default(/*createRoom*/ ctx[27]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*click_handler*/ ctx[50]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*title*/ 1024 && input0.value !== /*title*/ ctx[10]) {
    				set_input_value(input0, /*title*/ ctx[10]);
    			}

    			if (dirty[0] & /*free*/ 512) {
    				input1.checked = input1.__value === /*free*/ ctx[9];
    			}

    			if (dirty[0] & /*free*/ 512) {
    				input2.checked = input2.__value === /*free*/ ctx[9];
    			}

    			if (/*password*/ ctx[19] == 'true') {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2$5(ctx);
    					if_block.c();
    					if_block.m(div3, t9);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			/*$$binding_groups*/ ctx[47][0].splice(/*$$binding_groups*/ ctx[47][0].indexOf(input1), 1);
    			/*$$binding_groups*/ ctx[47][0].splice(/*$$binding_groups*/ ctx[47][0].indexOf(input2), 1);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(519:4) {#if creation == true}",
    		ctx
    	});

    	return block_1;
    }

    // (586:8) {:else}
    function create_else_block_7(ctx) {
    	let h3;

    	const block_1 = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Please select a room to start chatting";
    			set_style(h3, "font-style", "italic");
    			attr_dev(h3, "id", "roomTitle");
    			attr_dev(h3, "class", "svelte-qd64xz");
    			add_location(h3, file$6, 586, 10, 20090);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_7.name,
    		type: "else",
    		source: "(586:8) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (578:8) {#if currentRoom}
    function create_if_block_34(ctx) {
    	let if_block_anchor;

    	function select_block_type_3(ctx, dirty) {
    		if (/*currentRoom*/ ctx[4].isDirectMessage != true) return create_if_block_35;
    		return create_else_block_6$1;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_34.name,
    		type: "if",
    		source: "(578:8) {#if currentRoom}",
    		ctx
    	});

    	return block_1;
    }

    // (581:10) {:else}
    function create_else_block_6$1(ctx) {
    	let h3;
    	let t0;
    	let t1_value = /*currentRoom*/ ctx[4].name + "";
    	let t1;

    	const block_1 = {
    		c: function create() {
    			h3 = element("h3");
    			t0 = text("Conversation ");
    			t1 = text(t1_value);
    			attr_dev(h3, "id", "roomTitle");
    			attr_dev(h3, "class", "svelte-qd64xz");
    			add_location(h3, file$6, 581, 12, 19964);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*currentRoom*/ 16 && t1_value !== (t1_value = /*currentRoom*/ ctx[4].name + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_6$1.name,
    		type: "else",
    		source: "(581:10) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (579:10) {#if currentRoom.isDirectMessage != true}
    function create_if_block_35(ctx) {
    	let h3;
    	let t0;
    	let t1_value = /*currentRoom*/ ctx[4].name.toUpperCase() + "";
    	let t1;

    	const block_1 = {
    		c: function create() {
    			h3 = element("h3");
    			t0 = text("Room #");
    			t1 = text(t1_value);
    			attr_dev(h3, "id", "roomTitle");
    			attr_dev(h3, "class", "svelte-qd64xz");
    			add_location(h3, file$6, 579, 12, 19871);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*currentRoom*/ 16 && t1_value !== (t1_value = /*currentRoom*/ ctx[4].name.toUpperCase() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_35.name,
    		type: "if",
    		source: "(579:10) {#if currentRoom.isDirectMessage != true}",
    		ctx
    	});

    	return block_1;
    }

    // (627:14) {:else}
    function create_else_block_5$2(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*room*/ ctx[103].name.toUpperCase() + "";
    	let t1;
    	let br;
    	let mounted;
    	let dispose;

    	function click_handler_5() {
    		return /*click_handler_5*/ ctx[55](/*room*/ ctx[103]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			t0 = text("#");
    			t1 = text(t1_value);
    			br = element("br");
    			attr_dev(button, "id", "selectRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 627, 16, 21842);
    			add_location(br, file$6, 631, 17, 22022);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_5), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*rooms*/ 8 && t1_value !== (t1_value = /*room*/ ctx[103].name.toUpperCase() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_5$2.name,
    		type: "else",
    		source: "(627:14) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (620:60) 
    function create_if_block_33(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*room*/ ctx[103].name.toUpperCase() + "";
    	let t1;
    	let br;
    	let mounted;
    	let dispose;

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[54](/*room*/ ctx[103]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			t0 = text("#");
    			t1 = text(t1_value);
    			br = element("br");
    			set_style(button, "color", "lightgreen");
    			attr_dev(button, "id", "selectMyRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 620, 16, 21572);
    			add_location(br, file$6, 625, 17, 21797);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_4), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*rooms*/ 8 && t1_value !== (t1_value = /*room*/ ctx[103].name.toUpperCase() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_33.name,
    		type: "if",
    		source: "(620:60) ",
    		ctx
    	});

    	return block_1;
    }

    // (613:83) 
    function create_if_block_32(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*room*/ ctx[103].name.toUpperCase() + "";
    	let t1;
    	let br;
    	let mounted;
    	let dispose;

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[53](/*room*/ ctx[103]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			t0 = text("#");
    			t1 = text(t1_value);
    			br = element("br");
    			set_style(button, "color", "slategrey");
    			set_style(button, "padding", "5px 10px");
    			set_style(button, "background-color", "lightgreen");
    			attr_dev(button, "id", "selectMyRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 613, 16, 21215);
    			add_location(br, file$6, 618, 17, 21488);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_3), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*rooms*/ 8 && t1_value !== (t1_value = /*room*/ ctx[103].name.toUpperCase() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_32.name,
    		type: "if",
    		source: "(613:83) ",
    		ctx
    	});

    	return block_1;
    }

    // (606:51) 
    function create_if_block_31(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*room*/ ctx[103].name.toUpperCase() + "";
    	let t1;
    	let br;
    	let mounted;
    	let dispose;

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[52](/*room*/ ctx[103]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			t0 = text("#");
    			t1 = text(t1_value);
    			br = element("br");
    			set_style(button, "color", "lightblue");
    			attr_dev(button, "id", "selectMyOwnRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 606, 16, 20879);
    			add_location(br, file$6, 611, 17, 21108);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_2), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*rooms*/ 8 && t1_value !== (t1_value = /*room*/ ctx[103].name.toUpperCase() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_31.name,
    		type: "if",
    		source: "(606:51) ",
    		ctx
    	});

    	return block_1;
    }

    // (599:14) {#if room.channelOwnerId == $id && room == currentRoom}
    function create_if_block_30(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*room*/ ctx[103].name.toUpperCase() + "";
    	let t1;
    	let br;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[51](/*room*/ ctx[103]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			t0 = text("#");
    			t1 = text(t1_value);
    			br = element("br");
    			set_style(button, "color", "slategrey");
    			set_style(button, "padding", "5px 10px");
    			set_style(button, "background-color", "lightblue");
    			attr_dev(button, "id", "selectMyOwnRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 599, 16, 20529);
    			add_location(br, file$6, 604, 17, 20804);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_1), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*rooms*/ 8 && t1_value !== (t1_value = /*room*/ ctx[103].name.toUpperCase() + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_30.name,
    		type: "if",
    		source: "(599:14) {#if room.channelOwnerId == $id && room == currentRoom}",
    		ctx
    	});

    	return block_1;
    }

    // (598:12) {#each rooms as room}
    function create_each_block_3(ctx) {
    	let show_if;
    	let show_if_1;
    	let if_block_anchor;

    	function select_block_type_4(ctx, dirty) {
    		if (dirty[0] & /*myChannels, rooms, currentRoom*/ 262168) show_if = null;
    		if (dirty[0] & /*myChannels, rooms*/ 262152) show_if_1 = null;
    		if (/*room*/ ctx[103].channelOwnerId == /*$id*/ ctx[22] && /*room*/ ctx[103] == /*currentRoom*/ ctx[4]) return create_if_block_30;
    		if (/*room*/ ctx[103].channelOwnerId == /*$id*/ ctx[22]) return create_if_block_31;
    		if (show_if == null) show_if = !!(/*myChannels*/ ctx[18].indexOf(/*room*/ ctx[103].name) != -1 && /*room*/ ctx[103] == /*currentRoom*/ ctx[4]);
    		if (show_if) return create_if_block_32;
    		if (show_if_1 == null) show_if_1 = !!(/*myChannels*/ ctx[18].indexOf(/*room*/ ctx[103].name) != -1);
    		if (show_if_1) return create_if_block_33;
    		return create_else_block_5$2;
    	}

    	let current_block_type = select_block_type_4(ctx, [-1, -1, -1, -1]);
    	let if_block = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_4(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(598:12) {#each rooms as room}",
    		ctx
    	});

    	return block_1;
    }

    // (651:14) {:else}
    function create_else_block_4$3(ctx) {
    	let button;

    	let t0_value = (/*privateMessage*/ ctx[100].users[0].id == /*$id*/ ctx[22]
    	? /*privateMessage*/ ctx[100].users[1].userName42.toUpperCase()
    	: /*privateMessage*/ ctx[100].users[0].userName42.toUpperCase()) + "";

    	let t0;
    	let t1;
    	let br;
    	let mounted;
    	let dispose;

    	function click_handler_7() {
    		return /*click_handler_7*/ ctx[57](/*privateMessage*/ ctx[100]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			br = element("br");
    			attr_dev(button, "id", "selectPrivMsg");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 651, 16, 22837);
    			add_location(br, file$6, 659, 25, 23226);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_7), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*privateMessages, $id*/ 4194308 && t0_value !== (t0_value = (/*privateMessage*/ ctx[100].users[0].id == /*$id*/ ctx[22]
    			? /*privateMessage*/ ctx[100].users[1].userName42.toUpperCase()
    			: /*privateMessage*/ ctx[100].users[0].userName42.toUpperCase()) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_4$3.name,
    		type: "else",
    		source: "(651:14) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (640:14) {#if privateMessage == currentRoom}
    function create_if_block_29(ctx) {
    	let button;

    	let t0_value = (/*privateMessage*/ ctx[100].users[0].id == /*$id*/ ctx[22]
    	? /*privateMessage*/ ctx[100].users[1].userName42.toUpperCase()
    	: /*privateMessage*/ ctx[100].users[0].userName42.toUpperCase()) + "";

    	let t0;
    	let t1;
    	let br;
    	let mounted;
    	let dispose;

    	function click_handler_6() {
    		return /*click_handler_6*/ ctx[56](/*privateMessage*/ ctx[100]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			br = element("br");
    			set_style(button, "color", "white");
    			set_style(button, "background-color", "darkslategrey");
    			attr_dev(button, "id", "selectPrivMsg");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 640, 16, 22331);
    			add_location(br, file$6, 649, 25, 22792);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);
    			insert_dev(target, br, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_6), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*privateMessages, $id*/ 4194308 && t0_value !== (t0_value = (/*privateMessage*/ ctx[100].users[0].id == /*$id*/ ctx[22]
    			? /*privateMessage*/ ctx[100].users[1].userName42.toUpperCase()
    			: /*privateMessage*/ ctx[100].users[0].userName42.toUpperCase()) + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(br);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_29.name,
    		type: "if",
    		source: "(640:14) {#if privateMessage == currentRoom}",
    		ctx
    	});

    	return block_1;
    }

    // (639:12) {#each privateMessages as privateMessage}
    function create_each_block_2(ctx) {
    	let if_block_anchor;

    	function select_block_type_5(ctx, dirty) {
    		if (/*privateMessage*/ ctx[100] == /*currentRoom*/ ctx[4]) return create_if_block_29;
    		return create_else_block_4$3;
    	}

    	let current_block_type = select_block_type_5(ctx);
    	let if_block = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_5(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(639:12) {#each privateMessages as privateMessage}",
    		ctx
    	});

    	return block_1;
    }

    // (669:12) {#if currentRoom}
    function create_if_block_22(ctx) {
    	let div;
    	let show_if_2 = /*Mutes*/ ctx[15] && /*Mutes*/ ctx[15].indexOf(/*currentRoom*/ ctx[4].name) != -1;
    	let t;
    	let show_if;
    	let show_if_1;
    	let if_block1_anchor;
    	let if_block0 = show_if_2 && create_if_block_28(ctx);

    	function select_block_type_6(ctx, dirty) {
    		if (dirty[0] & /*myChannels, currentRoom*/ 262160) show_if = null;
    		if (dirty[0] & /*currentRoom, myChannels*/ 262160) show_if_1 = null;
    		if (show_if == null) show_if = !!(/*myChannels*/ ctx[18].indexOf(/*currentRoom*/ ctx[4].name) == -1 && /*currentRoom*/ ctx[4].isPublic == true && /*currentRoom*/ ctx[4].isDirectMessage != true);
    		if (show_if) return create_if_block_23;
    		if (show_if_1 == null) show_if_1 = !!(/*currentRoom*/ ctx[4].isPublic == false && /*myChannels*/ ctx[18].indexOf(/*currentRoom*/ ctx[4].name) == -1);
    		if (show_if_1) return create_if_block_24;
    		return create_else_block_2$4;
    	}

    	let current_block_type = select_block_type_6(ctx, [-1, -1, -1, -1]);
    	let if_block1 = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t = space();
    			if_block1.c();
    			if_block1_anchor = empty$1();
    			add_location(div, file$6, 669, 14, 23444);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			insert_dev(target, t, anchor);
    			if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*Mutes, currentRoom*/ 32784) show_if_2 = /*Mutes*/ ctx[15] && /*Mutes*/ ctx[15].indexOf(/*currentRoom*/ ctx[4].name) != -1;

    			if (show_if_2) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_28(ctx);
    					if_block0.c();
    					if_block0.m(div, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_6(ctx, dirty)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (detaching) detach_dev(t);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_22.name,
    		type: "if",
    		source: "(669:12) {#if currentRoom}",
    		ctx
    	});

    	return block_1;
    }

    // (671:16) {#if Mutes && Mutes.indexOf(currentRoom.name) != -1}
    function create_if_block_28(ctx) {
    	let p;

    	const block_1 = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "You are muted on this channel";
    			set_style(p, "text-align", "center");
    			set_style(p, "color", "red");
    			add_location(p, file$6, 671, 18, 23537);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_28.name,
    		type: "if",
    		source: "(671:16) {#if Mutes && Mutes.indexOf(currentRoom.name) != -1}",
    		ctx
    	});

    	return block_1;
    }

    // (695:14) {:else}
    function create_else_block_2$4(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*messages*/ ctx[1];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	const block_1 = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*messages, $username, currentRoom, blocked*/ 3145746) {
    				each_value_1 = /*messages*/ ctx[1];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_2$4.name,
    		type: "else",
    		source: "(695:14) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (682:100) 
    function create_if_block_24(ctx) {
    	let h3;
    	let t1;
    	let form;
    	let input;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "This room is password protected";
    			t1 = space();
    			form = element("form");
    			input = element("input");
    			set_style(h3, "margin-top", "30px");
    			add_location(h3, file$6, 682, 16, 24104);
    			set_style(input, "width", "100%");
    			attr_dev(input, "class", "form-control svelte-qd64xz");
    			attr_dev(input, "type", "password");
    			attr_dev(input, "placeholder", "Enter room password...");
    			add_location(input, file$6, 686, 18, 24284);
    			add_location(form, file$6, 685, 16, 24223);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, form, anchor);
    			append_dev(form, input);
    			set_input_value(input, /*roomPassword*/ ctx[5]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_1*/ ctx[59]),
    					listen_dev(form, "submit", prevent_default(/*joinRoom*/ ctx[40]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*roomPassword*/ 32 && input.value !== /*roomPassword*/ ctx[5]) {
    				set_input_value(input, /*roomPassword*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_24.name,
    		type: "if",
    		source: "(682:100) ",
    		ctx
    	});

    	return block_1;
    }

    // (677:14) {#if myChannels.indexOf(currentRoom.name) == -1 && currentRoom.isPublic == true && currentRoom.isDirectMessage != true}
    function create_if_block_23(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Join room";
    			attr_dev(button, "class", "joinButton svelte-qd64xz");
    			add_location(button, file$6, 677, 16, 23845);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler_8*/ ctx[58]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_23.name,
    		type: "if",
    		source: "(677:14) {#if myChannels.indexOf(currentRoom.name) == -1 && currentRoom.isPublic == true && currentRoom.isDirectMessage != true}",
    		ctx
    	});

    	return block_1;
    }

    // (697:18) {#if blocked.indexOf(msg.user.id.toString()) == -1}
    function create_if_block_25(ctx) {
    	let if_block_anchor;

    	function select_block_type_7(ctx, dirty) {
    		if (/*msg*/ ctx[97].user.userName == /*$username*/ ctx[21]) return create_if_block_26;
    		if (/*currentRoom*/ ctx[4].isDirectMessage == true) return create_if_block_27;
    		return create_else_block_3$4;
    	}

    	let current_block_type = select_block_type_7(ctx);
    	let if_block = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_7(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_25.name,
    		type: "if",
    		source: "(697:18) {#if blocked.indexOf(msg.user.id.toString()) == -1}",
    		ctx
    	});

    	return block_1;
    }

    // (706:20) {:else}
    function create_else_block_3$4(ctx) {
    	let p;
    	let span;
    	let t0_value = /*msg*/ ctx[97].user.userName + "";
    	let t0;
    	let br;
    	let t1;
    	let t2_value = /*msg*/ ctx[97].text + "";
    	let t2;
    	let t3;

    	const block_1 = {
    		c: function create() {
    			p = element("p");
    			span = element("span");
    			t0 = text(t0_value);
    			br = element("br");
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			set_style(span, "font-weight", "700");
    			set_style(span, "color", "darkgreen");
    			add_location(span, file$6, 707, 24, 25116);
    			add_location(br, file$6, 709, 25, 25243);
    			attr_dev(p, "class", "othermsg svelte-qd64xz");
    			add_location(p, file$6, 706, 22, 25071);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, span);
    			append_dev(span, t0);
    			append_dev(p, br);
    			append_dev(p, t1);
    			append_dev(p, t2);
    			append_dev(p, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*messages*/ 2 && t0_value !== (t0_value = /*msg*/ ctx[97].user.userName + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*messages*/ 2 && t2_value !== (t2_value = /*msg*/ ctx[97].text + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_3$4.name,
    		type: "else",
    		source: "(706:20) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (702:66) 
    function create_if_block_27(ctx) {
    	let p;
    	let t0_value = /*msg*/ ctx[97].text + "";
    	let t0;
    	let t1;

    	const block_1 = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(p, "class", "othermsg svelte-qd64xz");
    			add_location(p, file$6, 702, 22, 24938);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*messages*/ 2 && t0_value !== (t0_value = /*msg*/ ctx[97].text + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_27.name,
    		type: "if",
    		source: "(702:66) ",
    		ctx
    	});

    	return block_1;
    }

    // (698:20) {#if msg.user.userName == $username}
    function create_if_block_26(ctx) {
    	let p;
    	let t0_value = /*msg*/ ctx[97].text + "";
    	let t0;
    	let t1;

    	const block_1 = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(p, "class", "selfmsg svelte-qd64xz");
    			add_location(p, file$6, 698, 22, 24767);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*messages*/ 2 && t0_value !== (t0_value = /*msg*/ ctx[97].text + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_26.name,
    		type: "if",
    		source: "(698:20) {#if msg.user.userName == $username}",
    		ctx
    	});

    	return block_1;
    }

    // (696:16) {#each messages as msg}
    function create_each_block_1$1(ctx) {
    	let show_if = /*blocked*/ ctx[20].indexOf(/*msg*/ ctx[97].user.id.toString()) == -1;
    	let if_block_anchor;
    	let if_block = show_if && create_if_block_25(ctx);

    	const block_1 = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*blocked, messages*/ 1048578) show_if = /*blocked*/ ctx[20].indexOf(/*msg*/ ctx[97].user.id.toString()) == -1;

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_25(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(696:16) {#each messages as msg}",
    		ctx
    	});

    	return block_1;
    }

    // (746:80) 
    function create_if_block_21(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Leave Room";
    			attr_dev(button, "id", "leaveRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 746, 14, 26620);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler_12*/ ctx[64]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_21.name,
    		type: "if",
    		source: "(746:80) ",
    		ctx
    	});

    	return block_1;
    }

    // (740:71) 
    function create_if_block_20$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Delete Room";
    			attr_dev(button, "id", "leaveRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 740, 14, 26361);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler_11*/ ctx[63]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_20$1.name,
    		type: "if",
    		source: "(740:71) ",
    		ctx
    	});

    	return block_1;
    }

    // (733:12) {#if currentRoom && currentRoom.isDirectMessage == true}
    function create_if_block_19$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Delete Private Conversation";
    			attr_dev(button, "id", "leaveRoom");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 733, 14, 26067);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler_10*/ ctx[62]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_19$1.name,
    		type: "if",
    		source: "(733:12) {#if currentRoom && currentRoom.isDirectMessage == true}",
    		ctx
    	});

    	return block_1;
    }

    // (754:10) {#if currentRoom && currentRoom.channelOwnerId == $id && currentRoom.isPublic == false}
    function create_if_block_17$1(ctx) {
    	let div;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*changeRemove*/ ctx[16] == 'true' && create_if_block_18$1(ctx);

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "Change password";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Remove password";
    			t3 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty$1();
    			attr_dev(button0, "id", "createRoom2");
    			attr_dev(button0, "class", "svelte-qd64xz");
    			add_location(button0, file$6, 755, 14, 26991);
    			attr_dev(button1, "id", "leaveRoom2");
    			attr_dev(button1, "class", "svelte-qd64xz");
    			add_location(button1, file$6, 761, 14, 27195);
    			set_style(div, "margin-top", "5px");
    			attr_dev(div, "class", "my-buttons svelte-qd64xz");
    			add_location(div, file$6, 754, 12, 26927);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(div, t1);
    			append_dev(div, button1);
    			insert_dev(target, t3, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", prevent_default(/*click_handler_13*/ ctx[65]), false, true, false),
    					listen_dev(button1, "click", /*removeRoomPass*/ ctx[29], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*changeRemove*/ ctx[16] == 'true') {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_18$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t3);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_17$1.name,
    		type: "if",
    		source: "(754:10) {#if currentRoom && currentRoom.channelOwnerId == $id && currentRoom.isPublic == false}",
    		ctx
    	});

    	return block_1;
    }

    // (766:12) {#if changeRemove == 'true'}
    function create_if_block_18$1(ctx) {
    	let form;
    	let input;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			form = element("form");
    			input = element("input");
    			t0 = space();
    			button = element("button");
    			button.textContent = "Submit";
    			set_style(input, "width", "100%");
    			set_style(input, "margin-top", "10px");
    			attr_dev(input, "class", "form-control svelte-qd64xz");
    			attr_dev(input, "type", "password");
    			attr_dev(input, "placeholder", "Enter new password...");
    			add_location(input, file$6, 767, 16, 27447);
    			add_location(form, file$6, 766, 14, 27376);
    			add_location(button, file$6, 775, 14, 27731);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, input);
    			set_input_value(input, /*newPass*/ ctx[17]);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_3*/ ctx[66]),
    					listen_dev(form, "submit", prevent_default(/*submit_handler*/ ctx[67]), false, true, false),
    					listen_dev(button, "click", prevent_default(/*changeRoomPass*/ ctx[30]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*newPass*/ 131072 && input.value !== /*newPass*/ ctx[17]) {
    				set_input_value(input, /*newPass*/ ctx[17]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_18$1.name,
    		type: "if",
    		source: "(766:12) {#if changeRemove == 'true'}",
    		ctx
    	});

    	return block_1;
    }

    // (784:10) {#if currentRoom && myChannels.indexOf(currentRoom.name) != -1 && !currentUser}
    function create_if_block_16$1(ctx) {
    	let div;
    	let each_value = /*currentRoom*/ ctx[4].users;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block_1 = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			set_style(div, "margin-top", "15px");
    			add_location(div, file$6, 784, 12, 28048);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*currentRoom*/ 16 | dirty[1] & /*updateCurrentUser*/ 16) {
    				each_value = /*currentRoom*/ ctx[4].users;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_16$1.name,
    		type: "if",
    		source: "(784:10) {#if currentRoom && myChannels.indexOf(currentRoom.name) != -1 && !currentUser}",
    		ctx
    	});

    	return block_1;
    }

    // (786:14) {#each currentRoom.users as user}
    function create_each_block$3(ctx) {
    	let button;
    	let img;
    	let img_src_value;
    	let t0;
    	let t1_value = /*user*/ ctx[94].userName + "";
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_14() {
    		return /*click_handler_14*/ ctx[68](/*user*/ ctx[94]);
    	}

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			img = element("img");
    			t0 = space();
    			t1 = text(t1_value);
    			attr_dev(img, "class", "listAvatar svelte-qd64xz");
    			if (!src_url_equal(img.src, img_src_value = /*user*/ ctx[94].imageURL)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "profilePic");
    			add_location(img, file$6, 792, 18, 28339);
    			attr_dev(button, "id", "selectUser");
    			attr_dev(button, "class", "svelte-qd64xz");
    			add_location(button, file$6, 786, 16, 28144);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, img);
    			append_dev(button, t0);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_14), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*currentRoom*/ 16 && !src_url_equal(img.src, img_src_value = /*user*/ ctx[94].imageURL)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*currentRoom*/ 16 && t1_value !== (t1_value = /*user*/ ctx[94].userName + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(786:14) {#each currentRoom.users as user}",
    		ctx
    	});

    	return block_1;
    }

    // (803:10) {#if currentUser}
    function create_if_block_3$4(ctx) {
    	let t;
    	let if_block1_anchor;
    	let if_block0 = /*currentRoom*/ ctx[4].isDirectMessage == false && create_if_block_15$1(ctx);

    	function select_block_type_9(ctx, dirty) {
    		if (/*currentUser*/ ctx[6].id == /*$id*/ ctx[22]) return create_if_block_4$4;
    		if (/*currentRoom*/ ctx[4].isDirectMessage == true) return create_if_block_5$3;
    		return create_else_block_1$4;
    	}

    	let current_block_type = select_block_type_9(ctx);
    	let if_block1 = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if_block1.c();
    			if_block1_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t, anchor);
    			if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*currentRoom*/ ctx[4].isDirectMessage == false) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_15$1(ctx);
    					if_block0.c();
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_9(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_3$4.name,
    		type: "if",
    		source: "(803:10) {#if currentUser}",
    		ctx
    	});

    	return block_1;
    }

    // (804:12) {#if currentRoom.isDirectMessage == false}
    function create_if_block_15$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "X";
    			set_style(button, "cursor", "pointer");
    			set_style(button, "display", "block");
    			set_style(button, "text-align", "right");
    			set_style(button, "border", "none");
    			set_style(button, "margin-bottom", "-10px");
    			set_style(button, "color", "black");
    			add_location(button, file$6, 804, 14, 28695);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler_15*/ ctx[69]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_15$1.name,
    		type: "if",
    		source: "(804:12) {#if currentRoom.isDirectMessage == false}",
    		ctx
    	});

    	return block_1;
    }

    // (844:12) {:else}
    function create_else_block_1$4(ctx) {
    	let a;
    	let img;
    	let img_src_value;
    	let b;
    	let t0_value = /*currentUser*/ ctx[6].userName + "";
    	let t0;
    	let t1;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let show_if_2 = /*currentRoom*/ ctx[4] && /*currentRoom*/ ctx[4].channelOwnerId != /*currentUser*/ ctx[6].id && (/*currentRoom*/ ctx[4].channelOwnerId == /*$id*/ ctx[22] || /*currentRoom*/ ctx[4].channelAdminsId.indexOf(/*$id*/ ctx[22]) != -1);
    	let t6;
    	let show_if;
    	let show_if_1;
    	let if_block1_anchor;
    	let mounted;
    	let dispose;
    	let if_block0 = show_if_2 && create_if_block_8$3(ctx);

    	function select_block_type_11(ctx, dirty) {
    		if (dirty[0] & /*currentRoom, $id, currentUser*/ 4194384) show_if = null;
    		if (dirty[0] & /*currentRoom, $id, currentUser*/ 4194384) show_if_1 = null;
    		if (show_if == null) show_if = !!(/*currentRoom*/ ctx[4].channelOwnerId == /*$id*/ ctx[22] && /*currentRoom*/ ctx[4].channelAdminsId.indexOf(/*currentUser*/ ctx[6].id.toString()) == -1);
    		if (show_if) return create_if_block_6$3;
    		if (show_if_1 == null) show_if_1 = !!(/*currentRoom*/ ctx[4].channelOwnerId == /*$id*/ ctx[22] && /*currentRoom*/ ctx[4].channelAdminsId.indexOf(/*currentUser*/ ctx[6].id.toString()) != -1);
    		if (show_if_1) return create_if_block_7$3;
    	}

    	let current_block_type = select_block_type_11(ctx, [-1, -1, -1, -1]);
    	let if_block1 = current_block_type && current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			a = element("a");
    			img = element("img");
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "Send PM ✉️";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Invite to play 🏓";
    			t5 = space();
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty$1();
    			attr_dev(img, "class", "profile svelte-qd64xz");
    			if (!src_url_equal(img.src, img_src_value = /*currentUser*/ ctx[6].imageURL)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "profile");
    			add_location(img, file$6, 852, 16, 30520);
    			add_location(b, file$6, 856, 18, 30654);
    			attr_dev(a, "href", `${FRONTEND_URL}/#/userprofile`);
    			attr_dev(a, "class", "profileLink svelte-qd64xz");
    			set_style(a, "color", "darkred");
    			set_style(a, "font-size", "16px");
    			add_location(a, file$6, 844, 14, 30224);
    			attr_dev(button0, "class", "profileButton svelte-qd64xz");
    			set_style(button0, "color", "white");
    			set_style(button0, "background-color", "rgb(224, 62, 62)");
    			add_location(button0, file$6, 858, 14, 30717);
    			attr_dev(button1, "class", "profileButton svelte-qd64xz");
    			set_style(button1, "background-color", "dodgerblue");
    			set_style(button1, "color", "white");
    			add_location(button1, file$6, 864, 14, 30965);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, img);
    			append_dev(a, b);
    			append_dev(b, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t5, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t6, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(a, "click", /*click_handler_17*/ ctx[71], false, false, false),
    					listen_dev(button0, "click", prevent_default(/*createPrivateMessage*/ ctx[44]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*sendInvitation*/ ctx[25]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*currentUser*/ 64 && !src_url_equal(img.src, img_src_value = /*currentUser*/ ctx[6].imageURL)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*currentUser*/ 64 && t0_value !== (t0_value = /*currentUser*/ ctx[6].userName + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*currentRoom, currentUser, $id*/ 4194384) show_if_2 = /*currentRoom*/ ctx[4] && /*currentRoom*/ ctx[4].channelOwnerId != /*currentUser*/ ctx[6].id && (/*currentRoom*/ ctx[4].channelOwnerId == /*$id*/ ctx[22] || /*currentRoom*/ ctx[4].channelAdminsId.indexOf(/*$id*/ ctx[22]) != -1);

    			if (show_if_2) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_8$3(ctx);
    					if_block0.c();
    					if_block0.m(t6.parentNode, t6);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_11(ctx, dirty)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if (if_block1) if_block1.d(1);
    				if_block1 = current_block_type && current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t5);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t6);

    			if (if_block1) {
    				if_block1.d(detaching);
    			}

    			if (detaching) detach_dev(if_block1_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_else_block_1$4.name,
    		type: "else",
    		source: "(844:12) {:else}",
    		ctx
    	});

    	return block_1;
    }

    // (824:58) 
    function create_if_block_5$3(ctx) {
    	let a;
    	let img;
    	let img_src_value;
    	let b;
    	let t0_value = /*currentUser*/ ctx[6].userName + "";
    	let t0;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			a = element("a");
    			img = element("img");
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = space();
    			button = element("button");
    			button.textContent = "Invite to play 🏓";
    			attr_dev(img, "class", "profile svelte-qd64xz");
    			if (!src_url_equal(img.src, img_src_value = /*currentUser*/ ctx[6].imageURL)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "profile");
    			add_location(img, file$6, 831, 17, 29764);
    			add_location(b, file$6, 835, 18, 29898);
    			attr_dev(a, "href", `${FRONTEND_URL}/#/userprofile`);
    			attr_dev(a, "class", "profileLink svelte-qd64xz");
    			set_style(a, "color", "darkred");
    			set_style(a, "font-size", "16px");
    			add_location(a, file$6, 824, 14, 29483);
    			attr_dev(button, "class", "profileButton svelte-qd64xz");
    			set_style(button, "background-color", "dodgerblue");
    			set_style(button, "color", "white");
    			add_location(button, file$6, 837, 14, 29961);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, img);
    			append_dev(a, b);
    			append_dev(b, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(a, "click", /*click_handler_16*/ ctx[70], false, false, false),
    					listen_dev(button, "click", prevent_default(/*sendInvitation*/ ctx[25]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*currentUser*/ 64 && !src_url_equal(img.src, img_src_value = /*currentUser*/ ctx[6].imageURL)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*currentUser*/ 64 && t0_value !== (t0_value = /*currentUser*/ ctx[6].userName + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_5$3.name,
    		type: "if",
    		source: "(824:58) ",
    		ctx
    	});

    	return block_1;
    }

    // (813:12) {#if currentUser.id == $id}
    function create_if_block_4$4(ctx) {
    	let a;
    	let img;
    	let img_src_value;
    	let t_value = /*currentUser*/ ctx[6].userName + "";
    	let t;

    	const block_1 = {
    		c: function create() {
    			a = element("a");
    			img = element("img");
    			t = text(t_value);
    			attr_dev(img, "class", "profile svelte-qd64xz");
    			if (!src_url_equal(img.src, img_src_value = /*$image_url*/ ctx[24])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "profile");
    			add_location(img, file$6, 817, 17, 29244);
    			attr_dev(a, "href", `${FRONTEND_URL}/#/profile`);
    			attr_dev(a, "class", "profileLink svelte-qd64xz");
    			set_style(a, "color", "black");
    			set_style(a, "font-size", "16px");
    			add_location(a, file$6, 813, 14, 29081);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, img);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$image_url*/ 16777216 && !src_url_equal(img.src, img_src_value = /*$image_url*/ ctx[24])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*currentUser*/ 64 && t_value !== (t_value = /*currentUser*/ ctx[6].userName + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_4$4.name,
    		type: "if",
    		source: "(813:12) {#if currentUser.id == $id}",
    		ctx
    	});

    	return block_1;
    }

    // (871:14) {#if currentRoom && (currentRoom.channelOwnerId != currentUser.id) && (currentRoom.channelOwnerId == $id || currentRoom.channelAdminsId.indexOf($id) != -1)}
    function create_if_block_8$3(ctx) {
    	let h4;
    	let t1;
    	let show_if;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let if_block4_anchor;

    	function select_block_type_10(ctx, dirty) {
    		if (dirty[0] & /*Mutes, currentRoom*/ 32784) show_if = null;
    		if (show_if == null) show_if = !!(/*Mutes*/ ctx[15].indexOf(/*currentRoom*/ ctx[4].name) != -1);
    		if (show_if) return create_if_block_13$1;
    		if (/*currentRoom*/ ctx[4].channelOwnerId != /*currentUser*/ ctx[6].id) return create_if_block_14$1;
    	}

    	let current_block_type = select_block_type_10(ctx, [-1, -1, -1, -1]);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = /*muteOptions*/ ctx[11] == 'true' && create_if_block_12$2(ctx);
    	let if_block2 = /*currentRoom*/ ctx[4].channelOwnerId != /*currentUser*/ ctx[6].id && create_if_block_11$2(ctx);
    	let if_block3 = /*banOptions*/ ctx[13] == 'true' && create_if_block_10$3(ctx);
    	let if_block4 = /*currentUser*/ ctx[6].id != /*currentRoom*/ ctx[4].channelOwnerId && create_if_block_9$3(ctx);

    	const block_1 = {
    		c: function create() {
    			h4 = element("h4");
    			h4.textContent = "Admin";
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			if (if_block2) if_block2.c();
    			t4 = space();
    			if (if_block3) if_block3.c();
    			t5 = space();
    			if (if_block4) if_block4.c();
    			if_block4_anchor = empty$1();
    			add_location(h4, file$6, 871, 16, 31381);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h4, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t3, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t4, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev(target, t5, anchor);
    			if (if_block4) if_block4.m(target, anchor);
    			insert_dev(target, if_block4_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_10(ctx, dirty)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(t2.parentNode, t2);
    				}
    			}

    			if (/*muteOptions*/ ctx[11] == 'true') {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_12$2(ctx);
    					if_block1.c();
    					if_block1.m(t3.parentNode, t3);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*currentRoom*/ ctx[4].channelOwnerId != /*currentUser*/ ctx[6].id) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_11$2(ctx);
    					if_block2.c();
    					if_block2.m(t4.parentNode, t4);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*banOptions*/ ctx[13] == 'true') {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_10$3(ctx);
    					if_block3.c();
    					if_block3.m(t5.parentNode, t5);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*currentUser*/ ctx[6].id != /*currentRoom*/ ctx[4].channelOwnerId) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_9$3(ctx);
    					if_block4.c();
    					if_block4.m(if_block4_anchor.parentNode, if_block4_anchor);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h4);
    			if (detaching) detach_dev(t1);

    			if (if_block0) {
    				if_block0.d(detaching);
    			}

    			if (detaching) detach_dev(t2);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t3);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t4);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev(t5);
    			if (if_block4) if_block4.d(detaching);
    			if (detaching) detach_dev(if_block4_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_8$3.name,
    		type: "if",
    		source: "(871:14) {#if currentRoom && (currentRoom.channelOwnerId != currentUser.id) && (currentRoom.channelOwnerId == $id || currentRoom.channelAdminsId.indexOf($id) != -1)}",
    		ctx
    	});

    	return block_1;
    }

    // (876:71) 
    function create_if_block_14$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Mute";
    			attr_dev(button, "class", "profileButton svelte-qd64xz");
    			set_style(button, "background-color", "slategrey");
    			set_style(button, "color", "white");
    			add_location(button, file$6, 876, 18, 31627);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_18*/ ctx[72], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_14$1.name,
    		type: "if",
    		source: "(876:71) ",
    		ctx
    	});

    	return block_1;
    }

    // (874:16) {#if Mutes.indexOf(currentRoom.name) != -1}
    function create_if_block_13$1(ctx) {
    	let button;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Muted";
    			set_style(button, "color", "white");
    			set_style(button, "background", "red");
    			add_location(button, file$6, 874, 18, 31475);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_13$1.name,
    		type: "if",
    		source: "(874:16) {#if Mutes.indexOf(currentRoom.name) != -1}",
    		ctx
    	});

    	return block_1;
    }

    // (891:16) {#if muteOptions == 'true'}
    function create_if_block_12$2(ctx) {
    	let div;
    	let label0;
    	let input0;
    	let t0;
    	let t1;
    	let label1;
    	let input1;
    	let t2;
    	let t3;
    	let label2;
    	let input2;
    	let t4;
    	let t5;
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t0 = text("\n                      5 min.");
    			t1 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t2 = text("\n                      1 day");
    			t3 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t4 = text("\n                      3 days");
    			t5 = space();
    			button = element("button");
    			button.textContent = "Mute User";
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "default", "");
    			input0.__value = "5";
    			input0.value = input0.__value;
    			/*$$binding_groups*/ ctx[47][1].push(input0);
    			add_location(input0, file$6, 893, 22, 32246);
    			add_location(label0, file$6, 892, 20, 32216);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "1440";
    			input1.value = input1.__value;
    			/*$$binding_groups*/ ctx[47][1].push(input1);
    			add_location(input1, file$6, 903, 22, 32536);
    			add_location(label1, file$6, 902, 20, 32506);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "4320";
    			input2.value = input2.__value;
    			/*$$binding_groups*/ ctx[47][1].push(input2);
    			add_location(input2, file$6, 908, 22, 32702);
    			add_location(label2, file$6, 907, 20, 32672);
    			add_location(button, file$6, 911, 20, 32838);
    			add_location(div, file$6, 891, 18, 32190);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, label0);
    			append_dev(label0, input0);
    			input0.checked = input0.__value === /*muteTime*/ ctx[12];
    			append_dev(label0, t0);
    			append_dev(div, t1);
    			append_dev(div, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*muteTime*/ ctx[12];
    			append_dev(label1, t2);
    			append_dev(div, t3);
    			append_dev(div, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*muteTime*/ ctx[12];
    			append_dev(label2, t4);
    			append_dev(div, t5);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[73]),
    					listen_dev(input1, "change", /*input1_change_handler_1*/ ctx[74]),
    					listen_dev(input2, "change", /*input2_change_handler_1*/ ctx[75]),
    					listen_dev(button, "click", prevent_default(/*muteUser*/ ctx[28]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*muteTime*/ 4096) {
    				input0.checked = input0.__value === /*muteTime*/ ctx[12];
    			}

    			if (dirty[0] & /*muteTime*/ 4096) {
    				input1.checked = input1.__value === /*muteTime*/ ctx[12];
    			}

    			if (dirty[0] & /*muteTime*/ 4096) {
    				input2.checked = input2.__value === /*muteTime*/ ctx[12];
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*$$binding_groups*/ ctx[47][1].splice(/*$$binding_groups*/ ctx[47][1].indexOf(input0), 1);
    			/*$$binding_groups*/ ctx[47][1].splice(/*$$binding_groups*/ ctx[47][1].indexOf(input1), 1);
    			/*$$binding_groups*/ ctx[47][1].splice(/*$$binding_groups*/ ctx[47][1].indexOf(input2), 1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_12$2.name,
    		type: "if",
    		source: "(891:16) {#if muteOptions == 'true'}",
    		ctx
    	});

    	return block_1;
    }

    // (917:16) {#if currentRoom.channelOwnerId != currentUser.id}
    function create_if_block_11$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Ban";
    			attr_dev(button, "class", "profileButton svelte-qd64xz");
    			set_style(button, "background-color", "slategrey");
    			set_style(button, "color", "white");
    			add_location(button, file$6, 917, 18, 33054);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_19*/ ctx[76], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_11$2.name,
    		type: "if",
    		source: "(917:16) {#if currentRoom.channelOwnerId != currentUser.id}",
    		ctx
    	});

    	return block_1;
    }

    // (932:16) {#if banOptions == 'true'}
    function create_if_block_10$3(ctx) {
    	let div;
    	let label0;
    	let input0;
    	let t0;
    	let t1;
    	let label1;
    	let input1;
    	let t2;
    	let t3;
    	let label2;
    	let input2;
    	let t4;
    	let t5;
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			div = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t0 = text("\n                      5 min.");
    			t1 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t2 = text("\n                      1 day");
    			t3 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t4 = text("\n                      3 days");
    			t5 = space();
    			button = element("button");
    			button.textContent = "Ban User";
    			attr_dev(input0, "type", "radio");
    			input0.__value = "5";
    			input0.value = input0.__value;
    			/*$$binding_groups*/ ctx[47][2].push(input0);
    			add_location(input0, file$6, 934, 22, 33669);
    			add_location(label0, file$6, 933, 20, 33639);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "1440";
    			input1.value = input1.__value;
    			/*$$binding_groups*/ ctx[47][2].push(input1);
    			add_location(input1, file$6, 939, 22, 33832);
    			add_location(label1, file$6, 938, 20, 33802);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "4320";
    			input2.value = input2.__value;
    			/*$$binding_groups*/ ctx[47][2].push(input2);
    			add_location(input2, file$6, 944, 22, 33997);
    			add_location(label2, file$6, 943, 20, 33967);
    			add_location(button, file$6, 947, 20, 34132);
    			add_location(div, file$6, 932, 18, 33613);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, label0);
    			append_dev(label0, input0);
    			input0.checked = input0.__value === /*banTime*/ ctx[14];
    			append_dev(label0, t0);
    			append_dev(div, t1);
    			append_dev(div, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*banTime*/ ctx[14];
    			append_dev(label1, t2);
    			append_dev(div, t3);
    			append_dev(div, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*banTime*/ ctx[14];
    			append_dev(label2, t4);
    			append_dev(div, t5);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler_1*/ ctx[77]),
    					listen_dev(input1, "change", /*input1_change_handler_2*/ ctx[78]),
    					listen_dev(input2, "change", /*input2_change_handler_2*/ ctx[79]),
    					listen_dev(button, "click", prevent_default(/*banUser*/ ctx[31]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*banTime*/ 16384) {
    				input0.checked = input0.__value === /*banTime*/ ctx[14];
    			}

    			if (dirty[0] & /*banTime*/ 16384) {
    				input1.checked = input1.__value === /*banTime*/ ctx[14];
    			}

    			if (dirty[0] & /*banTime*/ 16384) {
    				input2.checked = input2.__value === /*banTime*/ ctx[14];
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*$$binding_groups*/ ctx[47][2].splice(/*$$binding_groups*/ ctx[47][2].indexOf(input0), 1);
    			/*$$binding_groups*/ ctx[47][2].splice(/*$$binding_groups*/ ctx[47][2].indexOf(input1), 1);
    			/*$$binding_groups*/ ctx[47][2].splice(/*$$binding_groups*/ ctx[47][2].indexOf(input2), 1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_10$3.name,
    		type: "if",
    		source: "(932:16) {#if banOptions == 'true'}",
    		ctx
    	});

    	return block_1;
    }

    // (951:16) {#if currentUser.id != currentRoom.channelOwnerId}
    function create_if_block_9$3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Kick";
    			attr_dev(button, "class", "profileButton svelte-qd64xz");
    			set_style(button, "background-color", "slategrey");
    			set_style(button, "color", "white");
    			add_location(button, file$6, 951, 18, 34324);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*kickUser*/ ctx[26]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_9$3.name,
    		type: "if",
    		source: "(951:16) {#if currentUser.id != currentRoom.channelOwnerId}",
    		ctx
    	});

    	return block_1;
    }

    // (966:130) 
    function create_if_block_7$3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Downgrade status";
    			set_style(button, "border", "solid 1px brown");
    			set_style(button, "color", "brown");
    			set_style(button, "background-color", "transparent");
    			attr_dev(button, "class", "profileButton svelte-qd64xz");
    			add_location(button, file$6, 966, 16, 35076);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*removeAdmin*/ ctx[33]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_7$3.name,
    		type: "if",
    		source: "(966:130) ",
    		ctx
    	});

    	return block_1;
    }

    // (960:14) {#if currentRoom.channelOwnerId == $id && currentRoom.channelAdminsId.indexOf(currentUser.id.toString()) == -1}
    function create_if_block_6$3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Upgrade status";
    			set_style(button, "background-color", "gold");
    			attr_dev(button, "class", "profileButton svelte-qd64xz");
    			add_location(button, file$6, 960, 16, 34737);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*makeAdmin*/ ctx[32]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_6$3.name,
    		type: "if",
    		source: "(960:14) {#if currentRoom.channelOwnerId == $id && currentRoom.channelAdminsId.indexOf(currentUser.id.toString()) == -1}",
    		ctx
    	});

    	return block_1;
    }

    // (550:10) {#if password == 'true'}
    function create_if_block_2$5(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block_1 = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "password");
    			attr_dev(input, "placeholder", "Enter channel password...");
    			add_location(input, file$6, 550, 12, 18980);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*pass*/ ctx[8]);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[49]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*pass*/ 256 && input.value !== /*pass*/ ctx[8]) {
    				set_input_value(input, /*pass*/ ctx[8]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_if_block_2$5.name,
    		type: "if",
    		source: "(550:10) {#if password == 'true'}",
    		ctx
    	});

    	return block_1;
    }

    function create_fragment$6(ctx) {
    	let main;

    	function select_block_type(ctx, dirty) {
    		if (/*$logged*/ ctx[23] == 'true') return create_if_block$5;
    		return create_else_block_8;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block_1 = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-qd64xz");
    			add_location(main, file$6, 516, 0, 18185);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block_1;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $username;
    	let $currentChat;
    	let $cookie;
    	let $id;
    	let $logged;
    	let $image_url;
    	validate_store(username, 'username');
    	component_subscribe($$self, username, $$value => $$invalidate(21, $username = $$value));
    	validate_store(currentChat, 'currentChat');
    	component_subscribe($$self, currentChat, $$value => $$invalidate(84, $currentChat = $$value));
    	validate_store(cookie, 'cookie');
    	component_subscribe($$self, cookie, $$value => $$invalidate(85, $cookie = $$value));
    	validate_store(id, 'id');
    	component_subscribe($$self, id, $$value => $$invalidate(22, $id = $$value));
    	validate_store(logged, 'logged');
    	component_subscribe($$self, logged, $$value => $$invalidate(23, $logged = $$value));
    	validate_store(image_url, 'image_url');
    	component_subscribe($$self, image_url, $$value => $$invalidate(24, $image_url = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Chat', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let Oname = $username;
    	let Otext = '';
    	let messages = [];
    	let privateMessages = [];
    	let socket = null;
    	let rooms = [];
    	let currentRoom = rooms[rooms.length - 1];
    	let roomPassword = '';
    	let currentUser;
    	let creation = false;
    	let pass = '';
    	let free = '';
    	let title = '';
    	let muteOptions = 'false';
    	let muteTime = 0;
    	let banOptions = 'false';
    	let banTime = 0;
    	let Mutes = [];
    	let changeRemove = 'false';
    	let newPass;
    	let myChannels = [];
    	let allRooms = [];
    	let newRoom = { name: '', password: '', isPublic: false };
    	let password = 'false';
    	let blocked = [];
    	let block;
    	let i = 0;

    	function sendInvitation() {
    		return __awaiter(this, void 0, void 0, function* () {
    			invitedPlayer.update(n => currentUser.userName42);
    			invitation.update(n => 'true');
    			window.location.replace(`${FRONTEND_URL}/#/pong`);
    		});
    	}

    	function kickUser() {
    		socket.emit('kickUser', {
    			channel: currentRoom.name,
    			userName42: currentUser.userName42,
    			minutes: banTime
    		});
    	}

    	function createRoom(e) {
    		return __awaiter(this, void 0, void 0, function* () {
    			e.stopImmediatePropagation();
    			e.stopPropagation();

    			if (title.indexOf(' ') != -1 || title.indexOf('\t') != -1) {
    				alert('❌ Room name cannot contain white spaces');
    				$$invalidate(10, title = '');
    				return;
    			}

    			if (!title || !free) {
    				alert('❌ Missing information !');
    				return;
    			} else if (free != 'true' && !pass) {
    				alert('❌ Missing information !');
    				return;
    			} else if (title.length < 3 || title.length > 10) {
    				alert('❌ Room title must be between 3 and 10 characters long');
    				return;
    			} else if (free != 'true' && (pass.length < 4 || pass.length > 16)) {
    				alert('❌ Your password must be between 4 and 16 characters long!');
    				return;
    			} else {
    				newRoom.name = title;
    				newRoom.password = pass;

    				if (free == 'true') {
    					newRoom.isPublic = true;
    				} else {
    					newRoom.isPublic = false;
    				}

    				socket.emit('createRoom', newRoom);
    			}
    		});
    	}

    	function muteUser() {
    		return __awaiter(this, void 0, void 0, function* () {
    			if (!muteTime) {
    				return;
    			}

    			socket.emit('muteUser', {
    				channel: currentRoom.name,
    				userName42: currentUser.userName42,
    				minutes: muteTime
    			});
    		});
    	}

    	function removeRoomPass() {
    		socket.emit('removePass', { room: currentRoom.name });
    		alert('#' + currentRoom.name.toUpperCase() + ' is now a public channel');
    		$$invalidate(16, changeRemove = 'false');
    	}

    	function changeRoomPass() {
    		if ((newPass === null || newPass === void 0
    		? void 0
    		: newPass.length) < 4 || (newPass === null || newPass === void 0
    		? void 0
    		: newPass.length) > 16) {
    			alert('❌ Your password must be between 4 and 16 characters long!');
    			$$invalidate(17, newPass = '');
    		} else {
    			socket.emit('changePass', { room: currentRoom.name, pass: newPass });
    			$$invalidate(17, newPass = '');
    			alert('#' + currentRoom.name.toUpperCase() + ' is now protected by a new password');
    			$$invalidate(16, changeRemove = 'false');
    		}
    	}

    	function banUser() {
    		return __awaiter(this, void 0, void 0, function* () {
    			if (!banTime) {
    				return;
    			}

    			socket.emit('banUser', {
    				channel: currentRoom.name,
    				userName42: currentUser.userName42,
    				minutes: banTime
    			});
    		});
    	}

    	function makeAdmin() {
    		return __awaiter(this, void 0, void 0, function* () {
    			socket.emit('makeAdmin', {
    				channel: currentRoom,
    				userName42: currentUser.userName42
    			});
    		});
    	}

    	function removeAdmin() {
    		return __awaiter(this, void 0, void 0, function* () {
    			socket.emit('removeAdmin', {
    				channel: currentRoom,
    				userName42: currentUser.userName42
    			});
    		});
    	}

    	function addPassword() {
    		$$invalidate(19, password = 'true');
    		$$invalidate(19, password);
    	}

    	function updateCurrentUser(user) {
    		$$invalidate(6, currentUser = user);
    		currentProfile.update(n => user.userName42);
    	}

    	function removePassword() {
    		$$invalidate(19, password = 'false');
    		$$invalidate(19, password);
    	}

    	function initAll(init) {
    		$$invalidate(3, rooms = init.allChannels);
    		$$invalidate(3, rooms = [...rooms]);

    		for (let i = 0; i < rooms.length; i++) {
    			allRooms = [...allRooms, rooms[i].name];
    		}

    		$$invalidate(2, privateMessages = init.directMessageChannels);
    		$$invalidate(2, privateMessages = [...privateMessages]);

    		for (let i = 0; i < rooms.length; i++) {
    			for (let j = 0; j < rooms[i].users.length; j++) {
    				if (rooms[i].users[j].id == $id) $$invalidate(18, myChannels = [...myChannels, rooms[i].name]);
    			}
    		}

    		for (let k = 0; k < rooms.length; k++) {
    			if (rooms[k].name == $currentChat) {
    				$$invalidate(4, currentRoom = rooms[k]);
    				$$invalidate(1, messages = currentRoom.messages);
    				break;
    			}
    		}

    		for (let k = 0; k < privateMessages.length; k++) {
    			if (privateMessages[k].name == $currentChat) {
    				$$invalidate(4, currentRoom = privateMessages[k]);

    				for (let i = 0; i < currentRoom.users.length; i++) {
    					if (currentRoom.users[i].id != $id) {
    						$$invalidate(6, currentUser = currentRoom.users[i]);
    					}
    				}

    				$$invalidate(1, messages = currentRoom.messages);
    				break;
    			}
    		}
    	}

    	function createChannel(channel) {
    		$$invalidate(3, rooms = channel.allChannels);
    		$$invalidate(3, rooms = [...rooms]);
    		$$invalidate(2, privateMessages = channel.directMessageChannels);
    		$$invalidate(2, privateMessages = [...privateMessages]);
    	}

    	function deleteRoom(room) {
    		alert(`Room ${room.name} has been deleted`);
    		socket.emit('deleteRoom', { name: room.name });
    		$$invalidate(3, rooms = rooms.filter(t => t != room));
    		$$invalidate(18, myChannels = myChannels.filter(t => t != room.name));
    		$$invalidate(4, currentRoom = '');
    	}

    	function deletePrivateMessage(room) {
    		alert('Conversation has been deleted');
    		socket.emit('deletePrivateMessage', { name: room.name });
    		$$invalidate(2, privateMessages = privateMessages.filter(t => t != room));
    		$$invalidate(4, currentRoom = '');
    		$$invalidate(6, currentUser = '');
    	}

    	function leaveRoom(room) {
    		alert('✈️ ✈️ ✈️ You left room #' + room.name.toUpperCase());
    		socket.emit('leaveRoom', { name: room.name });
    		$$invalidate(18, myChannels = myChannels.filter(t => t != room.name));
    		$$invalidate(4, currentRoom = '');
    	}

    	function joinRoom() {
    		return __awaiter(this, void 0, void 0, function* () {
    			socket.emit('joinRoom', {
    				name: currentRoom.name,
    				password: roomPassword
    			});

    			$$invalidate(5, roomPassword = '');
    		});
    	}

    	function changeConv(title) {
    		socket.emit('changeConv');
    		$$invalidate(4, currentRoom = title);
    		currentChat.update(n => title.name);
    		$$invalidate(6, currentUser = '');
    		currentProfile.update(n => '');
    		$$invalidate(1, messages = currentRoom.messages);
    	}

    	function changeConvMessages(title) {
    		socket.emit('changePrivateConv');
    		$$invalidate(4, currentRoom = title);
    		currentChat.update(n => title.name);

    		for (let i = 0; i < currentRoom.users.length; i++) {
    			if (currentRoom.users[i].id != $id) {
    				$$invalidate(6, currentUser = currentRoom.users[i]);
    			}
    		}
    	}

    	function sendMessage() {
    		if (validateInput()) {
    			socket.emit('message', { channel: currentRoom, text: Otext });
    			$$invalidate(0, Otext = '');
    		}
    	}

    	function receivedMessage(message) {
    		if (currentRoom && currentRoom.id == message.channel.id) {
    			$$invalidate(1, messages = [...messages, message]);
    		}
    	}

    	function validateInput() {
    		return Oname.length > 0 && Otext.length > 0;
    	}

    	function updateChannels(update) {
    		let allUpdate = [];

    		for (let k = 0; k < update.length; k++) {
    			allUpdate = [...allUpdate, update[k].name];
    		}

    		if (rooms.length > update.length) {
    			let missingRoom = allRooms.filter(x => allUpdate.indexOf(x) === -1);

    			if (currentRoom && currentRoom.name == missingRoom) {
    				alert(`⚠️ ⚠️ ⚠️ Chat room ${missingRoom} has been deleted by its owner`);
    			}

    			allUpdate.length = 0;
    			$$invalidate(4, currentRoom = '');
    			currentChat.update(n => '');
    		}

    		$$invalidate(3, rooms = update);
    		$$invalidate(3, rooms = [...rooms]);

    		for (let i = 0; i < rooms.length; i++) {
    			for (let j = 0; j < rooms[i].users.length; j++) {
    				if (rooms[i].users[j].id == $id) $$invalidate(18, myChannels = [...myChannels, rooms[i].name]);
    			}
    		}

    		for (let k = 0; k < rooms.length; k++) {
    			if (rooms[k].name == $currentChat) {
    				$$invalidate(4, currentRoom = rooms[k]);
    				$$invalidate(1, messages = currentRoom.messages);
    				break;
    			}
    		}

    		for (let k = 0; k < privateMessages.length; k++) {
    			if (privateMessages[k].name == $currentChat) {
    				$$invalidate(4, currentRoom = privateMessages[k]);
    				$$invalidate(1, messages = currentRoom.messages);
    				break;
    			}
    		}

    		$$invalidate(4, currentRoom);
    	}

    	function createPrivateMessage() {
    		return __awaiter(this, void 0, void 0, function* () {
    			yield socket.emit('createPrivateMessage', currentUser.userName42);
    		});
    	}

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		if ($logged == 'true') {
    			block = yield fetch(`${BACKEND_URL}/users/${$id}`, {
    				method: 'GET',
    				credentials: 'include',
    				headers: {
    					Authorization: 'Bearer ' + $cookie,
    					'Content-type': 'application/json; charset=UTF-8'
    				}
    			}).then(response => block = response.json());

    			$$invalidate(20, blocked = block.blocked);
    			socket = lookup(`${BACKEND_URL}/chat`, { auth: { token: $cookie } });

    			socket.on('updateChannels', update => {
    				updateChannels(update);
    			});

    			socket.on('init', init => {
    				initAll(init);
    			});

    			socket.on('alert', alert => {
    				alert(alert);
    			});

    			socket.on('createChannel', channel => {
    				createChannel(channel);
    			});

    			socket.on('msgToClient', message => {
    				receivedMessage(message);
    			});

    			socket.on('youHaveBeenBanned', message => {
    				alert('You have been banned from channel ' + message);
    				$$invalidate(4, currentRoom = '');
    				$$invalidate(6, currentUser = '');
    				currentProfile.update(n => '');
    				currentChat.update(n => '');
    				$$invalidate(18, myChannels = myChannels.filter(t => t != message));
    			});

    			socket.on('youHaveBeenKicked', message => {
    				alert('You have been banned from channel #' + message.toUpperCase());
    				$$invalidate(4, currentRoom = '');
    				$$invalidate(6, currentUser = '');
    				currentProfile.update(n => '');
    				currentChat.update(n => '');
    				$$invalidate(18, myChannels = myChannels.filter(t => t != message));
    			});

    			socket.on('youAreNowAdmin', message => {
    				alert('You are now an administator on channel #' + message);
    				location.reload();
    			});

    			socket.on('youAreNoMoreAdmin', message => {
    				alert('You are no longer an administator on channel #' + message);
    			});

    			socket.on('privateMessageDeleted', message => {
    				alert(`The private message channel ${message} was deleted`);

    				if (message == currentRoom.name) {
    					$$invalidate(4, currentRoom = '');
    					currentChat.update(n => '');
    					$$invalidate(6, currentUser = '');
    					currentProfile.update(n => '');
    				}
    			});

    			socket.on('createRoomResponse', message => {
    				if (message == 'exists') {
    					alert('❌ a Room of that name already exists. Please choose another name');
    				} else {
    					alert(`✅ Chatroom ${title} has been created`);
    					$$invalidate(7, creation = false);
    					$$invalidate(8, pass = '');
    					$$invalidate(10, title = '');
    					$$invalidate(9, free = '');
    				}
    			});

    			socket.on('updatePrivateMessages', message => {
    				$$invalidate(2, privateMessages = message);
    				$$invalidate(2, privateMessages = [...privateMessages]);

    				for (let i = 0; i < privateMessages.length; i++) {
    					if (privateMessages[i].name == currentRoom.name) {
    						$$invalidate(4, currentRoom = privateMessages[i]);
    						$$invalidate(1, messages = currentRoom.messages);
    					}
    				}
    			});

    			socket.on('kickUserResponse', response => {
    				if (response == 'true') {
    					alert(currentUser.userName + ' has been kicked from room #' + currentRoom.name.toUpperCase());
    					$$invalidate(6, currentUser = '');
    					currentProfile.update(n => '');
    				}
    			});

    			socket.on('muteUserResponse', response => {
    				let time = muteTime;

    				if (response == 'true') {
    					alert(currentUser.userName + 'has been muted for ' + time + ' minutes');
    				} else if (response == 'muted') {
    					alert(currentUser.userName + `has already been muted for a longer period`);
    				} else {
    					alert('User ' + currentUser.userName + ' could not be muted');
    				}

    				$$invalidate(11, muteOptions = 'false');
    				$$invalidate(12, muteTime = 0);
    			});

    			socket.on('banUserResponse', response => {
    				let time = banTime;

    				if (response == 'true') {
    					alert(currentUser.userName + ' has been banned for ' + time + ' minutes 👹 👹 👹');
    				} else if (response == 'banned') {
    					alert(currentUser.name + ' has already been banned by another administrator');
    				} else {
    					alert('User ' + currentUser.userName + ' could not be banned');
    				}

    				$$invalidate(13, banOptions = 'false');
    				$$invalidate(14, banTime = 0);
    			});

    			socket.on('messageResponse', message => {
    				if (message == 'muted') {
    					$$invalidate(15, Mutes = [...Mutes, currentRoom.name]);
    				}

    				if (message == 'unmuted') {
    					$$invalidate(15, Mutes = Mutes.filter(t => t != currentRoom.name));
    				}
    			});

    			socket.on('joinRoomResponse', response => {
    				if (response == 'true') {
    					alert('😎 😎 😎 You successfully joined Room #' + currentRoom.name.toUpperCase());
    					$$invalidate(18, myChannels = [...myChannels, currentRoom.name]);
    					$$invalidate(4, currentRoom);
    					set_store_value(currentChat, $currentChat = currentRoom.name, $currentChat);
    				}

    				if (response == 'false') {
    					alert('❌ ❌ ❌ Wrong passsword');
    				}

    				if (response == 'ban') {
    					alert('🤬 🤬 🤬 You have been banned from this room');
    				}
    			});

    			socket.on('makeAdminResponse', response => {
    				if (response == 'false') {
    					alert('😱 😱 😱 Operation failed');
    				} else if (response == 'alreadyAdmin') {
    					alert(currentUser.userName + ' is already an administrator on this channel');
    				} else if (response == 'true') {
    					alert(currentUser.userName + ' is now an administrator of channel #' + currentRoom.name.toUpperCase());
    				}

    				$$invalidate(13, banOptions = 'false');
    				$$invalidate(11, muteOptions = 'false');
    				location.reload();
    			});

    			socket.on('removeAdminResponse', response => {
    				if (response == 'notAdmin') {
    					alert(currentUser.userName + ' is not an administrator on channel #' + currentRoom.name);
    				}

    				if (response == 'true') {
    					alert(currentUser.userName + ' is no longer an administrator of channel #' + currentRoom.name.toUpperCase());
    				}
    			});

    			socket.on('createPrivateMessageResponse', newPM => {
    				if (newPM == 'blocked') {
    					alert('This user has made impossible for you to start a new conversation 😢 😢 😢');
    				}

    				if (newPM == 'true') {
    					socket.emit('changePrivateConv');
    					let DMname = $username + ' - ' + currentUser.userName;
    					let inverseDMname = currentUser.userName + ' - ' + $username;

    					for (let i = 0; i < privateMessages.length; i++) {
    						if (DMname == privateMessages[i].name || inverseDMname == privateMessages[i].name) {
    							changeConvMessages(privateMessages[i]);
    						}
    					}
    				}

    				if (newPM == 'exist') {
    					let DMname = $username + ' - ' + currentUser.userName;
    					let inverseDMname = currentUser.userName + ' - ' + $username;

    					for (let i = 0; i < privateMessages.length; i++) {
    						if (DMname == privateMessages[i].name || inverseDMname == privateMessages[i].name) {
    							changeConvMessages(privateMessages[i]);
    						}
    					}
    				}
    			});
    		}
    	}));

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Chat> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[], [], []];

    	function input0_input_handler() {
    		title = this.value;
    		$$invalidate(10, title);
    	}

    	function input1_change_handler() {
    		free = this.__value;
    		$$invalidate(9, free);
    	}

    	function input2_change_handler() {
    		free = this.__value;
    		$$invalidate(9, free);
    	}

    	function input_input_handler() {
    		pass = this.value;
    		$$invalidate(8, pass);
    	}

    	const click_handler = () => {
    		$$invalidate(7, creation = false);
    		$$invalidate(8, pass = '');
    		$$invalidate(10, title = '');
    		$$invalidate(9, free = '');
    		$$invalidate(19, password = 'false');
    	};

    	const click_handler_1 = room => changeConv(room);
    	const click_handler_2 = room => changeConv(room);
    	const click_handler_3 = room => changeConv(room);
    	const click_handler_4 = room => changeConv(room);
    	const click_handler_5 = room => changeConv(room);
    	const click_handler_6 = privateMessage => changeConvMessages(privateMessage);
    	const click_handler_7 = privateMessage => changeConvMessages(privateMessage);
    	const click_handler_8 = () => joinRoom();

    	function input_input_handler_1() {
    		roomPassword = this.value;
    		$$invalidate(5, roomPassword);
    	}

    	function input_input_handler_2() {
    		Otext = this.value;
    		$$invalidate(0, Otext);
    	}

    	const click_handler_9 = () => $$invalidate(7, creation = true);
    	const click_handler_10 = () => deletePrivateMessage(currentRoom);
    	const click_handler_11 = () => deleteRoom(currentRoom);
    	const click_handler_12 = () => leaveRoom(currentRoom);

    	const click_handler_13 = () => {
    		$$invalidate(16, changeRemove = 'true');
    	};

    	function input_input_handler_3() {
    		newPass = this.value;
    		$$invalidate(17, newPass);
    	}

    	const submit_handler = () => changeRoomPass;

    	const click_handler_14 = user => {
    		updateCurrentUser(user);
    	};

    	const click_handler_15 = () => {
    		$$invalidate(6, currentUser = '');
    		currentProfile.update(n => '');
    	};

    	const click_handler_16 = () => {
    		otherUser.update(n => currentUser.id);
    	};

    	const click_handler_17 = () => {
    		otherUser.update(n => currentUser.id);
    	};

    	const click_handler_18 = () => {
    		if (muteOptions == 'false') {
    			$$invalidate(11, muteOptions = 'true');
    		} else {
    			$$invalidate(11, muteOptions = 'false');
    		}

    		$$invalidate(13, banOptions = 'false');
    	};

    	function input0_change_handler() {
    		muteTime = this.__value;
    		$$invalidate(12, muteTime);
    	}

    	function input1_change_handler_1() {
    		muteTime = this.__value;
    		$$invalidate(12, muteTime);
    	}

    	function input2_change_handler_1() {
    		muteTime = this.__value;
    		$$invalidate(12, muteTime);
    	}

    	const click_handler_19 = () => {
    		if (banOptions == 'false') {
    			$$invalidate(13, banOptions = 'true');
    		} else {
    			$$invalidate(13, banOptions = 'false');
    		}

    		$$invalidate(11, muteOptions = 'false');
    	};

    	function input0_change_handler_1() {
    		banTime = this.__value;
    		$$invalidate(14, banTime);
    	}

    	function input1_change_handler_2() {
    		banTime = this.__value;
    		$$invalidate(14, banTime);
    	}

    	function input2_change_handler_2() {
    		banTime = this.__value;
    		$$invalidate(14, banTime);
    	}

    	$$self.$capture_state = () => ({
    		__awaiter,
    		onMount,
    		io: lookup,
    		invitedPlayer,
    		username,
    		otherUser,
    		image_url,
    		id,
    		cookie,
    		currentChat,
    		currentProfile,
    		invitation,
    		logged,
    		FRONTEND_URL,
    		BACKEND_URL,
    		Oname,
    		Otext,
    		messages,
    		privateMessages,
    		socket,
    		rooms,
    		currentRoom,
    		roomPassword,
    		currentUser,
    		creation,
    		pass,
    		free,
    		title,
    		muteOptions,
    		muteTime,
    		banOptions,
    		banTime,
    		Mutes,
    		changeRemove,
    		newPass,
    		myChannels,
    		allRooms,
    		newRoom,
    		password,
    		blocked,
    		block,
    		i,
    		sendInvitation,
    		kickUser,
    		createRoom,
    		muteUser,
    		removeRoomPass,
    		changeRoomPass,
    		banUser,
    		makeAdmin,
    		removeAdmin,
    		addPassword,
    		updateCurrentUser,
    		removePassword,
    		initAll,
    		createChannel,
    		deleteRoom,
    		deletePrivateMessage,
    		leaveRoom,
    		joinRoom,
    		changeConv,
    		changeConvMessages,
    		sendMessage,
    		receivedMessage,
    		validateInput,
    		updateChannels,
    		createPrivateMessage,
    		$username,
    		$currentChat,
    		$cookie,
    		$id,
    		$logged,
    		$image_url
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('Oname' in $$props) Oname = $$props.Oname;
    		if ('Otext' in $$props) $$invalidate(0, Otext = $$props.Otext);
    		if ('messages' in $$props) $$invalidate(1, messages = $$props.messages);
    		if ('privateMessages' in $$props) $$invalidate(2, privateMessages = $$props.privateMessages);
    		if ('socket' in $$props) socket = $$props.socket;
    		if ('rooms' in $$props) $$invalidate(3, rooms = $$props.rooms);
    		if ('currentRoom' in $$props) $$invalidate(4, currentRoom = $$props.currentRoom);
    		if ('roomPassword' in $$props) $$invalidate(5, roomPassword = $$props.roomPassword);
    		if ('currentUser' in $$props) $$invalidate(6, currentUser = $$props.currentUser);
    		if ('creation' in $$props) $$invalidate(7, creation = $$props.creation);
    		if ('pass' in $$props) $$invalidate(8, pass = $$props.pass);
    		if ('free' in $$props) $$invalidate(9, free = $$props.free);
    		if ('title' in $$props) $$invalidate(10, title = $$props.title);
    		if ('muteOptions' in $$props) $$invalidate(11, muteOptions = $$props.muteOptions);
    		if ('muteTime' in $$props) $$invalidate(12, muteTime = $$props.muteTime);
    		if ('banOptions' in $$props) $$invalidate(13, banOptions = $$props.banOptions);
    		if ('banTime' in $$props) $$invalidate(14, banTime = $$props.banTime);
    		if ('Mutes' in $$props) $$invalidate(15, Mutes = $$props.Mutes);
    		if ('changeRemove' in $$props) $$invalidate(16, changeRemove = $$props.changeRemove);
    		if ('newPass' in $$props) $$invalidate(17, newPass = $$props.newPass);
    		if ('myChannels' in $$props) $$invalidate(18, myChannels = $$props.myChannels);
    		if ('allRooms' in $$props) allRooms = $$props.allRooms;
    		if ('newRoom' in $$props) newRoom = $$props.newRoom;
    		if ('password' in $$props) $$invalidate(19, password = $$props.password);
    		if ('blocked' in $$props) $$invalidate(20, blocked = $$props.blocked);
    		if ('block' in $$props) block = $$props.block;
    		if ('i' in $$props) i = $$props.i;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		Otext,
    		messages,
    		privateMessages,
    		rooms,
    		currentRoom,
    		roomPassword,
    		currentUser,
    		creation,
    		pass,
    		free,
    		title,
    		muteOptions,
    		muteTime,
    		banOptions,
    		banTime,
    		Mutes,
    		changeRemove,
    		newPass,
    		myChannels,
    		password,
    		blocked,
    		$username,
    		$id,
    		$logged,
    		$image_url,
    		sendInvitation,
    		kickUser,
    		createRoom,
    		muteUser,
    		removeRoomPass,
    		changeRoomPass,
    		banUser,
    		makeAdmin,
    		removeAdmin,
    		addPassword,
    		updateCurrentUser,
    		removePassword,
    		deleteRoom,
    		deletePrivateMessage,
    		leaveRoom,
    		joinRoom,
    		changeConv,
    		changeConvMessages,
    		sendMessage,
    		createPrivateMessage,
    		input0_input_handler,
    		input1_change_handler,
    		$$binding_groups,
    		input2_change_handler,
    		input_input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		input_input_handler_1,
    		input_input_handler_2,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		click_handler_12,
    		click_handler_13,
    		input_input_handler_3,
    		submit_handler,
    		click_handler_14,
    		click_handler_15,
    		click_handler_16,
    		click_handler_17,
    		click_handler_18,
    		input0_change_handler,
    		input1_change_handler_1,
    		input2_change_handler_1,
    		click_handler_19,
    		input0_change_handler_1,
    		input1_change_handler_2,
    		input2_change_handler_2
    	];
    }

    class Chat extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {}, null, [-1, -1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Chat",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/routes/Home.svelte generated by Svelte v3.49.0 */
    const file$5 = "src/routes/Home.svelte";

    // (113:4) {:else}
    function create_else_block$4(ctx) {
    	let a;
    	let t;
    	let br;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text("Connect with");
    			br = element("br");
    			img = element("img");
    			attr_dev(br, "class", "svelte-yicb4b");
    			add_location(br, file$5, 130, 18, 5577);
    			if (!src_url_equal(img.src, img_src_value = "img/42_logo.png")) attr_dev(img, "src", img_src_value);
    			set_style(img, "width", "5vw");
    			attr_dev(img, "alt", "42 logo");
    			attr_dev(img, "class", "svelte-yicb4b");
    			add_location(img, file$5, 130, 22, 5581);
    			attr_dev(a, "href", `${BACKEND_URL}/auth/42`);
    			attr_dev(a, "class", "api svelte-yicb4b");
    			set_style(a, "color", "rgb(255, 255, 255)");
    			set_style(a, "text-align", "center");
    			set_style(a, "width", "15vw");
    			set_style(a, "max-width", "90px");
    			set_style(a, "min", "width:50px");
    			set_style(a, "padding", "2vw");
    			set_style(a, "padding-left", "8vw");
    			set_style(a, "padding-right", "8vw");
    			set_style(a, "margin", "0 auto");
    			set_style(a, "align-items", "center");
    			set_style(a, "align-content", "center");
    			set_style(a, "font-size", "clamp(13px, 2vw, 16px)");
    			set_style(a, "display", "block");
    			set_style(a, "margin-top", "30px");
    			set_style(a, "background-color", "rgb(25, 184, 173)");
    			set_style(a, "line-height", "2");
    			set_style(a, "font-family", "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif");
    			add_location(a, file$5, 113, 4, 5001);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    			append_dev(a, br);
    			append_dev(a, img);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(113:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (104:31) 
    function create_if_block_1$4(ctx) {
    	let div;
    	let h2;
    	let t1;
    	let input;
    	let t2;
    	let t3;
    	let button;
    	let mounted;
    	let dispose;
    	let if_block = /*error*/ ctx[1] == true && create_if_block_2$4(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Check your mails for the authentication code !";
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			if (if_block) if_block.c();
    			t3 = space();
    			button = element("button");
    			button.textContent = "Send";
    			set_style(h2, "text-align", "center");
    			attr_dev(h2, "class", "svelte-yicb4b");
    			add_location(h2, file$5, 105, 4, 4511);
    			set_style(input, "width", "150px");
    			set_style(input, "display", "block");
    			set_style(input, "margin", "0 auto");
    			set_style(input, "margin-bottom", "20px");
    			set_style(input, "text-align", "center");
    			attr_dev(input, "type", "password");
    			attr_dev(input, "placeholder", "2FA code");
    			attr_dev(input, "class", "svelte-yicb4b");
    			add_location(input, file$5, 106, 4, 4598);
    			attr_dev(button, "type", "submit");
    			button.value = "Submit";
    			set_style(button, "display", "block");
    			set_style(button, "margin", "0 auto");
    			attr_dev(button, "class", "svelte-yicb4b");
    			add_location(button, file$5, 110, 4, 4864);
    			set_style(div, "margin", "0 auto");
    			set_style(div, "display", "block");
    			attr_dev(div, "class", "svelte-yicb4b");
    			add_location(div, file$5, 104, 4, 4462);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, input);
    			set_input_value(input, /*code*/ ctx[0]);
    			append_dev(div, t2);
    			if (if_block) if_block.m(div, null);
    			append_dev(div, t3);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[6]),
    					listen_dev(button, "click", /*sendCode*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*code*/ 1 && input.value !== /*code*/ ctx[0]) {
    				set_input_value(input, /*code*/ ctx[0]);
    			}

    			if (/*error*/ ctx[1] == true) {
    				if (if_block) ; else {
    					if_block = create_if_block_2$4(ctx);
    					if_block.c();
    					if_block.m(div, t3);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(104:31) ",
    		ctx
    	});

    	return block;
    }

    // (89:2) {#if $logged == 'true'}
    function create_if_block$4(ctx) {
    	let h1;
    	let t1;
    	let div;
    	let p;
    	let t3;
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Just a bit of history...";
    			t1 = space();
    			div = element("div");
    			p = element("p");
    			p.textContent = "Pong is a table tennis–themed twitch arcade sports video game,\n        featuring simple two-dimensional graphics, manufactured by Atari \n        and originally released in 1972. It was one of the earliest arcade \n        video games; it was created by Allan Alcorn as a training exercise \n        assigned to him by Atari co-founder Nolan Bushnell, but Bushnell \n        and Atari co-founder Ted Dabney were surprised by the quality of \n        Alcorn's work and decided to manufacture the game. Bushnell based \n        the game's concept on an electronic ping-pong game included in the \n        Magnavox Odyssey, the first home video game console. In response, \n        Magnavox later sued Atari for patent infringement.";
    			t3 = space();
    			img = element("img");
    			set_style(h1, "text-align", "center");
    			set_style(h1, "font-weight", "700");
    			set_style(h1, "margin-top", "50px");
    			attr_dev(h1, "class", "svelte-yicb4b");
    			add_location(h1, file$5, 89, 2, 3390);
    			set_style(p, "text-align", "center");
    			attr_dev(p, "class", "svelte-yicb4b");
    			add_location(p, file$5, 91, 6, 3518);
    			if (!src_url_equal(img.src, img_src_value = "img/console.png")) attr_dev(img, "src", img_src_value);
    			set_style(img, "margin", "0px auto");
    			set_style(img, "display", "block");
    			set_style(img, "width", "250px");
    			set_style(img, "padding-top", "20px");
    			attr_dev(img, "alt", "First Pong Game console");
    			attr_dev(img, "class", "svelte-yicb4b");
    			add_location(img, file$5, 101, 8, 4281);
    			attr_dev(div, "class", "about svelte-yicb4b");
    			add_location(div, file$5, 90, 4, 3492);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(div, t3);
    			append_dev(div, img);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(89:2) {#if $logged == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (108:4) {#if error == true}
    function create_if_block_2$4(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Wrong code number";
    			set_style(p, "color", "red");
    			set_style(p, "text-align", "center");
    			attr_dev(p, "class", "svelte-yicb4b");
    			add_location(p, file$5, 108, 4, 4787);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$4.name,
    		type: "if",
    		source: "(108:4) {#if error == true}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let main;

    	function select_block_type(ctx, dirty) {
    		if (/*$logged*/ ctx[2] == 'true') return create_if_block$4;
    		if (/*$intra*/ ctx[3] == 'true') return create_if_block_1$4;
    		return create_else_block$4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-yicb4b");
    			add_location(main, file$5, 87, 0, 3355);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $cookie;
    	let $logged;
    	let $TWOFA;
    	let $intra;
    	validate_store(cookie, 'cookie');
    	component_subscribe($$self, cookie, $$value => $$invalidate(10, $cookie = $$value));
    	validate_store(logged, 'logged');
    	component_subscribe($$self, logged, $$value => $$invalidate(2, $logged = $$value));
    	validate_store(TWOFA, 'TWOFA');
    	component_subscribe($$self, TWOFA, $$value => $$invalidate(11, $TWOFA = $$value));
    	validate_store(intra, 'intra');
    	component_subscribe($$self, intra, $$value => $$invalidate(3, $intra = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let { socket = null } = $$props;
    	let blocked = [];
    	let isAuth;
    	let code;
    	let friends;
    	let error = false;

    	function sendCode() {
    		return __awaiter(this, void 0, void 0, function* () {
    			yield fetch(`${BACKEND_URL}/auth/activation/` + code, {
    				method: 'GET',
    				headers: {
    					'Authorization': 'Bearer ' + $cookie,
    					"Content-type": "application/json; charset=UTF-8"
    				}
    			}).then(response => {
    				if (response.status === 200) {
    					logged.update(n => 'true');
    				} else {
    					$$invalidate(0, code = '');
    					$$invalidate(1, error = true);
    				}
    			});
    		});
    	}

    	function updateAll(isAuth) {
    		id.update(n => isAuth.id);
    		username.update(n => isAuth.userName);
    		username42.update(n => isAuth.userName42);
    		firstname.update(n => isAuth.firstName);
    		lastname.update(n => isAuth.lastName);
    		wins.update(n => isAuth.wins);
    		losses.update(n => isAuth.losses);
    		level.update(n => isAuth.level);
    		image_url.update(n => isAuth.imageURL);
    		TWOFA.update(n => isAuth.TWOFA.toString());
    		email.update(n => isAuth.email);
    		ownmail.update(n => isAuth.ownMail.toString());
    		blocked = isAuth.blocked;
    		friends = isAuth.friends;
    	}

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		var _a;
    		currentPage.update(n => 'home');

    		let cookies = (_a = document.cookie) === null || _a === void 0
    		? void 0
    		: _a.split(';').find(n => n.startsWith('access_token'));

    		if (!cookies) {
    			return;
    		}

    		if ($intra == 'false') {
    			cookie.update(n => cookies.split('=')[1]);

    			isAuth = yield fetch(`${BACKEND_URL}/auth/currentuser`, {
    				method: 'GET',
    				credentials: 'include',
    				headers: {
    					'Authorization': 'Bearer ' + $cookie,
    					"Content-type": "application/json; charset=UTF-8"
    				}
    			}).then(response => isAuth = response.json());

    			updateAll(isAuth);
    			intra.update(n => 'true');

    			if ($TWOFA == 'false') {
    				logged.update(n => 'true');
    				$$invalidate(5, socket = lookup(`${BACKEND_URL}/home`, { auth: { token: $cookie } }));
    			}
    		}

    		if ($logged == 'true') {
    			$$invalidate(5, socket = lookup(`${BACKEND_URL}/home`, { auth: { token: $cookie } }));
    		}
    	}));

    	const writable_props = ['socket'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		code = this.value;
    		$$invalidate(0, code);
    	}

    	$$self.$$set = $$props => {
    		if ('socket' in $$props) $$invalidate(5, socket = $$props.socket);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		onMount,
    		username42,
    		currentPage,
    		level,
    		logged,
    		losses,
    		username,
    		wins,
    		image_url,
    		firstname,
    		lastname,
    		id,
    		intra,
    		TWOFA,
    		cookie,
    		email,
    		ownmail,
    		io: lookup,
    		socket,
    		blocked,
    		isAuth,
    		code,
    		friends,
    		error,
    		BACKEND_URL,
    		sendCode,
    		updateAll,
    		$cookie,
    		$logged,
    		$TWOFA,
    		$intra
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('socket' in $$props) $$invalidate(5, socket = $$props.socket);
    		if ('blocked' in $$props) blocked = $$props.blocked;
    		if ('isAuth' in $$props) isAuth = $$props.isAuth;
    		if ('code' in $$props) $$invalidate(0, code = $$props.code);
    		if ('friends' in $$props) friends = $$props.friends;
    		if ('error' in $$props) $$invalidate(1, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [code, error, $logged, $intra, sendCode, socket, input_input_handler];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { socket: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get socket() {
    		throw new Error("<Home>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set socket(value) {
    		throw new Error("<Home>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/routes/NotFound.svelte generated by Svelte v3.49.0 */
    const file$4 = "src/routes/NotFound.svelte";

    function create_fragment$4(ctx) {
    	let section;
    	let div0;
    	let h1;
    	let t1;
    	let p;
    	let t3;
    	let div1;
    	let a;
    	let t4;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Page Not Found";
    			t1 = space();
    			p = element("p");
    			p.textContent = "ERROR 404";
    			t3 = space();
    			div1 = element("div");
    			a = element("a");
    			t4 = text("🔙");
    			attr_dev(h1, "class", "svelte-15564nd");
    			add_location(h1, file$4, 12, 8, 244);
    			add_location(p, file$4, 13, 8, 276);
    			add_location(div0, file$4, 11, 4, 230);
    			attr_dev(a, "href", `${FRONTEND_URL}/#/`);
    			attr_dev(a, "class", "svelte-15564nd");
    			add_location(a, file$4, 16, 7, 321);
    			add_location(div1, file$4, 15, 4, 308);
    			attr_dev(section, "class", "svelte-15564nd");
    			add_location(section, file$4, 10, 0, 216);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			append_dev(div0, p);
    			append_dev(section, t3);
    			append_dev(section, div1);
    			append_dev(div1, a);
    			append_dev(a, t4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('NotFound', slots, []);

    	onMount(() => {
    		currentPage.update(n => '');
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<NotFound> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		currentPage,
    		onMount,
    		FRONTEND_URL,
    		BACKEND_URL
    	});

    	return [];
    }

    class NotFound extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NotFound",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/routes/Profile.svelte generated by Svelte v3.49.0 */

    const { Error: Error_1 } = globals;
    const file$3 = "src/routes/Profile.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[50] = list[i];
    	return child_ctx;
    }

    // (472:2) {:else}
    function create_else_block_3$3(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "ACCESS DENIED";
    			set_style(h1, "text-align", "center");
    			attr_dev(h1, "class", "svelte-11lp3j4");
    			add_location(h1, file$3, 472, 4, 16579);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3$3.name,
    		type: "else",
    		source: "(472:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (213:2) {#if $logged == 'true'}
    function create_if_block$3(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*newUserName*/ ctx[2] == 'true') return create_if_block_1$3;
    		if (/*newMail*/ ctx[3] == 'true') return create_if_block_2$3;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(213:2) {#if $logged == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (274:4) {:else}
    function create_else_block$3(ctx) {
    	let div0;
    	let h10;
    	let t0;
    	let t1;
    	let img;
    	let img_src_value;
    	let t2;
    	let button0;
    	let t4;
    	let input;
    	let t5;
    	let div1;
    	let p0;
    	let t6;
    	let t7;
    	let t8;
    	let br;
    	let t9;
    	let t10;
    	let div2;
    	let button1;
    	let t12;
    	let t13;
    	let div4;
    	let div3;
    	let h11;
    	let t15;
    	let h12;
    	let p1;
    	let span0;
    	let t17;
    	let span1;
    	let t18;
    	let t19;
    	let span2;
    	let span3;
    	let t22;
    	let span4;
    	let t23;
    	let t24;
    	let span5;
    	let span6;
    	let t27;
    	let span7;
    	let t28;
    	let t29;
    	let div7;
    	let h13;
    	let t31;
    	let div6;
    	let t32;
    	let div5;
    	let t33;
    	let div9;
    	let h14;
    	let t35;
    	let div8;
    	let t36;
    	let t37;
    	let t38;
    	let div11;
    	let h15;
    	let t40;
    	let div10;
    	let t41;
    	let mounted;
    	let dispose;

    	function select_block_type_2(ctx, dirty) {
    		if (/*$TWOFA*/ ctx[7] == 'false') return create_if_block_10$2;
    		return create_else_block_2$3;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*matches*/ ctx[6].length == 0 && create_if_block_9$2(ctx);
    	let each_value_1 = [.../*matches*/ ctx[6]].reverse();
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	function select_block_type_4(ctx, dirty) {
    		if (/*$wins*/ ctx[14] == 0 && /*friends*/ ctx[5].length == 0 && /*$ownmail*/ ctx[18] == 'false') return create_if_block_6$2;
    		if (/*$wins*/ ctx[14] != 0) return create_if_block_7$2;
    	}

    	let current_block_type_1 = select_block_type_4(ctx);
    	let if_block2 = current_block_type_1 && current_block_type_1(ctx);
    	let if_block3 = /*friends*/ ctx[5].length > 0 && create_if_block_5$2(ctx);
    	let if_block4 = /*$ownmail*/ ctx[18] == 'true' && create_if_block_4$3(ctx);
    	let if_block5 = /*friends*/ ctx[5].length == 0 && create_if_block_3$3(ctx);
    	let each_value = /*friends*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h10 = element("h1");
    			t0 = text(/*$username*/ ctx[8]);
    			t1 = space();
    			img = element("img");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Change profile picture";
    			t4 = space();
    			input = element("input");
    			t5 = space();
    			div1 = element("div");
    			p0 = element("p");
    			t6 = text(/*$firstname*/ ctx[11]);
    			t7 = space();
    			t8 = text(/*$lastname*/ ctx[12]);
    			br = element("br");
    			t9 = text(/*$email*/ ctx[13]);
    			t10 = space();
    			div2 = element("div");
    			button1 = element("button");
    			button1.textContent = "Change user name";
    			t12 = space();
    			if_block0.c();
    			t13 = space();
    			div4 = element("div");
    			div3 = element("div");
    			h11 = element("h1");
    			h11.textContent = "SCORES";
    			t15 = space();
    			h12 = element("h1");
    			p1 = element("p");
    			span0 = element("span");
    			span0.textContent = "wins";
    			t17 = space();
    			span1 = element("span");
    			t18 = text(/*$wins*/ ctx[14]);
    			t19 = space();
    			span2 = element("span");
    			span2.textContent = "| ";
    			span3 = element("span");
    			span3.textContent = "losses";
    			t22 = space();
    			span4 = element("span");
    			t23 = text(/*$losses*/ ctx[15]);
    			t24 = space();
    			span5 = element("span");
    			span5.textContent = "| ";
    			span6 = element("span");
    			span6.textContent = "level";
    			t27 = space();
    			span7 = element("span");
    			t28 = text(/*$level*/ ctx[16]);
    			t29 = space();
    			div7 = element("div");
    			h13 = element("h1");
    			h13.textContent = "MATCH HISTORY";
    			t31 = space();
    			div6 = element("div");
    			if (if_block1) if_block1.c();
    			t32 = space();
    			div5 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t33 = space();
    			div9 = element("div");
    			h14 = element("h1");
    			h14.textContent = "ACHIEVEMENTS";
    			t35 = space();
    			div8 = element("div");
    			if (if_block2) if_block2.c();
    			t36 = space();
    			if (if_block3) if_block3.c();
    			t37 = space();
    			if (if_block4) if_block4.c();
    			t38 = space();
    			div11 = element("div");
    			h15 = element("h1");
    			h15.textContent = "FRIENDS";
    			t40 = space();
    			div10 = element("div");
    			if (if_block5) if_block5.c();
    			t41 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(h10, "class", "name svelte-11lp3j4");
    			set_style(h10, "color", "darkred");
    			add_location(h10, file$3, 275, 8, 9503);
    			attr_dev(img, "class", "profile svelte-11lp3j4");
    			if (!src_url_equal(img.src, img_src_value = /*$image_url*/ ctx[10])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "width", "200px");
    			attr_dev(img, "alt", "Default Profile");
    			add_location(img, file$3, 276, 8, 9567);
    			attr_dev(button0, "class", "bt1 svelte-11lp3j4");
    			set_style(button0, "cursor", "pointer");
    			add_location(button0, file$3, 282, 8, 9700);
    			set_style(input, "display", "none");
    			attr_dev(input, "type", "file");
    			attr_dev(input, "accept", ".jpg, .jpeg, .png");
    			add_location(input, file$3, 289, 8, 9900);
    			set_style(div0, "margin", "0 auto");
    			set_style(div0, "display", "block");
    			add_location(div0, file$3, 274, 6, 9450);
    			add_location(br, file$3, 302, 21, 10262);
    			set_style(p0, "text-align", "center");
    			set_style(p0, "color", "grey");
    			set_style(p0, "font-weight", "500");
    			set_style(p0, "font-style", "italic");
    			add_location(p0, file$3, 298, 8, 10120);
    			add_location(div1, file$3, 297, 6, 10106);
    			attr_dev(button1, "class", "bt2 svelte-11lp3j4");
    			set_style(button1, "cursor", "pointer");
    			add_location(button1, file$3, 306, 8, 10348);
    			set_style(div2, "margin", "0 auto");
    			add_location(div2, file$3, 305, 6, 10309);
    			set_style(h11, "text-align", "center");
    			set_style(h11, "width", "400px");
    			set_style(h11, "background-color", "darkgrey");
    			set_style(h11, "color", "white");
    			set_style(h11, "text-decoration-line", "underline");
    			set_style(h11, "text-underline-offset", "20px");
    			attr_dev(h11, "class", "svelte-11lp3j4");
    			add_location(h11, file$3, 332, 10, 11315);
    			set_style(div3, "width", "400px");
    			set_style(div3, "margin", "0 auto");
    			set_style(div3, "display", "block");
    			add_location(div3, file$3, 331, 8, 11247);
    			attr_dev(span0, "class", "sp1 svelte-11lp3j4");
    			add_location(span0, file$3, 340, 12, 11609);
    			attr_dev(span1, "class", "sp2 svelte-11lp3j4");
    			add_location(span1, file$3, 340, 42, 11639);
    			set_style(span2, "font-weight", "300");
    			add_location(span2, file$3, 341, 12, 11684);
    			attr_dev(span3, "class", "sp1 svelte-11lp3j4");
    			add_location(span3, file$3, 341, 53, 11725);
    			attr_dev(span4, "class", "sp2 svelte-11lp3j4");
    			add_location(span4, file$3, 343, 14, 11785);
    			set_style(span5, "font-weight", "300");
    			add_location(span5, file$3, 344, 12, 11832);
    			attr_dev(span6, "class", "sp1 svelte-11lp3j4");
    			add_location(span6, file$3, 344, 53, 11873);
    			attr_dev(span7, "class", "sp2 svelte-11lp3j4");
    			add_location(span7, file$3, 346, 14, 11932);
    			add_location(p1, file$3, 339, 10, 11593);
    			set_style(h12, "text-transform", "uppercase");
    			attr_dev(h12, "class", "svelte-11lp3j4");
    			add_location(h12, file$3, 338, 8, 11543);
    			attr_dev(div4, "class", "tb1 svelte-11lp3j4");
    			add_location(div4, file$3, 330, 6, 11221);
    			set_style(h13, "background-color", "darkgrey");
    			set_style(h13, "color", "white");
    			set_style(h13, "text-align", "center");
    			attr_dev(h13, "class", "svelte-11lp3j4");
    			add_location(h13, file$3, 351, 8, 12080);
    			attr_dev(div5, "class", "row svelte-11lp3j4");
    			attr_dev(div5, "id", "history");
    			set_style(div5, "max-height", "150px");
    			set_style(div5, "overflow-y", "scroll");
    			set_style(div5, "margin", "0 auto");
    			set_style(div5, "display", "block");
    			set_style(div5, "align-content", "center");
    			set_style(div5, "text-align", "center");
    			add_location(div5, file$3, 362, 10, 12526);
    			set_style(div6, "display", "block");
    			set_style(div6, "margin", "0 auto");
    			set_style(div6, "text-align", "center");
    			add_location(div6, file$3, 354, 8, 12199);
    			set_style(div7, "width", "400px");
    			set_style(div7, "margin", "0 auto");
    			set_style(div7, "display", "block");
    			add_location(div7, file$3, 350, 6, 12014);
    			set_style(h14, "background-color", "darkgrey");
    			set_style(h14, "color", "white");
    			set_style(h14, "text-align", "center");
    			attr_dev(h14, "class", "svelte-11lp3j4");
    			add_location(h14, file$3, 397, 8, 13978);
    			attr_dev(div8, "class", "achievements svelte-11lp3j4");
    			add_location(div8, file$3, 400, 8, 14096);
    			set_style(div9, "width", "400px");
    			set_style(div9, "margin", "0 auto");
    			set_style(div9, "display", "block");
    			add_location(div9, file$3, 396, 6, 13911);
    			set_style(h15, "background-color", "darkgrey");
    			set_style(h15, "color", "white");
    			set_style(h15, "text-align", "center");
    			attr_dev(h15, "class", "svelte-11lp3j4");
    			add_location(h15, file$3, 440, 8, 15619);
    			attr_dev(div10, "class", "friends svelte-11lp3j4");
    			add_location(div10, file$3, 443, 8, 15732);
    			set_style(div11, "width", "400px");
    			set_style(div11, "margin", "0 auto");
    			set_style(div11, "display", "block");
    			add_location(div11, file$3, 439, 6, 15552);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h10);
    			append_dev(h10, t0);
    			append_dev(div0, t1);
    			append_dev(div0, img);
    			append_dev(div0, t2);
    			append_dev(div0, button0);
    			append_dev(div0, t4);
    			append_dev(div0, input);
    			/*input_binding*/ ctx[29](input);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p0);
    			append_dev(p0, t6);
    			append_dev(p0, t7);
    			append_dev(p0, t8);
    			append_dev(p0, br);
    			append_dev(p0, t9);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, button1);
    			append_dev(div2, t12);
    			if_block0.m(div2, null);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, h11);
    			append_dev(div4, t15);
    			append_dev(div4, h12);
    			append_dev(h12, p1);
    			append_dev(p1, span0);
    			append_dev(p1, t17);
    			append_dev(p1, span1);
    			append_dev(span1, t18);
    			append_dev(p1, t19);
    			append_dev(p1, span2);
    			append_dev(p1, span3);
    			append_dev(p1, t22);
    			append_dev(p1, span4);
    			append_dev(span4, t23);
    			append_dev(p1, t24);
    			append_dev(p1, span5);
    			append_dev(p1, span6);
    			append_dev(p1, t27);
    			append_dev(p1, span7);
    			append_dev(span7, t28);
    			insert_dev(target, t29, anchor);
    			insert_dev(target, div7, anchor);
    			append_dev(div7, h13);
    			append_dev(div7, t31);
    			append_dev(div7, div6);
    			if (if_block1) if_block1.m(div6, null);
    			append_dev(div6, t32);
    			append_dev(div6, div5);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div5, null);
    			}

    			insert_dev(target, t33, anchor);
    			insert_dev(target, div9, anchor);
    			append_dev(div9, h14);
    			append_dev(div9, t35);
    			append_dev(div9, div8);
    			if (if_block2) if_block2.m(div8, null);
    			append_dev(div8, t36);
    			if (if_block3) if_block3.m(div8, null);
    			append_dev(div8, t37);
    			if (if_block4) if_block4.m(div8, null);
    			insert_dev(target, t38, anchor);
    			insert_dev(target, div11, anchor);
    			append_dev(div11, h15);
    			append_dev(div11, t40);
    			append_dev(div11, div10);
    			if (if_block5) if_block5.m(div10, null);
    			append_dev(div10, t41);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div10, null);
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", prevent_default(/*click_handler_2*/ ctx[27]), false, true, false),
    					listen_dev(input, "change", /*change_handler*/ ctx[28], false, false, false),
    					listen_dev(button1, "click", prevent_default(/*click_handler_3*/ ctx[30]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$username*/ 256) set_data_dev(t0, /*$username*/ ctx[8]);

    			if (dirty[0] & /*$image_url*/ 1024 && !src_url_equal(img.src, img_src_value = /*$image_url*/ ctx[10])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*$firstname*/ 2048) set_data_dev(t6, /*$firstname*/ ctx[11]);
    			if (dirty[0] & /*$lastname*/ 4096) set_data_dev(t8, /*$lastname*/ ctx[12]);
    			if (dirty[0] & /*$email*/ 8192) set_data_dev(t9, /*$email*/ ctx[13]);

    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div2, null);
    				}
    			}

    			if (dirty[0] & /*$wins*/ 16384) set_data_dev(t18, /*$wins*/ ctx[14]);
    			if (dirty[0] & /*$losses*/ 32768) set_data_dev(t23, /*$losses*/ ctx[15]);
    			if (dirty[0] & /*$level*/ 65536) set_data_dev(t28, /*$level*/ ctx[16]);

    			if (/*matches*/ ctx[6].length == 0) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_9$2(ctx);
    					if_block1.c();
    					if_block1.m(div6, t32);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*matches, $username42*/ 131136) {
    				each_value_1 = [.../*matches*/ ctx[6]].reverse();
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div5, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (current_block_type_1 !== (current_block_type_1 = select_block_type_4(ctx))) {
    				if (if_block2) if_block2.d(1);
    				if_block2 = current_block_type_1 && current_block_type_1(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div8, t36);
    				}
    			}

    			if (/*friends*/ ctx[5].length > 0) {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_5$2(ctx);
    					if_block3.c();
    					if_block3.m(div8, t37);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*$ownmail*/ ctx[18] == 'true') {
    				if (if_block4) ; else {
    					if_block4 = create_if_block_4$3(ctx);
    					if_block4.c();
    					if_block4.m(div8, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*friends*/ ctx[5].length == 0) {
    				if (if_block5) ; else {
    					if_block5 = create_if_block_3$3(ctx);
    					if_block5.c();
    					if_block5.m(div10, t41);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (dirty[0] & /*friends*/ 32) {
    				each_value = /*friends*/ ctx[5];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div10, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			/*input_binding*/ ctx[29](null);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div2);
    			if_block0.d();
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(div4);
    			if (detaching) detach_dev(t29);
    			if (detaching) detach_dev(div7);
    			if (if_block1) if_block1.d();
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t33);
    			if (detaching) detach_dev(div9);

    			if (if_block2) {
    				if_block2.d();
    			}

    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (detaching) detach_dev(t38);
    			if (detaching) detach_dev(div11);
    			if (if_block5) if_block5.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(274:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (246:32) 
    function create_if_block_2$3(ctx) {
    	let div4;
    	let h2;
    	let t1;
    	let div3;
    	let input;
    	let t2;
    	let div0;
    	let button0;
    	let t4;
    	let div1;
    	let t5;
    	let div2;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Enter a private mail address";
    			t1 = space();
    			div3 = element("div");
    			input = element("input");
    			t2 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Change";
    			t4 = space();
    			div1 = element("div");
    			t5 = space();
    			div2 = element("div");
    			button1 = element("button");
    			button1.textContent = "🔙";
    			add_location(h2, file$3, 247, 8, 8674);
    			set_style(input, "width", "150px");
    			attr_dev(input, "type", "email");
    			input.required = true;
    			attr_dev(input, "placeholder", "Mail address");
    			add_location(input, file$3, 249, 10, 8736);
    			attr_dev(button0, "type", "submit");
    			button0.value = "Submit";
    			set_style(button0, "cursor", "pointer");
    			add_location(button0, file$3, 257, 12, 8933);
    			add_location(div0, file$3, 256, 10, 8915);
    			add_location(div1, file$3, 264, 10, 9152);
    			set_style(button1, "cursor", "pointer");
    			set_style(button1, "font-size", "50px");
    			set_style(button1, "border", "none");
    			set_style(button1, "background-color", "transparent");
    			add_location(button1, file$3, 266, 12, 9188);
    			add_location(div2, file$3, 265, 10, 9170);
    			add_location(div3, file$3, 248, 8, 8720);
    			attr_dev(div4, "class", "newMail svelte-11lp3j4");
    			add_location(div4, file$3, 246, 6, 8644);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, h2);
    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div3, input);
    			set_input_value(input, /*mail*/ ctx[0]);
    			append_dev(div3, t2);
    			append_dev(div3, div0);
    			append_dev(div0, button0);
    			append_dev(div3, t4);
    			append_dev(div3, div1);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler_1*/ ctx[25]),
    					listen_dev(button0, "click", prevent_default(/*validateMailAddress*/ ctx[19]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*click_handler_1*/ ctx[26]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*mail*/ 1 && input.value !== /*mail*/ ctx[0]) {
    				set_input_value(input, /*mail*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(246:32) ",
    		ctx
    	});

    	return block;
    }

    // (214:4) {#if newUserName == 'true'}
    function create_if_block_1$3(ctx) {
    	let div4;
    	let h2;
    	let t1;
    	let div3;
    	let input;
    	let t2;
    	let div0;
    	let button0;
    	let t4;
    	let div1;
    	let t5;
    	let div2;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Enter new username";
    			t1 = space();
    			div3 = element("div");
    			input = element("input");
    			t2 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Change";
    			t4 = space();
    			div1 = element("div");
    			t5 = space();
    			div2 = element("div");
    			button1 = element("button");
    			button1.textContent = "🔙";
    			add_location(h2, file$3, 215, 8, 7765);
    			set_style(input, "width", "150px");
    			attr_dev(input, "placeholder", "Enter new username");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "minlength", "3");
    			attr_dev(input, "maxlength", "6");
    			input.required = true;
    			add_location(input, file$3, 217, 10, 7817);
    			attr_dev(button0, "type", "submit");
    			button0.value = "Submit";
    			set_style(button0, "cursor", "pointer");
    			add_location(button0, file$3, 227, 12, 8071);
    			add_location(div0, file$3, 226, 10, 8053);
    			add_location(div1, file$3, 234, 10, 8287);
    			set_style(button1, "cursor", "pointer");
    			set_style(button1, "font-size", "50px");
    			set_style(button1, "border", "none");
    			set_style(button1, "background-color", "transparent");
    			add_location(button1, file$3, 236, 12, 8323);
    			add_location(div2, file$3, 235, 10, 8305);
    			add_location(div3, file$3, 216, 8, 7801);
    			attr_dev(div4, "class", "newUserName svelte-11lp3j4");
    			add_location(div4, file$3, 214, 6, 7731);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, h2);
    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div3, input);
    			set_input_value(input, /*user*/ ctx[1]);
    			append_dev(div3, t2);
    			append_dev(div3, div0);
    			append_dev(div0, button0);
    			append_dev(div3, t4);
    			append_dev(div3, div1);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[23]),
    					listen_dev(button0, "click", prevent_default(/*validateUserName*/ ctx[20]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*click_handler*/ ctx[24]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*user*/ 2 && input.value !== /*user*/ ctx[1]) {
    				set_input_value(input, /*user*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(214:4) {#if newUserName == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (322:8) {:else}
    function create_else_block_2$3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Disable 2FA";
    			attr_dev(button, "class", "TWOFA svelte-11lp3j4");
    			set_style(button, "cursor", "pointer");
    			set_style(button, "margin", "0 auto");
    			set_style(button, "padding", "10px");
    			set_style(button, "width", "200px");
    			set_style(button, "background-color", "dimgrey");
    			set_style(button, "color", "white");
    			set_style(button, "border-radius", "5px");
    			add_location(button, file$3, 322, 10, 10921);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*TWOFAoff*/ ctx[21]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$3.name,
    		type: "else",
    		source: "(322:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (315:8) {#if $TWOFA == 'false'}
    function create_if_block_10$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Enable 2FA";
    			attr_dev(button, "class", "TWOFA svelte-11lp3j4");
    			set_style(button, "cursor", "pointer");
    			set_style(button, "margin", "0 auto");
    			set_style(button, "padding", "10px");
    			set_style(button, "width", "200px");
    			set_style(button, "color", "white");
    			set_style(button, "background-color", "lightslategrey");
    			set_style(button, "border-radius", "5px");
    			add_location(button, file$3, 315, 10, 10610);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler_4*/ ctx[31]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10$2.name,
    		type: "if",
    		source: "(315:8) {#if $TWOFA == 'false'}",
    		ctx
    	});

    	return block;
    }

    // (356:10) {#if matches.length == 0}
    function create_if_block_9$2(ctx) {
    	let h4;

    	const block = {
    		c: function create() {
    			h4 = element("h4");
    			h4.textContent = "No match history to display yet";
    			set_style(h4, "text-align", "center");
    			set_style(h4, "display", "block");
    			set_style(h4, "margin", "0 auto");
    			set_style(h4, "color", "dimgrey");
    			set_style(h4, "font-style", "italic");
    			add_location(h4, file$3, 356, 12, 12311);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h4, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9$2.name,
    		type: "if",
    		source: "(356:10) {#if matches.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (382:14) {:else}
    function create_else_block_1$3(ctx) {
    	let div0;
    	let p0;
    	let t1;
    	let div1;
    	let p1;
    	let t2_value = /*match*/ ctx[50].winner.userName42 + "";
    	let t2;
    	let t3;
    	let div2;
    	let p2;
    	let t4_value = /*match*/ ctx[50].score + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			p0 = element("p");
    			p0.textContent = "Lost to";
    			t1 = space();
    			div1 = element("div");
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			p2 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			set_style(p0, "color", "red");
    			set_style(p0, "font-weight", "700");
    			add_location(p0, file$3, 383, 18, 13469);
    			attr_dev(div0, "class", "column");
    			set_style(div0, "float", "left");
    			set_style(div0, "width", "30%");
    			add_location(div0, file$3, 382, 16, 13397);
    			add_location(p1, file$3, 386, 18, 13632);
    			attr_dev(div1, "class", "column");
    			set_style(div1, "float", "left");
    			set_style(div1, "width", "30%");
    			add_location(div1, file$3, 385, 16, 13560);
    			add_location(p2, file$3, 389, 18, 13776);
    			attr_dev(div2, "class", "column");
    			set_style(div2, "float", "left");
    			set_style(div2, "width", "30%");
    			add_location(div2, file$3, 388, 16, 13704);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, p0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p1);
    			append_dev(p1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, p2);
    			append_dev(p2, t4);
    			append_dev(div2, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*matches*/ 64 && t2_value !== (t2_value = /*match*/ ctx[50].winner.userName42 + "")) set_data_dev(t2, t2_value);
    			if (dirty[0] & /*matches*/ 64 && t4_value !== (t4_value = /*match*/ ctx[50].score + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$3.name,
    		type: "else",
    		source: "(382:14) {:else}",
    		ctx
    	});

    	return block;
    }

    // (369:14) {#if match.winner.userName42 == $username42}
    function create_if_block_8$2(ctx) {
    	let div0;
    	let p0;
    	let t1;
    	let div1;
    	let p1;
    	let t2_value = /*match*/ ctx[50].loser.userName42 + "";
    	let t2;
    	let t3;
    	let div2;
    	let p2;
    	let t4_value = /*match*/ ctx[50].score + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			p0 = element("p");
    			p0.textContent = "Won to";
    			t1 = space();
    			div1 = element("div");
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			p2 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			set_style(p0, "color", "green");
    			set_style(p0, "font-weight", "700");
    			add_location(p0, file$3, 373, 18, 13008);
    			attr_dev(div0, "class", "column");
    			set_style(div0, "float", "left");
    			set_style(div0, "width", "30%");
    			set_style(div0, "display", "block");
    			set_style(div0, "margin", "0 auto");
    			add_location(div0, file$3, 369, 16, 12852);
    			add_location(p1, file$3, 376, 18, 13172);
    			attr_dev(div1, "class", "column");
    			set_style(div1, "float", "left");
    			set_style(div1, "width", "30%");
    			add_location(div1, file$3, 375, 16, 13100);
    			add_location(p2, file$3, 379, 18, 13315);
    			attr_dev(div2, "class", "column");
    			set_style(div2, "float", "left");
    			set_style(div2, "width", "30%");
    			add_location(div2, file$3, 378, 16, 13243);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, p0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p1);
    			append_dev(p1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, p2);
    			append_dev(p2, t4);
    			append_dev(div2, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*matches*/ 64 && t2_value !== (t2_value = /*match*/ ctx[50].loser.userName42 + "")) set_data_dev(t2, t2_value);
    			if (dirty[0] & /*matches*/ 64 && t4_value !== (t4_value = /*match*/ ctx[50].score + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8$2.name,
    		type: "if",
    		source: "(369:14) {#if match.winner.userName42 == $username42}",
    		ctx
    	});

    	return block;
    }

    // (368:12) {#each [...matches].reverse() as match}
    function create_each_block_1(ctx) {
    	let if_block_anchor;

    	function select_block_type_3(ctx, dirty) {
    		if (/*match*/ ctx[50].winner.userName42 == /*$username42*/ ctx[17]) return create_if_block_8$2;
    		return create_else_block_1$3;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(368:12) {#each [...matches].reverse() as match}",
    		ctx
    	});

    	return block;
    }

    // (408:31) 
    function create_if_block_7$2(ctx) {
    	let p;
    	let span0;
    	let br;
    	let span1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			span0 = element("span");
    			span0.textContent = "🥇 One first win 🥇";
    			br = element("br");
    			span1 = element("span");
    			span1.textContent = "You defeated another player on match!";
    			set_style(span0, "text-transform", "uppercase");
    			set_style(span0, "font-weight", "600");
    			add_location(span0, file$3, 409, 14, 14458);
    			add_location(br, file$3, 411, 15, 14575);
    			set_style(span1, "font-weight", "400");
    			set_style(span1, "font-style", "italic");
    			set_style(span1, "color", "grey");
    			add_location(span1, file$3, 411, 21, 14581);
    			add_location(p, file$3, 408, 12, 14440);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, span0);
    			append_dev(p, br);
    			append_dev(p, span1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7$2.name,
    		type: "if",
    		source: "(408:31) ",
    		ctx
    	});

    	return block;
    }

    // (402:10) {#if $wins == 0 && friends.length == 0 && $ownmail == 'false'}
    function create_if_block_6$2(ctx) {
    	let h4;

    	const block = {
    		c: function create() {
    			h4 = element("h4");
    			h4.textContent = "No achievements to display yet";
    			set_style(h4, "text-align", "center");
    			set_style(h4, "display", "block");
    			set_style(h4, "margin", "0 auto");
    			set_style(h4, "color", "dimgrey");
    			set_style(h4, "font-style", "italic");
    			add_location(h4, file$3, 402, 12, 14208);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h4, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6$2.name,
    		type: "if",
    		source: "(402:10) {#if $wins == 0 && friends.length == 0 && $ownmail == 'false'}",
    		ctx
    	});

    	return block;
    }

    // (418:10) {#if friends.length > 0}
    function create_if_block_5$2(ctx) {
    	let p;
    	let span0;
    	let br;
    	let span1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			span0 = element("span");
    			span0.textContent = "🤹‍♀️ Social guy 🤹‍♀️";
    			br = element("br");
    			span1 = element("span");
    			span1.textContent = "You added one person as a friend!";
    			set_style(span0, "text-transform", "uppercase");
    			set_style(span0, "font-weight", "600");
    			add_location(span0, file$3, 419, 14, 14834);
    			add_location(br, file$3, 421, 15, 14954);
    			set_style(span1, "font-weight", "400");
    			set_style(span1, "font-style", "italic");
    			set_style(span1, "color", "grey");
    			add_location(span1, file$3, 421, 21, 14960);
    			add_location(p, file$3, 418, 12, 14816);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, span0);
    			append_dev(p, br);
    			append_dev(p, span1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5$2.name,
    		type: "if",
    		source: "(418:10) {#if friends.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (428:10) {#if $ownmail == 'true'}
    function create_if_block_4$3(ctx) {
    	let p;
    	let span0;
    	let br;
    	let span1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			span0 = element("span");
    			span0.textContent = "🛡 Secure guy 🛡";
    			br = element("br");
    			span1 = element("span");
    			span1.textContent = "You enabled two factor authentication!";
    			set_style(span0, "text-transform", "uppercase");
    			set_style(span0, "font-weight", "600");
    			add_location(span0, file$3, 429, 14, 15209);
    			add_location(br, file$3, 431, 15, 15323);
    			set_style(span1, "font-weight", "400");
    			set_style(span1, "font-style", "italic");
    			set_style(span1, "color", "grey");
    			add_location(span1, file$3, 431, 21, 15329);
    			add_location(p, file$3, 428, 12, 15191);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, span0);
    			append_dev(p, br);
    			append_dev(p, span1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$3.name,
    		type: "if",
    		source: "(428:10) {#if $ownmail == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (445:10) {#if friends.length == 0}
    function create_if_block_3$3(ctx) {
    	let h4;

    	const block = {
    		c: function create() {
    			h4 = element("h4");
    			h4.textContent = "No friends yet to display";
    			set_style(h4, "text-align", "center");
    			set_style(h4, "display", "block");
    			set_style(h4, "margin", "0 auto");
    			set_style(h4, "color", "dimgrey");
    			set_style(h4, "font-style", "italic");
    			add_location(h4, file$3, 445, 12, 15802);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h4, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$3.name,
    		type: "if",
    		source: "(445:10) {#if friends.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (452:10) {#each friends as friend}
    function create_each_block$2(ctx) {
    	let div;
    	let a;
    	let img;
    	let img_src_value;
    	let t0_value = /*friend*/ ctx[47].userName + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_5() {
    		return /*click_handler_5*/ ctx[32](/*friend*/ ctx[47]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			img = element("img");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(img, "id", "otherProfile");
    			if (!src_url_equal(img.src, img_src_value = /*friend*/ ctx[47].imageURL)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "profile");
    			attr_dev(img, "class", "svelte-11lp3j4");
    			add_location(img, file$3, 460, 16, 16322);
    			attr_dev(a, "class", "profileLink svelte-11lp3j4");
    			attr_dev(a, "href", `${FRONTEND_URL}/#/userprofile`);
    			add_location(a, file$3, 453, 14, 16087);
    			attr_dev(div, "class", "oneFriend svelte-11lp3j4");
    			add_location(div, file$3, 452, 12, 16049);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    			append_dev(a, img);
    			append_dev(a, t0);
    			append_dev(div, t1);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", click_handler_5, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*friends*/ 32 && !src_url_equal(img.src, img_src_value = /*friend*/ ctx[47].imageURL)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*friends*/ 32 && t0_value !== (t0_value = /*friend*/ ctx[47].userName + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(452:10) {#each friends as friend}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;

    	function select_block_type(ctx, dirty) {
    		if (/*$logged*/ ctx[9] == 'true') return create_if_block$3;
    		return create_else_block_3$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-11lp3j4");
    			add_location(main, file$3, 211, 0, 7660);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function onlyNumbers(str) {
    	return (/^[0-9]+$/).test(str);
    }

    function redirect(arg0) {
    	throw new Error('Function not implemented.');
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $cookie;
    	let $id;
    	let $TWOFA;
    	let $username;
    	let $logged;
    	let $image_url;
    	let $firstname;
    	let $lastname;
    	let $email;
    	let $wins;
    	let $losses;
    	let $level;
    	let $username42;
    	let $ownmail;
    	validate_store(cookie, 'cookie');
    	component_subscribe($$self, cookie, $$value => $$invalidate(40, $cookie = $$value));
    	validate_store(id, 'id');
    	component_subscribe($$self, id, $$value => $$invalidate(41, $id = $$value));
    	validate_store(TWOFA, 'TWOFA');
    	component_subscribe($$self, TWOFA, $$value => $$invalidate(7, $TWOFA = $$value));
    	validate_store(username, 'username');
    	component_subscribe($$self, username, $$value => $$invalidate(8, $username = $$value));
    	validate_store(logged, 'logged');
    	component_subscribe($$self, logged, $$value => $$invalidate(9, $logged = $$value));
    	validate_store(image_url, 'image_url');
    	component_subscribe($$self, image_url, $$value => $$invalidate(10, $image_url = $$value));
    	validate_store(firstname, 'firstname');
    	component_subscribe($$self, firstname, $$value => $$invalidate(11, $firstname = $$value));
    	validate_store(lastname, 'lastname');
    	component_subscribe($$self, lastname, $$value => $$invalidate(12, $lastname = $$value));
    	validate_store(email, 'email');
    	component_subscribe($$self, email, $$value => $$invalidate(13, $email = $$value));
    	validate_store(wins, 'wins');
    	component_subscribe($$self, wins, $$value => $$invalidate(14, $wins = $$value));
    	validate_store(losses, 'losses');
    	component_subscribe($$self, losses, $$value => $$invalidate(15, $losses = $$value));
    	validate_store(level, 'level');
    	component_subscribe($$self, level, $$value => $$invalidate(16, $level = $$value));
    	validate_store(username42, 'username42');
    	component_subscribe($$self, username42, $$value => $$invalidate(17, $username42 = $$value));
    	validate_store(ownmail, 'ownmail');
    	component_subscribe($$self, ownmail, $$value => $$invalidate(18, $ownmail = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Profile', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let socket = null;
    	let mail;
    	let user;
    	let newUserName = 'false';
    	let newMail = 'false';
    	let fileinput;
    	let newImage;
    	let friendArray = [];
    	let myFriends;
    	let friends = [];
    	let newFriend;
    	let myMatches;
    	let matches = [];
    	let userResponse;

    	const validateEmail = email => {
    		return String(email).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
    	};

    	function validateMailAddress() {
    		if (validateEmail(mail)) {
    			changeMailAddress();
    		} else {
    			alert('❌ Please enter a valid email address');
    			$$invalidate(0, mail = '');
    		}
    	}

    	function changeMailAddress() {
    		return __awaiter(this, void 0, void 0, function* () {
    			if ($TWOFA == 'false') {
    				yield fetch(`${BACKEND_URL}/users/twofa`, {
    					method: 'POST',
    					headers: { Authorization: 'Bearer ' + $cookie }
    				});

    				yield fetch(`${BACKEND_URL}/users/updatemail/`, {
    					method: 'POST',
    					body: JSON.stringify({ id: $id, email: mail }),
    					headers: {
    						Authorization: 'Bearer ' + $cookie,
    						'Content-type': 'application/json; charset=UTF-8'
    					}
    				});

    				ownmail.update(n => 'true');
    				TWOFA.update(n => 'true');
    				email.update(n => mail);
    				alert('✅ Two factor authentification has been enalbled on this account');
    				$$invalidate(3, newMail = 'false');
    			} else {
    				alert('❌ Two factor authentication is already enabled!');
    				$$invalidate(3, newMail = 'false');
    			}
    		});
    	}

    	function validateUserName() {
    		if (user.length < 3) {
    			alert('❌ New username must be at least 3 characters long');
    		} else if (user.length > 6) {
    			alert('❌ New username must not be longet than 6 characters long');
    		} else if (user == $username) {
    			alert(user + ' is already your username');
    		} else {
    			changeUserName();
    		}
    	}

    	function changeUserName() {
    		return __awaiter(this, void 0, void 0, function* () {
    			userResponse = yield fetch(`${BACKEND_URL}/users/updateusername/`, {
    				method: 'POST',
    				body: JSON.stringify({ username: user, id: $id }),
    				headers: {
    					Authorization: 'Bearer ' + $cookie,
    					'Content-type': 'application/json; charset=UTF-8'
    				}
    			}).then(response => userResponse = response.json());

    			if (userResponse.status == 'OK') {
    				alert('✅ Your username has beem changed to ' + user);
    				username.update(n => user);
    				$$invalidate(2, newUserName = 'false');
    				$$invalidate(1, user = '');
    			} else if (userResponse.status == 'KO') {
    				alert('⚠️ user name has already been  chosen ! Pick another one');
    				$$invalidate(1, user = '');
    			}
    		});
    	}

    	function TWOFAon() {
    		return __awaiter(this, void 0, void 0, function* () {
    			if ($TWOFA == 'false') {
    				yield fetch(`${BACKEND_URL}/users/twofa`, {
    					method: 'POST',
    					headers: { Authorization: 'Bearer ' + $cookie }
    				});

    				TWOFA.update(n => 'true');
    				alert('✅ Two factor authentification has been enalbled on this account');
    			} else {
    				alert('❌ Two factor authentication is already enabled!');
    			}
    		});
    	}

    	function TWOFAoff() {
    		return __awaiter(this, void 0, void 0, function* () {
    			if ($TWOFA == 'true') {
    				yield fetch(`${BACKEND_URL}/users/twofa`, {
    					method: 'POST',
    					headers: { Authorization: 'Bearer ' + $cookie }
    				});

    				TWOFA.update(n => 'false');
    				alert('✅ Two factor authentication has been disabled on this account');
    			} else {
    				alert('❌ Two factor authentication is already disabled!');
    			}
    		});
    	}

    	function onFileSelected(e) {
    		return __awaiter(this, void 0, void 0, function* () {
    			let image = e.target.files[0];
    			var data = new FormData();
    			data.append('file', image);
    			data.append('id', $id.toString());

    			newImage = yield fetch(`${BACKEND_URL}/users/updateimage/`, {
    				method: 'post',
    				body: data,
    				headers: { Authorization: 'Bearer ' + $cookie }
    			}).then(response => newImage = response.json());

    			if (newImage.url) {
    				image_url.update(n => newImage.url);
    			}
    		});
    	}

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		socket = lookup(`${BACKEND_URL}/profile`, { auth: { token: $cookie } });
    		currentPage.update(n => 'profile');

    		myFriends = yield fetch(`${BACKEND_URL}/auth/currentuser`, {
    			method: 'GET',
    			credentials: 'include',
    			headers: {
    				Authorization: 'Bearer ' + $cookie,
    				'Content-type': 'application/json; charset=UTF-8'
    			}
    		}).then(response => myFriends = response.json());

    		friendArray = myFriends.friends;

    		for (let i = 0; i < friendArray.length; i++) {
    			if (parseInt(friendArray[i])) {
    				newFriend = yield fetch(`${BACKEND_URL}/users/` + friendArray[i], {
    					method: 'GET',
    					credentials: 'include',
    					headers: {
    						Authorization: 'Bearer ' + $cookie,
    						'Content-type': 'application/json; charset=UTF-8'
    					}
    				}).then(response => newFriend = response.json());

    				$$invalidate(5, friends = [...friends, newFriend]);
    			}
    		}

    		wins.update(n => myFriends.wins);
    		losses.update(n => myFriends.losses);
    		level.update(n => myFriends.level.toFixed(1));

    		myMatches = yield fetch(`${BACKEND_URL}/matches/getForUser`, {
    			method: 'POST',
    			credentials: 'include',
    			body: JSON.stringify({ id: $id }),
    			headers: {
    				Authorization: 'Bearer ' + $cookie,
    				'Content-type': 'application/json; charset=UTF-8'
    			}
    		}).then(response => myMatches = response.json());

    		$$invalidate(6, matches = myMatches);
    		refresh.update(n => 'true');
    	}));

    	onDestroy(() => __awaiter(void 0, void 0, void 0, function* () {
    		refresh.update(n => 'false');
    	}));

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Profile> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		user = this.value;
    		$$invalidate(1, user);
    	}

    	const click_handler = () => {
    		$$invalidate(2, newUserName = 'false');
    	};

    	function input_input_handler_1() {
    		mail = this.value;
    		$$invalidate(0, mail);
    	}

    	const click_handler_1 = () => $$invalidate(3, newMail = 'false');

    	const click_handler_2 = () => {
    		fileinput.click();
    	};

    	const change_handler = e => onFileSelected(e);

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			fileinput = $$value;
    			$$invalidate(4, fileinput);
    		});
    	}

    	const click_handler_3 = () => {
    		$$invalidate(2, newUserName = 'true');
    		$$invalidate(3, newMail = 'false');
    	};

    	const click_handler_4 = () => $$invalidate(3, newMail = 'true');

    	const click_handler_5 = friend => {
    		otherUser.update(n => friend.id);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		onDestroy,
    		onMount,
    		level,
    		logged,
    		losses,
    		username,
    		wins,
    		image_url,
    		firstname,
    		lastname,
    		id,
    		TWOFA,
    		cookie,
    		email,
    		ownmail,
    		otherUser,
    		currentPage,
    		username42,
    		refresh,
    		io: lookup,
    		FRONTEND_URL,
    		BACKEND_URL,
    		socket,
    		mail,
    		user,
    		newUserName,
    		newMail,
    		fileinput,
    		newImage,
    		friendArray,
    		myFriends,
    		friends,
    		newFriend,
    		myMatches,
    		matches,
    		userResponse,
    		validateEmail,
    		validateMailAddress,
    		changeMailAddress,
    		validateUserName,
    		changeUserName,
    		TWOFAon,
    		onlyNumbers,
    		TWOFAoff,
    		onFileSelected,
    		redirect,
    		$cookie,
    		$id,
    		$TWOFA,
    		$username,
    		$logged,
    		$image_url,
    		$firstname,
    		$lastname,
    		$email,
    		$wins,
    		$losses,
    		$level,
    		$username42,
    		$ownmail
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('socket' in $$props) socket = $$props.socket;
    		if ('mail' in $$props) $$invalidate(0, mail = $$props.mail);
    		if ('user' in $$props) $$invalidate(1, user = $$props.user);
    		if ('newUserName' in $$props) $$invalidate(2, newUserName = $$props.newUserName);
    		if ('newMail' in $$props) $$invalidate(3, newMail = $$props.newMail);
    		if ('fileinput' in $$props) $$invalidate(4, fileinput = $$props.fileinput);
    		if ('newImage' in $$props) newImage = $$props.newImage;
    		if ('friendArray' in $$props) friendArray = $$props.friendArray;
    		if ('myFriends' in $$props) myFriends = $$props.myFriends;
    		if ('friends' in $$props) $$invalidate(5, friends = $$props.friends);
    		if ('newFriend' in $$props) newFriend = $$props.newFriend;
    		if ('myMatches' in $$props) myMatches = $$props.myMatches;
    		if ('matches' in $$props) $$invalidate(6, matches = $$props.matches);
    		if ('userResponse' in $$props) userResponse = $$props.userResponse;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		mail,
    		user,
    		newUserName,
    		newMail,
    		fileinput,
    		friends,
    		matches,
    		$TWOFA,
    		$username,
    		$logged,
    		$image_url,
    		$firstname,
    		$lastname,
    		$email,
    		$wins,
    		$losses,
    		$level,
    		$username42,
    		$ownmail,
    		validateMailAddress,
    		validateUserName,
    		TWOFAoff,
    		onFileSelected,
    		input_input_handler,
    		click_handler,
    		input_input_handler_1,
    		click_handler_1,
    		click_handler_2,
    		change_handler,
    		input_binding,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5
    	];
    }

    class Profile extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {}, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Profile",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/routes/UserProfile.svelte generated by Svelte v3.49.0 */
    const file$2 = "src/routes/UserProfile.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[29] = list[i];
    	return child_ctx;
    }

    // (287:2) {:else}
    function create_else_block_5$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "ACCESS DENIED";
    			set_style(h1, "text-align", "center");
    			attr_dev(h1, "class", "svelte-qfxh6i");
    			add_location(h1, file$2, 287, 4, 10548);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_5$1.name,
    		type: "else",
    		source: "(287:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (150:2) {#if $logged == 'true'}
    function create_if_block$2(ctx) {
    	let show_if;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (dirty[0] & /*blocked, $id*/ 33792) show_if = null;
    		if (show_if == null) show_if = !!(/*blocked*/ ctx[10] && /*blocked*/ ctx[10].indexOf(/*$id*/ ctx[15].toString()) != -1);
    		if (show_if) return create_if_block_1$2;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type_1(ctx, [-1, -1]);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(150:2) {#if $logged == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (155:4) {:else}
    function create_else_block$2(ctx) {
    	let div0;
    	let show_if_4;
    	let t0;
    	let img;
    	let img_src_value;
    	let t1;
    	let div1;
    	let p0;
    	let t2;
    	let t3;
    	let t4;
    	let br;
    	let t5;
    	let show_if_3 = /*myFriends*/ ctx[12].indexOf(/*userId*/ ctx[9]) != -1;
    	let t6;
    	let show_if_2 = /*myFriends*/ ctx[12].indexOf(/*userId*/ ctx[9]) != -1;
    	let t7;
    	let div2;
    	let show_if_1;
    	let t8;
    	let show_if;
    	let t9;
    	let button;
    	let t11;
    	let div3;
    	let h10;
    	let t13;
    	let h11;
    	let p1;
    	let span0;
    	let t15;
    	let span1;
    	let t16;
    	let t17;
    	let span2;
    	let span3;
    	let t20;
    	let span4;
    	let t21;
    	let t22;
    	let span5;
    	let span6;
    	let t25;
    	let span7;
    	let t26;
    	let t27;
    	let div5;
    	let h12;
    	let t29;
    	let t30;
    	let div4;
    	let mounted;
    	let dispose;

    	function select_block_type_2(ctx, dirty) {
    		if (dirty[0] & /*myFriends, userId*/ 4608) show_if_4 = null;
    		if (show_if_4 == null) show_if_4 = !!(/*myFriends*/ ctx[12].indexOf(/*userId*/ ctx[9]) != -1);
    		if (show_if_4) return create_if_block_12$1;
    		return create_else_block_4$2;
    	}

    	let current_block_type = select_block_type_2(ctx, [-1, -1]);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = show_if_3 && create_if_block_11$1(ctx);
    	let if_block2 = show_if_2 && create_if_block_6$1(ctx);

    	function select_block_type_4(ctx, dirty) {
    		if (dirty[0] & /*myFriends, userId*/ 4608) show_if_1 = null;
    		if (show_if_1 == null) show_if_1 = !!(/*myFriends*/ ctx[12].indexOf(/*userId*/ ctx[9]) != -1);
    		if (show_if_1) return create_if_block_5$1;
    		return create_else_block_3$2;
    	}

    	let current_block_type_1 = select_block_type_4(ctx, [-1, -1]);
    	let if_block3 = current_block_type_1(ctx);

    	function select_block_type_5(ctx, dirty) {
    		if (dirty[0] & /*myBlocked, userId*/ 2560) show_if = null;
    		if (show_if == null) show_if = !!(/*myBlocked*/ ctx[11].indexOf(/*userId*/ ctx[9]) != -1);
    		if (show_if) return create_if_block_4$2;
    		return create_else_block_2$2;
    	}

    	let current_block_type_2 = select_block_type_5(ctx, [-1, -1]);
    	let if_block4 = current_block_type_2(ctx);
    	let if_block5 = /*matches*/ ctx[13].length == 0 && create_if_block_3$2(ctx);
    	let each_value = [.../*matches*/ ctx[13]].reverse();
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			if_block0.c();
    			t0 = space();
    			img = element("img");
    			t1 = space();
    			div1 = element("div");
    			p0 = element("p");
    			t2 = text(/*firstname*/ ctx[6]);
    			t3 = space();
    			t4 = text(/*lastname*/ ctx[7]);
    			br = element("br");
    			t5 = space();
    			if (if_block1) if_block1.c();
    			t6 = space();
    			if (if_block2) if_block2.c();
    			t7 = space();
    			div2 = element("div");
    			if_block3.c();
    			t8 = space();
    			if_block4.c();
    			t9 = space();
    			button = element("button");
    			button.textContent = "Invite to play 🏓";
    			t11 = space();
    			div3 = element("div");
    			h10 = element("h1");
    			h10.textContent = "SCORES";
    			t13 = space();
    			h11 = element("h1");
    			p1 = element("p");
    			span0 = element("span");
    			span0.textContent = "wins";
    			t15 = space();
    			span1 = element("span");
    			t16 = text(/*wins*/ ctx[4]);
    			t17 = space();
    			span2 = element("span");
    			span2.textContent = "| ";
    			span3 = element("span");
    			span3.textContent = "losses";
    			t20 = space();
    			span4 = element("span");
    			t21 = text(/*losses*/ ctx[1]);
    			t22 = space();
    			span5 = element("span");
    			span5.textContent = "| ";
    			span6 = element("span");
    			span6.textContent = "level";
    			t25 = space();
    			span7 = element("span");
    			t26 = text(/*level*/ ctx[0]);
    			t27 = space();
    			div5 = element("div");
    			h12 = element("h1");
    			h12.textContent = "MATCH HISTORY";
    			t29 = space();
    			if (if_block5) if_block5.c();
    			t30 = space();
    			div4 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(img, "class", "profile svelte-qfxh6i");
    			if (!src_url_equal(img.src, img_src_value = /*image_url*/ ctx[5])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "width", "200px");
    			attr_dev(img, "alt", "Default Profile");
    			add_location(img, file$2, 161, 8, 5958);
    			set_style(div0, "margin", "0 auto");
    			set_style(div0, "display", "block");
    			add_location(div0, file$2, 155, 6, 5689);
    			add_location(br, file$2, 173, 20, 6255);
    			set_style(p0, "text-align", "center");
    			set_style(p0, "color", "grey");
    			set_style(p0, "font-weight", "500");
    			set_style(p0, "font-style", "italic");
    			add_location(p0, file$2, 169, 8, 6115);
    			add_location(div1, file$2, 168, 6, 6101);
    			attr_dev(div2, "class", "buttons svelte-qfxh6i");
    			add_location(div2, file$2, 196, 6, 6975);
    			set_style(button, "width", "200px");
    			set_style(button, "background-color", "dodgerblue");
    			set_style(button, "padding", "10px");
    			set_style(button, "margin", "0 auto");
    			set_style(button, "display", "block");
    			set_style(button, "text-align", "center");
    			set_style(button, "color", "white");
    			add_location(button, file$2, 220, 6, 7870);
    			set_style(h10, "text-align", "center");
    			set_style(h10, "width", "400px");
    			set_style(h10, "background-color", "darkgrey");
    			set_style(h10, "color", "white");
    			set_style(h10, "text-decoration-line", "underline");
    			set_style(h10, "text-underline-offset", "20px");
    			attr_dev(h10, "class", "svelte-qfxh6i");
    			add_location(h10, file$2, 226, 8, 8185);
    			attr_dev(span0, "class", "sp1 svelte-qfxh6i");
    			add_location(span0, file$2, 233, 12, 8455);
    			attr_dev(span1, "class", "sp2 svelte-qfxh6i");
    			add_location(span1, file$2, 233, 42, 8485);
    			set_style(span2, "font-weight", "300");
    			add_location(span2, file$2, 234, 12, 8529);
    			attr_dev(span3, "class", "sp1 svelte-qfxh6i");
    			add_location(span3, file$2, 234, 53, 8570);
    			attr_dev(span4, "class", "sp2 svelte-qfxh6i");
    			add_location(span4, file$2, 236, 14, 8630);
    			set_style(span5, "font-weight", "300");
    			add_location(span5, file$2, 237, 12, 8676);
    			attr_dev(span6, "class", "sp1 svelte-qfxh6i");
    			add_location(span6, file$2, 237, 53, 8717);
    			attr_dev(span7, "class", "sp2 svelte-qfxh6i");
    			add_location(span7, file$2, 239, 14, 8776);
    			add_location(p1, file$2, 232, 10, 8439);
    			set_style(h11, "text-transform", "uppercase");
    			attr_dev(h11, "class", "svelte-qfxh6i");
    			add_location(h11, file$2, 231, 8, 8389);
    			attr_dev(div3, "class", "tb1 svelte-qfxh6i");
    			add_location(div3, file$2, 225, 6, 8159);
    			set_style(h12, "background-color", "darkgrey");
    			set_style(h12, "color", "white");
    			set_style(h12, "text-align", "center");
    			attr_dev(h12, "class", "svelte-qfxh6i");
    			add_location(h12, file$2, 245, 8, 8944);
    			attr_dev(div4, "class", "row svelte-qfxh6i");
    			attr_dev(div4, "id", "history");
    			add_location(div4, file$2, 256, 8, 9383);
    			set_style(div5, "width", "400px");
    			set_style(div5, "margin", "0 auto");
    			set_style(div5, "display", "block");
    			add_location(div5, file$2, 244, 6, 8878);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			if_block0.m(div0, null);
    			append_dev(div0, t0);
    			append_dev(div0, img);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p0);
    			append_dev(p0, t2);
    			append_dev(p0, t3);
    			append_dev(p0, t4);
    			append_dev(p0, br);
    			append_dev(div1, t5);
    			if (if_block1) if_block1.m(div1, null);
    			insert_dev(target, t6, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, div2, anchor);
    			if_block3.m(div2, null);
    			append_dev(div2, t8);
    			if_block4.m(div2, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h10);
    			append_dev(div3, t13);
    			append_dev(div3, h11);
    			append_dev(h11, p1);
    			append_dev(p1, span0);
    			append_dev(p1, t15);
    			append_dev(p1, span1);
    			append_dev(span1, t16);
    			append_dev(p1, t17);
    			append_dev(p1, span2);
    			append_dev(p1, span3);
    			append_dev(p1, t20);
    			append_dev(p1, span4);
    			append_dev(span4, t21);
    			append_dev(p1, t22);
    			append_dev(p1, span5);
    			append_dev(p1, span6);
    			append_dev(p1, t25);
    			append_dev(p1, span7);
    			append_dev(span7, t26);
    			insert_dev(target, t27, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, h12);
    			append_dev(div5, t29);
    			if (if_block5) if_block5.m(div5, null);
    			append_dev(div5, t30);
    			append_dev(div5, div4);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div4, null);
    			}

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*sendInvitation*/ ctx[16]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_2(ctx, dirty)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, t0);
    				}
    			}

    			if (dirty[0] & /*image_url*/ 32 && !src_url_equal(img.src, img_src_value = /*image_url*/ ctx[5])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*firstname*/ 64) set_data_dev(t2, /*firstname*/ ctx[6]);
    			if (dirty[0] & /*lastname*/ 128) set_data_dev(t4, /*lastname*/ ctx[7]);
    			if (dirty[0] & /*myFriends, userId*/ 4608) show_if_3 = /*myFriends*/ ctx[12].indexOf(/*userId*/ ctx[9]) != -1;

    			if (show_if_3) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_11$1(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*myFriends, userId*/ 4608) show_if_2 = /*myFriends*/ ctx[12].indexOf(/*userId*/ ctx[9]) != -1;

    			if (show_if_2) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_6$1(ctx);
    					if_block2.c();
    					if_block2.m(t7.parentNode, t7);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_4(ctx, dirty)) && if_block3) {
    				if_block3.p(ctx, dirty);
    			} else {
    				if_block3.d(1);
    				if_block3 = current_block_type_1(ctx);

    				if (if_block3) {
    					if_block3.c();
    					if_block3.m(div2, t8);
    				}
    			}

    			if (current_block_type_2 === (current_block_type_2 = select_block_type_5(ctx, dirty)) && if_block4) {
    				if_block4.p(ctx, dirty);
    			} else {
    				if_block4.d(1);
    				if_block4 = current_block_type_2(ctx);

    				if (if_block4) {
    					if_block4.c();
    					if_block4.m(div2, null);
    				}
    			}

    			if (dirty[0] & /*wins*/ 16) set_data_dev(t16, /*wins*/ ctx[4]);
    			if (dirty[0] & /*losses*/ 2) set_data_dev(t21, /*losses*/ ctx[1]);
    			if (dirty[0] & /*level*/ 1) set_data_dev(t26, /*level*/ ctx[0]);

    			if (/*matches*/ ctx[13].length == 0) {
    				if (if_block5) ; else {
    					if_block5 = create_if_block_3$2(ctx);
    					if_block5.c();
    					if_block5.m(div5, t30);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (dirty[0] & /*matches, username42*/ 8200) {
    				each_value = [.../*matches*/ ctx[13]].reverse();
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div4, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if_block0.d();
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (if_block1) if_block1.d();
    			if (detaching) detach_dev(t6);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div2);
    			if_block3.d();
    			if_block4.d();
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t27);
    			if (detaching) detach_dev(div5);
    			if (if_block5) if_block5.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(155:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (151:4) {#if blocked && blocked.indexOf($id.toString()) != -1}
    function create_if_block_1$2(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "ACCESS TO THIS PROFILE HAS BEEN DENIED BY THE OWNER";
    			set_style(h1, "text-align", "center");
    			attr_dev(h1, "class", "svelte-qfxh6i");
    			add_location(h1, file$2, 151, 6, 5567);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(151:4) {#if blocked && blocked.indexOf($id.toString()) != -1}",
    		ctx
    	});

    	return block;
    }

    // (159:8) {:else}
    function create_else_block_4$2(ctx) {
    	let h1;
    	let t;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t = text(/*username*/ ctx[2]);
    			attr_dev(h1, "class", "name svelte-qfxh6i");
    			set_style(h1, "color", "black");
    			add_location(h1, file$2, 159, 10, 5883);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*username*/ 4) set_data_dev(t, /*username*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_4$2.name,
    		type: "else",
    		source: "(159:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (157:8) {#if myFriends.indexOf(userId) != -1}
    function create_if_block_12$1(ctx) {
    	let h1;
    	let t;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t = text(/*username*/ ctx[2]);
    			attr_dev(h1, "class", "name svelte-qfxh6i");
    			set_style(h1, "color", "rgb(119, 158, 204)");
    			add_location(h1, file$2, 157, 10, 5790);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*username*/ 4) set_data_dev(t, /*username*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12$1.name,
    		type: "if",
    		source: "(157:8) {#if myFriends.indexOf(userId) != -1}",
    		ctx
    	});

    	return block;
    }

    // (176:8) {#if myFriends.indexOf(userId) != -1}
    function create_if_block_11$1(ctx) {
    	let p;
    	let t0;
    	let i;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("✔︎ ");
    			i = element("i");
    			i.textContent = "Friends";
    			add_location(i, file$2, 177, 15, 6417);
    			set_style(p, "text-align", "center");
    			set_style(p, "margin-bottom", "-10px");
    			set_style(p, "color", "royalblue");
    			add_location(p, file$2, 176, 10, 6331);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, i);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11$1.name,
    		type: "if",
    		source: "(176:8) {#if myFriends.indexOf(userId) != -1}",
    		ctx
    	});

    	return block;
    }

    // (182:6) {#if myFriends.indexOf(userId) != -1}
    function create_if_block_6$1(ctx) {
    	let div;
    	let h1;

    	function select_block_type_3(ctx, dirty) {
    		if (/*status*/ ctx[8] == 1) return create_if_block_7$1;
    		if (/*status*/ ctx[8] == 0) return create_if_block_8$1;
    		if (/*status*/ ctx[8] == 3) return create_if_block_9$1;
    		if (/*status*/ ctx[8] == 2) return create_if_block_10$1;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			if (if_block) if_block.c();
    			set_style(h1, "text-align", "center");
    			attr_dev(h1, "class", "svelte-qfxh6i");
    			add_location(h1, file$2, 183, 10, 6542);
    			add_location(div, file$2, 182, 8, 6526);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			if (if_block) if_block.m(h1, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type_3(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(h1, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6$1.name,
    		type: "if",
    		source: "(182:6) {#if myFriends.indexOf(userId) != -1}",
    		ctx
    	});

    	return block;
    }

    // (191:34) 
    function create_if_block_10$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "🟠 chatting";
    			attr_dev(span, "class", "sp2 svelte-qfxh6i");
    			add_location(span, file$2, 191, 14, 6871);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10$1.name,
    		type: "if",
    		source: "(191:34) ",
    		ctx
    	});

    	return block;
    }

    // (189:34) 
    function create_if_block_9$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "🔵 gaming";
    			attr_dev(span, "class", "sp2 svelte-qfxh6i");
    			add_location(span, file$2, 189, 14, 6787);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9$1.name,
    		type: "if",
    		source: "(189:34) ",
    		ctx
    	});

    	return block;
    }

    // (187:34) 
    function create_if_block_8$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "🔴 offline";
    			attr_dev(span, "class", "sp2 svelte-qfxh6i");
    			add_location(span, file$2, 187, 14, 6702);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8$1.name,
    		type: "if",
    		source: "(187:34) ",
    		ctx
    	});

    	return block;
    }

    // (185:12) {#if status == 1}
    function create_if_block_7$1(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "🟢 online";
    			attr_dev(span, "class", "sp2 svelte-qfxh6i");
    			add_location(span, file$2, 185, 14, 6618);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7$1.name,
    		type: "if",
    		source: "(185:12) {#if status == 1}",
    		ctx
    	});

    	return block;
    }

    // (204:8) {:else}
    function create_else_block_3$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "👍 Add as friend";
    			set_style(button, "width", "200px");
    			set_style(button, "text-align", "center");
    			set_style(button, "color", "black");
    			set_style(button, "border", "none");
    			set_style(button, "background-color", "rgb(221, 240, 247)");
    			attr_dev(button, "class", "friend svelte-qfxh6i");
    			add_location(button, file$2, 204, 10, 7287);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*friendRequest*/ ctx[19]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3$2.name,
    		type: "else",
    		source: "(204:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (198:8) {#if myFriends.indexOf(userId) != -1}
    function create_if_block_5$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "💨 Unfriend";
    			set_style(button, "width", "200px");
    			set_style(button, "color", "white");
    			set_style(button, "text-align", "center");
    			set_style(button, "background-color", "dimgrey");
    			attr_dev(button, "class", "friend svelte-qfxh6i");
    			add_location(button, file$2, 198, 10, 7053);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*unFriend*/ ctx[20]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5$1.name,
    		type: "if",
    		source: "(198:8) {#if myFriends.indexOf(userId) != -1}",
    		ctx
    	});

    	return block;
    }

    // (215:8) {:else}
    function create_else_block_2$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Block user ☢";
    			attr_dev(button, "class", "block svelte-qfxh6i");
    			add_location(button, file$2, 215, 10, 7733);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*blockUser*/ ctx[17]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$2.name,
    		type: "else",
    		source: "(215:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (211:8) {#if myBlocked.indexOf(userId) != -1}
    function create_if_block_4$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Unblock user 🔐";
    			attr_dev(button, "class", "block2 svelte-qfxh6i");
    			add_location(button, file$2, 211, 10, 7597);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*unBlockUser*/ ctx[18]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$2.name,
    		type: "if",
    		source: "(211:8) {#if myBlocked.indexOf(userId) != -1}",
    		ctx
    	});

    	return block;
    }

    // (249:8) {#if matches.length == 0}
    function create_if_block_3$2(ctx) {
    	let h4;

    	const block = {
    		c: function create() {
    			h4 = element("h4");
    			h4.textContent = "No match history to display yet";
    			set_style(h4, "text-align", "center");
    			set_style(h4, "display", "block");
    			set_style(h4, "margin", "0 auto");
    			set_style(h4, "color", "dimgrey");
    			set_style(h4, "font-style", "italic");
    			add_location(h4, file$2, 249, 10, 9099);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h4, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(249:8) {#if matches.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (272:12) {:else}
    function create_else_block_1$2(ctx) {
    	let div0;
    	let p0;
    	let t1;
    	let div1;
    	let p1;
    	let t2_value = /*match*/ ctx[29].winner.userName42 + "";
    	let t2;
    	let t3;
    	let div2;
    	let p2;
    	let t4_value = /*match*/ ctx[29].score + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			p0 = element("p");
    			p0.textContent = "Lost to";
    			t1 = space();
    			div1 = element("div");
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			p2 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			set_style(p0, "color", "red");
    			set_style(p0, "font-weight", "700");
    			add_location(p0, file$2, 273, 16, 10123);
    			attr_dev(div0, "class", "column");
    			set_style(div0, "float", "left");
    			set_style(div0, "width", "30%");
    			add_location(div0, file$2, 272, 14, 10053);
    			add_location(p1, file$2, 276, 16, 10280);
    			attr_dev(div1, "class", "column");
    			set_style(div1, "float", "left");
    			set_style(div1, "width", "30%");
    			add_location(div1, file$2, 275, 14, 10210);
    			add_location(p2, file$2, 279, 16, 10418);
    			attr_dev(div2, "class", "column");
    			set_style(div2, "float", "left");
    			set_style(div2, "width", "30%");
    			add_location(div2, file$2, 278, 14, 10348);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, p0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p1);
    			append_dev(p1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, p2);
    			append_dev(p2, t4);
    			append_dev(div2, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*matches*/ 8192 && t2_value !== (t2_value = /*match*/ ctx[29].winner.userName42 + "")) set_data_dev(t2, t2_value);
    			if (dirty[0] & /*matches*/ 8192 && t4_value !== (t4_value = /*match*/ ctx[29].score + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(272:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (259:12) {#if match.winner.userName42 == username42}
    function create_if_block_2$2(ctx) {
    	let div0;
    	let p0;
    	let t1;
    	let div1;
    	let p1;
    	let t2_value = /*match*/ ctx[29].loser.userName42 + "";
    	let t2;
    	let t3;
    	let div2;
    	let p2;
    	let t4_value = /*match*/ ctx[29].score + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			p0 = element("p");
    			p0.textContent = "Won to";
    			t1 = space();
    			div1 = element("div");
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			p2 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			set_style(p0, "color", "green");
    			set_style(p0, "font-weight", "700");
    			add_location(p0, file$2, 263, 16, 9682);
    			attr_dev(div0, "class", "column");
    			set_style(div0, "float", "left");
    			set_style(div0, "width", "30%");
    			set_style(div0, "display", "block");
    			set_style(div0, "margin", "0 auto");
    			add_location(div0, file$2, 259, 14, 9534);
    			add_location(p1, file$2, 266, 16, 9840);
    			attr_dev(div1, "class", "column");
    			set_style(div1, "float", "left");
    			set_style(div1, "width", "30%");
    			add_location(div1, file$2, 265, 14, 9770);
    			add_location(p2, file$2, 269, 16, 9977);
    			attr_dev(div2, "class", "column");
    			set_style(div2, "float", "left");
    			set_style(div2, "width", "30%");
    			add_location(div2, file$2, 268, 14, 9907);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, p0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p1);
    			append_dev(p1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, p2);
    			append_dev(p2, t4);
    			append_dev(div2, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*matches*/ 8192 && t2_value !== (t2_value = /*match*/ ctx[29].loser.userName42 + "")) set_data_dev(t2, t2_value);
    			if (dirty[0] & /*matches*/ 8192 && t4_value !== (t4_value = /*match*/ ctx[29].score + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(259:12) {#if match.winner.userName42 == username42}",
    		ctx
    	});

    	return block;
    }

    // (258:10) {#each [...matches].reverse() as match}
    function create_each_block$1(ctx) {
    	let if_block_anchor;

    	function select_block_type_6(ctx, dirty) {
    		if (/*match*/ ctx[29].winner.userName42 == /*username42*/ ctx[3]) return create_if_block_2$2;
    		return create_else_block_1$2;
    	}

    	let current_block_type = select_block_type_6(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_6(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(258:10) {#each [...matches].reverse() as match}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;

    	function select_block_type(ctx, dirty) {
    		if (/*$logged*/ ctx[14] == 'true') return create_if_block$2;
    		return create_else_block_5$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-qfxh6i");
    			add_location(main, file$2, 148, 0, 5469);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $cookie;
    	let $otherUser;
    	let $logged;
    	let $id;
    	validate_store(cookie, 'cookie');
    	component_subscribe($$self, cookie, $$value => $$invalidate(26, $cookie = $$value));
    	validate_store(otherUser, 'otherUser');
    	component_subscribe($$self, otherUser, $$value => $$invalidate(27, $otherUser = $$value));
    	validate_store(logged, 'logged');
    	component_subscribe($$self, logged, $$value => $$invalidate(14, $logged = $$value));
    	validate_store(id, 'id');
    	component_subscribe($$self, id, $$value => $$invalidate(15, $id = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('UserProfile', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let user;
    	let level;
    	let losses;
    	let username;
    	let username42;
    	let wins;
    	let image_url;
    	let firstname;
    	let lastname;
    	let status;
    	let userId;
    	let blocked = [];
    	let result;
    	let myBlocked = [];
    	let myFriends = [];
    	let mySelf;
    	let matches = [];
    	let myMatches;
    	let { socket = null } = $$props;

    	function sendInvitation() {
    		return __awaiter(this, void 0, void 0, function* () {
    			invitedPlayer.update(n => username42);
    			invitation.update(n => 'true');
    			window.location.replace(`${FRONTEND_URL}/#/pong`);
    		});
    	}

    	function blockUser() {
    		return __awaiter(this, void 0, void 0, function* () {
    			result = yield fetch(`${BACKEND_URL}/users/block`, {
    				method: 'POST',
    				headers: {
    					Authorization: 'Bearer ' + $cookie,
    					'Content-type': 'application/json; charset=UTF-8'
    				},
    				body: JSON.stringify({ id: userId })
    			}).then(response => result = response.json());

    			alert(username + ' has been blocked 🚫 🚫 🚫');
    			$$invalidate(11, myBlocked = [...myBlocked, userId]);
    		});
    	}

    	function unBlockUser() {
    		return __awaiter(this, void 0, void 0, function* () {
    			result = yield fetch(`${BACKEND_URL}/users/unblock`, {
    				method: 'POST',
    				headers: {
    					Authorization: 'Bearer ' + $cookie,
    					'Content-type': 'application/json; charset=UTF-8'
    				},
    				body: JSON.stringify({ id: userId })
    			}).then(response => result = response.json());

    			alert(username + ' has been unblocked ❎ ❎ ❎');
    			$$invalidate(11, myBlocked = myBlocked.filter(t => t != userId));
    			window.location.replace(`${FRONTEND_URL}/#/userprofile`);
    		});
    	}

    	function friendRequest() {
    		return __awaiter(this, void 0, void 0, function* () {
    			result = yield fetch(`${BACKEND_URL}/users/friends`, {
    				method: 'POST',
    				headers: {
    					Authorization: 'Bearer ' + $cookie,
    					'Content-type': 'application/json; charset=UTF-8'
    				},
    				body: JSON.stringify({ id: userId })
    			}).then(response => result = response.json());

    			$$invalidate(12, myFriends = [...myFriends, userId]);
    		});
    	}

    	function unFriend() {
    		return __awaiter(this, void 0, void 0, function* () {
    			result = yield fetch(`${BACKEND_URL}/users/unfriend`, {
    				method: 'POST',
    				headers: {
    					Authorization: 'Bearer ' + $cookie,
    					'Content-type': 'application/json; charset=UTF-8'
    				},
    				body: JSON.stringify({ id: userId })
    			}).then(response => result = response.json());

    			$$invalidate(12, myFriends = myFriends.filter(t => t != userId));
    		});
    	}

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		currentPage.update(n => '');

    		// if ($refresh != 'true') {
    		$$invalidate(21, socket = lookup(`${BACKEND_URL}/online`, { auth: { token: $cookie } }));

    		// }
    		refresh.update(n => 'true');

    		user = yield fetch(`${BACKEND_URL}/users/` + $otherUser, {
    			method: 'GET',
    			credentials: 'include',
    			headers: {
    				Authorization: 'Bearer ' + $cookie,
    				'Content-type': 'application/json; charset=UTF-8'
    			}
    		}).then(response => user = response.json());

    		$$invalidate(2, username = user.userName);
    		$$invalidate(9, userId = user.id.toString());
    		$$invalidate(6, firstname = user.firstName);
    		$$invalidate(7, lastname = user.lastName);
    		$$invalidate(4, wins = user.wins);
    		$$invalidate(1, losses = user.losses);
    		$$invalidate(0, level = user.level.toFixed(1));
    		$$invalidate(5, image_url = user.imageURL);
    		$$invalidate(8, status = user.state);
    		$$invalidate(10, blocked = user.blocked);
    		$$invalidate(3, username42 = user.userName42);

    		mySelf = yield fetch(`${BACKEND_URL}/auth/currentuser`, {
    			method: 'GET',
    			credentials: 'include',
    			headers: {
    				Authorization: 'Bearer ' + $cookie,
    				'Content-type': 'application/json; charset=UTF-8'
    			}
    		}).then(response => mySelf = response.json());

    		$$invalidate(11, myBlocked = mySelf.blocked);
    		$$invalidate(12, myFriends = mySelf.friends);

    		myMatches = yield fetch(`${BACKEND_URL}/matches/getForUser`, {
    			method: 'POST',
    			credentials: 'include',
    			body: JSON.stringify({ id: userId }),
    			headers: {
    				Authorization: 'Bearer ' + $cookie,
    				'Content-type': 'application/json; charset=UTF-8'
    			}
    		}).then(response => myMatches = response.json());

    		$$invalidate(13, matches = myMatches);
    	}));

    	onDestroy(() => __awaiter(void 0, void 0, void 0, function* () {
    		refresh.update(n => 'false');
    	}));

    	const writable_props = ['socket'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<UserProfile> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('socket' in $$props) $$invalidate(21, socket = $$props.socket);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		onMount,
    		otherUser,
    		logged,
    		cookie,
    		id,
    		invitedPlayer,
    		invitation,
    		currentPage,
    		refresh,
    		user,
    		level,
    		losses,
    		username,
    		username42,
    		wins,
    		image_url,
    		firstname,
    		lastname,
    		status,
    		userId,
    		blocked,
    		result,
    		myBlocked,
    		myFriends,
    		mySelf,
    		matches,
    		myMatches,
    		io: lookup,
    		onDestroy,
    		FRONTEND_URL,
    		BACKEND_URL,
    		socket,
    		sendInvitation,
    		blockUser,
    		unBlockUser,
    		friendRequest,
    		unFriend,
    		$cookie,
    		$otherUser,
    		$logged,
    		$id
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('user' in $$props) user = $$props.user;
    		if ('level' in $$props) $$invalidate(0, level = $$props.level);
    		if ('losses' in $$props) $$invalidate(1, losses = $$props.losses);
    		if ('username' in $$props) $$invalidate(2, username = $$props.username);
    		if ('username42' in $$props) $$invalidate(3, username42 = $$props.username42);
    		if ('wins' in $$props) $$invalidate(4, wins = $$props.wins);
    		if ('image_url' in $$props) $$invalidate(5, image_url = $$props.image_url);
    		if ('firstname' in $$props) $$invalidate(6, firstname = $$props.firstname);
    		if ('lastname' in $$props) $$invalidate(7, lastname = $$props.lastname);
    		if ('status' in $$props) $$invalidate(8, status = $$props.status);
    		if ('userId' in $$props) $$invalidate(9, userId = $$props.userId);
    		if ('blocked' in $$props) $$invalidate(10, blocked = $$props.blocked);
    		if ('result' in $$props) result = $$props.result;
    		if ('myBlocked' in $$props) $$invalidate(11, myBlocked = $$props.myBlocked);
    		if ('myFriends' in $$props) $$invalidate(12, myFriends = $$props.myFriends);
    		if ('mySelf' in $$props) mySelf = $$props.mySelf;
    		if ('matches' in $$props) $$invalidate(13, matches = $$props.matches);
    		if ('myMatches' in $$props) myMatches = $$props.myMatches;
    		if ('socket' in $$props) $$invalidate(21, socket = $$props.socket);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		level,
    		losses,
    		username,
    		username42,
    		wins,
    		image_url,
    		firstname,
    		lastname,
    		status,
    		userId,
    		blocked,
    		myBlocked,
    		myFriends,
    		matches,
    		$logged,
    		$id,
    		sendInvitation,
    		blockUser,
    		unBlockUser,
    		friendRequest,
    		unFriend,
    		socket
    	];
    }

    class UserProfile extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { socket: 21 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UserProfile",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get socket() {
    		throw new Error("<UserProfile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set socket(value) {
    		throw new Error("<UserProfile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/routes/Pong.svelte generated by Svelte v3.49.0 */
    const file$1 = "src/routes/Pong.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[57] = list[i];
    	return child_ctx;
    }

    // (513:0) {#if newInvite == 'true'}
    function create_if_block_19(ctx) {
    	let if_block_anchor;
    	let if_block = /*ingame*/ ctx[4] != 'true' && create_if_block_20(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*ingame*/ ctx[4] != 'true') {
    				if (if_block) ; else {
    					if_block = create_if_block_20(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_19.name,
    		type: "if",
    		source: "(513:0) {#if newInvite == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (514:2) {#if ingame != 'true'}
    function create_if_block_20(ctx) {
    	let h3;
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t0 = text("You received a new invitation to play !!");
    			br = element("br");
    			t1 = text("Refresh the page to see who\n      is challenging you");
    			add_location(br, file$1, 515, 46, 18283);
    			set_style(h3, "color", "slategrey");
    			set_style(h3, "text-align", "center");
    			add_location(h3, file$1, 514, 4, 18187);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t0);
    			append_dev(h3, br);
    			append_dev(h3, t1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_20.name,
    		type: "if",
    		source: "(514:2) {#if ingame != 'true'}",
    		ctx
    	});

    	return block;
    }

    // (521:0) {#if pause == 'true'}
    function create_if_block_18(ctx) {
    	let h2;
    	let t;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t = text(/*time*/ ctx[12]);
    			attr_dev(h2, "id", "countdown");
    			set_style(h2, "text-align", "center");
    			set_style(h2, "color", "darkred");
    			add_location(h2, file$1, 521, 2, 18394);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*time*/ 4096) set_data_dev(t, /*time*/ ctx[12]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_18.name,
    		type: "if",
    		source: "(521:0) {#if pause == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (699:0) {:else}
    function create_else_block_6(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "ACCESS DENIED";
    			set_style(h1, "color", "black");
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$1, 699, 2, 24253);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_6.name,
    		type: "else",
    		source: "(699:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (524:0) {#if $logged == 'true'}
    function create_if_block$1(ctx) {
    	let t0;
    	let t1;
    	let canvas_1;
    	let t2;
    	let if_block2_anchor;
    	let if_block0 = /*ingame*/ ctx[4] == 'watch' && create_if_block_16(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*ingame*/ ctx[4] == 'false') return create_if_block_10;
    		if (/*ingame*/ ctx[4] == 'waiting') return create_if_block_12;
    		if (/*ingame*/ ctx[4] == 'endgame') return create_if_block_14;
    		return create_else_block_4$1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block1 = current_block_type(ctx);

    	function select_block_type_5(ctx, dirty) {
    		if (/*ingame*/ ctx[4] == 'true') return create_if_block_1$1;
    		if (/*ingame*/ ctx[4] == 'false' && /*invited*/ ctx[9] == 'false') return create_if_block_8;
    	}

    	let current_block_type_1 = select_block_type_5(ctx);
    	let if_block2 = current_block_type_1 && current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if_block1.c();
    			t1 = space();
    			canvas_1 = element("canvas");
    			t2 = space();
    			if (if_block2) if_block2.c();
    			if_block2_anchor = empty$1();
    			attr_dev(canvas_1, "width", canvasWidth);
    			attr_dev(canvas_1, "height", canvasHeight);
    			attr_dev(canvas_1, "class", "svelte-1g0kr6r");
    			add_location(canvas_1, file$1, 605, 2, 21247);
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, canvas_1, anchor);
    			/*canvas_1_binding*/ ctx[33](canvas_1);
    			insert_dev(target, t2, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, if_block2_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*ingame*/ ctx[4] == 'watch') {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_16(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(t1.parentNode, t1);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_5(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if (if_block2) if_block2.d(1);
    				if_block2 = current_block_type_1 && current_block_type_1(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(canvas_1);
    			/*canvas_1_binding*/ ctx[33](null);
    			if (detaching) detach_dev(t2);

    			if (if_block2) {
    				if_block2.d(detaching);
    			}

    			if (detaching) detach_dev(if_block2_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(524:0) {#if $logged == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (525:2) {#if ingame == 'watch'}
    function create_if_block_16(ctx) {
    	let h2;
    	let t1;
    	let if_block_anchor;
    	let if_block = /*gameName*/ ctx[5] && create_if_block_17(ctx);

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Watching Live";
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty$1();
    			set_style(h2, "color", "black");
    			set_style(h2, "text-align", "center");
    			set_style(h2, "font-style", "italic");
    			add_location(h2, file$1, 525, 4, 18528);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*gameName*/ ctx[5]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_17(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_16.name,
    		type: "if",
    		source: "(525:2) {#if ingame == 'watch'}",
    		ctx
    	});

    	return block;
    }

    // (529:4) {#if gameName}
    function create_if_block_17(ctx) {
    	let h4;
    	let t;

    	const block = {
    		c: function create() {
    			h4 = element("h4");
    			t = text(/*gameName*/ ctx[5]);
    			set_style(h4, "color", "black");
    			set_style(h4, "text-align", "center");
    			add_location(h4, file$1, 529, 6, 18648);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h4, anchor);
    			append_dev(h4, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*gameName*/ 32) set_data_dev(t, /*gameName*/ ctx[5]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_17.name,
    		type: "if",
    		source: "(529:4) {#if gameName}",
    		ctx
    	});

    	return block;
    }

    // (584:2) {:else}
    function create_else_block_4$1(ctx) {
    	let div1;
    	let article;
    	let div0;
    	let strong0;
    	let t0_value = /*paddleLeft*/ ctx[13].score + "";
    	let t0;
    	let t1;
    	let t2;
    	let strong1;
    	let t3_value = /*paddleRight*/ ctx[14].score + "";
    	let t3;

    	function select_block_type_4(ctx, dirty) {
    		if (!/*playing*/ ctx[16]) return create_if_block_15;
    		return create_else_block_5;
    	}

    	let current_block_type = select_block_type_4(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			article = element("article");
    			div0 = element("div");
    			strong0 = element("strong");
    			t0 = text(t0_value);
    			t1 = space();
    			if_block.c();
    			t2 = space();
    			strong1 = element("strong");
    			t3 = text(t3_value);
    			set_style(strong0, "font-size", "7vw");
    			attr_dev(strong0, "class", "svelte-1g0kr6r");
    			add_location(strong0, file$1, 587, 10, 20741);
    			set_style(strong1, "font-size", "7vw");
    			attr_dev(strong1, "class", "svelte-1g0kr6r");
    			add_location(strong1, file$1, 598, 10, 21111);
    			set_style(div0, "margin-top", "15vw");
    			attr_dev(div0, "class", "svelte-1g0kr6r");
    			add_location(div0, file$1, 586, 8, 20699);
    			attr_dev(article, "class", "svelte-1g0kr6r");
    			add_location(article, file$1, 585, 6, 20681);
    			attr_dev(div1, "class", "game svelte-1g0kr6r");
    			add_location(div1, file$1, 584, 4, 20656);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, article);
    			append_dev(article, div0);
    			append_dev(div0, strong0);
    			append_dev(strong0, t0);
    			append_dev(div0, t1);
    			if_block.m(div0, null);
    			append_dev(div0, t2);
    			append_dev(div0, strong1);
    			append_dev(strong1, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*paddleLeft*/ 8192 && t0_value !== (t0_value = /*paddleLeft*/ ctx[13].score + "")) set_data_dev(t0, t0_value);

    			if (current_block_type === (current_block_type = select_block_type_4(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, t2);
    				}
    			}

    			if (dirty[0] & /*paddleRight*/ 16384 && t3_value !== (t3_value = /*paddleRight*/ ctx[14].score + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_4$1.name,
    		type: "else",
    		source: "(584:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (575:32) 
    function create_if_block_14(ctx) {
    	let div;
    	let h2;
    	let t0;
    	let br;
    	let t1;
    	let t2;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			t0 = text("Match is over");
    			br = element("br");
    			t1 = text("Thank you for participating");
    			t2 = space();
    			button = element("button");
    			button.textContent = "Play again";
    			add_location(br, file$1, 577, 21, 20465);
    			set_style(h2, "padding-top", "15vw");
    			set_style(h2, "color", "white");
    			set_style(h2, "font-size", "3vw");
    			add_location(h2, file$1, 576, 6, 20383);
    			attr_dev(button, "class", "play_again svelte-1g0kr6r");
    			add_location(button, file$1, 579, 6, 20517);
    			attr_dev(div, "class", "endgame svelte-1g0kr6r");
    			add_location(div, file$1, 575, 4, 20355);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(h2, t0);
    			append_dev(h2, br);
    			append_dev(h2, t1);
    			append_dev(div, t2);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*click_handler*/ ctx[32]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_14.name,
    		type: "if",
    		source: "(575:32) ",
    		ctx
    	});

    	return block;
    }

    // (558:32) 
    function create_if_block_12(ctx) {
    	let div;

    	function select_block_type_3(ctx, dirty) {
    		if (/*invitation_two*/ ctx[1] == 'true') return create_if_block_13;
    		return create_else_block_3$1;
    	}

    	let current_block_type = select_block_type_3(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "homescreen svelte-1g0kr6r");
    			add_location(div, file$1, 558, 4, 19647);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(558:32) ",
    		ctx
    	});

    	return block;
    }

    // (533:2) {#if ingame == 'false'}
    function create_if_block_10(ctx) {
    	let div;

    	function select_block_type_2(ctx, dirty) {
    		if (/*invited*/ ctx[9] == 'true') return create_if_block_11;
    		return create_else_block_2$1;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "homescreen svelte-1g0kr6r");
    			add_location(div, file$1, 533, 4, 18758);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(533:2) {#if ingame == 'false'}",
    		ctx
    	});

    	return block;
    }

    // (593:10) {:else}
    function create_else_block_5(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			set_style(button, "border", "none");
    			set_style(button, "background", "transparent");
    			attr_dev(button, "class", "svelte-1g0kr6r");
    			add_location(button, file$1, 593, 12, 20952);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*handleStart*/ ctx[22]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_5.name,
    		type: "else",
    		source: "(593:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (591:10) {#if !playing}
    function create_if_block_15(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Play";
    			attr_dev(button, "class", "svelte-1g0kr6r");
    			add_location(button, file$1, 591, 12, 20860);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*handleStart*/ ctx[22]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_15.name,
    		type: "if",
    		source: "(591:10) {#if !playing}",
    		ctx
    	});

    	return block;
    }

    // (568:6) {:else}
    function create_else_block_3$1(ctx) {
    	let h2;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Waiting for other players...";
    			t1 = space();
    			button = element("button");
    			button.textContent = "Cancel";
    			set_style(h2, "color", "white");
    			set_style(h2, "text-align", "center");
    			set_style(h2, "padding-top", "15vw");
    			set_style(h2, "font-size", "3vw");
    			add_location(h2, file$1, 568, 8, 20073);
    			attr_dev(button, "class", "cancel_button svelte-1g0kr6r");
    			add_location(button, file$1, 571, 8, 20212);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*cancelGame*/ ctx[24]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3$1.name,
    		type: "else",
    		source: "(568:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (560:6) {#if invitation_two == 'true'}
    function create_if_block_13(ctx) {
    	let h2;
    	let t0;
    	let span;
    	let t1;
    	let t2;
    	let t3;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			t0 = text("Waiting for ");
    			span = element("span");
    			t1 = text(/*invitedPlayer_two*/ ctx[0]);
    			t2 = text("'s response...");
    			t3 = space();
    			button = element("button");
    			button.textContent = "Cancel invitation";
    			set_style(span, "color", "dodgerblue");
    			add_location(span, file$1, 561, 22, 19817);
    			set_style(h2, "color", "white");
    			set_style(h2, "text-align", "center");
    			set_style(h2, "padding-top", "15vw");
    			set_style(h2, "font-size", "3vw");
    			add_location(h2, file$1, 560, 8, 19717);
    			attr_dev(button, "class", "cancel_game_button svelte-1g0kr6r");
    			add_location(button, file$1, 564, 8, 19922);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t0);
    			append_dev(h2, span);
    			append_dev(span, t1);
    			append_dev(h2, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*cancelGameInvitation*/ ctx[25]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*invitedPlayer_two*/ 1) set_data_dev(t1, /*invitedPlayer_two*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(560:6) {#if invitation_two == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (548:6) {:else}
    function create_else_block_2$1(ctx) {
    	let img;
    	let img_src_value;
    	let br0;
    	let br1;
    	let t0;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			button = element("button");
    			button.textContent = "▶︎";
    			attr_dev(img, "class", "play_svg svelte-1g0kr6r");
    			if (!src_url_equal(img.src, img_src_value = "img/play.svg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "play_logo");
    			add_location(img, file$1, 548, 8, 19350);
    			add_location(br0, file$1, 553, 10, 19495);
    			add_location(br1, file$1, 553, 16, 19501);
    			attr_dev(button, "class", "play svelte-1g0kr6r");
    			add_location(button, file$1, 554, 8, 19516);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", prevent_default(/*gameRequest*/ ctx[26]), false, true, false),
    					listen_dev(button, "click", prevent_default(/*gameRequest*/ ctx[26]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$1.name,
    		type: "else",
    		source: "(548:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (535:6) {#if invited == 'true'}
    function create_if_block_11(ctx) {
    	let div1;
    	let h2;
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let div0;
    	let button0;
    	let t4;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h2 = element("h2");
    			span = element("span");
    			t0 = text(/*invitingPlayer*/ ctx[8]);
    			t1 = text(" would\n            like to play pong");
    			t2 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Accept";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Decline";
    			set_style(span, "color", "rgb(224, 62, 62)");
    			add_location(span, file$1, 539, 12, 18969);
    			set_style(h2, "font-size", "3vw");
    			add_location(h2, file$1, 538, 10, 18930);
    			attr_dev(button0, "id", "accept");
    			attr_dev(button0, "class", "svelte-1g0kr6r");
    			add_location(button0, file$1, 543, 12, 19131);
    			attr_dev(button1, "id", "decline");
    			attr_dev(button1, "class", "svelte-1g0kr6r");
    			add_location(button1, file$1, 544, 12, 19218);
    			attr_dev(div0, "class", "my-buttons svelte-1g0kr6r");
    			add_location(div0, file$1, 542, 10, 19094);
    			set_style(div1, "text-align", "center");
    			set_style(div1, "color", "white");
    			set_style(div1, "display", "block");
    			set_style(div1, "padding-top", "10vw");
    			attr_dev(div1, "class", "svelte-1g0kr6r");
    			add_location(div1, file$1, 535, 8, 18821);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h2);
    			append_dev(h2, span);
    			append_dev(span, t0);
    			append_dev(h2, t1);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t4);
    			append_dev(div0, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", prevent_default(/*acceptInvite*/ ctx[27]), false, true, false),
    					listen_dev(button1, "click", prevent_default(/*declineInvite*/ ctx[28]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*invitingPlayer*/ 256) set_data_dev(t0, /*invitingPlayer*/ ctx[8]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(535:6) {#if invited == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (683:52) 
    function create_if_block_8(ctx) {
    	let h1;
    	let t1;
    	let if_block_anchor;

    	function select_block_type_8(ctx, dirty) {
    		if (/*games*/ ctx[2].length == 0) return create_if_block_9;
    		return create_else_block_1$1;
    	}

    	let current_block_type = select_block_type_8(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Watch live games";
    			t1 = space();
    			if_block.c();
    			if_block_anchor = empty$1();
    			attr_dev(h1, "class", "watchLive svelte-1g0kr6r");
    			add_location(h1, file$1, 683, 4, 23860);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_8(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(683:52) ",
    		ctx
    	});

    	return block;
    }

    // (607:2) {#if ingame == 'true'}
    function create_if_block_1$1(ctx) {
    	let div0;
    	let t0;
    	let button;
    	let t2;
    	let div1;
    	let mounted;
    	let dispose;

    	function select_block_type_6(ctx, dirty) {
    		if (/*theme*/ ctx[7] == 1) return create_if_block_6;
    		if (/*theme*/ ctx[7] == 2) return create_if_block_7;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type_6(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_7(ctx, dirty) {
    		if (/*myPaddle*/ ctx[6] == 'leftpaddle') return create_if_block_2$1;
    		if (/*myPaddle*/ ctx[6] == 'rightpaddle') return create_if_block_4$1;
    	}

    	let current_block_type_1 = select_block_type_7(ctx);
    	let if_block1 = current_block_type_1 && current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			if_block0.c();
    			t0 = space();
    			button = element("button");
    			button.textContent = "Forfeit the game";
    			t2 = space();
    			div1 = element("div");
    			if (if_block1) if_block1.c();
    			attr_dev(button, "class", "forfeit_button svelte-1g0kr6r");
    			add_location(button, file$1, 621, 6, 21844);
    			set_style(div0, "display", "flex");
    			set_style(div0, "margin", "0 auto");
    			set_style(div0, "width", "400px");
    			attr_dev(div0, "class", "svelte-1g0kr6r");
    			add_location(div0, file$1, 607, 4, 21348);
    			set_style(div1, "display", "block");
    			set_style(div1, "margin", "0 auto");
    			set_style(div1, "align-items", "center");
    			set_style(div1, "display", "flex");
    			set_style(div1, "align-items", "center");
    			set_style(div1, "margin-top", "50px");
    			set_style(div1, "margin-bottom", "50px");
    			set_style(div1, "text-align", "center");
    			set_style(div1, "width", "90vw");
    			set_style(div1, "height", "20vw");
    			set_style(div1, "border-top", "2px dotted black");
    			set_style(div1, "border-bottom", "2px dotted black");
    			attr_dev(div1, "class", "svelte-1g0kr6r");
    			add_location(div1, file$1, 624, 4, 21957);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			if_block0.m(div0, null);
    			append_dev(div0, t0);
    			append_dev(div0, button);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div1, anchor);
    			if (if_block1) if_block1.m(div1, null);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*forfeit*/ ctx[30]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_6(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div0, t0);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_7(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if (if_block1) if_block1.d(1);
    				if_block1 = current_block_type_1 && current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if_block0.d();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);

    			if (if_block1) {
    				if_block1.d();
    			}

    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(607:2) {#if ingame == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (691:4) {:else}
    function create_else_block_1$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*games*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*watchGame, games*/ 536870916) {
    				each_value = /*games*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(691:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (687:4) {#if games.length == 0}
    function create_if_block_9(ctx) {
    	let h3;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "No live games to watch at the moment";
    			attr_dev(h3, "id", "noLiveGames");
    			attr_dev(h3, "class", "svelte-1g0kr6r");
    			add_location(h3, file$1, 687, 6, 23950);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(687:4) {#if games.length == 0}",
    		ctx
    	});

    	return block;
    }

    // (692:6) {#each games as game}
    function create_each_block(ctx) {
    	let button;
    	let t0_value = /*game*/ ctx[57].name + "";
    	let t0;
    	let br0;
    	let br1;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[34](/*game*/ ctx[57]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text(t0_value);
    			br0 = element("br");
    			br1 = element("br");
    			t1 = text("🏓 🏓 🏓\n        ");
    			add_location(br0, file$1, 693, 21, 24172);
    			add_location(br1, file$1, 693, 27, 24178);
    			attr_dev(button, "class", "liveGame svelte-1g0kr6r");
    			add_location(button, file$1, 692, 8, 24077);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, br0);
    			append_dev(button, br1);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(click_handler_1), false, true, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*games*/ 4 && t0_value !== (t0_value = /*game*/ ctx[57].name + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(692:6) {#each games as game}",
    		ctx
    	});

    	return block;
    }

    // (617:6) {:else}
    function create_else_block$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Change theme";
    			attr_dev(button, "class", "theme_button3 svelte-1g0kr6r");
    			add_location(button, file$1, 617, 8, 21716);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*changeTheme*/ ctx[23]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(617:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (613:27) 
    function create_if_block_7(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Change theme";
    			attr_dev(button, "class", "theme_button2 svelte-1g0kr6r");
    			add_location(button, file$1, 613, 8, 21584);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*changeTheme*/ ctx[23]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(613:27) ",
    		ctx
    	});

    	return block;
    }

    // (609:6) {#if theme == 1}
    function create_if_block_6(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Change theme";
    			attr_dev(button, "class", "theme_button1 svelte-1g0kr6r");
    			add_location(button, file$1, 609, 8, 21438);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", prevent_default(/*changeTheme*/ ctx[23]), false, true, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(609:6) {#if theme == 1}",
    		ctx
    	});

    	return block;
    }

    // (659:42) 
    function create_if_block_4$1(ctx) {
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let t1;
    	let div1;
    	let img1;
    	let img1_src_value;
    	let if_block = /*gameName*/ ctx[5] && create_if_block_5(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			img0 = element("img");
    			t0 = space();
    			if (if_block) if_block.c();
    			t1 = space();
    			div1 = element("div");
    			img1 = element("img");
    			attr_dev(img0, "class", "player1_picture svelte-1g0kr6r");
    			if (!src_url_equal(img0.src, img0_src_value = /*otherPlayer*/ ctx[3].imageURL)) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "player1_profile_picture");
    			add_location(img0, file$1, 660, 10, 23122);
    			set_style(div0, "display", "block");
    			set_style(div0, "margin", "0 auto");
    			attr_dev(div0, "class", "svelte-1g0kr6r");
    			add_location(div0, file$1, 659, 8, 23067);
    			attr_dev(img1, "class", "player1_picture svelte-1g0kr6r");
    			if (!src_url_equal(img1.src, img1_src_value = /*$image_url*/ ctx[18])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "player1_profile_picture");
    			add_location(img1, file$1, 674, 10, 23640);
    			set_style(div1, "display", "block");
    			set_style(div1, "margin", "0 auto");
    			attr_dev(div1, "class", "svelte-1g0kr6r");
    			add_location(div1, file$1, 673, 8, 23585);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, img0);
    			insert_dev(target, t0, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*otherPlayer*/ 8 && !src_url_equal(img0.src, img0_src_value = /*otherPlayer*/ ctx[3].imageURL)) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (/*gameName*/ ctx[5]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_5(ctx);
    					if_block.c();
    					if_block.m(t1.parentNode, t1);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*$image_url*/ 262144 && !src_url_equal(img1.src, img1_src_value = /*$image_url*/ ctx[18])) {
    				attr_dev(img1, "src", img1_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(659:42) ",
    		ctx
    	});

    	return block;
    }

    // (637:6) {#if myPaddle == 'leftpaddle'}
    function create_if_block_2$1(ctx) {
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let t1;
    	let div1;
    	let img1;
    	let img1_src_value;
    	let if_block = /*gameName*/ ctx[5] && create_if_block_3$1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			img0 = element("img");
    			t0 = space();
    			if (if_block) if_block.c();
    			t1 = space();
    			div1 = element("div");
    			img1 = element("img");
    			attr_dev(img0, "class", "player1_picture svelte-1g0kr6r");
    			if (!src_url_equal(img0.src, img0_src_value = /*$image_url*/ ctx[18])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "player1_profile_picture");
    			add_location(img0, file$1, 638, 10, 22358);
    			set_style(div0, "display", "block");
    			set_style(div0, "margin", "0 auto");
    			attr_dev(div0, "class", "svelte-1g0kr6r");
    			add_location(div0, file$1, 637, 8, 22303);
    			attr_dev(img1, "class", "player1_picture svelte-1g0kr6r");
    			if (!src_url_equal(img1.src, img1_src_value = /*otherPlayer*/ ctx[3].imageURL)) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "player1_profile_picture");
    			add_location(img1, file$1, 652, 10, 22866);
    			set_style(div1, "display", "block");
    			set_style(div1, "margin", "0 auto");
    			attr_dev(div1, "class", "svelte-1g0kr6r");
    			add_location(div1, file$1, 651, 8, 22811);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, img0);
    			insert_dev(target, t0, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$image_url*/ 262144 && !src_url_equal(img0.src, img0_src_value = /*$image_url*/ ctx[18])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (/*gameName*/ ctx[5]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_3$1(ctx);
    					if_block.c();
    					if_block.m(t1.parentNode, t1);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*otherPlayer*/ 8 && !src_url_equal(img1.src, img1_src_value = /*otherPlayer*/ ctx[3].imageURL)) {
    				attr_dev(img1, "src", img1_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(637:6) {#if myPaddle == 'leftpaddle'}",
    		ctx
    	});

    	return block;
    }

    // (667:8) {#if gameName}
    function create_if_block_5(ctx) {
    	let h3;

    	let t_value = (/*gameName*/ ctx[5].split(' ')[0] == /*$username42*/ ctx[19]
    	? /*gameName*/ ctx[5].split(' ')[2] + ' - ' + /*gameName*/ ctx[5].split(' ')[0]
    	: /*gameName*/ ctx[5].split(' ')[0] + ' - ' + /*gameName*/ ctx[5].split(' ')[2]) + "";

    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(t_value);
    			set_style(h3, "text-align", "center");
    			set_style(h3, "color", "black");
    			add_location(h3, file$1, 667, 10, 23305);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*gameName, $username42*/ 524320 && t_value !== (t_value = (/*gameName*/ ctx[5].split(' ')[0] == /*$username42*/ ctx[19]
    			? /*gameName*/ ctx[5].split(' ')[2] + ' - ' + /*gameName*/ ctx[5].split(' ')[0]
    			: /*gameName*/ ctx[5].split(' ')[0] + ' - ' + /*gameName*/ ctx[5].split(' ')[2]) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(667:8) {#if gameName}",
    		ctx
    	});

    	return block;
    }

    // (645:8) {#if gameName}
    function create_if_block_3$1(ctx) {
    	let h3;

    	let t_value = (/*gameName*/ ctx[5].split(' ')[0] == /*$username42*/ ctx[19]
    	? /*gameName*/ ctx[5].split(' ')[0] + ' - ' + /*gameName*/ ctx[5].split(' ')[2]
    	: /*gameName*/ ctx[5].split(' ')[2] + ' - ' + /*gameName*/ ctx[5].split(' ')[0]) + "";

    	let t;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t = text(t_value);
    			set_style(h3, "text-align", "center");
    			set_style(h3, "color", "black");
    			add_location(h3, file$1, 645, 10, 22531);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*gameName, $username42*/ 524320 && t_value !== (t_value = (/*gameName*/ ctx[5].split(' ')[0] == /*$username42*/ ctx[19]
    			? /*gameName*/ ctx[5].split(' ')[0] + ' - ' + /*gameName*/ ctx[5].split(' ')[2]
    			: /*gameName*/ ctx[5].split(' ')[2] + ' - ' + /*gameName*/ ctx[5].split(' ')[0]) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(645:8) {#if gameName}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let if_block2_anchor;
    	let mounted;
    	let dispose;
    	let if_block0 = /*newInvite*/ ctx[10] == 'true' && create_if_block_19(ctx);
    	let if_block1 = /*pause*/ ctx[11] == 'true' && create_if_block_18(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*$logged*/ ctx[17] == 'true') return create_if_block$1;
    		return create_else_block_6;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block2 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			if_block2.c();
    			if_block2_anchor = empty$1();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if_block2.m(target, anchor);
    			insert_dev(target, if_block2_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(document.body, "keydown", /*handleKeydown*/ ctx[20], false, false, false),
    					listen_dev(document.body, "keyup", /*handleKeyup*/ ctx[21], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*newInvite*/ ctx[10] == 'true') {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_19(ctx);
    					if_block0.c();
    					if_block0.m(t1.parentNode, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*pause*/ ctx[11] == 'true') {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_18(ctx);
    					if_block1.c();
    					if_block1.m(t2.parentNode, t2);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t2);
    			if_block2.d(detaching);
    			if (detaching) detach_dev(if_block2_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const canvasWidth = 500;
    const canvasHeight = 320;
    const padding = 10;
    const margin = 5;
    const border = 5;
    const puckRadius = 7;
    const paddleWidth = 15;
    const paddleHeight = 70;

    function puckshow(context, ball) {
    	const { x, y, r, startAngle, endAngle } = ball;
    	context.arc(x, y, r, startAngle, endAngle);
    	context.fill();
    }

    function paddleshow(context, paddle) {
    	const { x, y, w, h } = paddle;
    	context.fillRect(x, y, w, h);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $invitedPlayer;
    	let $invitation;
    	let $cookie;
    	let $id;
    	let $logged;
    	let $image_url;
    	let $username42;
    	validate_store(invitedPlayer, 'invitedPlayer');
    	component_subscribe($$self, invitedPlayer, $$value => $$invalidate(43, $invitedPlayer = $$value));
    	validate_store(invitation, 'invitation');
    	component_subscribe($$self, invitation, $$value => $$invalidate(44, $invitation = $$value));
    	validate_store(cookie, 'cookie');
    	component_subscribe($$self, cookie, $$value => $$invalidate(45, $cookie = $$value));
    	validate_store(id, 'id');
    	component_subscribe($$self, id, $$value => $$invalidate(46, $id = $$value));
    	validate_store(logged, 'logged');
    	component_subscribe($$self, logged, $$value => $$invalidate(17, $logged = $$value));
    	validate_store(image_url, 'image_url');
    	component_subscribe($$self, image_url, $$value => $$invalidate(18, $image_url = $$value));
    	validate_store(username42, 'username42');
    	component_subscribe($$self, username42, $$value => $$invalidate(19, $username42 = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Pong', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	class Puck {
    		constructor({ x, y, r, speed = 3 }) {
    			this.x = x;
    			this.x0 = x;
    			this.y = y;
    			this.y0 = y;
    			this.r = r;
    			this.startAngle = 0;
    			this.endAngle = Math.PI * 2;
    			this.dx = 0;
    			this.dy = 0;
    			this.initialSpeed = speed;
    			this.speed = speed;
    		}
    	}

    	class Paddle {
    		constructor({ x, y, w, h, keys, speed = 3.5, score = 0 }) {
    			this.x = x;
    			this.y = y;
    			this.w = w;
    			this.h = h;
    			this.y0 = y;
    			this.dy = 0;
    			this.speed = speed;
    			this.keys = keys;
    			this.score = score;
    		}
    	}

    	let { socket = null } = $$props;
    	let invitedPlayer_two;
    	let invitation_two;
    	let games = [];
    	let otherPlayer;
    	let currentGame;
    	let ingame = 'false';
    	let gameId;
    	let gameName;
    	let scoreRight;
    	let scoreLeft;
    	let myPaddle = '';
    	let theme = 1;
    	let invitingPlayer;
    	let invited = 'false';
    	let allGames;
    	let newInvite = 'false';
    	let pause = 'false';
    	let time = 'Game paused, 10 seconds remaining';
    	let retour = 'false';
    	const width = canvasWidth - margin * 2;
    	const height = canvasHeight - margin * 2;

    	let puck = new Puck({
    			x: width / 2,
    			y: height / 2,
    			r: puckRadius
    		});

    	let paddleLeft = new Paddle({
    			x: padding,
    			y: height / 2 - paddleHeight / 2,
    			w: paddleWidth,
    			h: paddleHeight,
    			keys: { KeyW: -1, KeyS: 1 }
    		});

    	let paddleRight = new Paddle({
    			x: width - padding - paddleWidth,
    			y: height / 2 - paddleHeight / 2,
    			w: paddleWidth,
    			h: paddleHeight,
    			keys: { ArrowUp: -1, ArrowDown: 1 }
    		});

    	let canvas, context;
    	let playing, animationId;

    	onMount(() => {
    		context = canvas.getContext('2d');
    		context.translate(margin, margin);

    		if (ingame == 'true') {
    			draw();
    		}

    		return () => {
    			cancelAnimationFrame(animationId);
    		};
    	});

    	const draw = () => {
    		context.clearRect(0, 0, width, height);

    		if (theme == 1) {
    			context.strokeStyle = 'hsl(0, 0%,50%)';
    		} else if (theme == 2) {
    			context.strokeStyle = 'white';
    		} else {
    			context.strokeStyle = 'white';
    		}

    		context.lineWidth = border * 2;
    		context.strokeRect(500, 500, width, height);

    		if (theme == 1) {
    			context.fillStyle = 'black';
    		} else if (theme == 2) {
    			context.fillStyle = 'slategrey';
    		} else {
    			context.fillStyle = 'darkred';
    		}

    		context.fillRect(0, 0, width, height);
    		context.lineWidth = border;
    		context.beginPath();
    		context.moveTo(width / 2, 0);
    		context.lineTo(width / 2, height);
    		context.closePath();
    		context.stroke();
    		context.fillStyle = 'hsl(0, 0%, 100%)';
    		context.fillStyle = 'white';
    		puckshow(context, puck);

    		if (theme == 1) {
    			context.fillStyle = 'white';
    		} else if (theme == 2) {
    			context.fillStyle = 'white';
    		} else {
    			context.fillStyle = 'white';
    		}

    		paddleshow(context, paddleLeft);
    		paddleshow(context, paddleRight);
    	};

    	const handleKeydown = e => {
    		if (!myPaddle) {
    			return;
    		}

    		if (e.keyCode == 40) {
    			socket.emit('keyDown', { gameId, pos: myPaddle, dy: 1 });
    		}

    		if (e.keyCode == 38) {
    			socket.emit('keyDown', { gameId, pos: myPaddle, dy: -1 });
    		}
    	};

    	const handleKeyup = e => {
    		if (!myPaddle) {
    			return;
    		}

    		if (e.keyCode == 40) {
    			socket.emit('keyUp', { gameId, pos: myPaddle, dy: 1 });
    		}

    		if (e.keyCode == 38) {
    			socket.emit('keyUp', { gameId, pos: myPaddle, dy: -1 });
    		}
    	};

    	const handleStart = () => {
    		if (playing) return;
    		socket.emit('ready', { gameId });
    		$$invalidate(16, playing = true);
    	};

    	function changeTheme() {
    		theme == 3
    		? $$invalidate(7, theme = 1)
    		: $$invalidate(7, theme += 1);

    		draw();
    	}

    	function cancelGame() {
    		$$invalidate(4, ingame = 'false');
    		socket.emit('cancelGame');
    	}

    	function cancelGameInvitation() {
    		$$invalidate(4, ingame = 'false');
    		socket.emit('cancelInvite');
    		invitation.update(n => '');
    		invitedPlayer.update(n => '');
    	}

    	function initGame(game) {
    		puck = game.ball;
    		$$invalidate(13, paddleLeft = game.leftPaddle);
    		$$invalidate(14, paddleRight = game.rightPaddle);
    		scoreLeft = game.leftPaddle.score;
    		scoreRight = game.rightPaddle.score;
    	}

    	function declinedResponse() {
    		alert('Your invitaton has been declined');
    		$$invalidate(4, ingame = 'false');
    		$$invalidate(9, invited = 'false');
    		invitation.update(n => '');
    	}

    	function gameRequest() {
    		return __awaiter(this, void 0, void 0, function* () {
    			$$invalidate(4, ingame = 'waiting');
    			socket.emit('waiting');
    		});
    	}

    	function acceptInvite() {
    		return __awaiter(this, void 0, void 0, function* () {
    			socket.emit('acceptInvite');
    			$$invalidate(9, invited = 'false');
    		});
    	}

    	function declineInvite() {
    		socket.emit('declineInvite');
    		$$invalidate(9, invited = 'false');
    	}

    	function watchGame(game) {
    		return __awaiter(this, void 0, void 0, function* () {
    			currentGame = game;
    			socket.emit('watchGame', { gameId: game.id });
    		});
    	}

    	function forfeit() {
    		socket.emit('forfeit', { gameId });
    		context.clearRect(0, 0, width, height);
    		$$invalidate(4, ingame = 'false');
    		$$invalidate(16, playing = false);
    		alert('⚠️ Your abandon will be counted as a loss');
    	}

    	function countdownTimer() {
    		retour = 'false';
    		var timeleft = 9;

    		var downloadTimer = setInterval(
    			function () {
    				return __awaiter(this, void 0, void 0, function* () {
    					if (retour == 'true') {
    						timeleft = 9;
    						return;
    					}

    					if (timeleft <= 0) {
    						clearInterval(downloadTimer);
    						$$invalidate(12, time = '0');
    						$$invalidate(12, time);
    						$$invalidate(11, pause = 'false');

    						if (myPaddle) {
    							$$invalidate(4, ingame = 'endgame');
    							socket.emit('wonByTimeOut', { gameId });
    						}

    						if (!myPaddle) {
    							alert('Match is over because one of the two players disconnected');

    							allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    								method: 'GET',
    								credentials: 'include',
    								headers: {
    									Authorization: 'Bearer ' + $cookie,
    									'Content-type': 'application/json; charset=UTF-8'
    								}
    							}).then(response => allGames = response.json());

    							$$invalidate(2, games = allGames);
    							context.clearRect(0, 0, width, height);
    							$$invalidate(4, ingame = 'false');
    							$$invalidate(16, playing = false);
    							location.reload();
    						}

    						return;
    					} else {
    						$$invalidate(12, time = 'Game paused, ' + timeleft + ' seconds remaining');
    						$$invalidate(12, time);
    					}

    					timeleft -= 1;
    				});
    			},
    			1000
    		);
    	}

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		currentPage.update(n => 'pong');

    		if ($logged == 'true') {
    			$$invalidate(31, socket = lookup(`${BACKEND_URL}/pong`, { auth: { token: $cookie } }));

    			socket.on('invitationRequest', player => {
    				$$invalidate(8, invitingPlayer = player);
    				$$invalidate(9, invited = 'true');
    				alert('You received a new invitation to play Pong!');
    			});

    			socket.on('liveInvitationRequest', player => {
    				$$invalidate(8, invitingPlayer = player);
    				$$invalidate(10, newInvite = 'true');
    			});

    			socket.on('foundPeer', game => __awaiter(void 0, void 0, void 0, function* () {
    				gameId = game.game.id;
    				$$invalidate(5, gameName = game.game.name);

    				$$invalidate(6, myPaddle = game.game.leftPaddle.userId == $id
    				? 'leftpaddle'
    				: 'rightpaddle');

    				$$invalidate(3, otherPlayer = yield fetch(`${BACKEND_URL}/users/` + game.opponentId, {
    					method: 'GET',
    					credentials: 'include',
    					headers: {
    						Authorization: 'Bearer ' + $cookie,
    						'Content-type': 'application/json; charset=UTF-8'
    					}
    				}).then(response => $$invalidate(3, otherPlayer = response.json())));

    				initGame(game.game);
    				$$invalidate(4, ingame = 'true');
    				draw();
    			}));

    			socket.on('updateGame', game => __awaiter(void 0, void 0, void 0, function* () {
    				if (ingame == 'true' || ingame == 'watch') {
    					$$invalidate(5, gameName = game.name);
    					puck = game.ball;
    					$$invalidate(13, paddleLeft = game.leftPaddle);
    					$$invalidate(14, paddleRight = game.rightPaddle);
    					draw();
    					scoreLeft = game.leftPaddle.score;
    					scoreRight = game.rightPaddle.score;

    					if (scoreLeft >= 3 || scoreRight >= 3) {
    						scoreLeft >= 3
    						? scoreLeft = scoreLeft += 1
    						: scoreRight += 1;

    						$$invalidate(16, playing = false);
    						context.clearRect(0, 0, width, height);

    						if (ingame == 'watch') {
    							alert('Match is over, you will be redirected to the lobby');
    							context.clearRect(0, 0, width, height);

    							allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    								method: 'GET',
    								credentials: 'include',
    								headers: {
    									Authorization: 'Bearer ' + $cookie,
    									'Content-type': 'application/json; charset=UTF-8'
    								}
    							}).then(response => allGames = response.json());

    							$$invalidate(2, games = allGames);
    							$$invalidate(4, ingame = 'false');
    							$$invalidate(16, playing = false);
    							window.location.replace(`${FRONTEND_URL}/#/pong`);
    							return;
    						}

    						$$invalidate(4, ingame = 'endgame');

    						if (myPaddle == 'rightpaddle' && scoreRight >= 3) {
    							alert('🍾 Congratulations for you victory, your level is now higher!');

    							allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    								method: 'GET',
    								credentials: 'include',
    								headers: {
    									Authorization: 'Bearer ' + $cookie,
    									'Content-type': 'application/json; charset=UTF-8'
    								}
    							}).then(response => allGames = response.json());

    							$$invalidate(2, games = allGames);
    						} else if (myPaddle == 'leftpaddle' && scoreLeft >= 3) {
    							alert('🍾 Congratulations for you victory, your level is now higher!');

    							allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    								method: 'GET',
    								credentials: 'include',
    								headers: {
    									Authorization: 'Bearer ' + $cookie,
    									'Content-type': 'application/json; charset=UTF-8'
    								}
    							}).then(response => allGames = response.json());

    							$$invalidate(2, games = allGames);
    						} else {
    							alert("🦆 Too bad! You'll play better next time!");

    							allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    								method: 'GET',
    								credentials: 'include',
    								headers: {
    									Authorization: 'Bearer ' + $cookie,
    									'Content-type': 'application/json; charset=UTF-8'
    								}
    							}).then(response => allGames = response.json());

    							$$invalidate(2, games = allGames);
    						}

    						scoreLeft = 0;
    						scoreRight = 0;
    					}
    				}
    			}));

    			socket.on('acceptInviteResponse', message => {
    				if (message == 'noGame') {
    					alert('This game has been canceled');
    				}
    			});

    			socket.on('pausedGame', () => {
    				$$invalidate(11, pause = 'true');
    				countdownTimer();
    			});

    			socket.on('comeBack', game => __awaiter(void 0, void 0, void 0, function* () {
    				retour = 'true';
    				gameId = game.game.id;

    				$$invalidate(6, myPaddle = game.game.leftPaddle.userId == $id
    				? 'leftpaddle'
    				: 'rightpaddle');

    				$$invalidate(3, otherPlayer = yield fetch(`${BACKEND_URL}/users/` + game.opponentId, {
    					method: 'GET',
    					credentials: 'include',
    					headers: {
    						Authorization: 'Bearer ' + $cookie,
    						'Content-type': 'application/json; charset=UTF-8'
    					}
    				}).then(response => $$invalidate(3, otherPlayer = response.json())));

    				initGame(game.game);
    				$$invalidate(4, ingame = 'true');
    				socket.emit('ready', { gameId });
    				$$invalidate(16, playing = true);
    				draw();
    			}));

    			socket.on('wonByTimeOutResponse', () => {
    				context.clearRect(0, 0, width, height);
    				$$invalidate(4, ingame = 'endgame');
    				$$invalidate(16, playing = false);
    				alert('You opponent forfeited the match by disconnecting');
    			});

    			socket.on('resumeGame', () => {
    				$$invalidate(11, pause = 'false');
    				retour = 'true';
    				$$invalidate(12, time = '10');
    			});

    			allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    				method: 'GET',
    				credentials: 'include',
    				headers: {
    					Authorization: 'Bearer ' + $cookie,
    					'Content-type': 'application/json; charset=UTF-8'
    				}
    			}).then(response => allGames = response.json());

    			$$invalidate(2, games = allGames);

    			socket.on('winByForfeit', () => {
    				$$invalidate(4, ingame = 'endgame');
    				$$invalidate(16, playing = false);
    				context.clearRect(0, 0, width, height);
    				alert('Your opponent forfeited the game. You are the winner');
    			});

    			socket.on('winByDisconnect', () => {
    				$$invalidate(4, ingame = 'endgame');
    				$$invalidate(16, playing = false);
    				alert('Your opponnent disconnected. You are the winner');
    				context.clearRect(0, 0, width, height);
    			});

    			socket.on('declinedResponse', () => {
    				declinedResponse();
    			});

    			socket.on('watchGameResponse', message => __awaiter(void 0, void 0, void 0, function* () {
    				if (message == 'noGame') {
    					alert('Ne game is no more available');

    					allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    						method: 'GET',
    						credentials: 'include',
    						headers: {
    							Authorization: 'Bearer ' + $cookie,
    							'Content-type': 'application/json; charset=UTF-8'
    						}
    					}).then(response => allGames = response.json());

    					$$invalidate(2, games = allGames);
    				}

    				if (message == 'goWatchGame') {
    					$$invalidate(4, ingame = 'watch');
    					draw();
    					$$invalidate(16, playing = true);
    				}
    			}));

    			socket.on('forfeitedGame', () => __awaiter(void 0, void 0, void 0, function* () {
    				$$invalidate(16, playing = false);
    				$$invalidate(4, ingame = 'false');
    				context.clearRect(0, 0, width, height);
    				alert('Game is over because one of the players forfeited');

    				allGames = yield fetch(`${BACKEND_URL}/pong/games`, {
    					method: 'GET',
    					credentials: 'include',
    					headers: {
    						Authorization: 'Bearer ' + $cookie,
    						'Content-type': 'application/json; charset=UTF-8'
    					}
    				}).then(response => allGames = response.json());

    				$$invalidate(2, games = allGames);
    			}));

    			if ($invitation == 'true') {
    				socket.emit('inviteToGame', { userName42: $invitedPlayer });
    				$$invalidate(1, invitation_two = $invitation);
    				$$invalidate(0, invitedPlayer_two = $invitedPlayer);
    				invitation.update(n => 'false');
    				invitedPlayer.update(n => '');
    				$$invalidate(4, ingame = 'waiting');
    			}

    			socket.on('samePlayer', () => {
    				$$invalidate(4, ingame = 'false');
    				alert("⚠️ You are already logged on another device. You can't play Pong on two devices at once");
    			});
    		}
    	}));

    	onDestroy(() => __awaiter(void 0, void 0, void 0, function* () {
    		socket.emit('byebye');
    	}));

    	const writable_props = ['socket'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Pong> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(4, ingame = 'false');

    	function canvas_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			canvas = $$value;
    			$$invalidate(15, canvas);
    		});
    	}

    	const click_handler_1 = game => watchGame(game);

    	$$self.$$set = $$props => {
    		if ('socket' in $$props) $$invalidate(31, socket = $$props.socket);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		image_url,
    		username42,
    		id,
    		cookie,
    		currentPage,
    		invitedPlayer,
    		invitation,
    		logged,
    		io: lookup,
    		onMount,
    		onDestroy,
    		FRONTEND_URL,
    		BACKEND_URL,
    		Puck,
    		Paddle,
    		socket,
    		invitedPlayer_two,
    		invitation_two,
    		games,
    		otherPlayer,
    		currentGame,
    		ingame,
    		gameId,
    		gameName,
    		scoreRight,
    		scoreLeft,
    		myPaddle,
    		theme,
    		invitingPlayer,
    		invited,
    		allGames,
    		newInvite,
    		pause,
    		time,
    		retour,
    		canvasWidth,
    		canvasHeight,
    		padding,
    		margin,
    		border,
    		width,
    		height,
    		puckRadius,
    		paddleWidth,
    		paddleHeight,
    		puck,
    		paddleLeft,
    		paddleRight,
    		canvas,
    		context,
    		playing,
    		animationId,
    		draw,
    		puckshow,
    		paddleshow,
    		handleKeydown,
    		handleKeyup,
    		handleStart,
    		changeTheme,
    		cancelGame,
    		cancelGameInvitation,
    		initGame,
    		declinedResponse,
    		gameRequest,
    		acceptInvite,
    		declineInvite,
    		watchGame,
    		forfeit,
    		countdownTimer,
    		$invitedPlayer,
    		$invitation,
    		$cookie,
    		$id,
    		$logged,
    		$image_url,
    		$username42
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('socket' in $$props) $$invalidate(31, socket = $$props.socket);
    		if ('invitedPlayer_two' in $$props) $$invalidate(0, invitedPlayer_two = $$props.invitedPlayer_two);
    		if ('invitation_two' in $$props) $$invalidate(1, invitation_two = $$props.invitation_two);
    		if ('games' in $$props) $$invalidate(2, games = $$props.games);
    		if ('otherPlayer' in $$props) $$invalidate(3, otherPlayer = $$props.otherPlayer);
    		if ('currentGame' in $$props) currentGame = $$props.currentGame;
    		if ('ingame' in $$props) $$invalidate(4, ingame = $$props.ingame);
    		if ('gameId' in $$props) gameId = $$props.gameId;
    		if ('gameName' in $$props) $$invalidate(5, gameName = $$props.gameName);
    		if ('scoreRight' in $$props) scoreRight = $$props.scoreRight;
    		if ('scoreLeft' in $$props) scoreLeft = $$props.scoreLeft;
    		if ('myPaddle' in $$props) $$invalidate(6, myPaddle = $$props.myPaddle);
    		if ('theme' in $$props) $$invalidate(7, theme = $$props.theme);
    		if ('invitingPlayer' in $$props) $$invalidate(8, invitingPlayer = $$props.invitingPlayer);
    		if ('invited' in $$props) $$invalidate(9, invited = $$props.invited);
    		if ('allGames' in $$props) allGames = $$props.allGames;
    		if ('newInvite' in $$props) $$invalidate(10, newInvite = $$props.newInvite);
    		if ('pause' in $$props) $$invalidate(11, pause = $$props.pause);
    		if ('time' in $$props) $$invalidate(12, time = $$props.time);
    		if ('retour' in $$props) retour = $$props.retour;
    		if ('puck' in $$props) puck = $$props.puck;
    		if ('paddleLeft' in $$props) $$invalidate(13, paddleLeft = $$props.paddleLeft);
    		if ('paddleRight' in $$props) $$invalidate(14, paddleRight = $$props.paddleRight);
    		if ('canvas' in $$props) $$invalidate(15, canvas = $$props.canvas);
    		if ('context' in $$props) context = $$props.context;
    		if ('playing' in $$props) $$invalidate(16, playing = $$props.playing);
    		if ('animationId' in $$props) animationId = $$props.animationId;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		invitedPlayer_two,
    		invitation_two,
    		games,
    		otherPlayer,
    		ingame,
    		gameName,
    		myPaddle,
    		theme,
    		invitingPlayer,
    		invited,
    		newInvite,
    		pause,
    		time,
    		paddleLeft,
    		paddleRight,
    		canvas,
    		playing,
    		$logged,
    		$image_url,
    		$username42,
    		handleKeydown,
    		handleKeyup,
    		handleStart,
    		changeTheme,
    		cancelGame,
    		cancelGameInvitation,
    		gameRequest,
    		acceptInvite,
    		declineInvite,
    		watchGame,
    		forfeit,
    		socket,
    		click_handler,
    		canvas_1_binding,
    		click_handler_1
    	];
    }

    class Pong extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { socket: 31 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Pong",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get socket() {
    		throw new Error("<Pong>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set socket(value) {
    		throw new Error("<Pong>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.49.0 */
    const file = "src/App.svelte";

    // (147:4) {:else}
    function create_else_block_4(ctx) {
    	let a0;
    	let t1;
    	let a1;
    	let t3;
    	let a2;
    	let t5;
    	let a3;
    	let t7;
    	let a4;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a0 = element("a");
    			a0.textContent = "HOME";
    			t1 = space();
    			a1 = element("a");
    			a1.textContent = "PONG";
    			t3 = space();
    			a2 = element("a");
    			a2.textContent = "PROFILE";
    			t5 = space();
    			a3 = element("a");
    			a3.textContent = "CHAT";
    			t7 = space();
    			a4 = element("a");
    			a4.textContent = "LOGOUT";
    			attr_dev(a0, "class", "item svelte-h6sqss");
    			attr_dev(a0, "href", "#/");
    			add_location(a0, file, 147, 6, 4581);
    			attr_dev(a1, "class", "item svelte-h6sqss");
    			attr_dev(a1, "href", "#/");
    			add_location(a1, file, 148, 6, 4622);
    			attr_dev(a2, "class", "item svelte-h6sqss");
    			attr_dev(a2, "href", "#/");
    			add_location(a2, file, 149, 6, 4663);
    			attr_dev(a3, "class", "item svelte-h6sqss");
    			attr_dev(a3, "href", "#/");
    			add_location(a3, file, 150, 6, 4707);
    			attr_dev(a4, "class", "item svelte-h6sqss");
    			attr_dev(a4, "href", "#/");
    			add_location(a4, file, 151, 6, 4748);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, a1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, a2, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, a3, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, a4, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a4, "click", /*logOut*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(a1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(a2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(a3);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(a4);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_4.name,
    		type: "else",
    		source: "(147:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (73:4) {#if $logged == 'true'}
    function create_if_block(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let a;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*$currentPage*/ ctx[1] == 'home') return create_if_block_4;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*$currentPage*/ ctx[1] == 'profile') return create_if_block_3;
    		return create_else_block_2;
    	}

    	let current_block_type_1 = select_block_type_2(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	function select_block_type_3(ctx, dirty) {
    		if (/*$currentPage*/ ctx[1] == 'chat') return create_if_block_2;
    		return create_else_block_1;
    	}

    	let current_block_type_2 = select_block_type_3(ctx);
    	let if_block2 = current_block_type_2(ctx);

    	function select_block_type_4(ctx, dirty) {
    		if (/*$currentPage*/ ctx[1] == 'pong') return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type_3 = select_block_type_4(ctx);
    	let if_block3 = current_block_type_3(ctx);

    	const block = {
    		c: function create() {
    			if_block0.c();
    			t0 = space();
    			if_block1.c();
    			t1 = space();
    			if_block2.c();
    			t2 = space();
    			if_block3.c();
    			t3 = space();
    			a = element("a");
    			a.textContent = "LOGOUT";
    			attr_dev(a, "class", "item svelte-h6sqss");
    			attr_dev(a, "href", "#/");
    			add_location(a, file, 145, 6, 4508);
    		},
    		m: function mount(target, anchor) {
    			if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if_block2.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if_block3.m(target, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*logOut*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_2(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(t1.parentNode, t1);
    				}
    			}

    			if (current_block_type_2 === (current_block_type_2 = select_block_type_3(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type_2(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(t2.parentNode, t2);
    				}
    			}

    			if (current_block_type_3 === (current_block_type_3 = select_block_type_4(ctx)) && if_block3) {
    				if_block3.p(ctx, dirty);
    			} else {
    				if_block3.d(1);
    				if_block3 = current_block_type_3(ctx);

    				if (if_block3) {
    					if_block3.c();
    					if_block3.m(t3.parentNode, t3);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if_block2.d(detaching);
    			if (detaching) detach_dev(t2);
    			if_block3.d(detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(73:4) {#if $logged == 'true'}",
    		ctx
    	});

    	return block;
    }

    // (82:6) {:else}
    function create_else_block_3(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "HOME";
    			attr_dev(a, "class", "item svelte-h6sqss");
    			attr_dev(a, "href", "#/");
    			add_location(a, file, 82, 8, 3125);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_1*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(82:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (74:6) {#if $currentPage == 'home'}
    function create_if_block_4(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "HOME";
    			attr_dev(a, "class", "item_active svelte-h6sqss");
    			attr_dev(a, "href", "#/");
    			add_location(a, file, 74, 8, 2944);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(74:6) {#if $currentPage == 'home'}",
    		ctx
    	});

    	return block;
    }

    // (100:6) {:else}
    function create_else_block_2(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "PROFILE";
    			attr_dev(a, "class", "item svelte-h6sqss");
    			attr_dev(a, "href", "#/profile");
    			add_location(a, file, 100, 8, 3530);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_3*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(100:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (92:6) {#if $currentPage == 'profile'}
    function create_if_block_3(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "PROFILE";
    			attr_dev(a, "class", "item_active svelte-h6sqss");
    			attr_dev(a, "href", "#/profile");
    			add_location(a, file, 92, 8, 3336);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_2*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(92:6) {#if $currentPage == 'profile'}",
    		ctx
    	});

    	return block;
    }

    // (118:6) {:else}
    function create_else_block_1(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "CHAT";
    			attr_dev(a, "class", "item svelte-h6sqss");
    			attr_dev(a, "href", "#/chat");
    			add_location(a, file, 118, 8, 3936);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_5*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(118:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (110:6) {#if $currentPage == 'chat'}
    function create_if_block_2(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "CHAT";
    			attr_dev(a, "class", "item_active svelte-h6sqss");
    			attr_dev(a, "href", "#/chat");
    			add_location(a, file, 110, 8, 3751);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_4*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(110:6) {#if $currentPage == 'chat'}",
    		ctx
    	});

    	return block;
    }

    // (136:6) {:else}
    function create_else_block(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "PONG";
    			attr_dev(a, "class", "item svelte-h6sqss");
    			attr_dev(a, "href", "#/pong");
    			add_location(a, file, 136, 8, 4333);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_7*/ ctx[12], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(136:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (128:6) {#if $currentPage == 'pong'}
    function create_if_block_1(ctx) {
    	let a;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "PONG";
    			attr_dev(a, "class", "item_active svelte-h6sqss");
    			attr_dev(a, "href", "#/pong");
    			add_location(a, file, 128, 8, 4148);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler_6*/ ctx[11], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(128:6) {#if $currentPage == 'pong'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let t0;
    	let main;
    	let img;
    	let img_src_value;
    	let t1;
    	let nav;
    	let t2;
    	let router;
    	let current;

    	function select_block_type(ctx, dirty) {
    		if (/*$logged*/ ctx[0] == 'true') return create_if_block;
    		return create_else_block_4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	router = new Router({
    			props: { routes: /*routes*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			t0 = space();
    			main = element("main");
    			img = element("img");
    			t1 = space();
    			nav = element("nav");
    			if_block.c();
    			t2 = space();
    			create_component(router.$$.fragment);
    			if (!src_url_equal(img.src, img_src_value = "img/pong.svg")) attr_dev(img, "src", img_src_value);
    			set_style(img, "width", "300px");
    			attr_dev(img, "alt", "Pong icon");
    			add_location(img, file, 70, 2, 2787);
    			attr_dev(nav, "class", "menu svelte-h6sqss");
    			add_location(nav, file, 71, 2, 2854);
    			attr_dev(main, "class", "svelte-h6sqss");
    			add_location(main, file, 69, 0, 2778);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, img);
    			append_dev(main, t1);
    			append_dev(main, nav);
    			if_block.m(nav, null);
    			insert_dev(target, t2, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(nav, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			if_block.d();
    			if (detaching) detach_dev(t2);
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $intra;
    	let $cookie;
    	let $logged;
    	let $currentPage;
    	validate_store(intra, 'intra');
    	component_subscribe($$self, intra, $$value => $$invalidate(13, $intra = $$value));
    	validate_store(cookie, 'cookie');
    	component_subscribe($$self, cookie, $$value => $$invalidate(14, $cookie = $$value));
    	validate_store(logged, 'logged');
    	component_subscribe($$self, logged, $$value => $$invalidate(0, $logged = $$value));
    	validate_store(currentPage, 'currentPage');
    	component_subscribe($$self, currentPage, $$value => $$invalidate(1, $currentPage = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let socket = null;
    	let { name = 'transcendance' } = $$props;
    	let kuki = $cookie;

    	let routes = {
    		'/': Home,
    		'/pong': Pong,
    		'/chat': Chat,
    		'/profile': Profile,
    		'/userprofile': UserProfile,
    		'/*': NotFound
    	};

    	function logOut() {
    		var _a;

    		return __awaiter(this, void 0, void 0, function* () {
    			if ($intra == 'true') {
    				logged.update(n => 'false');
    				intra.update(n => 'false');
    				localStorage.removeItem('currentChat');
    				localStorage.removeItem('currentPage');
    				localStorage.removeItem('invitedPlayer');

    				for (let key in localStorage) {
    					delete localStorage[key];
    				}

    				var cookies = (_a = document.cookie) === null || _a === void 0
    				? void 0
    				: _a.split(';');

    				for (var i = 0; i < cookies.length; i++) {
    					var cookie = cookies[i];
    					var eqPos = cookie.indexOf('=');
    					var name_cookie = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    					document.cookie = name_cookie + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    				}

    				yield fetch(`${BACKEND_URL}/users/logout`, {
    					method: 'POST',
    					headers: {
    						Authorization: 'Bearer ' + kuki,
    						'Content-type': 'application/json; charset=UTF-8'
    					}
    				});

    				location.reload();
    				alert('✅ You successfully logged out');
    			}
    		});
    	}

    	onMount(() => {
    		
    	});

    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => {
    		currentPage.update(n => 'home');
    	};

    	const click_handler_1 = () => {
    		currentPage.update(n => 'home');
    	};

    	const click_handler_2 = () => {
    		currentPage.update(n => 'profile');
    	};

    	const click_handler_3 = () => {
    		currentPage.update(n => 'profile');
    	};

    	const click_handler_4 = () => {
    		currentPage.update(n => 'chat');
    	};

    	const click_handler_5 = () => {
    		currentPage.update(n => 'chat');
    	};

    	const click_handler_6 = () => {
    		currentPage.update(n => 'pong');
    	};

    	const click_handler_7 = () => {
    		currentPage.update(n => 'pong');
    	};

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(4, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		logged,
    		intra,
    		currentPage,
    		cookie,
    		Router,
    		Chat,
    		Home,
    		NotFound,
    		Profile,
    		UserProfile,
    		Pong,
    		onMount,
    		socket,
    		BACKEND_URL,
    		name,
    		kuki,
    		routes,
    		logOut,
    		$intra,
    		$cookie,
    		$logged,
    		$currentPage
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('socket' in $$props) socket = $$props.socket;
    		if ('name' in $$props) $$invalidate(4, name = $$props.name);
    		if ('kuki' in $$props) kuki = $$props.kuki;
    		if ('routes' in $$props) $$invalidate(2, routes = $$props.routes);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		$logged,
    		$currentPage,
    		routes,
    		logOut,
    		name,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var app = new App({
        target: document.body,
        props: {
            name: 'Transcendance'
        }
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
