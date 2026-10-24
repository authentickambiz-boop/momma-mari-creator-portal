//! Worlds window lock. The creator portal is not a navigation target.
//! Bundled assets may describe a later local game. This build still returns the office URL.

pub const WORLDS_URL: &str = "https://www.mommamari.com/portal/worlds";

pub fn json_string_field(manifest: &str, field: &str) -> Option<String> {
    let pattern = format!("\"{field}\"");
    let mut rest = manifest;
    while let Some(index) = rest.find(&pattern) {
        let trimmed = rest[index + pattern.len()..].trim_start();
        if !trimmed.starts_with(':') {
            rest = &rest[index + pattern.len()..];
            continue;
        }
        let value = trimmed[1..].trim_start();
        if !value.starts_with('"') {
            return None;
        }
        let mut out = String::new();
        let mut escaped = false;
        for ch in value[1..].chars() {
            if escaped {
                out.push(ch);
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == '"' {
                return Some(out);
            }
            out.push(ch);
        }
        return None;
    }
    None
}

/// The return type is the office constant, so a manifest cannot select the creator portal.
pub fn launch_url_from_assets(manifest: &str) -> &'static str {
    let mode = json_string_field(manifest, "mode").unwrap_or_default();
    let url = json_string_field(manifest, "url").unwrap_or_default();
    if mode == "webview" && url == WORLDS_URL {
        return WORLDS_URL;
    }
    WORLDS_URL
}

pub fn worlds_launch_line(url: &str, assets: &str) -> String {
    format!("WORLDS_LAUNCH url={url} assets={assets} updater=check")
}

pub fn updater_result_line(result: &str) -> String {
    format!("WORLDS_UPDATER result={result}")
}

pub fn host_name(url: &url::Url) -> String {
    url.host_str()
        .unwrap_or("")
        .trim_end_matches('.')
        .to_ascii_lowercase()
}

/// Sign-in hosts only. Gmail, Drive, Docs, and Calendar are not in this list.
pub fn host_is_google_auth(host: &str) -> bool {
    matches!(
        host,
        "accounts.google.com"
            | "accounts.youtube.com"
            | "myaccount.google.com"
            | "www.google.com"
            | "oauth2.googleapis.com"
            | "www.googleapis.com"
            | "apis.google.com"
            | "ssl.gstatic.com"
            | "www.gstatic.com"
            | "fonts.gstatic.com"
            | "lh3.googleusercontent.com"
    )
}

pub fn host_is_momma(host: &str) -> bool {
    host == "mommamari.com" || host == "www.mommamari.com"
}

pub fn portal_path_allowed(path: &str) -> bool {
    let bare = if path.len() > 1 {
        path.trim_end_matches('/')
    } else {
        path
    };
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

pub fn navigation_allowed(url: &url::Url) -> bool {
    if url.scheme() == "about" {
        return url.path() == "blank" || url.path() == "srcdoc";
    }
    let host = host_name(url);
    if host_is_google_auth(&host) {
        return url.scheme() == "https";
    }
    if host_is_momma(&host) {
        return url.scheme() == "https" && portal_path_allowed(url.path());
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(value: &str) -> url::Url {
        value.parse().unwrap()
    }

    #[test]
    fn office_opens_and_creator_portal_stays_closed() {
        assert!(navigation_allowed(&url(WORLDS_URL)));
        assert!(navigation_allowed(&url(
            "https://www.mommamari.com/portal/worlds/"
        )));
        assert!(navigation_allowed(&url(
            "https://www.mommamari.com/portal/worlds/create"
        )));
        assert!(navigation_allowed(&url(
            "https://mommamari.com/portal/login"
        )));
        assert!(navigation_allowed(&url(
            "https://www.mommamari.com/portal/api/auth/callback"
        )));
        assert!(navigation_allowed(&url(
            "https://www.mommamari.com/portal/api/worlds/status"
        )));
        assert!(navigation_allowed(&url(
            "https://accounts.google.com/o/oauth2/v2/auth"
        )));
        assert!(!navigation_allowed(&url(
            "https://www.mommamari.com/portal"
        )));
        assert!(!navigation_allowed(&url(
            "https://www.mommamari.com/portal/"
        )));
        assert!(!navigation_allowed(&url(
            "https://www.mommamari.com/portal/deals"
        )));
        assert!(!navigation_allowed(&url(
            "https://www.mommamari.com/portal/earnings"
        )));
        assert!(!navigation_allowed(&url("https://www.mommamari.com/")));
        assert!(!navigation_allowed(&url(
            "https://www.mommamari.com/portal/worlds/../deals"
        )));
        assert!(!navigation_allowed(&url(
            "http://www.mommamari.com/portal/worlds"
        )));
        assert!(!navigation_allowed(&url("https://drive.google.com/drive")));
        assert!(!navigation_allowed(&url(
            "https://evil.example/portal/worlds"
        )));

        let manifest = include_str!("../../assets/game.json");
        assert_eq!(launch_url_from_assets(manifest), WORLDS_URL);
        assert_eq!(
            launch_url_from_assets(
                r#"{"mode":"webview","url":"https://www.mommamari.com/portal"}"#
            ),
            WORLDS_URL
        );
        assert_eq!(
            launch_url_from_assets(
                r#"{"mode":"local","url":"https://www.mommamari.com/portal/deals"}"#
            ),
            WORLDS_URL
        );
        assert_eq!(
            json_string_field(manifest, "mode").as_deref(),
            Some("webview")
        );
        let line = worlds_launch_line(WORLDS_URL, "assets");
        assert!(line.starts_with("WORLDS_LAUNCH url=https://www.mommamari.com/portal/worlds "));
        assert!(line.contains("updater=check"));
        assert!(!line.contains("/portal/deals"));
        assert_eq!(updater_result_line("check"), "WORLDS_UPDATER result=check");
        assert_eq!(
            updater_result_line("current"),
            "WORLDS_UPDATER result=current"
        );
    }
}
