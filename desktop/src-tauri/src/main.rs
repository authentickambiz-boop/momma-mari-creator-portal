//! Desktop window for https://www.mommamari.com/portal/worlds.
//! Size, position, and monitor are restored by the window-state plugin.
//! The window stays on the bot office. Other portal pages are cancelled.
//! grokbot:// links are handed to the operating system so the Grok Bot app opens.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::OnceLock;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

const WORLDS_URL: &str = "https://www.mommamari.com/portal/worlds";

static APP: OnceLock<AppHandle> = OnceLock::new();

const DESKTOP_LOCK: &str = r#"
(() => {
  const WORLDS = "https://www.mommamari.com/portal/worlds";
  const bare = (path) => (path.length > 1 ? path.replace(/\/+$/, "") : path);
  const allowedPath = (path) => {
    const value = bare(path);
    return value === "/portal/worlds"
      || value.startsWith("/portal/worlds/")
      || value === "/portal/login"
      || value === "/portal/api/auth"
      || value.startsWith("/portal/api/auth/")
      || value === "/portal/api/worlds"
      || value.startsWith("/portal/api/worlds/")
      || value === "/api/worlds"
      || value.startsWith("/api/worlds/")
      || value === "/api/auth"
      || value.startsWith("/api/auth/");
  };
  const named = (host, root) => host === root || host.endsWith("." + root);
  const googleHost = (host) => named(host, "google.com") || named(host, "googleapis.com") || named(host, "gstatic.com") || named(host, "googleusercontent.com");
  const mommaHost = (host) => host === "mommamari.com" || host === "www.mommamari.com";
  const allowed = (url) => {
    if (url.protocol === "grokbot:") return true;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (googleHost(host)) return url.protocol === "https:";
    if (mommaHost(host)) return allowedPath(url.pathname);
    return false;
  };
  document.addEventListener("click", (event) => {
    const node = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!node) return;
    const href = node.getAttribute("href") || "";
    if (/^grokbot:/i.test(href)) {
      event.preventDefault();
      window.location.assign(href);
      return;
    }
    let url;
    try { url = new URL(href, window.location.href); } catch { return; }
    if (!allowed(url)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  const guard = (original) => function (state, title, url) {
    if (url != null) {
      try {
        const next = new URL(String(url), window.location.href);
        if (!allowed(next)) return;
      } catch { return; }
    }
    return original.call(this, state, title, url);
  };
  history.pushState = guard(history.pushState);
  history.replaceState = guard(history.replaceState);
  const onWorlds = () => {
    const path = bare(location.pathname);
    return path === "/portal/worlds" || path.startsWith("/portal/worlds/");
  };
  const watch = new MutationObserver(() => hidePortalMenu());
  const hidePortalMenu = () => {
    if (onWorlds()) {
      watch.disconnect();
      return;
    }
    const menu = document.querySelector(".portal-side, .account-menu, .portal-app");
    if (!menu) return;
    menu.setAttribute("hidden", "");
    watch.disconnect();
    location.replace(WORLDS);
  };
  document.addEventListener("DOMContentLoaded", () => {
    if (onWorlds() || !document.documentElement) return;
    hidePortalMenu();
    watch.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
"#;

fn is_grokbot(url: &url::Url) -> bool {
    url.scheme().eq_ignore_ascii_case("grokbot")
}

fn open_grokbot(url: &url::Url) {
    if let Err(error) = open::that(url.as_str()) {
        eprintln!("Could not open {url} in Grok Bot: {error}");
    }
}

fn host_name(url: &url::Url) -> String {
    url.host_str().unwrap_or("").trim_end_matches('.').to_ascii_lowercase()
}

fn host_is(host: &str, root: &str) -> bool {
    host == root || host.ends_with(&format!(".{root}"))
}

fn host_is_google(host: &str) -> bool {
    host_is(host, "google.com")
        || host_is(host, "googleapis.com")
        || host_is(host, "gstatic.com")
        || host_is(host, "googleusercontent.com")
}

fn host_is_momma(host: &str) -> bool {
    host == "mommamari.com" || host == "www.mommamari.com"
}

fn portal_path_allowed(path: &str) -> bool {
    let bare = if path.len() > 1 { path.trim_end_matches('/') } else { path };
    bare == "/portal/worlds"
        || bare.starts_with("/portal/worlds/")
        || bare == "/portal/login"
        || bare == "/portal/api/auth"
        || bare.starts_with("/portal/api/auth/")
        || bare == "/portal/api/worlds"
        || bare.starts_with("/portal/api/worlds/")
        || bare == "/api/worlds"
        || bare.starts_with("/api/worlds/")
        || bare == "/api/auth"
        || bare.starts_with("/api/auth/")
}

fn navigation_allowed(url: &url::Url) -> bool {
    if url.scheme() == "about" {
        return url.path() == "blank" || url.path() == "srcdoc";
    }
    let host = host_name(url);
    if host_is_google(&host) {
        return url.scheme() == "https";
    }
    if host_is_momma(&host) {
        return url.scheme() == "https" && portal_path_allowed(url.path());
    }
    false
}

fn send_back_to_worlds() {
    let Some(app) = APP.get() else { return };
    let app = app.clone();
    let window_app = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(window) = window_app.get_webview_window("main") else { return };
        let Ok(worlds) = WORLDS_URL.parse() else { return };
        let _ = window.navigate(worlds);
    });
}

fn desktop_user_agent() -> &'static str {
    if cfg!(target_os = "macos") {
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
    } else {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
    }
}

fn main() {
    let remembered = StateFlags::SIZE
        | StateFlags::POSITION
        | StateFlags::MAXIMIZED
        | StateFlags::FULLSCREEN
        | StateFlags::VISIBLE;

    tauri::Builder::default()
        .plugin(
            WindowStateBuilder::new()
                .with_state_flags(remembered)
                .build(),
        )
        .setup(|app| {
            let _ = APP.set(app.handle().clone());
            let worlds: url::Url = WORLDS_URL.parse().expect("worlds url");
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(worlds))
                .title("Momma Mari Worlds")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .resizable(true)
                .visible(false)
                .center()
                .focused(true)
                .user_agent(desktop_user_agent())
                .initialization_script(DESKTOP_LOCK)
                .on_navigation(|url| {
                    if is_grokbot(url) {
                        open_grokbot(url);
                        return false;
                    }
                    if navigation_allowed(url) {
                        return true;
                    }
                    if host_is_momma(&host_name(url)) {
                        send_back_to_worlds();
                    }
                    false
                })
                .on_new_window(|url, _features| {
                    if is_grokbot(&url) {
                        open_grokbot(&url);
                        return tauri::webview::NewWindowResponse::Deny;
                    }
                    if navigation_allowed(&url) {
                        tauri::webview::NewWindowResponse::Allow
                    } else {
                        tauri::webview::NewWindowResponse::Deny
                    }
                })
                .build()?;

            // Quit and fullscreen only. No item opens the creator portal.
            let fullscreen = MenuItem::with_id(app, "fullscreen", "Toggle Fullscreen", true, Some("F11"))?;
            let view = Submenu::with_items(app, "View", true, &[&fullscreen])?;
            let quit = PredefinedMenuItem::quit(app, Some("Quit Momma Mari Worlds"))?;
            let app_menu = Submenu::with_items(app, "Momma Mari Worlds", true, &[&quit])?;
            let menu = Menu::with_items(app, &[&app_menu, &view])?;
            app.set_menu(menu)?;
            app.on_menu_event(|app_handle, event| {
                if event.id().as_ref() != "fullscreen" {
                    return;
                }
                if let Some(win) = app_handle.get_webview_window("main") {
                    if let Ok(current) = win.is_fullscreen() {
                        let _ = win.set_fullscreen(!current);
                    }
                }
            });

            if !window.is_visible().unwrap_or(false) {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Momma Mari Worlds failed to start");
}
