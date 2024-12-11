let nn = 1; // counter for dynamically generated def id

class U {
    constructor(n) {
        this.n = n;
    }
}

const nopx = new Set([
    "column-count",
    "fill-opacity",
    "flex-grow",
    "flex-shrink",
    "font-weight",
    "opacity",
    "z-index"
]);

function node(a, c) {
    if (a instanceof U) return a.n;
    if (c) c = node(c);
    if (typeof a === "string") {
        const m = a.match(/^\s*<\s*(\w+)\s*>?\s*$/);
        if (m) {
            const n = document.createElementNS("http://www.w3.org/2000/svg", m[1]);
            if (/^svg$/i.test(n.tagName)) {
                // hack to force Firefox to see the dimension of the element
                createU("<rect", n).attr({ width: "100%", height: "100%", opacity: 0 });
            }
            return n;
        }
        return (c || document).querySelector(a);
    }
    return a[0] || a; // to support jQuery elements and nodelists
}

function createU(elem, container) {
    if (!container) return new U(node(elem));
    const resolvedContainer = node(container);
    const resolvedElem = node(elem, resolvedContainer);
    if (!resolvedElem) return null;
    if (resolvedContainer && !resolvedElem.parentNode) resolvedContainer.appendChild(resolvedElem);
    return new U(resolvedElem);
}

// reverse camel case : "strokeOpacity" -> "stroke-opacity"
function rcc(n) {
    return n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
}

// Instance methods
U.prototype.append = function(a) {
    this.n.appendChild(node(a));
    return this;
};

U.prototype.prependTo = function(a) {
    a = node(a);
    a.insertBefore(this.n, a.firstChild);
    return this;
};

// removes the graphical nodes, not the defs
U.prototype.empty = function() {
    for (let l = this.n.childNodes, i = l.length; i--;) {
        if (!/^defs$/i.test(l[i].tagName)) this.n.removeChild(l[i]);
    }
    return this;
};

U.prototype.autoid = function() {
    return this.attrnv("id", `ù${nn++}`);
};

U.prototype.text = function(s) {
    this.empty().n.appendChild(document.createTextNode(s));
    return this;
};

U.prototype.def = function(a) {
    const u = createU(a);
    let p = this;
    while (p) {
        if (p.n.tagName === "svg") {
            (createU("defs", p) || createU("<defs", p.n)).n.appendChild(u.n);
            return u.autoid();
        }
        p = createU(p.parentNode);
    }
    throw new Error("No parent SVG");
};

U.prototype.stops = function(...args) {
    for (let i = 0; i < args.length; i++) {
        createU("<stop", this).attr(args[i]);
    }
    return this;
};

U.prototype.rgrad = function(cx, cy, r, c1, c2) {
    return this.def("<radialGradient")
        .attr({ cx, cy, r })
        .stops(
            { offset: "0%", stopColor: c1 },
            { offset: "100%", stopColor: c2 }
        );
};

U.prototype.width = function(v) {
    if (v === undefined) {
        return this.n.getBBox().width ||
            Number.parseInt(window.getComputedStyle(this.n).width);
    }
    return this.attrnv("width", v);
};

U.prototype.height = function(v) {
    if (v === undefined) {
        return this.n.getBBox().height ||
            Number.parseInt(window.getComputedStyle(this.n).height);
    }
    return this.attrnv("height", v);
};

U.prototype.cssnv = function(name, value) {
    name = rcc(name);
    if (value === undefined) return this.n.style[name];
    if (typeof value === "number" && !nopx[name]) value += "px";
    this.n.style[name] = value;
    return this;
};

U.prototype.css = function(a1, a2) {
    if (typeof a1 === "string") return this.cssnv(a1, a2);
    for (const k in a1) this.cssnv(k, a1[k]);
    return this;
};

U.prototype.attrnv = function(name, value) {
    name = rcc(name);
    if (value === undefined) return this.n.getAttributeNS(null, name);
    if (value instanceof U) value = `url(#${value.n.id})`;
    this.n.setAttributeNS(null, name, value);
    return this;
};

U.prototype.attr = function(a1, a2) {
    if (typeof a1 === "string") return this.attrnv(a1, a2);
    for (const k in a1) {
        this.attrnv(k, a1[k]);
    }
    return this;
};

U.prototype.on = function(et, f) {
    for (const evt of et.split(" ")) {
        this.n.addEventListener(evt, f);
    }
    return this;
};

U.prototype.off = function(et, f) {
    for (const evt of et.split(" ")) {
        this.n.removeEventListener(evt, f);
    }
    return this;
};

U.prototype.remove = function() {
    if (this.n.parentNode) this.n.parentNode.removeChild(this.n);
    return this;
};

U.prototype.animate = function(dst, duration, cb) {
    const u = this;
    const vars = [];
    for (let k in dst) {
        const dstk = dst[k];
        k = rcc(k);
        const v = { k, e: dstk };
        const sk = this.n.style[k];
        if (sk !== undefined && sk !== "") {
            v.f = U.prototype.css;
            v.s = Number.parseFloat(sk);
        } else {
            v.f = U.prototype.attr;
            const d = this.n[k] || this.attr(k);
            if (d) {
                v.s = Number.parseFloat(d.baseVal ? d.baseVal.value : d);
            } else {
                v.s = 0;
            }
        }
        vars.push(v);
    }
    const s = Date.now();
    const e = s + duration;
    (function step(n) {
        n = Date.now();
        for (const v of vars) {
            v.f.call(u, v.k, v.s + ((n - s) * (v.e - v.s)) / duration);
        }
        if (n < e) return setTimeout(step, 10);
        for (const v of vars) {
            v.f.call(u, v.k, v.e);
        }
        if (cb) cb.call(u);
    })();
    return this;
};

// Add static methods to createU
for (const n in U.prototype) {
    if (typeof U.prototype[n] === "function") {
        createU[n] = U.prototype[n];
    }
}

export default createU;