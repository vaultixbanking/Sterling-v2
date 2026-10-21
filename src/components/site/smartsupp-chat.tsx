"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"

/** Public by design — it ships in the page to every visitor. */
const SMARTSUPP_KEY = process.env.NEXT_PUBLIC_SMARTSUPP_KEY

/**
 * Where the chat box stays hidden: the admin panel, which is staff answering
 * chats rather than customers asking, and the one-time PIN page, which shows a
 * withdrawal PIN in plain text.
 */
const HIDDEN_PREFIXES = ["/admin", "/pin"]

function isHiddenOn(pathname: string) {
  return HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/**
 * Smartsupp live chat, mounted once at the root.
 *
 * Landing on a hidden route never loads the script. But once it has loaded,
 * a client-side navigation keeps the document — an admin signs in on `/login`
 * and is pushed to `/admin` with the widget already up — so on hidden routes
 * the container is also hidden with CSS.
 *
 * Not `smartsupp("chat:hide")` or `_smartsupp.hideWidget`: on the current
 * Smartsupp plan both are ignored ("Chat box API feature is not enabled"), so
 * the container id is the only handle there is.
 */
export function SmartsuppChat() {
  const hidden = isHiddenOn(usePathname())

  if (!SMARTSUPP_KEY) return null

  if (hidden) {
    return (
      <style>{`#smartsupp-widget-container { display: none !important; }`}</style>
    )
  }

  // Smartsupp's embed snippet, verbatim apart from the key. The id must not be
  // "smartsupp": an element id becomes a window global, and the snippet's
  // `window.smartsupp||` guard would then see it and skip loading.
  return (
    <Script id="smartsupp-embed" strategy="lazyOnload">
      {`var _smartsupp = _smartsupp || {};
_smartsupp.key = ${JSON.stringify(SMARTSUPP_KEY)};
window.smartsupp||(function(d) {
  var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];
  s=d.getElementsByTagName('script')[0];c=d.createElement('script');
  c.type='text/javascript';c.charset='utf-8';c.async=true;
  c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);
})(document);`}
    </Script>
  )
}
