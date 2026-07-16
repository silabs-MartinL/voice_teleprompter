const APP_VERSION = "1.2.0";

document.title += " v" + APP_VERSION;

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".appVersion").forEach(el => {
        el.textContent = "v" + APP_VERSION;
    });
});