//! Desktop window for https://mommamari.com/worlds.
//! Size, position, and monitor are restored by the window-state plugin.
//! grokbot:// links are handed to the operating system so the Grok Bot app opens.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

const WORLDS_URL: &str = "https://mommamari.com/worlds";

const GROKBOT_CLICKS: &str = r#"
(() => {
  document.addEventListener("click", (event) => {
    const node = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!node) return;
    const href = node.getAttribute("href") || "";
    if (!/^grokbot:/i.test(href)) return;
    event.preventDefault();
    window.location.assign(href);
  }, true);
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
                .initialization_script(GROKBOT_CLICKS)
                .on_navigation(|url| {
                    if is_grokbot(url) {
                        open_grokbot(url);
                        return false;
                    }
                    true
                })
                .on_new_window(|url, _features| {
                    if is_grokbot(&url) {
                        open_grokbot(&url);
                        tauri::webview::NewWindowResponse::Deny
                    } else {
                        tauri::webview::NewWindowResponse::Allow
                    }
                })
                .build()?;

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
