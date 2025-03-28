/* http://Github.com/Canop/hu.js */

// A simple SVG library by denys.seguret@gmail.com
;(() => {
	let nn = 1; // counter for dynamically generated def id
	const U = function (n) {
		this.n = n;
	};
	const fn = U.prototype;
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
					ù("<rect", n).attr({ width: "100%", height: "100%", opacity: 0 });
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

	const ù = createU;
	window.ù = createU;
	window.hu = createU;
	ù.fn = fn; // so that ù can be easily extended

	// reverse camel case : "strokeOpacity" -> "stroke-opacity"
	function rcc(n) {
		return n.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
	}

	fn.append = function (a) {
		this.n.appendChild(node(a));
		return this;
	};
	fn.prependTo = function (a) {
		a = node(a);
		a.insertBefore(this.n, a.firstChild);
		return this;
	};

	// removes the graphical nodes, not the defs
	// (to remove everything, just call the standard DOM functions)
	fn.empty = function () {
		for (let l = this.n.childNodes, i = l.length; i--; ) {
			if (!/^defs$/i.test(l[i].tagName)) this.n.removeChild(l[i]);
		}
		return this;
	};

	fn.autoid = function () {
		return this.attrnv("id", `ù${nn++}`);
	};

	fn.text = function (s) {
		this.empty().n.appendChild(document.createTextNode(s));
		return this;
	};

	// stores the passed element in the closest SVG parent of this
	//  and gives it an automatic id.
	fn.def = function (a) {
		const u = ù(a);
		let p = this;
		while (p) {
			if (p.n.tagName === "svg") {
				(ù("defs", p) || ù("<defs", p.n)).n.appendChild(u.n);
				return u.autoid();
			}
			p = ù(p.parentNode);
		}
		throw new Error("No parent SVG");
	};

	fn.stops = function () {
		for (let i = 0; i < arguments.length; i++) {
			ù("<stop", this).attr(arguments[i]);
		}
		return this;
	};

	fn.rgrad = function (cx, cy, r, c1, c2) {
		return this.def("<radialGradient")
			.attr({ cx: cx, cy: cy, r: r })
			.stops(
				{ offset: "0%", stopColor: c1 },
				{ offset: "100%", stopColor: c2 },
			);
	};

	fn.width = function (v) {
		// window.getComputedStyle is the only thing that seems to work on FF when there are nested svg elements
		if (v === undefined)
			return (
				this.n.getBBox().width ||
				Number.parseInt(window.getComputedStyle(this.n).width)
			);
		return this.attrnv("width", v);
	};
	fn.height = function (v) {
		if (v === undefined)
			return (
				this.n.getBBox().height ||
				Number.parseInt(window.getComputedStyle(this.n).height)
			);
		return this.attrnv("height", v);
	};

	// css name value
	fn.cssnv = function (name, value) {
		name = rcc(name);
		if (value === undefined) return this.n.style[name];
		if (typeof value === "number" && !nopx[name]) value += "px";
		this.n.style[name] = value;
		return this;
	};

	fn.css = function (a1, a2) {
		if (typeof a1 === "string") return this.cssnv(a1, a2);
		for (const k in a1) this.cssnv(k, a1[k]);
		return this;
	};

	// attr name value
	fn.attrnv = function (name, value) {
		if (value === undefined) return this.n.getAttributeNS(null, name);
		if (value instanceof U) value = `url(#${value.n.id})`;
		this.n.setAttributeNS(null, name, value);
		return this;
	};

	fn.attr = function (a1, a2) {
		if (typeof a1 === "string") return this.attrnv(a1, a2);
		for (const k in a1) {
			this.attrnv(k, a1[k]);
		}
		return this;
	};

	fn.on = function (et, f) {
		for (const evt of et.split(" ")) {
			this.n.addEventListener(evt, f);
		}
		return this;
	};
	fn.off = function (et, f) {
		for (const evt of et.split(" ")) {
			this.n.removeEventListener(evt, f);
		};
		return this;
	};
	fn.remove = function () {
		if (this.n.parentNode) this.n.parentNode.removeChild(this.n);
		return this;
	};

	// dst is a map containing the destination css or attribute keys and values
	fn.animate = function (dst, duration, cb) {
		const u = this;
		const vars = [];
		// the goal of this iteration is to build an array of objects for the animable properties, with
		//  - v.k : the key
		//  - v.f : the function used to set the style or attribute (fn.css or fn.attr)
		//  - v.s : the start value
		//  - v.e  : the end value
		for (let k in dst) {
			const dstk = dst[k];
			k = rcc(k);
			const v = { k: k, e: dstk };
			const sk = this.n.style[k];
			if (sk !== undefined && sk !== "") {
				// 0 or "0" would be ok
				v.f = fn.css;
				v.s = Number.parseFloat(sk);
			} else {
				v.f = fn.attr;
				const d = this.n[k] || this.attr(k);
				if (d) {
					v.s = Number.parseFloat(d.baseVal ? d.baseVal.value : d); // you have a baseval for example in SVGAnimatedLength
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

	for (const n in fn) {
		if (typeof fn[n] === "function") ù[n] = fn[n];
	}
})();
