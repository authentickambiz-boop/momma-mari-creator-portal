//! Desktop window for https://www.mommamari.com/portal/worlds.
//! Size, position, and monitor are restored by the window-state plugin.
//! The window stays on the bot office. Other portal pages are cancelled.
//! grokbot:// links are handed to the operating system so the Grok Bot app opens.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

mod office_lock;

use office_lock::{
    host_is_momma, host_name, launch_url_from_assets, navigation_allowed, updater_result_line,
    worlds_launch_line, WORLDS_URL,
};

static APP: OnceLock<AppHandle> = OnceLock::new();

fn note_launch(app: &AppHandle, line: &str) {
    eprintln!("{line}");
    let Ok(dir) = app.path().app_log_dir() else {
        return;
    };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("worlds-launch.log"))
    else {
        return;
    };
    let _ = writeln!(file, "{line}");
}

fn bundled_game_manifest(app: &AppHandle) -> (String, Option<String>) {
    let mut candidates = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("assets"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../assets"));
    for assets in candidates {
        if let Ok(text) = std::fs::read_to_string(assets.join("game.json")) {
            return (assets.display().to_string(), Some(text));
        }
    }
    ("missing".into(), None)
}

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
  const googleAuthHosts = {
    "accounts.google.com": 1,
    "accounts.youtube.com": 1,
    "myaccount.google.com": 1,
    "www.google.com": 1,
    "oauth2.googleapis.com": 1,
    "www.googleapis.com": 1,
    "apis.google.com": 1,
    "ssl.gstatic.com": 1,
    "www.gstatic.com": 1,
    "fonts.gstatic.com": 1,
    "lh3.googleusercontent.com": 1
  };
  const googleHost = (host) => Object.prototype.hasOwnProperty.call(googleAuthHosts, host);
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

fn send_back_to_worlds() {
    let Some(app) = APP.get() else { return };
    let app = app.clone();
    let window_app = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(window) = window_app.get_webview_window("main") else {
            return;
        };
        let Ok(worlds) = WORLDS_URL.parse() else {
            return;
        };
        let _ = window.navigate(worlds);
    });
}

const UPDATING_NOTICE: &str = r#"
(() => {
  if (document.getElementById("mm-worlds-updating")) return;
  const bar = document.createElement("div");
  bar.id = "mm-worlds-updating";
  bar.textContent = "Updating…";
  bar.setAttribute("role", "status");
  bar.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1f3b2d;color:#f7f4ee;font:600 14px/1.2 sans-serif;padding:10px 16px;border-radius:999px;";
  (document.body || document.documentElement).appendChild(bar);
})();
"#;

fn show_updating(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.eval(UPDATING_NOTICE);
    let _ = window.set_title("Updating…");
}

fn check_for_update(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = install_update(&app).await {
            note_launch(
                &app,
                &format!("{} error={error}", updater_result_line("skip")),
            );
        }
    });
}

async fn install_update(app: &AppHandle) -> tauri_plugin_updater::Result<()> {
    note_launch(app, &updater_result_line("check"));
    let Some(update) = app.updater()?.check().await? else {
        note_launch(app, &updater_result_line("current"));
        return Ok(());
    };
    note_launch(
        app,
        &format!(
            "{} version={}",
            updater_result_line("update"),
            update.version
        ),
    );
    show_updating(app);
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await?;
    app.restart();
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            WindowStateBuilder::new()
                .with_state_flags(remembered)
                .build(),
        )
        .setup(|app| {
            let _ = APP.set(app.handle().clone());
            let (assets_path, manifest) = bundled_game_manifest(app.handle());
            let launch = launch_url_from_assets(manifest.as_deref().unwrap_or(""));
            note_launch(app.handle(), &worlds_launch_line(launch, &assets_path));
            let worlds: url::Url = launch.parse().expect("worlds url");
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
            let fullscreen =
                MenuItem::with_id(app, "fullscreen", "Toggle Fullscreen", true, Some("F11"))?;
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
            check_for_update(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Momma Mari Worlds failed to start");
}
