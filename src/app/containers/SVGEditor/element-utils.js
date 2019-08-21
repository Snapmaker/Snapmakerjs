import isNumber from 'lodash/isNumber';

const NAMESPACES = {
    SVG: 'http://www.w3.org/2000/svg'
};

function toXml(str) {
    // &apos; is ok in XML, but not HTML
    // &gt; does not normally need escaping, though it can if within a CDATA expression (and preceded by "]]")
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;'); // Note: `&apos;` is XML only
}

function shortFloat(val) {
    const digits = 5;
    if (!Number.isNaN(val)) {
        return Number(Number(val).toFixed(digits));
    }
    if (Array.isArray(val)) {
        return `${shortFloat(val[0])},${shortFloat(val[1])}`;
    }
    return parseFloat(val).toFixed(digits) - 0;
}


// TODO: add more defaults if needed
const defaultAttributes = {
    opacity: 1,
    stroke: 'none',
    rx: 0,
    ry: 0
};

function cleanupAttributes(elem) {
    if (elem.nodeName === 'ellipse') {
        // Ellipse elements require rx and ry attributes
        delete defaultAttributes.rx;
        delete defaultAttributes.ry;
    }

    for (const [key, value] of Object.entries(defaultAttributes)) {
        if (elem.getAttribute(key) === String(value)) {
            elem.removeAttribute(key);
        }
    }
}

/**
 * Set multiple attribute at once.
 *
 * @param elem
 * @param attributes
 */
function setAttributes(elem, attributes) {
    for (const [key, value] of Object.entries(attributes)) {
        elem.setAttribute(key, value);
    }
}

// Export SVG
function toString(elem, indent) {
    const out = [];
    out.push(new Array(indent).join(' '));

    switch (elem.nodeType) {
        case 1: {
            // element node
            cleanupAttributes(elem);

            const attrs = Object.values(elem.attributes);
            attrs.sort((a, b) => {
                return a.name > b.name ? -1 : 1;
            });

            out.push('<');
            out.push(elem.nodeName);


            for (let i = attrs.length - 1; i >= 0; i--) {
                const attr = attrs[i];
                let attrVal = toXml(attr.value);
                if (attrVal !== '') {
                    if (attrVal.startsWith('pointer-events')) {
                        continue;
                    }
                    out.push(' ');

                    if (isNumber(attrVal)) {
                        attrVal = shortFloat(attrVal);
                    }

                    out.push(`${attr.nodeName}="${attrVal}"`);
                }
            }

            if (elem.hasChildNodes()) {
                out.push('>');

                for (let i = 0; i < elem.childNodes.length; i++) {
                    const child = elem.childNodes.item(i);

                    const childOutput = toString(child, indent + 1);
                    if (childOutput) {
                        out.push('\n');
                        out.push(childOutput);
                    }
                }

                out.push('\n');
                out.push(new Array(indent).join(' '));
                out.push(`</${elem.nodeName}>`);
            } else {
                out.push('/>');
            }

            break;
        }
        case 3: {
            // text
            const str = elem.nodeValue.replace(/^\s+|\s+$/g, '');
            if (str === '') {
                return '';
            } else {
                out.push(toXml(str));
            }
            break;
        }
        case 4: {
            // CDATA
            out.push(`<![CDATA[${elem.nodeValue}]]>`);
            break;
        }
        case 8: {
            // comment
            out.push(`<!--${elem.data}-->`);
            break;
        }
        default:
            break;
    }

    return out.join('');
}

export {
    NAMESPACES,
    cleanupAttributes,
    setAttributes,
    toString
};
