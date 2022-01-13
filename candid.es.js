const webImports = new Set();
var index = async () => {
  await webImport(getBaseUrl(), document, webImports);
  process();
};
const isValidName = (() => {
  const PCENChar = "[-.0-9_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]";
  const regexp = new RegExp(`^[a-z]${PCENChar}*-${PCENChar}*$`, "u");
  const reservedWords = ["annotation-xml", "color-profile", "font-face", "font-face-src", "font-face-uri", "font-face-format", "font-face-name", "missing-glyph"];
  return (name2) => regexp.test(name2) && !reservedWords.includes(name2);
})();
function process() {
  document.querySelectorAll("web-component").forEach((elem) => {
    try {
      const name = elem.getAttribute("name");
      if (name === null) {
        console.warn("[candid] Missing custom element name.", elem);
        return;
      }
      if (!isValidName(name)) {
        console.warn("[candid] Invalid custom element name: '" + name + "'. See https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name", elem);
        return;
      }
      const mode = elem.getAttribute("mode");
      if (mode !== null && mode !== "open" && mode !== "closed") {
        console.warn("[candid] Invalid shadowRoot mode: '" + mode + "'. Valid values are 'open', 'closed' (or omit attribute). See https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/mode", elem);
        return;
      }
      const props = (elem == null ? void 0 : elem.hasAttribute("props")) && eval("(" + elem.getAttribute("props") + ")") || {};
      if (props === null || typeof props !== "object") {
        console.warn("[candid] Invalid props: '" + props + "'. Must be an object.", elem);
        return;
      }
      const template = elem.querySelector("template");
      const C = createClass(template, mode, props);
      customElements.define(name, C);
    } catch (err) {
      console.error("[candid] Error processing custom element:", elem, err);
    }
  });
}
const __ctx = Symbol();
function createClass(template, mode, props) {
  const script = template && Array.from(template.content.querySelectorAll("script")).map((s) => s.parentNode.removeChild(s).textContent).join(";\n");
  class C extends HTMLElement {
    constructor() {
      super();
      const root = mode === "open" || mode === "closed" ? this.attachShadow({ mode }) : this;
      root.appendChild(template.content.cloneNode(true));
      Object.defineProperty(this, __ctx, {
        value: createContext(this, root)
      });
      if (script) {
        (function() {
          eval(script);
        }).bind(this[__ctx])();
      }
    }
    static get observedAttributes() {
      return Object.keys(props);
    }
    connectedCallback() {
      if (!this.isConnected) {
        return;
      }
      if (this[__ctx].__uninitialized) {
        delete this[__ctx].__uninitialized;
        Object.entries(props).forEach(([prop, defaultValue]) => {
          let value = defaultValue;
          if (this.hasOwnProperty(prop)) {
            value = this[prop];
            delete this[prop];
          }
          createProperty(this, prop, defaultValue);
          if (!this.hasAttribute(prop)) {
            this[prop] = value;
          }
        });
      }
      this.addEventListener("slotchange", this[__ctx].onSlotChange);
      this[__ctx].onMount();
    }
    disconnectedCallback() {
      this[__ctx].onUnmount();
      this.removeEventListener("slotchange", this[__ctx].onSlotChange);
    }
    attributeChangedCallback(name2, oldValue, newValue) {
      this[__ctx].onUpdate(name2, oldValue, newValue);
    }
    adoptedCallback() {
      this[__ctx].onAdopt();
    }
  }
  return C;
}
function createProperty(target, prop, defaultValue) {
  const propertyDescriptor = typeof defaultValue === "boolean" ? {
    get() {
      return this.hasAttribute(prop);
    },
    set(value) {
      if (value) {
        this.setAttribute(prop, "");
      } else {
        this.removeAttribute(prop);
      }
    },
    enumerable: true
  } : {
    get() {
      return this.getAttribute(prop);
    },
    set(value) {
      if (value === null || value === void 0) {
        this.removeAttribute(prop);
      } else {
        this.setAttribute(prop, value);
      }
    },
    enumerable: true
  };
  Object.defineProperty(target, prop, propertyDescriptor);
}
function createContext(element, root2) {
  const context = {
    __uninitialized: true,
    element,
    root: root2,
    onMount() {
    },
    onUnmount() {
    },
    onUpdate(name2, oldValue, newValue) {
    },
    onSlotChange(event) {
    },
    onAdopt() {
    }
  };
  return Object.defineProperties(context, {
    element: {
      configurable: false,
      enumerable: true,
      writable: false
    },
    root: {
      configurable: false,
      enumerable: true,
      writable: false
    }
  });
}
async function webImport(base, element, visited) {
  await Promise.all(Array.from(element.querySelectorAll("web-import")).map(async (el) => {
    switch (el.getAttribute("status")) {
      case "loading":
        break;
      case "error":
        break;
      default:
        el.setAttribute("status", "loading");
        try {
          const href = el.getAttribute("href");
          const resourceUrl = createUrl(base, href);
          if (visited.has(resourceUrl)) {
            break;
          } else {
            visited.add(resourceUrl);
          }
          const response = await fetch(resourceUrl);
          if (response.ok) {
            const content = await response.text();
            const fragment = document.createRange().createContextualFragment(content);
            const newBaseUrl = extractBaseUrl(resourceUrl);
            await webImport(newBaseUrl, fragment, visited);
            el.parentNode.replaceChild(fragment, el);
          } else {
            el.setAttribute("status", "error");
            el.textContent = `${response.status} ${response.statusText}`;
          }
        } catch (error) {
          el.setAttribute("status", "error");
          el.textContent = error.message;
        }
    }
  }));
}
function extractBaseUrl(href) {
  return href.substring(0, href.lastIndexOf("/")) + "/";
}
function createUrl(base, href) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  } else if (href.startsWith("/")) {
    return base.endsWith("/") ? base + href.substring(1) : base + href;
  } else {
    return base.endsWith("/") ? base + href : base + "/" + href;
  }
}
function getBaseUrl() {
  const base = document.head.querySelector("base");
  if (base) {
    return base.href;
  }
  return document.URL;
}
export { index as default };
