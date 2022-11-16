
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
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
    function empty() {
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
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { ownerNode } = info.stylesheet;
                // there is no ownerNode if it runs on jsdom.
                if (ownerNode)
                    detach(ownerNode);
            });
            managed_styles.clear();
        });
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
    /**
     * Schedules a callback to run immediately before the component is updated after any state change.
     *
     * The first time the callback runs will be before the initial `onMount`
     *
     * https://svelte.dev/docs#run-time-svelte-beforeupdate
     */
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately after the component has been updated.
     *
     * The first time the callback runs will be after the initial `onMount`
     */
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    /**
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
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
    /**
     * Associates an arbitrary `context` object with the current component and the specified `key`
     * and returns that object. The context is then available to children of the component
     * (including slotted content) with `getContext`.
     *
     * Like lifecycle functions, this must be called during component initialisation.
     *
     * https://svelte.dev/docs#run-time-svelte-setcontext
     */
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
        return context;
    }
    /**
     * Retrieves the context that belongs to the closest parent component with the specified `key`.
     * Must be called during component initialisation.
     *
     * https://svelte.dev/docs#run-time-svelte-getcontext
     */
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    /**
     * Retrieves the whole context map that belongs to the closest parent component.
     * Must be called during component initialisation. Useful, for example, if you
     * programmatically create a component and want to pass the existing context to it.
     *
     * https://svelte.dev/docs#run-time-svelte-getallcontexts
     */
    function getAllContexts() {
        return get_current_component().$$.context;
    }
    /**
     * Checks whether a given `key` has been set in the context of a parent component.
     * Must be called during component initialisation.
     *
     * https://svelte.dev/docs#run-time-svelte-hascontext
     */
    function hasContext(key) {
        return get_current_component().$$.context.has(key);
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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }

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

    function bind$2(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
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
            ctx: [],
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
                start_hydrating();
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
            end_hydrating();
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
            if (!is_function(callback)) {
                return noop;
            }
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.53.1' }, detail), { bubbles: true }));
    }
    function append_hydration_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append_hydration(target, node);
    }
    function insert_hydration_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert_hydration(target, node, anchor);
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
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
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
    function construct_svelte_component_dev(component, props) {
        const error_message = 'this={...} of <svelte:component> should specify a Svelte component.';
        try {
            const instance = new component(props);
            if (!instance.$$ || !instance.$set || !instance.$on || !instance.$destroy) {
                throw new Error(error_message);
            }
            return instance;
        }
        catch (err) {
            const { message } = err;
            if (typeof message === 'string' && message.indexOf('is not a constructor') !== -1) {
                throw new Error(error_message);
            }
            else {
                throw err;
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
    /**
     * Base class to create strongly typed Svelte components.
     * This only exists for typing purposes and should be used in `.d.ts` files.
     *
     * ### Example:
     *
     * You have component library on npm called `component-library`, from which
     * you export a component called `MyComponent`. For Svelte+TypeScript users,
     * you want to provide typings. Therefore you create a `index.d.ts`:
     * ```ts
     * import { SvelteComponentTyped } from "svelte";
     * export class MyComponent extends SvelteComponentTyped<{foo: string}> {}
     * ```
     * Typing this makes it possible for IDEs like VS Code with the Svelte extension
     * to provide intellisense and to use the component like this in a Svelte file
     * with TypeScript:
     * ```svelte
     * <script lang="ts">
     * 	import { MyComponent } from "component-library";
     * </script>
     * <MyComponent foo={'bar'} />
     * ```
     *
     * #### Why not make this part of `SvelteComponent(Dev)`?
     * Because
     * ```ts
     * class ASubclassOfSvelteComponent extends SvelteComponent<{foo: string}> {}
     * const component: typeof SvelteComponent = ASubclassOfSvelteComponent;
     * ```
     * will throw a type error, so we need to separate the more strictly typed class.
     */
    class SvelteComponentTyped extends SvelteComponentDev {
        constructor(options) {
            super(options);
        }
    }

    var svelte = /*#__PURE__*/Object.freeze({
        __proto__: null,
        SvelteComponent: SvelteComponentDev,
        SvelteComponentTyped: SvelteComponentTyped,
        afterUpdate: afterUpdate,
        beforeUpdate: beforeUpdate,
        createEventDispatcher: createEventDispatcher,
        getAllContexts: getAllContexts,
        getContext: getContext,
        hasContext: hasContext,
        onDestroy: onDestroy,
        onMount: onMount,
        setContext: setContext,
        tick: tick
    });

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

    const LOCATION = {};
    const ROUTER = {};

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    function getLocation(source) {
      return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || "initial"
      };
    }

    function createHistory(source, options) {
      const listeners = [];
      let location = getLocation(source);

      return {
        get location() {
          return location;
        },

        listen(listener) {
          listeners.push(listener);

          const popstateListener = () => {
            location = getLocation(source);
            listener({ location, action: "POP" });
          };

          source.addEventListener("popstate", popstateListener);

          return () => {
            source.removeEventListener("popstate", popstateListener);

            const index = listeners.indexOf(listener);
            listeners.splice(index, 1);
          };
        },

        navigate(to, { state, replace = false } = {}) {
          state = { ...state, key: Date.now() + "" };
          // try...catch iOS Safari limits to 100 pushState calls
          try {
            if (replace) {
              source.history.replaceState(state, null, to);
            } else {
              source.history.pushState(state, null, to);
            }
          } catch (e) {
            source.location[replace ? "replace" : "assign"](to);
          }

          location = getLocation(source);
          listeners.forEach(listener => listener({ location, action: "PUSH" }));
        }
      };
    }

    // Stores history entries in memory for testing or other platforms like Native
    function createMemorySource(initialPathname = "/") {
      let index = 0;
      const stack = [{ pathname: initialPathname, search: "" }];
      const states = [];

      return {
        get location() {
          return stack[index];
        },
        addEventListener(name, fn) {},
        removeEventListener(name, fn) {},
        history: {
          get entries() {
            return stack;
          },
          get index() {
            return index;
          },
          get state() {
            return states[index];
          },
          pushState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            index++;
            stack.push({ pathname, search });
            states.push(state);
          },
          replaceState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            stack[index] = { pathname, search };
            states[index] = state;
          }
        }
      };
    }

    // Global history uses window.history as the source if available,
    // otherwise a memory history
    const canUseDOM = Boolean(
      typeof window !== "undefined" &&
        window.document &&
        window.document.createElement
    );
    const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
    const { navigate } = globalHistory;

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    const paramRe = /^:(.+)/;

    const SEGMENT_POINTS = 4;
    const STATIC_POINTS = 3;
    const DYNAMIC_POINTS = 2;
    const SPLAT_PENALTY = 1;
    const ROOT_POINTS = 1;

    /**
     * Check if `string` starts with `search`
     * @param {string} string
     * @param {string} search
     * @return {boolean}
     */
    function startsWith$1(string, search) {
      return string.substr(0, search.length) === search;
    }

    /**
     * Check if `segment` is a root segment
     * @param {string} segment
     * @return {boolean}
     */
    function isRootSegment(segment) {
      return segment === "";
    }

    /**
     * Check if `segment` is a dynamic segment
     * @param {string} segment
     * @return {boolean}
     */
    function isDynamic(segment) {
      return paramRe.test(segment);
    }

    /**
     * Check if `segment` is a splat
     * @param {string} segment
     * @return {boolean}
     */
    function isSplat(segment) {
      return segment[0] === "*";
    }

    /**
     * Split up the URI into segments delimited by `/`
     * @param {string} uri
     * @return {string[]}
     */
    function segmentize(uri) {
      return (
        uri
          // Strip starting/ending `/`
          .replace(/(^\/+|\/+$)/g, "")
          .split("/")
      );
    }

    /**
     * Strip `str` of potential start and end `/`
     * @param {string} str
     * @return {string}
     */
    function stripSlashes(str) {
      return str.replace(/(^\/+|\/+$)/g, "");
    }

    /**
     * Score a route depending on how its individual segments look
     * @param {object} route
     * @param {number} index
     * @return {object}
     */
    function rankRoute(route, index) {
      const score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
            score += SEGMENT_POINTS;

            if (isRootSegment(segment)) {
              score += ROOT_POINTS;
            } else if (isDynamic(segment)) {
              score += DYNAMIC_POINTS;
            } else if (isSplat(segment)) {
              score -= SEGMENT_POINTS + SPLAT_PENALTY;
            } else {
              score += STATIC_POINTS;
            }

            return score;
          }, 0);

      return { route, score, index };
    }

    /**
     * Give a score to all routes and sort them on that
     * @param {object[]} routes
     * @return {object[]}
     */
    function rankRoutes(routes) {
      return (
        routes
          .map(rankRoute)
          // If two routes have the exact same score, we go by index instead
          .sort((a, b) =>
            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
          )
      );
    }

    /**
     * Ranks and picks the best route to match. Each segment gets the highest
     * amount of points, then the type of segment gets an additional amount of
     * points where
     *
     *  static > dynamic > splat > root
     *
     * This way we don't have to worry about the order of our routes, let the
     * computers do it.
     *
     * A route looks like this
     *
     *  { path, default, value }
     *
     * And a returned match looks like:
     *
     *  { route, params, uri }
     *
     * @param {object[]} routes
     * @param {string} uri
     * @return {?object}
     */
    function pick(routes, uri) {
      let match;
      let default_;

      const [uriPathname] = uri.split("?");
      const uriSegments = segmentize(uriPathname);
      const isRootUri = uriSegments[0] === "";
      const ranked = rankRoutes(routes);

      for (let i = 0, l = ranked.length; i < l; i++) {
        const route = ranked[i].route;
        let missed = false;

        if (route.default) {
          default_ = {
            route,
            params: {},
            uri
          };
          continue;
        }

        const routeSegments = segmentize(route.path);
        const params = {};
        const max = Math.max(uriSegments.length, routeSegments.length);
        let index = 0;

        for (; index < max; index++) {
          const routeSegment = routeSegments[index];
          const uriSegment = uriSegments[index];

          if (routeSegment !== undefined && isSplat(routeSegment)) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/* or /files/*splatname
            const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

            params[splatName] = uriSegments
              .slice(index)
              .map(decodeURIComponent)
              .join("/");
            break;
          }

          if (uriSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/:userId
            missed = true;
            break;
          }

          let dynamicMatch = paramRe.exec(routeSegment);

          if (dynamicMatch && !isRootUri) {
            const value = decodeURIComponent(uriSegment);
            params[dynamicMatch[1]] = value;
          } else if (routeSegment !== uriSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/:id/profile
            missed = true;
            break;
          }
        }

        if (!missed) {
          match = {
            route,
            params,
            uri: "/" + uriSegments.slice(0, index).join("/")
          };
          break;
        }
      }

      return match || default_ || null;
    }

    /**
     * Check if the `path` matches the `uri`.
     * @param {string} path
     * @param {string} uri
     * @return {?object}
     */
    function match(route, uri) {
      return pick([route], uri);
    }

    /**
     * Add the query to the pathname if a query is given
     * @param {string} pathname
     * @param {string} [query]
     * @return {string}
     */
    function addQuery(pathname, query) {
      return pathname + (query ? `?${query}` : "");
    }

    /**
     * Resolve URIs as though every path is a directory, no files. Relative URIs
     * in the browser can feel awkward because not only can you be "in a directory",
     * you can be "at a file", too. For example:
     *
     *  browserSpecResolve('foo', '/bar/') => /bar/foo
     *  browserSpecResolve('foo', '/bar') => /foo
     *
     * But on the command line of a file system, it's not as complicated. You can't
     * `cd` from a file, only directories. This way, links have to know less about
     * their current path. To go deeper you can do this:
     *
     *  <Link to="deeper"/>
     *  // instead of
     *  <Link to=`{${props.uri}/deeper}`/>
     *
     * Just like `cd`, if you want to go deeper from the command line, you do this:
     *
     *  cd deeper
     *  # not
     *  cd $(pwd)/deeper
     *
     * By treating every path as a directory, linking to relative paths should
     * require less contextual information and (fingers crossed) be more intuitive.
     * @param {string} to
     * @param {string} base
     * @return {string}
     */
    function resolve(to, base) {
      // /foo/bar, /baz/qux => /foo/bar
      if (startsWith$1(to, "/")) {
        return to;
      }

      const [toPathname, toQuery] = to.split("?");
      const [basePathname] = base.split("?");
      const toSegments = segmentize(toPathname);
      const baseSegments = segmentize(basePathname);

      // ?a=b, /users?b=c => /users?a=b
      if (toSegments[0] === "") {
        return addQuery(basePathname, toQuery);
      }

      // profile, /users/789 => /users/789/profile
      if (!startsWith$1(toSegments[0], ".")) {
        const pathname = baseSegments.concat(toSegments).join("/");

        return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
      }

      // ./       , /users/123 => /users/123
      // ../      , /users/123 => /users
      // ../..    , /users/123 => /
      // ../../one, /a/b/c/d   => /a/b/one
      // .././one , /a/b/c/d   => /a/b/c/one
      const allSegments = baseSegments.concat(toSegments);
      const segments = [];

      allSegments.forEach(segment => {
        if (segment === "..") {
          segments.pop();
        } else if (segment !== ".") {
          segments.push(segment);
        }
      });

      return addQuery("/" + segments.join("/"), toQuery);
    }

    /**
     * Combines the `basepath` and the `path` into one path.
     * @param {string} basepath
     * @param {string} path
     */
    function combinePaths(basepath, path) {
      return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
    }

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    /* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.53.1 */

    function create_fragment$A(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$A.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$A($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, 'routes');
    	component_subscribe($$self, routes, value => $$invalidate(6, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(5, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(7, $base = value));

    	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
    		// If there is no activeRoute, the routerBase will be identical to the base.
    		if (activeRoute === null) {
    			return base;
    		}

    		const { path: basepath } = base;
    		const { route, uri } = activeRoute;

    		// Remove the potential /* or /*splatname from
    		// the end of the child Routes relative paths.
    		const path = route.default
    		? basepath
    		: route.path.replace(/\*.*$/, "");

    		return { path, uri };
    	});

    	function registerRoute(route) {
    		const { path: basepath } = $base;
    		let { path } = route;

    		// We store the original path in the _path property so we can reuse
    		// it when the basepath changes. The only thing that matters is that
    		// the route reference is intact, so mutation is fine.
    		route._path = path;

    		route.path = combinePaths(basepath, path);

    		if (typeof window === "undefined") {
    			// In SSR we should set the activeRoute immediately if it is a match.
    			// If there are more Routes being registered after a match is found,
    			// we just skip them.
    			if (hasActiveRoute) {
    				return;
    			}

    			const matchingRoute = match(route, $location.pathname);

    			if (matchingRoute) {
    				activeRoute.set(matchingRoute);
    				hasActiveRoute = true;
    			}
    		} else {
    			routes.update(rs => {
    				rs.push(route);
    				return rs;
    			});
    		}
    	}

    	function unregisterRoute(route) {
    		routes.update(rs => {
    			const index = rs.indexOf(route);
    			rs.splice(index, 1);
    			return rs;
    		});
    	}

    	if (!locationContext) {
    		// The topmost Router in the tree is responsible for updating
    		// the location store and supplying it through context.
    		onMount(() => {
    			const unlisten = globalHistory.listen(history => {
    				location.set(history.location);
    			});

    			return unlisten;
    		});

    		setContext(LOCATION, location);
    	}

    	setContext(ROUTER, {
    		activeRoute,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute
    	});

    	const writable_props = ['basepath', 'url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		setContext,
    		onMount,
    		writable,
    		derived,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		pick,
    		match,
    		stripSlashes,
    		combinePaths,
    		basepath,
    		url,
    		locationContext,
    		routerContext,
    		routes,
    		activeRoute,
    		hasActiveRoute,
    		location,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$location,
    		$routes,
    		$base
    	});

    	$$self.$inject_state = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 128) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			{
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 96) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			{
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		$location,
    		$routes,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$A, create_fragment$A, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$A.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.53.1 */

    const get_default_slot_changes$1 = dirty => ({
    	params: dirty & /*routeParams*/ 4,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context$1 = ctx => ({
    	params: /*routeParams*/ ctx[2],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block$k(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$5, create_else_block$5];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
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
    		id: create_if_block$k.name,
    		type: "if",
    		source: "(40:0) {#if $activeRoute !== null && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {:else}
    function create_else_block$5(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context$1);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, routeParams, $location*/ 532)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, get_default_slot_changes$1),
    						get_default_slot_context$1
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(43:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:2) {#if component !== null}
    function create_if_block_1$5(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[2],
    		/*routeProps*/ ctx[3]
    	];

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
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) mount_component(switch_instance, target, anchor);
    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, routeParams, routeProps*/ 28)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && { location: /*$location*/ ctx[4] },
    					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
    					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
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
    					switch_instance = construct_svelte_component_dev(switch_value, switch_props());
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
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$z(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block$k(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$k(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$z.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$z($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Route', slots, ['default']);
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));

    	const route = {
    		path,
    		// If no path prop is given, this Route will act as the default Route
    		// that is rendered if no other Route in the Router is a match.
    		default: path === ""
    	};

    	let routeParams = {};
    	let routeProps = {};
    	registerRoute(route);

    	// There is no need to unregister Routes in SSR since it will all be
    	// thrown away anyway.
    	if (typeof window !== "undefined") {
    		onDestroy(() => {
    			unregisterRoute(route);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('path' in $$new_props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('$$scope' in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onDestroy,
    		ROUTER,
    		LOCATION,
    		path,
    		component,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		location,
    		route,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), $$new_props));
    		if ('path' in $$props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
    		if ('routeParams' in $$props) $$invalidate(2, routeParams = $$new_props.routeParams);
    		if ('routeProps' in $$props) $$invalidate(3, routeProps = $$new_props.routeProps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 2) {
    			if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(2, routeParams = $activeRoute.params);
    			}
    		}

    		{
    			const { path, component, ...rest } = $$props;
    			$$invalidate(3, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		$activeRoute,
    		routeParams,
    		routeProps,
    		$location,
    		activeRoute,
    		location,
    		route,
    		path,
    		$$scope,
    		slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$z, create_fragment$z, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$z.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.53.1 */
    const file$v = "node_modules\\svelte-routing\\src\\Link.svelte";

    function create_fragment$y(ctx) {
    	let a;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		{ href: /*href*/ ctx[0] },
    		{ "aria-current": /*ariaCurrent*/ ctx[2] },
    		/*props*/ ctx[1],
    		/*$$restProps*/ ctx[6]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, "aria-current": true });
    			var a_nodes = children(a);
    			if (default_slot) default_slot.l(a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_attributes(a, a_data);
    			add_location(a, file$v, 40, 0, 1249);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*onClick*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 32768)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[15],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[15])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null),
    						null
    					);
    				}
    			}

    			set_attributes(a, a_data = get_spread_update(a_levels, [
    				(!current || dirty & /*href*/ 1) && { href: /*href*/ ctx[0] },
    				(!current || dirty & /*ariaCurrent*/ 4) && { "aria-current": /*ariaCurrent*/ ctx[2] },
    				dirty & /*props*/ 2 && /*props*/ ctx[1],
    				dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6]
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$y.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$y($$self, $$props, $$invalidate) {
    	let ariaCurrent;
    	const omit_props_names = ["to","replace","state","getProps"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $location;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Link', slots, ['default']);
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(14, $base = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(13, $location = value));
    	const dispatch = createEventDispatcher();
    	let href, isPartiallyCurrent, isCurrent, props;

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();

    			// Don't push another entry to the history stack when the user
    			// clicks on a Link to the page they are currently on.
    			const shouldReplace = $location.pathname === href || replace;

    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('to' in $$new_props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$new_props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$new_props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$new_props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('$$scope' in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		createEventDispatcher,
    		ROUTER,
    		LOCATION,
    		navigate,
    		startsWith: startsWith$1,
    		resolve,
    		shouldNavigate,
    		to,
    		replace,
    		state,
    		getProps,
    		base,
    		location,
    		dispatch,
    		href,
    		isPartiallyCurrent,
    		isCurrent,
    		props,
    		onClick,
    		ariaCurrent,
    		$location,
    		$base
    	});

    	$$self.$inject_state = $$new_props => {
    		if ('to' in $$props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('href' in $$props) $$invalidate(0, href = $$new_props.href);
    		if ('isPartiallyCurrent' in $$props) $$invalidate(11, isPartiallyCurrent = $$new_props.isPartiallyCurrent);
    		if ('isCurrent' in $$props) $$invalidate(12, isCurrent = $$new_props.isCurrent);
    		if ('props' in $$props) $$invalidate(1, props = $$new_props.props);
    		if ('ariaCurrent' in $$props) $$invalidate(2, ariaCurrent = $$new_props.ariaCurrent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $base*/ 16512) {
    			$$invalidate(0, href = to === "/" ? $base.uri : resolve(to, $base.uri));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 8193) {
    			$$invalidate(11, isPartiallyCurrent = startsWith$1($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 8193) {
    			$$invalidate(12, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 4096) {
    			$$invalidate(2, ariaCurrent = isCurrent ? "page" : undefined);
    		}

    		if ($$self.$$.dirty & /*getProps, $location, href, isPartiallyCurrent, isCurrent*/ 15361) {
    			$$invalidate(1, props = getProps({
    				location: $location,
    				href,
    				isPartiallyCurrent,
    				isCurrent
    			}));
    		}
    	};

    	return [
    		href,
    		props,
    		ariaCurrent,
    		base,
    		location,
    		onClick,
    		$$restProps,
    		to,
    		replace,
    		state,
    		getProps,
    		isPartiallyCurrent,
    		isCurrent,
    		$location,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$y, create_fragment$y, safe_not_equal, {
    			to: 7,
    			replace: 8,
    			state: 9,
    			getProps: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$y.name
    		});
    	}

    	get to() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get state() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getProps() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getProps(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const token = writable(localStorage.getItem('token'));

    //used to update projects array (used in all files that need to reach the projects array)
    const amountOfProjects = writable([]);

    //used to get the index of the projects on admin side (Edit.svelte and ProjectsAD.svelte)
    const show = writable([]);

    //used to see if editing is true or false (Edit.svelte and ProjectsAD.svelte)
    const isEditing = writable(false);

    const categories = writable(['Barn och Unga', 'Ungdomar', 'Stöd och Rörlighet', 'Primärvård', 'Informativt', 'Övrigt']);
    // export const categories = writable(['Younglings', 'Adolescence balance', 'support and mobility', 'primary care', 'Informative']);

    const checkPoint = writable(0);

    const bookId = writable(1);
    const projectId = writable(0);

    const allKidsBooksRead = writable(false);
    const adolescenceBooksRead = writable(false);
    const primaryBooksRead = writable(false);
    const informativeBooksRead = writable(false);
    const mobilityBooksRead = writable(false);

    const hasTalkedToSven = writable(0);

    const tree = writable('../images/dead-tree.png');
    const spell = writable(false);
    const light = writable(false);
    const gotWand = writable(false);
    const goHome = writable(false);
    const story = writable('');
    const nextChat = writable(0);

    var bind$1 = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return Array.isArray(val);
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(val) {
      return toString.call(val) === '[object FormData]';
    }

    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a plain Object
     *
     * @param {Object} val The value to test
     * @return {boolean} True if value is a plain Object, otherwise false
     */
    function isPlainObject(val) {
      if (toString.call(val) !== '[object Object]') {
        return false;
      }

      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }

    /**
     * Determine if a value is a Date
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }

    /**
     * Determine if a value is a File
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    function isFile(val) {
      return toString.call(val) === '[object File]';
    }

    /**
     * Determine if a value is a Blob
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a URLSearchParams object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    function isURLSearchParams(val) {
      return toString.call(val) === '[object URLSearchParams]';
    }

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind$1(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    /**
     * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
     *
     * @param {string} content with BOM
     * @return {string} content value without BOM
     */
    function stripBOM(content) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return content;
    }

    var utils = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isPlainObject: isPlainObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      extend: extend,
      trim: trim,
      stripBOM: stripBOM
    };

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              v = v.toISOString();
            } else if (utils.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    function InterceptorManager() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager.prototype.use = function use(fulfilled, rejected, options) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected,
        synchronous: options ? options.synchronous : false,
        runWhen: options ? options.runWhen : null
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager;

    var normalizeHeaderName = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    /**
     * Update an Error with the specified config, error code, and response.
     *
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    var enhanceError = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }

      error.request = request;
      error.response = response;
      error.isAxiosError = true;

      error.toJSON = function toJSON() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code,
          status: this.response && this.response.status ? this.response.status : null
        };
      };
      return error;
    };

    var transitional = {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    };

    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    var createError = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError(error, config, code, request, response);
    };

    /**
     * Resolve or reject a Promise based on response status.
     *
     * @param {Function} resolve A function that resolves the promise.
     * @param {Function} reject A function that rejects the promise.
     * @param {object} response The response.
     */
    var settle = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!response.status || !validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(createError(
          'Request failed with status code ' + response.status,
          response.config,
          null,
          response.request,
          response
        ));
      }
    };

    var cookies = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs support document.cookie
        (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));

              if (utils.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }

              if (utils.isString(path)) {
                cookie.push('path=' + path);
              }

              if (utils.isString(domain)) {
                cookie.push('domain=' + domain);
              }

              if (secure === true) {
                cookie.push('secure');
              }

              document.cookie = cookie.join('; ');
            },

            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return (match ? decodeURIComponent(match[3]) : null);
            },

            remove: function remove(name) {
              this.write(name, '', Date.now() - 86400000);
            }
          };
        })() :

      // Non standard browser env (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() { return null; },
            remove: function remove() {}
          };
        })()
    );

    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    var isAbsoluteURL = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
    };

    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    var combineURLs = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };

    /**
     * Creates a new URL by combining the baseURL with the requestedURL,
     * only when the requestedURL is not already an absolute URL.
     * If the requestURL is absolute, this function returns the requestedURL untouched.
     *
     * @param {string} baseURL The base URL
     * @param {string} requestedURL Absolute or relative URL to combine
     * @returns {string} The combined full path
     */
    var buildFullPath = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };

    // Headers whose duplicates are ignored by node
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];

    /**
     * Parse headers into an object
     *
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     *
     * @param {String} headers Headers needing to be parsed
     * @returns {Object} Headers parsed into an object
     */
    var parseHeaders = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;

      if (!headers) { return parsed; }

      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));

        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });

      return parsed;
    };

    var isURLSameOrigin = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;

          /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
          function resolveURL(url) {
            var href = url;

            if (msie) {
            // IE needs attribute set twice to normalize properties
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }

            urlParsingNode.setAttribute('href', href);

            // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                urlParsingNode.pathname :
                '/' + urlParsingNode.pathname
            };
          }

          originURL = resolveURL(window.location.href);

          /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
          return function isURLSameOrigin(requestURL) {
            var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
            return (parsed.protocol === originURL.protocol &&
                parsed.host === originURL.host);
          };
        })() :

      // Non standard browser envs (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })()
    );

    /**
     * A `Cancel` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function Cancel(message) {
      this.message = message;
    }

    Cancel.prototype.toString = function toString() {
      return 'Cancel' + (this.message ? ': ' + this.message : '');
    };

    Cancel.prototype.__CANCEL__ = true;

    var Cancel_1 = Cancel;

    var xhr = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;
        var responseType = config.responseType;
        var onCanceled;
        function done() {
          if (config.cancelToken) {
            config.cancelToken.unsubscribe(onCanceled);
          }

          if (config.signal) {
            config.signal.removeEventListener('abort', onCanceled);
          }
        }

        if (utils.isFormData(requestData)) {
          delete requestHeaders['Content-Type']; // Let the browser set it
        }

        var request = new XMLHttpRequest();

        // HTTP basic authentication
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }

        var fullPath = buildFullPath(config.baseURL, config.url);
        request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

        // Set the request timeout in MS
        request.timeout = config.timeout;

        function onloadend() {
          if (!request) {
            return;
          }
          // Prepare the response
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
            request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config: config,
            request: request
          };

          settle(function _resolve(value) {
            resolve(value);
            done();
          }, function _reject(err) {
            reject(err);
            done();
          }, response);

          // Clean up request
          request = null;
        }

        if ('onloadend' in request) {
          // Use onloadend if available
          request.onloadend = onloadend;
        } else {
          // Listen for ready state to emulate onloadend
          request.onreadystatechange = function handleLoad() {
            if (!request || request.readyState !== 4) {
              return;
            }

            // The request errored out and we didn't get a response, this will be
            // handled by onerror instead
            // With one exception: request that using file: protocol, most browsers
            // will return status as 0 even though it's a successful request
            if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
              return;
            }
            // readystate handler is calling before onerror or ontimeout handlers,
            // so we should call onloadend on the next 'tick'
            setTimeout(onloadend);
          };
        }

        // Handle browser request cancellation (as opposed to a manual cancellation)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }

          reject(createError('Request aborted', config, 'ECONNABORTED', request));

          // Clean up request
          request = null;
        };

        // Handle low level network errors
        request.onerror = function handleError() {
          // Real errors are hidden from us by the browser
          // onerror should only fire if it's a network error
          reject(createError('Network Error', config, null, request));

          // Clean up request
          request = null;
        };

        // Handle timeout
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
          var transitional$1 = config.transitional || transitional;
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(createError(
            timeoutErrorMessage,
            config,
            transitional$1.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
            request));

          // Clean up request
          request = null;
        };

        // Add xsrf header
        // This is only done if running in a standard browser environment.
        // Specifically not if we're in a web worker, or react-native.
        if (utils.isStandardBrowserEnv()) {
          // Add xsrf header
          var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;

          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }

        // Add headers to the request
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // Remove Content-Type if data is undefined
              delete requestHeaders[key];
            } else {
              // Otherwise add header to the request
              request.setRequestHeader(key, val);
            }
          });
        }

        // Add withCredentials to request if needed
        if (!utils.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }

        // Add responseType to request if needed
        if (responseType && responseType !== 'json') {
          request.responseType = config.responseType;
        }

        // Handle progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }

        // Not all browsers support upload events
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken || config.signal) {
          // Handle cancellation
          // eslint-disable-next-line func-names
          onCanceled = function(cancel) {
            if (!request) {
              return;
            }
            reject(!cancel || (cancel && cancel.type) ? new Cancel_1('canceled') : cancel);
            request.abort();
            request = null;
          };

          config.cancelToken && config.cancelToken.subscribe(onCanceled);
          if (config.signal) {
            config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
          }
        }

        if (!requestData) {
          requestData = null;
        }

        // Send the request
        request.send(requestData);
      });
    };

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = xhr;
      } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = xhr;
      }
      return adapter;
    }

    function stringifySafely(rawValue, parser, encoder) {
      if (utils.isString(rawValue)) {
        try {
          (parser || JSON.parse)(rawValue);
          return utils.trim(rawValue);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            throw e;
          }
        }
      }

      return (encoder || JSON.stringify)(rawValue);
    }

    var defaults = {

      transitional: transitional,

      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');

        if (utils.isFormData(data) ||
          utils.isArrayBuffer(data) ||
          utils.isBuffer(data) ||
          utils.isStream(data) ||
          utils.isFile(data) ||
          utils.isBlob(data)
        ) {
          return data;
        }
        if (utils.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }
        if (utils.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
          setContentTypeIfUnset(headers, 'application/json');
          return stringifySafely(data);
        }
        return data;
      }],

      transformResponse: [function transformResponse(data) {
        var transitional = this.transitional || defaults.transitional;
        var silentJSONParsing = transitional && transitional.silentJSONParsing;
        var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
        var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

        if (strictJSONParsing || (forcedJSONParsing && utils.isString(data) && data.length)) {
          try {
            return JSON.parse(data);
          } catch (e) {
            if (strictJSONParsing) {
              if (e.name === 'SyntaxError') {
                throw enhanceError(e, this, 'E_JSON_PARSE');
              }
              throw e;
            }
          }
        }

        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,
      maxBodyLength: -1,

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      },

      headers: {
        common: {
          'Accept': 'application/json, text/plain, */*'
        }
      }
    };

    utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData = function transformData(data, headers, fns) {
      var context = this || defaults_1;
      /*eslint no-param-reassign:0*/
      utils.forEach(fns, function transform(fn) {
        data = fn.call(context, data, headers);
      });

      return data;
    };

    var isCancel = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }

      if (config.signal && config.signal.aborted) {
        throw new Cancel_1('canceled');
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData.call(
        config,
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults_1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData.call(
          config,
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData.call(
              config,
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig$1 = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      function getMergedValue(target, source) {
        if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
          return utils.merge(target, source);
        } else if (utils.isPlainObject(source)) {
          return utils.merge({}, source);
        } else if (utils.isArray(source)) {
          return source.slice();
        }
        return source;
      }

      // eslint-disable-next-line consistent-return
      function mergeDeepProperties(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function valueFromConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function defaultToConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function mergeDirectKeys(prop) {
        if (prop in config2) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      var mergeMap = {
        'url': valueFromConfig2,
        'method': valueFromConfig2,
        'data': valueFromConfig2,
        'baseURL': defaultToConfig2,
        'transformRequest': defaultToConfig2,
        'transformResponse': defaultToConfig2,
        'paramsSerializer': defaultToConfig2,
        'timeout': defaultToConfig2,
        'timeoutMessage': defaultToConfig2,
        'withCredentials': defaultToConfig2,
        'adapter': defaultToConfig2,
        'responseType': defaultToConfig2,
        'xsrfCookieName': defaultToConfig2,
        'xsrfHeaderName': defaultToConfig2,
        'onUploadProgress': defaultToConfig2,
        'onDownloadProgress': defaultToConfig2,
        'decompress': defaultToConfig2,
        'maxContentLength': defaultToConfig2,
        'maxBodyLength': defaultToConfig2,
        'transport': defaultToConfig2,
        'httpAgent': defaultToConfig2,
        'httpsAgent': defaultToConfig2,
        'cancelToken': defaultToConfig2,
        'socketPath': defaultToConfig2,
        'responseEncoding': defaultToConfig2,
        'validateStatus': mergeDirectKeys
      };

      utils.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
        var merge = mergeMap[prop] || mergeDeepProperties;
        var configValue = merge(prop);
        (utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
      });

      return config;
    };

    var data = {
      "version": "0.26.1"
    };

    var VERSION = data.version;

    var validators$1 = {};

    // eslint-disable-next-line func-names
    ['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
      validators$1[type] = function validator(thing) {
        return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
      };
    });

    var deprecatedWarnings = {};

    /**
     * Transitional option validator
     * @param {function|boolean?} validator - set to false if the transitional option has been removed
     * @param {string?} version - deprecated version / removed since version
     * @param {string?} message - some message with additional info
     * @returns {function}
     */
    validators$1.transitional = function transitional(validator, version, message) {
      function formatMessage(opt, desc) {
        return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
      }

      // eslint-disable-next-line func-names
      return function(value, opt, opts) {
        if (validator === false) {
          throw new Error(formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')));
        }

        if (version && !deprecatedWarnings[opt]) {
          deprecatedWarnings[opt] = true;
          // eslint-disable-next-line no-console
          console.warn(
            formatMessage(
              opt,
              ' has been deprecated since v' + version + ' and will be removed in the near future'
            )
          );
        }

        return validator ? validator(value, opt, opts) : true;
      };
    };

    /**
     * Assert object's properties type
     * @param {object} options
     * @param {object} schema
     * @param {boolean?} allowUnknown
     */

    function assertOptions(options, schema, allowUnknown) {
      if (typeof options !== 'object') {
        throw new TypeError('options must be an object');
      }
      var keys = Object.keys(options);
      var i = keys.length;
      while (i-- > 0) {
        var opt = keys[i];
        var validator = schema[opt];
        if (validator) {
          var value = options[opt];
          var result = value === undefined || validator(value, opt, options);
          if (result !== true) {
            throw new TypeError('option ' + opt + ' must be ' + result);
          }
          continue;
        }
        if (allowUnknown !== true) {
          throw Error('Unknown option ' + opt);
        }
      }
    }

    var validator = {
      assertOptions: assertOptions,
      validators: validators$1
    };

    var validators = validator.validators;
    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager_1(),
        response: new InterceptorManager_1()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios.prototype.request = function request(configOrUrl, config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof configOrUrl === 'string') {
        config = config || {};
        config.url = configOrUrl;
      } else {
        config = configOrUrl || {};
      }

      config = mergeConfig$1(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      var transitional = config.transitional;

      if (transitional !== undefined) {
        validator.assertOptions(transitional, {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean)
        }, false);
      }

      // filter out skipped interceptors
      var requestInterceptorChain = [];
      var synchronousRequestInterceptors = true;
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
          return;
        }

        synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      var responseInterceptorChain = [];
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      });

      var promise;

      if (!synchronousRequestInterceptors) {
        var chain = [dispatchRequest, undefined];

        Array.prototype.unshift.apply(chain, requestInterceptorChain);
        chain = chain.concat(responseInterceptorChain);

        promise = Promise.resolve(config);
        while (chain.length) {
          promise = promise.then(chain.shift(), chain.shift());
        }

        return promise;
      }


      var newConfig = config;
      while (requestInterceptorChain.length) {
        var onFulfilled = requestInterceptorChain.shift();
        var onRejected = requestInterceptorChain.shift();
        try {
          newConfig = onFulfilled(newConfig);
        } catch (error) {
          onRejected(error);
          break;
        }
      }

      try {
        promise = dispatchRequest(newConfig);
      } catch (error) {
        return Promise.reject(error);
      }

      while (responseInterceptorChain.length) {
        promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
      }

      return promise;
    };

    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig$1(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };

    // Provide aliases for supported request methods
    utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, config) {
        return this.request(mergeConfig$1(config || {}, {
          method: method,
          url: url,
          data: (config || {}).data
        }));
      };
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, data, config) {
        return this.request(mergeConfig$1(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });

    var Axios_1 = Axios;

    /**
     * A `CancelToken` is an object that can be used to request cancellation of an operation.
     *
     * @class
     * @param {Function} executor The executor function.
     */
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }

      var resolvePromise;

      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });

      var token = this;

      // eslint-disable-next-line func-names
      this.promise.then(function(cancel) {
        if (!token._listeners) return;

        var i;
        var l = token._listeners.length;

        for (i = 0; i < l; i++) {
          token._listeners[i](cancel);
        }
        token._listeners = null;
      });

      // eslint-disable-next-line func-names
      this.promise.then = function(onfulfilled) {
        var _resolve;
        // eslint-disable-next-line func-names
        var promise = new Promise(function(resolve) {
          token.subscribe(resolve);
          _resolve = resolve;
        }).then(onfulfilled);

        promise.cancel = function reject() {
          token.unsubscribe(_resolve);
        };

        return promise;
      };

      executor(function cancel(message) {
        if (token.reason) {
          // Cancellation has already been requested
          return;
        }

        token.reason = new Cancel_1(message);
        resolvePromise(token.reason);
      });
    }

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };

    /**
     * Subscribe to the cancel signal
     */

    CancelToken.prototype.subscribe = function subscribe(listener) {
      if (this.reason) {
        listener(this.reason);
        return;
      }

      if (this._listeners) {
        this._listeners.push(listener);
      } else {
        this._listeners = [listener];
      }
    };

    /**
     * Unsubscribe from the cancel signal
     */

    CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
      if (!this._listeners) {
        return;
      }
      var index = this._listeners.indexOf(listener);
      if (index !== -1) {
        this._listeners.splice(index, 1);
      }
    };

    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token: token,
        cancel: cancel
      };
    };

    var CancelToken_1 = CancelToken;

    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    var spread = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };

    /**
     * Determines whether the payload is an error thrown by Axios
     *
     * @param {*} payload The value to test
     * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
     */
    var isAxiosError = function isAxiosError(payload) {
      return utils.isObject(payload) && (payload.isAxiosError === true);
    };

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios_1(defaultConfig);
      var instance = bind$1(Axios_1.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios_1.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      // Factory for creating new instances
      instance.create = function create(instanceConfig) {
        return createInstance(mergeConfig$1(defaultConfig, instanceConfig));
      };

      return instance;
    }

    // Create the default instance to be exported
    var axios$1 = createInstance(defaults_1);

    // Expose Axios class to allow class inheritance
    axios$1.Axios = Axios_1;

    // Expose Cancel & CancelToken
    axios$1.Cancel = Cancel_1;
    axios$1.CancelToken = CancelToken_1;
    axios$1.isCancel = isCancel;
    axios$1.VERSION = data.version;

    // Expose all/spread
    axios$1.all = function all(promises) {
      return Promise.all(promises);
    };
    axios$1.spread = spread;

    // Expose isAxiosError
    axios$1.isAxiosError = isAxiosError;

    var axios_1 = axios$1;

    // Allow use of default import syntax in TypeScript
    var _default = axios$1;
    axios_1.default = _default;

    var axios = axios_1;

    /* src\components\Login.svelte generated by Svelte v3.53.1 */

    const { console: console_1$o } = globals;
    const file$u = "src\\components\\Login.svelte";

    // (52:4) {#if validation}
    function create_if_block$j(ctx) {
    	let p;
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*validation*/ ctx[2]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, /*validation*/ ctx[2]);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "color: red");
    			add_location(p, file$u, 52, 4, 1545);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*validation*/ 4) set_data_dev(t, /*validation*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$j.name,
    		type: "if",
    		source: "(52:4) {#if validation}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$x(ctx) {
    	let main;
    	let form;
    	let input0;
    	let input0_class_value;
    	let t0;
    	let input1;
    	let input1_class_value;
    	let t1;
    	let button;
    	let t2;
    	let t3;
    	let mounted;
    	let dispose;
    	let if_block = /*validation*/ ctx[2] && create_if_block$j(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			form = element("form");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			button = element("button");
    			t2 = text("LOGIN");
    			t3 = space();
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			main = claim_element(nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			form = claim_element(main_nodes, "FORM", { class: true });
    			var form_nodes = children(form);

    			input0 = claim_element(form_nodes, "INPUT", {
    				class: true,
    				type: true,
    				name: true,
    				placeholder: true
    			});

    			t0 = claim_space(form_nodes);

    			input1 = claim_element(form_nodes, "INPUT", {
    				class: true,
    				type: true,
    				name: true,
    				placeholder: true
    			});

    			t1 = claim_space(form_nodes);
    			button = claim_element(form_nodes, "BUTTON", { type: true });
    			var button_nodes = children(button);
    			t2 = claim_text(button_nodes, "LOGIN");
    			button_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			t3 = claim_space(main_nodes);
    			if (if_block) if_block.l(main_nodes);
    			main_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(input0, "class", input0_class_value = "" + (null_to_empty(/*validationCSS*/ ctx[3]) + " svelte-r87zbw"));
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "name", "username");
    			attr_dev(input0, "placeholder", "username");
    			input0.required = true;
    			add_location(input0, file$u, 47, 4, 1232);
    			attr_dev(input1, "class", input1_class_value = "" + (null_to_empty(/*validationCSS*/ ctx[3]) + " svelte-r87zbw"));
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "name", "password");
    			attr_dev(input1, "placeholder", "password");
    			input1.required = true;
    			add_location(input1, file$u, 48, 4, 1349);
    			attr_dev(button, "type", "submit");
    			add_location(button, file$u, 49, 4, 1470);
    			attr_dev(form, "class", "svelte-r87zbw");
    			add_location(form, file$u, 46, 0, 1181);
    			attr_dev(main, "class", "svelte-r87zbw");
    			add_location(main, file$u, 45, 0, 1173);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, main, anchor);
    			append_hydration_dev(main, form);
    			append_hydration_dev(form, input0);
    			set_input_value(input0, /*username*/ ctx[0]);
    			append_hydration_dev(form, t0);
    			append_hydration_dev(form, input1);
    			set_input_value(input1, /*password*/ ctx[1]);
    			append_hydration_dev(form, t1);
    			append_hydration_dev(form, button);
    			append_hydration_dev(button, t2);
    			append_hydration_dev(main, t3);
    			if (if_block) if_block.m(main, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen_dev(form, "submit", prevent_default(/*handleLogin*/ ctx[4]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*validationCSS*/ 8 && input0_class_value !== (input0_class_value = "" + (null_to_empty(/*validationCSS*/ ctx[3]) + " svelte-r87zbw"))) {
    				attr_dev(input0, "class", input0_class_value);
    			}

    			if (dirty & /*username*/ 1 && input0.value !== /*username*/ ctx[0]) {
    				set_input_value(input0, /*username*/ ctx[0]);
    			}

    			if (dirty & /*validationCSS*/ 8 && input1_class_value !== (input1_class_value = "" + (null_to_empty(/*validationCSS*/ ctx[3]) + " svelte-r87zbw"))) {
    				attr_dev(input1, "class", input1_class_value);
    			}

    			if (dirty & /*password*/ 2 && input1.value !== /*password*/ ctx[1]) {
    				set_input_value(input1, /*password*/ ctx[1]);
    			}

    			if (/*validation*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$j(ctx);
    					if_block.c();
    					if_block.m(main, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$x.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$x($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Login', slots, []);
    	let username;
    	let password;
    	let validation;
    	let validationCSS;

    	const handleLogin = e => {
    		axios.post("http://localhost:4000/api/auth/login", { username, password }).then(response => {
    			console.log('status', response.status);

    			if (response.status === 200) {
    				console.log('success');
    				localStorage.setItem('token', response.data.token);
    				token.set(localStorage.getItem('token'));
    				navigate('/dashboard', { replace: true });
    			} else {
    				$$invalidate(2, validation = "Invalid username or password");
    				$$invalidate(3, validationCSS = "validation");
    			}
    		}).catch(error => {
    			console.log(error);

    			if (error.response.status === 401) {
    				$$invalidate(2, validation = "Invalid username or password");
    			} else if (error.response.status === 400) {
    				$$invalidate(2, validation = "Invalid credentials");
    				$$invalidate(3, validationCSS = "validation");
    			}
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$o.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		username = this.value;
    		$$invalidate(0, username);
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(1, password);
    	}

    	$$self.$capture_state = () => ({
    		axios,
    		navigate,
    		token,
    		username,
    		password,
    		validation,
    		validationCSS,
    		handleLogin
    	});

    	$$self.$inject_state = $$props => {
    		if ('username' in $$props) $$invalidate(0, username = $$props.username);
    		if ('password' in $$props) $$invalidate(1, password = $$props.password);
    		if ('validation' in $$props) $$invalidate(2, validation = $$props.validation);
    		if ('validationCSS' in $$props) $$invalidate(3, validationCSS = $$props.validationCSS);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*username, password*/ 3) {
    			if (username || password) {
    				$$invalidate(2, validation = null);
    				$$invalidate(3, validationCSS = "");
    			}
    		}
    	};

    	return [
    		username,
    		password,
    		validation,
    		validationCSS,
    		handleLogin,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$x, create_fragment$x, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$x.name
    		});
    	}
    }

    var isMergeableObject = function isMergeableObject(value) {
    	return isNonNullObject(value)
    		&& !isSpecial(value)
    };

    function isNonNullObject(value) {
    	return !!value && typeof value === 'object'
    }

    function isSpecial(value) {
    	var stringValue = Object.prototype.toString.call(value);

    	return stringValue === '[object RegExp]'
    		|| stringValue === '[object Date]'
    		|| isReactElement(value)
    }

    // see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
    var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
    var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

    function isReactElement(value) {
    	return value.$$typeof === REACT_ELEMENT_TYPE
    }

    function emptyTarget(val) {
    	return Array.isArray(val) ? [] : {}
    }

    function cloneUnlessOtherwiseSpecified(value, options) {
    	return (options.clone !== false && options.isMergeableObject(value))
    		? deepmerge(emptyTarget(value), value, options)
    		: value
    }

    function defaultArrayMerge(target, source, options) {
    	return target.concat(source).map(function(element) {
    		return cloneUnlessOtherwiseSpecified(element, options)
    	})
    }

    function getMergeFunction(key, options) {
    	if (!options.customMerge) {
    		return deepmerge
    	}
    	var customMerge = options.customMerge(key);
    	return typeof customMerge === 'function' ? customMerge : deepmerge
    }

    function getEnumerableOwnPropertySymbols(target) {
    	return Object.getOwnPropertySymbols
    		? Object.getOwnPropertySymbols(target).filter(function(symbol) {
    			return target.propertyIsEnumerable(symbol)
    		})
    		: []
    }

    function getKeys(target) {
    	return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
    }

    function propertyIsOnObject(object, property) {
    	try {
    		return property in object
    	} catch(_) {
    		return false
    	}
    }

    // Protects from prototype poisoning and unexpected merging up the prototype chain.
    function propertyIsUnsafe(target, key) {
    	return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
    		&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
    			&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
    }

    function mergeObject(target, source, options) {
    	var destination = {};
    	if (options.isMergeableObject(target)) {
    		getKeys(target).forEach(function(key) {
    			destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
    		});
    	}
    	getKeys(source).forEach(function(key) {
    		if (propertyIsUnsafe(target, key)) {
    			return
    		}

    		if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
    			destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
    		} else {
    			destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
    		}
    	});
    	return destination
    }

    function deepmerge(target, source, options) {
    	options = options || {};
    	options.arrayMerge = options.arrayMerge || defaultArrayMerge;
    	options.isMergeableObject = options.isMergeableObject || isMergeableObject;
    	// cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
    	// implementations can use it. The caller may not replace it.
    	options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;

    	var sourceIsArray = Array.isArray(source);
    	var targetIsArray = Array.isArray(target);
    	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

    	if (!sourceAndTargetTypesMatch) {
    		return cloneUnlessOtherwiseSpecified(source, options)
    	} else if (sourceIsArray) {
    		return options.arrayMerge(target, source, options)
    	} else {
    		return mergeObject(target, source, options)
    	}
    }

    deepmerge.all = function deepmergeAll(array, options) {
    	if (!Array.isArray(array)) {
    		throw new Error('first argument should be an array')
    	}

    	return array.reduce(function(prev, next) {
    		return deepmerge(prev, next, options)
    	}, {})
    };

    var deepmerge_1 = deepmerge;

    var cjs = deepmerge_1;

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    var ErrorKind;
    (function (ErrorKind) {
        /** Argument is unclosed (e.g. `{0`) */
        ErrorKind[ErrorKind["EXPECT_ARGUMENT_CLOSING_BRACE"] = 1] = "EXPECT_ARGUMENT_CLOSING_BRACE";
        /** Argument is empty (e.g. `{}`). */
        ErrorKind[ErrorKind["EMPTY_ARGUMENT"] = 2] = "EMPTY_ARGUMENT";
        /** Argument is malformed (e.g. `{foo!}``) */
        ErrorKind[ErrorKind["MALFORMED_ARGUMENT"] = 3] = "MALFORMED_ARGUMENT";
        /** Expect an argument type (e.g. `{foo,}`) */
        ErrorKind[ErrorKind["EXPECT_ARGUMENT_TYPE"] = 4] = "EXPECT_ARGUMENT_TYPE";
        /** Unsupported argument type (e.g. `{foo,foo}`) */
        ErrorKind[ErrorKind["INVALID_ARGUMENT_TYPE"] = 5] = "INVALID_ARGUMENT_TYPE";
        /** Expect an argument style (e.g. `{foo, number, }`) */
        ErrorKind[ErrorKind["EXPECT_ARGUMENT_STYLE"] = 6] = "EXPECT_ARGUMENT_STYLE";
        /** The number skeleton is invalid. */
        ErrorKind[ErrorKind["INVALID_NUMBER_SKELETON"] = 7] = "INVALID_NUMBER_SKELETON";
        /** The date time skeleton is invalid. */
        ErrorKind[ErrorKind["INVALID_DATE_TIME_SKELETON"] = 8] = "INVALID_DATE_TIME_SKELETON";
        /** Exepct a number skeleton following the `::` (e.g. `{foo, number, ::}`) */
        ErrorKind[ErrorKind["EXPECT_NUMBER_SKELETON"] = 9] = "EXPECT_NUMBER_SKELETON";
        /** Exepct a date time skeleton following the `::` (e.g. `{foo, date, ::}`) */
        ErrorKind[ErrorKind["EXPECT_DATE_TIME_SKELETON"] = 10] = "EXPECT_DATE_TIME_SKELETON";
        /** Unmatched apostrophes in the argument style (e.g. `{foo, number, 'test`) */
        ErrorKind[ErrorKind["UNCLOSED_QUOTE_IN_ARGUMENT_STYLE"] = 11] = "UNCLOSED_QUOTE_IN_ARGUMENT_STYLE";
        /** Missing select argument options (e.g. `{foo, select}`) */
        ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_OPTIONS"] = 12] = "EXPECT_SELECT_ARGUMENT_OPTIONS";
        /** Expecting an offset value in `plural` or `selectordinal` argument (e.g `{foo, plural, offset}`) */
        ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE"] = 13] = "EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE";
        /** Offset value in `plural` or `selectordinal` is invalid (e.g. `{foo, plural, offset: x}`) */
        ErrorKind[ErrorKind["INVALID_PLURAL_ARGUMENT_OFFSET_VALUE"] = 14] = "INVALID_PLURAL_ARGUMENT_OFFSET_VALUE";
        /** Expecting a selector in `select` argument (e.g `{foo, select}`) */
        ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_SELECTOR"] = 15] = "EXPECT_SELECT_ARGUMENT_SELECTOR";
        /** Expecting a selector in `plural` or `selectordinal` argument (e.g `{foo, plural}`) */
        ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_SELECTOR"] = 16] = "EXPECT_PLURAL_ARGUMENT_SELECTOR";
        /** Expecting a message fragment after the `select` selector (e.g. `{foo, select, apple}`) */
        ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT"] = 17] = "EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT";
        /**
         * Expecting a message fragment after the `plural` or `selectordinal` selector
         * (e.g. `{foo, plural, one}`)
         */
        ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT"] = 18] = "EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT";
        /** Selector in `plural` or `selectordinal` is malformed (e.g. `{foo, plural, =x {#}}`) */
        ErrorKind[ErrorKind["INVALID_PLURAL_ARGUMENT_SELECTOR"] = 19] = "INVALID_PLURAL_ARGUMENT_SELECTOR";
        /**
         * Duplicate selectors in `plural` or `selectordinal` argument.
         * (e.g. {foo, plural, one {#} one {#}})
         */
        ErrorKind[ErrorKind["DUPLICATE_PLURAL_ARGUMENT_SELECTOR"] = 20] = "DUPLICATE_PLURAL_ARGUMENT_SELECTOR";
        /** Duplicate selectors in `select` argument.
         * (e.g. {foo, select, apple {apple} apple {apple}})
         */
        ErrorKind[ErrorKind["DUPLICATE_SELECT_ARGUMENT_SELECTOR"] = 21] = "DUPLICATE_SELECT_ARGUMENT_SELECTOR";
        /** Plural or select argument option must have `other` clause. */
        ErrorKind[ErrorKind["MISSING_OTHER_CLAUSE"] = 22] = "MISSING_OTHER_CLAUSE";
        /** The tag is malformed. (e.g. `<bold!>foo</bold!>) */
        ErrorKind[ErrorKind["INVALID_TAG"] = 23] = "INVALID_TAG";
        /** The tag name is invalid. (e.g. `<123>foo</123>`) */
        ErrorKind[ErrorKind["INVALID_TAG_NAME"] = 25] = "INVALID_TAG_NAME";
        /** The closing tag does not match the opening tag. (e.g. `<bold>foo</italic>`) */
        ErrorKind[ErrorKind["UNMATCHED_CLOSING_TAG"] = 26] = "UNMATCHED_CLOSING_TAG";
        /** The opening tag has unmatched closing tag. (e.g. `<bold>foo`) */
        ErrorKind[ErrorKind["UNCLOSED_TAG"] = 27] = "UNCLOSED_TAG";
    })(ErrorKind || (ErrorKind = {}));

    var TYPE;
    (function (TYPE) {
        /**
         * Raw text
         */
        TYPE[TYPE["literal"] = 0] = "literal";
        /**
         * Variable w/o any format, e.g `var` in `this is a {var}`
         */
        TYPE[TYPE["argument"] = 1] = "argument";
        /**
         * Variable w/ number format
         */
        TYPE[TYPE["number"] = 2] = "number";
        /**
         * Variable w/ date format
         */
        TYPE[TYPE["date"] = 3] = "date";
        /**
         * Variable w/ time format
         */
        TYPE[TYPE["time"] = 4] = "time";
        /**
         * Variable w/ select format
         */
        TYPE[TYPE["select"] = 5] = "select";
        /**
         * Variable w/ plural format
         */
        TYPE[TYPE["plural"] = 6] = "plural";
        /**
         * Only possible within plural argument.
         * This is the `#` symbol that will be substituted with the count.
         */
        TYPE[TYPE["pound"] = 7] = "pound";
        /**
         * XML-like tag
         */
        TYPE[TYPE["tag"] = 8] = "tag";
    })(TYPE || (TYPE = {}));
    var SKELETON_TYPE;
    (function (SKELETON_TYPE) {
        SKELETON_TYPE[SKELETON_TYPE["number"] = 0] = "number";
        SKELETON_TYPE[SKELETON_TYPE["dateTime"] = 1] = "dateTime";
    })(SKELETON_TYPE || (SKELETON_TYPE = {}));
    /**
     * Type Guards
     */
    function isLiteralElement(el) {
        return el.type === TYPE.literal;
    }
    function isArgumentElement(el) {
        return el.type === TYPE.argument;
    }
    function isNumberElement(el) {
        return el.type === TYPE.number;
    }
    function isDateElement(el) {
        return el.type === TYPE.date;
    }
    function isTimeElement(el) {
        return el.type === TYPE.time;
    }
    function isSelectElement(el) {
        return el.type === TYPE.select;
    }
    function isPluralElement(el) {
        return el.type === TYPE.plural;
    }
    function isPoundElement(el) {
        return el.type === TYPE.pound;
    }
    function isTagElement(el) {
        return el.type === TYPE.tag;
    }
    function isNumberSkeleton(el) {
        return !!(el && typeof el === 'object' && el.type === SKELETON_TYPE.number);
    }
    function isDateTimeSkeleton(el) {
        return !!(el && typeof el === 'object' && el.type === SKELETON_TYPE.dateTime);
    }

    // @generated from regex-gen.ts
    var SPACE_SEPARATOR_REGEX = /[ \xA0\u1680\u2000-\u200A\u202F\u205F\u3000]/;

    /**
     * https://unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
     * Credit: https://github.com/caridy/intl-datetimeformat-pattern/blob/master/index.js
     * with some tweaks
     */
    var DATE_TIME_REGEX = /(?:[Eec]{1,6}|G{1,5}|[Qq]{1,5}|(?:[yYur]+|U{1,5})|[ML]{1,5}|d{1,2}|D{1,3}|F{1}|[abB]{1,5}|[hkHK]{1,2}|w{1,2}|W{1}|m{1,2}|s{1,2}|[zZOvVxX]{1,4})(?=([^']*'[^']*')*[^']*$)/g;
    /**
     * Parse Date time skeleton into Intl.DateTimeFormatOptions
     * Ref: https://unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
     * @public
     * @param skeleton skeleton string
     */
    function parseDateTimeSkeleton(skeleton) {
        var result = {};
        skeleton.replace(DATE_TIME_REGEX, function (match) {
            var len = match.length;
            switch (match[0]) {
                // Era
                case 'G':
                    result.era = len === 4 ? 'long' : len === 5 ? 'narrow' : 'short';
                    break;
                // Year
                case 'y':
                    result.year = len === 2 ? '2-digit' : 'numeric';
                    break;
                case 'Y':
                case 'u':
                case 'U':
                case 'r':
                    throw new RangeError('`Y/u/U/r` (year) patterns are not supported, use `y` instead');
                // Quarter
                case 'q':
                case 'Q':
                    throw new RangeError('`q/Q` (quarter) patterns are not supported');
                // Month
                case 'M':
                case 'L':
                    result.month = ['numeric', '2-digit', 'short', 'long', 'narrow'][len - 1];
                    break;
                // Week
                case 'w':
                case 'W':
                    throw new RangeError('`w/W` (week) patterns are not supported');
                case 'd':
                    result.day = ['numeric', '2-digit'][len - 1];
                    break;
                case 'D':
                case 'F':
                case 'g':
                    throw new RangeError('`D/F/g` (day) patterns are not supported, use `d` instead');
                // Weekday
                case 'E':
                    result.weekday = len === 4 ? 'short' : len === 5 ? 'narrow' : 'short';
                    break;
                case 'e':
                    if (len < 4) {
                        throw new RangeError('`e..eee` (weekday) patterns are not supported');
                    }
                    result.weekday = ['short', 'long', 'narrow', 'short'][len - 4];
                    break;
                case 'c':
                    if (len < 4) {
                        throw new RangeError('`c..ccc` (weekday) patterns are not supported');
                    }
                    result.weekday = ['short', 'long', 'narrow', 'short'][len - 4];
                    break;
                // Period
                case 'a': // AM, PM
                    result.hour12 = true;
                    break;
                case 'b': // am, pm, noon, midnight
                case 'B': // flexible day periods
                    throw new RangeError('`b/B` (period) patterns are not supported, use `a` instead');
                // Hour
                case 'h':
                    result.hourCycle = 'h12';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'H':
                    result.hourCycle = 'h23';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'K':
                    result.hourCycle = 'h11';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'k':
                    result.hourCycle = 'h24';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'j':
                case 'J':
                case 'C':
                    throw new RangeError('`j/J/C` (hour) patterns are not supported, use `h/H/K/k` instead');
                // Minute
                case 'm':
                    result.minute = ['numeric', '2-digit'][len - 1];
                    break;
                // Second
                case 's':
                    result.second = ['numeric', '2-digit'][len - 1];
                    break;
                case 'S':
                case 'A':
                    throw new RangeError('`S/A` (second) patterns are not supported, use `s` instead');
                // Zone
                case 'z': // 1..3, 4: specific non-location format
                    result.timeZoneName = len < 4 ? 'short' : 'long';
                    break;
                case 'Z': // 1..3, 4, 5: The ISO8601 varios formats
                case 'O': // 1, 4: miliseconds in day short, long
                case 'v': // 1, 4: generic non-location format
                case 'V': // 1, 2, 3, 4: time zone ID or city
                case 'X': // 1, 2, 3, 4: The ISO8601 varios formats
                case 'x': // 1, 2, 3, 4: The ISO8601 varios formats
                    throw new RangeError('`Z/O/v/V/X/x` (timeZone) patterns are not supported, use `z` instead');
            }
            return '';
        });
        return result;
    }

    // @generated from regex-gen.ts
    var WHITE_SPACE_REGEX = /[\t-\r \x85\u200E\u200F\u2028\u2029]/i;

    function parseNumberSkeletonFromString(skeleton) {
        if (skeleton.length === 0) {
            throw new Error('Number skeleton cannot be empty');
        }
        // Parse the skeleton
        var stringTokens = skeleton
            .split(WHITE_SPACE_REGEX)
            .filter(function (x) { return x.length > 0; });
        var tokens = [];
        for (var _i = 0, stringTokens_1 = stringTokens; _i < stringTokens_1.length; _i++) {
            var stringToken = stringTokens_1[_i];
            var stemAndOptions = stringToken.split('/');
            if (stemAndOptions.length === 0) {
                throw new Error('Invalid number skeleton');
            }
            var stem = stemAndOptions[0], options = stemAndOptions.slice(1);
            for (var _a = 0, options_1 = options; _a < options_1.length; _a++) {
                var option = options_1[_a];
                if (option.length === 0) {
                    throw new Error('Invalid number skeleton');
                }
            }
            tokens.push({ stem: stem, options: options });
        }
        return tokens;
    }
    function icuUnitToEcma(unit) {
        return unit.replace(/^(.*?)-/, '');
    }
    var FRACTION_PRECISION_REGEX = /^\.(?:(0+)(\*)?|(#+)|(0+)(#+))$/g;
    var SIGNIFICANT_PRECISION_REGEX = /^(@+)?(\+|#+)?[rs]?$/g;
    var INTEGER_WIDTH_REGEX = /(\*)(0+)|(#+)(0+)|(0+)/g;
    var CONCISE_INTEGER_WIDTH_REGEX = /^(0+)$/;
    function parseSignificantPrecision(str) {
        var result = {};
        if (str[str.length - 1] === 'r') {
            result.roundingPriority = 'morePrecision';
        }
        else if (str[str.length - 1] === 's') {
            result.roundingPriority = 'lessPrecision';
        }
        str.replace(SIGNIFICANT_PRECISION_REGEX, function (_, g1, g2) {
            // @@@ case
            if (typeof g2 !== 'string') {
                result.minimumSignificantDigits = g1.length;
                result.maximumSignificantDigits = g1.length;
            }
            // @@@+ case
            else if (g2 === '+') {
                result.minimumSignificantDigits = g1.length;
            }
            // .### case
            else if (g1[0] === '#') {
                result.maximumSignificantDigits = g1.length;
            }
            // .@@## or .@@@ case
            else {
                result.minimumSignificantDigits = g1.length;
                result.maximumSignificantDigits =
                    g1.length + (typeof g2 === 'string' ? g2.length : 0);
            }
            return '';
        });
        return result;
    }
    function parseSign(str) {
        switch (str) {
            case 'sign-auto':
                return {
                    signDisplay: 'auto',
                };
            case 'sign-accounting':
            case '()':
                return {
                    currencySign: 'accounting',
                };
            case 'sign-always':
            case '+!':
                return {
                    signDisplay: 'always',
                };
            case 'sign-accounting-always':
            case '()!':
                return {
                    signDisplay: 'always',
                    currencySign: 'accounting',
                };
            case 'sign-except-zero':
            case '+?':
                return {
                    signDisplay: 'exceptZero',
                };
            case 'sign-accounting-except-zero':
            case '()?':
                return {
                    signDisplay: 'exceptZero',
                    currencySign: 'accounting',
                };
            case 'sign-never':
            case '+_':
                return {
                    signDisplay: 'never',
                };
        }
    }
    function parseConciseScientificAndEngineeringStem(stem) {
        // Engineering
        var result;
        if (stem[0] === 'E' && stem[1] === 'E') {
            result = {
                notation: 'engineering',
            };
            stem = stem.slice(2);
        }
        else if (stem[0] === 'E') {
            result = {
                notation: 'scientific',
            };
            stem = stem.slice(1);
        }
        if (result) {
            var signDisplay = stem.slice(0, 2);
            if (signDisplay === '+!') {
                result.signDisplay = 'always';
                stem = stem.slice(2);
            }
            else if (signDisplay === '+?') {
                result.signDisplay = 'exceptZero';
                stem = stem.slice(2);
            }
            if (!CONCISE_INTEGER_WIDTH_REGEX.test(stem)) {
                throw new Error('Malformed concise eng/scientific notation');
            }
            result.minimumIntegerDigits = stem.length;
        }
        return result;
    }
    function parseNotationOptions(opt) {
        var result = {};
        var signOpts = parseSign(opt);
        if (signOpts) {
            return signOpts;
        }
        return result;
    }
    /**
     * https://github.com/unicode-org/icu/blob/master/docs/userguide/format_parse/numbers/skeletons.md#skeleton-stems-and-options
     */
    function parseNumberSkeleton(tokens) {
        var result = {};
        for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
            var token = tokens_1[_i];
            switch (token.stem) {
                case 'percent':
                case '%':
                    result.style = 'percent';
                    continue;
                case '%x100':
                    result.style = 'percent';
                    result.scale = 100;
                    continue;
                case 'currency':
                    result.style = 'currency';
                    result.currency = token.options[0];
                    continue;
                case 'group-off':
                case ',_':
                    result.useGrouping = false;
                    continue;
                case 'precision-integer':
                case '.':
                    result.maximumFractionDigits = 0;
                    continue;
                case 'measure-unit':
                case 'unit':
                    result.style = 'unit';
                    result.unit = icuUnitToEcma(token.options[0]);
                    continue;
                case 'compact-short':
                case 'K':
                    result.notation = 'compact';
                    result.compactDisplay = 'short';
                    continue;
                case 'compact-long':
                case 'KK':
                    result.notation = 'compact';
                    result.compactDisplay = 'long';
                    continue;
                case 'scientific':
                    result = __assign(__assign(__assign({}, result), { notation: 'scientific' }), token.options.reduce(function (all, opt) { return (__assign(__assign({}, all), parseNotationOptions(opt))); }, {}));
                    continue;
                case 'engineering':
                    result = __assign(__assign(__assign({}, result), { notation: 'engineering' }), token.options.reduce(function (all, opt) { return (__assign(__assign({}, all), parseNotationOptions(opt))); }, {}));
                    continue;
                case 'notation-simple':
                    result.notation = 'standard';
                    continue;
                // https://github.com/unicode-org/icu/blob/master/icu4c/source/i18n/unicode/unumberformatter.h
                case 'unit-width-narrow':
                    result.currencyDisplay = 'narrowSymbol';
                    result.unitDisplay = 'narrow';
                    continue;
                case 'unit-width-short':
                    result.currencyDisplay = 'code';
                    result.unitDisplay = 'short';
                    continue;
                case 'unit-width-full-name':
                    result.currencyDisplay = 'name';
                    result.unitDisplay = 'long';
                    continue;
                case 'unit-width-iso-code':
                    result.currencyDisplay = 'symbol';
                    continue;
                case 'scale':
                    result.scale = parseFloat(token.options[0]);
                    continue;
                // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#integer-width
                case 'integer-width':
                    if (token.options.length > 1) {
                        throw new RangeError('integer-width stems only accept a single optional option');
                    }
                    token.options[0].replace(INTEGER_WIDTH_REGEX, function (_, g1, g2, g3, g4, g5) {
                        if (g1) {
                            result.minimumIntegerDigits = g2.length;
                        }
                        else if (g3 && g4) {
                            throw new Error('We currently do not support maximum integer digits');
                        }
                        else if (g5) {
                            throw new Error('We currently do not support exact integer digits');
                        }
                        return '';
                    });
                    continue;
            }
            // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#integer-width
            if (CONCISE_INTEGER_WIDTH_REGEX.test(token.stem)) {
                result.minimumIntegerDigits = token.stem.length;
                continue;
            }
            if (FRACTION_PRECISION_REGEX.test(token.stem)) {
                // Precision
                // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#fraction-precision
                // precision-integer case
                if (token.options.length > 1) {
                    throw new RangeError('Fraction-precision stems only accept a single optional option');
                }
                token.stem.replace(FRACTION_PRECISION_REGEX, function (_, g1, g2, g3, g4, g5) {
                    // .000* case (before ICU67 it was .000+)
                    if (g2 === '*') {
                        result.minimumFractionDigits = g1.length;
                    }
                    // .### case
                    else if (g3 && g3[0] === '#') {
                        result.maximumFractionDigits = g3.length;
                    }
                    // .00## case
                    else if (g4 && g5) {
                        result.minimumFractionDigits = g4.length;
                        result.maximumFractionDigits = g4.length + g5.length;
                    }
                    else {
                        result.minimumFractionDigits = g1.length;
                        result.maximumFractionDigits = g1.length;
                    }
                    return '';
                });
                var opt = token.options[0];
                // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#trailing-zero-display
                if (opt === 'w') {
                    result = __assign(__assign({}, result), { trailingZeroDisplay: 'stripIfInteger' });
                }
                else if (opt) {
                    result = __assign(__assign({}, result), parseSignificantPrecision(opt));
                }
                continue;
            }
            // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#significant-digits-precision
            if (SIGNIFICANT_PRECISION_REGEX.test(token.stem)) {
                result = __assign(__assign({}, result), parseSignificantPrecision(token.stem));
                continue;
            }
            var signOpts = parseSign(token.stem);
            if (signOpts) {
                result = __assign(__assign({}, result), signOpts);
            }
            var conciseScientificAndEngineeringOpts = parseConciseScientificAndEngineeringStem(token.stem);
            if (conciseScientificAndEngineeringOpts) {
                result = __assign(__assign({}, result), conciseScientificAndEngineeringOpts);
            }
        }
        return result;
    }

    // @generated from time-data-gen.ts
    // prettier-ignore  
    var timeData = {
        "AX": [
            "H"
        ],
        "BQ": [
            "H"
        ],
        "CP": [
            "H"
        ],
        "CZ": [
            "H"
        ],
        "DK": [
            "H"
        ],
        "FI": [
            "H"
        ],
        "ID": [
            "H"
        ],
        "IS": [
            "H"
        ],
        "ML": [
            "H"
        ],
        "NE": [
            "H"
        ],
        "RU": [
            "H"
        ],
        "SE": [
            "H"
        ],
        "SJ": [
            "H"
        ],
        "SK": [
            "H"
        ],
        "AS": [
            "h",
            "H"
        ],
        "BT": [
            "h",
            "H"
        ],
        "DJ": [
            "h",
            "H"
        ],
        "ER": [
            "h",
            "H"
        ],
        "GH": [
            "h",
            "H"
        ],
        "IN": [
            "h",
            "H"
        ],
        "LS": [
            "h",
            "H"
        ],
        "PG": [
            "h",
            "H"
        ],
        "PW": [
            "h",
            "H"
        ],
        "SO": [
            "h",
            "H"
        ],
        "TO": [
            "h",
            "H"
        ],
        "VU": [
            "h",
            "H"
        ],
        "WS": [
            "h",
            "H"
        ],
        "001": [
            "H",
            "h"
        ],
        "AL": [
            "h",
            "H",
            "hB"
        ],
        "TD": [
            "h",
            "H",
            "hB"
        ],
        "ca-ES": [
            "H",
            "h",
            "hB"
        ],
        "CF": [
            "H",
            "h",
            "hB"
        ],
        "CM": [
            "H",
            "h",
            "hB"
        ],
        "fr-CA": [
            "H",
            "h",
            "hB"
        ],
        "gl-ES": [
            "H",
            "h",
            "hB"
        ],
        "it-CH": [
            "H",
            "h",
            "hB"
        ],
        "it-IT": [
            "H",
            "h",
            "hB"
        ],
        "LU": [
            "H",
            "h",
            "hB"
        ],
        "NP": [
            "H",
            "h",
            "hB"
        ],
        "PF": [
            "H",
            "h",
            "hB"
        ],
        "SC": [
            "H",
            "h",
            "hB"
        ],
        "SM": [
            "H",
            "h",
            "hB"
        ],
        "SN": [
            "H",
            "h",
            "hB"
        ],
        "TF": [
            "H",
            "h",
            "hB"
        ],
        "VA": [
            "H",
            "h",
            "hB"
        ],
        "CY": [
            "h",
            "H",
            "hb",
            "hB"
        ],
        "GR": [
            "h",
            "H",
            "hb",
            "hB"
        ],
        "CO": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "DO": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "KP": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "KR": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "NA": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "PA": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "PR": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "VE": [
            "h",
            "H",
            "hB",
            "hb"
        ],
        "AC": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "AI": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "BW": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "BZ": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "CC": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "CK": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "CX": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "DG": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "FK": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "GB": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "GG": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "GI": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "IE": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "IM": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "IO": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "JE": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "LT": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "MK": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "MN": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "MS": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "NF": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "NG": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "NR": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "NU": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "PN": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "SH": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "SX": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "TA": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "ZA": [
            "H",
            "h",
            "hb",
            "hB"
        ],
        "af-ZA": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "AR": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "CL": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "CR": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "CU": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "EA": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "es-BO": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "es-BR": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "es-EC": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "es-ES": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "es-GQ": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "es-PE": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "GT": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "HN": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "IC": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "KG": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "KM": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "LK": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "MA": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "MX": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "NI": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "PY": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "SV": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "UY": [
            "H",
            "h",
            "hB",
            "hb"
        ],
        "JP": [
            "H",
            "h",
            "K"
        ],
        "AD": [
            "H",
            "hB"
        ],
        "AM": [
            "H",
            "hB"
        ],
        "AO": [
            "H",
            "hB"
        ],
        "AT": [
            "H",
            "hB"
        ],
        "AW": [
            "H",
            "hB"
        ],
        "BE": [
            "H",
            "hB"
        ],
        "BF": [
            "H",
            "hB"
        ],
        "BJ": [
            "H",
            "hB"
        ],
        "BL": [
            "H",
            "hB"
        ],
        "BR": [
            "H",
            "hB"
        ],
        "CG": [
            "H",
            "hB"
        ],
        "CI": [
            "H",
            "hB"
        ],
        "CV": [
            "H",
            "hB"
        ],
        "DE": [
            "H",
            "hB"
        ],
        "EE": [
            "H",
            "hB"
        ],
        "FR": [
            "H",
            "hB"
        ],
        "GA": [
            "H",
            "hB"
        ],
        "GF": [
            "H",
            "hB"
        ],
        "GN": [
            "H",
            "hB"
        ],
        "GP": [
            "H",
            "hB"
        ],
        "GW": [
            "H",
            "hB"
        ],
        "HR": [
            "H",
            "hB"
        ],
        "IL": [
            "H",
            "hB"
        ],
        "IT": [
            "H",
            "hB"
        ],
        "KZ": [
            "H",
            "hB"
        ],
        "MC": [
            "H",
            "hB"
        ],
        "MD": [
            "H",
            "hB"
        ],
        "MF": [
            "H",
            "hB"
        ],
        "MQ": [
            "H",
            "hB"
        ],
        "MZ": [
            "H",
            "hB"
        ],
        "NC": [
            "H",
            "hB"
        ],
        "NL": [
            "H",
            "hB"
        ],
        "PM": [
            "H",
            "hB"
        ],
        "PT": [
            "H",
            "hB"
        ],
        "RE": [
            "H",
            "hB"
        ],
        "RO": [
            "H",
            "hB"
        ],
        "SI": [
            "H",
            "hB"
        ],
        "SR": [
            "H",
            "hB"
        ],
        "ST": [
            "H",
            "hB"
        ],
        "TG": [
            "H",
            "hB"
        ],
        "TR": [
            "H",
            "hB"
        ],
        "WF": [
            "H",
            "hB"
        ],
        "YT": [
            "H",
            "hB"
        ],
        "BD": [
            "h",
            "hB",
            "H"
        ],
        "PK": [
            "h",
            "hB",
            "H"
        ],
        "AZ": [
            "H",
            "hB",
            "h"
        ],
        "BA": [
            "H",
            "hB",
            "h"
        ],
        "BG": [
            "H",
            "hB",
            "h"
        ],
        "CH": [
            "H",
            "hB",
            "h"
        ],
        "GE": [
            "H",
            "hB",
            "h"
        ],
        "LI": [
            "H",
            "hB",
            "h"
        ],
        "ME": [
            "H",
            "hB",
            "h"
        ],
        "RS": [
            "H",
            "hB",
            "h"
        ],
        "UA": [
            "H",
            "hB",
            "h"
        ],
        "UZ": [
            "H",
            "hB",
            "h"
        ],
        "XK": [
            "H",
            "hB",
            "h"
        ],
        "AG": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "AU": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "BB": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "BM": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "BS": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "CA": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "DM": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "en-001": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "FJ": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "FM": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "GD": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "GM": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "GU": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "GY": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "JM": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "KI": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "KN": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "KY": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "LC": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "LR": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "MH": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "MP": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "MW": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "NZ": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "SB": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "SG": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "SL": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "SS": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "SZ": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "TC": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "TT": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "UM": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "US": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "VC": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "VG": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "VI": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "ZM": [
            "h",
            "hb",
            "H",
            "hB"
        ],
        "BO": [
            "H",
            "hB",
            "h",
            "hb"
        ],
        "EC": [
            "H",
            "hB",
            "h",
            "hb"
        ],
        "ES": [
            "H",
            "hB",
            "h",
            "hb"
        ],
        "GQ": [
            "H",
            "hB",
            "h",
            "hb"
        ],
        "PE": [
            "H",
            "hB",
            "h",
            "hb"
        ],
        "AE": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "ar-001": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "BH": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "DZ": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "EG": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "EH": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "HK": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "IQ": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "JO": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "KW": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "LB": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "LY": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "MO": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "MR": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "OM": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "PH": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "PS": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "QA": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "SA": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "SD": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "SY": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "TN": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "YE": [
            "h",
            "hB",
            "hb",
            "H"
        ],
        "AF": [
            "H",
            "hb",
            "hB",
            "h"
        ],
        "LA": [
            "H",
            "hb",
            "hB",
            "h"
        ],
        "CN": [
            "H",
            "hB",
            "hb",
            "h"
        ],
        "LV": [
            "H",
            "hB",
            "hb",
            "h"
        ],
        "TL": [
            "H",
            "hB",
            "hb",
            "h"
        ],
        "zu-ZA": [
            "H",
            "hB",
            "hb",
            "h"
        ],
        "CD": [
            "hB",
            "H"
        ],
        "IR": [
            "hB",
            "H"
        ],
        "hi-IN": [
            "hB",
            "h",
            "H"
        ],
        "kn-IN": [
            "hB",
            "h",
            "H"
        ],
        "ml-IN": [
            "hB",
            "h",
            "H"
        ],
        "te-IN": [
            "hB",
            "h",
            "H"
        ],
        "KH": [
            "hB",
            "h",
            "H",
            "hb"
        ],
        "ta-IN": [
            "hB",
            "h",
            "hb",
            "H"
        ],
        "BN": [
            "hb",
            "hB",
            "h",
            "H"
        ],
        "MY": [
            "hb",
            "hB",
            "h",
            "H"
        ],
        "ET": [
            "hB",
            "hb",
            "h",
            "H"
        ],
        "gu-IN": [
            "hB",
            "hb",
            "h",
            "H"
        ],
        "mr-IN": [
            "hB",
            "hb",
            "h",
            "H"
        ],
        "pa-IN": [
            "hB",
            "hb",
            "h",
            "H"
        ],
        "TW": [
            "hB",
            "hb",
            "h",
            "H"
        ],
        "KE": [
            "hB",
            "hb",
            "H",
            "h"
        ],
        "MM": [
            "hB",
            "hb",
            "H",
            "h"
        ],
        "TZ": [
            "hB",
            "hb",
            "H",
            "h"
        ],
        "UG": [
            "hB",
            "hb",
            "H",
            "h"
        ]
    };

    /**
     * Returns the best matching date time pattern if a date time skeleton
     * pattern is provided with a locale. Follows the Unicode specification:
     * https://www.unicode.org/reports/tr35/tr35-dates.html#table-mapping-requested-time-skeletons-to-patterns
     * @param skeleton date time skeleton pattern that possibly includes j, J or C
     * @param locale
     */
    function getBestPattern(skeleton, locale) {
        var skeletonCopy = '';
        for (var patternPos = 0; patternPos < skeleton.length; patternPos++) {
            var patternChar = skeleton.charAt(patternPos);
            if (patternChar === 'j') {
                var extraLength = 0;
                while (patternPos + 1 < skeleton.length &&
                    skeleton.charAt(patternPos + 1) === patternChar) {
                    extraLength++;
                    patternPos++;
                }
                var hourLen = 1 + (extraLength & 1);
                var dayPeriodLen = extraLength < 2 ? 1 : 3 + (extraLength >> 1);
                var dayPeriodChar = 'a';
                var hourChar = getDefaultHourSymbolFromLocale(locale);
                if (hourChar == 'H' || hourChar == 'k') {
                    dayPeriodLen = 0;
                }
                while (dayPeriodLen-- > 0) {
                    skeletonCopy += dayPeriodChar;
                }
                while (hourLen-- > 0) {
                    skeletonCopy = hourChar + skeletonCopy;
                }
            }
            else if (patternChar === 'J') {
                skeletonCopy += 'H';
            }
            else {
                skeletonCopy += patternChar;
            }
        }
        return skeletonCopy;
    }
    /**
     * Maps the [hour cycle type](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/hourCycle)
     * of the given `locale` to the corresponding time pattern.
     * @param locale
     */
    function getDefaultHourSymbolFromLocale(locale) {
        var hourCycle = locale.hourCycle;
        if (hourCycle === undefined &&
            // @ts-ignore hourCycle(s) is not identified yet
            locale.hourCycles &&
            // @ts-ignore
            locale.hourCycles.length) {
            // @ts-ignore
            hourCycle = locale.hourCycles[0];
        }
        if (hourCycle) {
            switch (hourCycle) {
                case 'h24':
                    return 'k';
                case 'h23':
                    return 'H';
                case 'h12':
                    return 'h';
                case 'h11':
                    return 'K';
                default:
                    throw new Error('Invalid hourCycle');
            }
        }
        // TODO: Once hourCycle is fully supported remove the following with data generation
        var languageTag = locale.language;
        var regionTag;
        if (languageTag !== 'root') {
            regionTag = locale.maximize().region;
        }
        var hourCycles = timeData[regionTag || ''] ||
            timeData[languageTag || ''] ||
            timeData["".concat(languageTag, "-001")] ||
            timeData['001'];
        return hourCycles[0];
    }

    var _a;
    var SPACE_SEPARATOR_START_REGEX = new RegExp("^".concat(SPACE_SEPARATOR_REGEX.source, "*"));
    var SPACE_SEPARATOR_END_REGEX = new RegExp("".concat(SPACE_SEPARATOR_REGEX.source, "*$"));
    function createLocation(start, end) {
        return { start: start, end: end };
    }
    // #region Ponyfills
    // Consolidate these variables up top for easier toggling during debugging
    var hasNativeStartsWith = !!String.prototype.startsWith;
    var hasNativeFromCodePoint = !!String.fromCodePoint;
    var hasNativeFromEntries = !!Object.fromEntries;
    var hasNativeCodePointAt = !!String.prototype.codePointAt;
    var hasTrimStart = !!String.prototype.trimStart;
    var hasTrimEnd = !!String.prototype.trimEnd;
    var hasNativeIsSafeInteger = !!Number.isSafeInteger;
    var isSafeInteger = hasNativeIsSafeInteger
        ? Number.isSafeInteger
        : function (n) {
            return (typeof n === 'number' &&
                isFinite(n) &&
                Math.floor(n) === n &&
                Math.abs(n) <= 0x1fffffffffffff);
        };
    // IE11 does not support y and u.
    var REGEX_SUPPORTS_U_AND_Y = true;
    try {
        var re = RE('([^\\p{White_Space}\\p{Pattern_Syntax}]*)', 'yu');
        /**
         * legacy Edge or Xbox One browser
         * Unicode flag support: supported
         * Pattern_Syntax support: not supported
         * See https://github.com/formatjs/formatjs/issues/2822
         */
        REGEX_SUPPORTS_U_AND_Y = ((_a = re.exec('a')) === null || _a === void 0 ? void 0 : _a[0]) === 'a';
    }
    catch (_) {
        REGEX_SUPPORTS_U_AND_Y = false;
    }
    var startsWith = hasNativeStartsWith
        ? // Native
            function startsWith(s, search, position) {
                return s.startsWith(search, position);
            }
        : // For IE11
            function startsWith(s, search, position) {
                return s.slice(position, position + search.length) === search;
            };
    var fromCodePoint = hasNativeFromCodePoint
        ? String.fromCodePoint
        : // IE11
            function fromCodePoint() {
                var codePoints = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    codePoints[_i] = arguments[_i];
                }
                var elements = '';
                var length = codePoints.length;
                var i = 0;
                var code;
                while (length > i) {
                    code = codePoints[i++];
                    if (code > 0x10ffff)
                        throw RangeError(code + ' is not a valid code point');
                    elements +=
                        code < 0x10000
                            ? String.fromCharCode(code)
                            : String.fromCharCode(((code -= 0x10000) >> 10) + 0xd800, (code % 0x400) + 0xdc00);
                }
                return elements;
            };
    var fromEntries = 
    // native
    hasNativeFromEntries
        ? Object.fromEntries
        : // Ponyfill
            function fromEntries(entries) {
                var obj = {};
                for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                    var _a = entries_1[_i], k = _a[0], v = _a[1];
                    obj[k] = v;
                }
                return obj;
            };
    var codePointAt = hasNativeCodePointAt
        ? // Native
            function codePointAt(s, index) {
                return s.codePointAt(index);
            }
        : // IE 11
            function codePointAt(s, index) {
                var size = s.length;
                if (index < 0 || index >= size) {
                    return undefined;
                }
                var first = s.charCodeAt(index);
                var second;
                return first < 0xd800 ||
                    first > 0xdbff ||
                    index + 1 === size ||
                    (second = s.charCodeAt(index + 1)) < 0xdc00 ||
                    second > 0xdfff
                    ? first
                    : ((first - 0xd800) << 10) + (second - 0xdc00) + 0x10000;
            };
    var trimStart = hasTrimStart
        ? // Native
            function trimStart(s) {
                return s.trimStart();
            }
        : // Ponyfill
            function trimStart(s) {
                return s.replace(SPACE_SEPARATOR_START_REGEX, '');
            };
    var trimEnd = hasTrimEnd
        ? // Native
            function trimEnd(s) {
                return s.trimEnd();
            }
        : // Ponyfill
            function trimEnd(s) {
                return s.replace(SPACE_SEPARATOR_END_REGEX, '');
            };
    // Prevent minifier to translate new RegExp to literal form that might cause syntax error on IE11.
    function RE(s, flag) {
        return new RegExp(s, flag);
    }
    // #endregion
    var matchIdentifierAtIndex;
    if (REGEX_SUPPORTS_U_AND_Y) {
        // Native
        var IDENTIFIER_PREFIX_RE_1 = RE('([^\\p{White_Space}\\p{Pattern_Syntax}]*)', 'yu');
        matchIdentifierAtIndex = function matchIdentifierAtIndex(s, index) {
            var _a;
            IDENTIFIER_PREFIX_RE_1.lastIndex = index;
            var match = IDENTIFIER_PREFIX_RE_1.exec(s);
            return (_a = match[1]) !== null && _a !== void 0 ? _a : '';
        };
    }
    else {
        // IE11
        matchIdentifierAtIndex = function matchIdentifierAtIndex(s, index) {
            var match = [];
            while (true) {
                var c = codePointAt(s, index);
                if (c === undefined || _isWhiteSpace(c) || _isPatternSyntax(c)) {
                    break;
                }
                match.push(c);
                index += c >= 0x10000 ? 2 : 1;
            }
            return fromCodePoint.apply(void 0, match);
        };
    }
    var Parser = /** @class */ (function () {
        function Parser(message, options) {
            if (options === void 0) { options = {}; }
            this.message = message;
            this.position = { offset: 0, line: 1, column: 1 };
            this.ignoreTag = !!options.ignoreTag;
            this.locale = options.locale;
            this.requiresOtherClause = !!options.requiresOtherClause;
            this.shouldParseSkeletons = !!options.shouldParseSkeletons;
        }
        Parser.prototype.parse = function () {
            if (this.offset() !== 0) {
                throw Error('parser can only be used once');
            }
            return this.parseMessage(0, '', false);
        };
        Parser.prototype.parseMessage = function (nestingLevel, parentArgType, expectingCloseTag) {
            var elements = [];
            while (!this.isEOF()) {
                var char = this.char();
                if (char === 123 /* `{` */) {
                    var result = this.parseArgument(nestingLevel, expectingCloseTag);
                    if (result.err) {
                        return result;
                    }
                    elements.push(result.val);
                }
                else if (char === 125 /* `}` */ && nestingLevel > 0) {
                    break;
                }
                else if (char === 35 /* `#` */ &&
                    (parentArgType === 'plural' || parentArgType === 'selectordinal')) {
                    var position = this.clonePosition();
                    this.bump();
                    elements.push({
                        type: TYPE.pound,
                        location: createLocation(position, this.clonePosition()),
                    });
                }
                else if (char === 60 /* `<` */ &&
                    !this.ignoreTag &&
                    this.peek() === 47 // char code for '/'
                ) {
                    if (expectingCloseTag) {
                        break;
                    }
                    else {
                        return this.error(ErrorKind.UNMATCHED_CLOSING_TAG, createLocation(this.clonePosition(), this.clonePosition()));
                    }
                }
                else if (char === 60 /* `<` */ &&
                    !this.ignoreTag &&
                    _isAlpha(this.peek() || 0)) {
                    var result = this.parseTag(nestingLevel, parentArgType);
                    if (result.err) {
                        return result;
                    }
                    elements.push(result.val);
                }
                else {
                    var result = this.parseLiteral(nestingLevel, parentArgType);
                    if (result.err) {
                        return result;
                    }
                    elements.push(result.val);
                }
            }
            return { val: elements, err: null };
        };
        /**
         * A tag name must start with an ASCII lower/upper case letter. The grammar is based on the
         * [custom element name][] except that a dash is NOT always mandatory and uppercase letters
         * are accepted:
         *
         * ```
         * tag ::= "<" tagName (whitespace)* "/>" | "<" tagName (whitespace)* ">" message "</" tagName (whitespace)* ">"
         * tagName ::= [a-z] (PENChar)*
         * PENChar ::=
         *     "-" | "." | [0-9] | "_" | [a-z] | [A-Z] | #xB7 | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x37D] |
         *     [#x37F-#x1FFF] | [#x200C-#x200D] | [#x203F-#x2040] | [#x2070-#x218F] | [#x2C00-#x2FEF] |
         *     [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
         * ```
         *
         * [custom element name]: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
         * NOTE: We're a bit more lax here since HTML technically does not allow uppercase HTML element but we do
         * since other tag-based engines like React allow it
         */
        Parser.prototype.parseTag = function (nestingLevel, parentArgType) {
            var startPosition = this.clonePosition();
            this.bump(); // `<`
            var tagName = this.parseTagName();
            this.bumpSpace();
            if (this.bumpIf('/>')) {
                // Self closing tag
                return {
                    val: {
                        type: TYPE.literal,
                        value: "<".concat(tagName, "/>"),
                        location: createLocation(startPosition, this.clonePosition()),
                    },
                    err: null,
                };
            }
            else if (this.bumpIf('>')) {
                var childrenResult = this.parseMessage(nestingLevel + 1, parentArgType, true);
                if (childrenResult.err) {
                    return childrenResult;
                }
                var children = childrenResult.val;
                // Expecting a close tag
                var endTagStartPosition = this.clonePosition();
                if (this.bumpIf('</')) {
                    if (this.isEOF() || !_isAlpha(this.char())) {
                        return this.error(ErrorKind.INVALID_TAG, createLocation(endTagStartPosition, this.clonePosition()));
                    }
                    var closingTagNameStartPosition = this.clonePosition();
                    var closingTagName = this.parseTagName();
                    if (tagName !== closingTagName) {
                        return this.error(ErrorKind.UNMATCHED_CLOSING_TAG, createLocation(closingTagNameStartPosition, this.clonePosition()));
                    }
                    this.bumpSpace();
                    if (!this.bumpIf('>')) {
                        return this.error(ErrorKind.INVALID_TAG, createLocation(endTagStartPosition, this.clonePosition()));
                    }
                    return {
                        val: {
                            type: TYPE.tag,
                            value: tagName,
                            children: children,
                            location: createLocation(startPosition, this.clonePosition()),
                        },
                        err: null,
                    };
                }
                else {
                    return this.error(ErrorKind.UNCLOSED_TAG, createLocation(startPosition, this.clonePosition()));
                }
            }
            else {
                return this.error(ErrorKind.INVALID_TAG, createLocation(startPosition, this.clonePosition()));
            }
        };
        /**
         * This method assumes that the caller has peeked ahead for the first tag character.
         */
        Parser.prototype.parseTagName = function () {
            var startOffset = this.offset();
            this.bump(); // the first tag name character
            while (!this.isEOF() && _isPotentialElementNameChar(this.char())) {
                this.bump();
            }
            return this.message.slice(startOffset, this.offset());
        };
        Parser.prototype.parseLiteral = function (nestingLevel, parentArgType) {
            var start = this.clonePosition();
            var value = '';
            while (true) {
                var parseQuoteResult = this.tryParseQuote(parentArgType);
                if (parseQuoteResult) {
                    value += parseQuoteResult;
                    continue;
                }
                var parseUnquotedResult = this.tryParseUnquoted(nestingLevel, parentArgType);
                if (parseUnquotedResult) {
                    value += parseUnquotedResult;
                    continue;
                }
                var parseLeftAngleResult = this.tryParseLeftAngleBracket();
                if (parseLeftAngleResult) {
                    value += parseLeftAngleResult;
                    continue;
                }
                break;
            }
            var location = createLocation(start, this.clonePosition());
            return {
                val: { type: TYPE.literal, value: value, location: location },
                err: null,
            };
        };
        Parser.prototype.tryParseLeftAngleBracket = function () {
            if (!this.isEOF() &&
                this.char() === 60 /* `<` */ &&
                (this.ignoreTag ||
                    // If at the opening tag or closing tag position, bail.
                    !_isAlphaOrSlash(this.peek() || 0))) {
                this.bump(); // `<`
                return '<';
            }
            return null;
        };
        /**
         * Starting with ICU 4.8, an ASCII apostrophe only starts quoted text if it immediately precedes
         * a character that requires quoting (that is, "only where needed"), and works the same in
         * nested messages as on the top level of the pattern. The new behavior is otherwise compatible.
         */
        Parser.prototype.tryParseQuote = function (parentArgType) {
            if (this.isEOF() || this.char() !== 39 /* `'` */) {
                return null;
            }
            // Parse escaped char following the apostrophe, or early return if there is no escaped char.
            // Check if is valid escaped character
            switch (this.peek()) {
                case 39 /* `'` */:
                    // double quote, should return as a single quote.
                    this.bump();
                    this.bump();
                    return "'";
                // '{', '<', '>', '}'
                case 123:
                case 60:
                case 62:
                case 125:
                    break;
                case 35: // '#'
                    if (parentArgType === 'plural' || parentArgType === 'selectordinal') {
                        break;
                    }
                    return null;
                default:
                    return null;
            }
            this.bump(); // apostrophe
            var codePoints = [this.char()]; // escaped char
            this.bump();
            // read chars until the optional closing apostrophe is found
            while (!this.isEOF()) {
                var ch = this.char();
                if (ch === 39 /* `'` */) {
                    if (this.peek() === 39 /* `'` */) {
                        codePoints.push(39);
                        // Bump one more time because we need to skip 2 characters.
                        this.bump();
                    }
                    else {
                        // Optional closing apostrophe.
                        this.bump();
                        break;
                    }
                }
                else {
                    codePoints.push(ch);
                }
                this.bump();
            }
            return fromCodePoint.apply(void 0, codePoints);
        };
        Parser.prototype.tryParseUnquoted = function (nestingLevel, parentArgType) {
            if (this.isEOF()) {
                return null;
            }
            var ch = this.char();
            if (ch === 60 /* `<` */ ||
                ch === 123 /* `{` */ ||
                (ch === 35 /* `#` */ &&
                    (parentArgType === 'plural' || parentArgType === 'selectordinal')) ||
                (ch === 125 /* `}` */ && nestingLevel > 0)) {
                return null;
            }
            else {
                this.bump();
                return fromCodePoint(ch);
            }
        };
        Parser.prototype.parseArgument = function (nestingLevel, expectingCloseTag) {
            var openingBracePosition = this.clonePosition();
            this.bump(); // `{`
            this.bumpSpace();
            if (this.isEOF()) {
                return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
            }
            if (this.char() === 125 /* `}` */) {
                this.bump();
                return this.error(ErrorKind.EMPTY_ARGUMENT, createLocation(openingBracePosition, this.clonePosition()));
            }
            // argument name
            var value = this.parseIdentifierIfPossible().value;
            if (!value) {
                return this.error(ErrorKind.MALFORMED_ARGUMENT, createLocation(openingBracePosition, this.clonePosition()));
            }
            this.bumpSpace();
            if (this.isEOF()) {
                return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
            }
            switch (this.char()) {
                // Simple argument: `{name}`
                case 125 /* `}` */: {
                    this.bump(); // `}`
                    return {
                        val: {
                            type: TYPE.argument,
                            // value does not include the opening and closing braces.
                            value: value,
                            location: createLocation(openingBracePosition, this.clonePosition()),
                        },
                        err: null,
                    };
                }
                // Argument with options: `{name, format, ...}`
                case 44 /* `,` */: {
                    this.bump(); // `,`
                    this.bumpSpace();
                    if (this.isEOF()) {
                        return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
                    }
                    return this.parseArgumentOptions(nestingLevel, expectingCloseTag, value, openingBracePosition);
                }
                default:
                    return this.error(ErrorKind.MALFORMED_ARGUMENT, createLocation(openingBracePosition, this.clonePosition()));
            }
        };
        /**
         * Advance the parser until the end of the identifier, if it is currently on
         * an identifier character. Return an empty string otherwise.
         */
        Parser.prototype.parseIdentifierIfPossible = function () {
            var startingPosition = this.clonePosition();
            var startOffset = this.offset();
            var value = matchIdentifierAtIndex(this.message, startOffset);
            var endOffset = startOffset + value.length;
            this.bumpTo(endOffset);
            var endPosition = this.clonePosition();
            var location = createLocation(startingPosition, endPosition);
            return { value: value, location: location };
        };
        Parser.prototype.parseArgumentOptions = function (nestingLevel, expectingCloseTag, value, openingBracePosition) {
            var _a;
            // Parse this range:
            // {name, type, style}
            //        ^---^
            var typeStartPosition = this.clonePosition();
            var argType = this.parseIdentifierIfPossible().value;
            var typeEndPosition = this.clonePosition();
            switch (argType) {
                case '':
                    // Expecting a style string number, date, time, plural, selectordinal, or select.
                    return this.error(ErrorKind.EXPECT_ARGUMENT_TYPE, createLocation(typeStartPosition, typeEndPosition));
                case 'number':
                case 'date':
                case 'time': {
                    // Parse this range:
                    // {name, number, style}
                    //              ^-------^
                    this.bumpSpace();
                    var styleAndLocation = null;
                    if (this.bumpIf(',')) {
                        this.bumpSpace();
                        var styleStartPosition = this.clonePosition();
                        var result = this.parseSimpleArgStyleIfPossible();
                        if (result.err) {
                            return result;
                        }
                        var style = trimEnd(result.val);
                        if (style.length === 0) {
                            return this.error(ErrorKind.EXPECT_ARGUMENT_STYLE, createLocation(this.clonePosition(), this.clonePosition()));
                        }
                        var styleLocation = createLocation(styleStartPosition, this.clonePosition());
                        styleAndLocation = { style: style, styleLocation: styleLocation };
                    }
                    var argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                    if (argCloseResult.err) {
                        return argCloseResult;
                    }
                    var location_1 = createLocation(openingBracePosition, this.clonePosition());
                    // Extract style or skeleton
                    if (styleAndLocation && startsWith(styleAndLocation === null || styleAndLocation === void 0 ? void 0 : styleAndLocation.style, '::', 0)) {
                        // Skeleton starts with `::`.
                        var skeleton = trimStart(styleAndLocation.style.slice(2));
                        if (argType === 'number') {
                            var result = this.parseNumberSkeletonFromString(skeleton, styleAndLocation.styleLocation);
                            if (result.err) {
                                return result;
                            }
                            return {
                                val: { type: TYPE.number, value: value, location: location_1, style: result.val },
                                err: null,
                            };
                        }
                        else {
                            if (skeleton.length === 0) {
                                return this.error(ErrorKind.EXPECT_DATE_TIME_SKELETON, location_1);
                            }
                            var dateTimePattern = skeleton;
                            // Get "best match" pattern only if locale is passed, if not, let it
                            // pass as-is where `parseDateTimeSkeleton()` will throw an error
                            // for unsupported patterns.
                            if (this.locale) {
                                dateTimePattern = getBestPattern(skeleton, this.locale);
                            }
                            var style = {
                                type: SKELETON_TYPE.dateTime,
                                pattern: dateTimePattern,
                                location: styleAndLocation.styleLocation,
                                parsedOptions: this.shouldParseSkeletons
                                    ? parseDateTimeSkeleton(dateTimePattern)
                                    : {},
                            };
                            var type = argType === 'date' ? TYPE.date : TYPE.time;
                            return {
                                val: { type: type, value: value, location: location_1, style: style },
                                err: null,
                            };
                        }
                    }
                    // Regular style or no style.
                    return {
                        val: {
                            type: argType === 'number'
                                ? TYPE.number
                                : argType === 'date'
                                    ? TYPE.date
                                    : TYPE.time,
                            value: value,
                            location: location_1,
                            style: (_a = styleAndLocation === null || styleAndLocation === void 0 ? void 0 : styleAndLocation.style) !== null && _a !== void 0 ? _a : null,
                        },
                        err: null,
                    };
                }
                case 'plural':
                case 'selectordinal':
                case 'select': {
                    // Parse this range:
                    // {name, plural, options}
                    //              ^---------^
                    var typeEndPosition_1 = this.clonePosition();
                    this.bumpSpace();
                    if (!this.bumpIf(',')) {
                        return this.error(ErrorKind.EXPECT_SELECT_ARGUMENT_OPTIONS, createLocation(typeEndPosition_1, __assign({}, typeEndPosition_1)));
                    }
                    this.bumpSpace();
                    // Parse offset:
                    // {name, plural, offset:1, options}
                    //                ^-----^
                    //
                    // or the first option:
                    //
                    // {name, plural, one {...} other {...}}
                    //                ^--^
                    var identifierAndLocation = this.parseIdentifierIfPossible();
                    var pluralOffset = 0;
                    if (argType !== 'select' && identifierAndLocation.value === 'offset') {
                        if (!this.bumpIf(':')) {
                            return this.error(ErrorKind.EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE, createLocation(this.clonePosition(), this.clonePosition()));
                        }
                        this.bumpSpace();
                        var result = this.tryParseDecimalInteger(ErrorKind.EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE, ErrorKind.INVALID_PLURAL_ARGUMENT_OFFSET_VALUE);
                        if (result.err) {
                            return result;
                        }
                        // Parse another identifier for option parsing
                        this.bumpSpace();
                        identifierAndLocation = this.parseIdentifierIfPossible();
                        pluralOffset = result.val;
                    }
                    var optionsResult = this.tryParsePluralOrSelectOptions(nestingLevel, argType, expectingCloseTag, identifierAndLocation);
                    if (optionsResult.err) {
                        return optionsResult;
                    }
                    var argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                    if (argCloseResult.err) {
                        return argCloseResult;
                    }
                    var location_2 = createLocation(openingBracePosition, this.clonePosition());
                    if (argType === 'select') {
                        return {
                            val: {
                                type: TYPE.select,
                                value: value,
                                options: fromEntries(optionsResult.val),
                                location: location_2,
                            },
                            err: null,
                        };
                    }
                    else {
                        return {
                            val: {
                                type: TYPE.plural,
                                value: value,
                                options: fromEntries(optionsResult.val),
                                offset: pluralOffset,
                                pluralType: argType === 'plural' ? 'cardinal' : 'ordinal',
                                location: location_2,
                            },
                            err: null,
                        };
                    }
                }
                default:
                    return this.error(ErrorKind.INVALID_ARGUMENT_TYPE, createLocation(typeStartPosition, typeEndPosition));
            }
        };
        Parser.prototype.tryParseArgumentClose = function (openingBracePosition) {
            // Parse: {value, number, ::currency/GBP }
            //
            if (this.isEOF() || this.char() !== 125 /* `}` */) {
                return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
            }
            this.bump(); // `}`
            return { val: true, err: null };
        };
        /**
         * See: https://github.com/unicode-org/icu/blob/af7ed1f6d2298013dc303628438ec4abe1f16479/icu4c/source/common/messagepattern.cpp#L659
         */
        Parser.prototype.parseSimpleArgStyleIfPossible = function () {
            var nestedBraces = 0;
            var startPosition = this.clonePosition();
            while (!this.isEOF()) {
                var ch = this.char();
                switch (ch) {
                    case 39 /* `'` */: {
                        // Treat apostrophe as quoting but include it in the style part.
                        // Find the end of the quoted literal text.
                        this.bump();
                        var apostrophePosition = this.clonePosition();
                        if (!this.bumpUntil("'")) {
                            return this.error(ErrorKind.UNCLOSED_QUOTE_IN_ARGUMENT_STYLE, createLocation(apostrophePosition, this.clonePosition()));
                        }
                        this.bump();
                        break;
                    }
                    case 123 /* `{` */: {
                        nestedBraces += 1;
                        this.bump();
                        break;
                    }
                    case 125 /* `}` */: {
                        if (nestedBraces > 0) {
                            nestedBraces -= 1;
                        }
                        else {
                            return {
                                val: this.message.slice(startPosition.offset, this.offset()),
                                err: null,
                            };
                        }
                        break;
                    }
                    default:
                        this.bump();
                        break;
                }
            }
            return {
                val: this.message.slice(startPosition.offset, this.offset()),
                err: null,
            };
        };
        Parser.prototype.parseNumberSkeletonFromString = function (skeleton, location) {
            var tokens = [];
            try {
                tokens = parseNumberSkeletonFromString(skeleton);
            }
            catch (e) {
                return this.error(ErrorKind.INVALID_NUMBER_SKELETON, location);
            }
            return {
                val: {
                    type: SKELETON_TYPE.number,
                    tokens: tokens,
                    location: location,
                    parsedOptions: this.shouldParseSkeletons
                        ? parseNumberSkeleton(tokens)
                        : {},
                },
                err: null,
            };
        };
        /**
         * @param nesting_level The current nesting level of messages.
         *     This can be positive when parsing message fragment in select or plural argument options.
         * @param parent_arg_type The parent argument's type.
         * @param parsed_first_identifier If provided, this is the first identifier-like selector of
         *     the argument. It is a by-product of a previous parsing attempt.
         * @param expecting_close_tag If true, this message is directly or indirectly nested inside
         *     between a pair of opening and closing tags. The nested message will not parse beyond
         *     the closing tag boundary.
         */
        Parser.prototype.tryParsePluralOrSelectOptions = function (nestingLevel, parentArgType, expectCloseTag, parsedFirstIdentifier) {
            var _a;
            var hasOtherClause = false;
            var options = [];
            var parsedSelectors = new Set();
            var selector = parsedFirstIdentifier.value, selectorLocation = parsedFirstIdentifier.location;
            // Parse:
            // one {one apple}
            // ^--^
            while (true) {
                if (selector.length === 0) {
                    var startPosition = this.clonePosition();
                    if (parentArgType !== 'select' && this.bumpIf('=')) {
                        // Try parse `={number}` selector
                        var result = this.tryParseDecimalInteger(ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR, ErrorKind.INVALID_PLURAL_ARGUMENT_SELECTOR);
                        if (result.err) {
                            return result;
                        }
                        selectorLocation = createLocation(startPosition, this.clonePosition());
                        selector = this.message.slice(startPosition.offset, this.offset());
                    }
                    else {
                        break;
                    }
                }
                // Duplicate selector clauses
                if (parsedSelectors.has(selector)) {
                    return this.error(parentArgType === 'select'
                        ? ErrorKind.DUPLICATE_SELECT_ARGUMENT_SELECTOR
                        : ErrorKind.DUPLICATE_PLURAL_ARGUMENT_SELECTOR, selectorLocation);
                }
                if (selector === 'other') {
                    hasOtherClause = true;
                }
                // Parse:
                // one {one apple}
                //     ^----------^
                this.bumpSpace();
                var openingBracePosition = this.clonePosition();
                if (!this.bumpIf('{')) {
                    return this.error(parentArgType === 'select'
                        ? ErrorKind.EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT
                        : ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT, createLocation(this.clonePosition(), this.clonePosition()));
                }
                var fragmentResult = this.parseMessage(nestingLevel + 1, parentArgType, expectCloseTag);
                if (fragmentResult.err) {
                    return fragmentResult;
                }
                var argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                if (argCloseResult.err) {
                    return argCloseResult;
                }
                options.push([
                    selector,
                    {
                        value: fragmentResult.val,
                        location: createLocation(openingBracePosition, this.clonePosition()),
                    },
                ]);
                // Keep track of the existing selectors
                parsedSelectors.add(selector);
                // Prep next selector clause.
                this.bumpSpace();
                (_a = this.parseIdentifierIfPossible(), selector = _a.value, selectorLocation = _a.location);
            }
            if (options.length === 0) {
                return this.error(parentArgType === 'select'
                    ? ErrorKind.EXPECT_SELECT_ARGUMENT_SELECTOR
                    : ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR, createLocation(this.clonePosition(), this.clonePosition()));
            }
            if (this.requiresOtherClause && !hasOtherClause) {
                return this.error(ErrorKind.MISSING_OTHER_CLAUSE, createLocation(this.clonePosition(), this.clonePosition()));
            }
            return { val: options, err: null };
        };
        Parser.prototype.tryParseDecimalInteger = function (expectNumberError, invalidNumberError) {
            var sign = 1;
            var startingPosition = this.clonePosition();
            if (this.bumpIf('+')) ;
            else if (this.bumpIf('-')) {
                sign = -1;
            }
            var hasDigits = false;
            var decimal = 0;
            while (!this.isEOF()) {
                var ch = this.char();
                if (ch >= 48 /* `0` */ && ch <= 57 /* `9` */) {
                    hasDigits = true;
                    decimal = decimal * 10 + (ch - 48);
                    this.bump();
                }
                else {
                    break;
                }
            }
            var location = createLocation(startingPosition, this.clonePosition());
            if (!hasDigits) {
                return this.error(expectNumberError, location);
            }
            decimal *= sign;
            if (!isSafeInteger(decimal)) {
                return this.error(invalidNumberError, location);
            }
            return { val: decimal, err: null };
        };
        Parser.prototype.offset = function () {
            return this.position.offset;
        };
        Parser.prototype.isEOF = function () {
            return this.offset() === this.message.length;
        };
        Parser.prototype.clonePosition = function () {
            // This is much faster than `Object.assign` or spread.
            return {
                offset: this.position.offset,
                line: this.position.line,
                column: this.position.column,
            };
        };
        /**
         * Return the code point at the current position of the parser.
         * Throws if the index is out of bound.
         */
        Parser.prototype.char = function () {
            var offset = this.position.offset;
            if (offset >= this.message.length) {
                throw Error('out of bound');
            }
            var code = codePointAt(this.message, offset);
            if (code === undefined) {
                throw Error("Offset ".concat(offset, " is at invalid UTF-16 code unit boundary"));
            }
            return code;
        };
        Parser.prototype.error = function (kind, location) {
            return {
                val: null,
                err: {
                    kind: kind,
                    message: this.message,
                    location: location,
                },
            };
        };
        /** Bump the parser to the next UTF-16 code unit. */
        Parser.prototype.bump = function () {
            if (this.isEOF()) {
                return;
            }
            var code = this.char();
            if (code === 10 /* '\n' */) {
                this.position.line += 1;
                this.position.column = 1;
                this.position.offset += 1;
            }
            else {
                this.position.column += 1;
                // 0 ~ 0x10000 -> unicode BMP, otherwise skip the surrogate pair.
                this.position.offset += code < 0x10000 ? 1 : 2;
            }
        };
        /**
         * If the substring starting at the current position of the parser has
         * the given prefix, then bump the parser to the character immediately
         * following the prefix and return true. Otherwise, don't bump the parser
         * and return false.
         */
        Parser.prototype.bumpIf = function (prefix) {
            if (startsWith(this.message, prefix, this.offset())) {
                for (var i = 0; i < prefix.length; i++) {
                    this.bump();
                }
                return true;
            }
            return false;
        };
        /**
         * Bump the parser until the pattern character is found and return `true`.
         * Otherwise bump to the end of the file and return `false`.
         */
        Parser.prototype.bumpUntil = function (pattern) {
            var currentOffset = this.offset();
            var index = this.message.indexOf(pattern, currentOffset);
            if (index >= 0) {
                this.bumpTo(index);
                return true;
            }
            else {
                this.bumpTo(this.message.length);
                return false;
            }
        };
        /**
         * Bump the parser to the target offset.
         * If target offset is beyond the end of the input, bump the parser to the end of the input.
         */
        Parser.prototype.bumpTo = function (targetOffset) {
            if (this.offset() > targetOffset) {
                throw Error("targetOffset ".concat(targetOffset, " must be greater than or equal to the current offset ").concat(this.offset()));
            }
            targetOffset = Math.min(targetOffset, this.message.length);
            while (true) {
                var offset = this.offset();
                if (offset === targetOffset) {
                    break;
                }
                if (offset > targetOffset) {
                    throw Error("targetOffset ".concat(targetOffset, " is at invalid UTF-16 code unit boundary"));
                }
                this.bump();
                if (this.isEOF()) {
                    break;
                }
            }
        };
        /** advance the parser through all whitespace to the next non-whitespace code unit. */
        Parser.prototype.bumpSpace = function () {
            while (!this.isEOF() && _isWhiteSpace(this.char())) {
                this.bump();
            }
        };
        /**
         * Peek at the *next* Unicode codepoint in the input without advancing the parser.
         * If the input has been exhausted, then this returns null.
         */
        Parser.prototype.peek = function () {
            if (this.isEOF()) {
                return null;
            }
            var code = this.char();
            var offset = this.offset();
            var nextCode = this.message.charCodeAt(offset + (code >= 0x10000 ? 2 : 1));
            return nextCode !== null && nextCode !== void 0 ? nextCode : null;
        };
        return Parser;
    }());
    /**
     * This check if codepoint is alphabet (lower & uppercase)
     * @param codepoint
     * @returns
     */
    function _isAlpha(codepoint) {
        return ((codepoint >= 97 && codepoint <= 122) ||
            (codepoint >= 65 && codepoint <= 90));
    }
    function _isAlphaOrSlash(codepoint) {
        return _isAlpha(codepoint) || codepoint === 47; /* '/' */
    }
    /** See `parseTag` function docs. */
    function _isPotentialElementNameChar(c) {
        return (c === 45 /* '-' */ ||
            c === 46 /* '.' */ ||
            (c >= 48 && c <= 57) /* 0..9 */ ||
            c === 95 /* '_' */ ||
            (c >= 97 && c <= 122) /** a..z */ ||
            (c >= 65 && c <= 90) /* A..Z */ ||
            c == 0xb7 ||
            (c >= 0xc0 && c <= 0xd6) ||
            (c >= 0xd8 && c <= 0xf6) ||
            (c >= 0xf8 && c <= 0x37d) ||
            (c >= 0x37f && c <= 0x1fff) ||
            (c >= 0x200c && c <= 0x200d) ||
            (c >= 0x203f && c <= 0x2040) ||
            (c >= 0x2070 && c <= 0x218f) ||
            (c >= 0x2c00 && c <= 0x2fef) ||
            (c >= 0x3001 && c <= 0xd7ff) ||
            (c >= 0xf900 && c <= 0xfdcf) ||
            (c >= 0xfdf0 && c <= 0xfffd) ||
            (c >= 0x10000 && c <= 0xeffff));
    }
    /**
     * Code point equivalent of regex `\p{White_Space}`.
     * From: https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt
     */
    function _isWhiteSpace(c) {
        return ((c >= 0x0009 && c <= 0x000d) ||
            c === 0x0020 ||
            c === 0x0085 ||
            (c >= 0x200e && c <= 0x200f) ||
            c === 0x2028 ||
            c === 0x2029);
    }
    /**
     * Code point equivalent of regex `\p{Pattern_Syntax}`.
     * See https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt
     */
    function _isPatternSyntax(c) {
        return ((c >= 0x0021 && c <= 0x0023) ||
            c === 0x0024 ||
            (c >= 0x0025 && c <= 0x0027) ||
            c === 0x0028 ||
            c === 0x0029 ||
            c === 0x002a ||
            c === 0x002b ||
            c === 0x002c ||
            c === 0x002d ||
            (c >= 0x002e && c <= 0x002f) ||
            (c >= 0x003a && c <= 0x003b) ||
            (c >= 0x003c && c <= 0x003e) ||
            (c >= 0x003f && c <= 0x0040) ||
            c === 0x005b ||
            c === 0x005c ||
            c === 0x005d ||
            c === 0x005e ||
            c === 0x0060 ||
            c === 0x007b ||
            c === 0x007c ||
            c === 0x007d ||
            c === 0x007e ||
            c === 0x00a1 ||
            (c >= 0x00a2 && c <= 0x00a5) ||
            c === 0x00a6 ||
            c === 0x00a7 ||
            c === 0x00a9 ||
            c === 0x00ab ||
            c === 0x00ac ||
            c === 0x00ae ||
            c === 0x00b0 ||
            c === 0x00b1 ||
            c === 0x00b6 ||
            c === 0x00bb ||
            c === 0x00bf ||
            c === 0x00d7 ||
            c === 0x00f7 ||
            (c >= 0x2010 && c <= 0x2015) ||
            (c >= 0x2016 && c <= 0x2017) ||
            c === 0x2018 ||
            c === 0x2019 ||
            c === 0x201a ||
            (c >= 0x201b && c <= 0x201c) ||
            c === 0x201d ||
            c === 0x201e ||
            c === 0x201f ||
            (c >= 0x2020 && c <= 0x2027) ||
            (c >= 0x2030 && c <= 0x2038) ||
            c === 0x2039 ||
            c === 0x203a ||
            (c >= 0x203b && c <= 0x203e) ||
            (c >= 0x2041 && c <= 0x2043) ||
            c === 0x2044 ||
            c === 0x2045 ||
            c === 0x2046 ||
            (c >= 0x2047 && c <= 0x2051) ||
            c === 0x2052 ||
            c === 0x2053 ||
            (c >= 0x2055 && c <= 0x205e) ||
            (c >= 0x2190 && c <= 0x2194) ||
            (c >= 0x2195 && c <= 0x2199) ||
            (c >= 0x219a && c <= 0x219b) ||
            (c >= 0x219c && c <= 0x219f) ||
            c === 0x21a0 ||
            (c >= 0x21a1 && c <= 0x21a2) ||
            c === 0x21a3 ||
            (c >= 0x21a4 && c <= 0x21a5) ||
            c === 0x21a6 ||
            (c >= 0x21a7 && c <= 0x21ad) ||
            c === 0x21ae ||
            (c >= 0x21af && c <= 0x21cd) ||
            (c >= 0x21ce && c <= 0x21cf) ||
            (c >= 0x21d0 && c <= 0x21d1) ||
            c === 0x21d2 ||
            c === 0x21d3 ||
            c === 0x21d4 ||
            (c >= 0x21d5 && c <= 0x21f3) ||
            (c >= 0x21f4 && c <= 0x22ff) ||
            (c >= 0x2300 && c <= 0x2307) ||
            c === 0x2308 ||
            c === 0x2309 ||
            c === 0x230a ||
            c === 0x230b ||
            (c >= 0x230c && c <= 0x231f) ||
            (c >= 0x2320 && c <= 0x2321) ||
            (c >= 0x2322 && c <= 0x2328) ||
            c === 0x2329 ||
            c === 0x232a ||
            (c >= 0x232b && c <= 0x237b) ||
            c === 0x237c ||
            (c >= 0x237d && c <= 0x239a) ||
            (c >= 0x239b && c <= 0x23b3) ||
            (c >= 0x23b4 && c <= 0x23db) ||
            (c >= 0x23dc && c <= 0x23e1) ||
            (c >= 0x23e2 && c <= 0x2426) ||
            (c >= 0x2427 && c <= 0x243f) ||
            (c >= 0x2440 && c <= 0x244a) ||
            (c >= 0x244b && c <= 0x245f) ||
            (c >= 0x2500 && c <= 0x25b6) ||
            c === 0x25b7 ||
            (c >= 0x25b8 && c <= 0x25c0) ||
            c === 0x25c1 ||
            (c >= 0x25c2 && c <= 0x25f7) ||
            (c >= 0x25f8 && c <= 0x25ff) ||
            (c >= 0x2600 && c <= 0x266e) ||
            c === 0x266f ||
            (c >= 0x2670 && c <= 0x2767) ||
            c === 0x2768 ||
            c === 0x2769 ||
            c === 0x276a ||
            c === 0x276b ||
            c === 0x276c ||
            c === 0x276d ||
            c === 0x276e ||
            c === 0x276f ||
            c === 0x2770 ||
            c === 0x2771 ||
            c === 0x2772 ||
            c === 0x2773 ||
            c === 0x2774 ||
            c === 0x2775 ||
            (c >= 0x2794 && c <= 0x27bf) ||
            (c >= 0x27c0 && c <= 0x27c4) ||
            c === 0x27c5 ||
            c === 0x27c6 ||
            (c >= 0x27c7 && c <= 0x27e5) ||
            c === 0x27e6 ||
            c === 0x27e7 ||
            c === 0x27e8 ||
            c === 0x27e9 ||
            c === 0x27ea ||
            c === 0x27eb ||
            c === 0x27ec ||
            c === 0x27ed ||
            c === 0x27ee ||
            c === 0x27ef ||
            (c >= 0x27f0 && c <= 0x27ff) ||
            (c >= 0x2800 && c <= 0x28ff) ||
            (c >= 0x2900 && c <= 0x2982) ||
            c === 0x2983 ||
            c === 0x2984 ||
            c === 0x2985 ||
            c === 0x2986 ||
            c === 0x2987 ||
            c === 0x2988 ||
            c === 0x2989 ||
            c === 0x298a ||
            c === 0x298b ||
            c === 0x298c ||
            c === 0x298d ||
            c === 0x298e ||
            c === 0x298f ||
            c === 0x2990 ||
            c === 0x2991 ||
            c === 0x2992 ||
            c === 0x2993 ||
            c === 0x2994 ||
            c === 0x2995 ||
            c === 0x2996 ||
            c === 0x2997 ||
            c === 0x2998 ||
            (c >= 0x2999 && c <= 0x29d7) ||
            c === 0x29d8 ||
            c === 0x29d9 ||
            c === 0x29da ||
            c === 0x29db ||
            (c >= 0x29dc && c <= 0x29fb) ||
            c === 0x29fc ||
            c === 0x29fd ||
            (c >= 0x29fe && c <= 0x2aff) ||
            (c >= 0x2b00 && c <= 0x2b2f) ||
            (c >= 0x2b30 && c <= 0x2b44) ||
            (c >= 0x2b45 && c <= 0x2b46) ||
            (c >= 0x2b47 && c <= 0x2b4c) ||
            (c >= 0x2b4d && c <= 0x2b73) ||
            (c >= 0x2b74 && c <= 0x2b75) ||
            (c >= 0x2b76 && c <= 0x2b95) ||
            c === 0x2b96 ||
            (c >= 0x2b97 && c <= 0x2bff) ||
            (c >= 0x2e00 && c <= 0x2e01) ||
            c === 0x2e02 ||
            c === 0x2e03 ||
            c === 0x2e04 ||
            c === 0x2e05 ||
            (c >= 0x2e06 && c <= 0x2e08) ||
            c === 0x2e09 ||
            c === 0x2e0a ||
            c === 0x2e0b ||
            c === 0x2e0c ||
            c === 0x2e0d ||
            (c >= 0x2e0e && c <= 0x2e16) ||
            c === 0x2e17 ||
            (c >= 0x2e18 && c <= 0x2e19) ||
            c === 0x2e1a ||
            c === 0x2e1b ||
            c === 0x2e1c ||
            c === 0x2e1d ||
            (c >= 0x2e1e && c <= 0x2e1f) ||
            c === 0x2e20 ||
            c === 0x2e21 ||
            c === 0x2e22 ||
            c === 0x2e23 ||
            c === 0x2e24 ||
            c === 0x2e25 ||
            c === 0x2e26 ||
            c === 0x2e27 ||
            c === 0x2e28 ||
            c === 0x2e29 ||
            (c >= 0x2e2a && c <= 0x2e2e) ||
            c === 0x2e2f ||
            (c >= 0x2e30 && c <= 0x2e39) ||
            (c >= 0x2e3a && c <= 0x2e3b) ||
            (c >= 0x2e3c && c <= 0x2e3f) ||
            c === 0x2e40 ||
            c === 0x2e41 ||
            c === 0x2e42 ||
            (c >= 0x2e43 && c <= 0x2e4f) ||
            (c >= 0x2e50 && c <= 0x2e51) ||
            c === 0x2e52 ||
            (c >= 0x2e53 && c <= 0x2e7f) ||
            (c >= 0x3001 && c <= 0x3003) ||
            c === 0x3008 ||
            c === 0x3009 ||
            c === 0x300a ||
            c === 0x300b ||
            c === 0x300c ||
            c === 0x300d ||
            c === 0x300e ||
            c === 0x300f ||
            c === 0x3010 ||
            c === 0x3011 ||
            (c >= 0x3012 && c <= 0x3013) ||
            c === 0x3014 ||
            c === 0x3015 ||
            c === 0x3016 ||
            c === 0x3017 ||
            c === 0x3018 ||
            c === 0x3019 ||
            c === 0x301a ||
            c === 0x301b ||
            c === 0x301c ||
            c === 0x301d ||
            (c >= 0x301e && c <= 0x301f) ||
            c === 0x3020 ||
            c === 0x3030 ||
            c === 0xfd3e ||
            c === 0xfd3f ||
            (c >= 0xfe45 && c <= 0xfe46));
    }

    function pruneLocation(els) {
        els.forEach(function (el) {
            delete el.location;
            if (isSelectElement(el) || isPluralElement(el)) {
                for (var k in el.options) {
                    delete el.options[k].location;
                    pruneLocation(el.options[k].value);
                }
            }
            else if (isNumberElement(el) && isNumberSkeleton(el.style)) {
                delete el.style.location;
            }
            else if ((isDateElement(el) || isTimeElement(el)) &&
                isDateTimeSkeleton(el.style)) {
                delete el.style.location;
            }
            else if (isTagElement(el)) {
                pruneLocation(el.children);
            }
        });
    }
    function parse(message, opts) {
        if (opts === void 0) { opts = {}; }
        opts = __assign({ shouldParseSkeletons: true, requiresOtherClause: true }, opts);
        var result = new Parser(message, opts).parse();
        if (result.err) {
            var error = SyntaxError(ErrorKind[result.err.kind]);
            // @ts-expect-error Assign to error object
            error.location = result.err.location;
            // @ts-expect-error Assign to error object
            error.originalMessage = result.err.message;
            throw error;
        }
        if (!(opts === null || opts === void 0 ? void 0 : opts.captureLocation)) {
            pruneLocation(result.val);
        }
        return result.val;
    }

    //
    // Main
    //
    function memoize(fn, options) {
        var cache = options && options.cache ? options.cache : cacheDefault;
        var serializer = options && options.serializer ? options.serializer : serializerDefault;
        var strategy = options && options.strategy ? options.strategy : strategyDefault;
        return strategy(fn, {
            cache: cache,
            serializer: serializer,
        });
    }
    //
    // Strategy
    //
    function isPrimitive(value) {
        return (value == null || typeof value === 'number' || typeof value === 'boolean'); // || typeof value === "string" 'unsafe' primitive for our needs
    }
    function monadic(fn, cache, serializer, arg) {
        var cacheKey = isPrimitive(arg) ? arg : serializer(arg);
        var computedValue = cache.get(cacheKey);
        if (typeof computedValue === 'undefined') {
            computedValue = fn.call(this, arg);
            cache.set(cacheKey, computedValue);
        }
        return computedValue;
    }
    function variadic(fn, cache, serializer) {
        var args = Array.prototype.slice.call(arguments, 3);
        var cacheKey = serializer(args);
        var computedValue = cache.get(cacheKey);
        if (typeof computedValue === 'undefined') {
            computedValue = fn.apply(this, args);
            cache.set(cacheKey, computedValue);
        }
        return computedValue;
    }
    function assemble(fn, context, strategy, cache, serialize) {
        return strategy.bind(context, fn, cache, serialize);
    }
    function strategyDefault(fn, options) {
        var strategy = fn.length === 1 ? monadic : variadic;
        return assemble(fn, this, strategy, options.cache.create(), options.serializer);
    }
    function strategyVariadic(fn, options) {
        return assemble(fn, this, variadic, options.cache.create(), options.serializer);
    }
    function strategyMonadic(fn, options) {
        return assemble(fn, this, monadic, options.cache.create(), options.serializer);
    }
    //
    // Serializer
    //
    var serializerDefault = function () {
        return JSON.stringify(arguments);
    };
    //
    // Cache
    //
    function ObjectWithoutPrototypeCache() {
        this.cache = Object.create(null);
    }
    ObjectWithoutPrototypeCache.prototype.get = function (key) {
        return this.cache[key];
    };
    ObjectWithoutPrototypeCache.prototype.set = function (key, value) {
        this.cache[key] = value;
    };
    var cacheDefault = {
        create: function create() {
            // @ts-ignore
            return new ObjectWithoutPrototypeCache();
        },
    };
    var strategies = {
        variadic: strategyVariadic,
        monadic: strategyMonadic,
    };

    var ErrorCode;
    (function (ErrorCode) {
        // When we have a placeholder but no value to format
        ErrorCode["MISSING_VALUE"] = "MISSING_VALUE";
        // When value supplied is invalid
        ErrorCode["INVALID_VALUE"] = "INVALID_VALUE";
        // When we need specific Intl API but it's not available
        ErrorCode["MISSING_INTL_API"] = "MISSING_INTL_API";
    })(ErrorCode || (ErrorCode = {}));
    var FormatError = /** @class */ (function (_super) {
        __extends(FormatError, _super);
        function FormatError(msg, code, originalMessage) {
            var _this = _super.call(this, msg) || this;
            _this.code = code;
            _this.originalMessage = originalMessage;
            return _this;
        }
        FormatError.prototype.toString = function () {
            return "[formatjs Error: ".concat(this.code, "] ").concat(this.message);
        };
        return FormatError;
    }(Error));
    var InvalidValueError = /** @class */ (function (_super) {
        __extends(InvalidValueError, _super);
        function InvalidValueError(variableId, value, options, originalMessage) {
            return _super.call(this, "Invalid values for \"".concat(variableId, "\": \"").concat(value, "\". Options are \"").concat(Object.keys(options).join('", "'), "\""), ErrorCode.INVALID_VALUE, originalMessage) || this;
        }
        return InvalidValueError;
    }(FormatError));
    var InvalidValueTypeError = /** @class */ (function (_super) {
        __extends(InvalidValueTypeError, _super);
        function InvalidValueTypeError(value, type, originalMessage) {
            return _super.call(this, "Value for \"".concat(value, "\" must be of type ").concat(type), ErrorCode.INVALID_VALUE, originalMessage) || this;
        }
        return InvalidValueTypeError;
    }(FormatError));
    var MissingValueError = /** @class */ (function (_super) {
        __extends(MissingValueError, _super);
        function MissingValueError(variableId, originalMessage) {
            return _super.call(this, "The intl string context variable \"".concat(variableId, "\" was not provided to the string \"").concat(originalMessage, "\""), ErrorCode.MISSING_VALUE, originalMessage) || this;
        }
        return MissingValueError;
    }(FormatError));

    var PART_TYPE;
    (function (PART_TYPE) {
        PART_TYPE[PART_TYPE["literal"] = 0] = "literal";
        PART_TYPE[PART_TYPE["object"] = 1] = "object";
    })(PART_TYPE || (PART_TYPE = {}));
    function mergeLiteral(parts) {
        if (parts.length < 2) {
            return parts;
        }
        return parts.reduce(function (all, part) {
            var lastPart = all[all.length - 1];
            if (!lastPart ||
                lastPart.type !== PART_TYPE.literal ||
                part.type !== PART_TYPE.literal) {
                all.push(part);
            }
            else {
                lastPart.value += part.value;
            }
            return all;
        }, []);
    }
    function isFormatXMLElementFn(el) {
        return typeof el === 'function';
    }
    // TODO(skeleton): add skeleton support
    function formatToParts(els, locales, formatters, formats, values, currentPluralValue, 
    // For debugging
    originalMessage) {
        // Hot path for straight simple msg translations
        if (els.length === 1 && isLiteralElement(els[0])) {
            return [
                {
                    type: PART_TYPE.literal,
                    value: els[0].value,
                },
            ];
        }
        var result = [];
        for (var _i = 0, els_1 = els; _i < els_1.length; _i++) {
            var el = els_1[_i];
            // Exit early for string parts.
            if (isLiteralElement(el)) {
                result.push({
                    type: PART_TYPE.literal,
                    value: el.value,
                });
                continue;
            }
            // TODO: should this part be literal type?
            // Replace `#` in plural rules with the actual numeric value.
            if (isPoundElement(el)) {
                if (typeof currentPluralValue === 'number') {
                    result.push({
                        type: PART_TYPE.literal,
                        value: formatters.getNumberFormat(locales).format(currentPluralValue),
                    });
                }
                continue;
            }
            var varName = el.value;
            // Enforce that all required values are provided by the caller.
            if (!(values && varName in values)) {
                throw new MissingValueError(varName, originalMessage);
            }
            var value = values[varName];
            if (isArgumentElement(el)) {
                if (!value || typeof value === 'string' || typeof value === 'number') {
                    value =
                        typeof value === 'string' || typeof value === 'number'
                            ? String(value)
                            : '';
                }
                result.push({
                    type: typeof value === 'string' ? PART_TYPE.literal : PART_TYPE.object,
                    value: value,
                });
                continue;
            }
            // Recursively format plural and select parts' option — which can be a
            // nested pattern structure. The choosing of the option to use is
            // abstracted-by and delegated-to the part helper object.
            if (isDateElement(el)) {
                var style = typeof el.style === 'string'
                    ? formats.date[el.style]
                    : isDateTimeSkeleton(el.style)
                        ? el.style.parsedOptions
                        : undefined;
                result.push({
                    type: PART_TYPE.literal,
                    value: formatters
                        .getDateTimeFormat(locales, style)
                        .format(value),
                });
                continue;
            }
            if (isTimeElement(el)) {
                var style = typeof el.style === 'string'
                    ? formats.time[el.style]
                    : isDateTimeSkeleton(el.style)
                        ? el.style.parsedOptions
                        : formats.time.medium;
                result.push({
                    type: PART_TYPE.literal,
                    value: formatters
                        .getDateTimeFormat(locales, style)
                        .format(value),
                });
                continue;
            }
            if (isNumberElement(el)) {
                var style = typeof el.style === 'string'
                    ? formats.number[el.style]
                    : isNumberSkeleton(el.style)
                        ? el.style.parsedOptions
                        : undefined;
                if (style && style.scale) {
                    value =
                        value *
                            (style.scale || 1);
                }
                result.push({
                    type: PART_TYPE.literal,
                    value: formatters
                        .getNumberFormat(locales, style)
                        .format(value),
                });
                continue;
            }
            if (isTagElement(el)) {
                var children = el.children, value_1 = el.value;
                var formatFn = values[value_1];
                if (!isFormatXMLElementFn(formatFn)) {
                    throw new InvalidValueTypeError(value_1, 'function', originalMessage);
                }
                var parts = formatToParts(children, locales, formatters, formats, values, currentPluralValue);
                var chunks = formatFn(parts.map(function (p) { return p.value; }));
                if (!Array.isArray(chunks)) {
                    chunks = [chunks];
                }
                result.push.apply(result, chunks.map(function (c) {
                    return {
                        type: typeof c === 'string' ? PART_TYPE.literal : PART_TYPE.object,
                        value: c,
                    };
                }));
            }
            if (isSelectElement(el)) {
                var opt = el.options[value] || el.options.other;
                if (!opt) {
                    throw new InvalidValueError(el.value, value, Object.keys(el.options), originalMessage);
                }
                result.push.apply(result, formatToParts(opt.value, locales, formatters, formats, values));
                continue;
            }
            if (isPluralElement(el)) {
                var opt = el.options["=".concat(value)];
                if (!opt) {
                    if (!Intl.PluralRules) {
                        throw new FormatError("Intl.PluralRules is not available in this environment.\nTry polyfilling it using \"@formatjs/intl-pluralrules\"\n", ErrorCode.MISSING_INTL_API, originalMessage);
                    }
                    var rule = formatters
                        .getPluralRules(locales, { type: el.pluralType })
                        .select(value - (el.offset || 0));
                    opt = el.options[rule] || el.options.other;
                }
                if (!opt) {
                    throw new InvalidValueError(el.value, value, Object.keys(el.options), originalMessage);
                }
                result.push.apply(result, formatToParts(opt.value, locales, formatters, formats, values, value - (el.offset || 0)));
                continue;
            }
        }
        return mergeLiteral(result);
    }

    /*
    Copyright (c) 2014, Yahoo! Inc. All rights reserved.
    Copyrights licensed under the New BSD License.
    See the accompanying LICENSE file for terms.
    */
    // -- MessageFormat --------------------------------------------------------
    function mergeConfig(c1, c2) {
        if (!c2) {
            return c1;
        }
        return __assign(__assign(__assign({}, (c1 || {})), (c2 || {})), Object.keys(c1).reduce(function (all, k) {
            all[k] = __assign(__assign({}, c1[k]), (c2[k] || {}));
            return all;
        }, {}));
    }
    function mergeConfigs(defaultConfig, configs) {
        if (!configs) {
            return defaultConfig;
        }
        return Object.keys(defaultConfig).reduce(function (all, k) {
            all[k] = mergeConfig(defaultConfig[k], configs[k]);
            return all;
        }, __assign({}, defaultConfig));
    }
    function createFastMemoizeCache(store) {
        return {
            create: function () {
                return {
                    get: function (key) {
                        return store[key];
                    },
                    set: function (key, value) {
                        store[key] = value;
                    },
                };
            },
        };
    }
    function createDefaultFormatters(cache) {
        if (cache === void 0) { cache = {
            number: {},
            dateTime: {},
            pluralRules: {},
        }; }
        return {
            getNumberFormat: memoize(function () {
                var _a;
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return new ((_a = Intl.NumberFormat).bind.apply(_a, __spreadArray([void 0], args, false)))();
            }, {
                cache: createFastMemoizeCache(cache.number),
                strategy: strategies.variadic,
            }),
            getDateTimeFormat: memoize(function () {
                var _a;
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return new ((_a = Intl.DateTimeFormat).bind.apply(_a, __spreadArray([void 0], args, false)))();
            }, {
                cache: createFastMemoizeCache(cache.dateTime),
                strategy: strategies.variadic,
            }),
            getPluralRules: memoize(function () {
                var _a;
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return new ((_a = Intl.PluralRules).bind.apply(_a, __spreadArray([void 0], args, false)))();
            }, {
                cache: createFastMemoizeCache(cache.pluralRules),
                strategy: strategies.variadic,
            }),
        };
    }
    var IntlMessageFormat = /** @class */ (function () {
        function IntlMessageFormat(message, locales, overrideFormats, opts) {
            var _this = this;
            if (locales === void 0) { locales = IntlMessageFormat.defaultLocale; }
            this.formatterCache = {
                number: {},
                dateTime: {},
                pluralRules: {},
            };
            this.format = function (values) {
                var parts = _this.formatToParts(values);
                // Hot path for straight simple msg translations
                if (parts.length === 1) {
                    return parts[0].value;
                }
                var result = parts.reduce(function (all, part) {
                    if (!all.length ||
                        part.type !== PART_TYPE.literal ||
                        typeof all[all.length - 1] !== 'string') {
                        all.push(part.value);
                    }
                    else {
                        all[all.length - 1] += part.value;
                    }
                    return all;
                }, []);
                if (result.length <= 1) {
                    return result[0] || '';
                }
                return result;
            };
            this.formatToParts = function (values) {
                return formatToParts(_this.ast, _this.locales, _this.formatters, _this.formats, values, undefined, _this.message);
            };
            this.resolvedOptions = function () { return ({
                locale: _this.resolvedLocale.toString(),
            }); };
            this.getAst = function () { return _this.ast; };
            // Defined first because it's used to build the format pattern.
            this.locales = locales;
            this.resolvedLocale = IntlMessageFormat.resolveLocale(locales);
            if (typeof message === 'string') {
                this.message = message;
                if (!IntlMessageFormat.__parse) {
                    throw new TypeError('IntlMessageFormat.__parse must be set to process `message` of type `string`');
                }
                // Parse string messages into an AST.
                this.ast = IntlMessageFormat.__parse(message, {
                    ignoreTag: opts === null || opts === void 0 ? void 0 : opts.ignoreTag,
                    locale: this.resolvedLocale,
                });
            }
            else {
                this.ast = message;
            }
            if (!Array.isArray(this.ast)) {
                throw new TypeError('A message must be provided as a String or AST.');
            }
            // Creates a new object with the specified `formats` merged with the default
            // formats.
            this.formats = mergeConfigs(IntlMessageFormat.formats, overrideFormats);
            this.formatters =
                (opts && opts.formatters) || createDefaultFormatters(this.formatterCache);
        }
        Object.defineProperty(IntlMessageFormat, "defaultLocale", {
            get: function () {
                if (!IntlMessageFormat.memoizedDefaultLocale) {
                    IntlMessageFormat.memoizedDefaultLocale =
                        new Intl.NumberFormat().resolvedOptions().locale;
                }
                return IntlMessageFormat.memoizedDefaultLocale;
            },
            enumerable: false,
            configurable: true
        });
        IntlMessageFormat.memoizedDefaultLocale = null;
        IntlMessageFormat.resolveLocale = function (locales) {
            var supportedLocales = Intl.NumberFormat.supportedLocalesOf(locales);
            if (supportedLocales.length > 0) {
                return new Intl.Locale(supportedLocales[0]);
            }
            return new Intl.Locale(typeof locales === 'string' ? locales : locales[0]);
        };
        IntlMessageFormat.__parse = parse;
        // Default format options used as the prototype of the `formats` provided to the
        // constructor. These are used when constructing the internal Intl.NumberFormat
        // and Intl.DateTimeFormat instances.
        IntlMessageFormat.formats = {
            number: {
                integer: {
                    maximumFractionDigits: 0,
                },
                currency: {
                    style: 'currency',
                },
                percent: {
                    style: 'percent',
                },
            },
            date: {
                short: {
                    month: 'numeric',
                    day: 'numeric',
                    year: '2-digit',
                },
                medium: {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                },
                long: {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                },
                full: {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                },
            },
            time: {
                short: {
                    hour: 'numeric',
                    minute: 'numeric',
                },
                medium: {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                },
                long: {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZoneName: 'short',
                },
                full: {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZoneName: 'short',
                },
            },
        };
        return IntlMessageFormat;
    }());

    /*
    Copyright (c) 2014, Yahoo! Inc. All rights reserved.
    Copyrights licensed under the New BSD License.
    See the accompanying LICENSE file for terms.
    */
    var o = IntlMessageFormat;

    const r={},i=(e,n,t)=>t?(n in r||(r[n]={}),e in r[n]||(r[n][e]=t),t):t,l=(e,n)=>{if(null==n)return;if(n in r&&e in r[n])return r[n][e];const t=E(n);for(let o=0;o<t.length;o++){const r=c(t[o],e);if(r)return i(e,n,r)}};let a;const s=writable({});function u(e){return e in a}function c(e,n){if(!u(e))return null;const t=function(e){return a[e]||null}(e);return function(e,n){if(null==n)return;if(n in e)return e[n];const t=n.split(".");let o=e;for(let e=0;e<t.length;e++)if("object"==typeof o){if(e>0){const n=t.slice(e,t.length).join(".");if(n in o){o=o[n];break}}o=o[t[e]];}else o=void 0;return o}(t,n)}function m(e,...n){delete r[e],s.update((o=>(o[e]=cjs.all([o[e]||{},...n]),o)));}derived([s],(([e])=>Object.keys(e)));s.subscribe((e=>a=e));const d={};function g(e){return d[e]}function h(e){return null!=e&&E(e).some((e=>{var n;return null===(n=g(e))||void 0===n?void 0:n.size}))}function w(e,n){const t=Promise.all(n.map((n=>(function(e,n){d[e].delete(n),0===d[e].size&&delete d[e];}(e,n),n().then((e=>e.default||e))))));return t.then((n=>m(e,...n)))}const p={};function b(e){if(!h(e))return e in p?p[e]:Promise.resolve();const n=function(e){return E(e).map((e=>{const n=g(e);return [e,n?[...n]:[]]})).filter((([,e])=>e.length>0))}(e);return p[e]=Promise.all(n.map((([e,n])=>w(e,n)))).then((()=>{if(h(e))return b(e);delete p[e];})),p[e]}/*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */function v(e,n){var t={};for(var o in e)Object.prototype.hasOwnProperty.call(e,o)&&n.indexOf(o)<0&&(t[o]=e[o]);if(null!=e&&"function"==typeof Object.getOwnPropertySymbols){var r=0;for(o=Object.getOwnPropertySymbols(e);r<o.length;r++)n.indexOf(o[r])<0&&Object.prototype.propertyIsEnumerable.call(e,o[r])&&(t[o[r]]=e[o[r]]);}return t}function O({locale:e,id:n}){console.warn(`[svelte-i18n] The message "${n}" was not found in "${E(e).join('", "')}".${h(P())?"\n\nNote: there are at least one loader still registered to this locale that wasn't executed.":""}`);}const j={fallbackLocale:null,loadingDelay:200,formats:{number:{scientific:{notation:"scientific"},engineering:{notation:"engineering"},compactLong:{notation:"compact",compactDisplay:"long"},compactShort:{notation:"compact",compactDisplay:"short"}},date:{short:{month:"numeric",day:"numeric",year:"2-digit"},medium:{month:"short",day:"numeric",year:"numeric"},long:{month:"long",day:"numeric",year:"numeric"},full:{weekday:"long",month:"long",day:"numeric",year:"numeric"}},time:{short:{hour:"numeric",minute:"numeric"},medium:{hour:"numeric",minute:"numeric",second:"numeric"},long:{hour:"numeric",minute:"numeric",second:"numeric",timeZoneName:"short"},full:{hour:"numeric",minute:"numeric",second:"numeric",timeZoneName:"short"}}},warnOnMissingMessages:!0,handleMissingMessage:void 0,ignoreTag:!0};function M(){return j}function $(e){const{formats:n}=e,t=v(e,["formats"]),o=e.initialLocale||e.fallbackLocale;return t.warnOnMissingMessages&&(delete t.warnOnMissingMessages,null==t.handleMissingMessage?t.handleMissingMessage=O:console.warn('[svelte-i18n] The "warnOnMissingMessages" option is deprecated. Please use the "handleMissingMessage" option instead.')),Object.assign(j,t,{initialLocale:o}),n&&("number"in n&&Object.assign(j.formats.number,n.number),"date"in n&&Object.assign(j.formats.date,n.date),"time"in n&&Object.assign(j.formats.time,n.time)),D.set(o)}const k=writable(!1);let T;const L=writable(null);function x(e){return e.split("-").map(((e,n,t)=>t.slice(0,n+1).join("-"))).reverse()}function E(e,n=M().fallbackLocale){const t=x(e);return n?[...new Set([...t,...x(n)])]:t}function P(){return null!=T?T:void 0}L.subscribe((e=>{T=null!=e?e:void 0,"undefined"!=typeof window&&null!=e&&document.documentElement.setAttribute("lang",e);}));const D=Object.assign(Object.assign({},L),{set:e=>{if(e&&function(e){if(null==e)return;const n=E(e);for(let e=0;e<n.length;e++){const t=n[e];if(u(t))return t}}(e)&&h(e)){const{loadingDelay:n}=M();let t;return "undefined"!=typeof window&&null!=P()&&n?t=window.setTimeout((()=>k.set(!0)),n):k.set(!0),b(e).then((()=>{L.set(e);})).finally((()=>{clearTimeout(t),k.set(!1);}))}return L.set(e)}}),C=e=>{const n=Object.create(null);return t=>{const o=JSON.stringify(t);return o in n?n[o]:n[o]=e(t)}},G=(e,n)=>{const{formats:t}=M();if(e in t&&n in t[e])return t[e][n];throw new Error(`[svelte-i18n] Unknown "${n}" ${e} format.`)},J=C((e=>{var{locale:n,format:t}=e,o=v(e,["locale","format"]);if(null==n)throw new Error('[svelte-i18n] A "locale" must be set to format numbers');return t&&(o=G("number",t)),new Intl.NumberFormat(n,o)})),U=C((e=>{var{locale:n,format:t}=e,o=v(e,["locale","format"]);if(null==n)throw new Error('[svelte-i18n] A "locale" must be set to format dates');return t?o=G("date",t):0===Object.keys(o).length&&(o=G("date","short")),new Intl.DateTimeFormat(n,o)})),V=C((e=>{var{locale:n,format:t}=e,o=v(e,["locale","format"]);if(null==n)throw new Error('[svelte-i18n] A "locale" must be set to format time values');return t?o=G("time",t):0===Object.keys(o).length&&(o=G("time","short")),new Intl.DateTimeFormat(n,o)})),_=(e={})=>{var{locale:n=P()}=e,t=v(e,["locale"]);return J(Object.assign({locale:n},t))},q=(e={})=>{var{locale:n=P()}=e,t=v(e,["locale"]);return U(Object.assign({locale:n},t))},B=(e={})=>{var{locale:n=P()}=e,t=v(e,["locale"]);return V(Object.assign({locale:n},t))},H=C(((e,n=P())=>new o(e,n,M().formats,{ignoreTag:M().ignoreTag}))),K=(e,n={})=>{var t,o,r,i;let a=n;"object"==typeof e&&(a=e,e=a.id);const{values:s,locale:u=P(),default:c}=a;if(null==u)throw new Error("[svelte-i18n] Cannot format a message without first setting the initial locale.");let m=l(e,u);if(m){if("string"!=typeof m)return console.warn(`[svelte-i18n] Message with id "${e}" must be of type "string", found: "${typeof m}". Gettin its value through the "$format" method is deprecated; use the "json" method instead.`),m}else m=null!==(i=null!==(r=null===(o=(t=M()).handleMissingMessage)||void 0===o?void 0:o.call(t,{locale:u,id:e,defaultValue:c}))&&void 0!==r?r:c)&&void 0!==i?i:e;if(!s)return m;let f=m;try{f=H(m,u).format(s);}catch(n){console.warn(`[svelte-i18n] Message "${e}" has syntax error:`,n.message);}return f},Q=(e,n)=>B(n).format(e),R=(e,n)=>q(n).format(e),W=(e,n)=>_(n).format(e),X=(e,n=P())=>l(e,n),Y=derived([D,s],(()=>K));derived([D],(()=>Q));derived([D],(()=>R));derived([D],(()=>W));derived([D,s],(()=>X));

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src\pages\Home.svelte generated by Svelte v3.53.1 */

    const { console: console_1$n, window: window_1$3 } = globals;
    const file$t = "src\\pages\\Home.svelte";

    // (73:4) {#if story !== ''}
    function create_if_block$i(ctx) {
    	let p;
    	let t;
    	let p_intro;
    	let p_outro;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*story*/ ctx[0]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, /*story*/ ctx[0]);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "svelte-n123h1");
    			add_location(p, file$t, 73, 4, 2219);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*story*/ 1) set_data_dev(t, /*story*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (p_outro) p_outro.end(1);
    				p_intro = create_in_transition(p, fly, { x: 200, duration: 1500 });
    				p_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (p_intro) p_intro.invalidate();
    			p_outro = create_out_transition(p, fly, { x: -200, duration: 1500 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching && p_outro) p_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$i.name,
    		type: "if",
    		source: "(73:4) {#if story !== ''}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$w(ctx) {
    	let div0;
    	let video;
    	let source;
    	let source_src_value;
    	let t0;
    	let p;
    	let p_class_value;
    	let t1;
    	let t2;
    	let div1;
    	let img;
    	let img_src_value;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*story*/ ctx[0] !== '' && create_if_block$i(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			video = element("video");
    			source = element("source");
    			t0 = space();
    			p = element("p");
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			div1 = element("div");
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			video = claim_element(div0_nodes, "VIDEO", { id: true, class: true });
    			var video_nodes = children(video);
    			source = claim_element(video_nodes, "SOURCE", { src: true, type: true });
    			video_nodes.forEach(detach_dev);
    			t0 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { id: true, class: true });
    			var p_nodes = children(p);
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			t2 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { tabindex: true, class: true });
    			var div1_nodes = children(div1);
    			img = claim_element(div1_nodes, "IMG", { class: true, src: true, alt: true });
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(source.src, source_src_value = "../images/rotate-device.mp4")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			add_location(source, file$t, 67, 12, 2014);
    			video.autoplay = true;
    			video.muted = true;
    			video.loop = true;
    			attr_dev(video, "id", "rotate-device");
    			attr_dev(video, "class", "svelte-n123h1");
    			add_location(video, file$t, 66, 8, 1954);
    			attr_dev(p, "id", "rotate-phone-message");
    			attr_dev(p, "class", p_class_value = "" + (null_to_empty(/*IOSdevice*/ ctx[1]) + " svelte-n123h1"));
    			add_location(p, file$t, 69, 8, 2101);
    			attr_dev(div0, "class", "rotate-animation svelte-n123h1");
    			add_location(div0, file$t, 65, 4, 1913);
    			attr_dev(img, "class", "door svelte-n123h1");
    			if (!src_url_equal(img.src, img_src_value = "/static/images/homepage-3-01-01.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "book-door");
    			add_location(img, file$t, 78, 4, 2456);
    			attr_dev(div1, "tabindex", "0");
    			attr_dev(div1, "class", "sprite svelte-n123h1");
    			add_location(div1, file$t, 76, 0, 2326);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, video);
    			append_hydration_dev(video, source);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div0, p);
    			p.innerHTML = /*fullscreenGuide*/ ctx[2];
    			insert_hydration_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, t2, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, img);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1$3, "keydown", /*keydown_handler*/ ctx[5], false, false, false),
    					action_destroyer(/*zoom*/ ctx[4].call(null, div1, 10))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*fullscreenGuide*/ 4) p.innerHTML = /*fullscreenGuide*/ ctx[2];
    			if (!current || dirty & /*IOSdevice*/ 2 && p_class_value !== (p_class_value = "" + (null_to_empty(/*IOSdevice*/ ctx[1]) + " svelte-n123h1"))) {
    				attr_dev(p, "class", p_class_value);
    			}

    			if (/*story*/ ctx[0] !== '') {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*story*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$i(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t2.parentNode, t2);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$w.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$w($$self, $$props, $$invalidate) {
    	let $_;
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(6, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	let IOSdevice = '';
    	let fullscreenGuide = '';
    	let key = "";
    	let story = '';

    	// $: console.log(key);
    	onMount(() => {
    		$$invalidate(0, story = $_("homepage.welcomeText"));
    	}); // if(story !== ''){
    	//     setTimeout(() => {
    	//         story = ''
    	//     }, 5000);

    	const zoom = (node, scale = 1.5) => {
    		node.style.transition = "3s";

    		function zoomIn() {
    			node.style.transform = `scale(${scale})`;
    			node.style.opacity = 0;

    			setTimeout(
    				function () {
    					navigate("/library");
    				},
    				3000
    			);
    		}

    		node.addEventListener("click", zoomIn);

    		node.addEventListener("keypress", () => {
    			if (key === "Enter") {
    				zoomIn();
    			}
    		});

    		console.log("clicked");
    	};

    	let isIOS = (/iPad|iPhone|iPod/).test(navigator.userAgent) && !window.MSStream;

    	if (isIOS) {
    		console.log('This is a IOS device');
    		fullscreenGuide = `För fullskärm: <br> 1. Vid webbläsarens adressfält finns en ikon 'aA'. <br> 2. Tryck på den och välj 'Göm verktygsfält'. <br> 3. Rotera skärmen.`;
    		IOSdevice = 'IOSdevice';
    	} else {
    		console.log('This is Not a IOS device');
    		fullscreenGuide = 'Rotera skärmen';
    		IOSdevice = '';
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$n.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = e => $$invalidate(3, key = e.key);

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		navigate,
    		fly,
    		IOSdevice,
    		fullscreenGuide,
    		key,
    		story,
    		zoom,
    		isIOS,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('IOSdevice' in $$props) $$invalidate(1, IOSdevice = $$props.IOSdevice);
    		if ('fullscreenGuide' in $$props) $$invalidate(2, fullscreenGuide = $$props.fullscreenGuide);
    		if ('key' in $$props) $$invalidate(3, key = $$props.key);
    		if ('story' in $$props) $$invalidate(0, story = $$props.story);
    		if ('isIOS' in $$props) isIOS = $$props.isIOS;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*story*/ 1) {
    			// }
    			console.log(story);
    		}
    	};

    	return [story, IOSdevice, fullscreenGuide, key, zoom, keydown_handler];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$w, create_fragment$w, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$w.name
    		});
    	}
    }

    /* src\components\admin\DeleteBtn.svelte generated by Svelte v3.53.1 */

    const { console: console_1$m } = globals;
    const file$s = "src\\components\\admin\\DeleteBtn.svelte";

    function create_fragment$v(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			children(button).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "svelte-12tiw2n");
    			add_location(button, file$s, 39, 4, 1096);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$v.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$v($$self, $$props, $$invalidate) {
    	let $amountOfProjects;
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(3, $amountOfProjects = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DeleteBtn', slots, []);
    	let { id } = $$props;

    	const deleteProject = id => {
    		axios.delete(`http://localhost:4000/api/projects/${id}`, {
    			headers: { 'token': localStorage.getItem('token') }
    		}).then(response => {
    			console.log('status', response.status);

    			if (response.status !== 200) {
    				console.log('unauthorized');
    			} else {
    				console.log('deleted project');

    				set_store_value(
    					amountOfProjects,
    					$amountOfProjects = $amountOfProjects.filter(function (value) {
    						if (value.id !== id) {
    							return value;
    						}
    					}),
    					$amountOfProjects
    				);
    			}
    		}).catch(err => {
    			console.log(err);
    		});
    	};

    	const confirm = () => {
    		if (window.confirm('are you sure you want to delete this project ?')) {
    			deleteProject(id);
    		}
    	};

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console_1$m.warn("<DeleteBtn> was created without expected prop 'id'");
    		}
    	});

    	const writable_props = ['id'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$m.warn(`<DeleteBtn> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => confirm();

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    	};

    	$$self.$capture_state = () => ({
    		axios,
    		amountOfProjects,
    		id,
    		deleteProject,
    		confirm,
    		$amountOfProjects
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [confirm, id, click_handler];
    }

    class DeleteBtn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$v, create_fragment$v, safe_not_equal, { id: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DeleteBtn",
    			options,
    			id: create_fragment$v.name
    		});
    	}

    	get id() {
    		throw new Error("<DeleteBtn>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<DeleteBtn>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\admin\Edit.svelte generated by Svelte v3.53.1 */

    const { console: console_1$l } = globals;
    const file$r = "src\\components\\admin\\Edit.svelte";

    function get_each_context$8(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    // (84:0) {#if $isEditing && $show[i]}
    function create_if_block$h(ctx) {
    	let form;
    	let input0;
    	let t0;
    	let input1;
    	let t1;
    	let img;
    	let img_src_value;
    	let t2;
    	let input2;
    	let t3;
    	let select;
    	let t4;
    	let button;
    	let t5;
    	let mounted;
    	let dispose;
    	let each_value = /*$categories*/ ctx[5];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$8(get_each_context$8(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			form = element("form");
    			input0 = element("input");
    			t0 = space();
    			input1 = element("input");
    			t1 = space();
    			img = element("img");
    			t2 = space();
    			input2 = element("input");
    			t3 = space();
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			button = element("button");
    			t5 = text("SAVE");
    			this.h();
    		},
    		l: function claim(nodes) {
    			form = claim_element(nodes, "FORM", { class: true });
    			var form_nodes = children(form);
    			input0 = claim_element(form_nodes, "INPUT", { class: true, type: true });
    			t0 = claim_space(form_nodes);
    			input1 = claim_element(form_nodes, "INPUT", { class: true, type: true });
    			t1 = claim_space(form_nodes);
    			img = claim_element(form_nodes, "IMG", { src: true, alt: true, height: true });
    			t2 = claim_space(form_nodes);
    			input2 = claim_element(form_nodes, "INPUT", { class: true, type: true });
    			t3 = claim_space(form_nodes);
    			select = claim_element(form_nodes, "SELECT", { class: true });
    			var select_nodes = children(select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(select_nodes);
    			}

    			select_nodes.forEach(detach_dev);
    			t4 = claim_space(form_nodes);
    			button = claim_element(form_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t5 = claim_text(button_nodes, "SAVE");
    			button_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(input0, "class", "inputs svelte-kdpljb");
    			attr_dev(input0, "type", "text");
    			add_location(input0, file$r, 85, 4, 2409);
    			attr_dev(input1, "class", "inputs svelte-kdpljb");
    			attr_dev(input1, "type", "file");
    			add_location(input1, file$r, 86, 1, 2473);
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[2].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			attr_dev(img, "height", "70px");
    			add_location(img, file$r, 87, 4, 2578);
    			attr_dev(input2, "class", "inputs svelte-kdpljb");
    			attr_dev(input2, "type", "text");
    			add_location(input2, file$r, 88, 1, 2631);
    			attr_dev(select, "class", "inputs svelte-kdpljb");
    			if (/*project*/ ctx[2].category === void 0) add_render_callback(() => /*select_change_handler*/ ctx[13].call(select));
    			add_location(select, file$r, 89, 1, 2701);
    			attr_dev(button, "class", "save-btn svelte-kdpljb");
    			add_location(button, file$r, 94, 0, 2880);
    			attr_dev(form, "class", "svelte-kdpljb");
    			add_location(form, file$r, 84, 0, 2397);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, form, anchor);
    			append_hydration_dev(form, input0);
    			set_input_value(input0, /*project*/ ctx[2].title);
    			append_hydration_dev(form, t0);
    			append_hydration_dev(form, input1);
    			append_hydration_dev(form, t1);
    			append_hydration_dev(form, img);
    			append_hydration_dev(form, t2);
    			append_hydration_dev(form, input2);
    			set_input_value(input2, /*project*/ ctx[2].description);
    			append_hydration_dev(form, t3);
    			append_hydration_dev(form, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*project*/ ctx[2].category);
    			append_hydration_dev(form, t4);
    			append_hydration_dev(form, button);
    			append_hydration_dev(button, t5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[9]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[10]),
    					listen_dev(input1, "change", /*change_handler*/ ctx[11], false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[12]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[13]),
    					listen_dev(button, "click", /*saveProject*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*project, $categories*/ 36 && input0.value !== /*project*/ ctx[2].title) {
    				set_input_value(input0, /*project*/ ctx[2].title);
    			}

    			if (dirty & /*project, $categories*/ 36 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[2].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*project, $categories*/ 36 && input2.value !== /*project*/ ctx[2].description) {
    				set_input_value(input2, /*project*/ ctx[2].description);
    			}

    			if (dirty & /*$categories*/ 32) {
    				each_value = /*$categories*/ ctx[5];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$8(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$8(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*project, $categories*/ 36) {
    				select_option(select, /*project*/ ctx[2].category);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$h.name,
    		type: "if",
    		source: "(84:0) {#if $isEditing && $show[i]}",
    		ctx
    	});

    	return block;
    }

    // (91:8) {#each $categories as category}
    function create_each_block$8(ctx) {
    	let option;
    	let t_value = /*category*/ ctx[17] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			option = claim_element(nodes, "OPTION", {});
    			var option_nodes = children(option);
    			t = claim_text(option_nodes, t_value);
    			option_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			option.__value = option_value_value = /*category*/ ctx[17];
    			option.value = option.__value;
    			add_location(option, file$r, 91, 8, 2805);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, option, anchor);
    			append_hydration_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$categories*/ 32 && t_value !== (t_value = /*category*/ ctx[17] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$categories*/ 32 && option_value_value !== (option_value_value = /*category*/ ctx[17])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$8.name,
    		type: "each",
    		source: "(91:8) {#each $categories as category}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$u(ctx) {
    	let button;
    	let t;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*$isEditing*/ ctx[3] && /*$show*/ ctx[4][/*i*/ ctx[1]] && create_if_block$h(ctx);

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			children(button).forEach(detach_dev);
    			t = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "edit-btn svelte-kdpljb");
    			add_location(button, file$r, 82, 0, 2306);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			insert_hydration_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*toEdit*/ ctx[6](/*id*/ ctx[0], /*i*/ ctx[1]))) /*toEdit*/ ctx[6](/*id*/ ctx[0], /*i*/ ctx[1]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (/*$isEditing*/ ctx[3] && /*$show*/ ctx[4][/*i*/ ctx[1]]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$h(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$u.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$u($$self, $$props, $$invalidate) {
    	let $isEditing;
    	let $show;
    	let $amountOfProjects;
    	let $categories;
    	validate_store(isEditing, 'isEditing');
    	component_subscribe($$self, isEditing, $$value => $$invalidate(3, $isEditing = $$value));
    	validate_store(show, 'show');
    	component_subscribe($$self, show, $$value => $$invalidate(4, $show = $$value));
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(14, $amountOfProjects = $$value));
    	validate_store(categories, 'categories');
    	component_subscribe($$self, categories, $$value => $$invalidate(5, $categories = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Edit', slots, []);
    	let { id } = $$props;
    	let { i } = $$props;

    	const project = {
    		title: "",
    		description: "",
    		category: "",
    		image_url: ""
    	};

    	const getProjectById = id => {
    		axios.get(`http://localhost:4000/api/projects/${id}`, {
    			headers: { 'token': localStorage.getItem('token') }
    		}).then(response => {
    			console.log('status', response.status);

    			if (response.status !== 200) {
    				console.log('unauthorized');
    			} else {
    				console.log(response.data);
    				$$invalidate(2, project.title = response.data.title, project);
    				$$invalidate(2, project.description = response.data.description, project);
    				$$invalidate(2, project.category = response.data.category, project);
    				$$invalidate(2, project.image_url = response.data.image_url, project);
    			}
    		}).catch(err => {
    			console.log(err);
    		});
    	};

    	const submitEdit = id => {
    		axios.put(`http://localhost:4000/api/projects/${id}`, project, {
    			headers: { 'token': localStorage.getItem('token') }
    		}).then(response => {
    			console.log('status', response.status);

    			if (response.status === 200) {
    				set_store_value(amountOfProjects, $amountOfProjects = $amountOfProjects.map(p => p.id === id ? project : p), $amountOfProjects);
    				console.log(response.data);
    			}
    		}).catch(err => {
    			console.log(err);
    		});
    	};

    	const toEdit = (id, i) => {
    		set_store_value(show, $show[i] = !$show[i], $show);
    		set_store_value(isEditing, $isEditing = true, $isEditing);
    		getProjectById(id);
    		console.log('editing', isEditing);
    	};

    	const saveProject = () => {
    		submitEdit(id);
    		set_store_value(isEditing, $isEditing = false, $isEditing);
    	};

    	const uploadImage = e => {
    		const image = e.target.files[0];
    		const reader = new FileReader();
    		reader.readAsDataURL(image);
    		let allowedFiles = ["image/png", "image/jpeg", "image/jpg"];

    		if (allowedFiles.includes(image.type)) {
    			reader.onload = e => {
    				$$invalidate(2, project.image_url = e.target.result, project);
    			};
    		} else {
    			e.target.value = "";
    		}
    	};

    	$$self.$$.on_mount.push(function () {
    		if (id === undefined && !('id' in $$props || $$self.$$.bound[$$self.$$.props['id']])) {
    			console_1$l.warn("<Edit> was created without expected prop 'id'");
    		}

    		if (i === undefined && !('i' in $$props || $$self.$$.bound[$$self.$$.props['i']])) {
    			console_1$l.warn("<Edit> was created without expected prop 'i'");
    		}
    	});

    	const writable_props = ['id', 'i'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$l.warn(`<Edit> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		project.title = this.value;
    		$$invalidate(2, project);
    	}

    	function input1_change_handler() {
    		project.image_url = this.value;
    		$$invalidate(2, project);
    	}

    	const change_handler = e => uploadImage(e);

    	function input2_input_handler() {
    		project.description = this.value;
    		$$invalidate(2, project);
    	}

    	function select_change_handler() {
    		project.category = select_value(this);
    		$$invalidate(2, project);
    	}

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('i' in $$props) $$invalidate(1, i = $$props.i);
    	};

    	$$self.$capture_state = () => ({
    		axios,
    		isEditing,
    		amountOfProjects,
    		show,
    		categories,
    		id,
    		i,
    		project,
    		getProjectById,
    		submitEdit,
    		toEdit,
    		saveProject,
    		uploadImage,
    		$isEditing,
    		$show,
    		$amountOfProjects,
    		$categories
    	});

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('i' in $$props) $$invalidate(1, i = $$props.i);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		id,
    		i,
    		project,
    		$isEditing,
    		$show,
    		$categories,
    		toEdit,
    		saveProject,
    		uploadImage,
    		input0_input_handler,
    		input1_change_handler,
    		change_handler,
    		input2_input_handler,
    		select_change_handler
    	];
    }

    class Edit extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$u, create_fragment$u, safe_not_equal, { id: 0, i: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Edit",
    			options,
    			id: create_fragment$u.name
    		});
    	}

    	get id() {
    		throw new Error("<Edit>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Edit>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get i() {
    		throw new Error("<Edit>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set i(value) {
    		throw new Error("<Edit>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\admin\ProjectsAD.svelte generated by Svelte v3.53.1 */

    const { console: console_1$k } = globals;
    const file$q = "src\\components\\admin\\ProjectsAD.svelte";

    function get_each_context$7(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	child_ctx[5] = i;
    	return child_ctx;
    }

    // (32:4) {:else}
    function create_else_block$4(ctx) {
    	let div0;
    	let h2;
    	let t0_value = /*project*/ ctx[3].title + "";
    	let t0;
    	let t1;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t2;
    	let div1;
    	let p0;
    	let strong0;
    	let t3;
    	let t4;
    	let p1;
    	let t5_value = /*project*/ ctx[3].description + "";
    	let t5;
    	let t6;
    	let div2;
    	let p2;
    	let strong1;
    	let t7;
    	let t8;
    	let p3;
    	let t9_value = /*project*/ ctx[3].category + "";
    	let t9;
    	let t10;
    	let div3;
    	let deletebtn;
    	let current;

    	deletebtn = new DeleteBtn({
    			props: { id: /*project*/ ctx[3].id },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			img = element("img");
    			t2 = space();
    			div1 = element("div");
    			p0 = element("p");
    			strong0 = element("strong");
    			t3 = text("Description");
    			t4 = space();
    			p1 = element("p");
    			t5 = text(t5_value);
    			t6 = space();
    			div2 = element("div");
    			p2 = element("p");
    			strong1 = element("strong");
    			t7 = text("Category");
    			t8 = space();
    			p3 = element("p");
    			t9 = text(t9_value);
    			t10 = space();
    			div3 = element("div");
    			create_component(deletebtn.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h2 = claim_element(div0_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t0 = claim_text(h2_nodes, t0_value);
    			h2_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);

    			img = claim_element(nodes, "IMG", {
    				src: true,
    				alt: true,
    				name: true,
    				height: true,
    				class: true
    			});

    			t2 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			p0 = claim_element(div1_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			strong0 = claim_element(p0_nodes, "STRONG", {});
    			var strong0_nodes = children(strong0);
    			t3 = claim_text(strong0_nodes, "Description");
    			strong0_nodes.forEach(detach_dev);
    			p0_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);
    			p1 = claim_element(div1_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t5 = claim_text(p1_nodes, t5_value);
    			p1_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t6 = claim_space(nodes);
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			p2 = claim_element(div2_nodes, "P", { class: true });
    			var p2_nodes = children(p2);
    			strong1 = claim_element(p2_nodes, "STRONG", {});
    			var strong1_nodes = children(strong1);
    			t7 = claim_text(strong1_nodes, "Category");
    			strong1_nodes.forEach(detach_dev);
    			p2_nodes.forEach(detach_dev);
    			t8 = claim_space(div2_nodes);
    			p3 = claim_element(div2_nodes, "P", { class: true });
    			var p3_nodes = children(p3);
    			t9 = claim_text(p3_nodes, t9_value);
    			p3_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t10 = claim_space(nodes);
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(deletebtn.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h2, "class", "svelte-13rhbp7");
    			add_location(h2, file$q, 33, 5, 782);
    			attr_dev(div0, "class", "header svelte-13rhbp7");
    			add_location(div0, file$q, 32, 4, 755);
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[3].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[3].title);
    			attr_dev(img, "name", "picture");
    			attr_dev(img, "height", "250px");
    			attr_dev(img, "class", "svelte-13rhbp7");
    			add_location(img, file$q, 35, 4, 824);
    			add_location(strong0, file$q, 42, 8, 968);
    			attr_dev(p0, "class", "svelte-13rhbp7");
    			add_location(p0, file$q, 42, 5, 965);
    			attr_dev(p1, "class", "description svelte-13rhbp7");
    			add_location(p1, file$q, 43, 5, 1007);
    			attr_dev(div1, "class", "desc svelte-13rhbp7");
    			add_location(div1, file$q, 41, 4, 940);
    			add_location(strong1, file$q, 47, 8, 1111);
    			attr_dev(p2, "class", "svelte-13rhbp7");
    			add_location(p2, file$q, 47, 5, 1108);
    			attr_dev(p3, "class", "svelte-13rhbp7");
    			add_location(p3, file$q, 48, 5, 1147);
    			attr_dev(div2, "class", "category svelte-13rhbp7");
    			add_location(div2, file$q, 46, 4, 1079);
    			attr_dev(div3, "class", "delete svelte-13rhbp7");
    			add_location(div3, file$q, 51, 4, 1192);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, h2);
    			append_hydration_dev(h2, t0);
    			insert_hydration_dev(target, t1, anchor);
    			insert_hydration_dev(target, img, anchor);
    			insert_hydration_dev(target, t2, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, p0);
    			append_hydration_dev(p0, strong0);
    			append_hydration_dev(strong0, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, p1);
    			append_hydration_dev(p1, t5);
    			insert_hydration_dev(target, t6, anchor);
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, p2);
    			append_hydration_dev(p2, strong1);
    			append_hydration_dev(strong1, t7);
    			append_hydration_dev(div2, t8);
    			append_hydration_dev(div2, p3);
    			append_hydration_dev(p3, t9);
    			insert_hydration_dev(target, t10, anchor);
    			insert_hydration_dev(target, div3, anchor);
    			mount_component(deletebtn, div3, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*$amountOfProjects*/ 1) && t0_value !== (t0_value = /*project*/ ctx[3].title + "")) set_data_dev(t0, t0_value);

    			if (!current || dirty & /*$amountOfProjects*/ 1 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[3].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*$amountOfProjects*/ 1 && img_alt_value !== (img_alt_value = /*project*/ ctx[3].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if ((!current || dirty & /*$amountOfProjects*/ 1) && t5_value !== (t5_value = /*project*/ ctx[3].description + "")) set_data_dev(t5, t5_value);
    			if ((!current || dirty & /*$amountOfProjects*/ 1) && t9_value !== (t9_value = /*project*/ ctx[3].category + "")) set_data_dev(t9, t9_value);
    			const deletebtn_changes = {};
    			if (dirty & /*$amountOfProjects*/ 1) deletebtn_changes.id = /*project*/ ctx[3].id;
    			deletebtn.$set(deletebtn_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(deletebtn.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(deletebtn.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(img);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div3);
    			destroy_component(deletebtn);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(32:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (30:4) {#if $isEditing && $show[i]}
    function create_if_block$g(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", {});
    			children(div).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(div, file$q, 30, 5, 730);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$g.name,
    		type: "if",
    		source: "(30:4) {#if $isEditing && $show[i]}",
    		ctx
    	});

    	return block;
    }

    // (23:1) {#each $amountOfProjects as project, i}
    function create_each_block$7(ctx) {
    	let article;
    	let div;
    	let edit;
    	let t0;
    	let current_block_type_index;
    	let if_block;
    	let t1;
    	let current;

    	edit = new Edit({
    			props: {
    				id: /*project*/ ctx[3].id,
    				i: /*i*/ ctx[5]
    			},
    			$$inline: true
    		});

    	const if_block_creators = [create_if_block$g, create_else_block$4];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$isEditing*/ ctx[1] && /*$show*/ ctx[2][/*i*/ ctx[5]]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			article = element("article");
    			div = element("div");
    			create_component(edit.$$.fragment);
    			t0 = space();
    			if_block.c();
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			article = claim_element(nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			div = claim_element(article_nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			claim_component(edit.$$.fragment, div_nodes);
    			div_nodes.forEach(detach_dev);
    			t0 = claim_space(article_nodes);
    			if_block.l(article_nodes);
    			t1 = claim_space(article_nodes);
    			article_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "edit svelte-13rhbp7");
    			add_location(div, file$q, 25, 4, 621);
    			attr_dev(article, "class", "project svelte-13rhbp7");
    			add_location(article, file$q, 23, 3, 588);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, article, anchor);
    			append_hydration_dev(article, div);
    			mount_component(edit, div, null);
    			append_hydration_dev(article, t0);
    			if_blocks[current_block_type_index].m(article, null);
    			append_hydration_dev(article, t1);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const edit_changes = {};
    			if (dirty & /*$amountOfProjects*/ 1) edit_changes.id = /*project*/ ctx[3].id;
    			edit.$set(edit_changes);
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
    				if_block.m(article, t1);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(edit.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(edit.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			destroy_component(edit);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$7.name,
    		type: "each",
    		source: "(23:1) {#each $amountOfProjects as project, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$t(ctx) {
    	let section;
    	let current;
    	let each_value = /*$amountOfProjects*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$7(get_each_context$7(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			section = element("section");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { class: true });
    			var section_nodes = children(section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(section_nodes);
    			}

    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(section, "class", "svelte-13rhbp7");
    			add_location(section, file$q, 21, 0, 532);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$isEditing, $show, $amountOfProjects*/ 7) {
    				each_value = /*$amountOfProjects*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$7(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$7(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(section, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$t.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const PROJECTS_ENDPOINT$6 = "http://localhost:4000/api/projects";

    function instance$t($$self, $$props, $$invalidate) {
    	let $amountOfProjects;
    	let $isEditing;
    	let $show;
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(0, $amountOfProjects = $$value));
    	validate_store(isEditing, 'isEditing');
    	component_subscribe($$self, isEditing, $$value => $$invalidate(1, $isEditing = $$value));
    	validate_store(show, 'show');
    	component_subscribe($$self, show, $$value => $$invalidate(2, $show = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ProjectsAD', slots, []);

    	onMount(async () => {
    		try {
    			const response = await axios.get(PROJECTS_ENDPOINT$6);
    			set_store_value(amountOfProjects, $amountOfProjects = response.data, $amountOfProjects);
    			console.log($amountOfProjects);
    		} catch(error) {
    			console.log(error);
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$k.warn(`<ProjectsAD> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		axios,
    		amountOfProjects,
    		isEditing,
    		show,
    		DeleteBtn,
    		Edit,
    		PROJECTS_ENDPOINT: PROJECTS_ENDPOINT$6,
    		$amountOfProjects,
    		$isEditing,
    		$show
    	});

    	return [$amountOfProjects, $isEditing, $show];
    }

    class ProjectsAD extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$t, create_fragment$t, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ProjectsAD",
    			options,
    			id: create_fragment$t.name
    		});
    	}
    }

    /* node_modules\svelte-simple-modal\src\Modal.svelte generated by Svelte v3.53.1 */

    const { Object: Object_1, window: window_1$2 } = globals;
    const file$p = "node_modules\\svelte-simple-modal\\src\\Modal.svelte";

    // (401:0) {#if Component}
    function create_if_block$f(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let t;
    	let div0;
    	let switch_instance;
    	let div0_class_value;
    	let div1_class_value;
    	let div1_aria_label_value;
    	let div1_aria_labelledby_value;
    	let div1_transition;
    	let div2_class_value;
    	let div3_class_value;
    	let div3_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*state*/ ctx[1].closeButton && create_if_block_1$4(ctx);
    	var switch_value = /*Component*/ ctx[2];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			div0 = element("div");
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div2_nodes = children(div2);

    			div1 = claim_element(div2_nodes, "DIV", {
    				class: true,
    				role: true,
    				"aria-modal": true,
    				"aria-label": true,
    				"aria-labelledby": true,
    				style: true
    			});

    			var div1_nodes = children(div1);
    			if (if_block) if_block.l(div1_nodes);
    			t = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			if (switch_instance) claim_component(switch_instance.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty(/*state*/ ctx[1].classContent) + " svelte-g4wg3a"));
    			attr_dev(div0, "style", /*cssContent*/ ctx[9]);
    			toggle_class(div0, "content", !/*unstyled*/ ctx[0]);
    			add_location(div0, file$p, 444, 8, 11301);
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindow) + " svelte-g4wg3a"));
    			attr_dev(div1, "role", "dialog");
    			attr_dev(div1, "aria-modal", "true");

    			attr_dev(div1, "aria-label", div1_aria_label_value = /*state*/ ctx[1].ariaLabelledBy
    			? null
    			: /*state*/ ctx[1].ariaLabel || null);

    			attr_dev(div1, "aria-labelledby", div1_aria_labelledby_value = /*state*/ ctx[1].ariaLabelledBy || null);
    			attr_dev(div1, "style", /*cssWindow*/ ctx[8]);
    			toggle_class(div1, "window", !/*unstyled*/ ctx[0]);
    			add_location(div1, file$p, 416, 6, 10354);
    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindowWrap) + " svelte-g4wg3a"));
    			attr_dev(div2, "style", /*cssWindowWrap*/ ctx[7]);
    			toggle_class(div2, "wrap", !/*unstyled*/ ctx[0]);
    			add_location(div2, file$p, 410, 4, 10221);
    			attr_dev(div3, "class", div3_class_value = "" + (null_to_empty(/*state*/ ctx[1].classBg) + " svelte-g4wg3a"));
    			attr_dev(div3, "style", /*cssBg*/ ctx[6]);
    			toggle_class(div3, "bg", !/*unstyled*/ ctx[0]);
    			add_location(div3, file$p, 401, 2, 9975);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_hydration_dev(div1, t);
    			append_hydration_dev(div1, div0);
    			if (switch_instance) mount_component(switch_instance, div0, null);
    			/*div1_binding*/ ctx[48](div1);
    			/*div2_binding*/ ctx[49](div2);
    			/*div3_binding*/ ctx[50](div3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						div1,
    						"introstart",
    						function () {
    							if (is_function(/*onOpen*/ ctx[13])) /*onOpen*/ ctx[13].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"outrostart",
    						function () {
    							if (is_function(/*onClose*/ ctx[14])) /*onClose*/ ctx[14].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"introend",
    						function () {
    							if (is_function(/*onOpened*/ ctx[15])) /*onOpened*/ ctx[15].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"outroend",
    						function () {
    							if (is_function(/*onClosed*/ ctx[16])) /*onClosed*/ ctx[16].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(div3, "mousedown", /*handleOuterMousedown*/ ctx[20], false, false, false),
    					listen_dev(div3, "mouseup", /*handleOuterMouseup*/ ctx[21], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*state*/ ctx[1].closeButton) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*state*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_1$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (switch_value !== (switch_value = /*Component*/ ctx[2])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, div0, null);
    				} else {
    					switch_instance = null;
    				}
    			}

    			if (!current || dirty[0] & /*state*/ 2 && div0_class_value !== (div0_class_value = "" + (null_to_empty(/*state*/ ctx[1].classContent) + " svelte-g4wg3a"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (!current || dirty[0] & /*cssContent*/ 512) {
    				attr_dev(div0, "style", /*cssContent*/ ctx[9]);
    			}

    			if (!current || dirty[0] & /*state, unstyled*/ 3) {
    				toggle_class(div0, "content", !/*unstyled*/ ctx[0]);
    			}

    			if (!current || dirty[0] & /*state*/ 2 && div1_class_value !== (div1_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindow) + " svelte-g4wg3a"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (!current || dirty[0] & /*state*/ 2 && div1_aria_label_value !== (div1_aria_label_value = /*state*/ ctx[1].ariaLabelledBy
    			? null
    			: /*state*/ ctx[1].ariaLabel || null)) {
    				attr_dev(div1, "aria-label", div1_aria_label_value);
    			}

    			if (!current || dirty[0] & /*state*/ 2 && div1_aria_labelledby_value !== (div1_aria_labelledby_value = /*state*/ ctx[1].ariaLabelledBy || null)) {
    				attr_dev(div1, "aria-labelledby", div1_aria_labelledby_value);
    			}

    			if (!current || dirty[0] & /*cssWindow*/ 256) {
    				attr_dev(div1, "style", /*cssWindow*/ ctx[8]);
    			}

    			if (!current || dirty[0] & /*state, unstyled*/ 3) {
    				toggle_class(div1, "window", !/*unstyled*/ ctx[0]);
    			}

    			if (!current || dirty[0] & /*state*/ 2 && div2_class_value !== (div2_class_value = "" + (null_to_empty(/*state*/ ctx[1].classWindowWrap) + " svelte-g4wg3a"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (!current || dirty[0] & /*cssWindowWrap*/ 128) {
    				attr_dev(div2, "style", /*cssWindowWrap*/ ctx[7]);
    			}

    			if (!current || dirty[0] & /*state, unstyled*/ 3) {
    				toggle_class(div2, "wrap", !/*unstyled*/ ctx[0]);
    			}

    			if (!current || dirty[0] & /*state*/ 2 && div3_class_value !== (div3_class_value = "" + (null_to_empty(/*state*/ ctx[1].classBg) + " svelte-g4wg3a"))) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (!current || dirty[0] & /*cssBg*/ 64) {
    				attr_dev(div3, "style", /*cssBg*/ ctx[6]);
    			}

    			if (!current || dirty[0] & /*state, unstyled*/ 3) {
    				toggle_class(div3, "bg", !/*unstyled*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[12], /*state*/ ctx[1].transitionWindowProps, true);
    				div1_transition.run(1);
    			});

    			add_render_callback(() => {
    				if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[11], /*state*/ ctx[1].transitionBgProps, true);
    				div3_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[12], /*state*/ ctx[1].transitionWindowProps, false);
    			div1_transition.run(0);
    			if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[11], /*state*/ ctx[1].transitionBgProps, false);
    			div3_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    			if (switch_instance) destroy_component(switch_instance);
    			/*div1_binding*/ ctx[48](null);
    			if (detaching && div1_transition) div1_transition.end();
    			/*div2_binding*/ ctx[49](null);
    			/*div3_binding*/ ctx[50](null);
    			if (detaching && div3_transition) div3_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$f.name,
    		type: "if",
    		source: "(401:0) {#if Component}",
    		ctx
    	});

    	return block;
    }

    // (432:8) {#if state.closeButton}
    function create_if_block_1$4(ctx) {
    	let show_if;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2$1, create_else_block$3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (dirty[0] & /*state*/ 2) show_if = null;
    		if (show_if == null) show_if = !!/*isFunction*/ ctx[17](/*state*/ ctx[1].closeButton);
    		if (show_if) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx, [-1, -1, -1]);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx, dirty);

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
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(432:8) {#if state.closeButton}",
    		ctx
    	});

    	return block;
    }

    // (435:10) {:else}
    function create_else_block$3(ctx) {
    	let button;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", {
    				class: true,
    				"aria-label": true,
    				style: true
    			});

    			children(button).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty(/*state*/ ctx[1].classCloseButton) + " svelte-g4wg3a"));
    			attr_dev(button, "aria-label", "Close modal");
    			attr_dev(button, "style", /*cssCloseButton*/ ctx[10]);
    			toggle_class(button, "close", !/*unstyled*/ ctx[0]);
    			add_location(button, file$p, 435, 12, 11050);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*close*/ ctx[18], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*state*/ 2 && button_class_value !== (button_class_value = "" + (null_to_empty(/*state*/ ctx[1].classCloseButton) + " svelte-g4wg3a"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty[0] & /*cssCloseButton*/ 1024) {
    				attr_dev(button, "style", /*cssCloseButton*/ ctx[10]);
    			}

    			if (dirty[0] & /*state, unstyled*/ 3) {
    				toggle_class(button, "close", !/*unstyled*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(435:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (433:10) {#if isFunction(state.closeButton)}
    function create_if_block_2$1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*state*/ ctx[1].closeButton;

    	function switch_props(ctx) {
    		return {
    			props: { onClose: /*close*/ ctx[18] },
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props(ctx));
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) mount_component(switch_instance, target, anchor);
    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (switch_value !== (switch_value = /*state*/ ctx[1].closeButton)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = construct_svelte_component_dev(switch_value, switch_props(ctx));
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
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
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(433:10) {#if isFunction(state.closeButton)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$s(ctx) {
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*Component*/ ctx[2] && create_if_block$f(ctx);
    	const default_slot_template = /*#slots*/ ctx[47].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[46], null);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			t = claim_space(nodes);
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, t, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window_1$2, "keydown", /*handleKeydown*/ ctx[19], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*Component*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*Component*/ 4) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$f(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 32768)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[46],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[46])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[46], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$s.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function bind(Component, props = {}) {
    	return function ModalComponent(options) {
    		return new Component({
    				...options,
    				props: { ...props, ...options.props }
    			});
    	};
    }

    function instance$s($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, ['default']);
    	const dispatch = createEventDispatcher();
    	const baseSetContext = setContext;
    	let { show = null } = $$props;
    	let { key = 'simple-modal' } = $$props;
    	let { ariaLabel = null } = $$props;
    	let { ariaLabelledBy = null } = $$props;
    	let { closeButton = true } = $$props;
    	let { closeOnEsc = true } = $$props;
    	let { closeOnOuterClick = true } = $$props;
    	let { styleBg = {} } = $$props;
    	let { styleWindowWrap = {} } = $$props;
    	let { styleWindow = {} } = $$props;
    	let { styleContent = {} } = $$props;
    	let { styleCloseButton = {} } = $$props;
    	let { classBg = null } = $$props;
    	let { classWindowWrap = null } = $$props;
    	let { classWindow = null } = $$props;
    	let { classContent = null } = $$props;
    	let { classCloseButton = null } = $$props;
    	let { unstyled = false } = $$props;
    	let { setContext: setContext$1 = baseSetContext } = $$props;
    	let { transitionBg = fade } = $$props;
    	let { transitionBgProps = { duration: 250 } } = $$props;
    	let { transitionWindow = transitionBg } = $$props;
    	let { transitionWindowProps = transitionBgProps } = $$props;
    	let { disableFocusTrap = false } = $$props;

    	const defaultState = {
    		ariaLabel,
    		ariaLabelledBy,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		classBg,
    		classWindowWrap,
    		classWindow,
    		classContent,
    		classCloseButton,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		disableFocusTrap,
    		unstyled
    	};

    	let state = { ...defaultState };
    	let Component = null;
    	let background;
    	let wrap;
    	let modalWindow;
    	let scrollY;
    	let cssBg;
    	let cssWindowWrap;
    	let cssWindow;
    	let cssContent;
    	let cssCloseButton;
    	let currentTransitionBg;
    	let currentTransitionWindow;
    	let prevBodyPosition;
    	let prevBodyOverflow;
    	let prevBodyWidth;
    	let outerClickTarget;
    	const camelCaseToDash = str => str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();

    	const toCssString = props => props
    	? Object.keys(props).reduce((str, key) => `${str}; ${camelCaseToDash(key)}: ${props[key]}`, '')
    	: '';

    	const isFunction = f => !!(f && f.constructor && f.call && f.apply);

    	const updateStyleTransition = () => {
    		$$invalidate(6, cssBg = toCssString(Object.assign(
    			{},
    			{
    				width: window.innerWidth,
    				height: window.innerHeight
    			},
    			state.styleBg
    		)));

    		$$invalidate(7, cssWindowWrap = toCssString(state.styleWindowWrap));
    		$$invalidate(8, cssWindow = toCssString(state.styleWindow));
    		$$invalidate(9, cssContent = toCssString(state.styleContent));
    		$$invalidate(10, cssCloseButton = toCssString(state.styleCloseButton));
    		$$invalidate(11, currentTransitionBg = state.transitionBg);
    		$$invalidate(12, currentTransitionWindow = state.transitionWindow);
    	};

    	const toVoid = () => {
    		
    	};

    	let onOpen = toVoid;
    	let onClose = toVoid;
    	let onOpened = toVoid;
    	let onClosed = toVoid;

    	const open = (NewComponent, newProps = {}, options = {}, callback = {}) => {
    		$$invalidate(2, Component = bind(NewComponent, newProps));
    		$$invalidate(1, state = { ...defaultState, ...options });
    		updateStyleTransition();
    		disableScroll();

    		$$invalidate(13, onOpen = event => {
    			if (callback.onOpen) callback.onOpen(event);

    			/**
     * The open event is fired right before the modal opens
     * @event {void} open
     */
    			dispatch('open');

    			/**
     * The opening event is fired right before the modal opens
     * @event {void} opening
     * @deprecated Listen to the `open` event instead
     */
    			dispatch('opening'); // Deprecated. Do not use!
    		});

    		$$invalidate(14, onClose = event => {
    			if (callback.onClose) callback.onClose(event);

    			/**
     * The close event is fired right before the modal closes
     * @event {void} close
     */
    			dispatch('close');

    			/**
     * The closing event is fired right before the modal closes
     * @event {void} closing
     * @deprecated Listen to the `close` event instead
     */
    			dispatch('closing'); // Deprecated. Do not use!
    		});

    		$$invalidate(15, onOpened = event => {
    			if (callback.onOpened) callback.onOpened(event);

    			/**
     * The opened event is fired after the modal's opening transition
     * @event {void} opened
     */
    			dispatch('opened');
    		});

    		$$invalidate(16, onClosed = event => {
    			if (callback.onClosed) callback.onClosed(event);

    			/**
     * The closed event is fired after the modal's closing transition
     * @event {void} closed
     */
    			dispatch('closed');
    		});
    	};

    	const close = (callback = {}) => {
    		if (!Component) return;
    		$$invalidate(14, onClose = callback.onClose || onClose);
    		$$invalidate(16, onClosed = callback.onClosed || onClosed);
    		$$invalidate(2, Component = null);
    		enableScroll();
    	};

    	const handleKeydown = event => {
    		if (state.closeOnEsc && Component && event.key === 'Escape') {
    			event.preventDefault();
    			close();
    		}

    		if (Component && event.key === 'Tab' && !state.disableFocusTrap) {
    			// trap focus
    			const nodes = modalWindow.querySelectorAll('*');

    			const tabbable = Array.from(nodes).filter(node => node.tabIndex >= 0);
    			let index = tabbable.indexOf(document.activeElement);
    			if (index === -1 && event.shiftKey) index = 0;
    			index += tabbable.length + (event.shiftKey ? -1 : 1);
    			index %= tabbable.length;
    			tabbable[index].focus();
    			event.preventDefault();
    		}
    	};

    	const handleOuterMousedown = event => {
    		if (state.closeOnOuterClick && (event.target === background || event.target === wrap)) outerClickTarget = event.target;
    	};

    	const handleOuterMouseup = event => {
    		if (state.closeOnOuterClick && event.target === outerClickTarget) {
    			event.preventDefault();
    			close();
    		}
    	};

    	const disableScroll = () => {
    		scrollY = window.scrollY;
    		prevBodyPosition = document.body.style.position;
    		prevBodyOverflow = document.body.style.overflow;
    		prevBodyWidth = document.body.style.width;
    		document.body.style.position = 'fixed';
    		document.body.style.top = `-${scrollY}px`;
    		document.body.style.overflow = 'hidden';
    		document.body.style.width = '100%';
    	};

    	const enableScroll = () => {
    		document.body.style.position = prevBodyPosition || '';
    		document.body.style.top = '';
    		document.body.style.overflow = prevBodyOverflow || '';
    		document.body.style.width = prevBodyWidth || '';
    		window.scrollTo(0, scrollY);
    	};

    	setContext$1(key, { open, close });
    	let isMounted = false;

    	onDestroy(() => {
    		if (isMounted) close();
    	});

    	onMount(() => {
    		$$invalidate(45, isMounted = true);
    	});

    	const writable_props = [
    		'show',
    		'key',
    		'ariaLabel',
    		'ariaLabelledBy',
    		'closeButton',
    		'closeOnEsc',
    		'closeOnOuterClick',
    		'styleBg',
    		'styleWindowWrap',
    		'styleWindow',
    		'styleContent',
    		'styleCloseButton',
    		'classBg',
    		'classWindowWrap',
    		'classWindow',
    		'classContent',
    		'classCloseButton',
    		'unstyled',
    		'setContext',
    		'transitionBg',
    		'transitionBgProps',
    		'transitionWindow',
    		'transitionWindowProps',
    		'disableFocusTrap'
    	];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			modalWindow = $$value;
    			$$invalidate(5, modalWindow);
    		});
    	}

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			wrap = $$value;
    			$$invalidate(4, wrap);
    		});
    	}

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			background = $$value;
    			$$invalidate(3, background);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('show' in $$props) $$invalidate(22, show = $$props.show);
    		if ('key' in $$props) $$invalidate(23, key = $$props.key);
    		if ('ariaLabel' in $$props) $$invalidate(24, ariaLabel = $$props.ariaLabel);
    		if ('ariaLabelledBy' in $$props) $$invalidate(25, ariaLabelledBy = $$props.ariaLabelledBy);
    		if ('closeButton' in $$props) $$invalidate(26, closeButton = $$props.closeButton);
    		if ('closeOnEsc' in $$props) $$invalidate(27, closeOnEsc = $$props.closeOnEsc);
    		if ('closeOnOuterClick' in $$props) $$invalidate(28, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ('styleBg' in $$props) $$invalidate(29, styleBg = $$props.styleBg);
    		if ('styleWindowWrap' in $$props) $$invalidate(30, styleWindowWrap = $$props.styleWindowWrap);
    		if ('styleWindow' in $$props) $$invalidate(31, styleWindow = $$props.styleWindow);
    		if ('styleContent' in $$props) $$invalidate(32, styleContent = $$props.styleContent);
    		if ('styleCloseButton' in $$props) $$invalidate(33, styleCloseButton = $$props.styleCloseButton);
    		if ('classBg' in $$props) $$invalidate(34, classBg = $$props.classBg);
    		if ('classWindowWrap' in $$props) $$invalidate(35, classWindowWrap = $$props.classWindowWrap);
    		if ('classWindow' in $$props) $$invalidate(36, classWindow = $$props.classWindow);
    		if ('classContent' in $$props) $$invalidate(37, classContent = $$props.classContent);
    		if ('classCloseButton' in $$props) $$invalidate(38, classCloseButton = $$props.classCloseButton);
    		if ('unstyled' in $$props) $$invalidate(0, unstyled = $$props.unstyled);
    		if ('setContext' in $$props) $$invalidate(39, setContext$1 = $$props.setContext);
    		if ('transitionBg' in $$props) $$invalidate(40, transitionBg = $$props.transitionBg);
    		if ('transitionBgProps' in $$props) $$invalidate(41, transitionBgProps = $$props.transitionBgProps);
    		if ('transitionWindow' in $$props) $$invalidate(42, transitionWindow = $$props.transitionWindow);
    		if ('transitionWindowProps' in $$props) $$invalidate(43, transitionWindowProps = $$props.transitionWindowProps);
    		if ('disableFocusTrap' in $$props) $$invalidate(44, disableFocusTrap = $$props.disableFocusTrap);
    		if ('$$scope' in $$props) $$invalidate(46, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		bind,
    		svelte,
    		fade,
    		createEventDispatcher,
    		dispatch,
    		baseSetContext,
    		show,
    		key,
    		ariaLabel,
    		ariaLabelledBy,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		classBg,
    		classWindowWrap,
    		classWindow,
    		classContent,
    		classCloseButton,
    		unstyled,
    		setContext: setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		disableFocusTrap,
    		defaultState,
    		state,
    		Component,
    		background,
    		wrap,
    		modalWindow,
    		scrollY,
    		cssBg,
    		cssWindowWrap,
    		cssWindow,
    		cssContent,
    		cssCloseButton,
    		currentTransitionBg,
    		currentTransitionWindow,
    		prevBodyPosition,
    		prevBodyOverflow,
    		prevBodyWidth,
    		outerClickTarget,
    		camelCaseToDash,
    		toCssString,
    		isFunction,
    		updateStyleTransition,
    		toVoid,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		open,
    		close,
    		handleKeydown,
    		handleOuterMousedown,
    		handleOuterMouseup,
    		disableScroll,
    		enableScroll,
    		isMounted
    	});

    	$$self.$inject_state = $$props => {
    		if ('show' in $$props) $$invalidate(22, show = $$props.show);
    		if ('key' in $$props) $$invalidate(23, key = $$props.key);
    		if ('ariaLabel' in $$props) $$invalidate(24, ariaLabel = $$props.ariaLabel);
    		if ('ariaLabelledBy' in $$props) $$invalidate(25, ariaLabelledBy = $$props.ariaLabelledBy);
    		if ('closeButton' in $$props) $$invalidate(26, closeButton = $$props.closeButton);
    		if ('closeOnEsc' in $$props) $$invalidate(27, closeOnEsc = $$props.closeOnEsc);
    		if ('closeOnOuterClick' in $$props) $$invalidate(28, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ('styleBg' in $$props) $$invalidate(29, styleBg = $$props.styleBg);
    		if ('styleWindowWrap' in $$props) $$invalidate(30, styleWindowWrap = $$props.styleWindowWrap);
    		if ('styleWindow' in $$props) $$invalidate(31, styleWindow = $$props.styleWindow);
    		if ('styleContent' in $$props) $$invalidate(32, styleContent = $$props.styleContent);
    		if ('styleCloseButton' in $$props) $$invalidate(33, styleCloseButton = $$props.styleCloseButton);
    		if ('classBg' in $$props) $$invalidate(34, classBg = $$props.classBg);
    		if ('classWindowWrap' in $$props) $$invalidate(35, classWindowWrap = $$props.classWindowWrap);
    		if ('classWindow' in $$props) $$invalidate(36, classWindow = $$props.classWindow);
    		if ('classContent' in $$props) $$invalidate(37, classContent = $$props.classContent);
    		if ('classCloseButton' in $$props) $$invalidate(38, classCloseButton = $$props.classCloseButton);
    		if ('unstyled' in $$props) $$invalidate(0, unstyled = $$props.unstyled);
    		if ('setContext' in $$props) $$invalidate(39, setContext$1 = $$props.setContext);
    		if ('transitionBg' in $$props) $$invalidate(40, transitionBg = $$props.transitionBg);
    		if ('transitionBgProps' in $$props) $$invalidate(41, transitionBgProps = $$props.transitionBgProps);
    		if ('transitionWindow' in $$props) $$invalidate(42, transitionWindow = $$props.transitionWindow);
    		if ('transitionWindowProps' in $$props) $$invalidate(43, transitionWindowProps = $$props.transitionWindowProps);
    		if ('disableFocusTrap' in $$props) $$invalidate(44, disableFocusTrap = $$props.disableFocusTrap);
    		if ('state' in $$props) $$invalidate(1, state = $$props.state);
    		if ('Component' in $$props) $$invalidate(2, Component = $$props.Component);
    		if ('background' in $$props) $$invalidate(3, background = $$props.background);
    		if ('wrap' in $$props) $$invalidate(4, wrap = $$props.wrap);
    		if ('modalWindow' in $$props) $$invalidate(5, modalWindow = $$props.modalWindow);
    		if ('scrollY' in $$props) scrollY = $$props.scrollY;
    		if ('cssBg' in $$props) $$invalidate(6, cssBg = $$props.cssBg);
    		if ('cssWindowWrap' in $$props) $$invalidate(7, cssWindowWrap = $$props.cssWindowWrap);
    		if ('cssWindow' in $$props) $$invalidate(8, cssWindow = $$props.cssWindow);
    		if ('cssContent' in $$props) $$invalidate(9, cssContent = $$props.cssContent);
    		if ('cssCloseButton' in $$props) $$invalidate(10, cssCloseButton = $$props.cssCloseButton);
    		if ('currentTransitionBg' in $$props) $$invalidate(11, currentTransitionBg = $$props.currentTransitionBg);
    		if ('currentTransitionWindow' in $$props) $$invalidate(12, currentTransitionWindow = $$props.currentTransitionWindow);
    		if ('prevBodyPosition' in $$props) prevBodyPosition = $$props.prevBodyPosition;
    		if ('prevBodyOverflow' in $$props) prevBodyOverflow = $$props.prevBodyOverflow;
    		if ('prevBodyWidth' in $$props) prevBodyWidth = $$props.prevBodyWidth;
    		if ('outerClickTarget' in $$props) outerClickTarget = $$props.outerClickTarget;
    		if ('onOpen' in $$props) $$invalidate(13, onOpen = $$props.onOpen);
    		if ('onClose' in $$props) $$invalidate(14, onClose = $$props.onClose);
    		if ('onOpened' in $$props) $$invalidate(15, onOpened = $$props.onOpened);
    		if ('onClosed' in $$props) $$invalidate(16, onClosed = $$props.onClosed);
    		if ('isMounted' in $$props) $$invalidate(45, isMounted = $$props.isMounted);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*show*/ 4194304 | $$self.$$.dirty[1] & /*isMounted*/ 16384) {
    			{
    				if (isMounted) {
    					if (isFunction(show)) {
    						open(show);
    					} else {
    						close();
    					}
    				}
    			}
    		}
    	};

    	return [
    		unstyled,
    		state,
    		Component,
    		background,
    		wrap,
    		modalWindow,
    		cssBg,
    		cssWindowWrap,
    		cssWindow,
    		cssContent,
    		cssCloseButton,
    		currentTransitionBg,
    		currentTransitionWindow,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		isFunction,
    		close,
    		handleKeydown,
    		handleOuterMousedown,
    		handleOuterMouseup,
    		show,
    		key,
    		ariaLabel,
    		ariaLabelledBy,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		classBg,
    		classWindowWrap,
    		classWindow,
    		classContent,
    		classCloseButton,
    		setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		disableFocusTrap,
    		isMounted,
    		$$scope,
    		slots,
    		div1_binding,
    		div2_binding,
    		div3_binding
    	];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$s,
    			create_fragment$s,
    			safe_not_equal,
    			{
    				show: 22,
    				key: 23,
    				ariaLabel: 24,
    				ariaLabelledBy: 25,
    				closeButton: 26,
    				closeOnEsc: 27,
    				closeOnOuterClick: 28,
    				styleBg: 29,
    				styleWindowWrap: 30,
    				styleWindow: 31,
    				styleContent: 32,
    				styleCloseButton: 33,
    				classBg: 34,
    				classWindowWrap: 35,
    				classWindow: 36,
    				classContent: 37,
    				classCloseButton: 38,
    				unstyled: 0,
    				setContext: 39,
    				transitionBg: 40,
    				transitionBgProps: 41,
    				transitionWindow: 42,
    				transitionWindowProps: 43,
    				disableFocusTrap: 44
    			},
    			null,
    			[-1, -1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$s.name
    		});
    	}

    	get show() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set show(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get key() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ariaLabel() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ariaLabel(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ariaLabelledBy() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ariaLabelledBy(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeButton() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeButton(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnEsc() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnEsc(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnOuterClick() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnOuterClick(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleBg() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleBg(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleWindowWrap() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleWindowWrap(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleWindow() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleWindow(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleContent() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleContent(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleCloseButton() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleCloseButton(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get classBg() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classBg(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get classWindowWrap() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classWindowWrap(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get classWindow() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classWindow(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get classContent() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classContent(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get classCloseButton() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classCloseButton(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get unstyled() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set unstyled(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setContext() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set setContext(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionBg() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionBg(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionBgProps() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionBgProps(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionWindow() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionWindow(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionWindowProps() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionWindowProps(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disableFocusTrap() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disableFocusTrap(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\admin\CreateForm.svelte generated by Svelte v3.53.1 */

    const { console: console_1$j } = globals;
    const file$o = "src\\components\\admin\\CreateForm.svelte";

    function get_each_context$6(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    // (85:8) {#each $categories as category}
    function create_each_block$6(ctx) {
    	let option;
    	let t_value = /*category*/ ctx[12] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			option = claim_element(nodes, "OPTION", {});
    			var option_nodes = children(option);
    			t = claim_text(option_nodes, t_value);
    			option_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			option.__value = option_value_value = /*category*/ ctx[12];
    			option.value = option.__value;
    			add_location(option, file$o, 85, 12, 2652);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, option, anchor);
    			append_hydration_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$categories*/ 8 && t_value !== (t_value = /*category*/ ctx[12] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$categories*/ 8 && option_value_value !== (option_value_value = /*category*/ ctx[12])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$6.name,
    		type: "each",
    		source: "(85:8) {#each $categories as category}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$r(ctx) {
    	let form;
    	let label0;
    	let t0;
    	let input0;
    	let t1;
    	let label1;
    	let t2;
    	let input1;
    	let t3;
    	let label2;
    	let t4;
    	let input2;
    	let t5;
    	let label3;
    	let t6;
    	let select;
    	let t7;
    	let p;
    	let t8;
    	let p_class_value;
    	let t9;
    	let button;
    	let t10;
    	let mounted;
    	let dispose;
    	let each_value = /*$categories*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$6(get_each_context$6(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			form = element("form");
    			label0 = element("label");
    			t0 = text("Title\r\n            ");
    			input0 = element("input");
    			t1 = space();
    			label1 = element("label");
    			t2 = text("Picture\r\n            ");
    			input1 = element("input");
    			t3 = space();
    			label2 = element("label");
    			t4 = text("description\r\n            ");
    			input2 = element("input");
    			t5 = space();
    			label3 = element("label");
    			t6 = text("choose a category\r\n        ");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			p = element("p");
    			t8 = text(/*validationMessage*/ ctx[0]);
    			t9 = space();
    			button = element("button");
    			t10 = text("submit");
    			this.h();
    		},
    		l: function claim(nodes) {
    			form = claim_element(nodes, "FORM", { enctype: true });
    			var form_nodes = children(form);
    			label0 = claim_element(form_nodes, "LABEL", { for: true, class: true });
    			var label0_nodes = children(label0);
    			t0 = claim_text(label0_nodes, "Title\r\n            ");

    			input0 = claim_element(label0_nodes, "INPUT", {
    				type: true,
    				accept: true,
    				name: true,
    				placeholder: true
    			});

    			label0_nodes.forEach(detach_dev);
    			t1 = claim_space(form_nodes);
    			label1 = claim_element(form_nodes, "LABEL", { for: true, class: true });
    			var label1_nodes = children(label1);
    			t2 = claim_text(label1_nodes, "Picture\r\n            ");

    			input1 = claim_element(label1_nodes, "INPUT", {
    				type: true,
    				name: true,
    				placeholder: true
    			});

    			label1_nodes.forEach(detach_dev);
    			t3 = claim_space(form_nodes);
    			label2 = claim_element(form_nodes, "LABEL", { for: true, class: true });
    			var label2_nodes = children(label2);
    			t4 = claim_text(label2_nodes, "description\r\n            ");

    			input2 = claim_element(label2_nodes, "INPUT", {
    				type: true,
    				name: true,
    				placeholder: true
    			});

    			label2_nodes.forEach(detach_dev);
    			t5 = claim_space(form_nodes);
    			label3 = claim_element(form_nodes, "LABEL", { for: true, class: true });
    			var label3_nodes = children(label3);
    			t6 = claim_text(label3_nodes, "choose a category\r\n        ");
    			select = claim_element(label3_nodes, "SELECT", {});
    			var select_nodes = children(select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(select_nodes);
    			}

    			select_nodes.forEach(detach_dev);
    			label3_nodes.forEach(detach_dev);
    			t7 = claim_space(form_nodes);
    			p = claim_element(form_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t8 = claim_text(p_nodes, /*validationMessage*/ ctx[0]);
    			p_nodes.forEach(detach_dev);
    			t9 = claim_space(form_nodes);
    			button = claim_element(form_nodes, "BUTTON", { type: true, class: true });
    			var button_nodes = children(button);
    			t10 = claim_text(button_nodes, "submit");
    			button_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "accept", ".jpg, .jpeg, .png");
    			attr_dev(input0, "name", "title");
    			attr_dev(input0, "placeholder", "title");
    			input0.required = true;
    			add_location(input0, file$o, 67, 12, 1829);
    			attr_dev(label0, "for", "title");
    			attr_dev(label0, "class", "svelte-yo0b2j");
    			add_location(label0, file$o, 65, 8, 1777);
    			attr_dev(input1, "type", "file");
    			attr_dev(input1, "name", "picture");
    			attr_dev(input1, "placeholder", "picture");
    			input1.required = true;
    			add_location(input1, file$o, 72, 12, 2037);
    			attr_dev(label1, "for", "picture");
    			attr_dev(label1, "class", "svelte-yo0b2j");
    			add_location(label1, file$o, 70, 8, 1981);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "name", "description");
    			attr_dev(input2, "placeholder", "description");
    			input2.required = true;
    			add_location(input2, file$o, 78, 12, 2341);
    			attr_dev(label2, "for", "description");
    			attr_dev(label2, "class", "svelte-yo0b2j");
    			add_location(label2, file$o, 76, 8, 2277);
    			select.required = true;
    			if (/*newProject*/ ctx[2].category === void 0) add_render_callback(() => /*select_change_handler*/ ctx[10].call(select));
    			add_location(select, file$o, 83, 8, 2547);
    			attr_dev(label3, "for", "category");
    			attr_dev(label3, "class", "svelte-yo0b2j");
    			add_location(label3, file$o, 81, 8, 2484);
    			attr_dev(p, "class", p_class_value = "" + (null_to_empty(/*validationCSS*/ ctx[1]) + " svelte-yo0b2j"));
    			add_location(p, file$o, 89, 8, 2760);
    			attr_dev(button, "type", "submit");
    			button.value = "submit";
    			attr_dev(button, "class", "submit svelte-yo0b2j");
    			add_location(button, file$o, 90, 8, 2818);
    			attr_dev(form, "enctype", "multipart/form-data");
    			add_location(form, file$o, 64, 0, 1688);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, form, anchor);
    			append_hydration_dev(form, label0);
    			append_hydration_dev(label0, t0);
    			append_hydration_dev(label0, input0);
    			set_input_value(input0, /*newProject*/ ctx[2].title);
    			append_hydration_dev(form, t1);
    			append_hydration_dev(form, label1);
    			append_hydration_dev(label1, t2);
    			append_hydration_dev(label1, input1);
    			append_hydration_dev(form, t3);
    			append_hydration_dev(form, label2);
    			append_hydration_dev(label2, t4);
    			append_hydration_dev(label2, input2);
    			set_input_value(input2, /*newProject*/ ctx[2].description);
    			append_hydration_dev(form, t5);
    			append_hydration_dev(form, label3);
    			append_hydration_dev(label3, t6);
    			append_hydration_dev(label3, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*newProject*/ ctx[2].category);
    			append_hydration_dev(form, t7);
    			append_hydration_dev(form, p);
    			append_hydration_dev(p, t8);
    			append_hydration_dev(form, t9);
    			append_hydration_dev(form, button);
    			append_hydration_dev(button, t10);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[7]),
    					listen_dev(input1, "change", /*change_handler*/ ctx[8], false, false, false),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[9]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[10]),
    					listen_dev(form, "submit", prevent_default(/*submitProject*/ ctx[4]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*newProject, $categories*/ 12 && input0.value !== /*newProject*/ ctx[2].title) {
    				set_input_value(input0, /*newProject*/ ctx[2].title);
    			}

    			if (dirty & /*newProject, $categories*/ 12 && input2.value !== /*newProject*/ ctx[2].description) {
    				set_input_value(input2, /*newProject*/ ctx[2].description);
    			}

    			if (dirty & /*$categories*/ 8) {
    				each_value = /*$categories*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$6(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$6(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*newProject, $categories*/ 12) {
    				select_option(select, /*newProject*/ ctx[2].category);
    			}

    			if (dirty & /*validationMessage*/ 1) set_data_dev(t8, /*validationMessage*/ ctx[0]);

    			if (dirty & /*validationCSS*/ 2 && p_class_value !== (p_class_value = "" + (null_to_empty(/*validationCSS*/ ctx[1]) + " svelte-yo0b2j"))) {
    				attr_dev(p, "class", p_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$r.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$r($$self, $$props, $$invalidate) {
    	let $categories;
    	validate_store(categories, 'categories');
    	component_subscribe($$self, categories, $$value => $$invalidate(3, $categories = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CreateForm', slots, []);
    	let validationMessage = "";
    	let validationCSS = "";

    	const newProject = {
    		title: "",
    		description: "",
    		category: "",
    		image_url: ""
    	};

    	const submitProject = () => {
    		axios.post("http://localhost:4000/api/projects", newProject, {
    			headers: { 'token': localStorage.getItem('token') }
    		}).then(response => {
    			console.log('status', response.status);

    			if (response.status !== 200) {
    				console.log('something went wrong');
    			} else {
    				console.log(response.data);
    				let addNewProject = response.data;
    				amountOfProjects.update(projects => [...projects, addNewProject]);
    				afterSubmit();
    			}
    		}).catch(err => {
    			console.log(err);
    		});
    	};

    	const afterSubmit = () => {
    		$$invalidate(2, newProject.title = "", newProject);
    		$$invalidate(2, newProject.description = "", newProject);
    		$$invalidate(2, newProject.category = "", newProject);
    		$$invalidate(2, newProject.image_url = "", newProject);
    	};

    	const uploadImage = e => {
    		const image = e.target.files[0];
    		const reader = new FileReader();
    		reader.readAsDataURL(image);
    		let allowedFiles = ["image/png", "image/jpeg", "image/jpg"];

    		if (allowedFiles.includes(image.type)) {
    			reader.onload = e => {
    				$$invalidate(2, newProject.image_url = e.target.result, newProject);
    				$$invalidate(0, validationMessage = "");
    			};
    		} else {
    			$$invalidate(0, validationMessage = "Please upload a valid image file");
    			$$invalidate(1, validationCSS = "error");
    			e.target.value = "";
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$j.warn(`<CreateForm> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		newProject.title = this.value;
    		$$invalidate(2, newProject);
    	}

    	function input1_change_handler() {
    		newProject.image_url = this.value;
    		$$invalidate(2, newProject);
    	}

    	const change_handler = e => uploadImage(e);

    	function input2_input_handler() {
    		newProject.description = this.value;
    		$$invalidate(2, newProject);
    	}

    	function select_change_handler() {
    		newProject.category = select_value(this);
    		$$invalidate(2, newProject);
    	}

    	$$self.$capture_state = () => ({
    		axios,
    		amountOfProjects,
    		categories,
    		validationMessage,
    		validationCSS,
    		newProject,
    		submitProject,
    		afterSubmit,
    		uploadImage,
    		$categories
    	});

    	$$self.$inject_state = $$props => {
    		if ('validationMessage' in $$props) $$invalidate(0, validationMessage = $$props.validationMessage);
    		if ('validationCSS' in $$props) $$invalidate(1, validationCSS = $$props.validationCSS);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		validationMessage,
    		validationCSS,
    		newProject,
    		$categories,
    		submitProject,
    		uploadImage,
    		input0_input_handler,
    		input1_change_handler,
    		change_handler,
    		input2_input_handler,
    		select_change_handler
    	];
    }

    class CreateForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$r, create_fragment$r, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CreateForm",
    			options,
    			id: create_fragment$r.name
    		});
    	}
    }

    /* src\components\admin\OpenFormBtn.svelte generated by Svelte v3.53.1 */
    const file$n = "src\\components\\admin\\OpenFormBtn.svelte";

    // (10:0) <Modal show={$modal}>
    function create_default_slot$8(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text("New Project");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, "New Project");
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "svelte-vsc81v");
    			add_location(button, file$n, 10, 4, 262);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*showModal*/ ctx[2], false, false, false);
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
    		id: create_default_slot$8.name,
    		type: "slot",
    		source: "(10:0) <Modal show={$modal}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$q(ctx) {
    	let modal_1;
    	let current;

    	modal_1 = new Modal({
    			props: {
    				show: /*$modal*/ ctx[0],
    				$$slots: { default: [create_default_slot$8] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(modal_1.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(modal_1.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(modal_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const modal_1_changes = {};
    			if (dirty & /*$modal*/ 1) modal_1_changes.show = /*$modal*/ ctx[0];

    			if (dirty & /*$$scope*/ 8) {
    				modal_1_changes.$$scope = { dirty, ctx };
    			}

    			modal_1.$set(modal_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modal_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modal_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(modal_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$q.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$q($$self, $$props, $$invalidate) {
    	let $modal;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('OpenFormBtn', slots, []);
    	const modal = writable(null);
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, value => $$invalidate(0, $modal = value));
    	const showModal = () => modal.set(CreateForm);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<OpenFormBtn> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		writable,
    		Modal,
    		CreateForm,
    		modal,
    		showModal,
    		$modal
    	});

    	return [$modal, modal, showModal];
    }

    class OpenFormBtn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$q, create_fragment$q, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OpenFormBtn",
    			options,
    			id: create_fragment$q.name
    		});
    	}
    }

    /* src\pages\Dashboard.svelte generated by Svelte v3.53.1 */

    const { console: console_1$i } = globals;

    const file$m = "src\\pages\\Dashboard.svelte";

    // (49:12) <Link to="/login" on:click={handleLogout}>
    function create_default_slot$7(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Logout");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "Logout");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$7.name,
    		type: "slot",
    		source: "(49:12) <Link to=\\\"/login\\\" on:click={handleLogout}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$p(ctx) {
    	let div1;
    	let div0;
    	let button;
    	let link;
    	let t0;
    	let openformbtn;
    	let t1;
    	let main;
    	let projectsad;
    	let current;

    	link = new Link({
    			props: {
    				to: "/login",
    				$$slots: { default: [create_default_slot$7] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	link.$on("click", /*handleLogout*/ ctx[0]);
    	openformbtn = new OpenFormBtn({ $$inline: true });
    	projectsad = new ProjectsAD({ $$inline: true });

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			button = element("button");
    			create_component(link.$$.fragment);
    			t0 = space();
    			create_component(openformbtn.$$.fragment);
    			t1 = space();
    			main = element("main");
    			create_component(projectsad.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			button = claim_element(div0_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			claim_component(link.$$.fragment, button_nodes);
    			button_nodes.forEach(detach_dev);
    			t0 = claim_space(div0_nodes);
    			claim_component(openformbtn.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			main = claim_element(div1_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			claim_component(projectsad.$$.fragment, main_nodes);
    			main_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "svelte-1475co9");
    			add_location(button, file$m, 47, 8, 1384);
    			attr_dev(div0, "class", "svelte-1475co9");
    			add_location(div0, file$m, 46, 4, 1369);
    			attr_dev(main, "class", "svelte-1475co9");
    			add_location(main, file$m, 52, 4, 1523);
    			attr_dev(div1, "class", "dash svelte-1475co9");
    			add_location(div1, file$m, 45, 0, 1345);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, button);
    			mount_component(link, button, null);
    			append_hydration_dev(div0, t0);
    			mount_component(openformbtn, div0, null);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, main);
    			mount_component(projectsad, main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const link_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				link_changes.$$scope = { dirty, ctx };
    			}

    			link.$set(link_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(link.$$.fragment, local);
    			transition_in(openformbtn.$$.fragment, local);
    			transition_in(projectsad.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(link.$$.fragment, local);
    			transition_out(openformbtn.$$.fragment, local);
    			transition_out(projectsad.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(link);
    			destroy_component(openformbtn);
    			destroy_component(projectsad);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$p.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$p($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Dashboard', slots, []);

    	onMount(async () => {
    		await axios.get('http://localhost:4000/api/auth/verify', {
    			headers: { 'token': localStorage.getItem('token') }
    		}).then(response => {
    			if (response.status === 200) {
    				console.log('Token is valid');
    			}
    		}).catch(error => {
    			console.log(error);

    			if (error.response.status === 404) {
    				console.log('Token is invalid');
    				localStorage.removeItem('token');
    				token.set(null);
    				navigate('/login', { replace: true });
    			} else {
    				console.log('unauthorized');
    				localStorage.removeItem('token');
    				token.set(null);
    				navigate('/login', { replace: true });
    			}
    		});
    	});

    	const handleLogout = () => {
    		localStorage.removeItem('token');
    		token.set(localStorage.getItem('token'));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$i.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		ProjectsAD,
    		Link,
    		axios,
    		token,
    		onMount,
    		navigate,
    		OpenFormBtn,
    		handleLogout
    	});

    	return [handleLogout];
    }

    class Dashboard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$p, create_fragment$p, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$p.name
    		});
    	}
    }

    /* src\ProtectedRoute.svelte generated by Svelte v3.53.1 */

    // (14:0) {:else}
    function create_else_block$2(ctx) {
    	let route;
    	let current;

    	route = new Route({
    			props: { path: /*path*/ ctx[0], component: Login },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(route.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(route, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route_changes = {};
    			if (dirty & /*path*/ 1) route_changes.path = /*path*/ ctx[0];
    			route.$set(route_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(14:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (12:0) {#if isAuthenticated}
    function create_if_block$e(ctx) {
    	let route;
    	let current;

    	route = new Route({
    			props: {
    				path: /*path*/ ctx[0],
    				component: /*component*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(route.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(route.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(route, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route_changes = {};
    			if (dirty & /*path*/ 1) route_changes.path = /*path*/ ctx[0];
    			if (dirty & /*component*/ 2) route_changes.component = /*component*/ ctx[1];
    			route.$set(route_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(route, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$e.name,
    		type: "if",
    		source: "(12:0) {#if isAuthenticated}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$o(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$e, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*isAuthenticated*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
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
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$o($$self, $$props, $$invalidate) {
    	let isAuthenticated;
    	let $token;
    	validate_store(token, 'token');
    	component_subscribe($$self, token, $$value => $$invalidate(3, $token = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ProtectedRoute', slots, []);
    	let { path } = $$props;
    	let { component } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (path === undefined && !('path' in $$props || $$self.$$.bound[$$self.$$.props['path']])) {
    			console.warn("<ProtectedRoute> was created without expected prop 'path'");
    		}

    		if (component === undefined && !('component' in $$props || $$self.$$.bound[$$self.$$.props['component']])) {
    			console.warn("<ProtectedRoute> was created without expected prop 'component'");
    		}
    	});

    	const writable_props = ['path', 'component'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ProtectedRoute> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('path' in $$props) $$invalidate(0, path = $$props.path);
    		if ('component' in $$props) $$invalidate(1, component = $$props.component);
    	};

    	$$self.$capture_state = () => ({
    		Route,
    		Link,
    		Login,
    		token,
    		path,
    		component,
    		isAuthenticated,
    		$token
    	});

    	$$self.$inject_state = $$props => {
    		if ('path' in $$props) $$invalidate(0, path = $$props.path);
    		if ('component' in $$props) $$invalidate(1, component = $$props.component);
    		if ('isAuthenticated' in $$props) $$invalidate(2, isAuthenticated = $$props.isAuthenticated);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$token*/ 8) {
    			$$invalidate(2, isAuthenticated = $token);
    		}
    	};

    	return [path, component, isAuthenticated, $token];
    }

    class ProtectedRoute extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$o, create_fragment$o, safe_not_equal, { path: 0, component: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ProtectedRoute",
    			options,
    			id: create_fragment$o.name
    		});
    	}

    	get path() {
    		throw new Error("<ProtectedRoute>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<ProtectedRoute>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<ProtectedRoute>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<ProtectedRoute>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\spriteAnimations\Sven.svelte generated by Svelte v3.53.1 */

    const { console: console_1$h } = globals;

    const file$l = "src\\components\\spriteAnimations\\Sven.svelte";

    function create_fragment$n(ctx) {
    	let canvas;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			canvas = element("canvas");
    			this.h();
    		},
    		l: function claim(nodes) {
    			canvas = claim_element(nodes, "CANVAS", { id: true, class: true });
    			children(canvas).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(canvas, "id", "svenCanvas");
    			attr_dev(canvas, "class", "svelte-10srhhp");
    			add_location(canvas, file$l, 61, 0, 1782);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, canvas, anchor);

    			if (!mounted) {
    				dispose = listen_dev(window, "load", /*svenSpriteAnimation*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(canvas);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$n($$self, $$props, $$invalidate) {
    	let $nextChat;
    	validate_store(nextChat, 'nextChat');
    	component_subscribe($$self, nextChat, $$value => $$invalidate(1, $nextChat = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sven', slots, []);
    	let svenSprite = '../images/sven-sprite-01-01.png';
    	onMount(() => svenSpriteAnimation());

    	const svenSpriteAnimation = () => {
    		const canvas = document.getElementById('svenCanvas');
    		const ctx = canvas.getContext('2d');
    		const cWidth = canvas.width = 1000;
    		const cHeight = canvas.height = 1400;
    		const playerImage = new Image();
    		playerImage.src = svenSprite;
    		const spriteWidth = 992; // sprite sheet width / sprite sheet columns
    		const spriteHeight = 1359; // sprite sheet height (if there were multiple sprites in one sheet this would be devided by the amount of rows)
    		let frameX = 0;
    		let frameY = 0;
    		let gameFrame = 0;
    		let staggerFrames = 0;

    		const animate = () => {
    			ctx.clearRect(0, 0, cWidth, cHeight);
    			ctx.drawImage(playerImage, frameX * spriteWidth, frameY * spriteHeight, spriteWidth, spriteHeight, 0, 0, spriteWidth, spriteHeight);

    			if (gameFrame % staggerFrames == 0) {
    				if (frameX < 3) {
    					frameX++;
    				} else {
    					frameX = 0;
    				}
    			}

    			if ($nextChat === 1) {
    				staggerFrames = 15;
    			} else if ($nextChat === 2) {
    				staggerFrames = 0;
    			} else if ($nextChat === 3) {
    				staggerFrames = 15;
    			} else {
    				staggerFrames = 0;
    			}

    			gameFrame++;
    			requestAnimationFrame(animate);
    		};

    		animate();
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$h.warn(`<Sven> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		svenSprite,
    		nextChat,
    		svenSpriteAnimation,
    		$nextChat
    	});

    	$$self.$inject_state = $$props => {
    		if ('svenSprite' in $$props) svenSprite = $$props.svenSprite;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$nextChat*/ 2) {
    			console.log($nextChat);
    		}
    	};

    	return [svenSpriteAnimation, $nextChat];
    }

    class Sven extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$n, create_fragment$n, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sven",
    			options,
    			id: create_fragment$n.name
    		});
    	}
    }

    /* src\components\spriteAnimations\Smoke.svelte generated by Svelte v3.53.1 */

    const { console: console_1$g } = globals;
    const file$k = "src\\components\\spriteAnimations\\Smoke.svelte";

    function create_fragment$m(ctx) {
    	let div;
    	let canvas;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			canvas = element("canvas");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			canvas = claim_element(div_nodes, "CANVAS", { id: true, class: true });
    			children(canvas).forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(canvas, "id", "smokeCanvas");
    			attr_dev(canvas, "class", "svelte-tlwfii");
    			add_location(canvas, file$k, 74, 4, 2127);
    			attr_dev(div, "class", "canvas-pos svelte-tlwfii");
    			add_location(div, file$k, 73, 0, 2093);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, canvas);

    			if (!mounted) {
    				dispose = listen_dev(window, "load", /*smokeSpriteAnimation*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$m($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Smoke', slots, []);
    	let smokeSprite = '../images/smoke-spritesheet.png';
    	let { transformAvatar } = $$props;
    	onMount(() => smokeSpriteAnimation());

    	const smokeSpriteAnimation = () => {
    		const canvas = document.getElementById('smokeCanvas');
    		const ctx = canvas.getContext('2d');
    		const cWidth = canvas.width = 430;
    		const cHeight = canvas.height = 430;
    		const playerImage = new Image();
    		playerImage.src = smokeSprite;
    		const spriteWidth = 354; // sprite sheet width / sprite sheet columns
    		const spriteHeight = 354; // sprite sheet height (if there were multiple sprites in one sheet this would be devided by the amount of rows)
    		let frameX = 12;
    		let frameY = 0;
    		let gameFrame = 0;
    		let fps = 0;

    		const animate = () => {
    			ctx.clearRect(0, 0, cWidth, cHeight);
    			ctx.drawImage(playerImage, frameX * spriteWidth, frameY * spriteHeight, spriteWidth, spriteHeight, 0, 0, spriteWidth, spriteHeight);

    			if (gameFrame % fps == 0) {
    				if (frameX < 14) {
    					frameX++;
    				} else {
    					frameX = 0;
    				}

    				gameFrame++;
    			}

    			if (transformAvatar) {
    				fps = 1;
    			}

    			if (frameX === 10) {
    				fps = 0;
    				frameX = 12;
    				console.log('frameX is 10', fps, frameX);
    			}

    			// BUG: animation lags af
    			// if( nextChat === 1){
    			//     staggerFrames = 9
    			// } else if( nextChat === 2){
    			//     staggerFrames = 0
    			// } else if ( nextChat === 3){
    			//     staggerFrames = 9
    			// } else{
    			//     staggerFrames = 0
    			// }
    			// gameFrame++
    			requestAnimationFrame(animate);
    		};

    		animate();
    	};

    	$$self.$$.on_mount.push(function () {
    		if (transformAvatar === undefined && !('transformAvatar' in $$props || $$self.$$.bound[$$self.$$.props['transformAvatar']])) {
    			console_1$g.warn("<Smoke> was created without expected prop 'transformAvatar'");
    		}
    	});

    	const writable_props = ['transformAvatar'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$g.warn(`<Smoke> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('transformAvatar' in $$props) $$invalidate(1, transformAvatar = $$props.transformAvatar);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		allKidsBooksRead,
    		smokeSprite,
    		transformAvatar,
    		smokeSpriteAnimation
    	});

    	$$self.$inject_state = $$props => {
    		if ('smokeSprite' in $$props) smokeSprite = $$props.smokeSprite;
    		if ('transformAvatar' in $$props) $$invalidate(1, transformAvatar = $$props.transformAvatar);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [smokeSpriteAnimation, transformAvatar];
    }

    class Smoke extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$m, create_fragment$m, safe_not_equal, { transformAvatar: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Smoke",
    			options,
    			id: create_fragment$m.name
    		});
    	}

    	get transformAvatar() {
    		throw new Error("<Smoke>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transformAvatar(value) {
    		throw new Error("<Smoke>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\spriteAnimations\Girl.svelte generated by Svelte v3.53.1 */

    const { console: console_1$f, window: window_1$1 } = globals;
    const file$j = "src\\components\\spriteAnimations\\Girl.svelte";

    // (260:0) {#if !$informativeBooksRead}
    function create_if_block$d(ctx) {
    	let smoke;
    	let current;

    	smoke = new Smoke({
    			props: {
    				transformAvatar: /*transformAvatar*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(smoke.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(smoke.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(smoke, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const smoke_changes = {};
    			if (dirty & /*transformAvatar*/ 4) smoke_changes.transformAvatar = /*transformAvatar*/ ctx[2];
    			smoke.$set(smoke_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(smoke.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(smoke.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(smoke, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$d.name,
    		type: "if",
    		source: "(260:0) {#if !$informativeBooksRead}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$l(ctx) {
    	let canvas;
    	let t0;
    	let img;
    	let img_src_value;
    	let t1;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = !/*$informativeBooksRead*/ ctx[0] && create_if_block$d(ctx);

    	const block = {
    		c: function create() {
    			canvas = element("canvas");
    			t0 = space();
    			img = element("img");
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			canvas = claim_element(nodes, "CANVAS", { id: true, class: true });
    			children(canvas).forEach(detach_dev);
    			t0 = claim_space(nodes);

    			img = claim_element(nodes, "IMG", {
    				class: true,
    				src: true,
    				alt: true,
    				id: true
    			});

    			t1 = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(canvas, "id", "canvas1");
    			attr_dev(canvas, "class", "svelte-1s484pt");
    			add_location(canvas, file$j, 251, 0, 8587);
    			attr_dev(img, "class", "forward svelte-1s484pt");
    			if (!src_url_equal(img.src, img_src_value = "../images/transformation-spritesheet.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "player");
    			attr_dev(img, "id", "playerImage");
    			add_location(img, file$j, 252, 0, 8612);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, canvas, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, img, anchor);
    			insert_hydration_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1$1, "keydown", /*keydown_handler*/ ctx[10], false, false, false),
    					listen_dev(window_1$1, "load", /*avatarSpriteAnimation*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*$informativeBooksRead*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$informativeBooksRead*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$d(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (detaching) detach_dev(canvas);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(img);
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props, $$invalidate) {
    	let $gotWand;
    	let $informativeBooksRead;
    	let $primaryBooksRead;
    	let $mobilityBooksRead;
    	let $adolescenceBooksRead;
    	let $allKidsBooksRead;
    	validate_store(gotWand, 'gotWand');
    	component_subscribe($$self, gotWand, $$value => $$invalidate(5, $gotWand = $$value));
    	validate_store(informativeBooksRead, 'informativeBooksRead');
    	component_subscribe($$self, informativeBooksRead, $$value => $$invalidate(0, $informativeBooksRead = $$value));
    	validate_store(primaryBooksRead, 'primaryBooksRead');
    	component_subscribe($$self, primaryBooksRead, $$value => $$invalidate(6, $primaryBooksRead = $$value));
    	validate_store(mobilityBooksRead, 'mobilityBooksRead');
    	component_subscribe($$self, mobilityBooksRead, $$value => $$invalidate(7, $mobilityBooksRead = $$value));
    	validate_store(adolescenceBooksRead, 'adolescenceBooksRead');
    	component_subscribe($$self, adolescenceBooksRead, $$value => $$invalidate(8, $adolescenceBooksRead = $$value));
    	validate_store(allKidsBooksRead, 'allKidsBooksRead');
    	component_subscribe($$self, allKidsBooksRead, $$value => $$invalidate(9, $allKidsBooksRead = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Girl', slots, []);
    	let key = "";
    	let girlTransform = 0;

    	//ver2
    	// so it loads the girl the first time you go to library
    	onMount(() => avatarSpriteAnimation());

    	// instead of window.addEventlistener('load' () => {})
    	// the avatarSpriteAnimation function is connected to <svelte:window />
    	const avatarSpriteAnimation = () => {
    		const canvas = document.getElementById("canvas1");

    		// console.log(canvas);
    		const ctx = canvas.getContext("2d");

    		// console.log(ctx);
    		// const CANVAS_WIDTH = ()
    		canvas.width = 1100;

    		// const CANVAS_HEIGHT = ()
    		canvas.height = 1550;

    		class InputHandler {
    			constructor() {
    				this.keys = [];

    				window.addEventListener("keydown", e => {
    					console.log(e.key);

    					if ((e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") && this.keys.indexOf(e.key) === -1) {
    						this.keys.push(e.key);
    					}

    					console.log(e.key, this.keys);
    				});

    				window.addEventListener("keyup", e => {
    					console.log(e.key);

    					if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
    						this.keys.splice(this.keys.indexOf(e.key), 1);
    					}

    					console.log(e.key, this.keys);
    				});

    				// window.addEventListener("wheel", (e) => {
    				//     // console.log(e);
    				//     if (
    				//         e.deltaY === 100 ||
    				//         (e.deltaY === -100 &&
    				//             this.keys.indexOf(e.deltaY) === -1)
    				//     ) {
    				//         this.keys.push(e.deltaY);
    				//     } else {
    				//     }
    				//     console.log(e.deltaY, this.keys);
    				// });
    				const onScrollStop = callback => {
    					let isScrolling;

    					window.addEventListener(
    						"wheel",
    						e => {
    							clearTimeout(isScrolling);

    							isScrolling = setTimeout(
    								() => {
    									callback();
    								},
    								150
    							);

    							if (e.deltaY === 150 || e.deltaY === -150 && this.keys.indexOf(e.deltaY) === -1) {
    								this.keys.push(e.deltaY);
    							}

    							console.log(e.deltaY, this.keys);
    						},
    						false
    					);
    				};

    				onScrollStop(() => {
    					this.keys.splice(0, this.keys.length);
    					console.log(this.keys);
    					console.log("The user has stopped scrolling");
    				});
    			}
    		}

    		class Player {
    			constructor(gameWidth, gameHeight) {
    				this.gameWidth = gameWidth;
    				this.gameHeight = gameHeight;
    				this.width = 1100;
    				this.height = 1550;
    				this.x = 0;
    				this.y = this.gameHeight - this.height;
    				this.image = document.getElementById("playerImage");
    				this.frameX = 0;
    				this.frameY = girlTransform;
    				this.fps = 6;
    				this.frameTimer = 0;

    				// controls the speed of the sprite animation
    				this.frameInterval = 800 / this.fps;

    				this.maxFrame = 4;
    				this.speed = 0;
    				this.vy = 0;
    				this.weight = 1;
    			}

    			draw(context) {
    				// context.fillRect(this.x, this.y, this.width, this.height);
    				context.drawImage(this.image, this.frameX * this.width, this.frameY * this.height, this.width, this.height, this.x, this.y, this.width, this.height);
    			}

    			update(input, deltaTime) {
    				//sprite animation
    				//controls
    				if (input.keys.indexOf("ArrowDown") > -1 || input.keys.indexOf(150) > -1) {
    					this.speed = 8;

    					if (this.frameTimer > this.frameInterval) {
    						if (this.frameX >= this.maxFrame) this.frameX = 0; else this.frameX++;
    						this.frameTimer = 0;
    					} else {
    						this.frameTimer += deltaTime;
    					}
    				} else if (input.keys.indexOf("ArrowUp") > -1 || input.keys.indexOf(-150) > -1) {
    					this.speed = -5;

    					if (this.frameTimer > this.frameInterval) {
    						if (this.frameX >= this.maxFrame) this.frameX = 0; else this.frameX++;
    						this.frameTimer = 0;
    					} else {
    						this.frameTimer += deltaTime;
    					}
    				} else {
    					this.speed = 0;
    					this.frameX = 0;
    				}
    			}
    		}

    		const input = new InputHandler();
    		const player = new Player(canvas.width, canvas.height);
    		let lastTime = 0;

    		// player.draw(ctx);
    		// player.update();
    		// const updateSpriteFrame = () => {
    		//     player.constructor
    		// }
    		function animate(timeStamp) {
    			const deltaTime = timeStamp - lastTime;
    			lastTime = timeStamp;
    			ctx.clearRect(0, 0, canvas.width, canvas.height);
    			player.draw(ctx);
    			player.update(input, deltaTime);
    			requestAnimationFrame(animate);
    		}

    		animate(0);
    	};

    	let transformAvatar = false;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$f.warn(`<Girl> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = e => $$invalidate(1, key = e.key);

    	$$self.$capture_state = () => ({
    		allKidsBooksRead,
    		adolescenceBooksRead,
    		primaryBooksRead,
    		mobilityBooksRead,
    		informativeBooksRead,
    		gotWand,
    		fade,
    		onMount,
    		Smoke,
    		key,
    		girlTransform,
    		avatarSpriteAnimation,
    		transformAvatar,
    		$gotWand,
    		$informativeBooksRead,
    		$primaryBooksRead,
    		$mobilityBooksRead,
    		$adolescenceBooksRead,
    		$allKidsBooksRead
    	});

    	$$self.$inject_state = $$props => {
    		if ('key' in $$props) $$invalidate(1, key = $$props.key);
    		if ('girlTransform' in $$props) $$invalidate(4, girlTransform = $$props.girlTransform);
    		if ('transformAvatar' in $$props) $$invalidate(2, transformAvatar = $$props.transformAvatar);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$allKidsBooksRead*/ 512) {
    			if ($allKidsBooksRead === true) {
    				$$invalidate(2, transformAvatar = true);
    				$$invalidate(4, girlTransform = 2);

    				setTimeout(
    					() => {
    						$$invalidate(2, transformAvatar = false);
    						avatarSpriteAnimation();
    					},
    					1000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$adolescenceBooksRead*/ 256) {
    			if ($adolescenceBooksRead === true) {
    				setTimeout(
    					() => {
    						$$invalidate(4, girlTransform = 1);
    						$$invalidate(2, transformAvatar = true);
    					},
    					3000
    				);

    				setTimeout(
    					() => {
    						$$invalidate(2, transformAvatar = false);
    						avatarSpriteAnimation();
    					},
    					4000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$mobilityBooksRead*/ 128) {
    			if ($mobilityBooksRead === true) {
    				$$invalidate(4, girlTransform = 4);
    				$$invalidate(2, transformAvatar = true);

    				setTimeout(
    					() => {
    						$$invalidate(2, transformAvatar = false);
    						avatarSpriteAnimation();
    					},
    					1000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$primaryBooksRead*/ 64) {
    			if ($primaryBooksRead === true) {
    				$$invalidate(4, girlTransform = 3);
    				$$invalidate(2, transformAvatar = true);

    				// console.log(girlTransform)
    				setTimeout(
    					() => {
    						$$invalidate(2, transformAvatar = false);
    						avatarSpriteAnimation();
    					},
    					1000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$informativeBooksRead, girlTransform*/ 17) {
    			if ($informativeBooksRead === true) {
    				// setTimeout(() => {
    				$$invalidate(4, girlTransform = 5);

    				avatarSpriteAnimation();
    				console.log(girlTransform);
    			} // }, 30000);
    		}

    		if ($$self.$$.dirty & /*$gotWand*/ 32) {
    			if ($gotWand === true) {
    				$$invalidate(4, girlTransform = 5);
    				avatarSpriteAnimation();
    			}
    		}
    	};

    	return [
    		$informativeBooksRead,
    		key,
    		transformAvatar,
    		avatarSpriteAnimation,
    		girlTransform,
    		$gotWand,
    		$primaryBooksRead,
    		$mobilityBooksRead,
    		$adolescenceBooksRead,
    		$allKidsBooksRead,
    		keydown_handler
    	];
    }

    class Girl extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$l, create_fragment$l, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Girl",
    			options,
    			id: create_fragment$l.name
    		});
    	}
    }

    /* src\components\EndingConvo.svelte generated by Svelte v3.53.1 */

    const { console: console_1$e } = globals;

    const file$i = "src\\components\\EndingConvo.svelte";

    // (69:4) {:else}
    function create_else_block_1$1(ctx) {
    	let button;
    	let t_value = /*$_*/ ctx[3]("library.talkToSven") + "";
    	let t;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty('talkWsven ' + (/*next*/ ctx[0] > 1 ? 'stop' : '')) + " svelte-117gwqs"));
    			add_location(button, file$i, 69, 4, 1637);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$_*/ 8 && t_value !== (t_value = /*$_*/ ctx[3]("library.talkToSven") + "")) set_data_dev(t, t_value);

    			if (dirty & /*next*/ 1 && button_class_value !== (button_class_value = "" + (null_to_empty('talkWsven ' + (/*next*/ ctx[0] > 1 ? 'stop' : '')) + " svelte-117gwqs"))) {
    				attr_dev(button, "class", button_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(69:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (54:4) {#if visible}
    function create_if_block$c(ctx) {
    	let article;
    	let p;
    	let strong;
    	let t0;
    	let t1;
    	let t2;
    	let button;
    	let t3;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*next*/ ctx[0] === 0) return create_if_block_1$3;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			article = element("article");
    			p = element("p");
    			strong = element("strong");
    			t0 = text(/*who*/ ctx[2]);
    			t1 = space();
    			if_block.c();
    			t2 = space();
    			button = element("button");
    			t3 = text("next");
    			this.h();
    		},
    		l: function claim(nodes) {
    			article = claim_element(nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			p = claim_element(article_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			strong = claim_element(p_nodes, "STRONG", {});
    			var strong_nodes = children(strong);
    			t0 = claim_text(strong_nodes, /*who*/ ctx[2]);
    			strong_nodes.forEach(detach_dev);
    			p_nodes.forEach(detach_dev);
    			t1 = claim_space(article_nodes);
    			if_block.l(article_nodes);
    			t2 = claim_space(article_nodes);
    			button = claim_element(article_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t3 = claim_text(button_nodes, "next");
    			button_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(strong, file$i, 55, 11, 1313);
    			attr_dev(p, "class", "svelte-117gwqs");
    			add_location(p, file$i, 55, 8, 1310);
    			attr_dev(button, "class", "next svelte-117gwqs");
    			add_location(button, file$i, 65, 8, 1545);
    			attr_dev(article, "class", "svelte-117gwqs");
    			add_location(article, file$i, 54, 4, 1291);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, article, anchor);
    			append_hydration_dev(article, p);
    			append_hydration_dev(p, strong);
    			append_hydration_dev(strong, t0);
    			append_hydration_dev(article, t1);
    			if_block.m(article, null);
    			append_hydration_dev(article, t2);
    			append_hydration_dev(article, button);
    			append_hydration_dev(button, t3);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*nextConvo*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*who*/ 4) set_data_dev(t0, /*who*/ ctx[2]);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(article, t2);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$c.name,
    		type: "if",
    		source: "(54:4) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (61:8) {:else}
    function create_else_block$1(ctx) {
    	let p;
    	let t;
    	let p_intro;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*conversation1*/ ctx[5]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, /*conversation1*/ ctx[5]);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "svelte-117gwqs");
    			add_location(p, file$i, 61, 8, 1460);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (!p_intro) {
    				add_render_callback(() => {
    					p_intro = create_in_transition(p, typewriter$2, {});
    					p_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(61:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (57:8) {#if next === 0}
    function create_if_block_1$3(ctx) {
    	let p;
    	let t;
    	let p_intro;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*conversation*/ ctx[4]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, /*conversation*/ ctx[4]);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "svelte-117gwqs");
    			add_location(p, file$i, 57, 8, 1375);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (!p_intro) {
    				add_render_callback(() => {
    					p_intro = create_in_transition(p, typewriter$2, {});
    					p_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(57:8) {#if next === 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$k(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*visible*/ ctx[1]) return create_if_block$c;
    		return create_else_block_1$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function typewriter$2(node, { speed = 3 }) {
    	const valid = node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE;

    	if (!valid) {
    		throw new Error(`something went wrong`);
    	}

    	const text = node.textContent;
    	const duration = text.length / (speed * 0.01);

    	return {
    		duration,
    		tick: t => {
    			const i = Math.trunc(text.length * t);
    			node.textContent = text.slice(0, i);
    		}
    	};
    }

    function instance$k($$self, $$props, $$invalidate) {
    	let $goHome;
    	let $_;
    	validate_store(goHome, 'goHome');
    	component_subscribe($$self, goHome, $$value => $$invalidate(8, $goHome = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(3, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('EndingConvo', slots, []);
    	let visible = false;
    	let next = 0;
    	let who = 'Sven: ';
    	let conversation = $_("library.dialogSven3");
    	let conversation1 = $_("library.dialogFairy2");

    	// let typewriterTransition = TypeWriter.typewriterComponent()
    	const nextConvo = () => {
    		$$invalidate(0, next++, next);

    		if (next === 1) {
    			$$invalidate(2, who = 'You:');
    		} else if (next > 1) {
    			$$invalidate(1, visible = false);
    			set_store_value(goHome, $goHome = true, $goHome);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$e.warn(`<EndingConvo> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(1, visible = !visible);

    	$$self.$capture_state = () => ({
    		_: Y,
    		goHome,
    		visible,
    		next,
    		who,
    		conversation,
    		conversation1,
    		nextConvo,
    		typewriter: typewriter$2,
    		$goHome,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('visible' in $$props) $$invalidate(1, visible = $$props.visible);
    		if ('next' in $$props) $$invalidate(0, next = $$props.next);
    		if ('who' in $$props) $$invalidate(2, who = $$props.who);
    		if ('conversation' in $$props) $$invalidate(4, conversation = $$props.conversation);
    		if ('conversation1' in $$props) $$invalidate(5, conversation1 = $$props.conversation1);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*next*/ 1) {
    			// TODO
    			// -fix transformation sprite
    			// if time, fix creators page
    			console.log(next);
    		}
    	};

    	return [next, visible, who, $_, conversation, conversation1, nextConvo, click_handler];
    }

    class EndingConvo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$k, create_fragment$k, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EndingConvo",
    			options,
    			id: create_fragment$k.name
    		});
    	}
    }

    /* src\components\Ending.svelte generated by Svelte v3.53.1 */
    const file$h = "src\\components\\Ending.svelte";

    function create_fragment$j(ctx) {
    	let section;
    	let article;
    	let endingconvo;
    	let t0;
    	let div0;
    	let girl;
    	let t1;
    	let div1;
    	let sven;
    	let current;
    	endingconvo = new EndingConvo({ $$inline: true });
    	girl = new Girl({ $$inline: true });
    	sven = new Sven({ $$inline: true });

    	const block = {
    		c: function create() {
    			section = element("section");
    			article = element("article");
    			create_component(endingconvo.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			create_component(girl.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(sven.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { class: true });
    			var section_nodes = children(section);
    			article = claim_element(section_nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			claim_component(endingconvo.$$.fragment, article_nodes);
    			t0 = claim_space(article_nodes);
    			div0 = claim_element(article_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(girl.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(article_nodes);
    			div1 = claim_element(article_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			claim_component(sven.$$.fragment, div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "girl svelte-y20z29");
    			add_location(div0, file$h, 11, 8, 249);
    			attr_dev(div1, "class", "sven svelte-y20z29");
    			add_location(div1, file$h, 14, 8, 315);
    			attr_dev(article, "class", "svelte-y20z29");
    			add_location(article, file$h, 9, 4, 205);
    			attr_dev(section, "class", "svelte-y20z29");
    			add_location(section, file$h, 8, 0, 190);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, article);
    			mount_component(endingconvo, article, null);
    			append_hydration_dev(article, t0);
    			append_hydration_dev(article, div0);
    			mount_component(girl, div0, null);
    			append_hydration_dev(article, t1);
    			append_hydration_dev(article, div1);
    			mount_component(sven, div1, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(endingconvo.$$.fragment, local);
    			transition_in(girl.$$.fragment, local);
    			transition_in(sven.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(endingconvo.$$.fragment, local);
    			transition_out(girl.$$.fragment, local);
    			transition_out(sven.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(endingconvo);
    			destroy_component(girl);
    			destroy_component(sven);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$j($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Ending', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Ending> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Sven, Girl, EndingConvo });
    	return [];
    }

    class Ending extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Ending",
    			options,
    			id: create_fragment$j.name
    		});
    	}
    }

    /* node_modules\svelte-intersection-observer\src\IntersectionObserver.svelte generated by Svelte v3.53.1 */

    const get_default_slot_changes = dirty => ({
    	intersecting: dirty & /*intersecting*/ 1,
    	entry: dirty & /*entry*/ 2,
    	observer: dirty & /*observer*/ 4
    });

    const get_default_slot_context = ctx => ({
    	intersecting: /*intersecting*/ ctx[0],
    	entry: /*entry*/ ctx[1],
    	observer: /*observer*/ ctx[2]
    });

    function create_fragment$i(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, intersecting, entry, observer*/ 263)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IntersectionObserver', slots, ['default']);
    	let { element = null } = $$props;
    	let { once = false } = $$props;
    	let { intersecting = false } = $$props;
    	let { root = null } = $$props;
    	let { rootMargin = "0px" } = $$props;
    	let { threshold = 0 } = $$props;
    	let { entry = null } = $$props;
    	let { observer = null } = $$props;
    	const dispatch = createEventDispatcher();
    	let prevRootMargin = null;
    	let prevElement = null;

    	const initialize = () => {
    		$$invalidate(2, observer = new IntersectionObserver(entries => {
    				entries.forEach(_entry => {
    					$$invalidate(1, entry = _entry);
    					$$invalidate(0, intersecting = _entry.isIntersecting);
    				});
    			},
    		{ root, rootMargin, threshold }));
    	};

    	onMount(() => {
    		initialize();

    		return () => {
    			if (observer) {
    				observer.disconnect();
    				$$invalidate(2, observer = null);
    			}
    		};
    	});

    	afterUpdate(async () => {
    		if (entry !== null) {
    			dispatch("observe", entry);

    			if (entry.isIntersecting) {
    				dispatch("intersect", entry);
    				if (once) observer.unobserve(element);
    			}
    		}

    		await tick();

    		if (element !== null && element !== prevElement) {
    			observer.observe(element);
    			if (prevElement !== null) observer.unobserve(prevElement);
    			prevElement = element;
    		}

    		if (prevRootMargin && rootMargin !== prevRootMargin) {
    			observer.disconnect();
    			prevElement = null;
    			initialize();
    		}

    		prevRootMargin = rootMargin;
    	});

    	const writable_props = [
    		'element',
    		'once',
    		'intersecting',
    		'root',
    		'rootMargin',
    		'threshold',
    		'entry',
    		'observer'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<IntersectionObserver> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('element' in $$props) $$invalidate(3, element = $$props.element);
    		if ('once' in $$props) $$invalidate(4, once = $$props.once);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('root' in $$props) $$invalidate(5, root = $$props.root);
    		if ('rootMargin' in $$props) $$invalidate(6, rootMargin = $$props.rootMargin);
    		if ('threshold' in $$props) $$invalidate(7, threshold = $$props.threshold);
    		if ('entry' in $$props) $$invalidate(1, entry = $$props.entry);
    		if ('observer' in $$props) $$invalidate(2, observer = $$props.observer);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		element,
    		once,
    		intersecting,
    		root,
    		rootMargin,
    		threshold,
    		entry,
    		observer,
    		tick,
    		createEventDispatcher,
    		afterUpdate,
    		onMount,
    		dispatch,
    		prevRootMargin,
    		prevElement,
    		initialize
    	});

    	$$self.$inject_state = $$props => {
    		if ('element' in $$props) $$invalidate(3, element = $$props.element);
    		if ('once' in $$props) $$invalidate(4, once = $$props.once);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('root' in $$props) $$invalidate(5, root = $$props.root);
    		if ('rootMargin' in $$props) $$invalidate(6, rootMargin = $$props.rootMargin);
    		if ('threshold' in $$props) $$invalidate(7, threshold = $$props.threshold);
    		if ('entry' in $$props) $$invalidate(1, entry = $$props.entry);
    		if ('observer' in $$props) $$invalidate(2, observer = $$props.observer);
    		if ('prevRootMargin' in $$props) prevRootMargin = $$props.prevRootMargin;
    		if ('prevElement' in $$props) prevElement = $$props.prevElement;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		intersecting,
    		entry,
    		observer,
    		element,
    		once,
    		root,
    		rootMargin,
    		threshold,
    		$$scope,
    		slots
    	];
    }

    class IntersectionObserver_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$i, create_fragment$i, safe_not_equal, {
    			element: 3,
    			once: 4,
    			intersecting: 0,
    			root: 5,
    			rootMargin: 6,
    			threshold: 7,
    			entry: 1,
    			observer: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IntersectionObserver_1",
    			options,
    			id: create_fragment$i.name
    		});
    	}

    	get element() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set element(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get once() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set once(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get intersecting() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set intersecting(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get root() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set root(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rootMargin() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rootMargin(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get threshold() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set threshold(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get entry() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set entry(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get observer() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set observer(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var IntersectionObserver$1 = IntersectionObserver_1;

    /* src\components\StartingConvo.svelte generated by Svelte v3.53.1 */

    const { console: console_1$d } = globals;
    const file$g = "src\\components\\StartingConvo.svelte";

    // (92:4) {:else}
    function create_else_block_1(ctx) {
    	let button;
    	let t_value = /*$_*/ ctx[2]("library.talkToSven") + "";
    	let t;
    	let button_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t = claim_text(button_nodes, t_value);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty("talk-to-sven " + (/*$hasTalkedToSven*/ ctx[7] >= 1 ? 'stopAnimation' : '')) + " svelte-1kycky2"));
    			add_location(button, file$g, 92, 4, 2345);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*talk*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$_*/ 4 && t_value !== (t_value = /*$_*/ ctx[2]("library.talkToSven") + "")) set_data_dev(t, t_value);

    			if (dirty & /*$hasTalkedToSven*/ 128 && button_class_value !== (button_class_value = "" + (null_to_empty("talk-to-sven " + (/*$hasTalkedToSven*/ ctx[7] >= 1 ? 'stopAnimation' : '')) + " svelte-1kycky2"))) {
    				attr_dev(button, "class", button_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(92:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (82:4) {#if talkToSven}
    function create_if_block$b(ctx) {
    	let article;
    	let p;
    	let strong;
    	let t0;
    	let t1;
    	let t2;
    	let button;
    	let t3;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*$nextChat*/ ctx[1] === 2) return create_if_block_1$2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			article = element("article");
    			p = element("p");
    			strong = element("strong");
    			t0 = text(/*who*/ ctx[3]);
    			t1 = space();
    			if_block.c();
    			t2 = space();
    			button = element("button");
    			t3 = text(/*btnText*/ ctx[6]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			article = claim_element(nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			p = claim_element(article_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			strong = claim_element(p_nodes, "STRONG", {});
    			var strong_nodes = children(strong);
    			t0 = claim_text(strong_nodes, /*who*/ ctx[3]);
    			strong_nodes.forEach(detach_dev);
    			p_nodes.forEach(detach_dev);
    			t1 = claim_space(article_nodes);
    			if_block.l(article_nodes);
    			t2 = claim_space(article_nodes);
    			button = claim_element(article_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t3 = claim_text(button_nodes, /*btnText*/ ctx[6]);
    			button_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(strong, file$g, 83, 11, 1990);
    			attr_dev(p, "class", "svelte-1kycky2");
    			add_location(p, file$g, 83, 8, 1987);
    			attr_dev(button, "class", "next svelte-1kycky2");
    			add_location(button, file$g, 89, 8, 2249);
    			attr_dev(article, "class", "svelte-1kycky2");
    			add_location(article, file$g, 82, 4, 1968);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, article, anchor);
    			append_hydration_dev(article, p);
    			append_hydration_dev(p, strong);
    			append_hydration_dev(strong, t0);
    			append_hydration_dev(article, t1);
    			if_block.m(article, null);
    			append_hydration_dev(article, t2);
    			append_hydration_dev(article, button);
    			append_hydration_dev(button, t3);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handleNext*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*who*/ 8) set_data_dev(t0, /*who*/ ctx[3]);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(article, t2);
    				}
    			}

    			if (dirty & /*btnText*/ 64) set_data_dev(t3, /*btnText*/ ctx[6]);
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$b.name,
    		type: "if",
    		source: "(82:4) {#if talkToSven}",
    		ctx
    	});

    	return block;
    }

    // (87:8) {:else}
    function create_else_block(ctx) {
    	let p;
    	let t;
    	let p_class_value;
    	let p_intro;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*svenChat*/ ctx[4]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, /*svenChat*/ ctx[4]);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", p_class_value = "" + (null_to_empty("sven-chat " + (/*$nextChat*/ ctx[1] === 3 ? 'last-chat' : '')) + " svelte-1kycky2"));
    			add_location(p, file$g, 87, 8, 2133);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*svenChat*/ 16) set_data_dev(t, /*svenChat*/ ctx[4]);

    			if (dirty & /*$nextChat*/ 2 && p_class_value !== (p_class_value = "" + (null_to_empty("sven-chat " + (/*$nextChat*/ ctx[1] === 3 ? 'last-chat' : '')) + " svelte-1kycky2"))) {
    				attr_dev(p, "class", p_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (!p_intro) {
    				add_render_callback(() => {
    					p_intro = create_in_transition(p, typewriter$1, {});
    					p_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(87:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (85:8) {#if $nextChat === 2}
    function create_if_block_1$2(ctx) {
    	let p;
    	let t;
    	let p_intro;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*girlChat*/ ctx[5]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, /*girlChat*/ ctx[5]);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "girl-chat svelte-1kycky2");
    			add_location(p, file$g, 85, 8, 2057);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*girlChat*/ 32) set_data_dev(t, /*girlChat*/ ctx[5]);
    		},
    		i: function intro(local) {
    			if (!p_intro) {
    				add_render_callback(() => {
    					p_intro = create_in_transition(p, typewriter$1, {});
    					p_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(85:8) {#if $nextChat === 2}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$h(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*talkToSven*/ ctx[0]) return create_if_block$b;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function typewriter$1(node, { speed = 3 }) {
    	const valid = node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE;

    	if (!valid) {
    		throw new Error(`something went wrong`);
    	}

    	const text = node.textContent;
    	const duration = text.length / (speed * 0.01);

    	return {
    		duration,
    		tick: t => {
    			const i = Math.trunc(text.length * t);
    			node.textContent = text.slice(0, i);
    		}
    	};
    }

    function instance$h($$self, $$props, $$invalidate) {
    	let $nextChat;
    	let $_;
    	let $hasTalkedToSven;
    	validate_store(nextChat, 'nextChat');
    	component_subscribe($$self, nextChat, $$value => $$invalidate(1, $nextChat = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(2, $_ = $$value));
    	validate_store(hasTalkedToSven, 'hasTalkedToSven');
    	component_subscribe($$self, hasTalkedToSven, $$value => $$invalidate(7, $hasTalkedToSven = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('StartingConvo', slots, []);
    	let who = 'Sven: ';
    	let svenChat = '';
    	let girlChat = '';
    	let talkToSven = false;
    	let btnText = '';

    	onMount(() => {
    		const svenStorage = localStorage.getItem('sven');

    		if (svenStorage !== null) {
    			try {
    				set_store_value(hasTalkedToSven, $hasTalkedToSven = svenStorage, $hasTalkedToSven);
    				console.log($hasTalkedToSven);
    			} catch {
    				console.log('error');
    			}
    		}
    	}); // console.log(svenStorage)

    	const talk = () => {
    		$$invalidate(0, talkToSven = !talkToSven);

    		if (talkToSven) {
    			set_store_value(hasTalkedToSven, $hasTalkedToSven += 1, $hasTalkedToSven);
    			localStorage.setItem('sven', $hasTalkedToSven);
    		}
    	};

    	const handleNext = () => {
    		set_store_value(nextChat, $nextChat += 1, $nextChat);
    		console.log($nextChat);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$d.warn(`<StartingConvo> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		hasTalkedToSven,
    		nextChat,
    		who,
    		svenChat,
    		girlChat,
    		talkToSven,
    		btnText,
    		typewriter: typewriter$1,
    		talk,
    		handleNext,
    		$nextChat,
    		$_,
    		$hasTalkedToSven
    	});

    	$$self.$inject_state = $$props => {
    		if ('who' in $$props) $$invalidate(3, who = $$props.who);
    		if ('svenChat' in $$props) $$invalidate(4, svenChat = $$props.svenChat);
    		if ('girlChat' in $$props) $$invalidate(5, girlChat = $$props.girlChat);
    		if ('talkToSven' in $$props) $$invalidate(0, talkToSven = $$props.talkToSven);
    		if ('btnText' in $$props) $$invalidate(6, btnText = $$props.btnText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$nextChat*/ 2) {
    			if ($nextChat > 3) {
    				$$invalidate(0, talkToSven = false);
    				set_store_value(nextChat, $nextChat = 0, $nextChat);
    			}
    		}

    		if ($$self.$$.dirty & /*talkToSven, $_*/ 5) {
    			if (talkToSven) {
    				set_store_value(nextChat, $nextChat = 1, $nextChat);
    				$$invalidate(4, svenChat = $_("library.dialogSven1"));
    				$$invalidate(6, btnText = $_("library.btnText1"));
    			}
    		}

    		if ($$self.$$.dirty & /*$nextChat, $_*/ 6) {
    			if ($nextChat === 2) {
    				$$invalidate(5, girlChat = $_("library.dialogGirl1"));
    				$$invalidate(3, who = 'Girl:');
    			} else if ($nextChat === 3) {
    				$$invalidate(3, who = 'Sven:');
    				$$invalidate(4, svenChat = $_("library.dialogSven2"));
    				$$invalidate(6, btnText = $_("library.btnText2"));
    			}
    		}
    	};

    	return [
    		talkToSven,
    		$nextChat,
    		$_,
    		who,
    		svenChat,
    		girlChat,
    		btnText,
    		$hasTalkedToSven,
    		talk,
    		handleNext
    	];
    }

    class StartingConvo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StartingConvo",
    			options,
    			id: create_fragment$h.name
    		});
    	}
    }

    /* src\components\MeetSven.svelte generated by Svelte v3.53.1 */

    const { console: console_1$c } = globals;
    const file$f = "src\\components\\MeetSven.svelte";

    // (16:0) <InterSectionObserver {element} bind:intersecting>
    function create_default_slot$6(ctx) {
    	let section;
    	let startingconvo;
    	let t;
    	let div1;
    	let div0;
    	let sven;
    	let section_class_value;
    	let current;
    	startingconvo = new StartingConvo({ $$inline: true });
    	sven = new Sven({ $$inline: true });

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(startingconvo.$$.fragment);
    			t = space();
    			div1 = element("div");
    			div0 = element("div");
    			create_component(sven.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section_nodes = children(section);
    			claim_component(startingconvo.$$.fragment, section_nodes);
    			t = claim_space(section_nodes);
    			div1 = claim_element(section_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(sven.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "box svelte-f4vj5c");
    			add_location(div0, file$f, 19, 4, 616);
    			attr_dev(div1, "class", "welcome svelte-f4vj5c");
    			add_location(div1, file$f, 18, 4, 588);
    			attr_dev(section, "id", "lobby");

    			attr_dev(section, "class", section_class_value = "" + (null_to_empty(/*$bookId*/ ctx[2] === /*$projectId*/ ctx[3]
    			? "overlay"
    			: "") + " svelte-f4vj5c"));

    			add_location(section, file$f, 16, 0, 491);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			mount_component(startingconvo, section, null);
    			append_hydration_dev(section, t);
    			append_hydration_dev(section, div1);
    			append_hydration_dev(div1, div0);
    			mount_component(sven, div0, null);
    			/*div0_binding*/ ctx[4](div0);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*$bookId, $projectId*/ 12 && section_class_value !== (section_class_value = "" + (null_to_empty(/*$bookId*/ ctx[2] === /*$projectId*/ ctx[3]
    			? "overlay"
    			: "") + " svelte-f4vj5c"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(startingconvo.$$.fragment, local);
    			transition_in(sven.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(startingconvo.$$.fragment, local);
    			transition_out(sven.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(startingconvo);
    			destroy_component(sven);
    			/*div0_binding*/ ctx[4](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$6.name,
    		type: "slot",
    		source: "(16:0) <InterSectionObserver {element} bind:intersecting>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$g(ctx) {
    	let intersectionobserver;
    	let updating_intersecting;
    	let current;

    	function intersectionobserver_intersecting_binding(value) {
    		/*intersectionobserver_intersecting_binding*/ ctx[5](value);
    	}

    	let intersectionobserver_props = {
    		element: /*element*/ ctx[1],
    		$$slots: { default: [create_default_slot$6] },
    		$$scope: { ctx }
    	};

    	if (/*intersecting*/ ctx[0] !== void 0) {
    		intersectionobserver_props.intersecting = /*intersecting*/ ctx[0];
    	}

    	intersectionobserver = new IntersectionObserver$1({
    			props: intersectionobserver_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind$2(intersectionobserver, 'intersecting', intersectionobserver_intersecting_binding));

    	const block = {
    		c: function create() {
    			create_component(intersectionobserver.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(intersectionobserver.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(intersectionobserver, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const intersectionobserver_changes = {};
    			if (dirty & /*element*/ 2) intersectionobserver_changes.element = /*element*/ ctx[1];

    			if (dirty & /*$$scope, $bookId, $projectId, element*/ 142) {
    				intersectionobserver_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_intersecting && dirty & /*intersecting*/ 1) {
    				updating_intersecting = true;
    				intersectionobserver_changes.intersecting = /*intersecting*/ ctx[0];
    				add_flush_callback(() => updating_intersecting = false);
    			}

    			intersectionobserver.$set(intersectionobserver_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(intersectionobserver.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(intersectionobserver.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(intersectionobserver, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let $checkPoint;
    	let $bookId;
    	let $projectId;
    	validate_store(checkPoint, 'checkPoint');
    	component_subscribe($$self, checkPoint, $$value => $$invalidate(6, $checkPoint = $$value));
    	validate_store(bookId, 'bookId');
    	component_subscribe($$self, bookId, $$value => $$invalidate(2, $bookId = $$value));
    	validate_store(projectId, 'projectId');
    	component_subscribe($$self, projectId, $$value => $$invalidate(3, $projectId = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MeetSven', slots, []);
    	let element;
    	let intersecting;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$c.warn(`<MeetSven> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(1, element);
    		});
    	}

    	function intersectionobserver_intersecting_binding(value) {
    		intersecting = value;
    		$$invalidate(0, intersecting);
    	}

    	$$self.$capture_state = () => ({
    		Sven,
    		InterSectionObserver: IntersectionObserver$1,
    		checkPoint,
    		bookId,
    		projectId,
    		StartingConvo,
    		element,
    		intersecting,
    		$checkPoint,
    		$bookId,
    		$projectId
    	});

    	$$self.$inject_state = $$props => {
    		if ('element' in $$props) $$invalidate(1, element = $$props.element);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*intersecting*/ 1) {
    			console.log('checkpoint', intersecting
    			? set_store_value(checkPoint, $checkPoint = set_store_value(checkPoint, $checkPoint = 0, $checkPoint), $checkPoint)
    			: '');
    		}
    	};

    	return [
    		intersecting,
    		element,
    		$bookId,
    		$projectId,
    		div0_binding,
    		intersectionobserver_intersecting_binding
    	];
    }

    class MeetSven extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MeetSven",
    			options,
    			id: create_fragment$g.name
    		});
    	}
    }

    /* src\components\Update.svelte generated by Svelte v3.53.1 */

    function create_fragment$f(ctx) {
    	const block = {
    		c: noop,
    		l: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let $amountOfProjects;
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(1, $amountOfProjects = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Update', slots, []);

    	const updateBook = updated => {
    		const array = [...$amountOfProjects];

    		// console.log(array)
    		let hasUpdated = array.map(p => p.id === updated.id ? updated : p);

    		if (hasUpdated) {
    			set_store_value(amountOfProjects, $amountOfProjects = hasUpdated, $amountOfProjects);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Update> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		amountOfProjects,
    		updateBook,
    		$amountOfProjects
    	});

    	return [updateBook];
    }

    class Update extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, { updateBook: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Update",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get updateBook() {
    		return this.$$.ctx[0];
    	}

    	set updateBook(value) {
    		throw new Error("<Update>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\categories\BarnOchUnga.svelte generated by Svelte v3.53.1 */

    const { console: console_1$b } = globals;
    const file$e = "src\\components\\categories\\BarnOchUnga.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[28] = list[i];
    	child_ctx[30] = i;
    	return child_ctx;
    }

    // (110:2) {#if project.category === "Barn och Unga"}
    function create_if_block$a(ctx) {
    	let div14;
    	let button;
    	let t0_value = /*$_*/ ctx[9]("closeTheBook") + "";
    	let t0;
    	let button_class_value;
    	let t1;
    	let div13;
    	let div1;
    	let div0;
    	let div0_class_value;
    	let t2;
    	let div2;
    	let h3;
    	let t3_value = /*project*/ ctx[28].title + "";
    	let t3;
    	let div2_class_value;
    	let t4;
    	let div3;
    	let div3_class_value;
    	let t5;
    	let div4;
    	let div4_class_value;
    	let t6;
    	let div5;
    	let div5_class_value;
    	let t7;
    	let div6;
    	let div6_class_value;
    	let t8;
    	let div7;
    	let div7_class_value;
    	let t9;
    	let div8;
    	let div8_class_value;
    	let t10;
    	let div9;
    	let div9_class_value;
    	let t11;
    	let div10;
    	let h2;
    	let t12_value = /*project*/ ctx[28].title + "";
    	let t12;
    	let t13;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t14;
    	let p0;
    	let t15_value = /*project*/ ctx[28].category + "";
    	let t15;
    	let div10_class_value;
    	let t16;
    	let div11;
    	let p1;
    	let t17_value = /*project*/ ctx[28].description + "";
    	let t17;
    	let div11_class_value;
    	let t18;
    	let div12;
    	let div12_class_value;
    	let div13_class_value;
    	let div13_key_value;
    	let t19;
    	let div14_class_value;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[16](/*i*/ ctx[30]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[17](/*i*/ ctx[30]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[18](/*i*/ ctx[30]);
    	}

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[19](/*project*/ ctx[28]);
    	}

    	function keyup_handler() {
    		return /*keyup_handler*/ ctx[20](/*i*/ ctx[30]);
    	}

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			div13 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			h3 = element("h3");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			t5 = space();
    			div4 = element("div");
    			t6 = space();
    			div5 = element("div");
    			t7 = space();
    			div6 = element("div");
    			t8 = space();
    			div7 = element("div");
    			t9 = space();
    			div8 = element("div");
    			t10 = space();
    			div9 = element("div");
    			t11 = space();
    			div10 = element("div");
    			h2 = element("h2");
    			t12 = text(t12_value);
    			t13 = space();
    			img = element("img");
    			t14 = space();
    			p0 = element("p");
    			t15 = text(t15_value);
    			t16 = space();
    			div11 = element("div");
    			p1 = element("p");
    			t17 = text(t17_value);
    			t18 = space();
    			div12 = element("div");
    			t19 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			button = claim_element(div14_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t0 = claim_text(button_nodes, t0_value);
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(div14_nodes);
    			div13 = claim_element(div14_nodes, "DIV", { tabindex: true, class: true, key: true });
    			var div13_nodes = children(div13);
    			div1 = claim_element(div13_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div13_nodes);
    			div2 = claim_element(div13_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			h3 = claim_element(div2_nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t3 = claim_text(h3_nodes, t3_value);
    			h3_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t4 = claim_space(div13_nodes);
    			div3 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div3).forEach(detach_dev);
    			t5 = claim_space(div13_nodes);
    			div4 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div4).forEach(detach_dev);
    			t6 = claim_space(div13_nodes);
    			div5 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div5).forEach(detach_dev);
    			t7 = claim_space(div13_nodes);
    			div6 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div6).forEach(detach_dev);
    			t8 = claim_space(div13_nodes);
    			div7 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div7).forEach(detach_dev);
    			t9 = claim_space(div13_nodes);
    			div8 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div8).forEach(detach_dev);
    			t10 = claim_space(div13_nodes);
    			div9 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div9).forEach(detach_dev);
    			t11 = claim_space(div13_nodes);
    			div10 = claim_element(div13_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h2 = claim_element(div10_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t12 = claim_text(h2_nodes, t12_value);
    			h2_nodes.forEach(detach_dev);
    			t13 = claim_space(div10_nodes);

    			img = claim_element(div10_nodes, "IMG", {
    				src: true,
    				alt: true,
    				name: true,
    				class: true
    			});

    			t14 = claim_space(div10_nodes);
    			p0 = claim_element(div10_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t15 = claim_text(p0_nodes, t15_value);
    			p0_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			t16 = claim_space(div13_nodes);
    			div11 = claim_element(div13_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			p1 = claim_element(div11_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t17 = claim_text(p1_nodes, t17_value);
    			p1_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t18 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div12).forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			t19 = claim_space(div14_nodes);
    			div14_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-1n8gdjp"));

    			add_location(button, file$e, 111, 5, 3225);

    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-1n8gdjp"));

    			add_location(div0, file$e, 122, 5, 3646);
    			attr_dev(div1, "class", "spine1 svelte-1n8gdjp");
    			add_location(div1, file$e, 121, 4, 3619);
    			attr_dev(h3, "class", "cover-title svelte-1n8gdjp");
    			add_location(h3, file$e, 125, 5, 3855);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div2, file$e, 124, 4, 3743);

    			attr_dev(div3, "class", div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div3, file$e, 129, 4, 3932);

    			attr_dev(div4, "class", div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div4, file$e, 131, 4, 4028);

    			attr_dev(div5, "class", div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div5, file$e, 132, 4, 4116);

    			attr_dev(div6, "class", div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div6, file$e, 133, 4, 4204);

    			attr_dev(div7, "class", div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div7, file$e, 134, 4, 4292);

    			attr_dev(div8, "class", div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div8, file$e, 135, 4, 4380);

    			attr_dev(div9, "class", div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div9, file$e, 136, 4, 4468);
    			attr_dev(h2, "class", "title svelte-1n8gdjp");
    			add_location(h2, file$e, 139, 5, 4673);
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[28].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[28].title);
    			attr_dev(img, "name", "picture");
    			attr_dev(img, "class", "picture svelte-1n8gdjp");
    			add_location(img, file$e, 140, 5, 4718);
    			attr_dev(p0, "class", "category svelte-1n8gdjp");
    			add_location(p0, file$e, 147, 5, 4844);

    			attr_dev(div10, "class", div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div10, file$e, 138, 4, 4562);
    			attr_dev(p1, "class", "description svelte-1n8gdjp");
    			add_location(p1, file$e, 150, 6, 5023);

    			attr_dev(div11, "class", div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div11, file$e, 149, 5, 4905);

    			attr_dev(div12, "class", div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"));

    			add_location(div12, file$e, 152, 4, 5090);
    			attr_dev(div13, "tabindex", "0");

    			attr_dev(div13, "class", div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-1n8gdjp"));

    			attr_dev(div13, "key", div13_key_value = /*project*/ ctx[28].id);
    			add_location(div13, file$e, 114, 4, 3386);
    			attr_dev(div14, "class", div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-1n8gdjp"));
    			add_location(div14, file$e, 110, 2, 3152);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, button);
    			append_hydration_dev(button, t0);
    			append_hydration_dev(div14, t1);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div13, t2);
    			append_hydration_dev(div13, div2);
    			append_hydration_dev(div2, h3);
    			append_hydration_dev(h3, t3);
    			append_hydration_dev(div13, t4);
    			append_hydration_dev(div13, div3);
    			append_hydration_dev(div13, t5);
    			append_hydration_dev(div13, div4);
    			append_hydration_dev(div13, t6);
    			append_hydration_dev(div13, div5);
    			append_hydration_dev(div13, t7);
    			append_hydration_dev(div13, div6);
    			append_hydration_dev(div13, t8);
    			append_hydration_dev(div13, div7);
    			append_hydration_dev(div13, t9);
    			append_hydration_dev(div13, div8);
    			append_hydration_dev(div13, t10);
    			append_hydration_dev(div13, div9);
    			append_hydration_dev(div13, t11);
    			append_hydration_dev(div13, div10);
    			append_hydration_dev(div10, h2);
    			append_hydration_dev(h2, t12);
    			append_hydration_dev(div10, t13);
    			append_hydration_dev(div10, img);
    			append_hydration_dev(div10, t14);
    			append_hydration_dev(div10, p0);
    			append_hydration_dev(p0, t15);
    			append_hydration_dev(div13, t16);
    			append_hydration_dev(div13, div11);
    			append_hydration_dev(div11, p1);
    			append_hydration_dev(p1, t17);
    			append_hydration_dev(div13, t18);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div14, t19);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[15], false, false, false),
    					listen_dev(div2, "click", click_handler_1, false, false, false),
    					listen_dev(div10, "click", click_handler_2, false, false, false),
    					listen_dev(div11, "click", click_handler_3, false, false, false),
    					listen_dev(div13, "click", click_handler_4, false, false, false),
    					listen_dev(div13, "keyup", prevent_default(keyup_handler), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*$_*/ 512 && t0_value !== (t0_value = /*$_*/ ctx[9]("closeTheBook") + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && button_class_value !== (button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-1n8gdjp"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div0_class_value !== (div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-1n8gdjp"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t3_value !== (t3_value = /*project*/ ctx[28].title + "")) set_data_dev(t3, t3_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div2_class_value !== (div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div3_class_value !== (div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div4_class_value !== (div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div4, "class", div4_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div5_class_value !== (div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div5, "class", div5_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div6_class_value !== (div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div6, "class", div6_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div7_class_value !== (div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div7, "class", div7_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div8_class_value !== (div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div8, "class", div8_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div9_class_value !== (div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div9, "class", div9_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t12_value !== (t12_value = /*project*/ ctx[28].title + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*$amountOfProjects*/ 64 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[28].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && img_alt_value !== (img_alt_value = /*project*/ ctx[28].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t15_value !== (t15_value = /*project*/ ctx[28].category + "")) set_data_dev(t15, t15_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div10_class_value !== (div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div10, "class", div10_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t17_value !== (t17_value = /*project*/ ctx[28].description + "")) set_data_dev(t17, t17_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div11_class_value !== (div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div11, "class", div11_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div12_class_value !== (div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1n8gdjp"))) {
    				attr_dev(div12, "class", div12_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 80 && div13_class_value !== (div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-1n8gdjp"))) {
    				attr_dev(div13, "class", div13_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && div13_key_value !== (div13_key_value = /*project*/ ctx[28].id)) {
    				attr_dev(div13, "key", div13_key_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 80 && div14_class_value !== (div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-1n8gdjp"))) {
    				attr_dev(div14, "class", div14_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(110:2) {#if project.category === \\\"Barn och Unga\\\"}",
    		ctx
    	});

    	return block;
    }

    // (109:2) {#each $amountOfProjects as project, i (project.id)}
    function create_each_block$5(key_2, ctx) {
    	let first;
    	let if_block_anchor;
    	let if_block = /*project*/ ctx[28].category === "Barn och Unga" && create_if_block$a(ctx);

    	const block = {
    		key: key_2,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			first = empty();
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*project*/ ctx[28].category === "Barn och Unga") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$a(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(109:2) {#each $amountOfProjects as project, i (project.id)}",
    		ctx
    	});

    	return block;
    }

    // (105:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>
    function create_default_slot$5(ctx) {
    	let section;
    	let article;
    	let main;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let main_class_value;
    	let section_class_value;
    	let each_value = /*$amountOfProjects*/ ctx[6];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*project*/ ctx[28].id;
    	validate_each_keys(ctx, each_value, get_each_context$5, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$5(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$5(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			article = element("article");
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section_nodes = children(section);
    			article = claim_element(section_nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			main = claim_element(article_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(main_nodes);
    			}

    			main_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(main, "class", main_class_value = "" + (null_to_empty(/*$hasTalkedToSven*/ ctx[8] >= 1 ? 'visible' : '') + " svelte-1n8gdjp"));
    			add_location(main, file$e, 107, 2, 2993);
    			attr_dev(article, "class", "svelte-1n8gdjp");
    			add_location(article, file$e, 106, 1, 2959);
    			attr_dev(section, "id", "first-category");

    			attr_dev(section, "class", section_class_value = "" + (null_to_empty("first-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[5]
    			? "overlay"
    			: "")) + " svelte-1n8gdjp"));

    			add_location(section, file$e, 105, 0, 2857);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, article);
    			append_hydration_dev(article, main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			/*article_binding*/ ctx[21](article);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$amountOfProjects, wasClicked, clickBookSpine, handleKeyDown, $bookId, openBook, $_*/ 7888) {
    				each_value = /*$amountOfProjects*/ ctx[6];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$5, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, main, destroy_block, create_each_block$5, null, get_each_context$5);
    			}

    			if (dirty[0] & /*$hasTalkedToSven*/ 256 && main_class_value !== (main_class_value = "" + (null_to_empty(/*$hasTalkedToSven*/ ctx[8] >= 1 ? 'visible' : '') + " svelte-1n8gdjp"))) {
    				attr_dev(main, "class", main_class_value);
    			}

    			if (dirty[0] & /*$bookId, $projectId*/ 160 && section_class_value !== (section_class_value = "" + (null_to_empty("first-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[5]
    			? "overlay"
    			: "")) + " svelte-1n8gdjp"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			/*article_binding*/ ctx[21](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(105:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let update;
    	let t;
    	let intersectionobserver;
    	let updating_intersecting;
    	let current;
    	let update_props = {};
    	update = new Update({ props: update_props, $$inline: true });
    	/*update_binding*/ ctx[14](update);

    	function intersectionobserver_intersecting_binding(value) {
    		/*intersectionobserver_intersecting_binding*/ ctx[22](value);
    	}

    	let intersectionobserver_props = {
    		element: /*element*/ ctx[2],
    		rootMargin: /*rootMargin*/ ctx[3],
    		$$slots: { default: [create_default_slot$5] },
    		$$scope: { ctx }
    	};

    	if (/*intersecting*/ ctx[0] !== void 0) {
    		intersectionobserver_props.intersecting = /*intersecting*/ ctx[0];
    	}

    	intersectionobserver = new IntersectionObserver$1({
    			props: intersectionobserver_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind$2(intersectionobserver, 'intersecting', intersectionobserver_intersecting_binding));

    	const block = {
    		c: function create() {
    			create_component(update.$$.fragment);
    			t = space();
    			create_component(intersectionobserver.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(update.$$.fragment, nodes);
    			t = claim_space(nodes);
    			claim_component(intersectionobserver.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(update, target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(intersectionobserver, target, anchor);
    			current = true;
    		},
    		p: function update$1(ctx, dirty) {
    			const update_changes = {};
    			update.$set(update_changes);
    			const intersectionobserver_changes = {};
    			if (dirty[0] & /*element*/ 4) intersectionobserver_changes.element = /*element*/ ctx[2];
    			if (dirty[0] & /*rootMargin*/ 8) intersectionobserver_changes.rootMargin = /*rootMargin*/ ctx[3];

    			if (dirty[0] & /*$bookId, $projectId, element, $hasTalkedToSven, $amountOfProjects, wasClicked, $_*/ 1012 | dirty[1] & /*$$scope*/ 1) {
    				intersectionobserver_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_intersecting && dirty[0] & /*intersecting*/ 1) {
    				updating_intersecting = true;
    				intersectionobserver_changes.intersecting = /*intersecting*/ ctx[0];
    				add_flush_callback(() => updating_intersecting = false);
    			}

    			intersectionobserver.$set(intersectionobserver_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(update.$$.fragment, local);
    			transition_in(intersectionobserver.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(update.$$.fragment, local);
    			transition_out(intersectionobserver.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*update_binding*/ ctx[14](null);
    			destroy_component(update, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(intersectionobserver, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const PROJECTS_ENDPOINT$5 = "http://localhost:4000/api/projects";

    function instance$e($$self, $$props, $$invalidate) {
    	let $projectId;
    	let $amountOfProjects;
    	let $bookId;
    	let $allKidsBooksRead;
    	let $checkPoint;
    	let $hasTalkedToSven;
    	let $_;
    	validate_store(projectId, 'projectId');
    	component_subscribe($$self, projectId, $$value => $$invalidate(5, $projectId = $$value));
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(6, $amountOfProjects = $$value));
    	validate_store(bookId, 'bookId');
    	component_subscribe($$self, bookId, $$value => $$invalidate(7, $bookId = $$value));
    	validate_store(allKidsBooksRead, 'allKidsBooksRead');
    	component_subscribe($$self, allKidsBooksRead, $$value => $$invalidate(24, $allKidsBooksRead = $$value));
    	validate_store(checkPoint, 'checkPoint');
    	component_subscribe($$self, checkPoint, $$value => $$invalidate(25, $checkPoint = $$value));
    	validate_store(hasTalkedToSven, 'hasTalkedToSven');
    	component_subscribe($$self, hasTalkedToSven, $$value => $$invalidate(8, $hasTalkedToSven = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(9, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('BarnOchUnga', slots, []);
    	let updateBookComponent;
    	let isInShelf = true;
    	let element;
    	let intersecting;
    	let rootMargin = "-250px";
    	const bookCopy = { ...$amountOfProjects, read: true };

    	// fixes issue with intersection observer on mobile devices
    	if (window.innerHeight < 768) {
    		rootMargin = "-150px";
    	}

    	let { key } = $$props;
    	let wasClicked = -1;

    	onMount(async () => {
    		try {
    			const response = await axios.get(PROJECTS_ENDPOINT$5);
    			set_store_value(amountOfProjects, $amountOfProjects = response.data, $amountOfProjects);

    			// console.log($amountOfProjects)
    			const kidsStorage = localStorage.getItem('kids');

    			if (kidsStorage !== null) {
    				const storage = JSON.parse(kidsStorage);
    				set_store_value(allKidsBooksRead, $allKidsBooksRead = storage, $allKidsBooksRead);
    				console.log($allKidsBooksRead);
    			}

    			console.log($allKidsBooksRead);
    		} catch(error) {
    			console.log(error);
    		}
    	});

    	// animates the book from spine to cover
    	const clickBookSpine = (book, id) => {
    		if (book.id !== id) {
    			set_store_value(bookId, $bookId = '', $bookId);
    			isInShelf = isInShelf;
    		} else if (book.id === id) {
    			set_store_value(bookId, $bookId = id, $bookId);
    			isInShelf = !isInShelf;
    		}
    	};

    	// checks if books in this category have been read
    	const checkReadBooks = () => {
    		const newArray = $amountOfProjects.filter(book => book.category === 'Barn och Unga');

    		// console.log('FIRST CATEGORY', newArray)
    		let array = [...newArray];

    		let readArray = array.map(r => r.read);

    		if (readArray.every(val => val === true)) {
    			set_store_value(allKidsBooksRead, $allKidsBooksRead = true, $allKidsBooksRead);
    			localStorage.setItem('kids', $allKidsBooksRead);
    		} // get fly award
    	};

    	// opens book, on closing it checks if book has been read and updates array accordingly
    	const openBook = i => {
    		$$invalidate(4, wasClicked = wasClicked === i ? -1 : i);

    		$amountOfProjects.forEach(() => {
    			if (i === wasClicked) {
    				set_store_value(projectId, $projectId = $bookId, $projectId);
    			}

    			if (wasClicked === -1) {
    				set_store_value(projectId, $projectId = 0, $projectId);
    				set_store_value(amountOfProjects, $amountOfProjects[i].read = true, $amountOfProjects);
    				updateBookComponent.updateBook(bookCopy);
    				checkReadBooks();
    			}

    			console.log(wasClicked, $projectId);
    		});
    	};

    	// function to open books with enter key
    	const handleKeyDown = i => {
    		if (key == 'Enter') {
    			openBook(i);
    		}
    	};

    	$$self.$$.on_mount.push(function () {
    		if (key === undefined && !('key' in $$props || $$self.$$.bound[$$self.$$.props['key']])) {
    			console_1$b.warn("<BarnOchUnga> was created without expected prop 'key'");
    		}
    	});

    	const writable_props = ['key'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$b.warn(`<BarnOchUnga> was created with unknown prop '${key}'`);
    	});

    	function update_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			updateBookComponent = $$value;
    			$$invalidate(1, updateBookComponent);
    		});
    	}

    	const click_handler = () => set_store_value(bookId, $bookId = set_store_value(bookId, $bookId = '', $bookId), $bookId);
    	const click_handler_1 = i => openBook(i);
    	const click_handler_2 = i => openBook(i);
    	const click_handler_3 = i => openBook(i);
    	const click_handler_4 = project => clickBookSpine(project, project.id);
    	const keyup_handler = i => handleKeyDown(i);

    	function article_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(2, element);
    		});
    	}

    	function intersectionobserver_intersecting_binding(value) {
    		intersecting = value;
    		$$invalidate(0, intersecting);
    	}

    	$$self.$$set = $$props => {
    		if ('key' in $$props) $$invalidate(13, key = $$props.key);
    	};

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		axios,
    		amountOfProjects,
    		checkPoint,
    		bookId,
    		projectId,
    		allKidsBooksRead,
    		hasTalkedToSven,
    		InterSectionObserver: IntersectionObserver$1,
    		Update,
    		updateBookComponent,
    		isInShelf,
    		element,
    		intersecting,
    		rootMargin,
    		bookCopy,
    		key,
    		wasClicked,
    		PROJECTS_ENDPOINT: PROJECTS_ENDPOINT$5,
    		clickBookSpine,
    		checkReadBooks,
    		openBook,
    		handleKeyDown,
    		$projectId,
    		$amountOfProjects,
    		$bookId,
    		$allKidsBooksRead,
    		$checkPoint,
    		$hasTalkedToSven,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('updateBookComponent' in $$props) $$invalidate(1, updateBookComponent = $$props.updateBookComponent);
    		if ('isInShelf' in $$props) isInShelf = $$props.isInShelf;
    		if ('element' in $$props) $$invalidate(2, element = $$props.element);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('rootMargin' in $$props) $$invalidate(3, rootMargin = $$props.rootMargin);
    		if ('key' in $$props) $$invalidate(13, key = $$props.key);
    		if ('wasClicked' in $$props) $$invalidate(4, wasClicked = $$props.wasClicked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*intersecting*/ 1) {
    			// BUG: when all are true or all have been read and you want read a book again all become unread or false again. 
    			intersecting
    			? set_store_value(checkPoint, $checkPoint = set_store_value(checkPoint, $checkPoint = 1, $checkPoint), $checkPoint)
    			: '';
    		}

    		if ($$self.$$.dirty[0] & /*intersecting*/ 1) {
    			console.log('intersecting', intersecting);
    		}
    	};

    	return [
    		intersecting,
    		updateBookComponent,
    		element,
    		rootMargin,
    		wasClicked,
    		$projectId,
    		$amountOfProjects,
    		$bookId,
    		$hasTalkedToSven,
    		$_,
    		clickBookSpine,
    		openBook,
    		handleKeyDown,
    		key,
    		update_binding,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		keyup_handler,
    		article_binding,
    		intersectionobserver_intersecting_binding
    	];
    }

    class BarnOchUnga extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { key: 13 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "BarnOchUnga",
    			options,
    			id: create_fragment$e.name
    		});
    	}

    	get key() {
    		throw new Error("<BarnOchUnga>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<BarnOchUnga>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\categories\Ungdomar.svelte generated by Svelte v3.53.1 */

    const { console: console_1$a } = globals;
    const file$d = "src\\components\\categories\\Ungdomar.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[27] = list[i];
    	child_ctx[29] = i;
    	return child_ctx;
    }

    // (98:2) {#if project.category === "Ungdomar"}
    function create_if_block$9(ctx) {
    	let div14;
    	let button;
    	let t0_value = /*$_*/ ctx[8]("closeTheBook") + "";
    	let t0;
    	let button_class_value;
    	let t1;
    	let div13;
    	let div1;
    	let div0;
    	let div0_class_value;
    	let t2;
    	let div2;
    	let h3;
    	let t3_value = /*project*/ ctx[27].title + "";
    	let t3;
    	let div2_class_value;
    	let t4;
    	let div3;
    	let div3_class_value;
    	let t5;
    	let div4;
    	let div4_class_value;
    	let t6;
    	let div5;
    	let div5_class_value;
    	let t7;
    	let div6;
    	let div6_class_value;
    	let t8;
    	let div7;
    	let div7_class_value;
    	let t9;
    	let div8;
    	let div8_class_value;
    	let t10;
    	let div9;
    	let div9_class_value;
    	let t11;
    	let div10;
    	let h2;
    	let t12_value = /*project*/ ctx[27].title + "";
    	let t12;
    	let t13;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t14;
    	let p0;
    	let t15_value = /*project*/ ctx[27].category + "";
    	let t15;
    	let div10_class_value;
    	let t16;
    	let div11;
    	let p1;
    	let t17_value = /*project*/ ctx[27].description + "";
    	let t17;
    	let div11_class_value;
    	let t18;
    	let div12;
    	let div12_class_value;
    	let div13_class_value;
    	let div13_key_value;
    	let t19;
    	let div14_class_value;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[15](/*i*/ ctx[29]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[16](/*i*/ ctx[29]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[17](/*i*/ ctx[29]);
    	}

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[18](/*project*/ ctx[27]);
    	}

    	function keyup_handler() {
    		return /*keyup_handler*/ ctx[19](/*i*/ ctx[29]);
    	}

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			div13 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			h3 = element("h3");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			t5 = space();
    			div4 = element("div");
    			t6 = space();
    			div5 = element("div");
    			t7 = space();
    			div6 = element("div");
    			t8 = space();
    			div7 = element("div");
    			t9 = space();
    			div8 = element("div");
    			t10 = space();
    			div9 = element("div");
    			t11 = space();
    			div10 = element("div");
    			h2 = element("h2");
    			t12 = text(t12_value);
    			t13 = space();
    			img = element("img");
    			t14 = space();
    			p0 = element("p");
    			t15 = text(t15_value);
    			t16 = space();
    			div11 = element("div");
    			p1 = element("p");
    			t17 = text(t17_value);
    			t18 = space();
    			div12 = element("div");
    			t19 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			button = claim_element(div14_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t0 = claim_text(button_nodes, t0_value);
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(div14_nodes);
    			div13 = claim_element(div14_nodes, "DIV", { tabindex: true, class: true, key: true });
    			var div13_nodes = children(div13);
    			div1 = claim_element(div13_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div13_nodes);
    			div2 = claim_element(div13_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			h3 = claim_element(div2_nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t3 = claim_text(h3_nodes, t3_value);
    			h3_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t4 = claim_space(div13_nodes);
    			div3 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div3).forEach(detach_dev);
    			t5 = claim_space(div13_nodes);
    			div4 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div4).forEach(detach_dev);
    			t6 = claim_space(div13_nodes);
    			div5 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div5).forEach(detach_dev);
    			t7 = claim_space(div13_nodes);
    			div6 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div6).forEach(detach_dev);
    			t8 = claim_space(div13_nodes);
    			div7 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div7).forEach(detach_dev);
    			t9 = claim_space(div13_nodes);
    			div8 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div8).forEach(detach_dev);
    			t10 = claim_space(div13_nodes);
    			div9 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div9).forEach(detach_dev);
    			t11 = claim_space(div13_nodes);
    			div10 = claim_element(div13_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h2 = claim_element(div10_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t12 = claim_text(h2_nodes, t12_value);
    			h2_nodes.forEach(detach_dev);
    			t13 = claim_space(div10_nodes);

    			img = claim_element(div10_nodes, "IMG", {
    				src: true,
    				alt: true,
    				name: true,
    				height: true,
    				class: true
    			});

    			t14 = claim_space(div10_nodes);
    			p0 = claim_element(div10_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t15 = claim_text(p0_nodes, t15_value);
    			p0_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			t16 = claim_space(div13_nodes);
    			div11 = claim_element(div13_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			p1 = claim_element(div11_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t17 = claim_text(p1_nodes, t17_value);
    			p1_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t18 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div12).forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			t19 = claim_space(div14_nodes);
    			div14_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-1cklglk"));

    			add_location(button, file$d, 99, 5, 2730);

    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-1cklglk"));

    			add_location(div0, file$d, 110, 4, 3143);
    			attr_dev(div1, "class", "spine1 svelte-1cklglk");
    			add_location(div1, file$d, 109, 4, 3117);
    			attr_dev(h3, "class", "cover-title svelte-1cklglk");
    			add_location(h3, file$d, 113, 5, 3352);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div2, file$d, 112, 4, 3240);

    			attr_dev(div3, "class", div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div3, file$d, 117, 4, 3429);

    			attr_dev(div4, "class", div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div4, file$d, 119, 4, 3525);

    			attr_dev(div5, "class", div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div5, file$d, 120, 4, 3613);

    			attr_dev(div6, "class", div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div6, file$d, 121, 4, 3701);

    			attr_dev(div7, "class", div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div7, file$d, 122, 4, 3789);

    			attr_dev(div8, "class", div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div8, file$d, 123, 4, 3877);

    			attr_dev(div9, "class", div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div9, file$d, 124, 4, 3965);
    			attr_dev(h2, "class", "title svelte-1cklglk");
    			add_location(h2, file$d, 127, 5, 4170);
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[27].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[27].title);
    			attr_dev(img, "name", "picture");
    			attr_dev(img, "height", "50px");
    			attr_dev(img, "class", "picture svelte-1cklglk");
    			add_location(img, file$d, 128, 5, 4215);
    			attr_dev(p0, "class", "category svelte-1cklglk");
    			add_location(p0, file$d, 135, 5, 4354);

    			attr_dev(div10, "class", div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div10, file$d, 126, 4, 4059);
    			attr_dev(p1, "class", "description svelte-1cklglk");
    			add_location(p1, file$d, 138, 6, 4533);

    			attr_dev(div11, "class", div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div11, file$d, 137, 5, 4415);

    			attr_dev(div12, "class", div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"));

    			add_location(div12, file$d, 140, 4, 4600);
    			attr_dev(div13, "tabindex", "0");

    			attr_dev(div13, "class", div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[29] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-1cklglk"));

    			attr_dev(div13, "key", div13_key_value = /*project*/ ctx[27].id);
    			add_location(div13, file$d, 102, 3, 2890);
    			attr_dev(div14, "class", div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[29] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-1cklglk"));
    			add_location(div14, file$d, 98, 2, 2657);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, button);
    			append_hydration_dev(button, t0);
    			append_hydration_dev(div14, t1);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div13, t2);
    			append_hydration_dev(div13, div2);
    			append_hydration_dev(div2, h3);
    			append_hydration_dev(h3, t3);
    			append_hydration_dev(div13, t4);
    			append_hydration_dev(div13, div3);
    			append_hydration_dev(div13, t5);
    			append_hydration_dev(div13, div4);
    			append_hydration_dev(div13, t6);
    			append_hydration_dev(div13, div5);
    			append_hydration_dev(div13, t7);
    			append_hydration_dev(div13, div6);
    			append_hydration_dev(div13, t8);
    			append_hydration_dev(div13, div7);
    			append_hydration_dev(div13, t9);
    			append_hydration_dev(div13, div8);
    			append_hydration_dev(div13, t10);
    			append_hydration_dev(div13, div9);
    			append_hydration_dev(div13, t11);
    			append_hydration_dev(div13, div10);
    			append_hydration_dev(div10, h2);
    			append_hydration_dev(h2, t12);
    			append_hydration_dev(div10, t13);
    			append_hydration_dev(div10, img);
    			append_hydration_dev(div10, t14);
    			append_hydration_dev(div10, p0);
    			append_hydration_dev(p0, t15);
    			append_hydration_dev(div13, t16);
    			append_hydration_dev(div13, div11);
    			append_hydration_dev(div11, p1);
    			append_hydration_dev(p1, t17);
    			append_hydration_dev(div13, t18);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div14, t19);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[14], false, false, false),
    					listen_dev(div2, "click", click_handler_1, false, false, false),
    					listen_dev(div10, "click", click_handler_2, false, false, false),
    					listen_dev(div11, "click", click_handler_3, false, false, false),
    					listen_dev(div13, "click", click_handler_4, false, false, false),
    					listen_dev(div13, "keyup", prevent_default(keyup_handler), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*$_*/ 256 && t0_value !== (t0_value = /*$_*/ ctx[8]("closeTheBook") + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && button_class_value !== (button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-1cklglk"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div0_class_value !== (div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-1cklglk"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 64 && t3_value !== (t3_value = /*project*/ ctx[27].title + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div2_class_value !== (div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div3_class_value !== (div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div4_class_value !== (div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div4, "class", div4_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div5_class_value !== (div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div5, "class", div5_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div6_class_value !== (div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div6, "class", div6_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div7_class_value !== (div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div7, "class", div7_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div8_class_value !== (div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div8, "class", div8_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div9_class_value !== (div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div9, "class", div9_class_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 64 && t12_value !== (t12_value = /*project*/ ctx[27].title + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*$amountOfProjects*/ 64 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[27].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 64 && img_alt_value !== (img_alt_value = /*project*/ ctx[27].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 64 && t15_value !== (t15_value = /*project*/ ctx[27].category + "")) set_data_dev(t15, t15_value);

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div10_class_value !== (div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div10, "class", div10_class_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 64 && t17_value !== (t17_value = /*project*/ ctx[27].description + "")) set_data_dev(t17, t17_value);

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div11_class_value !== (div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div11, "class", div11_class_value);
    			}

    			if (dirty & /*$amountOfProjects, $bookId*/ 192 && div12_class_value !== (div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[27].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-1cklglk"))) {
    				attr_dev(div12, "class", div12_class_value);
    			}

    			if (dirty & /*$amountOfProjects, wasClicked*/ 80 && div13_class_value !== (div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[29] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-1cklglk"))) {
    				attr_dev(div13, "class", div13_class_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 64 && div13_key_value !== (div13_key_value = /*project*/ ctx[27].id)) {
    				attr_dev(div13, "key", div13_key_value);
    			}

    			if (dirty & /*$amountOfProjects, wasClicked*/ 80 && div14_class_value !== (div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[29] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-1cklglk"))) {
    				attr_dev(div14, "class", div14_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(98:2) {#if project.category === \\\"Ungdomar\\\"}",
    		ctx
    	});

    	return block;
    }

    // (97:2) {#each $amountOfProjects as project, i (project.id)}
    function create_each_block$4(key_2, ctx) {
    	let first;
    	let if_block_anchor;
    	let if_block = /*project*/ ctx[27].category === "Ungdomar" && create_if_block$9(ctx);

    	const block = {
    		key: key_2,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			first = empty();
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*project*/ ctx[27].category === "Ungdomar") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$9(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(97:2) {#each $amountOfProjects as project, i (project.id)}",
    		ctx
    	});

    	return block;
    }

    // (93:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>
    function create_default_slot$4(ctx) {
    	let section;
    	let article;
    	let main;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let section_class_value;
    	let each_value = /*$amountOfProjects*/ ctx[6];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*project*/ ctx[27].id;
    	validate_each_keys(ctx, each_value, get_each_context$4, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$4(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$4(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			article = element("article");
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section_nodes = children(section);
    			article = claim_element(section_nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			main = claim_element(article_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(main_nodes);
    			}

    			main_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(main, "class", "svelte-1cklglk");
    			add_location(main, file$d, 95, 2, 2550);
    			attr_dev(article, "class", "svelte-1cklglk");
    			add_location(article, file$d, 94, 1, 2516);
    			attr_dev(section, "id", "second-category");

    			attr_dev(section, "class", section_class_value = "" + (null_to_empty("second-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[5]
    			? "overlay"
    			: "")) + " svelte-1cklglk"));

    			add_location(section, file$d, 93, 0, 2412);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, article);
    			append_hydration_dev(article, main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			/*article_binding*/ ctx[20](article);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$amountOfProjects, wasClicked, clickBookSpine, handleKeyDown, $bookId, openBook, $_*/ 4048) {
    				each_value = /*$amountOfProjects*/ ctx[6];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$4, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, main, destroy_block, create_each_block$4, null, get_each_context$4);
    			}

    			if (dirty & /*$bookId, $projectId*/ 160 && section_class_value !== (section_class_value = "" + (null_to_empty("second-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[5]
    			? "overlay"
    			: "")) + " svelte-1cklglk"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			/*article_binding*/ ctx[20](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(93:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let update;
    	let t;
    	let intersectionobserver;
    	let updating_intersecting;
    	let current;
    	let update_props = {};
    	update = new Update({ props: update_props, $$inline: true });
    	/*update_binding*/ ctx[13](update);

    	function intersectionobserver_intersecting_binding(value) {
    		/*intersectionobserver_intersecting_binding*/ ctx[21](value);
    	}

    	let intersectionobserver_props = {
    		element: /*element*/ ctx[2],
    		rootMargin: /*rootMargin*/ ctx[3],
    		$$slots: { default: [create_default_slot$4] },
    		$$scope: { ctx }
    	};

    	if (/*intersecting*/ ctx[0] !== void 0) {
    		intersectionobserver_props.intersecting = /*intersecting*/ ctx[0];
    	}

    	intersectionobserver = new IntersectionObserver$1({
    			props: intersectionobserver_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind$2(intersectionobserver, 'intersecting', intersectionobserver_intersecting_binding));

    	const block = {
    		c: function create() {
    			create_component(update.$$.fragment);
    			t = space();
    			create_component(intersectionobserver.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(update.$$.fragment, nodes);
    			t = claim_space(nodes);
    			claim_component(intersectionobserver.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(update, target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(intersectionobserver, target, anchor);
    			current = true;
    		},
    		p: function update$1(ctx, [dirty]) {
    			const update_changes = {};
    			update.$set(update_changes);
    			const intersectionobserver_changes = {};
    			if (dirty & /*element*/ 4) intersectionobserver_changes.element = /*element*/ ctx[2];
    			if (dirty & /*rootMargin*/ 8) intersectionobserver_changes.rootMargin = /*rootMargin*/ ctx[3];

    			if (dirty & /*$$scope, $bookId, $projectId, element, $amountOfProjects, wasClicked, $_*/ 1073742324) {
    				intersectionobserver_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_intersecting && dirty & /*intersecting*/ 1) {
    				updating_intersecting = true;
    				intersectionobserver_changes.intersecting = /*intersecting*/ ctx[0];
    				add_flush_callback(() => updating_intersecting = false);
    			}

    			intersectionobserver.$set(intersectionobserver_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(update.$$.fragment, local);
    			transition_in(intersectionobserver.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(update.$$.fragment, local);
    			transition_out(intersectionobserver.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*update_binding*/ ctx[13](null);
    			destroy_component(update, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(intersectionobserver, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const PROJECTS_ENDPOINT$4 = "http://localhost:4000/api/projects";

    function instance$d($$self, $$props, $$invalidate) {
    	let $checkPoint;
    	let $projectId;
    	let $amountOfProjects;
    	let $bookId;
    	let $adolescenceBooksRead;
    	let $_;
    	validate_store(checkPoint, 'checkPoint');
    	component_subscribe($$self, checkPoint, $$value => $$invalidate(23, $checkPoint = $$value));
    	validate_store(projectId, 'projectId');
    	component_subscribe($$self, projectId, $$value => $$invalidate(5, $projectId = $$value));
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(6, $amountOfProjects = $$value));
    	validate_store(bookId, 'bookId');
    	component_subscribe($$self, bookId, $$value => $$invalidate(7, $bookId = $$value));
    	validate_store(adolescenceBooksRead, 'adolescenceBooksRead');
    	component_subscribe($$self, adolescenceBooksRead, $$value => $$invalidate(24, $adolescenceBooksRead = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(8, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Ungdomar', slots, []);
    	let updateBookComponent;
    	let isInShelf = true;
    	let element;
    	let intersecting;
    	let rootMargin = "-250px";
    	const bookCopy = { ...$amountOfProjects, read: true };

    	// fixes issue with intersection observer on mobile devices
    	if (window.innerHeight < 768) {
    		rootMargin = "-150px";
    	}

    	let { key } = $$props;
    	let wasClicked = -1;

    	onMount(async () => {
    		try {
    			const response = await axios.get(PROJECTS_ENDPOINT$4);
    			set_store_value(amountOfProjects, $amountOfProjects = response.data, $amountOfProjects);
    			const adolescenceStorage = localStorage.getItem('adolescence');

    			if (adolescenceStorage !== null) {
    				const storage = JSON.parse(adolescenceStorage);
    				set_store_value(adolescenceBooksRead, $adolescenceBooksRead = storage, $adolescenceBooksRead);
    			}
    		} catch(error) {
    			console.log(error);
    		}
    	});

    	const clickBookSpine = (book, id) => {
    		if (book.id !== id) {
    			set_store_value(bookId, $bookId = '', $bookId);
    			isInShelf = isInShelf;
    		} else if (book.id === id) {
    			set_store_value(bookId, $bookId = id, $bookId);
    			isInShelf = !isInShelf;
    		}
    	};

    	// checks if books in this category have been read
    	const checkReadBooks = () => {
    		const newArray = $amountOfProjects.filter(book => book.category === 'Ungdomar');
    		let array = [...newArray];
    		let readArray = array.map(r => r.read);

    		if (readArray.every(val => val === true)) {
    			set_store_value(adolescenceBooksRead, $adolescenceBooksRead = true, $adolescenceBooksRead);
    			localStorage.setItem('adolescence', $adolescenceBooksRead);
    			window.scrollTo({ left: 600, behavior: "smooth" });
    		}
    	};

    	const openBook = i => {
    		$$invalidate(4, wasClicked = wasClicked === i ? -1 : i);

    		$amountOfProjects.forEach(() => {
    			if (i === wasClicked) {
    				set_store_value(projectId, $projectId = $bookId, $projectId);
    			}

    			if (wasClicked === -1) {
    				set_store_value(projectId, $projectId = 0, $projectId);
    				set_store_value(amountOfProjects, $amountOfProjects[i].read = true, $amountOfProjects);
    				updateBookComponent.updateBook(bookCopy);
    				checkReadBooks();
    			}

    			console.log(wasClicked, $projectId);
    		});
    	};

    	const handleKeyDown = i => {
    		if (key == 'Enter') {
    			openBook(i);
    		}
    	};

    	$$self.$$.on_mount.push(function () {
    		if (key === undefined && !('key' in $$props || $$self.$$.bound[$$self.$$.props['key']])) {
    			console_1$a.warn("<Ungdomar> was created without expected prop 'key'");
    		}
    	});

    	const writable_props = ['key'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$a.warn(`<Ungdomar> was created with unknown prop '${key}'`);
    	});

    	function update_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			updateBookComponent = $$value;
    			$$invalidate(1, updateBookComponent);
    		});
    	}

    	const click_handler = () => set_store_value(bookId, $bookId = set_store_value(bookId, $bookId = '', $bookId), $bookId);
    	const click_handler_1 = i => openBook(i);
    	const click_handler_2 = i => openBook(i);
    	const click_handler_3 = i => openBook(i);
    	const click_handler_4 = project => clickBookSpine(project, project.id);
    	const keyup_handler = i => handleKeyDown(i);

    	function article_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(2, element);
    		});
    	}

    	function intersectionobserver_intersecting_binding(value) {
    		intersecting = value;
    		$$invalidate(0, intersecting);
    	}

    	$$self.$$set = $$props => {
    		if ('key' in $$props) $$invalidate(12, key = $$props.key);
    	};

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		axios,
    		amountOfProjects,
    		checkPoint,
    		projectId,
    		bookId,
    		adolescenceBooksRead,
    		InterSectionObserver: IntersectionObserver$1,
    		Update,
    		updateBookComponent,
    		isInShelf,
    		element,
    		intersecting,
    		rootMargin,
    		bookCopy,
    		key,
    		wasClicked,
    		PROJECTS_ENDPOINT: PROJECTS_ENDPOINT$4,
    		clickBookSpine,
    		checkReadBooks,
    		openBook,
    		handleKeyDown,
    		$checkPoint,
    		$projectId,
    		$amountOfProjects,
    		$bookId,
    		$adolescenceBooksRead,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('updateBookComponent' in $$props) $$invalidate(1, updateBookComponent = $$props.updateBookComponent);
    		if ('isInShelf' in $$props) isInShelf = $$props.isInShelf;
    		if ('element' in $$props) $$invalidate(2, element = $$props.element);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('rootMargin' in $$props) $$invalidate(3, rootMargin = $$props.rootMargin);
    		if ('key' in $$props) $$invalidate(12, key = $$props.key);
    		if ('wasClicked' in $$props) $$invalidate(4, wasClicked = $$props.wasClicked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*intersecting*/ 1) {
    			intersecting
    			? set_store_value(checkPoint, $checkPoint = set_store_value(checkPoint, $checkPoint = 2, $checkPoint), $checkPoint)
    			: '';
    		}
    	};

    	return [
    		intersecting,
    		updateBookComponent,
    		element,
    		rootMargin,
    		wasClicked,
    		$projectId,
    		$amountOfProjects,
    		$bookId,
    		$_,
    		clickBookSpine,
    		openBook,
    		handleKeyDown,
    		key,
    		update_binding,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		keyup_handler,
    		article_binding,
    		intersectionobserver_intersecting_binding
    	];
    }

    class Ungdomar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, { key: 12 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Ungdomar",
    			options,
    			id: create_fragment$d.name
    		});
    	}

    	get key() {
    		throw new Error("<Ungdomar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Ungdomar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\categories\StödOchRörlighet.svelte generated by Svelte v3.53.1 */

    const { console: console_1$9 } = globals;
    const file$c = "src\\components\\categories\\StödOchRörlighet.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[28] = list[i];
    	child_ctx[30] = i;
    	return child_ctx;
    }

    // (104:2) {#if project.category === "Stöd och Rörlighet"}
    function create_if_block$8(ctx) {
    	let div14;
    	let button;
    	let t0_value = /*$_*/ ctx[9]("closeTheBook") + "";
    	let t0;
    	let button_class_value;
    	let t1;
    	let div13;
    	let div1;
    	let div0;
    	let div0_class_value;
    	let t2;
    	let div2;
    	let h3;
    	let t3_value = /*project*/ ctx[28].title + "";
    	let t3;
    	let div2_class_value;
    	let t4;
    	let div3;
    	let div3_class_value;
    	let t5;
    	let div4;
    	let div4_class_value;
    	let t6;
    	let div5;
    	let div5_class_value;
    	let t7;
    	let div6;
    	let div6_class_value;
    	let t8;
    	let div7;
    	let div7_class_value;
    	let t9;
    	let div8;
    	let div8_class_value;
    	let t10;
    	let div9;
    	let div9_class_value;
    	let t11;
    	let div10;
    	let h2;
    	let t12_value = /*project*/ ctx[28].title + "";
    	let t12;
    	let t13;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t14;
    	let p0;
    	let t15_value = /*project*/ ctx[28].category + "";
    	let t15;
    	let div10_class_value;
    	let t16;
    	let div11;
    	let p1;
    	let t17_value = /*project*/ ctx[28].description + "";
    	let t17;
    	let div11_class_value;
    	let t18;
    	let div12;
    	let div12_class_value;
    	let div13_class_value;
    	let div13_key_value;
    	let t19;
    	let div14_class_value;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[16](/*i*/ ctx[30]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[17](/*i*/ ctx[30]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[18](/*i*/ ctx[30]);
    	}

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[19](/*project*/ ctx[28]);
    	}

    	function keyup_handler() {
    		return /*keyup_handler*/ ctx[20](/*i*/ ctx[30]);
    	}

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			div13 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			h3 = element("h3");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			t5 = space();
    			div4 = element("div");
    			t6 = space();
    			div5 = element("div");
    			t7 = space();
    			div6 = element("div");
    			t8 = space();
    			div7 = element("div");
    			t9 = space();
    			div8 = element("div");
    			t10 = space();
    			div9 = element("div");
    			t11 = space();
    			div10 = element("div");
    			h2 = element("h2");
    			t12 = text(t12_value);
    			t13 = space();
    			img = element("img");
    			t14 = space();
    			p0 = element("p");
    			t15 = text(t15_value);
    			t16 = space();
    			div11 = element("div");
    			p1 = element("p");
    			t17 = text(t17_value);
    			t18 = space();
    			div12 = element("div");
    			t19 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			button = claim_element(div14_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t0 = claim_text(button_nodes, t0_value);
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(div14_nodes);
    			div13 = claim_element(div14_nodes, "DIV", { tabindex: true, class: true, key: true });
    			var div13_nodes = children(div13);
    			div1 = claim_element(div13_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div13_nodes);
    			div2 = claim_element(div13_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			h3 = claim_element(div2_nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t3 = claim_text(h3_nodes, t3_value);
    			h3_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t4 = claim_space(div13_nodes);
    			div3 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div3).forEach(detach_dev);
    			t5 = claim_space(div13_nodes);
    			div4 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div4).forEach(detach_dev);
    			t6 = claim_space(div13_nodes);
    			div5 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div5).forEach(detach_dev);
    			t7 = claim_space(div13_nodes);
    			div6 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div6).forEach(detach_dev);
    			t8 = claim_space(div13_nodes);
    			div7 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div7).forEach(detach_dev);
    			t9 = claim_space(div13_nodes);
    			div8 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div8).forEach(detach_dev);
    			t10 = claim_space(div13_nodes);
    			div9 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div9).forEach(detach_dev);
    			t11 = claim_space(div13_nodes);
    			div10 = claim_element(div13_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h2 = claim_element(div10_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t12 = claim_text(h2_nodes, t12_value);
    			h2_nodes.forEach(detach_dev);
    			t13 = claim_space(div10_nodes);

    			img = claim_element(div10_nodes, "IMG", {
    				src: true,
    				alt: true,
    				name: true,
    				height: true,
    				class: true
    			});

    			t14 = claim_space(div10_nodes);
    			p0 = claim_element(div10_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t15 = claim_text(p0_nodes, t15_value);
    			p0_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			t16 = claim_space(div13_nodes);
    			div11 = claim_element(div13_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			p1 = claim_element(div11_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t17 = claim_text(p1_nodes, t17_value);
    			p1_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t18 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div12).forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			t19 = claim_space(div14_nodes);
    			div14_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-rsmvgq"));

    			add_location(button, file$c, 105, 5, 3060);

    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-rsmvgq"));

    			add_location(div0, file$c, 116, 4, 3473);
    			attr_dev(div1, "class", "spine1 svelte-rsmvgq");
    			add_location(div1, file$c, 115, 4, 3447);
    			attr_dev(h3, "class", "cover-title svelte-rsmvgq");
    			add_location(h3, file$c, 119, 5, 3682);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div2, file$c, 118, 4, 3570);

    			attr_dev(div3, "class", div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div3, file$c, 123, 4, 3759);

    			attr_dev(div4, "class", div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div4, file$c, 125, 4, 3855);

    			attr_dev(div5, "class", div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div5, file$c, 126, 4, 3943);

    			attr_dev(div6, "class", div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div6, file$c, 127, 4, 4031);

    			attr_dev(div7, "class", div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div7, file$c, 128, 4, 4119);

    			attr_dev(div8, "class", div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div8, file$c, 129, 4, 4207);

    			attr_dev(div9, "class", div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div9, file$c, 130, 4, 4295);
    			attr_dev(h2, "class", "title svelte-rsmvgq");
    			add_location(h2, file$c, 133, 5, 4500);
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[28].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[28].title);
    			attr_dev(img, "name", "picture");
    			attr_dev(img, "height", "50px");
    			attr_dev(img, "class", "picture svelte-rsmvgq");
    			add_location(img, file$c, 134, 5, 4545);
    			attr_dev(p0, "class", "category svelte-rsmvgq");
    			add_location(p0, file$c, 141, 5, 4684);

    			attr_dev(div10, "class", div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div10, file$c, 132, 4, 4389);
    			attr_dev(p1, "class", "description svelte-rsmvgq");
    			add_location(p1, file$c, 144, 6, 4863);

    			attr_dev(div11, "class", div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div11, file$c, 143, 5, 4745);

    			attr_dev(div12, "class", div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"));

    			add_location(div12, file$c, 146, 4, 4930);
    			attr_dev(div13, "tabindex", "0");

    			attr_dev(div13, "class", div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-rsmvgq"));

    			attr_dev(div13, "key", div13_key_value = /*project*/ ctx[28].id);
    			add_location(div13, file$c, 108, 3, 3220);
    			attr_dev(div14, "class", div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-rsmvgq"));
    			add_location(div14, file$c, 104, 2, 2987);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, button);
    			append_hydration_dev(button, t0);
    			append_hydration_dev(div14, t1);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div13, t2);
    			append_hydration_dev(div13, div2);
    			append_hydration_dev(div2, h3);
    			append_hydration_dev(h3, t3);
    			append_hydration_dev(div13, t4);
    			append_hydration_dev(div13, div3);
    			append_hydration_dev(div13, t5);
    			append_hydration_dev(div13, div4);
    			append_hydration_dev(div13, t6);
    			append_hydration_dev(div13, div5);
    			append_hydration_dev(div13, t7);
    			append_hydration_dev(div13, div6);
    			append_hydration_dev(div13, t8);
    			append_hydration_dev(div13, div7);
    			append_hydration_dev(div13, t9);
    			append_hydration_dev(div13, div8);
    			append_hydration_dev(div13, t10);
    			append_hydration_dev(div13, div9);
    			append_hydration_dev(div13, t11);
    			append_hydration_dev(div13, div10);
    			append_hydration_dev(div10, h2);
    			append_hydration_dev(h2, t12);
    			append_hydration_dev(div10, t13);
    			append_hydration_dev(div10, img);
    			append_hydration_dev(div10, t14);
    			append_hydration_dev(div10, p0);
    			append_hydration_dev(p0, t15);
    			append_hydration_dev(div13, t16);
    			append_hydration_dev(div13, div11);
    			append_hydration_dev(div11, p1);
    			append_hydration_dev(p1, t17);
    			append_hydration_dev(div13, t18);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div14, t19);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[15], false, false, false),
    					listen_dev(div2, "click", click_handler_1, false, false, false),
    					listen_dev(div10, "click", click_handler_2, false, false, false),
    					listen_dev(div11, "click", click_handler_3, false, false, false),
    					listen_dev(div13, "click", click_handler_4, false, false, false),
    					listen_dev(div13, "keyup", prevent_default(keyup_handler), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*$_*/ 512 && t0_value !== (t0_value = /*$_*/ ctx[9]("closeTheBook") + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && button_class_value !== (button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-rsmvgq"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div0_class_value !== (div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-rsmvgq"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t3_value !== (t3_value = /*project*/ ctx[28].title + "")) set_data_dev(t3, t3_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div2_class_value !== (div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div3_class_value !== (div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div4_class_value !== (div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div4, "class", div4_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div5_class_value !== (div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div5, "class", div5_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div6_class_value !== (div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div6, "class", div6_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div7_class_value !== (div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div7, "class", div7_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div8_class_value !== (div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div8, "class", div8_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div9_class_value !== (div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div9, "class", div9_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t12_value !== (t12_value = /*project*/ ctx[28].title + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*$amountOfProjects*/ 64 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[28].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && img_alt_value !== (img_alt_value = /*project*/ ctx[28].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t15_value !== (t15_value = /*project*/ ctx[28].category + "")) set_data_dev(t15, t15_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div10_class_value !== (div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div10, "class", div10_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && t17_value !== (t17_value = /*project*/ ctx[28].description + "")) set_data_dev(t17, t17_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div11_class_value !== (div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div11, "class", div11_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 192 && div12_class_value !== (div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-rsmvgq"))) {
    				attr_dev(div12, "class", div12_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 80 && div13_class_value !== (div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-rsmvgq"))) {
    				attr_dev(div13, "class", div13_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 64 && div13_key_value !== (div13_key_value = /*project*/ ctx[28].id)) {
    				attr_dev(div13, "key", div13_key_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 80 && div14_class_value !== (div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-rsmvgq"))) {
    				attr_dev(div14, "class", div14_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(104:2) {#if project.category === \\\"Stöd och Rörlighet\\\"}",
    		ctx
    	});

    	return block;
    }

    // (103:2) {#each $amountOfProjects as project, i (project.id)}
    function create_each_block$3(key_2, ctx) {
    	let first;
    	let if_block_anchor;
    	let if_block = /*project*/ ctx[28].category === "Stöd och Rörlighet" && create_if_block$8(ctx);

    	const block = {
    		key: key_2,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			first = empty();
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*project*/ ctx[28].category === "Stöd och Rörlighet") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$8(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(103:2) {#each $amountOfProjects as project, i (project.id)}",
    		ctx
    	});

    	return block;
    }

    // (98:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>
    function create_default_slot$3(ctx) {
    	let section;
    	let article;
    	let main;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let main_class_value;
    	let section_class_value;
    	let each_value = /*$amountOfProjects*/ ctx[6];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*project*/ ctx[28].id;
    	validate_each_keys(ctx, each_value, get_each_context$3, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$3(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			article = element("article");
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section_nodes = children(section);
    			article = claim_element(section_nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			main = claim_element(article_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(main_nodes);
    			}

    			main_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(main, "class", main_class_value = "" + (null_to_empty(/*$spell*/ ctx[8] === true ? 'showBooks' : '') + " svelte-rsmvgq"));
    			add_location(main, file$c, 101, 2, 2827);
    			attr_dev(article, "class", "svelte-rsmvgq");
    			add_location(article, file$c, 99, 1, 2721);
    			attr_dev(section, "id", "third-category");

    			attr_dev(section, "class", section_class_value = "" + (null_to_empty("third-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[5]
    			? "overlay"
    			: '')) + " svelte-rsmvgq"));

    			add_location(section, file$c, 98, 0, 2619);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, article);
    			append_hydration_dev(article, main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			/*article_binding*/ ctx[21](article);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$amountOfProjects, wasClicked, clickBookSpine, handleKeyDown, $bookId, openBook, $_*/ 7888) {
    				each_value = /*$amountOfProjects*/ ctx[6];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$3, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, main, destroy_block, create_each_block$3, null, get_each_context$3);
    			}

    			if (dirty[0] & /*$spell*/ 256 && main_class_value !== (main_class_value = "" + (null_to_empty(/*$spell*/ ctx[8] === true ? 'showBooks' : '') + " svelte-rsmvgq"))) {
    				attr_dev(main, "class", main_class_value);
    			}

    			if (dirty[0] & /*$bookId, $projectId*/ 160 && section_class_value !== (section_class_value = "" + (null_to_empty("third-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[5]
    			? "overlay"
    			: '')) + " svelte-rsmvgq"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			/*article_binding*/ ctx[21](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(98:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let update;
    	let t;
    	let intersectionobserver;
    	let updating_intersecting;
    	let current;
    	let update_props = {};
    	update = new Update({ props: update_props, $$inline: true });
    	/*update_binding*/ ctx[14](update);

    	function intersectionobserver_intersecting_binding(value) {
    		/*intersectionobserver_intersecting_binding*/ ctx[22](value);
    	}

    	let intersectionobserver_props = {
    		element: /*element*/ ctx[2],
    		rootMargin: /*rootMargin*/ ctx[3],
    		$$slots: { default: [create_default_slot$3] },
    		$$scope: { ctx }
    	};

    	if (/*intersecting*/ ctx[0] !== void 0) {
    		intersectionobserver_props.intersecting = /*intersecting*/ ctx[0];
    	}

    	intersectionobserver = new IntersectionObserver$1({
    			props: intersectionobserver_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind$2(intersectionobserver, 'intersecting', intersectionobserver_intersecting_binding));

    	const block = {
    		c: function create() {
    			create_component(update.$$.fragment);
    			t = space();
    			create_component(intersectionobserver.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(update.$$.fragment, nodes);
    			t = claim_space(nodes);
    			claim_component(intersectionobserver.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(update, target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(intersectionobserver, target, anchor);
    			current = true;
    		},
    		p: function update$1(ctx, dirty) {
    			const update_changes = {};
    			update.$set(update_changes);
    			const intersectionobserver_changes = {};
    			if (dirty[0] & /*element*/ 4) intersectionobserver_changes.element = /*element*/ ctx[2];
    			if (dirty[0] & /*rootMargin*/ 8) intersectionobserver_changes.rootMargin = /*rootMargin*/ ctx[3];

    			if (dirty[0] & /*$bookId, $projectId, element, $spell, $amountOfProjects, wasClicked, $_*/ 1012 | dirty[1] & /*$$scope*/ 1) {
    				intersectionobserver_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_intersecting && dirty[0] & /*intersecting*/ 1) {
    				updating_intersecting = true;
    				intersectionobserver_changes.intersecting = /*intersecting*/ ctx[0];
    				add_flush_callback(() => updating_intersecting = false);
    			}

    			intersectionobserver.$set(intersectionobserver_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(update.$$.fragment, local);
    			transition_in(intersectionobserver.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(update.$$.fragment, local);
    			transition_out(intersectionobserver.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*update_binding*/ ctx[14](null);
    			destroy_component(update, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(intersectionobserver, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const PROJECTS_ENDPOINT$3 = "http://localhost:4000/api/projects";

    function instance$c($$self, $$props, $$invalidate) {
    	let $checkPoint;
    	let $projectId;
    	let $amountOfProjects;
    	let $bookId;
    	let $mobilityBooksRead;
    	let $spell;
    	let $_;
    	validate_store(checkPoint, 'checkPoint');
    	component_subscribe($$self, checkPoint, $$value => $$invalidate(24, $checkPoint = $$value));
    	validate_store(projectId, 'projectId');
    	component_subscribe($$self, projectId, $$value => $$invalidate(5, $projectId = $$value));
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(6, $amountOfProjects = $$value));
    	validate_store(bookId, 'bookId');
    	component_subscribe($$self, bookId, $$value => $$invalidate(7, $bookId = $$value));
    	validate_store(mobilityBooksRead, 'mobilityBooksRead');
    	component_subscribe($$self, mobilityBooksRead, $$value => $$invalidate(25, $mobilityBooksRead = $$value));
    	validate_store(spell, 'spell');
    	component_subscribe($$self, spell, $$value => $$invalidate(8, $spell = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(9, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('StuC3uB6dOchRuC3uB6rlighet', slots, []);
    	let updateBookComponent;
    	let isInShelf = true;
    	let element;
    	let intersecting;
    	let rootMargin = "-250px";
    	const bookCopy = { ...$amountOfProjects, read: true };

    	// fixes issue with intersection observer on mobile devices
    	if (window.innerHeight < 768) {
    		rootMargin = "-150px";
    	}

    	let { key } = $$props;
    	let wasClicked = -1;

    	onMount(async () => {
    		try {
    			const response = await axios.get(PROJECTS_ENDPOINT$3);
    			set_store_value(amountOfProjects, $amountOfProjects = response.data, $amountOfProjects);
    			const mobilityStorage = localStorage.getItem('mobility');

    			if (mobilityStorage !== null) {
    				const storage = JSON.parse(mobilityStorage);
    				set_store_value(mobilityBooksRead, $mobilityBooksRead = storage, $mobilityBooksRead);
    				console.log($mobilityBooksRead);
    			}
    		} catch(error) {
    			console.log(error);
    		}
    	});

    	// $: if($adolescenceBooksRead){
    	// 	document.getElementById('#third-category').scrollIntoView({behavior: "smooth"})
    	// }
    	const clickBookSpine = (book, id) => {
    		if (book.id !== id) {
    			set_store_value(bookId, $bookId = '', $bookId);
    			isInShelf = isInShelf;
    		} else if (book.id === id) {
    			set_store_value(bookId, $bookId = id, $bookId);
    			isInShelf = !isInShelf;
    			console.log($bookId, id);
    		}
    	};

    	// checks if books in this category have been read
    	const checkReadBooks = () => {
    		const newArray = $amountOfProjects.filter(book => book.category === 'Stöd och Rörlighet');
    		let array = [...newArray];
    		let readArray = array.map(r => r.read);

    		if (readArray.every(val => val === true)) {
    			set_store_value(mobilityBooksRead, $mobilityBooksRead = true, $mobilityBooksRead);
    			localStorage.setItem('mobility', $mobilityBooksRead);
    		}
    	};

    	const openBook = i => {
    		$$invalidate(4, wasClicked = wasClicked === i ? -1 : i);

    		$amountOfProjects.forEach(() => {
    			if (i === wasClicked) {
    				set_store_value(projectId, $projectId = $bookId, $projectId);
    			}

    			if (wasClicked === -1) {
    				set_store_value(projectId, $projectId = 0, $projectId);
    				set_store_value(amountOfProjects, $amountOfProjects[i].read = true, $amountOfProjects);
    				updateBookComponent.updateBook(bookCopy);
    				checkReadBooks();
    			}

    			console.log(wasClicked, $projectId);
    		});
    	};

    	const handleKeyDown = i => {
    		if (key == 'Enter') {
    			openBook(i);
    		}
    	};

    	$$self.$$.on_mount.push(function () {
    		if (key === undefined && !('key' in $$props || $$self.$$.bound[$$self.$$.props['key']])) {
    			console_1$9.warn("<StuC3uB6dOchRuC3uB6rlighet> was created without expected prop 'key'");
    		}
    	});

    	const writable_props = ['key'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$9.warn(`<StuC3uB6dOchRuC3uB6rlighet> was created with unknown prop '${key}'`);
    	});

    	function update_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			updateBookComponent = $$value;
    			$$invalidate(1, updateBookComponent);
    		});
    	}

    	const click_handler = () => set_store_value(bookId, $bookId = set_store_value(bookId, $bookId = '', $bookId), $bookId);
    	const click_handler_1 = i => openBook(i);
    	const click_handler_2 = i => openBook(i);
    	const click_handler_3 = i => openBook(i);
    	const click_handler_4 = project => clickBookSpine(project, project.id);
    	const keyup_handler = i => handleKeyDown(i);

    	function article_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(2, element);
    		});
    	}

    	function intersectionobserver_intersecting_binding(value) {
    		intersecting = value;
    		$$invalidate(0, intersecting);
    	}

    	$$self.$$set = $$props => {
    		if ('key' in $$props) $$invalidate(13, key = $$props.key);
    	};

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		axios,
    		amountOfProjects,
    		checkPoint,
    		bookId,
    		projectId,
    		mobilityBooksRead,
    		spell,
    		adolescenceBooksRead,
    		InterSectionObserver: IntersectionObserver$1,
    		Update,
    		updateBookComponent,
    		isInShelf,
    		element,
    		intersecting,
    		rootMargin,
    		bookCopy,
    		key,
    		wasClicked,
    		PROJECTS_ENDPOINT: PROJECTS_ENDPOINT$3,
    		clickBookSpine,
    		checkReadBooks,
    		openBook,
    		handleKeyDown,
    		$checkPoint,
    		$projectId,
    		$amountOfProjects,
    		$bookId,
    		$mobilityBooksRead,
    		$spell,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('updateBookComponent' in $$props) $$invalidate(1, updateBookComponent = $$props.updateBookComponent);
    		if ('isInShelf' in $$props) isInShelf = $$props.isInShelf;
    		if ('element' in $$props) $$invalidate(2, element = $$props.element);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('rootMargin' in $$props) $$invalidate(3, rootMargin = $$props.rootMargin);
    		if ('key' in $$props) $$invalidate(13, key = $$props.key);
    		if ('wasClicked' in $$props) $$invalidate(4, wasClicked = $$props.wasClicked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*intersecting*/ 1) {
    			intersecting
    			? set_store_value(checkPoint, $checkPoint = set_store_value(checkPoint, $checkPoint = 3, $checkPoint), $checkPoint)
    			: '';
    		}
    	};

    	return [
    		intersecting,
    		updateBookComponent,
    		element,
    		rootMargin,
    		wasClicked,
    		$projectId,
    		$amountOfProjects,
    		$bookId,
    		$spell,
    		$_,
    		clickBookSpine,
    		openBook,
    		handleKeyDown,
    		key,
    		update_binding,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		keyup_handler,
    		article_binding,
    		intersectionobserver_intersecting_binding
    	];
    }

    class StuC3uB6dOchRuC3uB6rlighet extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { key: 13 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StuC3uB6dOchRuC3uB6rlighet",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get key() {
    		throw new Error("<StuC3uB6dOchRuC3uB6rlighet>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<StuC3uB6dOchRuC3uB6rlighet>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\categories\Primärvård.svelte generated by Svelte v3.53.1 */

    const { console: console_1$8 } = globals;
    const file$b = "src\\components\\categories\\Primärvård.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[28] = list[i];
    	child_ctx[30] = i;
    	return child_ctx;
    }

    // (101:2) {#if project.category === "Primärvård"}
    function create_if_block$7(ctx) {
    	let div14;
    	let button;
    	let t0_value = /*$_*/ ctx[9]("closeTheBook") + "";
    	let t0;
    	let button_class_value;
    	let t1;
    	let div13;
    	let div1;
    	let div0;
    	let div0_class_value;
    	let t2;
    	let div2;
    	let h3;
    	let t3_value = /*project*/ ctx[28].title + "";
    	let t3;
    	let div2_class_value;
    	let t4;
    	let div3;
    	let div3_class_value;
    	let t5;
    	let div4;
    	let div4_class_value;
    	let t6;
    	let div5;
    	let div5_class_value;
    	let t7;
    	let div6;
    	let div6_class_value;
    	let t8;
    	let div7;
    	let div7_class_value;
    	let t9;
    	let div8;
    	let div8_class_value;
    	let t10;
    	let div9;
    	let div9_class_value;
    	let t11;
    	let div10;
    	let h2;
    	let t12_value = /*project*/ ctx[28].title + "";
    	let t12;
    	let t13;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t14;
    	let p0;
    	let t15_value = /*project*/ ctx[28].category + "";
    	let t15;
    	let div10_class_value;
    	let t16;
    	let div11;
    	let p1;
    	let t17_value = /*project*/ ctx[28].description + "";
    	let t17;
    	let div11_class_value;
    	let t18;
    	let div12;
    	let div12_class_value;
    	let div13_class_value;
    	let div13_key_value;
    	let t19;
    	let div14_class_value;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[16](/*i*/ ctx[30]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[17](/*i*/ ctx[30]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[18](/*i*/ ctx[30]);
    	}

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[19](/*project*/ ctx[28]);
    	}

    	function keyup_handler() {
    		return /*keyup_handler*/ ctx[20](/*i*/ ctx[30]);
    	}

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			div13 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			h3 = element("h3");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			t5 = space();
    			div4 = element("div");
    			t6 = space();
    			div5 = element("div");
    			t7 = space();
    			div6 = element("div");
    			t8 = space();
    			div7 = element("div");
    			t9 = space();
    			div8 = element("div");
    			t10 = space();
    			div9 = element("div");
    			t11 = space();
    			div10 = element("div");
    			h2 = element("h2");
    			t12 = text(t12_value);
    			t13 = space();
    			img = element("img");
    			t14 = space();
    			p0 = element("p");
    			t15 = text(t15_value);
    			t16 = space();
    			div11 = element("div");
    			p1 = element("p");
    			t17 = text(t17_value);
    			t18 = space();
    			div12 = element("div");
    			t19 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			button = claim_element(div14_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t0 = claim_text(button_nodes, t0_value);
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(div14_nodes);
    			div13 = claim_element(div14_nodes, "DIV", { tabindex: true, class: true, key: true });
    			var div13_nodes = children(div13);
    			div1 = claim_element(div13_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div13_nodes);
    			div2 = claim_element(div13_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			h3 = claim_element(div2_nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t3 = claim_text(h3_nodes, t3_value);
    			h3_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t4 = claim_space(div13_nodes);
    			div3 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div3).forEach(detach_dev);
    			t5 = claim_space(div13_nodes);
    			div4 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div4).forEach(detach_dev);
    			t6 = claim_space(div13_nodes);
    			div5 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div5).forEach(detach_dev);
    			t7 = claim_space(div13_nodes);
    			div6 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div6).forEach(detach_dev);
    			t8 = claim_space(div13_nodes);
    			div7 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div7).forEach(detach_dev);
    			t9 = claim_space(div13_nodes);
    			div8 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div8).forEach(detach_dev);
    			t10 = claim_space(div13_nodes);
    			div9 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div9).forEach(detach_dev);
    			t11 = claim_space(div13_nodes);
    			div10 = claim_element(div13_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h2 = claim_element(div10_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t12 = claim_text(h2_nodes, t12_value);
    			h2_nodes.forEach(detach_dev);
    			t13 = claim_space(div10_nodes);

    			img = claim_element(div10_nodes, "IMG", {
    				src: true,
    				alt: true,
    				name: true,
    				height: true,
    				class: true
    			});

    			t14 = claim_space(div10_nodes);
    			p0 = claim_element(div10_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t15 = claim_text(p0_nodes, t15_value);
    			p0_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			t16 = claim_space(div13_nodes);
    			div11 = claim_element(div13_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			p1 = claim_element(div11_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t17 = claim_text(p1_nodes, t17_value);
    			p1_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t18 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div12).forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			t19 = claim_space(div14_nodes);
    			div14_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-5m1ap2"));

    			add_location(button, file$b, 102, 5, 2923);

    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-5m1ap2"));

    			add_location(div0, file$b, 113, 4, 3336);
    			attr_dev(div1, "class", "spine1 svelte-5m1ap2");
    			add_location(div1, file$b, 112, 4, 3310);
    			attr_dev(h3, "class", "cover-title svelte-5m1ap2");
    			add_location(h3, file$b, 116, 5, 3545);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div2, file$b, 115, 4, 3433);

    			attr_dev(div3, "class", div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div3, file$b, 120, 4, 3622);

    			attr_dev(div4, "class", div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div4, file$b, 122, 4, 3718);

    			attr_dev(div5, "class", div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div5, file$b, 123, 4, 3806);

    			attr_dev(div6, "class", div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div6, file$b, 124, 4, 3894);

    			attr_dev(div7, "class", div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div7, file$b, 125, 4, 3982);

    			attr_dev(div8, "class", div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div8, file$b, 126, 4, 4070);

    			attr_dev(div9, "class", div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div9, file$b, 127, 4, 4158);
    			attr_dev(h2, "class", "title svelte-5m1ap2");
    			add_location(h2, file$b, 130, 5, 4363);
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[28].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[28].title);
    			attr_dev(img, "name", "picture");
    			attr_dev(img, "height", "50px");
    			attr_dev(img, "class", "picture svelte-5m1ap2");
    			add_location(img, file$b, 131, 5, 4408);
    			attr_dev(p0, "class", "category svelte-5m1ap2");
    			add_location(p0, file$b, 138, 5, 4547);

    			attr_dev(div10, "class", div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div10, file$b, 129, 4, 4252);
    			attr_dev(p1, "class", "description svelte-5m1ap2");
    			add_location(p1, file$b, 141, 6, 4726);

    			attr_dev(div11, "class", div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div11, file$b, 140, 5, 4608);

    			attr_dev(div12, "class", div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"));

    			add_location(div12, file$b, 143, 4, 4793);
    			attr_dev(div13, "tabindex", "0");

    			attr_dev(div13, "class", div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-5m1ap2"));

    			attr_dev(div13, "key", div13_key_value = /*project*/ ctx[28].id);
    			add_location(div13, file$b, 105, 3, 3083);
    			attr_dev(div14, "class", div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-5m1ap2"));
    			add_location(div14, file$b, 101, 2, 2850);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, button);
    			append_hydration_dev(button, t0);
    			append_hydration_dev(div14, t1);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div13, t2);
    			append_hydration_dev(div13, div2);
    			append_hydration_dev(div2, h3);
    			append_hydration_dev(h3, t3);
    			append_hydration_dev(div13, t4);
    			append_hydration_dev(div13, div3);
    			append_hydration_dev(div13, t5);
    			append_hydration_dev(div13, div4);
    			append_hydration_dev(div13, t6);
    			append_hydration_dev(div13, div5);
    			append_hydration_dev(div13, t7);
    			append_hydration_dev(div13, div6);
    			append_hydration_dev(div13, t8);
    			append_hydration_dev(div13, div7);
    			append_hydration_dev(div13, t9);
    			append_hydration_dev(div13, div8);
    			append_hydration_dev(div13, t10);
    			append_hydration_dev(div13, div9);
    			append_hydration_dev(div13, t11);
    			append_hydration_dev(div13, div10);
    			append_hydration_dev(div10, h2);
    			append_hydration_dev(h2, t12);
    			append_hydration_dev(div10, t13);
    			append_hydration_dev(div10, img);
    			append_hydration_dev(div10, t14);
    			append_hydration_dev(div10, p0);
    			append_hydration_dev(p0, t15);
    			append_hydration_dev(div13, t16);
    			append_hydration_dev(div13, div11);
    			append_hydration_dev(div11, p1);
    			append_hydration_dev(p1, t17);
    			append_hydration_dev(div13, t18);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div14, t19);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[15], false, false, false),
    					listen_dev(div2, "click", click_handler_1, false, false, false),
    					listen_dev(div10, "click", click_handler_2, false, false, false),
    					listen_dev(div11, "click", click_handler_3, false, false, false),
    					listen_dev(div13, "click", click_handler_4, false, false, false),
    					listen_dev(div13, "keyup", prevent_default(keyup_handler), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*$_*/ 512 && t0_value !== (t0_value = /*$_*/ ctx[9]("closeTheBook") + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && button_class_value !== (button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? "visible"
    			: "")) + " svelte-5m1ap2"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div0_class_value !== (div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'shelfMode'
    			: 'shake')) + " svelte-5m1ap2"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 32 && t3_value !== (t3_value = /*project*/ ctx[28].title + "")) set_data_dev(t3, t3_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div2_class_value !== (div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div3_class_value !== (div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div4_class_value !== (div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div4, "class", div4_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div5_class_value !== (div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div5, "class", div5_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div6_class_value !== (div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div6, "class", div6_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div7_class_value !== (div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div7, "class", div7_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div8_class_value !== (div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div8, "class", div8_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div9_class_value !== (div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div9, "class", div9_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 32 && t12_value !== (t12_value = /*project*/ ctx[28].title + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*$amountOfProjects*/ 32 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[28].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 32 && img_alt_value !== (img_alt_value = /*project*/ ctx[28].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 32 && t15_value !== (t15_value = /*project*/ ctx[28].category + "")) set_data_dev(t15, t15_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div10_class_value !== (div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div10, "class", div10_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 32 && t17_value !== (t17_value = /*project*/ ctx[28].description + "")) set_data_dev(t17, t17_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div11_class_value !== (div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div11, "class", div11_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 160 && div12_class_value !== (div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[28].id === /*$bookId*/ ctx[7]
    			? 'position'
    			: 'shelfMode')) + " svelte-5m1ap2"))) {
    				attr_dev(div12, "class", div12_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 48 && div13_class_value !== (div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4]
    			? 'wasClicked'
    			: '')) + " svelte-5m1ap2"))) {
    				attr_dev(div13, "class", div13_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 32 && div13_key_value !== (div13_key_value = /*project*/ ctx[28].id)) {
    				attr_dev(div13, "key", div13_key_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 48 && div14_class_value !== (div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[30] === /*wasClicked*/ ctx[4] ? "zindex" : "")) + " svelte-5m1ap2"))) {
    				attr_dev(div14, "class", div14_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(101:2) {#if project.category === \\\"Primärvård\\\"}",
    		ctx
    	});

    	return block;
    }

    // (100:2) {#each $amountOfProjects as project, i (project.id)}
    function create_each_block$2(key_2, ctx) {
    	let first;
    	let if_block_anchor;
    	let if_block = /*project*/ ctx[28].category === "Primärvård" && create_if_block$7(ctx);

    	const block = {
    		key: key_2,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			first = empty();
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*project*/ ctx[28].category === "Primärvård") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$7(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(100:2) {#each $amountOfProjects as project, i (project.id)}",
    		ctx
    	});

    	return block;
    }

    // (95:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>
    function create_default_slot$2(ctx) {
    	let section;
    	let article;
    	let img;
    	let img_src_value;
    	let img_class_value;
    	let t;
    	let main;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let main_class_value;
    	let section_class_value;
    	let each_value = /*$amountOfProjects*/ ctx[5];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*project*/ ctx[28].id;
    	validate_each_keys(ctx, each_value, get_each_context$2, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			article = element("article");
    			img = element("img");
    			t = space();
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section_nodes = children(section);
    			article = claim_element(section_nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			img = claim_element(article_nodes, "IMG", { src: true, alt: true, class: true });
    			t = claim_space(article_nodes);
    			main = claim_element(article_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(main_nodes);
    			}

    			main_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*$tree*/ ctx[8])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");

    			attr_dev(img, "class", img_class_value = "" + (null_to_empty("tree " + (/*$tree*/ ctx[8] === '../images/alive-tree-01.png'
    			? 'alive'
    			: 'finished')) + " svelte-5m1ap2"));

    			add_location(img, file$b, 97, 2, 2565);

    			attr_dev(main, "class", main_class_value = "" + (null_to_empty(/*$tree*/ ctx[8] === '../images/alive-tree-01.png'
    			? 'dusted'
    			: '') + " svelte-5m1ap2"));

    			add_location(main, file$b, 98, 2, 2677);
    			attr_dev(article, "class", "svelte-5m1ap2");
    			add_location(article, file$b, 96, 1, 2531);
    			attr_dev(section, "id", "fourth-category");

    			attr_dev(section, "class", section_class_value = "" + (null_to_empty("fourth-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[6]
    			? "overlay"
    			: "")) + " svelte-5m1ap2"));

    			add_location(section, file$b, 95, 1, 2427);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, article);
    			append_hydration_dev(article, img);
    			append_hydration_dev(article, t);
    			append_hydration_dev(article, main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			/*article_binding*/ ctx[21](article);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$tree*/ 256 && !src_url_equal(img.src, img_src_value = /*$tree*/ ctx[8])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*$tree*/ 256 && img_class_value !== (img_class_value = "" + (null_to_empty("tree " + (/*$tree*/ ctx[8] === '../images/alive-tree-01.png'
    			? 'alive'
    			: 'finished')) + " svelte-5m1ap2"))) {
    				attr_dev(img, "class", img_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked, clickBookSpine, handleKeyDown, $bookId, openBook, $_*/ 7856) {
    				each_value = /*$amountOfProjects*/ ctx[5];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, main, destroy_block, create_each_block$2, null, get_each_context$2);
    			}

    			if (dirty[0] & /*$tree*/ 256 && main_class_value !== (main_class_value = "" + (null_to_empty(/*$tree*/ ctx[8] === '../images/alive-tree-01.png'
    			? 'dusted'
    			: '') + " svelte-5m1ap2"))) {
    				attr_dev(main, "class", main_class_value);
    			}

    			if (dirty[0] & /*$bookId, $projectId*/ 192 && section_class_value !== (section_class_value = "" + (null_to_empty("fourth-category " + (/*$bookId*/ ctx[7] === /*$projectId*/ ctx[6]
    			? "overlay"
    			: "")) + " svelte-5m1ap2"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			/*article_binding*/ ctx[21](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(95:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let update;
    	let t;
    	let intersectionobserver;
    	let updating_intersecting;
    	let current;
    	let update_props = {};
    	update = new Update({ props: update_props, $$inline: true });
    	/*update_binding*/ ctx[14](update);

    	function intersectionobserver_intersecting_binding(value) {
    		/*intersectionobserver_intersecting_binding*/ ctx[22](value);
    	}

    	let intersectionobserver_props = {
    		element: /*element*/ ctx[2],
    		rootMargin: /*rootMargin*/ ctx[3],
    		$$slots: { default: [create_default_slot$2] },
    		$$scope: { ctx }
    	};

    	if (/*intersecting*/ ctx[0] !== void 0) {
    		intersectionobserver_props.intersecting = /*intersecting*/ ctx[0];
    	}

    	intersectionobserver = new IntersectionObserver$1({
    			props: intersectionobserver_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind$2(intersectionobserver, 'intersecting', intersectionobserver_intersecting_binding));

    	const block = {
    		c: function create() {
    			create_component(update.$$.fragment);
    			t = space();
    			create_component(intersectionobserver.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(update.$$.fragment, nodes);
    			t = claim_space(nodes);
    			claim_component(intersectionobserver.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(update, target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(intersectionobserver, target, anchor);
    			current = true;
    		},
    		p: function update$1(ctx, dirty) {
    			const update_changes = {};
    			update.$set(update_changes);
    			const intersectionobserver_changes = {};
    			if (dirty[0] & /*element*/ 4) intersectionobserver_changes.element = /*element*/ ctx[2];
    			if (dirty[0] & /*rootMargin*/ 8) intersectionobserver_changes.rootMargin = /*rootMargin*/ ctx[3];

    			if (dirty[0] & /*$bookId, $projectId, element, $tree, $amountOfProjects, wasClicked, $_*/ 1012 | dirty[1] & /*$$scope*/ 1) {
    				intersectionobserver_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_intersecting && dirty[0] & /*intersecting*/ 1) {
    				updating_intersecting = true;
    				intersectionobserver_changes.intersecting = /*intersecting*/ ctx[0];
    				add_flush_callback(() => updating_intersecting = false);
    			}

    			intersectionobserver.$set(intersectionobserver_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(update.$$.fragment, local);
    			transition_in(intersectionobserver.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(update.$$.fragment, local);
    			transition_out(intersectionobserver.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*update_binding*/ ctx[14](null);
    			destroy_component(update, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(intersectionobserver, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const PROJECTS_ENDPOINT$2 = "http://localhost:4000/api/projects";

    function instance$b($$self, $$props, $$invalidate) {
    	let $checkPoint;
    	let $amountOfProjects;
    	let $projectId;
    	let $bookId;
    	let $primaryBooksRead;
    	let $tree;
    	let $_;
    	validate_store(checkPoint, 'checkPoint');
    	component_subscribe($$self, checkPoint, $$value => $$invalidate(24, $checkPoint = $$value));
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(5, $amountOfProjects = $$value));
    	validate_store(projectId, 'projectId');
    	component_subscribe($$self, projectId, $$value => $$invalidate(6, $projectId = $$value));
    	validate_store(bookId, 'bookId');
    	component_subscribe($$self, bookId, $$value => $$invalidate(7, $bookId = $$value));
    	validate_store(primaryBooksRead, 'primaryBooksRead');
    	component_subscribe($$self, primaryBooksRead, $$value => $$invalidate(25, $primaryBooksRead = $$value));
    	validate_store(tree, 'tree');
    	component_subscribe($$self, tree, $$value => $$invalidate(8, $tree = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(9, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('PrimuC3uA4rvuC3uA5rd', slots, []);
    	let updateBookComponent;
    	let isInShelf = true;
    	let element;
    	let intersecting;
    	let rootMargin = "-250px";
    	const bookCopy = { ...$amountOfProjects, read: true };

    	// tree = '../images/dead-tree.png'
    	// fixes issue with intersection observer on mobile devices
    	if (window.innerHeight < 768) {
    		rootMargin = "-150px";
    	}

    	let { key } = $$props;
    	let wasClicked = -1;

    	onMount(async () => {
    		try {
    			const response = await axios.get(PROJECTS_ENDPOINT$2);
    			set_store_value(amountOfProjects, $amountOfProjects = response.data, $amountOfProjects);
    			const primaryStorage = localStorage.getItem('primary');

    			if (primaryStorage !== null) {
    				const storage = JSON.parse(primaryStorage);
    				set_store_value(primaryBooksRead, $primaryBooksRead = storage, $primaryBooksRead);
    				console.log($primaryBooksRead);
    			}
    		} catch(error) {
    			console.log(error);
    		}
    	});

    	const clickBookSpine = (book, id) => {
    		if (book.id !== id) {
    			set_store_value(bookId, $bookId = '', $bookId);
    			isInShelf = isInShelf;
    		} else if (book.id === id) {
    			set_store_value(bookId, $bookId = id, $bookId);
    			isInShelf = !isInShelf;
    			console.log($bookId, id);
    		}
    	};

    	// checks if books in this category have been read
    	const checkReadBooks = () => {
    		const newArray = $amountOfProjects.filter(book => book.category === 'Primärvård');
    		let array = [...newArray];
    		let readArray = array.map(r => r.read);

    		if (readArray.every(val => val === true)) {
    			set_store_value(primaryBooksRead, $primaryBooksRead = true, $primaryBooksRead);
    			localStorage.setItem('primary', $primaryBooksRead);
    		}
    	};

    	const openBook = i => {
    		$$invalidate(4, wasClicked = wasClicked === i ? -1 : i);

    		$amountOfProjects.forEach(() => {
    			if (i === wasClicked) {
    				set_store_value(projectId, $projectId = $bookId, $projectId);
    			}

    			if (wasClicked === -1) {
    				set_store_value(projectId, $projectId = 0, $projectId);
    				set_store_value(amountOfProjects, $amountOfProjects[i].read = true, $amountOfProjects);
    				updateBookComponent.updateBook(bookCopy);
    				checkReadBooks();
    			}
    		});
    	};

    	const handleKeyDown = i => {
    		if (key == 'Enter') {
    			openBook(i);
    		}
    	};

    	$$self.$$.on_mount.push(function () {
    		if (key === undefined && !('key' in $$props || $$self.$$.bound[$$self.$$.props['key']])) {
    			console_1$8.warn("<PrimuC3uA4rvuC3uA5rd> was created without expected prop 'key'");
    		}
    	});

    	const writable_props = ['key'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$8.warn(`<PrimuC3uA4rvuC3uA5rd> was created with unknown prop '${key}'`);
    	});

    	function update_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			updateBookComponent = $$value;
    			$$invalidate(1, updateBookComponent);
    		});
    	}

    	const click_handler = () => set_store_value(bookId, $bookId = set_store_value(bookId, $bookId = '', $bookId), $bookId);
    	const click_handler_1 = i => openBook(i);
    	const click_handler_2 = i => openBook(i);
    	const click_handler_3 = i => openBook(i);
    	const click_handler_4 = project => clickBookSpine(project, project.id);
    	const keyup_handler = i => handleKeyDown(i);

    	function article_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(2, element);
    		});
    	}

    	function intersectionobserver_intersecting_binding(value) {
    		intersecting = value;
    		$$invalidate(0, intersecting);
    	}

    	$$self.$$set = $$props => {
    		if ('key' in $$props) $$invalidate(13, key = $$props.key);
    	};

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		axios,
    		amountOfProjects,
    		checkPoint,
    		bookId,
    		projectId,
    		primaryBooksRead,
    		tree,
    		InterSectionObserver: IntersectionObserver$1,
    		Update,
    		updateBookComponent,
    		isInShelf,
    		element,
    		intersecting,
    		rootMargin,
    		bookCopy,
    		key,
    		wasClicked,
    		PROJECTS_ENDPOINT: PROJECTS_ENDPOINT$2,
    		clickBookSpine,
    		checkReadBooks,
    		openBook,
    		handleKeyDown,
    		$checkPoint,
    		$amountOfProjects,
    		$projectId,
    		$bookId,
    		$primaryBooksRead,
    		$tree,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('updateBookComponent' in $$props) $$invalidate(1, updateBookComponent = $$props.updateBookComponent);
    		if ('isInShelf' in $$props) isInShelf = $$props.isInShelf;
    		if ('element' in $$props) $$invalidate(2, element = $$props.element);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('rootMargin' in $$props) $$invalidate(3, rootMargin = $$props.rootMargin);
    		if ('key' in $$props) $$invalidate(13, key = $$props.key);
    		if ('wasClicked' in $$props) $$invalidate(4, wasClicked = $$props.wasClicked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*intersecting*/ 1) {
    			intersecting
    			? set_store_value(checkPoint, $checkPoint = set_store_value(checkPoint, $checkPoint = 4, $checkPoint), $checkPoint)
    			: '';
    		}
    	};

    	return [
    		intersecting,
    		updateBookComponent,
    		element,
    		rootMargin,
    		wasClicked,
    		$amountOfProjects,
    		$projectId,
    		$bookId,
    		$tree,
    		$_,
    		clickBookSpine,
    		openBook,
    		handleKeyDown,
    		key,
    		update_binding,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		keyup_handler,
    		article_binding,
    		intersectionobserver_intersecting_binding
    	];
    }

    class PrimuC3uA4rvuC3uA5rd extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { key: 13 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PrimuC3uA4rvuC3uA5rd",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get key() {
    		throw new Error("<PrimuC3uA4rvuC3uA5rd>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<PrimuC3uA4rvuC3uA5rd>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\categories\Informativt.svelte generated by Svelte v3.53.1 */

    const { console: console_1$7 } = globals;
    const file$a = "src\\components\\categories\\Informativt.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	child_ctx[32] = i;
    	return child_ctx;
    }

    // (112:2) {#if project.category === "Informativt"}
    function create_if_block$6(ctx) {
    	let div14;
    	let button;
    	let t0_value = /*$_*/ ctx[12]("closeTheBook") + "";
    	let t0;
    	let button_class_value;
    	let t1;
    	let div13;
    	let div1;
    	let div0;
    	let div0_class_value;
    	let t2;
    	let div2;
    	let h3;
    	let t3_value = /*project*/ ctx[30].title + "";
    	let t3;
    	let div2_class_value;
    	let t4;
    	let div3;
    	let div3_class_value;
    	let t5;
    	let div4;
    	let div4_class_value;
    	let t6;
    	let div5;
    	let div5_class_value;
    	let t7;
    	let div6;
    	let div6_class_value;
    	let t8;
    	let div7;
    	let div7_class_value;
    	let t9;
    	let div8;
    	let div8_class_value;
    	let t10;
    	let div9;
    	let div9_class_value;
    	let t11;
    	let div10;
    	let h2;
    	let t12_value = /*project*/ ctx[30].title + "";
    	let t12;
    	let t13;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t14;
    	let p0;
    	let t15_value = /*project*/ ctx[30].category + "";
    	let t15;
    	let div10_class_value;
    	let t16;
    	let div11;
    	let p1;
    	let t17_value = /*project*/ ctx[30].description + "";
    	let t17;
    	let div11_class_value;
    	let t18;
    	let div12;
    	let div12_class_value;
    	let div13_class_value;
    	let div13_key_value;
    	let t19;
    	let div14_class_value;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[19](/*i*/ ctx[32]);
    	}

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[20](/*i*/ ctx[32]);
    	}

    	function click_handler_3() {
    		return /*click_handler_3*/ ctx[21](/*i*/ ctx[32]);
    	}

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[22](/*project*/ ctx[30]);
    	}

    	function keyup_handler() {
    		return /*keyup_handler*/ ctx[23](/*i*/ ctx[32]);
    	}

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			button = element("button");
    			t0 = text(t0_value);
    			t1 = space();
    			div13 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			div2 = element("div");
    			h3 = element("h3");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			t5 = space();
    			div4 = element("div");
    			t6 = space();
    			div5 = element("div");
    			t7 = space();
    			div6 = element("div");
    			t8 = space();
    			div7 = element("div");
    			t9 = space();
    			div8 = element("div");
    			t10 = space();
    			div9 = element("div");
    			t11 = space();
    			div10 = element("div");
    			h2 = element("h2");
    			t12 = text(t12_value);
    			t13 = space();
    			img = element("img");
    			t14 = space();
    			p0 = element("p");
    			t15 = text(t15_value);
    			t16 = space();
    			div11 = element("div");
    			p1 = element("p");
    			t17 = text(t17_value);
    			t18 = space();
    			div12 = element("div");
    			t19 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			button = claim_element(div14_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t0 = claim_text(button_nodes, t0_value);
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(div14_nodes);
    			div13 = claim_element(div14_nodes, "DIV", { tabindex: true, class: true, key: true });
    			var div13_nodes = children(div13);
    			div1 = claim_element(div13_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div13_nodes);
    			div2 = claim_element(div13_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			h3 = claim_element(div2_nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t3 = claim_text(h3_nodes, t3_value);
    			h3_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t4 = claim_space(div13_nodes);
    			div3 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div3).forEach(detach_dev);
    			t5 = claim_space(div13_nodes);
    			div4 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div4).forEach(detach_dev);
    			t6 = claim_space(div13_nodes);
    			div5 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div5).forEach(detach_dev);
    			t7 = claim_space(div13_nodes);
    			div6 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div6).forEach(detach_dev);
    			t8 = claim_space(div13_nodes);
    			div7 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div7).forEach(detach_dev);
    			t9 = claim_space(div13_nodes);
    			div8 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div8).forEach(detach_dev);
    			t10 = claim_space(div13_nodes);
    			div9 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div9).forEach(detach_dev);
    			t11 = claim_space(div13_nodes);
    			div10 = claim_element(div13_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			h2 = claim_element(div10_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t12 = claim_text(h2_nodes, t12_value);
    			h2_nodes.forEach(detach_dev);
    			t13 = claim_space(div10_nodes);

    			img = claim_element(div10_nodes, "IMG", {
    				src: true,
    				alt: true,
    				name: true,
    				height: true,
    				class: true
    			});

    			t14 = claim_space(div10_nodes);
    			p0 = claim_element(div10_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t15 = claim_text(p0_nodes, t15_value);
    			p0_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			t16 = claim_space(div13_nodes);
    			div11 = claim_element(div13_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			p1 = claim_element(div11_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t17 = claim_text(p1_nodes, t17_value);
    			p1_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			t18 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			children(div12).forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			t19 = claim_space(div14_nodes);
    			div14_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? "visible"
    			: "")) + " svelte-q27qdj"));

    			add_location(button, file$a, 113, 5, 3116);

    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'shelfMode'
    			: 'shake')) + " svelte-q27qdj"));

    			add_location(div0, file$a, 124, 4, 3529);
    			attr_dev(div1, "class", "spine1 svelte-q27qdj");
    			add_location(div1, file$a, 123, 4, 3503);
    			attr_dev(h3, "class", "cover-title svelte-q27qdj");
    			add_location(h3, file$a, 127, 5, 3738);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div2, file$a, 126, 4, 3626);

    			attr_dev(div3, "class", div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div3, file$a, 131, 4, 3815);

    			attr_dev(div4, "class", div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div4, file$a, 133, 4, 3911);

    			attr_dev(div5, "class", div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div5, file$a, 134, 4, 3999);

    			attr_dev(div6, "class", div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div6, file$a, 135, 4, 4087);

    			attr_dev(div7, "class", div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div7, file$a, 136, 4, 4175);

    			attr_dev(div8, "class", div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div8, file$a, 137, 4, 4263);

    			attr_dev(div9, "class", div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div9, file$a, 138, 4, 4351);
    			attr_dev(h2, "class", "title svelte-q27qdj");
    			add_location(h2, file$a, 141, 5, 4556);
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[30].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[30].title);
    			attr_dev(img, "name", "picture");
    			attr_dev(img, "height", "50px");
    			attr_dev(img, "class", "picture svelte-q27qdj");
    			add_location(img, file$a, 142, 5, 4601);
    			attr_dev(p0, "class", "category svelte-q27qdj");
    			add_location(p0, file$a, 149, 5, 4740);

    			attr_dev(div10, "class", div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div10, file$a, 140, 4, 4445);
    			attr_dev(p1, "class", "description svelte-q27qdj");
    			add_location(p1, file$a, 152, 6, 4919);

    			attr_dev(div11, "class", div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div11, file$a, 151, 5, 4801);

    			attr_dev(div12, "class", div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"));

    			add_location(div12, file$a, 154, 4, 4986);
    			attr_dev(div13, "tabindex", "0");

    			attr_dev(div13, "class", div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[32] === /*wasClicked*/ ctx[7]
    			? 'wasClicked'
    			: '')) + " svelte-q27qdj"));

    			attr_dev(div13, "key", div13_key_value = /*project*/ ctx[30].id);
    			add_location(div13, file$a, 116, 3, 3276);
    			attr_dev(div14, "class", div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[32] === /*wasClicked*/ ctx[7] ? "zindex" : "")) + " svelte-q27qdj"));
    			add_location(div14, file$a, 112, 2, 3043);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, button);
    			append_hydration_dev(button, t0);
    			append_hydration_dev(div14, t1);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div13, t2);
    			append_hydration_dev(div13, div2);
    			append_hydration_dev(div2, h3);
    			append_hydration_dev(h3, t3);
    			append_hydration_dev(div13, t4);
    			append_hydration_dev(div13, div3);
    			append_hydration_dev(div13, t5);
    			append_hydration_dev(div13, div4);
    			append_hydration_dev(div13, t6);
    			append_hydration_dev(div13, div5);
    			append_hydration_dev(div13, t7);
    			append_hydration_dev(div13, div6);
    			append_hydration_dev(div13, t8);
    			append_hydration_dev(div13, div7);
    			append_hydration_dev(div13, t9);
    			append_hydration_dev(div13, div8);
    			append_hydration_dev(div13, t10);
    			append_hydration_dev(div13, div9);
    			append_hydration_dev(div13, t11);
    			append_hydration_dev(div13, div10);
    			append_hydration_dev(div10, h2);
    			append_hydration_dev(h2, t12);
    			append_hydration_dev(div10, t13);
    			append_hydration_dev(div10, img);
    			append_hydration_dev(div10, t14);
    			append_hydration_dev(div10, p0);
    			append_hydration_dev(p0, t15);
    			append_hydration_dev(div13, t16);
    			append_hydration_dev(div13, div11);
    			append_hydration_dev(div11, p1);
    			append_hydration_dev(p1, t17);
    			append_hydration_dev(div13, t18);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div14, t19);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*click_handler*/ ctx[18], false, false, false),
    					listen_dev(div2, "click", click_handler_1, false, false, false),
    					listen_dev(div10, "click", click_handler_2, false, false, false),
    					listen_dev(div11, "click", click_handler_3, false, false, false),
    					listen_dev(div13, "click", click_handler_4, false, false, false),
    					listen_dev(div13, "keyup", prevent_default(keyup_handler), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*$_*/ 4096 && t0_value !== (t0_value = /*$_*/ ctx[12]("closeTheBook") + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && button_class_value !== (button_class_value = "" + (null_to_empty("backBtn " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? "visible"
    			: "")) + " svelte-q27qdj"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div0_class_value !== (div0_class_value = "" + (null_to_empty("spine " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'shelfMode'
    			: 'shake')) + " svelte-q27qdj"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 256 && t3_value !== (t3_value = /*project*/ ctx[30].title + "")) set_data_dev(t3, t3_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div2_class_value !== (div2_class_value = "" + (null_to_empty("cover " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div3_class_value !== (div3_class_value = "" + (null_to_empty("coverInside " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div4_class_value !== (div4_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div4, "class", div4_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div5_class_value !== (div5_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div5, "class", div5_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div6_class_value !== (div6_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div6, "class", div6_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div7_class_value !== (div7_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div7, "class", div7_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div8_class_value !== (div8_class_value = "" + (null_to_empty("pages " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div8, "class", div8_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div9_class_value !== (div9_class_value = "" + (null_to_empty("coverPage " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div9, "class", div9_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 256 && t12_value !== (t12_value = /*project*/ ctx[30].title + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*$amountOfProjects*/ 256 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[30].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 256 && img_alt_value !== (img_alt_value = /*project*/ ctx[30].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 256 && t15_value !== (t15_value = /*project*/ ctx[30].category + "")) set_data_dev(t15, t15_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div10_class_value !== (div10_class_value = "" + (null_to_empty("page " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div10, "class", div10_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 256 && t17_value !== (t17_value = /*project*/ ctx[30].description + "")) set_data_dev(t17, t17_value);

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div11_class_value !== (div11_class_value = "" + (null_to_empty("last-page " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div11, "class", div11_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, $bookId*/ 1280 && div12_class_value !== (div12_class_value = "" + (null_to_empty("back-cover " + (/*project*/ ctx[30].id === /*$bookId*/ ctx[10]
    			? 'position'
    			: 'shelfMode')) + " svelte-q27qdj"))) {
    				attr_dev(div12, "class", div12_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 384 && div13_class_value !== (div13_class_value = "" + (null_to_empty("book " + (/*i*/ ctx[32] === /*wasClicked*/ ctx[7]
    			? 'wasClicked'
    			: '')) + " svelte-q27qdj"))) {
    				attr_dev(div13, "class", div13_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects*/ 256 && div13_key_value !== (div13_key_value = /*project*/ ctx[30].id)) {
    				attr_dev(div13, "key", div13_key_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked*/ 384 && div14_class_value !== (div14_class_value = "" + (null_to_empty("book-spacing " + (/*i*/ ctx[32] === /*wasClicked*/ ctx[7] ? "zindex" : "")) + " svelte-q27qdj"))) {
    				attr_dev(div14, "class", div14_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(112:2) {#if project.category === \\\"Informativt\\\"}",
    		ctx
    	});

    	return block;
    }

    // (111:2) {#each $amountOfProjects as project, i (project.id)}
    function create_each_block$1(key_2, ctx) {
    	let first;
    	let if_block_anchor;
    	let if_block = /*project*/ ctx[30].category === "Informativt" && create_if_block$6(ctx);

    	const block = {
    		key: key_2,
    		first: null,
    		c: function create() {
    			first = empty();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			first = empty();
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, first, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*project*/ ctx[30].category === "Informativt") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(111:2) {#each $amountOfProjects as project, i (project.id)}",
    		ctx
    	});

    	return block;
    }

    // (106:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>
    function create_default_slot$1(ctx) {
    	let section;
    	let article;
    	let img;
    	let img_src_value;
    	let img_class_value;
    	let t;
    	let main;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let main_class_value;
    	let section_class_value;
    	let each_value = /*$amountOfProjects*/ ctx[8];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*project*/ ctx[30].id;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			article = element("article");
    			img = element("img");
    			t = space();
    			main = element("main");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { id: true, class: true });
    			var section_nodes = children(section);
    			article = claim_element(section_nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);

    			img = claim_element(article_nodes, "IMG", {
    				src: true,
    				height: true,
    				alt: true,
    				class: true
    			});

    			t = claim_space(article_nodes);
    			main = claim_element(article_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(main_nodes);
    			}

    			main_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = "../images/icons/wand.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "height", "100px");
    			attr_dev(img, "alt", "wand");

    			attr_dev(img, "class", img_class_value = "" + (null_to_empty("wand " + (/*$informativeBooksRead*/ ctx[11]
    			? ''
    			: /*showWand*/ ctx[6])) + " svelte-q27qdj"));

    			add_location(img, file$a, 108, 2, 2762);
    			attr_dev(main, "class", main_class_value = "" + (null_to_empty(/*$light*/ ctx[1] === true ? 'showBooks' : '') + " svelte-q27qdj"));
    			add_location(main, file$a, 109, 2, 2890);
    			attr_dev(article, "class", "svelte-q27qdj");
    			add_location(article, file$a, 107, 1, 2728);
    			attr_dev(section, "id", "fifth-category");

    			attr_dev(section, "class", section_class_value = "" + (null_to_empty("fifth-category " + (/*$bookId*/ ctx[10] === /*$projectId*/ ctx[9]
    			? "overlay"
    			: /*darkToLight*/ ctx[5])) + " svelte-q27qdj"));

    			add_location(section, file$a, 106, 0, 2616);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, article);
    			append_hydration_dev(article, img);
    			append_hydration_dev(article, t);
    			append_hydration_dev(article, main);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(main, null);
    			}

    			/*article_binding*/ ctx[24](article);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$informativeBooksRead, showWand*/ 2112 && img_class_value !== (img_class_value = "" + (null_to_empty("wand " + (/*$informativeBooksRead*/ ctx[11]
    			? ''
    			: /*showWand*/ ctx[6])) + " svelte-q27qdj"))) {
    				attr_dev(img, "class", img_class_value);
    			}

    			if (dirty[0] & /*$amountOfProjects, wasClicked, clickBookSpine, handleKeyDown, $bookId, openBook, $_*/ 62848) {
    				each_value = /*$amountOfProjects*/ ctx[8];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, main, destroy_block, create_each_block$1, null, get_each_context$1);
    			}

    			if (dirty[0] & /*$light*/ 2 && main_class_value !== (main_class_value = "" + (null_to_empty(/*$light*/ ctx[1] === true ? 'showBooks' : '') + " svelte-q27qdj"))) {
    				attr_dev(main, "class", main_class_value);
    			}

    			if (dirty[0] & /*$bookId, $projectId, darkToLight*/ 1568 && section_class_value !== (section_class_value = "" + (null_to_empty("fifth-category " + (/*$bookId*/ ctx[10] === /*$projectId*/ ctx[9]
    			? "overlay"
    			: /*darkToLight*/ ctx[5])) + " svelte-q27qdj"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			/*article_binding*/ ctx[24](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(106:0) <InterSectionObserver {element} bind:intersecting {rootMargin}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let update;
    	let t;
    	let intersectionobserver;
    	let updating_intersecting;
    	let current;
    	let update_props = {};
    	update = new Update({ props: update_props, $$inline: true });
    	/*update_binding*/ ctx[17](update);

    	function intersectionobserver_intersecting_binding(value) {
    		/*intersectionobserver_intersecting_binding*/ ctx[25](value);
    	}

    	let intersectionobserver_props = {
    		element: /*element*/ ctx[3],
    		rootMargin: /*rootMargin*/ ctx[4],
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	};

    	if (/*intersecting*/ ctx[0] !== void 0) {
    		intersectionobserver_props.intersecting = /*intersecting*/ ctx[0];
    	}

    	intersectionobserver = new IntersectionObserver$1({
    			props: intersectionobserver_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind$2(intersectionobserver, 'intersecting', intersectionobserver_intersecting_binding));

    	const block = {
    		c: function create() {
    			create_component(update.$$.fragment);
    			t = space();
    			create_component(intersectionobserver.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(update.$$.fragment, nodes);
    			t = claim_space(nodes);
    			claim_component(intersectionobserver.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(update, target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			mount_component(intersectionobserver, target, anchor);
    			current = true;
    		},
    		p: function update$1(ctx, dirty) {
    			const update_changes = {};
    			update.$set(update_changes);
    			const intersectionobserver_changes = {};
    			if (dirty[0] & /*element*/ 8) intersectionobserver_changes.element = /*element*/ ctx[3];
    			if (dirty[0] & /*rootMargin*/ 16) intersectionobserver_changes.rootMargin = /*rootMargin*/ ctx[4];

    			if (dirty[0] & /*$bookId, $projectId, darkToLight, element, $light, $amountOfProjects, wasClicked, $_, $informativeBooksRead, showWand*/ 8170 | dirty[1] & /*$$scope*/ 4) {
    				intersectionobserver_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_intersecting && dirty[0] & /*intersecting*/ 1) {
    				updating_intersecting = true;
    				intersectionobserver_changes.intersecting = /*intersecting*/ ctx[0];
    				add_flush_callback(() => updating_intersecting = false);
    			}

    			intersectionobserver.$set(intersectionobserver_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(update.$$.fragment, local);
    			transition_in(intersectionobserver.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(update.$$.fragment, local);
    			transition_out(intersectionobserver.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			/*update_binding*/ ctx[17](null);
    			destroy_component(update, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(intersectionobserver, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const PROJECTS_ENDPOINT$1 = "http://localhost:4000/api/projects";

    function instance$a($$self, $$props, $$invalidate) {
    	let $checkPoint;
    	let $light;
    	let $amountOfProjects;
    	let $projectId;
    	let $bookId;
    	let $informativeBooksRead;
    	let $_;
    	validate_store(checkPoint, 'checkPoint');
    	component_subscribe($$self, checkPoint, $$value => $$invalidate(27, $checkPoint = $$value));
    	validate_store(light, 'light');
    	component_subscribe($$self, light, $$value => $$invalidate(1, $light = $$value));
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(8, $amountOfProjects = $$value));
    	validate_store(projectId, 'projectId');
    	component_subscribe($$self, projectId, $$value => $$invalidate(9, $projectId = $$value));
    	validate_store(bookId, 'bookId');
    	component_subscribe($$self, bookId, $$value => $$invalidate(10, $bookId = $$value));
    	validate_store(informativeBooksRead, 'informativeBooksRead');
    	component_subscribe($$self, informativeBooksRead, $$value => $$invalidate(11, $informativeBooksRead = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(12, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Informativt', slots, []);
    	let updateBookComponent;
    	let isInShelf = true;

    	// let bookId = ""
    	let element;

    	let intersecting;
    	let rootMargin = "-250px";
    	let darkToLight = 'dark-overlay';
    	let showWand = '';
    	const bookCopy = { ...$amountOfProjects, read: true };

    	// fixes issue with intersection observer on mobile devices
    	if (window.innerHeight < 768) {
    		rootMargin = "-150px";
    	}

    	let { key } = $$props;
    	let wasClicked = -1;

    	onMount(async () => {
    		try {
    			const response = await axios.get(PROJECTS_ENDPOINT$1);
    			set_store_value(amountOfProjects, $amountOfProjects = response.data, $amountOfProjects);
    			const infoStorage = localStorage.getItem('info');

    			if (infoStorage !== null) {
    				const storage = JSON.parse(infoStorage);
    				set_store_value(informativeBooksRead, $informativeBooksRead = storage, $informativeBooksRead);
    				console.log($informativeBooksRead);
    			}
    		} catch(error) {
    			console.log(error);
    		}
    	});

    	const clickBookSpine = (book, id) => {
    		if (book.id !== id) {
    			set_store_value(bookId, $bookId = '', $bookId);
    			isInShelf = isInShelf;
    		} else if (book.id === id) {
    			set_store_value(bookId, $bookId = id, $bookId);
    			isInShelf = !isInShelf;
    			console.log($bookId, id);
    		}
    	};

    	// checks if books in this category have been read
    	const checkReadBooks = () => {
    		const newArray = $amountOfProjects.filter(book => book.category === 'Informativt');
    		let array = [...newArray];
    		let readArray = array.map(r => r.read);

    		if (readArray.every(val => val === true)) {
    			set_store_value(informativeBooksRead, $informativeBooksRead = true, $informativeBooksRead);
    			localStorage.setItem('info', $informativeBooksRead);
    		}
    	};

    	// $: if($informativeBooksRead){
    	// 	$gotWand = true
    	// }
    	const openBook = i => {
    		$$invalidate(7, wasClicked = wasClicked === i ? -1 : i);

    		$amountOfProjects.forEach(() => {
    			if (i === wasClicked) {
    				set_store_value(projectId, $projectId = $bookId, $projectId);
    			}

    			if (wasClicked === -1) {
    				set_store_value(projectId, $projectId = 0, $projectId);
    				set_store_value(amountOfProjects, $amountOfProjects[i].read = true, $amountOfProjects);
    				updateBookComponent.updateBook(bookCopy);
    				checkReadBooks();
    			}
    		});
    	};

    	const handleKeyDown = i => {
    		if (key == 'Enter') {
    			openBook(i);
    		}
    	};

    	$$self.$$.on_mount.push(function () {
    		if (key === undefined && !('key' in $$props || $$self.$$.bound[$$self.$$.props['key']])) {
    			console_1$7.warn("<Informativt> was created without expected prop 'key'");
    		}
    	});

    	const writable_props = ['key'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$7.warn(`<Informativt> was created with unknown prop '${key}'`);
    	});

    	function update_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			updateBookComponent = $$value;
    			$$invalidate(2, updateBookComponent);
    		});
    	}

    	const click_handler = () => set_store_value(bookId, $bookId = set_store_value(bookId, $bookId = '', $bookId), $bookId);
    	const click_handler_1 = i => openBook(i);
    	const click_handler_2 = i => openBook(i);
    	const click_handler_3 = i => openBook(i);
    	const click_handler_4 = project => clickBookSpine(project, project.id);
    	const keyup_handler = i => handleKeyDown(i);

    	function article_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			element = $$value;
    			$$invalidate(3, element);
    		});
    	}

    	function intersectionobserver_intersecting_binding(value) {
    		intersecting = value;
    		$$invalidate(0, intersecting);
    	}

    	$$self.$$set = $$props => {
    		if ('key' in $$props) $$invalidate(16, key = $$props.key);
    	};

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		axios,
    		amountOfProjects,
    		checkPoint,
    		bookId,
    		projectId,
    		informativeBooksRead,
    		light,
    		gotWand,
    		InterSectionObserver: IntersectionObserver$1,
    		Update,
    		updateBookComponent,
    		isInShelf,
    		element,
    		intersecting,
    		rootMargin,
    		darkToLight,
    		showWand,
    		bookCopy,
    		key,
    		wasClicked,
    		PROJECTS_ENDPOINT: PROJECTS_ENDPOINT$1,
    		clickBookSpine,
    		checkReadBooks,
    		openBook,
    		handleKeyDown,
    		$checkPoint,
    		$light,
    		$amountOfProjects,
    		$projectId,
    		$bookId,
    		$informativeBooksRead,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('updateBookComponent' in $$props) $$invalidate(2, updateBookComponent = $$props.updateBookComponent);
    		if ('isInShelf' in $$props) isInShelf = $$props.isInShelf;
    		if ('element' in $$props) $$invalidate(3, element = $$props.element);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('rootMargin' in $$props) $$invalidate(4, rootMargin = $$props.rootMargin);
    		if ('darkToLight' in $$props) $$invalidate(5, darkToLight = $$props.darkToLight);
    		if ('showWand' in $$props) $$invalidate(6, showWand = $$props.showWand);
    		if ('key' in $$props) $$invalidate(16, key = $$props.key);
    		if ('wasClicked' in $$props) $$invalidate(7, wasClicked = $$props.wasClicked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$light*/ 2) {
    			if ($light === true) {
    				$$invalidate(5, darkToLight = '');
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$light*/ 2) {
    			if ($light) {
    				$$invalidate(6, showWand = 'showWand');
    			}
    		}

    		if ($$self.$$.dirty[0] & /*intersecting*/ 1) {
    			intersecting
    			? set_store_value(checkPoint, $checkPoint = set_store_value(checkPoint, $checkPoint = 5, $checkPoint), $checkPoint)
    			: '';
    		}
    	};

    	return [
    		intersecting,
    		$light,
    		updateBookComponent,
    		element,
    		rootMargin,
    		darkToLight,
    		showWand,
    		wasClicked,
    		$amountOfProjects,
    		$projectId,
    		$bookId,
    		$informativeBooksRead,
    		$_,
    		clickBookSpine,
    		openBook,
    		handleKeyDown,
    		key,
    		update_binding,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		keyup_handler,
    		article_binding,
    		intersectionobserver_intersecting_binding
    	];
    }

    class Informativt extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { key: 16 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Informativt",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get key() {
    		throw new Error("<Informativt>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Informativt>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Library.svelte generated by Svelte v3.53.1 */

    const { setTimeout: setTimeout_1, window: window_1 } = globals;

    const file$9 = "src\\pages\\Library.svelte";

    // (130:4) {#if $gotWand}
    function create_if_block_4(ctx) {
    	let ending;
    	let current;
    	ending = new Ending({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(ending.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(ending.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(ending, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(ending.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(ending.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(ending, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(130:4) {#if $gotWand}",
    		ctx
    	});

    	return block;
    }

    // (162:20) {#if $allKidsBooksRead === true}
    function create_if_block_3(ctx) {
    	let ungdomar;
    	let current;

    	ungdomar = new Ungdomar({
    			props: { key: /*key*/ ctx[5] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(ungdomar.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(ungdomar.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(ungdomar, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const ungdomar_changes = {};
    			if (dirty & /*key*/ 32) ungdomar_changes.key = /*key*/ ctx[5];
    			ungdomar.$set(ungdomar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(ungdomar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(ungdomar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(ungdomar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(162:20) {#if $allKidsBooksRead === true}",
    		ctx
    	});

    	return block;
    }

    // (168:20) {#if $adolescenceBooksRead === true}
    function create_if_block_2(ctx) {
    	let st_dochr_rlighet;
    	let current;

    	st_dochr_rlighet = new StuC3uB6dOchRuC3uB6rlighet({
    			props: { key: /*key*/ ctx[5] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(st_dochr_rlighet.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(st_dochr_rlighet.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(st_dochr_rlighet, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const st_dochr_rlighet_changes = {};
    			if (dirty & /*key*/ 32) st_dochr_rlighet_changes.key = /*key*/ ctx[5];
    			st_dochr_rlighet.$set(st_dochr_rlighet_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(st_dochr_rlighet.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(st_dochr_rlighet.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(st_dochr_rlighet, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(168:20) {#if $adolescenceBooksRead === true}",
    		ctx
    	});

    	return block;
    }

    // (174:20) {#if $mobilityBooksRead === true}
    function create_if_block_1$1(ctx) {
    	let prim_rv_rd;
    	let current;

    	prim_rv_rd = new PrimuC3uA4rvuC3uA5rd({
    			props: { key: /*key*/ ctx[5] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(prim_rv_rd.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(prim_rv_rd.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(prim_rv_rd, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const prim_rv_rd_changes = {};
    			if (dirty & /*key*/ 32) prim_rv_rd_changes.key = /*key*/ ctx[5];
    			prim_rv_rd.$set(prim_rv_rd_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(prim_rv_rd.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(prim_rv_rd.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(prim_rv_rd, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(174:20) {#if $mobilityBooksRead === true}",
    		ctx
    	});

    	return block;
    }

    // (180:20) {#if $primaryBooksRead === true}
    function create_if_block$5(ctx) {
    	let informativt;
    	let current;

    	informativt = new Informativt({
    			props: { key: /*key*/ ctx[5] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(informativt.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(informativt.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(informativt, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const informativt_changes = {};
    			if (dirty & /*key*/ 32) informativt_changes.key = /*key*/ ctx[5];
    			informativt.$set(informativt_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(informativt.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(informativt.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(informativt, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(180:20) {#if $primaryBooksRead === true}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let scrolling = false;

    	let clear_scrolling = () => {
    		scrolling = false;
    	};

    	let scrolling_timeout;
    	let div0;
    	let video;
    	let source;
    	let source_src_value;
    	let t0;
    	let p;
    	let p_class_value;
    	let t1;
    	let t2;
    	let div7;
    	let button2;
    	let a0;
    	let button0;
    	let t3;
    	let t4;
    	let a1;
    	let button1;
    	let t5;
    	let t6;
    	let girl;
    	let t7;
    	let div6;
    	let meetsven;
    	let t8;
    	let div1;
    	let t9;
    	let barnochunga;
    	let t10;
    	let div2;
    	let t11;
    	let t12;
    	let div3;
    	let div3_class_value;
    	let t13;
    	let t14;
    	let div4;
    	let t15;
    	let t16;
    	let div5;
    	let t17;
    	let current;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowscroll*/ ctx[19]);
    	let if_block0 = /*$gotWand*/ ctx[15] && create_if_block_4(ctx);
    	girl = new Girl({ $$inline: true });
    	meetsven = new MeetSven({ $$inline: true });

    	barnochunga = new BarnOchUnga({
    			props: { key: /*key*/ ctx[5] },
    			$$inline: true
    		});

    	let if_block1 = /*$allKidsBooksRead*/ ctx[4] === true && create_if_block_3(ctx);
    	let if_block2 = /*$adolescenceBooksRead*/ ctx[3] === true && create_if_block_2(ctx);
    	let if_block3 = /*$mobilityBooksRead*/ ctx[2] === true && create_if_block_1$1(ctx);
    	let if_block4 = /*$primaryBooksRead*/ ctx[1] === true && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			video = element("video");
    			source = element("source");
    			t0 = space();
    			p = element("p");
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			div7 = element("div");
    			button2 = element("button");
    			a0 = element("a");
    			button0 = element("button");
    			t3 = text(/*leftGuide*/ ctx[11]);
    			t4 = space();
    			a1 = element("a");
    			button1 = element("button");
    			t5 = text(/*rightGuide*/ ctx[12]);
    			t6 = space();
    			create_component(girl.$$.fragment);
    			t7 = space();
    			div6 = element("div");
    			create_component(meetsven.$$.fragment);
    			t8 = space();
    			div1 = element("div");
    			t9 = space();
    			create_component(barnochunga.$$.fragment);
    			t10 = space();
    			div2 = element("div");
    			t11 = space();
    			if (if_block1) if_block1.c();
    			t12 = space();
    			div3 = element("div");
    			t13 = space();
    			if (if_block2) if_block2.c();
    			t14 = space();
    			div4 = element("div");
    			t15 = space();
    			if (if_block3) if_block3.c();
    			t16 = space();
    			div5 = element("div");
    			t17 = space();
    			if (if_block4) if_block4.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			video = claim_element(div0_nodes, "VIDEO", { id: true, class: true });
    			var video_nodes = children(video);
    			source = claim_element(video_nodes, "SOURCE", { src: true, type: true, class: true });
    			video_nodes.forEach(detach_dev);
    			t0 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { id: true, class: true });
    			var p_nodes = children(p);
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			if (if_block0) if_block0.l(nodes);
    			t2 = claim_space(nodes);
    			div7 = claim_element(nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);

    			button2 = claim_element(div7_nodes, "BUTTON", {
    				class: true,
    				"data-point": true,
    				alt: true
    			});

    			var button2_nodes = children(button2);
    			a0 = claim_element(button2_nodes, "A", { href: true, class: true });
    			var a0_nodes = children(a0);
    			button0 = claim_element(a0_nodes, "BUTTON", { id: true, class: true });
    			var button0_nodes = children(button0);
    			t3 = claim_text(button0_nodes, /*leftGuide*/ ctx[11]);
    			button0_nodes.forEach(detach_dev);
    			a0_nodes.forEach(detach_dev);
    			t4 = claim_space(button2_nodes);
    			a1 = claim_element(button2_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			button1 = claim_element(a1_nodes, "BUTTON", { id: true, class: true });
    			var button1_nodes = children(button1);
    			t5 = claim_text(button1_nodes, /*rightGuide*/ ctx[12]);
    			button1_nodes.forEach(detach_dev);
    			a1_nodes.forEach(detach_dev);
    			t6 = claim_space(button2_nodes);
    			claim_component(girl.$$.fragment, button2_nodes);
    			t7 = claim_space(button2_nodes);
    			div6 = claim_element(button2_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			claim_component(meetsven.$$.fragment, div6_nodes);
    			t8 = claim_space(div6_nodes);
    			div1 = claim_element(div6_nodes, "DIV", { class: true });
    			children(div1).forEach(detach_dev);
    			t9 = claim_space(div6_nodes);
    			claim_component(barnochunga.$$.fragment, div6_nodes);
    			t10 = claim_space(div6_nodes);
    			div2 = claim_element(div6_nodes, "DIV", { class: true });
    			children(div2).forEach(detach_dev);
    			t11 = claim_space(div6_nodes);
    			if (if_block1) if_block1.l(div6_nodes);
    			t12 = claim_space(div6_nodes);
    			div3 = claim_element(div6_nodes, "DIV", { class: true, id: true });
    			children(div3).forEach(detach_dev);
    			t13 = claim_space(div6_nodes);
    			if (if_block2) if_block2.l(div6_nodes);
    			t14 = claim_space(div6_nodes);
    			div4 = claim_element(div6_nodes, "DIV", { class: true });
    			children(div4).forEach(detach_dev);
    			t15 = claim_space(div6_nodes);
    			if (if_block3) if_block3.l(div6_nodes);
    			t16 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			children(div5).forEach(detach_dev);
    			t17 = claim_space(div6_nodes);
    			if (if_block4) if_block4.l(div6_nodes);
    			div6_nodes.forEach(detach_dev);
    			button2_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(source.src, source_src_value = "../images/rotate-device.mp4")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			attr_dev(source, "class", "svelte-13ucm7m");
    			add_location(source, file$9, 121, 8, 4198);
    			video.autoplay = true;
    			video.muted = true;
    			video.loop = true;
    			attr_dev(video, "id", "rotate-device");
    			attr_dev(video, "class", "svelte-13ucm7m");
    			add_location(video, file$9, 120, 4, 4142);
    			attr_dev(p, "id", "rotate-phone-message");
    			attr_dev(p, "class", p_class_value = "" + (null_to_empty(/*IOSdevice*/ ctx[13]) + " svelte-13ucm7m"));
    			add_location(p, file$9, 123, 4, 4277);
    			attr_dev(div0, "class", "rotate-animation svelte-13ucm7m");
    			add_location(div0, file$9, 119, 0, 4105);
    			attr_dev(button0, "id", "moveLeftBtn");
    			attr_dev(button0, "class", "svelte-13ucm7m");
    			add_location(button0, file$9, 140, 20, 4867);
    			attr_dev(a0, "href", /*leftCategory*/ ctx[10]);
    			attr_dev(a0, "class", "moveButtons svelte-13ucm7m");
    			add_location(a0, file$9, 139, 16, 4802);
    			attr_dev(button1, "id", "moveRightBtn");
    			attr_dev(button1, "class", "svelte-13ucm7m");
    			add_location(button1, file$9, 144, 20, 5020);
    			attr_dev(a1, "href", /*rightCategory*/ ctx[9]);
    			attr_dev(a1, "class", "moveButtons svelte-13ucm7m");
    			add_location(a1, file$9, 143, 16, 4954);
    			attr_dev(div1, "class", "transition svelte-13ucm7m");
    			add_location(div1, file$9, 153, 24, 5243);
    			attr_dev(div2, "class", "transition svelte-13ucm7m");
    			add_location(div2, file$9, 159, 24, 5459);
    			attr_dev(div3, "class", div3_class_value = "" + (null_to_empty("transition " + (/*$adolescenceBooksRead*/ ctx[3] ? 'fly-to' : '')) + " svelte-13ucm7m"));
    			attr_dev(div3, "id", "fly-base");
    			add_location(div3, file$9, 165, 20, 5655);
    			attr_dev(div4, "class", "transition svelte-13ucm7m");
    			add_location(div4, file$9, 171, 24, 5925);
    			attr_dev(div5, "class", "dark-transition svelte-13ucm7m");
    			add_location(div5, file$9, 177, 24, 6108);
    			attr_dev(div6, "class", "imageQue svelte-13ucm7m");
    			add_location(div6, file$9, 149, 16, 5137);
    			attr_dev(button2, "class", "wrapper svelte-13ucm7m");
    			attr_dev(button2, "data-point", /*$checkPoint*/ ctx[0]);
    			attr_dev(button2, "alt", "Background");
    			add_location(button2, file$9, 136, 8, 4690);
    			attr_dev(div7, "class", "horizontal-scroll-wrapper svelte-13ucm7m");
    			add_location(div7, file$9, 132, 4, 4483);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, video);
    			append_hydration_dev(video, source);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div0, p);
    			p.innerHTML = /*fullscreenGuide*/ ctx[14];
    			insert_hydration_dev(target, t1, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_hydration_dev(target, t2, anchor);
    			insert_hydration_dev(target, div7, anchor);
    			append_hydration_dev(div7, button2);
    			append_hydration_dev(button2, a0);
    			append_hydration_dev(a0, button0);
    			append_hydration_dev(button0, t3);
    			append_hydration_dev(button2, t4);
    			append_hydration_dev(button2, a1);
    			append_hydration_dev(a1, button1);
    			append_hydration_dev(button1, t5);
    			append_hydration_dev(button2, t6);
    			mount_component(girl, button2, null);
    			append_hydration_dev(button2, t7);
    			append_hydration_dev(button2, div6);
    			mount_component(meetsven, div6, null);
    			append_hydration_dev(div6, t8);
    			append_hydration_dev(div6, div1);
    			append_hydration_dev(div6, t9);
    			mount_component(barnochunga, div6, null);
    			append_hydration_dev(div6, t10);
    			append_hydration_dev(div6, div2);
    			append_hydration_dev(div6, t11);
    			if (if_block1) if_block1.m(div6, null);
    			append_hydration_dev(div6, t12);
    			append_hydration_dev(div6, div3);
    			append_hydration_dev(div6, t13);
    			if (if_block2) if_block2.m(div6, null);
    			append_hydration_dev(div6, t14);
    			append_hydration_dev(div6, div4);
    			append_hydration_dev(div6, t15);
    			if (if_block3) if_block3.m(div6, null);
    			append_hydration_dev(div6, t16);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div6, t17);
    			if (if_block4) if_block4.m(div6, null);
    			/*button2_binding*/ ctx[20](button2);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1, "keydown", /*keydown_handler*/ ctx[18], false, false, false),
    					listen_dev(window_1, "scroll", () => {
    						scrolling = true;
    						clearTimeout(scrolling_timeout);
    						scrolling_timeout = setTimeout_1(clear_scrolling, 100);
    						/*onwindowscroll*/ ctx[19]();
    					})
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*scrollingX, scrollingY*/ 384 && !scrolling) {
    				scrolling = true;
    				clearTimeout(scrolling_timeout);
    				scrollTo(/*scrollingX*/ ctx[8], /*scrollingY*/ ctx[7]);
    				scrolling_timeout = setTimeout_1(clear_scrolling, 100);
    			}

    			if (!current || dirty & /*fullscreenGuide*/ 16384) p.innerHTML = /*fullscreenGuide*/ ctx[14];
    			if (!current || dirty & /*IOSdevice*/ 8192 && p_class_value !== (p_class_value = "" + (null_to_empty(/*IOSdevice*/ ctx[13]) + " svelte-13ucm7m"))) {
    				attr_dev(p, "class", p_class_value);
    			}

    			if (/*$gotWand*/ ctx[15]) {
    				if (if_block0) {
    					if (dirty & /*$gotWand*/ 32768) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t2.parentNode, t2);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*leftGuide*/ 2048) set_data_dev(t3, /*leftGuide*/ ctx[11]);

    			if (!current || dirty & /*leftCategory*/ 1024) {
    				attr_dev(a0, "href", /*leftCategory*/ ctx[10]);
    			}

    			if (!current || dirty & /*rightGuide*/ 4096) set_data_dev(t5, /*rightGuide*/ ctx[12]);

    			if (!current || dirty & /*rightCategory*/ 512) {
    				attr_dev(a1, "href", /*rightCategory*/ ctx[9]);
    			}

    			const barnochunga_changes = {};
    			if (dirty & /*key*/ 32) barnochunga_changes.key = /*key*/ ctx[5];
    			barnochunga.$set(barnochunga_changes);

    			if (/*$allKidsBooksRead*/ ctx[4] === true) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*$allKidsBooksRead*/ 16) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div6, t12);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*$adolescenceBooksRead*/ 8 && div3_class_value !== (div3_class_value = "" + (null_to_empty("transition " + (/*$adolescenceBooksRead*/ ctx[3] ? 'fly-to' : '')) + " svelte-13ucm7m"))) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (/*$adolescenceBooksRead*/ ctx[3] === true) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*$adolescenceBooksRead*/ 8) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div6, t14);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*$mobilityBooksRead*/ ctx[2] === true) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);

    					if (dirty & /*$mobilityBooksRead*/ 4) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_1$1(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(div6, t16);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}

    			if (/*$primaryBooksRead*/ ctx[1] === true) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);

    					if (dirty & /*$primaryBooksRead*/ 2) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block$5(ctx);
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(div6, null);
    				}
    			} else if (if_block4) {
    				group_outros();

    				transition_out(if_block4, 1, 1, () => {
    					if_block4 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*$checkPoint*/ 1) {
    				attr_dev(button2, "data-point", /*$checkPoint*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(girl.$$.fragment, local);
    			transition_in(meetsven.$$.fragment, local);
    			transition_in(barnochunga.$$.fragment, local);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			transition_in(if_block4);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(girl.$$.fragment, local);
    			transition_out(meetsven.$$.fragment, local);
    			transition_out(barnochunga.$$.fragment, local);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			transition_out(if_block4);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div7);
    			destroy_component(girl);
    			destroy_component(meetsven);
    			destroy_component(barnochunga);
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			/*button2_binding*/ ctx[20](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $checkPoint;
    	let $_;
    	let $story;
    	let $gotWand;
    	let $informativeBooksRead;
    	let $primaryBooksRead;
    	let $mobilityBooksRead;
    	let $adolescenceBooksRead;
    	let $allKidsBooksRead;
    	validate_store(checkPoint, 'checkPoint');
    	component_subscribe($$self, checkPoint, $$value => $$invalidate(0, $checkPoint = $$value));
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(16, $_ = $$value));
    	validate_store(story, 'story');
    	component_subscribe($$self, story, $$value => $$invalidate(21, $story = $$value));
    	validate_store(gotWand, 'gotWand');
    	component_subscribe($$self, gotWand, $$value => $$invalidate(15, $gotWand = $$value));
    	validate_store(informativeBooksRead, 'informativeBooksRead');
    	component_subscribe($$self, informativeBooksRead, $$value => $$invalidate(17, $informativeBooksRead = $$value));
    	validate_store(primaryBooksRead, 'primaryBooksRead');
    	component_subscribe($$self, primaryBooksRead, $$value => $$invalidate(1, $primaryBooksRead = $$value));
    	validate_store(mobilityBooksRead, 'mobilityBooksRead');
    	component_subscribe($$self, mobilityBooksRead, $$value => $$invalidate(2, $mobilityBooksRead = $$value));
    	validate_store(adolescenceBooksRead, 'adolescenceBooksRead');
    	component_subscribe($$self, adolescenceBooksRead, $$value => $$invalidate(3, $adolescenceBooksRead = $$value));
    	validate_store(allKidsBooksRead, 'allKidsBooksRead');
    	component_subscribe($$self, allKidsBooksRead, $$value => $$invalidate(4, $allKidsBooksRead = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Library', slots, []);
    	let element;
    	let intersecting;
    	let key = "";
    	let wrapperElem;
    	let scrollingY;
    	let scrollingX;
    	let rightCategory = '';
    	let leftCategory = '';
    	let leftGuide = '';
    	let rightGuide = '';
    	let IOSdevice = '';
    	let fullscreenGuide = '';

    	// let story = ''
    	// auto focuses the library so that the keyboard can be used to move around aswell
    	onMount(() => {
    		wrapperElem.focus();

    		if ($adolescenceBooksRead) {
    			document.getElementById('moveRightBtn').click();
    		}
    	});

    	//checks what device is being used
    	let isIOS = (/iPad|iPhone|iPod/).test(navigator.userAgent) && !window.MSStream;

    	if (isIOS) {
    		// console.log('This is a IOS device');
    		fullscreenGuide = `För fullskärm: <br> 1. Vid webbläsarens adressfält finns en ikon 'aA'. <br> 2. Tryck på den och välj 'Göm verktygsfält'. <br> 3. Rotera skärmen.`;

    		IOSdevice = 'IOSdevice';
    	} else {
    		// console.log('This is Not a IOS device');
    		fullscreenGuide = 'Rotera skärmen';

    		IOSdevice = '';
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Library> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = e => $$invalidate(5, key = e.key);

    	function onwindowscroll() {
    		$$invalidate(8, scrollingX = window_1.pageXOffset);
    		$$invalidate(7, scrollingY = window_1.pageYOffset);
    	}

    	function button2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			wrapperElem = $$value;
    			$$invalidate(6, wrapperElem);
    		});
    	}

    	$$self.$capture_state = () => ({
    		_: Y,
    		onMount,
    		Ending,
    		MeetSven,
    		BarnOchUnga,
    		Ungdomar,
    		StödOchRörlighet: StuC3uB6dOchRuC3uB6rlighet,
    		Primärvård: PrimuC3uA4rvuC3uA5rd,
    		Informativt,
    		checkPoint,
    		allKidsBooksRead,
    		hasTalkedToSven,
    		adolescenceBooksRead,
    		mobilityBooksRead,
    		primaryBooksRead,
    		informativeBooksRead,
    		gotWand,
    		story,
    		Girl,
    		InterSectionObserver: IntersectionObserver$1,
    		element,
    		intersecting,
    		key,
    		wrapperElem,
    		scrollingY,
    		scrollingX,
    		rightCategory,
    		leftCategory,
    		leftGuide,
    		rightGuide,
    		IOSdevice,
    		fullscreenGuide,
    		isIOS,
    		$checkPoint,
    		$_,
    		$story,
    		$gotWand,
    		$informativeBooksRead,
    		$primaryBooksRead,
    		$mobilityBooksRead,
    		$adolescenceBooksRead,
    		$allKidsBooksRead
    	});

    	$$self.$inject_state = $$props => {
    		if ('element' in $$props) element = $$props.element;
    		if ('intersecting' in $$props) intersecting = $$props.intersecting;
    		if ('key' in $$props) $$invalidate(5, key = $$props.key);
    		if ('wrapperElem' in $$props) $$invalidate(6, wrapperElem = $$props.wrapperElem);
    		if ('scrollingY' in $$props) $$invalidate(7, scrollingY = $$props.scrollingY);
    		if ('scrollingX' in $$props) $$invalidate(8, scrollingX = $$props.scrollingX);
    		if ('rightCategory' in $$props) $$invalidate(9, rightCategory = $$props.rightCategory);
    		if ('leftCategory' in $$props) $$invalidate(10, leftCategory = $$props.leftCategory);
    		if ('leftGuide' in $$props) $$invalidate(11, leftGuide = $$props.leftGuide);
    		if ('rightGuide' in $$props) $$invalidate(12, rightGuide = $$props.rightGuide);
    		if ('IOSdevice' in $$props) $$invalidate(13, IOSdevice = $$props.IOSdevice);
    		if ('fullscreenGuide' in $$props) $$invalidate(14, fullscreenGuide = $$props.fullscreenGuide);
    		if ('isIOS' in $$props) isIOS = $$props.isIOS;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$allKidsBooksRead, $_*/ 65552) {
    			// changes storyline according to books being read
    			if ($allKidsBooksRead) {
    				set_store_value(story, $story = $_("category1.cat2inst2"), $story);
    			}
    		}

    		if ($$self.$$.dirty & /*$adolescenceBooksRead, $_*/ 65544) {
    			if ($adolescenceBooksRead) {
    				document.getElementById('fly-base').scrollIntoView({
    					behavior: "smooth",
    					block: "center",
    					inline: "center"
    				});

    				setTimeout(
    					() => {
    						set_store_value(story, $story = $_("category2.cat2inst"), $story);
    					},
    					3000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$mobilityBooksRead, $_*/ 65540) {
    			if ($mobilityBooksRead) {
    				setTimeout(
    					() => {
    						set_store_value(story, $story = $_("category3.cat3inst"), $story);
    					},
    					2000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$primaryBooksRead, $_*/ 65538) {
    			if ($primaryBooksRead) {
    				setTimeout(
    					() => {
    						set_store_value(story, $story = $_("category4.cat4inst"), $story);
    					},
    					2000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$informativeBooksRead, $_*/ 196608) {
    			if ($informativeBooksRead) {
    				set_store_value(story, $story = $_("category5.cat5inst"), $story);

    				setTimeout(
    					() => {
    						set_store_value(gotWand, $gotWand = true, $gotWand);
    					},
    					11000
    				);
    			}
    		}

    		if ($$self.$$.dirty & /*$checkPoint, $_*/ 65537) {
    			//controls the buttons you mmove with in mobile/Tablet view
    			// changes storyline according to checkpoints
    			if ($checkPoint === 0) {
    				$$invalidate(9, rightCategory = '#first-category');
    				$$invalidate(12, rightGuide = $_("library.btnText2"));
    			} else if ($checkPoint === 1) {
    				$$invalidate(9, rightCategory = '#second-category');
    				set_store_value(story, $story = $_("category1.cat1inst1"), $story);
    			} else if ($checkPoint === 2) {
    				$$invalidate(9, rightCategory = '#third-category');
    			} else if ($checkPoint === 3) {
    				$$invalidate(9, rightCategory = '#fourth-category');
    			} else if ($checkPoint === 4) {
    				$$invalidate(9, rightCategory = '#fifth-category');
    			}
    		}

    		if ($$self.$$.dirty & /*$checkPoint, $_*/ 65537) {
    			if ($checkPoint === 0) {
    				$$invalidate(11, leftGuide = '');
    			} else if ($checkPoint === 1) {
    				$$invalidate(10, leftCategory = '#lobby');
    				$$invalidate(11, leftGuide = $_("library.lobby"));
    			} else if ($checkPoint === 2) {
    				$$invalidate(10, leftCategory = '#first-category');
    			} else if ($checkPoint === 3) {
    				$$invalidate(10, leftCategory = '#second-category');
    			} else if ($checkPoint === 4) {
    				$$invalidate(10, leftCategory = '#third-category');
    			} else if ($checkPoint === 5) {
    				$$invalidate(10, leftCategory = '#fourth-category');
    			}
    		}
    	};

    	return [
    		$checkPoint,
    		$primaryBooksRead,
    		$mobilityBooksRead,
    		$adolescenceBooksRead,
    		$allKidsBooksRead,
    		key,
    		wrapperElem,
    		scrollingY,
    		scrollingX,
    		rightCategory,
    		leftCategory,
    		leftGuide,
    		rightGuide,
    		IOSdevice,
    		fullscreenGuide,
    		$gotWand,
    		$_,
    		$informativeBooksRead,
    		keydown_handler,
    		onwindowscroll,
    		button2_binding
    	];
    }

    class Library extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Library",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src\components\Abilities.svelte generated by Svelte v3.53.1 */

    const { console: console_1$6 } = globals;
    const file$8 = "src\\components\\Abilities.svelte";

    function create_fragment$8(ctx) {
    	let section;
    	let article;
    	let button0;
    	let button0_disabled_value;
    	let button0_class_value;
    	let t0;
    	let button1;
    	let button1_disabled_value;
    	let button1_class_value;
    	let t1;
    	let button2;
    	let button2_disabled_value;
    	let button2_class_value;
    	let t2;
    	let button3;
    	let button3_disabled_value;
    	let button3_class_value;
    	let t3;
    	let a;
    	let button4;
    	let button4_disabled_value;
    	let button4_class_value;
    	let article_intro;
    	let article_outro;
    	let section_class_value;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			article = element("article");
    			button0 = element("button");
    			t0 = space();
    			button1 = element("button");
    			t1 = space();
    			button2 = element("button");
    			t2 = space();
    			button3 = element("button");
    			t3 = space();
    			a = element("a");
    			button4 = element("button");
    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { class: true });
    			var section_nodes = children(section);
    			article = claim_element(section_nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			button0 = claim_element(article_nodes, "BUTTON", { class: true });
    			var button0_nodes = children(button0);
    			button0_nodes.forEach(detach_dev);
    			t0 = claim_space(article_nodes);
    			button1 = claim_element(article_nodes, "BUTTON", { class: true });
    			var button1_nodes = children(button1);
    			button1_nodes.forEach(detach_dev);
    			t1 = claim_space(article_nodes);
    			button2 = claim_element(article_nodes, "BUTTON", { class: true });
    			var button2_nodes = children(button2);
    			button2_nodes.forEach(detach_dev);
    			t2 = claim_space(article_nodes);
    			button3 = claim_element(article_nodes, "BUTTON", { class: true });
    			var button3_nodes = children(button3);
    			button3_nodes.forEach(detach_dev);
    			t3 = claim_space(article_nodes);
    			a = claim_element(article_nodes, "A", { href: true });
    			var a_nodes = children(a);
    			button4 = claim_element(a_nodes, "BUTTON", { class: true });
    			var button4_nodes = children(button4);
    			button4_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			button0.disabled = button0_disabled_value = /*$allKidsBooksRead*/ ctx[4] ? false : true;
    			attr_dev(button0, "class", button0_class_value = "" + (null_to_empty(/*$allKidsBooksRead*/ ctx[4] ? 'fly' : '') + " svelte-1uhc43d"));
    			add_location(button0, file$8, 67, 8, 1725);
    			button1.disabled = button1_disabled_value = /*$adolescenceBooksRead*/ ctx[5] ? false : true;
    			attr_dev(button1, "class", button1_class_value = "" + (null_to_empty(/*$adolescenceBooksRead*/ ctx[5] ? 'spells' : '') + " svelte-1uhc43d"));
    			add_location(button1, file$8, 71, 8, 1865);
    			button2.disabled = button2_disabled_value = /*$mobilityBooksRead*/ ctx[6] ? false : true;
    			attr_dev(button2, "class", button2_class_value = "" + (null_to_empty(/*$mobilityBooksRead*/ ctx[6] ? 'dust' : '') + " svelte-1uhc43d"));
    			add_location(button2, file$8, 78, 8, 2057);
    			button3.disabled = button3_disabled_value = /*$primaryBooksRead*/ ctx[7] ? false : true;
    			attr_dev(button3, "class", button3_class_value = "" + (null_to_empty(/*$primaryBooksRead*/ ctx[7] ? 'light' : '') + " svelte-1uhc43d"));
    			add_location(button3, file$8, 85, 8, 2245);
    			button4.disabled = button4_disabled_value = /*$goHome*/ ctx[0] ? false : true;
    			attr_dev(button4, "class", button4_class_value = "" + (null_to_empty(/*wand*/ ctx[2] + (/*$goHome*/ ctx[0] ? 'wandAnimation' : '')) + " svelte-1uhc43d"));
    			add_location(button4, file$8, 93, 16, 2469);
    			attr_dev(a, "href", /*dimh*/ ctx[1]);
    			add_location(a, file$8, 92, 8, 2436);
    			attr_dev(article, "class", "svelte-1uhc43d");
    			add_location(article, file$8, 66, 4, 1631);
    			attr_dev(section, "class", section_class_value = "" + (null_to_empty(/*hide*/ ctx[3] === 'hide' ? 'hide' : '') + " svelte-1uhc43d"));
    			add_location(section, file$8, 63, 0, 1442);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, article);
    			append_hydration_dev(article, button0);
    			append_hydration_dev(article, t0);
    			append_hydration_dev(article, button1);
    			append_hydration_dev(article, t1);
    			append_hydration_dev(article, button2);
    			append_hydration_dev(article, t2);
    			append_hydration_dev(article, button3);
    			append_hydration_dev(article, t3);
    			append_hydration_dev(article, a);
    			append_hydration_dev(a, button4);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button1, "click", /*useSpell*/ ctx[8], false, false, false),
    					listen_dev(button2, "click", /*useFairyDust*/ ctx[9], false, false, false),
    					listen_dev(button3, "click", /*useLight*/ ctx[10], false, false, false),
    					listen_dev(button4, "click", /*useWand*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*$allKidsBooksRead*/ 16 && button0_disabled_value !== (button0_disabled_value = /*$allKidsBooksRead*/ ctx[4] ? false : true)) {
    				prop_dev(button0, "disabled", button0_disabled_value);
    			}

    			if (!current || dirty & /*$allKidsBooksRead*/ 16 && button0_class_value !== (button0_class_value = "" + (null_to_empty(/*$allKidsBooksRead*/ ctx[4] ? 'fly' : '') + " svelte-1uhc43d"))) {
    				attr_dev(button0, "class", button0_class_value);
    			}

    			if (!current || dirty & /*$adolescenceBooksRead*/ 32 && button1_disabled_value !== (button1_disabled_value = /*$adolescenceBooksRead*/ ctx[5] ? false : true)) {
    				prop_dev(button1, "disabled", button1_disabled_value);
    			}

    			if (!current || dirty & /*$adolescenceBooksRead*/ 32 && button1_class_value !== (button1_class_value = "" + (null_to_empty(/*$adolescenceBooksRead*/ ctx[5] ? 'spells' : '') + " svelte-1uhc43d"))) {
    				attr_dev(button1, "class", button1_class_value);
    			}

    			if (!current || dirty & /*$mobilityBooksRead*/ 64 && button2_disabled_value !== (button2_disabled_value = /*$mobilityBooksRead*/ ctx[6] ? false : true)) {
    				prop_dev(button2, "disabled", button2_disabled_value);
    			}

    			if (!current || dirty & /*$mobilityBooksRead*/ 64 && button2_class_value !== (button2_class_value = "" + (null_to_empty(/*$mobilityBooksRead*/ ctx[6] ? 'dust' : '') + " svelte-1uhc43d"))) {
    				attr_dev(button2, "class", button2_class_value);
    			}

    			if (!current || dirty & /*$primaryBooksRead*/ 128 && button3_disabled_value !== (button3_disabled_value = /*$primaryBooksRead*/ ctx[7] ? false : true)) {
    				prop_dev(button3, "disabled", button3_disabled_value);
    			}

    			if (!current || dirty & /*$primaryBooksRead*/ 128 && button3_class_value !== (button3_class_value = "" + (null_to_empty(/*$primaryBooksRead*/ ctx[7] ? 'light' : '') + " svelte-1uhc43d"))) {
    				attr_dev(button3, "class", button3_class_value);
    			}

    			if (!current || dirty & /*$goHome*/ 1 && button4_disabled_value !== (button4_disabled_value = /*$goHome*/ ctx[0] ? false : true)) {
    				prop_dev(button4, "disabled", button4_disabled_value);
    			}

    			if (!current || dirty & /*wand, $goHome*/ 5 && button4_class_value !== (button4_class_value = "" + (null_to_empty(/*wand*/ ctx[2] + (/*$goHome*/ ctx[0] ? 'wandAnimation' : '')) + " svelte-1uhc43d"))) {
    				attr_dev(button4, "class", button4_class_value);
    			}

    			if (!current || dirty & /*dimh*/ 2) {
    				attr_dev(a, "href", /*dimh*/ ctx[1]);
    			}

    			if (!current || dirty & /*hide*/ 8 && section_class_value !== (section_class_value = "" + (null_to_empty(/*hide*/ ctx[3] === 'hide' ? 'hide' : '') + " svelte-1uhc43d"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (article_outro) article_outro.end(1);
    				article_intro = create_in_transition(article, fly, { y: 200, duration: 800 });
    				article_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (article_intro) article_intro.invalidate();
    			article_outro = create_out_transition(article, fly, { y: 200, duration: 1500 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && article_outro) article_outro.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let $goHome;
    	let $light;
    	let $tree;
    	let $spell;
    	let $informativeBooksRead;
    	let $allKidsBooksRead;
    	let $adolescenceBooksRead;
    	let $mobilityBooksRead;
    	let $primaryBooksRead;
    	validate_store(goHome, 'goHome');
    	component_subscribe($$self, goHome, $$value => $$invalidate(0, $goHome = $$value));
    	validate_store(light, 'light');
    	component_subscribe($$self, light, $$value => $$invalidate(15, $light = $$value));
    	validate_store(tree, 'tree');
    	component_subscribe($$self, tree, $$value => $$invalidate(16, $tree = $$value));
    	validate_store(spell, 'spell');
    	component_subscribe($$self, spell, $$value => $$invalidate(17, $spell = $$value));
    	validate_store(informativeBooksRead, 'informativeBooksRead');
    	component_subscribe($$self, informativeBooksRead, $$value => $$invalidate(12, $informativeBooksRead = $$value));
    	validate_store(allKidsBooksRead, 'allKidsBooksRead');
    	component_subscribe($$self, allKidsBooksRead, $$value => $$invalidate(4, $allKidsBooksRead = $$value));
    	validate_store(adolescenceBooksRead, 'adolescenceBooksRead');
    	component_subscribe($$self, adolescenceBooksRead, $$value => $$invalidate(5, $adolescenceBooksRead = $$value));
    	validate_store(mobilityBooksRead, 'mobilityBooksRead');
    	component_subscribe($$self, mobilityBooksRead, $$value => $$invalidate(6, $mobilityBooksRead = $$value));
    	validate_store(primaryBooksRead, 'primaryBooksRead');
    	component_subscribe($$self, primaryBooksRead, $$value => $$invalidate(7, $primaryBooksRead = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Abilities', slots, []);
    	let show = false;
    	let showHide = 'open';
    	let dimh = '';
    	let wand = '';
    	let hide = '';

    	// $: if($allKidsBooksRead || $adolescenceBooksRead || $mobilityBooksRead || $primaryBooksRead || $informativeBooksRead)
    	// { showHideAbilities() }
    	onMount(() => {
    		if (location.pathname === '/dashboard') {
    			$$invalidate(3, hide = 'hide');
    		}
    	});

    	const useSpell = () => {
    		set_store_value(spell, $spell = true, $spell);
    	};

    	const useFairyDust = () => {
    		set_store_value(tree, $tree = '../images/alive-tree-01.png', $tree);
    	};

    	const useLight = () => {
    		set_store_value(light, $light = true, $light);
    	};

    	const useWand = () => {
    		// $gotWand = true
    		if ($goHome === true) {
    			$$invalidate(1, dimh = 'https://www.di-mh.com/');
    		}
    	};

    	const showHideAbilities = () => {
    		show = !show;

    		if (show) {
    			showHide = 'close';
    		} else {
    			showHide = 'open';
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$6.warn(`<Abilities> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		allKidsBooksRead,
    		primaryBooksRead,
    		mobilityBooksRead,
    		adolescenceBooksRead,
    		informativeBooksRead,
    		tree,
    		spell,
    		light,
    		gotWand,
    		goHome,
    		fly,
    		onMount,
    		show,
    		showHide,
    		dimh,
    		wand,
    		hide,
    		useSpell,
    		useFairyDust,
    		useLight,
    		useWand,
    		showHideAbilities,
    		$goHome,
    		$light,
    		$tree,
    		$spell,
    		$informativeBooksRead,
    		$allKidsBooksRead,
    		$adolescenceBooksRead,
    		$mobilityBooksRead,
    		$primaryBooksRead
    	});

    	$$self.$inject_state = $$props => {
    		if ('show' in $$props) show = $$props.show;
    		if ('showHide' in $$props) showHide = $$props.showHide;
    		if ('dimh' in $$props) $$invalidate(1, dimh = $$props.dimh);
    		if ('wand' in $$props) $$invalidate(2, wand = $$props.wand);
    		if ('hide' in $$props) $$invalidate(3, hide = $$props.hide);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$informativeBooksRead*/ 4096) {
    			if ($informativeBooksRead) {
    				$$invalidate(2, wand = 'wand ');
    			}
    		}

    		if ($$self.$$.dirty & /*$goHome*/ 1) {
    			if ($goHome === true) {
    				show = true;
    			}
    		}
    	};

    	console.log(location.pathname);

    	return [
    		$goHome,
    		dimh,
    		wand,
    		hide,
    		$allKidsBooksRead,
    		$adolescenceBooksRead,
    		$mobilityBooksRead,
    		$primaryBooksRead,
    		useSpell,
    		useFairyDust,
    		useLight,
    		useWand,
    		$informativeBooksRead
    	];
    }

    class Abilities extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Abilities",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src\pages\AllProjects.svelte generated by Svelte v3.53.1 */

    const { console: console_1$5 } = globals;
    const file$7 = "src\\pages\\AllProjects.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (34:4) {#each $amountOfProjects as project}
    function create_each_block(ctx) {
    	let article;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let h2;
    	let t1_value = /*project*/ ctx[1].title + "";
    	let t1;
    	let t2;
    	let p0;
    	let t3_value = /*project*/ ctx[1].category + "";
    	let t3;
    	let t4;
    	let p1;
    	let t5_value = /*project*/ ctx[1].description + "";
    	let t5;
    	let t6;

    	const block = {
    		c: function create() {
    			article = element("article");
    			img = element("img");
    			t0 = space();
    			h2 = element("h2");
    			t1 = text(t1_value);
    			t2 = space();
    			p0 = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			p1 = element("p");
    			t5 = text(t5_value);
    			t6 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			article = claim_element(nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);

    			img = claim_element(article_nodes, "IMG", {
    				src: true,
    				alt: true,
    				name: true,
    				class: true
    			});

    			t0 = claim_space(article_nodes);
    			h2 = claim_element(article_nodes, "H2", { class: true });
    			var h2_nodes = children(h2);
    			t1 = claim_text(h2_nodes, t1_value);
    			h2_nodes.forEach(detach_dev);
    			t2 = claim_space(article_nodes);
    			p0 = claim_element(article_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t3 = claim_text(p0_nodes, t3_value);
    			p0_nodes.forEach(detach_dev);
    			t4 = claim_space(article_nodes);
    			p1 = claim_element(article_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t5 = claim_text(p1_nodes, t5_value);
    			p1_nodes.forEach(detach_dev);
    			t6 = claim_space(article_nodes);
    			article_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*project*/ ctx[1].image_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*project*/ ctx[1].title);
    			attr_dev(img, "name", "picture");
    			attr_dev(img, "class", "project-img svelte-1ng7wkg");
    			add_location(img, file$7, 35, 12, 911);
    			attr_dev(h2, "class", "project-title svelte-1ng7wkg");
    			add_location(h2, file$7, 41, 12, 1092);
    			attr_dev(p0, "class", "category svelte-1ng7wkg");
    			add_location(p0, file$7, 42, 12, 1152);
    			attr_dev(p1, "class", "description svelte-1ng7wkg");
    			add_location(p1, file$7, 43, 12, 1208);
    			attr_dev(article, "class", "project svelte-1ng7wkg");
    			add_location(article, file$7, 34, 8, 872);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, article, anchor);
    			append_hydration_dev(article, img);
    			append_hydration_dev(article, t0);
    			append_hydration_dev(article, h2);
    			append_hydration_dev(h2, t1);
    			append_hydration_dev(article, t2);
    			append_hydration_dev(article, p0);
    			append_hydration_dev(p0, t3);
    			append_hydration_dev(article, t4);
    			append_hydration_dev(article, p1);
    			append_hydration_dev(p1, t5);
    			append_hydration_dev(article, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$amountOfProjects*/ 1 && !src_url_equal(img.src, img_src_value = /*project*/ ctx[1].image_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 1 && img_alt_value !== (img_alt_value = /*project*/ ctx[1].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$amountOfProjects*/ 1 && t1_value !== (t1_value = /*project*/ ctx[1].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*$amountOfProjects*/ 1 && t3_value !== (t3_value = /*project*/ ctx[1].category + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*$amountOfProjects*/ 1 && t5_value !== (t5_value = /*project*/ ctx[1].description + "")) set_data_dev(t5, t5_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(34:4) {#each $amountOfProjects as project}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let section;
    	let each_value = /*$amountOfProjects*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			section = element("section");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", { class: true });
    			var section_nodes = children(section);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(section_nodes);
    			}

    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(section, "class", "svelte-1ng7wkg");
    			add_location(section, file$7, 32, 0, 811);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$amountOfProjects*/ 1) {
    				each_value = /*$amountOfProjects*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(section, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_each(each_blocks, detaching);
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

    const PROJECTS_ENDPOINT = "http://localhost:4000/api/projects";

    function instance$7($$self, $$props, $$invalidate) {
    	let $amountOfProjects;
    	validate_store(amountOfProjects, 'amountOfProjects');
    	component_subscribe($$self, amountOfProjects, $$value => $$invalidate(0, $amountOfProjects = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('AllProjects', slots, []);

    	onMount(async () => {
    		try {
    			const response = await axios.get(PROJECTS_ENDPOINT);
    			set_store_value(amountOfProjects, $amountOfProjects = response.data, $amountOfProjects);
    			console.log($amountOfProjects);
    		} catch(error) {
    			console.log(error);
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$5.warn(`<AllProjects> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		axios,
    		amountOfProjects,
    		PROJECTS_ENDPOINT,
    		$amountOfProjects
    	});

    	return [$amountOfProjects];
    }

    class AllProjects extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AllProjects",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src\components\Cookies.svelte generated by Svelte v3.53.1 */

    const { console: console_1$4 } = globals;
    const file$6 = "src\\components\\Cookies.svelte";

    function create_fragment$6(ctx) {
    	let body;
    	let div3;
    	let div2;
    	let div1;
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let p;
    	let t1_value = /*$_*/ ctx[0]("homepage.cookies") + "";
    	let t1;
    	let t2;
    	let button0;
    	let t3_value = /*$_*/ ctx[0]("homepage.acceptCookies") + "";
    	let t3;
    	let t4;
    	let t5;
    	let button1;
    	let t6_value = /*$_*/ ctx[0]("homepage.declineCookies") + "";
    	let t6;
    	let t7;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			body = element("body");
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			p = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			button0 = element("button");
    			t3 = text(t3_value);
    			t4 = text("! 🍪");
    			t5 = space();
    			button1 = element("button");
    			t6 = text(t6_value);
    			t7 = text(" 😋");
    			this.h();
    		},
    		l: function claim(nodes) {
    			body = claim_element(nodes, "BODY", { class: true });
    			var body_nodes = children(body);
    			div3 = claim_element(body_nodes, "DIV", { id: true, class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			img = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
    			t0 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t1 = claim_text(p_nodes, t1_value);
    			p_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			button0 = claim_element(div0_nodes, "BUTTON", { id: true, class: true });
    			var button0_nodes = children(button0);
    			t3 = claim_text(button0_nodes, t3_value);
    			t4 = claim_text(button0_nodes, "! 🍪");
    			button0_nodes.forEach(detach_dev);
    			t5 = claim_space(div0_nodes);
    			button1 = claim_element(div0_nodes, "BUTTON", { id: true, class: true });
    			var button1_nodes = children(button1);
    			t6 = claim_text(button1_nodes, t6_value);
    			t7 = claim_text(button1_nodes, " 😋");
    			button1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			body_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = "/static/images/pngwing.com.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "cookies-girl");
    			attr_dev(img, "class", "cookies-img svelte-1gp47qu");
    			add_location(img, file$6, 68, 20, 2546);
    			attr_dev(p, "class", "svelte-1gp47qu");
    			add_location(p, file$6, 73, 20, 2747);
    			attr_dev(button0, "id", "cookies-btn");
    			attr_dev(button0, "class", "svelte-1gp47qu");
    			add_location(button0, file$6, 77, 20, 2936);
    			attr_dev(button1, "id", "cookies-decline-btn");
    			attr_dev(button1, "class", "svelte-1gp47qu");
    			add_location(button1, file$6, 78, 20, 3043);
    			attr_dev(div0, "class", "cookies svelte-1gp47qu");
    			add_location(div0, file$6, 67, 16, 2503);
    			attr_dev(div1, "class", "subcontainer svelte-1gp47qu");
    			add_location(div1, file$6, 66, 12, 2459);
    			attr_dev(div2, "class", "container svelte-1gp47qu");
    			add_location(div2, file$6, 65, 8, 2422);
    			attr_dev(div3, "id", "cookies");
    			attr_dev(div3, "class", "svelte-1gp47qu");
    			add_location(div3, file$6, 64, 4, 2394);
    			attr_dev(body, "class", "svelte-1gp47qu");
    			add_location(body, file$6, 63, 0, 2382);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, body, anchor);
    			append_hydration_dev(body, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, img);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, button0);
    			append_hydration_dev(button0, t3);
    			append_hydration_dev(button0, t4);
    			append_hydration_dev(div0, t5);
    			append_hydration_dev(div0, button1);
    			append_hydration_dev(button1, t6);
    			append_hydration_dev(button1, t7);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*acceptCookie*/ ctx[1].call(null, button0)),
    					action_destroyer(/*declineCookie*/ ctx[2].call(null, button1))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$_*/ 1 && t1_value !== (t1_value = /*$_*/ ctx[0]("homepage.cookies") + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*$_*/ 1 && t3_value !== (t3_value = /*$_*/ ctx[0]("homepage.acceptCookies") + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*$_*/ 1 && t6_value !== (t6_value = /*$_*/ ctx[0]("homepage.declineCookies") + "")) set_data_dev(t6, t6_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $_;
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(0, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Cookies', slots, []);

    	const acceptCookie = () => {
    		const setCookie = (cName, cValue, expDays) => {
    			let date = new Date();
    			date.setTime(date.getTime() + expDays * 24 * 60 * 60 * 1000);
    			const expires = "expires=" + date.toUTCString();
    			document.cookie = cName + "=" + cValue + ";" + expires + "; path=/";
    		};

    		const getCookie = cName => {
    			const name = cName + "=";
    			const decodedCookie = decodeURIComponent(document.cookie);
    			const cArr = decodedCookie.split("; ");
    			let value;

    			cArr.forEach(val => {
    				if (val.indexOf(name) === 0) {
    					value = val.substring(name.length);
    				}
    			});

    			return value;
    		};

    		document.getElementById("cookies-btn").addEventListener("click", () => {
    			document.getElementById("cookies").style.display = "none";
    			setCookie("cookie", true, 30);
    			console.log("cookie");
    			var addGoogleAnalytics = document.createElement("script");
    			addGoogleAnalytics.setAttribute("src", "https://www.googletagmanager.com/gtag/js?id=UA-144484874-6");
    			addGoogleAnalytics.async = "true";
    			document.head.appendChild(addGoogleAnalytics);
    			var addDataLayer = document.createElement("script");
    			var dataLayerData = document.createTextNode("window.dataLayer = window.dataLayer || []; \n function gtag(){dataLayer.push(arguments);} \n gtag('js', new Date()); \n gtag('config', 'G-MYIDHERE');");
    			addDataLayer.appendChild(dataLayerData);
    			document.head.appendChild(addDataLayer);
    		});

    		const cookieMsg = () => {
    			if (!getCookie("cookie")) {
    				document.getElementById("cookies").style.display = "block";
    			}
    		};

    		window.addEventListener("load", cookieMsg);
    	};

    	const declineCookie = () => {
    		document.getElementById("cookies-decline-btn").addEventListener("click", () => {
    			document.getElementById("cookies").style.display = "none";
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$4.warn(`<Cookies> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ _: Y, acceptCookie, declineCookie, $_ });
    	return [$_, acceptCookie, declineCookie];
    }

    class Cookies extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cookies",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\components\Accessibility.svelte generated by Svelte v3.53.1 */

    const { console: console_1$3 } = globals;
    const file$5 = "src\\components\\Accessibility.svelte";

    // (94:4) {#if show}
    function create_if_block$4(ctx) {
    	let aside;
    	let p0;
    	let t0_value = /*$_*/ ctx[1]("homepage.accTextSize") + "";
    	let t0;
    	let t1;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let img1;
    	let img1_src_value;
    	let t3;
    	let p1;
    	let t4_value = /*$_*/ ctx[1]("homepage.accLetterSpacing") + "";
    	let t4;
    	let t5;
    	let div1;
    	let img2;
    	let img2_src_value;
    	let t6;
    	let img3;
    	let img3_src_value;
    	let t7;
    	let p2;
    	let t8_value = /*$_*/ ctx[1]("homepage.accWordSpacing") + "";
    	let t8;
    	let t9;
    	let div2;
    	let img4;
    	let img4_src_value;
    	let t10;
    	let img5;
    	let img5_src_value;
    	let t11;
    	let p3;
    	let t12_value = /*$_*/ ctx[1]("homepage.accLineHeight") + "";
    	let t12;
    	let t13;
    	let div3;
    	let img6;
    	let img6_src_value;
    	let t14;
    	let img7;
    	let img7_src_value;
    	let aside_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			aside = element("aside");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			img0 = element("img");
    			t2 = space();
    			img1 = element("img");
    			t3 = space();
    			p1 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			img2 = element("img");
    			t6 = space();
    			img3 = element("img");
    			t7 = space();
    			p2 = element("p");
    			t8 = text(t8_value);
    			t9 = space();
    			div2 = element("div");
    			img4 = element("img");
    			t10 = space();
    			img5 = element("img");
    			t11 = space();
    			p3 = element("p");
    			t12 = text(t12_value);
    			t13 = space();
    			div3 = element("div");
    			img6 = element("img");
    			t14 = space();
    			img7 = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			aside = claim_element(nodes, "ASIDE", { class: true });
    			var aside_nodes = children(aside);
    			p0 = claim_element(aside_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t0 = claim_text(p0_nodes, t0_value);
    			p0_nodes.forEach(detach_dev);
    			t1 = claim_space(aside_nodes);
    			div0 = claim_element(aside_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			img0 = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
    			t2 = claim_space(div0_nodes);
    			img1 = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
    			div0_nodes.forEach(detach_dev);
    			t3 = claim_space(aside_nodes);
    			p1 = claim_element(aside_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t4 = claim_text(p1_nodes, t4_value);
    			p1_nodes.forEach(detach_dev);
    			t5 = claim_space(aside_nodes);
    			div1 = claim_element(aside_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			img2 = claim_element(div1_nodes, "IMG", { src: true, alt: true, class: true });
    			t6 = claim_space(div1_nodes);
    			img3 = claim_element(div1_nodes, "IMG", { src: true, alt: true, class: true });
    			div1_nodes.forEach(detach_dev);
    			t7 = claim_space(aside_nodes);
    			p2 = claim_element(aside_nodes, "P", { class: true });
    			var p2_nodes = children(p2);
    			t8 = claim_text(p2_nodes, t8_value);
    			p2_nodes.forEach(detach_dev);
    			t9 = claim_space(aside_nodes);
    			div2 = claim_element(aside_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			img4 = claim_element(div2_nodes, "IMG", { src: true, alt: true, class: true });
    			t10 = claim_space(div2_nodes);
    			img5 = claim_element(div2_nodes, "IMG", { src: true, alt: true, class: true });
    			div2_nodes.forEach(detach_dev);
    			t11 = claim_space(aside_nodes);
    			p3 = claim_element(aside_nodes, "P", { class: true });
    			var p3_nodes = children(p3);
    			t12 = claim_text(p3_nodes, t12_value);
    			p3_nodes.forEach(detach_dev);
    			t13 = claim_space(aside_nodes);
    			div3 = claim_element(aside_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			img6 = claim_element(div3_nodes, "IMG", { src: true, alt: true, class: true });
    			t14 = claim_space(div3_nodes);
    			img7 = claim_element(div3_nodes, "IMG", { src: true, alt: true, class: true });
    			div3_nodes.forEach(detach_dev);
    			aside_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p0, "class", "svelte-a1haf3");
    			add_location(p0, file$5, 95, 12, 2543);
    			if (!src_url_equal(img0.src, img0_src_value = "/static/images/decrease-font.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "Decrease text size");
    			attr_dev(img0, "class", "fontsize-plus-btn svelte-a1haf3");
    			add_location(img0, file$5, 98, 16, 2647);
    			if (!src_url_equal(img1.src, img1_src_value = "/static/images/increase-font.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "Increase text size");
    			attr_dev(img1, "class", "fontsize-minus-btn svelte-a1haf3");
    			add_location(img1, file$5, 104, 16, 2891);
    			attr_dev(div0, "class", "accessibility-sidebar svelte-a1haf3");
    			add_location(div0, file$5, 97, 12, 2594);
    			attr_dev(p1, "class", "svelte-a1haf3");
    			add_location(p1, file$5, 112, 12, 3154);
    			if (!src_url_equal(img2.src, img2_src_value = "/static/images/decrease-font-size.png")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "Decrease text size");
    			attr_dev(img2, "class", "letter-spacing-btn svelte-a1haf3");
    			add_location(img2, file$5, 115, 16, 3263);
    			if (!src_url_equal(img3.src, img3_src_value = "/static/images/increase-font-size.png")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "Increase text size");
    			attr_dev(img3, "class", "letter-spacing-btn svelte-a1haf3");
    			add_location(img3, file$5, 121, 16, 3518);
    			attr_dev(div1, "class", "accessibility-sidebar svelte-a1haf3");
    			add_location(div1, file$5, 114, 12, 3210);
    			attr_dev(p2, "class", "svelte-a1haf3");
    			add_location(p2, file$5, 129, 12, 3791);
    			if (!src_url_equal(img4.src, img4_src_value = "/static/images/decrease.png")) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "Decrease text size");
    			attr_dev(img4, "class", "word-btn svelte-a1haf3");
    			add_location(img4, file$5, 132, 16, 3898);
    			if (!src_url_equal(img5.src, img5_src_value = "/static/images/increase.png")) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "Increase text size");
    			attr_dev(img5, "class", "word-btn svelte-a1haf3");
    			add_location(img5, file$5, 138, 16, 4131);
    			attr_dev(div2, "class", "accessibility-sidebar svelte-a1haf3");
    			add_location(div2, file$5, 131, 12, 3845);
    			attr_dev(p3, "class", "svelte-a1haf3");
    			add_location(p3, file$5, 146, 12, 4382);
    			if (!src_url_equal(img6.src, img6_src_value = "/static/images/decrease-line-spacing.png")) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "Decrease line spacing");
    			attr_dev(img6, "class", "line-height-btn svelte-a1haf3");
    			add_location(img6, file$5, 149, 16, 4488);
    			if (!src_url_equal(img7.src, img7_src_value = "/static/images/increase-line-spacing.png")) attr_dev(img7, "src", img7_src_value);
    			attr_dev(img7, "alt", "Increase line spacing");
    			attr_dev(img7, "class", "line-height-btn svelte-a1haf3");
    			add_location(img7, file$5, 155, 16, 4744);
    			attr_dev(div3, "class", "accessibility-sidebar svelte-a1haf3");
    			add_location(div3, file$5, 148, 12, 4435);
    			attr_dev(aside, "class", "svelte-a1haf3");
    			add_location(aside, file$5, 94, 8, 2482);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, aside, anchor);
    			append_hydration_dev(aside, p0);
    			append_hydration_dev(p0, t0);
    			append_hydration_dev(aside, t1);
    			append_hydration_dev(aside, div0);
    			append_hydration_dev(div0, img0);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, img1);
    			append_hydration_dev(aside, t3);
    			append_hydration_dev(aside, p1);
    			append_hydration_dev(p1, t4);
    			append_hydration_dev(aside, t5);
    			append_hydration_dev(aside, div1);
    			append_hydration_dev(div1, img2);
    			append_hydration_dev(div1, t6);
    			append_hydration_dev(div1, img3);
    			append_hydration_dev(aside, t7);
    			append_hydration_dev(aside, p2);
    			append_hydration_dev(p2, t8);
    			append_hydration_dev(aside, t9);
    			append_hydration_dev(aside, div2);
    			append_hydration_dev(div2, img4);
    			append_hydration_dev(div2, t10);
    			append_hydration_dev(div2, img5);
    			append_hydration_dev(aside, t11);
    			append_hydration_dev(aside, p3);
    			append_hydration_dev(p3, t12);
    			append_hydration_dev(aside, t13);
    			append_hydration_dev(aside, div3);
    			append_hydration_dev(div3, img6);
    			append_hydration_dev(div3, t14);
    			append_hydration_dev(div3, img7);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(img0, "click", /*decreaseFontSize*/ ctx[3], false, false, false),
    					listen_dev(img1, "click", /*increaseFontSize*/ ctx[2], false, false, false),
    					listen_dev(img2, "click", /*decreaseLetterSpacing*/ ctx[5], false, false, false),
    					listen_dev(img3, "click", /*increaseLetterSpacing*/ ctx[4], false, false, false),
    					listen_dev(img4, "click", /*decreaseWordSpacing*/ ctx[7], false, false, false),
    					listen_dev(img5, "click", /*increaseWordSpacing*/ ctx[6], false, false, false),
    					listen_dev(img6, "click", /*decreaseLineSpacing*/ ctx[9], false, false, false),
    					listen_dev(img7, "click", /*increaseLineSpacing*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*$_*/ 2) && t0_value !== (t0_value = /*$_*/ ctx[1]("homepage.accTextSize") + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*$_*/ 2) && t4_value !== (t4_value = /*$_*/ ctx[1]("homepage.accLetterSpacing") + "")) set_data_dev(t4, t4_value);
    			if ((!current || dirty & /*$_*/ 2) && t8_value !== (t8_value = /*$_*/ ctx[1]("homepage.accWordSpacing") + "")) set_data_dev(t8, t8_value);
    			if ((!current || dirty & /*$_*/ 2) && t12_value !== (t12_value = /*$_*/ ctx[1]("homepage.accLineHeight") + "")) set_data_dev(t12, t12_value);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!aside_transition) aside_transition = create_bidirectional_transition(aside, fly, { x: 250, opacity: 1 }, true);
    				aside_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!aside_transition) aside_transition = create_bidirectional_transition(aside, fly, { x: 250, opacity: 1 }, false);
    			aside_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(aside);
    			if (detaching && aside_transition) aside_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(94:4) {#if show}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let body;
    	let button;
    	let img;
    	let img_src_value;
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*show*/ ctx[0] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			body = element("body");
    			button = element("button");
    			img = element("img");
    			t = space();
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			body = claim_element(nodes, "BODY", { class: true });
    			var body_nodes = children(body);
    			button = claim_element(body_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			img = claim_element(button_nodes, "IMG", { class: true, src: true, alt: true });
    			button_nodes.forEach(detach_dev);
    			t = claim_space(body_nodes);
    			if (if_block) if_block.l(body_nodes);
    			body_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "accessibility-img svelte-a1haf3");
    			if (!src_url_equal(img.src, img_src_value = "/static/images/accessibility.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "accessibility icon");
    			add_location(img, file$5, 86, 8, 2294);
    			attr_dev(button, "class", "accessibility-btn svelte-a1haf3");
    			add_location(button, file$5, 85, 4, 2218);
    			attr_dev(body, "class", "svelte-a1haf3");
    			add_location(body, file$5, 84, 0, 2206);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, body, anchor);
    			append_hydration_dev(body, button);
    			append_hydration_dev(button, img);
    			append_hydration_dev(body, t);
    			if (if_block) if_block.m(body, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*show*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*show*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(body, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (detaching) detach_dev(body);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
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

    function toggleAcc() {
    	console.log("accessibility btn clicked");
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $_;
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(1, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Accessibility', slots, []);
    	let show = false;
    	let fontSize = 1.2;

    	//document.getElementsByTagName("body")[0].style["font-size"] = "1.2rem";
    	const increaseFontSize = () => {
    		fontSize += 0.2;
    		document.getElementsByTagName("html")[0].style["font-size"] = `${fontSize}rem`;
    	}; /* var existing_size = document.getElementsByTagName( "body" )[0].style[ "font-size" ];
    var int_value = parseInt(existing_size.replace( "rem", "" ));
    int_value ++;
    document.getElementsByTagName( "body" )[0].style[ "font-size" ] = int_value + "rem"; */

    	function decreaseFontSize() {
    		fontSize -= 0.2;
    		document.getElementsByTagName("html")[0].style["font-size"] = `${fontSize}rem`;
    	}

    	let letterSpacing = 1;

    	function increaseLetterSpacing() {
    		letterSpacing += 2;
    		document.getElementsByTagName("html")[0].style["letter-spacing"] = `${letterSpacing}px`;
    	}

    	function decreaseLetterSpacing() {
    		letterSpacing -= 2;
    		document.getElementsByTagName("html")[0].style["letter-spacing"] = `${letterSpacing}px`;
    	}

    	let wordSpacing = 1;

    	function increaseWordSpacing() {
    		wordSpacing += 5;
    		document.getElementsByTagName("html")[0].style["word-spacing"] = `${wordSpacing}px`;
    	}

    	function decreaseWordSpacing() {
    		wordSpacing -= 5;
    		document.getElementsByTagName("html")[0].style["word-spacing"] = `${wordSpacing}px`;
    	}

    	let lineSpacing = 24;

    	function increaseLineSpacing() {
    		lineSpacing += 10;
    		document.getElementsByTagName("html")[0].style["line-height"] = `${lineSpacing}px`;
    	}

    	function decreaseLineSpacing() {
    		lineSpacing -= 10;
    		document.getElementsByTagName("html")[0].style["line-height"] = `${lineSpacing}px`;
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Accessibility> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, show = !show);

    	$$self.$capture_state = () => ({
    		_: Y,
    		fly,
    		toggleAcc,
    		show,
    		fontSize,
    		increaseFontSize,
    		decreaseFontSize,
    		letterSpacing,
    		increaseLetterSpacing,
    		decreaseLetterSpacing,
    		wordSpacing,
    		increaseWordSpacing,
    		decreaseWordSpacing,
    		lineSpacing,
    		increaseLineSpacing,
    		decreaseLineSpacing,
    		$_
    	});

    	$$self.$inject_state = $$props => {
    		if ('show' in $$props) $$invalidate(0, show = $$props.show);
    		if ('fontSize' in $$props) fontSize = $$props.fontSize;
    		if ('letterSpacing' in $$props) letterSpacing = $$props.letterSpacing;
    		if ('wordSpacing' in $$props) wordSpacing = $$props.wordSpacing;
    		if ('lineSpacing' in $$props) lineSpacing = $$props.lineSpacing;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		show,
    		$_,
    		increaseFontSize,
    		decreaseFontSize,
    		increaseLetterSpacing,
    		decreaseLetterSpacing,
    		increaseWordSpacing,
    		decreaseWordSpacing,
    		increaseLineSpacing,
    		decreaseLineSpacing,
    		click_handler
    	];
    }

    class Accessibility extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Accessibility",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\components\Help.svelte generated by Svelte v3.53.1 */

    const { console: console_1$2 } = globals;
    const file$4 = "src\\components\\Help.svelte";

    // (17:4) {#if showDesc}
    function create_if_block$3(ctx) {
    	let article;
    	let h3;
    	let t0_value = /*$_*/ ctx[2]("homepage.helpTitle") + "";
    	let t0;
    	let t1;
    	let div0;
    	let p0;
    	let t2_value = /*$_*/ ctx[2]("homepage.helpP1") + "";
    	let t2;
    	let t3;
    	let br0;
    	let t4;
    	let p1;
    	let t5_value = /*$_*/ ctx[2]("homepage.helpP2") + "";
    	let t5;
    	let t6;
    	let p2;
    	let t7_value = /*$_*/ ctx[2]("homepage.helpP3") + "";
    	let t7;
    	let t8;
    	let br1;
    	let t9;
    	let p3;
    	let t10_value = /*$_*/ ctx[2]("homepage.helpP4") + "";
    	let t10;
    	let t11;
    	let div1;
    	let button;
    	let t12_value = /*$_*/ ctx[2]("homepage.helpContinue") + "";
    	let t12;
    	let article_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			article = element("article");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			p0 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			br0 = element("br");
    			t4 = space();
    			p1 = element("p");
    			t5 = text(t5_value);
    			t6 = space();
    			p2 = element("p");
    			t7 = text(t7_value);
    			t8 = space();
    			br1 = element("br");
    			t9 = space();
    			p3 = element("p");
    			t10 = text(t10_value);
    			t11 = space();
    			div1 = element("div");
    			button = element("button");
    			t12 = text(t12_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			article = claim_element(nodes, "ARTICLE", { alt: true, class: true });
    			var article_nodes = children(article);
    			h3 = claim_element(article_nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t0 = claim_text(h3_nodes, t0_value);
    			h3_nodes.forEach(detach_dev);
    			t1 = claim_space(article_nodes);
    			div0 = claim_element(article_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			p0 = claim_element(div0_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t2 = claim_text(p0_nodes, t2_value);
    			p0_nodes.forEach(detach_dev);
    			t3 = claim_space(div0_nodes);
    			br0 = claim_element(div0_nodes, "BR", { class: true });
    			t4 = claim_space(div0_nodes);
    			p1 = claim_element(div0_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t5 = claim_text(p1_nodes, t5_value);
    			p1_nodes.forEach(detach_dev);
    			t6 = claim_space(div0_nodes);
    			p2 = claim_element(div0_nodes, "P", { class: true });
    			var p2_nodes = children(p2);
    			t7 = claim_text(p2_nodes, t7_value);
    			p2_nodes.forEach(detach_dev);
    			t8 = claim_space(div0_nodes);
    			br1 = claim_element(div0_nodes, "BR", { class: true });
    			t9 = claim_space(div0_nodes);
    			p3 = claim_element(div0_nodes, "P", { class: true });
    			var p3_nodes = children(p3);
    			t10 = claim_text(p3_nodes, t10_value);
    			p3_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t11 = claim_space(article_nodes);
    			div1 = claim_element(article_nodes, "DIV", {});
    			var div1_nodes = children(div1);
    			button = claim_element(div1_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t12 = claim_text(button_nodes, t12_value);
    			button_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			article_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h3, "class", "svelte-f5d2kr");
    			add_location(h3, file$4, 21, 12, 478);
    			attr_dev(p0, "class", "svelte-f5d2kr");
    			add_location(p0, file$4, 23, 16, 563);
    			attr_dev(br0, "class", "svelte-f5d2kr");
    			add_location(br0, file$4, 26, 16, 651);
    			attr_dev(p1, "class", "svelte-f5d2kr");
    			add_location(p1, file$4, 27, 16, 675);
    			attr_dev(p2, "class", "svelte-f5d2kr");
    			add_location(p2, file$4, 30, 16, 763);
    			attr_dev(br1, "class", "svelte-f5d2kr");
    			add_location(br1, file$4, 33, 16, 851);
    			attr_dev(p3, "class", "svelte-f5d2kr");
    			add_location(p3, file$4, 34, 16, 875);
    			attr_dev(div0, "class", "text svelte-f5d2kr");
    			add_location(div0, file$4, 22, 12, 527);
    			attr_dev(button, "class", "continueBTN svelte-f5d2kr");
    			add_location(button, file$4, 41, 16, 1160);
    			add_location(div1, file$4, 38, 12, 979);
    			attr_dev(article, "alt", "Photo by Tim Mossholder on Unsplash");
    			attr_dev(article, "class", "svelte-f5d2kr");
    			add_location(article, file$4, 17, 8, 349);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, article, anchor);
    			append_hydration_dev(article, h3);
    			append_hydration_dev(h3, t0);
    			append_hydration_dev(article, t1);
    			append_hydration_dev(article, div0);
    			append_hydration_dev(div0, p0);
    			append_hydration_dev(p0, t2);
    			append_hydration_dev(div0, t3);
    			append_hydration_dev(div0, br0);
    			append_hydration_dev(div0, t4);
    			append_hydration_dev(div0, p1);
    			append_hydration_dev(p1, t5);
    			append_hydration_dev(div0, t6);
    			append_hydration_dev(div0, p2);
    			append_hydration_dev(p2, t7);
    			append_hydration_dev(div0, t8);
    			append_hydration_dev(div0, br1);
    			append_hydration_dev(div0, t9);
    			append_hydration_dev(div0, p3);
    			append_hydration_dev(p3, t10);
    			append_hydration_dev(article, t11);
    			append_hydration_dev(article, div1);
    			append_hydration_dev(div1, button);
    			append_hydration_dev(button, t12);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_1*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*$_*/ 4) && t0_value !== (t0_value = /*$_*/ ctx[2]("homepage.helpTitle") + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*$_*/ 4) && t2_value !== (t2_value = /*$_*/ ctx[2]("homepage.helpP1") + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*$_*/ 4) && t5_value !== (t5_value = /*$_*/ ctx[2]("homepage.helpP2") + "")) set_data_dev(t5, t5_value);
    			if ((!current || dirty & /*$_*/ 4) && t7_value !== (t7_value = /*$_*/ ctx[2]("homepage.helpP3") + "")) set_data_dev(t7, t7_value);
    			if ((!current || dirty & /*$_*/ 4) && t10_value !== (t10_value = /*$_*/ ctx[2]("homepage.helpP4") + "")) set_data_dev(t10, t10_value);
    			if ((!current || dirty & /*$_*/ 4) && t12_value !== (t12_value = /*$_*/ ctx[2]("homepage.helpContinue") + "")) set_data_dev(t12, t12_value);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!article_transition) article_transition = create_bidirectional_transition(article, fly, { y: -20 }, true);
    				article_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!article_transition) article_transition = create_bidirectional_transition(article, fly, { y: -20 }, false);
    			article_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			if (detaching && article_transition) article_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(17:4) {#if showDesc}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let main;
    	let button;
    	let t0;
    	let t1;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*showDesc*/ ctx[1] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			button = element("button");
    			t0 = text("?");
    			t1 = space();
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			main = claim_element(nodes, "MAIN", {});
    			var main_nodes = children(main);
    			button = claim_element(main_nodes, "BUTTON", { class: true, tabindex: true });
    			var button_nodes = children(button);
    			t0 = claim_text(button_nodes, "?");
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(main_nodes);
    			if (if_block) if_block.l(main_nodes);
    			main_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "help-button svelte-f5d2kr");
    			attr_dev(button, "tabindex", "0");
    			add_location(button, file$4, 10, 4, 193);
    			add_location(main, file$4, 9, 0, 181);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, main, anchor);
    			append_hydration_dev(main, button);
    			append_hydration_dev(button, t0);
    			append_hydration_dev(main, t1);
    			if (if_block) if_block.m(main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*keydown_handler*/ ctx[3], false, false, false),
    					listen_dev(button, "click", /*click_handler*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showDesc*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showDesc*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(main, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
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
    	let $_;
    	validate_store(Y, '_');
    	component_subscribe($$self, Y, $$value => $$invalidate(2, $_ = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Help', slots, []);
    	let showDesc = false;
    	let key = "";
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Help> was created with unknown prop '${key}'`);
    	});

    	const keydown_handler = e => $$invalidate(0, key = e.key);
    	const click_handler = () => $$invalidate(1, showDesc = !showDesc);
    	const click_handler_1 = () => $$invalidate(1, showDesc = !showDesc);
    	$$self.$capture_state = () => ({ _: Y, fly, showDesc, key, $_ });

    	$$self.$inject_state = $$props => {
    		if ('showDesc' in $$props) $$invalidate(1, showDesc = $$props.showDesc);
    		if ('key' in $$props) $$invalidate(0, key = $$props.key);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*key*/ 1) {
    			console.log(key);
    		}
    	};

    	return [key, showDesc, $_, keydown_handler, click_handler, click_handler_1];
    }

    class Help extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Help",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\locale\i18n.svelte generated by Svelte v3.53.1 */

    const { console: console_1$1 } = globals;
    const file$3 = "src\\locale\\i18n.svelte";

    function create_fragment$3(ctx) {
    	let body;
    	let select;
    	let option0;
    	let t0;
    	let option1;
    	let t1;
    	let option2;
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			body = element("body");
    			select = element("select");
    			option0 = element("option");
    			t0 = text("🇬🇧");
    			option1 = element("option");
    			t1 = text("🇸🇪");
    			option2 = element("option");
    			t2 = text("🇭🇷");
    			this.h();
    		},
    		l: function claim(nodes) {
    			body = claim_element(nodes, "BODY", {});
    			var body_nodes = children(body);
    			select = claim_element(body_nodes, "SELECT", { class: true });
    			var select_nodes = children(select);
    			option0 = claim_element(select_nodes, "OPTION", { class: true });
    			var option0_nodes = children(option0);
    			t0 = claim_text(option0_nodes, "🇬🇧");
    			option0_nodes.forEach(detach_dev);
    			option1 = claim_element(select_nodes, "OPTION", { class: true });
    			var option1_nodes = children(option1);
    			t1 = claim_text(option1_nodes, "🇸🇪");
    			option1_nodes.forEach(detach_dev);
    			option2 = claim_element(select_nodes, "OPTION", { class: true });
    			var option2_nodes = children(option2);
    			t2 = claim_text(option2_nodes, "🇭🇷");
    			option2_nodes.forEach(detach_dev);
    			select_nodes.forEach(detach_dev);
    			body_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			option0.__value = "en";
    			option0.value = option0.__value;
    			attr_dev(option0, "class", "svelte-qxezx1");
    			add_location(option0, file$3, 15, 8, 353);
    			option1.__value = "sv";
    			option1.value = option1.__value;
    			attr_dev(option1, "class", "svelte-qxezx1");
    			add_location(option1, file$3, 16, 8, 395);
    			option2.__value = "hr";
    			option2.value = option2.__value;
    			attr_dev(option2, "class", "svelte-qxezx1");
    			add_location(option2, file$3, 17, 8, 437);
    			attr_dev(select, "class", "language-img svelte-qxezx1");
    			add_location(select, file$3, 14, 4, 283);
    			add_location(body, file$3, 13, 0, 271);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, body, anchor);
    			append_hydration_dev(body, select);
    			append_hydration_dev(select, option0);
    			append_hydration_dev(option0, t0);
    			append_hydration_dev(select, option1);
    			append_hydration_dev(option1, t1);
    			append_hydration_dev(select, option2);
    			append_hydration_dev(option2, t2);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*handleLocaleChange*/ ctx[0], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    			mounted = false;
    			dispose();
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

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('I18n', slots, []);

    	const handleLocaleChange = e => {
    		e.preventDefault();
    		D.set(e.target.value);
    	};

    	const changeLanguage = () => {
    		console.log("language clicked");
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<I18n> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		locale: D,
    		handleLocaleChange,
    		changeLanguage
    	});

    	return [handleLocaleChange];
    }

    class I18n extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "I18n",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\components\Sound.svelte generated by Svelte v3.53.1 */

    const file$2 = "src\\components\\Sound.svelte";

    // (25:4) {#if !muted}
    function create_if_block$2(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			this.h();
    		},
    		l: function claim(nodes) {
    			input = claim_element(nodes, "INPUT", {
    				class: true,
    				type: true,
    				min: true,
    				max: true,
    				step: true,
    				name: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(input, "class", "slider svelte-1akvqhx");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "100");
    			attr_dev(input, "step", "1");
    			attr_dev(input, "name", "volume");
    			add_location(input, file$2, 25, 4, 728);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, input, anchor);
    			set_input_value(input, /*vol*/ ctx[1]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[5]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[5]),
    					listen_dev(input, "input", /*adjustVol*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*vol*/ 2) {
    				set_input_value(input, /*vol*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(25:4) {#if !muted}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let body;
    	let t;
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;
    	let if_block = !/*muted*/ ctx[0] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			body = element("body");
    			if (if_block) if_block.c();
    			t = space();
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			body = claim_element(nodes, "BODY", {});
    			var body_nodes = children(body);
    			if (if_block) if_block.l(body_nodes);
    			t = claim_space(body_nodes);

    			img = claim_element(body_nodes, "IMG", {
    				class: true,
    				id: true,
    				src: true,
    				alt: true
    			});

    			body_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "sound-img svelte-1akvqhx");
    			attr_dev(img, "id", "sound");
    			if (!src_url_equal(img.src, img_src_value = /*soundImgSrc*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "sound icon");
    			add_location(img, file$2, 36, 4, 936);
    			add_location(body, file$2, 23, 0, 698);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, body, anchor);
    			if (if_block) if_block.m(body, null);
    			append_hydration_dev(body, t);
    			append_hydration_dev(body, img);

    			if (!mounted) {
    				dispose = listen_dev(img, "click", /*muteSound*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*muted*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(body, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*soundImgSrc*/ 4 && !src_url_equal(img.src, img_src_value = /*soundImgSrc*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sound', slots, []);
    	let muted = true;
    	let audioFile = new Audio("music/lightheartedLong.wav");
    	let vol = 50;
    	let soundImgSrc = "static/images/mute.png";

    	// devided by 100 because the audio objects volume property only handels numbers between 1 and 0
    	const adjustVol = () => audioFile.volume = vol / 100;

    	const muteSound = () => {
    		// console.log("sound clicked");
    		$$invalidate(0, muted = !muted);

    		if (muted) {
    			$$invalidate(2, soundImgSrc = "static/images/mute.png");
    			audioFile.pause();
    		} else {
    			$$invalidate(2, soundImgSrc = "static/images/sound.png");
    			audioFile.play();
    			audioFile.loop = true;
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sound> was created with unknown prop '${key}'`);
    	});

    	function input_change_input_handler() {
    		vol = to_number(this.value);
    		$$invalidate(1, vol);
    	}

    	$$self.$capture_state = () => ({
    		muted,
    		audioFile,
    		vol,
    		soundImgSrc,
    		adjustVol,
    		muteSound
    	});

    	$$self.$inject_state = $$props => {
    		if ('muted' in $$props) $$invalidate(0, muted = $$props.muted);
    		if ('audioFile' in $$props) audioFile = $$props.audioFile;
    		if ('vol' in $$props) $$invalidate(1, vol = $$props.vol);
    		if ('soundImgSrc' in $$props) $$invalidate(2, soundImgSrc = $$props.soundImgSrc);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [muted, vol, soundImgSrc, adjustVol, muteSound, input_change_input_handler];
    }

    class Sound extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sound",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\components\Storyline.svelte generated by Svelte v3.53.1 */

    const { console: console_1 } = globals;
    const file$1 = "src\\components\\Storyline.svelte";

    // (41:0) {#if visible}
    function create_if_block$1(ctx) {
    	let article;
    	let article_intro;
    	let article_outro;
    	let current;
    	let if_block = story !== '' && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			article = element("article");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			article = claim_element(nodes, "ARTICLE", { class: true });
    			var article_nodes = children(article);
    			if (if_block) if_block.l(article_nodes);
    			article_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(article, "class", "svelte-1c1g4ub");
    			add_location(article, file$1, 41, 0, 920);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, article, anchor);
    			if (if_block) if_block.m(article, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (story !== '') if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			add_render_callback(() => {
    				if (article_outro) article_outro.end(1);
    				article_intro = create_in_transition(article, fly, { y: -200, duration: 700 });
    				article_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (article_intro) article_intro.invalidate();
    			article_outro = create_out_transition(article, fly, { x: -200, duration: 1500 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			if (if_block) if_block.d();
    			if (detaching && article_outro) article_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(41:0) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (43:4) {#if story !== ''}
    function create_if_block_1(ctx) {
    	let p;
    	let t;
    	let p_intro;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*$story*/ ctx[0]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, /*$story*/ ctx[0]);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(p, "class", "svelte-1c1g4ub");
    			add_location(p, file$1, 43, 4, 1036);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$story*/ 1) set_data_dev(t, /*$story*/ ctx[0]);
    		},
    		i: function intro(local) {
    			if (!p_intro) {
    				add_render_callback(() => {
    					p_intro = create_in_transition(p, typewriter, {});
    					p_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(43:4) {#if story !== ''}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*visible*/ ctx[1] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*visible*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*visible*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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

    function typewriter(node, { speed = 2 }) {
    	const valid = node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE;

    	if (!valid) {
    		throw new Error(`something went wrong`);
    	}

    	const text = node.textContent;
    	const duration = text.length / (speed * 0.01);

    	return {
    		duration,
    		tick: t => {
    			const i = Math.trunc(text.length * t);
    			node.textContent = text.slice(0, i);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $story;
    	validate_store(story, 'story');
    	component_subscribe($$self, story, $$value => $$invalidate(0, $story = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Storyline', slots, []);
    	let visible = false;

    	onMount(() => {
    		if ($story !== '') {
    			$$invalidate(1, visible = true);

    			setTimeout(
    				() => {
    					set_store_value(story, $story = '', $story);
    				},
    				11000
    			);
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Storyline> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		story,
    		fly,
    		onMount,
    		visible,
    		typewriter,
    		$story
    	});

    	$$self.$inject_state = $$props => {
    		if ('visible' in $$props) $$invalidate(1, visible = $$props.visible);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$story*/ 1) {
    			console.log($story);
    		}
    	};

    	return [$story, visible];
    }

    class Storyline extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Storyline",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.53.1 */
    const file = "src\\App.svelte";

    // (50:2) {#if $story !== ''}
    function create_if_block(ctx) {
    	let storyline;
    	let current;
    	storyline = new Storyline({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(storyline.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(storyline.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(storyline, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(storyline.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(storyline.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(storyline, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(50:2) {#if $story !== ''}",
    		ctx
    	});

    	return block;
    }

    // (54:2) <Route path="/">
    function create_default_slot_3(ctx) {
    	let home;
    	let current;
    	home = new Home({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(home.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(home.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(home, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(54:2) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (58:2) <Route path="login">
    function create_default_slot_2(ctx) {
    	let login;
    	let current;
    	login = new Login({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(login.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(login.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(login, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(login.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(login.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(login, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(58:2) <Route path=\\\"login\\\">",
    		ctx
    	});

    	return block;
    }

    // (62:2) <Route path="library">
    function create_default_slot_1(ctx) {
    	let library;
    	let current;
    	library = new Library({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(library.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(library.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(library, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(library.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(library.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(library, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(62:2) <Route path=\\\"library\\\">",
    		ctx
    	});

    	return block;
    }

    // (29:1) <Router {url}>
    function create_default_slot(ctx) {
    	let nav;
    	let t0;
    	let a;
    	let t1;
    	let t2;
    	let accessibility;
    	let t3;
    	let language;
    	let t4;
    	let sound;
    	let t5;
    	let help;
    	let t6;
    	let abilities;
    	let t7;
    	let t8;
    	let route0;
    	let t9;
    	let route1;
    	let t10;
    	let route2;
    	let t11;
    	let protectedroute;
    	let current;
    	accessibility = new Accessibility({ $$inline: true });
    	language = new I18n({ $$inline: true });
    	sound = new Sound({ $$inline: true });
    	help = new Help({ $$inline: true });
    	abilities = new Abilities({ $$inline: true });
    	let if_block = /*$story*/ ctx[1] !== '' && create_if_block(ctx);

    	route0 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route1 = new Route({
    			props: {
    				path: "login",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route2 = new Route({
    			props: {
    				path: "library",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	protectedroute = new ProtectedRoute({
    			props: { path: "dashboard", component: Dashboard },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			t0 = space();
    			a = element("a");
    			t1 = text("dimh");
    			t2 = space();
    			create_component(accessibility.$$.fragment);
    			t3 = space();
    			create_component(language.$$.fragment);
    			t4 = space();
    			create_component(sound.$$.fragment);
    			t5 = space();
    			create_component(help.$$.fragment);
    			t6 = space();
    			create_component(abilities.$$.fragment);
    			t7 = space();
    			if (if_block) if_block.c();
    			t8 = space();
    			create_component(route0.$$.fragment);
    			t9 = space();
    			create_component(route1.$$.fragment);
    			t10 = space();
    			create_component(route2.$$.fragment);
    			t11 = space();
    			create_component(protectedroute.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav = claim_element(nodes, "NAV", { class: true });
    			var nav_nodes = children(nav);
    			nav_nodes.forEach(detach_dev);
    			t0 = claim_space(nodes);

    			a = claim_element(nodes, "A", {
    				href: true,
    				target: true,
    				rel: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			t1 = claim_text(a_nodes, "dimh");
    			a_nodes.forEach(detach_dev);
    			t2 = claim_space(nodes);
    			claim_component(accessibility.$$.fragment, nodes);
    			t3 = claim_space(nodes);
    			claim_component(language.$$.fragment, nodes);
    			t4 = claim_space(nodes);
    			claim_component(sound.$$.fragment, nodes);
    			t5 = claim_space(nodes);
    			claim_component(help.$$.fragment, nodes);
    			t6 = claim_space(nodes);
    			claim_component(abilities.$$.fragment, nodes);
    			t7 = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			t8 = claim_space(nodes);
    			claim_component(route0.$$.fragment, nodes);
    			t9 = claim_space(nodes);
    			claim_component(route1.$$.fragment, nodes);
    			t10 = claim_space(nodes);
    			claim_component(route2.$$.fragment, nodes);
    			t11 = claim_space(nodes);
    			claim_component(protectedroute.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(nav, "class", "svelte-1tgxu5a");
    			add_location(nav, file, 29, 2, 1054);
    			attr_dev(a, "href", "https://www.di-mh.com/");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "rel", "noreferrer");
    			attr_dev(a, "class", "svelte-1tgxu5a");
    			add_location(a, file, 36, 2, 1291);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, t1);
    			insert_hydration_dev(target, t2, anchor);
    			mount_component(accessibility, target, anchor);
    			insert_hydration_dev(target, t3, anchor);
    			mount_component(language, target, anchor);
    			insert_hydration_dev(target, t4, anchor);
    			mount_component(sound, target, anchor);
    			insert_hydration_dev(target, t5, anchor);
    			mount_component(help, target, anchor);
    			insert_hydration_dev(target, t6, anchor);
    			mount_component(abilities, target, anchor);
    			insert_hydration_dev(target, t7, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, t8, anchor);
    			mount_component(route0, target, anchor);
    			insert_hydration_dev(target, t9, anchor);
    			mount_component(route1, target, anchor);
    			insert_hydration_dev(target, t10, anchor);
    			mount_component(route2, target, anchor);
    			insert_hydration_dev(target, t11, anchor);
    			mount_component(protectedroute, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*$story*/ ctx[1] !== '') {
    				if (if_block) {
    					if (dirty & /*$story*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t8.parentNode, t8);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			const route0_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route0_changes.$$scope = { dirty, ctx };
    			}

    			route0.$set(route0_changes);
    			const route1_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
    			const route2_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route2_changes.$$scope = { dirty, ctx };
    			}

    			route2.$set(route2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(accessibility.$$.fragment, local);
    			transition_in(language.$$.fragment, local);
    			transition_in(sound.$$.fragment, local);
    			transition_in(help.$$.fragment, local);
    			transition_in(abilities.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(protectedroute.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(accessibility.$$.fragment, local);
    			transition_out(language.$$.fragment, local);
    			transition_out(sound.$$.fragment, local);
    			transition_out(help.$$.fragment, local);
    			transition_out(abilities.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(protectedroute.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t2);
    			destroy_component(accessibility, detaching);
    			if (detaching) detach_dev(t3);
    			destroy_component(language, detaching);
    			if (detaching) detach_dev(t4);
    			destroy_component(sound, detaching);
    			if (detaching) detach_dev(t5);
    			destroy_component(help, detaching);
    			if (detaching) detach_dev(t6);
    			destroy_component(abilities, detaching);
    			if (detaching) detach_dev(t7);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t8);
    			destroy_component(route0, detaching);
    			if (detaching) detach_dev(t9);
    			destroy_component(route1, detaching);
    			if (detaching) detach_dev(t10);
    			destroy_component(route2, detaching);
    			if (detaching) detach_dev(t11);
    			destroy_component(protectedroute, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(29:1) <Router {url}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let body;
    	let cookies;
    	let t;
    	let router;
    	let current;
    	cookies = new Cookies({ $$inline: true });

    	router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			body = element("body");
    			create_component(cookies.$$.fragment);
    			t = space();
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			body = claim_element(nodes, "BODY", {});
    			var body_nodes = children(body);
    			claim_component(cookies.$$.fragment, body_nodes);
    			t = claim_space(body_nodes);
    			claim_component(router.$$.fragment, body_nodes);
    			body_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(body, file, 23, 0, 978);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, body, anchor);
    			mount_component(cookies, body, null);
    			append_hydration_dev(body, t);
    			mount_component(router, body, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope, $story*/ 6) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cookies.$$.fragment, local);
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cookies.$$.fragment, local);
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(body);
    			destroy_component(cookies);
    			destroy_component(router);
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
    	let $story;
    	validate_store(story, 'story');
    	component_subscribe($$self, story, $$value => $$invalidate(1, $story = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { url = "" } = $$props;
    	const writable_props = ['url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	$$self.$capture_state = () => ({
    		Router,
    		Route,
    		Link,
    		story,
    		Login,
    		Home,
    		Dashboard,
    		ProtectedRoute,
    		Library,
    		Abilities,
    		AllProjects,
    		Cookies,
    		Accessibility,
    		Help,
    		Language: I18n,
    		Sound,
    		Storyline,
    		_: Y,
    		url,
    		$story
    	});

    	$$self.$inject_state = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [url, $story];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { url: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get url() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var descendantsTitle$2 = "Descendants";
    var adolescenceBalanceTitle$2 = "Adolescence Balance";
    var supportandmobilityTitle$2 = "Support and Mobility";
    var primarycareTitle$2 = "Primary Care";
    var informatoryTitle$2 = "Informatory";
    var libraryForward$2 = "Forward";
    var libraryBackward$2 = "Backward";
    var closeTheBook$2 = "Put back";
    var homepage$2 = {
    	allProjects: "All projects",
    	cookies: "This website uses cookies to ensure you get the best experience on our website.",
    	acceptCookies: "Yum, cookies",
    	declineCookies: "No, thanks",
    	accTextSize: "Change text size:",
    	accLetterSpacing: "Change letter spacing:",
    	accWordSpacing: "Change word spacing:",
    	accLineHeight: "Change line height:",
    	helpTitle: "Welcome to the library!",
    	helpP1: "To move you can scroll up or down. You can also use the up and down arrow keys!",
    	helpP2: "When you find a book try clicking on it to read about our awesome projects :)",
    	helpP3: "Or use the tab button to tab to a book and then push Enter to open and close it. To tab backwards use Shift+Tab.",
    	helpP4: "If you need any help just click on the ? in the up right corner ;)",
    	helpContinue: "Continue",
    	welcomeText: "Welcome to the library! You are one CLICK/ENTER away from crossing the threshold of its magical world…"
    };
    var library$2 = {
    	dialogSven1: "Hello there! I am so happy you are here! I seem to have misplaced some books in the library and I need you to help me find them.",
    	dialogGirl1: "I would love to help you!",
    	dialogSven2: "I am forever grateful! If you just SCROLL deeper into the library, I am sure you will have no trouble in finding them along the way. If scrolling makes movement too quick for your taste, you are welcome to PRESS DOWN and slow things around.",
    	dialogSven3: "I see that you have not only gotten all of my books back to me but have also reached your full potential by becoming a fairy! I am forever in your debt!",
    	dialogFairy2: "Thank you for sending me on this mission, Sven. It is time for me to go where the real magic happens!",
    	btnText1: "Next",
    	btnText2: "Continue",
    	talkToSven: "Talk to Sven",
    	lobby: "Back to lobby"
    };
    var category1$2 = {
    	cat1inst1: "It seems you have found some of Sven's books! Best is to check them out to make sure you got the right ones!",
    	cat2inst2: "It seems reading books makes you get awards like these wings! Maybe you can use them to fly away in search for the rest of the books!"
    };
    var category2$2 = {
    	cat2inst: "WOW - you just got the spell casting ability! Just remember to cast some spells if you will be having trouble with finding Sven's books!"
    };
    var category3$2 = {
    	cat3inst: "You have been turning into quite a little fairy - first wings, then spell casting, and now fairy dust! I wonder if you will need to throw it in the next chapter to find those books!"
    };
    var category4$2 = {
    	cat4inst: "There seems to be some darkness approaching - good that you were awarded with the light. Keep on going and watch your step!"
    };
    var category5$2 = {
    	cat5inst: "You made it! You have found all Sven's books and got the biggest award a fairy could wish for - a magic wand! Let us go and tell Sven about our adventures!"
    };
    var en = {
    	descendantsTitle: descendantsTitle$2,
    	adolescenceBalanceTitle: adolescenceBalanceTitle$2,
    	supportandmobilityTitle: supportandmobilityTitle$2,
    	primarycareTitle: primarycareTitle$2,
    	informatoryTitle: informatoryTitle$2,
    	libraryForward: libraryForward$2,
    	libraryBackward: libraryBackward$2,
    	closeTheBook: closeTheBook$2,
    	homepage: homepage$2,
    	library: library$2,
    	category1: category1$2,
    	category2: category2$2,
    	category3: category3$2,
    	category4: category4$2,
    	category5: category5$2
    };

    var descendantsTitle$1 = "Ättlingar";
    var adolescenceBalanceTitle$1 = "Adolescens Balans";
    var supportandmobilityTitle$1 = "Stöd och rörlighet";
    var primarycareTitle$1 = "Primärvård";
    var informatoryTitle$1 = "Informativt";
    var libraryForward$1 = "Fram";
    var libraryBackward$1 = "Bakåt";
    var closeTheBook$1 = "Ställ tillbaka";
    var homepage$1 = {
    	allProjects: "Alla projekt",
    	cookies: "Denna webbplats använder cookies för att säkerställa att du får den bästa upplevelsen på vår webbplats.",
    	acceptCookies: "Mums, cookies",
    	declineCookies: "Nej, tack",
    	accTextSize: "Ändra textstorlek:",
    	accLetterSpacing: "Ändra bokstav avstånd:",
    	accWordSpacing: "Ändra ordavstånd:",
    	accLineHeight: "Ändra linjehöjd:",
    	helpTitle: "Välkommen till biblioteket!",
    	helpP1: "För att flytta kan du bläddra uppåt eller nedåt. Du kan också använda upp- och nedpilarna!",
    	helpP2: "När du hittar en bok, försök att klicka på den för att läsa om våra fantastiska projekt :)",
    	helpP3: "Eller använd tabbknappen för att gå till en bok och tryck sedan på Enter för att öppna och stänga den. För att tabb bakåt använd Skift+Tabb. ",
    	helpP4: " Om du behöver hjälp klickar du bara på ? uppe i högra hörnet ;)",
    	helpContinue: "Fortsätt",
    	welcomeText: "Välkommen till biblioteket! Du är ett KLICK/ENTER ifrån att korsa tröskeln till dess magiska värld..."
    };
    var library$1 = {
    	dialogSven1: "Hejsan! Jag är så glad att du är här! Jag verkar ha tappat bort några böcker i biblioteket och jag behöver hjälp med att hitta dem.",
    	dialogGirl1: "Jag skulle gärna hjälpa dig!",
    	dialogSven2: "Jag är evigt tacksam! Om du bara SCROLLar djupare in i biblioteket är jag säker på att du inte kommer att ha några problem med att hitta dem längs vägen. Om rullning gör rörelsen för snabb för din smak är du välkommen att TRYCK NED och sakta ner sakerna.",
    	dialogSven3: "Jag ser att du inte bara har fått tillbaka alla mina böcker utan också nått din fulla potential genom att bli en älva! Jag står dig i skuld för evigt!",
    	dialogFairy2: "Tack för att du skickade mig på detta uppdrag, Sven. Det är dags för mig att gå dit den verkliga magin händer! https://www.di-mh.com/",
    	btnText1: "Näst",
    	btnText2: "Förtsätta",
    	talkToSven: "Prata med Sven",
    	lobby: "Tillbaka till lobbyn"
    };
    var category1$1 = {
    	cat1inst1: "Det verkar som om du har hittat några av Svens böcker! Bäst är att kolla upp dem för att se till att du har rätt!",
    	cat2inst2: "Det verkar som att läsa böcker gör att du får utmärkelser som dessa vingar! Kanske kan du använda dem för att flyga iväg på jakt efter resten av böckerna!"
    };
    var category2$1 = {
    	cat2inst: "WOW - du har precis fått besvärjelseförmågan! Kom bara ihåg att besvärja dig om du har problem med att hitta Svens böcker!"
    };
    var category3$1 = {
    	cat3inst: "Du har förvandlats till en ganska liten älva - först vingar, sedan trollformning och nu älvadamm! Jag undrar om du behöver lägga den i nästa kapitel för att hitta de böckerna!"
    };
    var category4$1 = {
    	cat4inst: "Det verkar vara lite mörker på väg - bra att du belönades med ljuset. Fortsätt gå och se dina steg!"
    };
    var category5$1 = {
    	cat5inst: "Du gjorde det! Du har hittat alla Svens böcker och fått den största utmärkelsen en älva kan önska sig - ett trollspö! Låt oss gå och berätta för Sven om våra äventyr!"
    };
    var sv = {
    	descendantsTitle: descendantsTitle$1,
    	adolescenceBalanceTitle: adolescenceBalanceTitle$1,
    	supportandmobilityTitle: supportandmobilityTitle$1,
    	primarycareTitle: primarycareTitle$1,
    	informatoryTitle: informatoryTitle$1,
    	libraryForward: libraryForward$1,
    	libraryBackward: libraryBackward$1,
    	closeTheBook: closeTheBook$1,
    	homepage: homepage$1,
    	library: library$1,
    	category1: category1$1,
    	category2: category2$1,
    	category3: category3$1,
    	category4: category4$1,
    	category5: category5$1
    };

    var descendantsTitle = "Mladunci";
    var adolescenceBalanceTitle = "Ravnoteža Mladosti";
    var supportandmobilityTitle = "Podrška i mobilnost";
    var primarycareTitle = "Primarna zdravstvena zaštita";
    var informatoryTitle = "Informativno";
    var libraryForward = "Naprijed";
    var libraryBackward = "Natrag";
    var closeTheBook = "Vrati";
    var homepage = {
    	allProjects: "Svi projekti",
    	cookies: "Ova web stranica koristi kolačiće kako bi osigurala najbolje iskustvo na našoj web stranici.",
    	acceptCookies: "Njam, kolačići",
    	declineCookies: "Ne, hvala",
    	accTextSize: "Promjena veličine teksta:",
    	accLetterSpacing: "Promjena razmaka slova:",
    	accWordSpacing: "Promjena razmaka riječi:",
    	accLineHeight: "Promjena visine linije:",
    	helpTitle: "Dobrodošli u knjižnicu!",
    	helpP1: "Za kretanje možeš pomicati kotač miša gore ili dolje. Također možeš koristiti tipke sa strelicama gore i dolje!",
    	helpP2: "Kada pronađeš knjigu, pokušaj kliknuti na nju da bi mogao čitati o našim sjajnim projektima :)",
    	helpP3: "Ili upotrijebi tab da dodeš do knjige te zatim pritisni Enter da bi ju otvorio/la i zatvorio/la. Za kretanje unatrag koristi Shift+Tab.",
    	helpP4: "Ako zatrebaš pomoć samo klikni na ? u gornjem desnom kutu ;)",
    	helpContinue: "Nastavi",
    	welcomeText: "Dobrodošao/la u knjižnicu! Nalaziš se KLIK/ENTER daleko od prelaska praga njezinog čarobnog svijeta..."
    };
    var library = {
    	dialogSven1: "Pozdrav! Tako sam sretan što si tu! Čini se da sam izgubio neke knjige u knjižnici i treba mi tvoja pomoć da ih pronađem.",
    	dialogGirl1: "Rado ću ti pomoći!",
    	dialogSven2: "Zauvijek sam zahvalan! Ako samo SCROLLaš dublje u knjižnicu, siguran sam da ih nećeš imati problema naći negdje usput. Ako skrolanje čini pokret prebrz za tvoj ukus, pritisni prema DOLJE i uspori cijelu stvar.",
    	dialogSven3: "Vidim da, ne samo da si mi vratila sve moje knjige, već si i dosegla svoj puni potencijal postavši vila! Zauvijek sam ti dužan!",
    	dialogFairy2: "Hvala ti što si me poslao na ovu misiju, Svene. Vrijeme je da odem tamo gdje se prava magija događa! https://www.di-mh.com/",
    	btnText1: "Dalje",
    	btnText2: "Nastavi",
    	talkToSven: "Pričaj sa Svenom",
    	lobby: "Natrag u predsoblje"
    };
    var category1 = {
    	cat1inst1: "Čini se da si pronašao/la neke od Svenovih knjiga! Najbolje je da ih provjeriš kako bi bio/la siguran/sigurna da imaš one prave!",
    	cat2inst2: "Izgleda da čitanje knjiga dovodi do nagrada poput ovih krila! Možda ih možeš iskoristiti da odletiš u potragu za ostatkom knjiga!"
    };
    var category2 = {
    	cat2inst: "WOW - upravo si dobio/la sposobnost bacanja čarolija! Ne zaboravi baciti neke od čarolija ako ćeš imati problema s pronalaženjem Svenovih knjiga!!"
    };
    var category3 = {
    	cat3inst: "Pretvario/la si se u pravu malu vilu - prvo krila, zatim čarolije, a sada i vilinski prah! Pitam se hoćeš li ga morati baciti u sljedećem poglavlju da pronađeš Svenove knjige!"
    };
    var category4 = {
    	cat4inst: "Izgleda da se približava neka tama - dobro da si nagrađen/a svjetlom. Samo tako nastavi i pazi kuda hodaš!"
    };
    var category5 = {
    	cat5inst: "Uspio/la si! Sve Svenove knjige su pronađene i dobio/la si najveću nagradu koju vila može poželjeti - čarobni štapić! Idemo reći Svenu o našim avanturama!"
    };
    var hr = {
    	descendantsTitle: descendantsTitle,
    	adolescenceBalanceTitle: adolescenceBalanceTitle,
    	supportandmobilityTitle: supportandmobilityTitle,
    	primarycareTitle: primarycareTitle,
    	informatoryTitle: informatoryTitle,
    	libraryForward: libraryForward,
    	libraryBackward: libraryBackward,
    	closeTheBook: closeTheBook,
    	homepage: homepage,
    	library: library,
    	category1: category1,
    	category2: category2,
    	category3: category3,
    	category4: category4,
    	category5: category5
    };

    m("en", en);
        m("sv", sv);
        m("hr", hr);

        $({ fallbackLocale: "en", initialLocale: "en" });

    const app = new App({
    	target: document.body,
    	hydrate: true
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
