/**
 * Applies the stored theme before first paint, so a dark-mode admin does not
 * get a white flash on every navigation.
 *
 * Rendered with the request's CSP nonce — see `src/proxy.ts`.
 */
export const THEME_INIT =
  '(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark");}catch(e){}})();';
